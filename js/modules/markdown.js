import { storage } from '../storage.js';
import { compactSnapshot } from '../backup.js';
import { cancelPendingSave, initializeSaving301, save, scheduleSave } from '../autosave.js';
import { ACHIEVEMENT_FIELDS, AWARD_FIELDS, BOOK_FIELDS, EDU_FIELDS, EDU_STAGES, EXAM_FIELDS, EXP_FIELDS, MODULES, MODULE_NAMES, PROFILE, blankAward, blankBook, blankEducation, blankExam, blankExp, blankSubject } from '../constants.js';
import { EN } from '../data.js';
import { ctx } from '../state.js';
import { draftFor3, textRows } from './resume.js';
import { currentVersion, fieldVisible, moduleStyle, synchronizeEditing } from '../model.js';
import { $, $$, clone, download, icon3, toast, tr, uid } from '../utils/helpers.js';
import { validateDraft } from '../utils/validation.js';
import { render } from '../app.js';
// 启程 · js/modules/markdown.js


const MD_FIELDS31 = {
  profile : PROFILE, education : [['stage', '教育阶段'], ...EDU_FIELDS], statement : [['zh', '中文个人陈述'], ['en', '英文个人陈述'], ['otherLanguage','小语种语种'], ['other','小语种个人陈述']],
  academics : [['languageLearning', '语言学习'], ['certificates', '证书与等级']], exams : EXAM_FIELDS, awards : [...AWARD_FIELDS,
  ['priority', '整理优先级'], ['summary', '补充简历表述']], experiences : [...EXP_FIELDS, ['priority', '整理优先级'], ['summary', '补充简历表述']],
  practices : [...EXP_FIELDS, ['summary', '补充简历表述']], strengths : [['strengths', '个人特长'], ['hobbies', '兴趣爱好']], achievements : [...ACHIEVEMENT_FIELDS,
  ['summary', '补充简历表述']], custom : [['title', '模块标题'], ['text', '正文内容']], learning : [['readingNotes', '阅读随记与已有书单'],
  ['plan', '学习计划'], ['notes', '其他学习记录']], books : BOOK_FIELDS, subjects : [['name', '科目名称'], ['score', '分科成绩'], ['fullMark',
  '科目满分'], ['rank', '单科排名']]
};

const MD_RECORD31 = new Set (['education', 'exams', 'awards', 'experiences', 'practices', 'achievements', 'custom']);

const MD_KIND31 = {
  education : '教育经历', exams : '考试', awards : '荣誉', experiences : '个人经历', practices : '社会实践', achievements : '个人成果',
  custom : '自定义图文', books : '阅读书目'
};

const mdLabel31 = (key, field, lang = 'zh') => {
  const z = (MD_FIELDS31 [key] || []).find (x => x [0] === field)?.[1] || field;
  return lang === 'en' ? (EN [z] || z) : z
};

function mdValue31 (label, value, bold = false) {
  const text = String (value ?? '').replace (/\r\n?/g, '\n'), lines = text.split ('\n');
  return '- ' + (bold ? '**' + label + '**' : label) + '：' + (lines.length === 1 ? (lines [0] ? ' ' + lines [0] : '') : '\n' +
  lines.map (l => '  ' + l).join ('\n')) + '\n'
}

function mdHeader31 (kind, title, id = '') {
  return '### ' + title + '\n<!-- qicheng:record ' + kind + (id ? ' ' + id : '') + ' -->\n\n'
}

