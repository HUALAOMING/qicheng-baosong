import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {FakeFactory} from './support.mjs';

async function harness() {
  const factory = new FakeFactory(), ctx = {state:{route:'home',uiLang:'zh'},persistencePaused:false};
  const banks = [{bank:{id:'bank',name:'Fixture bank',section:'grammar'},questions:Array.from({length:12},(_,index)=>({id:'Q'+index,type:index===0?'true-false':'single-choice',question:'Question '+index,explanation:'PRIVATE_EXPLANATION',...(index===0?{answer:false}:{options:[{id:'A',text:'One'},{id:'B',text:'Two'}],answer:'A'})}))}];
  const messages = [], writes = [], controls = new Map(); let now=Date.now(), nextId=0;
  class TestDate extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context=vm.createContext({console,indexedDB:factory,setTimeout,clearTimeout,structuredClone,Date:TestDate,Math,encodeURIComponent});
  const storeModule=new vm.SourceTextModule(await readFile(new URL('../js/storage.js',import.meta.url),'utf8'),{context});
  await storeModule.link(()=>{throw Error('Unexpected dependency');});await storeModule.evaluate();
  const storage=storeModule.namespace.storage;
  for(const method of ['set','setMany','update','remove']){const original=storage[method];storage[method]=(...args)=>{writes.push({method,key:args[0]});return original(...args);};}
  const dependencies={
    '../storage.js':{storage},'../resources.js':{listQuizBanks:()=>banks},'../state.js':{ctx},
    '../app.js':{render(){},confirmAction:async()=>true,go3:route=>{ctx.state.route=route;}},
    '../utils/helpers.js':{$:()=>null,$$:selector=>controls.get(selector)||[],esc:value=>String(value??''),tr:zh=>zh,toast:message=>messages.push(message),uid:()=> 'draft-'+(++nextId)}
  };
  const module=new vm.SourceTextModule(await readFile(new URL('../js/modules/quiz.js',import.meta.url),'utf8'),{context});
  await module.link(specifier=>{const values=dependencies[specifier];return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});
  await module.evaluate();const quiz=module.namespace;await quiz.initializeQuiz();
  return {quiz,storage,banks,ctx,factory,messages,writes,controls,advance:ms=>now+=ms};
}

test('rapid real answer edits debounce into one independent draft write; repeat selections and timer do not save',async()=>{
  const {quiz,storage,writes,advance}=await harness();
  const session=quiz.quizStart('bank','random',10,()=>0.25);await quiz.waitForQuizWrites();
  assert.equal(writes.length,1);assert.equal(writes[0].method,'update');
  const original=await storage.get(quiz.QUIZ_DRAFT_KEY);writes.length=0;
  for(let index=0;index<session.questions.length;index++)quiz.quizAnswer(index,session.questions[index].answer);
  assert.equal(writes.length,0);assert.equal(quiz.getRecentQuiz(),null);
  await new Promise(resolve=>setTimeout(resolve,650));await quiz.waitForQuizWrites();
  assert.equal(writes.length,1);assert.equal(writes[0].key,quiz.QUIZ_DRAFT_KEY);
  const draft=await storage.get(quiz.QUIZ_DRAFT_KEY);assert.deepEqual(draft.questions,original.questions);
  assert.equal(draft.answers.filter(answer=>answer!==null).length,10);
  assert.equal('index' in draft,false);assert.equal('correct' in draft,false);assert.equal(await storage.get('current'),undefined);
  quiz.quizAnswer(0,session.questions[0].answer);advance(120000);quiz.refreshQuizClock();await quiz.waitForQuizWrites();
  assert.equal(writes.length,1);assert.equal(quiz.getQuizDashboard().groups,0);
  quiz.resetQuiz();
});

test('a killed process restores partial answers and elapsed time without entering a page or revealing grading',async()=>{
  const {quiz,storage,ctx,advance}=await harness();
  const session=quiz.quizStart('bank','random',7,()=>0.5,{limitSeconds:120});
  quiz.quizAnswer(0,session.questions[0].answer);quiz.quizAnswer(2,session.questions[2].answer);
  await quiz.waitForQuizWrites();const saved=await storage.getAll();advance(90000);
  await quiz.initializeQuiz(saved);
  assert.equal(ctx.state.route,'home');assert.equal(quiz.getUnfinishedQuiz().answered,2);assert.equal(quiz.getUnfinishedQuiz().total,7);
  assert.match(quiz.quizPage(),/data-quiz-resume/);assert.equal(quiz.getRecentQuiz(),null);
  assert.equal(quiz.quizResume(),true);assert.equal(ctx.state.route,'quiz');
  assert.equal(quiz.quizTimeState().remainingSeconds,30);assert.equal(quiz.getQuizDraftRecord().answers[2],session.questions[2].answer);
  assert.ok(!quiz.quizPage().includes('PRIVATE_EXPLANATION'));assert.ok(!quiz.quizPage().includes('quiz-explanation'));
  const copy=quiz.getQuizDraftRecord();copy.answers[0]=null;assert.equal(quiz.getUnfinishedQuiz().answered,2);
  quiz.resetQuiz();
});

