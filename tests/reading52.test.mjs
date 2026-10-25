import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {storage}=await import('../js/storage.js');
const journal=await import('../js/modules/journal.js');
const home=await import('../js/modules/home.js');
const resources=await import('../js/resources.js');
const backup=await import('../js/backup.js');
ctx.state=fresh();await resources.initializeResources();await journal.initializeJournal();await home.initializeHome();
const entry=(patch={})=>({date:'2026-10-26',book:'论语',author:'孔子及其弟子',language:'中文',chapter:'学而篇 1—6 则',...patch});
const stored=(id,patch={})=>({id,schemaVersion:2,...entry(),edition:'',pages:'',note:'',createdAt:'2026-10-26T08:00:00Z',updatedAt:'2026-10-26T08:00:00Z',...patch});
const weekQuotes=()=>Array.from({length:7},(_,index)=>({id:'q'+index,text:'第 '+index+' 句',source:'测试典籍',selectionKey:'classic:test:q'+index}));

test('5.2 reading requires date, title, author, language and chapters; all optional values may be empty',async()=>{
  await journal.initializeJournal({});
  for(const key of ['date','book','author','language','chapter'])assert.throws(()=>journal.saveReadingProgress(entry({[key]:''})));
  assert.throws(()=>journal.saveReadingProgress(entry({date:'2026-02-29'})));
  const saved=await journal.saveReadingProgress(entry());
  assert.equal(saved.schemaVersion,2);assert.equal(saved.pages,'');assert.equal(saved.edition,'');assert.equal(saved.note,'');
  assert.equal(Object.hasOwn(saved,'startPage'),false);
  const html=journal.progressPage();
  for(const key of ['date','book','author','language','chapter'])assert.match(html,new RegExp('name="'+key+'"[^>]*required'));
  assert.doesNotMatch(html,/name="(?:startPage|endPage)"/);
  assert.equal((html.match(/class="reading-book52"/g)||[]).length,1);
  assert.match(html,/reading-axis52/);
  await journal.deleteReadingProgress(saved.id);
});

test('legacy page records load unchanged and new chapter records round-trip through persistence',async()=>{
  const legacy={id:'legacy52',date:'2026-10-20',book:'旧书',startPage:3,endPage:20,updatedAt:'2026-10-20T00:00:00Z'};
  await journal.initializeJournal({'journal:reading:legacy52':legacy});
  assert.deepEqual(journal.getLatestReading(),legacy);assert.match(journal.progressPage(),/旧版页码记录/);assert.match(journal.progressPage(),/3 — 20 页/);
  const saved=await journal.saveReadingProgress(entry({id:'roundtrip52',pages:'序言 iii—v；12—30 页',edition:'2025 修订版',note:'慢读。'}));
  assert.deepEqual(await storage.get('journal:reading:roundtrip52'),saved);
  await journal.initializeJournal();assert.equal(journal.getReadingProgress().find(row=>row.id==='roundtrip52').note,'慢读。');
  const unchanged=await journal.saveReadingProgress({...saved});assert.equal(unchanged.updatedAt,saved.updatedAt);
});

test('same book titles group into one timeline; latest input order is independent of reading date',async()=>{
  await journal.initializeJournal({
    'journal:reading:r52a':stored('r52a',{book:'论 语',date:'2026-10-26',createdAt:'2026-10-26T08:00:00Z'}),
    'journal:reading:r52b':stored('r52b',{book:'论语',date:'2020-01-01',chapter:'为政篇',createdAt:'2026-10-26T10:00:00Z'}),
    'journal:reading:r52c':stored('r52c',{book:'管子',createdAt:'2026-10-26T09:00:00Z'})
  });
  assert.equal(journal.getLatestReading().id,'r52b');
  const books=journal.getReadingBooks();assert.equal(books.length,2);assert.equal(books[0].records.length,2);
  books[0].records[0].chapter='changed';assert.equal(journal.getLatestReading().chapter,'为政篇');
  assert.equal((journal.progressPage().match(/class="reading-book52"/g)||[]).length,2);
});

