import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {setup, root} from './support.mjs';
await setup();
const {ctx} = await import('../js/state.js');
const {fresh, currentVersion} = await import('../js/model.js');
const {blankBook} = await import('../js/constants.js');
const {loadBuiltinData} = await import('../js/data.js');
const {validateDraft} = await import('../js/utils/validation.js');
const {documentPlan, buildContentsPages, exportHTML3, pdfBytes, wordBlob, pptBlob} = await import('../js/modules/export.js');
const {filesPanel22, stylePanel} = await import('../js/modules/resume.js');
await loadBuiltinData();
function reset() {
  ctx.state = fresh();
  ctx.state.profile.name = '导出检查同学';
  ctx.state.statement.zh = '把经历清楚、真实地呈现出来。\n保留内容与留白。';
  ctx.state.learning.plan = '阅读与写作，每日积累。';
  ctx.state.learning.books = [{...blankBook(), id:'sample-book', title:'论语', author:'孔子及其弟子', reflection:'学而时习之。'}];
  ctx.state.customBlocks = [{id:'sample-block', title:'自选作品', text:'这是简洁文档模板的示例正文。\n一份可编辑的申请资料。', layout:'stack', photos:[], attachments:[]}];
  Object.assign(currentVersion(), {showToc:true, showAvatar:false, disabled:[], photoMode:'none'});
}
reset();

test('5.0 document settings keep old documents unchanged and validate optional additions', () => {
  reset();
  const legacy = structuredClone(ctx.state);
  delete legacy.versions[0].pageDecoration;
  delete legacy.versions[0].showPageNumbers;
  assert.deepEqual(validateDraft(legacy), legacy);
  assert.equal(currentVersion().pageDecoration, 'plain');
  assert.equal(currentVersion().showPageNumbers, true);
  const invalid = structuredClone(ctx.state);
  invalid.versions[0].pageDecoration = 'flashing';
  assert.throws(() => validateDraft(invalid), /pageDecoration/);
  invalid.versions[0].pageDecoration = 'plain';
  invalid.versions[0].showPageNumbers = 'yes';
  assert.throws(() => validateDraft(invalid), /showPageNumbers/);
});

test('contents point to actual physical pages and all page numbers include contents', async () => {
  reset();
  const plan = await documentPlan();
  assert.ok(plan.tocPageCount >= 1);
  assert.equal(plan.pages.filter(page => page.kind === 'toc').length, plan.tocPageCount);
  for (const entry of plan.tocEntries) {
    assert.ok(plan.pages[entry.page - 1].items.some(item => item.kind === 'text' && item.text === entry.text), entry.text);
  }
  const references = plan.pages.flatMap(page => page.items).filter(item => item.role === 'toc-page-number');
  assert.deepEqual(references.map(item => +item.text), plan.tocEntries.map(entry => entry.page));
  plan.pages.forEach((page, index) => assert.equal(page.items.find(item => item.role === 'page-number').text, `${index + 1} / ${plan.pages.length}`));
  currentVersion().showToc = false;
  const without = await documentPlan();
  assert.equal(without.tocPageCount, 0);
  assert.equal(without.pages.length, plan.pages.length - plan.tocPageCount);
  assert.equal(without.tocEntries[0].page, plan.tocEntries[0].page - plan.tocPageCount);
});

test('long multi-page contents use the real offset and never overflow the printable area', async () => {
  reset(); await documentPlan(); // Load the real bundled font metrics.
  const version = {...currentVersion(), fontSize:12, lineHeight:1.6, gap:10};
  const options = {W:595.28, H:841.89, m:51, contentW:493.28, bottom:772.89, version, colors:{ink:'#222222', accent:'#936600'}};
  const entries = Array.from({length:120}, (_, index) => ({text:`第 ${index + 1} 个已选择模块 · 内容资料`, page:index + 1}));
  const contents = buildContentsPages(entries, options);
  assert.ok(contents.length > 3);
  const references = contents.flatMap(page => page.items).filter(item => item.role === 'toc-page-number');
  assert.equal(references.length, entries.length);
  references.forEach(item => assert.equal(+item.text, entries[item.sectionIndex].page + contents.length));
  for (const page of contents) for (const item of page.items) assert.ok(item.y + item.h <= options.bottom + .01, `${item.role}: ${item.y}`);
  const longTitle = buildContentsPages([{text:'这是一条非常长的目录标题'.repeat(180), page:1}], options);
  assert.ok(longTitle.length > 1);
  assert.equal(longTitle.flatMap(page => page.items).find(item => item.role === 'toc-page-number').text, String(longTitle.length + 1));
});

