import { $, $$, esc, tr, toast, download } from '../utils/helpers.js';
import { VERSION, UI_THEMES3 } from '../constants.js';
import { scheduleSave } from '../autosave.js';
import { clearAll, openBackupText } from '../backup.js';
import { render, go3 } from '../app.js';
import { pwa } from '../pwa.js';
import { ctx } from '../state.js';
import { RESOURCE_EXAMPLES } from '../data.js';
import { getResourceVersions, importResourceJSON, updateResources } from '../resources.js';
import { bindMarkdown31 } from './markdown.js';
import { exportFile } from './export.js';
import { backupPage } from './home.js';
let settingsResourceStatus = '';
function themeChoices () {
  return '<div class="theme-cards theme-cards3">'+UI_THEMES3.map(([id,z,e,sub])=>'<button class="theme-card '+(ctx.state.theme===id?'chosen':'')+'" data-setting-theme="'+id+'" aria-pressed="'+(ctx.state.theme===id)+'"><span class="theme-sample sample-'+id+'"><b>Aa</b><i></i></span><strong>'+tr(z,e)+'</strong><small>'+sub+'</small></button>').join('')+'</div>';
}
function resourceGuideMarkup() {
  return '<details class="resource-guide"><summary>'+tr('如何导入题库、典籍和每日一句？','How to import resources')+'</summary><p>'+tr('选择本地 UTF-8 JSON 文件即可。系统根据顶层 bank、book 或 quotes 自动识别类型，校验成功后保存在本机并立即加入对应页面；整个导入过程可以离线完成，无需 AI 服务、账号或额外联网。','Choose a local UTF-8 JSON. The bank, book or quotes field identifies the type. Valid files are stored locally and appear immediately, entirely offline.')+'</p><ul><li><b>bank</b>：'+tr('题库含 id、name、subject、section、version 和 questions。subject 为 english / chinese；section 分别为 grammar / vocabulary、ancient-culture / chinese-usage。单选 type 为 single-choice，options 是 {id,text} 数组，answer 必须匹配选项 ID；判断 type 为 true-false，answer 是布尔值 true / false。','A quiz bank has identity, subject, section, version and questions. Single choices use option IDs; true/false answers use JSON booleans.')+'</li><li><b>book</b>：'+tr('典籍含 id、title、version；passages 每段有稳定 id、text 原文，可附 chapter 篇目和 explanation 简释。用 lunyu / daodejing / zhuangzi 可填充预留入口；其他新 ID 会自动增加新的典籍入口。','A book has id, title and version; passages have stable IDs and text, with optional chapter/explanation. New book IDs automatically add study pages.')+'</li><li><b>quotes</b>：'+tr('每日一句含 version 和 quotes 数组；每句有 id、text，可附 source。可同时填写 bookId、passageId，链接到已安装典籍的同 ID 段落。导入后成为自定义每日一句，按本地日期每天固定显示一条。','Quotes have stable IDs, text and optional source. Optional bookId/passageId link to an installed passage. A local date chooses the same quote all day.')+'</li></ul><p>'+tr('三个格式都要求 schemaVersion: 1；version 用 1.0.0 形式；ID 使用字母、数字、点、下划线或连字符，同一文件内不得重复。题库 ID 不可占用官方 ID；相同自定义题库或典籍 ID 再次导入会替换该资源，保留相同题目 ID 对应的错题与收藏。每日一句导入会替换原自定义句库。建议每组至少 10 或 20 题。单个文件最多 12 MB。','All formats require schemaVersion 1, semantic versions and unique stable IDs. Reimporting a custom ID replaces that resource; stable question IDs preserve learning marks. Each file is limited to 12 MB.')+'</p><p>'+tr('自定义题库、典籍和每日一句均进入完整 JSON 备份。失败的文件会显示原因并保留旧数据。不要把启程备份文件当成资源导入。','Custom resources enter full backups. Failed imports keep existing data. A personal backup is not a resource file.')+'</p><div class="actions"><button data-resource-sample="quiz">'+tr('下载题库 JSON 样例','Quiz JSON sample')+'</button><button data-resource-sample="classic">'+tr('下载典籍 JSON 样例','Classic JSON sample')+'</button><button data-resource-sample="quotes">'+tr('下载每日一句 JSON 样例','Quotes JSON sample')+'</button><button data-resource-sample="ai">'+tr('下载给 AI 的格式说明','AI format instructions')+'</button></div><p>'+tr('可把样例、格式说明和你自己的资料一起交给千问、DeepSeek、GLM 或其他 AI，要求只输出对应格式的 JSON，不加代码围栏。AI 生成后仍需核对原文与答案，再导入启程；系统会验证结构，不能代替内容校对。','Give the sample, instructions and source material to Qwen, DeepSeek, GLM or another AI. Request plain JSON, then verify the content before import. Structural validation cannot verify facts.')+'</p></details>';
}
function settingsResourceMarkup() {
  const v=getResourceVersions();
  return '<section class="settings-section" id="resourceSettings"><h2>'+tr('题库与资源','Banks & resources')+'</h2><p class="hint">'+tr('只有主动点击在线获取才访问资源更新清单。已安装资源永久保存在本机，可完全离线使用。','Resource updates run only when requested. Installed resources remain available offline.')+'</p><div class="resource-list">'+v.banks.map(b=>'<div><span>'+esc(b.name)+'</span><span>'+b.questionCount+tr(' 题',' questions')+'</span></div>').join('')+'<div><span>'+tr('中华文化典籍','Chinese classics')+'</span><span>'+v.classics.length+tr(' 部入口',' study pages')+'</span></div><div><span>'+tr('每日一句','Daily quotes')+'</span><span>'+(v.quotes?.count||0)+tr(' 句',' quotes')+'</span></div></div><div class="actions"><button data-resource-import>'+tr('导入本地 JSON','Import local JSON')+'</button><button class="primary" data-resource-update>'+tr('在线获取最新版资源','Get latest resources online')+'</button></div><input type="file" id="resourceJSONInput" accept=".json,application/json" hidden><p id="resourceResult" class="hint" role="status">'+esc(settingsResourceStatus)+'</p>'+resourceGuideMarkup()+'</section>';
}
function settingsPage() {
  const v=getResourceVersions();
  const versions=[['启程',VERSION],...v.banks.map(b=>[b.name,b.version]),...v.classics.map(b=>['《'+b.title+'》',b.version]),['每日一句',v.quotes?.version||'—']];
  return '<div class="settings-page"><header class="explore-heading"><p class="eyebrow">QICHENG / SETTINGS</p><h1>'+tr('设置','Settings')+'</h1><p>'+tr('外观、资源与资料备份，集中在这里。','Appearance, resources and backups in one place.')+'</p></header><section class="settings-section"><h2>'+tr('外观与语言','Appearance & language')+'</h2>'+themeChoices()+'<label class="field"><span>'+tr('界面语言','Interface language')+'</span><select id="uiLanguage"><option value="zh" '+(ctx.state.uiLang==='zh'?'selected':'')+'>中文</option><option value="en" '+(ctx.state.uiLang==='en'?'selected':'')+'>English</option></select></label><p class="hint">'+tr('修改内容、文件和设置时自动保存；切换页面、菜单和临时标签不会触发保存。','Content, files and settings save automatically; navigation and temporary tabs do not.')+'</p></section><section class="settings-section"><h2>'+tr('Markdown 数据工具','Markdown tools')+'</h2><div class="actions"><button data-md-import31>'+tr('Markdown 导入','Import Markdown')+'</button><button data-md-template31>'+tr('下载 Markdown 样板','Download template')+'</button><button data-settings-md-export>'+tr('Markdown 下载 / 导出','Export Markdown')+'</button></div></section>'+settingsResourceMarkup()+'<section class="settings-section" id="backupSettings">'+backupPage()+'</section><section class="settings-section"><h2>'+tr('安装与离线','Install & offline')+'</h2><p data-pwa-status role="status"></p><div class="actions"><button data-pwa-install></button><button data-pwa-refresh hidden>'+tr('保存并更新应用','Save & update app')+'</button><button id="settingsOfflineGuide">'+tr('离线说明','Offline guide')+'</button></div></section><details class="settings-section"><summary>'+tr('其他数据工具','Other data tools')+'</summary><div class="actions"><button id="settingsBackupText">'+tr('备份文本','Backup text')+'</button><button class="danger-button" data-backup-clear>'+tr('清除本地数据','Clear local data')+'</button></div></details><footer class="settings-versions"><h2>'+tr('版本信息','Versions')+'</h2><dl>'+versions.map(([label,version])=>'<div><dt>'+esc(label)+'</dt><dd>v'+esc(version)+'</dd></div>').join('')+'</dl></footer></div>';
}
function openSettings(first=false,focusResources=false) {
  go3('settings');
  if(focusResources) $('#resourceSettings')?.scrollIntoView({block:'start'});
}
function bindSettingsControls() {
  $$('[data-setting-theme],[data-theme-choice]').forEach(b=>b.onclick=()=>{
    const theme=b.dataset.settingTheme||b.dataset.themeChoice;
    if(ctx.busy||ctx.state.theme===theme)return;
    ctx.state.theme=theme; scheduleSave(); render();
  });
  const language=$('#uiLanguage');if(language)language.onchange=()=>{if(ctx.busy||ctx.state.uiLang===language.value)return;ctx.state.uiLang=language.value;scheduleSave();render();};
  if(!$('#resourceSettings'))return;
  bindMarkdown31();
  $('[data-settings-md-export]').onclick=()=>exportFile('md');
  $('[data-backup-clear]').onclick=clearAll;$('#settingsBackupText').onclick=openBackupText;$('#settingsOfflineGuide').onclick=openOfflineGuide;
  $('[data-resource-import]').onclick=()=>{if(!ctx.busy)$('#resourceJSONInput').click();};
  $('#resourceJSONInput').onchange=async event=>{
    const file=event.target.files[0];if(!file||ctx.busy)return;ctx.busy=true;
    try{if(file.size>12*1024*1024)throw new Error('资源文件超过 12 MB。');const result=await importResourceJSON(await file.text());settingsResourceStatus=tr('已导入并保存到本机：','Imported and saved locally: ')+(result.bank?.name||result.book?.title||tr('每日一句','Daily quotes'));}
    catch(error){settingsResourceStatus=tr('导入失败，旧数据已保留：','Import failed; existing data kept: ')+error.message;}
    finally{ctx.busy=false;render();$('#resourceSettings')?.scrollIntoView({block:'start'});}
  };
  $('[data-resource-update]').onclick=async()=>{
    if(ctx.busy)return;ctx.busy=true;$('[data-resource-update]').disabled=true;$('[data-resource-import]').disabled=true;$('#resourceResult').textContent=tr('正在获取并校验资源…','Downloading and validating resources…');
    try{const result=await updateResources();settingsResourceStatus=result.updated.length?tr('已更新并保存到本机：','Updated and saved locally: ')+result.updated.join('、'):tr('已安装资源均为最新版本。','Installed resources are up to date.');}
    catch(error){settingsResourceStatus=tr('更新失败，旧版资源已保留：','Update failed; existing resources kept: ')+error.message;}
    finally{ctx.busy=false;render();$('#resourceSettings')?.scrollIntoView({block:'start'});}
  };
  $$('[data-resource-sample]').forEach(b=>b.onclick=()=>{
    const kind=b.dataset.resourceSample;if(kind==='ai')return download(RESOURCE_EXAMPLES.aiGuide,'text/markdown;charset=utf-8','Qicheng-AI-资源格式说明.md');
    const sample=RESOURCE_EXAMPLES.samples[kind];download(JSON.stringify(sample.data,null,2)+'\n','application/json;charset=utf-8',sample.filename);
  });
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
  '</p><p>' + tr ('菜单 → 设置 → 保存与备份 → 备份数据。恢复时先校验、显示备份信息并确认；失败会保留原数据。', 'Menu → Save & backup → Back up data. Restores are validated and confirmed first; failures keep the original data.') +
  '</p><p>' + tr ('招生网站、百科与地图数据来源等外部链接需要联网。院校资料、地图、编辑、预览、导出与备份可离线使用。', 'External admissions websites, encyclopedias and source links need internet. Built-in university information, maps, editing, previews, exports and backups work offline.') +
  '</p><p>' + tr ('可编辑 HTML 副本仍会完整打包程序和资料，方便留档；它不是可安装的 PWA。JSON 是日常备份的推荐方式。', 'Editable HTML copies still bundle the app and your materials. Use JSON for routine backups; HTML copies are standalone documents.') +
  '</p><button id="closeOfflineGuide">' + tr ('关闭', 'Close') + '</button>';
  dialog.showModal ();
  $ ('#closeOfflineGuide').onclick = () => dialog.close ();
}
export { themeChoices, settingsPage, openSettings, openOfflineGuide, bindSettingsControls };
