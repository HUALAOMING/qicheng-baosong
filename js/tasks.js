// Phase-local counters represent measured work, never an elapsed-time estimate.
const taskRecords521 = new Map();
let taskSequence521 = 0, taskPaintPending521 = false;
function paintTasks521() {
  taskPaintPending521 = false;
  if (!globalThis.document?.body || !document.getElementById) return;
  let host = document.getElementById('taskProgress521');
  if (!host) {
    host = document.createElement('aside'); host.id = 'taskProgress521';
    host.className = 'task-progress521'; host.setAttribute('aria-label','任务进度');
    document.body.append(host);
  }
  if(typeof host.replaceChildren!=='function')return;
  host.replaceChildren();
  for (const record of [...taskRecords521.values()].slice(-3)) {
    const panel=document.createElement('section'), title=document.createElement('strong'), detail=document.createElement('p'), progress=document.createElement('progress');
    panel.dataset.status=record.status; title.textContent=record.name;
    detail.textContent=record.stage+(record.total!==null?' · 已处理 '+record.done+'/'+record.total+(record.done<record.total?' · '+Math.floor(record.done/record.total*100)+'%':'，等待阶段确认'):'');
    panel.append(title,detail);
    if(record.status==='running') {
      progress.max=record.total||1;
      // A processed batch is not committed. 100% is only shown on success.
      if(record.total!==null && record.done<record.total)progress.value=record.done;
      progress.setAttribute('aria-label',record.stage);panel.append(progress);
    } else {
      const summary=document.createElement('p');summary.textContent=record.summary;summary.setAttribute('role',record.status==='failed'?'alert':'status');panel.append(summary);
      const close=document.createElement('button');close.textContent='关闭';close.onclick=()=>{taskRecords521.delete(record.id);paintTasks521();};panel.append(close);
    }
    host.append(panel);
  }
}
function scheduleTaskPaint521() {
  if(taskPaintPending521)return;taskPaintPending521=true;
  (globalThis.requestAnimationFrame || (fn=>setTimeout(fn,0)))(paintTasks521);
}
const tasks = {
  start(name) {
    const record={id:++taskSequence521,name,stage:'准备中',done:0,total:null,status:'running',summary:''};
    // Keep the panel bounded during a long session; running work is retained.
    for(const [id,item] of taskRecords521)if(taskRecords521.size>=8&&item.status!=='running')taskRecords521.delete(id);
    taskRecords521.set(record.id,record);scheduleTaskPaint521();
    return {
      stage(label,counts={}) {if(record.status!=='running')return;record.stage=label;record.total=Number.isFinite(counts.total)&&counts.total>0?counts.total:null;record.done=Math.max(0,Math.min(counts.done||0,record.total??Infinity));scheduleTaskPaint521();},
      succeed(summary='已完成') {if(record.status!=='running')return;record.status='succeeded';record.stage='完成';record.summary=summary;record.done=record.total??0;scheduleTaskPaint521();},
      fail(error) {if(record.status!=='running')return;record.status='failed';record.stage='失败';record.summary=error?.message||String(error);scheduleTaskPaint521();},
      get state(){return {...record};}
    };
  },
  snapshot(){return [...taskRecords521.values()].map(item=>({...item}));}
};
export {tasks};
