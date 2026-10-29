import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { FakeFactory } from './support.mjs';

async function harness() {
  const factory=new FakeFactory(), context=vm.createContext({console,indexedDB:factory,Date,Math,structuredClone,setTimeout,clearTimeout,AbortController});
  const storageModule=new vm.SourceTextModule(await readFile(new URL('../js/storage.js',import.meta.url),'utf8'),{context});
  await storageModule.link(()=>{throw new Error('Unexpected storage dependency');});await storageModule.evaluate();
  const storage=storageModule.namespace.storage, ctx={state:{uiLang:'zh',route:'calendar'},persistencePaused:false};
  const writes=[];for(const name of ['set','setMany','remove']){const original=storage[name];storage[name]=async(...args)=>{writes.push([name,...args]);return original(...args);};}
  let sequence=0, countdown={name:'考试',date:'2026-10-22'};
  const values={
    '../storage.js':{storage},'../state.js':{ctx},'../app.js':{confirmAction:async()=>true,go3(){}},
    './home.js':{getHomeCountdown:()=>({...countdown}),saveHomeCountdown:async value=>{countdown={...value};}},
    '../utils/helpers.js':{$:()=>null,$$:()=>[],esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),tr:(zh,en)=>ctx.state.uiLang==='en'?en:zh,toast(){},uid:()=> 'entry-'+(++sequence)}
  };
  const module=new vm.SourceTextModule(await readFile(new URL('../js/modules/journal.js',import.meta.url),'utf8'),{context});
  await module.link(specifier=>{
    if(!values[specifier])throw new Error('Unexpected dependency '+specifier);
    return new vm.SyntheticModule(Object.keys(values[specifier]),function(){for(const [key,value]of Object.entries(values[specifier]))this.setExport(key,value);},{context});
  });await module.evaluate();
  const journal=module.namespace;await journal.initializeJournal();
  return {journal,storage,factory,writes,ctx};
}
const reading=(patch={})=>({date:'2026-10-22',book:'论语',author:'孔子',language:'汉语',chapter:'学而第一',edition:'',pages:'1–12',note:'',...patch});
const storedReading=(patch={})=>({id:'old',date:'2026-10-22',book:'论语',startPage:1,endPage:12,updatedAt:'2026-10-22T01:00:00.000Z',...patch});

test('journal is read only until an explicit content action, including calendar and week/month generation',async()=>{
  const {journal,storage,writes}=await harness();
  assert.equal(journal.getLatestReading(),null);
  assert.equal(journal.getReadingProgress().length,0);
  assert.match(journal.calendarPage(),/学习日历/);assert.match(journal.progressPage(),/每一页，都算数/);
  assert.equal(journal.getCalendarDays('week','2026-10-22').length,7);
  assert.equal(journal.getCalendarDays('month','2026-10-22').length,42);
  journal.homeRecentStatusMarkup(new Date(2026,9,22));
  await journal.waitForJournalWrites();
  assert.equal(writes.length,0);assert.equal(Object.keys(await storage.getAll()).length,0);
});

test('save, edit, delete and initialize reading progress retain stable IDs without duplicating rows',async()=>{
  const {journal,storage,writes}=await harness();
  const first=await journal.saveReadingProgress(reading());
  assert.equal(first.id,'entry-1');assert.equal(first.book,'论语');
  assert.ok(writes[0][1]['journal:reading:entry-1']);assert.equal(writes[0][1]['meta:journal-overview'].latest.id,'entry-1');
  await journal.saveReadingProgress(reading({id:first.id,chapter:'为政第二'}));
  assert.equal(journal.getReadingProgress().length,1);assert.equal(journal.getLatestReading().chapter,'为政第二');
  const written=writes.length;await journal.saveReadingProgress(reading({id:first.id,chapter:'为政第二'}));assert.equal(writes.length,written);
  await journal.initializeJournal();assert.equal(journal.getLatestReading().chapter,'为政第二');
  assert.equal(await journal.deleteReadingProgress(first.id),true);
  assert.equal(journal.getLatestReading(),null);assert.equal(await storage.get('journal:reading:'+first.id),undefined);
  const count=writes.length;assert.equal(await journal.deleteReadingProgress(first.id),false);assert.equal(writes.length,count);
});

test('latest legacy reading follows recording time independently of reading date and returned objects cannot mutate saved data',async()=>{
  const {journal}=await harness();
  await journal.initializeJournal({
    'journal:reading:a':storedReading({id:'a',date:'2026-10-20',book:'旧书',updatedAt:'2026-10-22T00:00:00Z'}),
    'journal:reading:b':storedReading({id:'b',book:'较早修改',updatedAt:'2026-10-22T01:00:00Z'}),
    'journal:reading:c':storedReading({id:'c',book:'最新书目',updatedAt:'2026-10-22T02:00:00Z'})
  });
  assert.equal(journal.getLatestReading().book,'最新书目');
  const latest=journal.getLatestReading();latest.book='mutated';
  journal.getReadingProgress()[0].date='1900-01-01';
  assert.equal(journal.getLatestReading().book,'最新书目');assert.equal(journal.getLatestReading().date,'2026-10-22');
});

