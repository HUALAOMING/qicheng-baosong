import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),output=path.resolve('tests/generated/home-polish52');await mkdir(output,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!filename.startsWith(root+path.sep))throw Error('Outside root');const body=await readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
const page=await context.newPage(),errors=[],checks=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
const go=route=>page.evaluate(route=>ResumeStudio.go3(route),route);
const rowTexts=()=>page.locator('.weekly-quote-order52 li[data-weekly-key52]>p').allTextContents();
async function ready(){await page.waitForFunction(()=>window.ResumeStudio);await page.locator('#startupContinue52').click();}
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function mouseMoveRow(from,to){const handle=page.locator('.weekly-quote-order52 [data-weekly-grip52]').nth(from);await handle.scrollIntoViewIfNeeded();const first=await handle.boundingBox(),last=await page.locator('.weekly-quote-order52 li[data-weekly-key52]').nth(to).boundingBox();await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();await page.mouse.move(first.x+first.width/2,last.y+last.height/2+12,{steps:14});}
try{
  await page.goto(base);await ready();
  const schools=await page.evaluate(async()=>{const {SCHOOL_DETAILS3}=await import('/js/data.js'),home=await import('/js/modules/home.js'),s=ResumeStudio.fresh();s.onboarded=true;s.profile.targetSchool=SCHOOL_DETAILS3[0].name;s.dreamSchools=SCHOOL_DETAILS3.slice(0,4).map(row=>row.name);ResumeStudio.setState(s);await home.initializeHome({});await ResumeStudio.save();ResumeStudio.go3('home');return s.dreamSchools;});
  await check('dream cards swap locally, remain interruptible and preserve an unfinished home form',async()=>{
    assert.equal(await page.locator('[data-home-dream-school52]').count(),4);
    await page.locator('.home-countdown-editor').evaluate(el=>el.open=true);await page.locator('#homeCountdownForm [name="name"]').fill('还未保存的倒计时');
    await page.evaluate(()=>window.__originalHome=document.querySelector('.home-dashboard'));
    await page.locator('.home-dream-others52 [data-home-dream-school52]').nth(0).evaluate(el=>el.click());
    await page.waitForTimeout(50);
    await page.locator('.home-dream-others52 [data-home-dream-school52]').nth(1).evaluate(el=>el.click());
    await page.evaluate(async()=>{await(await import('/js/modules/home.js')).waitForHomeWrites();});await page.waitForTimeout(850);
    assert.equal(await page.evaluate(()=>window.__originalHome===document.querySelector('.home-dashboard')),true);
    assert.equal(await page.locator('#homeCountdownForm [name="name"]').inputValue(),'还未保存的倒计时');
    assert.equal(await page.locator('[data-home-dream-stage52]').getAttribute('data-featured'),schools[2]);
    const sizes=await page.evaluate(()=>({main:document.querySelector('.home-dream-main52 .home-university-seal').getBoundingClientRect().width,side:document.querySelector('.home-dream-others52 .home-university-seal').getBoundingClientRect().width}));assert.ok(sizes.main>=90);assert.ok(sizes.main>sizes.side*2);
  });
  await check('featured school persists through reload and all three themes fit desktop and mobile',async()=>{
    await page.reload();await ready();await go('home');assert.equal(await page.locator('[data-home-dream-stage52]').getAttribute('data-featured'),schools[2]);
    for(const theme of ['pudding','blue','obsidian']){await page.evaluate(async theme=>{const {ctx}=await import('/js/state.js');ctx.state.theme=theme;ResumeStudio.render();},theme);await page.waitForTimeout(550);await page.screenshot({path:path.join(output,'home-'+theme+'-desktop.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
    await page.setViewportSize({width:390,height:844});for(const theme of ['pudding','blue','obsidian']){await page.evaluate(async theme=>{const {ctx}=await import('/js/state.js');ctx.state.theme=theme;ResumeStudio.render();},theme);await page.waitForTimeout(550);await page.screenshot({path:path.join(output,'home-'+theme+'-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
    await page.setViewportSize({width:1440,height:1080});
  });
  await go('daily-quote');await page.locator('[data-home-weekly-open]').click();for(let i=0;i<7;i++)await page.locator('[data-weekly-quote]').nth(i).check();
  await check('mouse reorder tracks the pointer, preserves the dialog and changes the weekday order',async()=>{
    const original=await rowTexts();await page.evaluate(()=>window.__originalDialog=document.querySelector('#weeklyQuoteDialog52'));
    await mouseMoveRow(0,2);assert.equal(await page.locator('.weekly-drag-float52').count(),1);await page.mouse.up();await page.waitForTimeout(800);
    const after=await rowTexts();assert.equal(after[2],original[0]);assert.equal(after[0],original[1]);assert.equal(await page.evaluate(()=>window.__originalDialog===document.querySelector('#weeklyQuoteDialog52')),true);
    assert.equal(await page.locator('.weekly-quote-order52 li[data-weekly-key52]').nth(2).locator('strong').textContent(),'周三');
  });
  await check('keyboard and arrow-button alternatives work, and Escape cancels an active drag',async()=>{
    const quote=(await rowTexts())[2];await page.locator('[data-weekly-grip52]').nth(2).press('ArrowUp');assert.equal((await rowTexts())[1],quote);await page.locator('[data-weekly-grip52]').nth(1).press('Home');assert.equal((await rowTexts())[0],quote);
    await page.locator('[data-weekly-move="0:1"]').click();assert.equal((await rowTexts())[1],quote);await page.waitForTimeout(650);const before=await rowTexts();
    await mouseMoveRow(1,3);await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(750);assert.deepEqual(await rowTexts(),before);assert.equal(await page.locator('#weeklyQuoteDialog52').evaluate(el=>el.open),true);
  });
  await check('touch drag works on mobile and its exact order survives save and reload',async()=>{
    await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-weekly-grip52]').nth(0).scrollIntoViewIfNeeded();const before=await rowTexts(),first=await page.locator('[data-weekly-grip52]').nth(0).boundingBox(),target=await page.locator('.weekly-quote-order52 li[data-weekly-key52]').nth(1).boundingBox(),x=first.x+first.width/2,y=first.y+first.height/2,end=target.y+target.height/2+12,cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let step=1;step<=12;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+(end-y)*step/12,id:1}]});}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    assert.equal((await rowTexts())[1],before[0]);const expected=await rowTexts();await page.screenshot({path:path.join(output,'weekly-touch-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await page.locator('[data-weekly-save]').click();await page.waitForSelector('#weeklyQuoteDialog52',{state:'detached'});await page.reload();await ready();await go('daily-quote');await page.locator('[data-home-weekly-open]').click();assert.deepEqual(await rowTexts(),expected);await page.locator('[data-weekly-close]').first().click();
  });
  assert.deepEqual(errors,[]);await writeFile(path.join(output,'summary.json'),JSON.stringify({checks,errors,passed:checks.length},null,2));
}catch(error){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
