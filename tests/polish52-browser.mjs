// Focused visual acceptance for the 5.2.0 theme and save-control craft pass.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const root=path.resolve('.'),output=path.join(root,'tests/generated/polish52');
await mkdir(output,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));if(!target.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(await readFile(target));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
const page=await context.newPage(),checks=[],errors=[],screenshots=[];
page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
async function check(name,run){try{const detail=await run();checks.push({name,status:'PASS',detail});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png')});}}
async function go(route){await page.evaluate(route=>ResumeStudio.go3(route),route);}
async function screenshot(name){await page.screenshot({path:path.join(output,name),fullPage:true});screenshots.push(name);}
async function noOverflow(){const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(widths.scroll<=widths.client+1,JSON.stringify(widths));return widths;}
try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>window.ResumeStudio);
  if(await page.locator('#startupChoice52[open]').count())await page.locator('#startupContinue52').click();
  await page.evaluate(async()=>{
    const state=ResumeStudio.fresh();state.onboarded=true;state.sidebarHidden=false;state.profile.name='林知远';
    state.introductions=[{id:'visual-cn',title:'中文 · 两分钟',language:'中文',durationSeconds:120,note:'面试开场与个人方向',updatedAt:'2026-10-26T01:00:00Z',body:'各位老师好，我是林知远。\n\n阅读让我学会保持好奇，也让我更愿意认真理解不同的观点。我希望把语言的学习和实际的问题联系起来，在交流中不断拓展自己的认识。'}];
    ResumeStudio.setState(state);
    const journal=await import('/js/modules/journal.js');await journal.initializeJournal({});
    await journal.saveReadingProgress({date:'2026-10-26',book:'论语',author:'孔子及其弟子',language:'中文',chapter:'学而篇 · 第一至六则',note:'学而时习之。把今天的思考记下来，让阅读真正成为自己的理解。'});
    await journal.saveReadingProgress({date:'2026-10-25',book:'论语',author:'孔子及其弟子',language:'中文',chapter:'序言与导读',note:'从一个问题开始，慢慢建立对这本书的认识。'});
  });
  await check('polish stylesheet is integrated and local paper choices remain independent',async()=>{
    const loaded=await page.locator('link[href="css/polish52.css"]').count();
    assert.equal(loaded,1,'index.html must load polish52.css');
    const colors=await page.evaluate(()=>({surface:getComputedStyle(document.body).getPropertyValue('--surface').trim(),paper:getComputedStyle(document.body).getPropertyValue('--paper').trim()}));
    assert.notEqual(colors.surface,colors.paper);
    assert.ok(await page.locator('body').evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<.001));return colors;
  });
  for(const theme of ['pudding','obsidian','blue']){
    await check(theme+' desktop reading timeline and centered save card',async()=>{
      await page.setViewportSize({width:1440,height:1000});
      await page.evaluate(async theme=>{const {ctx}=await import('/js/state.js');ctx.state.theme=theme;ctx.state.sidebarHidden=false;ResumeStudio.render();},theme);
      await go('reading-progress');
      const widths=await noOverflow();
      await page.locator('.sidebar-save52').scrollIntoViewIfNeeded();
      const aligned=await page.locator('.sidebar-save52').evaluate(card=>{
        const copy=card.querySelector('.sidebar-save-copy52')||card.querySelector('#savedStatus'),button=card.querySelector('button');
        const cr=card.getBoundingClientRect(),sr=copy.getBoundingClientRect(),br=button.getBoundingClientRect();
        return {centerDelta:Math.abs(sr.y+sr.height/2-br.y-br.height/2),leftInset:sr.x-cr.x,rightInset:cr.right-br.right,width:cr.width,buttonHeight:br.height,cardHeight:cr.height,statusFont:parseFloat(getComputedStyle(card.querySelector('#savedStatus')).fontSize)};
      });
      assert.ok(aligned.centerDelta<1,JSON.stringify(aligned));assert.ok(Math.abs(aligned.leftInset-aligned.rightInset)<1,JSON.stringify(aligned));
      assert.ok(aligned.buttonHeight>=40);assert.ok(aligned.statusFont>=12);
      await page.locator('.sidebar-save52').screenshot({path:path.join(output,'save-'+theme+'.png')});
      await screenshot('desktop-'+theme+'-reading.png');
      await page.locator('.journal-reading-fields input').first().focus();
      assert.equal(await page.locator('.journal-reading-fields input').first().evaluate(el=>getComputedStyle(el).outlineStyle),'none');
      return {...widths,...aligned};
    });
    await check(theme+' mobile introduction, settings and navigation layout',async()=>{
      await page.setViewportSize({width:390,height:844});await go('self-introductions');
      if(await page.locator('[data-intro-back52]').count())await page.locator('[data-intro-back52]').click();
      await noOverflow();await screenshot('mobile-'+theme+'-introductions.png');
      await page.locator('[data-intro-open52="visual-cn"]').click();await noOverflow();await screenshot('mobile-'+theme+'-rehearsal.png');
      await go('settings');await noOverflow();await screenshot('mobile-'+theme+'-settings.png');
      await page.locator('.menu-toggle').click();await page.locator('.sidebar-save52').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('#sidebar3').evaluate(el=>el.inert),false);
      const geometry=await page.locator('.sidebar-save52').evaluate(el=>{const r=el.getBoundingClientRect(),button=el.querySelector('button').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,buttonHeight:button.height};});
      assert.ok(geometry.left>=0&&geometry.right<=390);assert.ok(geometry.buttonHeight>=44);
      await screenshot('mobile-'+theme+'-sidebar.png');await page.locator('.sidebar-close50').click();return geometry;
    });
  }
  await check('failed and pending saving keep aligned labels and an accessible status',async()=>{
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.state.sidebarHidden=false;ResumeStudio.render();});
    await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');const {updateSaveStatus301,cancelPendingSave}=await import('/js/autosave.js');cancelPendingSave();await ctx.saveChain;ctx.saveError=true;ctx.saving=false;updateSaveStatus301();});
    await page.waitForFunction(()=>{const el=document.querySelector('#savedStatus');return el?.classList.contains('saved-error')&&getComputedStyle(el).color===getComputedStyle(el,'::before').backgroundColor;});
    const error=await page.locator('#savedStatus').evaluate(el=>({color:getComputedStyle(el).color,dot:getComputedStyle(el,'::before').backgroundColor,role:el.getAttribute('role')}));
    assert.equal(error.color,error.dot);assert.equal(error.role,'status');
    await page.locator('.sidebar-save52').screenshot({path:path.join(output,'save-error.png')});
    await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.saveError=false;ctx.saving=true;const {updateSaveStatus301}=await import('/js/autosave.js');updateSaveStatus301();});
    assert.equal(await page.locator('.sidebar-save52').getAttribute('data-save-state'),'saving');
    await page.locator('.sidebar-save52').screenshot({path:path.join(output,'save-pending.png')});
    return error;
  });
  await check('no browser runtime errors during focused visual routes',()=>assert.deepEqual(errors,[]));
}finally{
  await writeFile(path.join(output,'summary.json'),JSON.stringify({browser:await browser.version(),checks,errors,screenshots,limitations:['Headless Edge at desktop and mobile viewport sizes; no physical iPhone or Safari.']},null,2));
  await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));
}
if(checks.some(check=>check.status==='FAIL'))process.exitCode=1;