test('reading validation rejects current required fields and malformed legacy page ranges before storage writes',async()=>{
  const {journal,writes}=await harness();
  for(const patch of [{date:'2026-02-29'},{date:'2026-13-01'},{date:'2026-1-2'},{date:'0001-01-01'},{book:' '},{book:'a'.repeat(201)},{author:''},{language:''},{chapter:''},{chapter:'x'.repeat(1001)},{id:'bad/key'}]) assert.throws(()=>journal.saveReadingProgress(reading(patch)));
  assert.equal(writes.length,0);assert.equal(journal.getLatestReading(),null);
  for(const patch of [{startPage:0},{startPage:1.5},{endPage:0},{startPage:20,endPage:10},{endPage:1000001}])assert.throws(()=>journal.validateJournalRecords({'journal:reading:old':storedReading(patch)}));
  await journal.saveReadingProgress(reading({date:'2024-02-29',pages:'2',book:'  道德经  '}));
  assert.equal(journal.getLatestReading().book,'道德经');assert.equal(journal.getLatestReading().pages,'2');
});

test('failed reading writes and deletes retain committed memory and database, and remain retryable',async()=>{
  const {journal,storage,factory}=await harness();
  const first=await journal.saveReadingProgress(reading());
  factory.failWrite=true;await assert.rejects(journal.saveReadingProgress(reading({id:first.id,chapter:'失败修改'})));
  assert.equal(journal.getLatestReading().chapter,'学而第一');assert.equal((await storage.get('journal:reading:'+first.id)).chapter,'学而第一');
  factory.failWrite=true;await assert.rejects(journal.deleteReadingProgress(first.id));assert.equal(journal.getLatestReading().id,first.id);
  await journal.saveReadingProgress(reading({id:first.id,chapter:'重试修改'}));assert.equal(journal.getLatestReading().chapter,'重试修改');
});

test('writes are serialized, pending edits survive navigation, and paused restore operations cannot interleave',async()=>{
  const {journal,ctx,storage}=await harness();
  const a=journal.saveReadingProgress(reading({id:'a'}));
  const b=journal.saveReadingProgress(reading({id:'a',chapter:'最新章节'}));
  ctx.state.route='home';await journal.waitForJournalWrites();await Promise.all([a,b]);
  assert.equal(journal.getLatestReading().chapter,'最新章节');assert.equal((await storage.get('journal:reading:a')).chapter,'最新章节');
  ctx.persistencePaused=true;await assert.rejects(journal.saveReadingProgress(reading({id:'b'})),/等待/);
  assert.equal(await storage.get('journal:reading:b'),undefined);assert.equal(journal.getReadingProgress().length,1);
});

test('four daily states persist individually, repeated unchanged selection does not save, clearing is isolated',async()=>{
  const {journal,writes,storage}=await harness();
  for(const [index,status]of ['perfect','good','steady','low'].entries()) await journal.saveDailyStatus('2026-10-'+(19+index),status);
  assert.equal(writes.length,4);
  await journal.saveDailyStatus('2026-10-22','low');assert.equal(writes.length,4);
  const days=journal.getRecentStatus(5,new Date(2026,9,22));
  assert.equal(days[0].date,'2026-10-18');assert.equal(days[0].status,null);assert.equal(days[4].status,'low');
  await journal.deleteDailyStatus('2026-10-22');
  assert.equal(journal.getRecentStatus(5,new Date(2026,9,22))[4].status,null);
  assert.equal((await storage.get('journal:day:2026-10-21')).status,'steady');
});

test('failed status write never replaces a previously committed day; invalid options do not write',async()=>{
  const {journal,factory,writes}=await harness();
  await journal.saveDailyStatus('2026-10-22','good');factory.failWrite=true;
  await assert.rejects(journal.saveDailyStatus('2026-10-22','perfect'));
  assert.equal(journal.getRecentStatus(1,new Date(2026,9,22))[0].status,'good');
  const count=writes.length;
  assert.throws(()=>journal.saveDailyStatus('2026-10-22','amazing'));
  assert.throws(()=>journal.saveDailyStatus('2026-02-30','good'));
  assert.throws(()=>journal.deleteDailyStatus('anything'));
  assert.equal(writes.length,count);
});

