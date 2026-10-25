import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.resolve('tests/generated/scores52');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname)));if(!file.startsWith(root+path.sep))throw Error('Invalid path');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Missing');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
const go=route=>page.evaluate(route=>ResumeStudio.go3(route),route);
const check=async(name,work)=>{try{await work();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(out,'failure-'+checks.length+'.png'),fullPage:true});}};
const start=async()=>{await page.waitForFunction(()=>window.ResumeStudio);if(await page.locator('#startupContinue52').isVisible())await page.locator('#startupContinue52').click();};
try{
  await page.goto('http://127.0.0.1:'+server.address().port);await start();
  await page.evaluate(async()=>{const {ctx}=await import('/js/state.js'),{blankExam}=await import('/js/constants.js');ctx.state.onboarded=true;ctx.state.exams=[{...blankExam(),id:'score-a',title:'第一次考试',date:'2026-10-01',totalScore:'600',totalFullMark:'750',rank:'10',subjects:[{id:'math-a',name:'数学',score:'120',fullMark:'150',rank:'5'}]},{...blankExam(),id:'score-b',title:'第二次考试',date:'2026-10-20',totalScore:'720',totalFullMark:'900',rank:'20',subjects:[{id:'math-b',name:'数学',score:'90',fullMark:'100',rank:'8'}]}];ResumeStudio.render();});
  await check('two dropdowns compare score rates with different full marks and use subject ranks',async()=>{
    await go('dashboard');await page.locator('#chartValueMode52').selectOption('rate');
    assert.match(await page.locator('.data-table3 tbody').textContent(),/80%/);
    await page.locator('#chartMetric3').selectOption('subject:数学');assert.match(await page.locator('#scoreChart3').textContent(),/90%/);
    await page.locator('#chartValueMode52').selectOption('rank');assert.match(await page.locator('.data-table3 tbody').textContent(),/5/);assert.equal(await page.locator('#chartSubject3,#rankChart3').count(),0);
    await page.screenshot({path:path.join(out,'subject-rank-desktop.png'),fullPage:true});
  });
  await check('weighted calculator updates immediately, rejects missing weights and computes normalized totals/ranks',async()=>{
    await page.locator('[data-weighted-exam52="score-a"]').check();await page.locator('[data-weight52="score-a"]').fill('25');
    await page.locator('[data-weighted-exam52="score-b"]').check();assert.match(await page.locator('#weightedResult52').textContent(),/非负权重/);
    await page.locator('[data-weight52="score-b"]').fill('75');assert.equal(await page.locator('[data-weighted-score52]').textContent(),'690');assert.equal(await page.locator('[data-weighted-rank52]').textContent(),'17.5');
    await page.locator('[data-weight52="score-b"]').fill('-1');assert.match(await page.locator('#weightedResult52').textContent(),/非负权重/);
    await page.locator('[data-weight52="score-b"]').fill('75');assert.match(await page.locator('.weighted-reference52').textContent(),/仅供参考，可能存在较大误差/);
    await page.locator('.weighted-calculator52').screenshot({path:path.join(out,'weighted-calculator.png')});
  });
  await check('empty calendar day opens a menu and a large editor, saves optional location and custom exam type',async()=>{
    await go('exam-calendar');await page.locator('#examCalendarMonth').fill('2026-10');await page.locator('#examCalendarMonth').dispatchEvent('change');
    await page.locator('[data-exam-date="2026-10-26"]').click();await page.waitForSelector('#examDateMenu52[open]');await page.locator('#examDateMenu52 [data-manual-exam-add52]').click();
    await page.waitForSelector('#manualExamEditor52[open]');assert.equal(await page.locator('#manualExamForm52 [name="date"]').inputValue(),'2026-10-26');
    assert.ok((await page.locator('#manualExamEditor52').boundingBox()).width>=700);
    await page.locator('#manualExamForm52 [name="schoolName"]').fill('测试院校');await page.locator('#manualExamForm52 [name="stage"]').selectOption('other');
    await page.locator('#manualExamEditor52').screenshot({path:path.join(out,'manual-exam-editor.png')});
    await page.locator('#manualExamForm52 [type="submit"]').click();await page.waitForSelector('#manualExamEditor52:not([open])',{state:'attached'});
    assert.match(await page.locator('#examDayDetails').textContent(),/测试院校/);assert.match(await page.locator('#examDayDetails').textContent(),/其他/);
    assert.equal(await page.evaluate(async()=>(await(await import('/js/modules/exam-calendar.js')).getManualExamEvents()).length),1);
  });
  await check('saved manual arrangements support edit, local JSON backup and reload',async()=>{
    await page.locator('[data-manual-exam-edit52]').click();await page.locator('#manualExamForm52 [name="stage"]').selectOption('interview');await page.locator('#manualExamForm52 [name="location"]').fill('教学楼 301');await page.locator('#manualExamForm52 [type="submit"]').click();
    await page.waitForSelector('#manualExamEditor52:not([open])',{state:'attached'});assert.match(await page.locator('#examDayDetails').textContent(),/教学楼 301/);
    const keys=await page.evaluate(async()=>Object.keys((await(await import('/js/backup.js')).getCurrentBackup()).data).filter(key=>key.startsWith('calendar:exam:')));assert.equal(keys.length,1);
    await page.reload();await start();await go('exam-calendar');await page.evaluate(async()=>{const calendar=await import('/js/modules/exam-calendar.js');calendar.selectExamCalendarDate('2026-10-26');ResumeStudio.render();});
    assert.match(await page.locator('#examDayDetails').textContent(),/教学楼 301/);assert.match(await page.locator('#examDayDetails').textContent(),/面试/);
  });
  await check('390px calculator, calendar and editor fit without horizontal overflow',async()=>{
    await page.setViewportSize({width:390,height:844});await go('dashboard');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('.weighted-calculator52').screenshot({path:path.join(out,'weighted-mobile.png')});
    await go('exam-calendar');await page.locator('[data-exam-date="2026-10-26"]').click();await page.locator('#examDateMenu52 [data-manual-exam-add52]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const bounds=await page.locator('#manualExamEditor52').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);await page.screenshot({path:path.join(out,'manual-exam-mobile.png'),fullPage:true});
    await page.locator('#manualExamEditor52 [data-exam-dialog-close52]').first().click();
  });
  await check('manual event deletion removes the persisted record after confirmation',async()=>{
    await page.locator('[data-manual-exam-delete52]').click();await page.waitForSelector('#confirmDialog[open]');await page.locator('#confirmAccept').click();await page.waitForSelector('.exam-calendar-empty');
    assert.equal(await page.evaluate(async()=>Object.keys(await(await import('/js/storage.js')).storage.getAll()).filter(key=>key.startsWith('calendar:exam:')).length),0);
  });
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));const report={checks,errors,passed:checks.filter(item=>item.status==='PASS').length,failed:checks.filter(item=>item.status==='FAIL').length};await writeFile(path.join(out,'summary.json'),JSON.stringify(report,null,2));if(report.failed||errors.length)process.exitCode=1;
}
