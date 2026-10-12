import { $, $$, esc, heading3, icon3, options, tr } from '../utils/helpers.js';
import { ctx } from '../state.js';
import { SCHOOLS, SCHOOL_DATES31, SCHOOL_DETAILS3, SCHOOL_EXAMS302 } from '../data.js';
import { save } from '../autosave.js';
import { go3, render } from '../app.js';
import { STAR } from '../constants.js';
import { vectorMapPanel31, bindMap31 } from './map.js';
// 启程 · js/modules/universities.js


function bindDreams () {
  $$ ('[data-dream]').forEach (b => b.onclick = () => toggleDream (b.dataset.dream));
}

async function toggleDream (name) {
  if (! SCHOOLS.some (s => s.name === name)) return;
  ctx.state.dreamSchools = ctx.state.dreamSchools.includes (name) ? ctx.state.dreamSchools.filter (x => x !== name) : [...ctx.state.dreamSchools,
  name];
  await save ();
  render ();
}

function filteredSchools3 () {
  return SCHOOL_DETAILS3.filter (s => (! ctx.onlyDreams || ctx.state.dreamSchools.includes (s.name)) && (! ctx.schoolRegion3 ||
  s.region === ctx.schoolRegion3) && (! ctx.schoolQuery || (s.name + s.abbreviation + s.english + s.city + s.region).toLowerCase ().includes (ctx.schoolQuery.toLowerCase ())))
}

function schoolLogo3 (s) {
  return s.logo ? '<div class="school-logo-art3 ' + (s.logoDark ? 'logo-dark3' : '') + ' ' + (s.logoStrip ? 'logo-strip3' : '') +
  '"><img src="' + s.logo + '" alt="' + esc (s.name) + tr ('校徽', ' seal') + '"></div>' : '<span>' + esc (s.abbreviation) +
  '</span>'
}

function schoolCards () {
  const list = filteredSchools3 ();
  return list.length ? list.map (s => {
    const dream = ctx.state.dreamSchools.includes (s.name); return '<article class="university-card3 ' + (dream ? 'is-dream' : '') +
    '"><div class="university-top3"><div class="school-logo3">' + schoolLogo3 (s) + '</div><button class="dream-star ' +
    (dream ? 'chosen' : '') + '" data-dream="' + esc (s.name) + '" aria-pressed="' + dream + '" aria-label="' + esc (tr ('标注梦想院校：',
    'Mark dream university: ') + s.name) + '">' + STAR + '</button></div><span class="school-abbr3">' + esc (s.abbreviation) +
    '</span><button class="school-name3" data-go3="school:' + encodeURIComponent (s.name) + '">' + esc (s.name) + '</button><p>' +
    esc (s.region + ' · ' + s.city) + '</p><p class="exam-card-status302">' + (SCHOOL_EXAMS302 [s.name] && SCHOOL_DATES31 [s.name] ?
    tr ('校测模式与历年时间已收录', 'Assessment and past dates added') : SCHOOL_DATES31 [s.name] ? tr ('历年考试时间已收录', 'Past exam dates added') : SCHOOL_EXAMS302 [s.name] ?
    tr ('2026 校测模式已收录', '2026 assessment added') : tr ('考试资料正在赶来的路上', 'Exam details are on the way')) + '</p><div class="school-card-bottom3"><button data-go3="school:' +
    encodeURIComponent (s.name) + '">' + tr ('查看院校', 'View university') + ' ↗</button><a href="' + esc (s.url) + '" target="_blank" rel="noopener noreferrer">' +
    tr ('招生简章', 'Admissions') + '</a></div></article>'
  }).join ('') : '<div class="panel empty3">' + tr ('当前筛选没有匹配院校。可以取消所在地或梦想院校筛选。', 'No universities match. Clear a location or dream filter.') +
  '</div>'
}

