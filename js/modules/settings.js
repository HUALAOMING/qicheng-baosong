import { $, $$, tr } from '../utils/helpers.js';
import { VERSION, UI_THEMES3 } from '../constants.js';
import { save, scheduleSave } from '../autosave.js';
import { exportBackup, clearAll } from '../backup.js';
import { render } from '../app.js';
import { pwa } from '../pwa.js';
import { ctx } from '../state.js';
// 启程 · js/modules/settings.js


function themeChoices () {
  return '<div class="theme-cards theme-cards3">' + UI_THEMES3.map (([id, z, e, sub]) => '<button class="theme-card ' +
  (ctx.state.theme === id ? 'chosen' : '') + '" data-setting-theme="' + id + '" aria-pressed="' + (ctx.state.theme === id) +
  '"><span class="theme-sample sample-' + id + '"><b>Aa</b><i></i></span><strong>' + tr (z, e) + '</strong><small>' +
  sub + '</small></button>').join ('') + '</div>'
}

export { themeChoices };

function openSettings (first = false) {
  let dialog = $ ('#settingsDialog');
  if (! dialog) {
    dialog = document.createElement ('dialog');
    dialog.id = 'settingsDialog';
    document.body.append (dialog);
  }
  dialog.innerHTML = '<div class="eyebrow">QICHENG / ' + VERSION + '</div><h2>' + tr (first ? '先选一种工作台风格' : '工作台设置',
  first ? 'Choose a workspace style' : 'Workspace settings') + '</h2>' + '<p>' + tr ('界面配色与简历配色分别设置。更换语言不会翻译你填写的内容。',
  'Workspace and document colors are set separately. Changing language does not translate your content.') + '</p>' +
  themeChoices () + '<label class="field"><span>' + tr ('界面语言', 'Interface language') + '</span><select id="uiLanguage"><option value="zh" ' +
  (ctx.state.uiLang === 'zh' ? 'selected' : '') + '>中文</option><option value="en" ' + (ctx.state.uiLang === 'en' ? 'selected' : '') +
  '>English</option></select></label>' + '<section class="backup-settings"><h3>' + tr ('数据与备份', 'Data & backup') + '</h3><p>' +
  tr ('数据只保存在此设备和浏览器中。JSON 备份包含全部内容、图片、附件和设置。', 'Data stays on this device and browser. JSON backups include all content, images, files and settings.') +
  '</p>' + '<div class="backup-buttons"><button class="primary" data-backup-now>' + tr ('立即备份', 'Back up now') + '</button><button data-backup-restore>' +
  tr ('从备份恢复', 'Restore backup') + '</button><button class="danger-button" data-backup-clear>' + tr ('清除本地数据', 'Clear local data') +
  '</button></div></section>' + '<section class="pwa-settings"><h3>' + tr ('安装与离线', 'Install & offline') + '</h3><p data-pwa-status role="status"></p><div class="actions"><button data-pwa-install></button><button data-pwa-refresh hidden>' +
  tr ('保存并更新', 'Save & update') + '</button></div><p class="hint">' + tr ('iPhone / iPad：在 Safari 点击分享按钮 → 添加到主屏幕。',
  'iPhone / iPad: in Safari, tap Share → Add to Home Screen.') + '</p></section>' + '<button class="primary" id="finishSettings">' +
  tr (first ? '开始使用' : '完成', first ? 'Start creating' : 'Done') + '</button>';
  dialog.oncancel = event => {
    if (first) event.preventDefault ();
  };
  if (! dialog.open) dialog.showModal ();
  $$ ('[data-setting-theme]').forEach (button => button.onclick = () => {
    ctx.state.theme = button.dataset.settingTheme; document.body.dataset.theme = ctx.state.theme; scheduleSave (); openSettings (first);
  });
  $ ('#uiLanguage').onchange = event => {
    ctx.state.uiLang = event.target.value;
    scheduleSave ();
    render ();
    openSettings (first);
  };
  $ ('[data-backup-now]').onclick = exportBackup;
  $ ('[data-backup-restore]').onclick = () => $ ('#backupInput').click ();
  $ ('[data-backup-clear]').onclick = clearAll;
  $ ('#finishSettings').onclick = async () => {
    ctx.state.onboarded = true;
    await save ();
    dialog.close ();
    render ();
  };
  pwa.bind ();
}
function openOfflineGuide () {
  let dialog = $ ('#offlineHelp');
  if (! dialog) {
    dialog = document.createElement ('dialog');
    dialog.id = 'offlineHelp';
    document.body.append (dialog);
  }
  dialog.innerHTML = '<h2>' + tr ('离线使用说明', 'Offline guide') + '</h2><p>' + tr ('首次联网打开后，在设置中看到“离线资源已就绪”，即可断网启动。安装后可从主屏幕或桌面独立打开。',
  'After your first online visit, wait for Ready for offline use in Settings. You can then launch without internet, including from the installed app.') +
  '</p><p>' + tr ('数据只保存在本设备的当前浏览器中；换浏览器、清除网站数据或更换安装地址，不会自动带上原数据。请用 JSON 备份转移内容。', 'Data belongs to this browser and address. Use a JSON backup to move between browsers, devices or installation addresses.') +
  '</p><p>' + tr ('填写后约半秒自动保存。离开前请确认“已保存”。保存失败时，立即备份当前工作台内容。', 'Edits save after about half a second. Check Saved before leaving; back up immediately if saving fails.') +
  '</p><p>' + tr ('设置 → 数据与备份 → 立即备份。恢复时先校验、显示备份信息并确认；失败会保留原数据。', 'Settings → Data & backup → Back up now. Restores are validated and confirmed first; failures keep the original data.') +
  '</p><p>' + tr ('招生网站、百科与地图数据来源等外部链接需要联网。院校资料、地图、编辑、预览、导出与备份可离线使用。', 'External admissions websites, encyclopedias and source links need internet. Built-in university information, maps, editing, previews, exports and backups work offline.') +
  '</p><p>' + tr ('可编辑 HTML 副本仍会完整打包程序和资料，方便留档；它不是可安装的 PWA。JSON 是日常备份的推荐方式。', 'Editable HTML copies still bundle the app and your materials. Use JSON for routine backups; HTML copies are standalone documents.') +
  '</p><button id="closeOfflineGuide">' + tr ('关闭', 'Close') + '</button>';
  dialog.showModal ();
  $ ('#closeOfflineGuide').onclick = () => dialog.close ();
}
export { openSettings, openOfflineGuide };

// All controls for this feature, in their original override order.
function bindSettingsControls () {
  $$ ('[data-theme-choice]').forEach (b => b.onclick = () => {
    if (ctx.busy) return; ctx.state.theme = b.dataset.themeChoice; scheduleSave (); render ();
  });
}
export { bindSettingsControls };
