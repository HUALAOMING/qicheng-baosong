import { scheduleSave, save, cancelPendingSave, initializeSaving301, updateSaveStatus301 } from './autosave.js';
import { ctx } from './state.js';
import { VERSION } from './constants.js';
import { storage } from './storage.js';
import { clone, $, download, toast, tr, uid } from './utils/helpers.js';
import { validateDraft, assertJSON } from './utils/validation.js';
import { fresh, snapshot3, photoRefs3, synchronizeEditing } from './model.js';
import { confirmAction, render, resetViewMemory50 } from './app.js';
import { resourceFetch } from './data.js';
import { validateResourceRecords, reloadResources, waitForResourceWrites } from './resources.js';
import { validateQuizRecords, initializeQuiz, waitForQuizWrites,getQuizDraftRecord,QUIZ_DRAFT_KEY,flushQuizDraft,hasPendingQuizWrites } from './modules/quiz.js';
import { validateHomeRecords, initializeHome, waitForHomeWrites } from './modules/home.js';
import {validateJournalRecords,initializeJournal,waitForJournalWrites} from './modules/journal.js';
import {initializeExamCalendar,validateExamCalendarRecords,waitForExamCalendarWrites} from './modules/exam-calendar.js';
import {resetIntroductions52} from './modules/introductions.js';
const BACKUP_VERSION = 1;
let manualSavePending = null;
function saveAllLocal() {
  if (manualSavePending) return manualSavePending;
  manualSavePending = (async () => {
    if (ctx.persistencePaused || ctx.uploadBusy) throw new Error('请等待当前文件或数据操作完成后再保存。');
    // Attach to independent writes now, so a rejection while current is saving
    // cannot disappear from a queue before we observe it.
    const [saved] = await Promise.all([save(),waitForQuizWrites(),waitForHomeWrites(),waitForResourceWrites(),waitForJournalWrites(),waitForExamCalendarWrites()]);
    if (!saved) throw new Error('本机资料未能保存，请导出完整 JSON 备份。');
    // Edits made while another queue was completing must also reach the database.
    if (ctx.dirty301 && !await save()) throw new Error('最新修改未能保存，请导出完整 JSON 备份。');
    if (hasPendingQuizWrites()) await waitForQuizWrites();
    if (ctx.dirty301 || hasPendingQuizWrites()) throw new Error('仍有新修改正在保存，请稍后再次确认。');
    return true;
  })().finally(() => { manualSavePending = null; });
  return manualSavePending;
}
function compactSnapshot (draft) {
  const copy = clone (draft);
  for (const photo of photoRefs3 (copy)) if (photo.assetId && copy.assets.some (a => a.id === photo.assetId)) delete photo.data;
  return copy;
}
function createBackup (snapshot, otherRecords = {
}) {
  const current = compactSnapshot (validateDraft (snapshot));
  for (const key of ['route', 'section', 'step', 'sidebarHidden', 'menuOpen']) delete current[key];
  const data = {
    ...backupUserRecords (otherRecords), current
  };
  assertJSON (data);
  Object.assign (data, validateResourceRecords (data));
  validateQuizRecords (data); validateHomeRecords (data); validateJournalRecords(data); validateExamCalendarRecords(data);
  return {
    app : 'Qicheng', backupVersion : BACKUP_VERSION, appVersion : VERSION, createdAt : new Date ().toISOString (), data
  };
}
function backupUserRecords (records) {
  return Object.fromEntries (Object.entries (clone (records)).filter (([key]) => !key.startsWith ('resource:official:') && key !== '__seedCleared' && !key.startsWith('meta:') && !key.startsWith('session:')));
}
function parseBackup (input) {
  let backup;
  try {
    backup = typeof input === 'string' ? JSON.parse (input.replace (/^\uFEFF/, '')) : clone (input);
  }
  catch {
    throw new Error ('JSON 无法解析，文件可能已损坏。');
  }
  if (! backup || typeof backup !== 'object' || Array.isArray (backup) || backup.app !== 'Qicheng') throw new Error ('这不是有效的启程备份文件。');
  if (backup.backupVersion !== BACKUP_VERSION) throw new Error ('不支持此 backupVersion。当前仅支持版本 1。');
  if (typeof backup.appVersion !== 'string' || ! backup.appVersion || typeof backup.createdAt !== 'string' || ! Number.isFinite (Date.parse (backup.createdAt))) throw new Error ('备份缺少有效的应用版本或备份时间。');
  if (! backup.data || typeof backup.data !== 'object' || Array.isArray (backup.data) || ! backup.data.current) throw new Error ('备份缺少必要的用户数据。');
  assertJSON (backup.data);
  Object.assign (backup.data, validateResourceRecords (backup.data));
  validateQuizRecords (backup.data); validateHomeRecords (backup.data); validateJournalRecords(backup.data); validateExamCalendarRecords(backup.data);
  const draft = validateDraft (backup.data.current);
  return {
    backup, draft
  };
}
function backupSummary (backup, draft) {
  return tr ('备份时间：', 'Created: ') + new Date (backup.createdAt).toLocaleString (ctx.state.uiLang === 'en' ? 'en' : 'zh-CN') +
  '\n' + tr ('应用版本：', 'App version: ') + backup.appVersion + '\n\n' + tr ('包含：', 'Contains: ') + '\n' + tr ('个人信息、教育、陈述与语言成绩',
  'Profile, education, statements and languages') + '\n' + tr ('荣誉 / 经历 / 实践 / 成果：', 'Awards / experience / practice / projects: ') +
  [draft.awards.length, draft.experiences.length, draft.practices.length, draft.achievements.length].join (' / ') +
  '\n' + tr ('考试 / 阅读 / 自定义内容：', 'Exams / books / custom blocks: ') + [draft.exams.length, draft.learning.books.length,
  draft.customBlocks.length].join (' / ') + '\n' + tr ('文档版本 / 院校收藏：', 'Documents / dream universities: ') + draft.versions.length +
  ' / ' + draft.dreamSchools.length + '\n' + tr ('图片、文件与已导出文档：', 'Images, files and generated exports: ') + draft.assets.length +
  '\n' + tr ('设置、学习笔记、所有编辑草稿和导出历史。', 'Settings, study notes, all editing drafts and export history.') + '\n\n' + tr ('恢复将完整替换当前本机数据。',
  'Restoring replaces all current local data.');
}
async function getCurrentBackup () {
  await Promise.all ([ctx.saveChain, waitForResourceWrites (), waitForQuizWrites ().catch(()=>{}), waitForHomeWrites (), waitForJournalWrites(),waitForExamCalendarWrites()]);
  const other = await storage.getAll ();
  const quizDraft=getQuizDraftRecord();if(quizDraft)other[QUIZ_DRAFT_KEY]=quizDraft;else delete other[QUIZ_DRAFT_KEY];
  return createBackup (snapshot3 (), other);
}
function backupFilename () {
  const d = new Date ();
  const day = [d.getFullYear (), String (d.getMonth () + 1).padStart (2, '0'), String (d.getDate ()).padStart (2, '0')].join ('-');
  return 'Qicheng_Backup_' + day + '.json';
}
async function exportBackup () {
  if (ctx.busy || ctx.uploadBusy) return;
  try {
    let saved=true;
    try { await saveAllLocal(); } catch { saved=false; }
    const backup = await getCurrentBackup ();
    download (JSON.stringify (backup, null, 2), 'application/json;charset=utf-8', backupFilename ());
    if(!saved)toast(tr('本机保存尚未完成，JSON 已包含当前可读取的资料和答案草稿，请妥善保存文件。','Local saving is incomplete. This JSON includes the readable current materials and answer draft; keep the file safely.'));
  }
  catch (error) {
    toast (tr ('无法生成备份：', 'Unable to back up: ') + error.message);
  }
}
function resetTransientState () {
  resetViewMemory50();
  resetIntroductions52();
  ctx.schoolQuery = '';
  ctx.onlyDreams = false;
  ctx.schoolRegion3 = '';
  ctx.activeProvince31 = '';
  ctx.assetSearch3 = '';
  ctx.layoutCache = null;
  ctx.previewToken ++;
  clearTimeout (ctx.previewDebounce);
  if (ctx.previewObjectURL) {
    URL.revokeObjectURL (ctx.previewObjectURL);
    ctx.previewObjectURL = null;
  }
  document.body.classList.remove ('nav-mobile-open');
  synchronizeEditing ();
}
async function commitBackup(input) {
  const parsed = parseBackup(input);
  if (ctx.busy || ctx.uploadBusy) throw new Error('请等待当前操作完成后再恢复。');
  ctx.busy = true; ctx.persistencePaused = true; document.body.inert = true;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.inert = true;
  cancelPendingSave();
  const previous = clone(ctx.state);
  try {
    const records = backupUserRecords (parsed.backup.data);
    parsed.draft.route = 'home'; parsed.draft.section = 'resume'; parsed.draft.step = 0;
    parsed.draft.sidebarHidden = true; parsed.draft.menuOpen = ['start'];
    records.current = compactSnapshot(parsed.draft);
    try {
      await Promise.all ([ctx.saveChain, waitForResourceWrites (), waitForQuizWrites (), waitForHomeWrites (), waitForJournalWrites(),waitForExamCalendarWrites()]);
      const installed = await storage.getAll ();
      for (const [key, value] of Object.entries (installed)) if (key.startsWith ('resource:official:')) records[key] = value;
      records['meta:device']={lastImportedAt:new Date().toISOString(),lastSavedAt:new Date().toISOString(),sourceCreatedAt:parsed.backup.createdAt,sourceAppVersion:parsed.backup.appVersion};
      await storage.replaceAll(records);
    } catch (error) {
      ctx.state = previous; updateSaveStatus301();
      throw new Error('恢复失败，原数据已保留：' + error.message);
    }
    // The transaction has committed; a display error must not masquerade as a failed restore.
    ctx.state = parsed.draft;
    try {
      await reloadResources (); await Promise.all ([initializeQuiz (records), initializeHome (records),initializeJournal(records),initializeExamCalendar(records)]);
      resetTransientState(); initializeSaving301(records.current);
    }
    catch { location.reload(); }
    return true;
  } finally {
    ctx.busy = false; ctx.persistencePaused = false; document.body.inert = false;
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.inert = false;
    if (ctx.dirty301) scheduleSave();
    flushQuizDraft().catch(()=>{});
  }
}
async function restoreBackup (event) {
  const file = event?.target?.files?.[0];
  if (! file) return;
  const transferRequested=!!ctx.transferImportRequested;ctx.transferImportRequested=false;
  try {
    if (ctx.busy || ctx.uploadBusy) throw new Error ('请等待当前操作完成。');
    const parsed = parseBackup (await file.text ());
    if (! await confirmAction (tr ('从备份恢复？', 'Restore this backup?'), backupSummary (parsed.backup, parsed.draft), tr ('恢复',
    'Restore'))) return;
    await commitBackup (parsed.backup);
    if(transferRequested)ctx.state.route='settings';
    for (const dialog of document.querySelectorAll ('dialog[open]')) dialog.close ();
    try {
      render ();
      if(transferRequested)$('#transferSettings')?.scrollIntoView({block:'start'});
      toast (tr ('全部数据已恢复', 'All data restored'));
    }
    catch {
      location.reload ();
    }
    return true;
  }
  catch (error) {
    toast (error.message);
  }
  finally {
    if (event?.target) event.target.value = '';
  }
}
async function clearAll() {
  if (ctx.busy || ctx.uploadBusy) return false;
  const details = tr('将删除本机全部个人信息、学习记录、照片、附件、收藏、设置、编辑草稿、文档版本和导出历史。已下载的文件不受影响。请先备份。','This deletes all local profiles, study records, photos, files, favorites, settings, drafts, document versions and export history. Downloaded files are kept. Back up first.');
  if (!await confirmAction(tr('清除本地数据？','Clear local data?'),details,tr('继续','Continue'))) return false;
  if (!await confirmAction(tr('最后确认：删除全部本机数据？','Final confirmation: delete all local data?'),details,tr('确认删除','Delete everything'))) return false;
  ctx.busy = true; ctx.persistencePaused = true; document.body.inert = true;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.inert = true;
  cancelPendingSave();
  try {
    const empty = fresh(); empty.onboarded = true; empty.savedAt = new Date().toISOString();
    const snapshot = compactSnapshot(empty);
    try {
      await Promise.all ([ctx.saveChain, waitForResourceWrites (), waitForQuizWrites (), waitForHomeWrites (), waitForJournalWrites(),waitForExamCalendarWrites()]);
      // Keep an empty workspace so reopening an editable HTML copy cannot resurrect its embedded seed.
      await storage.replaceAll({current:snapshot});
    } catch (error) {
      toast(tr('清除失败，原数据已保留：','Unable to clear; original data kept: ') + error.message); return false;
    }
    ctx.state = empty;
    try {
      await reloadResources (); await Promise.all ([initializeQuiz ({}), initializeHome ({}),initializeJournal({}),initializeExamCalendar({})]);
      resetTransientState(); initializeSaving301(snapshot);
      for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
      render(); toast(tr('本地数据已清除','Local data cleared'));
    } catch { location.reload(); }
    return true;
  } finally {
    ctx.busy = false; ctx.persistencePaused = false; document.body.inert = false;
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.inert = false;
    if (ctx.dirty301) scheduleSave();
  }
}
async function openBackupText () {
  if (ctx.busy || ctx.uploadBusy) return;
  let dialog = $ ('#textBackup');
  if (! dialog) {
    dialog = document.createElement ('dialog');
    dialog.id = 'textBackup';
    dialog.innerHTML = '<h2></h2><p></p><textarea id="backupTextValue" rows="12" spellcheck="false"></textarea><div class="actions"><button id="selectBackupText"></button><button id="restoreBackupText"></button><button id="closeBackupText"></button></div>';
    document.body.append (dialog);
  }
  try {
    dialog.querySelector ('h2').textContent = tr ('备份文本', 'Backup text');
    dialog.querySelector ('p').textContent = tr ('可复制保存完整 JSON，也可粘贴有效备份进行恢复。', 'Copy the complete JSON, or paste a valid backup to restore.');
    $ ('#backupTextValue').value = JSON.stringify (await getCurrentBackup (), null, 2);
    $ ('#selectBackupText').textContent = tr ('全选', 'Select all');
    $ ('#restoreBackupText').textContent = tr ('从文本恢复', 'Restore text');
    $ ('#closeBackupText').textContent = tr ('关闭', 'Close');
    $ ('#selectBackupText').onclick = () => {
      $ ('#backupTextValue').focus ();
      $ ('#backupTextValue').select ();
    };
    $ ('#closeBackupText').onclick = () => dialog.close ();
    $ ('#restoreBackupText').onclick = async () => {
      try {
        const parsed = parseBackup ($ ('#backupTextValue').value);
        if (! await confirmAction (tr ('从备份文本恢复？', 'Restore backup text?'), backupSummary (parsed.backup, parsed.draft), tr ('恢复',
        'Restore'))) return;
        await commitBackup (parsed.backup);
        dialog.close ();
        render ();
        toast (tr ('全部数据已恢复', 'All data restored'));
      }
      catch (error) {
        toast (error.message);
      }
    };
    dialog.showModal ();
  }
  catch (error) {
    toast (tr ('无法读取备份：', 'Unable to read backup: ') + error.message);
  }
}
async function offlineHTML () {
  await Promise.all ([ctx.saveChain, waitForResourceWrites (), waitForQuizWrites ().catch(()=>{}), waitForHomeWrites (), waitForJournalWrites(),waitForExamCalendarWrites()]);
  const template = globalThis.QICHENG_PORTABLE_TEMPLATE || await (await resourceFetch ('assets/editable-template.html')).text ();
  const records = await storage.getAll ();
  const quizDraft=getQuizDraftRecord();if(quizDraft)records[QUIZ_DRAFT_KEY]=quizDraft;else delete records[QUIZ_DRAFT_KEY];
  delete records.current; delete records.__seedCleared;
  for(const key of Object.keys(records))if(key.startsWith('meta:')||key.startsWith('session:'))delete records[key];
  assertJSON (records); validateQuizRecords (records); validateHomeRecords (records);validateJournalRecords(records);validateExamCalendarRecords(records);
  Object.assign (records, validateResourceRecords (records, {allowOfficial:true}));
  const payload = JSON.stringify ( {
    id : uid (), draft : snapshot3 (), records
  }).replace (/</g, '\\u003c').replace (/\u2028/g, '\\u2028').replace (/\u2029/g, '\\u2029');
  return template.replace (/(<script id="qichengEmbedded" type="application\/json">)[\s\S]*?(<\/script>)/, (_, start,
  end) => start + payload + end);
}
export { BACKUP_VERSION, createBackup, parseBackup, compactSnapshot, backupUserRecords, backupSummary, getCurrentBackup, backupFilename, exportBackup, commitBackup, restoreBackup, clearAll, openBackupText, offlineHTML, saveAllLocal };

// All controls for this feature, in their original override order.
function bindBackupControls () {
  $ ('#backupInput').onchange = restoreBackup;
}
export { bindBackupControls };
