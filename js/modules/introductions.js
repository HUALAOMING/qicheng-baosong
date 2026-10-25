import {ctx} from '../state.js';
import {$,$$,esc,tr,toast,uid} from '../utils/helpers.js';
import {scheduleSave} from '../autosave.js';
import {changed,render,confirmAction} from '../app.js';

let introActive52='', introEditing52=false, introInterval52=null;
const introTimers52=new Map();
function introductionDuration52(minutes,seconds){
  if(String(minutes).trim()===''&&String(seconds).trim()==='')return 0;
  const m=Number(minutes||0),s=Number(seconds||0);
  return Number.isInteger(m)&&Number.isInteger(s)&&m>=0&&s>=0?m*60+s:NaN;
}
function introductionCount52(text,language){
  if(/中文|汉语|漢語|普通话|chinese|^zh(?:-|$)/i.test(language))return {count:(text.match(/[\p{L}\p{N}]/gu)||[]).length,unit:tr('字','characters')};
  return {count:(text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[]).length,unit:tr('词','words')};
}
function introductionLabel52(item){return item.title||item.language+' · '+Math.floor(item.durationSeconds/60)+tr('分','m')+(item.durationSeconds%60?item.durationSeconds%60+tr('秒','s'):'');}
function introductionClock52(id,duration,now=Date.now()){
  const timer=introTimers52.get(id)||{elapsed:0,started:null};
  const elapsed=timer.elapsed+(timer.started!==null?Math.max(0,now-timer.started):0);
  const difference=duration*1000-elapsed;
  return {elapsed,seconds:difference>=0?Math.ceil(difference/1000):Math.floor(-difference/1000),overtime:difference<0,running:timer.started!==null};
}
function introClockText52(clock){return String(Math.floor(clock.seconds/60)).padStart(2,'0')+':'+String(clock.seconds%60).padStart(2,'0');}
function introductionTimerAction52(item,action,now=Date.now()){
  const timer=introTimers52.get(item.id)||{elapsed:0,started:null};
  if(action==='reset'){timer.elapsed=0;timer.started=null;}
  else if(action==='toggle'){
    if(timer.started!==null){timer.elapsed+=Math.max(0,now-timer.started);timer.started=null;}
    else timer.started=now;
  }
  introTimers52.set(item.id,timer);return introductionClock52(item.id,item.durationSeconds,now);
}
function blankIntroduction52(){return {id:'',title:'',language:'',minutes:'1',seconds:'0',note:'',body:''};}
function startIntroduction52(){
  // An existing-version edit must never turn the New version action into an update.
  if(ctx.state.introductionDraft.id)ctx.state.introductionDraft=blankIntroduction52();
  introActive52='';introEditing52=true;
}
function resetIntroductions52(){
  clearInterval(introInterval52);introInterval52=null;
  introActive52='';introEditing52=false;introTimers52.clear();
}
function introForm52(){
  const d=ctx.state.introductionDraft,count=introductionCount52(d.body,d.language);
  return '<section class="panel intro-form52"><h2>'+tr(d.id?'编辑自我介绍':'新增自我介绍',d.id?'Edit introduction':'New introduction')+'</h2><form id="introductionForm52"><div class="grid2"><label class="field"><span>'+tr('版本名称（选填）','Version name (optional)')+'</span><input name="title" maxlength="200" value="'+esc(d.title)+'" placeholder="例如：英文1分钟版"></label><label class="field"><span>'+tr('自我介绍语言 *','Language *')+'</span><input name="language" required maxlength="100" value="'+esc(d.language)+'" placeholder="中文 / 英语 / 其他语种"></label></div><label class="field"><span>'+tr('自我介绍时长 *','Duration *')+'</span><div class="intro-duration52"><input name="minutes" type="number" min="0" max="1440" step="1" aria-label="分钟" value="'+esc(d.minutes)+'"><span>'+tr('分钟','minutes')+'</span><input name="seconds" type="number" min="0" max="86400" step="1" aria-label="秒" value="'+esc(d.seconds)+'"><span>'+tr('秒','seconds')+'</span><button type="button" data-intro-convert52>'+tr('换算分秒','Normalize')+'</button></div><small>'+tr('可直接输入 90 秒，点击换算即为 1 分 30 秒。','For example, normalize 90 seconds to 1 minute 30 seconds.')+'</small></label><label class="field"><span>'+tr('备注（选填）','Notes (optional)')+'</span><input name="note" maxlength="2000" value="'+esc(d.note)+'"></label><label class="field"><span class="intro-body-label52">'+tr('正文 *','Script *')+'<output id="introCount52">'+count.count+' '+count.unit+'</output></span><textarea name="body" required maxlength="100000" rows="12" placeholder="在这里撰写你的自我介绍…">'+esc(d.body)+'</textarea><small>'+tr('中文字数 / 英文词数均不含标点符号。','Punctuation is excluded from character and word counts.')+'</small></label><div class="actions"><button class="primary" type="submit">'+tr('保存自我介绍','Save introduction')+'</button><button type="button" data-intro-cancel52>'+tr('取消','Cancel')+'</button></div><p id="introError52" role="alert"></p></form></section>';
}
function introductionsPage52(){
  clearInterval(introInterval52);introInterval52=null;
  const item=ctx.state.introductions.find(x=>x.id===introActive52);
  if(item&&!introEditing52){
    const clock=introductionClock52(item.id,item.durationSeconds),count=introductionCount52(item.body,item.language);
    return '<div class="introductions52"><button data-intro-back52>← '+tr('全部自我介绍','All introductions')+'</button><header class="page-head"><div><p class="eyebrow">REHEARSE / YOUR STORY</p><h1>'+esc(introductionLabel52(item))+'</h1><p>'+esc(item.language)+' · '+Math.floor(item.durationSeconds/60)+tr(' 分 ','m ')+item.durationSeconds%60+tr(' 秒','s')+' · '+count.count+' '+count.unit+'</p></div><button data-intro-edit52="'+esc(item.id)+'">'+tr('编辑','Edit')+'</button></header><div class="intro-review52"><article class="panel"><p class="intro-script52">'+esc(item.body)+'</p>'+(item.note?'<p class="hint">'+esc(item.note)+'</p>':'')+'</article><aside class="panel intro-timer52"><p>'+tr('朗读计时','Rehearsal timer')+'</p><output id="introClock52" class="'+(clock.overtime?'overtime':'')+'">'+introClockText52(clock)+'</output><p id="introTimerStatus52" role="status">'+(clock.overtime?tr('已超出 ','Overtime: ')+clock.seconds+tr(' 秒',' seconds'):tr('倒计时结束后自动记录超时','Overtime starts after the countdown'))+'</p><div class="actions"><button class="primary" data-intro-timer52="toggle">'+tr(clock.running?'暂停':'开始 / 继续',clock.running?'Pause':'Start / resume')+'</button><button data-intro-timer52="reset">'+tr('重置','Reset')+'</button></div><p class="hint">'+tr('切换页面后计时仍会继续；刷新页面会重置计时。','Timing continues across pages and resets on reload.')+'</p></aside></div></div>';
  }
  return '<div class="introductions52"><header class="page-head"><div><p class="eyebrow">LEARNING / INTRODUCTIONS</p><h1>'+tr('自我介绍汇总','Self introductions')+'</h1><p>'+tr('保存不同语言和时长的版本，随时朗读与复习。','Keep versions for different languages and durations, ready to rehearse.')+'</p></div><button class="primary" data-intro-new52>＋ '+tr('新增版本','New version')+'</button></header>'+(introEditing52?introForm52():'<div class="intro-grid52">'+(ctx.state.introductions.length?ctx.state.introductions.map(x=>'<article class="panel intro-card52"><button class="intro-open52" data-intro-open52="'+esc(x.id)+'"><span class="eyebrow">'+esc(x.language)+'</span><h2>'+esc(introductionLabel52(x))+'</h2><p>'+Math.floor(x.durationSeconds/60)+tr(' 分 ','m ')+x.durationSeconds%60+tr(' 秒','s')+'</p>'+(x.note?'<p class="hint">'+esc(x.note)+'</p>':'')+'</button><div class="actions"><button data-intro-edit52="'+esc(x.id)+'">'+tr('编辑','Edit')+'</button><button data-intro-delete52="'+esc(x.id)+'">'+tr('删除','Delete')+'</button></div></article>').join(''):'<div class="empty">'+tr('还没有自我介绍，先录入一个版本。','Create your first introduction.')+'</div>')+'</div>')+'</div>';
}
function updateIntroClock52(){
  const item=ctx.state?.introductions.find(x=>x.id===introActive52),out=$('#introClock52');if(!item||!out)return;
  const clock=introductionClock52(item.id,item.durationSeconds);out.textContent=introClockText52(clock);out.classList.toggle('overtime',clock.overtime);
  $('#introTimerStatus52').textContent=clock.overtime?tr('已超出 ','Overtime: ')+clock.seconds+tr(' 秒',' seconds'):tr('剩余 ','Remaining: ')+clock.seconds+tr(' 秒',' seconds');
  $('[data-intro-timer52="toggle"]').textContent=tr(clock.running?'暂停':'开始 / 继续',clock.running?'Pause':'Start / resume');
}
function bindIntroductions52(){
  clearInterval(introInterval52);introInterval52=null;
  const add=$('[data-intro-new52]');if(add)add.onclick=()=>{startIntroduction52();render();};
  const back=$('[data-intro-back52]');if(back)back.onclick=()=>{introActive52='';introEditing52=false;render();};
  const cancel=$('[data-intro-cancel52]');if(cancel)cancel.onclick=()=>{introEditing52=false;render();};
  $$('[data-intro-open52]').forEach(b=>b.onclick=()=>{introActive52=b.dataset.introOpen52;introEditing52=false;render();});
  $$('[data-intro-edit52]').forEach(b=>b.onclick=()=>{const x=ctx.state.introductions.find(x=>x.id===b.dataset.introEdit52);ctx.state.introductionDraft={...x,minutes:String(Math.floor(x.durationSeconds/60)),seconds:String(x.durationSeconds%60)};introActive52=x.id;introEditing52=true;changed();});
  $$('[data-intro-delete52]').forEach(b=>b.onclick=async()=>{if(!await confirmAction('删除这个自我介绍？','删除后可通过本地存档恢复。','删除'))return;ctx.state.introductions=ctx.state.introductions.filter(x=>x.id!==b.dataset.introDelete52);introTimers52.delete(b.dataset.introDelete52);if(ctx.state.introductionDraft.id===b.dataset.introDelete52)ctx.state.introductionDraft=blankIntroduction52();changed();});
  const form=$('#introductionForm52');if(form){
    form.oninput=()=>{for(const name of ['title','language','minutes','seconds','note','body'])ctx.state.introductionDraft[name]=form.elements[name].value;const count=introductionCount52(form.elements.body.value,form.elements.language.value);$('#introCount52').textContent=count.count+' '+count.unit;scheduleSave();};
    $('[data-intro-convert52]').onclick=()=>{const d=ctx.state.introductionDraft,total=introductionDuration52(d.minutes,d.seconds);if(!Number.isFinite(total)||total<1||total>86400)return toast('请填写 1 秒至 24 小时的有效时长');d.minutes=String(Math.floor(total/60));d.seconds=String(total%60);form.elements.minutes.value=d.minutes;form.elements.seconds.value=d.seconds;scheduleSave();};
    form.onsubmit=e=>{e.preventDefault();const d=ctx.state.introductionDraft,durationSeconds=introductionDuration52(d.minutes,d.seconds);if(!d.language.trim()||!d.body.trim()||!Number.isFinite(durationSeconds)||durationSeconds<1||durationSeconds>86400){$('#introError52').textContent='请填写语言、正文及有效时长（至少 1 秒）。';return;}if(!d.id&&ctx.state.introductions.length>=1000)return toast('最多保存1000个版本');const item={id:d.id||uid(),title:d.title.trim(),language:d.language.trim(),durationSeconds,note:d.note.trim(),body:d.body,updatedAt:new Date().toISOString()};const i=ctx.state.introductions.findIndex(x=>x.id===item.id);if(i<0)ctx.state.introductions.unshift(item);else ctx.state.introductions[i]=item;introTimers52.delete(item.id);ctx.state.introductionDraft=blankIntroduction52();introActive52=item.id;introEditing52=false;changed();toast('自我介绍已收录');};
  }
  $$('[data-intro-timer52]').forEach(b=>b.onclick=()=>{const item=ctx.state.introductions.find(x=>x.id===introActive52);if(item){introductionTimerAction52(item,b.dataset.introTimer52);updateIntroClock52();}});
  if($('#introClock52')){updateIntroClock52();introInterval52=setInterval(updateIntroClock52,200);}
}
function introductionPicker52(target){
  const items=ctx.state.introductions;
  return '<div class="statement-import52"><select data-intro-choice52="'+target+'" aria-label="选择自我介绍版本"><option value="">'+tr('选择任意自我介绍版本','Choose an introduction')+'</option>'+items.map(x=>'<option value="'+esc(x.id)+'">'+esc(introductionLabel52(x))+' · '+esc(x.language)+'</option>').join('')+'</select><button type="button" data-intro-import52="'+target+'">'+tr('从自我介绍导入','Import introduction')+'</button></div>';
}
function bindIntroductionImports52(){
  $$('[data-intro-import52]').forEach(b=>b.onclick=async()=>{const target=b.dataset.introImport52,selected=$('[data-intro-choice52="'+target+'"]').value,item=ctx.state.introductions.find(x=>x.id===selected);if(!item)return toast('请先选择一个自我介绍版本');if(ctx.state.statement[target]&&!await confirmAction('替换当前个人陈述？','将复制所选自我介绍正文。原自我介绍版本会保留。','替换'))return;ctx.state.statement[target]=item.body;if(target==='other')ctx.state.statement.otherLanguage=item.language;changed();toast('已导入，可继续修改');});
}
export {introductionsPage52,bindIntroductions52,introductionPicker52,bindIntroductionImports52,introductionCount52,introductionDuration52,introductionClock52,introductionTimerAction52,blankIntroduction52,startIntroduction52,resetIntroductions52};
