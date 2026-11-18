import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const release = {appVersion:'5.4.3',revision:'0123456789ab'};
const scriptURL = 'https://qicheng.test/app/service-worker.js?revision='+release.revision;
async function harness({manifest=async()=>release,register,waitForCalendar=async()=>{}}={}) {
  const notice = {textContent:''};
  const registration = {waiting:null};
  const messages = [];
  const counts = {checks:0,downloads:0,saves:0};
  const nav = {onLine:true,serviceWorker:{
    getRegistration:async()=>registration,
    register:async url=>{
      counts.downloads++;
      if (register) await register(url);
      assert.equal(url.href,scriptURL);
      registration.waiting = {scriptURL,postMessage:message=>messages.push(message)};
      return registration;
    }
  }};
  const values={
    './features53.js':{flushLoadedFeatures53:async()=>{}},'./timer53.js':{waitForTimerWrites53:async()=>{}},
    './state.js':{ctx:{state:{}}},
    './utils/helpers.js':{$:()=>null,$$:selector=>selector==='[data-pwa-update-status]'?[notice]:[],tr:zh=>zh,toast(){}},
    './tasks.js':{tasks:{start:()=>({state:{status:'running'},stage(){},succeed(){},fail(){}})}},
    './constants.js':{VERSION:'5.4.2'},
    './autosave.js':{save:async()=>{counts.saves++;return true;}},
    './data.js':{APP_BASE:new URL('https://qicheng.test/app/')},
    './modules/home.js':{waitForHomeWrites:async()=>{}},'./modules/quiz.js':{waitForQuizWrites:async()=>{}},
    './resources.js':{waitForResourceWrites:async()=>{}},'./modules/journal.js':{waitForJournalWrites:async()=>{}},
    './modules/exam-calendar.js':{waitForExamCalendarWrites:waitForCalendar}
  };
  const context=vm.createContext({
    navigator:nav,URL,AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{
      assert.equal(url.href,'https://qicheng.test/app/data/static-resources.json');
      assert.equal(options.cache,'no-store');
      counts.checks++;
      return {ok:true,json:manifest};
    }
  });
  const source=await readFile(new URL('../js/pwa.js',import.meta.url),'utf8');
  const module=new vm.SourceTextModule(source,{context});
  await module.link(name=>{
    const data=values[name];
    return new vm.SyntheticModule(Object.keys(data),function(){
      for(const [key,value] of Object.entries(data))this.setExport(key,value);
    },{context});
  });
  await module.evaluate();
  return {pwa:module.namespace.pwa,notice,nav,counts,messages};
}

test('checking offers the version without downloading it or saving workspace data',async()=>{
  const h=await harness();
  assert.equal(await h.pwa.checkUpdate(),true);
  assert.equal(await h.pwa.applyUpdate(),false);
  assert.deepEqual(h.counts,{checks:1,downloads:0,saves:0});
  assert.match(h.notice.textContent,/发现新版/);
  assert.equal(await h.pwa.downloadUpdate(),true);
  assert.deepEqual(h.counts,{checks:1,downloads:1,saves:0});
  assert.match(h.notice.textContent,/新版已下载/);
});
test('a failed background check is quiet and a manual check supplies recovery details',async()=>{
  const h=await harness({manifest:async()=>{throw new Error('Network unavailable');}});
  assert.equal(await h.pwa.checkUpdate({silent:true}),false);
  assert.equal(h.notice.textContent,'');
  assert.equal(await h.pwa.checkUpdate(),false);
  assert.match(h.notice.textContent,/旧版和个人资料已保留/);
  assert.match(h.notice.textContent,/Network unavailable/);
  assert.equal(h.counts.downloads,0);
});
test('a failed explicit download remains retryable without saving or clearing data',async()=>{
  let attempts=0;
  const h=await harness({register:async()=>{if(++attempts===1)throw new Error('Network unavailable');}});
  await h.pwa.checkUpdate();
  assert.equal(await h.pwa.downloadUpdate(),false);
  assert.match(h.notice.textContent,/旧版和个人资料已保留/);
  assert.equal(await h.pwa.downloadUpdate(),true);
  assert.equal(h.counts.saves,0);
});
test('offline discovery makes no request and a previously downloaded update stays available',async()=>{
  const h=await harness();
  h.nav.onLine=false;
  assert.equal(await h.pwa.checkUpdate(),false);
  assert.equal(h.counts.checks,0);
  assert.match(h.notice.textContent,/当前离线/);
  h.nav.onLine=true;
  await h.pwa.checkUpdate();
  await h.pwa.downloadUpdate();
  h.nav.onLine=false;
  assert.equal(await h.pwa.checkUpdate(),true);
  assert.equal(h.counts.checks,1);
});
test('apply serializes requests, waits for manual exam writes and aborts on write failure',async()=>{
  let releaseWrites;
  const pending=new Promise(resolve=>{releaseWrites=resolve;});
  const h=await harness({waitForCalendar:()=>pending});
  await h.pwa.checkUpdate();
  await h.pwa.downloadUpdate();
  const operation=h.pwa.applyUpdate();
  assert.equal(await h.pwa.applyUpdate(),false);
  assert.equal(h.messages.length,0);
  releaseWrites();
  assert.equal(await operation,true);
  assert.equal(h.messages[0].type,'ACTIVATE_UPDATE');
  const failed=await harness({waitForCalendar:async()=>{throw new Error('calendar write failed');}});
  await failed.pwa.checkUpdate();
  await failed.pwa.downloadUpdate();
  assert.equal(await failed.pwa.applyUpdate(),false);
  assert.equal(failed.messages.length,0);
  assert.match(failed.notice.textContent,/calendar write failed/);
});
