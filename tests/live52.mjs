// Production update acceptance uses one isolated, synthetic-data-only Edge profile.
import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const mode=process.argv[2]||'verify',base='https://hualaoming.github.io/qicheng-baosong/';
const output=path.resolve('tests/generated/live52'),profile=path.join(output,'isolated-upgrade-profile');await mkdir(output,{recursive:true});
const context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',acceptDownloads:true});
const page=context.pages()[0]||await context.newPage(),errors=[],checks=[];page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
async function ready(p=page){await p.waitForFunction(()=>window.ResumeStudio);if(await p.locator('#startupChoice52[open]').count())await p.locator('#startupContinue52').click();}
async function go(route,p=page){await p.evaluate(route=>ResumeStudio.go3(route),route);}
async function check(name,fn){try{const detail=await fn();checks.push({name,status:'PASS',detail});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL '+name+': '+e.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png')}).catch(()=>{});}}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await ready();
 if(mode==='prepare'){
  assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.1.0');
  await page.evaluate(async base=>{
   const s=ResumeStudio.fresh();s.profile.name='5.1至5.2隔离升级资料';s.profile.targetSchool='浙江大学';s.dreamSchools=['浙江大学','哈尔滨工业大学','北京大学'];s.theme='blue';s.onboarded=true;s.statement.zh='保留原有陈述';s.assets=[{id:'upgrade52-file',name:'升级保留.txt',mime:'text/plain',kind:'file',data:'data:text/plain;base64,cHJlc2VydmU1Mg==',size:10,createdAt:'2026-10-26T00:00:00Z',source:'isolated acceptance fixture'}];ResumeStudio.setState(s);await ResumeStudio.save();
   const home=await import(new URL('js/modules/home.js',base));await home.saveHomePreferences({motto:'启程，加油！',featuredSchool:'哈尔滨工业大学'});await home.saveHomeCountdown({name:'保留目标日',date:'2027-01-15'});
   const journal=await import(new URL('js/modules/journal.js',base));await journal.saveReadingProgress({id:'legacy-reading52',date:'2026-10-25',book:'管子',startPage:1,endPage:12});await journal.saveDailyStatus('2026-10-25','good');
   const quiz=await import(new URL('js/modules/quiz.js',base));const session=quiz.quizStart('english-grammar','random',3);session.questions.forEach((q,i)=>quiz.quizAnswer(i,q.answer));await quiz.quizSubmit();await quiz.quizFavorite('english-grammar',session.questions[0].id);
   await ResumeStudio.importResourceJSON({schemaVersion:1,bank:{id:'upgrade52-pack',name:'保留自定义题库',subject:'custom',section:'custom',version:'1.0.0'},questions:[{id:'keep-q',type:'true-false',question:'升级保留题目',answer:true,explanation:'用于验证保留'}]},{newBankName:'保留自定义题库'});
  },base);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated';});
  const before=await page.evaluate(async base=>({version:ResumeStudio.version,state:ResumeStudio.getState(),records:await(await import(new URL('js/storage.js',base))).storage.getAll()}),base);await writeFile(path.join(output,'before.json'),JSON.stringify(before,null,2));
  console.log('PREPARED 5.1.0 installed PWA, old page-based reading, profile/files, favorites, custom bank, quiz and Home settings.');
 }else{
  await check('installed 5.1 updates through Check update at the same address',async()=>{
   const initial=await page.evaluate(()=>ResumeStudio.version);assert.equal(initial,'5.1.0');await go('settings');await page.locator('[data-pwa-check]').click();await page.waitForSelector('[data-pwa-refresh]:not([hidden])',{timeout:180000});await page.locator('[data-pwa-refresh]').click();await page.waitForFunction(()=>window.ResumeStudio?.version==='5.2.0',{},{timeout:180000});await ready();assert.equal(await page.evaluate(()=>ResumeStudio.getState().route),'home');return {initial,updated:'5.2.0'};
  });
  await check('profile, files, statement, targets, legacy reading and all learning records survive',async()=>{
   const before=JSON.parse(await readFile(path.join(output,'before.json'),'utf8')),after=await page.evaluate(()=>ResumeStudio.getState());assert.deepEqual(after.profile,before.state.profile);assert.deepEqual(after.assets,before.state.assets);assert.deepEqual(after.dreamSchools,before.state.dreamSchools);assert.equal(after.statement.zh,before.state.statement.zh);assert.equal(after.theme,before.state.theme);assert.deepEqual(after.introductions,[]);
   const data=await page.evaluate(async base=>(await import(new URL('js/storage.js',base))).storage.getAll(),base);for(const [key,value]of Object.entries(before.records))if(key.startsWith('quiz:')||key.startsWith('journal:')||key.startsWith('settings:')||key.startsWith('resource:custom:'))assert.deepEqual(data[key],value,key);assert.equal(data['journal:reading:legacy-reading52'].endPage,12);
  });
  await check('published assets and complete installed cache match the 5.2 release candidate',async()=>{
   for(const filename of ['js/constants.js','js/app.js','js/modules/home.js','js/modules/page-help52.js','css/polish52.css','css/home-polish52.css','service-worker.js','manifest.webmanifest','data/static-resources.json']){
    const actual=await page.evaluate(async({base,filename})=>{const r=await fetch(new URL(filename+'?acceptance='+Date.now(),base),{cache:'no-store'});if(!r.ok)throw Error(r.status);return r.text();},{base,filename});assert.equal(actual,await readFile(path.resolve(filename),'utf8'),filename);
   }
   const expected=JSON.parse(await readFile('data/static-resources.json','utf8'));const installed=await page.evaluate(async()=>Promise.all((await caches.keys()).map(async name=>({name,count:(await(await caches.open(name)).keys()).length}))));assert.ok(installed.some(c=>c.name.includes(expected.revision)&&c.count===expected.assets.length));return {revision:expected.revision,cacheAssets:expected.assets.length};
  });
  await check('online Home has multiple dream universities and help changes with the page',async()=>{
   await go('home');assert.ok(await page.locator('.home-dream-others52 [data-home-dream-school52]').count()>=1);await page.locator('#helpToggle').click();const home=await page.locator('#helpPanel').textContent();await go('dashboard');await page.locator('#helpToggle').click();const score=await page.locator('#helpPanel').textContent();assert.notEqual(home,score);assert.match(score,/权重|weights/);assert.match(score,/100/);await page.locator('#helpToggle').click();
  });
  await check('new reading, introduction and complete JSON round-trip work on production',async()=>{
   await go('reading-progress');await page.locator('#journalReadingForm [name="book"]').fill('新增章节阅读');await page.locator('#journalReadingForm [name="author"]').fill('测试作者');await page.locator('#journalReadingForm [name="language"]').fill('中文');await page.locator('#journalReadingForm [name="chapter"]').fill('第二章');await page.locator('#journalReadingForm [type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#journalReadingFeedback')?.textContent.includes('已保存'));
   await go('self-introductions');await page.locator('[data-intro-new52]').click();await page.locator('[name="language"]').fill('中文');await page.locator('[name="body"]').fill('这是升级后录入的自我介绍。');await page.locator('#introductionForm52 [type="submit"]').click();await page.evaluate(()=>ResumeStudio.save());const backup=await page.evaluate(async base=>(await import(new URL('js/backup.js',base))).getCurrentBackup(),base);assert.equal(backup.appVersion,'5.2.0');assert.equal(backup.data.current.introductions.length,1);assert.ok(Object.values(backup.data).some(v=>v?.chapter==='第二章'));
  });
  await check('offline cold launch after update keeps user data and all new program modules',async()=>{
   await context.setOffline(true);const offline=await context.newPage();await offline.goto(base,{waitUntil:'domcontentloaded'});await ready(offline);assert.equal(await offline.evaluate(()=>ResumeStudio.version),'5.2.0');assert.equal(await offline.evaluate(()=>ResumeStudio.getState().profile.name),'5.1至5.2隔离升级资料');await go('self-introductions',offline);assert.ok(await offline.locator('.intro-script52,.intro-card52').count());await go('dashboard',offline);await offline.locator('#helpToggle').click();assert.match(await offline.locator('#helpPanel').textContent(),/权重/);await offline.close();await context.setOffline(false);
  });
  await check('three production themes, mobile layout and update check stay healthy',async()=>{
   for(const theme of ['pudding','obsidian','blue']){await go('settings');await page.locator('[data-setting-theme="'+theme+'"]').click();await go('home');await page.screenshot({path:path.join(output,'home-'+theme+'.png'),fullPage:true});}
   await page.setViewportSize({width:390,height:844});for(const route of ['home','settings','dashboard','reading-progress']){await go(route);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route);}await go('settings');await page.locator('[data-pwa-check]').click();await page.waitForSelector('[data-pwa-check]:not([disabled])',{timeout:90000});assert.match(await page.locator('[data-pwa-update-status]').textContent(),/最新版本/);assert.deepEqual(errors,[]);
  });
 }
}finally{
 await context.setOffline(false).catch(()=>{});await context.close();
 if(mode!=='prepare'){const result={version:'5.2.0',base,isolatedSyntheticProfile:true,checks,errors,passed:checks.filter(x=>x.status==='PASS').length,failed:checks.filter(x=>x.status==='FAIL').length};await writeFile(path.join(output,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,failed:result.failed,errors}));if(result.failed||errors.length)process.exitCode=1;}
}
