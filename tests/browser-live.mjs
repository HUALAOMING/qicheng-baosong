// Explicitly opt-in production acceptance. Uses a disposable browser profile and synthetic data.
// Requires the same Playwright/Edge setup as browser-upgrade.mjs. Never uses an existing user profile.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.QICHENG_BASE_URL;
if(!base || !/^https:\/\//.test(base))throw new Error('Set QICHENG_BASE_URL to the explicitly authorized HTTPS deployment.');
const output=path.join(root,'tests/generated/browser-live');
await mkdir(output,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.QICHENG_PLAYWRIGHT || 'C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const profile=await mkdtemp(path.join(os.tmpdir(),'qicheng-live-'));
const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.QICHENG_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,viewport:{width:1280,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai',acceptDownloads:true,reducedMotion:'reduce'});
const page=context.pages()[0];page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);
const errors=[],requests=[],checks=[];const networkFailures=[];context.on('requestfailed',r=>networkFailures.push({url:r.url(),error:r.failure()?.errorText}));
let expectedNetworkFailure=false;
page.on('pageerror',error=>errors.push(error.message));
page.on('console',msg=>{if(msg.type()==='error'&&!expectedNetworkFailure)errors.push(msg.text());});
page.on('request',request=>requests.push({url:request.url(),cacheControl:request.headers()['cache-control']}));
const report={startedAt:new Date().toISOString(),base,browser:context.browser()?.version(),isolatedSyntheticData:true,checks,errors,networkFailures,limitations:['Checks installation eligibility; does not install an OS shortcut or use a real user profile.']};
async function check(name,fn){const start=Date.now();try{const detail=await fn();checks.push({name,status:'PASS',milliseconds:Date.now()-start,detail});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',milliseconds:Date.now()-start,error:e.stack});console.log('FAIL '+name+': '+e.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png'),timeout:5000}).catch(()=>{});await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close())).catch(()=>{});}await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2));}
async function ready(target=page){await target.waitForSelector('#workspaceContent');await target.waitForFunction(async base=>(await import(new URL('js/state.js',base).href)).ctx.initialized,base);}
async function offlineReady(){
  let info;
  for(let attempt=0;attempt<120;attempt++){
    info=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();const names=await caches.keys();return {active:r?.active?.state,installing:r?.installing?.state,waiting:r?.waiting?.state,caches:await Promise.all(names.map(async n=>({name:n,count:(await(await caches.open(n)).keys()).length}))),status:document.querySelector('[data-pwa-status]')?.textContent};});
    if(info.active==='activated' && info.caches.some(c=>c.count===112))return info;
    if(attempt%20===0)console.log('Waiting for complete offline cache '+JSON.stringify(info));
    await new Promise(r=>setTimeout(r,1000));
  }
  throw new Error('Offline cache not complete: '+JSON.stringify(info));
}
async function go(route,target=page){await target.evaluate(async({base,route})=>(await import(new URL('js/app.js',base).href)).go3(route),{base,route});}
async function records(){return page.evaluate(async base=>(await import(new URL('js/storage.js',base).href)).storage.getAll(),base);}
async function startGroup(bank,size,mode='random'){
  await go('quiz');if(await page.locator('[data-quiz-back]').count())await page.locator('[data-quiz-back]').click();
  await page.locator('[data-quiz-bank="'+bank+'"]').click();await page.locator('#quizMode').selectOption(mode);await page.locator('#quizSize').selectOption(String(size));await page.locator('[data-quiz-start]').click();
  if(await page.locator('#confirmDialog[open]').count())await page.locator('#confirmAccept').click();await page.waitForSelector('#quizQuestion');
}
async function answerGroup(bank,size,wrongFirst=false){
  const before=Object.keys(await records()).filter(k=>k.startsWith('quiz:record:')).length;
  assert.equal(await page.locator('[data-quiz-jump]').count(),size);
  await page.locator('[data-quiz-submit]').click();assert.equal(await page.locator('.quiz-result').count(),0);
  for(let i=0;i<size;i++){
    await page.locator('[data-quiz-jump="'+i+'"]').click();
    const id=(await page.locator('.quiz-question > .quiz-actions > span').textContent()).split('·').at(-1).trim();
    const q=await page.evaluate(async({base,bank,id})=>(await import(new URL('js/resources.js',base).href)).listQuizBanks().find(b=>b.bank.id===bank).questions.find(q=>q.id===id),{base,bank,id});
    let answer=q.type==='true-false'?(q.answer?0:1):q.options.findIndex(o=>o.id===q.answer);if(i===0&&wrongFirst)answer=(answer+1)%(q.options?.length||2);
    await page.locator('[data-quiz-option="'+answer+'"]').click();
    if(i===0&&wrongFirst){await page.locator('[data-quiz-favorite]').click();await page.waitForFunction(()=>document.querySelector('[data-quiz-favorite]')?.getAttribute('aria-pressed')==='true');}
    assert.equal(await page.locator('.quiz-result,.quiz-explanation,.quiz-option.correct').count(),0);
  }
  // Return to an earlier question, change the answer, then restore it before submission.
  await page.locator('[data-quiz-jump="0"]').click();const chosen=await page.locator('.quiz-option.selected').getAttribute('data-quiz-option');
  await page.locator('[data-quiz-option="'+((Number(chosen)+1)%await page.locator('[data-quiz-option]').count())+'"]').click();await page.locator('[data-quiz-option="'+chosen+'"]').click();
  assert.equal(Object.keys(await records()).filter(k=>k.startsWith('quiz:record:')).length,before);
  await page.locator('[data-quiz-submit]').click();await page.waitForSelector('.quiz-result');
  assert.deepEqual(await page.locator('.quiz-result-stats dd').allTextContents(),[String(size),String(size-(wrongFirst?1:0)),wrongFirst?'1':'0',wrongFirst?'90%':'100%']);
  assert.equal(Object.keys(await records()).filter(k=>k.startsWith('quiz:record:')).length,before+1);
  assert.ok(await page.locator('.quiz-explanation').count()>0);
}
try{
  await check('HTTPS production files exactly match the prepared 4.2 runtime',async()=>{
    for(const name of ['index.html','service-worker.js','manifest.webmanifest','js/modules/explore.js','js/modules/quiz.js','js/resources.js','js/autosave.js','js/modules/settings.js','data/resource-examples.json','data/resources/daily-quotes.json','data/classics.json','data/resources/manifest.json']){
      const response=await context.request.get(new URL(name,base).href,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status(),200,name);
      const bytes=await response.body();assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(await readFile(path.join(root,name))).digest('hex'),name);
    }
  });
  await check('Live cold launch opens home, 228 English questions, no automatic resource manifest request',async()=>{
    await page.goto(base,{waitUntil:"domcontentloaded"});await ready();if(await page.locator('#finishSettings').isVisible())await go('home');
    assert.equal(await page.title(),'启程 · 首页');assert.equal(await page.locator('.home-shortcuts [data-go3="explore"]').count(),1);
    assert.equal(requests.filter(r=>r.url.includes('data/resources/manifest.json')).length,0);
    const banks=await page.evaluate(async base=>(await import(new URL('js/resources.js',base).href)).listQuizBanks().map(b=>({id:b.bank.id,count:b.questions.length})),base);
    assert.deepEqual(banks.map(b=>b.count),[118,110,0,0]);return banks;
  });
  await check('Live navigation does not save and immediate content navigation still commits',async()=>{
    await page.evaluate(async base=>{const {storage}=await import(new URL('js/storage.js',base).href);window.__liveOriginal=storage.set;window.__liveWrites=0;storage.set=async(k,v)=>{if(k==='current')window.__liveWrites++;return window.__liveOriginal(k,v);};},base);
    for(const r of ['profile','settings','explore','home'])await go(r);await page.locator('.menu-toggle').click();await page.locator('.menu-toggle').click();await new Promise(r=>setTimeout(r,650));assert.equal(await page.evaluate(()=>window.__liveWrites),0);
    await go('profile');await page.locator('[data-bind="profile.name"]').fill('即时切页验收');await go('explore');await new Promise(r=>setTimeout(r,700));assert.equal((await records()).current.profile.name,'即时切页验收');assert.equal(await page.evaluate(()=>window.__liveWrites),1);
    await page.evaluate(async base=>{(await import(new URL('js/storage.js',base).href)).storage.set=window.__liveOriginal;},base);
  });
  await check('Live Settings is a reusable page with offline import guide and versions only at the bottom',async()=>{
    for(const r of ['home','profile','quiz']){await go(r);await page.evaluate(()=>window.ResumeStudio.openSettings());assert.equal(await page.locator('.settings-page').count(),1);assert.equal(await page.locator('dialog#settingsDialog,.topbar-quote').count(),0);}
    await page.locator('.resource-guide summary').click();assert.equal(await page.locator('[data-resource-sample]').count(),4);assert.match(await page.locator('.resource-guide').textContent(),/DeepSeek/);assert.match(await page.locator('.settings-versions').textContent(),/4\.2\.1/);await go('home');assert.equal(await page.locator('#homeCardRail,.brand-version,.sidebar-version').count(),0);
  });
  await check('Legacy current record, uploads and theme survive reload at the original origin; startup returns home',async()=>{
    const fixture=JSON.parse(await readFile(path.join(root,'tests/fixtures/input.json'),'utf8'));fixture.theme='obsidian';fixture.route='profile';
    fixture.assets=[{id:'live-retained',name:'retained.txt',mime:'text/plain',kind:'file',data:'data:text/plain;base64,aGVsbG8=',size:5,createdAt:'2026-10-12T00:00:00Z',source:'synthetic acceptance'}];
    await page.evaluate(async({base,fixture})=>{const {storage}=await import(new URL('js/storage.js',base).href);const {validateDraft}=await import(new URL('js/utils/validation.js',base).href);await storage.set('current',validateDraft(fixture));await storage.set('resource:official:daily-quotes',{schemaVersion:1,version:'1.0.0',quotes:[],origin:'official'});},{base,fixture});
    await page.reload({waitUntil:"domcontentloaded"});await ready();const actual=await page.evaluate(()=>window.ResumeStudio.getState());assert.equal(actual.route,'home');assert.equal(actual.theme,'obsidian');assert.deepEqual(actual.assets,fixture.assets);assert.deepEqual(actual.profile,fixture.profile);assert.equal((await records())['resource:official:daily-quotes'].quotes.length,100);assert.match(await page.locator('.home-goals').textContent(),/哈尔滨工业大学/);
    await go('profile');await page.locator('[data-bind="profile.name"]').fill('线上验收测试同学');await page.locator('[data-bind="profile.name"]').blur();await page.evaluate(async base=>(await import(new URL('js/autosave.js',base).href)).save(),base);
    await page.reload({waitUntil:"domcontentloaded"});await ready();assert.equal(await page.evaluate(()=>window.ResumeStudio.getState().profile.name),'线上验收测试同学');
  });
  await check('Live learning hub and complete Guanzi reader, search and exact Markdown download',async()=>{
    await page.locator('.home-shortcuts [data-go3="explore"]').click();assert.equal(await page.locator('.explore-book').count(),4);
    for(const id of ['lunyu','daodejing','zhuangzi']){await go('classic:'+id);assert.match(await page.locator('.classic-empty').textContent(),/尚未收录/);}
    await go('classic:guanzi');assert.equal(await page.locator('.classic-passage').count(),100);assert.equal(await page.locator('#classicChapter option').count(),27);
    await page.locator('#classicSearch').fill('方圜');assert.equal(await page.locator('.classic-passage').count(),1);await page.locator('#classicSearch').fill('');
    await page.locator('.classic-source summary').click();await page.locator('[data-classic-download]').click();await page.waitForSelector('#downloadDialog[open]');
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#downloadLink').click()]);const file=path.join(output,'guanzi.md');await download.saveAs(file);await page.locator('#closeDownload').click();
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),'0822133bfe03e4b1d2dfd20c3b35139d47c6bbf01699eab18974d26fb600c8c5');
    await page.screenshot({path:path.join(output,'live-guanzi.png')});
  });
  await check('Live 10-question grammar group hides answers until submission and retains edits',async()=>{await startGroup('english-grammar',10);await answerGroup('english-grammar',10,true);});
  await check('Live 20-question vocabulary group uses the same submission engine',async()=>{await startGroup('english-vocabulary',20);await answerGroup('english-vocabulary',20);});
  await check('Wrong questions and favorites survive a live reload; Chinese empty bank is safe',async()=>{
    await page.reload({waitUntil:"domcontentloaded"});await ready();const marks=Object.entries(await records()).filter(([k])=>k.startsWith('quiz:mark:'));assert.equal(marks.filter(([,v])=>v.wrong).length,1);assert.equal(marks.filter(([,v])=>v.favorite).length,1);
    await startGroup('english-grammar',10,'wrong');assert.equal(await page.locator('[data-quiz-jump]').count(),1);
    await go('quiz');await page.locator('[data-quiz-back]').click();await page.locator('[data-quiz-bank="chinese-ancient-culture"]').click();assert.equal(await page.locator('[data-quiz-start]').isDisabled(),true);
  });
  await check('Real online manifest update bypasses SW and downloads, validates and commits the official bank',async()=>{
    await page.evaluate(async base=>{const r=await import(new URL('js/resources.js',base).href);const {storage}=await import(new URL('js/storage.js',base).href);const bank=r.listQuizBanks().find(b=>b.bank.id==='english-grammar');await storage.set('resource:official:english-grammar',{...bank,bank:{...bank.bank,version:'0.0.0'}});await r.reloadResources();},base);
    const network=[];const listener=response=>{if(/data\/resources\/(manifest|english-grammar)\.json/.test(response.url()))network.push({url:response.url(),status:response.status(),fromServiceWorker:response.fromServiceWorker()});};page.on('response',listener);
    await page.evaluate(()=>window.ResumeStudio.openSettings());await page.locator('[data-resource-update]').click();await page.waitForFunction(()=>/已更新并保存到本机/.test(document.querySelector('#resourceResult')?.textContent||''));page.off('response',listener);
    assert.ok(network.some(r=>r.url.includes('manifest.json')));assert.ok(network.some(r=>r.url.includes('english-grammar.json')));assert.ok(network.every(r=>r.status===200&&!r.fromServiceWorker));
    const installed=(await records())['resource:official:english-grammar'];assert.equal(installed.bank.version,'1.0.0');assert.equal(installed.questions.length,118);await go('home');return network;
  });
  await check('Live countdown and personal backup retain data and omit official resources/navigation',async()=>{
    await go('home');await page.locator('.home-countdown-editor summary').click();await page.locator('#homeCountdownForm [name="name"]').fill('线上验收目标');await page.locator('#homeCountdownForm [name="date"]').fill('2027-01-01');await page.locator('#homeCountdownForm button').click();
    await page.waitForFunction(()=>document.querySelector('.home-countdown h2')?.textContent==='线上验收目标');
    const backup=await page.evaluate(async base=>(await import(new URL('js/backup.js',base).href)).getCurrentBackup(),base);assert.equal(backup.data.current.profile.name,'线上验收测试同学');assert.equal(backup.data.current.assets[0].name,'retained.txt');assert.equal(backup.data['settings:countdown'].name,'线上验收目标');assert.equal(Object.keys(backup.data).filter(k=>k.startsWith('quiz:record:')).length,2);assert.equal(Object.keys(backup.data).filter(k=>k.startsWith('resource:official:')).length,0);assert.equal('route'in backup.data.current,false);
    await page.screenshot({path:path.join(output,'live-home.png')});
  });
  await check('Production PWA has all 112 cached assets and no Edge installation eligibility errors',async()=>{
    await offlineReady();await page.reload({waitUntil:"domcontentloaded"});await ready();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cdp=await context.newCDPSession(page);const result=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(result.installabilityErrors,[]);report.installability=result;await cdp.detach();
    const offline=await page.evaluate(async()=>{const names=await caches.keys();return Promise.all(names.map(async n=>({name:n,count:(await (await caches.open(n)).keys()).length})));});assert.ok(offline.some(c=>c.count===112));report.caches=offline;
    const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel="manifest"]').href)).json());assert.equal(manifest.id,'./');assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');assert.ok(manifest.icons.some(i=>i.sizes==='512x512'));return {installability:result,caches:offline};
  });
  await check('Offline fresh page opens home, full Guanzi and downloaded quiz; failed update preserves old bank',async()=>{
    expectedNetworkFailure=true;await context.setOffline(true);await page.close();const offlinePage=await context.newPage();await offlinePage.goto(base,{waitUntil:"domcontentloaded"});await ready(offlinePage);
    assert.ok((await offlinePage.locator('.home-quote blockquote').textContent()).length>5);assert.match(await offlinePage.locator('.home-countdown').textContent(),/线上验收目标/);
    await go('classic:guanzi',offlinePage);assert.equal(await offlinePage.locator('.classic-passage').count(),100);await go('quiz',offlinePage);await offlinePage.locator('[data-quiz-bank="english-grammar"]').click();await offlinePage.locator('[data-quiz-start]').click();await offlinePage.waitForSelector('#quizQuestion');
    const detail=await offlinePage.evaluate(async base=>{const r=await import(new URL('js/resources.js',base).href);const before=JSON.stringify(r.listQuizBanks());let rejected=false;try{await r.updateResources();}catch{rejected=true;}return {rejected,unchanged:before===JSON.stringify(r.listQuizBanks()),records:Object.keys(await(await import(new URL('js/storage.js',base).href)).storage.getAll()).filter(k=>k.startsWith('quiz:record:')).length};},base);
    assert.equal(detail.rejected,true);assert.equal(detail.unchanged,true);assert.equal(detail.records,2);await offlinePage.screenshot({path:path.join(output,'live-offline-quiz.png')});await offlinePage.close();await context.setOffline(false);expectedNetworkFailure=false;return detail;
  });
  await check('No unexpected console errors or uncaught runtime exceptions',async()=>{assert.deepEqual(errors,[]);});
}finally{
  await context.close();await rm(profile,{recursive:true,force:true});report.finishedAt=new Date().toISOString();report.passed=checks.filter(c=>c.status==='PASS').length;report.failed=checks.filter(c=>c.status==='FAIL').length;report.result=report.failed?'FAIL':'PASS';await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
