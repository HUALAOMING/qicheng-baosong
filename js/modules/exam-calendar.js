import {$,$$,esc,tr,heading3,uid,toast} from '../utils/helpers.js';
import {getExamScheduleResource} from '../resources.js';
import {journalDateKey,journalValidDate,journalShiftDate} from './journal.js';
import {storage} from '../storage.js';
import {ctx} from '../state.js';
import {SCHOOLS} from '../data.js';
import {confirmAction} from '../app.js';

// Viewing a month or a date is temporary UI state, never user data.
let examCalendarMonth=journalDateKey().slice(0,7),examCalendarSelected=journalDateKey();
const MANUAL_EXAM_PREFIX52='calendar:exam:';
let manualExamRecords52=new Map(),examCalendarWriteChain52=Promise.resolve();
const examCalendarPending52=new Set();
function validateExamCalendarRecords(records){
  if(!records||typeof records!=='object'||Array.isArray(records))throw Error('考试日历备份格式无效。');
  let count=0;
  for(const [key,event] of Object.entries(records)){
    if(!key.startsWith(MANUAL_EXAM_PREFIX52))continue;
    count++;
    const valid=event&&typeof event==='object'&&!Array.isArray(event)&&typeof event.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(event.id)&&key===MANUAL_EXAM_PREFIX52+event.id&&journalValidDate(event.date)&&typeof event.schoolName==='string'&&event.schoolName.trim()&&event.schoolName.length<=200&&typeof event.schoolId==='string'&&event.schoolId.length>0&&event.schoolId.length<=240&&['written','interview','other'].includes(event.stage)&&typeof event.location==='string'&&event.location.length<=500&&typeof event.updatedAt==='string'&&Number.isFinite(Date.parse(event.updatedAt));
    if(!valid)throw Error('手动考试安排格式无效：'+key);
  }
  if(count>10000)throw Error('手动考试安排最多可保存 10,000 条。');
  return records;
}
async function initializeExamCalendar(records){
  const loaded=records===undefined?await storage.getPrefix(MANUAL_EXAM_PREFIX52):records;
  validateExamCalendarRecords(loaded);
  manualExamRecords52=new Map(Object.entries(loaded).filter(([key])=>key.startsWith(MANUAL_EXAM_PREFIX52)).map(([,event])=>[event.id,structuredClone(event)]));
}
function examCalendarWrite52(operation){
  const write=examCalendarWriteChain52.then(()=>{if(ctx.persistencePaused)throw Error('请等待当前数据操作完成。');return operation();});
  examCalendarWriteChain52=write.catch(()=>{});examCalendarPending52.add(write);
  write.then(()=>examCalendarPending52.delete(write),()=>examCalendarPending52.delete(write));
  return write;
}
async function waitForExamCalendarWrites(){while(examCalendarPending52.size)await Promise.all([...examCalendarPending52]);}
function getManualExamEvents(){return [...manualExamRecords52.values()].map(event=>({...event}));}
function saveManualExamEvent(input){
  const schoolName=String(input.schoolName??'').trim(),resource=getExamScheduleResource();
  const school=resource.examSchedule.find(event=>event.schoolName.trim()===schoolName)||[...manualExamRecords52.values()].find(event=>event.schoolName===schoolName);
  const event={id:input.id||uid(),schoolId:school?.schoolId||'manual:'+schoolName.normalize('NFKC').toLowerCase(),schoolName,date:input.date,stage:input.stage,location:String(input.location??'').trim(),updatedAt:new Date().toISOString()};
  validateExamCalendarRecords({[MANUAL_EXAM_PREFIX52+event.id]:event});
  return examCalendarWrite52(async()=>{
    if(!manualExamRecords52.has(event.id)&&manualExamRecords52.size>=10000)throw Error('手动考试安排已达到 10,000 条。');
    await storage.set(MANUAL_EXAM_PREFIX52+event.id,event);manualExamRecords52.set(event.id,{...event});return {...event};
  });
}
function deleteManualExamEvent(id){return examCalendarWrite52(async()=>{if(!manualExamRecords52.has(id))return false;await storage.remove(MANUAL_EXAM_PREFIX52+id);manualExamRecords52.delete(id);return true;});}
function mergedExamResource52(){
  const resource=getExamScheduleResource();
  return {...resource,examSchedule:[...resource.examSchedule,...getManualExamEvents().map(event=>({...event,manual:true}))]};
}
function examStageLabel52(stage){return stage==='written'?tr('笔试','Written'):stage==='interview'?tr('面试','Interview'):tr('其他','Other');}
function examCalendarDays(month=examCalendarMonth){
  if(typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month)||!journalValidDate(month+'-01'))throw new Error('月份无效。');
  const first=month+'-01',start=journalShiftDate(first,-((new Date(first+'T12:00:00').getDay()+6)%7));
  const end=new Date(first+'T12:00:00');end.setMonth(end.getMonth()+1);end.setDate(0);
  const last=journalDateKey(end),days=[];let date=start;
  do{days.push(date);date=journalShiftDate(date,1);}while(date<=last||days.length%7);
  return days;
}
function examSchoolsForDate(date,resource=mergedExamResource52()){
  const groups=new Map();
  for(const event of resource.examSchedule.filter(item=>item.date===date)){
    if(!groups.has(event.schoolId))groups.set(event.schoolId,{id:event.schoolId,name:event.schoolName,events:[]});
    groups.get(event.schoolId).events.push({...event});
  }
  return [...groups.values()].map(school=>({...school,events:school.events.sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99')||a.stage.localeCompare(b.stage))}));
}
function examCalendarMarkup(){
  const resource=mergedExamResource52(),days=examCalendarDays(),today=journalDateKey(),monthEvents=resource.examSchedule.filter(item=>item.date.startsWith(examCalendarMonth)),schoolCount=new Set(monthEvents.map(event=>event.schoolId)).size;
  const selected=examSchoolsForDate(examCalendarSelected,resource),date=new Date(examCalendarSelected+'T12:00:00');
  const dateCounts=new Map();
  for(const event of resource.examSchedule){
    if(!dateCounts.has(event.date))dateCounts.set(event.date,{schools:new Set(),written:false,interview:false});
    const count=dateCounts.get(event.date);count.schools.add(event.schoolId);count[event.stage]=true;
  }
  const weekday=['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
  return '<div class="exam-calendar-toolbar"><div><p class="eyebrow">ADMISSIONS / CALENDAR</p><h2>'+examCalendarMonth.replace('-',' / ')+'</h2><p class="hint">'+schoolCount+tr(' 所院校 · 本月',' universities this month')+'</p></div><div class="exam-calendar-controls"><label class="field"><span>'+tr('选择月份','Month')+'</span><input type="month" id="examCalendarMonth" min="1900-01" max="9998-12" value="'+examCalendarMonth+'"></label><div class="actions"><button data-exam-month="-1" aria-label="'+tr('上个月','Previous month')+'">‹</button><button data-exam-today>'+tr('今天','Today')+'</button><button data-exam-month="1" aria-label="'+tr('下个月','Next month')+'">›</button></div></div></div>'+ 
    '<div class="exam-calendar-layout"><section class="exam-month-panel" aria-label="'+tr('院校考试月历','University examination calendar')+'"><div class="exam-weekdays" aria-hidden="true">'+['一','二','三','四','五','六','日'].map((day,i)=>'<span>'+tr(day,['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i])+'</span>').join('')+'</div><div class="exam-date-grid">'+days.map(day=>{
      const counts=dateCounts.get(day),count=counts?.schools.size||0,hasWritten=counts?.written,hasInterview=counts?.interview,hasOther=counts?.other;
      return '<button class="exam-day'+(day.startsWith(examCalendarMonth)?'':' outside')+(day===today?' today':'')+(day===examCalendarSelected?' selected':'')+'" data-exam-date="'+day+'" aria-haspopup="dialog" aria-pressed="'+(day===examCalendarSelected)+'" '+(day===today?'aria-current="date"':'')+' aria-label="'+day+' · '+count+tr(' 所院校',' universities')+(hasWritten?tr(' · 笔试',' · Written'):'')+(hasInterview?tr(' · 面试',' · Interview'):'')+(hasOther?tr(' · 其他',' · Other'):'')+'"><span class="exam-day-number">'+Number(day.slice(-2))+'</span>'+(count?'<span class="exam-school-count">'+count+tr(' 所',' schools')+'</span><span class="exam-stage-dots" aria-hidden="true">'+(hasWritten?'<i class="written"></i>':'')+(hasInterview?'<i class="interview"></i>':'')+(hasOther?'<i class="other"></i>':'')+'</span>':'')+'</button>';
    }).join('')+'</div><div class="exam-calendar-legend"><span><i class="written"></i>'+tr('笔试','Written')+'</span><span><i class="interview"></i>'+tr('面试','Interview')+'</span><span><i class="other"></i>'+tr('其他','Other')+'</span></div></section>'+ 
    '<section class="exam-day-panel" id="examDayDetails" aria-live="polite" aria-atomic="true"><p class="eyebrow">'+examCalendarSelected+'</p><h2>'+tr((date.getMonth()+1)+'月'+date.getDate()+'日 · '+weekday,date.toLocaleDateString('en',{month:'short',day:'numeric',weekday:'short'}))+'</h2><p class="hint">'+selected.length+tr(' 所院校的安排',' universities scheduled')+'</p><button class="primary exam-add52" data-manual-exam-add52>'+tr('添加考试','Add exam')+'</button>'+(selected.length?selected.map(school=>'<article class="exam-school-event"><h3>'+esc(school.name)+'</h3>'+school.events.map(event=>'<div class="exam-event-stage"><span class="exam-stage-label '+event.stage+'">'+examStageLabel52(event.stage)+'</span><span>'+esc(event.startTime?(event.startTime+(event.endTime?'–'+event.endTime:'')):tr(event.manual?'时间未填写':'具体时间待公布',event.manual?'No time entered':'Time to be announced'))+'</span>'+(event.location?'<p>'+esc(event.location)+'</p>':'')+(event.note?'<p class="hint">'+esc(event.note)+'</p>':'')+(event.manual?'<div class="exam-manual-actions52"><small>'+tr('手动添加','Manually added')+'</small><button data-manual-exam-edit52="'+esc(event.id)+'">'+tr('编辑','Edit')+'</button><button data-manual-exam-delete52="'+esc(event.id)+'">'+tr('删除','Delete')+'</button></div>':'')+'</div>').join('')+'</article>').join(''):'<div class="exam-calendar-empty">'+tr(resource.examSchedule.length?'这一天暂无已收录的考试安排，可手动添加。':'考试日程尚未安装。点击日期或“添加考试”，即可手动录入安排。',resource.examSchedule.length?'No examinations on this date. You can add one manually.':'No examination schedule is installed. Choose a date or Add exam to enter an event.')+'</div>')+'</section></div>';
}
function examCalendarPage(){
  const description=tr('点击任意日期，查看安排或添加考试。同校同日的多个考试阶段按一所院校计数。','Choose any date to view or add examinations. Each university counts once per date.');
  return '<div class="exam-calendar-page">'+heading3('INFORMATION / EXAMINATIONS',tr('考试信息','Examination calendar'),description)+'<div id="examCalendarRoot">'+examCalendarMarkup()+'</div><p class="hint exam-calendar-note">'+tr('手动安排会随本地记录保存与备份，也可在设置导入考试日程。以院校正式通知为准。','Manual events are saved and backed up with your local records. You can also import schedules in Settings. Follow official university notices.')+'</p>'+examCalendarDialogs52()+'</div>';
}
function examCalendarDialogs52(){
  const names=[...new Set([...(SCHOOLS||[]).map(school=>typeof school==='string'?school:school.name),...getExamScheduleResource().examSchedule.map(event=>event.schoolName),...getManualExamEvents().map(event=>event.schoolName)].filter(Boolean))];
  return '<dialog id="examDateMenu52" class="exam-date-menu52" aria-labelledby="examDateMenuTitle52"><div class="exam-dialog-heading52"><div><p class="eyebrow">EXAMINATION / DATE</p><h2 id="examDateMenuTitle52"></h2></div><button type="button" data-exam-dialog-close52="examDateMenu52" aria-label="'+tr('关闭日期菜单','Close date menu')+'">×</button></div><button class="primary" type="button" data-manual-exam-add52>'+tr('添加考试','Add exam')+' +</button><button type="button" data-exam-date-view52>'+tr('查看当天安排','View this day')+'</button></dialog><dialog id="manualExamEditor52" class="manual-exam-editor52" aria-labelledby="manualExamTitle52"><div class="exam-dialog-heading52"><div><p class="eyebrow">YOUR EXAMINATION</p><h2 id="manualExamTitle52">'+tr('添加考试','Add exam')+'</h2><p class="hint">'+tr('填写院校与考试类型，地点可留空。','Enter a university and examination type. Location is optional.')+'</p></div><button type="button" data-exam-dialog-close52="manualExamEditor52" aria-label="'+tr('关闭考试编辑','Close exam editor')+'">×</button></div><form id="manualExamForm52"><input type="hidden" name="id"><div class="manual-exam-fields52"><label class="field span2"><span>'+tr('考试院校 *','University *')+'</span><input name="schoolName" list="manualExamSchools52" maxlength="200" required placeholder="'+tr('选择或输入院校名称','Choose or type a university')+'"><datalist id="manualExamSchools52">'+names.map(name=>'<option value="'+esc(name)+'"></option>').join('')+'</datalist></label><label class="field"><span>'+tr('考试日期 *','Exam date *')+'</span><input type="date" name="date" required min="1900-01-01" max="9998-12-31"></label><label class="field"><span>'+tr('考试类型 *','Exam type *')+'</span><select name="stage" required><option value="written">'+tr('笔试','Written')+'</option><option value="interview">'+tr('面试','Interview')+'</option><option value="other">'+tr('其他','Other')+'</option></select></label><label class="field span2"><span>'+tr('考试地点（选填）','Location (optional)')+'</span><input name="location" maxlength="500" placeholder="'+tr('例如：校区、楼宇或线上会议入口','Campus, building or online meeting details')+'"></label></div><p id="manualExamError52" class="exam-form-error52" role="alert"></p><div class="actions"><button type="submit" class="primary">'+tr('保存考试安排','Save examination')+'</button><button type="button" data-exam-dialog-close52="manualExamEditor52">'+tr('取消','Cancel')+'</button></div></form></dialog>';
}
function openExamDateMenu52(){
  const dialog=$('#examDateMenu52');if(!dialog)return;
  $('#examDateMenuTitle52').textContent=examCalendarSelected;
  if(!dialog.open)dialog.showModal();
}
function openManualExamEditor52(id){
  const event=id?manualExamRecords52.get(id):null;
  if(id&&!event)return;
  const dialog=$('#manualExamEditor52'),form=$('#manualExamForm52');if(!dialog||!form)return;
  $('#examDateMenu52')?.close();
  const value=event||{id:'',schoolName:'',date:examCalendarSelected,stage:'written',location:''};
  for(const field of ['id','schoolName','date','stage','location'])form.elements.namedItem(field).value=value[field];
  $('#manualExamTitle52').textContent=tr(event?'编辑考试安排':'添加考试',event?'Edit examination':'Add exam');
  $('#manualExamError52').textContent='';
  if(!dialog.open)dialog.showModal();
  form.elements.namedItem('schoolName').focus();
}
function refreshExamCalendar(focusDate){
  const root=$('#examCalendarRoot');if(!root)return;
  const active=document.activeElement,selector=focusDate?'[data-exam-date="'+focusDate+'"]':active?.id?'#'+active.id:active?.dataset?.examMonth?'[data-exam-month="'+active.dataset.examMonth+'"]':active?.hasAttribute?.('data-exam-today')?'[data-exam-today]':null;
  root.innerHTML=examCalendarMarkup();bindExamCalendarControls();
  if(selector)$(selector)?.focus({preventScroll:true});
}
function selectExamCalendarDate(date){
  if(!journalValidDate(date))throw new Error('日期无效。');examCalendarSelected=date;examCalendarMonth=date.slice(0,7);
}
function bindExamCalendarControls(){
  if(!$('#examCalendarRoot'))return;
  $$('[data-exam-date]').forEach(button=>button.onclick=()=>{selectExamCalendarDate(button.dataset.examDate);refreshExamCalendar(examCalendarSelected);openExamDateMenu52();});
  $$('[data-exam-month]').forEach(button=>button.onclick=()=>{
    const date=new Date(examCalendarMonth+'-01T12:00:00');date.setMonth(date.getMonth()+Number(button.dataset.examMonth));
    if(date.getFullYear()<1900||date.getFullYear()>9998)return;examCalendarMonth=journalDateKey(date).slice(0,7);examCalendarSelected=examCalendarMonth+'-01';refreshExamCalendar();
  });
  const today=$('[data-exam-today]');if(today)today.onclick=()=>{selectExamCalendarDate(journalDateKey());refreshExamCalendar(examCalendarSelected);};
  const month=$('#examCalendarMonth');if(month)month.onchange=()=>{if(!month.validity.valid||!month.value||month.value<'1900-01'||month.value>'9998-12')return;selectExamCalendarDate(month.value+'-01');refreshExamCalendar();};
  $$('[data-manual-exam-add52]').forEach(button=>button.onclick=()=>openManualExamEditor52());
  $$('[data-exam-dialog-close52]').forEach(button=>button.onclick=()=>$('#'+button.dataset.examDialogClose52)?.close());
  const view=$('[data-exam-date-view52]');if(view)view.onclick=()=>{$('#examDateMenu52')?.close();$('#examDayDetails')?.scrollIntoView({block:'nearest',behavior:'smooth'});};
  $$('[data-manual-exam-edit52]').forEach(button=>button.onclick=()=>openManualExamEditor52(button.dataset.manualExamEdit52));
  $$('[data-manual-exam-delete52]').forEach(button=>button.onclick=async()=>{
    const event=manualExamRecords52.get(button.dataset.manualExamDelete52);if(!event||ctx.busy)return;
    if(!await confirmAction(tr('删除考试安排？','Delete examination?'),event.date+' · '+event.schoolName+' · '+examStageLabel52(event.stage)))return;
    button.disabled=true;
    try{await deleteManualExamEvent(event.id);refreshExamCalendar();toast(tr('已删除考试安排','Examination deleted'));}catch(error){toast(error.message);button.disabled=false;}
  });
  const form=$('#manualExamForm52');if(form)form.onsubmit=async event=>{
    event.preventDefault();if(ctx.busy||ctx.persistencePaused)return;
    if(!form.reportValidity())return;
    const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;
    try{const data=Object.fromEntries(new FormData(form)),saved=await saveManualExamEvent(data);$('#manualExamEditor52')?.close();selectExamCalendarDate(saved.date);refreshExamCalendar(saved.date);toast(tr('考试安排已保存','Examination saved'));}
    catch(error){$('#manualExamError52').textContent=error.message;}
    finally{submit.disabled=false;}
  };
}
export {examCalendarPage,bindExamCalendarControls,examCalendarDays,examSchoolsForDate,selectExamCalendarDate,initializeExamCalendar,validateExamCalendarRecords,waitForExamCalendarWrites,getManualExamEvents,saveManualExamEvent,deleteManualExamEvent};
