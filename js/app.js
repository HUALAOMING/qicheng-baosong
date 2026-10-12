import { dropRecord, moveRecord, organizationPage3 } from './modules/organization.js';
import { selectedPhotos, uploadBatch, avatarData } from './modules/images.js';
import { chartValue3, selectedExams3, dashboardPage3, drawDashboard3 } from './modules/dashboard.js';
import { exportArchive3, importAssets3, assetUsage3, archivePage3, materialsPage3, outputsPage3 } from './modules/materials.js';
import { normalizeAssets3, fresh, snapshot3, synchronizeEditing, cats, currentVersion, newVersion } from './model.js';
import { selectedAttachments3, ensureFonts, exportFile, documentPlan, pdfBytes, pptBlob, wordBlob, canvasPages, exportHTML3, refreshPreview } from './modules/export.js';
import { $$, $, clone, download, icon3, options, toast, tr, translateUI, uid, flip } from './utils/helpers.js';
import { storage } from './storage.js';
import { loadBuiltinData, SCHOOL_DETAILS3 } from './data.js';
import { validateDraft } from './utils/validation.js';
import { save, initializeSaving301, scheduleSave, updateSaveStatus301 } from './autosave.js';
import { clearAll, exportBackup, offlineHTML, openBackupText } from './backup.js';
import { openSettings, openOfflineGuide } from './modules/settings.js';
import { markdown, markdownTemplate31, parseMarkdown31, applyMarkdown31, importMarkdownFile31 } from './modules/markdown.js';
import { exportRows, textRows, preflight3, allPhotos, customPage3, previewPage } from './modules/resume.js';
import { filteredSchools3, toggleDream, schoolDetail3, schoolPage, bindSchoolCards3, schoolCards } from './modules/universities.js';
import { collect, entryPage3, learningPage3 } from './modules/records.js';
import { closeProvince31, updateMap31 } from './modules/map.js';
import { VERSION, BULB, GEAR, LOGO, MODULES, NAV3, ROUTE22, blankEducation, blankSubject } from './constants.js';
import { pwa } from './pwa.js';
import { ctx } from './state.js';
import { academicsPage, educationPage, profilePage, statementPage } from './modules/profile.js';
import { bind } from './events.js';
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
  if (route.startsWith ('school:')) return tr ('院校详情', 'University details');
  for (const g of NAV3) {
    const x = g.items.find (x => x [0] === route);
    if (x) return tr (x [1], x [2])
  }
  return tr ('个人工作台', 'Workspace')
}

function routeGroup3 (route = ctx.state.route) {
  return NAV3.find (g => g.items.some (x => x [0] === route)) || NAV3.find (g => g.id === 'info')
}

async function go3 (route) {
  if (ctx.busy || ctx.uploadBusy) return;
  ctx.state.route = route;
  ctx.state.section = route === 'schools' || route.startsWith ('school:') ? 'schools' : route === 'learning' ? 'learning' : 'resume';
  const i = ROUTE22.indexOf (route);
  ctx.state.step = i >= 0 ? i : 0;
  const g = routeGroup3 (route);
  if (g && ! ctx.state.menuOpen.includes (g.id)) ctx.state.menuOpen.push (g.id);
  if (innerWidth <= 900) document.body.classList.remove ('nav-mobile-open');
  scheduleSave ();
  render ();
  window.scrollTo ( {
    top : 0, behavior : 'auto'
  })
}

async function navigate (section, step) {
  return go3 (section === 'schools' ? 'schools' : section === 'learning' ? 'learning' : ROUTE22 [step] || 'profile')
}

