import {loadFeature53,loadedFeature53,flushLoadedFeatures53,hasPendingFeatures53} from './features53.js';
import {deviceSettings53,isLite53,canEditWorkspace53,initializeRuntime53,saveDeviceSettings53,workspaceHint53} from './runtime53.js';
import {initializeResumeVersions53} from './resume-model53.js';
import {loadRouteData} from './data.js';
import {tasks} from './tasks.js';
import { dropRecord, moveRecord, organizationPage3 } from './modules/organization.js';
import { selectedPhotos, uploadBatch, avatarData } from './modules/images.js';
import { chartValue3, selectedExams3, dashboardPage3, drawDashboard3,practiceDashboardPage } from './modules/dashboard.js';
import { exportArchive3, importAssets3, assetUsage3, archivePage3, materialsPage3, outputsPage3 } from './modules/materials.js';
import { normalizeAssets3, fresh, snapshot3, synchronizeEditing, cats, currentVersion, newVersion } from './model.js';
import { selectedAttachments3, ensureFonts, exportFile, documentPlan, pdfBytes, pptBlob, wordBlob, canvasPages, exportHTML3, refreshPreview } from './modules/export.js';
import { $$, $, clone, download, esc, icon3, options, toast, tr, translateUI, uid, flip } from './utils/helpers.js';
import { storage } from './storage.js';
import { loadBuiltinData, SCHOOL_DETAILS3 } from './data.js';
import { validateDraft } from './utils/validation.js';
import { save, initializeSaving301, scheduleSave, updateSaveStatus301 } from './autosave.js';
import { clearAll, exportBackup, offlineHTML, openBackupText,saveAllLocal } from './backup.js';
import { openSettings, openOfflineGuide, settingsPage } from './modules/settings.js';
import { markdown, markdownTemplate31, parseMarkdown31, applyMarkdown31, importMarkdownFile31 } from './modules/markdown.js';
import { exportRows, textRows, preflight3, allPhotos, customPage3, previewPage, cancelOrderInteraction } from './modules/resume.js';
import { filteredSchools3, toggleDream, schoolDetail3, schoolPage, bindSchoolCards3, schoolCards } from './modules/universities.js';
import { collect, entryPage3, learningPage3 } from './modules/records.js';
import { closeProvince31, updateMap31 } from './modules/map.js';
import { VERSION, BULB, GEAR, LOGO, MODULES, NAV3, ROUTE22, blankEducation, blankSubject } from './constants.js';
import { pwa } from './pwa.js';
import { ctx } from './state.js';
import { initializeHomeResources, initializeResources, reloadResources, listQuizBanks, getQuotesResource, importResourceJSON, updateResources, validateResourceRecords } from './resources.js';
import { initializeQuizSummary, initializeQuiz, quizPage, getRecentQuiz, validateQuizRecords, flushQuizDraft, refreshQuizClock, hasPendingQuizWrites } from './modules/quiz.js';
import { homePage, dailyQuotePage, dailyQuoteMarkup, initializeHome, getHomePreferences, validateHomeRecords, refreshHomeOverviewView53 } from './modules/home.js';
import { explorePage, readingPage, classicPage, exploreBook } from './modules/explore.js';
import { academicsPage, educationPage, profilePage, statementPage } from './modules/profile.js';
import { bind } from './events.js';
import {initializeJournalSummary,initializeJournal,validateJournalRecords,calendarPage,progressPage} from './modules/journal.js';
import {examCalendarPage,initializeExamCalendar,validateExamCalendarRecords} from './modules/exam-calendar.js';
import {introductionsPage52} from './modules/introductions.js';
import {saveLocalFile52,showStartupChoice52} from './local-files52.js';
import {getPageHelp52} from './modules/page-help52.js';
// 启程 · js/app.js

function confirmAction (title, message, label = '确认') {
  const d = $ ('#confirmDialog');
  $ ('#confirmTitle').textContent = title;
  $ ('#confirmMessage').textContent = message;
  $ ('#confirmAccept').textContent = label;
  d.returnValue = 'cancel';
  d.showModal ();
  translateUI ();
  return new Promise (r => d.addEventListener ('close', () => r (d.returnValue === 'confirm'), {
    once : true
  }));
}

