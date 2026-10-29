import {ctx} from './state.js';
import {newVersion} from './model.js';
import {MODULES,MODULE_NAMES,PROFILE,EDU_FIELDS,AWARD_FIELDS,EXP_FIELDS,EXAM_FIELDS,BOOK_FIELDS,ACHIEVEMENT_FIELDS} from './constants.js';
import {uid} from './utils/helpers.js';
const resumeMasterKeys53=['profile','education','statement','academics','awards','experiences','practices','achievements','exams','learning','customBlocks','avatar','avatarCrop','media'];
const resumeRecordModules53={education:'education',awards:'awards',experiences:'experiences',practices:'practices',achievements:'achievements',exams:'exams',learning:'learning.books',custom:'customBlocks'};
const resumeFieldDefs53={profile:PROFILE,education:[['stage','教育阶段'],...EDU_FIELDS],statement:[['zh','中文个人陈述'],['en','英文个人陈述'],['otherLanguage','其他语种'],['other','其他语种陈述']],academics:[['languageLearning','语言学习'],['certificates','证书与等级']],strengths:[['strengths','个人特长'],['hobbies','兴趣爱好']],awards:AWARD_FIELDS,experiences:EXP_FIELDS,practices:EXP_FIELDS,achievements:ACHIEVEMENT_FIELDS,exams:EXAM_FIELDS,learning:BOOK_FIELDS,custom:[['title','标题'],['text','正文']]};
function copyResume53(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function captureResumeMaster53(state=ctx.state){
 const clean=value=>{if(!value||typeof value!=='object')return value;if(Array.isArray(value))return value.map(clean);return Object.fromEntries(Object.entries(value).filter(([key])=>!['data','_assetPreview','_assetBlobRef'].includes(key)).map(([key,v])=>[key,clean(v)]));};
 return Object.fromEntries(resumeMasterKeys53.map(key=>[key,clean(state[key]??null)]));
}
function initialResumeData53(state=ctx.state,{blank=false}={}){
 const base=captureResumeMaster53(state);if(blank){for(const key of Object.keys(base)){if(Array.isArray(base[key]))base[key]=[];else if(base[key]&&typeof base[key]==='object')for(const f of Object.keys(base[key]))base[key][f]=Array.isArray(base[key][f])?[]:'';else base[key]=null;}}
 return {schemaVersion:1,base,blank,overrides:{},labels:{},styles:{},hidden:[],recordOrder:{},fieldOrder:{},addedRecords:{},addedFields:{},customModules:[],sectionOrder:[...MODULES],cover:{enabled:false,title:''},toc:{enabled:false,sections:[...MODULES]},template:'classic',design:{columns:1,fontFamily:'Microsoft YaHei',sectionLines:true}};
}
function initializeResumeVersions53(state=ctx.state){let changed=false;for(const v of state.versions){if(v.resume53)continue;const data=initialResumeData53(state);data.sectionOrder=[...v.order];data.hidden=[...v.disabled.map(key=>'module:'+key),...v.excluded.map(key=>'record:'+key),...v.hiddenFields];data.toc.enabled=!!v.showToc;if(v.target)data.overrides['profile.targetSchool']=v.target;v.resume53=data;v.createdAt53=v.createdAt53||state.savedAt||null;v.modifiedAt53=v.modifiedAt53||state.savedAt||null;v.targets53=v.targets53||(v.target?[v.target]:[]);changed=true;}return changed;}
function createResumeVersion53(name,targets=[],{blank=false}={}){if(!name.trim())throw new Error('请填写简历名称。');if(ctx.state.versions.length>=100)throw new Error('最多保存100份简历。');const v=newVersion(name.trim());v.targets53=[...new Set(targets.map(t=>t.trim()).filter(Boolean))];v.target=v.targets53.join('、');v.resume53=initialResumeData53(ctx.state,{blank});v.resume53.hidden=['module:learning'];v.createdAt53=v.modifiedAt53=new Date().toISOString();ctx.state.versions.push(v);ctx.state.activeVersion=v.id;return v;}
function cloneResumeVersion53(id){if(ctx.state.versions.length>=100)throw new Error('最多保存100份简历。');const source=ctx.state.versions.find(v=>v.id===id);if(!source)throw new Error('简历不存在。');const v=copyResume53(source);v.id=uid();v.name+=' · 副本';v.createdAt53=v.modifiedAt53=new Date().toISOString();ctx.state.versions.push(v);return v;}
function getResumeVersion53(id=ctx.state.activeVersion){return ctx.state.versions.find(v=>v.id===id)||null;}
function mergeResume53(base,live){if(Array.isArray(base)&&Array.isArray(live)){if([...base,...live].every(x=>x&&typeof x==='object'&&typeof x.id==='string')){const byID=new Map(base.map(x=>[x.id,x]));return [...live.map(x=>mergeResume53(byID.get(x.id)||{},x)),...base.filter(x=>!live.some(y=>y.id===x.id))];}return copyResume53(live);}if(base&&live&&typeof base==='object'&&typeof live==='object'&&!Array.isArray(base)&&!Array.isArray(live)){const result=copyResume53(base);for(const [key,value]of Object.entries(live))result[key]=mergeResume53(base[key],value);return result;}return live===undefined?copyResume53(base):copyResume53(live);}
function recordListResume53(workspace,module){const key=resumeRecordModules53[module];return key?.includes('.')?workspace.learning.books:workspace[key]||[];}
function locateResumeField53(workspace,path){if(path.includes('.')){const [module,key]=path.split('.');return workspace[module]&&{object:workspace[module],key};}const [module,id,key,subjectID,subkey]=path.split(':');const record=recordListResume53(workspace,module).find(x=>x.id===id);if(!record)return null;if(key==='subjects'){const sub=record.subjects?.find(x=>x.id===subjectID);return sub&&{object:sub,key:subkey};}return {object:record,key};}
function orderResume53(items,order,key='id'){if(!order?.length)return items;const positions=new Map(order.map((id,i)=>[id,i]));return [...items].sort((a,b)=>(positions.get(a[key])??1e6)-(positions.get(b[key])??1e6));}
function resolveResume53(id=ctx.state.activeVersion,state=ctx.state){
 const source=state.versions.find(v=>v.id===id);if(!source)return {workspace:state,version:null,modules:[]};const version=copyResume53(source),r=version.resume53||initialResumeData53(state),live=captureResumeMaster53(state),workspace={...state,...mergeResume53(r.base,r.blank?r.base:live)};
 // Workspace projection uses shared immutable asset metadata; never duplicates binary payload.
 workspace.assets=state.assets;workspace.versions=state.versions.map(v=>v.id===id?version:v);workspace.activeVersion=id;
 for(const [module,records]of Object.entries(r.addedRecords||{})){const list=recordListResume53(workspace,module);list.push(...copyResume53(records));}
 for(const [path,value]of Object.entries(r.overrides)){const target=locateResumeField53(workspace,path);if(target)target.object[target.key]=value;}
 const hidden=new Set(r.hidden),field=(path,label,value,role='body')=>({path,label:Object.hasOwn(r.labels,path)?r.labels[path]:label,value:String(value??''),role,hidden:hidden.has(path),style:{...(r.styles[path]||{})}});
 const modules=MODULES.map(key=>{
  const entries=[];
  if(['profile','statement','academics','strengths'].includes(key)){
   const root=key==='strengths'?'statement':key;entries.push({id:key,title:'',titleHidden:true,hidden:hidden.has('record:'+key)||hidden.has('record:'+key+':'+key),fields:resumeFieldDefs53[key].map(([name,label])=>field(root+'.'+name,label,workspace[root]?.[name]))});
  }else if(key==='learning'){
   entries.push({id:'learning-text',title:'学习文字',hidden:hidden.has('record:learning:learning-text'),fields:[['readingNotes','阅读随记'],['plan','学习计划'],['notes','其他记录']].map(([name,label])=>field('learning.'+name,label,workspace.learning[name]))});
  }
  if(resumeRecordModules53[key])for(const record of orderResume53(recordListResume53(workspace,key),r.recordOrder[key])){
   const defs=resumeFieldDefs53[key],titleKey=key==='education'?'stage':'title',fields=defs.map(([name,label])=>field(key+':'+record.id+':'+name,label,record[name],name===titleKey?'title':'body'));
   if(key==='exams')for(const sub of record.subjects||[])for(const [name,label]of [['name','科目'],['score','得分'],['fullMark','满分'],['rank','排名']])fields.push(field(key+':'+record.id+':subjects:'+sub.id+':'+name,label,sub[name]));
   const recordPath=key+':'+record.id;
   if(record.priority&&(version.includedFields||[]).includes(recordPath+':priority'))fields.push(field(recordPath+':priority','整理优先级',record.priority));
   const summaryPath=recordPath+':summary';if(['awards','experiences','practices','achievements'].includes(key)&&(Object.hasOwn(version.summaries,recordPath)||Object.hasOwn(r.overrides,summaryPath)))fields.push({...field(summaryPath,'简历表述',Object.hasOwn(r.overrides,summaryPath)?r.overrides[summaryPath]:version.summaries[recordPath]),versionOnly:true});
   for(const extra of r.addedFields[recordPath]||[])fields.push({...field('extra:'+recordPath+':'+extra.id,extra.label,extra.value),hidden:!!extra.hidden,style:{...(extra.style||{}),...(r.styles['extra:'+recordPath+':'+extra.id]||{})}});
   const title=fields.find(f=>f.role==='title');entries.push({id:record.id,title:title?.value||'',titleHidden:!!title?.hidden,style:title?.style||{},hidden:hidden.has('record:'+recordPath),fields:orderResume53(fields,r.fieldOrder[recordPath],'path'),photos:record.photos||[],attachments:record.attachments||[],sourceMissing:!recordListResume53(live,key).some(x=>x.id===record.id)&&!r.addedRecords[key]?.some(x=>x.id===record.id)});
  }
  if(key==='learning'){const e=entries[0];for(const extra of r.addedFields['learning:learning-text']||[])e.fields.push({...field('extra:learning:learning-text:'+extra.id,extra.label,extra.value),hidden:!!extra.hidden,style:{...(extra.style||{}),...(r.styles['extra:learning:learning-text:'+extra.id]||{})}});e.fields=orderResume53(e.fields,r.fieldOrder['learning:learning-text'],'path');}
  if(['profile','statement','academics','strengths'].includes(key))for(const extra of r.addedFields[key]||[])entries[0].fields.push({...field('extra:'+key+':'+extra.id,extra.label,extra.value),hidden:!!extra.hidden,style:{...(extra.style||{}),...(r.styles['extra:'+key+':'+extra.id]||{})}});
  if(['profile','statement','academics','strengths'].includes(key))entries[0].fields=orderResume53(entries[0].fields,r.fieldOrder[key],'path');
  return {key,title:Object.hasOwn(r.labels,'module:'+key)?r.labels['module:'+key]:version.titles[key]||MODULE_NAMES[key][0],hidden:hidden.has('module:'+key),style:r.styles['module:'+key]||version.moduleStyles[key]||{},entries};
 });
 for(const module of r.customModules){const key='vmod:'+module.id;modules.push({key,title:module.title,hidden:!!module.hidden,layout:module.layout,style:{...(module.style||{}),...(r.styles['module:'+key]||{})},entries:orderResume53(module.entries,module.entryOrder).map(entry=>({id:entry.id,title:entry.title,titleHidden:!!entry.titleHidden,hidden:!!entry.hidden,fields:orderResume53(entry.fields,entry.fieldOrder).map(f=>({path:'vmod:'+module.id+':'+entry.id+':'+f.id,label:f.label,value:f.value,hidden:!!f.hidden,style:{...(f.style||{}),...(r.styles['vmod:'+module.id+':'+entry.id+':'+f.id]||{})}})),photos:entry.photos||[],attachments:entry.attachments||[]}))});}
 for(const module of modules)for(const entry of module.entries)for(const f of entry.fields){const inherited={};if(module.style.fontSize)inherited.fontSize=module.style.fontSize;if(module.style.color)inherited.color=module.style.color;f.style={...inherited,...f.style};}
 version.resume53=r;version.disabled=MODULES.filter(k=>hidden.has('module:'+k));version.excluded=r.hidden.filter(k=>k.startsWith('record:')).map(k=>k.slice(7));version.hiddenFields=r.hidden.filter(k=>!k.startsWith('record:')&&!k.startsWith('module:'));version.showToc=r.toc.enabled;
 return {workspace,version,modules:orderResume53(modules,r.sectionOrder,'key')};
}
function versionFingerprint53(v){const copy={...v};delete copy.modifiedAt53;return JSON.stringify(copy);}
const resumeUndoSessions53=new Map();
function historyCopy53(v){const copy=copyResume53(v);if(copy.resume53)delete copy.resume53.base;return copy;}
function historySession53(id){if(!resumeUndoSessions53.has(id))resumeUndoSessions53.set(id,{undo:[],redo:[],lastTag:'',lastAt:0});return resumeUndoSessions53.get(id);}
function changeResumeVersion53(id,mutate,{tag='',recordHistory=true}={}){
 const v=getResumeVersion53(id);if(!v)throw new Error('简历不存在。');if(!v.resume53)initializeResumeVersions53();const before=copyResume53(v),next=copyResume53(v);mutate(next);if(versionFingerprint53(before)===versionFingerprint53(next))return false;
 const session=historySession53(id),now=Date.now();if(recordHistory){if(!tag||tag!==session.lastTag||now-session.lastAt>650)session.undo.push(historyCopy53(before));session.undo=session.undo.slice(-40);session.redo=[];session.lastTag=tag;session.lastAt=now;}
 next.modifiedAt53=new Date().toISOString();ctx.state.versions[ctx.state.versions.findIndex(x=>x.id===id)]=next;return true;
}
function undoResume53(id,redo=false){const v=getResumeVersion53(id),session=historySession53(id),from=redo?session.redo:session.undo,to=redo?session.undo:session.redo;if(!v||!from.length)return false;to.push(historyCopy53(v));const next=from.pop();next.resume53.base=v.resume53.base;next.modifiedAt53=new Date().toISOString();ctx.state.versions[ctx.state.versions.findIndex(x=>x.id===id)]=next;session.lastTag='';return true;}
function restoreResumeScope53(v,{module,recordId,path}={}){
 const r=v.resume53,targets=resolveResume53(v.id).modules.find(m=>m.key===module)?.entries||[];
 const paths=path?[path]:targets.filter(e=>!recordId||e.id===recordId).flatMap(e=>e.fields.map(f=>f.path));
 for(const key of paths){delete r.overrides[key];delete r.labels[key];}if(module&&!recordId&&!path)delete r.labels['module:'+module];
 // Explicitly refresh fallback only for existing master source values; preserve display/order/style.
 const master=captureResumeMaster53();for(const key of paths){const source=locateResumeField53(master,key),target=locateResumeField53(r.base,key);if(source&&target)target.object[target.key]=copyResume53(source.object[source.key]??'');}
}
function createCustomModule53(v,title='自定义模块'){const module={id:uid(),title,layout:'list',entries:[],style:{}};v.resume53.customModules.push(module);v.resume53.sectionOrder.push('vmod:'+module.id);return module;}
export {resumeMasterKeys53,resumeFieldDefs53,resumeRecordModules53,copyResume53,captureResumeMaster53,initialResumeData53,initializeResumeVersions53,createResumeVersion53,cloneResumeVersion53,getResumeVersion53,resolveResume53,changeResumeVersion53,undoResume53,historySession53,restoreResumeScope53,createCustomModule53,locateResumeField53,recordListResume53};

function preserveResumeReferences53(state=ctx.state){const live=captureResumeMaster53(state);for(const v of state.versions||[])if(v.resume53&&!v.resume53.blank)v.resume53.base=mergeResume53(v.resume53.base,live);}
export {preserveResumeReferences53};
