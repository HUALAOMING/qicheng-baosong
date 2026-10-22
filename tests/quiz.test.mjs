import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {FakeFactory} from './support.mjs';

async function quizHarness() {
  const factory = new FakeFactory();
  const banks = [
    {schemaVersion:1, bank:{id:'en/grammar', name:'Grammar', subject:'english', section:'grammar', version:'1.0.0'}, origin:'official', questions:Array.from({length:25}, (_,index) => ({id:'Q'+index,type:'single-choice',question:'Question '+index+' <i>italic</i>',options:[{id:'A',text:'First'},{id:'B',text:'Second'}],answer:'A',explanation:'EXPLANATION_SECRET '+index}))},
    {schemaVersion:1, bank:{id:'zh-usage', name:'Chinese usage', subject:'chinese', section:'chinese-usage',version:'1.0.0'}, origin:'custom', questions:[{id:'Q0',type:'true-false',question:'判断本题。',answer:false,explanation:'FALSE_EXPLANATION'}]},
    {schemaVersion:1, bank:{id:'empty',name:'Ancient culture',subject:'chinese',section:'ancient-culture',version:'1.0.0'},origin:'official',questions:[]}
  ];
  const ctx = {state:{route:'quiz',uiLang:'zh'},persistencePaused:false};
  let clockNow=Date.now();
  class QuizDate extends Date{constructor(...args){super(...(args.length?args:[clockNow]));}static now(){return clockNow;}}
  const context = vm.createContext({console, indexedDB:factory,setTimeout,clearTimeout,structuredClone,Date:QuizDate,Math,encodeURIComponent});
  const storageModule = new vm.SourceTextModule(await readFile(new URL('../js/storage.js',import.meta.url),'utf8'),{context});
  await storageModule.link(() => {throw new Error('Unexpected storage dependency');});
  await storageModule.evaluate();
  let nextId = 0;
  const modules = {
    '../storage.js':{storage:storageModule.namespace.storage},
    '../resources.js':{listPracticeBanks:()=>banks},
    '../state.js':{ctx},
    '../app.js':{render(){},confirmAction:async()=>true,go3:route=>{ctx.state.route=route;}},
    '../utils/helpers.js':{$:()=>null,$$:()=>[],esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),tr:(zh,en)=>ctx.state.uiLang==='en'?en:zh,toast(){},uid:()=> 'test-'+(++nextId)}
  };
  const module = new vm.SourceTextModule(await readFile(new URL('../js/modules/quiz.js',import.meta.url),'utf8'),{context});
  await module.link(specifier => {
    const values=modules[specifier];
    if(!values)throw new Error('Unexpected module '+specifier);
    return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});
  });
  await module.evaluate();
  const quiz=module.namespace,storage=storageModule.namespace.storage;
  await quiz.initializeQuiz();
  return {quiz,storage,factory,banks,ctx,advance:ms=>clockNow+=ms};
}
function quizFill(quiz,session,wrongIndex=-1) {
  session.questions.forEach((question,index)=>quiz.quizAnswer(index,index===wrongIndex ? question.type==='true-false' ? !question.answer : 'B' : question.answer));
}

test('random groups contain 10/20 distinct snapshots; drafts never write records or reveal answers',async()=>{
  const {quiz,storage,banks}=await quizHarness();
  for(const size of [10,20]) {
    const session=quiz.quizStart('en/grammar','random',size,()=>0.37);
    assert.equal(session.questions.length,size);
    assert.equal(new Set(session.questions.map(question=>question.id)).size,size);
    quizFill(quiz,session);
    const html=quiz.quizPage();
    assert.ok(!html.includes('EXPLANATION_SECRET'));
    assert.ok(!html.includes('class="quiz-explanation"'));
    assert.ok(!/class="[^"]*\b(?:correct|incorrect)\b/.test(html));
    assert.equal(quiz.getRecentQuiz(),null);
    assert.equal(Object.keys(await storage.getAll()).length,0);
  }
  const session=quiz.quizStart('en/grammar','random',10,()=>0);
  const id=session.questions[0].id;
  banks[0].questions.find(question=>question.id===id).question='changed upstream';
  assert.ok(!quiz.quizPage().includes('changed upstream'));
  assert.throws(()=>quiz.quizStart('en/grammar','random',201));
});

