import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {storage}=await import('../js/storage.js');
const r=await import('../js/resources.js');
const {tasks}=await import('../js/tasks.js');
function pack521(id='permanent-pack',count=3){return {schemaVersion:1,bank:{id,name:'长期题库',subject:'english',section:'grammar',version:'1.0.0'},questions:Array.from({length:count},(_,index)=>({id:'permanent-'+index,type:'single-choice',question:'题目 '+index,options:[{id:'A',text:'甲'},{id:'B',text:'乙'}],answer:'A',explanation:'原解析 '+index,source:'原始来源'}))};}
beforeEach(async()=>{await r.waitForResourceWrites().catch(()=>{});env.factory.failWrite=false;await storage.clear();await r.reloadResources();});

test('home initialization does not read bank or question prefixes; metadata loading defers question rows',async()=>{
  const original=storage.getPrefix,reads=[];storage.getPrefix=(prefix)=>{reads.push(prefix);return original(prefix);};
  try{await r.initializeHomeResources();assert.ok(reads.every(prefix=>!prefix.includes('bank:')&&prefix!=='resource:'));reads.length=0;
    await r.reloadResources({metadataOnly:true});assert.ok(!reads.some(prefix=>prefix.startsWith('@521:bank:q:')));
    assert.ok(r.listPracticeBankSummaries()[0].questionCount>0);assert.equal(r.listQuizBanks()[0].questions.length,0);
    await r.loadPracticeBank('english-grammar');assert.ok(reads.some(prefix=>prefix==='@521:bank:q:official:english-grammar/'));assert.ok(r.getPracticeBank('english-grammar').questions.length>0);
    assert.equal(r.listQuizBanks().find(item=>item.bank.id==='english-vocabulary').questions.length,0);
  }finally{storage.getPrefix=original;}
});

test('same bank reimport writes nothing; single-field patch writes only its question and bank revision',async()=>{
  await r.importResourceJSON(pack521());
  const original=storage.setMany,writes=[];storage.setMany=(records,remove,options)=>{writes.push({keys:Object.keys(records),remove});return original(records,remove,options);};
  try{
    const same=await r.prepareResourceImport(pack521());assert.deepEqual(same.summary,{added:0,changed:0,unchanged:3,removed:0,answerChanged:0,duplicateContent:0,total:3});await r.applyPreparedResourceImport(same);assert.equal(writes.length,0);
    const plan=await r.prepareResourceImport({schemaVersion:1,patch:{bankId:'permanent-pack',questions:[{id:'permanent-1',set:{explanation:'仅修改解析'}}]}});
    assert.equal(plan.summary.changed,1);assert.equal(plan.summary.unchanged,2);const result=await r.applyPreparedResourceImport(plan);
    assert.equal(writes.length,1);assert.deepEqual(writes[0].keys.sort(),['@521:bank:meta:custom:permanent-pack','@521:bank:q:custom:permanent-pack/permanent-1','question:edit:custom:permanent-pack/permanent-1']);
    assert.deepEqual(result.questions[1],{...pack521().questions[1],explanation:'仅修改解析'});
  }finally{storage.setMany=original;}
});

test('preflight detects answer changes, removed IDs and duplicate content without touching learning data',async()=>{
  await r.importResourceJSON(pack521());await storage.set('quiz:mark:permanent-pack/permanent-0',{bankId:'permanent-pack',questionId:'permanent-0',wrong:true,favorite:true});
  const changed=pack521();changed.questions[0].answer='B';changed.questions[1]={...changed.questions[0],id:'permanent-1'};changed.questions.pop();
  const before=await storage.getAll(),plan=await r.prepareResourceImport(changed);
  assert.equal(plan.summary.answerChanged,2);assert.equal(plan.summary.removed,1);assert.equal(plan.summary.duplicateContent,1);assert.deepEqual(await storage.getAll(),before);
  await r.applyPreparedResourceImport(plan);assert.deepEqual(await storage.get('quiz:mark:permanent-pack/permanent-0'),before['quiz:mark:permanent-pack/permanent-0']);
});

