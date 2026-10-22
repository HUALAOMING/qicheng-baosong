import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('tests/generated/library');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:960},locale:'zh-CN',timezoneId:'Asia/Shanghai',acceptDownloads:true});
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
const go=route=>page.evaluate(route=>ResumeStudio.go3(route),route);
const raw=id=>({schemaVersion:1,bank:{id,name:'验收题目包 '+id,subject:'english',section:'grammar',version:'1.0.0'},questions:[{id:'Q1',type:'true-false',question:'题目包 '+id,answer:false,explanation:'提交后才能显示的解析'}]});
const selectJSON=async data=>{await page.locator('#resourceJSONInput').setInputFiles({name:'bank.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});};
const packCount=()=>page.locator('[data-pack-delete]').count();
let customId;
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png'),fullPage:true});}}
try{
  await page.goto('http://127.0.0.1:4179/');await page.waitForFunction(()=>window.ResumeStudio);await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await page.waitForFunction(()=>window.ResumeStudio);
  await check('four default practice choices; opening menus and switching pages never save current',async()=>{
    await page.evaluate(async()=>{const {storage}=await import('/js/storage.js');window.currentWrites=0;const set=storage.set;storage.set=(key,value)=>{if(key==='current')window.currentWrites++;return set(key,value);};});
    for(const route of ['quiz','settings','home','profile','quiz'])await go(route);await page.locator('.menu-toggle').click();await page.locator('.menu-toggle').click();await page.waitForTimeout(650);
    assert.equal(await page.locator('[data-quiz-bank]').count(),4);assert.equal(await page.evaluate(()=>window.currentWrites),0);
  });
  await check('JSON preview waits for destination and confirmation, then merges into an existing default bank',async()=>{
    await page.locator('[data-action="resources"]').click();await selectJSON(raw('browser-one'));await page.waitForSelector('#quizImportTarget');
    assert.equal(await packCount(),0);await page.locator('#quizImportTarget').selectOption('chinese-usage');await page.locator('[data-bank-import-confirm]').click();await page.waitForFunction(()=>document.querySelector('[data-pack-delete="browser-one"]'));
    await go('quiz');assert.equal(await page.locator('[data-quiz-bank]').count(),4);assert.match(await page.locator('[data-quiz-bank="chinese-usage"]').textContent(),/1 题/);
  });
  await check('two packs with the same question ID share one bank and both can be answered',async()=>{
    await go('settings');await selectJSON(raw('browser-two'));await page.waitForSelector('#quizImportTarget');await page.locator('#quizImportTarget').selectOption('chinese-usage');await page.locator('[data-bank-import-confirm]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-pack-delete]').length===2);
    await go('quiz');await page.locator('[data-quiz-bank="chinese-usage"]').click();await page.locator('#quizSize').fill('20');await page.locator('[data-quiz-start]').click();
    assert.equal(await page.locator('[data-quiz-jump]').count(),2);assert.equal(await page.locator('.quiz-explanation,.quiz-result').count(),0);
    await page.evaluate(async()=>{const q=await import('/js/modules/quiz.js');q.quizAnswer(0,true);q.quizAnswer(1,true);await q.quizFavorite('chinese-usage',q.getQuizDraftRecord().questions[0].id);});
    await page.locator('[data-quiz-submit]').click();await page.waitForSelector('.quiz-result');assert.equal(await page.locator('.quiz-explanation').count(),1);
    const marks=await page.evaluate(async()=>Object.entries(await(await import('/js/storage.js')).storage.getPrefix('quiz:mark:')));assert.equal(marks.length,2);assert.ok(marks.some(([key])=>key.includes('browser-one/Q1')));
  });
  await check('users create a named bank and import into it without creating a second entry',async()=>{
    await go('settings');await page.locator('.quiz-library details summary').click();await page.locator('#practiceBankName').fill('我的专项题库');await page.locator('#practiceBankCategory').selectOption('chinese:ancient-culture');await page.locator('[data-bank-create]').click();await page.waitForFunction(()=>document.querySelectorAll('[data-bank-delete]').length===1);
    customId=await page.locator('[data-bank-delete]').getAttribute('data-bank-delete');await selectJSON(raw('browser-three'));await page.waitForSelector('#quizImportTarget');await page.locator('#quizImportTarget').selectOption(customId);await page.locator('[data-bank-import-confirm]').click();await page.waitForFunction(()=>document.querySelector('[data-pack-delete="browser-three"]'));
    await go('quiz');if(await page.locator('[data-quiz-back]').count())await page.locator('[data-quiz-back]').click();assert.equal(await page.locator('[data-quiz-bank]').count(),5);assert.match(await page.locator(`[data-quiz-bank="${customId}"]`).textContent(),/我的专项题库.*1 题/);
  });
  await check('reimport updates and moves a pack; invalid and cancelled imports leave installed content unchanged',async()=>{
    await go('settings');await selectJSON({...raw('browser-one'),questions:[{...raw('browser-one').questions[0],question:'修订题干'}]});await page.waitForSelector('#quizImportTarget');await page.locator('#quizImportTarget').selectOption(customId);await page.locator('[data-bank-import-confirm]').click();await page.waitForSelector('#resourceResult:has-text("题目已导入")');
    const before=await page.evaluate(async()=>await(await import('/js/storage.js')).storage.getAll());await selectJSON('{bad json');await page.waitForSelector('#resourceResult:has-text("导入失败")');assert.deepEqual(await page.evaluate(async()=>await(await import('/js/storage.js')).storage.getAll()),before);
    await selectJSON(raw('cancelled'));await page.waitForSelector('#quizImportTarget');await page.locator('[data-bank-import-cancel]').click();assert.deepEqual(await page.evaluate(async()=>await(await import('/js/storage.js')).storage.getAll()),before);
  });
  await check('deletion is confirmed, removes only selected imported content and preserves result snapshots',async()=>{
    await page.locator('[data-pack-delete="browser-two"]').click();await page.waitForSelector('#confirmDialog[open]');await page.locator('#confirmAccept').click();await page.waitForFunction(()=>!document.querySelector('[data-pack-delete="browser-two"]'));
    await page.locator(`[data-bank-delete="${customId}"]`).click();await page.waitForSelector('#confirmDialog[open]');await page.locator('#confirmAccept').click();await page.waitForFunction(()=>!document.querySelector('[data-bank-delete]'));
    assert.equal(await packCount(),0);await go('quiz');if(await page.locator('[data-quiz-back]').count())await page.locator('[data-quiz-back]').click();assert.equal(await page.locator('[data-quiz-bank]').count(),4);assert.equal(await page.locator('[data-quiz-review]').count(),1);await page.locator('[data-quiz-review]').click();await page.waitForSelector('.quiz-result');
  });
  await check('bank names and import controls work at Android width without horizontal overflow',async()=>{
    await page.setViewportSize({width:390,height:844});await go('settings');await selectJSON(raw('mobile-pack'));await page.waitForSelector('#quizImportTarget');await page.screenshot({path:path.join(output,'mobile-import.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#quizImportTarget').selectOption('chinese-usage');await page.locator('[data-bank-import-confirm]').click();await page.waitForFunction(()=>document.querySelector('[data-pack-delete="mobile-pack"]'));
  });
  await check('offline restart preserves imported questions and supports complete submitted practice',async()=>{
    await context.setOffline(true);await page.reload();await page.waitForSelector('.home-dashboard');await go('quiz');assert.equal(await page.locator('[data-quiz-bank]').count(),4);await page.locator('[data-quiz-bank="chinese-usage"]').click();await page.locator('#quizSize').fill('10');await page.locator('[data-quiz-start]').click();
    assert.equal(await page.locator('.quiz-explanation').count(),0);await page.evaluate(async()=>{const q=await import('/js/modules/quiz.js');q.quizAnswer(0,false);await q.quizSubmit();ResumeStudio.render();});await page.waitForSelector('.quiz-result');
    await go('settings');await page.locator('[data-pwa-check]').click();await page.waitForSelector('[data-pwa-update-status]:has-text("当前离线")');
  });
  await check('an edit immediately followed by navigation still saves; console has no uncaught errors',async()=>{
    await go('profile');await page.locator('[data-bind="profile.name"]').fill('切页后仍保存');await go('home');await page.waitForTimeout(700);assert.equal(await page.evaluate(async()=>(await(await import('/js/storage.js')).storage.get('current')).profile.name),'切页后仍保存');assert.deepEqual(errors,[]);
  });
}finally{await browser.close();const result={checks,errors,passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length};await writeFile(path.join(output,'summary.json'),JSON.stringify(result,null,2));if(result.failed||errors.length)process.exitCode=1;}
