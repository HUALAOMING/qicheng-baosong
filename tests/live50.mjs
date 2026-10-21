// Explicit production check: isolated synthetic profile only, never an everyday browser profile.
import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const mode=process.argv[2]||'verify',base=process.env.QICHENG_BASE_URL||'https://hualaoming.github.io/qicheng-baosong/';
const output=path.resolve('tests/generated/live50'),profile=path.join(output,'isolated-upgrade-profile');await mkdir(output,{recursive:true});
const context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,viewport:{width:1280,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
const page=context.pages()[0]||await context.newPage(),errors=[],checks=[];page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
async function go(route,target=page){await target.evaluate(route=>ResumeStudio.go3(route),route);}
async function ready(target=page){await target.waitForFunction(()=>window.ResumeStudio);}
async function check(name,fn){try{const detail=await fn();checks.push({name,status:'PASS',detail});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL '+name+': '+e.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png')}).catch(()=>{});}}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await ready();
 if(mode==='prepare'){
  assert.equal(await page.evaluate(()=>ResumeStudio.version),'4.2.1');
  await page.evaluate(async base=>{
   const state=ResumeStudio.fresh();state.profile.name='旧版升级验收资料';state.profile.targetSchool='浙江大学';state.dreamSchools=['浙江大学','哈尔滨工业大学'];state.theme='obsidian';state.onboarded=true;state.assets=[{id:'live-preserved-file',name:'保留附件.txt',mime:'text/plain',kind:'file',data:'data:text/plain;base64,bGVnYWN5LWRhdGE=',size:11,createdAt:'2026-10-21T00:00:00Z',source:'isolated upgrade acceptance'}];ResumeStudio.setState(state);await ResumeStudio.save();
   const home=await import(new URL('js/modules/home.js',base));const {storage}=await import(new URL('js/storage.js',base));await storage.set('settings:countdown',{name:'升级保留目标',date:'2027-01-15'});await home.initializeHome();
   const quiz=await import(new URL('js/modules/quiz.js',base));const session=quiz.quizStart('english-grammar','random',10);session.questions.forEach((q,i)=>quiz.quizAnswer(i,i===0?q.options.find(o=>o.id!==q.answer).id:q.answer));await quiz.quizSubmit();await quiz.quizFavorite('english-grammar',session.questions[0].id);
   const sample=(await import(new URL('js/data.js',base))).RESOURCE_EXAMPLES.samples.classic.data;await ResumeStudio.importResourceJSON(JSON.stringify(sample));
  },base);
  await page.evaluate(async()=>await navigator.serviceWorker.ready);await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated';});
  await writeFile(path.join(output,'before.json'),JSON.stringify(await page.evaluate(()=>ResumeStudio.getState()),null,2));console.log('PREPARED isolated 4.2.1 profile with materials, file, countdown, submitted quiz, marks and custom classic.');
 }else{
  await check('existing 4.2.1 PWA accepts update at the same address without clearing data',async()=>{
   const initial=await page.evaluate(()=>ResumeStudio.version);
   if(initial!=='5.0.0'){
    await page.evaluate(()=>ResumeStudio.openSettings());await page.waitForSelector('[data-pwa-refresh]:not([hidden])',{timeout:120000});await page.locator('[data-pwa-refresh]').click();await page.waitForFunction(()=>window.ResumeStudio?.version==='5.0.0',{},{timeout:120000});
   }
   assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.0.0');assert.equal(await page.evaluate(()=>ResumeStudio.getState().route),'home');return {initial,updated:'5.0.0'};
  });
  await check('old profile, uploads, theme, targets, countdown and quiz marks survive the update',async()=>{
   const before=JSON.parse(await readFile(path.join(output,'before.json'),'utf8')),after=await page.evaluate(()=>ResumeStudio.getState());assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.assets,before.assets);assert.deepEqual(after.dreamSchools,before.dreamSchools);assert.equal(after.theme,before.theme);
   const data=await page.evaluate(async base=>(await import(new URL('js/storage.js',base))).storage.getAll(),base);assert.equal(data['settings:countdown'].name,'升级保留目标');assert.ok(Object.keys(data).some(k=>k.startsWith('quiz:mark:')&&data[k].favorite));assert.ok(Object.keys(data).some(k=>k.startsWith('resource:custom:')));const recent=await page.evaluate(()=>ResumeStudio.getRecentQuiz());assert.equal(recent.total,10);assert.equal(recent.correct,9);
  });
  await check('production source and complete cache match the release candidate, and PWA is installable',async()=>{
   for(const filename of ['js/constants.js','css/v5.css','service-worker.js','manifest.webmanifest','data/static-resources.json']){
    const actual=await page.evaluate(async({base,filename})=>{const r=await fetch(new URL(filename+'?acceptance='+Date.now(),base),{cache:'no-store'});if(!r.ok)throw Error(r.status);return r.text();},{base,filename});assert.equal(actual,await readFile(path.resolve(filename),'utf8'),filename);
   }
   const expected=JSON.parse(await readFile('data/static-resources.json','utf8'));await page.evaluate(async()=>await navigator.serviceWorker.ready);const cached=await page.evaluate(async()=>{const names=await caches.keys();return Promise.all(names.map(async name=>({name,count:(await(await caches.open(name)).keys()).length})));});assert.ok(cached.some(c=>c.name.includes(expected.revision)&&c.count===expected.assets.length));
   const cdp=await context.newCDPSession(page),installed=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installed.installabilityErrors,[]);await cdp.detach();return {cacheRevision:expected.revision,cacheAssets:expected.assets.length,installationErrors:[]};
  });
  await check('live navigation stays on one document, saves no content; immediate editing persists',async()=>{
   await page.evaluate(async base=>{const {storage}=await import(new URL('js/storage.js',base));window.__writes=0;for(const method of ['set','setMany','update','remove']){const original=storage[method].bind(storage);storage[method]=(...args)=>{window.__writes++;return original(...args);};}window.__shell=document.querySelector('.shell3');},base);
   for(const route of ['profile','reading-progress','calendar','settings','home'])await go(route);await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>__writes),0);assert.equal(await page.evaluate(()=>__shell===document.querySelector('.shell3')),true);
   await go('profile');await page.locator('[data-bind="profile.targetMajor"]').fill('线上升级后编辑');await go('calendar');await page.waitForTimeout(700);assert.equal(await page.evaluate(async base=>(await(await import(new URL('js/storage.js',base))).storage.get('current')).profile.targetMajor,base),'线上升级后编辑');
  });
  await check('live reading, calendar reflection, home board and JSON transfer guide work',async()=>{
   await go('reading-progress');await page.locator('#journalReadingForm [name="book"]').fill('管子');await page.locator('#journalReadingForm [name="startPage"]').fill('1');await page.locator('#journalReadingForm [name="endPage"]').fill('12');await page.locator('#journalReadingForm [type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#journalReadingFeedback')?.textContent.includes('已保存'));
   await go('calendar');const date=await page.evaluate(()=>new Date().toLocaleDateString('sv-SE'));await page.locator('[data-journal-date="'+date+'"]').click();await page.locator('[data-journal-status="good"]').click();await page.waitForFunction(()=>document.querySelector('#journalDayPopover')?.hidden);await go('home');assert.match(await page.locator('.home-status-board').textContent(),/良好/);await go('settings');assert.equal(await page.locator('#transferSettings').count(),1);assert.match(await page.locator('[data-transfer-saved]').textContent(),/2026/);
   const backup=await page.evaluate(async base=>(await import(new URL('js/backup.js',base))).getCurrentBackup(),base);assert.ok(Object.keys(backup.data).some(k=>k.startsWith('journal:reading:')));assert.equal(Object.keys(backup.data).some(k=>k.startsWith('meta:')||k.startsWith('resource:official:')),false);
  });
  await check('live grouped practice hides feedback, restores a draft after reload, and grades only on submission',async()=>{
   await page.evaluate(async base=>{const q=await import(new URL('js/modules/quiz.js',base));const s=q.quizStart('english-vocabulary','random',7);q.quizAnswer(0,s.questions[0].options[0].id);await q.waitForQuizWrites();},base);await page.reload();await ready();await page.locator('.home-resume [data-quiz-resume]').click();assert.equal(await page.locator('[data-quiz-jump]').count(),7);assert.equal(await page.locator('.quiz-result,.quiz-explanation').count(),0);
   const record=await page.evaluate(async base=>{const q=await import(new URL('js/modules/quiz.js',base));const s=q.getQuizDraftRecord();s.questions.forEach((question,i)=>q.quizAnswer(i,question.answer));return q.quizSubmit();},base);assert.equal(record.total,7);assert.equal(record.correct,7);await page.evaluate(()=>ResumeStudio.render());assert.equal(await page.locator('.quiz-result').count(),1);
  });
  await check('offline cold launch keeps home, user data, classic, calendar and downloaded banks',async()=>{
   await context.setOffline(true);const offline=await context.newPage();await offline.goto(base,{waitUntil:'domcontentloaded'});await ready(offline);assert.equal(await offline.evaluate(()=>ResumeStudio.getState().profile.name),'旧版升级验收资料');await go('classic:guanzi',offline);assert.equal(await offline.locator('.classic-passage').count(),100);await go('calendar',offline);assert.ok(await offline.locator('[data-journal-date]').count()>=7);await go('quiz',offline);await offline.locator('[data-quiz-bank="english-grammar"]').click();await offline.locator('[data-quiz-start]').click();await offline.waitForSelector('#quizQuestion');assert.equal(await offline.locator('.quiz-explanation').count(),0);await offline.close();await context.setOffline(false);
  });
  await check('warm dark and mobile home have no horizontal overflow or uncaught errors',async()=>{
   await go('home');await page.screenshot({path:path.join(output,'production-home-warm.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'production-home-mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
  });
 }
}finally{await context.setOffline(false).catch(()=>{});await context.close();if(mode!=='prepare'){const report={version:'5.0.0',base,isolatedSyntheticProfile:true,checks,errors,passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length};await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;}}
