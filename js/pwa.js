import {waitForTimerWrites53} from './timer53.js';
import {flushLoadedFeatures53} from './features53.js';
import { ctx } from './state.js';
import { $, $$, toast, tr } from './utils/helpers.js';
import { save } from './autosave.js';
import { APP_BASE } from './data.js';
import { waitForHomeWrites } from './modules/home.js';
import { waitForQuizWrites } from './modules/quiz.js';
import { waitForResourceWrites } from './resources.js';
import { waitForJournalWrites } from './modules/journal.js';
import {waitForExamCalendarWrites} from './modules/exam-calendar.js';
import { tasks } from './tasks.js';
import { VERSION } from './constants.js';
let installationPrompt = null, registration = null, status = 'loading', message = '', applyingUpdate = false;
let checkingUpdate = false, updateNotice = '';
let updateDownloadError = '';
let updateOffer = null, installedRevision = '', dismissedRevision = '', downloadingUpdate = false, lastUpdateCheck = 0;
const workerURL = new URL('service-worker.js', APP_BASE);
let resourceTask521 = null, switchTask521 = null, preparedUpdate521 = null, updateWatchdog521 = null;
function updateStorageMarker521(value) {
  try { if(value)sessionStorage.setItem('qicheng-pwa-transition',JSON.stringify(value));else sessionStorage.removeItem('qicheng-pwa-transition'); }catch{}
}
function releaseUpdateLock521() {
  if(preparedUpdate521 && globalThis.document?.body)document.body.inert=preparedUpdate521.wasInert;
  preparedUpdate521=null;applyingUpdate=false;clearTimeout(updateWatchdog521);
}
async function flushUpdateWrites521() {
  await flushLoadedFeatures53();
  if(!await save())throw new Error('本机保存失败，请先备份。');
  await Promise.all([waitForHomeWrites(),waitForTimerWrites53(),waitForQuizWrites(),waitForResourceWrites(),waitForJournalWrites(),waitForExamCalendarWrites()]);
}
async function prepareUpdate521(event) {
  const data=event.data, active=globalThis.document?.activeElement;
  const editing=!!active?.matches?.('input:not([type=button]):not([type=submit]),textarea,select,[contenteditable=true]');
  const reject=detail=>event.source.postMessage({type:'APP_UPDATE_READY',requestId:data.requestId,ready:false,detail});
  if(ctx.busy||ctx.uploadBusy||(!data.initiator&&(ctx.dirty301||ctx.saveError||editing)))return reject('其他窗口正在编辑或未保存，请完成后重试。');
  const revision=ctx.editRevision301;
  const lock={id:data.requestId,revision:data.revision,wasInert:!!globalThis.document?.body?.inert};
  preparedUpdate521=lock;
  if(globalThis.document?.body)document.body.inert=true;
  try {
    await flushUpdateWrites521();
    if(preparedUpdate521!==lock)return;
    if(ctx.dirty301||ctx.saveError||ctx.busy||ctx.uploadBusy||revision!==ctx.editRevision301)throw new Error('窗口内容发生变化，请保存后重试。');
    applyingUpdate=true;
    switchTask521 ||= tasks.start('应用版本切换');switchTask521.stage('资料已保存，等待全部窗口确认');
    clearTimeout(updateWatchdog521);
    updateWatchdog521=setTimeout(()=>{
      if(preparedUpdate521!==lock)return;
      releaseUpdateLock521();updateNotice='版本切换未完成，当前资料已保留，请稍后重试。';
      switchTask521?.fail(new Error(updateNotice));switchTask521=null;pwaBind();
    },25000);
    event.source.postMessage({type:'APP_UPDATE_READY',requestId:data.requestId,ready:true});
  }catch(error){releaseUpdateLock521();reject(error.message);}
}
function handleWorkerMessage521(event) {
  if (event.source?.scriptURL) {
    const source = new URL(event.source.scriptURL);
    if (source.origin !== workerURL.origin || source.pathname !== workerURL.pathname) return;
  }
  const data=event.data||{};
  if(data.type==='UPDATE_CACHE_PROGRESS') {
    if (!downloadingUpdate) return;
    if(!resourceTask521||resourceTask521.state.status!=='running')resourceTask521=tasks.start('PWA 程序资源准备');
    resourceTask521.stage('下载并校验必要程序资源',{done:data.done,total:data.total});
    updateNotice='正在准备新版程序资源 · '+data.done+'/'+data.total;pwaBind();
  } else if(data.type==='UPDATE_CACHE_READY') {
    if (!downloadingUpdate) return;
    resourceTask521?.succeed('全部 '+data.total+' 个资源已校验，等待用户选择更新');
    updateNotice='新版资源已准备完成，可稍后更新；编辑内容不会被强制打断。';pwaBind();
  } else if(data.type==='UPDATE_CACHE_FAILED') {
    if (!downloadingUpdate) {
      if (!registration?.active) {
        status = 'error';
        message = tr('离线资源尚未就绪。联网重新打开可重试。','Offline resources are not ready. Reopen while online to retry.');
        pwaBind();
      }
      return;
    }
    updateDownloadError=String(data.detail||'UnknownError').slice(0,1200);
    updateNotice=pwaUpdateError(new Error(updateDownloadError));resourceTask521?.fail(new Error(updateNotice));pwaBind();
  } else if(data.type==='PREPARE_APP_UPDATE') {
    return prepareUpdate521(event);
  } else if(data.type==='UPDATE_ABORTED') {
    if(preparedUpdate521&&data.requestId&&preparedUpdate521.id!==data.requestId)return;
    releaseUpdateLock521();updateNotice=data.detail||'有窗口尚未准备好，当前版本继续可用。';
    switchTask521?.fail(new Error(updateNotice));switchTask521=null;pwaBind();toast(updateNotice);
  } else if(data.type==='UPDATE_ACTIVATING'&&preparedUpdate521?.id===data.requestId) {
    switchTask521?.stage('全部窗口已保存，正在安全切换程序版本');
    updateStorageMarker521({revision:data.revision});
  } else if(data.type==='UPDATE_RELEASE_INFO') {
    if (data.appVersion === VERSION && data.revision !== installedRevision) {
      installedRevision = data.revision;
      void pwaCheckUpdate({silent:true});
    }
    let pending;try{pending=JSON.parse(sessionStorage.getItem('qicheng-pwa-transition')||'null');}catch{}
    if(pending) {
      const task=tasks.start('应用版本切换');
      if(data.revision===pending.revision&&data.appVersion===VERSION) {task.succeed('新版本已启动，本机数据库读取与程序版本验证完成');updateStorageMarker521(null);}
      else task.fail(new Error('当前窗口与预期程序版本不一致，请保持资料并重新检查更新。'));
    }
  }
}

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
  const downloaded = !!waitingUpdate();
  $$ ('[data-pwa-refresh]').forEach (button => {
    button.hidden = !updateOffer;
    button.disabled = downloadingUpdate || applyingUpdate;
    button.textContent = downloaded ? tr('保存并更新应用','Save & update app') : tr('下载更新','Download update');
    button.onclick = downloaded ? pwaApplyUpdate : pwaDownloadUpdate;
  });
  $$('[data-pwa-offer]').forEach(element=>{
    element.hidden = !updateOffer || dismissedRevision === updateOffer.revision;
    if (element.hidden) return;
    element.querySelector('[data-pwa-offer-title]').textContent = downloaded
      ? tr('新版已下载。是否保存并更新？','The update is downloaded. Save and update?')
      : tr('启程 '+updateOffer.appVersion+' 已可用。是否下载更新？','Qicheng '+updateOffer.appVersion+' is available. Download it?');
    element.querySelector('[data-pwa-dismiss]').onclick = () => { dismissedRevision = updateOffer.revision; pwaBind(); };
  });
  $$('[data-pwa-check]').forEach(button=>{button.disabled=checkingUpdate;button.textContent=checkingUpdate?tr('正在检查应用更新…','Checking app updates…'):tr('检查应用新版本','Check app updates');button.onclick=pwaCheckUpdate;});
  $$('[data-pwa-update-status]').forEach(element=>element.textContent=updateNotice);
}
function waitingUpdate() {
  const waiting = registration?.waiting;
  if (!waiting || !updateOffer) return null;
  return new URL(waiting.scriptURL).searchParams.get('revision') === updateOffer.revision ? waiting : null;
}
async function pwaCheckUpdate({silent=false}={}) {
  if (checkingUpdate || downloadingUpdate || applyingUpdate) return false;
  if (silent && Date.now()-lastUpdateCheck < 60000) return false;
  if (globalThis.QICHENG_STATIC || !navigator.onLine) {
    if (!silent) {
      updateNotice = globalThis.QICHENG_STATIC
        ? tr('独立 HTML 副本请到原网站检查更新。','Check the original site for updates to this standalone copy.')
        : tr('当前离线。联网后可检查应用更新。','You are offline. Reconnect to check for updates.');
      pwaBind();
    }
    return !!waitingUpdate();
  }
  checkingUpdate = true;
  lastUpdateCheck = Date.now();
  if (!silent) updateNotice = tr('正在检查应用新版本…','Checking for app updates…');
  pwaBind();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),15000);
  try {
    registration = await navigator.serviceWorker?.getRegistration(APP_BASE.href) || registration;
    const response = await fetch(new URL('data/static-resources.json',APP_BASE), {cache:'no-store',signal:controller.signal});
    if (!response.ok) throw new Error('HTTP '+response.status);
    const {appVersion,revision} = await response.json();
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(appVersion) || !/^[a-f0-9]{12}$/.test(revision)) throw new Error('Invalid app release');
    updateOffer = (appVersion !== VERSION || (installedRevision && installedRevision !== revision)) ? {appVersion,revision} : null;
    if (!silent) dismissedRevision = '';
    updateNotice = waitingUpdate() ? tr('新版已下载。保存进度后可切换版本。','The update is downloaded and can be applied after saving.')
      : updateOffer ? tr('发现新版，选择“下载更新”后才会下载。','An update is available. Choose Download update to start.')
      : silent ? '' : tr('当前已是最新版本。','The app is up to date.');
    return !!updateOffer;
  } catch (error) {
    if (!silent) updateNotice = pwaUpdateError(error);
    return false;
  } finally { clearTimeout(timer); checkingUpdate = false; pwaBind(); }
}
async function pwaDownloadUpdate() {
  if (!updateOffer || downloadingUpdate || applyingUpdate) return false;
  if (waitingUpdate()) return true;
  downloadingUpdate = true;
  updateDownloadError = '';
  updateNotice = tr('正在下载并校验新版…','Downloading and verifying the update…');
  pwaBind();
  try {
    const url = new URL(workerURL);
    url.searchParams.set('revision',updateOffer.revision);
    registration = await navigator.serviceWorker.register(url,{scope:APP_BASE.href,updateViaCache:'none'});
    const installing = registration?.installing;
    if (installing?.scriptURL === url.href) {
      await new Promise((resolve,reject) => {
        const finish = error => {
          clearTimeout(timer);
          installing.removeEventListener('statechange',changed);
          if (error) reject(error); else resolve();
        };
        const changed = () => {
          if (['installed','activated'].includes(installing.state)) finish();
          else if (installing.state === 'redundant') finish(new Error('Update download failed'));
        };
        const timer = setTimeout(() => finish(new Error('Update download timed out')),180000);
        installing.addEventListener('statechange',changed);
        changed();
      });
    }
    if (!waitingUpdate()) throw new Error('The verified update is not ready');
    updateNotice = tr('新版已下载。保存进度后可切换版本。','The update is downloaded and can be applied after saving.');
    return true;
  } catch (error) {
    updateNotice = pwaUpdateError(error);
    return false;
  } finally { downloadingUpdate = false; pwaBind(); }
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
async function pwaApplyUpdate() {
  if (ctx.busy || ctx.uploadBusy) return toast(tr('请等待当前操作完成后更新。','Wait for the current operation before updating.'));
  const waiting = waitingUpdate();
  if (!waiting || applyingUpdate || downloadingUpdate) return false;
  applyingUpdate = true;
  pwaBind();
  switchTask521 = tasks.start('应用版本切换');
  switchTask521.stage('保存当前窗口资料');
  try {
    await flushUpdateWrites521();
    if (waitingUpdate() !== waiting) throw new Error(tr('可用版本发生变化，请重新检查。','The available version changed. Check again.'));
    switchTask521.stage('检查其他启程窗口是否已保存');
    updateWatchdog521 = setTimeout(() => {
      if (!applyingUpdate || preparedUpdate521) return;
      releaseUpdateLock521();
      updateNotice = tr('新版程序暂未响应，请稍后重试。','The new version did not respond. Try again.');
      switchTask521?.fail(new Error(updateNotice));
      switchTask521 = null;
      pwaBind();
    },18000);
    updateWatchdog521?.unref?.();
    waiting.postMessage({type:'ACTIVATE_UPDATE',protocol:2,requestId:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)});
    return true;
  } catch (error) {
    releaseUpdateLock521();
    switchTask521.fail(error);
    switchTask521 = null;
    updateNotice = error.message;
    pwaBind();
    return false;
  }
}
async function pwaInit() {
  window.addEventListener('beforeinstallprompt',event => {
    event.preventDefault();
    installationPrompt = event;
    pwaBind();
  });
  window.addEventListener('appinstalled',() => { installationPrompt = null; pwaBind(); });
  window.addEventListener('online',() => {
    pwaBind();
    lastUpdateCheck = 0;
    if (installedRevision) void pwaCheckUpdate({silent:true});
  });
  window.addEventListener('focus',() => { if (installedRevision) void pwaCheckUpdate({silent:true}); });
  window.addEventListener('offline',pwaBind);
  if (globalThis.QICHENG_STATIC) {
    status = 'portable';
    pwaBind();
    return;
  }
  if (!navigator.serviceWorker || !globalThis.isSecureContext) {
    status = 'error';
    message = tr('此地址无法启用 PWA。请使用 HTTPS 或 localhost。','PWA requires HTTPS or localhost.');
    pwaBind();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange',() => {
    if (applyingUpdate && preparedUpdate521) location.reload();
    else {
      updateNotice = tr('应用版本已切换，请保存进度后重新打开。','The app version changed. Save your work and reopen the app.');
      pwaBind();
    }
  });
  navigator.serviceWorker.addEventListener('message',handleWorkerMessage521);
  try {
    registration = await navigator.serviceWorker.getRegistration(APP_BASE.href)
      || await navigator.serviceWorker.register(workerURL,{scope:APP_BASE.href,updateViaCache:'none'});
    pwaBind();
    navigator.serviceWorker.controller?.postMessage({type:'GET_RELEASE_INFO'});
    await navigator.serviceWorker.ready;
    status = 'ready';
    pwaBind();
  } catch (error) {
    status = 'error';
    message = tr('离线支持注册失败：','Service worker registration failed: ')+error.message;
    pwaBind();
  }
}
const pwa = {
  init:pwaInit, bind:pwaBind, install:pwaInstall, statusText:pwaStatusText,
  checkUpdate:pwaCheckUpdate, downloadUpdate:pwaDownloadUpdate, applyUpdate:pwaApplyUpdate
};
export { pwa };
