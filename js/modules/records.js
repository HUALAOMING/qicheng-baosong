import {preserveResumeReferences53} from '../resume-model53.js';
import { $, $$, area, clone, esc, heading3, icon3, input, options, select, toast, tr, translateLabel, uid, moveIn } from '../utils/helpers.js';
import { ctx } from '../state.js';
import { ACHIEVEMENT_FIELDS, AWARD_CATS, AWARD_FIELDS, EXP_FIELDS, SCOPES, blankAward, blankExp, blanks, draftKeys } from '../constants.js';
import { draftHasContent, formActions } from './profile.js';
import { normalizeAssets3, records } from '../model.js';
import { save, scheduleSave } from '../autosave.js';
import { confirmAction, render, changed, go3 } from '../app.js';
import { draftFor3 } from './resume.js';
import { attachmentPanel3 } from './materials.js';
import { organizeMode3, scopeOrder3 } from './organization.js';
import {getReadingBooks,getReadingIntegration,journalDateKey} from './journal.js';
let readingEntryMode='manual', readingImportBook='';
// 启程 · js/modules/records.js


async function collect22 (kind) {
  if (ctx.busy) return;
  const d = ctx.state [draftKeys [kind]];
  if(kind==='books'&&!d.date)d.date=journalDateKey();
  if (kind === 'exams') {
    if (! draftHasContent (kind)) return toast ('请填写考试日期、名称或成绩。');
    if (! d.title.trim ()) d.title = [d.date, d.type].filter (Boolean).join (' ');
  }
  else if (! d.title.trim ()) return toast ('请填写名称');
  if (d.category) d.category = d.category.trim () || (kind === 'awards' ? '综合荣誉' : '其他经历');
  const arr = records (kind), i = arr.findIndex (x => x.id === ctx.editing [kind]);
  if (i >= 0) arr [i] = clone (d);
  else arr.push (clone (d));
  ctx.state [draftKeys [kind]] = blanks [kind] ();
  ctx.editing [kind] = null;
  await save ();
  render ();
  toast ('记录已收录');
}

async function editRecord (kind, id) {
  if (ctx.busy) return;
  if (draftHasContent (kind) && ! await confirmAction ('切换到这条记录？', '当前未收录的编辑草稿会被替换。可先取消并收录当前内容。', '切换编辑')) return;
  const found = records (kind).find (x => x.id === id);
  if (! found) return;
  ctx.state [draftKeys [kind]] = clone (found);
  ctx.editing [kind] = id;
  await save ();
  render ();
  window.scrollTo (0, 0);
}

async function deleteRecord (kind, id) {
  if (! await confirmAction ('移除这条记录？', '移除后可从之前下载的进度备份恢复。', '确认移除')) return;
  const arr = records (kind), i = arr.findIndex (x => x.id === id);
  if (i >= 0) {preserveResumeReferences53();arr.splice (i, 1);}
  if (ctx.editing [kind] === id) {
    ctx.state [draftKeys [kind]] = blanks [kind] ();
    ctx.editing [kind] = null;
  }
  await save ();
  render ();
}

