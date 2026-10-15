import { ctx } from '../state.js';
import { VERSION } from '../constants.js';
import { storage } from '../storage.js';
import { $, $$, esc, tr, icon3, toast } from '../utils/helpers.js';
import { render } from '../app.js';
import { listQuizBanks, getQuotesResource } from '../resources.js';
import { getRecentQuiz } from './quiz.js';

let homeCountdown = {name:'',date:''};
let homeDayTimer = null;
let homeObservedDay = '';
let homeVisibilityBound = false;

function homeDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function homeDayNumber(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
function validateHomeRecords(records) {
  const value = records['settings:countdown'];
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string' || value.name.length > 120 || typeof value.date !== 'string') throw new Error('倒计时设置格式不正确。');
  if (value.date) {
    const parsed = new Date(value.date + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(parsed.getTime()) || homeDateKey(parsed) !== value.date) throw new Error('倒计时日期无效。');
  }
}
async function initializeHome(records) {
  const saved = records ? records['settings:countdown'] : await storage.get('settings:countdown');
  validateHomeRecords({'settings:countdown':saved});
  homeCountdown = saved ? {...saved} : {name:'',date:''};
  homeObservedDay = homeDateKey();
  homeScheduleDay();
  if (!homeVisibilityBound) {
    document.addEventListener('visibilitychange', homeRefreshDate);
    homeVisibilityBound = true;
  }
}
function homeRefreshDate() {
  const today = homeDateKey();
  if (today !== homeObservedDay) {
    homeObservedDay = today;
    if (ctx.state?.route === 'home') render();
  }
  homeScheduleDay();
}
function homeScheduleDay() {
  clearTimeout(homeDayTimer);
  const now = new Date(), tomorrow = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  homeDayTimer = setTimeout(homeRefreshDate, tomorrow.getTime()-now.getTime()+100);
  homeDayTimer?.unref?.();
}
function homeCountdownDays(date = new Date()) {
  if (!homeCountdown.date) return null;
  const target = new Date(homeCountdown.date + 'T12:00:00');
  return homeDayNumber(target) - homeDayNumber(date);
}
function homeQuoteForDate(resource, date = new Date()) {
  const quotes = resource?.quotes || [];
  if (!quotes.length) return null;
  return quotes[((homeDayNumber(date) % quotes.length) + quotes.length) % quotes.length];
}
function homeBankVersion(subject) {
  const banks = listQuizBanks().filter(item=>item.bank.subject === subject);
  return banks.length ? banks.map(item=>item.bank.name + ' ' + item.bank.version).join(' / ') : tr('尚未安装','Not installed');
}
function homePage() {
  const target = ctx.state.profile.targetSchool.trim();
  const dreams = ctx.state.dreamSchools.filter(name=>name!==target);
  const days = homeCountdownDays(), recent = getRecentQuiz();
  const lastExport = ctx.state.exportHistory.slice().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const quotes = getQuotesResource(), quote = homeQuoteForDate(quotes);
  const dateLabel = new Date().toLocaleDateString(ctx.state.uiLang==='en'?'en':'zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  return '<div class="home-dashboard"><header class="home-intro"><p class="eyebrow">QICHENG / TODAY</p><p class="home-date">'+esc(dateLabel)+'</p><h1>'+tr('每一步，都向梦想靠近。','One step closer to your future.')+'</h1><p class="home-subtitle">'+tr('整理你的成长，拓展每天的所学。','Keep your growth in order. Make room for learning.')+'</p></header>'+ 
    '<div class="home-shortcuts"><button data-go3="profile"><span class="home-shortcut-number">01</span><span><strong>'+tr('信息录入','Your information')+'</strong><small>'+tr('记录、整理与完善成长资料','Record and refine your personal materials')+'</small></span>'+icon3('edit')+'</button><button data-go3="explore"><span class="home-shortcut-number">02</span><span><strong>'+tr('学习拓展中心','Learning center')+'</strong><small>'+tr('答题训练 · 中华文化典籍','Quiz practice & Chinese classics')+'</small></span>'+icon3('chevron')+'</button></div>'+
    '<div class="home-goals"><section class="home-goal"><p class="eyebrow">'+tr('梦想院校','YOUR DESTINATION')+'</p><h2>'+esc(target || dreams[0] || tr('下一站，由你定义。','Choose your next destination.'))+'</h2>'+(target && ctx.state.profile.targetMajor ? '<p>'+esc(ctx.state.profile.targetMajor)+'</p>':'')+(dreams.length?'<p class="hint">'+esc(dreams.join(' · '))+'</p>':'')+'<button class="home-text-button" data-go3="profile">'+tr('完善目标院校','Edit your destination')+' ↗</button></section>'+
    '<section class="home-goal home-countdown"><p class="eyebrow">'+tr('目标倒计时','YOUR NEXT MILESTONE')+'</p><h2>'+esc(homeCountdown.name || tr('给目标一个日期。','Give your goal a date.'))+'</h2><p class="home-countdown-value">'+(days===null?'<span>—</span>':days===0?'<span>'+tr('今天','Today')+'</span>':'<span>'+Math.abs(days)+'</span><small>'+tr(days>0?'天后':'天前',days>0?'days to go':'days ago')+'</small>')+'</p>'+(homeCountdown.date?'<p class="hint">'+esc(homeCountdown.date)+'</p>':'')+'<details class="home-countdown-editor"><summary>'+tr('设置倒计时','Set countdown')+'</summary><form id="homeCountdownForm"><label class="field"><span>'+tr('目标名称','Goal name')+'</span><input name="name" maxlength="120" value="'+esc(homeCountdown.name)+'" placeholder="'+tr('例如：保送考试','e.g. Admission exam')+'"></label><label class="field"><span>'+tr('目标日期','Target date')+'</span><input name="date" type="date" value="'+esc(homeCountdown.date)+'"></label><button type="submit" class="primary">'+tr('保存倒计时','Save countdown')+'</button><p class="hint">'+tr('清空日期并保存即可移除倒计时。','Clear the date and save to remove the countdown.')+'</p></form></details></section></div>'+
    '<section class="home-updates" aria-label="'+tr('近期动态','Recent activity')+'"><div class="home-section-title"><h2>'+tr('近期动态','At a glance')+'</h2><span class="hint">'+tr('左右滑动查看','Swipe to explore')+'</span></div><div class="home-card-rail" id="homeCardRail" tabindex="0"><article class="home-update-card" aria-label="'+tr('最近答题','Recent quiz')+'"><p class="eyebrow">01 / '+tr('最近答题','RECENT PRACTICE')+'</p>'+(recent?'<p class="home-update-stat">'+recent.total+'<small>'+tr('题已完成','completed')+'</small></p><dl><div><dt>'+tr('正确率','Accuracy')+'</dt><dd>'+Math.round(recent.correct/recent.total*100)+'%</dd></div><div><dt>'+tr('练习类型','Practice')+'</dt><dd>'+esc(recent.bankTitle)+' · '+tr(({random:'随机抽题',wrong:'错题复练',favorites:'收藏复练'})[recent.mode]||recent.mode,({random:'Random',wrong:'Mistakes',favorites:'Favorites'})[recent.mode]||recent.mode)+'</dd></div></dl>':'<h3>'+tr('从一组练习开始。','Start with a short practice.')+'</h3><p class="hint">'+tr('提交整组后，这里会显示最近的答题成果。','Your latest result appears after you submit a group.')+'</p>')+'<button data-go3="quiz" class="home-text-button">'+tr('进入答题训练','Open quiz practice')+' ↗</button></article>'+
    '<article class="home-update-card" aria-label="'+tr('最近导出','Recent export')+'"><p class="eyebrow">02 / '+tr('最近导出','RECENT EXPORT')+'</p>'+(lastExport?'<h3>'+esc(lastExport.name)+'</h3><dl><div><dt>'+tr('导出类型','Type')+'</dt><dd>'+esc(lastExport.type.toUpperCase())+'</dd></div><div><dt>'+tr('导出时间','Created')+'</dt><dd>'+esc(new Date(lastExport.createdAt).toLocaleString(ctx.state.uiLang==='en'?'en':'zh-CN'))+'</dd></div></dl>':'<h3>'+tr('你的下一份成果。','Your next finished document.')+'</h3><p class="hint">'+tr('导出简历或文档后，在这里查看最近记录。','Your latest exported document will appear here.')+'</p>')+'<button data-go3="outputs" class="home-text-button">'+tr('查看导出记录','View exports')+' ↗</button></article>'+
    '<article class="home-update-card home-versions" aria-label="'+tr('版本信息','Versions')+'"><p class="eyebrow">03 / '+tr('版本信息','VERSIONS')+'</p><dl><div><dt>'+tr('启程应用','Qicheng')+'</dt><dd>'+VERSION+'</dd></div><div><dt>'+tr('英语题库','English banks')+'</dt><dd>'+esc(homeBankVersion('english'))+'</dd></div><div><dt>'+tr('中文题库','Chinese banks')+'</dt><dd>'+esc(homeBankVersion('chinese'))+'</dd></div><div><dt>'+tr('每日一句','Daily quotes')+'</dt><dd>'+esc(quotes?.version || tr('尚未安装','Not installed'))+'</dd></div></dl><button data-action="resources" class="home-text-button">'+tr('题库与资源管理','Manage banks & resources')+' ↗</button></article></div><div class="home-rail-dots" aria-label="'+tr('信息卡片分页','Activity pages')+'">'+[tr('最近答题','Recent quiz'),tr('最近导出','Recent export'),tr('版本信息','Versions')].map((label,i)=>'<button data-home-card="'+i+'" aria-label="'+esc(label)+'" aria-pressed="'+(i===0)+'"><span></span></button>').join('')+'</div></section>'+
    '<section class="home-quote"><p class="eyebrow">'+tr('每日一句','A THOUGHT FOR TODAY')+'</p>'+(quote?'<blockquote>'+esc(quote.text)+'</blockquote>'+(quote.source?'<p class="home-quote-source">'+esc(quote.source)+'</p>':''):'<p class="home-quote-empty">'+tr('每日一句资源尚未安装','Daily quotes have not been installed')+'</p>')+'</section></div>';
}
function backupPage() {
  return '<div class="backup-page"><p class="eyebrow">QICHENG / YOUR DATA</p><h1>'+tr('保存与备份','Save & backup')+'</h1><p class="home-subtitle">'+tr('资料自动保存在此设备。定期留一份备份，让成长有所归档。','Your work saves on this device. Keep a backup of what matters.')+'</p><div class="backup-operation"><div><h2>'+tr('恢复备份','Restore a backup')+'</h2><p>'+tr('读取启程 JSON 备份，先校验内容，再确认恢复。','Validate a Qicheng JSON backup before confirming restoration.')+'</p></div><button data-action="restore">'+tr('恢复备份','Restore backup')+'</button></div><div class="backup-operation"><div><h2>'+tr('备份数据','Back up your data')+'</h2><p>'+tr('包含录入资料、上传文件、设置、倒计时、答题记录、错题、收藏和自定义题库。','Includes personal materials, files, settings, countdown, quiz records, mistakes, favorites and custom banks.')+'</p></div><button data-action="backup" class="primary">'+tr('备份数据','Back up data')+'</button></div><div class="backup-operation"><div><h2>'+tr('保存本地文件','Save a local file')+'</h2><p>'+tr('生成可继续编辑的完整 HTML 文件，包含当前资料与已安装题库，离线打开即可使用。','Create an editable HTML file with your current materials and installed banks for offline use.')+'</p></div><button data-action="offlineCopy">'+tr('保存本地文件','Save local file')+'</button></div><p class="hint">'+tr('官方资源可重新下载，无需放入日常 JSON 备份。恢复备份会保留当前官方资源。','Official resources are excluded from routine JSON backups and remain installed after restoration.')+'</p></div>';
}
function bindHomeControls() {
  const form = $('#homeCountdownForm');
  if (form) form.onsubmit = async event => {
    event.preventDefault();
    if (ctx.busy || ctx.uploadBusy) return;
    const button = form.querySelector('button[type="submit"]');
    const value = {name:form.elements.name.value.trim(),date:form.elements.date.value};
    try {
      validateHomeRecords({'settings:countdown':value});
      button.disabled = true;
      await storage.set('settings:countdown',value);
      homeCountdown = value;
      render(); toast(tr('倒计时已保存','Countdown saved'));
    } catch(error) { toast(error.message); button.disabled = false; }
  };
  const rail = $('#homeCardRail');
  if (rail) {
    $$('[data-home-card]').forEach(button=>button.onclick=()=>rail.scrollTo({left:Number(button.dataset.homeCard)*rail.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
    rail.onscroll=()=>{
      const selected = Math.round(rail.scrollLeft/Math.max(1,rail.clientWidth));
      $$('[data-home-card]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.homeCard)===selected)));
    };
  }
}
export { homePage, backupPage, bindHomeControls, initializeHome, validateHomeRecords, homeDateKey, homeDayNumber, homeCountdownDays, homeQuoteForDate };
