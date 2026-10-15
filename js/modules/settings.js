import { $, $$, esc, tr, toast } from '../utils/helpers.js';
import { VERSION, UI_THEMES3 } from '../constants.js';
import { save, scheduleSave } from '../autosave.js';
import { clearAll, openBackupText } from '../backup.js';
import { render } from '../app.js';
import { pwa } from '../pwa.js';
import { ctx } from '../state.js';
import { getResourceVersions, importResourceJSON, updateResources } from '../resources.js';
import { bindMarkdown31 } from './markdown.js';
import { exportFile } from './export.js';
let settingsResourceStatus = '';
// 启程 · js/modules/settings.js


function themeChoices () {
  return '<div class="theme-cards theme-cards3">' + UI_THEMES3.map (([id, z, e, sub]) => '<button class="theme-card ' +
  (ctx.state.theme === id ? 'chosen' : '') + '" data-setting-theme="' + id + '" aria-pressed="' + (ctx.state.theme === id) +
  '"><span class="theme-sample sample-' + id + '"><b>Aa</b><i></i></span><strong>' + tr (z, e) + '</strong><small>' +
  sub + '</small></button>').join ('') + '</div>'
}

export { themeChoices };

function settingsResourceMarkup () {
  const versions = getResourceVersions ();
  return '<section class="settings-section" id="resourceSettings"><h3>' + tr ('题库与资源管理', 'Banks & resources') + '</h3><p class="hint">' + tr ('仅在你点击在线获取时联网。已安装资源可完全离线使用，更新失败保留旧版。', 'Updates run only when requested. Installed resources work offline; failed updates keep the old version.') + '</p><div class="resource-list">' + versions.banks.map (bank => '<div><span>' + esc (bank.name) + '<small>' + tr (bank.origin === 'custom' ? '自定义' : '官方', bank.origin === 'custom' ? 'Custom' : 'Official') + '</small></span><span>v' + esc (bank.version) + ' · ' + bank.questionCount + tr (' 题', ' questions') + '</span></div>').join ('') + '<div><span>' + tr ('每日一句', 'Daily quotes') + '</span><span>' + (versions.quotes ? 'v' + esc (versions.quotes.version) + ' · ' + versions.quotes.count + tr (' 句', ' quotes') : tr ('尚未安装', 'Not installed')) + '</span></div></div><div class="actions"><button data-resource-import>' + tr ('导入本地 JSON', 'Import local JSON') + '</button><button class="primary" data-resource-update>' + tr ('在线获取最新版资源', 'Get latest resources online') + '</button></div><input type="file" id="resourceJSONInput" accept=".json,application/json" hidden><p id="resourceResult" class="hint" role="status">' + esc (settingsResourceStatus) + '</p></section>';
}
function openSettings (first = false, focusResources = false) {
  let dialog = $ ('#settingsDialog');
  if (! dialog) { dialog = document.createElement ('dialog'); dialog.id = 'settingsDialog'; document.body.append (dialog); }
  dialog.innerHTML = '<div class="eyebrow">QICHENG / ' + VERSION + '</div><h2>' + tr (first ? '先选一种工作台风格' : '设置', first ? 'Choose a workspace style' : 'Settings') + '</h2><p>' + tr ('界面配色与简历配色分别设置。更换语言不会翻译你填写的内容。', 'Workspace and document colors are set separately. Changing language does not translate your content.') + '</p>' + themeChoices () + '<label class="field"><span>' + tr ('界面语言', 'Interface language') + '</span><select id="uiLanguage"><option value="zh" ' + (ctx.state.uiLang === 'zh' ? 'selected' : '') + '>中文</option><option value="en" ' + (ctx.state.uiLang === 'en' ? 'selected' : '') + '>English</option></select></label>' +
    (first ? '' : '<section class="settings-section"><h3>' + tr ('Markdown 数据工具', 'Markdown data tools') + '</h3><p class="hint">' + tr ('导入填写好的资料，或下载资料样板与当前文档。', 'Import completed materials, or download a template and the current document.') + '</p><div class="actions"><button data-md-import31>' + tr ('Markdown 导入', 'Import Markdown') + '</button><button data-md-template31>' + tr ('下载 Markdown 样板', 'Download template') + '</button><button data-settings-md-export>' + tr ('Markdown 下载 / 导出', 'Export Markdown') + '</button></div></section>' + settingsResourceMarkup () + '<section class="settings-section"><h3>' + tr ('安装与离线', 'Install & offline') + '</h3><p data-pwa-status role="status"></p><div class="actions"><button data-pwa-install></button><button data-pwa-refresh hidden>' + tr ('保存并更新应用', 'Save & update app') + '</button><button id="settingsOfflineGuide">' + tr ('离线说明', 'Offline guide') + '</button></div><p class="hint">' + tr ('iPhone / iPad：在 Safari 点击分享按钮 → 添加到主屏幕。', 'iPhone / iPad: in Safari, tap Share → Add to Home Screen.') + '</p></section><details class="settings-advanced"><summary>' + tr ('其他数据工具', 'Other data tools') + '</summary><p class="hint">' + tr ('日常 JSON 备份与本地文件位于菜单的“保存与备份”。', 'Use Save & backup in the menu for routine JSON backups and local files.') + '</p><div class="actions"><button id="settingsBackupText">' + tr ('备份文本', 'Backup text') + '</button><button class="danger-button" data-backup-clear>' + tr ('清除本地数据', 'Clear local data') + '</button></div></details>') + '<div class="settings-finish"><button class="primary" id="finishSettings">' + tr (first ? '开始使用' : '完成', first ? 'Start creating' : 'Done') + '</button></div>';
  dialog.oncancel = event => { if (first) event.preventDefault (); };
  if (! dialog.open) dialog.showModal ();
  $$ ('[data-setting-theme]').forEach (button => button.onclick = () => {
    if (ctx.busy) return;
    ctx.state.theme = button.dataset.settingTheme; document.body.dataset.theme = ctx.state.theme; scheduleSave (); openSettings (first);
  });
  $ ('#uiLanguage').onchange = event => {
    if (ctx.busy) return;
    ctx.state.uiLang = event.target.value; scheduleSave (); render (); openSettings (first);
  };
  $ ('#finishSettings').onclick = async () => {
    if (ctx.busy) return;
    ctx.state.onboarded = true; await save (); dialog.close (); render ();
  };
  if (! first) {
    bindMarkdown31 ();
    $ ('[data-settings-md-export]').onclick = async () => {
      dialog.close (); await exportFile ('md');
    };
    $ ('[data-backup-clear]').onclick = clearAll;
    $ ('#settingsBackupText').onclick = () => { dialog.close (); openBackupText (); };
    $ ('#settingsOfflineGuide').onclick = () => { dialog.close (); openOfflineGuide (); };
    $ ('[data-resource-import]').onclick = () => { if (!ctx.busy) $ ('#resourceJSONInput').click (); };
    $ ('#resourceJSONInput').onchange = async event => {
      const file = event.target.files?.[0]; if (!file || ctx.busy) return;
      ctx.busy = true;
      try {
        if (file.size > 12*1024*1024) throw new Error(tr('资源文件超过 12 MB。','Resource file exceeds 12 MB.'));
        const resource = await importResourceJSON (await file.text ());
        settingsResourceStatus = tr ('已导入并保存：', 'Imported and saved: ') + (resource.bank?.name || tr ('每日一句', 'Daily quotes'));
        render ();
      } catch (error) { settingsResourceStatus = tr ('导入失败，原数据已保留：', 'Import failed; existing data kept: ') + error.message; }
      finally { ctx.busy = false; openSettings (false, true); }
    };
    $ ('[data-resource-update]').onclick = async () => {
      if (ctx.busy) return;
      ctx.busy = true;
      $ ('[data-resource-update]').disabled = true; $ ('[data-resource-import]').disabled = true;
      $ ('#resourceResult').textContent = tr ('正在获取并校验资源…', 'Downloading and validating resources…');
      try {
        const result = await updateResources ();
        settingsResourceStatus = result.updated.length ? tr ('已更新并保存到本机：', 'Updated and saved locally: ') + result.updated.join ('、') : tr ('已安装资源均为最新版本。', 'Installed resources are up to date.');
        render ();
      } catch (error) { settingsResourceStatus = tr ('更新失败，旧版资源已保留：', 'Update failed; existing resources kept: ') + error.message; }
      finally { ctx.busy = false; openSettings (false, true); }
    };
  }
  pwa.bind ();
  if (focusResources) $ ('#resourceSettings')?.scrollIntoView ({block:'start'});
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
  '</p><p>' + tr ('菜单 → 保存与备份 → 备份数据。恢复时先校验、显示备份信息并确认；失败会保留原数据。', 'Menu → Save & backup → Back up data. Restores are validated and confirmed first; failures keep the original data.') +
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
