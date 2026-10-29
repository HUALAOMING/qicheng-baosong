import test from 'node:test';import assert from 'node:assert/strict';import {setup} from './support.mjs';
await setup();const {ctx}=await import('../js/state.js'),{fresh}=await import('../js/model.js'),data=await import('../js/data.js'),model=await import('../js/resume-model53.js'),rows=await import('../js/modules/resume.js'),engine=await import('../js/modules/export.js');await data.loadBuiltinData();
function reset(){ctx.state=fresh();Object.assign(ctx.state.profile,{name:'全局底稿',school:'示范中学',birthday:'2008-01-01',schoolLanguage:'英语',email:'student@example.test'});ctx.state.statement.zh='底稿正文';model.initializeResumeVersions53();rows.configureResumeResolver53(model.resolveResume53);const v=ctx.state.versions[0];v.showAvatar=false;v.photoMode='none';v.resume53.overrides['profile.name']='版本A独立姓名';v.resume53.overrides['statement.zh']='版本A独立正文';v.resume53.cover={enabled:true,title:'版本封面'};v.resume53.toc={enabled:true,sections:['statement']};return v;}
test('resolved export rows and all four editable DOCX templates use isolated content and selected TOC headings',async()=>{
 const v=reset(),master=JSON.stringify(ctx.state.profile);v.resume53.styles['statement.zh']={fontSize:12,color:'#884422'};
 for(const template of ['original','classic','modern','academic']){
  v.resume53.template=template;v.resume53.design.columns=template==='academic'?2:1;
  const doc=await JSZip.loadAsync(await(await engine.wordBlob({versionId:v.id})).arrayBuffer()),xml=await doc.file('word/document.xml').async('string');
  assert.match(xml,/版本A独立姓名/);assert.match(xml,/版本A独立正文/);assert.match(xml,/版本封面/);assert.doesNotMatch(xml,/全局底稿|底稿正文|documentProtection/);assert.match(xml,/<w:t[^>]*>/);assert.doesNotMatch(xml,/<w:drawing/);
  if(template==='academic')assert.match(xml,/<w:cols[^>]*w:num="2"/);if(template==='original')assert.doesNotMatch(xml,/884422|w:pgBorders|w:pBdr/);else assert.match(xml,/884422/);
  assert.equal(xml.match(/w:pStyle w:val="Heading1"/g)?.length,1,'only the selected statement section enters automatic TOC');
 }
 assert.equal(JSON.stringify(ctx.state.profile),master);assert.equal(ctx.state.statement.zh,'底稿正文');
});
test('PDF pagination, cover, TOC and two-column bounds are finite for long version-only fields',async()=>{
 const v=reset();v.resume53.template='academic';v.resume53.design.columns=2;v.resume53.overrides['statement.zh']='很长的独立段落 Long paragraph. '.repeat(900);
 const plan=await engine.documentPlan({versionId:v.id});assert.equal(plan.pages[0].kind,'cover');assert.ok(plan.pages.length>3);assert.equal(plan.tocEntries.length,1);assert.ok(plan.tocEntries[0].page>2);
 const margin=v.margin*72/25.4;for(const page of plan.pages)for(const item of page.items){assert.ok(Number.isFinite(item.x)&&Number.isFinite(item.y));if(item.kind==='text'&&item.role!=='page-number'){assert.ok(item.y>=0&&item.y+item.size<plan.H);assert.ok(item.x>=margin-1);assert.ok(item.x+engine.widthOf(item.text,item.size)<plan.W-margin+2);}}
 const pdf=await PDFLib.PDFDocument.load(await engine.pdfBytes(plan));assert.equal(pdf.getPageCount(),plan.pages.length);
});
test('original template is a non-destructive view of saved styles and exports explicit empty overrides',async()=>{
 const v=reset();v.resume53.design.presets={modern:{titleColor:'#123456',paperColor:'#eeeeee'}};v.resume53.template='original';v.resume53.overrides['statement.zh']='';const before=JSON.stringify(v.resume53.design);const resolved=model.resolveResume53(v.id);assert.ok(!rows.exportRows({resolved}).some(row=>row.text.includes('底稿正文')));await engine.wordBlob({versionId:v.id});assert.equal(JSON.stringify(v.resume53.design),before);v.resume53.template='modern';assert.equal(rows.effectiveExportVersion53(v).titleColor,'#123456');
});

test('advanced legacy controls remain visible and unlinked evidence photos retain per-version selection',async()=>{
 const v=reset();v.resume53.template='classic';const ui=await import('../js/export53.js');const html=ui.designPanel53(v);
 for(const key of ['designPaperImage53','avatarShape','avatarSize','avatarRatioW','avatarRatioH','exportLang','statementLang','pptMode','wordBW','data-design-module53'])assert.ok(html.includes(key),key);
 ctx.state.assets.push({id:'standalone-image',name:'unlinked.png',kind:'image',mime:'image/png',data:'data:image/png;base64,VGVzdA==',size:4,source:'upload',createdAt:'2026-10-29'});v.photoMode='appendix';let resolved=model.resolveResume53(v.id);assert.ok(rows.exportRows({resolved}).some(r=>r.kind==='photos'&&r.photos.some(p=>p.id==='standalone-image')));
 v.resume53.hidden.push('record:photo:standalone-image');resolved=model.resolveResume53(v.id);assert.ok(!rows.exportRows({resolved}).some(r=>r.kind==='photos'&&r.photos.some(p=>p.id==='standalone-image')));assert.equal(ctx.state.assets.length,1);
 v.resume53.template='original';const original=ui.designPanel53(v);assert.ok(!original.includes('designPaperImage53'));assert.ok(!original.includes('data-density53'));assert.ok(original.includes('avatarShape'));
});

test('statement language keeps additional fields and hidden attachment originals stay absent from HTML',()=>{
 const v=reset();v.statementLang='zh';const resolved=model.resolveResume53(v.id),statement=resolved.modules.find(m=>m.key==='statement');statement.entries[0].fields.push({path:'extra:statement:custom',label:'补充',value:'Version-only extra',style:{}});statement.entries[0].fields.push({path:'statement.en',label:'英文个人陈述',value:'Hidden English',style:{}});
 const result=rows.exportRows({resolved});assert.ok(result.some(r=>r.text.includes('Version-only extra')));assert.ok(!result.some(r=>r.text.includes('Hidden English')));
 const asset={id:'private-file',name:'private.txt',data:'data:text/plain;base64,U0VDUkVU'};resolved.workspace.assets=[asset];statement.entries[0].attachments=[asset.id];resolved.version.hiddenFields.push('attachment:statement:'+statement.entries[0].id+':'+asset.id);
 const html=engine.exportHTML3({version:resolved.version,context53:resolved,W:595,H:842,colors:{bg:'#ffffff'},pages:[]});assert.ok(!html.includes(asset.data));assert.ok(!html.includes(asset.name));
});
