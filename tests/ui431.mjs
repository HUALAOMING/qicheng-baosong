import {chromium} from 'file:///C:/Users/LHM66/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('tests/generated/ui431');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'zh-CN',timezoneId:'Asia/Shanghai',reducedMotion:'no-preference'});
const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
async function go(route){await page.evaluate(route=>window.ResumeStudio.go3(route),route);}
async function test(name,fn){try{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){checks.push({name,status:'FAIL',error:e.stack});console.log('FAIL '+name+': '+e.message);await page.keyboard.press('Escape');await page.mouse.up();await page.clock.resume().catch(()=>{});await page.waitForTimeout(700);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png')});}}
try{
 await page.goto('http://127.0.0.1:4177/');await page.waitForSelector('.home-dashboard');
 await page.evaluate(async()=>{
  const state=window.ResumeStudio.fresh();state.profile.targetSchool='浙江大学';state.profile.targetMajor='外国语言文学';state.dreamSchools=['浙江大学','哈尔滨工业大学'];state.onboarded=true;window.ResumeStudio.setState(state);
  const {storage}=await import('/js/storage.js');const home=await import('/js/modules/home.js');await storage.set('settings:countdown',{name:'保送考试',date:'2027-01-15'});await home.saveHomePreferences({featuredSchool:'浙江大学',quoteSource:'classic',quoteBookId:'guanzi'});await home.initializeHome();window.ResumeStudio.go3('home');
 });
 for(const theme of ['pudding','obsidian','blue']){
  await page.evaluate(async theme=>{(await import('/js/state.js')).ctx.state.theme=theme;window.ResumeStudio.render();},theme);
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(output,'home-'+theme+'.png'),fullPage:true});
 }
 await test('home is a house row; learning contains two direct subpages',async()=>{
  await page.locator('.menu-toggle').click();
  assert.equal(await page.locator('nav .nav-home').count(),1);assert.equal(await page.locator('nav .nav-home [data-go3]').count(),0);
  await page.locator('[data-nav-group="learning-center"]').click();await page.locator('nav [data-go3="reading"]').click();assert.equal(await page.locator('.reading-center h1').textContent(),'阅读扩展');assert.equal(await page.locator('.explore-book').count(),4);assert.equal(await page.locator('.explore-quiz').count(),0);
  await page.locator('[data-go3="classic:guanzi"]').click();assert.equal(await page.locator('.classic-passage').count(),100);await page.locator('.classic-reader > [data-go3="reading"]').click();await page.locator('nav [data-go3="quiz"]').click();assert.equal(await page.locator('.page-head h1').textContent(),'练习中心');
 });
 await go('studio');await page.locator('[data-studio-tab="order"]').click();
 await page.screenshot({path:path.join(output,'order-before.png'),fullPage:true});
 const order=()=>page.locator('#moduleOrder > [data-order-key]').evaluateAll(rows=>rows.map(row=>row.dataset.orderKey));
 const persisted=()=>page.evaluate(async()=>(await import('/js/model.js')).currentVersion().order.slice());
 await page.evaluate(async()=>{await window.ResumeStudio.save();const {storage}=await import('/js/storage.js');window.__writes=0;const set=storage.set.bind(storage);storage.set=async(...args)=>{window.__writes++;return set(...args);};});
 await test('drag tracks the grab offset, reorders live, and commits only once on drop',async()=>{
  const before=await order(),handle=page.locator('[data-order-handle]').first();await handle.scrollIntoViewIfNeeded();const h=await handle.boundingBox(),row=await handle.locator('..').boundingBox();
  await page.mouse.move(h.x+14,h.y+18);await page.mouse.down();await page.mouse.move(h.x+17,h.y+21);assert.equal(await page.locator('.order-drag-float').count(),0);
  await page.mouse.move(h.x+14,h.y+180,{steps:8});
  const ghost=await page.locator('.order-drag-float').boundingBox();assert.ok(Math.abs(ghost.y-(row.y+162))<2);assert.ok(Math.abs(ghost.x-row.x)<2);assert.equal(await page.locator('#moduleOrder .drag-placeholder').count(),1);assert.deepEqual(await persisted(),before);assert.equal(await page.evaluate(()=>window.__writes),0);
  await page.mouse.up();await page.waitForTimeout(750);const after=await order();assert.notDeepEqual(after,before);assert.deepEqual(await persisted(),after);assert.equal(await page.evaluate(()=>window.__writes),1);assert.equal(await page.locator('.order-drag-float').count(),0);
 });
 await test('Escape and pointer cancellation roll back the drag without saving',async()=>{
  const before=await order(),writes=await page.evaluate(()=>window.__writes),handle=page.locator('[data-order-handle]').first();await handle.scrollIntoViewIfNeeded();let h=await handle.boundingBox();
  await page.mouse.move(h.x+15,h.y+20);await page.mouse.down();await page.mouse.move(h.x+15,h.y+200,{steps:7});assert.notDeepEqual(await order(),before);await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(700);assert.deepEqual(await order(),before);assert.equal(await page.evaluate(()=>window.__writes),writes);
  h=await handle.boundingBox();await page.mouse.move(h.x+15,h.y+20);await page.mouse.down();await page.mouse.move(h.x+15,h.y+170,{steps:7});await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));await page.mouse.up();await page.waitForTimeout(700);assert.deepEqual(await order(),before);assert.equal(await page.evaluate(()=>window.__writes),writes);
 });
 await test('keyboard ordering retains focus and debounces consecutive edits into one save',async()=>{
  const before=await order(),writes=await page.evaluate(()=>window.__writes),handle=page.locator('[data-order-handle]').first();const key=await handle.getAttribute('data-order-handle');await handle.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');assert.equal(await order().then(rows=>rows[2]),key);assert.equal(await page.evaluate(()=>document.activeElement.dataset.orderHandle),key);await page.waitForTimeout(750);assert.equal(await page.evaluate(()=>window.__writes),writes+1);assert.notDeepEqual(await persisted(),before);
 });
 await test('a settling row can be grabbed again and reversed without locking input',async()=>{
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+50));
  const handle=page.locator('[data-order-handle]').nth(2),key=await handle.getAttribute('data-order-handle');await handle.evaluate(e=>e.scrollIntoView({block:'center'}));let h=await handle.boundingBox();
  await page.mouse.move(h.x+20,h.y+20);await page.mouse.down();await page.mouse.move(h.x+20,h.y+140,{steps:6});await page.mouse.up();
  const moving=page.locator('#moduleOrder [data-order-handle="'+key+'"]');assert.equal(await moving.locator('..').evaluate(e=>e.classList.contains('order-released')),true);h=await moving.boundingBox();await page.mouse.move(h.x+20,h.y+20);await page.mouse.down();
  assert.equal(await moving.getAttribute('aria-pressed'),'true',JSON.stringify(await page.evaluate(({x,y})=>({hit:document.elementFromPoint(x,y)?.outerHTML,pressed:[...document.querySelectorAll('[aria-pressed="true"]')].map(e=>e.outerHTML),rows:[...document.querySelectorAll('#moduleOrder .module-order-row')].map(e=>({key:e.dataset.orderKey,z:getComputedStyle(e).zIndex,y:e.getBoundingClientRect().y,transform:e.style.transform}))}),{x:h.x+20,y:h.y+20})));await page.mouse.move(h.x+20,h.y-140,{steps:6});assert.equal(await page.locator('.order-drag-float').count(),1);await page.mouse.up();await page.clock.resume();await page.waitForTimeout(750);assert.equal(await page.locator('.order-drag-float').count(),0);assert.deepEqual(await persisted(),await order());
 });
 await test('edge dragging scrolls continuously; cancel restores order without a write',async()=>{
  const before=await order(),writes=await page.evaluate(()=>window.__writes),handle=page.locator('[data-order-handle]').first();await handle.scrollIntoViewIfNeeded();const h=await handle.boundingBox(),scroll=await page.evaluate(()=>scrollY);
  await page.mouse.move(h.x+20,h.y+20);await page.mouse.down();await page.mouse.move(h.x+20,1030,{steps:8});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>scrollY)>scroll);assert.equal(await page.evaluate(()=>window.__writes),writes);await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(700);assert.deepEqual(await order(),before);assert.equal(await page.evaluate(()=>window.__writes),writes);
 });
 await test('leaving mid-drag removes listeners and ghost; pending edits still persist',async()=>{
  const before=await order(),handle=page.locator('[data-order-handle]').first();await handle.scrollIntoViewIfNeeded();const h=await handle.boundingBox();await page.mouse.move(h.x+15,h.y+20);await page.mouse.down();await page.mouse.move(h.x+15,h.y+175,{steps:5});await go('home');await page.mouse.up();assert.equal(await page.locator('.order-drag-float').count(),0);assert.deepEqual(await persisted(),before);
  await go('profile');await page.locator('[data-bind="profile.name"]').fill('切页仍保存');await go('reading');await page.waitForTimeout(750);const state=await page.evaluate(async()=>(await(await import('/js/storage.js')).storage.get('current')).profile.name);assert.equal(state,'切页仍保存');
 });
 await test('quiz overview excludes drafts; weighted totals, marks, legacy time and filter are correct',async()=>{
  for(const [size,wrong,elapsed] of [[7,2,65],[3,0,35]]){
   await page.evaluate(async({size,wrong})=>{const quiz=await import('/js/modules/quiz.js');const session=quiz.quizStart('english-grammar','random',size);session.questions.forEach((question,index)=>quiz.quizAnswer(index,index<wrong?question.options.find(o=>o.id!==question.answer).id:question.answer));},{size,wrong});
   await page.clock.fastForward(elapsed*1000);await page.evaluate(async()=>await(await import('/js/modules/quiz.js')).quizSubmit());
  }
  await page.clock.resume();
  await page.evaluate(async()=>{
   const quiz=await import('/js/modules/quiz.js');
   await quiz.quizFavorite('english-grammar',(await import('/js/resources.js')).listQuizBanks().find(b=>b.bank.id==='english-grammar').questions[0].id);quiz.quizStart('english-vocabulary','random',5);
  });await go('dashboard');assert.equal(await page.locator('[data-quiz-stat="total"]').textContent(),'10');assert.equal(await page.locator('[data-quiz-stat="groups"]').textContent(),'2');assert.equal(await page.locator('[data-quiz-stat="accuracy"]').textContent(),'80%');assert.equal(await page.locator('[data-quiz-stat="time"]').textContent(),'01:40');assert.equal(await page.locator('[data-quiz-stat="favorites"]').textContent(),'1');assert.equal(await page.locator('.quiz-recent-results li').count(),2);
  const writes=await page.evaluate(()=>window.__writes);await page.locator('#quizDashboardSection').selectOption('vocabulary');assert.equal(await page.locator('[data-quiz-stat="total"]').textContent(),'0');assert.equal(await page.locator('[data-quiz-stat="accuracy"]').textContent(),'—');await page.locator('#quizDashboardSection').selectOption('');await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>window.__writes),writes);
  await page.screenshot({path:path.join(output,'dashboard-obsidian.png'),fullPage:true});
 });
 await test('reduced motion, high contrast and small viewport remain usable',async()=>{
  await page.emulateMedia({reducedMotion:'reduce',contrast:'more'});await go('home');assert.equal(await page.locator('.home-destination').evaluate(e=>getComputedStyle(e).backdropFilter),'none');
  for(const [width,height] of [[390,844],[820,1180],[1440,1050]]){await page.setViewportSize({width,height});for(const route of ['home','reading','dashboard','studio']){await go(route);if(route==='studio')await page.locator('[data-studio-tab="order"]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+route);}}
  await page.emulateMedia({reducedMotion:'no-preference',contrast:'no-preference'});await page.setViewportSize({width:390,height:844});await go('home');await page.screenshot({path:path.join(output,'home-dark-mobile.png'),fullPage:true});
 });
 await test('touch pointer dragging reorders and saves the final order once',async()=>{
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),mobile=await touch.newPage();
  try{
   await mobile.goto('http://127.0.0.1:4177/');await mobile.waitForSelector('.home-dashboard');await mobile.evaluate(()=>window.ResumeStudio.go3('studio'));await mobile.locator('[data-studio-tab="order"]').tap();
   const before=await mobile.locator('#moduleOrder > [data-order-key]').evaluateAll(rows=>rows.map(row=>row.dataset.orderKey));await mobile.evaluate(async()=>{await window.ResumeStudio.save();const {storage}=await import('/js/storage.js');window.__touchWrites=0;const set=storage.set.bind(storage);storage.set=async(...args)=>{window.__touchWrites++;return set(...args);};});
   const handle=mobile.locator('[data-order-handle]').first();await handle.scrollIntoViewIfNeeded();const h=await handle.boundingBox(),cdp=await touch.newCDPSession(mobile),x=h.x+20,y=h.y+20;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let offset=20;offset<=180;offset+=20)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+offset,id:1}]});assert.equal(await mobile.locator('.order-drag-float').count(),1);assert.equal(await mobile.evaluate(()=>window.__touchWrites),0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(750);
   const after=await mobile.locator('#moduleOrder > [data-order-key]').evaluateAll(rows=>rows.map(row=>row.dataset.orderKey));assert.notDeepEqual(after,before);assert.equal(await mobile.evaluate(()=>window.__touchWrites),1);assert.deepEqual(await mobile.evaluate(async()=>(await import('/js/model.js')).currentVersion().order),after);
  }finally{await touch.close();}
 });
 await test('no uncaught runtime errors',async()=>assert.deepEqual(errors,[]));
}finally{await context.close();await browser.close();await writeFile(path.join(output,'summary.json'),JSON.stringify({checks,errors},null,2));if(checks.some(item=>item.status==='FAIL'))process.exitCode=1;}
