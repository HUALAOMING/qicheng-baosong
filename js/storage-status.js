import {storage} from './storage.js';
import {ctx} from './state.js';
let storageStatusBound521=false;
let storageStatus521={mode:'checking',usage:null,quota:null,error:''};
const storageLabels521={checking:'正在检查',granted:'持久存储已授权',denied:'持久存储未授权',unsupported:'不支持持久存储接口',error:'持久存储状态检查失败'};
function storageBytes521(bytes){return Number.isFinite(bytes)?(bytes/1024/1024).toLocaleString('zh-CN',{maximumFractionDigits:1})+' MB':'浏览器未提供';}
async function inspectStorage521(request=false,manager=globalThis.navigator?.storage) {
  const result={mode:'unsupported',usage:null,quota:null,error:''};
  if(typeof manager?.persisted==='function') {
    try {
      let granted=await manager.persisted();
      if(request&&!granted&&typeof manager.persist==='function')granted=await manager.persist();
      result.mode=granted?'granted':typeof manager.persist==='function'?'denied':'unsupported';
    }catch(error){result.mode='error';result.error=error.message;}
  }
  if(typeof manager?.estimate==='function')try{const estimate=await manager.estimate();result.usage=Number.isFinite(estimate.usage)?estimate.usage:null;result.quota=Number.isFinite(estimate.quota)?estimate.quota:null;}catch(error){result.error+=(result.error?'；':'')+'用量估算失败：'+error.message;}
  storageStatus521=result;return {...result};
}
async function refreshStorageStatus521(request=false) {
  const status=await inspectStorage521(request),device=await storage.get('meta:device')||{},backup=await storage.get('meta:external-backup')||{};
  const values={mode:storageLabels521[status.mode],usage:storageBytes521(status.usage),quota:storageBytes521(status.quota),save:ctx.saveError?'保存失败，请立即导出备份':ctx.dirty301||ctx.saving?'仍有修改正在保存':device.lastSavedAt?'已提交 · '+new Date(device.lastSavedAt).toLocaleString('zh-CN'):'尚无个人资料提交记录',backup:backup.at?new Date(backup.at).toLocaleString('zh-CN')+' · '+(backup.method==='file'?'已写入所选文件':backup.confirmed?'已确认文件留存':'已生成下载，尚未确认留存'):'尚无外部完整备份记录',error:status.error};
  for(const [key,value]of Object.entries(values)){const node=document.getElementById('storage521-'+key);if(node)node.textContent=value;}
  return status;
}
function storageStatusMarkup521(){
  return '<section class="settings-section storage-status521" id="dataStorage521"><h2>数据与存储</h2><dl>'+[['mode','当前存储模式'],['usage','站点存储用量估算'],['quota','站点配额估算'],['save','本地数据最近保存'],['backup','最近外部完整备份']].map(([id,label])=>'<div><dt>'+label+'</dt><dd id="storage521-'+id+'">正在读取…</dd></div>').join('')+'</dl><p id="storage521-error" role="status"></p><div class="actions"><button id="storage521-request">申请持久存储</button><button id="storage521-refresh">重新检查</button><button id="storage521-confirm">确认已保存下载的备份</button></div><p class="hint">使用量与配额由浏览器估算，不代表设备准确剩余空间。Chrome、Edge 与 Android Edge 可能自动批准或拒绝持久存储申请，不一定显示权限窗口；请以实际检查结果为准。</p><p class="hint">个人资料与附件保存在 IndexedDB，仍由当前浏览器和站点管理。持久存储能降低浏览器自动驱逐风险，不能防止主动清除全部站点数据、浏览器配置文件清理、卸载或设备故障。仅清除程序缓存不会删除数据库；清除全部站点数据会删除资料。请定期保存外部完整备份。</p></section>';
}
function bindStorageStatus521(){
  if(!storageStatusBound521&&globalThis.addEventListener){storageStatusBound521=true;globalThis.addEventListener('qicheng-local-write',()=>{if(document.getElementById('dataStorage521'))refreshStorageStatus521().catch(()=>{});});}
  if(!document.getElementById('dataStorage521'))return;
  const bind=(id,fn)=>{const node=document.getElementById(id);if(node)node.onclick=async()=>{node.disabled=true;try{await fn();}catch(error){const message=document.getElementById('storage521-error');if(message)message.textContent=error.message;}finally{node.disabled=false;}};};
  bind('storage521-request',()=>refreshStorageStatus521(true));bind('storage521-refresh',()=>refreshStorageStatus521());
  bind('storage521-confirm',async()=>{const backup=await storage.get('meta:external-backup');if(!backup)throw new Error('请先生成完整备份，并完成下载或文件保存。');await storage.set('meta:external-backup',{...backup,confirmed:true});await refreshStorageStatus521();});
  refreshStorageStatus521().catch(()=>{});
}
async function noteExternalBackup521(method,filename){await storage.set('meta:external-backup',{at:new Date().toISOString(),method,filename,confirmed:method==='file'});}
export {inspectStorage521,refreshStorageStatus521,storageStatusMarkup521,bindStorageStatus521,noteExternalBackup521};
