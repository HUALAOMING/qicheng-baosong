// Deliberately small API doubles. These test application logic, not a real browser layout/engine.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root = fileURLToPath(new URL('../',import.meta.url));
class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach(v => this.values.add(v)); }
  remove(...values) { values.forEach(v => this.values.delete(v)); }
  contains(value) { return this.values.has(value); }
  toggle(value,on = !this.contains(value)) { on ? this.add(value) : this.remove(value); return on; }
}
class Element {
  constructor(id = '') { this.id=id; this.dataset={}; this.style={}; this.classList=new ClassList(); this.attributes=new Map(); this.value=''; this.hidden=false; this.open=false; this.textContent=''; this._html=''; this.listeners=new Map(); }
  set innerHTML(value) { this._html=value; }
  get innerHTML() { return this._html; }
  setAttribute(k,v) { this.attributes.set(k,String(v)); }
  getAttribute(k) { return this.attributes.get(k); }
  hasAttribute(k) { return this.attributes.has(k); }
  addEventListener(name,fn) { this.listeners.set(name,fn); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  append() {} focus() {} select() {} click() {} scrollIntoView() {}
  showModal() { this.open=true; }
  close() { this.open=false; this.listeners.get('close')?.(); }
}
function makeDocument() {
  const fixed=new Map(['app','confirmDialog','confirmTitle','confirmMessage','confirmAccept','downloadDialog','downloadLink','downloadDescription','openGeneratedFile','shareFile','closeDownload','offlineSnapshot'].map(k=>[k,new Element(k)]));
  fixed.get('offlineSnapshot').textContent='{"id":"blank-v11","draft":null}';
  const document={baseURI:'https://qicheng.test/',fonts:{add(){},ready:Promise.resolve()},documentElement:{lang:'zh-CN',outerHTML:'<html></html>'},body:new Element(),visibilityState:'visible',listeners:new Map()};
  const generated=new Map();
  document.querySelector=selector=>{
    if(fixed.has(selector.slice(1)) && selector.startsWith('#')) return fixed.get(selector.slice(1));
    const html=fixed.get('app').innerHTML;
    if(selector.startsWith('#') && html.includes('id="'+selector.slice(1)+'"')) {
      if(!generated.has(selector)) generated.set(selector,new Element(selector.slice(1)));
      return generated.get(selector);
    }
    if(selector.startsWith('.') && html.includes(selector.slice(1))) {
      if(!generated.has(selector)) generated.set(selector,new Element()); return generated.get(selector);
    }
    return null;
  };
  document.querySelectorAll=()=>[];
  document.getElementById=id=>document.querySelector('#'+id);
  document.addEventListener=(name,fn)=>document.listeners.set(name,fn);
  document.createElement=()=>new Element();
  return document;
}
class FakeFactory {
  constructor() { this.databases=new Map(); this.failOpen=false; this.failWrite=false; this.failAfter=0; }
  open(name) {
    const request={};
    setImmediate(()=>{
      if(this.failOpen) { request.error=new DOMException('Database unavailable','UnknownError'); request.onerror?.(); return; }
      const exists=this.databases.has(name);
      if(!exists) this.databases.set(name,{data:new Map(),tail:Promise.resolve(),stores:new Set()});
      const state=this.databases.get(name), factory=this;
      const db={objectStoreNames:{contains:n=>state.stores.has(n)},createObjectStore(n){state.stores.add(n);},close(){db.onclose?.();},transaction(store,mode){
        const operations=[]; let aborted=false, local=null;
        const tx={error:null,abort(){if(aborted)return;aborted=true;tx.error ||= new DOMException('Transaction aborted','AbortError');}};
        const requestFor=(type,key,value)=>{const r={};operations.push({type,key,value,r});return r;};
        const objectStore={get:key=>requestFor('get',key),put:(value,key)=>{structuredClone(value);return requestFor('put',key,value);},delete:key=>requestFor('delete',key),clear:()=>requestFor('clear'),openCursor:()=>requestFor('cursor')};
        tx.objectStore=()=>objectStore;
        state.tail=state.tail.then(()=>new Promise(resolve=>setImmediate(()=>{
          local=new Map([...state.data].map(([k,v])=>[k,structuredClone(v)]));
          let count=0;
          const stop=()=>{if(aborted){tx.onabort?.();resolve();return true;}return false;};
          function next(){
            if(stop())return;
            const op=operations.shift();
            if(!op){if(mode==='readwrite')state.data=local;tx.oncomplete?.();resolve();return;}
            if(mode==='readwrite' && (factory.failWrite || factory.failAfter && ++count>=factory.failAfter)) {
              factory.failWrite=false;factory.failAfter=0;tx.error=new DOMException('Injected write failure','QuotaExceededError');tx.abort();next();return;
            }
            if(op.type==='get') op.r.result=structuredClone(local.get(op.key));
            if(op.type==='put') local.set(op.key,structuredClone(op.value));
            if(op.type==='delete') local.delete(op.key);
            if(op.type==='clear') local.clear();
            if(op.type==='cursor') {
              const entries=[...local],emit=index=>{
                if(index===entries.length){op.r.result=null;op.r.onsuccess?.();setImmediate(next);return;}
                const [key,value]=entries[index];op.r.result={key,value:structuredClone(value),continue:()=>setImmediate(()=>emit(index+1))};op.r.onsuccess?.();
              };
              emit(0);return;
            }
            try { op.r.onsuccess?.(); } catch(e) { tx.error=e;tx.abort(); }
            setImmediate(next);
          }
          next();
        })));
        return tx;
      }};
      request.result=db;
      if(!exists) request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  }
}
async function setup() {
  const document=makeDocument(),factory=new FakeFactory();
  Object.assign(globalThis,{document,window:globalThis,self:globalThis,indexedDB:factory,innerWidth:1280,
    FontFace:class { load(){return Promise.resolve(this);} },
    matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{fn();return 1;},
    scrollTo(){},scrollBy(){},addEventListener(){},location:{reload(){}},
    fetch:async input=>{
      const url=new URL(String(input),document.baseURI);
      if(url.origin!=='https://qicheng.test')throw new Error('External fetch prohibited in tests');
      const data=await readFile(path.join(root,decodeURIComponent(url.pathname.slice(1))));
      return new Response(data,{status:200});
    }
  });
  Object.defineProperty(globalThis,'navigator',{value:{onLine:true,userAgent:'Node test harness'},configurable:true});
  for(const name of ['docx','pdf-lib','jszip','fontkit','pptxgen']) vm.runInThisContext(await readFile(path.join(root,'assets/vendor/'+name+'.js'),'utf8'),{filename:name+'.js',importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
  return {document,factory,root};
}
function workspaceHTML(document) {
  return document.getElementById('app').innerHTML.split('<div class="page-content3" id="workspaceContent">')[1]?.split('</div><footer class="quiet-footer">')[0];
}
export {setup,makeDocument,workspaceHTML,root,FakeFactory};
