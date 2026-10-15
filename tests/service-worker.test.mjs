// Execute the actual worker in a VM with Cache/Fetch doubles. No real browser is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {root} from './support.mjs';
const source=await readFile(path.join(root,'service-worker.js'),'utf8');
const origin='https://qicheng.test',scope=origin+'/app/';
function worker(code=source,shared={stores:new Map()},failure='') {
  const listeners={};let claimed=false,skipped=false,offline=false;
  const caches={
    open:async name=>{
      if(!shared.stores.has(name))shared.stores.set(name,new Map());const store=shared.stores.get(name);
      return {
        async addAll(requests){const entries=await Promise.all(requests.map(async r=>{if(r.url.endsWith(failure)&&failure)throw new Error('cache installation failed');const pathname=new URL(r.url).pathname.slice('/app/'.length);return [r.url,await readFile(path.join(root,pathname))];}));for(const [k,v]of entries)store.set(k,v);},
        async match(request){const bytes=store.get(typeof request==='string'?request:request.url);return bytes?new Response(bytes):undefined;}
      };
    },
    keys:async()=>[...shared.stores.keys()],delete:async name=>shared.stores.delete(name)
  };
  const self={registration:{scope},location:{origin},clients:{claim:async()=>{claimed=true;}},addEventListener:(name,fn)=>{listeners[name]=fn;},skipWaiting(){skipped=true;}};
  const context=vm.createContext({self,caches,URL,Request,Response,Set,fetch:async()=>{if(offline)throw new Error('offline');return new Response('network');}});
  vm.runInContext(code,context);
  async function event(name,data={}) {
    let promise,result;listeners[name]({waitUntil:p=>{promise=p;},respondWith:p=>{result=p;},...data});if(promise)await promise;return result?await result:undefined;
  }
  return {event,shared,offline:()=>{offline=true;},claimed:()=>claimed,skipped:()=>skipped};
}
test('actual static cache paths exist and exclude user records, documentation and tests',async()=>{
  const paths=JSON.parse(source.match(/const PRECACHE = (\[[^;]+\]);/)[1]);assert.ok(paths.includes('data/china-map.json'));assert.ok(paths.includes('assets/editable-template.html'));assert.ok(paths.includes('js/storage.js'));
  for(const name of paths){await access(path.join(root,name));assert.ok(!name.startsWith('tests/'));assert.ok(!name.includes('Backup'));}
});
test('cold install caches complete app; navigation, JS, fonts, map and templates work with network disabled',async()=>{
  const w=worker();await w.event('install');await w.event('activate');assert.ok(w.claimed());w.offline();
  const navigation={url:scope+'index.html',method:'GET',mode:'navigate'};assert.ok((await (await w.event('fetch',{request:navigation})).text()).includes('启程'));
  for(const name of ['js/app.js','css/themes.css','data/universities.json','data/china-map.json','assets/fonts/cjk.ttf','assets/editable-template.html'])assert.ok((await (await w.event('fetch',{request:new Request(scope+name)})).arrayBuffer()).byteLength>100);
});
test('worker neither intercepts user-data writes nor external admissions links',async()=>{
  const w=worker();await w.event('install');assert.equal(await w.event('fetch',{request:new Request(scope+'notes',{method:'POST',body:'user data'})}),undefined);assert.equal(await w.event('fetch',{request:new Request('https://university.test/admissions')}),undefined);assert.equal(await w.event('fetch',{request:new Request(scope+'Qicheng_Backup.json')}),undefined);
});
test('explicit no-store resource updates bypass the worker and manifests are not fetched on install',async()=>{
  const w=worker();await w.event('install');
  assert.equal(await w.event('fetch',{request:new Request(scope+'data/resources/english-grammar.json',{cache:'no-store'})}),undefined);
  const paths=JSON.parse(source.match(/const PRECACHE = (\[[^;]+\]);/)[1]);assert.equal(paths.includes('data/resources/manifest.json'),false);
});
test('worker update switches complete version cache and removes only this app old cache',async()=>{
  const first=worker();await first.event('install');first.shared.stores.set('another-app-cache',new Map());const namesBefore=[...first.shared.stores.keys()];
  const updated=worker(source.replace(/v4-[0-9a-f]{12}/,'v4-test-update'),first.shared);await updated.event('install');await updated.event('message',{data:{type:'ACTIVATE_UPDATE'}});assert.ok(updated.skipped());await updated.event('activate');const after=[...updated.shared.stores.keys()];assert.ok(after.includes('another-app-cache'));assert.ok(after.some(n=>n.includes('v4-test-update')));assert.ok(!after.includes(namesBefore[0]));updated.offline();assert.ok(await updated.event('fetch',{request:new Request(scope+'js/storage.js')}));
});
test('failed cache install discards incomplete new cache and leaves current offline version intact',async()=>{
  const old=worker();await old.event('install');const before=[...old.shared.stores.keys()];const broken=worker(source.replace(/v4-[0-9a-f]{12}/,'v4-broken'),old.shared,'assets/fonts/cjk.ttf');await assert.rejects(()=>broken.event('install'),/cache installation failed/);assert.deepEqual([...old.shared.stores.keys()],before);
});
