import {storage} from './storage.js';
import {ctx} from './state.js';
import {$,$$,esc,tr,download,toast} from './utils/helpers.js';
import {save} from './autosave.js';
import {getCurrentBackup,exportBackup} from './backup.js';

const TRANSFER_META_KEY='meta:device';
let transferRole='send',transferNotice='';
let transferActivityBound=false;
function transferTime(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(ctx.state.uiLang==='en'?'en':'zh-CN'):tr('尚无记录','No record yet');}
function transferMarkup(){
  return '<section class="settings-section transfer-section" id="transferSettings"><p class="eyebrow">YOUR DATA / DEVICE TRANSFER</p><h2>'+tr('多端资料接力','Move your data between devices')+'</h2><p>'+tr('同一个 JSON 文件，适用于安卓、iPhone / iPad 和 Windows。无需账号或云同步；由你选择文件如何传输。','The same JSON works on Android, iPhone/iPad and Windows. No account or cloud sync is needed. You choose how to transfer it.')+'</p>'+ 
    '<div class="transfer-tabs" role="group" aria-label="'+tr('本机的角色','This device')+'"><button data-transfer-role="send" aria-pressed="'+(transferRole==='send')+'">'+tr('从这台设备发送','Send from this device')+'</button><button data-transfer-role="receive" aria-pressed="'+(transferRole==='receive')+'">'+tr('在这台设备接收','Receive on this device')+'</button></div>'+transferGuideMarkup()+'<dl class="transfer-times"><div><dt>'+tr('本机最后保存','Last local save')+'</dt><dd data-transfer-saved>'+esc(transferTime(ctx.state.savedAt))+'</dd></div><div><dt>'+tr('本机最近导入','Last import on this device')+'</dt><dd data-transfer-imported>—</dd></div><div><dt>'+tr('导入文件生成时间','Imported file created')+'</dt><dd data-transfer-source>—</dd></div></dl><p class="hint" data-transfer-notice role="status">'+esc(transferNotice)+'</p><details class="transfer-help"><summary>'+tr('传输前需要知道什么？','What should I know before transferring?')+'</summary><p>'+tr('文件包含个人资料、照片附件、设置、学习进度、日历状态、答题草稿与成绩、收藏，以及自行导入的内容。官方题库可重新获取，接收端现有官方资源会保留；若你用的是自定义题库，它会随 JSON 一起转移。','The file contains personal materials, photos, settings, learning progress, calendar states, quiz drafts/results, favorites and custom resources. Official resources remain installed on the receiving device; custom banks travel with the file.')+'</p><p>'+tr('接收端先校验并展示备份信息，确认后完整替换本机用户数据，不自动合并两台设备的修改。请以最新完成编辑的设备为准，先给接收端留一份备份；同步后在新设备继续编辑，下次再反向传输。','After validation and confirmation, importing replaces local user data rather than merging edits. Use the device with your latest edits as the source. Back up the receiving device first; transfer back when changing devices again.')+'</p><p>'+tr('安卓通常保存在“下载”；iOS 可在保存文件对话框或分享菜单中存到“文件”；Windows 可选择下载目录。文件内容与格式一致，保留 .json 后缀，无需转换。传输完成后，在另一台设备选择“导入并更新本机”。','Android usually saves to Downloads. On iOS, use Save to Files or the share menu. On Windows, choose a download location. Keep the .json extension; no conversion is needed.')+'</p><p>'+tr('进度指引仅显示本机的文件生成和导入状态，无法检测你是否已经通过聊天、隔空投送、数据线等完成传输。可随时离线导出和导入。','This guide tracks local file generation and imports. It cannot detect transfer by messaging, AirDrop or cable. Exporting and importing work offline.')+'</p></details></section>';
}
function transferGuideMarkup(){
  const receive=transferRole==='receive';
  return '<ol class="transfer-steps" data-transfer-guide><li><span>01</span><div><strong>'+tr(receive?'先留一份本机备份':'整理好最新资料',receive?'Keep a local backup first':'Finish your latest edits')+'</strong><p>'+tr(receive?'避免两端内容互相覆盖前无处找回。':'等待“已保存”，再生成完整数据文件。',receive?'Keep a copy before replacing local materials.':'Wait for Saved, then generate a complete file.')+'</p>'+(receive?'<button data-action="backup">'+tr('备份当前本机','Back up this device')+'</button>':'')+'</div></li><li><span>02</span><div><strong>'+tr(receive?'取得另一台设备的 JSON':'生成并自行传输 JSON',receive?'Get the JSON from your other device':'Generate and transfer the JSON')+'</strong><p>'+tr(receive?'把文件保存到此设备可选取的位置。':'下载后，通过你习惯的方式把文件发送到另一端。',receive?'Save the file somewhere accessible on this device.':'After downloading, send it using your preferred method.')+'</p>'+(!receive?'<button class="primary" data-transfer-export>'+tr('生成最新同步文件','Generate latest transfer file')+'</button>':'')+'</div></li><li><span>03</span><div><strong>'+tr(receive?'导入并核对本机状态':'到另一端导入并核对',receive?'Import and check this device':'Import and check on the other device')+'</strong><p>'+tr(receive?'检查文件时间，确认完整替换；成功后下方显示本机导入时间。':'另一端：设置 → 多端资料接力 → 在这台设备接收。',receive?'Check the file time and confirm replacement. Successful imports appear below.':'On the other device: Settings → Move your data → Receive.')+'</p>'+(receive?'<button class="primary" data-transfer-import>'+tr('选择 JSON，导入并更新本机','Choose JSON and update this device')+'</button>':'')+'</div></li></ol>';
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
  $$('[data-transfer-role]').forEach(button=>button.onclick=()=>{
    transferRole=button.dataset.transferRole;
    $$('[data-transfer-role]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.transferRole===transferRole)));
    const guide=$('[data-transfer-guide]');if(guide)guide.outerHTML=transferGuideMarkup();bindTransferControls();
  });
  const pick=$('[data-transfer-import]');if(pick)pick.onclick=()=>{ctx.transferImportRequested=true;$('#backupInput')?.click();};
  // Reuse the existing backup control when the guide's temporary role changes.
  const backup=$('#transferSettings [data-action="backup"]');if(backup)backup.onclick=exportBackup;
  const button=$('[data-transfer-export]');if(button)button.onclick=async()=>{
    if(ctx.busy||ctx.uploadBusy)return;button.disabled=true;
    try{
      const saved=await save();
      const backup=await getCurrentBackup();
      download(JSON.stringify(backup,null,2),'application/json;charset=utf-8','Qicheng_Transfer_'+backup.createdAt.slice(0,10)+'.json');
      transferNotice=tr('完整 JSON 已生成。请保存并自行发送到另一台设备，再在接收端导入。','The complete JSON is ready. Save it, transfer it, then import it on the receiving device.')+(saved?'':tr(' 本机保存失败，文件包含当前内存资料，请妥善保存。',' Local saving failed; the file includes current in-memory materials. Keep this backup.'));
      const notice=$('[data-transfer-notice]');if(notice)notice.textContent=transferNotice;
    }catch(error){toast(error.message);}finally{button.disabled=false;refreshTransferStatus();}
  };
  if($('#transferSettings'))refreshTransferStatus();
}
export {TRANSFER_META_KEY,transferMarkup,bindTransferControls,refreshTransferStatus};
