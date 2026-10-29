// Golden workspace HTML captured from the uploaded v3.1, using synthetic data.
// Unchanged routes retain exact golden HTML. The 5.2 reading/score/statement
// extensions compare original fields and records explicitly rather than their old layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {setup,root,workspaceHTML} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {loadBuiltinData,loadRouteData}=await import('../js/data.js');
const {validateDraft}=await import('../js/utils/validation.js');
const {render}=await import('../js/app.js');
const {journalDateKey}=await import('../js/modules/journal.js');
const {chartValue3,lineChart3}=await import('../js/modules/dashboard.js');
await loadBuiltinData();
const input=JSON.parse(await readFile(path.join(root,'tests/fixtures/input.json'),'utf8'));
const snapshots=JSON.parse(await readFile(path.join(root,'tests/fixtures/v3.1-workspaces.json'),'utf8'));
function boundControls(html) {
  const result=new Map();
  for(const match of html.matchAll(/<input\b([^>]*)>|<(textarea|select)\b([^>]*)>([\s\S]*?)<\/\2>/g)) {
    const attrs=match[1]||match[3],binding=attrs.match(/data-bind="([^"]+)"/)?.[1];if(!binding)continue;
    const tag=match[1]!==undefined?'input':match[2];
    const value=tag==='input'?(attrs.match(/value="([^"]*)"/)?.[1]||''):tag==='textarea'?match[4]:[...match[4].matchAll(/<option value="([^"]*)"([^>]*)>/g)].find(option=>/\bselected\b/.test(option[2]))?.[1];
    result.set(binding,{tag,value});
  }
  return result;
}
function assertEvolvedRouteParity(route,html,expected) {
  if(route==='statement') {
    for(const field of ['statement.otherLanguage','statement.other'])assert.ok(html.includes('data-bind="'+field+'"'),field);
    for(const language of ['zh','en','other'])assert.ok(html.includes('data-intro-choice52="'+language+'"'));
    const original=html.replace(/<div class="statement-import52">[\s\S]*?<\/div>/g,'')
      .replace(/<h2>[^<]*<\/h2><label class="field"><span>[^<]*<\/span><input[^>]*data-bind="statement.otherLanguage"[\s\S]*?(?=<div class="grid2">)/,'');
    assert.equal(original,expected);return;
  }
  if(route==='learning') {
    const actual=boundControls(html),original=boundControls(expected);
    for(const [binding,control]of original) {
      const current=actual.get(binding);assert.ok(current,binding);
      if(binding==='bookDraft.date'&&!control.value)assert.deepEqual(current,{tag:'input',value:journalDateKey()});
      else assert.deepEqual(current,control,binding);
    }
    // Complete saved record markup and attachment actions remain unchanged.
    const records=source=>source.match(/<div class="records3">([\s\S]*?)<\/section>/)?.[1];
    assert.ok(records(expected));assert.equal(records(html),records(expected));
    for(const marker of ['data-import3="bookDraft"','data-picker3="bookDraft"','data-reading-mode="manual"','data-reading-mode="progress"'])assert.ok(html.includes(marker),marker);
    return;
  }
  if(route==='dashboard') {
    const examStart='<section class="panel exam-dashboard3">',overviewStart='<div class="overview-grid3">';
    assert.equal(html.split(examStart)[0],expected.split(examStart)[0]);
    assert.equal(html.slice(html.indexOf(overviewStart)),expected.slice(expected.indexOf(overviewStart)));
    const picks=source=>[...source.matchAll(/<input type="checkbox"[^>]*data-chart-exam3="([^"]+)"[^>]*>/g)].map(match=>match[0]);
    assert.deepEqual(picks(html),picks(expected));
    for(const id of ['chartMetric3','chartValueMode52','scoreChart3'])assert.ok(html.includes('id="'+id+'"'));
    for(const metric of ['score','rate','rank'])assert.ok(html.includes('value="'+metric+'"'));
    for(const exam of ctx.state.exams) {
      assert.ok(html.includes(exam.title));assert.ok(html.includes(exam.date));
      assert.equal(chartValue3(exam,'score'),Number(exam.totalScore));assert.equal(chartValue3(exam,'rank'),Number(exam.rank));
      for(const [mode,value]of [['score',exam.totalScore],['rank',exam.rank]])assert.ok(lineChart3(mode).includes(exam.title+'：'+value));
    }
    return;
  }
  assert.equal(html,expected);
}
for(const [key,expected]of Object.entries(snapshots))test('v3.1 feature/field parity: '+key,async()=>{
  const split=key.indexOf(':'),uiLang=key.slice(0,split),route=key.slice(split+1);
  ctx.state=validateDraft({...structuredClone(input),uiLang,route});await loadRouteData(route);render();
  // The new featured-school picker is tested separately; compare all original content.
  const html=workspaceHTML(env.document).replace(/<section class="panel home-school-picker">[\s\S]*?<\/section>/,'').replace(/<section class="quiz-dashboard panel"[\s\S]*?<\/section>/,'').replace(/<section class="panel school-facts53">[\s\S]*?<\/section>/,'').replace(/<button class="school-feature-button"[\s\S]*?<\/button>/g,'');
  assertEvolvedRouteParity(route,html,expected);
});
