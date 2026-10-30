import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setup} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {storage}=await import('../js/storage.js');
const {fresh}=await import('../js/model.js');
const saving=await import('../js/autosave.js');
const backup=await import('../js/backup.js');
const r=await import('../js/resources.js');
const quiz=await import('../js/modules/quiz.js');
const home=await import('../js/modules/home.js');
const journal=await import('../js/modules/journal.js');
const calendar=await import('../js/modules/exam-calendar.js');
const app=await import('../js/app.js');
const dashboard=await import('../js/modules/dashboard.js');
const settings=await import('../js/modules/settings.js');
const fetch=globalThis.fetch;
await(await import('../js/data.js')).loadBuiltinData();
const schedule=(version='1.0.0')=>({schemaVersion:1,version,examSchedule:[
  {id:'one-written',schoolId:'one',schoolName:'测试甲校',date:'2027-01-15',stage:'written',startTime:'09:00',endTime:'11:00'},
  {id:'one-interview',schoolId:'one',schoolName:'测试甲校',date:'2027-01-15',stage:'interview',startTime:'14:00'},
  {id:'two-written',schoolId:'two',schoolName:'测试乙校',date:'2027-01-15',stage:'written'}
]});
beforeEach(async()=>{
  env.factory.failWrite=false;await quiz.waitForQuizWrites().catch(()=>{});await r.waitForResourceWrites().catch(()=>{});await journal.waitForJournalWrites().catch(()=>{});await ctx.saveChain;
  saving.cancelPendingSave();await storage.clear();globalThis.fetch=fetch;ctx.state=fresh();ctx.state.onboarded=true;saving.initializeSaving301();
  await r.reloadResources();await quiz.initializeQuiz();await home.initializeHome();await journal.initializeJournal();
});
test('manual save commits edited materials and independent quiz/home/reading writes before reporting success',async()=>{
  ctx.state.profile.name='统一保存';saving.scheduleSave();const session=quiz.quizStart('english-grammar','random',7);quiz.quizAnswer(0,session.questions[0].answer);
  const writes=[home.saveHomeCountdown({name:'目标',date:'2027-01-15'}),journal.saveReadingProgress({date:'2026-10-23',book:'管子',author:'管仲',language:'汉语',chapter:'牧民',pages:'1–3'})];
  await backup.saveAllLocal();await Promise.all(writes);
  assert.equal((await storage.get('current')).profile.name,'统一保存');assert.equal((await storage.get(quiz.QUIZ_DRAFT_KEY)).answers[0],session.questions[0].answer);assert.equal((await storage.get('settings:countdown')).name,'目标');assert.equal(journal.getLatestReading().book,'管子');assert.equal(quiz.getRecentQuiz(),null);
});
test('repeated manual saves and navigation never write unchanged data; settings does not open Information',async()=>{
  let currentWrites=0;const original=storage.commitCurrent;storage.commitCurrent=(...args)=>{currentWrites++;return original(...args);};
  try{ctx.state.menuOpen=['start'];const before=await storage.getAll();await app.go3('settings');assert.deepEqual(ctx.state.menuOpen,['start']);assert.equal(app.routeGroup3('settings'),undefined);
    for(const route of ['practice-dashboard','dashboard','exam-calendar','home'])await app.go3(route);
    await backup.saveAllLocal();await backup.saveAllLocal();assert.equal(currentWrites,0);assert.deepEqual(await storage.getAll(),before);
  }finally{storage.commitCurrent=original;}
});
test('manual saving retries an answer draft failure and never reports success while storage fails',async()=>{
  const session=quiz.quizStart('english-grammar','random',7);quiz.quizAnswer(0,session.questions[0].answer);env.factory.failWrite=true;
  await assert.rejects(backup.saveAllLocal());assert.equal(await storage.get(quiz.QUIZ_DRAFT_KEY),undefined);assert.equal(quiz.getUnfinishedQuiz().answered,1);
  env.factory.failWrite=false;await backup.saveAllLocal();assert.equal((await storage.get(quiz.QUIZ_DRAFT_KEY)).answers[0],session.questions[0].answer);
});
test('manual save observes a pending resource failure even while current is being saved',async()=>{
  const original=storage.setMany;
  let enter,fail;const entered=new Promise(resolve=>enter=resolve),fault=new Promise((_,reject)=>fail=reject);
  storage.setMany=(records,...rest)=>{if(Object.keys(records).some(key=>key.startsWith('resource:custom:'))){enter();return fault;}return original(records,...rest);};
  try{
    ctx.state.profile.name='并行保存';saving.scheduleSave();
    const importing=r.importResourceJSON(schedule()),handled=importing.catch(()=>{});await entered;
    const pending=backup.saveAllLocal();fail(Error('Resource write failure'));
    await assert.rejects(pending,/Resource write failure/);await handled;
    assert.equal(r.getExamScheduleResource().examSchedule.length,0);
  }finally{storage.setMany=original;}
});
test('settings has one set of JSON controls and keeps independent HTML copies under Advanced tools',()=>{
  const html=settings.settingsPage();assert.equal((html.match(/data-action="backup"/g)||[]).length,1);assert.equal((html.match(/data-transfer-import>/g)||[]).length,1);assert.equal((html.match(/data-local-save>/g)||[]).length,1);
  assert.doesNotMatch(html,/data-transfer-role|data-transfer-export|id="backupSettings"/);assert.match(html,/高级工具/);assert.match(html,/导出可编辑 HTML 副本/);assert.match(html,/不与原 PWA 持续同步/);
});
test('materials/results and unified practice statistics have separate pages and independent filters',async()=>{
  const learning=await(await import('../js/features53.js')).loadFeature53('learning');await learning.prepareLearning53('practice-dashboard');
  assert.doesNotMatch(dashboard.dashboardPage3(),/quiz-dashboard/);assert.match(dashboard.dashboardPage3(),/考试成绩与排名/);
  const practice=dashboard.practiceDashboardPage();assert.match(practice,/learning-stat-grid53/);assert.match(practice,/不同题目|最近30天|题库表现/);assert.doesNotMatch(practice,/exam-dashboard3|stat-grid3|learning-nav53/);
  assert.equal(app.routeGroup3('practice-dashboard').id,'dashboard');assert.equal(app.routeGroup3('exam-calendar').id,'info');
});
test('empty examination framework ships no dates and month rows are Monday-first, including leap years',()=>{
  assert.deepEqual(r.getExamScheduleResource().examSchedule,[]);assert.match(calendar.examCalendarPage(),/考试日程尚未安装/);
  const days=calendar.examCalendarDays('2028-02');assert.equal(days.length%7,0);assert.equal(new Date(days[0]+'T12:00:00').getDay(),1);assert.ok(days.includes('2028-02-29'));assert.ok(calendar.examCalendarDays('2027-01').includes('2027-01-31'));assert.throws(()=>calendar.examCalendarDays('2027-13'));
});
test('school counts deduplicate same-day written/interview stages and preserve both arrangements',()=>{
  const schools=calendar.examSchoolsForDate('2027-01-15',r.validateExamSchedule(schedule()));assert.equal(schools.length,2);assert.equal(schools[0].events.length,2);assert.equal(schools[0].events[0].stage,'written');assert.equal(calendar.examSchoolsForDate('2027-01-16',schedule()).length,0);
});
test('schedule imports validate real dates, stable IDs, stages, times and ambiguous resource formats',async()=>{
  for(const change of [s=>s.schemaVersion=2,s=>s.examSchedule[0].date='2027-02-29',s=>s.examSchedule[0].stage='oral',s=>s.examSchedule[0].startTime='24:00',s=>s.examSchedule[0].endTime='08:00',s=>s.examSchedule.push(s.examSchedule[0]),s=>s.examSchedule[0].schoolName='']){const input=schedule();change(input);assert.throws(()=>r.validateExamSchedule(input));}
  const before=await storage.getAll();await assert.rejects(r.importResourceJSON({...schedule(),quotes:[]}));assert.deepEqual(await storage.getAll(),before);
});
test('offline imported schedules survive backup and do not collide with old banks named exam-schedule',async()=>{
  globalThis.fetch=()=>{throw Error('Offline');};await r.importResourceJSON(schedule());await r.importResourceJSON({schemaVersion:1,bank:{id:'exam-schedule',name:'旧题库',subject:'english',section:'grammar',version:'1.0.0'},questions:[]});
  const file=await backup.getCurrentBackup();assert.ok(file.data['resource:custom:schedule:exam-schedule']);assert.ok(file.data['resource:custom:exam-schedule']);await backup.commitBackup(file);
  calendar.selectExamCalendarDate('2027-01-15');assert.match(calendar.examCalendarPage(),/2 所/);assert.match(calendar.examCalendarPage(),/笔试/);assert.match(calendar.examCalendarPage(),/面试/);assert.equal(r.listImportedQuizPacks()[0].bank.id,'exam-schedule');
});
test('online schedule updates use the existing atomic resource update and custom schedules keep priority',async()=>{
  await r.importResourceJSON(schedule());const latest=schedule('1.1.0');latest.examSchedule=[latest.examSchedule[0]];const body=JSON.stringify(latest);
  const manifest={schemaVersion:1,resources:[{id:'exam-schedule',type:'exam-schedule',version:'1.1.0',url:'schedule.json',sha256:createHash('sha256').update(body).digest('hex')}]};
  globalThis.fetch=async url=>new Response(String(url).endsWith('manifest.json')?JSON.stringify(manifest):body);
  assert.deepEqual((await r.updateResources('https://updates.test/manifest.json')).updated,['exam-schedule']);assert.equal(r.getExamScheduleResource().examSchedule.length,3);assert.equal((await storage.get('resource:official:schedule:exam-schedule')).examSchedule.length,1);
  const before=await storage.getAll();manifest.resources[0].version='1.2.0';manifest.resources[0].sha256='0'.repeat(64);await assert.rejects(r.updateResources('https://updates.test/manifest.json'),/SHA/);assert.deepEqual(await storage.getAll(),before);
});
test('schedule text is rendered inertly instead of interpreting injected HTML',async()=>{
  const data=schedule();data.examSchedule[0].schoolName='<img src=x onerror=alert(1)>';await r.importResourceJSON(data);calendar.selectExamCalendarDate('2027-01-15');const html=calendar.examCalendarPage();assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
});
