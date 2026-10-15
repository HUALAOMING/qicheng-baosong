import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {FakeFactory, makeDocument, root} from './support.mjs';

const factory = new FakeFactory();
globalThis.document = makeDocument();
globalThis.indexedDB = factory;
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const {storage} = await import('../js/storage.js');
const resources = await import('../js/resources.js');
function bank(id = 'english-grammar', version = '1.0.0') {
  const subject = id.startsWith('chinese-') ? 'chinese' : 'english';
  const section = ({'english-vocabulary':'vocabulary','chinese-ancient-culture':'ancient-culture','chinese-usage':'chinese-usage'})[id] || 'grammar';
  return {schemaVersion:1,bank:{id,name:'Validation fixture',subject,section,version},questions:[{id:'fixture-1',type:'single-choice',question:'Fixture only',options:[{id:'A',text:'First'},{id:'B',text:'Second'}],answer:'A',explanation:''}]};
}
function quotes(version = '1.0.0') { return {schemaVersion:1,version,quotes:[]}; }
function remote(items, mutate = () => {}) {
  const bodies = new Map(), manifest = {schemaVersion:1,resources:items.map(item => {
    const id = item.bank?.id || 'daily-quotes', body = JSON.stringify(item), url = id + '.json'; bodies.set('https://updates.test/' + url,body);
    return {id,type:item.bank ? 'quiz-bank' : 'quotes',version:item.bank?.version || item.version,url,sha256:createHash('sha256').update(body).digest('hex')};
  })};
  mutate(manifest,bodies); bodies.set('https://updates.test/manifest.json',JSON.stringify(manifest));
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({url,options}); if (!bodies.has(String(url))) throw new Error('Network unavailable'); return new Response(bodies.get(String(url))); };
  return requests;
}
beforeEach(async () => {
  await resources.waitForResourceWrites(); await storage.clear();
  globalThis.QICHENG_RESOURCE_SEEDS = {banks:resources.RESOURCE_BANK_IDS.map(id=>bank(id)),quotes:quotes()};
  globalThis.fetch = () => { throw new Error('Unexpected network'); };
  await resources.reloadResources();
});

test('schema validation rejects broken answers, duplicate stable IDs, mismatched sections and invalid versions', () => {
  for (const change of [b=>b.questions.push(b.questions[0]),b=>b.questions[0].answer='Z',b=>b.questions[0].options[1].id='A',b=>b.bank.subject='chinese',b=>b.bank.version='01.0.0',b=>b.schemaVersion=2,b=>b.questions[0].question='',b=>b.questions[0].type='essay',b=>delete b.questions[0].explanation]) {
    const input = bank(); change(input); assert.throws(() => resources.validateQuizBank(input));
  }
  const valid = bank(); valid.questions = [{id:'tf',type:'true-false',question:'Fixture',answer:false,explanation:''}];
  assert.equal(resources.validateQuizBank(valid).questions[0].answer,false);
  valid.questions[0].answer='false'; assert.throws(() => resources.validateQuizBank(valid));
  const q = {schemaVersion:1,version:'1.0.0',quotes:[{id:'same',text:'Fixture',source:''},{id:'same',text:'Fixture',source:''}]};
  assert.throws(() => resources.validateQuotes(q),/重复/);
});

test('semantic versions compare numerically including prerelease precedence', () => {
  const compare = resources.compareResourceVersions;
  assert.equal(compare('1.10.0','1.9.0'),1); assert.equal(compare('10.0.0','2.9.9'),1);
  assert.equal(compare('1.0.0-rc.10','1.0.0-rc.2'),1); assert.equal(compare('1.0.0-rc.1','1.0.0'),-1);
  assert.equal(compare('1.0.0+build2','1.0.0+build1'),0); assert.equal(compare('1.0.0-a-b','1.0.0-a-a'),1);
});

