import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {storage}=await import('../js/storage.js');
const {storage:peer}=await import('../js/storage.js?autosavePeer521');
const {ctx}=await import('../js/state.js');
const {fresh,snapshot3}=await import('../js/model.js');
const {save,initializeSaving301,cancelPendingSave}=await import('../js/autosave.js');
test('no-op save avoids writes; rapid queued saves retain latest edit and actual commit state',async()=>{
 await storage.clear();await storage.get('current');ctx.state=fresh();initializeSaving301();
 const before=storage.lastCommit();assert.equal(await save(),true);assert.equal(storage.lastCommit(),before);
 ctx.state.profile.name='first';const first=save();ctx.state.profile.name='latest';const last=save();assert.equal(await first,true);assert.equal(await last,true);
 assert.equal((await storage.get('current')).profile.name,'latest');assert.equal(ctx.saveError,false);assert.equal(ctx.saving,false);
});
test('storage snapshots omit immutable binary projections and photos before cloning',async()=>{
 ctx.state.assets=[{id:'image',name:'original.png',mime:'image/png',kind:'image',data:'data:image/png;base64,QUJDRA==',size:4,createdAt:'2026-10-28T00:00:00Z',source:'upload',_assetBlobRef:'original-ref',_assetPreview:'data:image/png;base64,'}];
 ctx.state.media=[{id:'photo',assetId:'image',data:ctx.state.assets[0].data,name:'photo'}];
 const snapshot=snapshot3({forStorage:true});assert.equal(snapshot.assets[0].data,undefined);assert.equal(snapshot.media[0].data,undefined);assert.equal(ctx.state.assets[0].data,'data:image/png;base64,QUJDRA==');
 ctx.state.assets=[];ctx.state.media=[];
});
test('autosave pins UI revision even after incidental database reads; conflicts preserve local unsaved edits',async()=>{
 ctx.state.profile.name='baseline';assert.equal(await save(),true);
 const other=await peer.getCurrent({lazyAssets:true});other.profile.name='peer winner';await peer.commitCurrent(other);
 await storage.getAll();await storage.get('current');
 ctx.state.profile.name='unsaved UI';assert.equal(await save(),false);assert.equal(ctx.state.profile.name,'unsaved UI');assert.equal(ctx.saveError,true);assert.equal(ctx.dirty301,true);
 assert.equal((await storage.getAll()).current.profile.name,'peer winner');cancelPendingSave();
});
