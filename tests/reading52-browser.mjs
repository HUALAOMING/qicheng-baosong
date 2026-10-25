import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('.'),output=path.join(root,'tests/generated/reading52');await mkdir(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!filename.startsWith(root+path.sep))throw Error('Outside root');const body=await readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const context=await chromium.launchPersistentContext(path.join(output,'isolated-profile'),{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,viewport:{width:1360,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
const go=route=>page.evaluate(route=>ResumeStudio.go3(route),route);
async function ready(){await page.waitForFunction(()=>window.ResumeStudio);await page.locator('#startupContinue52').click();}
try{
  await page.goto(base);await ready();
  await page.evaluate(async()=>{const {storage}=await import('/js/storage.js');await storage.setMany({},Object.keys(await storage.getAll()).filter(key=>key.startsWith('journal:')||key==='settings:home'));await(await import('/js/modules/journal.js')).initializeJournal();await(await import('/js/modules/home.js')).initializeHome();const s=ResumeStudio.fresh();s.onboarded=true;ResumeStudio.setState(s);await ResumeStudio.save();});
  await go('reading-progress');
  for(const [book,chapter,note]of [['论语','学而篇 1—6 则','第一条小记'],['论语','为政篇 1—4 则','第二条小记'],['管子','牧民篇','别的书的小记']]){
    await page.locator('#journalReadingForm [name="book"]').fill(book);
    await page.locator('#journalReadingForm [name="author"]').fill(book==='论语'?'孔子及其弟子':'管仲');
    await page.locator('#journalReadingForm [name="language"]').fill('中文');
    await page.locator('#journalReadingForm [name="chapter"]').fill(chapter);
    await page.locator('#journalReadingForm [name="note"]').fill(note);
    await page.locator('#journalReadingForm [type="submit"]').click();
    await page.waitForFunction(()=>document.querySelector('#journalReadingFeedback')?.textContent.includes('已保存'));
  }
  assert.equal(await page.locator('.reading-book52').count(),2);assert.equal(await page.locator('.reading-axis52 .journal-reading-row').count(),3);
  await page.locator('#readingHistoryView').selectOption('book');await page.locator('#readingHistoryBook').selectOption('论语');
  assert.equal(await page.locator('.reading-book52').count(),1);assert.equal(await page.locator('.reading-axis52 .journal-reading-row').count(),2);
  await page.locator('[data-journal-reading-edit]').first().click();assert.equal(await page.locator('#journalReadingForm [name="chapter"]').inputValue(),'为政篇 1—4 则');
  await page.locator('[data-journal-reading-cancel]').click();
  await page.screenshot({path:path.join(output,'reading-timeline-desktop.png'),fullPage:true});
  await go('learning');await page.locator('[data-reading-mode="progress"]').click();await page.locator('#readingExperienceBook').selectOption('论语');
  await page.locator('[data-reading-import]').click();assert.equal(await page.locator('[data-bind="bookDraft.title"]').inputValue(),'论语');assert.equal(await page.locator('[data-bind="bookDraft.author"]').inputValue(),'孔子及其弟子');
  assert.equal(await page.locator('[data-bind="bookDraft.language"]').inputValue(),'中文');
  assert.equal(await page.locator('[data-bind="bookDraft.date"]').inputValue(),await page.evaluate(()=>new Date().toLocaleDateString('sv-SE')));
  await page.locator('[data-reading-merge-notes]').click();const reflection=await page.locator('[data-bind="bookDraft.reflection"]').inputValue();assert.match(reflection,/第一条小记/);assert.match(reflection,/第二条小记/);assert.doesNotMatch(reflection,/别的书/);
  await page.locator('[data-bind="bookDraft.reflection"]').fill(reflection+'\n我的进一步整理');await page.locator('#bookForm [type="submit"]').click();
  await page.waitForFunction(()=>ResumeStudio.getState().learning.books.length===1);assert.match(await page.locator('.entry-list3').textContent(),/论语/);
  assert.equal(await page.evaluate(async()=>(await import('/js/modules/journal.js')).getReadingIntegration('论语').reflection.includes('进一步整理')),false);
  await go('daily-quote');await page.locator('[data-home-weekly-open]').click();
  for(let i=0;i<7;i++)await page.locator('[data-weekly-quote]').nth(i).check();
  assert.equal(await page.locator('[data-weekly-quote]:checked').count(),7);
  const original=await page.locator('.weekly-quote-order52 li').nth(0).locator('p').textContent();
  await page.locator('[data-weekly-move="0:1"]').click();assert.equal(await page.locator('.weekly-quote-order52 li').nth(1).locator('p').textContent(),original);
  await page.screenshot({path:path.join(output,'weekly-quotes-desktop.png'),fullPage:true});
  await page.locator('[data-weekly-save]').click();await page.waitForSelector('#weeklyQuoteDialog52',{state:'detached'});
  const plan=await page.evaluate(async()=>(await import('/js/modules/home.js')).getHomePreferences().weeklyQuotePlan);assert.equal(plan.quotes.length,7);
  const day=await page.evaluate(()=>(new Date().getDay()+6)%7);assert.equal((await page.locator('.daily-quote-link').textContent()).trim(),plan.quotes[day].text);
  await page.reload();await ready();await go('daily-quote');assert.equal((await page.locator('.daily-quote-link').textContent()).trim(),plan.quotes[day].text);
  await page.setViewportSize({width:390,height:844});await go('reading-progress');await page.locator('#readingHistoryView').selectOption('book');await page.locator('#readingHistoryBook').selectOption('论语');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(output,'reading-timeline-mobile.png'),fullPage:true});
  await go('daily-quote');await page.locator('[data-home-weekly-open]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(output,'weekly-quotes-mobile.png'),fullPage:true});
  await page.locator('[data-weekly-close]').first().click();
  assert.deepEqual(errors,[]);console.log('PASS reading chapter entry, timeline/filter/edit, experience integration/notes, weekly selection/order/persistence, mobile overflow; no page errors.');
}finally{await context.close();await new Promise(resolve=>server.close(resolve));}
