import { ctx } from './state.js';
import { storage } from './storage.js';
import { snapshot3 } from './model.js';
import { savedStatus, toast, tr } from './utils/helpers.js';
function fingerprint301 (snapshot) {
  const {
    savedAt, route, section, step, sidebarHidden, menuOpen,
    chartExamIds, chartSelectionSet, chartMetric, chartSubject, activeVersion, ...data
  }
  = snapshot;
  return JSON.stringify (data);
}
function initializeSaving301 (snapshot = snapshot3 ()) {
  ctx.savedFingerprint301 = fingerprint301 (snapshot);
  ctx.dirty301 = false;
  ctx.saveError = false;
  ctx.saving = false;
}
function updateSaveStatus301 () {
  const message = ctx.saveError ? tr ('保存失败 · 请立即备份', 'Save failed · back up now') : ctx.saving || ctx.dirty301 ? tr ('正在保存…',
  'Saving…') : tr ('已保存', 'Saved');
  savedStatus (message);
}
function scheduleSave () {
  ctx.dirty301 = true;
  ctx.editRevision301 ++;
  updateSaveStatus301 ();
  clearTimeout (ctx.timer);
  ctx.timer = setTimeout (() => {
    ctx.timer = null; save ();
  }, 500);
}
function cancelPendingSave () {
  clearTimeout (ctx.timer);
  ctx.timer = null;
}
function save () {
  if (ctx.persistencePaused) return Promise.resolve (false);
  cancelPendingSave ();
  let snapshot, fingerprint;
  const revision = ctx.editRevision301;
  try {
    snapshot = snapshot3 ();
    fingerprint = fingerprint301 (snapshot);
  }
  catch (error) {
    ctx.saveError = true;
    ctx.dirty301 = true;
    updateSaveStatus301 ();
    toast (tr ('保存失败：', 'Save failed: ') + error.message);
    return Promise.resolve (false);
  }
  const run = async () => {
    if (fingerprint === ctx.savedFingerprint301 && ! ctx.saveError) {
      if (ctx.editRevision301 === revision) ctx.dirty301 = false;
      updateSaveStatus301 ();
      return true;
    }
    ctx.saving = true;
    updateSaveStatus301 ();
    // Keep compatibility with old drafts without persisting the current navigation.
    Object.assign(snapshot, {route:'home',section:'resume',step:0,sidebarHidden:true,menuOpen:['start']});
    snapshot.savedAt = new Date ().toISOString ();
    try {
      await storage.set ('current', snapshot);
      ctx.savedFingerprint301 = fingerprint;
      ctx.state.savedAt = snapshot.savedAt;
      ctx.saveError = false;
      if (ctx.editRevision301 === revision) ctx.dirty301 = false;
      return true;
    }
    catch (error) {
      ctx.saveError = true;
      ctx.dirty301 = true;
      toast (tr ('本机保存失败，请立即备份：', 'Local save failed. Back up now: ') + error.message);
      return false;
    }
    finally {
      ctx.saving = false;
      updateSaveStatus301 ();
    }
  };
  ctx.saveChain = ctx.saveChain.then (run, run);
  return ctx.saveChain;
}
export { save, scheduleSave, cancelPendingSave, fingerprint301, initializeSaving301, updateSaveStatus301 };
