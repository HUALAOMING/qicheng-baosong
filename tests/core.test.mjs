import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {setup,root,workspaceHTML} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const model=await import('../js/model.js');
const {storage}=await import('../js/storage.js');
const autosave=await import('../js/autosave.js');
const backup=await import('../js/backup.js');
const {validateDraft}=await import('../js/utils/validation.js');
const app=await import('../js/app.js');
const data=await import('../js/data.js');
const constants=await import('../js/constants.js');
const markdown=await import('../js/modules/markdown.js');
const exporter=await import('../js/modules/export.js');
const map=await import('../js/modules/map.js');
const universities=await import('../js/modules/universities.js');
await data.loadBuiltinData();ctx.state=model.fresh();
function sample() {
  const s=model.fresh();
  for(const [key,label]of constants.PROFILE) s.profile[key]='测试 '+label;
  s.profile.name='测试同学';s.profile.email='student@example.test';s.profile.phone='13800000000';s.profile.targetSchool=constants.PROFILE[0][0];
  s.statement={zh:'成长是逐渐承担责任。\n这是第二段。',en:'Growth means learning to take responsibility.',strengths:'足球、主持',hobbies:'摇滚、阅读'};
  s.academics={languageLearning:'英语学习与德语兴趣',certificates:'CET-6'};
  s.education.forEach(e=>{e.school='测试学校';e.start='2023-09';e.end='2026-06';e.location='重庆';e.detail='课程与活动';});
  const award=constants.blankAward();for(const [k,l]of constants.AWARD_FIELDS)award[k]=l+' 测试';award.scope='校级';award.category='艺术与体育';s.awards=[award];
  const exp=constants.blankExp();for(const [k,l]of constants.EXP_FIELDS)exp[k]=l+' 测试';s.experiences=[exp];s.practices=[{...structuredClone(exp),id:'practice-record',category:'社会实践',photos:[],attachments:[]}];
  const achievement={id:'project-record',photos:[],attachments:[]};for(const [k,l]of constants.ACHIEVEMENT_FIELDS)achievement[k]=l+' 测试';s.achievements=[achievement];
  const exam=constants.blankExam();exam.title='排位考试';exam.date='2026-10-08';exam.totalScore='600';exam.totalFullMark='750';exam.rank='12';exam.rankTotal='82';exam.subjects.forEach(x=>{x.score='120';x.fullMark='150';x.rank='12';});s.exams=[exam];
  const book=constants.blankBook();book.title='悉达多';book.author='赫尔曼·黑塞';book.reflection='关于成长与自我探索。';s.learning.books=[book];s.learning.plan='每周阅读';s.learning.notes='保留笔记';s.learning.readingNotes='阅读随记';
  s.customBlocks=[{id:'custom-record',title:'自定义内容',text:'测试正文',layout:'stack',photos:[],attachments:[]}];
  s.dreamSchools=[data.SCHOOLS[0].name,data.SCHOOLS[1].name];s.profile.targetSchool=s.dreamSchools[0];
  s.versions[0].showAvatar=false;s.versions[0].photoMode='none';s.versions[0].disabled=[];
  s.versions[0].titles.awards='我的荣誉';s.versions[0].summaries['awards:'+award.id]='补充简历表述';
  s.versions[0].moduleStyles.awards=model.cleanModuleStyle({titleAlign:'center',labelBold:false});
  s.onboarded=true;return validateDraft(s);
}
function reset(s=sample()) { ctx.state=s;ctx.busy=false;ctx.uploadBusy=false;autosave.cancelPendingSave();ctx.saveChain=Promise.resolve();autosave.initializeSaving301(); }