async function v2Action (a) {
  if (ctx.busy || ctx.uploadBusy) return;
  const v = currentVersion ();
  if (a === 'openPreview') {
    const d = $ ('#composerPreview');
    d.showModal ();
    await refreshPreview ();
    return
  }
  else if (a === 'closePreview') {
    $ ('#composerPreview')?.close ();
    return
  }
  else if (a === 'addEducation') {
    if (ctx.state.education.length >= 60) return toast (tr ('最多60条教育记录', 'Up to 60 education entries'));
    ctx.state.education.push (blankEducation ());
    changed ();
    return
  }
  else if (a === 'addBlock') {
    if (ctx.state.customBlocks.length >= 100) return toast (tr ('最多100个自定义模块', 'Up to 100 custom blocks'));
    ctx.state.customBlocks.push ( {
      id : uid (), title : '', text : '', layout : 'stack', photos : []
    })
  }
  else if (a === 'removeAvatar') {
    ctx.state.avatar = null
  }
  else if (a === 'selectAll') {
    v.disabled = [];
    v.excluded = [];
    v.hiddenFields = []
  }
  else if (a === 'selectNone') {
    v.disabled = [...MODULES];
    v.excluded = allPhotos ().map (p => 'photo:' + p.id)
  }
  else if (a === 'newVersion' || a === 'duplicateVersion') {
    if (ctx.state.versions.length >= 30) return toast (tr ('最多保存30份简历版本', 'Up to 30 resume versions'));
    const n = a === 'newVersion' ? newVersion (tr ('新简历', 'New resume')) : clone (v);
    n.id = uid ();
    if (a === 'duplicateVersion') n.name = v.name + tr (' · 副本', ' · Copy');
    ctx.state.versions.push (n);
    ctx.state.activeVersion = n.id
  }
  else if (a === 'deleteVersion') {
    if (ctx.state.versions.length === 1) return;
    if (! await confirmAction (tr ('删除此简历版本？', 'Delete this resume version?'), tr ('原始素材不会被删除。', 'Source materials will be kept.'))) return;
    ctx.state.versions = ctx.state.versions.filter (x => x.id !== v.id);
    ctx.state.activeVersion = ctx.state.versions [0].id
  }
  changed ();
}

function routeName3 (route = ctx.state.route) {
  if(route.startsWith('resume-editor:'))return '简历编辑工作区';
  if(route.startsWith('resume-review:'))return '简历只读审阅';
  if(route.startsWith('question:'))return '题目与个人笔记';
  if (route === 'quiz') return tr ('练习中心', 'Practice center');
  if (route === 'explore') return tr ('学习中心', 'Learning center');
  if (route.startsWith ('classic:')) return '《' + (exploreBook (route.slice (8))?.title || tr ('典籍', 'Classic')) + '》';
  if (route === 'settings' || route === 'backup') return tr ('设置', 'Settings');
  if (route === 'daily-quote') return tr ('每日一句', 'Daily quote');
  if (route.startsWith ('school:')) return tr ('院校详情', 'University details');
  for (const g of NAV3) {
    const x = g.items.find (x => x [0] === route);
    if (x) return tr (x [1], x [2])
  }
  return tr ('个人工作台', 'Workspace')
}

function routeGroup3 (route = ctx.state.route) {
  if(route.startsWith('resume-')||['resumes','export-center','studio'].includes(route))return NAV3.find(g=>g.id==='export');
  if(route.startsWith('question:'))return NAV3.find(g=>g.id==='learning-center');
  if (['settings','backup','daily-quote'].includes(route)) return undefined;
  if (['quiz', 'reading', 'explore','calendar','reading-progress','self-introductions'].includes(route) || route.startsWith ('classic:')) return NAV3.find (g => g.id === 'learning-center');
  return NAV3.find (g => g.items.some (x => x [0] === route)) || NAV3.find (g => g.id === 'info')
}

let routeSequence521=0,quizInitialized521=false,calendarInitialized521=false,journalInitialized521=false;
async function go3 (route) {
  if (ctx.busy || ctx.uploadBusy) return;
  if (route === 'backup') route = 'settings';
  const legacyOrder53=route==='studio';if(legacyOrder53){const version=ctx.state.activeVersion||ctx.state.versions[0]?.id;route=version?'resume-editor:'+version:'resumes';}
  let blockedEditor53=false;
  if(route.startsWith('resume-editor:')&&(isLite53()||!canEditWorkspace53())){route=route.replace('resume-editor:','resume-review:');blockedEditor53=true;}
  await flushLoadedFeatures53();
  const sequence=++routeSequence521;
  if((ctx.dirty301||ctx.saveError)&&!await save()){toast('最新修改尚未保存，请先重试或备份。');return;}
  const task={stage(){},succeed(){},fail(){}};
  try {
    task.stage('准备页面所需资料');
    await loadRouteData(route);
    if(['resumes','export-center'].includes(route)||route.startsWith('resume-')){const resume=await loadFeature53('resume');await resume.prepareResume53(route);if(legacyOrder53)resume.showResumeOrder53();}
    if(route==='export-center'){const exporting=await loadFeature53('export');await exporting.prepareExport53(route);}
    if(['quiz','learning-review','question-bank','quiz-history','learning-stats'].includes(route)||route.startsWith('question:')){const learning=await loadFeature53('learning');await learning.prepareLearning53(route);}
    if(['calendar','reading-progress','learning'].includes(route)&&!journalInitialized521){await initializeJournal();journalInitialized521=true;}
    if(['exam-calendar','exams'].includes(route)&&!calendarInitialized521){await initializeExamCalendar();calendarInitialized521=true;}
    if(['quiz','settings','reading','explore','daily-quote','calendar','practice-dashboard'].includes(route)||route.startsWith('classic:'))await initializeResources({metadataOnly:true});
    if(['quiz','practice-dashboard'].includes(route)&&!quizInitialized521){await initializeQuiz();quizInitialized521=true;}
    task.succeed('页面资料已就绪');
  }catch(error){task.fail(error);toast(error.message);return;}
  if(sequence!==routeSequence521)return;
  ctx.modeHint53=blockedEditor53;
  ctx.state.route = route;
  ctx.state.section = route === 'schools' || route.startsWith ('school:') ? 'schools' : route === 'learning' ? 'learning' : 'resume';
  const i = ROUTE22.indexOf (route);
  ctx.state.step = i >= 0 ? i : 0;
  const g = routeGroup3 (route);
  if (g && ! ctx.state.menuOpen.includes (g.id)) ctx.state.menuOpen.push (g.id);
  if (innerWidth <= 900) document.body.classList.remove ('nav-mobile-open');
  render ();
}