function markdownTemplate31 () {
  let out = '# 启程资料\n<!-- qicheng:md 3.1 -->\n\n> 在冒号后填写，空项可以留空。多行内容从下一行开始，每行前留两个空格。可复制整段记录增加条目，保留小标题和识别标记。\n\n';
  for (const k of MODULES) {
    out += '## ' + MODULE_NAMES [k] [0] + '\n<!-- qicheng:section ' + k + ' -->\n\n';
    if (k === 'education') for (const stage of EDU_STAGES) {
      out += mdHeader31 (k, stage);
      for (const [f, l] of MD_FIELDS31 [k]) out += mdValue31 (l, f === 'stage' ? stage : '');
      out += '\n'
    }
    else if (MD_RECORD31.has (k)) {
      out += mdHeader31 (k, MD_KIND31 [k] + ' 1');
      for (const [f, l] of MD_FIELDS31 [k]) if (f !== 'priority') out += mdValue31 (l, '');
      if (k === 'exams') {
        for (let i = 0; i < 3; i ++) {
          out += '\n#### 科目 ' + (i + 1) + '\n<!-- qicheng:subject -->\n';
          for (const [f, l] of MD_FIELDS31.subjects) out += mdValue31 (l, f === 'name' ? ['语文', '数学', '外语'] [i] : '')
        }
      }
      out += '\n'
    }
    else {
      for (const [f, l] of MD_FIELDS31 [k] || []) out += mdValue31 (l, '');
      if (k === 'learning') {
        out += '\n' + mdHeader31 ('books', '阅读书目 1');
        for (const [f, l] of BOOK_FIELDS) out += mdValue31 (l, '')
      }
      out += '\n'
    }
  }
  return out;
}

function markdown () {
  const rows = textRows (), v = currentVersion (), lang = v.exportLang === 'en' ? 'en' : 'zh';
  let out = '# ' + (v.name || '启程资料') + '\n<!-- qicheng:md 3.1 -->\n\n', recordKey = '', subjectKey = '';
  if (v.showToc) out += '## ' + (lang === 'en' ? 'Contents' : '目录') + '\n\n' + rows.filter (r => r.kind === 'section').map (r =>
  '- ' + r.text).join ('\n') + '\n\n';
  for (const r of rows) {
    if (r.kind === 'section') {
      out += '## ' + r.text + '\n<!-- qicheng:section ' + r.module + ' -->\n\n';
      recordKey = '';
      subjectKey = '';
      continue
    }
    if (! r.fieldKey) {
      if (r.text && r.kind !== 'entry') out += r.text + '\n\n';
      continue
    }
    const f = r.fieldKey, parts = f.split (':'), bold = moduleStyle (r.module, v).labelBold;
    let label = '', value = r.value ?? r.text ?? '';
    if (f.startsWith ('photo:')) {
      out += '<!-- qicheng:field ' + f + ' -->\n' + mdValue31 (lang === 'en' ? 'Photo caption' : '照片说明', value, bold) +
      '\n';
      continue
    }
    if (f.startsWith ('attachment:')) {
      out += mdValue31 (lang === 'en' ? 'File attachment' : '文件附件', value, bold) + '\n';
      continue
    }
    if (f.includes ('.')) {
      const [group, key] = f.split ('.');
      label = mdLabel31 (r.module, key, lang);
      out += mdValue31 (label, value, bold);
      continue
    }
    const [module, id, key] = parts, kind = module === 'learning' ? 'books' : module, recKey = kind + ':' + id;
    if (recordKey !== recKey) {
      recordKey = recKey;
      subjectKey = '';
      const all = kind === 'books' ? ctx.state.learning.books : kind === 'custom' ? ctx.state.customBlocks : ctx.state [kind] ||
      [], item = all.find (x => x.id === id), title = fieldVisible (module + ':' + id + ':title') ? item?.title : fieldVisible (module +
      ':' + id + ':stage') ? item?.stage : '';
      out += '\n' + mdHeader31 (kind, title || MD_KIND31 [kind] || 'Record', id)
    }
    if (key === 'subjects') {
      const sid = parts [3], sk = parts [4];
      if (subjectKey !== sid) {
        subjectKey = sid;
        out += '\n#### ' + (lang === 'en' ? 'Subject' : '科目') + '\n<!-- qicheng:subject ' + sid + ' -->\n'
      }
      label = mdLabel31 ('subjects', sk, lang);
    }
    else label = mdLabel31 (kind, key, lang);
    out += mdValue31 (label, value, bold);
  }
  return out + '\n';
}