test('49 universities, 34 provinces, font resources and all local seals load on demand',async()=>{
  await data.loadRouteData('schools');await data.loadDocumentFonts();
  assert.equal(data.SCHOOL_DETAILS3.length,49);assert.equal(data.SCHOOLS.length,49);assert.equal(data.CHINA_VECTOR31.provinces.length,34);
  assert.ok(data.SCHOOL_DETAILS3.every(s=>s.logo.startsWith('assets/images/')));assert.ok(data.FONT_CJK.startsWith('data:font/ttf;base64,'));
});
test('all school profiles display sourced founding data and honest motto fallback',async()=>{
  await data.loadRouteData('schools');
  for(const s of data.SCHOOL_DETAILS3){
    assert.ok(s.schoolFacts?.source?.startsWith('https://'),s.name);
    assert.ok(s.schoolFacts.founding,s.name);
    const html=universities.schoolDetail3(s.name);
    assert.ok(html.includes(s.schoolFacts.founding),s.name);
    assert.ok(html.includes(s.schoolFacts.motto || '资料待核实'),s.name);
    assert.ok(html.includes(s.schoolFacts.mottoSource || s.schoolFacts.source),s.name);
  }
});
test('strict current-state validation preserves every field and document setting',()=>{
  const s=sample();assert.deepEqual(validateDraft(s),s);const bad=structuredClone(s);delete bad.education;assert.throws(()=>validateDraft(bad),/必要字段/);
});
test('all original routes render with both interface languages and every current theme',async()=>{
  const routes=constants.NAV3.flatMap(g=>g.items.map(i=>i[0]));
  for(const uiLang of ['zh','en'])for(const theme of ['pudding','obsidian','blue'])for(const route of [...routes,...data.SCHOOLS.map(s => 'school:'+encodeURIComponent(s.name))]) {
    reset();ctx.state.uiLang=uiLang;ctx.state.theme=theme;ctx.state.route=route;await data.loadRouteData(route);app.render();assert.ok(workspaceHTML(env.document)?.length>100,route);assert.equal(env.document.body.dataset.theme,theme);
  }
});
test('IndexedDB get/set/update/remove/getAll/clear use committed transactions',async()=>{
  await storage.clear();await storage.set('note',{n:1});await storage.update('note',v=>({...v,n:v.n+1}));assert.equal((await storage.get('note')).n,2);assert.ok((await storage.getAll()).note);await storage.remove('note');assert.equal(await storage.get('note'),undefined);
});
test('debounced autosave saves latest edits and queued writes preserve order',async()=>{
  reset();ctx.state.profile.name='first';autosave.scheduleSave();ctx.state.profile.name='second';autosave.scheduleSave();await new Promise(r=>setTimeout(r,650));await ctx.saveChain;assert.equal((await storage.get('current')).profile.name,'second');assert.equal(ctx.dirty301,false);
  ctx.state.profile.name='A';const a=autosave.save();ctx.state.profile.name='B';const b=autosave.save();await Promise.all([a,b]);assert.equal((await storage.get('current')).profile.name,'B');
});
test('closing/reopening database retains user data (storage-layer restart)',async()=>{
  storage.close();assert.equal((await storage.get('current')).profile.name,'B');
});
test('save failure remains visible and the in-memory workspace can be backed up',async()=>{
  reset();ctx.state.profile.name='unsaved';env.factory.failWrite=true;assert.equal(await autosave.save(),false);assert.equal(ctx.saveError,true);assert.equal(ctx.dirty301,true);const file=await backup.getCurrentBackup();assert.equal(file.data.current.profile.name,'unsaved');
});
test('complete JSON backup survives clearing and atomic recovery, including future user records',async()=>{
  reset();await autosave.save();await storage.set('future-note',{text:'future user-generated content'});const original=model.snapshot3(),file=await backup.getCurrentBackup();await mkdir(path.join(root,'tests/generated'),{recursive:true});await writeFile(path.join(root,'tests/generated/sample-backup.json'),JSON.stringify(file,null,2));assert.equal(file.app,'Qicheng');assert.equal(file.backupVersion,backup.BACKUP_VERSION);assert.deepEqual(validateDraft(file.data.current),original);assert.ok(!JSON.stringify(file).includes('provinces'));assert.ok(file.data['future-note']);
  await storage.clear();reset(model.fresh());await backup.commitBackup(await readFile(path.join(root,'tests/generated/sample-backup.json'),'utf8'));assert.deepEqual(await storage.materializeCurrent(model.snapshot3()),original);assert.deepEqual((await storage.getAll())['future-note'],{text:'future user-generated content'});
});
test('images, attachments, editable drafts and export history round-trip without duplication',async()=>{
  reset();const s=ctx.state;const png='data:image/png;base64,'+(await readFile(path.join(root,'assets/icons/apple-touch-icon.png'))).toString('base64');
  s.assets=[{id:'image-asset',name:'portrait.png',mime:'image/png',kind:'image',data:png,size:5000,createdAt:new Date().toISOString(),source:'upload'},
    {id:'file-asset',name:'notes.txt',mime:'text/plain',kind:'file',data:'data:text/plain;base64,VGVzdA==',size:4,createdAt:new Date().toISOString(),source:'upload'},
    {id:'export-asset',name:'resume.md',mime:'text/markdown',kind:'export',data:'data:text/markdown;base64,VGVzdA==',size:4,createdAt:new Date().toISOString(),source:'generated'}];
  const photo={id:'photo-ref',assetId:'image-asset',name:'portrait.png',data:png,caption:'测试说明',crop:model.cleanCrop({ratio:'circle'})};s.awards[0].photos=[photo];s.awardDraft=structuredClone(s.awards[0]);s.awards[0].attachments=['file-asset'];s.media=[{...structuredClone(photo),id:'media-ref',link:'awards:'+s.awards[0].id}];s.avatar={...structuredClone(photo),id:'avatar-ref'};s.exportHistory=[{id:'export-record',assetId:'export-asset',name:'resume.md',type:'md',createdAt:new Date().toISOString(),versionId:s.activeVersion,purpose:'resume'}];
  const file=await backup.getCurrentBackup();assert.equal(file.data.current.awards[0].photos[0].data,undefined);assert.equal(file.data.current.assets[0].data,png);await backup.commitBackup(file);assert.equal(await storage.photoData(ctx.state.awards[0].photos[0],ctx.state),png);assert.ok(ctx.state.assets[0]._assetBlobRef);assert.deepEqual(await storage.materializeCurrent(model.snapshot3()),backup.compactSnapshot(validateDraft(file.data.current)));
});
test('damaged/non-Qicheng/unsupported/incomplete/malformed/referentially broken JSON never mutates state',async()=>{
  reset();await autosave.save();const before=await storage.getAll(),state=structuredClone(ctx.state),valid=backup.createBackup(model.snapshot3());
  const variants=['{',JSON.stringify({hello:true}),JSON.stringify({...valid,app:'Other'}),JSON.stringify({...valid,backupVersion:2}),JSON.stringify({...valid,data:{}})];
  const bad=structuredClone(valid);bad.data.current.profile.name=7;variants.push(JSON.stringify(bad));
  const broken=structuredClone(valid);broken.data.current.awards[0].attachments=['missing-asset'];variants.push(JSON.stringify(broken));
  const poisoned=JSON.stringify(valid).replace('"data":{','"data":{"__proto__":{"polluted":true},');variants.push(poisoned);
  for(const text of variants){await assert.rejects(()=>backup.commitBackup(text));assert.deepEqual(await storage.getAll(),before);assert.deepEqual(ctx.state,state);}
});
test('a restore write failure AFTER clear rolls back all records and keeps unsaved edits',async()=>{
  reset();await autosave.save();await storage.set('extra',{keep:true});const before=await storage.getAll();ctx.state.profile.name='unsaved original';const memory=structuredClone(ctx.state);const incoming=sample();incoming.profile.name='incoming';const file=backup.createBackup(incoming);env.factory.failAfter=2;
  await assert.rejects(()=>backup.commitBackup(file),/原数据已保留/);assert.deepEqual(await storage.getAll(),before);assert.deepEqual(ctx.state,memory);
});
test('opening IndexedDB failure is surfaced and can be retried',async()=>{
  storage.close();env.factory.failOpen=true;await assert.rejects(()=>storage.open(),/Database unavailable/);env.factory.failOpen=false;await storage.open();
});
test('Markdown sample/import and bilingual export keep every recognized module',()=>{
  reset();const template=markdown.markdownTemplate31();assert.ok(template.includes('qicheng:section practices'));assert.ok(template.includes('qicheng:section achievements'));
  const input='## 基本信息\n- 姓名：Markdown同学\n\n## 个人陈述\n- 中文个人陈述：第一段\n  第二段\n';
  const result=markdown.applyMarkdown31(markdown.parseMarkdown31(input));assert.equal(result.draft.profile.name,'Markdown同学');assert.ok(result.draft.statement.zh.includes('第二段'));assert.equal(result.draft.awards.length,ctx.state.awards.length);
  for(const lang of ['zh','en']){ctx.state.versions[0].exportLang=lang;const text=markdown.markdown();assert.ok(text.includes('测试同学'));assert.ok(text.includes('qicheng:record awards'));}
});
test('vector map contains each province, inset and counts; filters/favorites retain semantics',()=>{
  reset();const svg=map.vectorMapSvg31();assert.ok(svg.includes('insetClip31'));assert.ok(svg.includes(data.CHINA_VECTOR31.seaInset));for(const p of data.CHINA_VECTOR31.provinces)assert.ok(svg.includes('data-province31="'+p.region+'"'));ctx.onlyDreams=true;assert.equal(universities.filteredSchools3().length,2);ctx.onlyDreams=false;ctx.schoolRegion3='北京';assert.ok(universities.filteredSchools3().every(x=>x.region==='北京'));ctx.schoolRegion3='';
});
test('real paginated SVG, embedded-font searchable PDF, DOCX and editable PPTX exports',async()=>{
  reset();const plan=await exporter.documentPlan();assert.ok(plan.pages.length>=1);assert.ok(plan.pages.every(p=>p.items.length>0));assert.ok(exporter.planSvg(plan,plan.pages[0]).includes('<svg'));
  const dir=path.join(root,'tests/generated');await mkdir(dir,{recursive:true});
  const pdf=await exporter.pdfBytes(plan);assert.equal(Buffer.from(pdf).subarray(0,4).toString(),'%PDF');await writeFile(path.join(dir,'sample.pdf'),pdf);
  const word=await exporter.wordBlob();const w=Buffer.from(await word.arrayBuffer());assert.equal(w.subarray(0,2).toString(),'PK');await writeFile(path.join(dir,'sample.docx'),w);
  const ppt=await exporter.pptBlob(plan);const p=Buffer.from(await ppt.arrayBuffer());assert.equal(p.subarray(0,2).toString(),'PK');await writeFile(path.join(dir,'sample.pptx'),p);
  const html=exporter.exportHTML3(plan);assert.ok(html.includes('data:font/ttf;base64,'));assert.ok(html.includes('测试同学'));await writeFile(path.join(dir,'sample.html'),html);
});
test('editable HTML preserves full runtime/data/assets and embeds the current workspace',async()=>{
  reset();const html=await backup.offlineHTML();assert.ok(html.includes('qichengEmbedded'));assert.ok(html.includes('测试同学'));assert.ok(!html.includes('src="assets/vendor/'));assert.ok(!html.includes('href="css/'));assert.ok(!html.includes("from './"));
  const scripts=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>!m[0].startsWith('<script id="qichengEmbedded"'));
  for(const s of scripts)new vm.Script(s[1]);
});

