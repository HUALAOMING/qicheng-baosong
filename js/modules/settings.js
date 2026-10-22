import { $, $$, esc, tr, toast, download } from '../utils/helpers.js';
import { VERSION, UI_THEMES3 } from '../constants.js';
import { scheduleSave } from '../autosave.js';
import { clearAll, openBackupText } from '../backup.js';
import { render, go3, confirmAction } from '../app.js';
import { pwa } from '../pwa.js';
import { ctx } from '../state.js';
import { RESOURCE_EXAMPLES } from '../data.js';
import { getResourceVersions, importResourceJSON, updateResources, validateQuizBank, listPracticeBanks, listImportedQuizPacks, createPracticeBank, deletePracticeBank, deleteImportedQuizPack } from '../resources.js';
import { bindMarkdown31 } from './markdown.js';
import { exportFile } from './export.js';
import { homeSettingsMarkup } from './home.js';
import {transferMarkup,bindTransferControls} from '../transfer.js';
let settingsResourceStatus = '';
let pendingQuizImport = null, importTarget = '';
function practiceLibraryMarkup() {
  const banks = listPracticeBanks(), packs = listImportedQuizPacks();
  if (!banks.some(item => item.bank.id === importTarget)) importTarget = banks[0]?.bank.id || '';
  const options = banks.map(item => '<option value="'+esc(item.bank.id)+'" '+(item.bank.id===importTarget?'selected':'')+'>'+esc(item.bank.name)+'</option>').join('');
  return '<div class="quiz-library"><h3>'+tr('练习题库','Practice banks')+'</h3><p class="hint">'+tr('四个默认题库始终保留。JSON 是题目包，选择归入哪个题库，不会每次新增练习入口。','The four default banks remain. Each JSON is a question pack assigned to your chosen practice bank.')+'</p><div class="resource-list">'+banks.map(item=>'<div><span>'+esc(item.bank.name)+' · '+item.questions.length+tr(' 题',' questions')+'</span>'+(item.origin==='custom'?'<button class="danger-button" data-bank-delete="'+esc(item.bank.id)+'">'+tr('删除题库','Delete bank')+'</button>':'<small>'+tr('默认题库','Default bank')+'</small>')+'</div>').join('')+'</div><details class="resource-guide" '+(pendingQuizImport?'open':'')+'><summary>'+tr('新建自己的题库','Create a practice bank')+'</summary><label class="field"><span>'+tr('题库名称','Bank name')+'</span><input id="practiceBankName" maxlength="200" placeholder="'+tr('例如：考前专项练习','For example: revision')+'"></label><label class="field"><span>'+tr('所属板块','Category')+'</span><select id="practiceBankCategory"><option value="english:grammar">英语语法</option><option value="english:vocabulary">英语词汇</option><option value="chinese:ancient-culture">中国古代文化常识</option><option value="chinese:chinese-usage">汉语易错知识</option></select></label><button data-bank-create>'+tr('新建题库','Create bank')+'</button></details>'+(pendingQuizImport?'<div class="quiz-import-preview" role="region" aria-label="'+tr('选择导入目标题库','Choose destination')+'"><h3>'+tr('将题目导入哪个题库？','Where should these questions go?')+'</h3><p>'+esc(pendingQuizImport.name)+' · '+pendingQuizImport.count+tr(' 题',' questions')+'</p><label class="field"><span>'+tr('目标题库','Destination bank')+'</span><select id="quizImportTarget">'+options+'</select></label><p class="hint">'+tr('同一 bank.id 再次导入会更新原题目包，并可移动到所选题库；不同 ID 的题目包会合并练习，彼此不会覆盖。','Reimporting the same bank.id updates its pack and can move it. Different pack IDs are combined for practice without overwriting each other.')+'</p><div class="actions"><button class="primary" data-bank-import-confirm>'+tr('确认导入','Import questions')+'</button><button data-bank-import-cancel>'+tr('取消','Cancel')+'</button></div></div>':'')+(packs.length?'<h3>'+tr('已导入的题目包','Imported question packs')+'</h3><div class="resource-list">'+packs.map(item=>'<div><span>'+esc(item.bank.name)+' · '+item.questions.length+tr(' 题 → ',' questions → ')+esc(banks.find(b=>b.bank.id===item.targetBankId)?.bank.name||'')+'</span><button class="danger-button" data-pack-delete="'+esc(item.bank.id)+'">'+tr('删除','Delete')+'</button></div>').join('')+'</div><p class="hint">'+tr('删除题目包只移除导入题目。成绩、错题与收藏保留；以后重新导入相同 ID 可继续匹配。','Deleting a pack removes its questions. Results and learning marks remain and reconnect when the same IDs return.')+'</p>':'')+'</div>';
}
function themeChoices () {
  return '<div class="theme-cards theme-cards3">'+UI_THEMES3.map(([id,z,e,sub])=>'<button class="theme-card '+(ctx.state.theme===id?'chosen':'')+'" data-setting-theme="'+id+'" aria-pressed="'+(ctx.state.theme===id)+'"><span class="theme-sample sample-'+id+'"><b>Aa</b><i></i></span><strong>'+tr(z,e)+'</strong><small>'+sub+'</small></button>').join('')+'</div>';
}
function resourceGuideMarkup() {
  return '<details class="resource-guide"><summary>'+tr('如何导入题库、典籍和每日一句？','How to import resources')+'</summary><p>'+tr('选择本地 UTF-8 JSON 文件即可。系统根据顶层 bank、book、quotes 或 examSchedule 自动识别类型，校验成功后保存在本机并立即加入对应页面；整个导入过程可以离线完成，无需 AI 服务、账号或额外联网。','Choose a local UTF-8 JSON. The bank, book, quotes or examSchedule field identifies the type. Valid files are stored locally and appear immediately, entirely offline.')+'</p><ul><li><b>bank</b>：'+tr('题库含 id、name、subject、section、version 和 questions。subject 为 english / chinese；section 分别为 grammar / vocabulary、ancient-culture / chinese-usage。单选 type 为 single-choice，options 是 {id,text} 数组，answer 必须匹配选项 ID；判断 type 为 true-false，answer 是布尔值 true / false。','A quiz bank has identity, subject, section, version and questions. Single choices use option IDs; true/false answers use JSON booleans.')+'</li><li><b>book</b>：'+tr('典籍含 id、title、version；passages 每段有稳定 id、text 原文，可附 chapter 篇目和 explanation 简释。用 lunyu / daodejing / zhuangzi 可填充预留入口；其他新 ID 会自动增加新的典籍入口。','A book has id, title and version; passages have stable IDs and text, with optional chapter/explanation. New book IDs automatically add study pages.')+'</li><li><b>quotes</b>：'+tr('每日一句含 version 和 quotes 数组；每句有 id、text，可附 source。可同时填写 bookId、passageId，链接到已安装典籍的同 ID 段落。导入后成为自定义每日一句，按本地日期每天固定显示一条。','Quotes have stable IDs, text and optional source. Optional bookId/passageId link to an installed passage. A local date chooses the same quote all day.')+'</li><li><b>examSchedule</b>：'+tr('考试日程含 version 和 examSchedule 数组。每项有稳定 id、schoolId、schoolName、date（YYYY-MM-DD）、stage（written 笔试 / interview 面试）；可选 startTime、endTime（HH:mm）、location、note。同一学校同日的笔试、面试分别一项，schoolId 相同；日历按院校去重计数。导入后更新考试信息页。','Schedules have version and an examSchedule array. Each event has id, schoolId, schoolName, date (YYYY-MM-DD) and stage (written/interview); optional startTime/endTime (HH:mm), location and note. A school’s stages share schoolId and count as one university per day.')+'</li></ul><p>'+tr('四种格式都要求 schemaVersion: 1；version 用 1.0.0 形式；ID 使用字母、数字、点、下划线或连字符，同一文件内不得重复。题库 JSON 先选择目标题库，再确认导入。bank.id 识别题目包，相同 ID 再次导入更新整个题目包，不同 ID 合并进入所选题库。题目 ID 在各自题目包内保持稳定即可，跨文件同名不会冲突。原有导入题目自动归入对应默认题库，错题和收藏继续保留。典籍相同 ID 再次导入仍替换原资源。每日一句导入会替换原自定义句库。建议每组至少 10 或 20 题。单个文件最多 12 MB。','All formats require schemaVersion 1, semantic versions and unique stable IDs. Choose a destination bank for each quiz JSON. bank.id identifies its pack: reimport replaces that pack, while different packs are combined. Stable IDs preserve learning marks. Each file is limited to 12 MB.')+'</p><p>'+tr('自定义题库、典籍、每日一句和考试日程均进入完整 JSON 备份。失败的文件会显示原因并保留旧数据。不要把启程备份文件当成资源导入。','Custom resources enter full backups. Failed imports keep existing data. A personal backup is not a resource file.')+'</p><div class="actions"><button data-resource-sample="quiz">'+tr('下载题库 JSON 样例','Quiz JSON sample')+'</button><button data-resource-sample="classic">'+tr('下载典籍 JSON 样例','Classic JSON sample')+'</button><button data-resource-sample="quotes">'+tr('下载每日一句 JSON 样例','Quotes JSON sample')+'</button><button data-resource-sample="schedule">'+tr('下载考试日程 JSON 样例','Exam schedule JSON sample')+'</button><button data-resource-sample="ai">'+tr('下载给 AI 的格式说明','AI format instructions')+'</button></div><p>'+tr('可把样例、格式说明和你自己的资料一起交给千问、DeepSeek、GLM 或其他 AI，要求只输出对应格式的 JSON，不加代码围栏。AI 生成后仍需核对原文与答案，再导入启程；系统会验证结构，不能代替内容校对。','Give the sample, instructions and source material to Qwen, DeepSeek, GLM or another AI. Request plain JSON, then verify the content before import. Structural validation cannot verify facts.')+'</p></details>';
}
function settingsResourceMarkup() {
  const v=getResourceVersions();
  return '<section class="settings-section" id="resourceSettings"><h2>'+tr('题库与资源','Banks & resources')+'</h2><p class="hint">'+tr('只有主动点击在线获取才访问资源更新清单。已安装资源永久保存在本机，可完全离线使用。','Resource updates run only when requested. Installed resources remain available offline.')+'</p><div class="resource-list">'+'<div><span>'+tr('中华文化典籍','Chinese classics')+'</span><span>'+v.classics.length+tr(' 部入口',' study pages')+'</span></div><div><span>'+tr('每日一句','Daily quotes')+'</span><span>'+(v.quotes?.count||0)+tr(' 句',' quotes')+'</span></div><div><span>'+tr('院校考试日程','University examinations')+'</span><span>'+(v.examSchedule?.count||0)+tr(' 项安排',' events')+'</span></div></div><div class="actions"><button data-resource-import>'+tr('导入本地 JSON','Import local JSON')+'</button><button class="primary" data-resource-update>'+tr('在线获取最新版资源','Get latest resources online')+'</button></div><input type="file" id="resourceJSONInput" accept=".json,application/json" hidden><p id="resourceResult" class="hint" role="status">'+esc(settingsResourceStatus)+'</p>'+practiceLibraryMarkup()+resourceGuideMarkup()+'</section>';
}
function settingsPage() {
  const v=getResourceVersions();
  const versions=[['启程',VERSION],...v.banks.map(b=>[b.name,b.version]),...v.classics.map(b=>['《'+b.title+'》',b.version]),['每日一句',v.quotes?.version||'—'],['考试日程',v.examSchedule?.version||'—']];
  return '<div class="settings-page"><header class="explore-heading"><p class="eyebrow">QICHENG / SETTINGS</p><h1>'+tr('设置','Settings')+'</h1><p>'+tr('外观、资源与资料备份，集中在这里。','Appearance, resources and backups in one place.')+'</p></header><section class="settings-section"><h2>'+tr('外观与语言','Appearance & language')+'</h2>'+themeChoices()+'<label class="field"><span>'+tr('界面语言','Interface language')+'</span><select id="uiLanguage"><option value="zh" '+(ctx.state.uiLang==='zh'?'selected':'')+'>中文</option><option value="en" '+(ctx.state.uiLang==='en'?'selected':'')+'>English</option></select></label><p class="hint">'+tr('修改内容、文件和设置时自动保存；切换页面、菜单和临时标签不会触发保存。','Content, files and settings save automatically; navigation and temporary tabs do not.')+'</p></section>'+homeSettingsMarkup()+'<section class="settings-section"><h2>'+tr('Markdown 数据工具','Markdown tools')+'</h2><div class="actions"><button data-md-import31>'+tr('Markdown 导入','Import Markdown')+'</button><button data-md-template31>'+tr('下载 Markdown 样板','Download template')+'</button><button data-settings-md-export>'+tr('Markdown 下载 / 导出','Export Markdown')+'</button></div></section>'+settingsResourceMarkup()+transferMarkup()+'<section class="settings-section"><h2>'+tr('安装与离线','Install & offline')+'</h2><p data-pwa-status role="status"></p><div class="actions"><button data-pwa-install></button><button data-pwa-check>检查应用新版本</button><button data-pwa-refresh hidden>'+tr('保存并更新应用','Save & update app')+'</button><button id="settingsOfflineGuide">'+tr('离线说明','Offline guide')+'</button></div><p class="hint" data-pwa-update-status role="status"></p></section><details class="settings-section"><summary>'+tr('高级工具','Advanced tools')+'</summary><p class="hint">'+tr('可编辑 HTML 副本包含程序、资料和已安装资源，适合独立离线留档。它使用独立资料空间，不与原 PWA 持续同步，也不会自动更新。日常备份或设备接力请使用上方完整 JSON。','An editable HTML copy bundles the app, materials and installed resources for standalone offline use. It has a separate workspace and does not sync or update with the PWA. Use the complete JSON above for routine backups and transfers.')+'</p><div class="actions"><button data-action="offlineCopy">'+tr('导出可编辑 HTML 副本','Export editable HTML copy')+'</button><button id="settingsBackupText">'+tr('备份文本','Backup text')+'</button><button class="danger-button" data-backup-clear>'+tr('清除本地数据','Clear local data')+'</button></div></details><footer class="settings-versions"><h2>'+tr('版本信息','Versions')+'</h2><dl>'+versions.map(([label,version])=>'<div><dt>'+esc(label)+'</dt><dd>v'+esc(version)+'</dd></div>').join('')+'</dl></footer></div>';
}
function openSettings(first=false,focusResources=false) {
  go3('settings');
  if(focusResources) $('#resourceSettings')?.scrollIntoView({block:'start'});
}
function bindSettingsControls() {
  bindTransferControls();
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
    try{
      if(file.size>12*1024*1024)throw new Error('资源文件超过 12 MB。');
      const text=await file.text(), parsed=JSON.parse(text.replace(/^\uFEFF/,''));
      if(parsed?.bank){
        if(['bank','book','quotes','examSchedule'].filter(key=>Object.hasOwn(parsed,key)).length!==1)throw new Error('JSON 必须且只能包含一种资源。');
        const clean=validateQuizBank(parsed), banks=listPracticeBanks(), existing=listImportedQuizPacks().find(item=>item.bank.id===clean.bank.id||item.bank.id==='local-pack-'+clean.bank.id);
        pendingQuizImport={text:JSON.stringify(clean),name:clean.bank.name,count:clean.questions.length};
        importTarget=existing?.targetBankId||banks.find(item=>item.bank.subject===clean.bank.subject&&item.bank.section===clean.bank.section)?.bank.id||banks[0]?.bank.id||'';
        settingsResourceStatus=tr('文件已校验，请选择目标题库并确认导入。','File validated. Choose a destination and confirm.');
      }else{
        const result=await importResourceJSON(parsed);pendingQuizImport=null;settingsResourceStatus=tr('已导入并保存到本机：','Imported and saved locally: ')+(result.book?.title||(result.examSchedule?tr('考试日程','Exam schedule'):tr('每日一句','Daily quotes')));
      }
    }
    catch(error){settingsResourceStatus=tr('导入失败，旧数据已保留：','Import failed; existing data kept: ')+error.message;}
    finally{ctx.busy=false;render();(pendingQuizImport?$('.quiz-import-preview'):$('#resourceSettings'))?.scrollIntoView({block:'start'});if(pendingQuizImport)$('#quizImportTarget')?.focus({preventScroll:true});}
  };
  const refreshResources=()=>{render();(pendingQuizImport?$('.quiz-import-preview'):$('#resourceSettings'))?.scrollIntoView({block:'start'});};
  const destination=$('#quizImportTarget');if(destination)destination.onchange=()=>{importTarget=destination.value;};
  const cancel=$('[data-bank-import-cancel]');if(cancel)cancel.onclick=()=>{pendingQuizImport=null;settingsResourceStatus=tr('已取消导入，未更改题目。','Import cancelled; questions are unchanged.');refreshResources();};
  const commit=$('[data-bank-import-confirm]');if(commit)commit.onclick=async()=>{
    if(ctx.busy||!pendingQuizImport)return;ctx.busy=true;commit.disabled=true;
    try{await importResourceJSON(pendingQuizImport.text,{targetBankId:importTarget});pendingQuizImport=null;settingsResourceStatus=tr('题目已导入所选题库并保存到本机。','Questions imported into the chosen bank and saved locally.');}
    catch(error){settingsResourceStatus=tr('导入失败，旧数据已保留：','Import failed; existing data kept: ')+error.message;}
    finally{ctx.busy=false;refreshResources();}
  };
  $('[data-bank-create]').onclick=async()=>{
    if(ctx.busy)return;const name=$('#practiceBankName').value.trim();if(!name)return toast(tr('请先填写题库名称。','Enter a bank name first.'));
    const [subject,section]=$('#practiceBankCategory').value.split(':');ctx.busy=true;
    try{const bank=await createPracticeBank({name,subject,section});importTarget=bank.id;settingsResourceStatus=tr('已新建题库：','Created bank: ')+bank.name;}
    catch(error){settingsResourceStatus=error.message;}finally{ctx.busy=false;refreshResources();}
  };
  $$('[data-pack-delete],[data-bank-delete]').forEach(button=>button.onclick=async()=>{
    if(ctx.busy)return;const bankId=button.dataset.bankDelete,packId=button.dataset.packDelete;
    if(!await confirmAction(tr(bankId?'删除自建题库？':'删除导入题目包？',bankId?'Delete this practice bank?':'Delete this question pack?'),tr(bankId?'将移除此题库及其中全部导入题目。已完成成绩、错题与收藏保留；默认题库不受影响。':'只删除这个题目包，其他题目不受影响。成绩、错题与收藏保留。','Only the selected bank/packs are removed. Results and learning marks are kept.'),tr('删除','Delete')))return;
    if(ctx.busy)return;ctx.busy=true;
    try{if(bankId)await deletePracticeBank(bankId);else await deleteImportedQuizPack(packId);settingsResourceStatus=tr('已删除，学习记录已保留。','Deleted; learning records kept.');}
    catch(error){settingsResourceStatus=tr('删除失败，原数据已保留：','Deletion failed; existing data kept: ')+error.message;}
    finally{ctx.busy=false;refreshResources();}
  });
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
  '</p><p>' + tr ('菜单 → 设置 → 保存与设备接力 → 导出完整 JSON。恢复时先校验、显示备份信息并确认；失败会保留原数据。', 'Menu → Settings → Save & move your data → Export complete JSON. Restores are validated and confirmed first; failures keep the original data.') +
  '</p><p>' + tr ('招生网站、百科与地图数据来源等外部链接需要联网。院校资料、地图、编辑、预览、导出与备份可离线使用。', 'External admissions websites, encyclopedias and source links need internet. Built-in university information, maps, editing, previews, exports and backups work offline.') +
  '</p><p>' + tr ('可编辑 HTML 副本仍会完整打包程序和资料，方便留档；它不是可安装的 PWA。JSON 是日常备份的推荐方式。', 'Editable HTML copies still bundle the app and your materials. Use JSON for routine backups; HTML copies are standalone documents.') +
  '</p><button id="closeOfflineGuide">' + tr ('关闭', 'Close') + '</button>';
  dialog.showModal ();
  $ ('#closeOfflineGuide').onclick = () => dialog.close ();
}
export { themeChoices, settingsPage, openSettings, openOfflineGuide, bindSettingsControls };
