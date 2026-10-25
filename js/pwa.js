import { ctx } from './state.js';
import { $, $$, toast, tr } from './utils/helpers.js';
import { save } from './autosave.js';
import { APP_BASE } from './data.js';
import { waitForHomeWrites } from './modules/home.js';
import { waitForQuizWrites } from './modules/quiz.js';
import { waitForResourceWrites } from './resources.js';
import { waitForJournalWrites } from './modules/journal.js';
import {waitForExamCalendarWrites} from './modules/exam-calendar.js';
let installationPrompt = null, registration = null, status = 'loading', message = '', applyingUpdate = false;
let checkingUpdate = false, updateNotice = '';
let updateDownloadError = '';
function pwaUpdateError(error) {
  const detail = [error?.name, error?.message].filter(Boolean).join(': ') || 'UnknownError';
  return tr('应用更新未完成，旧版和个人资料已保留。请确认网络能打开本站，并留出设备存储空间后重试；也可在安装启程时使用的浏览器中打开原地址检查。技术信息：','The update could not finish. Your current app and personal data are kept. Check this site is reachable and device storage is available, then retry in the browser used to install the app. Details: ')+(updateDownloadError || detail);
}
const isIOS = () => /iPad|iPhone|iPod/.test (navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const installed = () => matchMedia ('(display-mode: standalone)').matches || navigator.standalone === true;
function pwaStatusText () {
  if (status === 'ready') return navigator.onLine ? tr ('离线资源已就绪', 'Ready for offline use') : tr ('正在离线运行 · 本机可编辑与保存',
  'Offline · editing and saving work locally');
  if (status === 'portable') return tr ('独立 HTML 副本 · 可直接离线使用', 'Standalone HTML copy · works offline');
  if (status === 'error') return message;
  return tr ('正在准备离线资源…', 'Preparing offline resources…');
}
function pwaBind () {
  $$ ('[data-pwa-status]').forEach (e => {
    e.textContent = pwaStatusText (); e.classList.toggle ('saved-error', status === 'error');
  });
  $$ ('[data-pwa-install]').forEach (button => {
    button.textContent = installed () ? tr ('已安装启程', 'Qicheng installed') : tr ('安装启程', 'Install Qicheng'); button.disabled = installed (); button.onclick = pwaInstall;
  });
  $$ ('[data-pwa-refresh]').forEach (button => {
    button.hidden = ! registration?.waiting; button.onclick = pwaApplyUpdate;
  });
  $$('[data-pwa-check]').forEach(button=>{button.disabled=checkingUpdate;button.textContent=checkingUpdate?tr('正在检查应用更新…','Checking app updates…'):tr('检查应用新版本','Check app updates');button.onclick=pwaCheckUpdate;});
  $$('[data-pwa-update-status]').forEach(element=>element.textContent=updateNotice);
}
async function pwaCheckUpdate(){
  if(checkingUpdate)return false;
  if(globalThis.QICHENG_STATIC){updateNotice=tr('这是独立 HTML 副本。请在可安装的 PWA 中检查应用更新。','This is a standalone HTML copy. Check app updates in the installed PWA.');pwaBind();return false;}
  if(!navigator.onLine){updateNotice=tr('当前离线，连接网络后可检查应用新版本。本机数据不受影响。','You are offline. Connect to check app updates; local data is unchanged.');pwaBind();return false;}
  checkingUpdate=true;updateNotice=tr('正在检查当前安装地址的应用程序…','Checking the app at this installation address…');pwaBind();
  try{
    registration = await navigator.serviceWorker?.getRegistration(APP_BASE.href) || registration;
    if(!registration)throw new Error(tr('离线功能尚未准备好，请稍后重试。','Offline support is still being prepared. Try again shortly.'));
    updateDownloadError='';
    // A downloaded update is usable even when a new network check would fail.
    if(!registration.waiting){
      try{await registration.update();}
      catch(error){
        // Android browsers may hold a stale registration after resuming the app.
        // Retry the same URL/scope once, without unregistering or clearing data.
        if(!['UnknownError','InvalidStateError','TypeError'].includes(error?.name))throw error;
        registration=await navigator.serviceWorker.register(new URL('service-worker.js',APP_BASE),{scope:APP_BASE.href,updateViaCache:'none'});
        if(!registration.waiting)await registration.update();
      }
    }
    const worker=registration.installing;
    if(worker && !['installed','activated','redundant'].includes(worker.state))await new Promise((resolve,reject)=>{
      const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);error?reject(error):resolve();};
      const changed=()=>{if(['installed','activated'].includes(worker.state))finish();else if(worker.state==='redundant')finish(new Error(tr('新版下载未完成，现有版本已保留。','The update did not complete. The current version is kept.')));};
      const timer=setTimeout(()=>finish(),60000);timer?.unref?.();worker.addEventListener('statechange',changed);changed();
    });
    updateNotice=registration.waiting?tr('新版已下载。点击“保存并更新应用”即可应用，资料会先保存。','Update downloaded. Choose Save & update app to apply it after saving your work.'):registration.installing?tr('新版仍在下载。你可以继续使用，稍后再检查。','The update is still downloading. Continue using the app and check again later.'):tr('当前地址提供的应用已是最新版本。题库与每日一句可在资源区单独更新。','This address provides no newer app version. Banks and daily resources update separately.');
    return !!registration.waiting;
  }catch(error){updateNotice=pwaUpdateError(error);return false;}
  finally{checkingUpdate=false;pwaBind();}
}
async function pwaInstall () {
  if (installationPrompt) {
    try {
      await installationPrompt.prompt ();
      await installationPrompt.userChoice;
      installationPrompt = null;
      pwaBind ();
    }
    catch (error) {
      toast (tr ('无法显示安装提示：', 'Unable to show install prompt: ') + error.message);
    }
    return;
  }
  toast (isIOS () ? tr ('请在 Safari 点击分享按钮 → 添加到主屏幕。', 'In Safari, tap Share → Add to Home Screen.') : tr ('在浏览器菜单中选择“安装启程”或“安装应用”。请从 HTTPS 或 localhost 地址打开。',
  'Choose Install Qicheng / Install app in your browser menu. Open using HTTPS or localhost.'));
}
async function pwaApplyUpdate () {
  if (ctx.busy || ctx.uploadBusy) return toast (tr ('请等待当前操作完成后更新。', 'Wait for the current operation before updating.'));
  if (! registration?.waiting) return;
  if (! await save ()) return toast (tr ('保存失败，请先备份，暂未更新。', 'Save failed. Back up before updating.'));
  try {await Promise.all([waitForHomeWrites(),waitForQuizWrites(),waitForResourceWrites(),waitForJournalWrites(),waitForExamCalendarWrites()]);}
  catch(error){toast(tr('数据仍未保存，请稍后再更新：','Pending data could not be saved: ')+error.message);return false;}
  applyingUpdate = true;
  registration.waiting.postMessage ( {
    type : 'ACTIVATE_UPDATE'
  });
}
async function pwaInit () {
  window.addEventListener ('beforeinstallprompt', event => {
    event.preventDefault (); installationPrompt = event; pwaBind ();
  });
  window.addEventListener ('appinstalled', () => {
    installationPrompt = null; pwaBind ();
  });
  window.addEventListener ('online', pwaBind);
  window.addEventListener ('offline', pwaBind);
  if (globalThis.QICHENG_STATIC) {
    status = 'portable';
    pwaBind ();
    return;
  }
  if (! ('serviceWorker' in navigator) || ! globalThis.isSecureContext) {
    status = 'error';
    message = tr ('此地址无法启用 PWA。请使用 HTTPS 或 localhost。', 'PWA requires HTTPS or localhost.');
    pwaBind ();
    toast (message);
    return;
  }
  navigator.serviceWorker.addEventListener ('controllerchange', () => {
    if (applyingUpdate) location.reload ();
  });
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.source?.scriptURL && new URL(event.source.scriptURL).href!==new URL('service-worker.js',APP_BASE).href)return;
    if(event.data?.type==='UPDATE_CACHE_FAILED'){
      updateDownloadError=String(event.data.detail||'UnknownError').slice(0,1200);
      updateNotice=pwaUpdateError(new Error(updateDownloadError));pwaBind();
    }
  });
  try {
    registration = await navigator.serviceWorker.register (new URL ('service-worker.js', APP_BASE), {
      scope : APP_BASE.href, updateViaCache : 'none'
    });
    if (registration.waiting) pwaBind ();
    registration.addEventListener ('updatefound', () => {
      const worker = registration.installing; worker?.addEventListener ('statechange', () => {
        if (worker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            toast (tr ('发现新版本，可在设置中保存并重新加载。', 'Update available. Save and reload from Settings.')); pwaBind ();
          }
        }
        else if (worker.state === 'redundant') {
          if(navigator.serviceWorker.controller){updateNotice=pwaUpdateError(new Error('新版离线资源下载未完成'));pwaBind();}
          else{status = 'error'; message = tr ('离线资源准备失败，请联网重试。', 'Offline preparation failed. Retry online.'); pwaBind (); toast (message);}
        }
      });
    });
    navigator.serviceWorker.ready.then (() => {
      status = 'ready'; pwaBind ();
    }).catch (error => {
      status = 'error'; message = tr ('离线准备失败：', 'Offline preparation failed: ') + error.message; pwaBind (); toast (message);
    });
    if (navigator.onLine) registration.update ().catch (error => {
      if (! navigator.serviceWorker.controller) {
        status = 'error'; message = tr ('离线资源检查失败，请联网重新加载。', 'Offline resource check failed. Reload online.'); pwaBind (); toast (message);
      }
    });
  }
  catch (error) {
    status = 'error';
    message = tr ('离线支持注册失败：', 'Service worker registration failed: ') + error.message;
    pwaBind ();
    toast (message);
  }
}
const pwa = {
  init : pwaInit, bind : pwaBind, install : pwaInstall, statusText : pwaStatusText, checkUpdate:pwaCheckUpdate, applyUpdate:pwaApplyUpdate
};
export { pwa };
