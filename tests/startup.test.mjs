import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {makeDocument,root,FakeFactory} from './support.mjs';
const source=await readFile(path.join(root,'js/bootstrap.js'),'utf8');
async function failureHarness(store) {
  const document=makeDocument();let reloaded=0;const answers=[];
  const context=vm.createContext({document,console,Blob,URL,setTimeout:()=>0,confirm:()=>answers.shift()||false,location:{reload:()=>{reloaded++;}}});
  const app=new vm.SyntheticModule(['boot'],function(){this.setExport('boot',async()=>{throw new Error('数据库无法打开');});},{context});
  const storage=new vm.SyntheticModule(['storage'],function(){this.setExport('storage',store);},{context});
  for(const mod of [app,storage]){await mod.link(()=>{});await mod.evaluate();}
  await new vm.Script(source,{importModuleDynamically:specifier=>specifier==='./app.js'?app:storage}).runInContext(context);
  return {document,answers,reloaded:()=>reloaded};
}
test('startup module failure shows reload, emergency export and double-confirmed clear controls',async()=>{
  let clears=0;const h=await failureHarness({getAll:async()=>({current:{synthetic:true}}),replaceAll:async()=>{clears++;}});
  assert.ok(h.document.getElementById('app').innerHTML.includes('启程无法正常加载'));
  assert.equal(h.document.getElementById('startupErrorDetail').textContent,'数据库无法打开');
  await h.document.getElementById('exportEmergency').onclick();assert.match(h.document.getElementById('emergencyStatus').textContent,/已生成/);
  h.answers.push(true,false);await h.document.getElementById('clearEmergency').onclick();assert.equal(clears,0);
  h.answers.push(true,true);await h.document.getElementById('clearEmergency').onclick();assert.equal(clears,1);assert.equal(h.reloaded(),1);
});
test('startup emergency export failure has a visible message and never clears stored data',async()=>{
  let clears=0;const h=await failureHarness({getAll:async()=>{throw new Error('read blocked');},replaceAll:async()=>{clears++;}});
  await h.document.getElementById('exportEmergency').onclick();assert.match(h.document.getElementById('emergencyStatus').textContent,/无法导出：read blocked/);assert.equal(clears,0);
});
test('exported standalone HTML executes without any network imports/resources and restores its embedded workspace',async()=>{
  const template=await readFile(path.join(root,'assets/editable-template.html'),'utf8');
  const input=JSON.parse(await readFile(path.join(root,'tests/fixtures/input.json'),'utf8'));
  const payload=JSON.stringify({id:'portable-fixture',draft:input}).replace(/</g,'\\u003c');
  const html=template.replace(/(<script id="qichengEmbedded" type="application\/json">)[\s\S]*?(<\/script>)/,(_,start,end)=>start+payload+end);
  const document=makeDocument();document.baseURI='file:///tmp/Qicheng-copy.html';document.documentElement.outerHTML=html;
  const originalGet=document.getElementById;document.getElementById=id=>id==='qichengEmbedded'?{textContent:payload}:originalGet(id);
  const window={addEventListener(){},scrollTo(){},scrollBy(){},matchMedia:()=>({matches:false})};let network=0;
  const context=vm.createContext({window,self:window,document,indexedDB:new FakeFactory(),innerWidth:1280,innerHeight:900,console,Blob,File,URL,DOMException,
    Uint8Array,Uint16Array,Uint32Array,Int16Array,ArrayBuffer,DataView,TextDecoder,TextEncoder,AbortController,atob,btoa,structuredClone,
    FontFace:class{load(){return Promise.resolve(this);}},navigator:{onLine:false,userAgent:'Node test harness'},location:{reload(){}},
    setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:false}),fetch:()=>{network++;throw new Error('network forbidden');}});
  context.window=context;context.self=context;Object.assign(context,window);
  for(const match of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)) if(!match[0].startsWith('<script id="qichengEmbedded"'))new vm.Script(match[1]).runInContext(context);
  const deadline=Date.now()+3000;
  while(!context.ResumeStudio&&Date.now()<deadline&&!document.getElementById('startupErrorDetail')?.textContent)await new Promise(r=>setImmediate(r));
  assert.ok(context.ResumeStudio,document.getElementById('startupErrorDetail')?.textContent || document.getElementById('app').innerHTML);
  assert.equal(context.ResumeStudio.getState().profile.name,input.profile.name);assert.equal(network,0);
  await context.ResumeStudio.go3('explore');assert.ok(document.getElementById('app').innerHTML.includes('学习中心'));
  await context.ResumeStudio.go3('classic:guanzi');assert.ok(document.getElementById('app').innerHTML.includes('id="guanzi-100"'));assert.ok(document.getElementById('app').innerHTML.includes('政平则人安；士教和'));
  assert.equal(network,0);
  for (const name of ['dropRecord','moveRecord','selectedPhotos','uploadBatch','v2Action','openSettings','translateUI','exportArchive3','normalizeAssets3','selectedAttachments3','chartValue3','selectedExams3']) assert.equal(typeof context.ResumeStudio[name],'function',name);
});
