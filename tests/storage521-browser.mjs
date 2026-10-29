import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.join(root,'tests/generated/storage521');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep))throw Error();const b=await readFile(file);res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':'text/html','Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext(),page=await context.newPage(),checks=[];
try{
 await page.goto(base+'/tests/fixtures/storage-empty.html').catch(()=>{});
 const result=await page.evaluate(async()=>{
  const {storage}=await import('/js/storage.js');await storage.get('current');
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;const c=canvas.getContext('2d');c.fillStyle='#e3cda5';c.fillRect(0,0,768,1024);c.fillStyle='#122d49';c.font='80px sans-serif';c.fillText('Original 521',30,400);const data=canvas.toDataURL('image/png');
  const file='data:application/octet-stream;base64,'+btoa('x'.repeat(4*1024*1024));
  const current={profile:{name:'Edge fixture'},learning:{books:[],notes:''},assets:[{id:'photo',name:'original.png',mime:'image/png',kind:'image',data,size:0},{id:'file',name:'original.bin',mime:'application/octet-stream',kind:'file',data:file,size:4*1024*1024}],awards:[{id:'a1',photos:[{id:'p1',assetId:'photo'}]}]};
  await storage.commitCurrent(current);const lazy=await storage.getCurrent({lazyAssets:true}),full=await storage.getAll();
  const bitmap=await createImageBitmap(await storage.assetBlob(lazy.assets[0]));
  const before=performance.now();lazy.profile.name='one field';const commit=await storage.commitCurrent(lazy),saveMs=performance.now()-before;
  const output={fullImageExact:full.current.assets[0].data===data,fullAttachmentExact:full.current.assets[1].data===file,originalSize:[bitmap.width,bitmap.height],thumbnailRecords:Object.keys(await storage.getPrefix('@521:thumb:')).length,lazyAttachmentBytes:lazy.assets[1].data.length,saveMs,changedKeys:commit.result.changed,revision:storage.revision('current')};bitmap.close();return output;
 });
 assert.ok(result.fullImageExact&&result.fullAttachmentExact);assert.deepEqual(result.originalSize,[768,1024]);assert.equal(result.thumbnailRecords,0);assert.ok(result.lazyAttachmentBytes<100);assert.deepEqual(result.changedKeys,['@521:ws:profile']);checks.push({name:'real IDB Blob original/no-thumbnail/lazy attachment/incremental single-field commit',status:'PASS',...result});
 const peer=await context.newPage();await peer.goto(base+'/tests/fixtures/storage-empty.html');await peer.evaluate(async()=>{const {storage}=await import('/js/storage.js');window.stale=await storage.getCurrent({lazyAssets:true});});
 await page.evaluate(async()=>{const{storage}=await import('/js/storage.js');const current=await storage.getCurrent({lazyAssets:true});current.profile.name='winner';await storage.commitCurrent(current);});
 const conflict=await peer.evaluate(async()=>{const{storage}=await import('/js/storage.js');window.stale.profile.name='loser';try{await storage.commitCurrent(window.stale);return 'overwritten';}catch(error){return error.name;}});assert.equal(conflict,'StorageConflictError');checks.push({name:'separate Edge tabs reject stale whole-workspace overwrite',status:'PASS'});
 await page.reload();const retained=await page.evaluate(async()=>{const{storage}=await import('/js/storage.js');const current=await storage.getCurrent({lazyAssets:true});return {profileName:current.profile.name,size:(await storage.assetBlob(current.assets[1])).size};});assert.equal(retained.profileName,'winner');assert.equal(retained.size,4*1024*1024);checks.push({name:'refresh retains text and exact attachment size',status:'PASS',...retained});
 console.log(JSON.stringify(checks,null,2));
}finally{await writeFile(path.join(out,'evidence.json'),JSON.stringify({date:new Date().toISOString(),platform:'Windows Edge headless',checks},null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}