function entryPage3 (kind) {
  const key = draftFor3 (kind), x = ctx.state [key], fields = kind === 'awards' ? AWARD_FIELDS : kind === 'achievements' ?
  ACHIEVEMENT_FIELDS : EXP_FIELDS, title = {
    awards : ['收录每一份努力。', 'Record every achievement.'], experiences : ['记录你的角色与行动。', 'Describe your roles and actions.'],
    practices : ['让社会实践单独被看见。', 'Give social practice its own place.'], achievements : ['把探索，变成可展示的成果。', 'Turn exploration into work you can show.']
  }
  [kind], choices = kind === 'awards' ? AWARD_CATS : kind === 'achievements' ? ['研究与实验', '课外写作', '艺术与创作', '技术与设计', '兴趣成果',
  '其他成果'] : kind === 'practices' ? ['社会实践', '志愿服务', '社区调研', '公益活动', '实习与参访', '其他实践'] : ['社团活动', '高中干部经历', '工作经历', '研究项目',
  '其他经历'];
  x.photos ||= [];
  x.attachments ||= [];
  return heading3 ('INFORMATION / ' + kind.toUpperCase (), tr (...title), tr ('文字、照片和附件一起收录；之后可在整理页调整顺序。', 'Save text, photos and attachments, then arrange them on the Organize pages.')) +
  '<div class="entry-grid3"><section class="panel"><div class="panel-title"><h2>' + tr (ctx.editing [kind] ? '编辑记录' : '添加一条记录',
  ctx.editing [kind] ? 'Edit record' : 'Add a record') + '</h2><span class="badge">' + tr ('本机保存', 'LOCAL') + '</span></div><form data-record-form3="' +
  kind + '"><div class="grid2">' + fields.map (([f, label]) => {
    const long = ['note', 'reflection', 'action', 'method', 'result'].includes (f); if (f === 'scope') return '<label class="field"><span>' +
    tr ('获奖级别', 'Award scope') + '</span><select data-record3="' + key + '" data-key="scope">' + options (['', ...SCOPES],
    x.scope) + '</select></label>'; return '<label class="field ' + (f === 'title' || long ? 'span2' : '') + '"><span>' +
    esc (translateLabel (label)) + (f === 'title' ? ' *' : '') + '</span>' + (f === 'category' ? '<input data-record3="' +
    key + '" data-key="' + f + '" value="' + esc (x [f]) + '" list="categories3">' : long ? '<textarea data-record3="' +
    key + '" data-key="' + f + '" rows="3">' + esc (x [f]) + '</textarea>' : '<input data-record3="' + key + '" data-key="' +
    f + '" value="' + esc (x [f]) + '" ' + (f === 'title' ? 'required' : '') + '>') + '</label>'
  }).join ('') + '</div>' + attachmentPanel3 (key) + '<div class="actions"><button class="primary" type="submit">' +
  tr (ctx.editing [kind] ? '保存修改' : '收录记录', ctx.editing [kind] ? 'Save changes' : 'Save record') + '</button>' + (ctx.editing [kind] ?
  '<button type="button" data-cancel3="' + kind + '">' + tr ('结束编辑', 'Finish editing') + '</button>' : '') + '</div></form><datalist id="categories3">' +
  options (choices, '') + '</datalist></section><section class="panel entry-list3"><div class="panel-title"><h2>' +
  tr ('已收录记录', 'Saved records') + '</h2><span class="badge">' + ctx.state [kind].length + '</span></div>' + recordsCards3 (kind) +
  '</section></div>'
}

function recordsCards3 (kind) {
  const arr = kind === 'books' ? ctx.state.learning.books : ctx.state [kind];
  return arr.length ? '<div class="records3">' + arr.map (x => '<article><div class="record-head"><div><h3>' + esc (x.title ||
  tr ('未命名', 'Untitled')) + '</h3><p>' + esc ([x.scope, x.category, x.role, x.date].filter (Boolean).join (' · ')) +
  '</p></div></div>' + (x.action || x.result || x.reflection ? '<p class="record-excerpt">' + esc ((x.action || x.result ||
  x.reflection).slice (0, 130)) + '</p>' : '') + '<div class="record-foot"><small>' + tr ('照片 ', 'Photos ') + (x.photos?.length ||
  0) + ' · ' + tr ('附件 ', 'Files ') + (x.attachments?.length || 0) + '</small><div><button data-edit3="' + kind + ':' +
  x.id + '">' + tr ('编辑', 'Edit') + '</button><button data-delete3="' + kind + ':' + x.id + '">' + tr ('移除', 'Remove') +
  '</button></div></div></article>').join ('') + '</div>' : '<div class="empty3">' + icon3 ('edit') + '<p>' + tr ('从第一条记录开始。',
  'Start with your first record.') + '</p></div>'
}

