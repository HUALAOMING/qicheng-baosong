import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {ctx} = await import('../js/state.js');
const {fresh,currentVersion} = await import('../js/model.js');
const {loadBuiltinData} = await import('../js/data.js');
const {documentPlan,exportColors,exportHTML3,pdfBytes,wordBlob,pptBlob} = await import('../js/modules/export.js');
const {exportRows,stylePanel} = await import('../js/modules/resume.js');
await loadBuiltinData();
function reset() {
  ctx.state=fresh();ctx.state.profile.name='配色测试';ctx.state.statement.zh='保持正文可读。';
  Object.assign(currentVersion(),{showAvatar:false,photoMode:'none',paperColor:'#f9f2e6',lineColor:'#225577',titleColor:'#883311',wordBW:false});
}
test('independent paper, rule and section colors reach HTML, PDF, editable PPTX and Word', async()=>{
  reset();currentVersion().moduleStyles.statement={titleColor:'#335599'};
  const plan=await documentPlan(),items=plan.pages.flatMap(page=>page.items);
  assert.equal(plan.colors.bg,'#f9f2e6');assert.equal(plan.colors.ink,'#000000');
  assert.ok(items.some(item=>item.text==='个人陈述'&&item.color==='#335599'));
  assert.ok(items.some(item=>item.text==='基本信息'&&item.color==='#883311'));
  assert.equal(items.find(item=>item.text==='保持正文可读。').color,'#000000');
  assert.ok(items.filter(item=>item.kind==='line').every(item=>item.color==='#225577'));
  const html=exportHTML3(plan);for(const color of ['#f9f2e6','#225577','#335599','#000000'])assert.ok(html.includes(color));
  assert.equal((await PDFLib.PDFDocument.load(await pdfBytes(plan))).getPageCount(),plan.pages.length);
  const ppt=await JSZip.loadAsync(await (await pptBlob(plan)).arrayBuffer()),slide=await ppt.file('ppt/slides/slide1.xml').async('string');
  for(const color of ['f9f2e6','225577','335599','000000'])assert.ok(slide.toLowerCase().includes(color));
  const word=await JSZip.loadAsync(await (await wordBlob()).arrayBuffer()),xml=await word.file('word/document.xml').async('string');
  assert.match(xml,/<w:background w:color="f9f2e6"/i);
  for(const color of ['225577','335599','000000'])assert.ok(xml.toLowerCase().includes(color));
  currentVersion().wordBW=true;
  const mono=await JSZip.loadAsync(await (await wordBlob()).arrayBuffer()),monoxml=await mono.file('word/document.xml').async('string');
  assert.doesNotMatch(monoxml,/335599|883311|f9f2e6/i);
});
test('appearance controls keep custom settings and additional statement can be independently excluded',()=>{
  reset();const html=stylePanel();
  assert.doesNotMatch(html,/data-v-setting="(?:palette|background)"/);
  for(const value of ['paperColor','lineColor','titleColor','paperImage52','densitySwitch52','data-module-style="statement:titleColor"'])assert.ok(html.includes(value));
  for(const value of ['data-v-range="margin"','data-v-range="fontSize"','data-v-range="lineHeight"','data-v-range="gap"'])assert.ok(html.includes(value));
  ctx.state.statement.otherLanguage='法语';ctx.state.statement.other='Je souhaite poursuivre mes études.';
  assert.ok(exportRows().some(row=>row.text===ctx.state.statement.other));
  currentVersion().hiddenFields.push('statement.other');assert.ok(!exportRows().some(row=>row.text===ctx.state.statement.other));
  assert.equal(exportColors({...currentVersion(),titleColor:'invalid',paperColor:'url(invalid)'}).ink,'#000000');
});
