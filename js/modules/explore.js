import { $, $$, esc, tr, icon3, download } from '../utils/helpers.js';
import { getClassicBooks } from '../resources.js';
import { go3 } from '../app.js';
import { ctx } from '../state.js';

let exploreBookID = '', exploreQuery = '', exploreChapter = '';
const exploreParsedBooks = new Map();

function exploreBook(id) { return getClassicBooks().find(book => book.id === id); }
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
  if(book.passages)return {intro:'',entries:book.passages.map((p,i)=>({id:p.id,number:i+1,chapter:p.chapter,text:p.text,explanation:p.explanation})),chapters:[...new Set(book.passages.map(p=>p.chapter).filter(Boolean))],afterword:''};
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
  return '<div class="explore-center"><header class="explore-heading"><p class="eyebrow">QICHENG / LEARNING</p><h1>'+tr('学习中心','Learning center')+'</h1><p>'+tr('练习语言，读懂经典。把知识积累，融入每一天。','Practice languages and explore Chinese classics at your own pace.')+'</p></header>'+
    '<section class="explore-quiz"><div><p class="eyebrow">01 / '+tr('答题训练','QUIZ PRACTICE')+'</p><h2>'+tr('用一组练习，巩固所学。','Put your knowledge into practice.')+'</h2><p>'+tr('英语与中文 · 自定题数与计时 · 错题与收藏复练','English & Chinese · Custom size & timing · Mistakes & favorites')+'</p></div><button class="primary" data-go3="quiz">'+tr('进入答题训练','Open quiz practice')+' ↗</button></section>'+
    learningUtilitiesMarkup()+classicLibraryMarkup()+'</div>';
}
function learningUtilitiesMarkup(){
  return '<nav class="learning-utilities" aria-label="'+tr('学习工具','Learning tools')+'"><button data-go3="reading-progress">'+icon3('book')+'<strong>'+tr('每日阅读进度','Reading progress')+'</strong><small>'+tr('记录书目与页码，让阅读有迹可循。','Record a book and pages, one day at a time.')+'</small></button><button data-go3="calendar">'+icon3('calendar')+'<strong>'+tr('学习日历','Learning calendar')+'</strong><small>'+tr('今日事，今日毕。留下一次简单的自我评估。','A simple check-in for your day.')+'</small></button></nav>';
}
function classicLibraryMarkup() {
  return '<section class="explore-classics"><div class="explore-section-title"><p class="eyebrow">02 / '+tr('中华文化典籍','CHINESE CLASSICS')+'</p><h2>'+tr('从经典中，拓展眼界。','Read beyond the familiar.')+'</h2></div><div class="explore-book-grid">'+getClassicBooks().map((book,index)=>{
      const parsed = exploreParseBook(book), ready = parsed.entries.length > 0;
      return '<button class="explore-book" data-go3="classic:'+esc(book.id)+'"><span class="explore-book-number">0'+(index+1)+'</span><span class="explore-book-body"><strong>《'+esc(book.title)+'》</strong><small>'+esc(ready ? book.subtitle : tr('学习资料待收录','Study material coming later'))+'</small><span class="explore-book-status">'+(ready ? parsed.entries.length+tr(' 句 · 原文与简释',' passages · Text & explanations') : tr('查看学习入口','Open study page'))+'</span></span>'+icon3('chevron')+'</button>';
    }).join('')+'</div></section>';
}
function readingPage() {
  return '<div class="explore-center reading-center"><header class="explore-heading"><p class="eyebrow">LEARNING / READING</p><h1>'+tr('阅读扩展','Reading')+'</h1><p>'+tr('让经典成为日常，在阅读中拓展眼界。','Make room for the classics, one passage at a time.')+'</p></header>'+classicLibraryMarkup()+'</div>';
}
function exploreFilteredEntries(parsed, query = exploreQuery, chapter = exploreChapter) {
  const needle = query.trim().toLocaleLowerCase();
  return parsed.entries.filter(entry=>(!chapter || entry.chapter===chapter) && (!needle || (entry.chapter+' '+entry.number+' '+(entry.markdown||entry.text+' '+entry.explanation)).toLocaleLowerCase().includes(needle)));
}
function exploreEntriesHTML(entries) {
  return entries.length ? entries.map(entry=>'<article class="classic-passage" id="'+esc(entry.id)+'"><header><span>'+tr('第 ','Passage ')+entry.number+tr(' 句','')+'</span><span>'+esc(entry.chapter)+'</span></header><div class="classic-prose">'+(entry.markdown?exploreMarkdown(entry.markdown):'<blockquote>'+esc(entry.text)+'</blockquote>'+(entry.explanation?'<p>'+esc(entry.explanation)+'</p>':''))+'</div></article>').join('') : '<p class="classic-no-results" role="status">'+tr('未找到匹配内容，请换一个关键词或篇目。','No matching passages. Try another term or chapter.')+'</p>';
}
function classicPage(id) {
  const book = exploreBook(id);
  if (exploreBookID !== id) { exploreBookID = id; exploreQuery = ''; exploreChapter = ''; }
  const back = '<button class="home-text-button" data-go3="reading">← '+tr('返回阅读扩展','Back to reading')+'</button>';
  if (!book) return '<div class="classic-reader">'+back+'<h1>'+tr('未找到这部典籍','Book not found')+'</h1></div>';
  const parsed = exploreParseBook(book);
  if (!parsed.entries.length) return '<div class="classic-reader">'+back+'<header class="explore-heading"><p class="eyebrow">CHINESE CLASSICS</p><h1>《'+esc(book.title)+'》</h1></header><section class="classic-empty"><h2>'+tr('学习资料尚未收录','Study materials have not been added')+'</h2><p>'+tr('这里已预留典籍学习入口，正式内容收录后即可阅读。','This study page is ready for verified material when it is available.')+'</p></section></div>';
  const entries = exploreFilteredEntries(parsed);
  return '<div class="classic-reader">'+back+'<header class="explore-heading"><p class="eyebrow">CHINESE CLASSICS / '+esc((book.englishTitle||'').toUpperCase())+'</p><h1>《'+esc(book.title)+'》</h1><p>'+esc(book.subtitle)+'</p><p class="classic-meta">'+parsed.entries.length+tr(' 句 · ',' passages · ')+parsed.chapters.length+tr(' 篇目 · 离线可读',' chapters · Available offline')+'</p></header>'+
    '<details class="classic-source"><summary>'+tr('底本说明与校勘重点','Source and editorial notes')+'</summary><div class="classic-prose">'+exploreMarkdown(parsed.intro||tr('此资料由本机导入，请以所提供的底本为准。','Imported locally. Consult the supplied source.'))+'</div><button data-classic-download="'+esc(id)+'">'+(book.passages?tr('下载典籍 JSON','Download classic JSON'):tr('下载原 Markdown 资料','Download original Markdown'))+'</button></details>'+
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
    else if(book?.passages) {
      const {id,title,version,englishTitle,subtitle,passages}=book;
      download(JSON.stringify({schemaVersion:1,book:{id,title,version,englishTitle,subtitle},passages},null,2),'application/json;charset=utf-8',id+'.json');
    }
  });
}
export { explorePage, readingPage, classicPage, bindExploreControls, exploreBook, exploreParseBook, exploreFilteredEntries, exploreMarkdown };

async function openClassicPassage(bookId,passageId) {
  const book=exploreBook(bookId);const parsed=exploreParseBook(book);
  if(!book || !parsed.entries.some(p=>p.id===passageId))return go3('daily-quote');
  exploreQuery='';exploreChapter='';await go3('classic:'+bookId);
  requestAnimationFrame(()=>{const passage=document.getElementById(passageId);if(passage){passage.scrollIntoView({block:'center'});passage.classList.add('quote-target');passage.tabIndex=-1;passage.focus({preventScroll:true});}});
}
export { openClassicPassage };

// Derive daily reading directly from installed classic content; never duplicate it on disk.
function classicAsQuotes(book) {
  const parsed=exploreParseBook(book);
  return {schemaVersion:1,version:book?.version||'1.0.0',quotes:parsed.entries.map(entry=>({
    id:entry.id,text:entry.text??entry.markdown.split('\n').filter(line=>line.startsWith('>')).map(line=>line.replace(/^>\s?/,'')).join('\n').replaceAll('**','').trim(),
    source:'《'+book.title+'》'+(entry.chapter?' · '+entry.chapter:''),bookId:book.id,passageId:entry.id
  })).filter(quote=>quote.text.trim())};
}
export { classicAsQuotes };
