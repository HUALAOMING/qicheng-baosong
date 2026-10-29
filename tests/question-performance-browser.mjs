import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const reports=[];
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{for(const target of ['../qicheng-5.2.1-bank-baseline','.']){
 const root=path.resolve(target),types={'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json'};
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{for(let round=0;round<3;round++){
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();try{
   await page.goto(base);await page.waitForFunction(()=>window.ResumeStudio);await page.locator('#startupContinue52').click();
   const result=await page.evaluate(async()=>{
    const r=await import('/js/resources.js'),{storage}=await import('/js/storage.js');await r.initializeResources();
    const bank={schemaVersion:1,bank:{id:'bench',name:'Bench',subject:'custom',section:'custom',version:'1.0.0'},questions:Array.from({length:5000},(_,i)=>({id:'q'+i,type:'true-false',question:'唯一问题 '+i,answer:true,explanation:'原始解析 '+i}))};
    let gets=0,puts=0;const get=IDBObjectStore.prototype.get,put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.get=function(...args){gets++;return get.apply(this,args);};IDBObjectStore.prototype.put=function(...args){puts++;return put.apply(this,args);};
    const runs=[];
    try{for(const kind of ['initial','identical','patch']){gets=puts=0;const start=performance.now(),input=kind==='patch'?{schemaVersion:1,patch:{bankId:'bench',questions:[{id:'q123',set:{explanation:'修正后的解析'}}]}}:bank;const plan=await r.prepareResourceImport(input,kind==='initial'?{newBankName:'Bench'}:{}),prepared=performance.now();await r.applyPreparedResourceImport(plan);runs.push({kind,preflightMs:prepared-start,commitMs:performance.now()-prepared,totalMs:performance.now()-start,gets,puts});}}
    finally{IDBObjectStore.prototype.get=get;IDBObjectStore.prototype.put=put;}
    const reads=[],updates=[];let pageTime;
    for(let i=0;i<10;i++){
     let t=performance.now();const item=r.readQuestion?await r.readQuestion('bench','q123'):await storage.get('@521:bank:q:custom:bench/q123');reads.push(performance.now()-t);
     t=performance.now();if(r.updateQuestion)await r.updateQuestion('bench','q123',{explanation:'单题更新 '+i},{expectedRevision:item.revision});else await r.importResourceJSON({schemaVersion:1,patch:{bankId:'bench',questions:[{id:'q123',set:{explanation:'单题更新 '+i}}]}});updates.push(performance.now()-t);
    }
    const t=performance.now();if(r.queryQuestions)await r.queryQuestions('bench',{limit:50});else await r.loadPracticeBank((r.listPracticeBankSummaries().find(b=>b.bank.name==='Bench')||{}).bank?.id);pageTime=performance.now()-t;
    const bankStore=await import('/js/bank-store521.js');const fullStart=performance.now();const full=await bankStore.bankRead521('custom','bench');const fullReadMs=performance.now()-fullStart;if(full.questions.length!==5000)throw new Error('Incomplete bank');return {runs,reads,updates,pageTime,fullReadMs};
   });
   if(target==='.'){
    await context.setOffline(true);
    const offline=await page.evaluate(async()=>{const r=await import('/js/resources.js');const row=await r.readQuestion('bench','q123');await r.updateQuestion('bench','q123',{explanation:'真实离线修改'},{expectedRevision:row.revision});return (await r.readQuestion('bench','q123')).question.explanation;});assert.equal(offline,'真实离线修改');result.offline=true;
   }
   reports.push({target,round:round+1,...result});console.log(JSON.stringify(reports.at(-1)));
  }finally{await context.close();}
 }}finally{await new Promise(r=>server.close(r));}
}}finally{await browser.close();await mkdir('docs',{recursive:true});await writeFile('docs/QUESTION_PERFORMANCE_RAW.json',JSON.stringify(reports,null,2));}
