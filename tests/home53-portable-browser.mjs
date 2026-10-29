import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'zh-CN'}),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.setDefaultTimeout(15000);
try{
 await page.goto(pathToFileURL(path.resolve('assets/editable-template.html')).href);await page.waitForFunction(()=>window.ResumeStudio);if(await page.locator('#startupChoice52[open]').count())await page.locator('#startupContinue52').click();
 const schools=['北京大学','清华大学','浙江大学','厦门大学','复旦大学','吉林大学','南开大学'];
 await page.evaluate(async schools=>{const s=ResumeStudio.fresh();s.onboarded=true;s.profile.targetSchool=schools[0];s.dreamSchools=schools;ResumeStudio.setState(s);await ResumeStudio.save();await ResumeStudio.go3('home');},schools);
 assert.equal(await page.locator('[data-home-dream-school52]').count(),5);
 await page.locator('.home-edit-button53').click();await page.locator('[data-home-card-choice53="timer"]').check();await page.locator('[data-home-card-choice53="quote"]').uncheck();await page.locator('.home-edit-button53').click();
 await page.locator('[data-timer-config53]').click();await page.locator('#timerConfig53 [name="minutes"]').fill('0');await page.locator('#timerConfig53 [name="seconds"]').fill('1');await page.locator('#timerConfig53 button[type="submit"]').click();await page.locator('#timerConfig53').waitFor({state:'hidden'});await page.locator('[data-home-timer53] [data-timer-toggle53]').click();await page.waitForFunction(()=>document.querySelector('[data-home-timer53]')?.classList.contains('timer-over53'));
 await page.locator('[data-timer-open53]').click();assert.equal(await page.locator('#timerDialog53').evaluate(el=>el.open),true);await page.locator('[data-timer-close53]').click();await page.waitForFunction(()=>!document.querySelector('#timerDialog53')?.open);
 await page.locator('.home-destination').click({button:'right'});await page.locator('#homeSchoolDisplay53 input[name="school"]').first().uncheck();await page.locator('#homeSchoolDisplay53 input[name="school"]').nth(5).check();await page.locator('#homeSchoolDisplay53 select[name="featured"]').selectOption(schools[5]);await page.locator('#homeSchoolDisplay53 button[type="submit"]').click();await page.locator('#homeSchoolDisplay53').waitFor({state:'hidden'});assert.equal(await page.locator('[data-home-dream-stage52]').getAttribute('data-featured'),schools[5]);
 await page.reload();await page.waitForFunction(()=>window.ResumeStudio);if(await page.locator('#startupChoice52[open]').count())await page.locator('#startupContinue52').click();await page.waitForSelector('[data-home-timer53]');assert.equal(await page.locator('[data-home-card53="quote"]').isVisible(),false);assert.equal(await page.locator('[data-home-dream-stage52]').getAttribute('data-featured'),schools[5]);await page.waitForFunction(()=>document.querySelector('[data-home-timer53]')?.classList.contains('timer-over53'));
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log('PASS portable file:// home card, five-school selection, timer overtime and reload; no network requests');
}finally{await browser.close();}
