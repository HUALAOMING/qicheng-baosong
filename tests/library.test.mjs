import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {storage}=await import('../js/storage.js');
const r=await import('../js/resources.js');
const quiz=await import('../js/modules/quiz.js');
const backup=await import('../js/backup.js');
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {initializeSaving301}=await import('../js/autosave.js');
await (await import('../js/data.js')).loadBuiltinData();
const pack=(id='pack-one',question='Question')=>({schemaVersion:1,bank:{id,name:'题目包 '+id,subject:'english',section:'grammar',version:'1.0.0'},questions:[{id:'Q1',type:'true-false',question,answer:false,explanation:'Private answer'}]});
beforeEach(async()=>{
  await quiz.waitForQuizWrites();await r.waitForResourceWrites();env.factory.failWrite=false;await storage.clear();
  ctx.state=fresh();ctx.state.onboarded=true;initializeSaving301();await r.reloadResources();await quiz.initializeQuiz();
});
test('old imported packs join the default four without migration writes and preserve old learning keys',async()=>{
  await storage.set('resource:custom:legacy',{...pack('legacy'),origin:'custom'});
  const key=quiz.quizMarkKey('legacy','Q1');await storage.set(key,{bankId:'legacy',questionId:'Q1',wrong:true,favorite:true});
  const before=await storage.getAll();await r.reloadResources();await quiz.initializeQuiz();assert.deepEqual(await storage.getAll(),before);
  assert.equal(r.listPracticeBanks().length,4);assert.equal(r.listPracticeBanks()[0].questions.length,119);
  const session=quiz.quizStart('english-grammar','wrong',10);assert.equal(session.questions.length,1);assert.equal(session.questions[0].learningBankId,'legacy');
  assert.doesNotMatch(quiz.quizPage(),/Private answer/);quiz.quizAnswer(0,false);await quiz.quizSubmit();
  assert.deepEqual(await storage.get(key),{bankId:'legacy',questionId:'Q1',wrong:false,favorite:true,reviewPending:true,mastered:false});
  assert.equal(quiz.quizStart('english-grammar','favorites',10).questions.length,1);
});
test('multiple JSON packs with the same question ID merge safely into one chosen bank',async()=>{
  await r.importResourceJSON(pack('one'),{targetBankId:'chinese-usage'});await r.importResourceJSON(pack('two'),{targetBankId:'chinese-usage'});
  assert.equal(r.listPracticeBanks().length,4);const bank=r.listPracticeBanks().find(item=>item.bank.id==='chinese-usage');
  assert.equal(bank.questions.length,2);assert.equal(new Set(bank.questions.map(q=>q.id)).size,2);
  const session=quiz.quizStart('chinese-usage','random',20);session.questions.forEach((q,i)=>quiz.quizAnswer(i,true));await quiz.quizSubmit();
  for(const id of ['one','two'])assert.equal((await storage.get(quiz.quizMarkKey(id,'Q1'))).wrong,true);
});
test('users create named banks; empty banks, assignments and imported packs survive a complete backup restore',async()=>{
  const bank=await r.createPracticeBank({name:'  我的专项练习  ',subject:'chinese',section:'ancient-culture'});
  assert.equal(bank.name,'我的专项练习');assert.equal(r.listPracticeBanks().length,5);
  assert.throws(()=>quiz.quizStart(bank.id),/暂未/);await r.importResourceJSON(pack(),{targetBankId:bank.id});
  const file=await backup.getCurrentBackup();assert.ok(file.data[r.QUIZ_LIBRARY_KEY]);assert.ok(file.data['resource:custom:pack-one']);
  await r.deletePracticeBank(bank.id);await backup.commitBackup(file);
  assert.equal(r.listPracticeBanks().find(item=>item.bank.id===bank.id).questions.length,1);
  const before=await storage.getAll(),invalid=structuredClone(file);invalid.data[r.QUIZ_LIBRARY_KEY].assignments['pack-one']='missing';invalid.integrity.digest=await backup.backupDigest521(invalid);
  await assert.rejects(backup.commitBackup(invalid),/目标题库/);assert.deepEqual(await storage.getAll(),before);
});
test('a local JSON with an official ID imports as a personal pack without overwriting official content',async()=>{
  const before=await storage.get('resource:official:english-grammar');
  await r.importResourceJSON(pack('english-grammar'),{targetBankId:'chinese-usage'});
  assert.deepEqual(await storage.get('resource:official:english-grammar'),before);
  assert.equal(r.listPracticeBanks().find(b=>b.bank.id==='chinese-usage').questions.length,1);
  assert.ok((await backup.getCurrentBackup()).data['resource:custom:local-pack-english-grammar']);
});
test('reimport updates a pack and can move it without duplicating practice entries or losing favorites',async()=>{
  const first=await r.createPracticeBank({name:'First',subject:'english',section:'grammar'}),second=await r.createPracticeBank({name:'Second',subject:'english',section:'vocabulary'});
  await r.importResourceJSON(pack(),{targetBankId:first.id});const q=r.listPracticeBanks().find(b=>b.bank.id===first.id).questions[0];await quiz.quizFavorite(first.id,q.id);
  const next=pack();next.bank.version='1.1.0';next.questions[0].question='Revised';await r.importResourceJSON(next,{targetBankId:second.id});
  assert.equal(r.listPracticeBanks().find(b=>b.bank.id===first.id).questions.length,0);assert.equal(r.listPracticeBanks().find(b=>b.bank.id===second.id).questions.length,1);
  const session=quiz.quizStart(second.id,'favorites',10);assert.equal(session.questions[0].question,'Revised');assert.equal(r.listPracticeBanks().length,6);
});
test('deleting packs and custom banks preserves other packs, default banks and learning history',async()=>{
  const custom=await r.createPracticeBank({name:'Practice',subject:'english',section:'grammar'});
  await r.importResourceJSON(pack('one'),{targetBankId:custom.id});await r.importResourceJSON(pack('two'),{targetBankId:custom.id});await r.importResourceJSON(pack('keep'),{targetBankId:'chinese-usage'});
  const session=quiz.quizStart(custom.id,'random',20);session.questions.forEach((q,i)=>quiz.quizAnswer(i,true));await quiz.quizSubmit();const result=quiz.getRecentQuiz();
  await r.deleteImportedQuizPack('one');assert.equal(r.listPracticeBanks().find(b=>b.bank.id===custom.id).questions.length,1);
  assert.ok(await storage.get(quiz.quizMarkKey('one','Q1')));assert.ok(await storage.get('quiz:record:'+result.id));
  await r.deletePracticeBank(custom.id);assert.equal(r.listPracticeBanks().length,4);assert.equal(r.listImportedQuizPacks().length,1);assert.equal(r.listImportedQuizPacks()[0].bank.id,'keep');
  await assert.rejects(r.deletePracticeBank('english-grammar'),/默认题库/);
});
test('database failures preserve both the old directory and all packs in memory and on disk',async()=>{
  await r.importResourceJSON(pack(),{targetBankId:'chinese-usage'});const before=await storage.getAll(),memory=r.listPracticeBanks();
  for(const operation of [()=>r.importResourceJSON(pack('other'),{targetBankId:'chinese-usage'}),()=>r.deleteImportedQuizPack('pack-one'),()=>r.createPracticeBank({name:'New',subject:'english',section:'grammar'})]){
    env.factory.failWrite=true;await assert.rejects(operation());assert.deepEqual(await storage.getAll(),before);assert.deepEqual(r.listPracticeBanks(),memory);
  }
  env.factory.failWrite=false;await assert.rejects(r.importResourceJSON(pack('other'),{targetBankId:'missing'}),/选择/);assert.deepEqual(await storage.getAll(),before);
});
test('offline reload retains the directory and imported content without requests or extra user-state saves',async()=>{
  const bank=await r.createPracticeBank({name:'Offline',subject:'english',section:'grammar'});await r.importResourceJSON(pack(),{targetBankId:bank.id});const before=await storage.getAll();
  const fetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Offline');};try{storage.close();await r.reloadResources();assert.equal(r.listPracticeBanks().find(b=>b.bank.id===bank.id).questions.length,1);assert.deepEqual(await storage.getAll(),before);}finally{globalThis.fetch=fetch;}
});
test('valid IDs that match object property names keep their own assignments and learning identities',async()=>{
  await r.importResourceJSON(pack('constructor'));assert.equal(r.listImportedQuizPacks()[0].targetBankId,'english-grammar');
  const bank=await r.createPracticeBank({name:'IDs',subject:'english',section:'grammar'});await r.importResourceJSON(pack('constructor'),{targetBankId:bank.id});
  assert.equal(r.listPracticeBanks().find(item=>item.bank.id===bank.id).questions[0].learningBankId,'constructor');await r.reloadResources();assert.equal(r.listImportedQuizPacks()[0].targetBankId,bank.id);
});
