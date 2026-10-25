import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output=path.resolve('tests/generated/design52');await mkdir(output,{recursive:true});
const baseRoot=path.resolve('.'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'},server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),target=path.resolve(baseRoot,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));if(!target.startsWith(baseRoot+path.sep))throw Error('path');res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(await readFile(target));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=process.env.QICHENG_BASE_URL||'http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',timezoneId:'Asia/Shanghai',serviceWorkers:'allow'});
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
async function check(name,run){try{const detail=await run();checks.push({name,status:'PASS',detail});console.log('PASS '+name);}catch(error){checks.push({name,status:'FAIL',error:error.stack});console.error('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png')});}}
try{
 await page.goto(base);await page.waitForFunction(()=>window.ResumeStudio);
 if(await page.locator('#startupChoice52[open]').count())await page.locator('#startupContinue52').click();
 await page.evaluate(async()=>await navigator.serviceWorker.ready);
 await page.waitForFunction(async()=> (await navigator.serviceWorker.getRegistration())?.active?.state==='activated');
 await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('show'));
 await page.evaluate(()=>{const s=ResumeStudio.fresh();s.profile.name='启程排版体验';s.statement.zh='每一次阅读与思考，都让表达更清楚。';s.onboarded=true;s.versions[0].showAvatar=false;s.versions[0].photoMode='none';ResumeStudio.setState(s);ResumeStudio.go3('studio');});
 await page.locator('.studio-tabs [data-studio-tab="style"]').click();
 await check('independent colors and per-section override update the document',async()=>{
   for(const [key,color] of [['paperColor','#faf5eb'],['lineColor','#326d7e'],['titleColor','#714632']])await page.locator('[data-paper-color="'+key+'"]').evaluate((input,color)=>{input.value=color;input.dispatchEvent(new Event('input',{bubbles:true}));},color);
   await page.locator('details.module-style').filter({has:page.locator('[data-module-style="statement:titleColor"]')}).locator('summary').click();
   await page.locator('[data-module-style="statement:titleColor"]').evaluate(input=>{input.value='#315d83';input.dispatchEvent(new Event('input',{bubbles:true}));});
   const result=await page.evaluate(async()=>{const p=await ResumeStudio.documentPlan();return {colors:p.colors,title:p.pages.flatMap(p=>p.items).find(i=>i.text==='个人陈述')?.color,body:p.pages.flatMap(p=>p.items).find(i=>i.text==='每一次阅读与思考，都让表达更清楚。')?.color};});
   assert.equal(result.colors.bg,'#faf5eb');assert.equal(result.colors.line,'#326d7e');assert.equal(result.title,'#315d83');assert.equal(result.body,'#000000');
   await page.locator('.paper-design52').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('show'));
   await page.screenshot({path:path.join(output,'paper-controls.png')});return result;
 });
 await check('three-detent drag tracks continuously, settles, supports keyboard and cancels custom edits',async()=>{
   const slider=page.locator('#densitySwitch52');await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox(),cell=(box.width-8)/3;
   const x=box.x+4+cell*1.5,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+cell*.4,y,{steps:8});
   const during=await slider.locator('i').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41/el.getBoundingClientRect().width);
   assert.ok(during>1.25&&during<1.6,'thumb must follow fractional drag position');
   await page.mouse.move(x+cell,y,{steps:8});await page.mouse.up();await page.waitForTimeout(450);
   assert.equal(await slider.getAttribute('aria-valuenow'),'2');assert.equal(await page.evaluate(()=>ResumeStudio.currentVersion().margin),23);
   await slider.press('Home');assert.equal(await page.evaluate(()=>ResumeStudio.currentVersion().margin),13);
   await slider.press('ArrowRight');assert.equal(await page.evaluate(()=>ResumeStudio.currentVersion().fontSize),11);
   const margin=page.locator('[data-v-number="margin"]');await margin.fill('21');await margin.dispatchEvent('change');
   const now=await slider.boundingBox();await page.mouse.move(now.x+now.width/2,now.y+now.height/2);await page.mouse.down();await page.mouse.move(now.x+now.width*.8,now.y+now.height/2);await page.keyboard.press('Escape');await page.mouse.up();
   assert.equal(await page.evaluate(()=>ResumeStudio.currentVersion().margin),21);assert.equal(await page.evaluate(()=>ResumeStudio.currentVersion().layoutPreset),'custom');
   return {fractionalDrag:during,keyboard:true,customCancel:true};
 });
 await check('uploaded background reaches preview, PNG, PDF, editable PPTX and editable Word',async()=>{
   await page.evaluate(()=>ResumeStudio.currentVersion().showToc=true);
   const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=20;const x=c.getContext('2d');x.fillStyle='#e9f1f9';x.fillRect(0,0,40,20);return c.toDataURL('image/png').split(',')[1];});
   await page.locator('#paperImage52').setInputFiles({name:'paper.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
   await page.waitForSelector('#removePaperImage52');
   const data=await page.evaluate(async()=>{
     const p=await ResumeStudio.documentPlan(),canvases=await ResumeStudio.canvasPages(p),pixel=[...canvases[0].getContext('2d').getImageData(0,0,1,1).data];
     const pdf=await PDFLib.PDFDocument.load(await ResumeStudio.pdfBytes(p)),xObjects=pdf.getPages()[0].node.Resources().lookup(PDFLib.PDFName.of('XObject'));
     const ppt=await JSZip.loadAsync(await (await ResumeStudio.pptBlob(p)).arrayBuffer()),slides=await Promise.all(Object.keys(ppt.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name=>ppt.file(name).async('string')));
     const word=await JSZip.loadAsync(await (await ResumeStudio.wordBlob()).arrayBuffer()),headerFile=Object.keys(word.files).find(name=>/^word\/header\d+\.xml$/.test(name)),header=await word.file(headerFile).async('string'),xml=await word.file('word/document.xml').async('string');
     return {pages:p.pages.length,backgrounds:p.pages.map(pg=>pg.items[0].role),pixel,pdfImages:xObjects.keys().length,pptHasImage:slides.every(slide=>slide.includes('<p:pic>')),pptEditableText:slides.some(slide=>slide.includes('每一次阅读')),wordBehindText:header.includes('behindDoc="1"'),wordEditableText:xml.includes('每一次阅读'),htmlImage:ResumeStudio.exportHTML3(p).includes('data:image/jpeg;base64,')};
   });
   assert.ok(data.pages>=2);assert.ok(data.backgrounds.every(role=>role==='paper-background'));assert.ok(data.pixel.slice(0,3).every((value,index)=>Math.abs(value-[233,241,249][index])<=2));assert.equal(data.pixel[3],255);assert.ok(data.pdfImages>0);
   for(const key of ['pptHasImage','pptEditableText','wordBehindText','wordEditableText','htmlImage'])assert.equal(data[key],true,key);
   await page.locator('.studio-tabs [data-studio-tab="files"]').click();await page.waitForSelector('#pagePreview svg image');await page.waitForFunction(()=>!document.querySelector('#toast')?.classList.contains('show'));await page.locator('#pagePreview svg').last().screenshot({path:path.join(output,'paper-preview.png')});return data;
 });
 await check('removing background and reduced-motion keyboard settings preserve content',async()=>{
   await page.locator('.studio-tabs [data-studio-tab="style"]').click();await page.locator('#removePaperImage52').click();
   await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#densitySwitch52').press('End');
   const result=await page.evaluate(async()=>{const p=await ResumeStudio.documentPlan();return {background:p.backgroundData,text:ResumeStudio.getState().statement.zh,margin:ResumeStudio.currentVersion().margin};});
   assert.equal(result.background,'');assert.equal(result.margin,23);assert.equal(result.text,'每一次阅读与思考，都让表达更清楚。');
   await page.setViewportSize({width:390,height:844});await page.locator('#densitySwitch52').scrollIntoViewIfNeeded();const mobile=await page.locator('#densitySwitch52').boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390);
   await page.locator('#densitySwitch52').screenshot({path:path.join(output,'density-mobile.png')});return {...result,mobileControlWidth:mobile.width};
 });
}finally{await writeFile(path.join(output,'summary.json'),JSON.stringify({checks,errors},null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
assert.ok(checks.every(check=>check.status==='PASS'),JSON.stringify(checks.filter(check=>check.status!=='PASS')));assert.deepEqual(errors,[]);