function schoolPage () {
  const regions = [...new Set (SCHOOL_DETAILS3.map (s => s.region))], match = new Set (filteredSchools3 ().map (s =>
  s.name));
  return heading3 ('DESTINATIONS / UNIVERSITIES', tr ('从这里，走向梦想的大学。', 'From here, to your dream university.'), tr ('收藏梦想院校，按所在地筛选，点进学校查看资料与招生链接。',
  'Mark dream universities, filter by location and open their information pages.')) + '<section class="panel schools-toolbar3"><label class="search3">' +
  icon3 ('search') + '<input id="schoolSearch3" value="' + esc (ctx.schoolQuery) + '" placeholder="' + tr ('学校、缩写、所在地',
  'Name, abbreviation or location') + '"></label><select id="schoolRegion3" aria-label="' + tr ('按所在地筛选', 'Filter by location') +
  '"><option value="">' + tr ('全部所在地', 'All locations') + '</option>' + options (regions, ctx.schoolRegion3) + '</select><button data-action3="dreamFilter" class="' +
  (ctx.onlyDreams ? 'primary' : '') + '" aria-pressed="' + ctx.onlyDreams + '">' + tr ('仅看梦想院校', 'Dream universities only') +
  ' · ' + ctx.state.dreamSchools.length + '</button><div class="segmented3"><button data-school-view3="cards" class="' +
  (ctx.schoolView3 === 'cards' ? 'active' : '') + '">' + tr ('院校卡片', 'Cards') + '</button><button data-school-view3="map" class="' +
  (ctx.schoolView3 === 'map' ? 'active' : '') + '">' + tr ('院校地图', 'Map') + '</button></div></section><div class="school-filter-summary3"><span id="schoolMatch3">' +
  filteredSchools3 ().length + ' / ' + SCHOOL_DETAILS3.length + ' ' + tr ('所院校', 'universities') + '</span><button data-action3="clearSchoolFilters">' +
  tr ('重置筛选', 'Clear filters') + '</button></div>' + (ctx.schoolView3 === 'map' ? vectorMapPanel31 () : '') + '<div class="university-grid3" id="schoolLinks3">' +
  schoolCards () + '</div><p class="source-note">' + tr ('资料链接核对：2026.10.09。招生简章标注年度；申请时请核对院校发布的对应年度要求。', 'Links checked: 2026-10-09. Admission notices show their year; verify the applicable year before applying.') +
  '</p>'
}

function schoolExamPanel302 (s) {
  const info = SCHOOL_EXAMS302 [s.name], dates = SCHOOL_DATES31 [s.name] || {
  }, pending = tr ('正在赶来的路上', 'On the way');
  const rows = [['written', '笔试科目与分值', 'Written subjects & marks'], ['interview', '面试与考核方式', 'Interview & assessment'],
  ['weight', '最终成绩与录取方式', 'Final score & admission']];
  const facts = info ? '<h3 class="exam-mode-heading31">' + tr ('2026 年考核模式参考', '2026 assessment reference') + '</h3><dl class="exam-facts302">' +
  rows.map (([key, z, e]) => '<div><dt>' + tr (z, e) + '</dt><dd>' + esc (info [key] || pending) + '</dd></div>').join ('') +
  '</dl>' : '<div class="exam-modes-pending31"><span class="exam-pending302">' + pending + '</span><p>' + tr ('考试科目与考核方式待补充。',
  'Subjects and assessment formats are coming soon.') + '</p></div>';
  const years = [2025, ...(dates [2026] ? [2026] : [])], dateRows = years.map (year => {
    const item = dates [year]; return '<div class="exam-year-row31"><strong>' + year + ' ' + tr ('年 · 考试时间参考', '· Exam date reference') +
    '</strong>' + (item ? '<span>' + esc (item.text) + '</span><br><a href="' + esc (item.url) + '" target="_blank" rel="noopener noreferrer">' +
    esc (item.label) + ' ↗</a>' : '<span class="exam-pending302">' + pending + '</span>') + '</div>'
  }).join ('');
  return '<section class="panel school-exams302"><div class="exam-heading302"><div><div class="eyebrow">ADMISSIONS / EXAM REFERENCE</div><h2>' +
  tr ('外语保送校测参考', 'Language admissions exam reference') + '</h2></div><span class="exam-year302">' + tr ('往届参考', 'Past-cycle reference') +
  '</span></div>' + facts + '<div class="exam-dates31"><h3>' + tr ('历年考试时间', 'Past exam dates') + '</h3><div class="exam-years31">' +
  dateRows + '</div></div>' + (info?.note ? '<div class="exam-notes302"><h3>' + tr ('补充参考', 'Additional reference') +
  '</h3><p>' + esc (info.note) + '</p></div>' : '') + '<p class="exam-footer302">' + tr ('日期按招生年度列示，仅作往届参考；具体安排以相应年度招生简章、考试通知及准考证为准。更多题型与流程正在赶来的路上。',
  'Dates are listed by admission year for reference. Follow the brochure, exam notice and admission ticket for the corresponding year. More question types and procedures are on the way.') +
  '</p></section>';
}

