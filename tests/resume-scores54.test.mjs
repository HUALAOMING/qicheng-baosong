import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {ctx}=await import('../js/state.js'),{fresh}=await import('../js/model.js'),resume=await import('../js/resume-model53.js'),scores=await import('../js/display-scores54.js'),{validateDraft}=await import('../js/utils/validation.js'),{rowsFromResolved53}=await import('../js/modules/resume.js'),{storage}=await import('../js/storage.js'),saving=await import('../js/autosave.js');

function reset(){ctx.state=fresh();ctx.state.profile.name='底稿姓名';ctx.state.displayScores=[];ctx.state.displayScoreDraft=scores.blankDisplayScore54();resume.initializeResumeVersions53();}

test('new resume from an existing version copies content, selections, custom structure and presentation independently',()=>{
 reset();const source=ctx.state.versions[0];resume.changeResumeVersion53(source.id,v=>{
  v.resume53.overrides['profile.name']='通用版姓名';v.resume53.overrides['profile.targetSchool']='北大';v.resume53.labels['profile.name']='申请人';v.resume53.hidden.push('profile.phone');v.resume53.sectionOrder.reverse();v.resume53.template='business';v.resume53.styles['profile.name']={fontSize:14,color:'#123456'};v.resume53.fieldOrder.profile=['profile.school','profile.name'];
  const module=resume.createCustomModule53(v,'研究');module.entries.push({id:'custom-entry',title:'课题',fields:[{id:'custom-field',label:'方法',value:'访谈'}]});
 });
 const before=structuredClone(resume.getResumeVersion53(source.id)),copy=resume.createResumeVersion53('复旦版本',['复旦大学'],{sourceId:source.id});
 assert.notEqual(copy.id,source.id);assert.equal(ctx.state.activeVersion,copy.id);assert.equal(copy.target,'复旦大学');assert.equal(copy.filename,'复旦版本');
 for(const key of ['labels','hidden','sectionOrder','template','styles','fieldOrder','customModules'])assert.deepEqual(copy.resume53[key],before.resume53[key]);
 assert.equal(resume.resolveResume53(copy.id).workspace.profile.name,'通用版姓名');assert.equal(resume.resolveResume53(copy.id).workspace.profile.targetSchool,'复旦大学');
 resume.changeResumeVersion53(copy.id,v=>{v.resume53.overrides['profile.name']='复旦姓名';v.resume53.customModules[0].entries[0].fields[0].value='问卷';});
 assert.deepEqual(resume.getResumeVersion53(source.id),before);assert.equal(ctx.state.profile.name,'底稿姓名');
 const count=ctx.state.versions.length;assert.throws(()=>resume.createResumeVersion53('错误来源',[],{sourceId:'missing'}));assert.equal(ctx.state.versions.length,count);
});

test('display-only grades export beside regular exams without entering dashboard data and survive validated persistence',async()=>{
 reset();ctx.state.exams.push({id:'exam-regular',title:'最近月考',type:'月考',date:'2026-11-01',totalScore:'600',totalFullMark:'750',rankScope:'年级',rank:'20',rankTotal:'600',note:'',subjects:[]});
 const grade=scores.prepareDisplayScore54({title:'优秀期中成绩',item:'外语',score:'145',fullMark:'150',classRank:'1 / 45',gradeRank:'3 / 600'});ctx.state.displayScores.push(grade);
 const version=resume.createResumeVersion53('成绩简历'),resolved=resume.resolveResume53(version.id),entries=resolved.modules.find(m=>m.key==='exams').entries;
 assert.equal(ctx.state.exams.length,1);assert.equal(ctx.state.exams[0].id,'exam-regular');assert.equal(entries.length,2);
 const entry=entries.find(e=>e.id===grade.id);assert.equal(entry.fields.find(f=>f.label==='展示项目').value,'外语');assert.equal(entry.fields.find(f=>f.label==='班级排名').value,'1 / 45');
 const text=rowsFromResolved53(resolved).map(row=>row.text||'').join('\n');assert.match(text,/最近月考/);assert.match(text,/优秀期中成绩/);assert.match(text,/展示项目：外语/);assert.match(text,/年级排名：3 \/ 600/);
 resume.changeResumeVersion53(version.id,v=>v.resume53.hidden.push('record:exams:'+grade.id));assert.doesNotMatch(rowsFromResolved53(resume.resolveResume53(version.id)).map(row=>row.text||'').join('\n'),/优秀期中成绩/);
 await storage.clear();saving.initializeSaving301();ctx.savedFingerprint301=null;ctx.persistencePaused=false;assert.equal(await saving.save(),true);ctx.state=validateDraft(await storage.getCurrent({lazyAssets:true}),{trustedLocal:true});
 assert.deepEqual(ctx.state.displayScores,[grade]);assert.equal(ctx.state.exams.length,1);assert.equal(resume.resolveResume53(version.id).modules.find(m=>m.key==='exams').entries.length,2);
});

test('display-only grades preserve per-version overrides and source fallback without affecting blank resumes',()=>{
 reset();const grade=scores.prepareDisplayScore54({title:'优秀成绩',item:'总分',score:'700',fullMark:'750',classRank:'1',gradeRank:'5'});ctx.state.displayScores.push(grade);const v=resume.createResumeVersion53('非空'),blank=resume.createResumeVersion53('空白',[],{blank:true});
 resume.changeResumeVersion53(v.id,x=>x.resume53.overrides['exams:'+grade.id+':classRank']='2');ctx.state.displayScores[0].score='710';resume.preserveResumeReferences53();ctx.state.displayScores=[];
 const entry=resume.resolveResume53(v.id).modules.find(m=>m.key==='exams').entries.find(e=>e.id===grade.id);assert.equal(entry.fields.find(f=>f.label==='分数').value,'710');assert.equal(entry.fields.find(f=>f.label==='班级排名').value,'2');assert.equal(entry.sourceMissing,true);assert.equal(resume.resolveResume53(blank.id).workspace.exams.length,0);
});

test('display grades validate meaningful content and accept custom grades and rank descriptions',()=>{
 for(const record of [{title:'',item:'外语',score:'A'},{title:'期中',item:'',score:'A'},{title:'期中',item:'外语'},{title:'期中',item:'外语',score:'151',fullMark:'150'},{title:'期中',item:'外语',score:'0',fullMark:'0'},{title:'期中',item:'外语',score:'-1'}])assert.throws(()=>scores.prepareDisplayScore54(record));
 assert.equal(scores.prepareDisplayScore54({title:'口语测试',item:'口语',score:'A+',classRank:'前5%'}).score,'A+');
 assert.equal(scores.prepareDisplayScore54({title:'口语测试',item:'口语',score:'0',fullMark:'100'}).score,'0');
});


test('import validation refuses ambiguous score IDs and invalid display drafts',()=>{
 reset();ctx.state.exams.push({id:'duplicate-score',title:'常规成绩',type:'月考',date:'',totalScore:'80',totalFullMark:'100',rankScope:'年级',rank:'',rankTotal:'',note:'',subjects:[]});
 ctx.state.displayScores.push({...scores.blankDisplayScore54(),id:'duplicate-score',title:'仅展示',item:'数学',score:'90'});
 assert.throws(()=>validateDraft(ctx.state),/与常规考试重复/);
 ctx.state.displayScores=[];ctx.state.displayScoreDraft.id='../invalid';assert.throws(()=>validateDraft(ctx.state),/displayScoreDraft.id/);
});
