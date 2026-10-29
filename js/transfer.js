import {storage} from './storage.js';
import {ctx} from './state.js';
import {$,$$,esc,tr,toast} from './utils/helpers.js';
import {saveAllLocal} from './backup.js';
import {saveLocalFile52} from './local-files52.js';

const TRANSFER_META_KEY='meta:device';
let transferNotice='',transferActivityBound=false,manualSaving=false;
function transferTime(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(ctx.state.uiLang==='en'?'en':'zh-CN'):tr('尚无记录','No record yet');}
function transferMarkup(){
  return '<section class="settings-section transfer-section" id="transferSettings"><p class="eyebrow">YOUR DATA / SAVE & TRANSFER</p><h2>'+tr('保存与设备接力','Save & move your data')+'</h2><p>'+tr('保存到本机，或用同一份完整 JSON 留档、传到另一台设备。安卓、iPhone / iPad 与 Windows 无需转换格式。','Save locally, or use one complete JSON for backups and moving between Android, iPhone/iPad and Windows.')+'</p>'+ 
    '<div class="data-save-status"><span>'+tr('此设备','This device')+'</span><strong data-local-save-status role="status">'+tr('自动保存到本机数据库；手动保存会另存完整文件。','Edits save to the local database. Manual saving creates a complete file.')+'</strong></div><div class="data-save-actions"><button class="primary" data-local-save>'+tr('手动保存本地文件','Save archive to a file')+'</button><button data-action="backup">'+tr('导出完整 JSON','Export complete JSON')+'</button><button data-transfer-import>'+tr('导入完整 JSON','Import complete JSON')+'</button></div><p class="hint">'+tr('JSON 同时用于备份与设备接力。导入前会校验并请求确认，之后完整替换本机用户数据，不合并两端的修改。','The same JSON works for backups and transfers. Importing validates and asks for confirmation, then replaces local user data without merging edits.')+'</p>'+ 
    '<dl class="transfer-times"><div><dt>'+tr('本机最后保存','Last local save')+'</dt><dd data-transfer-saved>'+esc(transferTime(ctx.state.savedAt))+'</dd></div><div><dt>'+tr('本机最近导入','Last import on this device')+'</dt><dd data-transfer-imported>—</dd></div><div><dt>'+tr('来源文件生成时间','Source file created')+'</dt><dd data-transfer-source>—</dd></div></dl><p class="hint" data-transfer-notice role="status">'+esc(transferNotice)+'</p>'+ 
    '<details class="transfer-help"><summary>'+tr('如何备份或把资料接力到另一台设备？','How do I back up or move to another device?')+'</summary><ol class="data-transfer-guide"><li><strong>'+tr('在最新资料所在的设备导出','Export from the device with the latest data')+'</strong><p>'+tr('完成编辑，点击“手动保存本地文件”，将完整 JSON 文件保存到你选择的位置。也可用“导出完整 JSON”生成备份。','Finish editing, save locally, then export the complete JSON. Keep the file as a backup.')+'</p></li><li><strong>'+tr('自行传输文件','Transfer the file yourself')+'</strong><p>'+tr('通过聊天、隔空投送、数据线或其他方式发送。安卓通常存于“下载”，iOS 可存到“文件”，Windows 可选下载目录；保留 .json 后缀。','Send via messaging, AirDrop, cable or another method. Android usually uses Downloads, iOS uses Files and Windows lets you choose a folder. Keep the .json extension.')+'</p></li><li><strong>'+tr('在接收端导入并核对','Import and check on the receiving device')+'</strong><p>'+tr('先在接收设备导出一份 JSON 留底，再选择“导入完整 JSON”，核对文件时间并确认覆盖。成功后会更新本机导入时间。','First export a safety copy on the receiving device, then import the new JSON, check its time and confirm replacement. The local import time updates after success.')+'</p></li></ol><p>'+tr('文件包含个人资料、上传附件、设置、阅读和日历记录、倒计时、答题草稿与成绩、错题收藏、自建题库和导入资源。完整备份也包含当前已安装的官方题库资源。','The file contains personal materials, uploads, settings, reading/calendar records, countdown, quiz drafts/results, learning marks, custom banks and imported resources. Full backups also include installed official question banks.')+'</p><p>'+tr('全程可以离线操作。文件是导出时的快照，不会自动同步；本机无法检测你是否已把文件传到另一台设备。阅读等使用独立“保存记录”按钮的表单，请先完成该记录的提交。','Everything works offline. The file is a snapshot and does not sync automatically; this device cannot detect a completed file transfer. Submit reading forms with their own Save record button before exporting.')+'</p></details></section>';
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
    try{const success=await saveLocalFile52();transferNotice=success?tr('完整 JSON 存档已生成，请确认本地文件保存成功。','Complete JSON archive generated. Confirm the file is saved.'):tr('本次文件存档未完成，自动保存的资料仍保留。','File save was not completed; automatically saved data is kept.');}
    catch(error){transferNotice=tr('尚未全部保存：','Some changes are not saved: ')+error.message;toast(transferNotice);}
    finally{manualSaving=false;const current=$('[data-local-save]');if(current)current.disabled=false;const currentStatus=$('[data-local-save-status]');if(currentStatus)currentStatus.textContent=transferNotice;const notice=$('[data-transfer-notice]');if(notice)notice.textContent=transferNotice;refreshTransferStatus();}
  };});
  if($('#transferSettings'))refreshTransferStatus();
}
export {TRANSFER_META_KEY,transferMarkup,bindTransferControls,refreshTransferStatus};