async function navigate (section, step) {
  return go3 (section === 'schools' ? 'schools' : section === 'learning' ? 'learning' : ROUTE22 [step] || 'profile')
}

function shell (content) {
  const active = routeGroup3 (), isMobile = innerWidth <= 900, isHome = ctx.state.route === 'home', isSettings = ['settings','backup'].includes(ctx.state.route);
  const navVisible = isMobile ? document.body.classList.contains ('nav-mobile-open') : ! ctx.state.sidebarHidden;
  const breadcrumb = isHome ? '<strong>'+tr('首页','Home')+'</strong>' : tr(active?.zh||'工作台',active?.en||'Workspace')+' <em>/</em> <strong>'+esc(routeName3())+'</strong>';
  const navigation = NAV3.filter(g=>!isLite53()||!['organize','personal','dashboard'].includes(g.id)).map (g => g.standalone ? '<button data-go3="home" class="nav-home ' + (isHome ? 'active' : '') + '" ' + (isHome ? 'aria-current="page"' : '') + '>' + icon3('home') + '<span>' + tr(g.zh,g.en) + '</span></button>' : '<section class="nav-group ' + (ctx.state.menuOpen.includes (g.id) ? 'is-open' : '') + '"><button class="nav-group-toggle ' + (g.id === active?.id ? 'active-group' : '') + '" data-nav-group="' + g.id + '" aria-expanded="' + ctx.state.menuOpen.includes (g.id) + '">' + icon3 (g.icon) + '<span>' + tr (g.zh, g.en) + '</span><i>' + icon3 ('chevron') + '</i></button><div class="nav-sub" ' + (ctx.state.menuOpen.includes (g.id) ? '' : 'inert') + '><div>' + g.items.map (x => '<button data-go3="' + x[0] + '" class="nav-item ' + ((ctx.state.route === x[0] || (x[0] === 'reading' && ctx.state.route.startsWith('classic:'))) ? 'active' : '') + '" ' + ((ctx.state.route === x[0] || (x[0] === 'reading' && ctx.state.route.startsWith('classic:'))) ? 'aria-current="page"' : '') + '>' + tr (x[1], x[2]) + '</button>').join ('') + '</div></div></section>').join ('');
  return '<div class="shell3 '+(ctx.state.sidebarHidden?'nav-hidden':'')+'"><button class="nav-backdrop" data-action3="toggleNav" aria-label="'+tr('收起菜单','Close menu')+'"></button><aside class="sidebar3" id="sidebar3" '+(navVisible?'':'inert')+'><a class="brand3" href="#" data-go3="home"><span class="brand-mark">'+LOGO+'</span><span><strong>启程</strong><small>PERSONAL STUDIO</small></span></a><button class="sidebar-close50" data-action3="toggleNav" aria-label="'+tr('收起菜单','Close menu')+'">'+icon3('close')+'</button><div class="nav-caption">'+tr('我的成长档案','YOUR PERSONAL WORKSPACE')+'</div><nav aria-label="'+tr('工作台导航','Workspace navigation')+'">'+navigation+'</nav><div class="sidebar-tools"><div class="sidebar-save52" data-save-state="saved"><div class="sidebar-save-copy52"><span class="sidebar-save-eyebrow52">'+tr('工作进度','WORKSPACE')+'</span><div id="savedStatus" class="save-status" role="status" aria-live="polite">'+tr('已保存','Saved')+'</div></div><button class="sidebar-save-button52" data-action="saveFile52" aria-label="'+tr('手动保存为本地文件','Save a complete local file')+'">'+icon3('download')+'<span>'+tr('手动保存','Save file')+'</span></button></div><button class="sidebar-bottom-link" data-go3="settings">'+GEAR+'<span>'+tr('设置','Settings')+'</span></button></div></aside><main class="main3"><header class="topbar3"><div class="topbar-left"><button class="menu-toggle" data-action3="toggleNav" aria-controls="sidebar3" aria-expanded="'+navVisible+'" aria-label="'+tr('展开或收起菜单','Toggle menu')+'">'+icon3('menu')+'</button><div class="topbar-context"><span class="breadcrumb">'+breadcrumb+'</span>'+(isSettings?'':dailyQuoteMarkup(true))+'</div></div><div class="topbar-actions">'+searchButton53()+(isHome||isSettings?'':'<button data-go3="resumes">'+tr('编辑与导出','Edit & export')+' '+icon3('export')+'</button><button class="primary" data-action="save">'+tr('保存进度','Save')+'</button>')+'</div></header><div class="page-content3" id="workspaceContent">'+content+'</div><footer class="quiet-footer"><span>QICHENG PERSONAL STUDIO</span><span>'+tr('在这里，记录成长的每一步。','A place for every step of your growth.')+'</span></footer></main></div>'+help()+'<input type="file" id="backupInput" accept=".json,application/json" hidden><datalist id="awardCategories">'+options(cats('awards'),'')+'</datalist><datalist id="experienceCategories">'+options(cats('experiences'),'')+'</datalist><datalist id="languageList">'+options(['英语','德语','西班牙语','法语','日语','俄语'],'')+'</datalist>';
}