test('initialization fetches only bundled local resources and never requests a manifest', async () => {
  await storage.clear();
  delete globalThis.QICHENG_RESOURCE_SEEDS; const requested = [];
  globalThis.fetch = async url => { const target = new URL(url); requested.push(target.href); return new Response(await readFile(path.join(root,target.pathname.slice(1)))); };
  await resources.reloadResources();
  assert.equal(resources.listQuizBanks().length,4); assert.equal(requested.length,5);
  assert.ok(requested.every(url => url.startsWith('https://qicheng.test/data/resources/') && !url.includes('manifest')));
  assert.equal(Object.keys(await storage.getAll()).length,5);
  requested.length = 0; await resources.reloadResources(); assert.equal(requested.length,0);
});

test('installed resources take priority over newer application seeds without a startup update', async () => {
  globalThis.QICHENG_RESOURCE_SEEDS.banks[0].bank.version='99.0.0';
  globalThis.QICHENG_RESOURCE_SEEDS.quotes.version='99.0.0';
  await resources.reloadResources();
  assert.equal(resources.listQuizBanks()[0].bank.version,'1.0.0');
  assert.equal(resources.getQuotesResource().version,'1.0.0');
});

test('custom resources persist through an offline restart and cannot replace an official bank', async () => {
  await assert.rejects(resources.importResourceJSON(bank()),/官方/);
  const custom = bank('my-bank'); await resources.importResourceJSON(JSON.stringify(custom));
  const personalQuotes = {schemaVersion:1,version:'1.2.0',quotes:[{id:'quote-1',text:'Fixture only',source:'Test fixture'}]};
  await resources.importResourceJSON(personalQuotes); storage.close(); await resources.reloadResources();
  assert.equal(resources.listQuizBanks().find(item => item.bank.id === 'my-bank').origin,'custom');
  assert.deepEqual(resources.getQuotesResource(),{...personalQuotes,origin:'custom'});
});

test('reimport replaces the same custom bank while retaining stable learning keys, with rollback on failure', async () => {
  await resources.importResourceJSON(bank('my-bank'));
  await storage.set('quiz:fixture:my-bank:fixture-1',{wrong:true,favorite:true});
  const replacement = bank('my-bank','1.1.0'); replacement.questions[0].explanation='Updated fixture';
  await resources.importResourceJSON(replacement);
  assert.equal(resources.listQuizBanks().find(item=>item.bank.id==='my-bank').questions[0].explanation,'Updated fixture');
  assert.deepEqual(await storage.get('quiz:fixture:my-bank:fixture-1'),{wrong:true,favorite:true});
  const disk = await storage.getAll(), memory = resources.listQuizBanks();
  replacement.bank.version='1.2.0'; factory.failWrite=true;
  await assert.rejects(resources.importResourceJSON(replacement));
  assert.deepEqual(await storage.getAll(),disk); assert.deepEqual(resources.listQuizBanks(),memory);
  replacement.bank.section='vocabulary'; await assert.rejects(resources.importResourceJSON(replacement),/章节/);
  replacement.bank.section='grammar'; replacement.questions[0].answer='missing'; await assert.rejects(resources.importResourceJSON(replacement));
  assert.deepEqual(await storage.getAll(),disk);
});

test('backup resource validation checks origin, key consistency and official/custom collisions', () => {
  const custom = {...bank('my-bank'),origin:'custom'};
  assert.equal(resources.validateResourceRecords({'resource:custom:my-bank':custom})['resource:custom:my-bank'].bank.id,'my-bank');
  assert.throws(() => resources.validateResourceRecords({'resource:custom:wrong':custom}));
  assert.throws(() => resources.validateResourceRecords({'resource:custom:my-bank':{...custom,origin:'official'}}));
  assert.throws(() => resources.validateResourceRecords({'resource:official:english-grammar':{...bank(),origin:'official'}}));
  assert.throws(() => resources.validateResourceRecords({'resource:custom:english-grammar':{...bank(),origin:'custom'}}));
  assert.throws(() => resources.validateResourceRecords({'resource:official:new-bank':{...bank('new-bank'),origin:'official'},'resource:custom:new-bank':{...bank('new-bank'),origin:'custom'}},{allowOfficial:true}));
});

