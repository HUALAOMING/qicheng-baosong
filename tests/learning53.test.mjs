import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {storage}=await import('../js/storage.js');
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const data=await import('../js/data.js');await data.loadBuiltinData();ctx.state=fresh();
const r=await import('../js/resources.js'),quiz=await import('../js/modules/quiz.js'),learn=await import('../js/learning53.js');
await r.initializeResources();
const pack={schemaVersion:1,bank:{id:'learning53-pack',name:'学习53测试',subject:'custom',section:'custom',version:'1.0.0'},questions:[{id:'one',type:'true-false',question:'关键字判断题',answer:true,explanation:'SECRET_EXPLANATION',category:'语法',tags:['测试']},{id:'two',type:'single-choice',question:'第二题',options:[{id:'A',text:'正确选择'},{id:'B',text:'另一个选择'}],answer:'A',explanation:'第二题解析'}]};
await r.importResourceJSON(pack,{newBankName:'学习中心53'});
const target=r.listImportedQuizPackSummaries().find(p=>p.bank.id===pack.bank.id).targetBankId;

test('category/tags roundtrip and atomic incoming conflict resolution preserve notes',async()=>{
 const row=await r.readQuestion(pack.bank.id,'one');assert.equal(row.question.category,'语法');assert.deepEqual(row.question.tags,['测试']);
 await r.updateQuestion(pack.bank.id,'one',{explanation:'本地解析'},{expectedRevision:row.revision});const state=await r.getQuestionLearning(pack.bank.id,'one');await r.saveQuestionNote(pack.bank.id,'one','PRIVATE_NOTE',{expectedRevision:state.noteRevision});
 const incoming=structuredClone(pack);incoming.questions[0].explanation='上游新解析';await assert.rejects(r.prepareResourceImport(incoming),e=>e.code==='QUESTION_UPDATE_CONFLICT');
 const plan=await r.prepareResourceImport(incoming,{resolveLocalConflicts:'incoming'}),before=await storage.getAll();env.factory.failAfter=3;await assert.rejects(r.applyPreparedResourceImport(plan));assert.deepEqual(await storage.getAll(),before);
 const retry=await r.prepareResourceImport(incoming,{resolveLocalConflicts:'incoming'});await r.applyPreparedResourceImport(retry);assert.equal((await r.readQuestion(pack.bank.id,'one')).question.explanation,'上游新解析');assert.equal((await r.getQuestionLearning(pack.bank.id,'one')).note.text,'PRIVATE_NOTE');
});
test('unsubmitted group blocks question detail, search snippets and notes across shared identity',async()=>{
 await quiz.initializeQuiz();const sample=await r.loadPracticeSample(target,{size:2});quiz.quizStart(target,'random',2,()=>0,{sampleResource521:sample});await quiz.waitForQuizWrites();
 assert.equal(await learn.isQuestionProtected53(pack.bank.id,'one'),true);await learn.prepareLearning53(learn.questionRoute53(pack.bank.id,'one'));const html=learn.learningPage53(learn.questionRoute53(pack.bank.id,'one'));assert.match(html,/先完成正在进行的练习/);assert.doesNotMatch(html,/PRIVATE_NOTE|上游新解析|正确答案/);
 assert.equal((await learn.searchLearning53('PRIVATE_NOTE')).length,0);assert.equal((await learn.searchLearning53('关键字')).length,0);
});
test('submission deduplicates wrongs, timestamps errors and keeps mastery independent of favorite',async()=>{
 const draft=quiz.getQuizDraftRecord();draft.questions.forEach((q,i)=>quiz.quizAnswer(i,q.type==='true-false'?!q.answer:'B'));await quiz.quizSubmit();
 const key=quiz.quizMarkKey(pack.bank.id,'one'),mark=await storage.get(key);assert.equal(mark.reviewPending,true);assert.equal(mark.mastered,false);assert.ok(Number.isFinite(Date.parse(mark.lastWrongAt)));
 await learn.setMastery53(pack.bank.id,'one',true);assert.equal((await storage.get(key)).reviewPending,false);assert.equal((await storage.get(key)).mastered,true);
 const sample=await r.loadPracticeSample(target,{size:2});quiz.quizStart(target,'random',2,()=>0,{sampleResource521:sample});const current=quiz.getQuizDraftRecord();current.questions.forEach((q,i)=>quiz.quizAnswer(i,q.type==='true-false'?!q.answer:'B'));await quiz.quizSubmit();assert.equal((await storage.get(key)).mastered,false);assert.equal((await storage.get(key)).reviewPending,true);
 const all=await storage.getPrefix('quiz:mark:');assert.equal(Object.keys(all).filter(k=>k===key).length,1);assert.ok(await storage.get('settings:learning-overview53'));
});
test('folders are many-to-many, rename without changing identity and backup validators reject corrupt membership',async()=>{
 const first=await learn.saveFolder53('语法'),second=await learn.saveFolder53('复习');await learn.setFolderQuestion53(first.id,pack.bank.id,'one',true);await learn.setFolderQuestion53(first.id,pack.bank.id,'one',true);await learn.setFolderQuestion53(second.id,pack.bank.id,'one',true);await learn.saveFolder53('语法改名',first.id);
 const saved=await storage.get('learning:folder:'+first.id);assert.equal(saved.questions.length,1);assert.equal(saved.name,'语法改名');assert.equal((await storage.get('learning:folder:'+second.id)).questions.length,1);
 assert.throws(()=>quiz.validateQuizRecords({['learning:folder:'+first.id]:{...saved,questions:[...saved.questions,...saved.questions]}}),/收藏夹记录无效/);
 const backup=await import('../js/backup.js'),archive=await backup.getCurrentBackup();assert.ok(archive.data['learning:folder:'+first.id]);await storage.clear();await backup.commitBackup(archive);learn.resetLearning53();assert.equal((await storage.get('learning:folder:'+first.id)).name,'语法改名');assert.equal((await r.getQuestionLearning(pack.bank.id,'one')).note.text,'PRIVATE_NOTE');
});
test('statistics distinguish repeated attempts, unique source identities and time range',()=>{
 const q={id:'local',learningBankId:'source',learningQuestionId:'stable',type:'true-false',answer:true,question:'Q',explanation:''};const make=(id,date,correct)=>({id,submittedAt:date,total:1,correct,bankId:'display',section:'custom',questions:[q],answers:[!!correct]});const history=[make('a','2026-10-29T10:00:00+08:00',1),make('b','2026-10-28T10:00:00+08:00',0),make('c','2026-09-01T10:00:00+08:00',1)];
 const week=learn.calculateLearningStats53(history,[{wrong:true,favorite:true}],7,new Date('2026-10-29T12:00:00+08:00'));assert.equal(week.groups,2);assert.equal(week.attempts,2);assert.equal(week.distinct,1);assert.equal(week.accuracy,.5);assert.equal(week.pendingWrong,1);assert.equal(week.favorites,1);assert.equal(learn.calculateLearningStats53(history,[],0).attempts,3);
});
