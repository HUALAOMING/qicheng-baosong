import test from 'node:test';import assert from 'node:assert/strict';import {setup} from './support.mjs';
const env=await setup(),{storage}=await import('../js/storage.js');
test('saving image originals never decodes/resizes; old derived thumbnails removed atomically',async()=>{
 let decodes=0;globalThis.createImageBitmap=()=>{decodes++;throw Error('must not decode');};
 await storage.replaceAll({current:{profile:{name:'test'},learning:{books:[]},assets:[{id:'image',name:'picture.png',kind:'image',mime:'image/png',size:4,source:'upload',createdAt:'2026-10-29',data:'data:image/png;base64,VGVzdA=='}]}});
 assert.equal(decodes,0);const current=await storage.getCurrent({lazyAssets:true}),ref=current.assets[0]._assetBlobRef;await storage.set('@521:thumb:'+ref,new Blob(['old derived data']));
 current.profile.name='changed';env.factory.failAfter=2;await assert.rejects(storage.commitCurrent(current));assert.ok(await storage.get('@521:thumb:'+ref));
 await storage.commitCurrent(current);assert.equal(await storage.get('@521:thumb:'+ref),undefined);assert.equal(await(await storage.assetBlob(current.assets[0])).text(),'Test');assert.equal(decodes,0);delete globalThis.createImageBitmap;
});
