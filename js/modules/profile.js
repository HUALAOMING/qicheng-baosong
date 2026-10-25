import { $, $$, area, esc, head, input, options, select, tr, translateLabel } from '../utils/helpers.js';
import { ctx } from '../state.js';
import { EDU_FIELDS, EDU_STAGES, EXAM_TYPES, PROFILE, blankEducation, draftKeys } from '../constants.js';
import { currentVersion, records } from '../model.js';
import { save, scheduleSave } from '../autosave.js';
import { changed, confirmAction, render } from '../app.js';
import { collect } from './records.js';
import {introductionPicker52,bindIntroductionImports52} from './introductions.js';
// 启程 · js/modules/profile.js


function profilePage () {
  return head ('INFORMATION / PROFILE', '从基本信息开始。') + '<div class="work-grid"><section class="panel">' + avatarEditor () +
  '<div class="grid2">' + PROFILE.filter (([k]) => ! ['targetSchool', 'targetMajor'].includes (k)).map (([k, l]) =>
  input ('profile.' + k, l, ctx.state.profile [k], {
    school : '中学全称', grade : '例如：高2027届', schoolLanguage : '高中主要学习的外语'
  }
  [k] || '', k === 'birthday' ? 'date' : k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text', k === 'schoolLanguage' ?
  'list="languageList"' : '')).join ('') + '</div>' + (ctx.state.dreamSchools.length ? '<label class="field"><span>从梦想院校中选择</span><select id="dreamChoice"><option value="">选择学校，或在下方自由输入</option>' +
  options (ctx.state.dreamSchools, ctx.state.profile.targetSchool) + '</select></label>' : '') + input ('profile.targetSchool',
  '目标院校', ctx.state.profile.targetSchool, '可自由输入院校名称') + input ('profile.targetMajor', '语言 / 申请专业', ctx.state.profile.targetMajor,
  '例如：德语、法语、国际关系') + '</section><aside><section class="panel mini-preview"><div class="eyebrow">简历轮廓</div><h3 id="miniName">' +
  esc (ctx.state.profile.name || '你的名字') + '</h3><p id="miniSchool">' + esc (ctx.state.profile.school || '你的学校') + '</p><div class="paper-stat"><span class="badge">' +
  ctx.state.exams.length + ' 次考试</span><span class="badge">' + ctx.state.awards.length + ' 项荣誉</span><span class="badge">' +
  ctx.state.experiences.length + ' 段经历</span></div><button data-section="schools">标记梦想院校</button></section></aside></div>';
}

function educationPage () {
  const stages = EDU_STAGES.slice (0, 3), card = (item) => '<section class="panel education-card"><div class="panel-title"><h2>' +
  tr (item.stage, ( {
    小学 : 'Primary school', 初中 : 'Junior secondary school', 高中 : 'Senior secondary school', 培训经历 : 'Training'
  }
  [item.stage] || item.stage)) + '</h2>' + (item.stage === '培训经历' ? '<button data-edu-delete="' + item.id + '">' + tr ('移除此培训经历',
  'Remove training') + '</button>' : '') + '</div><div class="grid2">' + EDU_FIELDS.map (([k, l]) => '<label class="field"><span>' +
  esc (translateLabel (l)) + '</span>' + (k === 'detail' ? '<textarea data-edu="' + item.id + ':' + k + '" rows="3" placeholder="' +
  tr ('课程、项目或学习收获', 'Courses, projects or learning outcomes') + '">' + esc (item [k]) + '</textarea>' : '<input data-edu="' +
  item.id + ':' + k + '" value="' + esc (item [k]) + '" placeholder="' + (k === 'school' ? tr ('填写学校或机构名称', 'School or institution name') : tr ('选填',
  'Optional')) + '">') + '</label>').join ('') + '</div></section>';
  return head ('INFORMATION / EDUCATION', tr ('把求学经历，整理成清晰的时间线。', 'Build a clear education timeline.'), tr ('按小学、初中、高中填写；培训经历可以添加多条。空白记录不会导出。',
  'Add primary, junior and senior secondary school, plus any training. Blank records are omitted from exports.')) +
  '<div class="education-list">' + stages.map (stage => card (ctx.state.education.find (x => x.stage === stage) || blankEducation (stage))).join ('') +
  '<h2>' + tr ('培训经历', 'Training experiences') + '</h2>' + ctx.state.education.filter (x => x.stage === '培训经历').map (card).join ('') +
  '<button class="primary" data-v2="addEducation">＋ ' + tr ('添加培训经历', 'Add training') + '</button></div>';
}

