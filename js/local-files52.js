import {noteExternalBackup521,inspectStorage521} from './storage-status.js';
import {ctx} from './state.js';
import {$,download,toast,tr} from './utils/helpers.js';
import {saveAllLocal,getCurrentBackup,restoreBackup} from './backup.js';
import {confirmAction} from './app.js';
import {APP_BASE} from './data.js';

let savingFile52=false;
async function saveLocalFile52(){
  if(savingFile52||ctx.busy||ctx.uploadBusy)return false;
  savingFile52=true;
  try{
    // Ask for the destination while the click still has browser user activation.
    const destination=typeof globalThis.showSaveFilePicker==='function'?globalThis.showSaveFilePicker({suggestedName:'启程-本地存档-'+new Date().toLocaleDateString('sv-SE')+'.json',types:[{description:'启程完整存档',accept:{'application/json':['.json']}}]}):null;
    const handle=destination?await destination:null;
    let saved=true;try{await saveAllLocal();}catch{saved=false;}
    const backup=await getCurrentBackup(),content=JSON.stringify(backup,null,2);
    if(handle){
      const writer=await handle.createWritable();
      try{await writer.write(content);await writer.close();await noteExternalBackup521('file',handle.name||'完整备份.json').catch(error=>toast('文件已写入，但无法记录备份时间：'+error.message));}catch(error){try{await writer.abort();}catch{}throw error;}
      toast(saved?tr('完整存档已写入本地文件','Complete archive saved to file'):tr('本机自动保存异常，已将可读取的当前资料写入存档','Automatic saving failed; readable current data saved to file'));
    }else{
      download(content,'application/json;charset=utf-8','启程-本地存档-'+new Date().toLocaleDateString('sv-SE')+'.json');
      await noteExternalBackup521('download','完整备份.json').catch(error=>toast('备份已生成，但无法记录备份时间：'+error.message));
      toast(tr('完整存档已生成，请保存下载的 JSON 文件','Archive generated. Keep the downloaded JSON file'));
    }
    return true;
  }catch(error){if(error.name!=='AbortError')toast(tr('文件存档未完成：','File save failed: ')+error.message);return false;}
  finally{savingFile52=false;}
}
async function clearApplicationCache52(){
  if(ctx.busy||ctx.uploadBusy)return false;
  if(!await confirmAction(tr('清除程序缓存？','Clear application cache?'),tr('如果未手动保存，本机资料仍只有浏览器中的副本，可能因浏览器清理而丢失，建议先手动保存文件。此操作仅删除离线程序缓存，不删除个人信息、阅读记录、题库或本地存档文件。下次使用离线功能前需要联网重新加载。','If you have not saved a file, your only copy is in this browser and may be lost when browser data is cleared. This removes only offline application assets, keeping personal data and saved files. Reconnect before using the app offline.'),tr('清除缓存','Clear cache')))return false;
  try{
    if(!globalThis.caches){toast('当前环境没有可清除的离线程序缓存');return true;}
    const prefix='qicheng-static-'+encodeURIComponent(APP_BASE.pathname)+'-';
    const names=(await caches.keys()).filter(name=>name.startsWith(prefix));
    for(const name of names)if(!await caches.delete(name))throw new Error('未能删除缓存 '+name);
    const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];
    for(const registration of registrations)if(registration.scope===APP_BASE.href)await registration.unregister();
    toast(tr('程序缓存已清除，个人资料仍保留。请联网重新打开以恢复离线资源。','Application cache cleared. Personal data is kept. Reopen online to restore offline support.'));return true;
  }catch(error){toast('清除缓存未完成：'+error.message);return false;}
}
function showStartupChoice52(){
  const dialog=$('#startupChoice52');if(!dialog)return;
  const input=$('#startupFile52');
  $('#startupContinue52').onclick=()=>{dialog.close();inspectStorage521(true).catch(()=>{});};
  $('#startupLoad52').onclick=()=>input.click();
  input.onchange=async event=>{
    if(!event.target.files?.length)return;
    dialog.close();
    const restored=await restoreBackup(event);
    if(!restored)dialog.showModal();
  };
  dialog.showModal();
}
export {saveLocalFile52,clearApplicationCache52,showStartupChoice52};
