import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';

await setup();
const {ctx} = await import('../js/state.js');
const {fresh} = await import('../js/model.js');
const {NAV3} = await import('../js/constants.js');
const {getPageHelp52} = await import('../js/modules/page-help52.js');
const {calculateWeightedExams52,dashboardPage3} = await import('../js/modules/dashboard.js');

beforeEach(() => { ctx.state = fresh(); ctx.studioTab = 'content'; });

test('every current page has its own help, including detail routes outside navigation', () => {
  const routes = [...new Set(NAV3.flatMap(group => group.items.map(item => item[0])))].filter(route => route !== 'studio');
  routes.push('explore','classic:lunyu','school:北京大学','settings','daily-quote');
  const help = routes.map(route => getPageHelp52(route));
  assert.equal(new Set(help.map(entry => entry.title)).size,routes.length);
  assert.equal(new Set(help.map(entry => entry.html)).size,routes.length);
  for (const entry of help) {
    assert.doesNotMatch(entry.title,/当前页面/);
    assert.match(entry.html,/<h3>.+<\/h3><p>.+<\/p>/);
    assert.doesNotMatch(entry.html,/菜单按录入、整理、个性内容/);
  }
  assert.equal(getPageHelp52('backup').html,getPageHelp52('settings').html);
});

test('all six composer tabs describe their own controls', () => {
  const tabs = ['content','style','media','order','check','files'];
  const help = tabs.map(tab => getPageHelp52('studio',tab));
  assert.equal(new Set(help.map(entry => entry.title)).size,6);
  assert.equal(new Set(help.map(entry => entry.html)).size,6);
  assert.match(help[1].html,/分割线、纸张背景、标题文字颜色/);
  assert.match(help[3].html,/拖动模块/);
  assert.match(help[5].html,/导出文件名/);
});

test('help refresh keys track the route, current composer tab and language', () => {
  ctx.state.route = 'reading-progress';
  const progress = getPageHelp52();
  assert.match(progress.title,/每日阅读进度/);
  ctx.state.route = 'dashboard';
  const dashboard = getPageHelp52();
  assert.notEqual(progress.key,dashboard.key);
  assert.match(dashboard.html,/为什么权重不用合计 100/);
  assert.doesNotMatch(dashboard.html,/按章节记录/);
  ctx.state.route = 'studio'; ctx.studioTab = 'media';
  const photos = getPageHelp52();
  ctx.studioTab = 'files';
  assert.notEqual(photos.key,getPageHelp52().key);
  const zh = getPageHelp52(); ctx.state.uiLang = 'en';
  assert.notEqual(zh.key,getPageHelp52().key);
  assert.match(getPageHelp52().title,/Export/);
});

test('English help is available for every page and composer tab', () => {
  ctx.state.uiLang = 'en';
  const routes = [...new Set(NAV3.flatMap(group => group.items.map(item => item[0])))];
  routes.push('classic:test','school:Test','daily-quote','settings','explore','backup');
  const help = routes.map(route => getPageHelp52(route));
  help.push(...['content','style','media','order','check','files'].map(tab => getPageHelp52('studio',tab)));
  for (const entry of help) {
    assert.match(entry.title,/ · Help$/);
    assert.doesNotMatch(entry.html,/[\u3400-\u9fff]/);
  }
  assert.match(getPageHelp52('dashboard').html,/relative proportions/);
  assert.match(getPageHelp52('dashboard').html,/substantial error/);
});

test('dashboard help explains normalization and equivalent ratios with correct examples', () => {
  const help = getPageHelp52('dashboard');
  for (const phrase of ['20:30:50','2:3:5','0.2:0.3:0.5','÷ Σ（权重）','÷10 = 93','权重为 0','仅供参考','可能存在较大误差','满分不同']) assert.ok(help.html.includes(phrase),phrase);
  const exams = [80,90,100].map((score,index) => ({id:String(index),totalScore:String(score),totalFullMark:'100',rank:String((index+1)*10)}));
  const results = [[20,30,50],[2,3,5],[0.2,0.3,0.5]].map(weights => calculateWeightedExams52(exams,weights.map((weight,index) => ({id:String(index),weight}))));
  for (const result of results) {
    assert.equal(result.valid,true);
    assert.ok(Math.abs(result.score-93)<1e-10);
    assert.ok(Math.abs(result.rank-23)<1e-10);
  }
  ctx.state.exams=exams;
  const calculator = dashboardPage3().split('<section class="panel weighted-calculator52">')[1];
  assert.match(calculator,/计算方式见右下角使用提示/);
  assert.match(calculator,/可能存在较大误差/);
  assert.doesNotMatch(calculator,/权重合计不必为 100|自动归一化|Σ（/);
});

test('help never echoes an unknown route as executable content', () => {
  const help = getPageHelp52('unknown:<img src=x onerror=alert(1)>');
  assert.doesNotMatch(help.title+help.html,/<img|onerror|<script/);
  assert.match(help.html,/手动保存/);
});