// View position belongs to this running session, never to the user's saved data.
const routePositions50 = new Map();
let renderedRoute50 = '', renderedLanguage50 = '',renderedLite53=null;
function resetViewMemory50 () { routePositions50.clear(); renderedRoute50 = ''; }
function captureFocus50 (content) {
  const element = document.activeElement;
  if (!element || !content?.contains?.(element) || !element.matches?.('input,textarea,select,button,[contenteditable=true]')) return null;
  const keys = [...element.attributes].filter(attribute => attribute.name === 'id' || attribute.name === 'name' || attribute.name.startsWith('data-')).map(attribute => [attribute.name, attribute.value]);
  if (!keys.length) return null;
  return {tag:element.tagName,keys,start:element.selectionStart,end:element.selectionEnd,direction:element.selectionDirection};
}
function restoreFocus50 (content, focus) {
  if (!focus) return;
  const element = [...content.querySelectorAll(focus.tag)].find(candidate => focus.keys.every(([name,value]) => candidate.getAttribute(name) === value));
  if (!element || element.disabled || element.type === 'file' || element.closest('[inert],[hidden]')) return;
  element.focus({preventScroll:true});
  if (typeof focus.start === 'number' && typeof element.setSelectionRange === 'function') {
    try { element.setSelectionRange(focus.start,focus.end,focus.direction); } catch { /* Number/date inputs do not expose a text selection. */ }
  }
}
function updateShell50 () {
  // Parse only when labels change. Page navigation keeps these composited surfaces alive.
  const shellRoot = $('.shell3');
  const languageChanged = renderedLanguage50 !== ctx.state.uiLang||renderedLite53!==isLite53();
  const isHome = ctx.state.route === 'home', isSettings = ['settings','backup'].includes(ctx.state.route);
  if (languageChanged) {
    const template = document.createElement('template');
    template.innerHTML = shell('');
    for (const selector of ['.sidebar3','.topbar3','#helpPanel','#helpToggle','#awardCategories','#experienceCategories','#languageList']) {
      const previous = $(selector), next = template.content.querySelector(selector);
      if (previous && next) previous.replaceWith(next);
    }
  } else {
    const active = routeGroup3();
    const breadcrumb = $('.breadcrumb');
    const breadcrumbHTML = isHome ? '<strong>'+tr('首页','Home')+'</strong>' : tr(active?.zh||'工作台',active?.en||'Workspace')+' <em>/</em> <strong>'+esc(routeName3())+'</strong>';
    if (breadcrumb && breadcrumb.innerHTML !== breadcrumbHTML) { breadcrumb.innerHTML = breadcrumbHTML; translateUI(breadcrumb); }
    const context = $('.topbar-context'), quote = context?.querySelector('.topbar-quote');
    const quoteHTML = isSettings ? '' : dailyQuoteMarkup(true);
    if (context && context.dataset.quoteHTML !== quoteHTML) {
      quote?.remove(); if (quoteHTML) context.insertAdjacentHTML('beforeend',quoteHTML);
      context.dataset.quoteHTML = quoteHTML;
    }
    const actions = $('.topbar-actions');
    const actionsHTML = searchButton53()+(isHome || isSettings ? '' : '<button data-go3="resumes">'+tr('编辑与导出','Edit & export')+' '+icon3('export')+'</button><button class="primary" data-action="save">'+tr('保存进度','Save')+'</button>');
    if (actions && actions.dataset.html !== actionsHTML) { actions.innerHTML = actionsHTML; actions.dataset.html = actionsHTML; }
    for (const button of $$('.sidebar3 [data-go3]')) {
      const selected = button.dataset.go3 === ctx.state.route || (button.dataset.go3 === 'reading' && ctx.state.route.startsWith('classic:'));
      button.classList.toggle('active',selected);
      if (selected) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
    }
    for (const button of $$('[data-nav-group]')) {
      const open = ctx.state.menuOpen.includes(button.dataset.navGroup);
      button.classList.toggle('active-group',button.dataset.navGroup === active?.id);
      button.closest('.nav-group').classList.toggle('is-open',open);
      button.setAttribute('aria-expanded',String(open)); button.nextElementSibling.inert = !open;
    }
  }
  shellRoot.classList.toggle('nav-hidden',ctx.state.sidebarHidden);
  const visible = innerWidth <= 900 ? document.body.classList.contains('nav-mobile-open') : !ctx.state.sidebarHidden;
  $('#sidebar3').inert = !visible;
  $('.menu-toggle')?.setAttribute('aria-expanded',String(visible));
  // Category labels can change after editing content without rebuilding the shell.
  for (const [selector,type] of [['#awardCategories','awards'],['#experienceCategories','experiences']]) {
    const element = $(selector), html = options(cats(type),'');
    if (element && element.dataset.html !== html) { element.innerHTML = html; element.dataset.html = html; }
  }
  return languageChanged;
}
function render () {
  cancelOrderInteraction();
  ctx.previewToken ++;
  if (! ctx.state.route) ctx.state.route = ROUTE22 [ctx.state.step] || 'profile';
  document.body.dataset.theme = ctx.state.theme;
  document.body.classList.toggle('resume-editor53',ctx.state.route.startsWith('resume-editor:'));
  const pages3 = {
    profile : profilePage, education : educationPage, statement : statementPage, academics : academicsPage, awards : () =>
    entryPage3 ('awards'), experiences : () => entryPage3 ('experiences'), practices : () => entryPage3 ('practices'),
    'sort-awards' : () => organizationPage3 ('awards'), 'sort-experiences' : () => organizationPage3 ('experiences'),
    'sort-practices' : () => organizationPage3 ('practices'), learning : learningPage3, achievements : () => entryPage3 ('achievements'),
    custom : customPage3, dashboard : dashboardPage3, 'practice-dashboard':practiceDashboardPage, home : homePage, explore : explorePage, reading : readingPage, quiz : quizPage, settings : settingsPage, backup : settingsPage, 'daily-quote' : dailyQuotePage, images : () => materialsPage3 ('image'), files : () => materialsPage3 ('file'),
    outputs : outputsPage3, studio : previewPage, archive : archivePage3, schools : schoolPage, calendar:calendarPage,'reading-progress':progressPage,'exam-calendar':examCalendarPage,'self-introductions':introductionsPage52
  };
  let page = ctx.state.route.startsWith ('classic:') ? () => classicPage (ctx.state.route.slice (8)) : ctx.state.route.startsWith ('school:') ? () => schoolDetail3 (decodeURIComponent (ctx.state.route.slice (7))) : pages3 [ctx.state.route] ||
  profilePage;
  const resume53=loadedFeature53('resume'),export53=loadedFeature53('export'),learning53=loadedFeature53('learning');
  if(ctx.state.route==='resumes'&&resume53)page=resume53.resumeManagerPage53;
  if(ctx.state.route.startsWith('resume-editor:')&&resume53)page=()=>resume53.resumeEditorPage53();
  if(ctx.state.route.startsWith('resume-review:')&&resume53)page=()=> (ctx.modeHint53?workspaceHint53():'')+resume53.getResumeReadOnlyPage53();
  if(ctx.state.route==='export-center'&&export53)page=export53.exportCenterPage53;
  if((['learning-review','question-bank','quiz-history','learning-stats'].includes(ctx.state.route)||ctx.state.route.startsWith('question:'))&&learning53)page=()=>learning53.learningPage53(ctx.state.route);
  const root = $('#app'), content = root.querySelector?.('#workspaceContent');
  const samePage = renderedRoute50 === ctx.state.route;
  const position = {top:window.scrollY || 0,left:window.scrollX || 0};
  if (renderedRoute50) routePositions50.set(renderedRoute50,position);
  const focus = samePage ? captureFocus50(content) : null;
  let languageChanged = true;
  if (content && root.querySelector('.shell3')) {
    languageChanged = updateShell50();
    content.innerHTML = page();
  } else root.innerHTML = shell(page());
  const nextContent = root.querySelector?.('#workspaceContent');
  document.title = '启程 · ' + routeName3 ();
  refreshPageHelp52(!samePage);
  bind ();
  resume53?.bindResume53?.();export53?.bindExport53?.();learning53?.bindLearning53?.();
  bindGlobalControls53();
  translateUI(languageChanged || !nextContent ? document.body : nextContent);
  updateSaveStatus301 ();
  pwa.bind ();
  const targetPosition = samePage ? position : routePositions50.get(ctx.state.route) || {top:0,left:0};
  // Restore synchronously before the next paint; scroll-behavior must not animate this correction.
  window.scrollTo({...targetPosition,behavior:'instant'});
  if (samePage && nextContent) restoreFocus50(nextContent,focus);
  renderedRoute50 = ctx.state.route; renderedLanguage50 = ctx.state.uiLang;renderedLite53=isLite53();
  if (ctx.state.route === 'studio' && ctx.studioTab === 'files') {
    clearTimeout (ctx.previewDebounce);
    ctx.previewDebounce = setTimeout (refreshPreview, 180)
  }
  if (ctx.state.route === 'dashboard') requestAnimationFrame (drawDashboard3)
}

