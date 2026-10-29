import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const target=path.resolve(process.argv[2]||'.'),out=path.resolve('docs'),version=JSON.parse(await readFile(path.join(target,'package.json'))).version;
await mkdir(out,{recursive:true});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(target,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(target+path.sep))throw Error();const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const result={version,engine:browser.version(),date:new Date().toISOString(),conditions:'Windows Edge headless, 1440×1000, serviceWorkers blocked for equal application measurements; 5000 synthetic questions and 40 256×256 PNGs',runs:[],errors:[]};
try{
 for(let run=0;run<3;run++){
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',locale:'zh-CN'}),page=await context.newPage();
  page.on('pageerror',error=>result.errors.push(error.message));let networkBytes=0;
  page.on('response',response=>{const len=response.headers()['content-length'];if(len)networkBytes+=Number(len);});
  const ready=async()=>{await page.waitForFunction(()=>window.ResumeStudio);if(await page.locator('#startupChoice52[open]').count())await page.locator('#startupContinue52').click();};
  const started=performance.now();await page.goto(base);await ready();const cold=performance.now()-started;
  const requests=await page.evaluate(()=>performance.getEntriesByType('resource').map(item=>({name:new URL(item.name).pathname,bytes:item.transferSize}))),heapCold=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
  const stress=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),pixels=c.createImageData(256,256);let value=123456;
   for(let i=0;i<pixels.data.length;i++){value=(value*1664525+1013904223)>>>0;pixels.data[i]=i%4===3?255:value>>>24;}c.putImageData(pixels,0,0);const image=canvas.toDataURL('image/png');
   const state=ResumeStudio.getState();for(let i=0;i<40;i++)state.assets.push({id:'stress-image-'+i,name:'image-'+i+'.png',mime:'image/png',source:'stress',size:Math.floor(image.length*.75),data:image,kind:'image',category:'其他',tags:[],ownerRefs:[],createdAt:new Date().toISOString()});
   ResumeStudio.setState(state);let t=performance.now();await ResumeStudio.save();const imageSave=performance.now()-t;
   t=performance.now();await ResumeStudio.go3('images');const previewImages=[...document.querySelectorAll('#workspaceContent .asset-card3 img')];if(previewImages.length!==40)throw new Error('Expected 40 actual preview images, got '+previewImages.length);for(const img of previewImages)img.loading='eager';await Promise.race([Promise.all(previewImages.map(img=>img.decode?.())),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Image decode timed out')),30000))]);const imagePreviewMs=performance.now()-t;
   const bank={schemaVersion:1,bank:{id:'stress-5000',name:'压力题库',subject:'custom',section:'custom',version:'1.0.0'},questions:Array.from({length:5000},(_,i)=>({id:'q'+i,type:'single-choice',question:'第 '+i+' 道压力测试问题',options:[{id:'A',text:'选项甲'},{id:'B',text:'选项乙'}],answer:'A',explanation:'解析 '+i}))};
   t=performance.now();await ResumeStudio.importResourceJSON(bank,{newBankName:'压力专用题库'});const importMs=performance.now()-t;
   t=performance.now();await ResumeStudio.go3('quiz');const quizOpen=performance.now()-t;
   const {ctx}=await import('/js/state.js'),{scheduleSave}=await import('/js/autosave.js');const edits=[];for(let i=0;i<5;i++){ctx.state.profile.name='压力用户'+i;scheduleSave();t=performance.now();await ResumeStudio.save();edits.push(performance.now()-t);}
   t=performance.now();for(const route of ['home','profile','quiz','schools','home','settings','home','profile','quiz','home'])await ResumeStudio.go3(route);const switches=performance.now()-t;
   return {imageSave,imagePreviewMs,importMs,quizOpen,saveMs:edits,switches,heap:performance.memory?.usedJSHeapSize??null,dom:document.getElementsByTagName('*').length};
  });
  const warmStart=performance.now();await page.reload();await ready();const warm=performance.now()-warmStart;
  const entry={run:run+1,coldMs:cold,warmWithStressMs:warm,firstScreenBytes:requests.reduce((sum,item)=>sum+item.bytes,0),firstScreenRequests:requests.length,heapCold,...stress};result.runs.push(entry);console.log(JSON.stringify(entry));await context.close();
 }
}catch(error){result.failure=error.stack;throw error;}finally{await writeFile(path.join(out,'PERFORMANCE_'+version+'_RAW.json'),JSON.stringify(result,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}