test('malformed patch, wrong base version and unknown fields leave every original record intact',async()=>{
  await r.importResourceJSON(pack521());const before=await storage.getAll();
  for(const patch of [
    {bankId:'permanent-pack',questions:[{id:'missing',set:{explanation:'x'}}]},
    {bankId:'permanent-pack',baseVersion:'9.0.0',questions:[]},
    {bankId:'permanent-pack',questions:[{id:'permanent-0',set:{id:'changed'}}]},
    {bankId:'permanent-pack',questions:[{id:'permanent-0',set:{answer:'Z'}}]},
    {bankId:'permanent-pack',questions:[{id:'permanent-0',set:{explanation:'x'}},{id:'permanent-0',set:{explanation:'y'}}]},
    {bankId:'permanent-pack',questions:[],deleteIds:['permanent-0','permanent-0']}
  ])await assert.rejects(r.prepareResourceImport({schemaVersion:1,patch}));
  assert.deepEqual(await storage.getAll(),before);
  assert.ok(tasks.snapshot().some(task=>task.status==='failed'));
});

test('a transaction failure never publishes patched memory or success',async()=>{
  await r.importResourceJSON(pack521());const before=await storage.getAll(),memory=r.listQuizBanks();
  const plan=await r.prepareResourceImport({schemaVersion:1,patch:{bankId:'permanent-pack',questions:[{id:'permanent-0',set:{explanation:'不得写入'}}],deleteIds:['permanent-2']}});
  env.factory.failAfter=2;await assert.rejects(r.applyPreparedResourceImport(plan));
  assert.deepEqual(await storage.getAll(),before);assert.deepEqual(r.listQuizBanks(),memory);
  assert.equal(tasks.snapshot().at(-1).status,'failed');
});

test('large imports report measured validated counts and export all original bank questions',async()=>{
  const plan=await r.prepareResourceImport(pack521('large-pack',5000));assert.equal(plan.summary.total,5000);assert.equal(plan.summary.added,5000);
  await r.applyPreparedResourceImport(plan);const all=await r.exportBankRecords();
  assert.equal(all['resource:custom:large-pack'].questions.length,5000);assert.deepEqual(all['resource:custom:large-pack'].questions[4999],pack521('large-pack',5000).questions[4999]);
  assert.ok(all['resource:official:english-grammar'].questions.length>0);
  await r.reloadResources({metadataOnly:true});assert.equal(r.listImportedQuizPackSummaries().find(item=>item.bank.id==='large-pack').questionCount,5000);
});

test('a prepared plan cannot silently overwrite a newer bank revision',async()=>{
  await r.importResourceJSON(pack521());
  const stale=await r.prepareResourceImport({schemaVersion:1,patch:{bankId:'permanent-pack',questions:[{id:'permanent-0',set:{explanation:'旧计划'}}]}});
  const fresh=await r.prepareResourceImport({schemaVersion:1,patch:{bankId:'permanent-pack',questions:[{id:'permanent-1',set:{explanation:'新计划'}}]}});
  await r.applyPreparedResourceImport(fresh);
  await assert.rejects(r.applyPreparedResourceImport(stale),/其他|修改|冲突/);
  const saved=(await r.exportBankRecords())['resource:custom:permanent-pack'];assert.equal(saved.questions[0].explanation,'原解析 0');assert.equal(saved.questions[1].explanation,'新计划');
});

test('a ten-question UI sample reads exactly ten question rows from a 5000-question bank',async()=>{
  await r.importResourceJSON(pack521('sample-pack',5000));await r.reloadResources({metadataOnly:true});
  const originalGet=storage.get,originalPrefix=storage.getPrefix,questionReads=[],prefixReads=[];
  storage.get=(key)=>{if(key.startsWith('@521:bank:q:'))questionReads.push(key);return originalGet(key);};
  storage.getPrefix=(prefix)=>{prefixReads.push(prefix);return originalPrefix(prefix);};
  try{
    const sample=await r.loadPracticeSample('english-grammar',{size:10,random:()=>0.9});
    assert.equal(sample.questions.length,10);assert.equal(new Set(sample.questions.map(q=>q.id)).size,10);assert.equal(questionReads.length,10);
    assert.ok(!prefixReads.some(prefix=>prefix.startsWith('@521:bank:q:')));assert.ok(r.listQuizBanks().every(item=>item.questions.length===0));
  }finally{storage.get=originalGet;storage.getPrefix=originalPrefix;}
});
