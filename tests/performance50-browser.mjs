import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('tests/generated/performance50');await mkdir(output,{recursive:true});
const root=process.cwd(),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(request,response)=>{try{const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname),target=path.resolve(root,'.'+(relative.endsWith('/')?relative+'index.html':relative));if(!target.startsWith(root+path.sep))throw Error('Invalid path');response.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});response.end(await readFile(target));}catch{response.writeHead(404);response.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
const page=await context.newPage(),errors=[],checks=[],metrics={};page.on('pageerror',error=>errors.push(error.message));
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{});}}
const go=route=>page.evaluate(route=>window.ResumeStudio.go3(route),route);
try{
 await page.goto(base);await page.waitForFunction(()=>window.ResumeStudio);
 await page.evaluate(async()=>{const state=ResumeStudio.fresh();state.onboarded=true;state.profile.targetSchool='浙江大学';state.dreamSchools=['浙江大学'];ResumeStudio.setState(state);await ResumeStudio.save();});
 await check('mobile navigation preserves the shell, topbar and sidebar DOM without reload',async()=>{
  await page.evaluate(()=>{window.__shell=document.querySelector('.shell3');window.__sidebar=document.querySelector('.sidebar3');window.__topbar=document.querySelector('.topbar3');window.__navigationEntry=performance.getEntriesByType('navigation').length;});
  for(const route of ['profile','reading','quiz','settings','home'])await go(route);
  assert.equal(await page.evaluate(()=>__shell===document.querySelector('.shell3')&&__sidebar===document.querySelector('.sidebar3')&&__topbar===document.querySelector('.topbar3')),true);
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('navigation').length),1);
 });
 await check('same-page redraw and route revisits retain scroll without writing navigation',async()=>{
  await go('classic:guanzi');await page.evaluate(()=>scrollTo(0,900));await page.waitForTimeout(50);const first=await page.evaluate(()=>scrollY);assert.ok(first>600);
  await page.evaluate(()=>ResumeStudio.render());assert.ok(Math.abs(await page.evaluate(()=>scrollY)-first)<2);
  await go('settings');await page.evaluate(()=>scrollTo(0,500));const second=await page.evaluate(()=>scrollY);
  await go('classic:guanzi');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-first)<2);
  await go('settings');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-second)<2);
 });
 await check('redraw retains text focus and selection; editing then navigating saves the latest content',async()=>{
  await go('profile');const name=page.locator('[data-bind="profile.name"]');await name.fill('连续编辑保持光标');
  await name.evaluate(element=>{element.focus();element.setSelectionRange(2,4);});const y=await page.evaluate(()=>scrollY);
  await page.evaluate(()=>ResumeStudio.render());assert.equal(await name.evaluate(element=>document.activeElement===element),true);
  assert.deepEqual(await name.evaluate(element=>[element.selectionStart,element.selectionEnd]),[2,4]);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y)<2);
  await go('reading');await page.waitForTimeout(650);assert.equal(await page.evaluate(async()=>(await(await import('/js/storage.js')).storage.get('current')).profile.name),'连续编辑保持光标');
 });
 await page.evaluate(async()=>{await ResumeStudio.save();const {storage}=await import('/js/storage.js');window.__writes=[];for(const key of ['set','setMany','update','remove']){const original=storage[key].bind(storage);storage[key]=(...args)=>{__writes.push({key,argsKey:typeof args[0]==='string'?args[0]:Object.keys(args[0])});return original(...args);};}});
 await check('menus, route changes, temporary tabs and returning to the foreground produce zero data writes',async()=>{
  for(const route of ['home','dashboard','settings','studio'])await go(route);
  for(const tab of ['order','content'])await page.locator('[data-studio-tab="'+tab+'"]').click();
  await go('home');await page.locator('.menu-toggle').click();await page.locator('.sidebar-close50').click();
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(650);assert.deepEqual(await page.evaluate(()=>__writes),[]);
 });
 await check('selecting an answer updates controls in place and debounces only the independent quiz draft',async()=>{
  await page.evaluate(async()=>{const quiz=await import('/js/modules/quiz.js');quiz.quizStart('english-grammar','random',7,()=>0.25);await quiz.waitForQuizWrites();ResumeStudio.go3('quiz');window.__question=document.querySelector('.quiz-question');__writes.length=0;});
  await page.locator('[data-quiz-option="0"]').click();
  assert.equal(await page.evaluate(()=>__question===document.querySelector('.quiz-question')),true);assert.equal(await page.locator('[data-quiz-option="0"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.quiz-explanation,.quiz-result').count(),0);assert.deepEqual(await page.evaluate(()=>__writes),[]);
  await page.waitForTimeout(650);assert.deepEqual(await page.evaluate(()=>__writes),[{key:'update',argsKey:'quiz:draft:active'}]);
  await page.locator('[data-quiz-option="0"]').click();await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>__writes.length),1);
 });
 await check('hidden/pagehide flush only dirty answers; repeated lifecycle events and timers do not write',async()=>{
  await page.locator('[data-quiz-next]').click();await page.locator('[data-quiz-option="1"]').click();
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));});
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__writes.length),2);
  await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(1250);assert.equal(await page.evaluate(()=>__writes.length),2);
 });
 await check('process-style reload starts at Home and resumes saved unsubmitted answers without grading',async()=>{
  await page.reload();await page.waitForFunction(()=>window.ResumeStudio);assert.equal(await page.evaluate(()=>ResumeStudio.getState().route),'home');
  assert.equal(await page.locator('[data-quiz-resume]').count(),1);await page.locator('[data-quiz-resume]').click();
  assert.equal(await page.evaluate(()=>ResumeStudio.getState().route),'quiz');assert.equal(await page.locator('.quiz-explanation,.quiz-result').count(),0);
  assert.equal(await page.evaluate(async()=>(await import('/js/modules/quiz.js')).getUnfinishedQuiz().answered),2);
  assert.equal(await page.evaluate(async()=>(await import('/js/modules/quiz.js')).getQuizDashboard().groups),0);
 });
 await check('partial answers enter a complete backup and restore without navigation or scroll data',async()=>{
  const result=await page.evaluate(async()=>{const backup=await import('/js/backup.js'),quiz=await import('/js/modules/quiz.js');const file=await backup.getCurrentBackup();const draft=file.data[quiz.QUIZ_DRAFT_KEY];const before=quiz.getUnfinishedQuiz();await backup.commitBackup(file);return {answers:draft.answers.filter(answer=>answer!==null).length,keys:Object.keys(draft),before:before.id,after:quiz.getUnfinishedQuiz()?.id,route:ResumeStudio.getState().route};});
  assert.equal(result.answers,2);assert.equal(result.before,result.after);assert.equal(result.route,'home');assert.ok(!result.keys.includes('index'));assert.ok(!result.keys.includes('route'));
 });
 await check('older results load offline on demand while an unfinished group stays available',async()=>{
  const ids=await page.evaluate(async()=>{const quiz=await import('/js/modules/quiz.js');let first;
   for(const size of [3,5]){const session=quiz.quizStart('english-grammar','random',size);session.questions.forEach((question,index)=>quiz.quizAnswer(index,question.answer));const record=await quiz.quizSubmit();first ||= record;}
   const session=quiz.quizStart('english-grammar','random',7);quiz.quizAnswer(0,session.questions[0].options[0].id);await quiz.waitForQuizWrites();ResumeStudio.go3('quiz');document.querySelector('[data-quiz-back]').click();return {first:first.id,draft:session.id};});
  await context.setOffline(true);await page.locator('[data-quiz-review="'+ids.first+'"]').click();await page.waitForSelector('.quiz-explanation');
  assert.equal(await page.evaluate(async()=>(await import('/js/modules/quiz.js')).getUnfinishedQuiz().id),ids.draft);
  await page.locator('[data-quiz-back]').click();await page.locator('[data-quiz-resume]').click();assert.equal(await page.locator('.quiz-explanation').count(),0);
  assert.equal(await page.evaluate(async()=>(await import('/js/modules/quiz.js')).getUnfinishedQuiz().answered),1);await context.setOffline(false);
 });
 await check('mobile redraw timings are recorded under fourfold CPU slowdown with no full-page animation',async()=>{
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  metrics.navigation=await page.evaluate(async()=>{const results=[];for(const route of ['profile','home','quiz','reading','calendar','home','reading-progress','settings','home']){const start=performance.now();await ResumeStudio.go3(route);results.push({route,milliseconds:Math.round((performance.now()-start)*10)/10});}return results;});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});metrics.maximumMilliseconds=Math.max(...metrics.navigation.map(entry=>entry.milliseconds));
  assert.equal(await page.locator('.page-content3').evaluate(element=>getComputedStyle(element).animationName),'none');
 });
 await check('no browser runtime errors occurred',async()=>assert.deepEqual(errors,[]));
}finally{await writeFile(path.join(output,'report.json'),JSON.stringify({checks,metrics,errors},null,2));await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
if(checks.some(check=>check.status==='FAIL'))process.exitCode=1;
