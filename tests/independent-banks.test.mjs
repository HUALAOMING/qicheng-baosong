import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();const {storage}=await import('../js/storage.js');const r=await import('../js/resources.js');const q=await import('../js/modules/quiz.js');const backup=await import('../js/backup.js');const {ctx}=await import('../js/state.js');const {fresh}=await import('../js/model.js');const saving=await import('../js/autosave.js');const dashboard=await import('../js/modules/dashboard.js');
await(await import('../js/data.js')).loadBuiltinData();
const pack=(id='math-pack')=>({schemaVersion:1,bank:{id,name:'数学资源包',subject:'mathematics',section:'algebra',version:'1.0.0'},questions:[{id:'Q1',type:'true-false',question:'Fixture',answer:true,explanation:'Fixture explanation'}]});
beforeEach(async()=>{env.factory.failWrite=false;await q.waitForQuizWrites().catch(()=>{});await r.waitForResourceWrites().catch(()=>{});await storage.clear();ctx.state=fresh();saving.initializeSaving301();await r.reloadResources();await q.initializeQuiz();});
test('a name alone creates a peer bank outside the four defaults; old category-based banks also display as peers',async()=>{
 const own=await r.createPracticeBank({name:'数学'});assert.equal(own.subject,'custom');assert.equal(own.section,'custom');const old=await r.createPracticeBank({name:'旧题库',subject:'english',section:'grammar'});
 const html=q.quizPage();assert.equal((html.match(/data-quiz-bank=/g)||[]).length,6);assert.doesNotMatch(html,/class="quiz-section"|quiz-custom-library/);assert.match(html,/数学/);assert.match(html,/旧题库/);assert.equal(r.listPracticeBanks().find(b=>b.bank.id===old.id).bank.section,'grammar');
});
test('a new bank and a question resource pack import atomically, with arbitrary subject metadata',async()=>{
 await r.importResourceJSON(pack(),{newBankName:'独立数学大题库'});const bank=r.listPracticeBanks().find(b=>b.bank.name==='独立数学大题库');assert.ok(bank);assert.equal(bank.questions.length,1);assert.equal(r.listImportedQuizPacks()[0].targetBankId,bank.bank.id);
 const session=q.quizStart(bank.bank.id,'random',10);q.quizAnswer(0,false);await q.quizFavorite(bank.bank.id,session.questions[0].id);const result=await q.quizSubmit();assert.equal(result.section,'custom');assert.equal(q.getQuizDashboard('bank:'+bank.bank.id).total,1);assert.equal(q.getQuizDashboard('grammar').total,0);
 const file=await backup.getCurrentBackup();await backup.commitBackup(file);assert.equal(r.listPracticeBanks().find(b=>b.bank.id===bank.bank.id).questions.length,1);assert.equal(q.getQuizDashboard('bank:'+bank.bank.id).favorites,1);
});
test('moving a pack keeps IDs, wrong/favorite marks and historical results; several packs may share a bank',async()=>{
 const first=await r.createPracticeBank({name:'甲'}),second=await r.createPracticeBank({name:'乙'});await r.importResourceJSON(pack(),{targetBankId:first.id});const session=q.quizStart(first.id,'random',1);q.quizAnswer(0,false);await q.quizFavorite(first.id,session.questions[0].id);const result=await q.quizSubmit();
 const source=await storage.get('resource:custom:math-pack');await r.moveImportedQuizPack('math-pack',second.id);assert.deepEqual(await storage.get('resource:custom:math-pack'),source);assert.ok(await storage.get('quiz:record:'+result.id));assert.equal(r.listPracticeBanks().find(b=>b.bank.id===first.id).questions.length,0);
 assert.equal(q.quizStart(second.id,'wrong',10).questions.length,1);assert.equal(q.quizStart(second.id,'favorites',10).questions.length,1);await r.importResourceJSON(pack('second-pack'),{targetBankId:second.id});assert.equal(r.listPracticeBanks().find(b=>b.bank.id===second.id).questions.length,2);assert.equal(r.listPracticeBanks().length,6);
 await r.deleteImportedQuizPack('math-pack');assert.equal(r.listPracticeBanks().find(b=>b.bank.id===second.id).questions.length,1);assert.ok(await storage.get(q.quizMarkKey('math-pack','Q1')));
});
test('a failed create-from-pack leaves no empty bank and no imported pack; failed moves preserve the original assignment',async()=>{
 const before=await storage.getAll();env.factory.failAfter=2;await assert.rejects(r.importResourceJSON(pack(),{newBankName:'不得残留'}));assert.deepEqual(await storage.getAll(),before);assert.equal(r.listPracticeBanks().length,4);
 const first=await r.createPracticeBank({name:'原题库'}),second=await r.createPracticeBank({name:'目标题库'});await r.importResourceJSON(pack(),{targetBankId:first.id});const saved=await storage.getAll();env.factory.failWrite=true;await assert.rejects(r.moveImportedQuizPack('math-pack',second.id));assert.deepEqual(await storage.getAll(),saved);assert.equal(r.listImportedQuizPacks()[0].targetBankId,first.id);env.factory.failWrite=false;
 const original=storage.set;let writes=0;storage.set=(...args)=>{writes++;return original(...args);};try{assert.equal(await r.moveImportedQuizPack('math-pack',first.id),false);assert.equal(writes,0);}finally{storage.set=original;}
});
test('custom bank names are escaped in the unified practice dashboard results',async()=>{
 const bank=await r.createPracticeBank({name:'<img src=x onerror=alert(1)>'});await r.importResourceJSON(pack(),{targetBankId:bank.id});const session=q.quizStart(bank.id,'random',1);q.quizAnswer(0,true);await q.quizSubmit();const learning=await(await import('../js/features53.js')).loadFeature53('learning');await learning.prepareLearning53('practice-dashboard');const html=dashboard.practiceDashboardPage();assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
});
