import test from 'node:test';import assert from 'node:assert/strict';import {setup} from './support.mjs';
const env=await setup(),{storage,DATABASE_NAME}=await import('../js/storage.js'),r=await import('../js/resources.js'),{ctx}=await import('../js/state.js'),{fresh}=await import('../js/model.js'),b=await import('../js/backup.js');ctx.state=fresh();await r.initializeResources();
const original={schemaVersion:1,bank:{id:'longterm',name:'长期题包',subject:'custom',section:'custom',version:'1.0.0'},questions:Array.from({length:5000},(_,i)=>({id:'q'+i,type:'true-false',question:'题目 '+i,answer:true,explanation:'原解析 '+i}))};
let added;
test('5000 rows import; direct create/update preserves stable IDs and writes only selected question',async()=>{
 await r.importResourceJSON(original,{newBankName:'长期练习'});added=await r.createQuestion('longterm',{type:'true-false',question:'手动新增',answer:false,explanation:'个人题目'});assert.ok(added.questionId);const before=await storage.get('@521:bank:q:custom:longterm/q4');const row=await r.readQuestion('longterm','q3');await r.updateQuestion('longterm','q3',{explanation:'本地修改'},{expectedRevision:row.revision});assert.deepEqual(await storage.get('@521:bank:q:custom:longterm/q4'),before);assert.deepEqual(storage.lastCommit().keys.filter(k=>k.startsWith('@521:bank:q:')),['@521:bank:q:custom:longterm/q3']);
});
test('old JSON preserves manual new question and local explanation; conflicting upstream change is atomic',async()=>{
 await r.importResourceJSON(original);assert.equal((await r.readQuestion('longterm','q3')).question.explanation,'本地修改');assert.ok((await r.readQuestion('longterm',added.questionId)).question);
 const changed=structuredClone(original);changed.questions[3].explanation='上游修改';const before=await storage.getAll();await assert.rejects(r.importResourceJSON(changed),e=>e.code==='QUESTION_UPDATE_CONFLICT'&&e.conflicts[0].questionId==='q3');assert.deepEqual(await storage.getAll(),before);
});
test('append retains all existing questions, duplicate import no duplication, bounded filtered query',async()=>{
 await r.appendQuestions('longterm',[{id:'appended',type:'true-false',question:'新增关键词',answer:true,explanation:''}]);const page=await r.queryQuestions('longterm',{limit:10});assert.equal(page.items.length,10);assert.equal(page.total,5002);const found=await r.queryQuestions('longterm',{keyword:'新增关键词',limit:1});assert.equal(found.items[0].id,'appended');await r.importResourceJSON(original);assert.ok((await r.readQuestion('longterm','appended')).question);
});
test('note and mark remain independent across answer edits and deletion; history snapshot remains exact',async()=>{
 const key='quiz:mark:longterm/q3';await storage.set(key,{bankId:'longterm',questionId:'q3',wrong:true,favorite:true});const state=await r.getQuestionLearning('longterm','q3');await r.saveQuestionNote('longterm','q3','独立批注',{expectedRevision:state.noteRevision});const old=await r.readQuestion('longterm','q3');await storage.set('future:history',{question:old.question,answer:true});await r.updateQuestion('longterm','q3',{answer:false},{expectedRevision:old.revision});const next=await r.readQuestion('longterm','q3');await r.deleteQuestion('longterm','q3',{expectedRevision:next.revision});assert.equal((await r.readQuestion('longterm','q3')).question,null);assert.equal((await r.getQuestionLearning('longterm','q3')).note.text,'独立批注');assert.equal((await storage.get('future:history')).question.answer,true);assert.equal((await storage.get(key)).favorite,true);
});
test('quota rollback and rapid stale writes do not partially change bank or provenance',async()=>{
 let row=await r.readQuestion('longterm','q2');const before=await storage.getAll();env.factory.failAfter=3;await assert.rejects(r.updateQuestion('longterm','q2',{explanation:'失败'},{expectedRevision:row.revision}));assert.deepEqual(await storage.getAll(),before);
 const results=await Promise.allSettled([r.updateQuestion('longterm','q2',{explanation:'第一次'},{expectedRevision:row.revision}),r.updateQuestion('longterm','q2',{explanation:'过期'},{expectedRevision:row.revision})]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');
});
test('backup restores effective questions, provenance, tombstone and notes; invalid metadata rejected',async()=>{
 const archive=await b.getCurrentBackup();assert.ok(archive.data['question:edit:custom:longterm/q3']);await storage.clear();await b.commitBackup(archive);assert.equal((await r.readQuestion('longterm','q3')).deleted,true);assert.equal((await r.getQuestionLearning('longterm','q3')).note.text,'独立批注');assert.ok((await r.readQuestion('longterm',added.questionId)).question);const invalid=structuredClone(archive);invalid.data['question:note:longterm/q3'].text=10;invalid.integrity.digest=await b.backupDigest521(invalid);await assert.rejects(b.commitBackup(invalid));
});
test('source pack same qid never collides; manual pack maps to presentation bank',async()=>{
 const pack=await r.ensureManualQuestionPack('english-grammar');assert.equal(await r.ensureManualQuestionPack('english-grammar'),pack);await r.createQuestion(pack,{id:'q2',type:'true-false',question:'另一题',answer:true,explanation:''});assert.notEqual((await r.readQuestion(pack,'q2')).question.question,(await r.readQuestion('longterm','q2')).question.question);
});

test('verified official online update cannot overwrite locally edited question',async()=>{
 const all=await r.exportQuestionBank('english-grammar'),id=all.questions[0].id,row=await r.readQuestion('english-grammar',id);await r.updateQuestion('english-grammar',id,{explanation:'本地官方题解析'},{expectedRevision:row.revision});
 const remote=structuredClone(all);remote.bank.version='99.0.0';remote.questions[0].explanation='不同的上游解析';const body=JSON.stringify(remote),{createHash}=await import('node:crypto');const manifest={schemaVersion:1,resources:[{id:'english-grammar',type:'quiz-bank',version:'99.0.0',url:'bank.json',sha256:createHash('sha256').update(body).digest('hex')}]};const before=await storage.getAll(),fetch=globalThis.fetch;
 globalThis.fetch=async url=>new Response(String(url).endsWith('manifest.json')?JSON.stringify(manifest):body);
 try{await assert.rejects(r.updateResources('https://updates.test/manifest.json'),e=>e.code==='QUESTION_UPDATE_CONFLICT');assert.deepEqual(await storage.getAll(),before);}finally{globalThis.fetch=fetch;}
});

test('explicit reset resolves local provenance without deleting independent notes',async()=>{
 const row=await r.readQuestion('longterm','q3');await r.resetQuestionLocalChange('longterm','q3',{expectedRevision:row.revision});const restored=await r.readQuestion('longterm','q3');assert.equal(restored.question.answer,true);assert.equal(restored.local,null);assert.equal((await r.getQuestionLearning('longterm','q3')).note.text,'独立批注');
});