test('answers can be revised, incomplete groups cannot submit, result uses final choices',async()=>{
  const {quiz,storage}=await quizHarness();
  const session=quiz.quizStart('en/grammar');
  assert.equal(quiz.quizAnswer(0,'X'),false);
  quiz.quizAnswer(0,'B');quiz.quizAnswer(0,'A');
  await assert.rejects(quiz.quizSubmit(),/第 2 题/);
  assert.equal(Object.keys(await storage.getAll()).length,0);
  quizFill(quiz,session,2);
  const record=await quiz.quizSubmit();
  assert.equal(record.correct,9);assert.equal(record.total,10);
  assert.equal(quiz.getRecentQuiz().id,record.id);
  assert.match(quiz.quizPage(),/quiz-explanation/);
  assert.match(quiz.quizPage(),/EXPLANATION_SECRET/);
  for(const label of ['总题数','正确题数','错误题数','正确率']) assert.ok(quiz.quizPage().includes(label));
  assert.equal(quiz.quizAnswer(2,'A'),false);
  assert.equal(await quiz.quizSubmit(),null);
  const records=await storage.getAll();
  assert.equal(Object.keys(records).filter(key=>key.startsWith('quiz:record:')).length,1);
  assert.equal(Object.keys(records).filter(key=>key.startsWith('quiz:mark:')).length,1);
  assert.equal(quiz.validateQuizRecords(records),records);
});

test('atomic failure midway preserves every old mark and leaves the active group retryable',async()=>{
  const {quiz,storage,factory}=await quizHarness();
  const session=quiz.quizStart('en/grammar');
  quizFill(quiz,session,0);
  factory.failAfter=2;
  await assert.rejects(quiz.quizSubmit());
  assert.equal(Object.keys(await storage.getAll()).length,0);
  assert.equal(quiz.getRecentQuiz(),null);
  assert.ok(!quiz.quizPage().includes('EXPLANATION_SECRET'));
  assert.equal(quiz.quizAnswer(0,'B'),true);
  const record=await quiz.quizSubmit();
  assert.equal(record.correct,9);
  assert.equal(Object.keys(await storage.getAll()).length,2);
  assert.equal(await storage.get(quiz.QUIZ_DRAFT_KEY),undefined);
});

test('rapid double submission creates exactly one formal result',async()=>{
  const {quiz,storage}=await quizHarness();
  const session=quiz.quizStart('en/grammar');quizFill(quiz,session);
  const first=quiz.quizSubmit(),second=quiz.quizSubmit();
  assert.equal(await second,null);assert.ok(await first);
  assert.equal(Object.keys(await storage.getAll()).filter(key=>key.startsWith('quiz:record:')).length,1);
});

test('favorites survive initialization; composite IDs isolate banks and failed saves do not toggle memory',async()=>{
  const {quiz,storage,factory}=await quizHarness();
  await quiz.quizFavorite('en/grammar','Q0');
  assert.throws(()=>quiz.quizStart('zh-usage','favorites'),/暂无收藏/);
  assert.equal(quiz.getRecentQuiz(),null);
  factory.failWrite=true;
  await assert.rejects(quiz.quizFavorite('en/grammar','Q0'));
  let session=quiz.quizStart('en/grammar','favorites',20);
  assert.equal(session.questions.length,1);
  assert.match(quiz.quizPage(),/本组共 1 题/);
  await quiz.initializeQuiz();
  session=quiz.quizStart('en/grammar','favorites',10);
  assert.equal(session.questions[0].id,'Q0');
  await quiz.quizFavorite('en/grammar','Q0');
  assert.throws(()=>quiz.quizStart('en/grammar','favorites'),/暂无收藏/);
  assert.equal((await storage.get(quiz.quizMarkKey('en/grammar','Q0'))).favorite,false);
});

test('wrong practice clears a wrong mark only after a correctly submitted group and preserves favorites',async()=>{
  const {quiz,storage}=await quizHarness();
  const session=quiz.quizStart('en/grammar');quizFill(quiz,session,0);
  const wrongId=session.questions[0].id;
  await quiz.quizFavorite('en/grammar',wrongId);
  await quiz.quizSubmit();
  const review=quiz.quizStart('en/grammar','wrong',20);
  assert.equal(review.questions.length,1);
  quizFill(quiz,review);
  assert.equal((await storage.get(quiz.quizMarkKey('en/grammar',wrongId))).wrong,true);
  await quiz.quizSubmit();
  const mark=await storage.get(quiz.quizMarkKey('en/grammar',wrongId));
  assert.equal(mark.wrong,false);assert.equal(mark.favorite,true);
  assert.throws(()=>quiz.quizStart('en/grammar','wrong'),/暂无待巩固/);
});

