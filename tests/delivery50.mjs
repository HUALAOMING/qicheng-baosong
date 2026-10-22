import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const output=path.resolve('../outputs'),base='http://127.0.0.1:4177/';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'zh-CN',timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
const offlineFile=path.join(output,'qicheng-5.1.0-offline.html');
async function shot(name){await page.evaluate(()=>document.querySelectorAll('.toast').forEach(e=>e.remove()));await page.waitForTimeout(350);await page.screenshot({path:path.join(output,name),fullPage:true});}
try{
 await page.goto(base);await page.waitForFunction(()=>window.ResumeStudio);assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.1.0');
 const html=await page.evaluate(()=>ResumeStudio.offlineHTML());await writeFile(offlineFile,html);
 const offline=await browser.newContext({offline:true,viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'zh-CN',timezoneId:'Asia/Shanghai'}),copy=await offline.newPage(),copyErrors=[];copy.on('pageerror',e=>copyErrors.push(e.message));
 try{
  await copy.goto(pathToFileURL(offlineFile).href);await copy.waitForFunction(()=>window.ResumeStudio);assert.equal(await copy.evaluate(()=>ResumeStudio.getState().profile.name),'');assert.equal(await copy.evaluate(()=>ResumeStudio.listQuizBanks().reduce((n,b)=>n+b.questions.length,0)),228);
  await copy.evaluate(()=>ResumeStudio.go3('calendar'));assert.equal(await copy.locator('.journal-calendar-day').count(),42);await copy.locator('[data-journal-view="week"]').tap();assert.equal(await copy.locator('.journal-calendar-day').count(),7);
  await copy.evaluate(()=>ResumeStudio.go3('reading'));await copy.locator('[data-go3="classic:guanzi"]').tap();assert.equal(await copy.locator('.classic-passage').count(),100);
  await copy.evaluate(()=>ResumeStudio.go3('reading-progress'));await copy.locator('#journalReadingForm [name="book"]').fill('离线阅读');await copy.locator('#journalReadingForm [name="startPage"]').fill('1');await copy.locator('#journalReadingForm [name="endPage"]').fill('10');await copy.locator('#journalReadingForm [type="submit"]').tap();await copy.waitForFunction(()=>document.querySelector('#journalReadingFeedback')?.textContent.includes('已保存'));
  await copy.evaluate(()=>ResumeStudio.go3('profile'));await copy.locator('[data-bind="profile.name"]').fill('独立文件检验');await copy.evaluate(()=>ResumeStudio.go3('home'));await copy.waitForTimeout(700);await copy.reload();await copy.waitForFunction(()=>window.ResumeStudio);assert.equal(await copy.evaluate(()=>ResumeStudio.getState().profile.name),'独立文件检验');await copy.evaluate(()=>ResumeStudio.go3('reading-progress'));assert.match(await copy.locator('.journal-reading-history').textContent(),/离线阅读/);
  await copy.evaluate(()=>ResumeStudio.openSettings());assert.equal(await copy.locator('#transferSettings').count(),1);await copy.locator('[data-pwa-check]').tap();assert.match(await copy.locator('[data-pwa-update-status]').textContent(),/独立 HTML 副本/);assert.deepEqual(copyErrors,[]);
 }finally{await offline.close();}
 await page.evaluate(async()=>{
  const state=ResumeStudio.fresh();state.onboarded=true;state.profile.targetSchool='浙江大学';state.profile.targetMajor='外国语言文学';state.dreamSchools=['浙江大学','哈尔滨工业大学'];ResumeStudio.setState(state);await ResumeStudio.save();
  const home=await import('/js/modules/home.js'),journal=await import('/js/modules/journal.js');await home.saveHomePreferences({featuredSchool:'浙江大学',quoteSource:'classic',quoteBookId:'guanzi'});await home.saveHomeCountdown({name:'保送考试',date:'2027-01-15'});
  const today=journal.journalDateKey();for(const [offset,status] of [[-4,'steady'],[-3,'good'],[-2,'low'],[-1,'perfect'],[0,'good']])await journal.saveDailyStatus(journal.journalShiftDate(today,offset),status);
  await journal.saveReadingProgress({date:today,book:'管子',startPage:12,endPage:28});await journal.saveReadingProgress({date:journal.journalShiftDate(today,-1),book:'论语',startPage:1,endPage:16});ResumeStudio.go3('home');
 });
 await shot('qicheng-5.0-home-light.png');await page.evaluate(async()=>{(await import('/js/state.js')).ctx.state.theme='obsidian';ResumeStudio.render();});await shot('qicheng-5.0-home-dark.png');
 await page.setViewportSize({width:390,height:844});await shot('qicheng-5.0-home-mobile.png');
 await page.setViewportSize({width:1440,height:1050});await page.evaluate(()=>ResumeStudio.go3('calendar'));await shot('qicheng-5.0-calendar-month.png');await page.locator('[data-journal-view="week"]').click();await shot('qicheng-5.0-calendar-week.png');
 await page.evaluate(()=>ResumeStudio.go3('reading-progress'));await shot('qicheng-5.0-reading-progress.png');await page.evaluate(()=>ResumeStudio.go3('settings'));await page.locator('#transferSettings').screenshot({path:path.join(output,'qicheng-5.0-transfer-guide.png')});
 assert.deepEqual(errors,[]);const bytes=await readFile(offlineFile);const result={version:'5.1.0',emptyOfflineArtifact:true,offlineChecks:8,errors,file:offlineFile,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),previews:['qicheng-5.0-home-light.png','qicheng-5.0-home-dark.png','qicheng-5.0-home-mobile.png','qicheng-5.0-calendar-month.png','qicheng-5.0-calendar-week.png','qicheng-5.0-reading-progress.png','qicheng-5.0-transfer-guide.png']};
 await writeFile(path.join(output,'qicheng-5.0-artifact-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await context.close();await browser.close();}