function schoolDetail3 (name) {
  const s = SCHOOL_DETAILS3.find (x => x.name === name);
  if (! s) return heading3 ('UNIVERSITY', tr ('没有找到这所学校', 'University not found')) + '<button data-go3="schools">' +
  tr ('返回院校列表', 'Back to universities') + '</button>';
  const dream = ctx.state.dreamSchools.includes (s.name);
  return '<button class="back-link3" data-go3="schools">← ' + tr ('返回院校与地图', 'Back to universities & map') + '</button><section class="school-hero3"><div class="school-hero-text3"><div class="eyebrow">' +
  esc (s.abbreviation) + ' / ' + tr ('院校档案', 'UNIVERSITY PROFILE') + '</div><h1>' + esc (s.name) + '</h1><p class="university-english3">' +
  esc (s.english) + '</p><div class="school-location3">' + icon3 ('globe') + esc (s.region + ' · ' + s.city) + '</div><button class="' +
  (dream ? 'primary' : '') + '" data-dream="' + esc (s.name) + '">' + STAR + tr (dream ? '已标注梦想院校' : '标注为梦想院校', dream ?
  'Marked as dream university' : 'Mark as dream university') + '</button></div><div class="school-hero-logo3">' + schoolLogo3 (s) +
  '</div></section><div class="university-details-grid3"><section class="panel school-links3"><h2>' + tr ('院校资料与链接',
  'University resources') + '</h2><a href="' + esc (s.url) + '" target="_blank" rel="noopener noreferrer"><span><strong>' +
  tr ('保送生招生简章', 'Recommended-student admissions') + '</strong><small>' + esc (s.label) + '</small></span>' + icon3 ('export') +
  '</a><a href="' + esc (s.baike) + '" target="_blank" rel="noopener noreferrer"><span><strong>' + tr ('百度百科', 'Baidu Baike') +
  '</strong><small>' + esc (s.name) + '</small></span>' + icon3 ('export') + '</a><a href="' + esc (s.wiki) + '" target="_blank" rel="noopener noreferrer"><span><strong>' +
  tr ('维基百科', 'Wikipedia') + '</strong><small>' + esc (s.english) + '</small></span>' + icon3 ('export') + '</a>' +
  (s.official ? '<a href="' + esc (s.official) + '" target="_blank" rel="noopener noreferrer"><span><strong>' + tr ('学校官网',
  'Official website') + '</strong><small>' + esc (s.official) + '</small></span>' + icon3 ('export') + '</a>' : '') +
  '</section>' + schoolExamPanel302 (s) + '</div>'
}

function bindSchoolCards3 () {
  $$ ('#schoolLinks3 [data-go3]').forEach (b => b.onclick = () => go3 (b.dataset.go3));
  $$ ('#schoolLinks3 [data-dream]').forEach (b => b.onclick = () => toggleDream (b.dataset.dream))
}

export { bindDreams, toggleDream, filteredSchools3, schoolLogo3, schoolCards, schoolPage, schoolExamPanel302, schoolDetail3, bindSchoolCards3 };

// All controls for this feature, in their original override order.
function bindUniversitiesControls () {
  bindDreams ();
  if ($ ('#schoolSearch')) $ ('#schoolSearch').oninput = e => {
    ctx.schoolQuery = e.target.value.trim ();
    $ ('#schoolLinks').innerHTML = schoolCards ();
    bindDreams ();
  };
  $$ ('[data-school-view3]').forEach (b => b.onclick = () => {
    ctx.schoolView3 = b.dataset.schoolView3; render ()
  });
  if ($ ('#schoolRegion3')) $ ('#schoolRegion3').onchange = e => {
    ctx.schoolRegion3 = e.target.value;
    render ()
  };
  bindMap31 ();
}
export { bindUniversitiesControls };