test('true-false false is a completed answer; sparse and empty banks behave explicitly',async()=>{
  const {quiz}=await quizHarness();
  assert.throws(()=>quiz.quizStart('empty'),/暂未收录/);
  const session=quiz.quizStart('zh-usage','random',20);
  assert.equal(session.questions.length,1);
  assert.ok(!quiz.quizPage().includes('FALSE_EXPLANATION'));
  assert.equal(quiz.quizAnswer(0,false),true);
  const record=await quiz.quizSubmit();
  assert.equal(record.correct,1);assert.equal(record.answers[0],false);
  assert.ok(quiz.quizPage().includes('FALSE_EXPLANATION'));
});

test('missing live questions retain saved marks and snapshot history but are excluded from practice',async()=>{
  const {quiz,banks,storage}=await quizHarness();
  await quiz.quizFavorite('zh-usage','Q0');
  const session=quiz.quizStart('zh-usage');quizFill(quiz,session);await quiz.quizSubmit();
  banks[1].questions=[];
  await quiz.initializeQuiz();
  assert.equal(quiz.getRecentQuiz().questions[0].question,'判断本题。');
  assert.throws(()=>quiz.quizStart('zh-usage','favorites'),/暂无收藏/);
  assert.equal((await storage.get(quiz.quizMarkKey('zh-usage','Q0'))).favorite,true);
});

test('restoration resets active drafts and validates results against snapshot answers',async()=>{
  const {quiz,storage}=await quizHarness();
  const session=quiz.quizStart('zh-usage');quizFill(quiz,session);await quiz.quizSubmit();
  const records=await storage.getAll(),key=Object.keys(records).find(key=>key.startsWith('quiz:record:'));
  const bad=structuredClone(records);bad[key].correct=0;
  assert.throws(()=>quiz.validateQuizRecords(bad),/无效/);
  const badAnswer=structuredClone(records);badAnswer[key].answers[0]='false';
  assert.throws(()=>quiz.validateQuizRecords(badAnswer),/无效/);
  const badMark={[quiz.quizMarkKey('en','id')]:{bankId:'other',questionId:'id',wrong:true,favorite:false}};
  assert.throws(()=>quiz.validateQuizRecords(badMark),/无效/);
  quiz.quizStart('en/grammar');
  await quiz.initializeQuiz(records);
  assert.ok(quiz.quizPage().includes('quiz-setup'));
  assert.equal(quiz.getRecentQuiz().total,1);
  await quiz.initializeQuiz({});
  assert.equal(quiz.getRecentQuiz(),null);
});

test('rich text allows only exact italic/underline tags, inertly escapes scripts and attributes',async()=>{
  const {quiz}=await quizHarness();
  const html=quiz.quizText('<i>yes</i><u>line</u><img src=x onerror=alert(1)><i onclick="x">bad</i>&lt;script&gt;');
  assert.match(html,/<i>yes<\/i><u>line<\/u>/);
  assert.ok(!html.includes('<img'));assert.ok(!html.includes('<i onclick='));
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&amp;lt;script&amp;gt;'));
});

test('backup write barrier waits for favorite and group commits; paused persistence blocks new mutations',async()=>{
  const {quiz,storage,ctx}=await quizHarness();
  const favorite=quiz.quizFavorite('en/grammar','Q0');
  ctx.persistencePaused=true;
  assert.equal(await quiz.quizFavorite('en/grammar','Q1'),false);
  await quiz.waitForQuizWrites();
  assert.equal((await storage.get(quiz.quizMarkKey('en/grammar','Q0'))).favorite,true);
  await favorite;
  ctx.persistencePaused=false;
  const session=quiz.quizStart('en/grammar');quizFill(quiz,session);
  const submit=quiz.quizSubmit();
  ctx.persistencePaused=true;
  assert.equal(quiz.quizAnswer(0,'B'),false);
  assert.throws(()=>quiz.quizStart('en/grammar'),/等待/);
  await quiz.waitForQuizWrites();
  assert.equal(Object.keys(await storage.getAll()).filter(key=>key.startsWith('quiz:record:')).length,1);
  await submit;
});