function shell (content) {
  const active = routeGroup3 (), isMobile = innerWidth <= 900;
  return '<div class="shell3 ' + (ctx.state.sidebarHidden ? 'nav-hidden' : '') + '"><button class="nav-backdrop" data-action3="toggleNav" aria-label="' +
  tr ('收起菜单', 'Close menu') + '"></button><aside class="sidebar3" id="sidebar3" ' + ((isMobile ? ! document.body.classList.contains ('nav-mobile-open') : ctx.state.sidebarHidden) ?
  'inert' : '') + '><a class="brand3" href="#" data-go3="dashboard"><span class="brand-mark">' + LOGO + '</span><span><strong>启程<span class="brand-version">4.0 Beta</span></strong><small>PERSONAL STUDIO</small></span></a><div class="nav-caption">' +
  tr ('我的成长档案', 'YOUR PERSONAL WORKSPACE') + '</div><nav aria-label="' + tr ('工作台导航', 'Workspace navigation') + '">' +
  NAV3.map (g => '<section class="nav-group ' + (ctx.state.menuOpen.includes (g.id) ? 'is-open' : '') + '"><button class="nav-group-toggle ' +
  (g.id === active?.id ? 'active-group' : '') + '" data-nav-group="' + g.id + '" aria-expanded="' + ctx.state.menuOpen.includes (g.id) +
  '">' + icon3 (g.icon) + '<span>' + tr (g.zh, g.en) + '</span><i>' + icon3 ('chevron') + '</i></button><div class="nav-sub" ' +
  (ctx.state.menuOpen.includes (g.id) ? '' : 'inert') + '><div>' + g.items.map (x => '<button data-go3="' + x [0] +
  '" class="nav-item ' + (ctx.state.route === x [0] ? 'active' : '') + '" ' + (ctx.state.route === x [0] ? 'aria-current="page"' : '') +
  '>' + tr (x [1], x [2]) + '</button>').join ('') + '</div></div></section>').join ('') + '</nav><div class="sidebar-tools"><div id="savedStatus" class="save-status">' +
  tr ('本机自动保存', 'Auto-save on this device') + '</div><div class="side-actions"><button data-action="backup">' + tr ('备份进度',
  'Back up') + '</button><button data-action="restore">' + tr ('恢复备份', 'Restore') + '</button></div><div class="md-tools31"><button data-md-template31>' +
  icon3 ('export') + tr ('下载 Markdown 样板', 'Download Markdown template') + '</button><button data-md-import31>' + icon3 ('folder') +
  tr ('导入 Markdown 资料', 'Import Markdown materials') + '</button></div><button class="offline-save" data-action="offlineCopy">' +
  icon3 ('export') + '<span>' + tr ('保存可编辑离线副本', 'Save editable offline copy') + '</span></button><div class="side-actions"><button data-action="offlineHelp">' +
  tr ('离线说明', 'Offline guide') + '</button><button data-action="backupText">' + tr ('备份文本', 'Backup text') + '</button></div><button class="clear-all" data-action="clearAll">' +
  tr ('清空全部内容', 'Clear all content') + '</button><div class="side-setting"><button data-action="settings">' + GEAR +
  '<span>' + tr ('设置', 'Settings') + '</span></button><small>v4.0 Beta · ' + tr ('离线版', 'OFFLINE') + '</small></div></div></aside><main class="main3"><header class="topbar3"><div class="topbar-left"><button class="menu-toggle" data-action3="toggleNav" aria-controls="sidebar3" aria-expanded="' +
  (isMobile ? document.body.classList.contains ('nav-mobile-open') : ! ctx.state.sidebarHidden) + '" aria-label="' +
  tr ('展开或收起菜单', 'Toggle menu') + '">' + icon3 ('menu') + '</button><span class="breadcrumb">' + tr (active?.zh || '工作台',
  active?.en || 'Workspace') + ' <em>/</em> <strong>' + routeName3 () + '</strong></span></div><div class="topbar-actions"><button data-go3="studio">' +
  tr ('导出成果', 'Create document') + ' ' + icon3 ('export') + '</button><button class="primary" data-action="save">' +
  tr ('保存进度', 'Save') + '</button></div></header><div class="page-content3" id="workspaceContent">' + content + '</div><footer class="quiet-footer"><span>QICHENG PERSONAL STUDIO</span><span>' +
  tr ('在这里，记录成长的每一步。', 'A place for every step of your growth.') + '</span></footer></main></div>' + help () + '<input type="file" id="backupInput" accept=".json,application/json" hidden><datalist id="awardCategories">' +
  options (cats ('awards'), '') + '</datalist><datalist id="experienceCategories">' + options (cats ('experiences'),
  '') + '</datalist><datalist id="languageList">' + options (['英语', '德语', '西班牙语', '法语', '日语', '俄语'], '') + '</datalist>'
}

