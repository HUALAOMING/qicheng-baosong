import {resolveResume53} from './resume-model53.js';
import {loadedFeature53} from './features53.js';
import {selectSettingsCategory53} from './modules/settings.js';
import {ctx} from './state.js';
import {storage} from './storage.js';
import {SCHOOL_DETAILS3} from './data.js';
import {initializeResources,listImportedQuizPackSummaries,listPracticeBankSummaries,getResourceVersions,queryQuestions} from './resources.js';
import {getQuizDraftRecord,QUIZ_DRAFT_KEY} from './modules/quiz.js';
import {esc} from './utils/helpers.js';
import {go3} from './app.js';
import {isLite53} from './runtime53.js';
const settingsSearch53=[['外观与界面 主题 语言 运行模式','appearance'],['启动与导航 默认启动页面','navigation'],['数据与存储 持久存储 本地保存 备份 恢复 Markdown','storage'],['学习与答题 题数 题库 资源 每日一句','learning'],['更新与离线 新版本 PWA 更新日志','updates'],['关于启程 帮助 版本信息','about']];
let searchGeneration53=0,searchDebounce53=null,searchBound53=false,searchRows53=[],searchPrivacyChannel53=null,searchPrivacyBound53=false,searchRefresh53=null,activeSearch53=null,searchDismissDocumentBound53=false;
async function protectedSearchIds53(){const drafts=[getQuizDraftRecord(),await storage.get(QUIZ_DRAFT_KEY)].filter(Boolean);return new Set(drafts.flatMap(draft=>(draft.questions||[]).map(q=>JSON.stringify([q.learningBankId||draft.bankId,q.learningQuestionId||q.id]))));}
function searchSnippet53(text,term){const value=String(text||''),index=value.toLocaleLowerCase().indexOf(term);return value.slice(Math.max(0,index-35),Math.max(0,index-35)+160);}
function highlightSearch53(value,query){const text=String(value),term=query.toLocaleLowerCase();let result='',cursor=0,index;while(term&&(index=text.toLocaleLowerCase().indexOf(term,cursor))>=0){result+=esc(text.slice(cursor,index))+'<mark>'+esc(text.slice(index,index+query.length))+'</mark>';cursor=index+query.length;}return result+esc(text.slice(cursor));}
async function globalSearch53(query,{cancelled=()=>false,onStage=()=>{}}={}){
 const term=query.trim().toLocaleLowerCase();if(term.length<1||term.length>200)return [];
 const rows=[],add=(group,title,text,route,target={})=>{if(rows.length>=120)return;const full=String(title)+' '+String(text);if(full.toLocaleLowerCase().includes(term))rows.push({group,title:String(title),snippet:searchSnippet53(text,term),route,...target});};
 for(const school of SCHOOL_DETAILS3)add('院校',school.name,JSON.stringify(school),'school:'+encodeURIComponent(school.name));
 for(const v of ctx.state.versions||[])add('简历版本',v.name,[v.target,...(v.targets53||[])].join(' '),(isLite53()?'resume-review:':'resume-editor:')+v.id);
 const masterRoutes53={profile:'profile',education:'education',statement:'statement',academics:'academics',awards:'awards',experiences:'experiences',practices:'practices',achievements:'achievements',customBlocks:'custom',learning:'learning',introductions:'self-introductions'};
 const walk=(value,path,route,recordId=null)=>{if(cancelled()||rows.length>=100)return;if(typeof value==='string'){if(!value.startsWith('data:')&&value.toLocaleLowerCase().includes(term))add('个人资料',( {profile:'个人基本信息',education:'教育经历',statement:'个人陈述',academics:'语言成绩',awards:'荣誉',experiences:'经历',practices:'社会实践',achievements:'个人成果',custom:'自定义内容',learning:'阅读与学习','self-introductions':'自我介绍'}[route]||'个人资料')+' · '+({name:'姓名',title:'标题',text:'正文',note:'备注',zh:'中文',en:'英文',reflection:'收获',role:'角色',school:'学校',email:'邮箱',phone:'电话',date:'日期'}[path.split('.').at(-1)]||'内容'),value,route,{field:path,recordId});return;}if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value))if(!['data','_assetPreview','_assetBlobRef','photos','assets'].includes(key))walk(child,path+'.'+key,route,value.id||recordId);};
 for(const [key,route]of Object.entries(masterRoutes53))walk(ctx.state[key],key,route);
 for(const [label,category]of settingsSearch53)add('设置',label,label,'settings',{category});
 if(cancelled())return rows;
 onStage('准备题库索引');await initializeResources({metadataOnly:true});
 const protectedIds=await protectedSearchIds53();
 const notes=await storage.getPrefix('question:note:');
 for(const note of Object.values(notes)){if(protectedIds.has(JSON.stringify([note.bankId,note.questionId])))continue;add('个人笔记',note.bankId+' · '+note.questionId,note.text,'question:'+encodeURIComponent(note.bankId)+'/'+encodeURIComponent(note.questionId),{focusNote:true,bankId:note.bankId,questionId:note.questionId});}
 const summaries=listPracticeBankSummaries(),sourceNames=new Map();for(const b of summaries)for(const id of b.sourceBankIds||[])sourceNames.set(id,b.bank.name);
 const packIds=getResourceVersions().banks.map(b=>b.id);
 for(let index=0;index<packIds.length;index++){
  if(cancelled()||rows.length>=120)break;const bankId=packIds[index];onStage('搜索题库 '+(index+1)+'/'+packIds.length);
  let offset=0,revision;do{
   const page=await queryQuestions(bankId,{offset,limit:30,keyword:term,expectedRevision:revision});revision=page.revision;
   for(const q of page.items)if(!protectedIds.has(JSON.stringify([bankId,q.id])))add('题目',(sourceNames.get(bankId)||bankId)+' · '+q.id,[q.question,...(q.options||[]).map(o=>o.text),q.explanation].join(' '),'question:'+encodeURIComponent(bankId)+'/'+encodeURIComponent(q.id),{bankId,questionId:q.id});
   offset=page.nextOffset;
  }while(offset!==null&&!cancelled()&&rows.length<120);
 }
 const finalGuard53=await protectedSearchIds53();return rows.filter(row=>!row.bankId||!finalGuard53.has(JSON.stringify([row.bankId,row.questionId])));
}
function resumeSearch53(query){
 const term=query.trim().toLocaleLowerCase();if(!term||term.length>200)return [];
 const {modules,version}=resolveResume53(ctx.state.activeVersion);if(!version)return [];
 const rows=[];const add=(title,text,module,recordId='',path='')=>{if(rows.length>=120)return;const full=String(title)+' '+String(text);if(full.toLocaleLowerCase().includes(term))rows.push({group:'当前简历',title:String(title),snippet:searchSnippet53(text,term),resumeTarget:{module,recordId,path}});};
 for(const module of modules){add(module.title,module.hidden?'此模块已隐藏':'简历模块',module.key);for(const entry of module.entries){if(entry.title)add(module.title+' · '+entry.title,entry.hidden?'此条目已隐藏':'简历条目',module.key,entry.id);for(const field of entry.fields)add(module.title+' · '+field.label,field.value,module.key,entry.id,field.path);}}
 return rows;
}
async function openSearch53(){
 if(!searchPrivacyBound53){searchPrivacyBound53=true;const invalidate=()=>{const dialog=document.getElementById('globalSearch53');if(!dialog?.open)return;searchGeneration53++;document.getElementById('globalSearchResults53')?.replaceChildren();const status=document.getElementById('globalSearchStatus53');if(status)status.textContent='资料或题组状态已变化，正在重新搜索…';clearTimeout(searchDebounce53);searchDebounce53=setTimeout(()=>{if(dialog.open&&dialog.querySelector('#globalSearchInput53')?.value.trim())searchRefresh53?.();},250);};globalThis.addEventListener?.('qicheng-local-write',invalidate);if(globalThis.BroadcastChannel){searchPrivacyChannel53=new BroadcastChannel('qicheng-learning-53');searchPrivacyChannel53.onmessage=invalidate;}}
 const anchor=[...document.querySelectorAll('.global-search-anchor53')].find(node=>node.getClientRects().length>0);if(!anchor)return;
 let dialog=document.getElementById('globalSearch53');if(dialog&&dialog.parentElement!==anchor)anchor.append(dialog);if(!dialog){dialog=document.createElement('div');dialog.id='globalSearch53';dialog.className='global-search-inline53';dialog.innerHTML='<form id="globalSearchForm53" role="search"><input id="globalSearchInput53" maxlength="200" placeholder="搜索题目、笔记、简历或设置" aria-label="全局搜索" aria-controls="globalSearchResults53" autocomplete="off" tabindex="-1"><button type="submit" class="search-submit53" aria-label="查找">查找</button><button type="button" id="globalSearchClose53" aria-label="收起搜索">×</button></form><div class="global-search-dropdown53" hidden><p id="globalSearchStatus53" role="status">输入关键词搜索；未交卷题目及笔记会隐藏。</p><div id="globalSearchResults53" class="search-results53"></div></div>';anchor.append(dialog);}
 dialog.close=()=>{dialog.open=false;if(activeSearch53===dialog)activeSearch53=null;anchor.classList.remove('is-search-open53');anchor.querySelector('[data-open-search53]')?.setAttribute('aria-expanded','false');dialog.querySelector('.global-search-dropdown53').hidden=true;dialog.querySelector('input').tabIndex=-1;searchGeneration53++;clearTimeout(searchDebounce53);};
 if(!searchDismissDocumentBound53){searchDismissDocumentBound53=true;document.addEventListener('pointerdown',event=>{if(activeSearch53?.open&&!activeSearch53.parentElement?.contains(event.target))activeSearch53.close();});}if(!dialog.dataset.searchDismissBound53){dialog.dataset.searchDismissBound53='true';dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close();dialog.parentElement?.querySelector('[data-open-search53]')?.focus();}else if(event.key==='ArrowDown'&&event.target.id==='globalSearchInput53'){event.preventDefault();dialog.querySelector('[data-search-result53]')?.focus();}});}
 const box=anchor.getBoundingClientRect(),width=Math.min(460,innerWidth-32),left=Math.max(16,Math.min(innerWidth-width-16,box.right-width));dialog.style.width=width+'px';dialog.style.left=(left-box.left)+'px';
 const input=dialog.querySelector('#globalSearchInput53'),status=dialog.querySelector('#globalSearchStatus53'),results=dialog.querySelector('#globalSearchResults53');
 const resumeScope=ctx.state.route.startsWith('resume-editor:');input.placeholder=resumeScope?'搜索当前简历中的内容':'搜索题目、笔记、简历或设置';input.setAttribute('aria-label',resumeScope?'搜索当前简历':'全局搜索');status.textContent=resumeScope?'仅搜索当前编辑的简历。':'输入关键词搜索；未交卷题目及笔记会隐藏。';input.value='';results.replaceChildren();
 const run=async()=>{const generation=++searchGeneration53,query=input.value.trim();results.replaceChildren();if(!query){status.textContent='请输入关键词。';return;}status.textContent='正在搜索…';try{const rows=resumeScope?resumeSearch53(query):await globalSearch53(query,{cancelled:()=>generation!==searchGeneration53||!dialog.open||!dialog.isConnected,onStage:stage=>{if(generation===searchGeneration53)status.textContent=stage;}});if(generation!==searchGeneration53||!dialog.open||!dialog.isConnected)return;searchRows53=rows;const groups=[...new Set(rows.map(r=>r.group))];results.innerHTML=groups.map(group=>'<section><h3>'+esc(group)+'</h3>'+rows.map((row,index)=>row.group===group?'<button data-search-result53="'+index+'"><strong>'+highlightSearch53(row.title,query)+'</strong><small>'+highlightSearch53(row.snippet,query)+'</small></button>':'').join('')+'</section>').join('');status.textContent=rows.length?'找到 '+rows.length+' 项'+(rows.length>=120?'，请缩小关键词以查看更多。':'。'):'没有匹配项。';results.querySelectorAll('[data-search-result53]').forEach(button=>button.onclick=async()=>{const row=searchRows53[+button.dataset.searchResult53];dialog.close();if(row.resumeTarget){const t=row.resumeTarget;loadedFeature53('resume')?.focusResumeSearch53(t.module,t.recordId,t.path);return;}await go3(row.route);if(row.category){selectSettingsCategory53(row.category);}if(row.field){const field=[...document.querySelectorAll('[data-bind]')].find(e=>e.dataset.bind===row.field);field?.scrollIntoView({block:'center'});field?.focus();field?.select?.();if(!field&&row.recordId){const target=[...document.querySelectorAll('button')].find(button=>Object.values(button.dataset).some(value=>value===row.recordId||value.endsWith(':'+row.recordId)));target?.scrollIntoView({block:'center'});target?.focus();}}if(row.focusNote)document.querySelector('[data-note53-bank]')?.scrollIntoView({block:'center'});});}catch(error){if(generation===searchGeneration53)status.textContent='搜索未完成：'+error.message;}};
 searchRefresh53=run;
 input.oninput=()=>{clearTimeout(searchDebounce53);searchGeneration53++;searchDebounce53=setTimeout(run,250);};dialog.querySelector('#globalSearchForm53').onsubmit=event=>{event.preventDefault();clearTimeout(searchDebounce53);run();};dialog.querySelector('#globalSearchClose53').onclick=()=>dialog.close();if(activeSearch53&&activeSearch53!==dialog)activeSearch53.close();activeSearch53=dialog;dialog.open=true;anchor.classList.add('is-search-open53');anchor.querySelector('[data-open-search53]')?.setAttribute('aria-expanded','true');dialog.querySelector('.global-search-dropdown53').hidden=false;input.tabIndex=0;input.focus();
}
function bindSearchShortcut53(){if(searchBound53)return;searchBound53=true;document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openSearch53();}});}
export {resumeSearch53,globalSearch53,openSearch53,highlightSearch53,protectedSearchIds53,bindSearchShortcut53};