function changed (rerender = true) {
  ctx.layoutCache = null;
  scheduleSave ();
  if (rerender) render ();
  else if ((ctx.state.route === 'studio' && ctx.studioTab === 'files') || $ ('#composerPreview')?.open) {
    clearTimeout (ctx.previewDebounce);
    ctx.previewDebounce = setTimeout (refreshPreview, 250)
  }
}

function helpPanelContents52(info=getPageHelp52()) {
  return '<div class="panel-title"><div><p class="eyebrow">'+tr('此页指南','PAGE GUIDE')+'</p><h2 id="helpTitle52">'+esc(info.title)+'</h2></div><button data-action="closeHelp" aria-label="'+tr('关闭使用帮助','Close page guide')+'">'+icon3('close')+'</button></div><div class="page-help-content52">'+info.html+'</div>';
}
function help () {
  const info=getPageHelp52();
  return '<button class="help-toggle" id="helpToggle" data-action="help" aria-controls="helpPanel" aria-label="'+esc(info.title)+'" aria-expanded="false">'+BULB+'</button><aside id="helpPanel" class="help-panel" role="region" aria-labelledby="helpTitle52" tabindex="-1" data-help-key="'+esc(info.key)+'" hidden>'+helpPanelContents52(info)+'</aside>';
}
function refreshPageHelp52(close=false) {
  const panel=$('#helpPanel'),button=$('#helpToggle');if(!panel||!button)return;
  const info=getPageHelp52();
  if(panel.dataset.helpKey!==info.key){panel.innerHTML=helpPanelContents52(info);panel.dataset.helpKey=info.key;}
  button.setAttribute('aria-label',info.title);
  if(close)panel.hidden=true;
  button.setAttribute('aria-expanded',String(!panel.hidden));
}

