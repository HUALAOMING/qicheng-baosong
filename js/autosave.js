import { ctx } from './state.js';
import { storage } from './storage.js';
import { snapshot3, normalizeAssets3 } from './model.js';
import { savedStatus, toast, tr } from './utils/helpers.js';
function fingerprint301 (snapshot) {
  const {
    savedAt, route, section, step, sidebarHidden, menuOpen,
    chartExamIds, chartSelectionSet, chartMetric, chartSubject, activeVersion, ...data
  }
  = snapshot;
  const assets=(data.assets||[]).map(asset=>{
    if(!asset._assetBlobRef)return asset;
    const {data,_assetPreview,...metadata}=asset;return metadata;
  });
  return JSON.stringify ({...data,assets});
}
function initializeSaving301 (snapshot = snapshot3 ({forStorage:true})) {
  ctx.savedFingerprint301 = fingerprint301 (snapshot);
  ctx.workspaceRevision521 = storage.revision('current');
  ctx.dirty301 = false;
  ctx.saveError = false;
  ctx.saving = false;
  clearTimeout(savePresentation53.timer);savePresentation53={phase:'saved',since:0,timer:null};lastActualSaving53=false;
}
let savePresentation53={phase:'saved',since:0,timer:null},lastActualSaving53=false;
function getSaveFeedback53(){const phase=savePresentation53.phase;return {phase,text:phase==='error'?tr('保存失败','Save failed'):phase==='saving'?tr('正在保存…','Saving…'):phase==='dirty'?tr('待自动保存','Pending save'):tr('已保存','Saved')};}
function updateSaveStatus301 () {
  const now=Date.now(),actual=ctx.saveError?'error':ctx.saving?'saving':ctx.dirty301?'dirty':'saved';
  clearTimeout(savePresentation53.timer);savePresentation53.timer=null;
  if(actual==='saving'&&!lastActualSaving53)savePresentation53={phase:'saving',since:now,timer:null};
  else if(actual==='error')savePresentation53.phase='error';
  else if(savePresentation53.phase==='saving'&&actual!=='saving'&&now-savePresentation53.since<1000){savePresentation53.timer=setTimeout(updateSaveStatus301,1000-(now-savePresentation53.since));}
  else savePresentation53.phase=actual;
  lastActualSaving53=actual==='saving';
  const feedback=getSaveFeedback53();
  savedStatus(ctx.saveError?tr('保存失败 · 请立即备份','Save failed · back up now'):feedback.text);
  const card=globalThis.document?.querySelector?.('.sidebar-save52');if(card)card.dataset.saveState=feedback.phase;
  const resumeStatus=globalThis.document?.querySelector?.('#resumeSaveStatus53');
  if(resumeStatus){resumeStatus.dataset.phase=feedback.phase;if(resumeStatus.dataset.message53!==feedback.text){resumeStatus.innerHTML='<i aria-hidden="true"></i><span>'+feedback.text+'</span>';resumeStatus.dataset.message53=feedback.text;}}
  if(globalThis.dispatchEvent&&globalThis.CustomEvent)globalThis.dispatchEvent(new CustomEvent('qicheng-save-state53',{detail:{dirty:ctx.dirty301,saving:ctx.saving,error:ctx.saveError}}));
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
    snapshot = snapshot3 ({forStorage:true});
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
      const committed=await storage.commitCurrent(snapshot,{expected:{current:ctx.workspaceRevision521??0}});
      ctx.workspaceRevision521=committed.revision;
      const binaryRefs=new Map(committed.assets.map(asset=>[asset.id,asset]));
      for(const asset of ctx.state.assets||[]){const meta=binaryRefs.get(asset.id);if(meta){asset._assetBlobRef=meta._assetBlobRef;asset._assetPreview=meta._assetPreview;asset.data=meta._assetPreview;}}
      normalizeAssets3();
      // New assets acquire stable references only after the transaction commits.
      snapshot.assets=committed.assets;
      ctx.savedFingerprint301 = fingerprint301(snapshot);
      ctx.state.savedAt = snapshot.savedAt;
      ctx.saveError = false;
      if (ctx.editRevision301 === revision) ctx.dirty301 = false;
      return true;
    }
    catch (error) {
      ctx.saveError = true;
      ctx.dirty301 = true;
      const detail=error.name==='QuotaExceededError'?'此站点可用存储配额不足。请先导出备份，再清理不需要的附件。':error.message;
      toast (tr ('本机保存失败，请立即备份：', 'Local save failed. Back up now: ') + detail);
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
export { getSaveFeedback53, save, scheduleSave, cancelPendingSave, fingerprint301, initializeSaving301, updateSaveStatus301 };
