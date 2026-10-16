import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {setup,root} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {storage,DATABASE_NAME}=await import('../js/storage.js');
const {loadBuiltinData}=await import('../js/data.js');
const {fresh,snapshot3}=await import('../js/model.js');
const {validateDraft}=await import('../js/utils/validation.js');
const home=await import('../js/modules/home.js');
const resources=await import('../js/resources.js');
const quiz=await import('../js/modules/quiz.js');
const backup=await import('../js/backup.js');
const {initializeSaving301,save}=await import('../js/autosave.js');
await loadBuiltinData();
ctx.state=fresh();ctx.state.onboarded=true;initializeSaving301();
await resources.initializeResources();await quiz.initializeQuiz();await home.initializeHome();

test('formal English banks keep 118 grammar and 110 vocabulary stable IDs, Chinese remains empty and Guanzi daily quotes are installed',()=>{
  const banks=resources.listQuizBanks();
  assert.deepEqual(banks.map(b=>[b.bank.id,b.questions.length]),[['english-grammar',118],['english-vocabulary',110],['chinese-ancient-culture',0],['chinese-usage',0]]);
  const ids=banks.flatMap(b=>b.questions.map(q=>q.id));assert.equal(new Set(ids).size,228);
  assert.ok(banks.slice(0,2).every(bank=>bank.questions.every(q=>q.type==='single-choice'&&q.options.some(option=>option.id===q.answer))));
  assert.equal(resources.getQuotesResource().quotes.length,100);assert.equal(home.homeQuoteForDate(resources.getQuotesResource()).bookId,'guanzi');
});
test('beta1 schema and every original user field remain readable; transient fields may be omitted',async()=>{
  assert.equal(DATABASE_NAME,'qicheng-v4');
  const old=JSON.parse(await readFile(path.join(root,'tests/fixtures/input.json'),'utf8'));
  assert.equal(old.format,'qicheng-resume');assert.equal(old.version,6);
  assert.deepEqual(validateDraft(old),old);
  const portable=structuredClone(old);for(const key of ['route','section','step','sidebarHidden','menuOpen'])delete portable[key];
  const restored=validateDraft(portable);assert.equal(restored.route,'home');
  for(const key of Object.keys(portable))assert.deepEqual(restored[key],old[key],key);
});
test('countdown calendar days handle leap days, today, past targets and invalid dates',async()=>{
  await home.initializeHome({'settings:countdown':{name:'Leap target',date:'2028-03-01'}});
  assert.equal(home.homeCountdownDays(new Date(2028,1,28,23)),2);
  assert.equal(home.homeCountdownDays(new Date(2028,1,29,1)),1);
  assert.equal(home.homeCountdownDays(new Date(2028,2,1,23)),0);
  assert.equal(home.homeCountdownDays(new Date(2028,2,2,1)),-1);
  assert.throws(()=>home.validateHomeRecords({'settings:countdown':{name:'Bad',date:'2027-02-29'}}));
  assert.throws(()=>home.validateHomeRecords({'settings:countdown':{name:123,date:''}}));
});
test('daily quote is fixed for local calendar date, changes next day, and accepts empty resources',()=>{
  const data={quotes:[{id:'Q1',text:'Test 1',source:''},{id:'Q2',text:'Test 2',source:''},{id:'Q3',text:'Test 3',source:''}]};
  assert.deepEqual(home.homeQuoteForDate(data,new Date(2026,9,14,0)),home.homeQuoteForDate(data,new Date(2026,9,14,23)));
  assert.notDeepEqual(home.homeQuoteForDate(data,new Date(2026,9,14,0)),home.homeQuoteForDate(data,new Date(2026,9,15,0)));
  assert.equal(home.homeQuoteForDate({quotes:[]}),null);assert.equal(home.homeQuoteForDate(null),null);
});
test('full backup covers independent user keys, omits navigation and official resources, restores atomically while keeping installed official version',async()=>{
  ctx.state=fresh();ctx.state.onboarded=true;ctx.state.theme='blue';ctx.state.profile.name='Backup fixture';ctx.state.route='quiz';
  initializeSaving301();await save();
  const custom={schemaVersion:1,bank:{id:'upgrade-custom',name:'Custom fixture',subject:'chinese',section:'chinese-usage',version:'1.0.0'},questions:[{id:'TF1',type:'true-false',question:'Fixture only',answer:false,explanation:''}]};
  await resources.importResourceJSON(custom);
  await storage.set('settings:countdown',{name:'Backup goal',date:'2027-01-01'});
  await home.initializeHome();
  quiz.quizStart('upgrade-custom','random',10);quiz.quizAnswer(0,true);await quiz.quizFavorite('upgrade-custom','TF1');await quiz.quizSubmit();
  await storage.set('future-user-note',{text:'Retain unknown user records'});
  const file=await backup.getCurrentBackup();
  assert.equal(file.backupVersion,1);assert.equal(file.data.current.profile.name,'Backup fixture');
  for(const key of ['route','section','step','sidebarHidden','menuOpen'])assert.equal(Object.hasOwn(file.data.current,key),false);
  assert.equal(Object.keys(file.data).some(key=>key.startsWith('resource:official:')),false);
  assert.ok(file.data['resource:custom:upgrade-custom']);assert.ok(file.data['settings:countdown']);assert.ok(file.data['future-user-note']);
  assert.ok(Object.keys(file.data).some(key=>key.startsWith('quiz:record:')));
  assert.deepEqual(file.data[quiz.quizMarkKey('upgrade-custom','TF1')],{bankId:'upgrade-custom',questionId:'TF1',wrong:true,favorite:true});
  const installed=await storage.get('resource:official:english-grammar');installed.bank.version='8.0.0';await storage.set('resource:official:english-grammar',installed);
  ctx.state.profile.name='Changed';await save();await backup.commitBackup(file);
  assert.equal(ctx.state.profile.name,'Backup fixture');assert.equal(ctx.state.theme,'blue');assert.equal(ctx.state.route,'home');
  assert.equal((await storage.get('resource:official:english-grammar')).bank.version,'8.0.0');
  assert.equal(resources.listQuizBanks().find(item=>item.bank.id==='english-grammar').bank.version,'8.0.0');
  assert.equal(quiz.getRecentQuiz().correct,0);assert.equal(home.homeCountdownDays(new Date(2027,0,1)),0);
});
test('invalid countdown, quiz and custom-bank records are rejected before restoring any user data',async()=>{
  const valid=await backup.getCurrentBackup();const before=await storage.getAll();
  for(const corrupt of [file=>file.data['settings:countdown'].date='2027-02-30',file=>file.data[quiz.quizMarkKey('upgrade-custom','TF1')].wrong='yes',file=>file.data['resource:custom:upgrade-custom'].questions[0].answer='false']) {
    const file=structuredClone(valid);corrupt(file);await assert.rejects(()=>backup.commitBackup(file));assert.deepEqual(await storage.getAll(),before);
  }
});
test('Home reads existing target data and export history without creating duplicate fields',()=>{
  ctx.state.profile.targetSchool='Existing target';ctx.state.profile.targetMajor='Existing major';ctx.state.dreamSchools=[];
  const html=home.homePage();assert.ok(html.includes('Existing target'));assert.ok(html.includes('Existing major'));
  assert.equal(Object.hasOwn(snapshot3(),'countdown'),false);assert.equal(Object.hasOwn(snapshot3(),'homeTargetSchool'),false);
});