test('one corrupt checksum prevents the entire update, preserving disk, memory and learning history', async () => {
  await storage.set('quiz:history',{answers:[false]}); const disk = await storage.getAll(), memory = resources.listQuizBanks();
  remote([bank('english-grammar','1.1.0'),quotes('1.1.0')],manifest => { manifest.resources[1].sha256='0'.repeat(64); });
  await assert.rejects(resources.updateResources('https://updates.test/manifest.json'),/SHA-256/);
  assert.deepEqual(await storage.getAll(),disk); assert.deepEqual(resources.listQuizBanks(),memory); assert.equal(resources.getQuotesResource().version,'1.0.0');
});

test('a correctly hashed but invalid schema or inconsistent version cannot update', async () => {
  const malformed = bank('english-grammar','1.1.0'); malformed.questions[0].answer='Z'; remote([malformed]);
  await assert.rejects(resources.updateResources('https://updates.test/manifest.json'),/正确答案/);
  remote([bank('english-grammar','1.1.0')],manifest=>{manifest.resources[0].version='1.2.0';});
  await assert.rejects(resources.updateResources('https://updates.test/manifest.json'),/版本/);
  assert.equal(resources.listQuizBanks()[0].bank.version,'1.0.0'); assert.equal(Object.keys(await storage.getAll()).length,5);
});

test('database failure after the first put rolls all resources back without publishing memory', async () => {
  await storage.set('learning-state',{keep:true}); const before = await storage.getAll();
  remote([bank('english-grammar','1.1.0'),quotes('1.1.0')]); factory.failAfter=2;
  await assert.rejects(resources.updateResources('https://updates.test/manifest.json'));
  assert.deepEqual(await storage.getAll(),before); assert.equal(resources.listQuizBanks()[0].bank.version,'1.0.0'); assert.equal(resources.getQuotesResource().version,'1.0.0');
});

test('manual update commits all verified resources and retains them after offline restart', async () => {
  await storage.set('learning-state',{keep:true}); const requests = remote([bank('english-grammar','1.10.0'),quotes('1.1.0')]);
  const result = await resources.updateResources('https://updates.test/manifest.json');
  assert.deepEqual(result.updated,['english-grammar','daily-quotes']); assert.ok(requests.every(item=>item.options.cache==='no-store' && item.options.redirect==='error'));
  assert.deepEqual(await storage.get('learning-state'),{keep:true});
  globalThis.fetch = () => { throw new Error('Offline'); }; await resources.reloadResources();
  assert.equal(resources.listQuizBanks()[0].bank.version,'1.10.0'); assert.equal(resources.getQuotesResource().version,'1.1.0');
  remote([bank('english-grammar','1.9.0')]); assert.deepEqual((await resources.updateResources('https://updates.test/manifest.json')).updated,[]);
});

test('unsafe manifests and custom ID collisions fail before resource downloads', async () => {
  await assert.rejects(resources.updateResources('javascript:alert(1)'),/HTTPS/);
  await assert.rejects(resources.updateResources('http://updates.test/manifest.json'),/HTTPS/);
  await resources.importResourceJSON(bank('custom-id'));
  const requests = remote([bank('custom-id','2.0.0')]); await assert.rejects(resources.updateResources('https://updates.test/manifest.json'),/冲突/); assert.equal(requests.length,1);
});

test('simultaneous imports are serialized and failed queued work does not poison future writes', async () => {
  const results = await Promise.allSettled([resources.importResourceJSON(bank()),resources.importResourceJSON(bank('same-custom'))]);
  assert.equal(results.filter(item=>item.status==='fulfilled').length,1);
  await resources.importResourceJSON(bank('another-custom')); await resources.waitForResourceWrites();
  assert.equal(resources.listQuizBanks().filter(item=>item.origin==='custom').length,2);
});