function learningPage3 () {
  const b=ctx.state.bookDraft,books=getReadingBooks();
  if(!books.some(book=>book.key===readingImportBook))readingImportBook=books[0]?.key||'';
  const selected=books.find(book=>book.key===readingImportBook),integration=selected?getReadingIntegration(selected.title):null;
  return heading3('PERSONAL / READING',tr('阅读经历','Reading experiences'),tr('从头写一段阅读经历，或将每日阅读进度整理成自己的阅读心得。','Write a reading experience, or bring your daily reading entries together.'))+
  '<div class="entry-grid3"><section class="panel reading-experience52"><div class="panel-title"><h2>'+tr(ctx.editing.books?'编辑阅读经历':'添加阅读经历',ctx.editing.books?'Edit reading experience':'Add a reading experience')+'</h2><button data-go3="reading-progress">'+tr('每日阅读进度','Daily reading')+' ↗</button></div><div class="reading-entry-modes52" role="group" aria-label="'+tr('阅读录入方式','Reading entry method')+'"><button type="button" data-reading-mode="manual" aria-pressed="'+(readingEntryMode==='manual')+'">'+tr('自己撰写','Write from scratch')+'</button><button type="button" data-reading-mode="progress" aria-pressed="'+(readingEntryMode==='progress')+'">'+tr('从每日进度整合','Combine daily progress')+'</button></div>'+
  (readingEntryMode==='progress'?'<aside class="reading-import52">'+(books.length?'<label class="field"><span>'+tr('选择已有阅读足迹的书目','Choose a book from your reading log')+'</span><select id="readingExperienceBook">'+books.map(book=>'<option value="'+esc(book.key)+'"'+(book.key===readingImportBook?' selected':'')+'>'+esc(book.title)+'</option>').join('')+'</select></label><p class="hint">'+(integration?integration.count:0)+tr(' 条阅读记录；',' reading entries; ')+(integration?integration.noteCount:0)+tr(' 条阅读小记。书名、作者和语言将自动填入，日期默认为今天，均可继续修改。',' reading notes. Title, author and language are filled automatically; the date defaults to today and remains editable.')+'</p><div class="actions"><button type="button" data-reading-import>'+tr('填入书目信息','Fill book details')+'</button><button type="button" data-reading-merge-notes'+(integration?.noteCount?'':' disabled')+'>'+tr('一键合并全部小记','Combine all reading notes')+'</button></div>':'<p>'+tr('先在每日阅读进度中添加一本书，再回到这里整合。','Add a daily reading entry first to combine it here.')+'</p>')+'</aside>':'')+
  '<form id="bookForm">'+input('bookDraft.title','书名 *',b.title,'','text','required')+'<div class="grid2">'+input('bookDraft.author','作者',b.author)+input('bookDraft.language','阅读语言',b.language)+select('bookDraft.status','阅读进度',b.status,['计划阅读','在读','已读完'])+input('bookDraft.date','阅读日期',b.date||journalDateKey(),'','date')+'</div>'+area('bookDraft.reflection','阅读心得',b.reflection,'可以自由撰写，也可以整合阅读小记后继续修改。','rows="9"')+attachmentPanel3('bookDraft')+formActions('books','这段阅读经历')+'</form></section><section class="panel entry-list3"><div class="panel-title"><h2>'+tr('已收录阅读经历','Saved reading experiences')+'</h2><span class="badge">'+ctx.state.learning.books.length+'</span></div>'+recordsCards3('books')+'</section></div><section class="panel learning-notes reading-other-learning52"><h2>'+tr('其他学习记录与计划','Other study notes & plans')+'</h2>'+area('learning.readingNotes','阅读随记与已有书单',ctx.state.learning.readingNotes)+area('learning.plan','学习计划',ctx.state.learning.plan)+area('learning.notes','其他学习记录',ctx.state.learning.notes)+'</section>';
}

async function collect (kind) {
  if (['awards', 'experiences', 'practices', 'achievements'].includes (kind)) {
    if (ctx.busy) return;
    const key = draftFor3 (kind), x = ctx.state [key];
    if (! x.title.trim ()) return toast (tr ('请填写名称', 'Enter a title'));
    normalizeAssets3 ();
    const i = ctx.state [kind].findIndex (x => x.id === ctx.editing [kind]);
    if (i >= 0) ctx.state [kind] [i] = clone (x);
    else ctx.state [kind].push (clone (x));
    if (kind === 'awards' && organizeMode3 ('awards') === 'scope') ctx.state.awards.sort ((a, b) => scopeOrder3 (a.scope) - scopeOrder3 (b.scope));
    ctx.state [key] = kind === 'awards' ? {
      ...blankAward (), attachments : []
    } : kind === 'achievements' ? {
      id : uid (), ...Object.fromEntries (ACHIEVEMENT_FIELDS.map (([k]) => [k, k === 'category' ? '研究与实验' : ''])), photos : [],
      attachments : []
    } : {
      ...blankExp (), category : kind === 'practices' ? '社会实践' : '社团活动', photos : [], attachments : []
    };
    ctx.editing [kind] = null;
    await save ();
    render ();
    toast (tr ('记录已收录', 'Record saved'));
    return
  }
  return collect22 (kind)
}

export { collect22, editRecord, deleteRecord, entryPage3, recordsCards3, learningPage3, collect };