function toggleNav3 () {
  if (innerWidth <= 900) {
    document.body.classList.toggle ('nav-mobile-open');
    $ ('.menu-toggle')?.setAttribute ('aria-expanded', String (document.body.classList.contains ('nav-mobile-open')));
    $ ('#sidebar3').inert = ! document.body.classList.contains ('nav-mobile-open')
  }
  else {
    ctx.state.sidebarHidden = ! ctx.state.sidebarHidden;
    $ ('.shell3')?.classList.toggle ('nav-hidden', ctx.state.sidebarHidden);
    $ ('.menu-toggle')?.setAttribute ('aria-expanded', String (! ctx.state.sidebarHidden));
    $ ('#sidebar3').inert = ctx.state.sidebarHidden
  }
}

export { confirmAction, v2Action, routeName3, routeGroup3, go3, navigate, shell, render, changed, help, toggleNav3, resetViewMemory50 };

async function action (name) {
  if (ctx.busy && ! ['help', 'closeHelp'].includes (name)) return;
  if (name === 'settings') return openSettings ();
  if (name === 'resources') return openSettings (false, true);
  if (name === 'save') {
    try { await saveAllLocal(); toast (tr ('当前进度已保存', 'Saved')); }
    catch(error) { toast(tr('尚未全部保存：','Some changes are not saved: ')+error.message); }
    return;
  }
  if (name === 'saveFile52') return saveLocalFile52();
  if (name === 'backup') return exportBackup ();
  if (name === 'restore') return $ ('#backupInput').click ();
  if (name === 'clearAll') return clearAll ();
  if (name === 'backupText') return openBackupText ();
  if (name === 'offlineHelp') return openOfflineGuide ();
  if (name === 'offlineCopy') {
    try {
      await save ();
      toast (tr ('正在生成完整离线副本…', 'Preparing complete offline copy…'));
      download (await offlineHTML (), 'text/html;charset=utf-8', (ctx.state.profile.name || '启程') + '-可编辑离线副本.html');
    }
    catch (error) {
      toast (tr ('离线副本生成失败：', 'Offline copy failed: ') + error.message);
    }
    return;
  }
  if (name === 'help' || name === 'closeHelp') {
    refreshPageHelp52();
    const panel = $ ('#helpPanel');
    panel.hidden = name === 'closeHelp' ? true : ! panel.hidden;
    $ ('#helpToggle').setAttribute ('aria-expanded', String (! panel.hidden));
    if(!panel.hidden)panel.focus?.({preventScroll:true});else $('#helpToggle').focus?.({preventScroll:true});
    return;
  }
  if (name === 'previous') return navigate ('resume', ctx.state.step - 1);
  if (name === 'next') return navigate ('resume', ctx.state.step + 1);
  if (name === 'addSubject') {
    if (ctx.state.examDraft.subjects.length >= 40) return toast (tr ('单次考试最多 40 个科目', 'Up to 40 subjects per exam'));
    ctx.state.examDraft.subjects.push (blankSubject ());
    await save ();
    render ();
    return;
  }
  if (name === 'dreamFilter') {
    ctx.onlyDreams = ! ctx.onlyDreams;
    render ();
    return;
  }
  if (name === 'preview') return refreshPreview ();
  if (name === 'print') return window.print ();
}
async function boot () {
  await Promise.all ([loadBuiltinData (), storage.open ()]);
  ctx.state = fresh ();
  const stored = await storage.getCurrent({lazyAssets:true});
  const embedded = globalThis.QICHENG_EMBEDDED?.draft;
  if (stored !== undefined) ctx.state = validateDraft (stored,{trustedLocal:true});
  else if (embedded && !await storage.get('__seedCleared')) {
    ctx.state = validateDraft (embedded);
    const extra = globalThis.QICHENG_EMBEDDED.records || {};
    validateResourceRecords (extra, {allowOfficial:true});
    validateQuizRecords (extra); validateHomeRecords (extra);validateJournalRecords(extra);validateExamCalendarRecords(extra);
    await storage.setMany ({...extra, current:snapshot3 ()});
  }
  const resumeMigration53=initializeResumeVersions53(ctx.state);
  await initializeRuntime53(()=>{if(ctx.state.route.startsWith('resume-editor:')&&(isLite53()||!canEditWorkspace53()))go3(ctx.state.route);else render();});ctx.device53=deviceSettings53;
  // Startup always opens Home, regardless of the route in an old draft or backup.
  ctx.state.route = 'home';
  ctx.state.section = 'resume'; ctx.state.step = 0;
  ctx.state.menuOpen = ['start']; ctx.state.sidebarHidden = true;
  await initializeHomeResources ();
  await Promise.all ([initializeQuizSummary (), initializeHome (),initializeJournalSummary(),refreshHomeOverview53()]);
  if(getHomePreferences().quoteSource==='classic')await loadRouteData('reading');
  storage.enableActivityTracking();
  // Export/preview prepares its own document fonts; Home never waits for font decoding.
  ctx.initialized = true;
  globalThis.performance?.mark?.('qicheng-home-ready');
  synchronizeEditing ();
  initializeSaving301 ();
  render ();
  if(resumeMigration53){ctx.savedFingerprint301=null;scheduleSave();}
  bindGlobalLifecycle53();
  document.addEventListener('focusout',()=>{if(ctx.dirty301||ctx.saveError)save();});
  window.addEventListener ('beforeunload', event => {
    const featurePending53=hasPendingFeatures53();if(featurePending53)flushLoadedFeatures53().catch(()=>{});
    const quizPending = hasPendingQuizWrites()||featurePending53;
    if (quizPending) flushQuizDraft().catch(() => {});
    if (ctx.dirty301 || ctx.saveError) {
      save (); event.preventDefault (); event.returnValue = '';
    }
    else if (quizPending) { event.preventDefault (); event.returnValue = ''; }
  });
  document.addEventListener ('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && (ctx.dirty301 || ctx.saveError)) save ();
    if (document.visibilityState === 'hidden'){flushQuizDraft().catch(() => {});flushLoadedFeatures53().catch(()=>{});}
    refreshQuizClock();
  });
  window.addEventListener ('pagehide', () => { if (ctx.dirty301 || ctx.saveError) save (); flushQuizDraft().catch(() => {}); flushLoadedFeatures53().catch(() => {}); });
  // A browser back/forward-cache restore resumes the existing app without writing data.
  window.addEventListener ('pageshow', refreshQuizClock);
  window.addEventListener ('unhandledrejection', event => {
    toast (tr ('操作未完成：', 'Operation failed: ') + (event.reason?.message || String (event.reason)));
  });
  window.addEventListener ('error', event => {
    toast (tr ('操作出现错误：', 'An operation failed: ') + event.message);
  });
  document.addEventListener ('keydown', event => {
    if (event.key !== 'Escape') return; if ($ ('#helpPanel')) {
      const helpPanel=$('#helpPanel'),returnToHelp=!helpPanel.hidden&&helpPanel.contains?.(document.activeElement);helpPanel.hidden=true;$('#helpToggle')?.setAttribute('aria-expanded','false');if(returnToHelp)$('#helpToggle')?.focus?.({preventScroll:true});
    }
    if (document.body.classList.contains ('nav-mobile-open')) toggleNav3 (); closeProvince31 ();
  });
  document.addEventListener ('pointerdown', event => {
    if (! event.target.closest?.('#mapStage31')) closeProvince31 ();
  });
  window.ResumeStudio = {
    version : VERSION, fresh, currentVersion, newVersion, validateDraft, documentPlan, pdfBytes, pptBlob, wordBlob, canvasPages,
    listQuizBanks, getQuotesResource, getRecentQuiz, importResourceJSON, updateResources, reloadResources,
    refreshPreview, exportRows, textRows, markdown, markdownTemplate31, parseMarkdown31, applyMarkdown31, importMarkdownFile31,
    go3, snapshot3, preflight3, importAssets3, assetUsage3, filteredSchools3, toggleDream, collect, clearAll, action,
    exportFile, save, offlineHTML, avatarData, exportHTML3, render, dropRecord, moveRecord,
    selectedPhotos, uploadBatch, v2Action, openSettings, translateUI, exportArchive3, normalizeAssets3,
    selectedAttachments3, chartValue3, selectedExams3, getState : () => clone (ctx.state), setState : draft =>
    {
      ctx.state = validateDraft (draft);
      synchronizeEditing ();
      changed ();
    }
  };
  if(deviceSettings53.startRoute!=='home')await go3(deviceSettings53.startRoute);
  showStartupChoice52();
  // First launch stays on Home; appearance is available on the regular Settings page.
  pwa.init ().catch (error => toast (tr ('离线支持初始化失败：', 'Offline support failed: ') + error.message));
  return window.ResumeStudio;
}
export { boot, action };