test('beta manual question sizes accept integers and never duplicate scarce questions',async()=>{
  const {quiz}=await quizHarness();for(const count of [1,7,15,37,200]){const session=quiz.quizStart('en/grammar','random',count);assert.equal(session.questions.length,Math.min(25,count));assert.equal(new Set(session.questions.map(q=>q.id)).size,session.questions.length);}
  for(const count of [0,-1,1.5,201,NaN])assert.throws(()=>quiz.quizStart('en/grammar','random',count));
});
test('beta timer uses absolute elapsed time, expires without grading, and freezes only on submission',async()=>{
  const {quiz,storage,advance}=await quizHarness();const session=quiz.quizStart('en/grammar','random',7,()=>0.5,{limitSeconds:2});advance(1500);assert.equal(quiz.quizTimeState().remainingSeconds,1);advance(4500);assert.equal(quiz.quizTimeState().expired,true);assert.equal(quiz.quizTimeState().remainingSeconds,0);assert.equal(Object.keys(await storage.getAll()).length,0);assert.equal(quiz.getRecentQuiz(),null);assert.ok(!quiz.quizPage().includes('EXPLANATION_SECRET'));
  quizFill(quiz,session);const record=await quiz.quizSubmit();assert.equal(record.total,7);assert.equal(record.timing.elapsedSeconds,6);assert.equal(record.timing.limitSeconds,2);advance(120000);assert.equal(quiz.quizTimeState().elapsedSeconds,6);quiz.validateQuizRecords(await storage.getAll());
});
test('beta untimed sessions count elapsed time and old records stay valid',async()=>{
  const {quiz,advance}=await quizHarness();const session=quiz.quizStart('en/grammar');advance(61000);assert.equal(quiz.quizTimeState().elapsedSeconds,61);assert.equal(quiz.quizTimeState().remainingSeconds,null);assert.equal(quiz.quizTimeState().expired,false);assert.equal(quiz.quizFormatTime(3661),'1:01:01');quizFill(quiz,session);const record=await quiz.quizSubmit();delete record.timing;quiz.validateQuizRecords({['quiz:record:'+record.id]:record});record.timing={startedAt:'bad',elapsedSeconds:1,limitSeconds:60};assert.throws(()=>quiz.validateQuizRecords({['quiz:record:'+record.id]:record}));
});

test('learning overview weights submitted questions, excludes drafts, and reads without writes',async()=>{
  const {quiz,storage,advance}=await quizHarness();
  assert.equal(quiz.getQuizDashboard().accuracy,null);
  let session=quiz.quizStart('en/grammar','random',7);const wrongIds=new Set(session.questions.slice(0,2).map(question=>question.id));quizFill(quiz,session);quiz.quizAnswer(0,'B');quiz.quizAnswer(1,'B');advance(65000);await quiz.quizSubmit();
  session=quiz.quizStart('en/grammar','random',3);for(const question of session.questions)wrongIds.delete(question.id);quizFill(quiz,session);advance(35000);await quiz.quizSubmit();
  await quiz.quizFavorite('en/grammar','Q0');quiz.quizStart('zh-usage');
  const before=JSON.stringify(await storage.getAll()),stats=quiz.getQuizDashboard();
  assert.equal(stats.total,10);assert.equal(stats.correct,8);assert.equal(stats.groups,2);assert.equal(stats.accuracy,80);assert.equal(stats.elapsedSeconds,100);assert.equal(stats.timedGroups,2);assert.equal(stats.favorites,1);assert.equal(stats.wrong,wrongIds.size);assert.equal(stats.recent.length,2);
  assert.equal(quiz.getQuizDashboard('chinese-usage').total,0);assert.equal(quiz.getQuizDashboard('chinese-usage').accuracy,null);
  stats.recent[0].bankTitle='changed';assert.notEqual(quiz.getRecentQuiz().bankTitle,'changed');
  assert.equal(JSON.stringify(await storage.getAll()),before);
  const records=await storage.getAll();for(const record of Object.values(records))if(record.submittedAt)delete record.timing;
  await quiz.initializeQuiz(records);assert.equal(quiz.getQuizDashboard().total,10);assert.equal(quiz.getQuizDashboard().timedGroups,0);assert.equal(quiz.getQuizDashboard().elapsedSeconds,0);
});
