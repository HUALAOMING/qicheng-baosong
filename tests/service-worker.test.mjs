// Generated-worker VM checks. Real lifecycle checks are in pwa521-browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import {root} from './support.mjs';
const generated=await readFile(path.join(root,'service-worker.js'),'utf8');
// Fixture the current source bytes so parallel feature edits do not invalidate
// lifecycle tests. scripts/check.mjs separately checks the packaged manifest.
const fixtureHashes={};
for(const name of JSON.parse(generated.match(/const PRECACHE = (\[[^;]+\]);/)[1]))fixtureHashes[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');
const source=generated.replace(/const HASHES = [^\n]+;/,'const HASHES = '+JSON.stringify(fixtureHashes)+';');
const paths=JSON.parse(source.match(/const PRECACHE = (\[[^;]+\]);/)[1]);
const origin='https://qicheng.test',scope=origin+'/app/';
const changeRevision=revision=>source.replace(/const REVISION = "[^"]+";/,'const REVISION = "'+revision+'";');
function worker({code=source,shared={stores:new Map()},failure='',transient=false,tamper='',clientCount=1}={}) {
  const listeners={},notices=[];let claimed=false,skipped=false,offline=false,failed=false,inflight=0,maxInflight=0;
  const clients=Array.from({length:clientCount},(_,i)=>({id:'window-'+i,url:scope,postMessage:message=>notices.push({client:'window-'+i,...message})}));
  const caches={
    open:async name=>{
      if(!shared.stores.has(name))shared.stores.set(name,new Map());const store=shared.stores.get(name);
      return {async put(request,response){store.set(typeof request==='string'?request:request.url,new Uint8Array(await response.arrayBuffer()));},async match(request){const bytes=store.get(typeof request==='string'?request:request.url);return bytes?new Response(bytes):undefined;}};
    },keys:async()=>[...shared.stores.keys()],delete:async name=>shared.stores.delete(name)
  };
  const self={registration:{scope},location:{origin},clients:{claim:async()=>{claimed=true;},matchAll:async()=>[...clients,{id:'unrelated',url:origin+'/other/',postMessage:()=>{throw Error('Wrong scope');}}]},addEventListener:(name,fn)=>{listeners[name]=fn;},skipWaiting(){skipped=true;}};
  const context=vm.createContext({self,caches,URL,Request,Response,Set,Uint8Array,crypto:webcrypto,setTimeout,clearTimeout,fetch:async request=>{
    if(offline)throw new Error('offline');inflight++;maxInflight=Math.max(maxInflight,inflight);
    try {if(request.url.endsWith(failure)&&failure&&(!transient||!failed)){failed=true;throw Error('cache installation failed');}const pathname=new URL(request.url).pathname.slice('/app/'.length);return new Response(request.url.endsWith(tamper)&&tamper?'changed during deployment':await readFile(path.join(root,pathname)));}finally{inflight--;}
  }});
  vm.runInContext(code,context);
  async function event(name,data={}) {let promise,result;listeners[name]({source:clients[0],waitUntil:p=>{promise=p;},respondWith:p=>{result=p;},...data});if(promise)await promise;return result?await result:undefined;}
  return {event,shared,notices,clients,offline:()=>{offline=true;},claimed:()=>claimed,skipped:()=>skipped,maxInflight:()=>maxInflight};
}
test('precache paths exist and include lazy modules, workers, templates; exclude user data and tests',async()=>{
  for(const name of ['data/china-map.json','assets/editable-template.html','js/storage.js','js/lazy-runtime.js','workers/json-worker.js'])assert.ok(paths.includes(name),name);
  for(const name of paths){await access(path.join(root,name));assert.ok(!name.startsWith('tests/'));assert.ok(!name.includes('Backup'));}
});
test('cold install verifies every resource; offline navigation, JS, fonts, map and templates work',async()=>{
  const w=worker();await w.event('install');await w.event('activate');assert.equal(w.claimed(),false);w.offline();assert.ok((await(await w.event('fetch',{request:{url:scope+'index.html',method:'GET',mode:'navigate'}})).text()).includes('启程'));for(const name of ['js/app.js','css/themes.css','data/universities.json','data/china-map.json','assets/fonts/cjk.ttf','assets/editable-template.html'])assert.ok((await(await w.event('fetch',{request:new Request(scope+name)})).arrayBuffer()).byteLength>100);
});
test('worker does not intercept personal writes, external URLs or backup downloads',async()=>{
  const w=worker();await w.event('install');assert.equal(await w.event('fetch',{request:new Request(scope+'notes',{method:'POST',body:'user data'})}),undefined);assert.equal(await w.event('fetch',{request:new Request('https://university.test/admissions')}),undefined);assert.equal(await w.event('fetch',{request:new Request(scope+'Qicheng_Backup.json')}),undefined);
});
test('explicit no-store resource updates bypass worker; mutable manifests are not precached',async()=>{const w=worker();await w.event('install');assert.equal(await w.event('fetch',{request:new Request(scope+'data/resources/english-grammar.json',{cache:'no-store'})}),undefined);assert.equal(paths.includes('data/resources/manifest.json'),false);});
test('new version retains preceding cache and unrelated apps; legacy single-window activation works',async()=>{
  const first=worker();await first.event('install');first.shared.stores.set('another-app-cache',new Map());const oldName=[...first.shared.stores.keys()][0];const updated=worker({code:changeRevision('test-update'),shared:first.shared});await updated.event('install');await updated.event('message',{data:{type:'ACTIVATE_UPDATE'}});assert.ok(updated.skipped());await updated.event('activate');const names=[...updated.shared.stores.keys()];assert.ok(names.includes('another-app-cache'));assert.ok(names.includes(oldName));assert.ok(names.some(n=>n.includes('v5-test-update')));updated.offline();assert.ok(await updated.event('fetch',{request:new Request(scope+'js/storage.js')}));
});
test('failed installation discards partial new cache and preserves complete old offline version',async()=>{
  const old=worker();await old.event('install');const before=[...old.shared.stores.keys()];const broken=worker({code:changeRevision('broken'),shared:old.shared,failure:'assets/fonts/cjk.ttf'});await assert.rejects(()=>broken.event('install'),/cache installation failed/);assert.deepEqual([...old.shared.stores.keys()],before);
});
test('mobile installation bounds downloads to four and reports measured resource counts after verification',async()=>{
  const w=worker({failure:'assets/fonts/cjk.ttf',transient:true});await w.event('install');assert.ok(w.maxInflight()<=4);const progress=w.notices.filter(n=>n.type==='UPDATE_CACHE_PROGRESS');assert.equal(progress[0].done,0);assert.equal(progress.at(-1).done,paths.length);assert.ok(progress.every((n,i)=>n.total===paths.length&&(!i||n.done>=progress[i-1].done)));assert.equal(w.notices.at(-1).type,'UPDATE_CACHE_READY');assert.equal([...w.shared.stores.values()][0].size,paths.length+1);
});
test('permanent failure reports error without emitting ready or false completion',async()=>{
  const w=worker({failure:'assets/fonts/cjk.ttf'});await assert.rejects(w.event('install'));assert.equal(w.shared.stores.size,0);const failures=w.notices.filter(n=>n.type==='UPDATE_CACHE_FAILED');assert.equal(failures.length,1);assert.match(failures[0].detail,/assets\/fonts\/cjk.ttf/);assert.equal(w.notices.some(n=>n.type==='UPDATE_CACHE_READY'),false);
});
test('hash mismatch rejects mixed-version resources instead of installing broken release',async()=>{const w=worker({tamper:'js/app.js'});await assert.rejects(w.event('install'),/资源校验不一致/);assert.equal(w.shared.stores.size,0);});
test('missing known resource never falls through to newer network code',async()=>{const w=worker();await w.event('install');[...w.shared.stores.values()][0].delete(scope+'js/app.js');assert.equal((await w.event('fetch',{request:new Request(scope+'js/app.js')})).status,503);});
test('multi-tab activation needs every client acknowledgement; dirty peer aborts safely',async()=>{
  const w=worker({clientCount:2});await w.event('install');await w.event('message',{data:{type:'ACTIVATE_UPDATE',protocol:2,requestId:'round-1'}});assert.equal(w.skipped(),false);await w.event('message',{data:{type:'APP_UPDATE_READY',requestId:'round-1',ready:true}});assert.equal(w.skipped(),false);await w.event('message',{source:w.clients[1],data:{type:'APP_UPDATE_READY',requestId:'round-1',ready:false,detail:'正在编辑'}});assert.equal(w.skipped(),false);assert.equal(w.notices.at(-1).type,'UPDATE_ABORTED');await w.event('message',{data:{type:'ACTIVATE_UPDATE',protocol:2,requestId:'round-2'}});await w.event('message',{data:{type:'APP_UPDATE_READY',requestId:'round-2',ready:true}});await w.event('message',{source:w.clients[1],data:{type:'APP_UPDATE_READY',requestId:'round-2',ready:true}});assert.equal(w.skipped(),true);
});
test('new peers and legacy multiple windows cannot be activated without acknowledgement',async()=>{
  const w=worker({clientCount:2});await w.event('install');await w.event('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.skipped(),false);assert.equal(w.notices.at(-1).type,'UPDATE_ABORTED');await w.event('message',{data:{type:'ACTIVATE_UPDATE',protocol:2,requestId:'race'}});await w.event('message',{data:{type:'APP_UPDATE_READY',requestId:'race',ready:true}});w.clients.push({id:'new-tab',url:scope,postMessage:()=>{}});await w.event('message',{source:w.clients[1],data:{type:'APP_UPDATE_READY',requestId:'race',ready:true}});assert.equal(w.skipped(),false);assert.match(w.notices.at(-1).detail,/窗口发生变化/);
});