// All controls for this feature, in their original override order.
function bindAppControls () {
  $$ ('[data-step]').forEach (b => b.onclick = () => navigate ('resume', Number (b.dataset.step)));
  $$ ('[data-section]').forEach (b => b.onclick = () => navigate (b.dataset.section, ctx.state.step));
  $$ ('[data-action]').forEach (b => b.onclick = () => action (b.dataset.action));
  $$ ('[data-go3]').forEach (b => b.onclick = e => {
    e.preventDefault (); go3 (b.dataset.go3)
  });
  $$ ('[data-nav-group]').forEach (b => b.onclick = () => {
    const id = b.dataset.navGroup, open = ! b.closest ('.nav-group').classList.contains ('is-open'); flip (ctx.state.menuOpen,
    id, open); b.closest ('.nav-group').classList.toggle ('is-open', open); b.setAttribute ('aria-expanded', String (open)); b.nextElementSibling.inert = ! open
  });
  $$ ('[data-action3]').forEach (b => b.onclick = () => {
    const a = b.dataset.action3; if (a === 'toggleNav') toggleNav3 (); else if (a === 'archive') exportArchive3 (); else if (a === 'dreamFilter') {
      ctx.onlyDreams = ! ctx.onlyDreams; render ()
    }
    else if (a === 'clearSchoolFilters') {
      ctx.schoolRegion3 = ''; ctx.schoolQuery = ''; ctx.onlyDreams = false; render ()
    }
  });
  if ($ ('#schoolSearch3')) $ ('#schoolSearch3').oninput = e => {
    ctx.schoolQuery = e.target.value.trim ();
    $ ('#schoolLinks3').innerHTML = schoolCards ();
    $ ('#schoolMatch3').textContent = filteredSchools3 ().length + ' / ' + SCHOOL_DETAILS3.length + ' ' + tr ('所院校', 'universities');
    bindSchoolCards3 ();
    updateMap31 ();
    const matches = new Set (filteredSchools3 ().map (x => x.name));
    $$ ('.hotspot[data-go3]').forEach (b => {
      const selected = matches.has (decodeURIComponent (b.dataset.go3.slice (7))); b.disabled = ! selected; b.classList.toggle ('hotspot-inactive3',
      ! selected)
    })
  };
  $$ ('[data-section]').forEach (b => b.onclick = () => go3 (b.dataset.section === 'schools' ? 'schools' : b.dataset.section === 'learning' ?
  'learning' : 'profile'));
}
export { bindAppControls };

