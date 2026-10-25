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
const HOME_DEFAULTS={motto:'',featuredSchool:'',quoteSource:'quotes',quoteBookId:'',weeklyQuotePlan:null};
let homePreferences={...HOME_DEFAULTS}, homeWriteChain=Promise.resolve();
let weeklyDraft=[],weeklySource='quotes',weeklySearch='',weeklyPickerSources=[];
let homeDayTimer = null;
let homeObservedDay = '';
let homeVisibilityBound = false;
const homeMotion52=new WeakMap();
let homeFeaturedChange52=0;
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
function homeWeekStart(date=new Date()) {
  const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());day.setDate(day.getDate()-(day.getDay()+6)%7);return homeDateKey(day);
}
function validateHomeRecords(records) {
  const prefs=records['settings:home'];
  if(prefs!==undefined){
    if(!prefs||typeof prefs!=='object'||Array.isArray(prefs)||typeof prefs.motto!=='string'||prefs.motto.length>120||typeof prefs.featuredSchool!=='string'||prefs.featuredSchool.length>200||!['quotes','classic'].includes(prefs.quoteSource)||typeof prefs.quoteBookId!=='string'||(prefs.quoteBookId&&!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(prefs.quoteBookId))||(prefs.quoteSource==='classic'&&!prefs.quoteBookId))throw new Error('首页偏好格式不正确。');
    const plan=prefs.weeklyQuotePlan;
    if(plan!==undefined&&plan!==null){
      const parsed=new Date(plan.weekStart+'T12:00:00');
      if(!plan||typeof plan!=='object'||Array.isArray(plan)||!/^\d{4}-\d{2}-\d{2}$/.test(plan.weekStart)||!Number.isFinite(parsed.getTime())||homeDateKey(parsed)!==plan.weekStart||parsed.getDay()!==1||!Array.isArray(plan.quotes)||plan.quotes.length!==7||new Set(plan.quotes.map(quote=>quote?.selectionKey)).size!==7)throw new Error('本周每日一句需要选择七句并设置顺序。');
      for(const quote of plan.quotes){
        if(!quote||typeof quote!=='object'||typeof quote.text!=='string'||!quote.text.trim()||quote.text.length>50000||typeof quote.selectionKey!=='string'||!quote.selectionKey||quote.selectionKey.length>300||typeof quote.source!=='string'||quote.source.length>1000||typeof quote.id!=='string'||quote.id.length>200||['bookId','passageId'].some(key=>quote[key]!==undefined&&(typeof quote[key]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(quote[key]))))throw new Error('自定义每日一句格式不正确。');
      }
    }
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
  homePreferences=JSON.parse(JSON.stringify({...HOME_DEFAULTS,...loaded['settings:home']}));
  homeObservedDay = homeDateKey(); homeScheduleDay();
  if (!homeVisibilityBound) {document.addEventListener('visibilitychange',homeRefreshDate);homeVisibilityBound=true;}
}
function getHomePreferences(){return JSON.parse(JSON.stringify(homePreferences));}
function waitForHomeWrites(){return homeWriteChain;}
function saveHomePreferences(patch){
  const write=homeWriteChain.then(async()=>{
    if(ctx.persistencePaused)throw new Error('请等待当前数据操作完成。');
    const next={...homePreferences,...patch};validateHomeRecords({'settings:home':next});
    if(JSON.stringify(next)===JSON.stringify(homePreferences))return getHomePreferences();
    await storage.set('settings:home',next);homePreferences=JSON.parse(JSON.stringify(next));return getHomePreferences();
  });
  homeWriteChain=write.catch(()=>{});return write;
}
function homeSchoolCandidates(){return [...new Set([ctx.state.profile.targetSchool.trim(),...ctx.state.dreamSchools].filter(Boolean))];}
function homeFeaturedSchool(){
  const candidates=homeSchoolCandidates();
  const name=candidates.includes(homePreferences.featuredSchool)?homePreferences.featuredSchool:candidates[0]||'';
  return {name,school:SCHOOL_DETAILS3.find(s=>s.name===name)};
}
function homeSchoolSeal52(name,school){
  return '<span class="home-university-seal'+(school?.logo?'':' home-seal-empty')+'">'+(school?.logo?'<img src="'+esc(school.logo)+'" alt="'+esc(name)+tr('校徽',' seal')+'">':icon3('globe'))+'</span>';
}
function homeDreamSchoolsMarkup52(){
  const names=homeSchoolCandidates(),featured=homeFeaturedSchool();
  if(!names.length)return '<div class="home-university">'+homeSchoolSeal52('')+'<div><h2>'+tr('下一站，由你定义。','Choose your next destination.')+'</h2><p class="hint">'+tr('选定一个方向，让努力更具体。','Choose a destination to make progress tangible.')+'</p></div></div>';
  const cards=[featured.name,...names.filter(name=>name!==featured.name)].map(name=>{
    const school=SCHOOL_DETAILS3.find(row=>row.name===name),active=name===featured.name;
    return '<button type="button" class="home-dream-school52'+(active?' is-featured':'')+'" data-home-dream-school52="'+esc(name)+'" aria-pressed="'+active+'" aria-label="'+esc(name)+(active?tr('，当前主要展示院校',' — currently featured'):tr('，设为主要展示院校',' — make featured'))+'">'+homeSchoolSeal52(name,school)+'<span class="home-dream-identity52"><span class="home-dream-name52">'+esc(name)+'</span><span class="home-school-short">'+esc(school?.abbreviation||tr('梦想正在靠近','Your next destination'))+(school?.city?'<span>'+esc(school.city)+'</span>':'')+'</span></span><span class="home-dream-promote52" aria-hidden="true">↗</span></button>';
  });
  return '<div class="home-dream-stage52'+(names.length>1?' has-alternatives':'')+'" data-home-dream-stage52 data-featured="'+esc(featured.name)+'" aria-label="'+tr('梦想院校，点击小卡片切换主要展示','Dream universities. Select a small card to feature it.')+'"><div class="home-dream-main52">'+cards[0]+'</div><div class="home-dream-others52">'+cards.slice(1).join('')+'</div></div><p class="home-dream-feedback52" data-home-dream-feedback52 role="status" aria-live="polite">'+(names.length>1?tr('轻点院校小卡，切换你的主要目标。','Select another university to make it your main destination.'):'')+'</p>';
}
function homeReducedMotion52(){return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
// Each retarget starts at the currently displayed rectangle and keeps its velocity.
// Only transforms animate; the DOM stays usable throughout a school switch or reorder.
function homeSpringRect52(element,from,{velocity,release=false,complete}={}){
  const previous=homeMotion52.get(element);previous?.cancel();
  element.style.transform='';
  const target=element.getBoundingClientRect();
  if(homeReducedMotion52()||!target.width||!target.height){complete?.();return;}
  const value=[from.left-target.left,from.top-target.top,from.width/target.width-1,from.height/target.height-1];
  const speed=velocity||previous?.speed?.slice()||[0,0,0,0];
  const state={speed,cancel(){cancelAnimationFrame(state.frame);homeMotion52.delete(element);element.style.transform='';element.style.willChange='';}};
  homeMotion52.set(element,state);element.style.transformOrigin='0 0';element.style.willChange='transform';
  const draw=()=>{element.style.setProperty('transform','translate3d('+value[0]+'px,'+value[1]+'px,0) scale('+(1+value[2])+','+(1+value[3])+')','important');};
  draw();let last=performance.now();
  const tick=now=>{
    if(!element.isConnected){state.cancel();return;}
    const dt=Math.min((now-last)/1000,.032);last=now;
    const stiffness=420,damping=release?34:41;
    // Small substeps keep the spring stable after a busy rendering frame.
    for(let step=0;step<3;step++)for(let index=0;index<4;index++){speed[index]+=(-stiffness*value[index]-damping*speed[index])*dt/3;value[index]+=speed[index]*dt/3;}
    draw();
    if(value.every((n,i)=>Math.abs(n)<(i<2?.15:.001))&&speed.every((n,i)=>Math.abs(n)<(i<2?1:.01))){state.cancel();complete?.();return;}
    state.frame=requestAnimationFrame(tick);
  };
  state.frame=requestAnimationFrame(tick);return state;
}
function homeSwapFeaturedSchool52(stage,name){
  const cards=[...stage.querySelectorAll('[data-home-dream-school52]')],selected=cards.find(card=>card.dataset.homeDreamSchool52===name);
  if(!selected||stage.dataset.featured===name)return;
  const before=new Map(cards.map(card=>[card,{rect:card.getBoundingClientRect(),velocity:homeMotion52.get(card)?.speed.slice()}]));
  cards.forEach(card=>homeMotion52.get(card)?.cancel());
  const old=stage.dataset.featured;stage.dataset.featured=name;
  // Swap the two slots so the former main university returns to the selected card's place.
  const order=cards.slice(),oldIndex=order.findIndex(card=>card.dataset.homeDreamSchool52===old),nextIndex=order.indexOf(selected);
  [order[oldIndex],order[nextIndex]]=[order[nextIndex],order[oldIndex]];
  order.forEach(card=>{const active=card===selected;card.classList.toggle('is-featured',active);card.setAttribute('aria-pressed',String(active));card.setAttribute('aria-label',card.dataset.homeDreamSchool52+(active?tr('，当前主要展示院校',' — currently featured'):tr('，设为主要展示院校',' — make featured')));});
  stage.querySelector('.home-dream-main52').replaceChildren(order[0]);stage.querySelector('.home-dream-others52').replaceChildren(...order.slice(1));
  cards.forEach(card=>homeSpringRect52(card,before.get(card).rect,{velocity:before.get(card).velocity}));
  selected.focus({preventScroll:true});
  const feedback=stage.parentElement.querySelector('[data-home-dream-feedback52]');if(feedback)feedback.textContent=name+tr(' · 当前主要展示院校',' · Your main destination');
}
function bindHomeDreamSchools52(){
  $$('[data-home-dream-stage52]').forEach(stage=>stage.querySelectorAll('[data-home-dream-school52]').forEach(button=>button.onclick=async()=>{
    const name=button.dataset.homeDreamSchool52;if(stage.dataset.featured===name||!homeSchoolCandidates().includes(name))return;
    const change=++homeFeaturedChange52;homeSwapFeaturedSchool52(stage,name);
    try{await saveHomePreferences({featuredSchool:name});}
    catch(error){if(change===homeFeaturedChange52&&stage.isConnected)homeSwapFeaturedSchool52(stage,homeFeaturedSchool().name);toast(error.message);}
  }));
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
  return '<section class="settings-section" id="homeSettings"><h2>'+tr('首页与每日一句','Home & daily reading')+'</h2>'+homeMottoForm()+'<label class="field daily-source-choice"><span>'+tr('每日一句的来源','Daily reading source')+'</span><select id="homeQuoteSource"><option value="quotes"'+(homePreferences.quoteSource==='quotes'?' selected':'')+'>'+tr('每日一句句库','Quotes library')+'</option>'+books.map(book=>'<option value="classic:'+esc(book.id)+'"'+(homePreferences.quoteSource==='classic'&&homePreferences.quoteBookId===book.id?' selected':'')+(book.count?'':' disabled')+'>《'+esc(book.title)+'》 · '+(book.count?book.count+tr(' 段原文',' passages'):tr('资料待导入','No content'))+'</option>').join('')+'</select></label><p class="hint">'+tr('典籍 JSON 也可以直接作为每日一句的来源，不需要另做 quotes 文件。每天固定选取一段原文，点击可回到典籍正文；更新该典籍后，两处同步使用新内容。来源不可用时暂用每日一句句库。','A classic JSON can also supply daily reading. One original passage is selected per day and links back to the book. Reimporting the book updates both views; missing sources fall back to the quotes library.')+'</p>'+weeklyQuoteSettingsMarkup()+'<button data-go3="schools">'+tr('选择首页展示院校','Choose featured university')+'</button></section>';
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
  const plan=homePreferences.weeklyQuotePlan;
  if(plan?.weekStart===homeWeekStart(date))return JSON.parse(JSON.stringify(plan.quotes[(date.getDay()+6)%7]));
  const quotes = resource?.quotes || [];
  if (!quotes.length) return null;
  return quotes[((homeDayNumber(date) % quotes.length) + quotes.length) % quotes.length];
}
function homePage() {
  const days=homeCountdownDays(),recent=getRecentQuiz();
  const lastExport=ctx.state.exportHistory.slice().sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const motto=homePreferences.motto||tr('每一步，都向梦想靠近。','One step closer to your future.');
  const dateLabel=new Date().toLocaleDateString(ctx.state.uiLang==='en'?'en':'zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  return '<div class="home-dashboard home-beta"><header class="home-intro"><div class="home-kicker"><span class="eyebrow">QICHENG / TODAY</span><p class="home-date">'+esc(dateLabel)+'</p></div><h1>'+esc(motto)+'</h1><p class="home-subtitle">'+tr('为想去的地方，积累今天的每一步。','Make a little progress today, toward the place you want to be.')+'</p><details class="home-motto-editor"><summary>'+tr('自定义这句鼓励','Make this message yours')+'</summary>'+homeMottoForm()+'</details></header>'+
    '<div class="home-goals"><section class="home-goal home-destination"><div class="home-panel-heading"><p class="eyebrow">'+tr('你的方向','YOUR DIRECTION')+'</p><span>'+tr('梦想院校','DREAM UNIVERSITY')+'</span></div>'+homeDreamSchoolsMarkup52()+'<div class="home-panel-bottom"><p class="hint">'+(ctx.state.profile.targetMajor?esc(ctx.state.profile.targetMajor):ctx.state.dreamSchools.length+tr(' 所已收藏的梦想院校',' saved destinations'))+'</p><button class="home-text-button" data-go3="schools">'+tr('管理目标院校','Manage destinations')+' ↗</button></div></section>'+
    '<section class="home-goal home-countdown"><div class="home-panel-heading"><p class="eyebrow">'+tr('下一站','NEXT MILESTONE')+'</p><span>'+tr('目标倒计时','COUNTDOWN')+'</span></div><h2>'+esc(homeCountdown.name||tr('给期待，一个日期。','Give your next step a date.'))+'</h2><p class="home-countdown-value">'+(days===null?'<span>—</span>':days===0?'<span class="is-today">'+tr('今天','Today')+'</span>':'<span>'+Math.abs(days)+'</span><small>'+tr(days>0?'天后':'天前',days>0?'days to go':'days ago')+'</small>')+'</p><p class="hint">'+(homeCountdown.date?esc(homeCountdown.date):tr('不急于抵达，先看清下一步。','A clear next step is a good beginning.'))+'</p><details class="home-countdown-editor"><summary>'+tr('设置倒计时','Set countdown')+'</summary><form id="homeCountdownForm"><label class="field"><span>'+tr('目标名称','Goal name')+'</span><input name="name" maxlength="120" value="'+esc(homeCountdown.name)+'"></label><label class="field"><span>'+tr('目标日期','Target date')+'</span><input name="date" type="date" value="'+esc(homeCountdown.date)+'"></label><button type="submit" class="primary">'+tr('保存倒计时','Save countdown')+'</button><p class="hint">'+tr('清空日期并保存即可移除。','Clear the date and save to remove.')+'</p></form></details></section></div>'+
    homeRecentStatusMarkup()+homeResumeMarkup()+'<section class="home-momentum"><div class="home-section-title"><h2>'+tr('日积月累','PROGRESS, DAY BY DAY')+'</h2><p>'+tr('每一次完成，都算数。','Every completed step counts.')+'</p></div><div class="home-progress-grid"><article><span class="home-progress-label">'+tr('最近练习','LATEST PRACTICE')+'</span><strong>'+(recent?recent.correct+' / '+recent.total:tr('从一组练习开始','Start with a short practice'))+'</strong><p>'+(recent?esc(recent.bankTitle)+' · '+Math.round(recent.correct/recent.total*100)+'%':tr('给今天留下一点新的积累。','Make room for something new today.'))+'</p></article><article><span class="home-progress-label">'+tr('最近成果','LATEST DOCUMENT')+'</span><strong>'+esc(lastExport?.name||tr('你的下一份成果','Your next finished document'))+'</strong><p>'+(lastExport?esc(lastExport.type.toUpperCase())+' · '+esc(new Date(lastExport.createdAt).toLocaleDateString()):tr('把经历整理好，离目标更近一步。','Keep your story in order as you move ahead.'))+'</p></article></div></section>'+
    '<section class="home-quote"><div class="home-section-title"><h2>'+tr('今日所读','READ SOMETHING TIMELESS')+'</h2><button class="home-text-button" data-home-weekly-open>'+tr('自定义每日一句','Customize this week')+' ↗</button></div>'+dailyQuoteMarkup(false)+'</section>'+
    '<nav class="home-shortcuts" aria-label="'+tr('开始行动','Take the next step')+'"><button data-go3="profile">'+icon3('edit')+'<span><strong>'+tr('信息录入','Your information')+'</strong><small>'+tr('记录与整理成长','Keep your story in order')+'</small></span>'+icon3('chevron')+'</button><button data-go3="explore">'+icon3('bulb')+'<span><strong>'+tr('学习中心','Learning center')+'</strong><small>'+tr('答题与中华文化典籍','Practice & Chinese classics')+'</small></span>'+icon3('chevron')+'</button></nav></div>';
}
function backupPage() {
  return '<div class="backup-page"><p class="eyebrow">QICHENG / YOUR DATA</p><h2>'+tr('保存与备份','Save & backup')+'</h2><p class="home-subtitle">'+tr('资料自动保存在此设备。定期留一份备份，让成长有所归档。','Your work saves on this device. Keep a backup of what matters.')+'</p><div class="backup-operation"><div><h2>'+tr('恢复备份','Restore a backup')+'</h2><p>'+tr('读取启程 JSON 备份，先校验内容，再确认恢复。','Validate a Qicheng JSON backup before confirming restoration.')+'</p></div><button data-action="restore">'+tr('恢复备份','Restore backup')+'</button></div><div class="backup-operation"><div><h2>'+tr('备份数据','Back up your data')+'</h2><p>'+tr('包含录入资料、上传文件、设置、倒计时、答题记录、错题、收藏和自定义题库。','Includes personal materials, files, settings, countdown, quiz records, mistakes, favorites and custom banks.')+'</p></div><button data-action="backup" class="primary">'+tr('备份数据','Back up data')+'</button></div><div class="backup-operation"><div><h2>'+tr('保存本地文件','Save a local file')+'</h2><p>'+tr('生成可继续编辑的完整 HTML 文件，包含当前资料与已安装题库，离线打开即可使用。','Create an editable HTML file with your current materials and installed banks for offline use.')+'</p></div><button data-action="offlineCopy">'+tr('保存本地文件','Save local file')+'</button></div><p class="hint">'+tr('官方资源可重新下载，无需放入日常 JSON 备份。恢复备份会保留当前官方资源。','Official resources are excluded from routine JSON backups and remain installed after restoration.')+'</p></div>';
}
function bindHomeControls() {
  bindHomeDreamSchools52();
  $$('[data-home-weekly-open]').forEach(button=>button.onclick=homeOpenWeeklyQuotes);
  $$('[data-home-weekly-reset]').forEach(button=>button.onclick=async()=>{try{await saveHomePreferences({weeklyQuotePlan:null});render();toast(tr('已恢复默认顺序滚动','Default daily rotation restored'));}catch(error){toast(error.message);}});
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
  return '<section class="daily-quote-page"><p class="eyebrow">'+tr('每日一句','DAILY QUOTE')+'</p><h1>'+tr('今日所读','A thought for today')+'</h1>'+dailyQuoteMarkup(false)+weeklyQuoteSettingsMarkup()+'</section>';
}

export { getHomePreferences, saveHomePreferences, waitForHomeWrites, homeSchoolCandidates, homeFeaturedSchool, homeSchoolPickerMarkup, homeSettingsMarkup, getDailyQuoteResource };

function homeResumeMarkup(){
  const draft=getUnfinishedQuiz();
  return draft?'<aside class="home-resume"><div><strong>'+tr('继续上次练习','Continue your practice')+'</strong><p>'+esc(draft.bankTitle)+' · '+draft.answered+' / '+draft.total+tr(' 题已答',' answered')+'</p></div><button data-quiz-resume>'+tr('继续答题','Resume')+' ↗</button></aside>':'';
}

function weeklyQuoteSettingsMarkup() {
  const active=homePreferences.weeklyQuotePlan?.weekStart===homeWeekStart();
  return '<div class="weekly-quote-settings52"><p class="hint">'+(active?tr('本周已自定义七句，按周一至周日的顺序展示。','This week uses your seven quotes, Monday through Sunday.'):tr('未手动设置时，按默认顺序每日滚动。本周安排只对当前自然周有效。','Without a weekly selection, quotes rotate in their default order. Your custom selection applies to this calendar week.'))+'</p><div class="actions"><button type="button" data-home-weekly-open>'+tr('自定义每日一句','Customize this week’s quotes')+'</button>'+(active?'<button type="button" data-home-weekly-reset>'+tr('恢复默认滚动','Restore default rotation')+'</button>':'')+'</div></div>';
}
function weeklyQuoteSources() {
  return [{key:'quotes',title:tr('每日一句句库','Quotes library'),quotes:getQuotesResource()?.quotes||[]},...getClassicBooks().map(book=>({key:'classic:'+book.id,title:'《'+book.title+'》',quotes:classicAsQuotes(book).quotes}))].filter(source=>source.quotes.length);
}
function saveWeeklyQuotes(quotes,date=new Date()) { return saveHomePreferences({weeklyQuotePlan:{weekStart:homeWeekStart(date),quotes:JSON.parse(JSON.stringify(quotes))}}); }
function weeklyQuoteSnapshot(quote,source) {
  return {id:String(quote.id),text:quote.text,source:quote.source||source.title,selectionKey:source.key+':'+quote.id,...(quote.bookId?{bookId:quote.bookId}:{}),...(quote.passageId?{passageId:quote.passageId}:{})};
}
function reorderWeeklyQuotes52(quotes,from,to){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=quotes.length||to>=quotes.length||from===to)return false;
  quotes.splice(to,0,quotes.splice(from,1)[0]);return true;
}
function weeklyQuoteOrderMarkup52(days){
  return '<h3>'+tr('本周顺序','This week’s order')+' <span aria-live="polite">'+weeklyDraft.length+' / 7</span></h3><p class="weekly-quote-drag-help52" id="weeklyQuoteDragHelp52">'+tr('拖动左侧手柄排序，也可用 ↑ ↓ 按钮。手柄聚焦后可按方向键调整。','Drag a handle to reorder, or use the arrow buttons. A focused handle also supports arrow keys.')+'</p><ol aria-label="'+tr('周一至周日的每日一句顺序','Daily quotes, Monday through Sunday')+'">'+Array.from({length:7},(_,index)=>{
    const quote=weeklyDraft[index];
    return '<li'+(quote?' data-weekly-key52="'+esc(quote.selectionKey)+'"':' class="weekly-quote-empty52"')+'>'+(quote?'<button type="button" class="weekly-quote-grip52" data-weekly-grip52 aria-describedby="weeklyQuoteDragHelp52" aria-label="'+days[index]+tr('，拖动排序，或按上下方向键',' — drag to reorder, or use arrow keys')+'"><span aria-hidden="true">⠿</span></button>':'')+'<strong>'+days[index]+'</strong>'+(quote?'<p>'+esc(quote.text)+'</p><div><button type="button" data-weekly-move="'+index+':-1"'+(index===0?' disabled':'')+' aria-label="'+tr('向前移动','Move earlier')+'">↑</button><button type="button" data-weekly-move="'+index+':1"'+(index===weeklyDraft.length-1?' disabled':'')+' aria-label="'+tr('向后移动','Move later')+'">↓</button><button type="button" data-weekly-remove="'+index+'" aria-label="'+tr('移除这句','Remove quote')+'">×</button></div>':'<p class="hint">'+tr('待选取','Choose a quote')+'</p>')+'</li>';
  }).join('')+'</ol><p class="home-interaction-live52" data-weekly-order-live52 role="status" aria-live="polite"></p>';
}
function syncWeeklyOrder52(dialog,{animate=true,exclude}={}){
  const list=dialog.querySelector('.weekly-quote-order52 ol'),rows=[...list.children],before=new Map(rows.map(row=>[row,{rect:row.getBoundingClientRect(),velocity:homeMotion52.get(row)?.speed.slice()}]));
  const days=ctx.state.uiLang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['周一','周二','周三','周四','周五','周六','周日'];
  const byKey=new Map(rows.filter(row=>row.dataset.weeklyKey52).map(row=>[row.dataset.weeklyKey52,row]));
  [...weeklyDraft.map(quote=>byKey.get(quote.selectionKey)),...rows.filter(row=>!row.dataset.weeklyKey52)].forEach((row,index)=>{
    homeMotion52.get(row)?.cancel();list.append(row);row.querySelector('strong').textContent=days[index];
    const grip=row.querySelector('[data-weekly-grip52]');if(grip)grip.setAttribute('aria-label',days[index]+tr('，拖动排序，或按上下方向键',' — drag to reorder, or use arrow keys'));
    row.querySelectorAll('[data-weekly-move]').forEach(button=>{const direction=Number(button.dataset.weeklyMove.split(':')[1]);button.dataset.weeklyMove=index+':'+direction;button.disabled=index+direction<0||index+direction>=weeklyDraft.length;});
    const remove=row.querySelector('[data-weekly-remove]');if(remove)remove.dataset.weeklyRemove=String(index);
  });
  if(animate)rows.filter(row=>row!==exclude).forEach(row=>homeSpringRect52(row,before.get(row).rect,{velocity:before.get(row).velocity}));
  const source=weeklyPickerSources.find(row=>row.key===weeklySource);
  if(source)dialog.querySelectorAll('[data-weekly-quote]').forEach(checkbox=>{
    const quote=source.quotes.find(row=>String(row.id)===checkbox.dataset.weeklyQuote),index=weeklyDraft.findIndex(row=>row.selectionKey===source.key+':'+checkbox.dataset.weeklyQuote);
    const small=checkbox.closest('label').querySelector('small');if(small)small.textContent=(quote?.source||source.title)+(index>=0?' · '+days[index]:'');
  });
}
function announceWeeklyMove52(dialog,index){
  const days=ctx.state.uiLang==='en'?['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']:['周一','周二','周三','周四','周五','周六','周日'];
  dialog.querySelector('[data-weekly-order-live52]').textContent=tr('已移至','Moved to ')+days[index];
}
function bindWeeklyDrag52(dialog){
  const list=dialog.querySelector('.weekly-quote-order52 ol'),settling=new Map();let drag=null;
  const clearSettling=row=>{const floating=settling.get(row);if(floating){homeMotion52.get(floating)?.cancel();floating.remove();settling.delete(row);}row.classList.remove('is-dragging52');};
  const place=()=>{
    if(!drag?.active)return;
    const center=drag.clientY-drag.grabOffset+drag.rect.height/2;
    const top=list.getBoundingClientRect().top-list.scrollTop;
    const others=[...list.querySelectorAll('[data-weekly-key52]')].filter(row=>row!==drag.row);
    const target=others.filter(row=>center>top+row.offsetTop+row.offsetHeight/2).length;
    const from=weeklyDraft.findIndex(quote=>quote.selectionKey===drag.key);
    if(reorderWeeklyQuotes52(weeklyDraft,from,target)){syncWeeklyOrder52(dialog,{exclude:drag.row});drag.handle.focus({preventScroll:true});drag.handle.setPointerCapture?.(drag.pointerId);}
  };
  const tick=()=>{
    if(!drag?.active)return;
    const rect=list.getBoundingClientRect(),margin=46;
    if(drag.clientY<rect.top+margin)list.scrollTop-=Math.min(12,(rect.top+margin-drag.clientY)/4);
    else if(drag.clientY>rect.bottom-margin)list.scrollTop+=Math.min(12,(drag.clientY-rect.bottom+margin)/4);
    place();drag.frame=requestAnimationFrame(tick);
  };
  const finish=(cancel=false)=>{
    if(!drag)return;const current=drag;drag=null;cancelAnimationFrame(current.frame);
    if(current.handle.hasPointerCapture?.(current.pointerId))current.handle.releasePointerCapture(current.pointerId);
    current.row.classList.remove('is-grabbed52');
    if(!current.active)return;
    if(cancel){weeklyDraft=current.original;syncWeeklyOrder52(dialog,{exclude:current.row});}
    const index=weeklyDraft.findIndex(quote=>quote.selectionKey===current.key);announceWeeklyMove52(dialog,index);
    const from=current.floating.getBoundingClientRect(),target=current.row.getBoundingClientRect(),history=current.history,elapsed=history.length>1?(history.at(-1).time-history[0].time)/1000:0;
    const velocity=elapsed>0&&performance.now()-history.at(-1).time<80?Math.max(-1600,Math.min(1600,(history.at(-1).y-history[0].y)/elapsed)):0;
    Object.assign(current.floating.style,{left:target.left+'px',top:target.top+'px',width:target.width+'px',height:target.height+'px',transform:''});
    settling.set(current.row,current.floating);
    homeSpringRect52(current.floating,from,{release:true,velocity:[0,cancel?0:velocity,0,0],complete:()=>{if(settling.get(current.row)===current.floating)clearSettling(current.row);}});
    current.handle.focus({preventScroll:true});
  };
  const cleanup=()=>{if(drag){cancelAnimationFrame(drag.frame);drag.floating?.remove();drag.row.classList.remove('is-grabbed52','is-dragging52');drag=null;}settling.forEach((_,row)=>clearSettling(row));dialog.onpointermove=dialog.onpointerup=dialog.onpointercancel=dialog.onkeydown=dialog.oncancel=null;};
  dialog._weeklyDragCleanup52=cleanup;
  list.querySelectorAll('[data-weekly-grip52]').forEach(handle=>{
    handle.onpointerdown=event=>{
      if(event.button!==0||drag)return;
      const row=handle.closest('[data-weekly-key52]');clearSettling(row);handle.focus({preventScroll:true});
      const rect=row.getBoundingClientRect();row.classList.add('is-grabbed52');
      drag={row,handle,key:row.dataset.weeklyKey52,pointerId:event.pointerId,rect,startY:event.clientY,clientY:event.clientY,grabOffset:event.clientY-rect.top,active:false,original:weeklyDraft.slice(),history:[{y:event.clientY,time:performance.now()}]};
      handle.setPointerCapture?.(event.pointerId);event.preventDefault();
    };
    handle.onkeydown=event=>{
      const row=handle.closest('[data-weekly-key52]'),from=weeklyDraft.findIndex(quote=>quote.selectionKey===row.dataset.weeklyKey52),to=event.key==='ArrowUp'?from-1:event.key==='ArrowDown'?from+1:event.key==='Home'?0:event.key==='End'?weeklyDraft.length-1:from;
      if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();clearSettling(row);
      if(reorderWeeklyQuotes52(weeklyDraft,from,to)){syncWeeklyOrder52(dialog);announceWeeklyMove52(dialog,to);handle.focus({preventScroll:true});}
    };
  });
  dialog.onpointermove=event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;drag.clientY=event.clientY;
    const now=performance.now();drag.history.push({y:event.clientY,time:now});drag.history=drag.history.filter(point=>now-point.time<100);
    if(!drag.active&&Math.abs(event.clientY-drag.startY)<5)return;
    event.preventDefault();
    if(!drag.active){
      drag.active=true;drag.floating=drag.row.cloneNode(true);drag.floating.className='weekly-drag-float52';drag.floating.setAttribute('aria-hidden','true');
      [drag.floating,...drag.floating.querySelectorAll('*')].forEach(node=>{[...node.attributes].filter(attr=>attr.name.startsWith('data-weekly-')).forEach(attr=>node.removeAttribute(attr.name));if(node.matches('button'))node.tabIndex=-1;});
      Object.assign(drag.floating.style,{position:'fixed',left:drag.rect.left+'px',top:drag.rect.top+'px',width:drag.rect.width+'px',height:drag.rect.height+'px'});
      dialog.append(drag.floating);drag.row.classList.add('is-dragging52');tick();
    }
    drag.floating.style.transform='translate3d(0,'+(event.clientY-drag.startY)+'px,0)';place();
  };
  dialog.onpointerup=event=>{if(drag?.pointerId===event.pointerId)finish();};
  dialog.onpointercancel=event=>{if(drag?.pointerId===event.pointerId)finish(true);};
  dialog.onkeydown=event=>{if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();finish(true);}};
  dialog.oncancel=event=>{if(drag){event.preventDefault();finish(true);}};
}
function homeOpenWeeklyQuotes() {
  weeklyDraft=homePreferences.weeklyQuotePlan?.weekStart===homeWeekStart()?JSON.parse(JSON.stringify(homePreferences.weeklyQuotePlan.quotes)):[];
  weeklySearch='';weeklyPickerSources=weeklyQuoteSources();weeklySource=weeklyPickerSources[0]?.key||'quotes';
  let dialog=$('#weeklyQuoteDialog52');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='weeklyQuoteDialog52';dialog.className='weekly-quote-dialog52';dialog.setAttribute('aria-labelledby','weeklyQuoteTitle52');document.body.append(dialog);dialog.addEventListener('close',()=>{dialog._weeklyDragCleanup52?.();dialog.remove();});}
  renderWeeklyQuoteDialog(dialog);if(!dialog.open)dialog.showModal();
}
function renderWeeklyQuoteDialog(dialog) {
  dialog._weeklyDragCleanup52?.();
  const sources=weeklyPickerSources,source=sources.find(row=>row.key===weeklySource)||sources[0],search=weeklySearch.toLocaleLowerCase();
  if(source)weeklySource=source.key;
  const choices=(source?.quotes||[]).filter(quote=>!search||(quote.text+' '+(quote.source||'')).toLocaleLowerCase().includes(search)),days=ctx.state.uiLang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['周一','周二','周三','周四','周五','周六','周日'];
  dialog.innerHTML='<header class="weekly-quote-heading52"><div><p class="eyebrow">YOUR WEEK / '+homeWeekStart()+'</p><h2 id="weeklyQuoteTitle52">'+tr('安排本周的七句','Choose seven quotes for this week')+'</h2><p class="hint">'+tr('先选书目与句子，再调整周一至周日的顺序。','Choose a book and quotes, then arrange them from Monday to Sunday.')+'</p></div><button type="button" data-weekly-close aria-label="'+tr('关闭','Close')+'">×</button></header><div class="weekly-quote-layout52"><section><div class="grid2"><label class="field"><span>'+tr('哪本书 / 句库','Book / quotes library')+'</span><select id="weeklyQuoteSource52">'+sources.map(row=>'<option value="'+esc(row.key)+'"'+(row.key===weeklySource?' selected':'')+'>'+esc(row.title)+'</option>').join('')+'</select></label><label class="field"><span>'+tr('查找句子','Find a quote')+'</span><input id="weeklyQuoteSearch52" value="'+esc(weeklySearch)+'" placeholder="'+tr('输入原文关键词','Search quote text')+'"></label></div><div class="weekly-quote-choices52">'+choices.slice(0,200).map(quote=>{const snapshot=weeklyQuoteSnapshot(quote,source),index=weeklyDraft.findIndex(row=>row.selectionKey===snapshot.selectionKey);return '<label class="weekly-quote-choice52"><input type="checkbox" data-weekly-quote="'+esc(String(quote.id))+'"'+(index>=0?' checked':'')+'><span><span class="weekly-quote-text52">'+esc(quote.text)+'</span><small>'+esc(quote.source||source.title)+(index>=0?' · '+days[index]:'')+'</small></span></label>';}).join('')+(choices.length>200?'<p class="hint">'+tr('请用关键词缩小范围，当前展示前 200 句。','Use search to narrow the list. Showing the first 200 quotes.')+'</p>':'')+(!choices.length?'<p class="hint">'+tr('暂无匹配的句子，请更换书目或关键词。','No quotes match. Try another source or search.')+'</p>':'')+'</div></section><section class="weekly-quote-order52">'+weeklyQuoteOrderMarkup52(days)+'</section></div><footer class="weekly-quote-footer52"><span id="weeklyQuoteFeedback52" role="status">'+tr('请选择恰好七句，每句对应一天。','Choose exactly seven quotes, one for each day.')+'</span><button type="button" data-weekly-close>'+tr('取消','Cancel')+'</button><button class="primary" type="button" data-weekly-save'+(weeklyDraft.length===7?'':' disabled')+'>'+tr('保存本周安排','Save this week')+'</button></footer>';
  dialog.querySelectorAll('[data-weekly-close]').forEach(button=>button.onclick=()=>dialog.close());
  const sourceChoice=dialog.querySelector('#weeklyQuoteSource52');sourceChoice.onchange=()=>{weeklySource=sourceChoice.value;weeklySearch='';renderWeeklyQuoteDialog(dialog);};
  const searchInput=dialog.querySelector('#weeklyQuoteSearch52');let searchTimer;
  searchInput.oninput=()=>{weeklySearch=searchInput.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(!dialog.isConnected)return;const position=searchInput.selectionStart;renderWeeklyQuoteDialog(dialog);const next=dialog.querySelector('#weeklyQuoteSearch52');next.focus();next.setSelectionRange(position,position);},180);};
  dialog.querySelectorAll('[data-weekly-quote]').forEach(checkbox=>checkbox.onchange=()=>{
    const quote=source.quotes.find(row=>String(row.id)===checkbox.dataset.weeklyQuote),snapshot=weeklyQuoteSnapshot(quote,source),index=weeklyDraft.findIndex(row=>row.selectionKey===snapshot.selectionKey);
    if(!checkbox.checked&&index>=0)weeklyDraft.splice(index,1);
    else if(checkbox.checked&&index<0){if(weeklyDraft.length>=7){checkbox.checked=false;dialog.querySelector('#weeklyQuoteFeedback52').textContent=tr('已选满七句，可先移除一句再选择。','Seven quotes selected. Remove one before adding another.');return;}weeklyDraft.push(snapshot);}
    const scroll=dialog.querySelector('.weekly-quote-choices52').scrollTop;renderWeeklyQuoteDialog(dialog);dialog.querySelector('.weekly-quote-choices52').scrollTop=scroll;
  });
  dialog.querySelectorAll('[data-weekly-move]').forEach(button=>button.onclick=()=>{const [index,direction]=button.dataset.weeklyMove.split(':').map(Number),target=index+direction;if(reorderWeeklyQuotes52(weeklyDraft,index,target)){syncWeeklyOrder52(dialog);announceWeeklyMove52(dialog,target);button.closest('[data-weekly-key52]').querySelector('[data-weekly-grip52]').focus({preventScroll:true});}});
  dialog.querySelectorAll('[data-weekly-remove]').forEach(button=>button.onclick=()=>{weeklyDraft.splice(Number(button.dataset.weeklyRemove),1);renderWeeklyQuoteDialog(dialog);});
  bindWeeklyDrag52(dialog);
  dialog.querySelector('[data-weekly-save]').onclick=async()=>{try{await saveWeeklyQuotes(weeklyDraft);dialog.close();render();toast(tr('本周每日一句已保存','This week’s daily quotes saved'));}catch(error){dialog.querySelector('#weeklyQuoteFeedback52').textContent=error.message;}};
}
export {homeWeekStart,saveWeeklyQuotes,weeklyQuoteSources,weeklyQuoteSnapshot,reorderWeeklyQuotes52,homeDreamSchoolsMarkup52};