function mdNormalize31 (s) {
  return String (s || '').replace (/\*\*|[_`]/g, '').replace (/[\s\u3000：:（）()／/·-]/g, '').toLowerCase ()
}

function mdModule31 (title) {
  const n = mdNormalize31 (title), alias = {
    基本信息 : 'profile', 个人基本信息 : 'profile', 教育经历 : 'education', 教育经历录入 : 'education', 个人陈述 : 'statement', 语言与成绩 : 'academics',
    语言与考试成绩 : 'academics', 考试成绩 : 'exams', 考试记录 : 'exams', 个人荣誉 : 'awards', 荣誉录入 : 'awards', 个人经历与社会实践 : 'experiences',
    个人经历 : 'experiences', 社会实践 : 'practices', 个人特长与兴趣 : 'strengths', 个人成果 : 'achievements', 自定义图文 : 'custom', 自定义内容 : 'custom',
    个人学习记录 : 'learning', 阅读与学习记录 : 'learning'
  };
  for (const [z, k] of Object.entries (alias)) if (mdNormalize31 (z) === n) return k;
  for (const k of MODULES) for (const t of [...MODULE_NAMES [k], currentVersion ().titles [k] || '']) if (t && mdNormalize31 (t) === n) return k;
  return ''
}

function mdField31 (kind, label) {
  const n = mdNormalize31 (label);
  for (const [f, z] of MD_FIELDS31 [kind] || []) if ([z, EN [z], f].filter (Boolean).some (l => mdNormalize31 (l) === n)) return f;
  const aliases = {
    姓名 : 'name', 担任职务 : 'role', 职务 : 'role', 担任时间 : 'date', 简历表述 : 'summary', 学校 : 'school', 机构 : 'school', 书名 : 'title',
    正文 : 'text', 中文陈述 : 'zh', 英文陈述 : 'en'
  };
  return aliases [label] && (MD_FIELDS31 [kind] || []).some (x => x [0] === aliases [label]) ? aliases [label] : ''
}

function parseMarkdown31 (input) {
  const text = String (input).replace (/^\uFEFF/, '').replace (/\r\n?/g, '\n'), ops = [], records = [], modules = new Set ();
  let module = '', record = null, subject = null, field = null, fieldOverride = '', pendingHeading = '', seenFormat = false;
  const finish = () => {
    if (field) {
      field.value = field.lines.join ('\n').replace (/\n+$/, '');
      delete field.lines;
      field = null
    }
  };
  const newRecord = (kind, title = '', id = '') => {
    finish ();
    record = {
      kind, id, title, fields : {
      }, subjects : []
    };
    records.push (record);
    subject = null;
    return record
  };
  const lines = text.split ('\n');
  for (let i = 0; i < lines.length; i ++) {
    const line = lines [i];
    let match;
    if (line.startsWith ('  ') && field) {
      field.lines.push (line.slice (2));
      continue
    }
    if ((match = line.match (/^\s*<!--\s*qicheng:md\s+([^>]+)-->\s*$/))) {
      seenFormat = true;
      continue
    }
    if ((match = line.match (/^\s*<!--\s*qicheng:section\s+([a-z]+)\s*-->\s*$/))) {
      finish ();
      module = MODULES.includes (match [1]) ? match [1] : '';
      record = null;
      subject = null;
      fieldOverride = '';
      if (module) modules.add (module);
      continue
    }
    if ((match = line.match (/^\s*<!--\s*qicheng:record\s+([a-z]+)(?:\s+([a-zA-Z0-9_-]+))?\s*-->\s*$/))) {
      const kind = match [1];
      if (MD_RECORD31.has (kind) || kind === 'books') {
        if (record && record._heading && ! Object.keys (record.fields).length) {
          record.kind = kind;
          record.id = match [2] || '';
          delete record._heading
        }
        else newRecord (kind, pendingHeading, match [2] || '')
      }
      continue
    }
    if ((match = line.match (/^\s*<!--\s*qicheng:subject(?:\s+([a-zA-Z0-9_-]+))?\s*-->\s*$/))) {
      if (record?.kind === 'exams') {
        if (! subject) {
          subject = {
            id : match [1] || '', fields : {
            }
          };
          record.subjects.push (subject)
        }
        else subject.id = match [1] || ''
      }
      continue
    }
    if ((match = line.match (/^\s*<!--\s*qicheng:field\s+(photo:[a-zA-Z0-9_-]+:caption)\s*-->\s*$/))) {
      finish ();
      fieldOverride = match [1];
      continue
    }
    if (/^<!--.*-->\s*$/.test (line)) continue;
    if ((match = line.match (/^##\s+(.+?)\s*#*$/))) {
      finish ();
      module = mdModule31 (match [1]);
      record = null;
      subject = null;
      fieldOverride = '';
      if (module) modules.add (module);
      continue
    }
    if ((match = line.match (/^###\s+(.+?)\s*#*$/))) {
      finish ();
      pendingHeading = match [1];
      const kind = module === 'learning' ? 'books' : module;
      if (MD_RECORD31.has (kind) || kind === 'books') {
        newRecord (kind, match [1]);
        record._heading = true
      }
      continue
    }
    if ((match = line.match (/^####\s+(?:科目|Subject)\s*\d*\s*$/i)) && module === 'exams') {
      finish ();
      if (! record) newRecord ('exams');
      subject = {
        id : '', fields : {
        }
      };
      record.subjects.push (subject);
      continue
    }
    if (! module) {
      continue
    }
    const kind = subject ? 'subjects' : record?.kind || module;
    match = line.match (/^(?:-\s+)?\s*(?:\*\*)?([^：:\n]+?)(?:\*\*)?\s*[：:]\s*(.*)$/);
    const label = match?.[1]?.replace (/\*\*/g, '').trim (), key = label && mdField31 (kind, label);
    if (match && (key || fieldOverride)) {
      finish ();
      const val = /^\*\*[^：:]+[：:]\*\*/.test (line) ? match [2].replace (/^\*\*\s*/, '') : match [2], target = fieldOverride ?
      'photo' : subject ? 'subject' : record ? 'record' : 'scalar';
      field = {
        target, kind : subject ? 'exams' : record?.kind || module, key : key || 'caption', record, subject, photoId : fieldOverride ?
        fieldOverride.split (':') [1] : '', lines : val ? [val] : [], value : ''
      };
      ops.push (field);
      fieldOverride = '';
      continue
    }
    if (field) {
      if (/^\s*>\s/.test (line) && ! field.lines.length) continue;
      field.lines.push (line.startsWith ('  ') ? line.slice (2) : line)
    }
  }
  finish ();
  if (! ops.length) throw Error (tr ('未识别到可导入的字段，请使用样板或启程导出的 Markdown。', 'No importable fields found. Use the template or a Qicheng Markdown export.'));
  for (const op of ops) if (op.value.length > 100000) throw Error (tr ('单个字段内容过长，请精简后重试。', 'A field is too long. Shorten it and try again.'));
  return {
    ops, records, modules : [...modules], seenFormat
  };
}

function applyMarkdown31 (parsed) {
  const draft = clone (ctx.state), v = draft.versions.find (x => x.id === draft.activeVersion) || draft.versions [0],
  matched = new Map (), subjects = new Map ();
  let imported = 0;
  for (const op of parsed.ops) if (op.target === 'record') op.record.fields [op.key] = op.value;
  else if (op.target === 'subject') op.subject.fields [op.key] = op.value;
  const arrayFor = k => k === 'books' ? draft.learning.books : k === 'custom' ? draft.customBlocks : draft [k];
  for (const rec of parsed.records) {
    const arr = arrayFor (rec.kind);
    if (! arr) continue;
    const values = Object.values (rec.fields), hasContent = values.some ((v, i) => v.trim () && Object.keys (rec.fields) [i] !== 'stage') ||
    rec.subjects.some (s => Object.entries (s.fields).some (([k, v]) => k !== 'name' && v.trim ()));
    let item = rec.id ? arr.find (x => x.id === rec.id) : null;
    if (! item && rec.kind === 'education') {
      const stage = rec.fields.stage || EDU_STAGES.find (s => rec.title === s);
      if (stage && stage !== '培训经历') item = arr.find (x => x.stage === stage)
    }
    if (! item && ! rec.id) {
      const t = rec.fields.title || '', same = arr.filter (x => t && x.title === t);
      if (same.length === 1) item = same [0]
    }
    if (! item && ! hasContent) continue;
    if (! item) {
      item = rec.kind === 'education' ? blankEducation (rec.fields.stage || '培训经历') : rec.kind === 'exams' ? blankExam () : rec.kind === 'awards' ?
      blankAward () : rec.kind === 'books' ? blankBook () : rec.kind === 'custom' ? {
        id : uid (), title : '', text : '', layout : 'text', photos : [], attachments : []
      } : rec.kind === 'achievements' ? {
        id : uid (), ...Object.fromEntries (ACHIEVEMENT_FIELDS.map (([k]) => [k, ''])), photos : [], attachments : []
      } : {
        ...blankExp (), category : rec.kind === 'practices' ? '社会实践' : '', photos : [], attachments : []
      };
      if (rec.id) item.id = rec.id;
      if (rec.kind === 'exams') item.subjects = [];
      arr.push (item)
    }
    matched.set (rec, item);
    if (rec.kind === 'exams') for (const s of rec.subjects) {
      const meaningful = Object.values (s.fields).some (x => x.trim ());
      let sub = s.id ? item.subjects.find (x => x.id === s.id) : null;
      if (! sub && ! meaningful) continue;
      if (! sub && s.fields.name) {
        const same = item.subjects.filter (x => x.name === s.fields.name);
        if (same.length === 1) sub = same [0]
      }
      if (! sub) {
        sub = blankSubject ('');
        if (s.id) sub.id = s.id;
        item.subjects.push (sub)
      }
      subjects.set (s, sub)
    }
  }
  for (const op of parsed.ops) {
    if (op.target === 'scalar') {
      const group = op.kind === 'strengths' ? 'statement' : op.kind;
      if (draft [group] && Object.hasOwn (draft [group], op.key)) {
        draft [group] [op.key] = op.value;
        imported ++
      }
    }
    else if (op.target === 'record') {
      const item = matched.get (op.record);
      if (! item) continue;
      if (op.key === 'summary') {
        v.summaries [(op.kind === 'books' ? 'learning' : op.kind) + ':' + item.id] = op.value
      }
      else item [op.key] = op.value;
      imported ++
    }
    else if (op.target === 'subject') {
      const s = subjects.get (op.subject);
      if (s) {
        s [op.key] = op.value;
        imported ++
      }
    }
    else if (op.target === 'photo') {
      const groups = [draft.media, ...['awards', 'experiences', 'practices', 'achievements'].map (k => draft [k].flatMap (x =>
      x.photos || [])), draft.customBlocks.flatMap (x => x.photos || []), draft.learning.books.flatMap (x => x.photos ||
      [])];
      for (const arr of groups) for (const p of arr) if (p.id === op.photoId) {
        p.caption = op.value;
        imported ++
      }
    }
  }
  if (! imported) throw Error (tr ('没有可写入的内容。请填写样板后再导入。', 'Nothing to import. Fill in the template first.'));
  for (const [rec, item] of matched) {
    if (['awards', 'experiences', 'practices', 'achievements', 'books'].includes (rec.kind)) {
      const key = draftFor3 (rec.kind);
      if (draft [key]?.id === item.id) draft [key] = clone (item)
    }
  }
  const cleaned = validateDraft (draft);
  return {
    draft : cleaned, imported
  };
}

function openMarkdownImport31 () {
  if (ctx.busy || ctx.uploadBusy) return;
  let d = $ ('#mdImport31');
  if (! d) {
    d = document.createElement ('dialog');
    d.id = 'mdImport31';
    d.className = 'md-import31';
    document.body.append (d)
  }
  d.innerHTML = '<div class="eyebrow">QICHENG / MARKDOWN</div><h2>' + tr ('导入 Markdown 资料', 'Import Markdown materials') +
  '</h2><p>' + tr ('使用样板或启程导出的 .md 文档。同名字段会覆盖；文档未包含的内容保留。', 'Use a template or exported .md file. Included fields replace their values; omitted content stays unchanged.') +
  '</p><label class="md-upload31">' + icon3 ('folder') + '<span>' + tr ('选择 .md 文档', 'Choose a .md file') + '</span><input type="file" id="mdFile31" accept=".md,text/markdown" hidden></label><p id="mdError31" class="md-error31" hidden></p><div class="md-progress31" id="mdProgress31" hidden><div class="progress-label31"><span id="mdStatus31"></span><span id="mdPercent31">0%</span></div><progress id="mdBar31" max="100" value="0"></progress></div><div class="actions"><button id="mdClose31">' +
  tr ('关闭', 'Close') + '</button></div>';
  d.showModal ();
  $ ('#mdClose31').onclick = () => d.close ();
  d.oncancel = e => {
    if (ctx.busy) e.preventDefault ()
  };
  $ ('#mdFile31').onchange = e => {
    const f = e.target.files [0];
    if (f) importMarkdownFile31 (f, d)
  };
}

async function importMarkdownFile31 (file, d = $ ('#mdImport31')) {
  if (ctx.busy || ctx.uploadBusy) return;
  ctx.busy = true;
  const setProgress = (n, z, en) => {
    const box = $ ('#mdProgress31');
    if (box) box.hidden = false;
    const bar = $ ('#mdBar31');
    if (bar) bar.value = n;
    if ($ ('#mdStatus31')) $ ('#mdStatus31').textContent = tr (z, en);
    if ($ ('#mdPercent31')) $ ('#mdPercent31').textContent = n + '%'
  };
  try {
    if (! /\.md$/i.test (file.name)) throw Error (tr ('仅支持 .md 文档。', 'Only .md files are supported.'));
    if (file.size > 10 * 1024 * 1024) throw Error (tr ('文档超过 10 MB，请精简后重试。', 'The file exceeds 10 MB. Shorten it and try again.'));
    if ($ ('#mdError31')) $ ('#mdError31').hidden = true;
    $ ('#mdClose31')?.setAttribute ('disabled', '');
    if ($ ('.md-upload31')) $ ('.md-upload31').hidden = true;
    setProgress (15, '读取文档', 'Reading document');
    await new Promise (r => requestAnimationFrame (() => requestAnimationFrame (r)));
    const bytes = await file.arrayBuffer (), text = new TextDecoder ('utf-8', {
      fatal : true
    }).decode (bytes);
    setProgress (45, '识别字段', 'Matching fields');
    await new Promise (r => setTimeout (r, 90));
    const parsed = parseMarkdown31 (text);
    setProgress (75, '写入资料', 'Updating materials');
    await new Promise (r => setTimeout (r, 90));
    const result = applyMarkdown31 (parsed);
    ctx.persistencePaused = true;
    cancelPendingSave();
    await ctx.saveChain;
    result.draft.savedAt = new Date().toISOString();
    const snapshot = compactSnapshot(result.draft);
    try { await storage.set('current',snapshot); }
    catch (error) { throw new Error(tr('导入未完成，原资料已保留：','Import failed; original materials kept: ') + error.message); }
    ctx.state = result.draft;
    synchronizeEditing(); ctx.layoutCache = null;
    initializeSaving301(snapshot);
    setProgress (100, '导入完成', 'Import complete');
    if (d) {
      d.querySelector ('.md-progress31').insertAdjacentHTML ('afterend', '<div class="md-success31">' + icon3 ('check') +
      '<span>' + tr ('导入完成', 'Import complete') + '</span></div>');
      await new Promise (r => setTimeout (r, 700));
      d.close ()
    }
    render ();
    toast (tr ('导入完成', 'Import complete'));
    return result.imported;
  }
  catch (e) {
    if ($ ('#mdError31')) {
      $ ('#mdError31').textContent = e.message;
      $ ('#mdError31').hidden = false
    }
    if ($ ('#mdProgress31')) $ ('#mdProgress31').hidden = true;
    if ($ ('.md-upload31')) $ ('.md-upload31').hidden = false;
    if ($ ('#mdClose31')) $ ('#mdClose31').disabled = false;
    if ($ ('#mdFile31')) $ ('#mdFile31').value = '';
    if (! d) throw e;
  }
  finally {
    ctx.busy = false; ctx.persistencePaused = false;
    if (ctx.dirty301) scheduleSave();
  }
}

function bindMarkdown31 () {
  $$ ('[data-md-template31]').forEach (b => b.onclick = () => download (markdownTemplate31 (), 'text/markdown;charset=utf-8',
  '启程-资料填写样板.md'));
  $$ ('[data-md-import31]').forEach (b => b.onclick = openMarkdownImport31)
}

export { MD_FIELDS31, MD_RECORD31, MD_KIND31, mdLabel31, mdValue31, mdHeader31, markdownTemplate31, markdown, mdNormalize31, mdModule31, mdField31, parseMarkdown31, applyMarkdown31, openMarkdownImport31, importMarkdownFile31, bindMarkdown31 };

// All controls for this feature, in their original override order.
function bindMarkdownControls () {
  bindMarkdown31 ();
}
export { bindMarkdownControls };