function render () {
  ctx.previewToken ++;
  if (! ctx.state.route) ctx.state.route = ROUTE22 [ctx.state.step] || 'profile';
  document.body.dataset.theme = ctx.state.theme;
  const pages3 = {
    profile : profilePage, education : educationPage, statement : statementPage, academics : academicsPage, awards : () =>
    entryPage3 ('awards'), experiences : () => entryPage3 ('experiences'), practices : () => entryPage3 ('practices'),
    'sort-awards' : () => organizationPage3 ('awards'), 'sort-experiences' : () => organizationPage3 ('experiences'),
    'sort-practices' : () => organizationPage3 ('practices'), learning : learningPage3, achievements : () => entryPage3 ('achievements'),
    custom : customPage3, dashboard : dashboardPage3, images : () => materialsPage3 ('image'), files : () => materialsPage3 ('file'),
    outputs : outputsPage3, studio : previewPage, archive : archivePage3, schools : schoolPage
  };
  const page = ctx.state.route.startsWith ('school:') ? () => schoolDetail3 (decodeURIComponent (ctx.state.route.slice (7))) : pages3 [ctx.state.route] ||
  profilePage;
  $ ('#app').innerHTML = shell (page ());
  document.title = '启程 4.0 Beta · ' + routeName3 ();
  bind ();
  translateUI ();
  updateSaveStatus301 ();
  pwa.bind ();
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

function help () {
  return '<button class="help-toggle" id="helpToggle" data-action="help" aria-label="' + tr ('打开帮助', 'Open help') +
  '" aria-expanded="false">' + BULB + '</button><aside id="helpPanel" class="help-panel" hidden><div class="panel-title"><h2>' +
  tr ('使用帮助', 'Help') + '</h2><button data-action="closeHelp">×</button></div><p>' + tr ('菜单按录入、整理、个性内容、看板、资料与导出分区。点击三道杠可隐藏或展开菜单。',
  'Use the menu for information, organization, personal content, dashboard, materials and export. The menu button expands or hides navigation.') +
  '</p><p>' + tr ('所有上传内容都会进入资料中心。移除记录中的附件只解除关联；在资料中心删除会二次确认并同时解除全部关联。', 'Uploads appear in Materials. Removing an attachment from a record only unlinks it. Deleting in Materials asks for confirmation and removes all links.') +
  '</p><p>' + tr ('导出内容、字段、照片、顺序与排版设置仍独立保存在每份文档版本中。导出前检查会列出缺项与重复记录。', 'Each document version keeps its own fields, photos, order and styling. Preflight checks flag omissions and repeated records.') +
  '</p><p>' + tr ('填写后约半秒自动保存；保存失败会提示。可在设置中导出完整 JSON 备份，离线时也可编辑、预览和导出。资料中心的个人资料 ZIP 与可编辑 HTML 副本继续保留。', 'Edits save after half a second. Failures are reported. Use Settings to export a complete JSON backup; editing, previews and exports work offline. Personal archive ZIP and editable HTML copies remain available.') +
  '</p></aside>'
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
    $ ('#sidebar3').inert = ctx.state.sidebarHidden;
    scheduleSave ()
  }
}

export { confirmAction, v2Action, routeName3, routeGroup3, go3, navigate, shell, render, changed, help, toggleNav3 };

async function action (name) {
  if (ctx.busy && ! ['help', 'closeHelp'].includes (name)) return;
  if (name === 'settings') return openSettings ();
  if (name === 'save') {
    if (await save ()) toast (tr ('当前进度已保存', 'Saved'));
    return;
  }
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
    const panel = $ ('#helpPanel');
    panel.hidden = name === 'closeHelp' ? true : ! panel.hidden;
    $ ('#helpToggle').setAttribute ('aria-expanded', String (! panel.hidden));
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
  const stored = await storage.get ('current');
  const embedded = globalThis.QICHENG_EMBEDDED?.draft;
  if (stored !== undefined) ctx.state = validateDraft (stored);
  else if (embedded && !await storage.get('__seedCleared')) {
    ctx.state = validateDraft (embedded);
    await storage.set ('current', snapshot3 ());
  }
  await ensureFonts ();
  ctx.initialized = true;
  synchronizeEditing ();
  initializeSaving301 ();
  render ();
  window.addEventListener ('beforeunload', event => {
    if (ctx.dirty301 || ctx.saveError) {
      save (); event.preventDefault (); event.returnValue = '';
    }
  });
  document.addEventListener ('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save ();
  });
  window.addEventListener ('pagehide', () => save ());
  window.addEventListener ('unhandledrejection', event => {
    toast (tr ('操作未完成：', 'Operation failed: ') + (event.reason?.message || String (event.reason)));
  });
  window.addEventListener ('error', event => {
    toast (tr ('操作出现错误：', 'An operation failed: ') + event.message);
  });
  document.addEventListener ('keydown', event => {
    if (event.key !== 'Escape') return; if ($ ('#helpPanel')) {
      $ ('#helpPanel').hidden = true; $ ('#helpToggle')?.setAttribute ('aria-expanded', 'false');
    }
    if (document.body.classList.contains ('nav-mobile-open')) toggleNav3 (); closeProvince31 ();
  });
  document.addEventListener ('pointerdown', event => {
    if (! event.target.closest?.('#mapStage31')) closeProvince31 ();
  });
  window.ResumeStudio = {
    version : VERSION, fresh, currentVersion, newVersion, validateDraft, documentPlan, pdfBytes, pptBlob, wordBlob, canvasPages,
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
  if (! ctx.state.onboarded) openSettings (true);
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
    id, open); b.closest ('.nav-group').classList.toggle ('is-open', open); b.setAttribute ('aria-expanded', String (open)); b.nextElementSibling.inert = ! open; scheduleSave ()
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