function statementPage () {
  return head ('INFORMATION / STATEMENT', '把经历串成你的故事。') + '<section class="panel statement-panel">' + introductionPicker52('zh') + area ('statement.zh',
  '个人陈述 · 中文', ctx.state.statement.zh, '成长经历、专业兴趣与申请动机。', 'class="statement-text" lang="zh-CN"') + introductionPicker52('en') + area ('statement.en',
  'Personal Statement · English', ctx.state.statement.en, 'Tell your story, academic interests and motivation.', 'class="statement-text" lang="en" spellcheck="true"') +
  '<h2>小语种个人陈述（选填）</h2>' + input('statement.otherLanguage','语种',ctx.state.statement.otherLanguage,'例如：德语、法语、日语') + introductionPicker52('other') + area('statement.other','个人陈述正文（选填）',ctx.state.statement.other,'使用所填写的语种撰写。','class="statement-text"') + '<div class="grid2">' + area ('statement.strengths', '个人特长', ctx.state.statement.strengths, '具体能力及相关实践。') + area ('statement.hobbies',
  '兴趣爱好', ctx.state.statement.hobbies, '例如：足球、音乐、摄影、旅行。') + '</div></section>';
}

function itemActions (kind, id) {
  return '<div class="record-actions"><button class="icon-btn" data-edit="' + kind + ':' + id + '">编辑</button><button class="icon-btn" data-delete="' +
  kind + ':' + id + '">移除</button></div>';
}

function recordList (kind) {
  const arr = records (kind);
  return '<section class="panel"><div class="panel-title"><h2>已收录' + ( {
    awards : '荣誉', experiences : '经历', exams : '考试', books : '书目'
  }) [kind] + '</h2><span class="badge">' + arr.length + ' 条</span></div><div class="records">' + (arr.length ? arr.map (x =>
  '<article class="record"><div class="record-head"><div><h3>' + esc (x.title || x.type) + '</h3><p>' + esc ([x.category ||
  x.type || x.author, x.scope || x.status, x.date].filter (Boolean).join (' · ')) + '</p></div>' + itemActions (kind,
  x.id) + '</div>' + (kind === 'exams' ? '<div class="hint">' + esc ([x.totalScore && '总分 ' + x.totalScore, x.rank &&
  '排名 ' + x.rank].filter (Boolean).join (' · ')) + '</div>' : '') + '</article>').join ('') : '<div class="empty">从一条完整的记录开始。</div>') +
  '</div></section>';
}

function formActions (kind, label) {
  return '<div class="actions"><button class="primary" type="submit">' + (ctx.editing [kind] ? '保存修改' : '收录' + label) +
  '</button>' + (ctx.editing [kind] ? '<button type="button" data-cancel="' + kind + '">结束编辑</button>' : '') + '</div>';
}

function academicsPage () {
  const e = ctx.state.examDraft;
  return head ('INFORMATION / LANGUAGES & SCORES', '让语言能力与成绩清晰可读。') + '<section class="panel language-panel"><h2>语言学习</h2><div class="grid2">' +
  area ('academics.languageLearning', '语言学习经历与水平', ctx.state.academics.languageLearning, '语种、学习年限、课程与实际使用经历。') + area ('academics.certificates',
  '语言证书与等级', ctx.state.academics.certificates, '证书名称、时间、等级或分数。') + '</div></section><div class="work-grid"><section class="panel"><h2>' +
  (ctx.editing.exams ? '编辑考试成绩' : '录入一次考试') + '</h2><form id="examForm"><div class="grid2">' + input ('examDraft.title',
  '考试名称', e.title, '例如：高三上学期期中考试') + select ('examDraft.type', '考试类型', e.type, EXAM_TYPES) + input ('examDraft.date',
  '考试时间', e.date, '', 'date') + input ('examDraft.rankScope', '排名范围', e.rankScope, '年级 / 班级 / 保送班') + '</div><h3>分科成绩</h3><div class="subject-list">' +
  e.subjects.map ((x, i) => '<div class="subject-row">' + [['name', '科目', 'text'], ['score', '成绩', 'decimal'], ['fullMark',
  '满分', 'decimal'], ['rank', '单科排名', 'numeric']].map (([k, l, im]) => '<label>' + l + '<input inputmode="' + im + '" aria-label="' +
  l + ' ' + (i + 1) + '" data-subject="' + x.id + '" data-key="' + k + '" value="' + esc (x [k]) + '" placeholder="' +
  (k === 'name' ? '科目' : '选填') + '"></label>').join ('') + '<button type="button" class="icon-btn" data-remove-subject="' +
  x.id + '" aria-label="移除科目 ' + (i + 1) + '">×</button></div>').join ('') + '</div><button type="button" data-action="addSubject">添加科目</button><div class="grid2 exam-totals">' +
  input ('examDraft.totalScore', '总分', e.totalScore, '选填', 'text', 'inputmode="decimal"') + input ('examDraft.totalFullMark',
  '总分满分', e.totalFullMark, '选填', 'text', 'inputmode="decimal"') + input ('examDraft.rank', '总排名', e.rank, '选填', 'text',
  'inputmode="numeric"') + input ('examDraft.rankTotal', '参考人数', e.rankTotal, '选填', 'text', 'inputmode="numeric"') +
  '</div>' + area ('examDraft.note', '成绩备注', e.note) + formActions ('exams', '这次考试') + '</form></section><aside>' +
  recordList ('exams') + '</aside></div>';
}

