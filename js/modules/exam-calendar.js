import {$,$$,esc,tr,heading3} from '../utils/helpers.js';
import {getExamScheduleResource} from '../resources.js';
import {journalDateKey,journalValidDate,journalShiftDate} from './journal.js';

// Viewing a month or a date is temporary UI state, never user data.
let examCalendarMonth=journalDateKey().slice(0,7),examCalendarSelected=journalDateKey();
function examCalendarDays(month=examCalendarMonth){
  if(typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month)||!journalValidDate(month+'-01'))throw new Error('月份无效。');
  const first=month+'-01',start=journalShiftDate(first,-((new Date(first+'T12:00:00').getDay()+6)%7));
  const end=new Date(first+'T12:00:00');end.setMonth(end.getMonth()+1);end.setDate(0);
  const last=journalDateKey(end),days=[];let date=start;
  do{days.push(date);date=journalShiftDate(date,1);}while(date<=last||days.length%7);
  return days;
}
function examSchoolsForDate(date,resource=getExamScheduleResource()){
  const groups=new Map();
  for(const event of resource.examSchedule.filter(item=>item.date===date)){
    if(!groups.has(event.schoolId))groups.set(event.schoolId,{id:event.schoolId,name:event.schoolName,events:[]});
    groups.get(event.schoolId).events.push({...event});
  }
  return [...groups.values()].map(school=>({...school,events:school.events.sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99')||a.stage.localeCompare(b.stage))}));
}
function examCalendarMarkup(){
  const resource=getExamScheduleResource(),days=examCalendarDays(),today=journalDateKey(),monthEvents=resource.examSchedule.filter(item=>item.date.startsWith(examCalendarMonth)),schoolCount=new Set(monthEvents.map(event=>event.schoolId)).size;
  const selected=examSchoolsForDate(examCalendarSelected,resource),date=new Date(examCalendarSelected+'T12:00:00');
  const dateCounts=new Map();
  for(const event of resource.examSchedule){
    if(!dateCounts.has(event.date))dateCounts.set(event.date,{schools:new Set(),written:false,interview:false});
    const count=dateCounts.get(event.date);count.schools.add(event.schoolId);count[event.stage]=true;
  }
  const weekday=['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
  return '<div class="exam-calendar-toolbar"><div><p class="eyebrow">ADMISSIONS / CALENDAR</p><h2>'+examCalendarMonth.replace('-',' / ')+'</h2><p class="hint">'+schoolCount+tr(' 所院校 · 本月',' universities this month')+'</p></div><div class="exam-calendar-controls"><label class="field"><span>'+tr('选择月份','Month')+'</span><input type="month" id="examCalendarMonth" min="1900-01" max="9998-12" value="'+examCalendarMonth+'"></label><div class="actions"><button data-exam-month="-1" aria-label="'+tr('上个月','Previous month')+'">‹</button><button data-exam-today>'+tr('今天','Today')+'</button><button data-exam-month="1" aria-label="'+tr('下个月','Next month')+'">›</button></div></div></div>'+ 
    '<div class="exam-calendar-layout"><section class="exam-month-panel" aria-label="'+tr('院校考试月历','University examination calendar')+'"><div class="exam-weekdays" aria-hidden="true">'+['一','二','三','四','五','六','日'].map((day,i)=>'<span>'+tr(day,['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i])+'</span>').join('')+'</div><div class="exam-date-grid">'+days.map(day=>{
      const counts=dateCounts.get(day),count=counts?.schools.size||0,hasWritten=counts?.written,hasInterview=counts?.interview;
      return '<button class="exam-day'+(day.startsWith(examCalendarMonth)?'':' outside')+(day===today?' today':'')+(day===examCalendarSelected?' selected':'')+'" data-exam-date="'+day+'" aria-pressed="'+(day===examCalendarSelected)+'" '+(day===today?'aria-current="date"':'')+' aria-label="'+day+' · '+count+tr(' 所院校',' universities')+(hasWritten?tr(' · 笔试',' · Written'):'')+(hasInterview?tr(' · 面试',' · Interview'):'')+'"><span class="exam-day-number">'+Number(day.slice(-2))+'</span>'+(count?'<span class="exam-school-count">'+count+tr(' 所',' schools')+'</span><span class="exam-stage-dots" aria-hidden="true">'+(hasWritten?'<i class="written"></i>':'')+(hasInterview?'<i class="interview"></i>':'')+'</span>':'')+'</button>';
    }).join('')+'</div><div class="exam-calendar-legend"><span><i class="written"></i>'+tr('笔试','Written')+'</span><span><i class="interview"></i>'+tr('面试','Interview')+'</span></div></section>'+ 
    '<section class="exam-day-panel" id="examDayDetails" aria-live="polite" aria-atomic="true"><p class="eyebrow">'+examCalendarSelected+'</p><h2>'+tr((date.getMonth()+1)+'月'+date.getDate()+'日 · '+weekday,date.toLocaleDateString('en',{month:'short',day:'numeric',weekday:'short'}))+'</h2><p class="hint">'+selected.length+tr(' 所院校的安排',' universities scheduled')+'</p>'+(selected.length?selected.map(school=>'<article class="exam-school-event"><h3>'+esc(school.name)+'</h3>'+school.events.map(event=>'<div class="exam-event-stage"><span class="exam-stage-label '+event.stage+'">'+tr(event.stage==='written'?'笔试':'面试',event.stage==='written'?'Written':'Interview')+'</span><span>'+esc(event.startTime?(event.startTime+(event.endTime?'–'+event.endTime:'')):tr('具体时间待公布','Time to be announced'))+'</span>'+(event.location?'<p>'+esc(event.location)+'</p>':'')+(event.note?'<p class="hint">'+esc(event.note)+'</p>':'')+'</div>').join('')+'</article>').join(''):'<div class="exam-calendar-empty">'+tr(resource.examSchedule.length?'这一天暂无已收录的考试安排。':'考试日程尚未安装。后续导入或更新资源后，会在对应日期显示院校与笔试、面试安排。',resource.examSchedule.length?'No recorded examinations on this date.':'No examination schedule is installed. Imported or updated schedules will appear here with written and interview stages.')+'</div>')+'</section></div>';
}
function examCalendarPage(){
  const installed=getExamScheduleResource().examSchedule.length>0;
  const description=installed?tr('点击日期查看笔试与面试安排。同校同日的多个考试阶段按一所院校计数。','Choose a date to view written and interview stages. Each university counts once per date.'):tr('按日期查看院校考试安排。具体日程将在后续更新，目前不预填日期。','Browse university examinations by date. Schedules will arrive in a later update; no dates are prefilled.');
  return '<div class="exam-calendar-page">'+heading3('INFORMATION / EXAMINATIONS',tr('考试信息','Examination calendar'),description)+'<div id="examCalendarRoot">'+examCalendarMarkup()+'</div><p class="hint exam-calendar-note">'+tr('可在设置 → 题库与资源，导入考试日程 JSON，或主动获取最新版资源。以院校正式通知为准。','Import a schedule JSON or request the latest resources in Settings. Follow each university’s official notices.')+'</p></div>';
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
  $$('[data-exam-date]').forEach(button=>button.onclick=()=>{selectExamCalendarDate(button.dataset.examDate);refreshExamCalendar(examCalendarSelected);});
  $$('[data-exam-month]').forEach(button=>button.onclick=()=>{
    const date=new Date(examCalendarMonth+'-01T12:00:00');date.setMonth(date.getMonth()+Number(button.dataset.examMonth));
    if(date.getFullYear()<1900||date.getFullYear()>9998)return;examCalendarMonth=journalDateKey(date).slice(0,7);examCalendarSelected=examCalendarMonth+'-01';refreshExamCalendar();
  });
  const today=$('[data-exam-today]');if(today)today.onclick=()=>{selectExamCalendarDate(journalDateKey());refreshExamCalendar(examCalendarSelected);};
  const month=$('#examCalendarMonth');if(month)month.onchange=()=>{if(!month.validity.valid||!month.value||month.value<'1900-01'||month.value>'9998-12')return;selectExamCalendarDate(month.value+'-01');refreshExamCalendar();};
}
export {examCalendarPage,bindExamCalendarControls,examCalendarDays,examSchoolsForDate,selectExamCalendarDate};
