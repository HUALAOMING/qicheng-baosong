import {chromium531 as chromium} from './browser531-support.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.resolve('tests/generated/resume-scores54');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
const go=route=>page.evaluate(route=>ResumeStudio.go3(route),route);
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function ready(){await page.waitForFunction(()=>window.ResumeStudio);if(await page.locator('#startupChoice52[open]').count())await page.locator('#startupContinue52').click();}
try{
 await page.goto('http://127.0.0.1:'+server.address().port);await ready();
 await check('language and score input are separate pages',async()=>{await go('academics');assert.equal(await page.locator('[data-bind="academics.languageLearning"]').count(),1);assert.equal(await page.locator('#examForm').count(),0);await go('scores');assert.equal(await page.locator('#examForm').count(),1);assert.equal(await page.locator('[data-bind="academics.languageLearning"]').count(),0);});
 await check('regular exams and display-only scores submit through separate forms',async()=>{
  await page.locator('[data-bind="examDraft.title"]').fill('常规月考');await page.locator('[data-bind="examDraft.totalScore"]').fill('600');await page.locator('[data-bind="examDraft.totalFullMark"]').fill('750');await page.locator('#examForm button[type=submit]').click();
  for(const[key,value]of Object.entries({title:'高二优秀期中考试',item:'外语',score:'145',fullMark:'150',classRank:'1 / 45',gradeRank:'3 / 600'}))await page.locator('[data-bind="displayScoreDraft.'+key+'"]').fill(value);
  await page.locator('#displayScoreForm54 button[type=submit]').click();await page.waitForFunction(()=>ResumeStudio.getState().displayScores.length===1);const state=await page.evaluate(()=>ResumeStudio.getState());assert.equal(state.exams.length,1);assert.equal(state.displayScores[0].score,'145');
  await go('dashboard');assert.equal((await page.evaluate(()=>ResumeStudio.selectedExams3())).length,1);await go('scores');await page.screenshot({path:path.join(out,'scores-desktop.png'),fullPage:true});
 });
 let sourceId;
 await check('new version from existing version preserves content, style and selection with independent edits',async()=>{
  sourceId=await page.evaluate(async()=>{const r=await import('/js/resume-model53.js');r.initializeResumeVersions53();const v=r.createResumeVersion53('通用申请版');r.changeResumeVersion53(v.id,copy=>{copy.resume53.overrides['profile.name']='通用版姓名';copy.resume53.hidden.push('profile.phone');copy.resume53.styles['profile.name']={fontSize:14,color:'#123456'};copy.resume53.template='business';const m=r.createCustomModule53(copy,'课题研究');m.entries.push({id:'browser-entry',title:'城市调研',fields:[{id:'browser-field',label:'方法',value:'访谈'}]});});await ResumeStudio.save();return v.id;});
  await go('resumes');await page.locator('#newResume53').click();await page.locator('#resumeForm53 [name="name"]').fill('复旦申请版');await page.locator('#resumeForm53 [name="targets"]').fill('复旦大学');await page.locator('#resumeSource54').selectOption('version');assert.equal(await page.locator('#resumeSourceVersion54').isVisible(),true);await page.locator('#resumeForm53 [name="sourceId"]').selectOption(sourceId);await page.locator('#resumeForm53 button[type=submit]').click();await page.locator('[data-resume-field-value53="profile.name"]').waitFor();assert.equal(await page.locator('[data-resume-field-value53="profile.name"]').inputValue(),'通用版姓名');
  await page.locator('[data-resume-field-value53="profile.name"]').fill('复旦版姓名');await page.locator('[data-resume-save53]').click();
  const result=await page.evaluate(sourceId=>{const state=ResumeStudio.getState(),source=state.versions.find(v=>v.id===sourceId),copy=state.versions.find(v=>v.id===state.activeVersion);return {source,copy};},sourceId);assert.equal(result.source.resume53.overrides['profile.name'],'通用版姓名');assert.equal(result.copy.resume53.overrides['profile.name'],'复旦版姓名');assert.deepEqual(result.copy.resume53.styles,result.source.resume53.styles);assert.equal(result.copy.resume53.template,'business');assert.equal(result.copy.resume53.customModules[0].entries[0].fields[0].value,'访谈');assert.ok(result.copy.resume53.hidden.includes('profile.phone'));
  const rows=await page.evaluate(async()=>{const r=await import('/js/resume-model53.js'),e=await import('/js/modules/resume.js');return e.rowsFromResolved53(r.resolveResume53()).map(x=>x.text).join('\n');});assert.match(rows,/常规月考/);assert.match(rows,/高二优秀期中考试/);assert.match(rows,/展示项目：外语/);assert.match(rows,/班级排名：1 \/ 45/);
 });
 await check('selected language and award values remain visible at desktop and tablet widths',async()=>{
  for(const viewport of [{width:1440,height:1100},{width:1024,height:1366}]){
   await page.setViewportSize(viewport);await go('profile');const language=page.locator('[data-bind="profile.schoolLanguage"]');await language.locator('..').locator('.editable-choice-toggle532').click();await page.locator('.editable-choice-menu532:not([hidden]) button').filter({hasText:/^日语$/}).click();assert.equal(await language.inputValue(),'日语');const bounds=await language.boundingBox();assert.ok(bounds.width>100,'language width '+bounds.width);const color=await language.evaluate(el=>getComputedStyle(el).webkitTextFillColor);assert.notEqual(color,'rgba(0, 0, 0, 0)');await go('awards');const scope=page.locator('[data-record3="awardDraft"][data-key="scope"]');await scope.selectOption('省级');assert.equal(await scope.inputValue(),'省级');assert.equal(await scope.locator('option:checked').innerText(),'省级');assert.ok((await scope.boundingBox()).width>100);await page.screenshot({path:path.join(out,'choices-'+viewport.width+'.png'),fullPage:true});
  }
  await ResumeSave();
 });
 await check('saved display grades, existing exams and cloned versions survive reload',async()=>{await page.reload();await ready();const state=await page.evaluate(()=>ResumeStudio.getState());assert.equal(state.displayScores.length,1);assert.equal(state.exams.length,1);const source=state.versions.find(v=>v.id===sourceId),copy=state.versions.find(v=>v.name==='复旦申请版');assert.equal(source.resume53.overrides['profile.name'],'通用版姓名');assert.equal(copy.resume53.overrides['profile.name'],'复旦版姓名');assert.equal(state.profile.schoolLanguage,'日语');await go('scores');await page.setViewportSize({width:1024,height:1366});await page.screenshot({path:path.join(out,'scores-tablet.png'),fullPage:true});});
 assert.deepEqual(errors,[]);
}finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify({checks,errors},null,2));await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
async function ResumeSave(){await page.evaluate(()=>ResumeStudio.save());}
console.log(JSON.stringify({passed:checks.length,errors}));