// All controls for this feature, in their original override order.
function bindRecordsControls () {
  $$('[data-reading-mode]').forEach(button=>button.onclick=()=>{readingEntryMode=button.dataset.readingMode;render();});
  const bookChoice=$('#readingExperienceBook');if(bookChoice)bookChoice.onchange=()=>{readingImportBook=bookChoice.value;render();};
  const selectedIntegration=()=>{const book=getReadingBooks().find(row=>row.key===readingImportBook);return book?getReadingIntegration(book.title):null;};
  const fill=$('[data-reading-import]');if(fill)fill.onclick=()=>{
    const reading=selectedIntegration();if(!reading||ctx.busy)return;
    Object.assign(ctx.state.bookDraft,{title:reading.title,author:reading.author,language:reading.language,date:reading.date});
    changed();toast(tr('书目信息已填入，日期默认为今天，可继续修改','Book details filled with today’s date. You can edit every field.'));
  };
  const merge=$('[data-reading-merge-notes]');if(merge)merge.onclick=async()=>{
    const reading=selectedIntegration();if(!reading?.reflection||ctx.busy)return;
    const current=ctx.state.bookDraft.reflection?.trim();
    if(current&&current!==reading.reflection&&!await confirmAction(tr('用全部阅读小记替换当前心得？','Replace the reflection with all reading notes?'),tr('当前心得将替换为这本书全部已录入的小记，合并后仍可自行修改。','This combines all saved notes for the selected book. You can edit the result afterward.')))return;
    ctx.state.bookDraft.reflection=reading.reflection;changed();toast(tr('全部阅读小记已合并，可继续修改','All reading notes combined. You can keep editing.'));
  };
  $$ ('[data-edit]').forEach (b => b.onclick = () => editRecord (...b.dataset.edit.split (':')));
  $$ ('[data-delete]').forEach (b => b.onclick = () => deleteRecord (...b.dataset.delete.split (':')));
  $$ ('[data-cancel]').forEach (b => b.onclick = async () => {
    const k = b.dataset.cancel; ctx.state [draftKeys [k]] = blanks [k] (); ctx.editing [k] = null; await save (); render ();
  });
  $$ ('[data-block]').forEach (e => e.oninput = () => {
    ctx.state.customBlocks.find (b => b.id === e.dataset.block) [e.dataset.key] = e.value; changed (false)
  });
  $$ ('[data-block-move]').forEach (e => e.onclick = () => {
    const [id, d] = e.dataset.blockMove.split (':'); moveIn (ctx.state.customBlocks, ctx.state.customBlocks.findIndex (b =>
    b.id === id), Number (d)); changed ()
  });
  $$ ('[data-block-delete]').forEach (e => e.onclick = async () => {
    if (await confirmAction (tr ('删除这个图文模块？', 'Delete this content block?'), tr ('文字和图片会一起删除，请先备份。', 'Its text and photos will be removed. Back up first.'))) {
      preserveResumeReferences53();ctx.state.customBlocks = ctx.state.customBlocks.filter (b => b.id !== e.dataset.blockDelete); changed ()
    }
  });
  $$ ('[data-record3]').forEach (e => e.oninput = () => {
    ctx.state [e.dataset.record3] [e.dataset.key] = e.value; scheduleSave ()
  });
  $$ ('[data-record-form3]').forEach (f => f.onsubmit = e => {
    e.preventDefault (); collect (f.dataset.recordForm3)
  });
  $$ ('[data-edit3]').forEach (b => b.onclick = () => {
    const [k, id] = b.dataset.edit3.split (':'), arr = k === 'books' ? ctx.state.learning.books : ctx.state [k], x = arr.find (x =>
    x.id === id); if (! x) return; ctx.state [draftFor3 (k)] = clone (x); ctx.editing [k] = id; go3 (k === 'books' ? 'learning' : k)
  });
  $$ ('[data-cancel3]').forEach (b => b.onclick = () => {
    const k = b.dataset.cancel3; ctx.state [draftFor3 (k)] = k === 'achievements' ? {
      id : uid (), ...Object.fromEntries (ACHIEVEMENT_FIELDS.map (([f]) => [f, ''])), photos : [], attachments : []
    } : k === 'awards' ? {
      ...blankAward (), attachments : []
    } : {
      ...blankExp (), category : k === 'practices' ? '社会实践' : '社团活动', photos : [], attachments : []
    }; ctx.editing [k] = null; changed ()
  });
  $$ ('[data-delete3]').forEach (b => b.onclick = async () => {
    const [k, id] = b.dataset.delete3.split (':'); if (! await confirmAction (tr ('移除这条记录？', 'Remove this record?'), tr ('将移除文字与附件关联；原文件仍保留在资料中心。',
    'Text and attachment links are removed; source files remain in Materials.'), tr ('确认移除', 'Remove'))) return; const arr = k === 'books' ?
    ctx.state.learning.books : ctx.state [k], i = arr.findIndex (x => x.id === id); if (i >= 0) {preserveResumeReferences53();arr.splice (i, 1);} if (ctx.editing [k] === id) ctx.editing [k] = null; changed ()
  });
}
export { bindRecordsControls };
