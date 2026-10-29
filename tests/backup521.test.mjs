import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {storage}=await import('../js/storage.js');
const {validateDraft}=await import('../js/utils/validation.js');
const {initializeSaving301,save}=await import('../js/autosave.js');
const {getCurrentBackup,verifyBackup521,commitBackup,backupDigest521}=await import('../js/backup.js');
const {loadBuiltinData}=await import('../js/data.js');
await loadBuiltinData();
const original='data:application/octet-stream;base64,AAECAwQF/v8=';
let file;
test('backup v2 materializes exact original bytes from lazy Blob workspace without local pointers',async()=>{
 await storage.clear();ctx.state=fresh();initializeSaving301();
 ctx.state.assets.push({id:'original-file',name:'原始附件.bin',mime:'application/octet-stream',kind:'file',data:original,size:8,createdAt:'2026-10-28T00:00:00.000Z',source:'upload'});
 assert.equal(await save(),true);
 ctx.state=validateDraft(await storage.getCurrent({lazyAssets:true}),{trustedLocal:true});initializeSaving301();
 assert.notEqual(ctx.state.assets[0].data,original);assert.ok(ctx.state.assets[0]._assetBlobRef);
 file=await getCurrentBackup();assert.equal(file.backupVersion,2);assert.equal(file.data.current.assets[0].data,original);assert.ok(!JSON.stringify(file).includes('_assetBlobRef'));assert.ok(!JSON.stringify(file).includes('_assetPreview'));
 assert.equal(file.integrity.digest,await backupDigest521(file));
});
test('preflight can precede atomic restore without invalidating integrity; restored original is lossless',async()=>{
 await verifyBackup521(file);assert.equal(await commitBackup(file),true);
 assert.equal((await storage.get('current')).assets[0].data,original);
 assert.equal(await(await storage.assetBlob(ctx.state.assets[0])).arrayBuffer().then(bytes=>Buffer.from(bytes).toString('base64')),'AAECAwQF/v8=');
});
test('damaged complete backup is rejected before replacing existing database',async()=>{
 const before=await storage.getAll(),damaged=structuredClone(file);damaged.data.current.profile.name='tampered';
 await assert.rejects(()=>commitBackup(damaged),/完整性校验失败/);assert.deepEqual(await storage.getAll(),before);
});
test('external backups cannot supply local Blob pointers even with matching recalculated digest',async()=>{
 const bad=structuredClone(file);bad.data.current.assets[0]._assetBlobRef='another-local-file';bad.integrity.digest=await backupDigest521(bad);
 const before=await storage.getAll();await assert.rejects(()=>commitBackup(bad),/外部备份不能含本机附件指针/);assert.deepEqual(await storage.getAll(),before);
});
