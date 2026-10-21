import { SCHOOL_DETAILS3 } from '../data.js';
import { getRecentQuizSummary as getRecentQuiz, getUnfinishedQuiz } from './quiz.js';
import { ctx } from '../state.js';
import { storage } from '../storage.js';
import { $, $$, esc, tr, icon3, toast } from '../utils/helpers.js';
import { render, go3 } from '../app.js';
import { getQuotesResource, getClassicBooks } from '../resources.js';
import { openClassicPassage, classicAsQuotes } from './explore.js';

import {homeRecentStatusMarkup} from './journal.js';
let homeCountdown = {name:'',date:''};
const HOME_DEFAULTS={motto:'',featuredSchool:'',quoteSource:'quotes',quoteBookId:''};
let homePreferences={...HOME_DEFAULTS}, homeWriteChain=Promise.resolve();
let homeDayTimer = null;
let homeObservedDay = '';
let homeVisibilityBound = false;
function getHomeCountdown(){return {...homeCountdown};}
function saveHomeCountdown(value){
  const next={name:value.name,date:value.date};
  try{validateHomeRecords({'settings:countdown':next});}catch(error){return Promise.reject(error);}
  const write=homeWriteChain.catch(()=>{}).then(async()=>{
    if(ctx.persistencePaused)throw new Error('请等待本地数据操作完成。');
    await storage.set('settings:countdown',next);homeCountdown=next;
    return {...next};
  });
  homeWriteChain=write;return write;
}
export {getHomeCountdown,saveHomeCountdown};

function homeDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function homeDayNumber(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
function validateHomeRecords(records) {
  const prefs=records['settings:home'];
  if(prefs!==undefined){
    if(!prefs||typeof prefs!=='object'||Array.isArray(prefs)||typeof prefs.motto!=='string'||prefs.motto.length>120||typeof prefs.featuredSchool!=='string'||prefs.featuredSchool.length>200||!['quotes','classic'].includes(prefs.quoteSource)||typeof prefs.quoteBookId!=='string'||(prefs.quoteBookId&&!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(prefs.quoteBookId))||(prefs.quoteSource==='classic'&&!prefs.quoteBookId))throw new Error('首页偏好格式不正确。');
  }
  const value = records['settings:countdown'];
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string' || value.name.length > 120 || typeof value.date !== 'string') throw new Error('倒计时设置格式不正确。');
  if (value.date) {
    const parsed = new Date(value.date + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(parsed.getTime()) || homeDateKey(parsed) !== value.date) throw new Error('倒计时日期无效。');
  }
}
async function initializeHome(records) {
  const loaded=records??{'settings:countdown':await storage.get('settings:countdown'),'settings:home':await storage.get('settings:home')};
  validateHomeRecords(loaded);
  homeCountdown=loaded['settings:countdown']?{...loaded['settings:countdown']}:{name:'',date:''};
  homePreferences={...HOME_DEFAULTS,...loaded['settings:home']};
  homeObservedDay = homeDateKey(); homeScheduleDay();
  if (!homeVisibilityBound) {document.addEventListener('visibilitychange',homeRefreshDate);homeVisibilityBound=true;}
}
function getHomePreferences(){return {...homePreferences};}
function waitForHomeWrites(){return homeWriteChain;}
function saveHomePreferences(patch){
  const write=homeWriteChain.then(async()=>{
    if(ctx.persistencePaused)throw new Error('请等待当前数据操作完成。');
    const next={...homePreferences,...patch};validateHomeRecords({'settings:home':next});
    if(JSON.stringify(next)===JSON.stringify(homePreferences))return getHomePreferences();
    await storage.set('settings:home',next);homePreferences=next;return getHomePreferences();
  });
  homeWriteChain=write.catch(()=>{});return write;
}
function homeSchoolCandidates(){return [...new Set([ctx.state.profile.targetSchool.trim(),...ctx.state.dreamSchools].filter(Boolean))];}
function homeFeaturedSchool(){
  const candidates=homeSchoolCandidates();
  const name=candidates.includes(homePreferences.featuredSchool)?homePreferences.featuredSchool:candidates[0]||'';
  return {name,school:SCHOOL_DETAILS3.find(s=>s.name===name)};
}
function homeSchoolPickerMarkup(){
  const names=homeSchoolCandidates();
  return '<section class="panel home-school-picker"><div><h2>'+tr('首页展示的梦想院校','Featured university')+'</h2><p class="hint">'+tr('从已填写或收藏的目标中，选一所展示校徽、校名和简称。','Choose a target to display its name, seal and abbreviation on Home.')+'</p></div><label class="field"><span>'+tr('展示到首页','Show on Home')+'</span><select id="homeSchoolChoice"><option value="">'+tr('自动选择首个目标','Use the first target')+'</option>'+names.map(name=>'<option value="'+esc(name)+'"'+(name===homePreferences.featuredSchool?' selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label></section>';
}
function getDailyQuoteResource(){
  if(homePreferences.quoteSource==='classic'){
    const book=getClassicBooks().find(b=>b.id===homePreferences.quoteBookId);
    if(book){const resource=classicAsQuotes(book);if(resource.quotes.length)return resource;}
  }
  return getQuotesResource();
}
function homeMottoForm(){
  return '<form id="homeMottoForm"><label class="field"><span>'+tr('首页加油标语','Home encouragement')+'</span><input name="motto" maxlength="120" value="'+esc(homePreferences.motto)+'" placeholder="'+tr('每一步，都向梦想靠近。','One step closer to your future.')+'"></label><div class="actions"><button class="primary" type="submit">'+tr('保存标语','Save message')+'</button><button type="button" data-home-motto-reset>'+tr('恢复默认','Use default')+'</button></div></form>';
}
function homeSettingsMarkup(){
  const books=getClassicBooks().map(book=>({...book,count:classicAsQuotes(book).quotes.length}));
  return '<section class="settings-section" id="homeSettings"><h2>'+tr('首页与每日一句','Home & daily reading')+'</h2>'+homeMottoForm()+'<label class="field daily-source-choice"><span>'+tr('每日一句的来源','Daily reading source')+'</span><select id="homeQuoteSource"><option value="quotes"'+(homePreferences.quoteSource==='quotes'?' selected':'')+'>'+tr('每日一句句库','Quotes library')+'</option>'+books.map(book=>'<option value="classic:'+esc(book.id)+'"'+(homePreferences.quoteSource==='classic'&&homePreferences.quoteBookId===book.id?' selected':'')+(book.count?'':' disabled')+'>《'+esc(book.title)+'》 · '+(book.count?book.count+tr(' 段原文',' passages'):tr('资料待导入','No content'))+'</option>').join('')+'</select></label><p class="hint">'+tr('典籍 JSON 也可以直接作为每日一句的来源，不需要另做 quotes 文件。每天固定选取一段原文，点击可回到典籍正文；更新该典籍后，两处同步使用新内容。来源不可用时暂用每日一句句库。','A classic JSON can also supply daily reading. One original passage is selected per day and links back to the book. Reimporting the book updates both views; missing sources fall back to the quotes library.')+'</p><button data-go3="schools">'+tr('选择首页展示院校','Choose featured university')+'</button></section>';
}
function homeRefreshDate() {
  const today = homeDateKey();
  if (today !== homeObservedDay) {
    homeObservedDay = today;
    if (ctx.state && !['settings','backup'].includes(ctx.state.route)) {
      const quote=document.querySelector('.topbar-quote');
      if(quote)quote.outerHTML=dailyQuoteMarkup(true);
      if(['home','daily-quote'].includes(ctx.state.route))render();else bindHomeControls();
    }
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
function homePage() {
  const days=homeCountdownDays(),featured=homeFeaturedSchool(),recent=getRecentQuiz();
  const lastExport=ctx.state.exportHistory.slice().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const motto=homePreferences.motto||tr('每一步，都向梦想靠近。','One step closer to your future.');
  const dateLabel=new Date().toLocaleDateString(ctx.state.uiLang==='en'?'en':'zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  const school=featured.school;
  return '<div class="home-dashboard home-beta"><header class="home-intro"><div class="home-kicker"><span class="eyebrow">QICHENG / TODAY</span><p class="home-date">'+esc(dateLabel)+'</p></div><h1>'+esc(motto)+'</h1><p class="home-subtitle">'+tr('为想去的地方，积累今天的每一步。','Make a little progress today, toward the place you want to be.')+'</p><details class="home-motto-editor"><summary>'+tr('自定义这句鼓励','Make this message yours')+'</summary>'+homeMottoForm()+'</details></header>'+
    '<div class="home-goals"><section class="home-goal home-destination"><div class="home-panel-heading"><p class="eyebrow">'+tr('你的方向','YOUR DIRECTION')+'</p><span>'+tr('梦想院校','DREAM UNIVERSITY')+'</span></div><div class="home-university">'+(school?.logo?'<div class="home-university-seal"><img src="'+esc(school.logo)+'" alt="'+esc(featured.name)+tr('校徽',' seal')+'"></div>':'<div class="home-university-seal home-seal-empty" aria-hidden="true">'+icon3('globe')+'</div>')+'<div><h2>'+esc(featured.name||tr('下一站，由你定义。','Choose your next destination.'))+'</h2>'+(school?'<p class="home-school-short">'+esc(school.abbreviation)+'<span>'+esc(school.city)+'</span></p>':'<p class="hint">'+tr('选定一个方向，让努力更具体。','Choose a destination to make progress tangible.')+'</p>')+'</div></div><div class="home-panel-bottom"><p class="hint">'+(ctx.state.profile.targetMajor?esc(ctx.state.profile.targetMajor):ctx.state.dreamSchools.length+tr(' 所已收藏的梦想院校',' saved destinations'))+'</p><button class="home-text-button" data-go3="schools">'+tr('管理目标院校','Manage destinations')+' ↗</button></div></section>'+
    '<section class="home-goal home-countdown"><div class="home-panel-heading"><p class="eyebrow">'+tr('下一站','NEXT MILESTONE')+'</p><span>'+tr('目标倒计时','COUNTDOWN')+'</span></div><h2>'+esc(homeCountdown.name||tr('给期待，一个日期。','Give your next step a date.'))+'</h2><p class="home-countdown-value">'+(days===null?'<span>—</span>':days===0?'<span class="is-today">'+tr('今天','Today')+'</span>':'<span>'+Math.abs(days)+'</span><small>'+tr(days>0?'天后':'天前',days>0?'days to go':'days ago')+'</small>')+'</p><p class="hint">'+(homeCountdown.date?esc(homeCountdown.date):tr('不急于抵达，先看清下一步。','A clear next step is a good beginning.'))+'</p><details class="home-countdown-editor"><summary>'+tr('设置倒计时','Set countdown')+'</summary><form id="homeCountdownForm"><label class="field"><span>'+tr('目标名称','Goal name')+'</span><input name="name" maxlength="120" value="'+esc(homeCountdown.name)+'"></label><label class="field"><span>'+tr('目标日期','Target date')+'</span><input name="date" type="date" value="'+esc(homeCountdown.date)+'"></label><button type="submit" class="primary">'+tr('保存倒计时','Save countdown')+'</button><p class="hint">'+tr('清空日期并保存即可移除。','Clear the date and save to remove.')+'</p></form></details></section></div>'+
    homeRecentStatusMarkup()+homeResumeMarkup()+'<section class="home-momentum"><div class="home-section-title"><h2>'+tr('日积月累','PROGRESS, DAY BY DAY')+'</h2><p>'+tr('每一次完成，都算数。','Every completed step counts.')+'</p></div><div class="home-progress-grid"><article><span class="home-progress-label">'+tr('最近练习','LATEST PRACTICE')+'</span><strong>'+(recent?recent.correct+' / '+recent.total:tr('从一组练习开始','Start with a short practice'))+'</strong><p>'+(recent?esc(recent.bankTitle)+' · '+Math.round(recent.correct/recent.total*100)+'%':tr('给今天留下一点新的积累。','Make room for something new today.'))+'</p></article><article><span class="home-progress-label">'+tr('最近成果','LATEST DOCUMENT')+'</span><strong>'+esc(lastExport?.name||tr('你的下一份成果','Your next finished document'))+'</strong><p>'+(lastExport?esc(lastExport.type.toUpperCase())+' · '+esc(new Date(lastExport.createdAt).toLocaleDateString()):tr('把经历整理好，离目标更近一步。','Keep your story in order as you move ahead.'))+'</p></article></div></section>'+
    '<section class="home-quote"><div class="home-section-title"><h2>'+tr('今日所读','READ SOMETHING TIMELESS')+'</h2><button class="home-text-button" data-home-daily-settings>'+tr('选择来源','Choose source')+' ↗</button></div>'+dailyQuoteMarkup(false)+'</section>'+
    '<nav class="home-shortcuts" aria-label="'+tr('开始行动','Take the next step')+'"><button data-go3="profile">'+icon3('edit')+'<span><strong>'+tr('信息录入','Your information')+'</strong><small>'+tr('记录与整理成长','Keep your story in order')+'</small></span>'+icon3('chevron')+'</button><button data-go3="explore">'+icon3('bulb')+'<span><strong>'+tr('学习中心','Learning center')+'</strong><small>'+tr('答题与中华文化典籍','Practice & Chinese classics')+'</small></span>'+icon3('chevron')+'</button></nav></div>';
}
function backupPage() {
  return '<div class="backup-page"><p class="eyebrow">QICHENG / YOUR DATA</p><h2>'+tr('保存与备份','Save & backup')+'</h2><p class="home-subtitle">'+tr('资料自动保存在此设备。定期留一份备份，让成长有所归档。','Your work saves on this device. Keep a backup of what matters.')+'</p><div class="backup-operation"><div><h2>'+tr('恢复备份','Restore a backup')+'</h2><p>'+tr('读取启程 JSON 备份，先校验内容，再确认恢复。','Validate a Qicheng JSON backup before confirming restoration.')+'</p></div><button data-action="restore">'+tr('恢复备份','Restore backup')+'</button></div><div class="backup-operation"><div><h2>'+tr('备份数据','Back up your data')+'</h2><p>'+tr('包含录入资料、上传文件、设置、倒计时、答题记录、错题、收藏和自定义题库。','Includes personal materials, files, settings, countdown, quiz records, mistakes, favorites and custom banks.')+'</p></div><button data-action="backup" class="primary">'+tr('备份数据','Back up data')+'</button></div><div class="backup-operation"><div><h2>'+tr('保存本地文件','Save a local file')+'</h2><p>'+tr('生成可继续编辑的完整 HTML 文件，包含当前资料与已安装题库，离线打开即可使用。','Create an editable HTML file with your current materials and installed banks for offline use.')+'</p></div><button data-action="offlineCopy">'+tr('保存本地文件','Save local file')+'</button></div><p class="hint">'+tr('官方资源可重新下载，无需放入日常 JSON 备份。恢复备份会保留当前官方资源。','Official resources are excluded from routine JSON backups and remain installed after restoration.')+'</p></div>';
}
function bindHomeControls() {
  const motto=$('#homeMottoForm');
  if(motto)motto.onsubmit=async event=>{event.preventDefault();const button=motto.querySelector('[type="submit"]');if(button)button.disabled=true;try{await saveHomePreferences({motto:motto.elements.motto.value.trim()});render();toast(tr('首页标语已保存','Home message saved'));}catch(error){toast(error.message);if(button)button.disabled=false;}};
  $$('[data-home-motto-reset]').forEach(button=>button.onclick=async()=>{try{await saveHomePreferences({motto:''});render();}catch(error){toast(error.message);}});
  const school=$('#homeSchoolChoice');if(school)school.onchange=async()=>{try{await saveHomePreferences({featuredSchool:school.value});render();toast(tr('首页展示院校已保存','Featured university saved'));}catch(error){toast(error.message);}};
  const source=$('#homeQuoteSource');if(source)source.onchange=async()=>{const value=source.value;try{await saveHomePreferences({quoteSource:value==='quotes'?'quotes':'classic',quoteBookId:value==='quotes'?'':value.slice(8)});render();toast(tr('每日一句来源已保存','Daily reading source saved'));}catch(error){toast(error.message);}};
  $$('[data-home-daily-settings]').forEach(button=>button.onclick=()=>{go3('settings');$('#homeSettings')?.scrollIntoView({block:'start'});});
  const form = $('#homeCountdownForm');
  if (form) form.onsubmit = async event => {
    event.preventDefault();
    if (ctx.busy || ctx.uploadBusy) return;
    const button = form.querySelector('button[type="submit"]');
    const value = {name:form.elements.name.value.trim(),date:form.elements.date.value};
    try {
      validateHomeRecords({'settings:countdown':value});
      button.disabled = true;
      await saveHomeCountdown(value);
      render(); toast(tr('倒计时已保存','Countdown saved'));
    } catch(error) { toast(error.message); button.disabled = false; }
  };
  $$('[data-daily-quote]').forEach(button=>button.onclick=event=>{
    event.preventDefault();const quote=homeQuoteForDate(getDailyQuoteResource());
    if(quote?.bookId && quote.passageId)openClassicPassage(quote.bookId,quote.passageId);
    else go3('daily-quote');
  });
}
export { homePage, backupPage, dailyQuotePage, dailyQuoteMarkup, bindHomeControls, initializeHome, validateHomeRecords, homeDateKey, homeDayNumber, homeCountdownDays, homeQuoteForDate };

function dailyQuoteMarkup(compact=false) {
  const quote=homeQuoteForDate(getDailyQuoteResource());
  if(!quote)return compact?'':'<p class="home-quote-empty">'+tr('每日一句资源尚未安装','Daily quotes have not been installed')+'</p>';
  return '<a href="#daily-quote" data-daily-quote class="'+(compact?'topbar-quote':'daily-quote-link')+'" title="'+esc(quote.source||tr('阅读原文','Read source'))+'">'+(compact?'':'<blockquote>')+esc(quote.text)+(compact?'':'</blockquote>')+'</a>'+(compact?'':quote.source?'<p class="home-quote-source">'+esc(quote.source)+'</p>':'');
}
function dailyQuotePage() {
  return '<section class="daily-quote-page"><p class="eyebrow">'+tr('每日一句','DAILY QUOTE')+'</p><h1>'+tr('今日所读','A thought for today')+'</h1>'+dailyQuoteMarkup(false)+'</section>';
}

export { getHomePreferences, saveHomePreferences, waitForHomeWrites, homeSchoolCandidates, homeFeaturedSchool, homeSchoolPickerMarkup, homeSettingsMarkup, getDailyQuoteResource };

function homeResumeMarkup(){
  const draft=getUnfinishedQuiz();
  return draft?'<aside class="home-resume"><div><strong>'+tr('继续上次练习','Continue your practice')+'</strong><p>'+esc(draft.bankTitle)+' · '+draft.answered+' / '+draft.total+tr(' 题已答',' answered')+'</p></div><button data-quiz-resume>'+tr('继续答题','Resume')+' ↗</button></aside>':'';
}
