import { clone, validData3 } from './helpers.js';
import { fresh, photoRefs3 } from '../model.js';
import { PROFILE, EDU_FIELDS, EDU_STAGES, AWARD_FIELDS, EXP_FIELDS, EXAM_FIELDS, BOOK_FIELDS, ACHIEVEMENT_FIELDS, MODULES, NAV3, THEMES, draftKeys } from '../constants.js';
import { SCHOOLS, CLASSICS } from '../data.js';
const fail = path => {
  throw new Error ('备份数据格式不正确：' + path);
};
const object = (value, path) => {
  if (! value || typeof value !== 'object' || Array.isArray (value)) fail (path);
};
const text = (value, path) => {
  if (typeof value !== 'string' || value.length > 100000) fail (path);
};
const list = (value, path, limit = 500) => {
  if (! Array.isArray (value) || value.length > limit) fail (path);
};
const id = (value, path) => {
  if (typeof value !== 'string' || ! /^[A-Za-z0-9_-]{1,100}$/.test (value)) fail (path);
};
const choice = (value, choices, path) => {
  if (! choices.includes (value)) fail (path);
};
const number = (value, min, max, path) => {
  if (! Number.isFinite (value) || value < min || value > max) fail (path);
};
const flag = (value, path) => {
  if (typeof value !== 'boolean') fail (path);
};
function stringList (value, path, limit = 4000) {
  list (value, path, limit);
  value.forEach (v => text (v, path));
}
function unique (values, path) {
  if (new Set (values).size !== values.length) fail (path + '（重复编号）');
}
function fields (record, definitions, path) {
  object (record, path);
  definitions.forEach (([name]) => text (record [name], path + '.' + name));
}
function assertJSON (value, path = 'data', depth = 0) {
  if (depth > 30) fail (path + '（嵌套过深）');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite (value)) return;
  if (Array.isArray (value)) {
    value.forEach ((v, i) => assertJSON (v, path + '[' + i + ']', depth + 1));
    return;
  }
  object (value, path);
  for (const [key, v] of Object.entries (value)) {
    if (['__proto__', 'prototype', 'constructor'].includes (key)) fail (path + '.' + key);
    assertJSON (v, path + '.' + key, depth + 1);
  }
}
function crop (value, path) {
  if (! value) return;
  object (value, path);
  choice (value.ratio, ['original', 'id', 'square', 'circle', 'custom'], path + '.ratio');
  number (value.x, 0, 100, path + '.x');
  number (value.y, 0, 100, path + '.y');
  number (value.zoom, 1, 3, path + '.zoom');
  number (value.w, 1, 20, path + '.w');
  number (value.h, 1, 20, path + '.h');
}
function validateResumeVersion53(v,assets){
 const r=v.resume53;object(r,'resume53');if(r.schemaVersion!==1)fail('resume53.schemaVersion');object(r.base,'resume53.base');flag(r.blank,'resume53.blank');
 let count53=0;const bounded53=(value,depth=0)=>{if(++count53>100000||depth>18)fail('resume53（内容过多或嵌套过深）');if(typeof value==='string'){text(value,'resume53.text');return;}if(value===null||typeof value==='boolean'||typeof value==='number')return;if(Array.isArray(value)){list(value,'resume53.list',2000);value.forEach(x=>bounded53(x,depth+1));return;}object(value,'resume53.object');for(const [key,val]of Object.entries(value)){if(['data','_assetBlobRef','_assetPreview','assets','versions'].includes(key))fail('resume53（不得复制附件原文或本机指针）');if(key==='assetId'&&!assets.has(val))fail('resume53.assetId（引用资料已缺失）');if(key==='attachments'){list(val,'resume53.attachments',1500);for(const ref of val)if(!assets.has(ref))fail('resume53.attachments');}bounded53(val,depth+1);}};
 for(const key of Object.keys(r.base))if(!['profile','education','statement','academics','awards','experiences','practices','achievements','exams','learning','customBlocks','avatar','avatarCrop','media'].includes(key))fail('resume53.base.'+key);bounded53(r.base);
 const path=value=>{text(value,'resume53.path');if(value.length>300||! /^[A-Za-z0-9_.:-]+$/.test(value)||value.split(/[.:]/).some(k=>['__proto__','constructor','prototype'].includes(k)))fail('resume53.path');};
 const style=value=>{object(value,'resume53.style');for(const key of Object.keys(value))if(!['fontSize','titleSize','color','titleColor','titleAlign','titleBold','subtitleSize','subtitleAlign','subtitleBold','labelBold','layout','bodyColor'].includes(key))fail('resume53.style.'+key);for(const key of ['fontSize','titleSize','subtitleSize'])if(value[key]!==undefined)number(value[key],6,36,'resume53.style.'+key);for(const key of ['color','titleColor','bodyColor'])if(value[key]!==undefined&&value[key]!==''&&!/^#[0-9a-f]{6}$/i.test(value[key]))fail('resume53.style.'+key);};
 for(const key of ['overrides','labels','styles','recordOrder','fieldOrder','addedRecords','addedFields'])object(r[key],'resume53.'+key);
 for(const [key,value]of Object.entries(r.overrides)){path(key);text(value,'resume53.overrides');}
 for(const [key,value]of Object.entries(r.labels)){path(key);text(value,'resume53.labels');}
 for(const [key,value]of Object.entries(r.styles)){path(key);style(value);}
 for(const key of ['hidden','sectionOrder']){stringList(r[key],'resume53.'+key,10000);unique(r[key],'resume53.'+key);r[key].forEach(path);}
 for(const kind of ['recordOrder','fieldOrder'])for(const [key,items]of Object.entries(r[kind])){path(key);stringList(items,'resume53.order',10000);unique(items,'resume53.order');items.forEach(path);}
 const customField=f=>{object(f,'resume53.field');id(f.id,'resume53.field.id');text(f.label,'resume53.field.label');text(f.value,'resume53.field.value');if(f.hidden!==undefined)flag(f.hidden,'resume53.field.hidden');if(f.style)style(f.style);};
 for(const [key,records]of Object.entries(r.addedRecords)){choice(key,['education','awards','experiences','practices','achievements','exams','learning','custom'],'resume53.addedRecords');list(records,'resume53.addedRecords',500);unique(records.map(x=>x.id),'resume53.addedRecords');for(const rec of records){id(rec.id,'resume53.record.id');object(rec,'resume53.record');bounded53(rec);}}
 for(const [key,items]of Object.entries(r.addedFields)){path(key);list(items,'resume53.addedFields',100);unique(items.map(f=>f.id),'resume53.addedFields');items.forEach(customField);}
 list(r.customModules,'resume53.customModules',100);unique(r.customModules.map(m=>m.id),'resume53.customModules');
 for(const m of r.customModules){id(m.id,'resume53.module.id');text(m.title,'resume53.module.title');choice(m.layout,['list','text','timeline','image'],'resume53.module.layout');if(m.hidden!==undefined)flag(m.hidden,'resume53.module.hidden');if(m.style)style(m.style);list(m.entries,'resume53.entries',500);unique(m.entries.map(e=>e.id),'resume53.entries');for(const e of m.entries){id(e.id,'resume53.entry.id');text(e.title,'resume53.entry.title');if(e.hidden!==undefined)flag(e.hidden,'resume53.entry.hidden');list(e.fields,'resume53.fields',100);unique(e.fields.map(f=>f.id),'resume53.fields');e.fields.forEach(customField);if(e.photos)bounded53(e.photos);if(e.attachments)bounded53({attachments:e.attachments});}}
 object(r.cover,'resume53.cover');flag(r.cover.enabled,'resume53.cover.enabled');text(r.cover.title,'resume53.cover.title');object(r.toc,'resume53.toc');flag(r.toc.enabled,'resume53.toc.enabled');stringList(r.toc.sections,'resume53.toc.sections',200);r.toc.sections.forEach(path);
 choice(r.template,['original','classic','modern','academic'],'resume53.template');object(r.design,'resume53.design');choice(r.design.columns,[1,2],'resume53.design.columns');text(r.design.fontFamily,'resume53.design.fontFamily');if(r.design.sectionLines!==undefined)flag(r.design.sectionLines,'resume53.design.sectionLines');
}
function validateDraft (input, {trustedLocal = false} = {}) {
  assertJSON (input);
  object (input, 'current');
  if (input.format !== 'qicheng-resume' || input.version !== 6) throw new Error ('这不是当前 PWA 版本的启程数据。');
  const s = clone (input), defaults = fresh ();
  // Additive 5.2 fields: old 5.1 workspaces and backups remain readable.
  for (const key of ['introductions','introductionDraft']) if (!Object.hasOwn(s,key)) s[key]=clone(defaults[key]);
  if (s.statement && !Object.hasOwn(s.statement,'other')) s.statement.other='';
  if (s.statement && !Object.hasOwn(s.statement,'otherLanguage')) s.statement.otherLanguage='';
  // Navigation is deliberately omitted from backups. Older backups retain these fields.
  for (const key of ['route', 'section', 'step', 'sidebarHidden', 'menuOpen']) if (! Object.hasOwn (s, key)) s[key] = clone(defaults[key]);
  for (const key of Object.keys (defaults)) if (! Object.hasOwn (s, key)) fail ('current.' + key + '（必要字段缺失）');
  text (s.appVersion, 'appVersion');
  fields (s.profile, PROFILE, 'profile');
  fields (s.statement, [['zh'], ['en'], ['strengths'], ['hobbies']], 'statement');
  fields(s.statement,[['otherLanguage'],['other']],'statement');
  list(s.introductions,'introductions',1000);unique(s.introductions.map(x=>x?.id),'introductions');
  for(const item of s.introductions){
    object(item,'introductions');id(item.id,'introductions.id');
    fields(item,[['title'],['language'],['note'],['body'],['updatedAt']],'introductions');
    if(!item.language.trim()||!item.body.trim()||!Number.isFinite(Date.parse(item.updatedAt)))fail('introductions');
    number(item.durationSeconds,1,86400,'introductions.durationSeconds');
    if(!Number.isInteger(item.durationSeconds))fail('introductions.durationSeconds');
  }
  fields(s.introductionDraft,[['id'],['title'],['language'],['minutes'],['seconds'],['note'],['body']],'introductionDraft');
  fields (s.academics, [['languageLearning'], ['certificates']], 'academics');
  object (s.learning, 'learning');
  ['readingNotes', 'plan', 'notes'].forEach (k => text (s.learning [k], 'learning.' + k));
  choice (s.theme, ['pudding', 'obsidian', 'blue'], 'theme');
  if(s.theme==='blue')s.theme='pudding';
  choice (s.uiLang, ['zh', 'en'], 'uiLang');
  flag (s.onboarded, 'onboarded');
  flag (s.sidebarHidden, 'sidebarHidden');
  choice (s.section, ['resume', 'schools', 'learning'], 'section');
  number (s.step, 0, 9, 'step');
  if (! Number.isInteger (s.step)) fail ('step');
  choice (s.orientation, ['portrait', 'landscape'], 'orientation');
  stringList (s.menuOpen, 'menuOpen', NAV3.length);
  s.menuOpen.forEach (k => choice (k, NAV3.map (g => g.id), 'menuOpen'));
  text (s.route, 'route');
  const routes = ['studio','resumes','export-center','learning-review','question-bank','quiz-history','learning-stats',...NAV3.flatMap (g => g.items.map (i => i [0])), 'backup', 'settings', 'daily-quote', 'quiz', 'explore', ...CLASSICS.books.map (book => 'classic:' + book.id)];
  if (! routes.includes (s.route) && !/^(?:resume-editor|resume-review):[A-Za-z0-9_-]{1,100}$/.test(s.route) && !/^question:[A-Za-z0-9][A-Za-z0-9._-]{0,119}\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(s.route) && !/^classic:[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(s.route)) {
    try {
      if (! s.route.startsWith ('school:') || ! SCHOOLS.some (x => x.name === decodeURIComponent (s.route.slice (7)))) fail ('route');
    }
    catch {
      fail ('route');
    }
  }
  stringList (s.dreamSchools, 'dreamSchools', 100);
  unique (s.dreamSchools, 'dreamSchools');
  s.dreamSchools.forEach (name => {
    if (! SCHOOLS.some (x => x.name === name)) fail ('dreamSchools');
  });
  if (s.savedAt !== null && (typeof s.savedAt !== 'string' || ! Number.isFinite (Date.parse (s.savedAt)))) fail ('savedAt');
  list (s.assets, 'assets', 1500);
  unique (s.assets.map (a => a?.id), 'assets');
  const assets = new Map ();
  for (const a of s.assets) {
    if (!trustedLocal && (a._assetBlobRef || a._assetPreview)) fail ('assets（外部备份不能含本机附件指针）');
    object (a, 'assets');
    id (a.id, 'assets.id');
    text (a.name, 'assets.name');
    text (a.mime, 'assets.mime');
    choice (a.kind, ['image', 'file', 'export'], 'assets.kind');
    if (! validData3 (a.data) || a.data.split (',') [1].length % 4 !== 0) fail ('assets.data');
    if (! Number.isFinite (a.size) || a.size < 0) fail ('assets.size');
    text (a.createdAt, 'assets.createdAt');
    text (a.source, 'assets.source');
    assets.set (a.id, a);
  }
  function photo (p, path) {
    object (p, path);
    id (p.id, path + '.id');
    text (p.name, path + '.name');
    if (p.caption !== undefined) text (p.caption, path + '.caption');
    if (p.link !== undefined) text (p.link, path + '.link');
    crop (p.crop, path + '.crop');
    const a = p.assetId && assets.get (p.assetId);
    if (p.assetId && (! a || a.kind !== 'image')) fail (path + '.assetId（图片关联失效）');
    const data = a?.data || p.data;
    if (! validData3 (data) || ! /^data:image\//.test (data)) fail (path + '.data');
    if (a && p.data && p.data !== a.data) fail (path + '.data（图片与原始资料不一致）');
    p.data = data;
  }
  function attachments (record, path) {
    if (record.photos !== undefined) {
      list (record.photos, path + '.photos', 100);
      record.photos.forEach (p => photo (p, path + '.photos'));
      unique (record.photos.map (p => p.id), path + '.photos');
    }
    if (record.attachments !== undefined) {
      stringList (record.attachments, path + '.attachments', 1500);
      record.attachments.forEach (k => {
        if (! assets.has (k)) fail (path + '.attachments（文件关联失效）');
      });
    }
  }
  function records (array, definitions, path, limit = 500) {
    list (array, path, limit);
    unique (array.map (r => r?.id), path);
    for (const record of array) {
      fields (record, definitions, path);
      id (record.id, path + '.id');
      if (record.priority !== undefined) text (record.priority, path + '.priority');
      attachments (record, path);
    }
  }
  records (s.education, EDU_FIELDS, 'education', 60);
  for (const e of s.education) choice (e.stage, EDU_STAGES, 'education.stage');
  for (const [key, definitions] of [['awards', AWARD_FIELDS], ['experiences', EXP_FIELDS], ['practices', EXP_FIELDS],
  ['achievements', ACHIEVEMENT_FIELDS], ['exams', EXAM_FIELDS]]) records (s [key], definitions, key);
  records (s.learning.books, BOOK_FIELDS, 'learning.books');
  records (s.customBlocks, [['title'], ['text']], 'customBlocks', 100);
  s.customBlocks.forEach (b => choice (b.layout, ['text', 'stack', 'left', 'right', 'gallery'], 'customBlocks.layout'));
  const kinds = {
    ...draftKeys, practices : 'practiceDraft', achievements : 'achievementDraft'
  };
  const defs = {
    awards : AWARD_FIELDS, experiences : EXP_FIELDS, practices : EXP_FIELDS, achievements : ACHIEVEMENT_FIELDS, exams : EXAM_FIELDS,
    books : BOOK_FIELDS
  };
  for (const [kind, key] of Object.entries (kinds)) records ([s [key]], defs [kind], key, 1);
  for (const exam of [...s.exams, s.examDraft]) records (exam.subjects, [['name'], ['score'], ['fullMark'], ['rank']],
  'exams.subjects', 40);
  list (s.media, 'media', 200);
  s.media.forEach (p => photo (p, 'media'));
  if (s.avatar !== null) photo (s.avatar, 'avatar');
  object (s.avatarCrop, 'avatarCrop');
  number (s.avatarCrop.x, 0, 100, 'avatarCrop.x');
  number (s.avatarCrop.y, 0, 100, 'avatarCrop.y');
  number (s.avatarCrop.zoom, 1, 3, 'avatarCrop.zoom');
  list (s.versions, 'versions', 100);
  unique (s.versions.map (v => v?.id), 'versions');
  for (const v of s.versions) {
    object (v, 'versions');
    if(v.resume53)validateResumeVersion53(v,assets);
    if(v.targets53!==undefined)stringList(v.targets53,'versions.targets53',100);
    for(const key of ['createdAt53','modifiedAt53'])if(v[key]!==undefined&&v[key]!==null&&(typeof v[key]!=='string'||!Number.isFinite(Date.parse(v[key]))))fail('versions.'+key);
    for(const [key,value] of Object.entries({paperColor:'#ffffff',lineColor:'#d6d6d6',titleColor:'#000000',paperImage:'',layoutPreset:'custom'})) if(!Object.hasOwn(v,key))v[key]=value;
    for(const key of ['paperColor','lineColor','titleColor'])if(!/^#[0-9a-f]{6}$/i.test(v[key]))fail('versions.'+key);
    if(typeof v.paperImage!=='string'||v.paperImage.length>6000000||(v.paperImage&&!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(v.paperImage)))fail('versions.paperImage');
    choice(v.layoutPreset,['compact','standard','airy','custom'],'versions.layoutPreset');
    id (v.id, 'versions.id');
    ['name', 'target', 'filename'].forEach (k => text (v [k], 'versions.' + k));
    for (const k of ['order', 'disabled', 'excluded', 'hiddenFields', 'includedFields', 'breaks']) stringList (v [k],
    'versions.' + k);
    unique (v.order, 'versions.order');
    if (v.order.length !== MODULES.length || MODULES.some (k => ! v.order.includes (k))) fail ('versions.order');
    v.disabled.forEach (k => choice (k, MODULES, 'versions.disabled'));
    for (const k of ['moduleStyles', 'titles', 'summaries']) object (v [k], 'versions.' + k);
    for (const k of ['titles', 'summaries']) Object.values (v [k]).forEach (x => text (x, 'versions.' + k));
    for (const [key, st] of Object.entries (v.moduleStyles)) {
      choice (key, MODULES, 'moduleStyles');
      object (st, 'moduleStyles.' + key);
      if(Object.hasOwn(st,'titleColor')&&st.titleColor!==''&&!/^#[0-9a-f]{6}$/i.test(st.titleColor))fail('moduleStyles.titleColor');
      for (const k of ['titleSize', 'subtitleSize']) number (st [k], k === 'titleSize' ? 10 : 9, k === 'titleSize' ? 28 : 20,
      'moduleStyles.' + k);
      for (const k of ['titleAlign', 'subtitleAlign']) choice (st [k], ['left', 'center'], 'moduleStyles.' + k);
      for (const k of ['titleBold', 'subtitleBold', 'labelBold']) flag (st [k], 'moduleStyles.' + k);
    }
    choice (v.palette, [...Object.keys (THEMES), 'bw'], 'versions.palette');
    choice (v.background, ['full', 'accent', 'none'], 'versions.background');
    choice (v.orientation, ['portrait', 'landscape'], 'versions.orientation');
    choice (v.statementLang, ['both', 'zh', 'en'], 'versions.statementLang');
    choice (v.exportLang, ['zh', 'en'], 'versions.exportLang');
    choice (v.photoMode, ['inline', 'appendix', 'none'], 'versions.photoMode');
    choice (v.photosPerRow, [1, 2, 3], 'versions.photosPerRow');
    choice (v.avatarShape, ['square', 'circle', 'id', 'custom'], 'versions.avatarShape');
    choice (v.pptMode, ['editable', 'image'], 'versions.pptMode');
    // Older documents keep their original settings and receive the same plain/page-number defaults at rendering time.
    if (Object.hasOwn (v, 'pageDecoration')) choice (v.pageDecoration, ['plain', 'frame', 'editorial'], 'versions.pageDecoration');
    if (Object.hasOwn (v, 'showPageNumbers')) flag (v.showPageNumbers, 'versions.showPageNumbers');
    choice (v.purpose, ['resume', 'reading', 'custom'], 'versions.purpose');
    for (const [key, min, max] of [['margin', 8, 32], ['fontSize', 8, 16], ['lineHeight', 1.1, 2], ['gap', 2, 24], ['avatarSize',
    20, 48], ['avatarRatioW', 1, 20], ['avatarRatioH', 1, 20]]) number (v [key], min, max, 'versions.' + key);
    for (const key of ['showAvatar', 'boldLabels', 'showToc', 'wordImages', 'wordBW']) flag (v [key], 'versions.' + key);
  }
  if (s.versions.length?!s.versions.some (v => v.id === s.activeVersion):s.activeVersion!=='') fail ('activeVersion');
  list (s.exportHistory, 'exportHistory', 1500);
  unique (s.exportHistory.map (x => x?.id), 'exportHistory');
  for (const e of s.exportHistory) {
    object (e, 'exportHistory');
    id (e.id, 'exportHistory.id');
    ['assetId', 'name', 'type', 'createdAt', 'versionId'].forEach (k => text (e [k], 'exportHistory.' + k));
    if (assets.get (e.assetId)?.kind !== 'export') fail ('exportHistory.assetId');
    choice (e.purpose, ['resume', 'reading', 'custom'], 'exportHistory.purpose');
  }
  flag (s.chartSelectionSet, 'chartSelectionSet');
  stringList (s.chartExamIds, 'chartExamIds', 500);
  s.chartExamIds.forEach (k => {
    if (! s.exams.some (x => x.id === k)) fail ('chartExamIds');
  });
  choice (s.chartMetric, ['totalScore', 'subject'], 'chartMetric');
  text (s.chartSubject, 'chartSubject');
  text (s.filePackageName, 'filePackageName');
  object (s.organizeModes, 'organizeModes');
  for (const k of ['awards', 'experiences', 'practices']) choice (s.organizeModes [k], ['scope', 'category', 'custom'],
  'organizeModes.' + k);
  return s;
}
export { validateDraft, assertJSON };
