import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=process.cwd(),out=path.resolve('tests/generated/runtime521');await mkdir(out,{recursive:true});
const profile=path.join(out,'owned-profile-'+Date.now());
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep))throw Error('path');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const checks=[],errors=[],requests404=[],startedAt=new Date().toISOString();let context,page,phase='launch';
const launch=async()=>{const ctx=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,serviceWorkers:'block',viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',acceptDownloads:true});ctx.on('page',observe);for(const p of ctx.pages())observe(p);return ctx;};
function observe(p){p.on('pageerror',error=>errors.push({phase,message:error.message}));p.on('response',response=>{if(response.status()===404)requests404.push(response.url());});p.setDefaultTimeout(20000);}
async function ready(p=page){await p.waitForFunction(()=>window.ResumeStudio);if(await p.locator('#startupChoice52').evaluate(el=>el.open))await p.locator('#startupContinue52').click();}
const go=async(route,p=page)=>p.evaluate(route=>ResumeStudio.go3(route),route);
async function waitAsync521(predicate){const deadline=Date.now()+20000;while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Timed out awaiting actual asynchronous database state');}
async function check(name,fn){phase=name;try{const details=await fn();checks.push({name,status:'PASS',details});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.log('FAIL '+name+': '+error.message);await page?.screenshot({path:path.join(out,'failure-'+checks.length+'.png')}).catch(()=>{});}}
const bank={schemaVersion:1,bank:{id:'runtime-longterm',name:'运行验收题库',subject:'english',section:'grammar',version:'1.0.0'},questions:Array.from({length:1000},(_,index)=>({id:'stable-'+index,type:'single-choice',question:'验收题目 '+index,options:[{id:'A',text:'正确项'},{id:'B',text:'错误项'}],answer:'A',explanation:'原始解析 '+index,source:'本地虚构验收'}))};
let backup,imageBase64,binaryBase64;
try{
 context=await launch();page=context.pages()[0]||await context.newPage();await page.goto(base);await ready();
 await check('actual Edge profile edits commit and survive refresh',async()=>{
   assert.equal(await page.evaluate(()=>ResumeStudio.version),'5.2.1');await go('profile');await page.locator('[data-bind="profile.name"]').fill('持久资料验收');
   await waitAsync521(()=>page.evaluate(async()=>{const {ctx}=await import('/js/state.js'),{storage}=await import('/js/storage.js');return (await storage.getCurrent())?.profile.name==='持久资料验收'&&!ctx.dirty301&&!ctx.saving;}));
   assert.equal(await page.evaluate(async()=>{const {storage}=await import('/js/storage.js');return (await storage.getCurrent())?.profile.name;}),'持久资料验收');
   await page.reload();await ready();assert.equal(await page.evaluate(()=>ResumeStudio.getState().profile.name),'持久资料验收');
 });
 await check('file bank preflight shows actual 1000-count summary before confirmed commit',async()=>{
   await go('settings');await page.locator('#resourceJSONInput').setInputFiles({name:'1000-questions.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bank))});
   await page.waitForSelector('.quiz-import-preview');assert.match(await page.locator('.quiz-import-preview').textContent(),/1000/);
   const before=await page.evaluate(async()=>!!await(await import('/js/storage.js')).storage.get('@521:bank:meta:custom:runtime-longterm'));assert.equal(before,false);
   await page.locator('#quizImportTarget').selectOption('english-grammar');await page.locator('[data-bank-import-confirm]').click();await page.waitForSelector('#confirmDialog[open]');assert.match(await page.locator('#confirmMessage').textContent(),/新增 1000/);
   await page.locator('#confirmAccept').click();await page.waitForSelector('#resourceResult:has-text("题目已导入")');
   const meta=await page.evaluate(async()=>await(await import('/js/storage.js')).storage.get('@521:bank:meta:custom:runtime-longterm'));assert.equal(meta.questionIds.length,1000);
   return {questions:1000};
 });
 await check('single-field patch UI preserves options, answer, ID and untouched questions',async()=>{
   const patch={schemaVersion:1,patch:{bankId:'runtime-longterm',baseVersion:'1.0.0',questions:[{id:'stable-0',set:{explanation:'只修正这道题的解析'}}]}};
   await page.locator('#resourceJSONInput').setInputFiles({name:'single-patch.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(patch))});
   await page.waitForSelector('#confirmDialog[open]');assert.match(await page.locator('#confirmMessage').textContent(),/修改 1/);await page.locator('#confirmAccept').click();await page.waitForSelector('#resourceResult:has-text("补丁已提交")');
   const rows=await page.evaluate(async()=>{const {storage}=await import('/js/storage.js');return [await storage.get('@521:bank:q:custom:runtime-longterm/stable-0'),await storage.get('@521:bank:q:custom:runtime-longterm/stable-1')];});
   assert.deepEqual(rows[0],{...bank.questions[0],explanation:'只修正这道题的解析'});assert.deepEqual(rows[1],bank.questions[1]);
 });
 await check('quiz UI starts a ten-question lazy sample and homepage resume survives reload',async()=>{
   await go('quiz');await page.locator('[data-quiz-bank="english-grammar"]').click();await page.locator('#quizSize').fill('10');await page.locator('[data-quiz-start]').click();await page.waitForSelector('.quiz-session');await page.locator('[data-quiz-option="0"]').click();
   await page.evaluate(async()=>await(await import('/js/modules/quiz.js')).waitForQuizWrites());await page.reload();await ready();
   assert.match(await page.locator('.home-resume').textContent(),/1 \/ 10/);
   const homeBackup=await page.evaluate(async()=>await(await import('/js/backup.js')).getCurrentBackup());assert.equal(homeBackup.data['quiz:draft:active'].questions.length,10);assert.equal(homeBackup.data['quiz:draft:active'].answers.filter(v=>v!==null).length,1);
   await page.locator('.home-resume [data-quiz-resume]').click();await page.waitForSelector('.quiz-session');assert.match(await page.locator('.quiz-progress').textContent(),/1 \/ 10/);
 });
 await check('original PNG and binary attachment bytes survive Blob storage and full v2 backup roundtrip',async()=>{
   imageBase64=(await readFile(path.join(root,'assets/icons/icon-192.png'))).toString('base64');binaryBase64=Buffer.from(Array.from({length:4096},(_,i)=>(i*71+13)%256)).toString('base64');
   await page.evaluate(async({imageBase64,binaryBase64})=>{const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));await ResumeStudio.importAssets3([new File([decode(imageBase64)],'original.png',{type:'image/png'}),new File([decode(binaryBase64)],'original.bin',{type:'application/octet-stream'})]);},{imageBase64,binaryBase64});
   backup=await page.evaluate(async()=>await(await import('/js/backup.js')).getCurrentBackup());assert.equal(backup.backupVersion,2);assert.equal(backup.integrity.algorithm,'SHA-256');assert.equal(backup.data.current.assets.length,2);
   const dataByName=new Map(backup.data.current.assets.map(asset=>[asset.name,asset.data.split(',')[1]]));assert.equal(dataByName.get('original.png'),imageBase64);assert.equal(dataByName.get('original.bin'),binaryBase64);
   const input={app:backup.app,backupVersion:backup.backupVersion,appVersion:backup.appVersion,createdAt:backup.createdAt,data:backup.data};assert.equal(createHash('sha256').update(JSON.stringify(input)).digest('hex'),backup.integrity.digest);
   assert.equal(backup.data['resource:custom:runtime-longterm'].questions.length,1000);assert.ok(backup.data['resource:official:english-grammar'].questions.length>0);
   await page.evaluate(async data=>{const b=await import('/js/backup.js');await b.commitBackup(data);ResumeStudio.render();},backup);
   const actual=await page.evaluate(async()=>{const {storage}=await import('/js/storage.js'),current=await storage.get('current');return current.assets.map(asset=>({name:asset.name,data:asset.data}));});
   assert.equal(actual.find(a=>a.name==='original.png').data.split(',')[1],imageBase64);assert.equal(actual.find(a=>a.name==='original.bin').data.split(',')[1],binaryBase64);
   await writeFile(path.join(out,'complete-backup.json'),JSON.stringify(backup,null,2));return {imageBytes:Buffer.from(imageBase64,'base64').length,binaryBytes:4096,digest:backup.integrity.digest};
 });
 await check('tampered v2 backup rejects before replacing database',async()=>{
   const tampered=structuredClone(backup);tampered.data.current.profile.name='被篡改';
   const outcome=await page.evaluate(async data=>{const {storage}=await import('/js/storage.js');const before=JSON.stringify(await storage.getAll());let error='';try{await(await import('/js/backup.js')).commitBackup(data);}catch(e){error=e.message;}return {error,unchanged:before===JSON.stringify(await storage.getAll())};},tampered);
   assert.match(outcome.error,/完整性校验失败/);assert.equal(outcome.unchanged,true);
 });
 await check('injected quota failure reports unsaved state and preserves prior committed profile',async()=>{
   await go('profile');const result=await page.evaluate(async()=>{const {ctx}=await import('/js/state.js'),{storage}=await import('/js/storage.js'),saving=await import('/js/autosave.js');const old=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(typeof key==='string'&&key.startsWith('@521:ws:profile'))throw new DOMException('验收注入：配额不足','QuotaExceededError');return old.apply(this,arguments);};let saved;try{ctx.state.profile.name='未成功提交';saving.scheduleSave();saved=await saving.save();}finally{IDBObjectStore.prototype.put=old;saving.cancelPendingSave();}return {saved,error:ctx.saveError,dirty:ctx.dirty301,stored:(await storage.get('current')).profile.name,status:document.querySelector('#savedStatus').textContent};});
   assert.equal(result.saved,false);assert.equal(result.error,true);assert.equal(result.dirty,true);assert.equal(result.stored,'持久资料验收');assert.match(result.status,/保存失败/);
   await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.state.profile.name='持久资料验收';await(await import('/js/autosave.js')).save();});return result;
 });
 await check('aborted restore transaction rolls back clear and all writes',async()=>{
   const result=await page.evaluate(async data=>{const {storage}=await import('/js/storage.js'),{ctx}=await import('/js/state.js');const before=JSON.stringify(await storage.getAll()),name=ctx.state.profile.name,original=IDBDatabase.prototype.transaction;let aborted=false;IDBDatabase.prototype.transaction=function(...args){const tx=original.apply(this,args);if(args[1]==='readwrite'&&!aborted){aborted=true;queueMicrotask(()=>{try{tx.abort();}catch{}});}return tx;};let error='';try{await(await import('/js/backup.js')).commitBackup(data);}catch(e){error=e.message;}finally{IDBDatabase.prototype.transaction=original;}return {error,aborted,unchanged:before===JSON.stringify(await storage.getAll()),stateName:ctx.state.profile.name,name,busy:ctx.busy,inert:document.body.inert};},backup);
   assert.equal(result.aborted,true);assert.match(result.error,/恢复失败/);assert.equal(result.unchanged,true);assert.equal(result.stateName,result.name);assert.equal(result.busy,false);assert.equal(result.inert,false);
 });
 await check('two tabs reject stale save even after backup export reads database',async()=>{
   const second=await context.newPage();await second.goto(base);await ready(second);await go('profile',second);
   await page.evaluate(async()=>{const {ctx}=await import('/js/state.js');ctx.state.profile.name='第一窗口最新提交';await(await import('/js/autosave.js')).save();});
   const result=await second.evaluate(async()=>{const {ctx}=await import('/js/state.js'),saving=await import('/js/autosave.js'),{storage}=await import('/js/storage.js');ctx.state.profile.name='第二窗口过期编辑';saving.scheduleSave();const first=await saving.save();const exported=await(await import('/js/backup.js')).getCurrentBackup();const retry=await saving.save();saving.cancelPendingSave();return {first,retry,localName:ctx.state.profile.name,exportedName:exported.data.current.profile.name,storedName:(await storage.get('current')).profile.name,error:ctx.saveError};});
   assert.equal(result.first,false);assert.equal(result.retry,false);assert.equal(result.error,true);assert.equal(result.storedName,'第一窗口最新提交');assert.equal(result.exportedName,'第二窗口过期编辑');await second.close();return result;
 });
 await check('stale favorite changes cannot overwrite another tab learning state after reads',async()=>{
   const second=await context.newPage();await second.goto(base);await ready(second);await go('quiz',second);
   const key='quiz:mark:runtime-longterm/stable-0';
   await page.evaluate(async key=>{await(await import('/js/storage.js')).storage.set(key,{bankId:'runtime-longterm',questionId:'stable-0',wrong:true,favorite:false});},key);
   const result=await second.evaluate(async key=>{const {storage}=await import('/js/storage.js'),q=await import('/js/modules/quiz.js');await storage.get(key);await(await import('/js/backup.js')).getCurrentBackup();let error='';try{await q.quizFavorite('runtime-longterm','stable-0');}catch(e){error=e.message;}return {error,mark:await storage.get(key)};},key);
   assert.match(result.error,/窗口.*修改|修改.*窗口/);assert.equal(result.mark.wrong,true);assert.equal(result.mark.favorite,false);await second.close();return result;
 });
 await check('persistent browser restart retains profile, attachments, imported question and unfinished answers',async()=>{
   await context.close();context=await launch();page=context.pages()[0]||await context.newPage();await page.goto(base);await ready();
   const result=await page.evaluate(async()=>{const {storage}=await import('/js/storage.js');const current=await storage.get('current'),q=await storage.get('@521:bank:q:custom:runtime-longterm/stable-0'),draft=await storage.get('quiz:draft:active');return {name:current.profile.name,assets:current.assets.map(a=>({name:a.name,data:a.data})),explanation:q.explanation,answered:draft.answers.filter(v=>v!==null).length};});
   assert.equal(result.name,'第一窗口最新提交');assert.equal(result.explanation,'只修正这道题的解析');assert.equal(result.assets.find(a=>a.name==='original.png').data.split(',')[1],imageBase64);assert.equal(result.assets.find(a=>a.name==='original.bin').data.split(',')[1],binaryBase64);assert.equal(result.answered,1);
   return {name:result.name,assets:result.assets.length,answered:result.answered};
 });
 await check('desktop and Android-size emulation show truthful storage status without horizontal overflow',async()=>{
   await go('settings');await page.locator('#dataStorage521').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('#storage521-mode').textContent.includes('正在'));
   const realMode=await page.evaluate(async()=>await navigator.storage.persisted()),label=await page.locator('#storage521-mode').textContent();assert.match(label,realMode?/持久存储已授权/:/未授权/);
   await waitAsync521(()=>page.evaluate(()=>!document.querySelector('#toast').classList.contains('show')&&Number(getComputedStyle(document.querySelector('#toast')).opacity)===0));await page.screenshot({path:path.join(out,'desktop-storage.png')});
   await page.setViewportSize({width:412,height:915});await page.locator('#dataStorage521').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'android-viewport-storage.png')});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);await page.setViewportSize({width:1440,height:1000});
   return {persisted:realMode,label,mobile:'viewport emulation only; not Android Edge hardware'};
 });
}finally{
 await context?.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));
 await writeFile(path.join(out,'evidence.json'),JSON.stringify({startedAt,completedAt:new Date().toISOString(),browser:'Windows Edge headless; isolated owned persistent profile',serviceWorkers:'blocked for data integration; see separate PWA lifecycle test',profile,checks,errors,requests404},null,2));
}
console.log(JSON.stringify({passed:checks.filter(c=>c.status==='PASS').length,total:checks.length,errors,requests404}));
if(checks.some(c=>c.status!=='PASS')||errors.length||requests404.length)process.exitCode=1;
