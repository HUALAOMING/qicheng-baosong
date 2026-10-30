import {uiIcon53,enterPanel53} from '../ui53.js';
import {deviceSettings53,isLite53,saveDeviceSettings53} from '../runtime53.js';
import {tasks} from '../tasks.js';
import {parseTaskFile} from '../json-tasks.js';
import {prepareResourceImport,applyPreparedResourceImport,resourceImportSummary,listPracticeBankSummaries,listImportedQuizPackSummaries,listPracticeSubjects} from '../resources.js';
import {storageStatusMarkup521,bindStorageStatus521} from '../storage-status.js';
import {downloadQuizInstructions531,copyQuizBrief531} from '../ai-instructions52.js';
import {clearApplicationCache52} from '../local-files52.js';
import { $, $$, esc, tr, toast, download } from '../utils/helpers.js';
import { VERSION, UI_THEMES3 } from '../constants.js';
import { scheduleSave } from '../autosave.js';
import { clearAll, openBackupText } from '../backup.js';
import { render, go3, confirmAction } from '../app.js';
import { pwa } from '../pwa.js';
import { ctx } from '../state.js';
import { RESOURCE_EXAMPLES } from '../data.js';
import { getResourceVersions, importResourceJSON, updateResources, validateQuizBank, listPracticeBanks, listImportedQuizPacks, createPracticeBank, deletePracticeBank, deleteImportedQuizPack,moveImportedQuizPack } from '../resources.js';
import { bindMarkdown31 } from './markdown.js';
import { exportFile } from './export.js';
import { homeSettingsMarkup } from './home.js';
import {transferMarkup,bindTransferControls} from '../transfer.js';
let settingsResourceStatus = '';
let pendingQuizImport = null, importTarget = '';
function settingsBankSubjectFields531(prefix){
  return '<label class="field"><span>'+tr('科目（必选）','Subject (required)')+'</span><select id="'+prefix+'Subject531" required><option value="" selected disabled>'+tr('请选择科目','Choose a subject')+'</option>'+listPracticeSubjects().map(subject=>'<option value="'+esc(subject.id)+'">'+esc(subject.name)+(['english','chinese'].includes(subject.id)?' ('+esc(subject.id)+')':'')+'</option>').join('')+'<option value="new">'+tr('新建科目…','New subject…')+'</option></select></label><label class="field" id="'+prefix+'SubjectNameField531" hidden><span>'+tr('新科目名称','New subject name')+'</span><input id="'+prefix+'SubjectName531" maxlength="100" disabled placeholder="'+tr('例如：数学、历史','For example: Mathematics or History')+'"></label>';
}
function settingsBankSubjectValue531(prefix){
  const subject=$('#'+prefix+'Subject531').value,subjectName=$('#'+prefix+'SubjectName531').value.trim();
  if(!subject)throw new Error(tr('请选择题库科目。','Choose the bank subject.'));
  if(subject==='new'&&!subjectName)throw new Error(tr('请填写新科目名称。','Enter the new subject name.'));
  return {subject,subjectName};
}
function bindSettingsBankSubjects531(){
  for(const prefix of ['practiceBank','quizImportBank']){
    const select=$('#'+prefix+'Subject531');if(!select)continue;
    select.onchange=()=>{const isNew=select.value==='new',input=$('#'+prefix+'SubjectName531');$('#'+prefix+'SubjectNameField531').hidden=!isNew;input.disabled=!isNew;input.required=isNew;};
  }
}
function practiceLibraryMarkup() {
  const banks=listPracticeBankSummaries(),packs=listImportedQuizPackSummaries();
  if(!banks.some(item=>item.bank.id===importTarget))importTarget='';
  const options=selected=>'<option value="" disabled '+(!selected?'selected':'')+'>'+tr('请选择题库','Choose a bank')+'</option>'+banks.map(item=>'<option value="'+esc(item.bank.id)+'" '+(item.bank.id===selected?'selected':'')+'>'+esc(item.bank.name)+'</option>').join('');
  const preview=pendingQuizImport?'<div class="quiz-import-preview"><h3>'+tr('导入题目资源包','Import a question pack')+'</h3><p>'+esc(pendingQuizImport.name)+' · '+pendingQuizImport.count+tr(' 题',' questions')+'</p><label class="field"><span>'+tr('导入已有题库','Use an existing bank')+'</span><select id="quizImportTarget">'+options(importTarget)+'</select></label><div class="actions"><button class="primary" data-bank-import-confirm'+(!importTarget?' disabled':'')+'>'+tr('导入所选题库','Import into selected bank')+'</button><button data-bank-import-cancel>'+tr('取消','Cancel')+'</button></div><div class="import-create-bank"><label class="field"><span>'+tr('或以此题包建立新题库，名称为','Or create a new bank named')+'</span><input id="quizImportNewName" maxlength="200" value="'+esc(pendingQuizImport.name)+'"></label>'+settingsBankSubjectFields531('quizImportBank')+'<button data-bank-import-new>'+tr('以此题包建立新题库','Create a new bank from this pack')+'</button></div><p class="hint">'+tr('bank.id 识别题目包。相同 ID 再次导入会更新原题包并调整归属；不同 ID 可以合并到同一题库。','bank.id identifies the pack. Reimport updates that pack and its destination; different IDs can be combined in one bank.')+'</p></div>':'';
  return '<div class="quiz-library"><h3>'+tr('题库管理','Manage banks')+'</h3><p class="hint">'+tr('四个默认题库与用户新建题库同级。新建题库需选择科目，科目与练习筛选一致。题包是一组导入题目；导入后全部题目都归入所选题库，可统一管理和练习。','The four defaults and your banks are peers. Every new bank has a subject used by practice filters. Imported packs belong to their chosen bank and all their questions can be managed and practiced together.')+'</p><div class="resource-list">'+banks.map(item=>'<div><span>'+esc(item.bank.name)+' · '+(item.questionCount??item.questions?.length??0)+tr(' 题',' questions')+'</span>'+(item.origin==='custom'?'<button class="danger-button" data-bank-delete="'+esc(item.bank.id)+'">'+tr('删除题库','Delete bank')+'</button>':'<small>'+tr('默认题库','Default bank')+'</small>')+'</div>').join('')+'</div><details class="resource-guide"><summary>'+tr('新建独立题库','Create an independent bank')+'</summary><label class="field"><span>'+tr('题库名称','Bank name')+'</span><input id="practiceBankName" maxlength="200" placeholder="'+tr('例如：数学、时政、面试常识','For example: mathematics or interview practice')+'"></label>'+settingsBankSubjectFields531('practiceBank')+'<button data-bank-create>'+tr('新建题库','Create bank')+'</button></details>'+preview+(packs.length?'<h3>'+tr('已导入的题目资源包','Imported question packs')+'</h3><div class="resource-list">'+packs.map(item=>'<div class="resource-pack-row"><span>'+esc(item.bank.name)+' · '+(item.questionCount??item.questions?.length??0)+tr(' 题',' questions')+'</span><div class="resource-pack-controls"><select data-pack-target="'+esc(item.bank.id)+'" aria-label="'+esc(item.bank.name)+tr(' 的目标题库',' destination bank')+'">'+options(item.targetBankId)+'</select><button data-pack-move="'+esc(item.bank.id)+'">'+tr('移动','Move')+'</button><button class="danger-button" data-pack-delete="'+esc(item.bank.id)+'">'+tr('删除题包','Delete pack')+'</button></div></div>').join('')+'</div><p class="hint">'+tr('移动不会更改题目 ID，错题与收藏跟随题包。删除题包只移除题目，已完成成绩与学习标记保留。','Moving keeps question IDs and learning marks. Deleting removes questions while keeping completed results and marks.')+'</p>':'')+'</div>';
}
function themeChoices () {
  return '<div class="theme-cards theme-cards3">'+UI_THEMES3.map(([id,z,e,sub])=>'<button class="theme-card '+(ctx.state.theme===id?'chosen':'')+'" data-setting-theme="'+id+'" aria-pressed="'+(ctx.state.theme===id)+'"><span class="theme-sample sample-'+id+'"><b>Aa</b><i></i></span><strong>'+tr(z,e)+'</strong><small>'+sub+'</small></button>').join('')+'</div>';
}
function resourceGuideMarkup() {
  return '<details class="resource-guide"><summary>'+tr('如何导入题库、典籍和每日一句？','How to import resources')+'</summary><p>'+tr('选择本地 UTF-8 JSON 文件即可。系统根据顶层 bank、book、quotes 或 examSchedule 自动识别类型，校验成功后保存在本机并立即加入对应页面；整个导入过程可以离线完成，无需 AI 服务、账号或额外联网。','Choose a local UTF-8 JSON. The bank, book, quotes or examSchedule field identifies the type. Valid files are stored locally and appear immediately, entirely offline.')+'</p><ul><li><b>bank</b>：'+tr('题包包含 bank（id、name、subject、section、version）和 questions。subject 为 english / chinese 时，section 分别为 grammar / vocabulary、ancient-culture / chinese-usage；其他学科可用 subject: custom、section: custom；导入时选择题库，科目以目标题库为准。单选 type 为 single-choice，options 是 {id,text} 数组，answer 必须匹配选项 ID；判断 type 为 true-false，answer 是布尔值 true / false。','A question pack contains bank metadata (id, name, subject, section, version) and questions. Its destination bank defines the subject used in filters. Single choices use option IDs; true/false answers use JSON booleans.')+'</li><li><b>book</b>：'+tr('典籍含 id、title、version；passages 每段有稳定 id、text 原文，可附 chapter 篇目和 explanation 简释。用 lunyu / daodejing / zhuangzi 可填充预留入口；其他新 ID 会自动增加新的典籍入口。','A book has id, title and version; passages have stable IDs and text, with optional chapter/explanation. New book IDs automatically add study pages.')+'</li><li><b>quotes</b>：'+tr('每日一句含 version 和 quotes 数组；每句有 id、text，可附 source。可同时填写 bookId、passageId，链接到已安装典籍的同 ID 段落。导入后成为自定义每日一句，按本地日期每天固定显示一条。','Quotes have stable IDs, text and optional source. Optional bookId/passageId link to an installed passage. A local date chooses the same quote all day.')+'</li><li><b>examSchedule</b>：'+tr('考试日程含 version 和 examSchedule 数组。每项有稳定 id、schoolId、schoolName、date（YYYY-MM-DD）、stage（written 笔试 / interview 面试）；可选 startTime、endTime（HH:mm）、location、note。同一学校同日的笔试、面试分别一项，schoolId 相同；日历按院校去重计数。导入后更新考试信息页。','Schedules have version and an examSchedule array. Each event has id, schoolId, schoolName, date (YYYY-MM-DD) and stage (written/interview); optional startTime/endTime (HH:mm), location and note. A school’s stages share schoolId and count as one university per day.')+'</li></ul><p>'+tr('四种格式都要求 schemaVersion: 1；version 用 1.0.0 形式；ID 使用字母、数字、点、下划线或连字符，同一文件内不得重复。题库 JSON 先选择目标题库，再确认导入。bank.id 识别题目包，相同 ID 再次导入会比较差异并仅写入变化的题目，不同 ID 合并进入所选题库。题目 ID 在各自题目包内保持稳定即可，跨文件同名不会冲突。原有导入题目自动归入对应默认题库，错题和收藏继续保留。典籍相同 ID 再次导入仍替换原资源。每日一句导入会替换原自定义句库。建议每组至少 10 或 20 题。单个文件最多 12 MB。单题补丁使用 {schemaVersion:1, patch:{bankId, questions:[{id,set:{explanation:"新的解析"}}]}}；只修改 set 中明确指定的字段，提交前展示变化摘要。','All formats require schemaVersion 1, semantic versions and unique stable IDs. Choose a destination bank for each quiz JSON. bank.id identifies its pack: reimport replaces that pack, while different packs are combined. Stable IDs preserve learning marks. Each file is limited to 12 MB.')+'</p><p>'+tr('自定义题库、典籍、每日一句和考试日程均进入完整 JSON 备份。失败的文件会显示原因并保留旧数据。不要把启程备份文件当成资源导入。','Custom resources enter full backups. Failed imports keep existing data. A personal backup is not a resource file.')+'</p><div class="actions"><button data-resource-sample="quiz">'+tr('下载题库 JSON 样例','Quiz JSON sample')+'</button><button data-resource-sample="independentQuiz">'+tr('下载通用题包 JSON 样例','Independent question-pack sample')+'</button><button data-resource-sample="classic">'+tr('下载典籍 JSON 样例','Classic JSON sample')+'</button><button data-resource-sample="quotes">'+tr('下载每日一句 JSON 样例','Quotes JSON sample')+'</button><button data-resource-sample="schedule">'+tr('下载考试日程 JSON 样例','Exam schedule JSON sample')+'</button><button data-resource-sample="ai">'+tr('下载AI指令md文档','Download AI instructions (.md)')+'</button><button data-resource-sample="ai-brief">'+tr('复制AI说明','Copy AI brief')+'</button></div><p>'+tr('下载的md文档包含完整格式、题型和校验要求。将文档、样例和资料一起交给AI；“复制AI说明”只提供简短背景，粘贴后补充主题、题量、难度与来源。AI生成后请核对原文与答案，再导入启程。','The downloaded Markdown contains full format and validation requirements. Attach it with your sample and materials. Copy AI brief provides short context; add your topic, count, difficulty and sources, then verify generated questions before importing.')+'</p></details>';
}
function settingsResourceMarkup() {
  const v=getResourceVersions();
  return '<section class="settings-section" id="resourceSettings"><h2>'+tr('题库与资源','Banks & resources')+'</h2><p class="hint">'+tr('只有主动点击在线获取才访问资源更新清单。已安装资源永久保存在本机，可完全离线使用。','Resource updates run only when requested. Installed resources remain available offline.')+'</p><div class="resource-list">'+'<div><span>'+tr('中华文化典籍','Chinese classics')+'</span><span>'+v.classics.length+tr(' 部入口',' study pages')+'</span></div><div><span>'+tr('每日一句','Daily quotes')+'</span><span>'+(v.quotes?.count||0)+tr(' 句',' quotes')+'</span></div><div><span>'+tr('院校考试日程','University examinations')+'</span><span>'+(v.examSchedule?.count||0)+tr(' 项安排',' events')+'</span></div></div><div class="actions"><button data-resource-import>'+tr('导入本地 JSON','Import local JSON')+'</button><button class="primary" data-resource-update>'+tr('在线获取最新版资源','Get latest resources online')+'</button></div><input type="file" id="resourceJSONInput" accept=".json,application/json" hidden><p id="resourceResult" class="hint" role="status">'+esc(settingsResourceStatus)+'</p>'+practiceLibraryMarkup()+resourceGuideMarkup()+'</section>';
}
function settingsPage() {
  const v=getResourceVersions();
  const versions=[['启程系统','v'+VERSION],...v.banks.filter(b=>['english-grammar','english-vocabulary','chinese-ancient-culture','chinese-usage'].includes(b.id)).map(b=>[b.name+tr(' · 最新更新',' · Updated'),b.updatedAt?new Date(b.updatedAt).toLocaleDateString(ctx.state.uiLang==='en'?'en':'zh-CN',{timeZone:'Asia/Shanghai'}):tr('未提供更新时间','Update date unavailable')])];
  return '<div class="settings-page"><header class="explore-heading"><p class="eyebrow">QICHENG / SETTINGS</p><h1>'+tr('设置','Settings')+'</h1><p>'+tr('外观、资源与资料备份，集中在这里。','Appearance, resources and backups in one place.')+'</p></header><section class="settings-section"><h2>'+tr('外观与语言','Appearance & language')+'</h2>'+themeChoices()+'<label class="field"><span>'+tr('界面语言','Interface language')+'</span><select id="uiLanguage"><option value="zh" '+(ctx.state.uiLang==='zh'?'selected':'')+'>中文</option><option value="en" '+(ctx.state.uiLang==='en'?'selected':'')+'>English</option></select></label><p class="hint">'+tr('修改内容、文件和设置时自动保存；切换页面、菜单和临时标签不会触发保存。','Content, files and settings save automatically; navigation and temporary tabs do not.')+'</p></section>'+homeSettingsMarkup()+'<section class="settings-section"><h2>'+tr('Markdown 数据工具','Markdown tools')+'</h2><div class="actions"><button data-md-import31>'+tr('Markdown 导入','Import Markdown')+'</button><button data-md-template31>'+tr('下载 Markdown 样板','Download template')+'</button><button data-settings-md-export>'+tr('Markdown 下载 / 导出','Export Markdown')+'</button></div></section>'+settingsResourceMarkup()+storageStatusMarkup521()+transferMarkup()+'<section class="settings-section"><h2>'+tr('安装与离线','Install & offline')+'</h2><p data-pwa-status role="status"></p><div class="actions"><button data-pwa-install></button><button data-pwa-check>检查应用新版本</button><button data-pwa-refresh hidden>'+tr('保存并更新应用','Save & update app')+'</button><button id="settingsOfflineGuide">'+tr('离线说明','Offline guide')+'</button></div><p class="hint" data-pwa-update-status role="status"></p></section><details class="settings-section"><summary>'+tr('高级工具','Advanced tools')+'</summary><p class="hint">'+tr('可编辑 HTML 副本包含程序、资料和已安装资源，适合独立离线留档。它使用独立资料空间，不与原 PWA 持续同步，也不会自动更新。日常备份或设备接力请使用上方完整 JSON。','An editable HTML copy bundles the app, materials and installed resources for standalone offline use. It has a separate workspace and does not sync or update with the PWA. Use the complete JSON above for routine backups and transfers.')+'</p><div class="actions"><button data-action="offlineCopy">'+tr('导出可编辑 HTML 副本','Export editable HTML copy')+'</button><button id="settingsBackupText">'+tr('备份文本','Backup text')+'</button><button data-cache-clear52>'+tr('清除程序缓存','Clear application cache')+'</button><button class="danger-button" data-backup-clear>'+tr('清除本地数据','Clear local data')+'</button></div></details><footer class="settings-versions"><h2>'+tr('版本信息','Versions')+'</h2><dl>'+versions.map(([label,version])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(version)+'</dd></div>').join('')+'</dl></footer></div>';
}
function openSettings(first=false,focusResources=false) {
  if(focusResources)settingsCategory53='learning';
  go3('settings');
  if(focusResources) $('#resourceSettings')?.scrollIntoView({block:'start'});
}
function bindSettingsControls() {
  bindStorageStatus521();
  bindTransferControls();
  bindSettingsNavigation53();
  bindSettingsBankSubjects531();
  $$('[data-setting-theme],[data-theme-choice]').forEach(b=>b.onclick=()=>{
    const theme=b.dataset.settingTheme||b.dataset.themeChoice;
    if(ctx.busy||ctx.state.theme===theme)return;
    ctx.state.theme=theme; scheduleSave(); render();
  });
  const language=$('#uiLanguage');if(language)language.onchange=()=>{if(ctx.busy||ctx.state.uiLang===language.value)return;ctx.state.uiLang=language.value;scheduleSave();render();};
  if(!$('#resourceSettings'))return;
  bindMarkdown31();
  $('[data-settings-md-export]').onclick=()=>exportFile('md');
  $('[data-backup-clear]').onclick=clearAll;$('[data-cache-clear52]').onclick=clearApplicationCache52;$('#settingsBackupText').onclick=openBackupText;$('#settingsOfflineGuide').onclick=openOfflineGuide;
  $('[data-resource-import]').onclick=()=>{if(!ctx.busy)$('#resourceJSONInput').click();};
  $('#resourceJSONInput').onchange=async event=>{
    const file=event.target.files[0];if(!file||ctx.busy)return;ctx.busy=true;
    const task=tasks.start('预检题库与资源文件');
    try{
      if(file.size>12*1024*1024)throw new Error('资源文件超过 12 MB。');
      const parsed=await parseTaskFile(file,task);task.stage('验证数据与检测冲突');
      if(parsed?.patch){
        const plan=await prepareResourceImport(parsed);task.succeed('补丁校验完成，等待确认。');
        ctx.busy=false;
        if(await confirmAction('确认题库补丁更新？',resourceImportSummary(plan),'应用补丁')){ctx.busy=true;await applyPreparedResourceImport(plan);settingsResourceStatus='补丁已提交，仅修改指定字段，学习记录已保留。';}
        else settingsResourceStatus='已取消补丁，原数据未更改。';
      }else if(parsed?.bank){
        if(['bank','book','quotes','examSchedule'].filter(key=>Object.hasOwn(parsed,key)).length!==1)throw new Error('JSON 必须且只能包含一种资源。');
        const clean=validateQuizBank(parsed), banks=listPracticeBankSummaries(), existing=listImportedQuizPackSummaries().find(item=>item.bank.id===clean.bank.id||item.bank.id==='local-pack-'+clean.bank.id);
        const preview=await prepareResourceImport(clean);
        pendingQuizImport={text:JSON.stringify(clean),name:clean.bank.name,count:clean.questions.length,summary:resourceImportSummary(preview)};
        importTarget=existing?.targetBankId||(clean.bank.subject==='custom'?'':banks.find(item=>item.origin!=='custom'&&item.bank.subject===clean.bank.subject&&item.bank.section===clean.bank.section)?.bank.id)||'';
        settingsResourceStatus=tr('文件已校验，请选择目标题库并确认导入。','File validated. Choose a destination and confirm.');
      }else{
        const result=await importResourceJSON(parsed);pendingQuizImport=null;settingsResourceStatus=tr('已导入并保存到本机：','Imported and saved locally: ')+(result.book?.title||(result.examSchedule?tr('考试日程','Exam schedule'):tr('每日一句','Daily quotes')));
      }
    }
    catch(error){task.fail(error);settingsResourceStatus=tr('导入失败，格式可能存在错误，旧数据已保留。请核对 JSON 格式、题型与答案字段：','Import failed. The format may be incorrect; existing data is kept. Check JSON, question types and answers: ')+error.message;}
    finally{if(task.state.status==='running')task.succeed('预检完成，等待确认或已提交资源。');ctx.busy=false;render();(pendingQuizImport?$('.quiz-import-preview'):$('#resourceSettings'))?.scrollIntoView({block:'start'});if(pendingQuizImport)$('#quizImportTarget')?.focus({preventScroll:true});}
  };
  const refreshResources=()=>{render();(pendingQuizImport?$('.quiz-import-preview'):$('#resourceSettings'))?.scrollIntoView({block:'start'});};
  const destination=$('#quizImportTarget');if(destination)destination.onchange=()=>{importTarget=destination.value;const confirm=$('[data-bank-import-confirm]');if(confirm)confirm.disabled=!importTarget;};
  const cancel=$('[data-bank-import-cancel]');if(cancel)cancel.onclick=()=>{pendingQuizImport=null;settingsResourceStatus=tr('已取消导入，未更改题目。','Import cancelled; questions are unchanged.');refreshResources();};
  const commit=$('[data-bank-import-confirm]');if(commit)commit.onclick=async()=>{
    if(ctx.busy||!pendingQuizImport)return;ctx.busy=true;commit.disabled=true;
    try{const plan=await prepareResourceImport(pendingQuizImport.text,{targetBankId:importTarget});ctx.busy=false;if(!await confirmAction('确认题库变化？',resourceImportSummary(plan),'提交更新'))return;ctx.busy=true;await applyPreparedResourceImport(plan);pendingQuizImport=null;settingsResourceStatus=tr('题目已导入所选题库并保存到本机。','Questions imported into the chosen bank and saved locally.');}
    catch(error){settingsResourceStatus=tr('导入失败，格式可能存在错误，旧数据已保留。请核对 JSON 格式、题型与答案字段：','Import failed. The format may be incorrect; existing data is kept. Check JSON, question types and answers: ')+error.message;}
    finally{ctx.busy=false;refreshResources();}
  };
  $('[data-bank-create]').onclick=async()=>{
    if(ctx.busy)return;const name=$('#practiceBankName').value.trim();if(!name)return toast(tr('请先填写题库名称。','Enter a bank name first.'));
    let subject;try{subject=settingsBankSubjectValue531('practiceBank');}catch(error){return toast(error.message);}
    ctx.busy=true;
    try{const bank=await createPracticeBank({name,...subject});importTarget=bank.id;settingsResourceStatus=tr('已新建题库：','Created bank: ')+bank.name;}
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
  const fromPack=$('[data-bank-import-new]');if(fromPack)fromPack.onclick=async()=>{
    if(ctx.busy||!pendingQuizImport)return;const name=$('#quizImportNewName').value.trim();if(!name)return toast(tr('请填写新题库名称。','Enter a bank name.'));
    let selection;try{selection=settingsBankSubjectValue531('quizImportBank');}catch(error){return toast(error.message);}
    ctx.busy=true;fromPack.disabled=true;
    try{const plan=await prepareResourceImport(pendingQuizImport.text,{newBankName:name,newBankSubject:selection.subject,newBankSubjectName:selection.subjectName});ctx.busy=false;if(!await confirmAction('确认新建并导入？',resourceImportSummary(plan),'提交导入'))return;ctx.busy=true;await applyPreparedResourceImport(plan);pendingQuizImport=null;settingsResourceStatus=tr('已建立独立题库并导入题目：','Created bank and imported questions: ')+name;}
    catch(error){settingsResourceStatus=tr('导入失败，格式可能存在错误，旧数据已保留。请核对 JSON 格式、题型与答案字段：','Import failed. The format may be incorrect; existing data is kept. Check JSON, question types and answers: ')+error.message;}
    finally{ctx.busy=false;refreshResources();}
  };
  $$('[data-pack-move]').forEach(button=>button.onclick=async()=>{
    if(ctx.busy)return;const id=button.dataset.packMove,target=$('[data-pack-target="'+id+'"]').value;ctx.busy=true;button.disabled=true;
    try{const changed=await moveImportedQuizPack(id,target);settingsResourceStatus=changed?tr('题包已移动，错题和收藏保留。','Pack moved; learning marks kept.'):tr('题包已在这个题库中。','The pack is already in this bank.');}
    catch(error){settingsResourceStatus=tr('移动失败，原归属已保留：','Move failed; original destination kept: ')+error.message;}
    finally{ctx.busy=false;refreshResources();}
  });
  $('[data-resource-update]').onclick=async()=>{
    if(ctx.busy)return;ctx.busy=true;$('[data-resource-update]').disabled=true;$('[data-resource-import]').disabled=true;$('#resourceResult').textContent=tr('正在获取并校验资源…','Downloading and validating resources…');
    try{const result=await updateResources(undefined,{confirm:async summaries=>confirmAction('确认资源更新？',summaries.join('\n\n'),'提交更新')});settingsResourceStatus=result.updated.length?tr('已更新并保存到本机：','Updated and saved locally: ')+result.updated.join('、'):tr('已安装资源均为最新版本。','Installed resources are up to date.');}
    catch(error){settingsResourceStatus=tr('更新失败，旧版资源已保留：','Update failed; existing resources kept: ')+error.message;}
    finally{ctx.busy=false;render();$('#resourceSettings')?.scrollIntoView({block:'start'});}
  };
  $$('[data-resource-sample]').forEach(b=>b.onclick=()=>{
    const kind=b.dataset.resourceSample;if(kind==='ai')return downloadQuizInstructions531();if(kind==='ai-brief')return copyQuizBrief531();
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

let settingsCategory53='appearance';
const settingsCategories53=[['appearance','外观与界面'],['navigation','启动与导航'],['storage','数据与存储'],['learning','学习与答题'],['updates','更新与离线'],['about','关于启程']];
function selectSettingsCategory53(category){
 const position={top:globalThis.scrollY||0,left:globalThis.scrollX||0,behavior:'instant'};
 if(!settingsCategories53.some(([key])=>key===category))return;settingsCategory53=category;
 document.querySelectorAll('[data-settings-panel53]').forEach(node=>node.hidden=node.dataset.settingsPanel53!==category);
 document.querySelectorAll('[data-settings-category53]').forEach(node=>{if(node.dataset.settingsCategory53===category)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
 // Keep navigation in place; scrolling and translating the whole panel felt like a page jump.
 const panel=document.querySelector('[data-settings-panel53="'+category+'"]');
 panel?.getAnimations?.().forEach(animation=>animation.cancel());
 if(panel&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)panel.animate?.([{opacity:.85},{opacity:1}],{duration:120,easing:'ease-out'});
 globalThis.scrollTo?.(position);
}
function bindSettingsNavigation53(){
 const root=document.querySelector('.settings-page');if(!root||!root.children||root.querySelector('.settings-layout53'))return;root.classList.add('settings-page53');
 const children=[...root.children].filter(node=>node.tagName!=='HEADER'),layout=document.createElement('div'),nav=document.createElement('nav'),pane=document.createElement('div');layout.className='settings-layout53';nav.className='settings-nav53';nav.setAttribute('aria-label','设置分类');pane.className='settings-pane53';pane.id='settingsPane53';
 const panels=new Map(settingsCategories53.map(([key])=>{const node=document.createElement('div');node.dataset.settingsPanel53=key;pane.append(node);return[key,node];}));
 children.forEach((node,index)=>{let category='storage';if(index===0)category='appearance';else if(node.id==='homeSettings')category='navigation';else if(node.id==='resourceSettings')category='learning';else if(node.querySelector('[data-pwa-status]'))category='updates';else if(node.classList.contains('settings-versions'))category='about';panels.get(category).append(node);});
 for(const [key,label]of settingsCategories53){const button=document.createElement('button');button.type='button';button.dataset.settingsCategory53=key;button.innerHTML=uiIcon53({appearance:'palette',navigation:'navigation',storage:'storage',learning:'learning',updates:'updates',about:'about'}[key])+'<span>'+label+'</span>';button.onclick=()=>selectSettingsCategory53(key);nav.append(button);}
 const appearance=document.createElement('section');appearance.className='settings-section';appearance.innerHTML='<h2>运行模式</h2><label class="field"><span>当前设备偏好</span><select id="runMode53"><option value="auto">自动选择</option><option value="full">完整版</option><option value="lite">精简版</option></select></label><p class="hint">当前为'+(isLite53()?'精简版':'完整版')+'。偏好仅保存在当前设备，不随跨设备备份传递；空间不足时编辑器提供只读审阅。</p>';panels.get('appearance').append(appearance);
 const navigation=document.createElement('section');navigation.className='settings-section';navigation.innerHTML='<h2>启动与首页</h2><label class="field"><span>默认启动页面</span><select id="startRoute53"><option value="home">首页</option><option value="quiz">练习中心</option><option value="resumes">简历管理中心</option><option value="reading">阅读扩展</option><option value="learning-review">错题与收藏</option></select></label><label class="check"><input id="homeCards53" type="checkbox">显示首页学习状态卡片</label>';panels.get('navigation').prepend(navigation);
 const learning=document.createElement('section');learning.className='settings-section';learning.innerHTML='<h2>默认练习偏好</h2><label class="field"><span>默认每组题数（1—200）</span><input id="defaultPractice53" type="number" min="1" max="200" step="1"></label><p class="hint">每组开始前仍可临时调整题数，不改变已开始的练习。</p><button data-go3="question-bank">打开题库管理</button>';panels.get('learning').prepend(learning);
 const about=document.createElement('section');about.className='settings-section';about.innerHTML='<h2>关于启程</h2><p>启程是一方陪伴你走向梦想的学习与成长工作台：在这里整理经历、打磨简历、记录阅读与练习，也把心仪的院校放在目光所及之处。资料保存在自己的设备上，离线时也能安心积累，让每一次认真都有迹可循，让每一分努力都有处安放。愿你不因路远而迟疑，不因步小而停歇，带着好奇与勇气，奔赴属于自己的辽阔。加油，下一程的风景，正等你亲自抵达。</p><button id="aboutOffline53">离线与数据说明</button>';panels.get('about').prepend(about);
 const updates=document.createElement('p');updates.className='hint';updates.textContent='当前版本 '+VERSION+' · 更新日志：5.3.1 理顺科目、题库与题包归属；整合练习统计，恢复AI指令md下载；新增简历字段换行与两套完整配色模板。';panels.get('updates').append(updates);
 layout.append(nav,pane);root.append(layout);
 const mode=root.querySelector('#runMode53'),start=root.querySelector('#startRoute53'),count=root.querySelector('#defaultPractice53'),cards=root.querySelector('#homeCards53');mode.value=deviceSettings53.mode;start.value=deviceSettings53.startRoute;count.value=deviceSettings53.practiceSize;cards.checked=deviceSettings53.homeCards;
 const change=(node,patch)=>{node.onchange=async()=>{node.disabled=true;try{await saveDeviceSettings53(patch());render();}catch(error){toast(error.message);node.disabled=false;}};};change(mode,()=>({mode:mode.value}));change(start,()=>({startRoute:start.value}));change(count,()=>({practiceSize:Number(count.value)}));change(cards,()=>({homeCards:cards.checked}));root.querySelector('#aboutOffline53').onclick=openOfflineGuide;
 selectSettingsCategory53(settingsCategory53);
}
export {selectSettingsCategory53,settingsCategories53};
