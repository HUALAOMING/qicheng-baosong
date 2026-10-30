import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {storage}=await import('../js/storage.js'),{ctx}=await import('../js/state.js'),{fresh}=await import('../js/model.js');
await(await import('../js/data.js')).loadBuiltinData();ctx.state=fresh();
const r=await import('../js/resources.js'),learn=await import('../js/learning53.js');await r.initializeResources({metadataOnly:true});
const pack=(id,n=35)=>({schemaVersion:1,bank:{id,name:id,subject:'custom',section:'custom',version:'1.0.0'},questions:Array.from({length:n},(_,i)=>({id:'shared-'+i,type:'single-choice',question:'中文关键字 '+id+' '+i,options:[{id:'A',text:'选项检索'},{id:'B',text:'备用'}],answer:'A',explanation:'解析检索',category:i<20?'前二十':'其他'}))});
let bank;
test('existing subjects and new named subjects persist and use valid container metadata',async()=>{
 bank=await r.createPracticeBank({name:'英语专题',subject:'english'});assert.equal(bank.subject,'english');assert.equal(bank.section,'grammar');
 const math=await r.createPracticeBank({name:'数学真题',subject:'new',subjectName:'数学'});assert.match(math.subject,/^subject-/);assert.equal(r.listPracticeSubjects().find(s=>s.id===math.subject).name,'数学');
 const second=await r.createPracticeBank({name:'数学错题',subject:'new',subjectName:'数学'});assert.equal(second.subject,math.subject);
 await r.reloadResources({metadataOnly:true});assert.equal(r.listPracticeSubjects().find(s=>s.id===math.subject).name,'数学');
 await assert.rejects(r.createPracticeBank({name:'无效',subject:'new',subjectName:''}),/科目名称/);
});
test('a bank aggregates later imports, accurately pages and searches every contained pack without ID collisions',async()=>{
 await r.importResourceJSON(pack('first-531'),{targetBankId:bank.id});await r.importResourceJSON(pack('second-531'),{targetBankId:bank.id});
 const before=await storage.getAll();await r.reloadResources({metadataOnly:true});assert.deepEqual(await storage.getAll(),before,'metadata reload keeps existing 5.3 data unchanged');
 const pages=await Promise.all([0,30,60].map(offset=>r.queryPracticeQuestions(bank.id,{offset})));assert.deepEqual(pages.map(p=>p.items.length),[30,30,10]);assert.deepEqual(pages.map(p=>p.total),[70,70,70]);assert.deepEqual(pages.map(p=>p.nextOffset),[30,60,null]);
 assert.equal(new Set(pages.flatMap(p=>p.items).map(q=>JSON.stringify([q.sourceBankId,q.id]))).size,70);
 for(const keyword of ['中文关键字','选项检索','解析检索'])assert.equal((await r.queryPracticeQuestions(bank.id,{keyword})).total,70);
 const filtered=await r.queryPracticeQuestions(bank.id,{keyword:'解析检索',category:'前二十',offset:30});assert.equal(filtered.total,40);assert.equal(filtered.items.length,10);assert.equal(filtered.nextOffset,null);
 await learn.prepareLearning53('question-bank');const html=learn.learningPage53('question-bank');assert.doesNotMatch(html,/>来源题包</);assert.match(html,/id="bankSource53"/);
});
test('editing and deleting identical question IDs touches only the selected source and preserves notes',async()=>{
 const first=await r.readQuestion('first-531','shared-0');await r.updateQuestion('first-531','shared-0',{question:'只修改第一包'},{expectedRevision:first.revision});
 assert.equal((await r.readQuestion('first-531','shared-0')).question.question,'只修改第一包');assert.match((await r.readQuestion('second-531','shared-0')).question.question,/second-531/);
 const note=await r.getQuestionLearning('first-531','shared-0');await r.saveQuestionNote('first-531','shared-0','仍需保留',{expectedRevision:note.noteRevision});
 const updated=await r.readQuestion('first-531','shared-0');await r.deleteQuestion('first-531','shared-0',{expectedRevision:updated.revision});
 assert.equal((await r.queryPracticeQuestions(bank.id)).total,69);assert.ok((await r.readQuestion('second-531','shared-0')).question);assert.equal((await r.getQuestionLearning('first-531','shared-0')).note.text,'仍需保留');
});
test('practice restricts packs to the chosen bank, includes built-ins and supports whole-bank selection',async()=>{
 const all=await r.loadPracticeSample(bank.id,{size:200});assert.equal(all.questions.length,69);assert.equal(new Set(all.questions.map(q=>q.id)).size,69);
 const one=await r.loadPracticeSample(bank.id,{size:200,sourceBankId:'second-531'});assert.equal(one.questions.length,35);assert.ok(one.questions.every(q=>q.learningBankId==='second-531'));
 await assert.rejects(r.loadPracticeSample('english-grammar',{sourceBankId:'second-531'}),/不属于/);
 const original=await r.loadPracticeSample('english-grammar',{size:3,sourceBankId:'english-grammar'});assert.equal(original.questions.length,3);assert.ok(original.questions.every(q=>!q.learningBankId));
});
test('whole-bank JSON contains all packs with safe unique IDs and can be imported into another bank',async()=>{
 const exported=await r.exportPracticeQuestionBank(bank.id);assert.equal(exported.questions.length,69);r.validateQuizBank(exported);assert.equal(new Set(exported.questions.map(q=>q.id)).size,69);
 const target=await r.createPracticeBank({name:'导出重导入',subject:'english'});await r.importResourceJSON(exported,{targetBankId:target.id});assert.equal((await r.queryPracticeQuestions(target.id)).total,69);
});
