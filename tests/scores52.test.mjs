import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {storage}=await import('../js/storage.js');
const saving=await import('../js/autosave.js');
const resources=await import('../js/resources.js');
const dashboard=await import('../js/modules/dashboard.js');
const calendar=await import('../js/modules/exam-calendar.js');
beforeEach(async()=>{
  await calendar.waitForExamCalendarWrites().catch(()=>{});await ctx.saveChain;
  saving.cancelPendingSave();env.factory.failWrite=false;await storage.clear();
  ctx.state=fresh();ctx.state.onboarded=true;ctx.persistencePaused=false;saving.initializeSaving301();
  await resources.reloadResources();await calendar.initializeExamCalendar();
});
const exams=()=>[
  {id:'exam-a',title:'第一次考试',date:'2026-10-01',totalScore:'600',totalFullMark:'750',rank:'10',rankScope:'年级',subjects:[{name:'数学',score:'120',fullMark:'150',rank:'5'}]},
  {id:'exam-b',title:'第二次考试',date:'2026-10-20',totalScore:'720',totalFullMark:'900',rank:'20',rankScope:'年级',subjects:[{name:'数学',score:'90',fullMark:'100',rank:'8'}]}
];
test('total and subject metrics use corresponding full marks and corresponding ranks',()=>{
  const [first,second]=exams();ctx.state.chartMetric='totalScore';
  assert.equal(dashboard.chartValue3(first,'score'),600);assert.equal(dashboard.chartValue3(second,'score'),720);
  assert.equal(dashboard.chartValue3(first,'rate'),80);assert.equal(dashboard.chartValue3(second,'rate'),80);
  ctx.state.chartMetric='subject';ctx.state.chartSubject='数学';
  assert.equal(dashboard.chartValue3(first,'rate'),80);assert.equal(dashboard.chartValue3(second,'rate'),90);
  assert.equal(dashboard.chartValue3(first,'rank'),5);assert.equal(dashboard.chartValue3(second,true),8);
  second.subjects[0].rank='';assert.equal(dashboard.chartValue3(second,'rank'),null);
  ctx.state.chartSubject='不存在的科目';assert.equal(dashboard.chartValue3(second,'score'),null);assert.equal(dashboard.chartValue3(second,'rank'),null);
});
test('score rates preserve numeric zero and reject absent, impossible or zero full marks',()=>{
  ctx.state.chartMetric='totalScore';assert.equal(dashboard.numeric3(0),0);assert.equal(dashboard.numeric3('０'),0);assert.equal(dashboard.numeric3(''),null);
  const event={totalScore:0,totalFullMark:'100',rank:0};assert.equal(dashboard.chartValue3(event,'rate'),0);assert.equal(dashboard.chartValue3(event,'rank'),null);
  for(const value of ['',null,'0','-1','abc'])assert.equal(dashboard.chartValue3({...event,totalFullMark:value},'rate'),null);
  assert.equal(dashboard.chartValue3({...event,totalScore:'101'},'rate'),null);
  assert.equal(dashboard.chartValue3({...event,totalScore:'-1'},'score'),null);
});
test('chart offers exactly total/subject and score/rate/rank selectors, with no missing-value NaN',()=>{
  ctx.state.exams=exams();ctx.state.chartMetric='subject';ctx.state.chartSubject='数学';
  const html=dashboard.dashboardPage3();assert.match(html,/value="subject:数学"/);assert.match(html,/id="chartValueMode52"/);
  assert.doesNotMatch(html,/id="chartSubject3"|id="rankChart3"/);assert.match(html,/加权成绩计算器/);assert.match(html,/可能存在较大误差/);
  assert.doesNotMatch(dashboard.lineChart3('rate'),/NaN|Infinity/);assert.match(dashboard.lineChart3('rate'),/90%/);
  ctx.state.exams[0].subjects=[];ctx.state.exams[1].subjects=[];assert.match(dashboard.lineChart3('rate'),/没有有效得分率/);
});
test('weighted scores and ranks normalize relative weights without requiring 100 percent',()=>{
  const result=dashboard.calculateWeightedExams52(exams(),[{id:'exam-a',weight:1},{id:'exam-b',weight:3}]);
  assert.equal(result.valid,true);assert.equal(result.totalWeight,4);assert.equal(result.score,690);assert.equal(result.fullMark,862.5);assert.equal(result.rank,17.5);
  const scaled=dashboard.calculateWeightedExams52(exams(),new Map([['exam-a','25'],['exam-b','75']]));assert.equal(scaled.score,result.score);assert.equal(scaled.rank,result.rank);
});
test('invalid weights block calculations and missing scores/ranks are never silently counted as zero',()=>{
  for(const entries of [[],[{id:'exam-a',weight:''}],[{id:'exam-a',weight:-1}],[{id:'exam-a',weight:0}],[{id:'exam-a',weight:'Infinity'}],[{id:'missing',weight:2}],[{id:'exam-a',weight:1},{id:'exam-a',weight:1}]])assert.equal(dashboard.calculateWeightedExams52(exams(),entries).valid,false);
  const data=exams();data[1].totalScore='';let result=dashboard.calculateWeightedExams52(data,[{id:'exam-a',weight:1},{id:'exam-b',weight:1}]);assert.equal(result.score,null);assert.equal(result.rank,15);
  data[1].rank='';result=dashboard.calculateWeightedExams52(data,[{id:'exam-a',weight:1},{id:'exam-b',weight:1}]);assert.equal(result.rank,null);
  result=dashboard.calculateWeightedExams52(data,[{id:'exam-a',weight:1},{id:'exam-b',weight:0}]);assert.equal(result.score,600);assert.equal(result.rank,10);
});
test('manual calendar arrangements save, reload, edit, group by university and delete independently',async()=>{
  const first=await calendar.saveManualExamEvent({date:'2026-10-26',schoolName:'测试院校',stage:'written'});
  const second=await calendar.saveManualExamEvent({date:'2026-10-26',schoolName:'测试院校',stage:'other',location:'线上'});
  assert.equal((await storage.get('calendar:exam:'+first.id)).location,'');assert.equal(calendar.examSchoolsForDate('2026-10-26').length,1);assert.equal(calendar.examSchoolsForDate('2026-10-26')[0].events.length,2);
  await calendar.initializeExamCalendar();assert.equal(calendar.getManualExamEvents().length,2);
  await calendar.saveManualExamEvent({...first,date:'2026-10-27',stage:'interview',location:'教学楼'});
  assert.equal(calendar.examSchoolsForDate('2026-10-26')[0].events.length,1);assert.equal(calendar.examSchoolsForDate('2026-10-27')[0].events[0].location,'教学楼');
  await calendar.deleteManualExamEvent(second.id);assert.equal(await storage.get('calendar:exam:'+second.id),undefined);assert.equal(calendar.getManualExamEvents().length,1);
});
test('manual event validation and storage failures preserve the previous complete event',async()=>{
  for(const changes of [{date:'2026-02-30'},{schoolName:' '},{stage:'invalid'},{location:'a'.repeat(501)}])assert.throws(()=>calendar.saveManualExamEvent({date:'2026-10-26',schoolName:'测试院校',stage:'written',...changes}));
  const first=await calendar.saveManualExamEvent({date:'2026-10-26',schoolName:'测试院校',stage:'written'});
  const before=await storage.getAll();env.factory.failWrite=true;
  await assert.rejects(calendar.saveManualExamEvent({...first,location:'不得保存'}));assert.deepEqual(await storage.getAll(),before);assert.equal(calendar.getManualExamEvents()[0].location,'');
  env.factory.failWrite=true;await assert.rejects(calendar.deleteManualExamEvent(first.id));assert.equal(calendar.getManualExamEvents().length,1);
  const invalid=structuredClone(before);invalid['calendar:exam:'+first.id].stage='no';assert.throws(()=>calendar.validateExamCalendarRecords(invalid));
  await assert.rejects(calendar.initializeExamCalendar(invalid));assert.equal(calendar.getManualExamEvents()[0].stage,'written');
});
test('manual events survive independent-record round trips and text remains inert in the calendar',async()=>{
  const first=await calendar.saveManualExamEvent({date:'2026-10-26',schoolName:'<img src=x onerror=alert(1)>',stage:'other',location:'<script>oops</script>'});
  const records=await storage.getAll();calendar.validateExamCalendarRecords(records);await calendar.initializeExamCalendar({});assert.equal(calendar.getManualExamEvents().length,0);
  await calendar.initializeExamCalendar(records);assert.equal(calendar.getManualExamEvents()[0].id,first.id);
  calendar.selectExamCalendarDate('2026-10-26');const html=calendar.examCalendarPage();assert.match(html,/&lt;img/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<img src=x|<script>oops/);
  assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/id="manualExamEditor52"/);assert.match(html,/data-manual-exam-edit52/);assert.match(html,/data-manual-exam-delete52/);
});
test('complete backup restores manual calendar events and rejects damaged events before any mutation',async()=>{
  const backup=await import('../js/backup.js');
  const first=await calendar.saveManualExamEvent({date:'2026-10-26',schoolName:'备份测试院校',stage:'written'});
  const archive=await backup.getCurrentBackup();assert.equal(archive.data['calendar:exam:'+first.id].schoolName,'备份测试院校');
  await calendar.deleteManualExamEvent(first.id);assert.equal(calendar.getManualExamEvents().length,0);
  await backup.commitBackup(archive);assert.equal(calendar.getManualExamEvents()[0].schoolName,'备份测试院校');
  const before=await storage.getAll(),invalid=structuredClone(archive);invalid.data['calendar:exam:'+first.id].date='2026-02-30';
  await assert.rejects(backup.commitBackup(invalid));assert.deepEqual(await storage.getAll(),before);
});