test('malformed draft backups reject invalid schema, IDs, questions, answers and timing before changing memory',async()=>{
  const {quiz}=await harness();const session=quiz.quizStart('bank','random',7,()=>0.25);
  quiz.quizAnswer(0,session.questions[0].answer);const good=quiz.getQuizDraftRecord();
  assert.equal(quiz.validateQuizRecords({[quiz.QUIZ_DRAFT_KEY]:good})[quiz.QUIZ_DRAFT_KEY],good);
  for(const damage of [draft=>draft.schemaVersion=2,draft=>draft.questions[0].question='',draft=>draft.questions[1].id=draft.questions[0].id,draft=>draft.answers[0]='invalid',draft=>draft.answers.pop(),draft=>draft.startedAt=-1,draft=>draft.limitSeconds=10801,draft=>draft.updatedAt='bad',draft=>draft.correct=7]){
    const broken=structuredClone(good);damage(broken);assert.throws(()=>quiz.validateQuizRecords({[quiz.QUIZ_DRAFT_KEY]:broken}),/无效/);
    await assert.rejects(quiz.initializeQuiz({[quiz.QUIZ_DRAFT_KEY]:broken}),/无效/);
    assert.equal(quiz.getUnfinishedQuiz().id,good.id);
  }
  quiz.resetQuiz();
});

test('failed draft save preserves the previous committed answer and exposes a pure emergency backup snapshot',async()=>{
  const {quiz,storage,factory,messages}=await harness();const session=quiz.quizStart('bank','random',7);
  await quiz.waitForQuizWrites();quiz.quizAnswer(0,session.questions[0].answer);factory.failWrite=true;
  await assert.rejects(quiz.waitForQuizWrites());
  assert.equal((await storage.get(quiz.QUIZ_DRAFT_KEY)).answers[0],null);
  assert.equal(quiz.getQuizDraftRecord().answers[0],session.questions[0].answer);
  assert.equal(quiz.getUnfinishedQuiz().saveError,true);assert.match(messages.at(-1),/暂存失败/);
  await quiz.waitForQuizWrites();assert.equal((await storage.get(quiz.QUIZ_DRAFT_KEY)).answers[0],session.questions[0].answer);
  assert.equal(quiz.hasPendingQuizWrites(),false);assert.equal(quiz.getUnfinishedQuiz().saveError,false);
  quiz.resetQuiz();
});

test('submission atomically removes the saved draft; failure keeps it retryable and never shows formal statistics',async()=>{
  const {quiz,storage,factory}=await harness();const session=quiz.quizStart('bank','random',7);
  for(let index=0;index<session.questions.length;index++)quiz.quizAnswer(index,session.questions[index].answer);
  await quiz.waitForQuizWrites();factory.failAfter=2;
  await assert.rejects(quiz.quizSubmit());assert.equal(quiz.getRecentQuiz(),null);assert.ok(await storage.get(quiz.QUIZ_DRAFT_KEY));
  const record=await quiz.quizSubmit();assert.equal(record.correct,7);assert.equal(await storage.get(quiz.QUIZ_DRAFT_KEY),undefined);
  assert.equal(quiz.getQuizDraftRecord(),null);assert.equal(quiz.getUnfinishedQuiz(),null);
  await quiz.waitForQuizWrites();await quiz.initializeQuiz();assert.equal(quiz.getUnfinishedQuiz(),null);assert.equal(quiz.getRecentQuiz().id,record.id);
  quiz.resetQuiz();
});

test('replacing an in-flight draft is serialized; pausing persistence blocks new draft writes',async()=>{
  const {quiz,storage,ctx,writes}=await harness();quiz.quizStart('bank','random',7);const first=quiz.flushQuizDraft();
  const second=quiz.quizStart('bank','random',10);quiz.quizAnswer(0,second.questions[0].answer);
  await Promise.all([first,quiz.flushQuizDraft()]);assert.equal((await storage.get(quiz.QUIZ_DRAFT_KEY)).id,second.id);
  assert.equal((await storage.get(quiz.QUIZ_DRAFT_KEY)).answers.filter(answer=>answer!==null).length,1);
  ctx.persistencePaused=true;const before=writes.length;assert.equal(quiz.quizAnswer(1,second.questions[1].answer),false);
  await quiz.flushQuizDraft();assert.equal(writes.length,before);ctx.persistencePaused=false;quiz.resetQuiz();
});

test('old history loads question snapshots on demand and reviewing never replaces an unfinished draft',async()=>{
  const {quiz,storage,writes,controls}=await harness();let first;
  for(const size of [7,3]){
    const session=quiz.quizStart('bank','random',size);
    for(let index=0;index<session.questions.length;index++)quiz.quizAnswer(index,session.questions[index].answer);
    const record=await quiz.quizSubmit();first ||= record;
  }
  assert.equal(quiz.getRecentQuiz().questions.length,3);
  assert.ok(quiz.getQuizDashboard().recent.every(summary=>!('questions' in summary)));
  const session=quiz.quizStart('bank','random',7);quiz.quizAnswer(0,session.questions[0].answer);await quiz.waitForQuizWrites();
  let reads=0;const originalGet=storage.get;storage.get=key=>{if(key==='quiz:record:'+first.id)reads++;return originalGet(key);};
  const button={dataset:{quizReview:first.id},disabled:false};controls.set('[data-quiz-review]',[button]);quiz.bindQuizControls();
  const beforeWrites=writes.length;await button.onclick();assert.equal(reads,1);assert.match(quiz.quizPage(),/PRIVATE_EXPLANATION/);
  assert.equal(quiz.getUnfinishedQuiz().id,session.id);assert.equal(quiz.getUnfinishedQuiz().answered,1);
  quiz.quizResume();assert.ok(!quiz.quizPage().includes('PRIVATE_EXPLANATION'));assert.equal(writes.length,beforeWrites);
  assert.equal((await storage.get('quiz:record:'+first.id)).questions.length,7);
  quiz.resetQuiz();
});