test('background save cannot overwrite a restore transaction in progress',async()=>{
  reset();await autosave.save();const file=backup.createBackup({...sample(),profile:{...sample().profile,name:'restored'}});
  const replace=storage.replaceAll;let release;
  storage.replaceAll=async records=>{await new Promise(r=>{release=r;});return replace(records);};
  try {
    const restoration=backup.commitBackup(file);
    while(!release)await new Promise(r=>setImmediate(r));
    assert.equal(ctx.persistencePaused,true);assert.equal(await autosave.save(),false);release();await restoration;
    assert.equal((await storage.get('current')).profile.name,'restored');assert.equal(ctx.persistencePaused,false);
  } finally {storage.replaceAll=replace;}
});

test('all export palettes and both orientations generate finite, paginated layouts',async()=>{
  reset();
  for(const palette of ['pudding','obsidian','blue','jade','berry','bw'])for(const orientation of ['portrait','landscape']) {
    Object.assign(ctx.state.versions[0],{palette,orientation});const plan=await exporter.documentPlan();
    assert.ok(plan.W>0&&plan.H>0);assert.ok(plan.pages.every(p=>p.items.every(i=>Number.isFinite(i.x)&&Number.isFinite(i.y))));
  }
});

test('province popup opens with matching universities and closes cleanly (DOM API double)',()=>{
  reset();ctx.state.route='schools';app.render();
  const stage=env.document.getElementById('mapStage31'),popup=env.document.getElementById('provincePopup31');
  stage.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600});popup.offsetWidth=320;popup.offsetHeight=250;
  const button={onclick:null,focus(){}};popup.querySelector=()=>button;popup.querySelectorAll=()=>[];
  map.openProvince31('北京',{clientX:200,clientY:100,type:'click'});assert.equal(popup.hidden,false);assert.ok(popup.innerHTML.includes('北京'));assert.ok(popup.innerHTML.includes(data.SCHOOL_DETAILS3.find(s=>s.region==='北京').name));map.closeProvince31();assert.equal(popup.hidden,true);
});

