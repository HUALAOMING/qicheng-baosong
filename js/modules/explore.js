import { $, $$, esc, tr, icon3, download } from '../utils/helpers.js';
import { CLASSICS } from '../data.js';
import { ctx } from '../state.js';

let exploreBookID = '', exploreQuery = '', exploreChapter = '';
const exploreParsedBooks = new Map();

function exploreBook(id) { return CLASSICS.books.find(book => book.id === id); }
function exploreInline(text) {
  return esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
// A deliberately small safe renderer for the supplied Markdown: text, emphasis,
// headings, blockquotes and lists. Raw HTML and executable links are never used.
function exploreMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n?/g,'\n').split('\n');
  let html = '', paragraph = [], quote = [], list = '', items = [];
  const flushParagraph = () => { if (paragraph.length) html += '<p>'+exploreInline(paragraph.join('\n'))+'</p>'; paragraph = []; };
  const flushQuote = () => { if (quote.length) html += '<blockquote>'+exploreInline(quote.join('\n'))+'</blockquote>'; quote = []; };
  const flushList = () => { if (items.length) html += '<'+list+'>'+items.map(item=>'<li>'+exploreInline(item)+'</li>').join('')+'</'+list+'>'; items = []; list = ''; };
  const flush = () => { flushParagraph(); flushQuote(); flushList(); };
  for (const line of lines) {
    if (!line.trim()) { flush(); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) { flush(); html += '<h3>'+exploreInline(heading[2])+'</h3>'; continue; }
    if (/^---+$/.test(line.trim())) { flush(); html += '<hr>'; continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); flushList(); quote.push(line.replace(/^>\s?/,'')); continue; }
    const item = /^\s*(?:([-*])\s+|\d+\.\s+)(.+)$/.exec(line);
    if (item) {
      flushParagraph(); flushQuote(); const next = item[1] ? 'ul' : 'ol';
      if (list && next !== list) flushList(); list = next; items.push(item[2]); continue;
    }
    flushQuote(); flushList(); paragraph.push(line.trimEnd());
  }
  flush(); return html;
}
function exploreParseBook(book) {
  if (!book) return {intro:'',entries:[],chapters:[],afterword:''};
  const prior = exploreParsedBooks.get(book.id);
  if (prior?.markdown === book.markdown) return prior.parsed;
  const lines = book.markdown.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  const intro = [], afterword = [], entries = [], chapters = [];
  let chapter = '', current = null, started = false, ending = false;
  const finish = () => {
    if (!current) return;
    current.markdown = current.lines.join('\n').trim(); delete current.lines;
    entries.push(current); current = null;
  };
  for (const line of lines) {
    const chapterMatch = /^## ([一二三四五六七八九十]+、.+)$/.exec(line);
    if (chapterMatch) {
      finish(); started = true; chapter = chapterMatch[1]; chapters.push(chapter); continue;
    }
    const number = /^### (\d+)\s*$/.exec(line);
    if (number && started && !ending) {
      finish(); const n = Number(number[1]);
      current = {id:book.id+'-'+String(n).padStart(3,'0'),number:n,chapter,lines:[]}; continue;
    }
    if (started && /^## /.test(line)) { finish(); ending = true; }
    if (ending) afterword.push(line);
    else if (current) current.lines.push(line);
    else if (!started) intro.push(line);
  }
  finish();
  const parsed = {intro:intro.join('\n').trim(),entries,chapters,afterword:afterword.join('\n').trim()};
  exploreParsedBooks.set(book.id,{markdown:book.markdown,parsed}); return parsed;
}
function explorePage() {
  return '<div class="explore-center"><header class="explore-heading"><p class="eyebrow">QICHENG / LEARNING</p><h1>'+tr('学习拓展中心','Learning center')+'</h1><p>'+tr('练习语言，读懂经典。把知识积累，融入每一天。','Practice languages and explore Chinese classics at your own pace.')+'</p></header>'+
    '<section class="explore-quiz"><div><p class="eyebrow">01 / '+tr('答题训练','QUIZ PRACTICE')+'</p><h2>'+tr('用一组练习，巩固所学。','Put your knowledge into practice.')+'</h2><p>'+tr('英语与中文 · 每组 10 / 20 题 · 错题与收藏复练','English & Chinese · 10 / 20 questions · Mistakes & favorites')+'</p></div><button class="primary" data-go3="quiz">'+tr('进入答题训练','Open quiz practice')+' ↗</button></section>'+
    '<section class="explore-classics"><div class="explore-section-title"><p class="eyebrow">02 / '+tr('中华文化典籍','CHINESE CLASSICS')+'</p><h2>'+tr('从经典中，拓展眼界。','Read beyond the familiar.')+'</h2></div><div class="explore-book-grid">'+CLASSICS.books.map((book,index)=>{
      const parsed = exploreParseBook(book), ready = parsed.entries.length > 0;
      return '<button class="explore-book" data-go3="classic:'+esc(book.id)+'"><span class="explore-book-number">0'+(index+1)+'</span><span class="explore-book-body"><strong>《'+esc(book.title)+'》</strong><small>'+esc(ready ? book.subtitle : tr('学习资料待收录','Study material coming later'))+'</small><span class="explore-book-status">'+(ready ? parsed.entries.length+tr(' 句 · 原文与简释',' passages · Text & explanations') : tr('查看学习入口','Open study page'))+'</span></span>'+icon3('chevron')+'</button>';
    }).join('')+'</div></section></div>';
}
function exploreFilteredEntries(parsed, query = exploreQuery, chapter = exploreChapter) {
  const needle = query.trim().toLocaleLowerCase();
  return parsed.entries.filter(entry=>(!chapter || entry.chapter===chapter) && (!needle || (entry.chapter+' '+entry.number+' '+entry.markdown).toLocaleLowerCase().includes(needle)));
}
function exploreEntriesHTML(entries) {
  return entries.length ? entries.map(entry=>'<article class="classic-passage" id="'+esc(entry.id)+'"><header><span>'+tr('第 ','Passage ')+entry.number+tr(' 句','')+'</span><span>'+esc(entry.chapter)+'</span></header><div class="classic-prose">'+exploreMarkdown(entry.markdown)+'</div></article>').join('') : '<p class="classic-no-results" role="status">'+tr('未找到匹配内容，请换一个关键词或篇目。','No matching passages. Try another term or chapter.')+'</p>';
}
function classicPage(id) {
  const book = exploreBook(id);
  if (exploreBookID !== id) { exploreBookID = id; exploreQuery = ''; exploreChapter = ''; }
  const back = '<button class="home-text-button" data-go3="explore">← '+tr('返回学习拓展中心','Back to learning center')+'</button>';
  if (!book) return '<div class="classic-reader">'+back+'<h1>'+tr('未找到这部典籍','Book not found')+'</h1></div>';
  const parsed = exploreParseBook(book);
  if (!parsed.entries.length) return '<div class="classic-reader">'+back+'<header class="explore-heading"><p class="eyebrow">CHINESE CLASSICS</p><h1>《'+esc(book.title)+'》</h1></header><section class="classic-empty"><h2>'+tr('学习资料尚未收录','Study materials have not been added')+'</h2><p>'+tr('这里已预留典籍学习入口，正式内容收录后即可阅读。','This study page is ready for verified material when it is available.')+'</p></section></div>';
  const entries = exploreFilteredEntries(parsed);
  return '<div class="classic-reader">'+back+'<header class="explore-heading"><p class="eyebrow">CHINESE CLASSICS / '+esc(book.englishTitle.toUpperCase())+'</p><h1>《'+esc(book.title)+'》</h1><p>'+esc(book.subtitle)+'</p><p class="classic-meta">'+parsed.entries.length+tr(' 句 · ',' passages · ')+parsed.chapters.length+tr(' 篇目 · 离线可读',' chapters · Available offline')+'</p></header>'+
    '<details class="classic-source"><summary>'+tr('底本说明与校勘重点','Source and editorial notes')+'</summary><div class="classic-prose">'+exploreMarkdown(parsed.intro)+'</div><button data-classic-download="'+esc(id)+'">'+tr('下载原 Markdown 资料','Download original Markdown')+'</button></details>'+
    '<div class="classic-tools"><label><span>'+tr('搜索内容','Search passages')+'</span><input id="classicSearch" type="search" maxlength="200" value="'+esc(exploreQuery)+'" placeholder="'+tr('搜索原文、简释或篇目','Search text, explanations or chapters')+'"></label><label><span>'+tr('选择篇目','Chapter')+'</span><select id="classicChapter"><option value="">'+tr('全部篇目','All chapters')+'</option>'+parsed.chapters.map(chapter=>'<option value="'+esc(chapter)+'"'+(chapter===exploreChapter?' selected':'')+'>'+esc(chapter)+'</option>').join('')+'</select></label><p id="classicMatchCount" role="status">'+entries.length+' / '+parsed.entries.length+tr(' 句',' passages')+'</p></div>'+
    '<div id="classicPassages">'+exploreEntriesHTML(entries)+'</div><section class="classic-afterword classic-prose">'+exploreMarkdown(parsed.afterword)+'</section></div>';
}
function bindExploreControls() {
  const search = $('#classicSearch'), chapter = $('#classicChapter');
  const filter = () => {
    exploreQuery = search.value; exploreChapter = chapter.value;
    const parsed = exploreParseBook(exploreBook(exploreBookID)), entries = exploreFilteredEntries(parsed);
    $('#classicPassages').innerHTML = exploreEntriesHTML(entries);
    $('#classicMatchCount').textContent = entries.length+' / '+parsed.entries.length+tr(' 句',' passages');
  };
  if (search && chapter) { search.oninput = filter; chapter.onchange = filter; }
  $$('[data-classic-download]').forEach(button=>button.onclick=()=>{
    const book = exploreBook(button.dataset.classicDownload);
    if (book?.markdown) download(book.markdown,'text/markdown;charset=utf-8',book.source?.filename || book.id+'.md');
  });
}
export { explorePage, classicPage, bindExploreControls, exploreBook, exploreParseBook, exploreFilteredEntries, exploreMarkdown };
