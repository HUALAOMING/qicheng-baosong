import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const data=await import('../js/data.js');
const {fresh}=await import('../js/model.js');
const {storage}=await import('../js/storage.js');
const save=await import('../js/autosave.js');
const app=await import('../js/app.js');
const home=await import('../js/modules/home.js');
const resources=await import('../js/resources.js');
const explore=await import('../js/modules/explore.js');
const backup=await import('../js/backup.js');
const {pwa}=await import('../js/pwa.js');
await data.loadBuiltinData();ctx.state=fresh();await resources.initializeResources();await home.initializeHome();save.initializeSaving301();
test('beta homepage settings are serialized independently; navigation does not write current or prefs',async()=>{
  let currentWrites=0,prefWrites=0;const original=storage.set;
  storage.set=async(k,v)=>{if(k==='current')currentWrites++;if(k==='settings:home')prefWrites++;return original(k,v);};
  try{
    await Promise.all([home.saveHomePreferences({motto:'向前走，慢慢来。'}),home.saveHomePreferences({featuredSchool:data.SCHOOLS[1].name})]);
    assert.equal(home.getHomePreferences().motto,'向前走，慢慢来。');assert.equal(home.getHomePreferences().featuredSchool,data.SCHOOLS[1].name);assert.equal(currentWrites,0);assert.equal(prefWrites,2);
    for(const route of ['home','settings','explore','schools'])await app.go3(route);app.toggleNav3();app.toggleNav3();await save.save();assert.equal(currentWrites,0);assert.equal(prefWrites,2);
    await home.saveHomePreferences({motto:'向前走，慢慢来。'});assert.equal(prefWrites,2);
  }finally{storage.set=original;}
});
test('featured school is a reference to existing targets with a non-destructive fallback',async()=>{
  const [a,b]=data.SCHOOL_DETAILS3;ctx.state.profile.targetSchool=a.name;ctx.state.dreamSchools=[a.name,b.name];await home.saveHomePreferences({featuredSchool:b.name});assert.equal(home.homeFeaturedSchool().school.logo,b.logo);const html=home.homePage();assert.ok(html.includes(b.name)&&html.includes(b.abbreviation)&&html.includes(b.logo));ctx.state.dreamSchools=[a.name];assert.equal(home.homeFeaturedSchool().name,a.name);assert.equal(home.getHomePreferences().featuredSchool,b.name);
});
test('classic JSON is shared by daily reading, reimports update both views, and backups retain the binding',async()=>{
  const book={schemaVersion:1,book:{id:'beta-classic',title:'体验典籍',version:'1.0.0'},passages:[{id:'P1',text:'原文甲',chapter:'第一篇'},{id:'P2',text:'原文乙',explanation:'释义乙'}]};await resources.importResourceJSON(book);const originalQuotes=await storage.get('resource:custom:daily-quotes');await home.saveHomePreferences({quoteSource:'classic',quoteBookId:'beta-classic'});
  assert.deepEqual(home.getDailyQuoteResource().quotes.map(q=>q.text),['原文甲','原文乙']);assert.equal(home.getDailyQuoteResource().quotes[0].passageId,'P1');book.book.version='1.1.0';book.passages[0].text='校订原文甲';await resources.importResourceJSON(book);assert.equal(home.getDailyQuoteResource().quotes[0].text,'校订原文甲');assert.match(explore.classicPage('beta-classic'),/校订原文甲/);assert.deepEqual(await storage.get('resource:custom:daily-quotes'),originalQuotes);
  const file=await backup.getCurrentBackup();assert.equal(file.data['settings:home'].quoteBookId,'beta-classic');await backup.commitBackup(file);assert.equal(home.getDailyQuoteResource().quotes[0].text,'校订原文甲');assert.equal(explore.classicAsQuotes(explore.exploreBook('guanzi')).quotes.length,100);
});
test('home settings validate before mutation; missing old settings keep defaults; text stays inert',async()=>{
  const original=home.getHomePreferences();for(const patch of [{motto:'x'.repeat(121)},{quoteSource:'bad'},{quoteSource:'classic',quoteBookId:''}])await assert.rejects(home.saveHomePreferences(patch));assert.deepEqual(home.getHomePreferences(),original);await home.saveHomePreferences({motto:'<script>alert(1)</script>'});assert.ok(home.homePage().includes('&lt;script&gt;'));await home.initializeHome({});assert.equal(home.getHomePreferences().motto,'');
});
test('backup waits for accepted home writes and a failed write preserves old preferences',async()=>{
  const original=storage.set;let release;
  storage.set=async(k,v)=>{if(k==='settings:home')await new Promise(r=>release=r);return original(k,v);};
  const pending=home.saveHomePreferences({motto:'备份前的修改'});await new Promise(r=>setTimeout(r,0));let finished=false;const file=backup.getCurrentBackup().then(v=>{finished=true;return v;});await new Promise(r=>setTimeout(r,0));assert.equal(finished,false);release();await pending;assert.equal((await file).data['settings:home'].motto,'备份前的修改');storage.set=original;
  env.factory.failWrite=true;await assert.rejects(home.saveHomePreferences({motto:'失败的修改'}));assert.equal(home.getHomePreferences().motto,'备份前的修改');env.factory.failWrite=false;
});
test('explicit app update check finds waiting versions, handles offline/failure, and never saves content',async()=>{
  let updateCalls=0,posted=0,fail=false;
  const reg={waiting:null,installing:null,addEventListener(){},update:async()=>{updateCalls++;if(fail)throw Error('Offline fixture');}};
  const nav={onLine:true,userAgent:'Test',serviceWorker:{register:async()=>reg,getRegistration:async()=>reg,addEventListener(){},ready:Promise.resolve(reg)}};
  Object.defineProperty(globalThis,'navigator',{value:nav,configurable:true});globalThis.isSecureContext=true;await pwa.init();const before=JSON.stringify(await storage.getAll());await pwa.checkUpdate();assert.ok(updateCalls>=2);assert.equal(JSON.stringify(await storage.getAll()),before);
  reg.waiting={postMessage(){posted++;}};assert.equal(await pwa.checkUpdate(),true);ctx.state.profile.name='未保存内容';env.factory.failWrite=true;await pwa.applyUpdate();assert.equal(posted,0);env.factory.failWrite=false;await pwa.applyUpdate();assert.equal(posted,1);assert.equal((await storage.get('current')).profile.name,'未保存内容');
  const calls=updateCalls;nav.onLine=false;assert.equal(await pwa.checkUpdate(),false);assert.equal(updateCalls,calls);nav.onLine=true;reg.waiting=null;fail=true;assert.equal(await pwa.checkUpdate(),false);
});