test('page-number toggle and restrained decorations apply to every fixed-layout page', async () => {
  reset();
  for (const decoration of ['plain', 'frame', 'editorial']) {
    currentVersion().pageDecoration = decoration;
    const plan = await documentPlan();
    for (const page of plan.pages) {
      assert.equal(page.items.filter(item => item.role === 'page-frame').length, decoration === 'frame' ? 4 : 0);
      assert.equal(page.items.find(item => item.role === 'page-accent').h, decoration === 'editorial' ? 3 : 1.2);
    }
    const html = exportHTML3(plan);
    assert.ok(html.includes('导出检查同学'));
    assert.equal((html.match(/class="paper-page"/g) || []).length, plan.pages.length);
  }
  currentVersion().showPageNumbers = false;
  const unnumbered = await documentPlan();
  assert.equal(unnumbered.pages.flatMap(page => page.items).filter(item => item.role === 'page-number').length, 0);
  assert.ok(unnumbered.pages.flatMap(page => page.items).some(item => item.role === 'toc-page-number'));
});

test('DOCX carries a dynamic TOC, refresh flag, page/total fields and optional real page borders', async () => {
  reset(); currentVersion().pageDecoration = 'frame';
  const blob = await wordBlob(), zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const document = await zip.file('word/document.xml').async('string');
  const settings = await zip.file('word/settings.xml').async('string');
  assert.match(document, /TOC[^<]*\\o &quot;1-1&quot;/);
  assert.match(document, /<w:pgBorders/);
  for (const edge of ['top','bottom','left','right']) assert.match(document, new RegExp(`<w:${edge}[^>]*w:val="single"`));
  assert.match(settings, /<w:updateFields/);
  const footerFiles = Object.keys(zip.files).filter(name => /^word\/footer\d+\.xml$/.test(name));
  assert.equal(footerFiles.length, 1);
  const footer = await zip.file(footerFiles[0]).async('string');
  assert.match(footer, /PAGE/); assert.match(footer, /NUMPAGES/);
  const dir = path.join(root, 'tests/generated/export50'); await mkdir(dir, {recursive:true});
  await writeFile(path.join(dir, 'sample-framed.docx'), new Uint8Array(await blob.arrayBuffer()));
  currentVersion().showPageNumbers = false; currentVersion().pageDecoration = 'plain';
  const plain = await JSZip.loadAsync(await (await wordBlob()).arrayBuffer());
  assert.equal(Object.keys(plain.files).filter(name => /^word\/footer\d+\.xml$/.test(name)).length, 0);
  assert.doesNotMatch(await plain.file('word/document.xml').async('string'), /<w:pgBorders/);
});

test('PDF and editable PPTX preserve the same contents and total-page count', async () => {
  reset(); currentVersion().pageDecoration = 'editorial';
  const plan = await documentPlan(), bytes = await pdfBytes(plan);
  const pdf = await PDFLib.PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), plan.pages.length);
  const ppt = await pptBlob(plan), zip = await JSZip.loadAsync(await ppt.arrayBuffer());
  const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b) => +a.match(/slide(\d+)/)[1] - +b.match(/slide(\d+)/)[1]);
  assert.equal(slides.length, plan.pages.length);
  for (let i=0; i<slides.length; i++) assert.ok((await zip.file(slides[i]).async('string')).includes(`${i + 1} / ${plan.pages.length}`));
  const dir = path.join(root, 'tests/generated/export50'); await mkdir(dir, {recursive:true});
  await writeFile(path.join(dir, 'sample-editorial.pdf'), bytes);
  await writeFile(path.join(dir, 'sample-editorial.pptx'), new Uint8Array(await ppt.arrayBuffer()));
  await writeFile(path.join(dir, 'sample-editorial.html'), exportHTML3(plan));
});

test('all six original formats remain exposed with clear pagination guidance', () => {
  reset();
  const files = filesPanel22();
  assert.deepEqual([...files.matchAll(/data-export="([^"]+)"/g)].map(match => match[1]), ['pdf','docx','pptx','png','html','md']);
  assert.ok(files.includes('更新整个目录'));
  assert.ok(files.includes('showPageNumbers'));
  assert.ok(stylePanel().includes('pageDecoration'));
});
