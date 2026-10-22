import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const current=process.cwd(),previous=path.resolve('../qicheng-release-5.0'),out=path.resolve('tests/generated/library-upgrade');await mkdir(out,{recursive:true});
let upgraded=false;const errors=[],checks=[];
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{
  try{const root=upgraded?current:previous,requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(!file.startsWith(root+path.sep))throw Error('Invalid path');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(25000);
try{
  await page.goto(base);await page.waitForFunction(()=>window.ResumeStudio);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>window.ResumeStudio);
  await page.evaluate(async()=>{
    const {ctx}=await import('/js/state.js');ctx.state.profile.name='升级前保存的资料';await(await import('/js/autosave.js')).save();
    await(await import('/js/resources.js')).importResourceJSON({schemaVersion:1,bank:{id:'upgrade-pack',name:'旧版导入题库',subject:'chinese',section:'chinese-usage',version:'1.0.0'},questions:[{id:'stable',type:'true-false',question:'旧版原题',answer:false,explanation:'保留解析'}]});
    const quiz=await import('/js/modules/quiz.js');await quiz.quizFavorite('upgrade-pack','stable');
    await(await import('/js/storage.js')).storage.set(quiz.quizMarkKey('upgrade-pack','stable'),{bankId:'upgrade-pack',questionId:'stable',wrong:true,favorite:true});
    ResumeStudio.go3('settings');
  });
  upgraded=true;await page.locator('[data-pwa-check]').click();await page.waitForSelector('[data-pwa-refresh]:not([hidden])',{timeout:90000});await page.locator('[data-pwa-refresh]').click();await page.waitForFunction(async()=>{try{return !!(await import('/js/resources.js')).listPracticeBanks;}catch{return false;}},{},{timeout:30000});
  await page.waitForSelector('.home-dashboard');assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'升级前保存的资料');await page.evaluate(()=>ResumeStudio.go3('quiz'));assert.equal(await page.locator('[data-quiz-bank]').count(),4);
  const session=await page.evaluate(async()=>{const q=await import('/js/modules/quiz.js');return q.quizStart('chinese-usage','wrong',10);});assert.equal(session.questions.length,1);assert.equal(session.questions[0].learningBankId,'upgrade-pack');checks.push({name:'published 5.0 updates at the same address; personal data, old imports and wrong/favorite identities survive',status:'PASS'});
  await context.setOffline(true);await page.reload();await page.waitForSelector('.home-dashboard');assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'升级前保存的资料');await page.evaluate(()=>ResumeStudio.go3('quiz'));assert.equal(await page.locator('[data-quiz-bank]').count(),4);
  const marks=await page.evaluate(async()=>await(await import('/js/storage.js')).storage.get('quiz:mark:upgrade-pack/stable'));assert.equal(marks.favorite,true);assert.equal(marks.wrong,true);assert.deepEqual(errors,[]);checks.push({name:'upgraded app reopens fully offline with old source-pack learning marks intact',status:'PASS'});
}catch(error){checks.push({name:'same-origin update regression',status:'FAIL',error:error.stack});process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(out,'summary.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));}
