import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {storage}=await import('../js/storage.js');
const saving=await import('../js/autosave.js');
const backup=await import('../js/backup.js');
const intro=await import('../js/modules/introductions.js');
const local=await import('../js/local-files52.js');
beforeEach(async()=>{await ctx.saveChain;saving.cancelPendingSave();env.factory.failWrite=false;await storage.clear();ctx.state=fresh();ctx.busy=false;ctx.uploadBusy=false;ctx.persistencePaused=false;saving.initializeSaving301();intro.resetIntroductions52();});
test('New introduction clears an existing edit ID while retaining an unfinished new draft',()=>{
  ctx.state.introductionDraft={id:'prior-version',title:'原版',language:'中文',body:'原正文',minutes:'1',seconds:'0',note:''};
  intro.startIntroduction52();assert.equal(ctx.state.introductionDraft.id,'');assert.equal(ctx.state.introductionDraft.body,'');
  ctx.state.introductionDraft.body='新草稿';intro.startIntroduction52();assert.equal(ctx.state.introductionDraft.body,'新草稿');
});
test('restore clears rehearsal clocks so an imported version cannot inherit previous overtime',async()=>{
  const item={id:'same-id',title:'',language:'中文',durationSeconds:60,note:'',body:'正文',updatedAt:'2026-10-26T00:00:00Z'};
  ctx.state.introductions=[item];const archive=backup.createBackup(ctx.state);
  intro.introductionTimerAction52(item,'toggle',Date.now()-100000);assert.equal(intro.introductionClock52(item.id,60).overtime,true);
  await backup.commitBackup(archive);assert.equal(intro.introductionClock52(item.id,60).seconds,60);assert.equal(intro.introductionClock52(item.id,60).running,false);
});
test('cache clearing asks for confirmation and removes only this installation assets, keeping all database records',async()=>{
  await storage.setMany({'current':ctx.state,'calendar:exam:sample':{keep:true},'settings:custom':{value:'用户设置'}});const before=await storage.getAll();
  const removed=[],unregistered=[];
  globalThis.caches={keys:async()=>['qicheng-static-%2F-v4-current','qicheng-static-%2Fother%2F-v4-current','unrelated-cache'],delete:async name=>{removed.push(name);return true;}};
  navigator.serviceWorker={getRegistrations:async()=>[{scope:'https://qicheng.test/',unregister:async()=>{unregistered.push('this');return true;}},{scope:'https://qicheng.test/other/',unregister:async()=>{unregistered.push('other');return true;}}]};
  try{
    let operation=local.clearApplicationCache52(),dialog=env.document.getElementById('confirmDialog');assert.equal(dialog.open,true);assert.match(env.document.getElementById('confirmMessage').textContent,/未手动保存/);
    dialog.returnValue='cancel';dialog.close();assert.equal(await operation,false);assert.deepEqual(removed,[]);assert.deepEqual(await storage.getAll(),before);
    operation=local.clearApplicationCache52();dialog.returnValue='confirm';dialog.close();assert.equal(await operation,true);
    assert.deepEqual(removed,['qicheng-static-%2F-v4-current']);assert.deepEqual(unregistered,['this']);assert.deepEqual(await storage.getAll(),before);
  }finally{delete globalThis.caches;delete navigator.serviceWorker;}
});
test('manual JSON save preserves unsaved current data even when database writing fails',async()=>{
  ctx.state.profile.name='数据库写入失败仍可另存';saving.scheduleSave();env.factory.failWrite=true;let content='';
  globalThis.showSaveFilePicker=async()=>({createWritable:async()=>({write:async text=>{content=text;},close:async()=>{},abort:async()=>{}})});
  try{assert.equal(await local.saveLocalFile52(),true);assert.equal(backup.parseBackup(content).draft.profile.name,'数据库写入失败仍可另存');assert.equal(ctx.state.profile.name,'数据库写入失败仍可另存');}
  finally{delete globalThis.showSaveFilePicker;}
});