function draftHasContent (kind) {
  const d = ctx.state [draftKeys [kind]];
  if (ctx.editing [kind]) return true;
  if (kind === 'exams') return ! ! (d.title || d.date || d.totalScore || d.totalFullMark || d.rank || d.rankTotal ||
  d.note || d.subjects.some (s => s.score || s.fullMark || s.rank));
  return ! ! (d.title || d.scope || d.level || d.organizer || d.role || d.date || d.location || d.note || d.reflection ||
  d.action || d.photos?.length);
}

function avatarEditor22 () {
  return '<div class="avatar-editor"><div class="avatar-thumb ' + (currentVersion ().avatarShape === 'id' ? 'portrait-id' : '') +
  '">' + (ctx.state.avatar ? '<img src="' + esc (ctx.state.avatar.data) + '" alt="' + tr ('个人照片', 'Portrait') + '" style="object-position:' +
  ctx.state.avatarCrop.x + '% ' + ctx.state.avatarCrop.y + '%;transform:scale(' + ctx.state.avatarCrop.zoom + ');transform-origin:' +
  ctx.state.avatarCrop.x + '% ' + ctx.state.avatarCrop.y + '%">' : '<span>＋</span>') + '</div><div><h3>' + tr ('个人照片',
  'Portrait') + '</h3><label class="file-button">' + tr ('上传 / 更换照片', 'Upload / replace') + '<input type="file" data-upload="avatar" accept="image/*" hidden></label>' +
  (ctx.state.avatar ? '<button data-crop-photo="avatar:0">' + tr ('裁剪照片', 'Crop portrait') + '</button><button data-v2="removeAvatar">' +
  tr ('移除', 'Remove') + '</button>' : '') + '<p class="hint">' + tr ('保留原图；导出时按裁剪位置显示。', 'The source image is kept. Exports use your crop settings.') +
  '</p></div></div>' + (ctx.state.avatar ? '<div class="crop-controls">' + [['x', '水平位置', 'Horizontal position', 0,
  100, 1], ['y', '垂直位置', 'Vertical position', 0, 100, 1], ['zoom', '放大', 'Zoom', 1, 3, .05]].map (([k, z, e, min, max,
  step]) => '<label>' + tr (z, e) + ' <output>' + ctx.state.avatarCrop [k] + '</output><input type="range" data-crop="' +
  k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + ctx.state.avatarCrop [k] + '"></label>').join ('') +
  '</div>' : '');
}

function avatarEditor () {
  return avatarEditor22 ().replace ('<p class="hint">', '<button type="button" data-picker3="avatar">' + tr ('从资料中心选择',
  'Choose from Materials') + '</button><p class="hint">')
}

export { profilePage, educationPage, statementPage, itemActions, recordList, formActions, academicsPage, draftHasContent, avatarEditor22, avatarEditor };

// All controls for this feature, in their original override order.
function bindProfileControls () {
  bindIntroductionImports52();
  $$ ('[data-bind]').forEach (el => el.addEventListener ('input', () => {
    const [g, k] = el.dataset.bind.split ('.'); ctx.state [g] [k] = el.value; scheduleSave (); if (g === 'profile' &&
    ['name', 'school'].includes (k)) {
      const x = $ (k === 'name' ? '#miniName' : '#miniSchool'); if (x) x.textContent = el.value || '尚未填写';
    }
  }));
  if ($ ('#dreamChoice')) $ ('#dreamChoice').onchange = e => {
    if (! e.target.value) return;
    ctx.state.profile.targetSchool = e.target.value;
    scheduleSave ();
    render ();
  };
  for (const [kind, id] of [['awards', 'awardForm'], ['experiences', 'experienceForm'], ['exams', 'examForm'], ['books',
  'bookForm']]) if ($ ('#' + id)) $ ('#' + id).onsubmit = e => {
    e.preventDefault ();
    return collect (kind);
  };
  $$ ('[data-subject]').forEach (el => el.addEventListener ('input', () => {
    ctx.state.examDraft.subjects.find (s => s.id === el.dataset.subject) [el.dataset.key] = el.value; scheduleSave ();
  }));
  $$ ('[data-remove-subject]').forEach (b => b.onclick = async () => {
    ctx.state.examDraft.subjects = ctx.state.examDraft.subjects.filter (s => s.id !== b.dataset.removeSubject); await save (); render ();
  });
  $$ ('[data-edu]').forEach (e => e.oninput = () => {
    const [id, key] = e.dataset.edu.split (':'); const item = ctx.state.education.find (x => x.id === id); if (item) {
      item [key] = e.value; scheduleSave ()
    }
  });
  $$ ('[data-edu-delete]').forEach (e => e.onclick = async () => {
    if (await confirmAction (tr ('移除此培训经历？', 'Remove this training entry?'), tr ('删除后可通过进度备份恢复。', 'It can be restored from a backup.'))) {
      ctx.state.education = ctx.state.education.filter (x => x.id !== e.dataset.eduDelete); changed ()
    }
  });
}
export { bindProfileControls };
