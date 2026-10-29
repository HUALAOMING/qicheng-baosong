import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setup} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const data=await import('../js/data.js');
const {fresh,snapshot3}=await import('../js/model.js');
const {storage}=await import('../js/storage.js');
const saving=await import('../js/autosave.js');
const app=await import('../js/app.js');
const resources=await import('../js/resources.js');
const explore=await import('../js/modules/explore.js');
const home=await import('../js/modules/home.js');
const backup=await import('../js/backup.js');
await data.loadBuiltinData();await data.loadRouteData('reading');ctx.state=fresh();await resources.initializeResources();
test('navigation, menu and temporary filters produce zero current writes; an edit survives immediate navigation',async()=>{
  saving.initializeSaving301();let writes=0;const original=storage.commitCurrent;
  storage.commitCurrent=async(...args)=>{writes++;return original(...args);};
  try{
    for(const route of ['profile','settings','quiz','home'])await app.go3(route);
    app.toggleNav3();app.toggleNav3();ctx.state.menuOpen.push('info');ctx.state.chartMetric='subject';
    assert.equal(ctx.dirty301,false);await saving.save();assert.equal(writes,0);
    ctx.state.profile.name='编辑后立刻切页';saving.scheduleSave();await app.go3('explore');
    await new Promise(resolve=>setTimeout(resolve,650));await ctx.saveChain;
    assert.equal(writes,1);assert.equal((await storage.get('current')).profile.name,'编辑后立刻切页');assert.equal((await storage.get('current')).route,'home');
    for(const route of ['settings','profile','home'])await app.go3(route);await saving.save();assert.equal(writes,1);
  }finally{storage.commitCurrent=original;saving.cancelPendingSave();}
});
test('all three downloadable examples import offline, show dynamic entries and round-trip through backup',async()=>{
  const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network disabled');};
  try{
    for(const kind of ['quiz','classic','quotes'])await resources.importResourceJSON(data.RESOURCE_EXAMPLES.samples[kind].data);
    assert.ok(resources.listQuizBanks().some(b=>b.bank.id==='my-english-grammar'));
    assert.match(explore.classicPage('my-classic'),/请在此填写经核对的原文/);
    assert.match(explore.explorePage(),/我的典籍资料/);
    const file=await backup.getCurrentBackup();assert.ok(file.data['resource:custom:classic:my-classic']);assert.ok(file.data['resource:custom:daily-quotes']);
    await backup.commitBackup(file);assert.equal(resources.getClassicBooks().find(b=>b.id==='my-classic').passages[0].id,'P0001');
  }finally{globalThis.fetch=original;}
});
test('failed imports preserve every record, reject ambiguous formats, duplicate IDs, illegal answers and dangerous text remains inert',async()=>{
  const samples=data.RESOURCE_EXAMPLES.samples;
  const badClassic=structuredClone(samples.classic.data);badClassic.passages.push(badClassic.passages[0]);
  const badQuestion=structuredClone(samples.quiz.data);badQuestion.questions[0].answer='missing';
  const badQuote=structuredClone(samples.quotes.data);badQuote.quotes[0].bookId='guanzi';
  const before=JSON.stringify(await storage.getAll());
  for(const item of [badClassic,badQuestion,badQuote,{...samples.classic.data,...samples.quotes.data},'{'])await assert.rejects(resources.importResourceJSON(item));
  assert.equal(JSON.stringify(await storage.getAll()),before);
  const danger=structuredClone(samples.classic.data);danger.passages[0].text='<script>alert(1)</script>';await resources.importResourceJSON(danger);
  const html=explore.classicPage('my-classic');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
test('Guanzi 100 quotes are exact originals with valid passage links and fixed daily selection',async()=>{
  const original=resources.validateQuotes(JSON.parse(await (await data.resourceFetch('data/resources/daily-quotes.json')).text()));
  const entries=explore.exploreParseBook(explore.exploreBook('guanzi')).entries;
  assert.equal(original.quotes.length,100);
  for(const q of original.quotes){const entry=entries.find(e=>e.id===q.passageId);assert.ok(entry);assert.equal(q.text,entry.markdown.split('\n').filter(l=>l.startsWith('>')).map(l=>l.replace(/^>\s?/, '')).join('\n').replaceAll('**','').trim());}
  const day=new Date(2026,9,16);assert.deepEqual(home.homeQuoteForDate(original,day),home.homeQuoteForDate(original,new Date(2026,9,16,23,59)));assert.notEqual(home.homeQuoteForDate(original,day).id,home.homeQuoteForDate(original,new Date(2026,9,17)).id);
});
test('manual online classic update verifies checksum and commits atomically, with custom content still preferred',async()=>{
  const item=structuredClone(data.RESOURCE_EXAMPLES.samples.classic.data);item.book.id='new-classic';
  const body=JSON.stringify(item);const manifest={schemaVersion:1,resources:[{id:item.book.id,type:'classic',version:item.book.version,url:'book.json',sha256:createHash('sha256').update(body).digest('hex')}]};
  const original=globalThis.fetch;globalThis.fetch=async url=>new Response(String(url).endsWith('manifest.json')?JSON.stringify(manifest):body);
  try{await resources.updateResources('https://content.test/manifest.json');assert.equal(resources.getClassicBooks().find(b=>b.id==='new-classic').origin,'official');const before=JSON.stringify(await storage.getAll());manifest.resources[0].version='2.0.0';manifest.resources[0].sha256='0'.repeat(64);await assert.rejects(resources.updateResources('https://content.test/manifest.json'));assert.equal(JSON.stringify(await storage.getAll()),before);}
  finally{globalThis.fetch=original;}
});
test('empty old official quotes are filled locally while custom quotes and real installed resources remain untouched',async()=>{
  const custom=(await storage.getAll())['resource:custom:daily-quotes'];await storage.set('resource:official:daily-quotes',{schemaVersion:1,version:'1.0.0',quotes:[],origin:'official'});await resources.reloadResources();
  assert.equal((await storage.get('resource:official:daily-quotes')).quotes.length,100);assert.deepEqual(resources.getQuotesResource(),custom);
});