test('integration combines every note of the selected book chronologically and remains independently editable',async()=>{
  await journal.initializeJournal({
    'journal:reading:n52a':stored('n52a',{date:'2026-10-25',chapter:'第二章',note:'第二天的思考'}),
    'journal:reading:n52b':stored('n52b',{date:'2026-10-24',chapter:'第一章',note:'第一天的思考'}),
    'journal:reading:n52c':stored('n52c',{book:'其他书',note:'不会被合并'}),
    'journal:reading:n52d':stored('n52d',{note:''})
  });
  const result=journal.getReadingIntegration('论语');
  assert.equal(result.date,journal.journalDateKey());assert.equal(result.author,'孔子及其弟子');assert.equal(result.language,'中文');assert.equal(result.count,3);assert.equal(result.noteCount,2);
  assert.ok(result.reflection.indexOf('第一天')<result.reflection.indexOf('第二天'));assert.doesNotMatch(result.reflection,/不会被合并/);
  result.reflection='自己的修改';assert.match(journal.getReadingIntegration('论语').reflection,/第一天/);
  assert.equal(journal.getReadingIntegration('不存在'),null);
});

test('a failed reading write keeps the last committed record intact',async()=>{
  await journal.initializeJournal({});
  const saved=await journal.saveReadingProgress(entry({id:'failed52',note:'原有小记'}));
  env.factory.failWrite=true;await assert.rejects(journal.saveReadingProgress({...saved,note:'没有保存成功'}));
  assert.equal(journal.getLatestReading().note,'原有小记');assert.equal((await storage.get('journal:reading:failed52')).note,'原有小记');
});

test('weekly quotes require exactly seven unique selections and follow Monday-to-Sunday order for this week only',async()=>{
  await home.initializeHome({});const monday=new Date(2026,9,26,12),resource={quotes:[{id:'default',text:'默认句子'}]};
  assert.equal(home.homeWeekStart(new Date(2026,10,1,23)),'2026-10-26');
  for(const quotes of [weekQuotes().slice(0,6),[...weekQuotes(),weekQuotes()[0]],Array.from({length:7},()=>weekQuotes()[0])])await assert.rejects(home.saveWeeklyQuotes(quotes,monday));
  const quotes=weekQuotes();[quotes[0],quotes[6]]=[quotes[6],quotes[0]];await home.saveWeeklyQuotes(quotes,monday);
  assert.equal(home.homeQuoteForDate(resource,monday).id,'q6');assert.equal(home.homeQuoteForDate(resource,new Date(2026,10,1,22)).id,'q0');
  assert.equal(home.homeQuoteForDate(resource,new Date(2026,10,2,12)).id,'default');
  const copy=home.getHomePreferences();copy.weeklyQuotePlan.quotes[0].text='changed';assert.equal(home.homeQuoteForDate(resource,monday).text,'第 6 句');
  await home.saveHomePreferences({weeklyQuotePlan:null});assert.equal(home.homeQuoteForDate(resource,monday).id,'default');
});

test('weekly quotes persist with the existing home backup record and malformed restored plans are rejected',async()=>{
  const monday=new Date(2026,9,26,12);await home.saveWeeklyQuotes(weekQuotes(),monday);
  const record=await storage.get('settings:home');assert.equal(record.weeklyQuotePlan.quotes.length,7);
  await home.initializeHome({'settings:home':record});
  assert.equal(home.homeQuoteForDate({quotes:[]},monday).text,'第 0 句');
  const broken=structuredClone(record);broken.weeklyQuotePlan.weekStart='2026-10-27';assert.throws(()=>home.validateHomeRecords({'settings:home':broken}));
  env.factory.failWrite=true;await assert.rejects(home.saveHomePreferences({weeklyQuotePlan:null}));assert.equal(home.homeQuoteForDate({quotes:[]},monday).id,'q0');
  const result=await backup.getCurrentBackup();assert.ok(result.data['settings:home'].weeklyQuotePlan);assert.ok(result.data['journal:reading:failed52']);
  await backup.commitBackup(result);
  assert.equal(journal.getReadingProgress().find(row=>row.id==='failed52').chapter,'学而篇 1—6 则');
  assert.equal(home.homeQuoteForDate({quotes:[]},monday).id,'q0');
});

test('reading text stays escaped and daily quote customization is reachable from home, daily quote and settings',async()=>{
  await journal.initializeJournal({});await journal.saveReadingProgress(entry({book:'<img src=x>',chapter:'<script>chapter</script>',note:'<b>notes</b>'}));
  const html=journal.progressPage();assert.doesNotMatch(html,/<script>|<img src=x>|<b>notes/);assert.match(html,/&lt;script&gt;chapter/);
  for(const page of [home.homePage(),home.dailyQuotePage(),home.homeSettingsMarkup()])assert.match(page,/data-home-weekly-open/);
});