test('service worker registration failure keeps the workspace visible and reports an error',async()=>{
  reset();app.render();const before=env.document.getElementById('app').innerHTML;
  const {pwa}=await import('../js/pwa.js');
  Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});
  navigator.serviceWorker={addEventListener(){},register:async()=>{throw new Error('registration rejected');}};
  await pwa.init();assert.match(pwa.statusText(),/注册失败/);assert.equal(env.document.getElementById('app').innerHTML,before);
  delete navigator.serviceWorker;
});

test('normal clear requires two confirmations and persists an empty workspace',async()=>{
  reset();await autosave.save();const before=await storage.getAll();
  const dialog=env.document.getElementById('confirmDialog');
  const canceled=backup.clearAll();dialog.returnValue='cancel';dialog.close();assert.equal(await canceled,false);assert.deepEqual(await storage.getAll(),before);
  const clearing=backup.clearAll();dialog.returnValue='confirm';dialog.close();await new Promise(r=>setImmediate(r));assert.equal(dialog.open,true);dialog.returnValue='confirm';dialog.close();assert.equal(await clearing,true);
  const empty=await storage.get('current');assert.ok(empty);assert.ok(Object.values(empty.profile).every(v=>v===''));assert.equal(empty.assets.length,0);assert.equal(empty.dreamSchools.length,0);assert.equal(ctx.state.uiLang,'zh');
});

test('Markdown file import commits before changing workspace; a failed write keeps original materials',async()=>{
  reset();await autosave.save();
  const bytes=new TextEncoder().encode('## 基本信息\n- 姓名：Markdown已保存\n');
  const file={name:'sample.md',size:bytes.length,arrayBuffer:async()=>bytes.buffer};
  await markdown.importMarkdownFile31(file,null);assert.equal(ctx.state.profile.name,'Markdown已保存');assert.equal((await storage.get('current')).profile.name,'Markdown已保存');
  const before=structuredClone(ctx.state),disk=await storage.getAll();env.factory.failWrite=true;
  await assert.rejects(()=>markdown.importMarkdownFile31(file,null),/原资料已保留/);assert.deepEqual(ctx.state,before);assert.deepEqual(await storage.getAll(),disk);assert.equal(ctx.persistencePaused,false);
});