let globalLifecycleBound53=false,overviewRefresh53=null;
function searchButton53(){return '<div class="global-search-anchor53"><button class="global-search-button53" data-open-search53 aria-label="搜索（Ctrl K）" aria-expanded="false">'+icon3('search')+'</button></div>';}
async function refreshHomeOverview53(){ctx.homeOverview53=await storage.get('settings:learning-overview53')||null;}
function bindGlobalControls53(){document.querySelectorAll('[data-open-search53]').forEach(button=>button.onclick=async()=>{const module=await loadFeature53('search');module.openSearch53();});document.querySelectorAll('[data-mode-lite53]').forEach(button=>button.onclick=async()=>{try{await saveDeviceSettings53({mode:'lite'});render();}catch(error){toast(error.message);}});}
function bindGlobalLifecycle53(){if(globalLifecycleBound53)return;globalLifecycleBound53=true;document.addEventListener('keydown',async event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();const module=await loadFeature53('search');module.openSearch53();}});const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('qicheng-home-overview53'):null;channel?.unref?.();const refresh=()=>{if(ctx.state?.route==='home'&&!overviewRefresh53)overviewRefresh53=setTimeout(async()=>{overviewRefresh53=null;try{await refreshHomeOverview53();if(ctx.state.route==='home')refreshHomeOverviewView53();}catch{}},250);};if(channel)channel.onmessage=refresh;window.addEventListener('qicheng-local-write',()=>{refresh();channel?.postMessage('local-write');});window.addEventListener('focus',refresh);}
