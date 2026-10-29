import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setup} from './support.mjs';
await setup();
const data = await import('../js/data.js');
const {fresh} = await import('../js/model.js');
const {ctx} = await import('../js/state.js');
const {validateDraft} = await import('../js/utils/validation.js');
const {createBackup} = await import('../js/backup.js');
const {routeName3,routeGroup3} = await import('../js/app.js');
const explore = await import('../js/modules/explore.js');
await data.loadBuiltinData();await data.loadRouteData('explore');ctx.state = fresh();

test('four classic entrances and the complete supplied Guanzi source are preserved',()=>{
  assert.deepEqual(data.CLASSICS.books.map(book=>book.title),['论语','道德经','管子','庄子']);
  const book = explore.exploreBook('guanzi');
  assert.equal(createHash('sha256').update(book.markdown,'utf8').digest('hex'),book.source.sha256);
  assert.equal(book.source.sha256,'0822133bfe03e4b1d2dfd20c3b35139d47c6bbf01699eab18974d26fb600c8c5');
  assert.ok(data.CLASSICS.books.filter(book=>book.id!=='guanzi').every(book=>book.markdown===''));
  const html = explore.explorePage();assert.ok(html.includes('学习中心'));assert.ok(html.includes('data-go3="quiz"'));
  for (const book of data.CLASSICS.books) assert.ok(html.includes('data-go3="classic:'+book.id+'"'));
});
test('Guanzi has all 100 original numbered passages, 26 chapters, source notes and study advice',()=>{
  const parsed = explore.exploreParseBook(explore.exploreBook('guanzi'));
  assert.equal(parsed.entries.length,100);assert.equal(parsed.chapters.length,26);
  assert.deepEqual(parsed.entries.map(entry=>entry.number),Array.from({length:100},(_,i)=>i+1));
  assert.equal(new Set(parsed.entries.map(entry=>entry.id)).size,100);
  assert.ok(parsed.entries.every(entry=>entry.markdown.includes('> ')&&entry.markdown.includes('**简释：**')));
  assert.ok(parsed.intro.includes('ISBN 9787101133325'));assert.ok(parsed.intro.includes('## 校勘重点'));
  assert.ok(parsed.afterword.includes('## 背诵使用建议'));assert.ok(parsed.afterword.includes('能准确复述原文'));
  const html = explore.classicPage('guanzi');
  assert.equal((html.match(/class="classic-passage"/g)||[]).length,100);assert.ok(html.includes('id="guanzi-100"'));
});
test('reviewed editorial wordings remain exactly as supplied, including the corrected punctuation',()=>{
  const entries = explore.exploreParseBook(explore.exploreBook('guanzi')).entries;
  for (const [number,text] of [[30,'必顺于礼义'],[36,'修长在乎任贤，高安在乎同利'],[37,'骄君使疲民则国危'],[59,'方圜'],[61,'政平则人安；士教和，则兵胜敌'],[69,'权出于道'],[80,'重赋敛，得民财'],[90,'六曰问疾'],[92,'听之术，曰勿望而距，勿望而许'],[100,'轻重无数。物发而应之，闻声而乘之']]) assert.ok(entries[number-1].markdown.includes(text),String(number));
});
test('passage search and chapter selection combine without changing source content',()=>{
  const parsed = explore.exploreParseBook(explore.exploreBook('guanzi'));
  assert.equal(explore.exploreFilteredEntries(parsed,'','').length,100);
  assert.deepEqual(explore.exploreFilteredEntries(parsed,'方圜','').map(entry=>entry.number),[59]);
  assert.equal(explore.exploreFilteredEntries(parsed,'',parsed.chapters[0]).length,7);
  assert.equal(explore.exploreFilteredEntries(parsed,'方圜',parsed.chapters[0]).length,0);
  assert.equal(explore.exploreFilteredEntries(parsed,'__no_such_phrase__','').length,0);
  assert.equal(parsed.entries.length,100);
});
test('Markdown displays emphasis and lists while treating HTML and executable links as inert text',()=>{
  const html = explore.exploreMarkdown('# 标题\n\n> **原文**\n\n**简释：** <img src=x onerror=alert(1)>\n\n- 说明\n\n1. 复习\n\n<script>alert(1)</script>\n[jump](javascript:alert(1))');
  assert.ok(html.includes('<strong>原文</strong>'));assert.ok(html.includes('<ul>'));assert.ok(html.includes('<ol>'));
  assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script'));
  assert.equal(/<(img|script|a)\b/.test(html),false);
});
test('old quiz routes remain valid while new center and all four classic pages validate',()=>{
  for (const route of ['quiz','explore','reading',...data.CLASSICS.books.map(book=>'classic:'+book.id)]) {
    const state = fresh();state.route=route;assert.equal(validateDraft(state).route,route);
    assert.equal(routeGroup3(route).id,'learning-center');
  }
  const bad = fresh();bad.route='classic:<invalid>';assert.throws(()=>validateDraft(bad));
  assert.equal(routeName3('classic:guanzi'),'《管子》');assert.equal(routeName3('quiz'),'练习中心');
});
test('uninstalled classics show an honest empty state; static texts do not enter personal backups',()=>{
  for (const id of ['lunyu','daodejing','zhuangzi']) {
    const html = explore.classicPage(id);assert.ok(html.includes('学习资料尚未收录'));assert.ok(!html.includes('class="classic-passage"'));
  }
  const backup = JSON.stringify(createBackup(fresh()));assert.ok(!backup.includes('仓廪实'));assert.ok(!backup.includes('classics'));
});
