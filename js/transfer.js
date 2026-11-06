import {storage} from './storage.js';
import {ctx} from './state.js';
import {$,$$,esc,tr,toast} from './utils/helpers.js';
import {saveAllLocal} from './backup.js';
import {saveLocalFile52} from './local-files52.js';

const TRANSFER_META_KEY='meta:device';
let transferNotice='',transferActivityBound=false,manualSaving=false;
function transferTime(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(ctx.state.uiLang==='en'?'en':'zh-CN'):tr('尚无记录','No record yet');}
function transferMarkup(){
 return '<section class="settings-section transfer-section" id="transferSettings"><h2>'+tr('保存工作进度','Save progress')+'</h2><p>'+tr('编辑后点击保存，或按 Ctrl / ⌘ + S。保存写入此设备的本机数据库；备份文件在“导入与导出”中按需生成。','Click Save or press Ctrl / Command + S after editing. Progress is stored on this device; create backup files in Import & export.')+'</p><div class="data-save-status"><strong data-local-save-status role="status"></strong></div><div class="actions"><button class="primary" data-local-save>'+tr('保存进度','Save progress')+'</button><button data-settings-category53="importexport">'+tr('打开导入与导出','Open Import & export')+'</button></div><dl class="transfer-times"><div><dt>'+tr('本机最后保存','Last local save')+'</dt><dd data-transfer-saved>'+esc(transferTime(ctx.state.savedAt))+'</dd></div><div><dt>'+tr('本机最近导入','Last import')+'</dt><dd data-transfer-imported>—</dd></div><div><dt>'+tr('来源文件生成时间','Source file created')+'</dt><dd data-transfer-source>—</dd></div></dl><p data-transfer-notice role="status">'+esc(transferNotice)+'</p></section>';
}

async function refreshTransferStatus(){
  try{
    const meta=await storage.get(TRANSFER_META_KEY)||{};
    const saved=$('[data-transfer-saved]'),imported=$('[data-transfer-imported]'),source=$('[data-transfer-source]');
    if(saved)saved.textContent=transferTime(meta.lastSavedAt||ctx.state.savedAt);
    if(imported)imported.textContent=transferTime(meta.lastImportedAt);
    if(source)source.textContent=transferTime(meta.sourceCreatedAt);
  }catch(error){const notice=$('[data-transfer-notice]');if(notice)notice.textContent=tr('暂时无法读取本机时间：','Unable to read device times: ')+error.message;}
}
function bindTransferControls(){
  if(!transferActivityBound&&typeof window!=='undefined'){
    transferActivityBound=true;window.addEventListener('qicheng-local-write',()=>{if($('#transferSettings'))refreshTransferStatus();});
  }
  const pick=$('[data-transfer-import]');if(pick)pick.onclick=()=>{if(ctx.busy||ctx.uploadBusy||manualSaving)return;ctx.transferImportRequested=true;$('#backupInput')?.click();};
  $$('[data-local-save]').forEach(button=>{button.disabled=manualSaving;button.onclick=async()=>{
    if(ctx.busy||ctx.uploadBusy||manualSaving)return;manualSaving=true;button.disabled=true;
    const status=$('[data-local-save-status]');if(status)status.textContent=tr('正在确认本机保存…','Saving local changes…');
    try{const success=await saveLocalFile52();transferNotice=success?tr('当前工作进度已保存到本机。','Current progress saved on this device.'):tr('保存尚未完成，请重试或到设置导出备份。','Save incomplete. Retry or export a backup in Settings.');}
    catch(error){transferNotice=tr('尚未全部保存：','Some changes are not saved: ')+error.message;toast(transferNotice);}
    finally{manualSaving=false;const current=$('[data-local-save]');if(current)current.disabled=false;const currentStatus=$('[data-local-save-status]');if(currentStatus)currentStatus.textContent=transferNotice;const notice=$('[data-transfer-notice]');if(notice)notice.textContent=transferNotice;refreshTransferStatus();}
  };});
  if($('#transferSettings'))refreshTransferStatus();
}
export {TRANSFER_META_KEY,transferMarkup,bindTransferControls,refreshTransferStatus};
