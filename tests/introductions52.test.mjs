import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {loadBuiltinData}=await import('../js/data.js');
const {validateDraft}=await import('../js/utils/validation.js');
const {createBackup,parseBackup,saveAllLocal}=await import('../js/backup.js');
const {initializeSaving301}=await import('../js/autosave.js');
const {storage}=await import('../js/storage.js');
const intro=await import('../js/modules/introductions.js');
const {quizAIInstructions52}=await import('../js/ai-instructions52.js');
const {validateQuizBank,initializeResources,getResourceVersions}=await import('../js/resources.js');
await loadBuiltinData();ctx.state=fresh();

test('5.1 snapshots gain only additive 5.2 fields and keep statements and document settings',()=>{
  const old=fresh();delete old.introductions;delete old.introductionDraft;delete old.statement.other;delete old.statement.otherLanguage;
  old.statement.zh='原有陈述';old.versions[0].fontSize=13;old.versions[0].wordBW=true;
  for(const key of ['paperColor','lineColor','titleColor','paperImage','layoutPreset'])delete old.versions[0][key];
  const upgraded=validateDraft(old);assert.equal(upgraded.statement.zh,'原有陈述');assert.equal(upgraded.versions[0].fontSize,13);assert.equal(upgraded.versions[0].wordBW,true);assert.deepEqual(upgraded.introductions,[]);assert.equal(upgraded.statement.other,'');assert.equal(upgraded.versions[0].paperColor,'#ffffff');
});
test('Chinese character counts and English word counts exclude punctuation',()=>{
  assert.deepEqual(intro.introductionCount52('你好，世界！ 2026。','汉语'),{count:8,unit:'字'});
  assert.deepEqual(intro.introductionCount52("Hello, I'm a well-prepared student!",'English'),{count:5,unit:'词'});
  assert.equal(intro.introductionCount52(' ？！—','中文').count,0);
});
test('duration conversion accepts overflow seconds and rejects negative or fractional input',()=>{
  assert.equal(intro.introductionDuration52('0','90'),90);assert.equal(intro.introductionDuration52('2','75'),195);
  assert.ok(Number.isNaN(intro.introductionDuration52('-1','5')));assert.ok(Number.isNaN(intro.introductionDuration52('1.5','0')));
});
test('countdown runs into overtime, preserves pause and resume, and resets',()=>{
  const item={id:'clock-test52',durationSeconds:60};intro.introductionTimerAction52(item,'toggle',1000);
  assert.equal(intro.introductionClock52(item.id,60,31000).seconds,30);
  const overtime=intro.introductionClock52(item.id,60,63500);assert.equal(overtime.overtime,true);assert.equal(overtime.seconds,2);
  intro.introductionTimerAction52(item,'toggle',64000);assert.equal(intro.introductionClock52(item.id,60,99999).seconds,3);
  intro.introductionTimerAction52(item,'toggle',100000);assert.equal(intro.introductionClock52(item.id,60,105000).seconds,8);
  intro.introductionTimerAction52(item,'reset',105000);assert.equal(intro.introductionClock52(item.id,60,200000).seconds,60);
});
test('complete backups preserve introduction versions, drafts, and optional third-language statements',()=>{
  const s=fresh();s.introductions=[{id:'intro52',language:'英语',title:'面试1分钟版',durationSeconds:60,note:'',body:'My story.',updatedAt:'2026-10-26T08:00:00Z'}];s.introductionDraft.body='尚未提交的正文';s.statement.otherLanguage='Deutsch';s.statement.other='Guten Tag.';
  const restored=parseBackup(createBackup(s)).draft;assert.deepEqual(restored.introductions,s.introductions);assert.equal(restored.introductionDraft.body,'尚未提交的正文');assert.equal(restored.statement.other,'Guten Tag.');
  s.introductions[0].durationSeconds=0;assert.throws(()=>validateDraft(s),/durationSeconds/);
});
test('manual local-file save writes a restorable JSON and cancellation keeps user data',async()=>{
  ctx.state=fresh();ctx.state.profile.name='手动存档测试';initializeSaving301();let content='',closed=false;
  globalThis.showSaveFilePicker=async()=>({createWritable:async()=>({write:async value=>{content=value;},close:async()=>{closed=true;},abort:async()=>{}})});
  const {saveLocalFile52}=await import('../js/local-files52.js');assert.equal(await saveLocalFile52(),true);assert.equal(closed,true);assert.equal(parseBackup(content).draft.profile.name,'手动存档测试');
  globalThis.showSaveFilePicker=async()=>{throw new DOMException('Cancelled','AbortError');};assert.equal(await saveLocalFile52(),false);assert.equal(ctx.state.profile.name,'手动存档测试');delete globalThis.showSaveFilePicker;
});
test('AI instruction example satisfies the actual importer and includes strict JSON guidance',()=>{
  const prompt=quizAIInstructions52(),example=prompt.slice(prompt.indexOf('{\n'),prompt.indexOf('\n\n二、'));
  const bank=validateQuizBank(JSON.parse(example));assert.equal(bank.questions.length,2);assert.equal(bank.questions[1].answer,true);assert.match(prompt,/不要 Markdown/);assert.match(prompt,/12 MB/);assert.match(prompt,/20000/);
});
test('default-bank dates and provided updatedAt metadata survive validation and storage',async()=>{
  await initializeResources();const versions=getResourceVersions();assert.equal(versions.banks.length,4);assert.ok(versions.banks.every(b=>Number.isFinite(Date.parse(b.updatedAt))));
  const input={schemaVersion:1,bank:{id:'test-updated',name:'更新测试',subject:'custom',section:'custom',version:'1.1.0',updatedAt:'2026-10-26T08:00:00Z'},questions:[]};
  const clean=validateQuizBank(input);assert.equal(clean.bank.updatedAt,'2026-10-26T08:00:00.000Z');await storage.set('test52:resource-date',clean);assert.equal(validateQuizBank(await storage.get('test52:resource-date')).bank.updatedAt,clean.bank.updatedAt);input.bank.updatedAt='invalid';assert.throws(()=>validateQuizBank(input),/更新时间/);
});
