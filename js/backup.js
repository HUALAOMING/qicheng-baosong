import { scheduleSave, save, cancelPendingSave, initializeSaving301, updateSaveStatus301 } from './autosave.js';
import { ctx } from './state.js';
import { VERSION } from './constants.js';
import { storage } from './storage.js';
import { clone, $, download, toast, tr, uid } from './utils/helpers.js';
import { validateDraft, assertJSON } from './utils/validation.js';
import { fresh, snapshot3, photoRefs3, synchronizeEditing } from './model.js';
import { confirmAction, render } from './app.js';
import { resourceFetch } from './data.js';
const BACKUP_VERSION = 1;
function compactSnapshot (draft) {
  const copy = clone (draft);
  for (const photo of photoRefs3 (copy)) if (photo.assetId && copy.assets.some (a => a.id === photo.assetId)) delete photo.data;
  return copy;
}
function createBackup (snapshot, otherRecords = {
}) {
  const current = compactSnapshot (validateDraft (snapshot));
  const data = {
    ...clone (otherRecords), current
  };
  assertJSON (data);
  return {
    app : 'Qicheng', backupVersion : BACKUP_VERSION, appVersion : VERSION, createdAt : new Date ().toISOString (), data
  };
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
  let other = {
  };
  try {
    other = await storage.getAll ();
  }
  catch (error) {
    toast (tr ('数据库读取失败，将备份当前工作台内容：', 'Database read failed; backing up the current workspace: ') + error.message);
  }
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
    await save ();
    const backup = await getCurrentBackup ();
    download (JSON.stringify (backup, null, 2), 'application/json;charset=utf-8', backupFilename ());
  }
  catch (error) {
    toast (tr ('无法生成备份：', 'Unable to back up: ') + error.message);
  }
}
function resetTransientState () {
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
    const records = clone(parsed.backup.data);
    records.current = compactSnapshot(parsed.draft);
    try {
      await ctx.saveChain;
      await storage.replaceAll(records);
    } catch (error) {
      ctx.state = previous; updateSaveStatus301();
      throw new Error('恢复失败，原数据已保留：' + error.message);
    }
    // The transaction has committed; a display error must not masquerade as a failed restore.
    ctx.state = parsed.draft;
    try { resetTransientState(); initializeSaving301(records.current); }
    catch { location.reload(); }
    return true;
  } finally {
    ctx.busy = false; ctx.persistencePaused = false; document.body.inert = false;
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.inert = false;
    if (ctx.dirty301) scheduleSave();
  }
}
async function restoreBackup (event) {
  const file = event?.target?.files?.[0];
  if (! file) return;
  try {
    if (ctx.busy || ctx.uploadBusy) throw new Error ('请等待当前操作完成。');
    const parsed = parseBackup (await file.text ());
    if (! await confirmAction (tr ('从备份恢复？', 'Restore this backup?'), backupSummary (parsed.backup, parsed.draft), tr ('恢复',
    'Restore'))) return;
    await commitBackup (parsed.backup);
    for (const dialog of document.querySelectorAll ('dialog[open]')) dialog.close ();
    try {
      render ();
      toast (tr ('全部数据已恢复', 'All data restored'));
    }
    catch {
      location.reload ();
    }
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
      await ctx.saveChain;
      // Keep an empty workspace so reopening an editable HTML copy cannot resurrect its embedded seed.
      await storage.replaceAll({current:snapshot});
    } catch (error) {
      toast(tr('清除失败，原数据已保留：','Unable to clear; original data kept: ') + error.message); return false;
    }
    ctx.state = empty;
    try {
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
  const template = globalThis.QICHENG_PORTABLE_TEMPLATE || await (await resourceFetch ('assets/editable-template.html')).text ();
  const payload = JSON.stringify ( {
    id : uid (), draft : snapshot3 ()
  }).replace (/</g, '\\u003c').replace (/\u2028/g, '\\u2028').replace (/\u2029/g, '\\u2029');
  return template.replace (/(<script id="qichengEmbedded" type="application\/json">)[\s\S]*?(<\/script>)/, (_, start,
  end) => start + payload + end);
}
export { BACKUP_VERSION, createBackup, parseBackup, compactSnapshot, backupSummary, getCurrentBackup, backupFilename, exportBackup, commitBackup, restoreBackup, clearAll, openBackupText, offlineHTML };

// All controls for this feature, in their original override order.
function bindBackupControls () {
  $ ('#backupInput').onchange = restoreBackup;
}
export { bindBackupControls };
