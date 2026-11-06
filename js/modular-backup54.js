import {ctx} from './state.js';
import {VERSION} from './constants.js';
import {storage} from './storage.js';
import {snapshot3,fresh,synchronizeEditing} from './model.js';
import {assertJSON,validateDraft} from './utils/validation.js';
import {$,$$,esc,download,toast} from './utils/helpers.js';
import {ensureVendors} from './lazy-runtime.js';
import {saveAllLocal,verifyBackup521,commitBackup} from './backup.js';
import {initializeSaving301,cancelPendingSave} from './autosave.js';
import {confirmAction,render} from './app.js';
import {validateResourceRecords,reloadResources} from './resources.js';
import {validateQuizRecords,initializeQuiz,getQuizDraftRecord,QUIZ_DRAFT_KEY} from './modules/quiz.js';
import {validateHomeRecords,initializeHome} from './modules/home.js';
import {validateJournalRecords,initializeJournal} from './modules/journal.js';
import {validateExamCalendarRecords,initializeExamCalendar} from './modules/exam-calendar.js';
import {initializeTimer53} from './timer53.js';
import {resetLoadedFeatures53,pendingFeatureRecords53} from './features53.js';
import {bankDelta521} from './bank-store521.js';
import {noteExternalBackup521} from './storage-status.js';

