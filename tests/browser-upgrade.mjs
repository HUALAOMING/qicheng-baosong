// Opt-in integration acceptance using an existing browser in an isolated context.
// Start scripts/serve.mjs first, then: node tests/browser-upgrade.mjs
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'tests/generated/browser-upgrade');
await mkdir(output,{recursive:true});
const runtime=process.env.QICHENG_PLAYWRIGHT || 'C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(runtime).href);
const executable=process.env.QICHENG_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
await access(executable);
const base=process.env.QICHENG_BASE_URL || 'http://127.0.0.1:4173/';
const browser=await chromium.launch({executablePath:executable,headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true,locale:'zh-CN',timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const errors=[],requests=[],checks=[];
page.on('pageerror',error=>errors.push({kind:'pageerror',message:error.message}));
page.on('console',message=>{if(message.type()==='error')errors.push({kind:'console',message:message.text()});});
page.on('request',request=>requests.push(request.url()));
const report={startedAt:new Date().toISOString(),browser:await browser.version(),base,isolatedContext:true,checks,errors,screenshots:[],limitations:['Headless desktop Edge with emulated viewport/touch; no actual iPhone, Safari or installed-app shell.','Resource update responses are intercepted fixtures; no production service is contacted.']};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(name,fn){
  const start=Date.now();
  try{const detail=await fn();checks.push({name,status:'PASS',milliseconds:Date.now()-start,detail});console.log('PASS '+name);}
  catch(error){checks.push({name,status:'FAIL',milliseconds:Date.now()-start,error:error.stack});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{});await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close())).catch(()=>{});}
  await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2));
}
async function ready(){await page.waitForSelector('#workspaceContent');await page.waitForFunction(async()=>!!(await import('/js/state.js')).ctx.initialized);}
async function go(route){await page.evaluate(async route=>(await import('/js/app.js')).go3(route),route);}
async function getRecords(){return page.evaluate(async()=>(await import('/js/storage.js')).storage.getAll());}
async function saveDownload(action,name){await action();if(await page.locator('#confirmDialog[open]').count())await page.locator('#confirmAccept').click();await page.waitForSelector('#downloadDialog[open]');const [item]=await Promise.all([page.waitForEvent('download'),page.locator('#downloadLink').click()]);const filename=path.join(output,name||item.suggestedFilename());await item.saveAs(filename);await page.locator('#closeDownload').click();return filename;}
async function openQuizFromHome(target=page){await target.locator('.home-shortcuts [data-go3="explore"]').click();await target.locator('.explore-quiz [data-go3="quiz"]').click();}
async function backToBanks(){if(await page.locator('[data-quiz-back]').count())await page.locator('[data-quiz-back]').click();}
async function startGroup(bank,size,mode='random'){
  await go('quiz');await backToBanks();await page.locator('[data-quiz-bank="'+bank+'"]').click();
  await page.locator('#quizMode').selectOption(mode);await page.locator('#quizSize').selectOption(String(size));await page.locator('[data-quiz-start]').click();
  if(await page.locator('#confirmDialog[open]').count())await page.locator('#confirmAccept').click();
  await page.waitForSelector('#quizQuestion');
}
async function currentQuestion(bank){
  const label=await page.locator('.quiz-question > .quiz-actions > span').textContent();
  const id=label.split('·').at(-1).trim();
  return page.evaluate(async({bank,id})=>(await import('/js/resources.js')).listQuizBanks().find(item=>item.bank.id===bank).questions.find(item=>item.id===id),{bank,id});
}
async function completeGroup(bank,size,{wrongFirst=false,favoriteFirst=false}={}){
  const total=await page.locator('[data-quiz-jump]').count();assert.equal(total,size);
  assert.equal(await page.locator('.quiz-explanation,.quiz-result,.quiz-option.correct,.quiz-jump.correct').count(),0);
  await page.locator('[data-quiz-submit]').click();assert.equal(await page.locator('.quiz-result').count(),0);
  for(let i=0;i<total;i++){
    await page.locator('[data-quiz-jump="'+i+'"]').click();const q=await currentQuestion(bank);
    let answer=q.type==='true-false'?(q.answer?0:1):q.options.findIndex(option=>option.id===q.answer);
    if(i===0&&wrongFirst)answer=(answer+1)%(q.options?.length||2);
    await page.locator('[data-quiz-option="'+answer+'"]').click();
    if(i===0&&favoriteFirst){await page.locator('[data-quiz-favorite]').click();await page.waitForFunction(()=>document.querySelector('[data-quiz-favorite]')?.getAttribute('aria-pressed')==='true');}
    assert.equal(await page.locator('.quiz-explanation,.quiz-result').count(),0);
  }
  // Previous/next and changing a selection really update the answer draft.
  if(total>1){await page.locator('[data-quiz-prev]').click();assert.equal(await page.locator('[data-quiz-jump="'+(total-2)+'"]').getAttribute('aria-current'),'step');await page.locator('[data-quiz-next]').click();}
  await page.locator('[data-quiz-jump="0"]').click();const chosen=await page.locator('.quiz-option.selected').getAttribute('data-quiz-option');
  const alternate=String((Number(chosen)+1)%(await page.locator('[data-quiz-option]').count()));
  await page.locator('[data-quiz-option="'+alternate+'"]').click();assert.equal(await page.locator('.quiz-option.selected').getAttribute('data-quiz-option'),alternate);
  await page.locator('[data-quiz-option="'+chosen+'"]').click();
  await page.locator('[data-quiz-submit]').click();await page.waitForSelector('.quiz-result');
  const recent=await page.evaluate(async()=>(await import('/js/modules/quiz.js')).getRecentQuiz());
  assert.equal(recent.total,total);assert.equal(recent.correct,total-(wrongFirst?1:0));
  assert.equal(recent.correct,recent.questions.filter((q,i)=>q.answer===recent.answers[i]).length);
  assert.equal(await page.locator('.quiz-result-stats > div').count(),4);assert.deepEqual(await page.locator('.quiz-result-stats dd').allTextContents(),[String(total),String(recent.correct),String(total-recent.correct),Math.round(recent.correct/total*100)+'%']);
  return recent;
}
let oldFixture,backupFile,portableFile;
try{
  await check('cold boot opens home and makes no manifest update request',async()=>{
    await page.goto(base);await ready();assert.equal(await page.evaluate(async()=>(await import('/js/state.js')).ctx.state.route),'home');
    if(await page.locator('#finishSettings').isVisible())await page.locator('#finishSettings').click();
    assert.equal(requests.filter(url=>/\/data\/resources\/manifest\.json/.test(url)).length,0);
    assert.equal(requests.filter(url=>!url.startsWith(base)&&!url.startsWith('data:')&&!url.startsWith('blob:')).length,0);
  });
  await check('old current record persists files, export history, theme, drafts while startup returns home',async()=>{
    oldFixture=JSON.parse(await readFile(path.join(root,'tests/fixtures/input.json'),'utf8'));
    oldFixture.theme='obsidian';oldFixture.route='profile';
    oldFixture.assets=[{id:'browser-file',name:'retained.txt',mime:'text/plain',kind:'file',data:'data:text/plain;base64,aGVsbG8=',size:5,createdAt:'2026-10-12T00:00:00Z',source:'browser test'},{id:'browser-export',name:'retained.md',mime:'text/markdown',kind:'export',data:'data:text/markdown;base64,IyBoaQ==',size:4,createdAt:'2026-10-12T00:00:00Z',source:'browser test'}];
    oldFixture.exportHistory=[{id:'browser-export-log',assetId:'browser-export',name:'retained.md',type:'md',createdAt:'2026-10-12T00:00:00Z',versionId:oldFixture.versions[0].id,purpose:'resume'}];
    await page.evaluate(async fixture=>{const {storage}=await import('/js/storage.js');const {validateDraft}=await import('/js/utils/validation.js');await storage.set('current',validateDraft(fixture));},oldFixture);
    await page.reload();await ready();const state=await page.evaluate(async()=>(await import('/js/state.js')).ctx.state);
    assert.equal(state.route,'home');assert.equal(state.theme,'obsidian');assert.deepEqual(state.assets,oldFixture.assets);assert.deepEqual(state.exportHistory,oldFixture.exportHistory);assert.deepEqual(state.profile,oldFixture.profile);for(const key of ['awardDraft','experienceDraft','practiceDraft','achievementDraft','examDraft','bookDraft','versions','learning'])assert.deepEqual(state[key],oldFixture[key]);
  });
  await check('navigation, legacy pages and menu toggle remain usable',async()=>{
    await page.locator('.home-shortcuts [data-go3="profile"]').click();assert.equal(await page.evaluate(async()=>(await import('/js/state.js')).ctx.state.route),'profile');
    const toggle=page.locator('.menu-toggle');const expanded=await toggle.getAttribute('aria-expanded');await toggle.click();assert.notEqual(await toggle.getAttribute('aria-expanded'),expanded);await toggle.click();
    const routes=['profile','education','statement','academics','awards','experiences','practices','sort-awards','sort-experiences','sort-practices','learning','achievements','custom','dashboard','images','files','outputs','studio','archive','schools'];
    for(const route of routes){await go(route);assert.ok((await page.locator('#workspaceContent').textContent()).trim().length>10,route);}
  });
  await check('4.2 home and menu open the learning center with quiz and four classics',async()=>{
    await go('home');assert.match(await page.locator('.home-shortcuts [data-go3="explore"]').textContent(),/学习拓展中心/);
    await page.locator('.home-shortcuts [data-go3="explore"]').click();assert.equal(await page.locator('.explore-center h1').textContent(),'学习拓展中心');
    assert.equal(await page.locator('.explore-book').count(),4);assert.equal(await page.locator('.explore-quiz [data-go3="quiz"]').count(),1);
    await page.locator('.explore-quiz [data-go3="quiz"]').click();assert.equal(await page.locator('#quizSize').count(),1);await page.locator('#workspaceContent > [data-go3="explore"]').click();
    for(const id of ['lunyu','daodejing','zhuangzi']){await page.locator('[data-go3="classic:'+id+'"]').click();assert.match(await page.locator('.classic-empty').textContent(),/尚未收录/);await page.locator('.classic-reader > [data-go3="explore"]').click();}
    const state=await page.evaluate(()=>window.ResumeStudio.getState());assert.deepEqual(state.profile,oldFixture.profile);assert.deepEqual(state.assets,oldFixture.assets);
  });
  await check('Guanzi reader preserves 100 passages and source, filters chapters and downloads the exact Markdown',async()=>{
    await page.locator('[data-go3="classic:guanzi"]').click();assert.equal(await page.locator('.classic-passage').count(),100);assert.equal(await page.locator('#classicChapter option').count(),27);
    assert.match(await page.locator('#guanzi-030').textContent(),/必顺于礼义/);assert.match(await page.locator('#guanzi-061').textContent(),/政平则人安；士教和/);assert.match(await page.locator('#guanzi-100').textContent(),/轻重无数。物发而应之，闻声而乘之/);
    assert.match(await page.locator('.classic-afterword').textContent(),/能准确复述原文/);
    await page.locator('#classicSearch').fill('方圜');assert.equal(await page.locator('.classic-passage').count(),1);assert.equal(await page.locator('#guanzi-059').count(),1);
    await page.locator('#classicChapter').selectOption('一、牧民第一');assert.equal(await page.locator('.classic-passage').count(),0);assert.match(await page.locator('.classic-no-results').textContent(),/未找到/);
    await page.locator('#classicSearch').fill('');assert.equal(await page.locator('.classic-passage').count(),7);await page.locator('#classicChapter').selectOption('');assert.equal(await page.locator('.classic-passage').count(),100);
    await page.locator('.classic-source summary').click();assert.match(await page.locator('.classic-source').textContent(),/ISBN 9787101133325/);assert.match(await page.locator('.classic-source').textContent(),/校勘重点/);
    const sourceFile=await saveDownload(()=>page.locator('[data-classic-download]').click(),'guanzi-source.md');assert.equal(createHash('sha256').update(await readFile(sourceFile)).digest('hex'),'0822133bfe03e4b1d2dfd20c3b35139d47c6bbf01699eab18974d26fb600c8c5');
    await page.screenshot({path:path.join(output,'guanzi-reader-desktop.png'),fullPage:false});await page.locator('.classic-reader > [data-go3="explore"]').click();
  });
  await check('settings retains themes and Markdown template/import/export through existing controls',async()=>{
    await page.evaluate(()=>window.ResumeStudio.openSettings());
    assert.equal(await page.locator('.sidebar-tools button').count(),2);
    const template=await saveDownload(()=>page.locator('#settingsDialog [data-md-template31]').click(),'template.md');assert.match(await readFile(template,'utf8'),/基本信息/);
    await page.locator('#settingsDialog [data-md-import31]').click();await page.locator('#mdFile31').setInputFiles({name:'materials.md',mimeType:'text/markdown',buffer:Buffer.from('## 基本信息\n- 姓名：浏览器导入同学\n','utf8')});
    await page.waitForFunction(()=>window.ResumeStudio.getState().profile.name==='浏览器导入同学');await page.waitForFunction(async()=>!document.querySelector('#mdImport31[open]')&&!(await import('/js/state.js')).ctx.busy);
    await page.evaluate(()=>window.ResumeStudio.openSettings());
    const exported=await saveDownload(()=>page.locator('#settingsDialog [data-settings-md-export]').click(),'exported.md');assert.match(await readFile(exported,'utf8'),/浏览器导入同学/);
  });
  await check('countdown saved through UI and day-based quote functions',async()=>{
    await go('home');await page.locator('.home-countdown-editor summary').click();await page.locator('#homeCountdownForm input[name="name"]').fill('验收目标');await page.locator('#homeCountdownForm input[name="date"]').fill('2027-01-01');await page.locator('#homeCountdownForm button').click();
    await page.waitForFunction(()=>document.querySelector('.home-countdown h2')?.textContent==='验收目标');
    assert.deepEqual((await getRecords())['settings:countdown'],{name:'验收目标',date:'2027-01-01'});
    const result=await page.evaluate(async()=>{const h=await import('/js/modules/home.js');const r={quotes:[{text:'first'},{text:'second'},{text:'third'}]};const day=new Date(2026,9,13,1);return{a:h.homeQuoteForDate(r,day),b:h.homeQuoteForDate(r,new Date(2026,9,13,23)),next:h.homeQuoteForDate(r,new Date(2026,9,14,1)),today:h.homeCountdownDays(new Date(2027,0,1)),after:h.homeCountdownDays(new Date(2027,0,2))};});
    assert.deepEqual(result.a,result.b);assert.notDeepEqual(result.a,result.next);assert.equal(result.today,0);assert.equal(result.after,-1);
  });
  await check('activity rail changes only on manual paging',async()=>{
    await go('home');await page.locator('[data-home-card="2"]').click();await page.waitForFunction(()=>document.querySelector('[data-home-card="2"]').getAttribute('aria-pressed')==='true');const before=await page.locator('#homeCardRail').evaluate(el=>el.scrollLeft);await wait(1200);assert.equal(await page.locator('#homeCardRail').evaluate(el=>el.scrollLeft),before);
  });
  for(const [bank,size] of [['english-grammar',10],['english-vocabulary',20]])await check(bank+' '+size+' grouped questions with delayed grading',async()=>{await startGroup(bank,size);return completeGroup(bank,size,{wrongFirst:true,favoriteFirst:true});});
  await check('wrong-answer and favorite practice reuse recorded marks',async()=>{
    await startGroup('english-grammar',10,'wrong');await completeGroup('english-grammar',1);
    await startGroup('english-grammar',10,'favorites');await completeGroup('english-grammar',1);
  });
  // Review the deliberately wrong questions before later random groups may correctly answer them.
  for(const [bank,size] of [['english-grammar',20],['english-vocabulary',10]])await check(bank+' '+size+' alternate size works',async()=>{await startGroup(bank,size);return completeGroup(bank,size);});
  await check('Chinese starter banks empty and custom true-false JSON works',async()=>{
    await go('quiz');await backToBanks();await page.locator('[data-quiz-bank="chinese-ancient-culture"]').click();assert.equal(await page.locator('[data-quiz-start]').isDisabled(),true);
    const resource={schemaVersion:1,bank:{id:'browser-chinese-tf',name:'验收判断题',subject:'chinese',section:'ancient-culture',version:'1.0.0'},questions:[{id:'browser-tf-1',type:'true-false',question:'验收用判断题：请选择正确。',answer:true,explanation:'用于交互验证的合成题。'},{id:'browser-tf-2',type:'true-false',question:'验收用判断题：请选择错误。',answer:false,explanation:'用于交互验证的合成题。'}]};
    await page.evaluate(()=>window.ResumeStudio.openSettings(false,true));await page.locator('#resourceJSONInput').setInputFiles({name:'custom.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(resource))});await page.waitForFunction(()=>document.querySelector('#resourceResult')?.textContent.includes('已导入并保存'));await page.locator('#finishSettings').click();
    await startGroup('browser-chinese-tf',10);await completeGroup('browser-chinese-tf',2);
  });
  await check('invalid resource JSON is rejected without changing IDB',async()=>{
    const before=await getRecords();const message=await page.evaluate(async()=>{try{await(await import('/js/resources.js')).importResourceJSON('{broken');return '';}catch(error){return error.message;}});assert.match(message,/JSON/);assert.deepEqual(await getRecords(),before);
  });
  await check('online update button downloads verified bank and daily quotes; failure keeps every old resource',async()=>{
    const bank=await page.evaluate(async()=>(await import('/js/resources.js')).listQuizBanks().find(item=>item.bank.id==='english-grammar'));
    delete bank.origin;bank.bank.version='1.0.1';
    const quotes={schemaVersion:1,version:'1.0.1',quotes:[{id:'QA-Q1',text:'浏览器验收用每日一句甲',source:'合成测试资源'},{id:'QA-Q2',text:'浏览器验收用每日一句乙',source:'合成测试资源'},{id:'QA-Q3',text:'浏览器验收用每日一句丙',source:'合成测试资源'}]};
    const payloads={'english-grammar':JSON.stringify(bank),'daily-quotes':JSON.stringify(quotes)};
    let corrupt=false;
    await context.route('**/data/resources/manifest.json',async route=>{
      const resources=Object.entries(payloads).map(([id,bytes])=>({id,type:id==='daily-quotes'?'quotes':'quiz-bank',version:corrupt?'1.0.2':'1.0.1',url:'https://qicheng-test.invalid/'+id+'.json',sha256:corrupt&&id==='daily-quotes'?'0'.repeat(64):createHash('sha256').update(bytes).digest('hex')}));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaVersion:1,resources})});
    });
    await context.route('https://qicheng-test.invalid/**',async route=>route.fulfill({status:200,contentType:'application/json',body:payloads[new URL(route.request().url()).pathname.slice(1,-5)]}));
    await go('home');await page.evaluate(()=>window.ResumeStudio.save());await page.evaluate(()=>window.ResumeStudio.openSettings(false,true));
    await page.locator('[data-resource-update]').click();await page.waitForFunction(()=>document.querySelector('#resourceResult')?.textContent.includes('已更新并保存'));
    assert.equal((await getRecords())['resource:official:english-grammar'].bank.version,'1.0.1');
    assert.equal((await getRecords())['resource:official:daily-quotes'].quotes.length,3);
    const before=await getRecords();corrupt=true;
    // Make the bank valid at the newer version so the later quote checksum fails atomically.
    bank.bank.version='1.0.2';payloads['english-grammar']=JSON.stringify(bank);
    await page.locator('[data-resource-update]').click();await page.waitForFunction(()=>document.querySelector('#resourceResult')?.textContent.includes('更新失败'));
    assert.match(await page.locator('#resourceResult').textContent(),/SHA-256/);assert.deepEqual(await getRecords(),before);
    await page.locator('#finishSettings').click();await go('home');assert.match(await page.locator('.home-quote').textContent(),/浏览器验收用每日一句/);
  });
  await check('backup download contains all user records and excludes official resources',async()=>{
    await go('backup');backupFile=await saveDownload(()=>page.locator('#workspaceContent [data-action="backup"]').click(),'backup.json');
    const data=JSON.parse(await readFile(backupFile,'utf8')).data;assert.ok(data.current);assert.ok(data['settings:countdown']);assert.ok(data['resource:custom:browser-chinese-tf']);assert.ok(Object.keys(data).some(key=>key.startsWith('quiz:record:')));assert.ok(Object.keys(data).some(key=>key.startsWith('quiz:mark:')));assert.equal(Object.keys(data).some(key=>key.startsWith('resource:official:')),false);assert.deepEqual(data.current.assets.filter(asset=>['browser-file','browser-export'].includes(asset.id)),oldFixture.assets);for(const key of ['route','section','step','menuOpen','sidebarHidden'])assert.equal(Object.hasOwn(data.current,key),false);
  });
  await check('backup restore through file input preserves official installed bank',async()=>{
    await page.locator('#backupInput').setInputFiles(backupFile);await page.waitForSelector('#confirmDialog[open]');await page.locator('#confirmAccept').click();await page.waitForFunction(async()=>!(await import('/js/state.js')).ctx.busy);assert.equal((await getRecords())['resource:official:english-grammar'].bank.version,'1.0.1');
    const prior=await getRecords();await page.locator('#backupInput').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await wait(200);assert.deepEqual(await getRecords(),prior);
  });
  await check('portable file download bundles user and installed resource records',async()=>{
    await go('backup');portableFile=await saveDownload(()=>page.locator('#workspaceContent [data-action="offlineCopy"]').click(),'portable.html');assert.ok((await readFile(portableFile)).length>100000);
  });
  await check('service worker, install manifest, offline fresh page and downloaded IDB reuse',async()=>{
    const cdp=await context.newCDPSession(page);const installability=await cdp.send('Page.getInstallabilityErrors');assert.ok(installability.installabilityErrors.every(error=>error.errorId==='in-incognito'));report.incognitoInstallability=installability.installabilityErrors;await cdp.detach();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await ready();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const manifest=await page.evaluate(async()=>{const url=document.querySelector('link[rel="manifest"]').href;return(await fetch(url)).json();});assert.ok(manifest.name);assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));assert.ok(['standalone','minimal-ui'].includes(manifest.display));
    await context.setOffline(true);const fresh=await context.newPage();await fresh.goto(base);await fresh.waitForSelector('.home-dashboard');assert.equal(await fresh.evaluate(async()=>(await import('/js/resources.js')).listQuizBanks().find(item=>item.bank.id==='english-grammar').bank.version),'1.0.1');assert.equal(await fresh.evaluate(async()=>(await import('/js/modules/quiz.js')).getRecentQuiz().total),2);assert.match(await fresh.locator('.home-quote').textContent(),/浏览器验收用每日一句/);await openQuizFromHome(fresh);assert.equal(await fresh.locator('[data-quiz-bank="english-grammar"] span').textContent(),'118 题');await fresh.locator('[data-quiz-bank="english-vocabulary"]').click();await fresh.locator('#quizMode').selectOption('random');await fresh.locator('[data-quiz-start]').click();assert.equal(await fresh.locator('[data-quiz-jump]').count(),10);assert.equal(await fresh.locator('.quiz-explanation').count(),0);await fresh.evaluate(async()=>(await import('/js/app.js')).go3('classic:guanzi'));assert.equal(await fresh.locator('.classic-passage').count(),100);await fresh.locator('#classicSearch').fill('方圜');assert.equal(await fresh.locator('#guanzi-059').count(),1);await fresh.close();await context.setOffline(false);
  });
  await check('Windows Edge installability has no errors in an isolated normal profile',async()=>{
    const profile=await mkdtemp(path.join(output,'installability-profile-'));
    let persistent;
    try {
      persistent=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,viewport:{width:1280,height:900},reducedMotion:'reduce'});
      const installedPage=await persistent.newPage();await installedPage.goto(base);await installedPage.waitForSelector('.home-dashboard');
      if(await installedPage.locator('#finishSettings').isVisible())await installedPage.locator('#finishSettings').click();
      await installedPage.evaluate(async()=>await navigator.serviceWorker.ready);await installedPage.reload();await installedPage.waitForSelector('.home-dashboard');
      const cdp=await persistent.newCDPSession(installedPage);const result=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(result.installabilityErrors,[]);report.normalProfileInstallability=result;await cdp.detach();
    } finally {
      await persistent?.close();
      if(!path.resolve(profile).startsWith(path.resolve(output)+path.sep))throw new Error('Temporary profile cleanup escaped test directory.');
      await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
    }
  });
  await check('portable file works under file URL offline with all learning state',async()=>{
    const offline=await browser.newContext({offline:true,viewport:{width:1280,height:900}});const portable=await offline.newPage();const portableErrors=[];portable.on('pageerror',error=>portableErrors.push(error.message));
    try{await portable.goto(pathToFileURL(portableFile).href);await portable.waitForSelector('.home-dashboard');assert.match(await portable.locator('.home-countdown').textContent(),/验收目标/);assert.match(await portable.locator('.home-versions').textContent(),/1\.0\.1/);await openQuizFromHome(portable);assert.ok(await portable.locator('[data-quiz-bank="browser-chinese-tf"]').count());assert.ok(await portable.locator('[data-quiz-review]').count());await portable.evaluate(()=>window.ResumeStudio.go3('classic:guanzi'));assert.equal(await portable.locator('.classic-passage').count(),100);assert.match(await portable.locator('#guanzi-061').textContent(),/政平则人安；士教和/);assert.deepEqual(portableErrors,[]);await portable.screenshot({path:path.join(output,'portable-offline.png'),fullPage:true});}finally{await offline.close();}
  });
  await check('three themes at desktop tablet and mobile widths include center and classics without overflow',async()=>{
    for(const [device,width,height] of [['desktop',1280,900],['tablet',820,1180],['mobile',390,844]]){
      await page.setViewportSize({width,height});
      for(const theme of ['pudding','obsidian','blue']){
        await page.evaluate(async theme=>{const {ctx}=await import('/js/state.js');ctx.state.theme=theme;(await import('/js/app.js')).render();},theme);
        for(const route of ['home','profile','quiz','explore','classic:guanzi']){
          await go(route);if(route==='quiz')await backToBanks();const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(dimensions.scroll<=dimensions.client+1,device+' '+theme+' '+route+' '+JSON.stringify(dimensions));
          const name=device+'-'+theme+'-'+route.replace(':','-')+'.png';await page.screenshot({path:path.join(output,name),fullPage:!route.startsWith('classic:')});report.screenshots.push(name);
        }
      }
    }
  });
  await check('touch device can open menu and manually page activity cards',async()=>{
    const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const mobile=await touch.newPage();
    try{await mobile.goto(base);await mobile.waitForSelector('.home-dashboard');if(await mobile.locator('#finishSettings').isVisible())await mobile.locator('#finishSettings').tap();await mobile.locator('.menu-toggle').tap();assert.equal(await mobile.locator('.menu-toggle').getAttribute('aria-expanded'),'true');await mobile.locator('.menu-toggle').tap();await mobile.locator('[data-home-card="1"]').tap();await mobile.waitForFunction(()=>document.querySelector('[data-home-card="1"]').getAttribute('aria-pressed')==='true');await mobile.screenshot({path:path.join(output,'mobile-touch.png'),fullPage:true});}finally{await touch.close();}
  });
  await check('no unexpected browser console or uncaught errors',async()=>{assert.deepEqual(errors,[]);});
}finally{
  await context.setOffline(false).catch(()=>{});await context.close();await browser.close();report.finishedAt=new Date().toISOString();report.passed=checks.filter(item=>item.status==='PASS').length;report.failed=checks.filter(item=>item.status==='FAIL').length;report.result=report.failed?'FAIL':'PASS';await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,passed:report.passed,failed:report.failed,output}));if(report.failed)process.exitCode=1;
}
