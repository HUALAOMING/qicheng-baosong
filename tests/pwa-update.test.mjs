import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
async function harness(registration,waitForCalendar=async()=>{}){
  const notice={textContent:''};let registrations=0,saves=0;const nav={onLine:true,serviceWorker:{getRegistration:async()=>registration,register:async()=>{registrations++;return registration;}}};
  const values={
    './features53.js':{flushLoadedFeatures53:async()=>{}},'./timer53.js':{waitForTimerWrites53:async()=>{}},
    './state.js':{ctx:{state:{}}},'./utils/helpers.js':{$:()=>null,$$:selector=>selector==='[data-pwa-update-status]'?[notice]:[],tr:zh=>zh,toast(){}},
    './tasks.js':{tasks:{start:()=>({state:{status:'running'},stage(){},succeed(){},fail(){}})}},'./constants.js':{VERSION:'5.2.1'},
    './autosave.js':{save:async()=>{saves++;return true;}},'./data.js':{APP_BASE:new URL('https://qicheng.test/app/')},
    './modules/home.js':{waitForHomeWrites:async()=>{}},'./modules/quiz.js':{waitForQuizWrites:async()=>{}},'./resources.js':{waitForResourceWrites:async()=>{}},'./modules/journal.js':{waitForJournalWrites:async()=>{}},'./modules/exam-calendar.js':{waitForExamCalendarWrites:waitForCalendar}
  };
  const context=vm.createContext({navigator:nav,URL,setTimeout,clearTimeout});const module=new vm.SourceTextModule(await readFile(new URL('../js/pwa.js',import.meta.url),'utf8'),{context});
  await module.link(name=>{const data=values[name];return new vm.SyntheticModule(Object.keys(data),function(){for(const[k,v]of Object.entries(data))this.setExport(k,v);},{context});});await module.evaluate();
  return {pwa:module.namespace.pwa,notice,nav,counts:()=>({registrations,saves})};
}
test('Android UnknownError retries the same service-worker URL without clearing registration or saving user state',async()=>{
  let attempts=0;const reg={waiting:null,installing:null,update:async()=>{if(++attempts===1){const error=Error('Unknown error');error.name='UnknownError';throw error;}reg.waiting={};}};
  const h=await harness(reg);assert.equal(await h.pwa.checkUpdate(),true);assert.equal(attempts,2);assert.deepEqual(h.counts(),{registrations:1,saves:0});assert.match(h.notice.textContent,/新版已下载/);
});
test('an already downloaded update remains available even if another network check would fail',async()=>{
  let attempts=0;const h=await harness({waiting:{},update:async()=>{attempts++;throw Error('Offline');}});
  assert.equal(await h.pwa.checkUpdate(),true);assert.equal(attempts,0);assert.deepEqual(h.counts(),{registrations:0,saves:0});
});
test('repeated unknown failures report useful recovery steps and technical details without deleting user data',async()=>{
  const h=await harness({update:async()=>{const e=Error('Unknown error');e.name='UnknownError';throw e;}});
  assert.equal(await h.pwa.checkUpdate(),false);assert.match(h.notice.textContent,/旧版和个人资料已保留/);assert.match(h.notice.textContent,/UnknownError/);assert.equal(h.counts().saves,0);
});
test('offline checks do not request updates, re-register or save data',async()=>{
  const h=await harness({update:async()=>{throw Error('Unexpected call');}});h.nav.onLine=false;
  assert.equal(await h.pwa.checkUpdate(),false);assert.match(h.notice.textContent,/当前离线/);assert.deepEqual(h.counts(),{registrations:0,saves:0});
});
test('app update waits for manual exam writes and keeps the old app when a write fails',async()=>{
  let activate=0,release;const pending=new Promise(resolve=>{release=resolve;});
  const h=await harness({waiting:{postMessage(){activate++;}}},()=>pending);await h.pwa.checkUpdate();const operation=h.pwa.applyUpdate();await new Promise(setImmediate);assert.equal(activate,0);release();await operation;assert.equal(activate,1);
  const failed=await harness({waiting:{postMessage(){activate++;}}},async()=>{throw Error('calendar write failed');});await failed.pwa.checkUpdate();assert.equal(await failed.pwa.applyUpdate(),false);assert.equal(activate,1);
});
