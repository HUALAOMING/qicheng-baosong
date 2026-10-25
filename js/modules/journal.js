import { $, $$, esc, tr, toast, uid } from '../utils/helpers.js';
import { storage } from '../storage.js';
import { ctx } from '../state.js';
import { confirmAction, go3 } from '../app.js';
import { getHomeCountdown, saveHomeCountdown } from './home.js';

// Learning records have their own small keys. Calendar navigation is deliberately temporary.
const JOURNAL_LIMIT = 10000;
const JOURNAL_STATUSES = [
  ['perfect', '完美', 'Excellent', '完成全部任务', 'Completed everything'],
  ['good', '良好', 'Good', '完成大部分任务', 'Completed most things'],
  ['steady', '继续努力', 'Keep going', '平稳前行，继续积累', 'A steady day of progress'],
  ['low', '状态欠佳', 'A difficult day', '照顾自己，明天再来', 'Take care and begin again tomorrow']
];
let readingRecords = new Map(), dayRecords = new Map(), journalPreferences = {motto:''}, sortedReadingCache = null;
let journalWriteChain = Promise.resolve(), pendingWrites = new Set();
let calendarView = 'month', calendarAnchor = journalDateKey(), selectedDate = journalDateKey();
let readingDraft = null, readingVisible = 30, bindingAbort = null;
let readingView = 'time', readingBookFilter = '';
const READING_FIELDS = ['id','date','book','author','language','chapter','edition','pages','note'];

function journalDateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function journalValidDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value+'T12:00:00');
  return Number.isFinite(date.getTime()) && journalDateKey(date) === value;
}
function journalShiftDate(key, days) {
  const date = new Date(key+'T12:00:00');
  date.setDate(date.getDate()+days);
  return journalDateKey(date);
}
function journalObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function journalTimestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function journalClone(value) { return value === null ? null : JSON.parse(JSON.stringify(value)); }
function journalStatus(status) { return JOURNAL_STATUSES.find(value => value[0] === status); }
function journalStatusLabel(status) { const item=journalStatus(status); return item?tr(item[1],item[2]):tr('尚未记录','Not recorded'); }
function validateJournalRecords(records) {
  if (!journalObject(records)) throw new Error('学习记录备份格式无效。');
  let readingCount=0, dayCount=0;
  for (const [key,value] of Object.entries(records)) {
    if (key === 'settings:journal') {
      if (!journalObject(value) || typeof value.motto !== 'string' || value.motto.length>120) throw new Error('日历标语格式无效。');
      continue;
    }
    if (!key.startsWith('journal:')) continue;
    let valid=false;
    if (key.startsWith('journal:reading:') && journalObject(value)) {
      readingCount++;
      const text=(field,max,required=false)=>typeof value[field]==='string' && value[field].length<=max && (!required||!!value[field].trim());
      const legacy=value.schemaVersion===undefined && Number.isInteger(value.startPage) && Number.isInteger(value.endPage) && value.startPage>=1 && value.endPage>=value.startPage && value.endPage<=1000000;
      const current=value.schemaVersion===2 && text('author',200,true) && text('language',80,true) && text('chapter',1000,true) && text('edition',200) && text('pages',200) && text('note',20000) && journalTimestamp(value.createdAt);
      valid=typeof value.id==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value.id) && key==='journal:reading:'+value.id && journalValidDate(value.date) && text('book',200,true) && (legacy||current) && journalTimestamp(value.updatedAt);
    } else if (key.startsWith('journal:day:') && journalObject(value)) {
      dayCount++;
      valid=journalValidDate(value.date) && key==='journal:day:'+value.date && !!journalStatus(value.status) && journalTimestamp(value.updatedAt);
    }
    if (!valid) throw new Error('学习记录无效：'+key);
  }
  if (readingCount>JOURNAL_LIMIT || dayCount>JOURNAL_LIMIT) throw new Error('学习记录数量超出上限（每类 10,000 条）。');
  return records;
}
async function initializeJournal(records) {
  let loaded=records;
  if (loaded===undefined) {
    const [entries,preferences]=await Promise.all([storage.getPrefix('journal:'),storage.get('settings:journal')]);
    loaded={...entries,...(preferences===undefined?{}:{'settings:journal':preferences})};
  }
  validateJournalRecords(loaded);
  const readings=new Map(), days=new Map();
  for (const [key,value] of Object.entries(loaded)) {
    if (key.startsWith('journal:reading:')) readings.set(value.id,journalClone(value));
    if (key.startsWith('journal:day:')) days.set(value.date,journalClone(value));
  }
  readingRecords=readings; dayRecords=days; sortedReadingCache=null;
  journalPreferences={motto:loaded['settings:journal']?.motto||''};
  readingDraft=null; readingVisible=30; readingView='time'; readingBookFilter='';
}
function journalWrite(operation) {
  const write=journalWriteChain.then(()=>{
    if (ctx.persistencePaused) throw new Error('请等待当前数据操作完成。');
    return operation();
  });
  journalWriteChain=write.catch(()=>{});
  pendingWrites.add(write);
  write.then(()=>pendingWrites.delete(write),()=>pendingWrites.delete(write));
  return write;
}
async function waitForJournalWrites() {
  // Include writes enqueued by the same interaction while a previous transaction completes.
  while (pendingWrites.size) await Promise.all([...pendingWrites]);
}
function saveReadingProgress(input) {
  const now=new Date().toISOString();
  const value={id:input.id||uid(),schemaVersion:2,date:input.date,...Object.fromEntries(READING_FIELDS.filter(key=>!['id','date'].includes(key)).map(key=>[key,String(input[key]??'').trim()])),createdAt:readingRecords.get(input.id)?.createdAt||readingRecords.get(input.id)?.updatedAt||now,updatedAt:now};
  validateJournalRecords({['journal:reading:'+value.id]:value});
  return journalWrite(async()=>{
    const prior=readingRecords.get(value.id);
    if (prior && READING_FIELDS.every(key=>prior[key]===value[key])) return journalClone(prior);
    if(prior)value.createdAt=prior.createdAt||prior.updatedAt;
    if (!readingRecords.has(value.id) && readingRecords.size>=JOURNAL_LIMIT) throw new Error('阅读记录已达到 10,000 条。');
    await storage.set('journal:reading:'+value.id,value);
    readingRecords.set(value.id,journalClone(value)); sortedReadingCache=null;
    return journalClone(value);
  });
}
function deleteReadingProgress(id) {
  return journalWrite(async()=>{
    if (!readingRecords.has(id)) return false;
    await storage.remove('journal:reading:'+id);
    readingRecords.delete(id); sortedReadingCache=null; return true;
  });
}
function journalSortedReadings() { return sortedReadingCache??=( [...readingRecords.values()].sort((a,b)=>(b.createdAt||b.updatedAt).localeCompare(a.createdAt||a.updatedAt)||b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)) ); }
function getReadingProgress() { return journalSortedReadings().map(journalClone); }
function getLatestReading() { return journalClone(journalSortedReadings()[0]||null); }
function readingBookKey(book) { return String(book||'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase(); }
function getReadingBooks() {
  const books=new Map();
  for(const reading of journalSortedReadings()) {
    const key=readingBookKey(reading.book);
    if(!books.has(key))books.set(key,{key,title:reading.book,author:reading.author||'',language:reading.language||'',records:[]});
    books.get(key).records.push(journalClone(reading));
  }
  return [...books.values()];
}
function getReadingIntegration(book,date=journalDateKey()) {
  const group=getReadingBooks().find(row=>row.key===readingBookKey(book));
  if(!group)return null;
  const rows=group.records.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||a.updatedAt).localeCompare(b.createdAt||b.updatedAt));
  return {title:group.title,author:group.records.find(row=>row.author)?.author||'',language:group.records.find(row=>row.language)?.language||'',date:journalValidDate(date)?date:journalDateKey(),reflection:rows.filter(row=>row.note?.trim()).map(row=>row.date+(row.chapter?' · '+row.chapter:'')+'\n'+row.note.trim()).join('\n\n'),count:rows.length,noteCount:rows.filter(row=>row.note?.trim()).length};
}
function saveDailyStatus(date,status) {
  const value={date,status,updatedAt:new Date().toISOString()};
  validateJournalRecords({['journal:day:'+date]:value});
  return journalWrite(async()=>{
    if (!dayRecords.has(date) && dayRecords.size>=JOURNAL_LIMIT) throw new Error('状态记录已达到 10,000 条。');
    if (dayRecords.get(date)?.status===status) return journalClone(dayRecords.get(date));
    await storage.set('journal:day:'+date,value);
    dayRecords.set(date,journalClone(value)); return journalClone(value);
  });
}
function deleteDailyStatus(date) {
  if (!journalValidDate(date)) throw new Error('日期无效。');
  return journalWrite(async()=>{
    if (!dayRecords.has(date)) return false;
    await storage.remove('journal:day:'+date); dayRecords.delete(date); return true;
  });
}
function saveJournalPreferences(patch) {
  return journalWrite(async()=>{
    const value={...journalPreferences,...patch};
    validateJournalRecords({'settings:journal':value});
    if (value.motto===journalPreferences.motto) return {...journalPreferences};
    await storage.set('settings:journal',value); journalPreferences=value; return {...value};
  });
}
function getRecentStatus(count=5,date=new Date()) {
  const end=journalDateKey(date), length=Math.max(1,Math.min(31,Math.floor(count)||5));
  return Array.from({length},(_,index)=>{
    const key=journalShiftDate(end,index-length+1), record=dayRecords.get(key);
    return {date:key,status:record?.status||null,updatedAt:record?.updatedAt||null};
  });
}
function homeRecentStatusMarkup(date=new Date()) {
  const today=journalDateKey(date);
  return '<section class="home-status-board"><div class="home-section-title"><div><p class="eyebrow">'+tr('留意自己的节奏','YOUR OWN PACE')+'</p><h2>'+tr('近五天状态','The last five days')+'</h2></div><button class="home-text-button" data-go3="calendar">'+tr('学习日历','Learning calendar')+' ↗</button></div><div class="home-status-days">'+getRecentStatus(5,date).map(day=>'<article class="home-status-day'+(day.date===today?' is-today':'')+'"><span>'+esc(day.date.slice(5).replace('-',' / '))+'</span><i class="journal-status-mark'+(day.status?' status-'+day.status:'')+'" aria-hidden="true"></i><strong>'+esc(journalStatusLabel(day.status))+'</strong><small>'+esc(day.date===today?tr('今天','Today'):new Date(day.date+'T12:00:00').toLocaleDateString(ctx.state.uiLang==='en'?'en':'zh-CN',{weekday:'short'}))+'</small></article>').join('')+'</div></section>';
}
function journalDateLabel(date,options={month:'long',day:'numeric',weekday:'long'}) {
  return new Date(date+'T12:00:00').toLocaleDateString(ctx.state.uiLang==='en'?'en':'zh-CN',options);
}
function getCalendarDays(view=calendarView,anchor=calendarAnchor) {
  if (!['month','week'].includes(view) || !journalValidDate(anchor)) throw new Error('日历日期无效。');
  const start=new Date(anchor+'T12:00:00');
  if (view==='month') start.setDate(1);
  start.setDate(start.getDate()-(start.getDay()+6)%7);
  return Array.from({length:view==='week'?7:42},(_,index)=>journalShiftDate(journalDateKey(start),index));
}
function journalCalendarGrid() {
  const days=getCalendarDays(), countdown=getHomeCountdown(), today=journalDateKey();
  const weekdays=ctx.state.uiLang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['一','二','三','四','五','六','日'];
  const cells=days.map(date=>{
    const record=dayRecords.get(date), isTarget=countdown.date===date, outside=calendarView==='month'&&date.slice(0,7)!==calendarAnchor.slice(0,7);
    const label=journalDateLabel(date)+(isTarget?'，'+tr('倒计时目标日','countdown target')+' '+countdown.name:'')+'，'+journalStatusLabel(record?.status);
    return '<button class="journal-calendar-day'+(outside?' outside-month':'')+(date===today?' is-today':'')+(isTarget?' is-target':'')+(record?' has-status status-'+record.status:'')+'" type="button" role="gridcell" aria-label="'+esc(label)+'" aria-haspopup="dialog" aria-expanded="false" data-journal-date="'+date+'" tabindex="'+(date===(days.includes(selectedDate)?selectedDate:days.includes(today)?today:days[0])?'0':'-1')+'"><span class="journal-date-number">'+Number(date.slice(8))+'</span>'+(isTarget?'<span class="journal-target-label" title="'+esc(countdown.name)+'">'+tr('目标','Goal')+'</span>':'')+(record?'<span class="journal-day-state"><i class="journal-status-mark status-'+record.status+'" aria-hidden="true"></i><span>'+esc(journalStatusLabel(record.status))+'</span></span>':'')+'</button>';
  });
  const rows=Array.from({length:days.length/7},(_,index)=>'<div class="journal-calendar-week" role="row">'+cells.slice(index*7,index*7+7).join('')+'</div>').join('');
  return '<div class="journal-weekdays" aria-hidden="true">'+weekdays.map(day=>'<span>'+day+'</span>').join('')+'</div><div class="journal-calendar-grid" role="grid" aria-label="'+tr('学习日历，方向键选择日期','Learning calendar. Use arrow keys to choose a date.')+'">'+rows+'</div>';
}
function calendarPage() {
  const days=getCalendarDays(), month=journalDateLabel(calendarAnchor,{year:'numeric',month:'long'});
  const title=calendarView==='month'?month:journalDateLabel(days[0],{month:'short',day:'numeric'})+' — '+journalDateLabel(days[6],{month:'short',day:'numeric'});
  return '<div class="journal-page journal-calendar-page" id="journalCalendarPage"><header class="journal-heading"><div><p class="eyebrow">QICHENG / YOUR RHYTHM</p><h1>'+tr('学习日历','Learning calendar')+'</h1><p>'+tr('不必记录每一件事，留意每天的自己。','A small moment to reflect on your day.')+'</p></div><button data-go3="reading-progress">'+tr('阅读进度','Reading progress')+' ↗</button></header><section class="journal-calendar-panel"><div class="journal-calendar-motto"><h2>'+esc(journalPreferences.motto||tr('今日事，今日毕。','Make today count.'))+'</h2><details><summary>'+tr('自定义鼓励','Your encouragement')+'</summary><form id="journalMottoForm"><label class="field"><span>'+tr('日历标语','Calendar message')+'</span><input name="motto" maxlength="120" value="'+esc(journalPreferences.motto)+'" placeholder="'+tr('今日事，今日毕。','Make today count.')+'"></label><button type="submit">'+tr('保存标语','Save message')+'</button></form></details></div><div class="journal-calendar-toolbar"><div class="journal-calendar-navigation"><button type="button" data-journal-period="-1" aria-label="'+tr('上一段日期','Previous period')+'">‹</button><h2 aria-live="polite">'+esc(title)+'</h2><button type="button" data-journal-period="1" aria-label="'+tr('下一段日期','Next period')+'">›</button><button type="button" class="journal-today-button" data-journal-today>'+tr('今天','Today')+'</button></div><div class="journal-view-switch" role="group" aria-label="'+tr('日历视图','Calendar view')+'"><button type="button" data-journal-view="week" aria-pressed="'+(calendarView==='week')+'">'+tr('周','Week')+'</button><button type="button" data-journal-view="month" aria-pressed="'+(calendarView==='month')+'">'+tr('月','Month')+'</button></div></div>'+journalCalendarGrid()+'<p class="journal-calendar-hint">'+tr('轻点日期，记录当日状态，或设为首页倒计时目标日。','Choose a date to reflect on the day or set your Home countdown.')+'</p></section><div id="journalDayPopover" class="journal-popover" popover="auto" role="dialog" aria-modal="false" aria-labelledby="journalPopoverTitle" hidden></div></div>';
}
function journalBlankReading() { return {id:'',date:journalDateKey(),book:'',author:'',language:'',chapter:'',edition:'',pages:'',note:''}; }
function readingEntryMarkup(row) {
  const pages=row.pages||(row.startPage?row.startPage+' — '+row.endPage+' 页':'');
  return '<article class="journal-reading-row"><time class="journal-reading-date" datetime="'+esc(row.date)+'"><strong>'+esc(row.date.slice(5).replace('-',' / '))+'</strong><small>'+esc(row.date.slice(0,4))+'</small></time><div class="journal-reading-detail"><h3>'+esc(row.chapter||tr('旧版页码记录','Legacy page entry'))+'</h3><p>'+esc([row.author,row.language,row.edition,pages].filter(Boolean).join(' · '))+'</p>'+(row.note?'<p class="reading-note52">'+esc(row.note)+'</p>':'')+'</div><div class="journal-reading-actions"><button type="button" data-journal-reading-edit="'+esc(row.id)+'" aria-label="'+esc(tr('编辑《'+row.book+'》阅读记录','Edit reading entry for '+row.book))+'">'+tr('编辑','Edit')+'</button><button type="button" data-journal-reading-delete="'+esc(row.id)+'" aria-label="'+esc(tr('删除《'+row.book+'》阅读记录','Delete reading entry for '+row.book))+'">'+tr('删除','Delete')+'</button></div></article>';
}
function readingTimelineMarkup(rows,book) {
  return '<article class="reading-book52"><header><span class="reading-book-mark52" aria-hidden="true">'+esc(book.title.slice(0,1))+'</span><div><h3>《'+esc(book.title)+'》</h3><p>'+esc([book.author,book.language].filter(Boolean).join(' · '))+'</p></div><span class="badge">'+rows.length+tr(' 次阅读',' entries')+'</span></header><div class="reading-axis52">'+rows.map(readingEntryMarkup).join('')+'</div></article>';
}
function readingFootprintsMarkup() {
  const readings=journalSortedReadings(),books=getReadingBooks();
  if(readingBookFilter&&!books.some(book=>book.key===readingBookFilter))readingBookFilter='';
  const filtered=readingView==='book'&&readingBookFilter?readings.filter(row=>readingBookKey(row.book)===readingBookFilter):readings;
  const shown=filtered.slice(0,readingVisible),groups=new Map();
  for(const row of shown){const key=readingBookKey(row.book);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  return '<section class="journal-reading-history"><div class="journal-list-heading"><div><p class="eyebrow">READING FOOTPRINTS</p><h2>'+tr('阅读足迹','Your reading log')+'</h2></div><span>'+filtered.length+tr(' 条记录',' entries')+'</span></div><div class="reading-filters52"><label class="field"><span>'+tr('查看方式','View')+'</span><select id="readingHistoryView"><option value="time"'+(readingView==='time'?' selected':'')+'>'+tr('按时间排序 · 最近录入','By time · newest entries')+'</option><option value="book"'+(readingView==='book'?' selected':'')+'>'+tr('按书筛选','Filter by book')+'</option></select></label>'+(readingView==='book'?'<label class="field"><span>'+tr('选择书目','Choose a book')+'</span><select id="readingHistoryBook"><option value="">'+tr('全部书目','All books')+'</option>'+books.map(book=>'<option value="'+esc(book.key)+'"'+(book.key===readingBookFilter?' selected':'')+'>'+esc(book.title)+'</option>').join('')+'</select></label>':'')+'</div>'+(shown.length?'<p class="hint">'+tr('书目按最近录入时间排列，同一本书的阅读记录汇成一条纵向阅读轴。','Books appear by their latest entry, with each book collected on one reading timeline.')+'</p><div class="reading-timelines52">'+[...groups].map(([key,rows])=>readingTimelineMarkup(rows,books.find(book=>book.key===key))).join('')+'</div>'+(filtered.length>readingVisible?'<button class="journal-show-more" type="button" data-journal-reading-more>'+tr('查看更多阅读记录','Show more reading')+'</button>':''):'<div class="journal-empty"><strong>'+tr('每一页，都算数。','Every page counts.')+'</strong><p>'+tr('记下今天读到的章节，开始积累自己的阅读足迹。','Begin your reading trail with the chapter you reached today.')+'</p></div>')+'</section>';
}
function progressPage() {
  const draft={...journalBlankReading(),...(readingDraft||{})},books=getReadingBooks();
  if(!draft.pages&&draft.startPage)draft.pages=draft.startPage+' — '+draft.endPage;
  const field=(name,label,max,required=false,type='text',placeholder='')=>'<label class="field'+(name==='chapter'?' reading-chapter52':'')+'"><span>'+tr(...label)+(required?' *':tr('（选填）',' (optional)'))+'</span><input type="'+type+'" name="'+name+'" maxlength="'+max+'"'+(required?' required':'')+' value="'+esc(draft[name])+'"'+(name==='book'?' list="journalBookNames"':'')+' placeholder="'+esc(placeholder)+'"></label>';
  return '<div class="journal-page journal-progress-page" id="journalProgressPage"><header class="journal-heading"><div><p class="eyebrow">QICHENG / READING LOG</p><h1>'+tr('每日阅读进度','Reading progress')+'</h1><p>'+tr('以章节记录阅读，把每一天的思考连成足迹。','Keep chapters and thoughts together, one reading day at a time.')+'</p></div><button data-go3="calendar">'+tr('学习日历','Learning calendar')+' ↗</button></header><section class="journal-reading-entry"><h2>'+tr(draft.id?'编辑阅读记录':'记下今天的阅读',draft.id?'Edit reading entry':'What did you read?')+'</h2><form id="journalReadingForm"><input type="hidden" name="id" value="'+esc(draft.id)+'"><div class="journal-reading-fields">'+field('date',['阅读日期','Reading date'],10,true,'date')+field('book',['书名','Book title'],200,true)+field('author',['作者','Author'],200,true)+field('language',['阅读语言','Reading language'],80,true)+field('chapter',['阅读章节','Chapters read'],1000,true,'text',tr('例如：第一章；学而篇 1—6 则','For example: Chapter 1; sections 1–6'))+field('edition',['书的版本','Edition'],200)+field('pages',['页码范围','Page range'],200,false,'text',tr('可自由填写，例如 12—30 页','For example: pages 12–30'))+'</div><datalist id="journalBookNames">'+books.map(book=>'<option value="'+esc(book.title)+'"></option>').join('')+'</datalist><label class="field"><span>'+tr('阅读小记（选填）','Reading note (optional)')+'</span><textarea name="note" rows="4" maxlength="20000" placeholder="'+tr('留下一点想法，之后可一键整合为阅读心得。','Save a thought to combine into your reading reflection later.')+'">'+esc(draft.note)+'</textarea></label><div class="journal-form-actions"><button class="primary" type="submit">'+tr(draft.id?'保存修改':'保存阅读记录',draft.id?'Save changes':'Save reading')+'</button>'+(draft.id?'<button type="button" data-journal-reading-cancel>'+tr('取消编辑','Cancel edit')+'</button>':'')+'<span class="hint" id="journalReadingFeedback" role="status"></span></div></form><p class="hint">'+tr('仅日期、书名、作者、阅读语言与章节必填。保存后自动加入阅读足迹。','Only date, title, author, reading language and chapters are required. Saved entries join your reading timeline.')+'</p><button class="journal-reading-transfer" data-go3="learning">'+tr('整合为阅读经历','Create a reading experience')+' ↗</button></section>'+readingFootprintsMarkup()+'</div>';
}
function journalPage() { return calendarPage(); }
function journalRefresh(id,markup,focus) {
  const container=$('#'+id);
  if (!container) return;
  container.outerHTML=markup(); bindJournalControls();
  if (focus) $(focus)?.focus({preventScroll:true});
}
function journalMovePeriod(direction) {
  if (calendarView==='week') calendarAnchor=journalShiftDate(calendarAnchor,direction*7);
  else {
    const date=new Date(calendarAnchor+'T12:00:00'); date.setDate(1); date.setMonth(date.getMonth()+direction);
    calendarAnchor=journalDateKey(date);
  }
  selectedDate=calendarAnchor;
  journalRefresh('journalCalendarPage',calendarPage,'[data-journal-period="'+direction+'"]');
}
function journalClosePopover(restoreFocus=true) {
  const panel=$('#journalDayPopover');
  if (!panel || panel.hidden) return;
  try { if (panel.matches(':popover-open')) panel.hidePopover(); } catch {}
  panel.hidden=true;
  $$('[data-journal-date]').forEach(button=>button.setAttribute('aria-expanded','false'));
  if (restoreFocus) $('[data-journal-date="'+selectedDate+'"]')?.focus({preventScroll:true});
}
function journalOpenDay(button) {
  const panel=$('#journalDayPopover'); if (!panel) return;
  selectedDate=button.dataset.journalDate;
  const date=selectedDate, current=dayRecords.get(date), countdown=getHomeCountdown();
  $$('[data-journal-date]').forEach(day=>{day.setAttribute('aria-expanded',String(day===button));day.tabIndex=day===button?0:-1;});
  panel.innerHTML='<div class="journal-popover-heading"><div><p>'+esc(date.slice(0,7).replace('-',' / '))+'</p><h2 id="journalPopoverTitle">'+esc(journalDateLabel(date))+'</h2></div><button type="button" data-journal-popover-close aria-label="'+tr('关闭日期菜单','Close date menu')+'">×</button></div><div class="journal-status-options" role="group" aria-label="'+tr('评估当日状态','Reflect on this day')+'">'+JOURNAL_STATUSES.map(status=>'<button type="button" data-journal-status="'+status[0]+'" aria-pressed="'+(current?.status===status[0])+'"><i class="journal-status-mark status-'+status[0]+'" aria-hidden="true"></i><span><strong>'+tr(status[1],status[2])+'</strong><small>'+tr(status[3],status[4])+'</small></span><span class="journal-status-check" aria-hidden="true">'+(current?.status===status[0]?'✓':'')+'</span></button>').join('')+'</div>'+(current?'<button class="journal-status-clear" type="button" data-journal-status-clear>'+tr('清除这天的状态','Clear this reflection')+'</button>':'')+'<form id="journalCountdownForm"><label class="field"><span>'+tr('首页倒计时目标名称','Home countdown goal')+'</span><input name="name" maxlength="120" value="'+esc(countdown.name)+'" placeholder="'+tr('例如：目标考试','For example: Exam day')+'"></label><button type="submit">'+tr('设为倒计时目标日','Set countdown target')+'</button><p class="hint">'+tr('与首页使用同一个目标，修改后两处同步。','This updates the same countdown shown on Home.')+'</p></form>';
  panel.hidden=false;
  const rect=button.getBoundingClientRect(), width=Math.min(360,Math.max(280,globalThis.innerWidth-24));
  panel.style.width=width+'px';
  panel.style.left=Math.max(12,Math.min(rect.left+rect.width/2-width/2,globalThis.innerWidth-width-12))+'px';
  panel.style.top='12px';
  try { if (panel.showPopover && !panel.matches(':popover-open')) panel.showPopover(); } catch {}
  const height=panel.getBoundingClientRect().height, below=rect.bottom+8, above=rect.top-height-8;
  panel.style.top=Math.max(12,Math.min(below+height<=globalThis.innerHeight-12?below:above>=12?above:globalThis.innerHeight-height-12,globalThis.innerHeight-height-12))+'px';
  panel.style.transformOrigin=below+height<=globalThis.innerHeight-12?'top center':'bottom center';
  panel.querySelector('[data-journal-popover-close]').onclick=()=>journalClosePopover();
  panel.querySelectorAll('[data-journal-status]').forEach(choice=>choice.onclick=async()=>{
    panel.querySelectorAll('button').forEach(control=>control.disabled=true);
    try { await saveDailyStatus(date,choice.dataset.journalStatus); journalClosePopover(false); journalRefresh('journalCalendarPage',calendarPage,'[data-journal-date="'+date+'"]'); toast(tr('当日状态已记录','Reflection saved')); }
    catch(error) { toast(error.message); panel.querySelectorAll('button').forEach(control=>control.disabled=false); }
  });
  const clear=panel.querySelector('[data-journal-status-clear]'); if (clear) clear.onclick=async()=>{
    try { await deleteDailyStatus(date); journalClosePopover(false); journalRefresh('journalCalendarPage',calendarPage,'[data-journal-date="'+date+'"]'); }
    catch(error) { toast(error.message); }
  };
  const form=panel.querySelector('#journalCountdownForm'); form.onsubmit=async event=>{
    event.preventDefault(); const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try { await saveHomeCountdown({name:form.elements.name.value.trim(),date});journalClosePopover(false);journalRefresh('journalCalendarPage',calendarPage,'[data-journal-date="'+date+'"]');toast(tr('首页倒计时已同步','Home countdown updated')); }
    catch(error) { toast(error.message);submit.disabled=false; }
  };
  panel.querySelector('[data-journal-status]')?.focus({preventScroll:true});
}
function bindJournalControls() {
  bindingAbort?.abort(); bindingAbort=null;
  const calendar=$('#journalCalendarPage'), progress=$('#journalProgressPage');
  if (!calendar && !progress) return;
  bindingAbort=new AbortController(); const signal=bindingAbort.signal;
  // These page-local links are replaced with the calendar/form, so bind them here too.
  (calendar||progress).querySelectorAll('[data-go3]').forEach(button=>button.onclick=()=>go3(button.dataset.go3));
  if (calendar) {
    $$('[data-journal-view]').forEach(button=>button.onclick=()=>{if(calendarView===button.dataset.journalView)return;calendarView=button.dataset.journalView;journalRefresh('journalCalendarPage',calendarPage,'[data-journal-view="'+calendarView+'"]');});
    $$('[data-journal-period]').forEach(button=>button.onclick=()=>journalMovePeriod(Number(button.dataset.journalPeriod)));
    const today=$('[data-journal-today]');if(today)today.onclick=()=>{calendarAnchor=selectedDate=journalDateKey();journalRefresh('journalCalendarPage',calendarPage,'[data-journal-date="'+selectedDate+'"]');};
    $$('[data-journal-date]').forEach(button=>{
      button.onclick=()=>journalOpenDay(button);
      button.onkeydown=event=>{
        const distance={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
        if (!distance) return; event.preventDefault();
        selectedDate=journalShiftDate(button.dataset.journalDate,distance);
        if (!getCalendarDays().includes(selectedDate)) {calendarAnchor=selectedDate;journalRefresh('journalCalendarPage',calendarPage,'[data-journal-date="'+selectedDate+'"]');}
        else {$$('[data-journal-date]').forEach(day=>day.tabIndex=day.dataset.journalDate===selectedDate?0:-1);$('[data-journal-date="'+selectedDate+'"]')?.focus({preventScroll:true});}
      };
    });
    const motto=$('#journalMottoForm');if(motto)motto.onsubmit=async event=>{event.preventDefault();try{await saveJournalPreferences({motto:motto.elements.motto.value.trim()});journalRefresh('journalCalendarPage',calendarPage);toast(tr('日历标语已保存','Calendar message saved'));}catch(error){toast(error.message);}};
    document.addEventListener('keydown',event=>{if(event.key==='Escape')journalClosePopover();},{signal});
    document.addEventListener('pointerdown',event=>{const panel=$('#journalDayPopover');if(panel&&!panel.hidden&&!panel.contains(event.target)&&!event.target.closest('[data-journal-date]'))journalClosePopover(false);},{signal});
    const panel=$('#journalDayPopover');panel?.addEventListener('toggle',event=>{if(event.newState==='closed'){panel.hidden=true;$$('[data-journal-date]').forEach(button=>button.setAttribute('aria-expanded','false'));}},{signal});
  }
  if (progress) {
    const form=$('#journalReadingForm');
    if (form) {
      form.oninput=()=>{readingDraft=Object.fromEntries(READING_FIELDS.map(key=>[key,form.elements[key].value]));};
      form.onsubmit=async event=>{
        event.preventDefault(); if(!form.reportValidity())return;
        const button=form.querySelector('[type="submit"]');button.disabled=true;
        try {await saveReadingProgress(Object.fromEntries(READING_FIELDS.map(key=>[key,form.elements[key].value])));readingDraft=null;journalRefresh('journalProgressPage',progressPage);const feedback=$('#journalReadingFeedback');if(feedback)feedback.textContent=tr('阅读记录已保存。','Reading saved.');}
        catch(error) {toast(error.message);button.disabled=false;}
      };
    }
    const view=$('#readingHistoryView');if(view)view.onchange=()=>{readingView=view.value;readingVisible=30;journalRefresh('journalProgressPage',progressPage,'#readingHistoryView');};
    const book=$('#readingHistoryBook');if(book)book.onchange=()=>{readingBookFilter=book.value;readingVisible=30;journalRefresh('journalProgressPage',progressPage,'#readingHistoryBook');};
    $$('[data-journal-reading-more]').forEach(button=>button.onclick=()=>{readingVisible+=30;journalRefresh('journalProgressPage',progressPage);});
    $$('[data-journal-reading-edit]').forEach(button=>button.onclick=()=>{readingDraft=journalClone(readingRecords.get(button.dataset.journalReadingEdit));journalRefresh('journalProgressPage',progressPage,'#journalReadingForm input[name="book"]');});
    $$('[data-journal-reading-cancel]').forEach(button=>button.onclick=()=>{readingDraft=null;journalRefresh('journalProgressPage',progressPage);});
    $$('[data-journal-reading-delete]').forEach(button=>button.onclick=async()=>{
      const id=button.dataset.journalReadingDelete, row=readingRecords.get(id);if(!row)return;
      if(!await confirmAction(tr('删除阅读记录','Delete reading entry'),tr('删除《'+row.book+'》在 '+row.date+' 的阅读记录？','Delete the entry for '+row.book+' on '+row.date+'?')))return;
      try {await deleteReadingProgress(id);if(readingDraft?.id===id)readingDraft=null;journalRefresh('journalProgressPage',progressPage);toast(tr('阅读记录已删除','Reading entry deleted'));}catch(error){toast(error.message);}
    });
  }
}

export { initializeJournal, validateJournalRecords, waitForJournalWrites, calendarPage, progressPage, journalPage, bindJournalControls, getReadingProgress, getLatestReading, getReadingBooks, getReadingIntegration, readingBookKey, saveReadingProgress, deleteReadingProgress, saveDailyStatus, deleteDailyStatus, saveJournalPreferences, homeRecentStatusMarkup, getRecentStatus, journalDateKey, journalValidDate, journalShiftDate, getCalendarDays };
