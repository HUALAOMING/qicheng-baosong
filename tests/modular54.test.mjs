import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const {factory}=await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {loadBuiltinData}=await import('../js/data.js');
const {storage}=await import('../js/storage.js');
const {initializeSaving301}=await import('../js/autosave.js');
const {saveAllLocal,getCurrentBackup}=await import('../js/backup.js');
const backup=await import('../js/modular-backup54.js');
await loadBuiltinData();
const bytes='data:application/octet-stream;base64,AAECAwQF/v8=',createdAt='2026-11-07T00:00:00.000Z';
const makeAsset=(id='file54')=>({id,name:'最终简历.bin',kind:'file',mime:'application/octet-stream',data:bytes,size:8,createdAt,source:'upload',collection:'resume',folderId:'folder54'});
async function workspace54(){await storage.clear();ctx.state=fresh();ctx.state.onboarded=true;ctx.state.profile.name='迁移用户';ctx.state.assetFolders=[{id:'folder54',name:'申请材料',createdAt}];ctx.state.assets=[makeAsset()];ctx.state.education[0].attachments=['file54'];ctx.state.learning.notes='学习正文';initializeSaving301();ctx.savedFingerprint301=null;await saveAllLocal();}
let profile,learning,archive;
test('modular export keeps original bytes out of both JSON files and verifies without mutation',async()=>{
 await workspace54();await storage.set('quiz:mark:bank54/q54',{bankId:'bank54',questionId:'q54',wrong:true,favorite:true});
 const state=await storage.getCurrent({lazyAssets:true}),records=await storage.getUserRecords(),read=storage.assetBlob;storage.assetBlob=()=>{throw new Error('JSON export must not read binary');};
 try{profile=await backup.createPart54('profile',state,records);learning=await backup.createPart54('learning',state,records);}finally{storage.assetBlob=read;}
 assert.ok(JSON.stringify(profile).length<20000);assert.ok(!JSON.stringify(profile).includes('base64'));assert.ok(!JSON.stringify(learning).includes('_assetBlobRef'));
 assert.equal(profile.data.current.profile.name,'迁移用户');assert.equal(learning.data.learning.notes,'学习正文');assert.equal(learning.data.records['quiz:mark:bank54/q54'].favorite,true);
 const before=JSON.stringify(learning);await backup.verifyPart54(learning);await backup.verifyPart54(learning);assert.equal(JSON.stringify(learning),before);
});
test('attachment ZIP roundtrip preserves arbitrary original bytes, folders and uploaded final-resume category',async()=>{
 const blob=await backup.createFilesArchive54(ctx.state,['file54']);archive=await backup.readArchive54(await blob.arrayBuffer());
 assert.deepEqual([...archive.files[0].bytes],[0,1,2,3,4,5,254,255]);assert.equal(archive.manifest.data.assets[0].collection,'resume');assert.equal(archive.manifest.data.folders[0].name,'申请材料');
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());zip.file(archive.files[0].meta.path,new Uint8Array([7,7,7,7,7,7,7,7]));const damagedBytes=await zip.generateAsync({type:'uint8array'});await assert.rejects(()=>backup.readArchive54(damagedBytes),/附件内容校验失败/);
});
test('new-device batch import restores profile, learning and attachments; independent module import preserves other content',async()=>{
 await storage.clear();ctx.state=fresh();ctx.state.profile.name='接收端';initializeSaving301();
 await backup.commitParts54([profile,learning],[archive]);assert.equal(ctx.state.profile.name,'迁移用户');assert.equal(ctx.state.learning.notes,'学习正文');assert.equal(await storage.assetData(ctx.state.assets[0]),bytes);assert.equal(ctx.state.assets[0].collection,'resume');
 ctx.state.profile.name='本机改名';await saveAllLocal();const next=structuredClone(learning);next.data.learning.notes='只导入学习';next.integrity.digest=await backup.partDigest54(next);
 await backup.commitParts54([next]);assert.equal(ctx.state.profile.name,'本机改名');assert.equal(ctx.state.learning.notes,'只导入学习');assert.equal(await storage.assetData(ctx.state.assets[0]),bytes);
});
test('profile import with missing attachments rejects without changing receiving data',async()=>{
 await storage.clear();ctx.state=fresh();ctx.state.profile.name='需要保留';initializeSaving301();ctx.savedFingerprint301=null;await saveAllLocal();const before=await storage.getAll();
 await assert.rejects(()=>backup.commitParts54([profile]),/附件尚未导入/);assert.deepEqual(await storage.getAll(),before);assert.equal(ctx.state.profile.name,'需要保留');
});
test('corrupt JSON and tampered archive inputs reject before any database write',async()=>{
 const before=await storage.getAll(),damaged=structuredClone(profile);damaged.data.current.profile.name='损坏';await assert.rejects(()=>backup.commitParts54([damaged]),/完整性校验失败/);
 const tampered=structuredClone(archive);tampered.files[0].bytes[0]=9;await assert.rejects(()=>backup.commitParts54([profile],[tampered]),/附件内容校验失败/);assert.deepEqual(await storage.getAll(),before);
});
test('existing asset ID with different original bytes cannot overwrite a local file',async()=>{
 await workspace54();ctx.state.assets[0].data='data:application/octet-stream;base64,AQID';delete ctx.state.assets[0]._assetBlobRef;await saveAllLocal();const before=await storage.getAll();
 await assert.rejects(()=>backup.commitParts54([],[archive]),/附件编号冲突/);assert.deepEqual(await storage.getAll(),before);
});
test('injected transaction failure retains every existing module and binary',async()=>{
 await workspace54();const before=await storage.getAll(),setMany=storage.setMany;
 storage.setMany=(records,remove,options)=>{if(options?.expectedClock!==undefined)factory.failAfter=3;return setMany(records,remove,options);};
 try{await assert.rejects(()=>backup.commitParts54([learning]),/空间|事务|write|失败|Injected/i);}finally{storage.setMany=setMany;}
 assert.deepEqual(await storage.getAll(),before);
});
test('concurrent write during restore planning is guarded by the database clock',async()=>{
 await workspace54();const before=await storage.getCurrent(),setMany=storage.setMany;let injected=false;
 storage.setMany=async(records,remove,options)=>{if(options?.expectedClock!==undefined&&!injected){injected=true;await storage.set('settings:concurrent54',{value:'另一窗口'});}return setMany(records,remove,options);};
 try{await assert.rejects(()=>backup.commitParts54([learning]),/另一窗口/);}finally{storage.setMany=setMany;}
 assert.deepEqual(await storage.getCurrent(),before);assert.equal((await storage.get('settings:concurrent54')).value,'另一窗口');
});
test('legacy full JSON remains verifiable after additive metadata upgrades',async()=>{
 const old=await getCurrentBackup();assert.equal(old.backupVersion,2);const {verifyBackup521}=await import('../js/backup.js');await verifyBackup521(old);
});
test('an empty imported learning library preserves all local banks, custom subjects and pack assignments',async()=>{
 const bank=id=>({id,name:id,subject:'custom',section:'custom',version:'1.0.0'});
 const local={schemaVersion:1,banks:[bank('local-math')],assignments:{'local-pack':'local-math'},subjects:[{id:'math',name:'数学'}]};
 const part=await backup.createPart54('learning',fresh(),{'settings:quiz-library':{schemaVersion:1,banks:[],assignments:{}}});
 const plan=await backup.planParts54([part],[],fresh(),{'settings:quiz-library':local});assert.deepEqual(plan.writes['settings:quiz-library'],local);
});
test('a different imported learning library merges banks and subjects by ID and keeps unrelated pack assignments',async()=>{
 const bank=(id,name=id)=>({id,name,subject:'custom',section:'custom',version:'1.0.0'});
 const local={schemaVersion:1,banks:[bank('math'),bank('shared','本机旧名')],assignments:{'math-pack':'math','shared-pack':'shared'},subjects:[{id:'math-subject',name:'数学'}]};
 const incoming={schemaVersion:1,banks:[bank('history'),bank('shared','新名称')],assignments:{'history-pack':'history'},subjects:[{id:'history-subject',name:'历史'}]};
 const part=await backup.createPart54('learning',fresh(),{'settings:quiz-library':incoming});
 const plan=await backup.planParts54([part],[],fresh(),{'settings:quiz-library':local}),result=plan.writes['settings:quiz-library'];
 assert.deepEqual(result.banks.map(b=>b.id),['math','shared','history']);assert.equal(result.banks.find(b=>b.id==='shared').name,'新名称');assert.deepEqual(result.assignments,{'math-pack':'math','shared-pack':'shared','history-pack':'history'});assert.deepEqual(result.subjects.map(s=>s.id),['math-subject','history-subject']);
});
test('learning JSON includes introductions and book drafts; a profile-only import preserves receiving learning fields',async()=>{
 const source=fresh();source.introductions=[{id:'intro54',title:'面试',language:'中文',durationSeconds:60,note:'',body:'自我介绍',updatedAt:createdAt}];source.introductionDraft.body='正在编辑';source.bookDraft.title='阅读草稿';
 const part=await backup.createPart54('learning',source),core=await backup.createPart54('profile',source);
 assert.equal(core.data.current.introductions,undefined);assert.equal(core.data.current.bookDraft,undefined);
 const plan=await backup.planParts54([part],[],fresh(),{});assert.deepEqual(plan.next.introductions,source.introductions);assert.equal(plan.next.bookDraft.title,'阅读草稿');
 const receiving=fresh();receiving.introductionDraft.body='本机学习草稿';const profilePlan=await backup.planParts54([core],[],receiving,{});assert.equal(profilePlan.next.introductionDraft.body,'本机学习草稿');
});
test('inline resume backgrounds are deduplicated into the files ZIP and restored from original bytes',async()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/VZkAAAAASUVORK5CYII=',source=fresh();source.versions[0].paperImage=png;
 const another=structuredClone(source.versions[0]);another.id='background-copy';source.versions.push(another);
 const part=await backup.createPart54('profile',source);assert.equal(part.data.assetRefs.length,1);assert.equal(JSON.stringify(part).includes('base64'),false);
 const file=await backup.readArchive54(await(await backup.createFilesArchive54(source,'*')).arrayBuffer());assert.equal(file.files.length,1);
 const plan=await backup.planParts54([part],[file],fresh(),{});assert.equal(plan.next.versions[0].paperImage,png);assert.equal(plan.next.versions[1].paperImage,png);
});
test('folders independently named the same on two devices merge without dropping assets or changing the local ID',async()=>{
 const receiving=fresh();receiving.assetFolders=[{id:'local-folder54',name:'申请材料',createdAt}];const plan=await backup.planParts54([],[archive],receiving,{});
 assert.equal(plan.next.assetFolders.length,1);assert.equal(plan.next.assetFolders[0].id,'local-folder54');assert.equal(plan.next.assets[0].folderId,'local-folder54');
});
test('quota failure while saving still permits exporting current in-memory edits and unsaved attachment originals',async()=>{
 await workspace54();ctx.state.profile.name='尚未保存的新姓名';ctx.state.assets.push({...makeAsset('unsaved-file54'),data:'data:application/octet-stream;base64,AQID',size:3});factory.failWrite=true;
 const source=await backup.getExportSource54(),part=await backup.createPart54('profile',source.workspace,source.records);assert.ok(source.saveWarning);assert.equal(part.data.current.profile.name,'尚未保存的新姓名');assert.notEqual((await storage.getCurrent()).profile.name,'尚未保存的新姓名');
 const archive=await backup.readArchive54(await(await backup.createFilesArchive54(source.workspace,['unsaved-file54'])).arrayBuffer());assert.deepEqual([...archive.files[0].bytes],[1,2,3]);
});
