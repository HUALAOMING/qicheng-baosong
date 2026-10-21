// Opt-in real-browser export acceptance. Run scripts/serve.mjs first.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'tests/generated/browser-export50');
await mkdir(output, {recursive:true});
const runtime = process.env.QICHENG_PLAYWRIGHT || 'C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium} = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({executablePath:process.env.QICHENG_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000}, locale:'zh-CN', timezoneId:'Asia/Shanghai', reducedMotion:'reduce', acceptDownloads:true, serviceWorkers:'block'});
const page = await context.newPage(), checks = [], errors = [];
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
const report = {startedAt:new Date().toISOString(), browser:await browser.version(), isolatedContext:true, checks, errors,
  limitations:['Headless Edge; DOCX fields and final Word pagination were checked structurally, not rendered by Microsoft Word.']};
const go = route => page.evaluate(route => window.ResumeStudio.go3(route), route);
const writes = () => page.evaluate(() => window.__exportCurrentWrites);
const planData = () => page.evaluate(async () => {
  const plan = await window.ResumeStudio.documentPlan();
  return {count:plan.pages.length, toc:plan.tocPageCount, references:plan.tocEntries, pages:plan.pages.map(page => ({items:page.items.map(({kind,role,text,color}) => ({kind,role,text,color}))}))};
});
async function check(name, run) {
  try {const detail = await run(); checks.push({name,status:'PASS',detail}); console.log('PASS ' + name);}
  catch (error) {checks.push({name,status:'FAIL',error:error.stack}); console.error('FAIL ' + name + ': ' + error.message); await page.screenshot({path:path.join(output, 'failure-' + checks.length + '.png'),fullPage:true}).catch(() => {});}
  await writeFile(path.join(output,'summary.json'), JSON.stringify(report,null,2));
}
async function downloadFormat(type) {
  await page.locator(`[data-export="${type}"]`).click();
  if (await page.locator('#confirmDialog[open]').count()) await page.locator('#confirmAccept').click();
  await page.waitForSelector('#downloadDialog[open]', {timeout:30000});
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#downloadLink').click()]);
  const target = path.join(output,download.suggestedFilename()); await download.saveAs(target);
  await page.locator('#closeDownload').click();
  return target;
}
try {
  await page.goto(process.env.QICHENG_BASE_URL || 'http://127.0.0.1:4177/');
  await page.waitForSelector('.home-dashboard');
  await page.evaluate(async () => {
    const state = window.ResumeStudio.fresh();
    Object.assign(state.profile,{name:'模板体验同学',school:'启程示例中学',birthday:'2008-01-01',schoolLanguage:'英语',phone:'13800000000'});
    state.statement.zh = '用清晰的表达，记录学习的积累。\n每一段真实经历都值得被认真呈现。';
    state.customBlocks = [{id:'export-example',title:'研究与作品',text:'阅读、思考、写作。\n留出空间，让内容成为主角。',layout:'stack',photos:[],attachments:[]}];
    Object.assign(state.versions[0],{showAvatar:false,photoMode:'none',showToc:true,disabled:[],filename:'启程5.0-导出验证'});
    state.onboarded = true; window.ResumeStudio.setState(state); await window.ResumeStudio.save();
    const {storage} = await import('/js/storage.js');
    const set = storage.set.bind(storage); window.__exportCurrentWrites = 0;
    storage.set = async (key, value) => {if (key === 'current') window.__exportCurrentWrites++; return set(key,value);};
  });

  await check('temporary export tabs and route switches do not save', async () => {
    const before = await writes(); await go('studio');
    for (const tab of ['style','files','order','files','style']) await page.locator(`.studio-tabs [data-studio-tab="${tab}"]`).click();
    await go('home'); await go('studio'); await page.waitForTimeout(900);
    assert.equal(await writes(),before);
    return {currentWrites:await writes()};
  });

  await check('changing paper finish is saved once even when leaving immediately', async () => {
    await page.locator('[data-studio-tab="style"]').click(); const before = await writes();
    await page.locator('[data-v-setting="pageDecoration"]').selectOption('frame'); await go('home'); await page.waitForTimeout(1000);
    assert.equal(await writes(), before + 1);
    assert.equal(await page.evaluate(async () => (await (await import('/js/storage.js')).storage.get('current')).versions[0].pageDecoration),'frame');
    await go('studio'); await page.locator('[data-studio-tab="files"]').click();
    const plan = await planData();
    assert.ok(plan.pages.every(page => page.items.filter(item => item.role === 'page-frame').length === 4));
    for (const entry of plan.references) assert.ok(plan.pages[entry.page - 1].items.some(item => item.text === entry.text));
    await page.waitForSelector('#pagePreview svg'); await page.locator('#pagePreview').screenshot({path:path.join(output,'framed-preview.png')});
    return {pageCount:plan.count,contentsPages:plan.toc};
  });

  await check('page-number toggle updates preview and persists without hiding TOC references', async () => {
    const before = await writes(); await page.locator('[data-v-bool="showPageNumbers"]').uncheck(); await page.waitForTimeout(900);
    assert.equal(await writes(), before + 1);
    const plan = await planData();
    assert.ok(plan.pages.every(page => !page.items.some(item => item.role === 'page-number')));
    assert.ok(plan.pages.some(page => page.items.some(item => item.role === 'toc-page-number')));
    assert.equal(await page.evaluate(async () => (await (await import('/js/storage.js')).storage.get('current')).versions[0].showPageNumbers),false);
    await page.locator('[data-v-bool="showPageNumbers"]').check(); await page.waitForTimeout(900);
    assert.ok((await planData()).pages.every(page => page.items.some(item => item.role === 'page-number')));
    return {pageNumbersRestored:true};
  });

  await check('PNG export works offline and includes all pages as genuine images', async () => {
    await context.setOffline(true);
    try {
      const file = await downloadFormat('png'), bytes = await readFile(file);
      assert.equal(bytes.subarray(0,2).toString(),'PK');
      const result = await page.evaluate(async encoded => {
        const zip = await JSZip.loadAsync(encoded,{base64:true});
        const files = Object.keys(zip.files).filter(name => name.endsWith('.png'));
        const first = await zip.file(files[0]).async('uint8array');
        return {files,signature:[...first.slice(0,8)],first:await zip.file(files[0]).async('base64')};
      },bytes.toString('base64'));
      assert.equal(result.files.length,(await planData()).count);
      assert.deepEqual(result.signature,[137,80,78,71,13,10,26,10]);
      await writeFile(path.join(output,'exported-page-1.png'),Buffer.from(result.first,'base64'));
      return {filename:path.basename(file),pages:result.files.length};
    } finally {await context.setOffline(false);}
  });

  await check('all original document download buttons create real files and export history', async () => {
    const files=[];
    for (const type of ['pdf','docx','pptx','html','md']) {
      const file=await downloadFormat(type),bytes=await readFile(file); assert.ok(bytes.length>100);
      if (type === 'pdf') assert.equal(bytes.subarray(0,4).toString(),'%PDF');
      if (['docx','pptx'].includes(type)) assert.equal(bytes.subarray(0,2).toString(),'PK');
      if (['html','md'].includes(type)) assert.ok(bytes.toString('utf8').includes('模板体验同学'));
      files.push({type,filename:path.basename(file),bytes:bytes.length});
    }
    const history=await page.evaluate(() => window.ResumeStudio.getState().exportHistory);
    for (const type of ['pdf','docx','pptx','png','html','md']) assert.ok(history.some(item => item.type === type));
    return files;
  });

  await check('responsive export controls fit narrow touch viewports', async () => {
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-studio-tab="style"]').click();
    await page.locator('[data-v-setting="pageDecoration"]').selectOption('editorial'); await page.waitForTimeout(800);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('.export-appearance').screenshot({path:path.join(output,'mobile-paper-finishes.png')});
    await page.locator('[data-studio-tab="files"]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.equal(await page.locator('[data-export]').count(),6);
    return {width:390,horizontalOverflow:false};
  });
  await check('no runtime or console errors were introduced',async () => {assert.deepEqual(errors,[]);return {errors:0};});
} finally {
  report.completedAt=new Date().toISOString(); await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2)); await browser.close();
}
if (checks.some(check => check.status === 'FAIL')) process.exitCode=1;
