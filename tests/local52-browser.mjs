import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.resolve('tests/generated/local52');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!file.startsWith(root+path.sep))throw Error();const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',acceptDownloads:true});
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
const go=route=>page.evaluate(route=>ResumeStudio.go3(route),route);
async function ready(){await page.waitForFunction(()=>window.ResumeStudio);}
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL '+name+': '+e.message);await page.screenshot({path:path.join(out,'failure-'+checks.length+'.png')}).catch(()=>{});}}
let archivePath,introID;
try{
 await page.goto(base);await ready();
 await check('startup presents continue and archive load after the app is ready',async()=>{
   assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.2.0');assert.equal(await page.locator('#startupChoice52').evaluate(e=>e.open),true);await page.locator('#startupContinue52').click();assert.equal(await page.locator('#startupChoice52').evaluate(e=>e.open),false);
 });
 await check('introduction draft survives reload, seconds convert, Chinese count and version detail work',async()=>{
   await go('self-introductions');await page.locator('[data-intro-new52]').click();await page.locator('#introductionForm52 [name="title"]').fill('中文90秒面试版');await page.locator('#introductionForm52 [name="language"]').fill('汉语');await page.locator('#introductionForm52 [name="minutes"]').fill('0');await page.locator('#introductionForm52 [name="seconds"]').fill('90');await page.locator('[data-intro-convert52]').click();assert.equal(await page.locator('[name="minutes"]').inputValue(),'1');assert.equal(await page.locator('[name="seconds"]').inputValue(),'30');await page.locator('[name="body"]').fill('你好，世界！');assert.equal(await page.locator('#introCount52').textContent(),'4 字');
   await page.evaluate(()=>ResumeStudio.save());await page.reload();await ready();await page.locator('#startupContinue52').click();await go('self-introductions');await page.locator('[data-intro-new52]').click();assert.equal(await page.locator('[name="body"]').inputValue(),'你好，世界！');await page.locator('#introductionForm52 [type="submit"]').click();await page.waitForSelector('.intro-script52');assert.equal(await page.locator('.intro-script52').textContent(),'你好，世界！');introID=await page.evaluate(()=>ResumeStudio.getState().introductions[0].id);assert.ok(parseFloat(await page.locator('.intro-script52').evaluate(e=>getComputedStyle(e).fontSize))>=19);await page.screenshot({path:path.join(out,'intro-review.png')});
 });
 await check('timer crosses zero and retains elapsed time when paused',async()=>{
   await page.evaluate(async id=>{const i=await import('/js/modules/introductions.js');i.introductionTimerAction52({id,durationSeconds:90},'toggle',Date.now()-92500);},introID);await page.waitForFunction(()=>document.querySelector('#introTimerStatus52').textContent.includes('已超出'));assert.match(await page.locator('#introTimerStatus52').textContent(),/已超出 [23] 秒/);await page.locator('[data-intro-timer52="toggle"]').click();const clock=await page.locator('#introClock52').textContent();await page.waitForTimeout(1100);assert.equal(await page.locator('#introClock52').textContent(),clock);await page.locator('[data-intro-timer52="reset"]').click();assert.equal(await page.locator('#introClock52').textContent(),'01:30');
 });
 await check('second language version and manual statement import use exact selected text',async()=>{
   await page.locator('[data-intro-back52]').click();await page.locator('[data-intro-new52]').click();await page.locator('[name="language"]').fill('English');await page.locator('[name="body"]').fill("Hello, I'm a prepared student.");assert.equal(await page.locator('#introCount52').textContent(),'5 词');await page.locator('#introductionForm52 [type="submit"]').click();await go('statement');await page.locator('[data-intro-choice52="zh"]').selectOption(introID);await page.locator('[data-intro-import52="zh"]').click();assert.equal(await page.locator('[data-bind="statement.zh"]').inputValue(),'你好，世界！');
   await page.locator('[data-bind="statement.otherLanguage"]').fill('Deutsch');await page.locator('[data-bind="statement.other"]').fill('Guten Tag!');await page.evaluate(()=>ResumeStudio.save());await page.reload();await ready();await page.locator('#startupContinue52').click();await go('statement');assert.equal(await page.locator('[data-bind="statement.otherLanguage"]').inputValue(),'Deutsch');assert.equal(await page.locator('[data-bind="statement.other"]').inputValue(),'Guten Tag!');
 });
 await check('settings copies valid AI instructions and identifies malformed question-bank JSON',async()=>{
   await go('settings');await page.locator('details.resource-guide').first().evaluate(e=>e.open=true);const ai=page.locator('[data-resource-sample="ai"]');await ai.scrollIntoViewIfNeeded();await ai.evaluate(e=>{for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
   await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__aiInstructions=text;}}});});await ai.click();assert.match(await page.evaluate(()=>window.__aiInstructions),/schemaVersion/);assert.match(await ai.textContent(),/复制/);
   await page.locator('#resourceJSONInput').setInputFiles({name:'bad-bank.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":1,"bank":{},"questions":[]}')});await page.waitForSelector('#resourceResult:has-text("格式可能存在错误")');assert.match(await page.locator('#resourceResult').textContent(),/旧数据已保留/);
   assert.equal(await page.locator('.settings-versions dl > div').count(),5);assert.equal(await page.locator('.settings-versions').getByText('v5.2.0',{exact:true}).count(),1);
 });
 await check('menu manual save downloads a complete restorable file containing new records',async()=>{
   await page.evaluate(()=>{Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:undefined});});
   await page.locator('.menu-toggle').click();await page.locator('[data-action="saveFile52"]').click();await page.waitForSelector('#downloadDialog[open]');const pending=page.waitForEvent('download');await page.locator('#downloadLink').click();const file=await pending;archivePath=path.join(out,'manual-archive.json');await file.saveAs(archivePath);await page.locator('#closeDownload').click();const parsed=JSON.parse(await readFile(archivePath,'utf8'));assert.equal(parsed.appVersion,'5.2.0');assert.equal(parsed.data.current.introductions.length,2);assert.equal(parsed.data.current.statement.other,'Guten Tag!');assert.equal(parsed.data.current.introductionDraft.body,'');
 });
 await check('startup archive load validates and restores data, invalid JSON leaves chooser and data intact',async()=>{
   await page.reload();await ready();await page.locator('#startupFile52').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#startupChoice52').open);assert.equal(await page.evaluate(()=>ResumeStudio.getState().introductions.length),2);
   await page.locator('#startupFile52').setInputFiles(archivePath);await page.waitForSelector('#confirmDialog[open]');assert.match(await page.locator('#confirmMessage').textContent(),/5.2.0/);await page.locator('#confirmAccept').click();await page.waitForSelector('#toast:has-text("全部数据已恢复")');await page.waitForFunction(async()=>!(await import('/js/state.js')).ctx.busy&&!document.body.inert);assert.equal(await page.evaluate(()=>ResumeStudio.getState().introductions.length),2);
 });
 await check('core editing, grouped quiz scoring, and JSON backup still work',async()=>{
   await go('profile');await page.locator('[data-bind="profile.name"]').fill('5.2核心验收');await go('home');await page.evaluate(()=>ResumeStudio.save());assert.equal(await page.evaluate(async()=>(await(await import('/js/storage.js')).storage.get('current')).profile.name),'5.2核心验收');
   const result=await page.evaluate(async()=>{const q=await import('/js/modules/quiz.js'),s=q.quizStart('english-grammar','random',3);s.questions.forEach((x,i)=>q.quizAnswer(i,x.answer));return q.quizSubmit();});assert.equal(result.correct,3);assert.equal(result.total,3);const backup=await page.evaluate(async()=>(await import('/js/backup.js')).getCurrentBackup());assert.equal(backup.data.current.profile.name,'5.2核心验收');assert.ok(Object.keys(backup.data).some(k=>k.startsWith('quiz:')));
 });
 await check('new pages fit mobile and dark theme without horizontal scrolling',async()=>{
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const {theme}=ResumeStudio.getState();});await go('settings');await page.locator('[data-setting-theme="obsidian"]').click();
   for(const route of ['self-introductions','statement','reading-progress','dashboard','exam-calendar','settings']){await go(route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route);}
   await go('self-introductions');await page.screenshot({path:path.join(out,'intro-mobile-dark.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 });
 await check('offline cold launch and standalone HTML preserve current profile and introduction records',async()=>{
   await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);const offline=await context.newPage();
   await offline.goto(base);await offline.waitForFunction(()=>window.ResumeStudio);await offline.locator('#startupContinue52').click();assert.equal(await offline.evaluate(()=>ResumeStudio.getState().profile.name),'5.2核心验收');await offline.evaluate(()=>ResumeStudio.go3('self-introductions'));assert.equal(await offline.locator('.intro-card52').count(),2);await offline.close();await context.setOffline(false);
   const html=await page.evaluate(()=>ResumeStudio.offlineHTML()),filename=path.join(out,'portable52.html');await writeFile(filename,html);const portable=await context.newPage();await portable.goto('file:///'+filename.replaceAll('\\','/'));await portable.waitForFunction(()=>window.ResumeStudio);await portable.locator('#startupContinue52').click();assert.equal(await portable.evaluate(()=>ResumeStudio.version),'5.2.0');assert.equal(await portable.evaluate(()=>ResumeStudio.getState().introductions.length),2);await portable.close();
 });
 await check('page guide refreshes across routes, languages and composer tabs while keeping one shell',async()=>{
   await go('home');await page.locator('#helpToggle').click();assert.match(await page.locator('#helpTitle52').textContent(),/首页/);const home=await page.locator('#helpPanel').textContent();
   await go('dashboard');assert.equal(await page.locator('#helpPanel').isVisible(),false);await page.locator('#helpToggle').click();const scores=await page.locator('#helpPanel').textContent();assert.notEqual(home,scores);assert.match(scores,/100/);assert.match(scores,/2:3:5/);await page.locator('[data-action="closeHelp"]').click();
   await go('studio');await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.studioTab='style';ResumeStudio.render();});await page.locator('#helpToggle').click();const style=await page.locator('#helpPanel').textContent();assert.match(style,/排版/);await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.studioTab='files';ResumeStudio.render();});assert.notEqual(await page.locator('#helpPanel').textContent(),style);
   await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.state.uiLang='en';ResumeStudio.render();});assert.match(await page.locator('#helpTitle52').textContent(),/Help/);await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.state.uiLang='zh';ResumeStudio.render();});await go('settings');
 });
 await check('clear cache warns and removes only program assets while preserving user database and other caches',async()=>{
   await page.evaluate(async()=>{await caches.open('unrelated-test-cache');await navigator.serviceWorker.ready;});await go('settings');await page.locator('[data-cache-clear52]').evaluate(e=>e.closest('details').open=true);await page.locator('[data-cache-clear52]').click();await page.waitForSelector('#confirmDialog[open]');assert.match(await page.locator('#confirmMessage').textContent(),/未手动保存/);await page.locator('#confirmAccept').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('程序缓存已清除'));assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'5.2核心验收');assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('unrelated-test-cache')),true);assert.equal(await page.evaluate(async()=>(await caches.keys()).some(n=>n.startsWith('qicheng-static-'))),false);
 });
 assert.deepEqual(errors,[]);
}finally{
 await context.close();await browser.close();await new Promise(r=>server.close(r));
 const summary={version:'5.2.0',isolatedSyntheticData:true,checks,errors,passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length};await writeFile(path.join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({passed:summary.passed,failed:summary.failed,errors}));if(summary.failed||errors.length)process.exitCode=1;
}
