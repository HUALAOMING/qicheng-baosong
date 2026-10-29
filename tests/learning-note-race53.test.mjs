import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {storage}=await import('../js/storage.js');
const resources=await import('../js/resources.js');
const learning=await import('../js/learning53.js');
const noteKey='question:note:note-race53/q1';
function host53(){
 const host={isConnected:true,dataset:{note53Bank:'note-race53',note53Question:'q1'},renders:0,elements:{}};
 Object.defineProperty(host,'innerHTML',{get(){return host.html||'';},set(value){host.html=value;host.renders++;const match=value.match(/data-note-editor53>([\s\S]*?)<\/textarea>/);host.elements=match?{input:{value:match[1]},status:{textContent:''},save:{},remove:{}}:{};}});
 host.querySelector=selector=>selector==='textarea'||selector==='[data-note-editor53]'?host.elements.input:selector==='[data-note-status53]'?host.elements.status:selector==='[data-note-save53]'?host.elements.save:selector==='[data-note-delete53]'?host.elements.remove:null;
 return host;
}
async function until53(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setImmediate(r));}throw Error('Controlled read was not started');}
test('same note host is bound once; repeated late binding cannot erase rapid input before route flush',async()=>{
 learning.resetLearning53();await storage.clear();await resources.saveQuestionNote('note-race53','q1','original',{expectedRevision:0});
 const originalGet=storage.get;let reads=0,release;
 storage.get=async key=>{const value=await originalGet(key);if(key===noteKey){reads++;await new Promise(resolve=>{release=resolve;});}return value;};
 try{
  const host=host53(),first=learning.bindNoteHost53(host);await until53(()=>!!release);const second=learning.bindNoteHost53(host);
  assert.equal(second,first,'a second render must reuse the same in-flight bind');assert.equal(reads,1);
  release();await first;assert.equal(host.elements.input.value,'original');const input=host.elements.input;
  // This is the portable failure trigger: another bind runs after the textarea
  // exists, then the user types and immediately navigates away.
  const repeated=learning.bindNoteHost53(host);input.value='rapid offline edit';input.oninput();await repeated;
  assert.equal(host.elements.input,input,'do not replace an input node with an old DB value');assert.equal(reads,1);
  assert.equal(learning.getPendingLearningRecords53()[noteKey].text,'rapid offline edit');
  storage.get=originalGet;await learning.flushLearning53();assert.equal((await storage.get(noteKey)).text,'rapid offline edit');assert.equal(learning.hasPendingLearning53(),false);assert.equal(host.renders,1);
 }finally{storage.get=originalGet;learning.resetLearning53();}
});
test('late detached host read from before restore cannot replace the new canonical note draft',async()=>{
 learning.resetLearning53();await storage.clear();await resources.saveQuestionNote('note-race53','q1','before restore',{expectedRevision:0});
 const originalGet=storage.get;let release,delayed=false;
 storage.get=async key=>{const value=await originalGet(key);if(key===noteKey&&!delayed){delayed=true;await new Promise(resolve=>{release=resolve;});}return value;};
 try{
  const old=host53(),pending=learning.bindNoteHost53(old);await until53(()=>!!release);old.isConnected=false;learning.resetLearning53();
  const current=await resources.getQuestionLearning('note-race53','q1');await resources.saveQuestionNote('note-race53','q1','restored note',{expectedRevision:current.noteRevision});
  const active=host53();await learning.bindNoteHost53(active);active.elements.input.value='new post-restore edit';active.elements.input.oninput();
  release();await pending;
  assert.equal(learning.getPendingLearningRecords53()[noteKey].text,'new post-restore edit');assert.equal(active.elements.input.value,'new post-restore edit');assert.equal(old.renders,0);
  storage.get=originalGet;await learning.flushLearning53();assert.equal((await storage.get(noteKey)).text,'new post-restore edit');
 }finally{storage.get=originalGet;learning.resetLearning53();}
});
test('route flush drains text typed during an earlier database commit before it resolves',async()=>{
 learning.resetLearning53();await storage.clear();const host=host53();await learning.bindNoteHost53(host);
 const originalSetMany=storage.setMany;let release,blocked=false;
 storage.setMany=async(records,...rest)=>{if(Object.hasOwn(records,noteKey)&&!blocked){blocked=true;await new Promise(resolve=>{release=resolve;});}return originalSetMany(records,...rest);};
 try{
  host.elements.input.value='first pending text';host.elements.input.oninput();const flush=learning.flushLearning53();await until53(()=>!!release);
  host.elements.input.value='latest text during commit';host.elements.input.oninput();release();await flush;
  assert.equal((await storage.get(noteKey)).text,'latest text during commit');assert.equal(learning.hasPendingLearning53(),false);
 }finally{storage.setMany=originalSetMany;learning.resetLearning53();}
});
