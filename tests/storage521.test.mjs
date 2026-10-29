import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const environment=await setup();
const {storage,DATABASE_NAME}=await import('../js/storage.js');
const {storage:peer}=await import('../js/storage.js?peer=521');
const workspace=(name='Test')=>({profile:{name},awards:[{id:'award-1',title:'Award',photos:[]}],learning:{books:[],notes:'hello'},assets:[{id:'file-1',name:'notes.txt',mime:'text/plain',kind:'file',data:'data:text/plain;base64,VGVzdA==',size:4,createdAt:'2026-10-28T00:00:00.000Z',source:'upload'}]});

test('workspace normalization separates originals as Blob, reconstructs lossless public view, lazy view contains no original',async()=>{
 await storage.clear();await storage.get('current');await storage.set('current',workspace());
 const raw=environment.factory.databases.get(DATABASE_NAME).data;
 assert.equal(raw.get('current').__workspace521,1);
 const blobs=[...raw].filter(([key])=>key.startsWith('@521:blob:'));
 assert.equal(blobs.length,1);assert.ok(blobs[0][1] instanceof Blob);
 assert.equal(await blobs[0][1].text(),'Test');
 const lazy=await storage.getCurrent({lazyAssets:true});assert.equal(lazy.assets[0].data,'data:text/plain;base64,');assert.ok(lazy.assets[0]._assetBlobRef);
 assert.equal((await storage.get('current')).assets[0].data,workspace().assets[0].data);
 const backup=await storage.getAll();assert.deepEqual(backup.current,workspace());assert.ok(!Object.keys(backup).some(key=>key.startsWith('@521:')));
});
test('editing one field commits only changed row and preserves immutable original Blob identity',async()=>{
 const lazy=await storage.getCurrent({lazyAssets:true}),raw=environment.factory.databases.get(DATABASE_NAME).data;
 const binaryKey=[...raw.keys()].find(key=>key.startsWith('@521:blob:'));
 const beforeRevision=raw.get('@521:rev:'+binaryKey),beforeAwards=raw.get('@521:rev:@521:ws:awards:award-1');
 lazy.profile.name='Changed';const result=await storage.commitCurrent(lazy);
 assert.deepEqual(result.result.changed,['@521:ws:profile']);
 const after=environment.factory.databases.get(DATABASE_NAME).data;
 assert.equal(after.get('@521:rev:'+binaryKey),beforeRevision);assert.equal(after.get('@521:rev:@521:ws:awards:award-1'),beforeAwards);
});
test('two windows reject stale workspace and generic writes without overwriting committed data',async()=>{
 const first=await storage.getCurrent({lazyAssets:true}),second=await peer.getCurrent({lazyAssets:true});
 first.profile.name='Winner';await storage.commitCurrent(first);second.profile.name='Stale';await assert.rejects(()=>peer.commitCurrent(second),{name:'StorageConflictError'});
 await peer.getAll();await assert.rejects(()=>peer.commitCurrent(second),{name:'StorageConflictError'},'export projection must never refresh the editing revision');
 assert.equal((await storage.get('current')).profile.name,'Winner');
 await storage.set('quiz:note',{text:'one'});await peer.get('quiz:note');await storage.set('quiz:note',{text:'two'});
 await assert.rejects(()=>peer.set('quiz:note',{text:'lost'}),{name:'StorageConflictError'});assert.equal((await storage.get('quiz:note')).text,'two');
});
test('failed normalized transaction rolls back all fields and preserves quota failure reason',async()=>{
 const before=await storage.getAll(),incoming=await storage.getCurrent({lazyAssets:true});incoming.profile.name='Do not commit';incoming.awards[0].title='Do not commit';
 environment.factory.failAfter=3;await assert.rejects(()=>storage.commitCurrent(incoming),/Injected write failure/);
 assert.deepEqual(await storage.getAll(),before);
});
test('failed full restore after clear is atomic, updater errors retain exact reason',async()=>{
 const before=await storage.getAll();environment.factory.failAfter=4;await assert.rejects(()=>storage.replaceAll({current:workspace('Restore')}),/Injected write failure/);assert.deepEqual(await storage.getAll(),before);
 await assert.rejects(()=>storage.update('quiz:note',()=>{throw new Error('Specific validation reason');}),/Specific validation reason/);
});
test('restore invalidates a peer observed revision and bank projection retains origin and exact questions',async()=>{
 await peer.get('current');await storage.replaceAll({current:workspace('Restored')});const stale=workspace('stale');await assert.rejects(()=>peer.commitCurrent(stale),{name:'StorageConflictError'});
 const bank={id:'sample',name:'Sample'},q={id:'q-1',type:'true-false',question:'Question',answer:true,explanation:''};
 await storage.setMany({'@521:bank:meta:custom:sample':{schemaVersion:1,origin:'custom',bank,questionIds:['q-1']},'@521:bank:q:custom:sample/q-1':q});
 const projected=(await storage.getAll())['resource:custom:sample'];assert.equal(projected.origin,'custom');assert.deepEqual(projected.questions,[q]);assert.deepEqual(await storage.get('resource:custom:sample'),projected);
});
test('removing the last asset reference garbage collects original and thumbnail atomically',async()=>{
 const current=await storage.getCurrent({lazyAssets:true}),ref=current.assets[0]._assetBlobRef;current.assets=[];
 environment.factory.failAfter=2;await assert.rejects(()=>storage.commitCurrent(current));
 assert.equal((await storage.get('current')).assets.length,1);
 await storage.commitCurrent(current);
 const raw=environment.factory.databases.get(DATABASE_NAME).data;
 assert.equal(raw.has('@521:blob:'+ref),false);assert.equal(raw.has('@521:thumb:'+ref),false);
 assert.deepEqual((await storage.get('current')).assets,[]);
});
