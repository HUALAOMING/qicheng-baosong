// Local-only actual Edge lifecycle regression. Every HTTP response is an immutable
// in-memory snapshot; this never contacts GitHub or any deployment service.
import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServiceWorker521} from '../scripts/service-worker-template.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),previous=path.resolve(root,'../qicheng-5.2'),out=path.join(root,'tests/generated/pwa521');
await mkdir(out,{recursive:true});
async function snapshot(directory) {
 const records=new Map();
 async function walk(relative='') {for(const entry of await readdir(path.join(directory,relative),{withFileTypes:true})){const name=path.posix.join(relative,entry.name);if(['tests','docs','scripts','node_modules','.git'].includes(entry.name))continue;if(entry.isDirectory())await walk(name);else if(!name.endsWith('.md'))records.set(name,await readFile(path.join(directory,name)));}}
 await walk();return records;
}
const [oldFiles,newFiles]=await Promise.all([snapshot(previous),snapshot(root)]);
const assets=[...newFiles.keys()].filter(name=>/^(index\.html|manifest\.webmanifest|css\/|js\/|data\/|assets\/|workers\/)/.test(name)&&!['data/static-resources.json','data/resources/manifest.json'].includes(name)).sort();
const hashes=Object.fromEntries(assets.map(name=>[name,createHash('sha256').update(newFiles.get(name)).digest('hex')]));
const revision=createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0,12);
const worker=rev=>Buffer.from(createServiceWorker521({revision:rev,assets,hashes,appVersion:'5.2.1'}));
let mode='old',failure=false;
const scope='/qicheng-baosong/',mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
const httpErrors=[];
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(scope)){res.writeHead(404);res.end();return;}
 const name=decodeURIComponent(url.pathname.slice(scope.length))||'index.html';const records=mode==='old'?oldFiles:newFiles;
 let bytes=records.get(name);if(name==='service-worker.js'&&mode!=='old')bytes=worker(mode==='new'?revision:mode==='next'?'next-'+revision:'failed-'+revision);
 if(failure&&name==='js/lazy-runtime.js')bytes=Buffer.from('intentional mismatched resource');
 if(!bytes){httpErrors.push({mode,name});res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+scope;
const browser=await chromium.launch({executablePath:process.env.QICHENG_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1360,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai',acceptDownloads:true});
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
let peer;
const report={browser:await browser.version(),actualDevice:'Windows headless Edge; not Android or installed OS PWA shell',scope,checks,errors,httpErrors,startedAt:new Date().toISOString()};
async function ready(target=page){await target.waitForFunction(()=>!!window.ResumeStudio);if(await target.locator('#startupChoice52[open]').count())await target.locator('#startupContinue52').click();}
const go=(route,target=page)=>target.evaluate(route=>ResumeStudio.go3(route),route);
const pwa=(method,target=page)=>target.evaluate(async({method,scope})=>(await import(scope+'js/pwa.js')).pwa[method](),{method,scope});
async function check(name,fn){const start=Date.now();try{const detail=await fn();checks.push({name,status:'PASS',milliseconds:Date.now()-start,detail});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(out,'failure-'+checks.length+'.png')}).catch(()=>{});}await writeFile(path.join(out,'summary.json'),JSON.stringify(report,null,2));}
try {
 await check('5.2.0 existing app boots and commits baseline user data',async()=>{
  await page.goto(base);await ready();assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.2.0');await page.evaluate(async()=>{const state=ResumeStudio.getState();state.profile.name='升级回归资料';ResumeStudio.setState(state);await ResumeStudio.save();});await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 });
 await check('5.2.0 saved single-window update migrates to 5.2.1 without losing database',async()=>{
  mode='new';assert.equal(await pwa('checkUpdate'),true);await Promise.all([page.waitForNavigation({waitUntil:'load'}),pwa('applyUpdate')]);await ready();assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.2.1');assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'升级回归资料');assert.equal(httpErrors.length,0);
 });
 await check('offline restart and lazy school/map, quiz and document route work under GitHub Pages subpath',async()=>{
  await context.setOffline(true);await page.reload();await ready();assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'升级回归资料');for(const route of ['schools','quiz','studio','self-introductions','reading-progress']){await go(route);assert.ok(await page.locator('#workspaceContent').textContent());}await page.screenshot({path:path.join(out,'offline-studio.png')});await context.setOffline(false);
 });
 await check('editing peer blocks actual waiting-worker activation without refresh',async()=>{
  peer=await context.newPage();peer.setDefaultTimeout(30000);peer.on('pageerror',error=>errors.push('peer: '+error.message));await peer.goto(base);await ready(peer);await go('profile',peer);const input=peer.locator('[data-bind="profile.name"]');await input.fill('多窗口编辑资料');await input.focus();await peer.evaluate(()=>ResumeStudio.save());
  mode='next';await go('settings');assert.equal(await pwa('checkUpdate'),true);const oldController=await page.evaluate(()=>navigator.serviceWorker.controller.state);await pwa('applyUpdate');await page.waitForFunction(()=>!document.body.inert&&document.querySelector('[data-pwa-update-status]')?.textContent.includes('其他窗口'));
  assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);assert.equal(await input.inputValue(),'多窗口编辑资料');assert.equal(await peer.locator('#startupChoice52[open]').count(),0);return {controllerState:oldController};
 });
 await check('all clean windows acknowledge, save and reload together; new boot verifies expected revision',async()=>{
  await peer.evaluate(()=>document.activeElement?.blur());await go('home',peer);await peer.evaluate(()=>ResumeStudio.save());
  await Promise.all([page.waitForNavigation({waitUntil:'load'}),peer.waitForNavigation({waitUntil:'load'}),pwa('applyUpdate')]);await ready();await ready(peer);assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'多窗口编辑资料');assert.equal(await peer.evaluate(()=>ResumeStudio.getState().profile.name),'多窗口编辑资料');
  await page.waitForFunction(()=>sessionStorage.getItem('qicheng-pwa-transition')===null);assert.equal(await page.evaluate(()=>document.body.inert),false);await peer.close();peer=null;
 });
 await check('interrupted/mismatched new resources fail installation; old offline program and data remain usable',async()=>{
  mode='broken';failure=true;await go('settings');assert.equal(await pwa('checkUpdate'),false);await page.waitForFunction(()=>document.querySelector('[data-pwa-update-status]')?.textContent.includes('未完成'));assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),false);failure=false;await context.setOffline(true);await page.reload();await ready();assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'多窗口编辑资料');assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.2.1');await context.setOffline(false);
 });
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(httpErrors.length,0,JSON.stringify(httpErrors));
}finally {
 await writeFile(path.join(out,'summary.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));
}
if(checks.some(check=>check.status==='FAIL'))process.exitCode=1;