test('restoration validates every journal entry before replacing any memory and accepts unrelated backup records',async()=>{
  const {journal}=await harness();await journal.saveReadingProgress(reading());
  const valid={'current':{legacy:'untouched'},'settings:home':{motto:'home'},'journal:reading:old':storedReading(),'journal:day:2026-10-22':{date:'2026-10-22',status:'perfect',updatedAt:'2026-10-22T00:00:00Z'},'settings:journal':{motto:'先做眼前事'}};
  assert.equal(journal.validateJournalRecords(valid),valid);
  await assert.rejects(journal.initializeJournal({...valid,'journal:day:2026-10-23':{date:'2026-10-23',status:'invalid',updatedAt:'2026-10-23T00:00:00Z'}}));
  assert.equal(journal.getLatestReading().id,'entry-1');
  await journal.initializeJournal(valid);assert.equal(journal.getLatestReading().id,'old');assert.match(journal.calendarPage(),/先做眼前事/);
  await journal.initializeJournal({});assert.equal(journal.getLatestReading(),null);assert.match(journal.calendarPage(),/今日事，今日毕/);
});

test('malformed and mismatched journal backups are rejected, including unknown record types',async()=>{
  const {journal}=await harness();
  for(const records of [null,[],{'settings:journal':{motto:5}},{'settings:journal':{motto:'x'.repeat(121)}},{'journal:reading:other':storedReading()},{'journal:reading:old':storedReading({updatedAt:'never'})},{'journal:day:2026-10-21':{date:'2026-10-22',status:'good',updatedAt:'2026-10-22T00:00:00Z'}},{'journal:new':{} }]) assert.throws(()=>journal.validateJournalRecords(records));
});

test('date calculations use local calendar dates, support year boundaries and keep Monday-first 7-day rows',async()=>{
  const {journal}=await harness();
  assert.equal(journal.journalDateKey(new Date(2026,9,22,0,1)),'2026-10-22');
  assert.equal(journal.journalShiftDate('2026-12-31',1),'2027-01-01');assert.equal(journal.journalShiftDate('2024-03-01',-1),'2024-02-29');
  const month=journal.getCalendarDays('month','2026-10-22'), week=journal.getCalendarDays('week','2026-10-22');
  assert.equal(month[0],'2026-09-28');assert.equal(month[41],'2026-11-08');assert.equal(week[0],'2026-10-19');assert.equal(week[6],'2026-10-25');
  assert.equal(new Set(month).size,42);assert.equal(new Date(month[0]+'T12:00:00').getDay(),1);
  assert.throws(()=>journal.getCalendarDays('unknown','2026-10-22'));assert.throws(()=>journal.getCalendarDays('month','bad'));
});

test('calendar encouragement saves independently and only after successful commit',async()=>{
  const {journal,factory,writes}=await harness();
  await journal.saveJournalPreferences({motto:'读书，向前。'});assert.equal(writes.length,1);assert.match(journal.calendarPage(),/读书，向前。/);
  await journal.saveJournalPreferences({motto:'读书，向前。'});assert.equal(writes.length,1);
  factory.failWrite=true;await assert.rejects(journal.saveJournalPreferences({motto:'未保存'}));assert.ok(!journal.calendarPage().includes('未保存'));
  await assert.rejects(journal.saveJournalPreferences({motto:'x'.repeat(121)}));
});

test('home five-day board distinguishes unrecorded days and safely escapes user text in all views',async()=>{
  const {journal}=await harness();
  await journal.saveDailyStatus('2026-10-22','perfect');await journal.saveReadingProgress(reading({book:'<img src=x onerror=alert(1)>'}));
  await journal.saveJournalPreferences({motto:'<script>unsafe</script>'});
  const home=journal.homeRecentStatusMarkup(new Date(2026,9,22));
  assert.equal((home.match(/class="home-status-day[ "]/g)||[]).length,5);assert.match(home,/尚未记录/);assert.match(home,/完美/);assert.match(home,/data-go3="calendar"/);
  assert.ok(!journal.progressPage().includes('<img src=x'));assert.match(journal.progressPage(),/&lt;img/);
  assert.ok(!journal.calendarPage().includes('<script>'));assert.match(journal.calendarPage(),/&lt;script&gt;/);
});

test('calendar reuses the existing countdown date and renders accessible date and reflection controls',async()=>{
  const {journal}=await harness();
  const html=journal.calendarPage();
  assert.match(html,/data-journal-date="2026-10-22"/);assert.match(html,/is-target/);assert.match(html,/倒计时目标日.*考试/);
  assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/aria-expanded="false"/);assert.match(html,/popover="auto"/);
  assert.equal((html.match(/data-journal-date=/g)||[]).length,42);
});

test('large reading history is paginated for mobile rendering; backups retain all records and enforce limits',async()=>{
  const {journal}=await harness();
  const records=Object.fromEntries(Array.from({length:10001},(_,index)=>['journal:reading:r'+index,storedReading({id:'r'+index,book:'书目 '+index})]));
  assert.throws(()=>journal.validateJournalRecords(records),/上限/);delete records['journal:reading:r10000'];
  await journal.initializeJournal(records);
  assert.equal(journal.getReadingProgress().length,10000);
  const html=journal.progressPage();assert.equal((html.match(/class="journal-reading-row"/g)||[]).length,30);assert.match(html,/查看更多阅读记录/);
  await assert.rejects(journal.saveReadingProgress(reading({id:'new'})),/10,000/);
});
