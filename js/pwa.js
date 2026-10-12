import { ctx } from './state.js';
import { $, $$, toast, tr } from './utils/helpers.js';
import { save } from './autosave.js';
import { APP_BASE } from './data.js';
let installationPrompt = null, registration = null, status = 'loading', message = '', applyingUpdate = false;
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
          status = 'error'; message = tr ('离线资源准备失败，请联网重新加载。', 'Offline preparation failed. Reload while online.'); pwaBind (); toast (message);
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
  init : pwaInit, bind : pwaBind, install : pwaInstall, statusText : pwaStatusText
};
export { pwa };
