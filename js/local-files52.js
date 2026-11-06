import {inspectStorage521} from './storage-status.js';
import {ctx} from './state.js';
import {$,toast,tr} from './utils/helpers.js';
import {saveAllLocal,restoreBackup} from './backup.js';
import {confirmAction} from './app.js';
import {APP_BASE} from './data.js';

let savingFile52=false;
async function saveLocalFile52(){
  if(savingFile52||ctx.busy||ctx.uploadBusy)return false;
  savingFile52=true;
  try{
    await saveAllLocal();
    toast(tr('当前工作进度已保存到本机','Current progress saved on this device'));
    return true;
  }catch(error){if(error.name!=='AbortError')toast(tr('保存未完成，请到设置导出备份：','Save failed; export a backup in Settings: ')+error.message);return false;}
  finally{savingFile52=false;}
}
async function clearApplicationCache52(){
  if(ctx.busy||ctx.uploadBusy)return false;
  if(!await confirmAction(tr('清除程序缓存？','Clear application cache?'),tr('如果未手动保存，本机资料仍只有浏览器中的副本，可能因浏览器清理而丢失，建议先到设置导出备份。此操作仅删除离线程序缓存，不删除个人信息、阅读记录、题库或本地存档文件。下次使用离线功能前需要联网重新加载。','If you have not saved a file, your only copy is in this browser and may be lost when browser data is cleared. This removes only offline application assets, keeping personal data and saved files. Reconnect before using the app offline.'),tr('清除缓存','Clear cache')))return false;
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