// A progress save never enters this module. Binary originals are read only for a
// deliberately selected file export or an imported-file collision check.
const PARTS54=['profile','learning','files'],PART_LABELS54={profile:'个人资料与简历',learning:'学习中心',files:'附件与照片'};
const MAX_ARCHIVE54=512*1024*1024;
const LEARNING_FIELDS54=['introductions','introductionDraft','bookDraft'];
let backupNotice54='';
function learningKey54(key){return /^(?:quiz:|resource:|question:|learning:|journal:|calendar:exam:)/.test(key)||['settings:quiz-library','settings:journal','settings:timer53','settings:learning-overview53'].includes(key);}
function userKey54(key){return key!=='current'&&key!=='__seedCleared'&&!/^(?:@521:|meta:|session:)/.test(key);}
function metadata54(value){
 if(Array.isArray(value))return value.map(metadata54);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['data','_assetBlobRef','_assetPreview'].includes(k)).map(([k,v])=>[k,metadata54(v)]));
 return value;
}
async function digestBytes54(bytes){if(!globalThis.crypto?.subtle)throw new Error('请在 HTTPS 或本地服务器中使用备份校验。');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function partDigest54(part){const {integrity,...content}=part;return digestBytes54(new TextEncoder().encode(JSON.stringify(content)));}
async function sealPart54(part,data){const result={app:'Qicheng',backupVersion:3,part,appVersion:VERSION,createdAt:new Date().toISOString(),data};assertJSON(result);result.integrity={algorithm:'SHA-256',digest:await partDigest54(result)};return result;}
function referencedIds54(value,ids=new Set()){
 if(!value||typeof value!=='object')return ids;
 for(const [key,item]of Object.entries(value)){
  if(key==='assetId'&&typeof item==='string')ids.add(item);
  else if(key==='attachments'&&Array.isArray(item))item.filter(id=>typeof id==='string').forEach(id=>ids.add(id));
  else if(key==='paperImage'&&typeof item==='string'&&item.startsWith('qicheng-asset:'))ids.add(item.slice(14));
  else referencedIds54(item,ids);
 }
 return ids;
}
async function externalizeImages54(workspace){
 const result=structuredClone(workspace),seen=new Map(),extra=[];
 const walk=async value=>{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){
  if(key==='paperImage'&&typeof item==='string'&&/^data:image\/(?:png|jpeg);base64,/.test(item)){
   let id=seen.get(item);if(!id){id='background-'+(await digestBytes54(new TextEncoder().encode(item))).slice(0,32);seen.set(item,id);if(!result.assets.some(a=>a.id===id))extra.push({id,name:'简历背景_'+id.slice(-8)+(item.startsWith('data:image/png')?'.png':'.jpg'),mime:item.slice(5,item.indexOf(';')),kind:'image',data:item,size:atob(item.split(',')[1]).length,createdAt:workspace.savedAt||new Date().toISOString(),source:'resume-background'});}
   value[key]='qicheng-asset:'+id;
  }else await walk(item);
 }};
 await walk(result);result.assets.push(...extra);return result;
}
async function resolveImages54(value,assets){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){
 if(key==='paperImage'&&typeof item==='string'&&item.startsWith('qicheng-asset:')){const asset=assets.find(a=>a.id===item.slice(14));if(!asset)throw new Error('简历背景原图尚未导入，请同时上传附件 ZIP。');value[key]=await storage.assetData(asset);}
 else await resolveImages54(item,assets);
}}
function validateRecords54(records){
 assertJSON(records);validateResourceRecords(records,{allowOfficial:true});validateQuizRecords(records);validateHomeRecords(records);validateJournalRecords(records);validateExamCalendarRecords(records);
 for(const [key,value] of Object.entries(records)){
  if(key.startsWith('question:note:')&&(!value||value.schemaVersion!==1||typeof value.bankId!=='string'||typeof value.questionId!=='string'||key!=='question:note:'+value.bankId+'/'+value.questionId||typeof value.text!=='string'||value.text.length>100000||!Number.isFinite(Date.parse(value.updatedAt))))throw new Error('题目笔记格式无效：'+key);
 }
 return records;
}
function assetMeta54(a){const clean=metadata54(a);if(!clean||! /^[A-Za-z0-9_-]{1,100}$/.test(clean.id)||typeof clean.name!=='string'||!clean.name||clean.name.length>100000||typeof clean.mime!=='string'||! /^[\w.+\-/]*$/.test(clean.mime)||!['image','file','export'].includes(clean.kind)||!Number.isFinite(clean.size)||clean.size<0||typeof clean.createdAt!=='string'||typeof clean.source!=='string')throw new Error('附件索引格式无效。');return clean;}
function folders54(value){if(!Array.isArray(value)||value.length>200)throw new Error('文件夹索引格式无效。');const ids=new Set();for(const f of value){if(!f||! /^[A-Za-z0-9_-]{1,100}$/.test(f.id)||ids.has(f.id)||typeof f.name!=='string'||!f.name.trim()||f.name.length>120||!Number.isFinite(Date.parse(f.createdAt)))throw new Error('文件夹索引格式无效。');ids.add(f.id);}return value;}
function rejectBinary54(value){if(!value||typeof value!=='object')return;for(const [key,v]of Object.entries(value)){if(['data','_assetBlobRef','_assetPreview'].includes(key))throw new Error('资料 JSON 不应包含附件原文或本机指针，请使用附件 ZIP。');rejectBinary54(v);}}
async function createPart54(part,workspace,records={}){
 if(!['profile','learning'].includes(part))throw new Error('请选择资料或学习备份。');
 const clean=metadata54(part==='profile'?await externalizeImages54(workspace):workspace),other=Object.fromEntries(Object.entries(records).filter(([key])=>userKey54(key)&&learningKey54(key)===(part==='learning')));
 if(part==='learning'){
  const fields=Object.fromEntries(LEARNING_FIELDS54.map(key=>[key,clean[key]])),ids=referencedIds54({learning:clean.learning,fields});
  return sealPart54(part,{learning:clean.learning,fields,assetRefs:clean.assets.filter(a=>ids.has(a.id)).map(assetMeta54),records:validateRecords54(other)});
 }
 const {learning,assets,assetFolders,...current}=clean;
 for(const key of LEARNING_FIELDS54)delete current[key];
 for(const key of ['route','section','step','sidebarHidden','menuOpen'])delete current[key];
 const ids=referencedIds54(current);
 return sealPart54(part,{current,assetRefs:assets.filter(a=>ids.has(a.id)).map(assetMeta54),records:validateRecords54(other)});
}
async function verifyPart54(input){
 const part=typeof input==='string'?JSON.parse(input.replace(/^\uFEFF/,'')):structuredClone(input);
 assertJSON(part);
 if(part?.app!=='Qicheng'||part.backupVersion!==3||!PARTS54.includes(part.part)||typeof part.appVersion!=='string'||!Number.isFinite(Date.parse(part.createdAt))||!part.data||typeof part.data!=='object'||Array.isArray(part.data))throw new Error('不是有效的启程分模块备份。');
 if(part.integrity?.algorithm!=='SHA-256'||! /^[a-f0-9]{64}$/.test(part.integrity?.digest)||await partDigest54(part)!==part.integrity.digest)throw new Error('备份完整性校验失败，原数据未更改。');
 rejectBinary54(part.data);
 if(part.part==='files'){
  folders54(part.data.folders);if(!Array.isArray(part.data.assets)||part.data.assets.length>1500)throw new Error('附件清单无效。');
  const ids=new Set(),paths=new Set();for(const a of part.data.assets){assetMeta54(a);if(ids.has(a.id)||paths.has(a.path)||typeof a.path!=='string'||!a.path.startsWith('files/'+a.id+'/')||a.path.includes('..')||a.path.includes('\\')||! /^[a-f0-9]{64}$/.test(a.sha256))throw new Error('附件路径或校验信息无效。');if(a.folderId&&!part.data.folders.some(f=>f.id===a.folderId))throw new Error('附件引用的文件夹缺失。');ids.add(a.id);paths.add(a.path);}
 }else{
  if(!part.data.records||Object.keys(part.data.records).some(key=>!userKey54(key)||learningKey54(key)!==(part.part==='learning')))throw new Error('备份包含不属于该模块的记录。');
  validateRecords54(part.data.records);
  if(part.part==='profile'){
   if(!part.data.current||Array.isArray(part.data.current)||Object.keys(part.data.current).some(key=>!Object.hasOwn(fresh(),key)||['learning','assets','assetFolders'].includes(key)))throw new Error('个人资料字段无效。');
   if(!Array.isArray(part.data.assetRefs)||part.data.assetRefs.length>1500||new Set(part.data.assetRefs.map(a=>a.id)).size!==part.data.assetRefs.length)throw new Error('附件引用清单无效。');part.data.assetRefs.forEach(assetMeta54);
  }else{
   if(!part.data.learning||!Array.isArray(part.data.learning.books))throw new Error('学习资料字段无效。');
   if(part.data.fields&&Object.keys(part.data.fields).some(key=>!LEARNING_FIELDS54.includes(key)))throw new Error('学习资料包含其他模块字段。');
   if(part.data.assetRefs){if(!Array.isArray(part.data.assetRefs)||part.data.assetRefs.length>1500||new Set(part.data.assetRefs.map(a=>a.id)).size!==part.data.assetRefs.length)throw new Error('附件引用清单无效。');part.data.assetRefs.forEach(assetMeta54);}
  }
 }
 return part;
}
async function createFilesArchive54(workspace,selectedIds){
 await ensureVendors(['jszip']);
 if(selectedIds==='*')workspace=await externalizeImages54(workspace);
 const ids=selectedIds==='*'?new Set(workspace.assets.map(a=>a.id)):new Set(selectedIds||[]),assets=workspace.assets.filter(a=>ids.has(a.id));
 if(!assets.length)throw new Error('请先选择要导出的文件或文件夹。');
 if(assets.length!==ids.size)throw new Error('所选文件已变化，请重新选择。');
 const zip=new JSZip(),index=[];let total=0;
 for(const a of assets){
  const blob=await storage.assetBlob(a);total+=blob.size;if(total>MAX_ARCHIVE54)throw new Error('附件总量超过 512 MB，请按文件夹分批导出。');
  const bytes=await blob.arrayBuffer(),filename=a.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/\.\./g,'_').trim().slice(0,120)||'attachment';
  const path='files/'+a.id+'/'+filename;zip.file(path,bytes);index.push({...assetMeta54(a),size:blob.size,path,sha256:await digestBytes54(bytes)});
 }
 const folderIds=new Set(index.map(a=>a.folderId).filter(Boolean));
 const manifest=await sealPart54('files',{folders:folders54(workspace.assetFolders||[]).filter(f=>selectedIds==='*'||folderIds.has(f.id)),assets:index});
 zip.file('manifest.json',JSON.stringify(manifest,null,2));
 return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3},mimeType:'application/zip'});
}
async function generateFilesArchive54(selectedIds){if(ctx.uploadBusy||ctx.persistencePaused)throw new Error('请等待当前操作完成。');return createFilesArchive54(snapshot3({forStorage:true}),selectedIds);}
async function getExportSource54({includeRecords=true}={}){
 let saveWarning='';try{await saveAllLocal();}catch(error){saveWarning=error.message;}
 const workspace=snapshot3({forStorage:true}),records=includeRecords?await storage.getUserRecords():{};
 Object.assign(records,pendingFeatureRecords53());const draft=getQuizDraftRecord();if(draft)records[QUIZ_DRAFT_KEY]=draft;
 return {workspace,records,saveWarning};
}
async function readArchive54(input){
 await ensureVendors(['jszip']);const bytes=input instanceof Blob?await input.arrayBuffer():input;
 if(bytes.byteLength>MAX_ARCHIVE54)throw new Error('附件 ZIP 超过 512 MB，请分批导入。');
 const zip=await JSZip.loadAsync(bytes),manifestFile=zip.file('manifest.json');if(!manifestFile||manifestFile._data?.uncompressedSize>4*1024*1024)throw new Error('ZIP 缺少启程附件清单，或清单过大。');
 const manifest=await verifyPart54(await manifestFile.async('string'));if(manifest.part!=='files')throw new Error('这不是附件备份 ZIP。');
 const result=[],expected=new Set(['manifest.json']);let total=0;
 for(const a of manifest.data.assets){
  const entry=zip.file(a.path);if(!entry||entry.dir||entry.unsafeOriginalName&&entry.unsafeOriginalName!==a.path||entry._data?.uncompressedSize!==a.size)throw new Error('附件丢失或大小不一致：'+a.name);
  total+=a.size;if(total>MAX_ARCHIVE54)throw new Error('解压后的附件超过 512 MB，请分批导入。');
  const data=await entry.async('uint8array');if(data.byteLength!==a.size||await digestBytes54(data)!==a.sha256)throw new Error('附件内容校验失败：'+a.name);
  result.push({meta:a,bytes:data});expected.add(a.path);
 }
 if(Object.values(zip.files).some(entry=>!entry.dir&&!expected.has(entry.name)))throw new Error('ZIP 包含未登记文件，请使用启程导出的附件包。');
 return {manifest,files:result};
}
function bytesData54(bytes,mime){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return 'data:'+(mime||'application/octet-stream')+';base64,'+btoa(binary);}
async function planParts54(parts,archives,workspace,records){
 const next=structuredClone(workspace),writes={},seen=new Set();next.assetFolders||=[];let added=0;
 for(const a of next.assets)if(a._assetBlobRef&&!a.data)a.data=a._assetPreview||'data:'+(a.mime||'application/octet-stream')+';base64,';
 for(const part of parts){if(seen.has(part.part))throw new Error('同一批次只能导入一份'+PART_LABELS54[part.part]+'备份。');seen.add(part.part);}
 if(archives.length>1)throw new Error('同一批次请只选择一个附件 ZIP；其他附件包可继续分次导入。');
 for(const archive of archives){
  const folderMap=new Map();
  for(const folder of archive.manifest.data.folders){
   const old=next.assetFolders.find(f=>f.id===folder.id),sameName=next.assetFolders.find(f=>f.id!==folder.id&&f.name.trim().toLocaleLowerCase()===folder.name.trim().toLocaleLowerCase());
   if(old){if(!sameName)Object.assign(old,folder);folderMap.set(folder.id,old.id);}
   else if(sameName)folderMap.set(folder.id,sameName.id);
   else {next.assetFolders.push(structuredClone(folder));folderMap.set(folder.id,folder.id);}
  }
  for(const item of archive.files){
   const {path,sha256,...meta}=item.meta;if(meta.folderId)meta.folderId=folderMap.get(meta.folderId)||meta.folderId;const old=next.assets.find(a=>a.id===meta.id);
   if(old){const bytes=await(await storage.assetBlob(old)).arrayBuffer();if(await digestBytes54(bytes)!==sha256)throw new Error('附件编号冲突：'+meta.name+'。现有文件和资料均未更改。');const data=old.data,ref=old._assetBlobRef,preview=old._assetPreview;Object.assign(old,meta,{data});if(ref)Object.assign(old,{_assetBlobRef:ref,_assetPreview:preview});}
   else {next.assets.push({...meta,data:bytesData54(item.bytes,meta.mime)});added++;}
  }
 }
 for(const part of parts){
  for(const a of part.data.assetRefs||[]){const local=next.assets.find(x=>x.id===a.id);if(!local)throw new Error('资料引用的附件尚未导入：'+a.name+'。请先导入附件 ZIP，或将 JSON 和附件 ZIP 一并上传。');if(local.mime!==a.mime||local.kind!==a.kind)throw new Error('附件索引与当前文件冲突：'+a.name);}
  if(part.part==='profile'){
   Object.assign(next,structuredClone(part.data.current));
  }else if(part.part==='learning'){next.learning=structuredClone(part.data.learning);Object.assign(next,structuredClone(part.data.fields||{}));}
  Object.assign(writes,structuredClone(part.data.records),validateResourceRecords(part.data.records,{allowOfficial:true}));
 }
 // A learning backup merges into the receiving device. Its library is a nested
 // index, so replacing the index would hide unrelated banks and orphan packs.
 const libraryKey='settings:quiz-library',incomingLibrary=writes[libraryKey],localLibrary=records[libraryKey];
 if(incomingLibrary&&localLibrary){
  const mergeById=(oldRows=[],newRows=[])=>[...new Map([...oldRows,...newRows].map(row=>[row.id,structuredClone(row)])).values()];
  writes[libraryKey]={...structuredClone(localLibrary),...incomingLibrary,banks:mergeById(localLibrary.banks,incomingLibrary.banks),assignments:{...localLibrary.assignments,...incomingLibrary.assignments}};
  if(localLibrary.subjects||incomingLibrary.subjects)writes[libraryKey].subjects=mergeById(localLibrary.subjects,incomingLibrary.subjects);
 }
 // Core and learning JSON keep references; validate only after all selected parts
 // have been assembled, so a missing file can never silently erase an attachment.
 await resolveImages54(next,next.assets);
 const checked=validateDraft(next,{trustedLocal:true});validateRecords54({...records,...writes});
 return {next:checked,writes,added,parts:[...seen,...(archives.length?['files']:[])]};
}
async function commitParts54(parts,archives=[]){
 if(ctx.busy||ctx.uploadBusy||ctx.persistencePaused)throw new Error('请等待当前操作完成。');
 // Revalidate public API inputs immediately before any database mutation.
 const checked=await Promise.all(parts.map(verifyPart54));for(const archive of archives){await verifyPart54(archive.manifest);if(archive.files.length!==archive.manifest.data.assets.length)throw new Error('附件内容清单不完整。');for(let i=0;i<archive.files.length;i++){const entry=archive.files[i],registered=archive.manifest.data.assets[i];if(JSON.stringify(entry.meta)!==JSON.stringify(registered)||entry.bytes.byteLength!==registered.size||await digestBytes54(entry.bytes)!==registered.sha256)throw new Error('附件内容校验失败，原数据未更改。');}}
 await saveAllLocal();ctx.busy=true;ctx.persistencePaused=true;cancelPendingSave();document.body.inert=true;
 try{
  const expectedClock=await storage.get('@521:clock')||0,workspace=snapshot3({forStorage:true}),records=await storage.getUserRecords(),plan=await planParts54(checked,archives,workspace,records),expected={current:storage.revision('current')},writes={...plan.writes,current:plan.next};
  for(const key of Object.keys(plan.writes)){await storage.get(key);expected[key]=storage.revision(key);}
  const removals=[];
  for(const [key,value]of Object.entries(plan.writes))if(key.startsWith('resource:')&&value?.bank){const delta=bankDelta521(value,records[key]);delete writes[key];Object.assign(writes,delta.writes);removals.push(...delta.removals,key);for(const name of [...Object.keys(delta.writes),...delta.removals]){await storage.get(name);expected[name]=storage.revision(name);}}
  if(plan.parts.includes('learning'))removals.push('@521:quiz:overview','meta:journal-overview','settings:learning-overview53');
  writes['meta:device']={...(await storage.get('meta:device')),lastImportedAt:new Date().toISOString(),lastSavedAt:new Date().toISOString()};
  await storage.setMany(writes,removals,{expected,expectedClock});
  // The transaction has committed; failure to repaint must never claim rollback.
  ctx.state=validateDraft(await storage.getCurrent({lazyAssets:true}),{trustedLocal:true});resetLoadedFeatures53();
  try{await reloadResources();const all=await storage.getUserRecords();await Promise.all([initializeQuiz(all),initializeHome(all),initializeJournal(all),initializeExamCalendar(all),initializeTimer53(all['settings:timer53']||null)]);synchronizeEditing();initializeSaving301();}catch{location.reload();}
  return plan;
 }finally{ctx.busy=false;ctx.persistencePaused=false;document.body.inert=false;}
}
function modularBackupMarkup54(){return '<section class="settings-section" id="modularBackup54"><p class="eyebrow">YOUR DATA / IMPORT & EXPORT</p><h2>导入与导出</h2><p>按需选择模块。个人资料和学习记录分别保存为 JSON，附件与照片以原始文件保存为 ZIP。默认不选中任何模块。</p><fieldset><legend>选择导出内容</legend>'+PARTS54.map(part=>'<label class="check"><input type="checkbox" data-backup-part54="'+part+'">'+PART_LABELS54[part]+(part==='files'?' ZIP（全部文件；可到文件管理选择文件夹或单个文件）':' JSON')+'</label>').join('')+'</fieldset><div class="actions"><button class="primary" data-backup-export54 disabled>导出所选模块</button><button data-go3="archive">选择文件夹或文件导出</button></div><h3>导入备份</h3><p class="hint">单独导入个人资料或学习 JSON 时，所引用的附件需已在本机；也可将 JSON 与附件 ZIP 一起上传。学习记录按编号合并，同编号内容会更新，其他模块和本机附件保留。全部文件先校验，通过确认后一次提交；失败不写入任何内容。</p><div class="actions">'+[['profile','上传个人资料 JSON','.json,application/json'],['learning','上传学习中心 JSON','.json,application/json'],['files','上传附件 ZIP','.zip,application/zip'],['batch','一并上传多个备份','.json,.zip,application/json,application/zip'],['legacy','导入旧版完整 JSON','.json,application/json']].map(([id,label,accept])=>'<button type="button" data-backup-pick54="'+id+'">'+label+'</button><input type="file" data-backup-import54="'+id+'" aria-label="'+label+'" accept="'+accept+'" '+(id==='batch'?'multiple ':'')+'hidden>').join('')+'</div><p data-backup-notice54 class="hint" role="status">'+esc(backupNotice54)+'</p><p class="hint">旧版完整 JSON 继续支持，恢复旧备份会完整替换当前资料；导入前会单独提示。新备份不再默认生成包含所有附件的大 JSON。</p></section>';}
function bindModularBackup54(){
 const exportButton=$('[data-backup-export54]');if(!exportButton)return;
 $$('[data-backup-pick54]').forEach(button=>button.onclick=()=>{if(!ctx.busy&&!ctx.uploadBusy)$('[data-backup-import54="'+button.dataset.backupPick54+'"]').click();});
 const checks=$$('[data-backup-part54]');checks.forEach(node=>node.onchange=()=>{exportButton.disabled=!checks.some(input=>input.checked);});
 exportButton.onclick=async()=>{
  if(ctx.busy||ctx.uploadBusy)return;const selected=checks.filter(node=>node.checked).map(node=>node.dataset.backupPart54);if(!selected.length)return;
  exportButton.disabled=true;backupNotice54='正在生成所选备份…';$('[data-backup-notice54]').textContent=backupNotice54;
  try{
   const {workspace,records,saveWarning}=await getExportSource54({includeRecords:selected.some(part=>part!=='files')});
   // Build all selected files before presenting downloads, so a validation error
   // cannot leave the user with an apparently complete but partial export.
   const files=[];for(const part of selected){const name='Qicheng_'+part+'_'+new Date().toISOString().slice(0,10)+(part==='files'?'.zip':'.json');files.push({name,blob:part==='files'?await createFilesArchive54(workspace,'*'):new Blob([JSON.stringify(await createPart54(part,workspace,records),null,2)],{type:'application/json;charset=utf-8'})});}
   if(files.length===1)download(files[0].blob,files[0].blob.type,files[0].name);else{await ensureVendors(['jszip']);const zip=new JSZip();for(const file of files)zip.file(file.name,await file.blob.arrayBuffer());download(await zip.generateAsync({type:'blob',compression:'STORE'}),'application/zip','Qicheng_Selected_Backups_'+new Date().toISOString().slice(0,10)+'.zip');}
   backupNotice54='已生成 '+selected.map(part=>PART_LABELS54[part]).join('、')+'。多个模块会放入同一外层 ZIP，保留各自独立文件。'+(saveWarning?' 本机进度保存未完成；本次备份已包含当前可读取的修改和答题草稿，请妥善保存下载文件。':'');await noteExternalBackup521('download','分模块备份：'+selected.join(',')).catch(()=>{});
  }catch(error){backupNotice54=error.message;toast(error.message);}finally{exportButton.disabled=!checks.some(node=>node.checked);$('[data-backup-notice54]').textContent=backupNotice54;}
 };
 $$('[data-backup-import54]').forEach(input=>input.onchange=async()=>{
  const files=[...input.files];input.value='';if(!files.length||ctx.busy||ctx.uploadBusy)return;
  try{
   const prepared=await readBackupFiles54(files,input.dataset.backupImport54);
   const details=prepared.legacy?'这是一份旧版完整备份，将完整替换本机资料。请确认已备份当前内容。':'将导入：'+prepared.parts.map(p=>PART_LABELS54[p.part]).concat(prepared.archives.length?['附件与照片（'+prepared.archives[0].files.length+' 个文件）']:[]).join('、')+'。同编号内容更新，其他模块和现有附件保留。';
   if(!await confirmAction('确认导入已校验的备份？',details,'导入'))return;
   if(prepared.legacy)await commitBackup(prepared.legacy);else await commitParts54(prepared.parts,prepared.archives);
   backupNotice54='导入成功，已保存到本机。';render();toast(backupNotice54);
  }catch(error){backupNotice54='导入未完成：'+error.message;const notice=$('[data-backup-notice54]');if(notice)notice.textContent=backupNotice54;toast(backupNotice54);}
 });
}
async function readBackupFiles54(files,expected='batch'){
 const parts=[],archives=[],legacy=[];
 const consume=async(file,name,depth=0)=>{
  if(depth>1)throw new Error('备份压缩包嵌套层数过多。');
  if(/\.zip$/i.test(name)){
   const bytes=file instanceof Blob?await file.arrayBuffer():file;if(bytes.byteLength>MAX_ARCHIVE54)throw new Error('ZIP 超过 512 MB。');await ensureVendors(['jszip']);const zip=await JSZip.loadAsync(bytes);
   if(zip.file('manifest.json')){archives.push(await readArchive54(bytes));return;}
   const entries=Object.values(zip.files).filter(entry=>!entry.dir);if(!entries.length||entries.length>3||entries.some(e=>!/^Qicheng_(?:profile|learning|files)_[^/\\]+\.(?:json|zip)$/.test(e.name)||e._data?.uncompressedSize>MAX_ARCHIVE54))throw new Error('这不是启程模块备份包。');
   for(const entry of entries)await consume(await entry.async('uint8array'),entry.name,depth+1);
  }else{
   const text=file instanceof Blob?await file.text():new TextDecoder().decode(file),raw=JSON.parse(text.replace(/^\uFEFF/,''));
   if(raw.backupVersion===3)parts.push(await verifyPart54(raw));else legacy.push((await verifyBackup521(raw)).backup);
  }
 };
 for(const file of files)await consume(file,file.name);
 if(legacy.length&&(legacy.length!==1||parts.length||archives.length))throw new Error('旧版完整 JSON 请单独导入，不能与模块备份混合。');
 if(expected==='legacy'&&!legacy.length)throw new Error('请使用旧版完整 JSON，或选择“一并上传多个备份”。');
 if(!['batch','legacy'].includes(expected)){
  const mismatch=legacy.length||parts.some(p=>p.part!==expected)||(expected==='files'?archives.length!==1||parts.length:archives.length!==0||parts.length!==1);
  if(mismatch)throw new Error('文件类型与所选上传入口不一致，请使用“一并上传多个备份”。');
 }
 if(new Set(parts.map(p=>p.part)).size!==parts.length||archives.length>1)throw new Error('同一批次请为每个模块选择一份备份。');
 if(!legacy.length){const workspace=snapshot3({forStorage:true}),records=await storage.getUserRecords();await planParts54(parts,archives,workspace,records);}
 return {parts,archives,legacy:legacy[0]};
}
export {learningKey54,metadata54,partDigest54,createPart54,verifyPart54,createFilesArchive54,generateFilesArchive54,getExportSource54,readArchive54,planParts54,commitParts54,readBackupFiles54,modularBackupMarkup54,bindModularBackup54};
