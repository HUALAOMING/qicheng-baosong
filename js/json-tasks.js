import { APP_BASE } from './data.js';
async function parseTaskJSON(text,task) {
  task?.stage('解析 JSON');
  // Portable copies use a local fallback. PWA parsing runs off the main thread.
  if(typeof Worker==='undefined'||globalThis.QICHENG_PORTABLE_TEMPLATE||globalThis.location?.protocol==='file:') {
    await new Promise(resolve=>setTimeout(resolve,0));return JSON.parse(text.replace(/^\uFEFF/,''));
  }
  return new Promise((resolve,reject)=>{
    let worker;
    const finish=(error,value)=>{clearTimeout(timeout);worker?.terminate();error?reject(error):resolve(value);};
    const timeout=setTimeout(()=>finish(new Error('JSON 处理超时，请检查文件大小与结构。')),120000);
    try {
      worker=new Worker(new URL('workers/json-worker.js',APP_BASE));
      worker.onmessage=event=>event.data.error?finish(new Error(event.data.error)):finish(null,event.data.value);
      worker.onerror=()=>finish(new Error('JSON 解析工作线程未能完成，请重试。'));
      worker.postMessage({text});
    }catch(error){finish(error);}
  });
}
async function parseTaskFile(file,task) {
  task?.stage('读取文件');
  return parseTaskJSON(await file.text(),task);
}
export {parseTaskJSON,parseTaskFile};
