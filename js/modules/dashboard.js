import { render } from '../app.js';
import { $, $$, checkbox, esc, heading3, icon3, options, tr, translateLabel, flip } from '../utils/helpers.js';
import { ctx } from '../state.js';
import { getQuizDashboard, quizFormatTime } from './quiz.js';
import { changed } from '../app.js';
// 启程 · js/modules/dashboard.js


function numeric3 (value) {
  const s = String (value || '').replace (/[０-９]/g, c => String (c.charCodeAt (0) - 65296)).replace (/,/g, '').trim ();
  return /^-?\d+(?:\.\d+)?$/.test (s) ? Number (s) : null
}

function pieChart3 (arr, label) {
  const colors = ['var(--chart1)', 'var(--chart2)', 'var(--chart3)', 'var(--chart4)', 'var(--chart5)', 'var(--chart6)'],
  counts = new Map ();
  arr.forEach (x => counts.set (x.category || tr ('未分类', 'Uncategorized'), (counts.get (x.category || tr ('未分类', 'Uncategorized')) ||
  0) + 1));
  let cursor = 0;
  const total = arr.length;
  return '<div class="donut3"><svg viewBox="0 0 160 160" role="img" aria-label="' + esc (label) + '"><circle cx="80" cy="80" r="58" fill="none" stroke="var(--line)" stroke-width="20"/>' +
  [...counts].map (([name, n], i) => {
    const length = n / total * 364.425, start = cursor; cursor += length; return '<circle cx="80" cy="80" r="58" fill="none" stroke="' +
    colors [i % colors.length] + '" stroke-width="20" stroke-dasharray="' + length + ' ' + (364.425 - length) + '" stroke-dashoffset="' +
    (- start) + '" transform="rotate(-90 80 80)"><title>' + esc (name) + '：' + n + '</title></circle>'
  }).join ('') + '<text x="80" y="78" text-anchor="middle" class="donut-total3">' + total + '</text><text x="80" y="98" text-anchor="middle" class="donut-label3">' +
  tr ('条记录', 'records') + '</text></svg><div class="chart-legend3">' + ([...counts].map (([name, n], i) => '<div><i style="background:' +
  colors [i % colors.length] + '"></i><span>' + esc (translateLabel (name)) + '</span><strong>' + n + '</strong></div>').join ('') ||
  '<p class="hint">' + tr ('暂无数据', 'No data yet') + '</p>') + '</div></div>'
}

function selectedExams3 () {
  return ctx.state.exams.filter (e => ! ctx.state.chartSelectionSet || ctx.state.chartExamIds.includes (e.id)).slice ().sort ((a,
  b) => {
    const x = Date.parse (a.date), y = Date.parse (b.date); return Number.isFinite (x) && Number.isFinite (y) ? x - y : 0
  })
}

function chartValue3 (exam, rank = false) {
  if (rank) return numeric3 (exam.rank);
  if (ctx.state.chartMetric === 'subject') {
    const sub = exam.subjects.find (s => s.name.trim () === ctx.state.chartSubject);
    return numeric3 (sub?.score)
  }
  return numeric3 (exam.totalScore)
}

function lineChart3 (rank = false) {
  const exams = selectedExams3 (), points = exams.map ((e, i) => ( {
    e, i, value : chartValue3 (e, rank)
  })), valid = points.filter (x => x.value !== null), w = 680, h = 245, left = 56, right = 30, top = 24, bottom = 55;
  if (! valid.length) return '<div class="chart-empty3">' + tr ('所选考试没有可绘制的数字。请填写分数或排名。', 'Selected exams have no numeric values. Enter scores or rankings.') +
  '</div>';
  let min = Math.min (...valid.map (x => x.value)), max = Math.max (...valid.map (x => x.value));
  if (min === max) {
    min = Math.max (0, min - 5);
    max += 5
  }
  const pad = (max - min) * .15;
  if (! rank) {
    min = Math.max (0, min - pad);
    max += pad
  }
  else {
    min = Math.max (1, Math.floor (min - pad));
    max = Math.ceil (max + pad)
  }
  const xOf = i => exams.length === 1 ? (w + left - right) / 2 : left + i * (w - left - right) / (exams.length - 1),
  yOf = n => rank ? top + (n - min) / (max - min) * (h - top - bottom) : h - bottom - (n - min) / (max - min) * (h - top - bottom);
  let segments = [], seg = [];
  points.forEach (p => {
    if (p.value === null) {
      if (seg.length) segments.push (seg); seg = []
    }
    else seg.push (p)
  });
  if (seg.length) segments.push (seg);
  return '<svg class="line-chart3" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + tr (rank ? '考试排名趋势，数字越小排名越靠前' : '考试成绩趋势',
  rank ? 'Rank trend; smaller is better' : 'Score trend') + '">' + Array.from ( {
    length : 5
  }, (_, i) => {
    const val = min + (max - min) * i / 4, y = yOf (val); return '<line x1="' + left + '" y1="' + y + '" x2="' + (w - right) +
    '" y2="' + y + '" class="chart-grid3"/><text x="' + (left - 9) + '" y="' + (y + 4) + '" text-anchor="end">' + (rank ?
    Math.round (val) : Math.round (val * 10) / 10) + '</text>'
  }).join ('') + segments.map (s => '<polyline points="' + s.map (p => xOf (p.i) + ',' + yOf (p.value)).join (' ') +
  '" fill="none" stroke="' + (rank ? 'var(--chart2)' : 'var(--accent)') + '" stroke-width="2.5"/>').join ('') + points.map (p =>
  '<text x="' + xOf (p.i) + '" y="' + (h - 22) + '" text-anchor="middle">' + esc ((p.e.date || p.e.title || String (p.i +
  1)).slice (0, 11)) + '</text>' + (p.value !== null ? '<circle cx="' + xOf (p.i) + '" cy="' + yOf (p.value) + '" r="5" fill="' +
  (rank ? 'var(--chart2)' : 'var(--accent)') + '"><title>' + esc (p.e.title) + '：' + p.value + '</title></circle><text x="' +
  xOf (p.i) + '" y="' + (yOf (p.value) - 12) + '" text-anchor="middle">' + p.value + '</text>' : '')).join ('') + '</svg>'
}

function dashboardPage3 () {
  const counts = [[ctx.state.awards.length, '个人荣誉', 'Awards', 'spark'], [ctx.state.experiences.length, '个人经历', 'Experience',
  'edit'], [ctx.state.practices.length, '社会实践', 'Practice', 'globe'], [ctx.state.learning.books.length, '阅读书目', 'Reading',
  'layers'], [ctx.state.achievements.length, '个人成果', 'Projects', 'folder'], [ctx.state.exams.length, '考试记录', 'Exams',
  'chart']], subjects = [...new Set (ctx.state.exams.flatMap (e => e.subjects.map (s => s.name)).filter (Boolean))];
  return heading3 ('OVERVIEW / DASHBOARD', tr ('成长的轨迹，一目了然。', 'See the shape of your growth.'), tr ('汇总已经收录的资料；成绩与排名只使用有效数字，不把缺失值当成零。',
  'A view of saved materials. Charts use valid numeric values; missing values are never treated as zero.')) + '<div class="stat-grid3">' +
  counts.map (([n, z, e, i]) => '<article class="stat-card3">' + icon3 (i) + '<strong>' + n + '</strong><span>' + tr (z,
  e) + '</span></article>').join ('') + '</div>' + '<div class="pie-grid3">' + [['awards', '荣誉类别', 'Award categories'], ['experiences',
  '经历类别', 'Experience categories'], ['practices', '实践类别', 'Practice categories']].map (([kind, z, e]) => '<section class="panel"><h2>' +
  tr (z, e) + '</h2>' + pieChart3 (ctx.state [kind], tr (z, e)) + '</section>').join ('') + '</div><section class="panel exam-dashboard3"><div class="panel-title"><div><h2>' +
  tr ('考试成绩与排名', 'Examination trends') + '</h2><p class="hint">' + tr ('勾选要比较的考试。不同类型、满分或排名范围的考试请谨慎横向比较。', 'Choose exams to compare. Take care when types, full marks or ranking groups differ.') +
  '</p></div></div><div class="exam-picks3">' + (ctx.state.exams.length ? ctx.state.exams.map (e => checkbox (! ctx.state.chartSelectionSet ||
  ctx.state.chartExamIds.includes (e.id), 'data-chart-exam3="' + e.id + '"', esc (e.title || e.date) + '<small>' + esc (e.date) +
  '</small>')).join ('') : '<p class="hint">' + tr ('先录入考试，再形成趋势。', 'Add exams to see trends.') + '</p>') + '</div><div class="chart-options3"><label>' +
  tr ('成绩曲线', 'Score metric') + '<select id="chartMetric3"><option value="totalScore" ' + (ctx.state.chartMetric === 'totalScore' ?
  'selected' : '') + '>' + tr ('总分', 'Total score') + '</option><option value="subject" ' + (ctx.state.chartMetric === 'subject' ?
  'selected' : '') + '>' + tr ('分科成绩', 'Subject score') + '</option></select></label><label>' + tr ('选择科目', 'Subject') +
  '<select id="chartSubject3">' + options (subjects, ctx.state.chartSubject) + '</select></label></div><div class="line-grid3"><section><h3>' +
  tr ('成绩变化', 'Score trend') + '</h3><div id="scoreChart3">' + lineChart3 (false) + '</div></section><section><h3>' +
  tr ('总排名变化 · 越靠上越好', 'Overall rank · higher on chart is better') + '</h3><div id="rankChart3">' + lineChart3 (true) +
  '</div></section></div><div class="data-table-scroll3"><table class="data-table3"><thead><tr><th>' + tr ('考试', 'Exam') +
  '</th><th>' + tr ('时间', 'Date') + '</th><th>' + tr ('所选成绩', 'Selected score') + '</th><th>' + tr ('总排名', 'Overall rank') +
  '</th><th>' + tr ('排名范围', 'Ranking group') + '</th></tr></thead><tbody>' + selectedExams3 ().map (e => '<tr><td>' +
  esc (e.title) + '</td><td>' + esc (e.date) + '</td><td>' + (chartValue3 (e) ?? '—') + '</td><td>' + esc (e.rank ||
  '—') + '</td><td>' + esc (e.rankScope || '—') + '</td></tr>').join ('') + '</tbody></table></div></section><div class="overview-grid3">' +
  [['awards', '荣誉一览', 'Honors overview'], ['experiences', '经历一览', 'Experience overview'], ['practices', '实践一览', 'Practice overview']].map (([k,
  z, e]) => '<section class="panel"><div class="panel-title"><h2>' + tr (z, e) + '</h2><button data-go3="' + k + '">' +
  tr ('录入 / 编辑', 'Add / edit') + '</button></div>' + ctx.state [k].map (x => '<div class="overview-row3"><strong>' +
  esc (x.title) + '</strong><span>' + esc ([x.scope, x.role, x.category, x.date].filter (Boolean).join (' · ')) + '</span></div>').join ('') +
  (ctx.state [k].length ? '' : '<p class="hint">' + tr ('暂无记录', 'No records yet') + '</p>') + '</section>').join ('') +
  '</div>'
}

function drawDashboard3 () {
}
function practiceDashboardPage() {
  return heading3('LEARNING / PRACTICE DATA',tr('每一次练习，都在积累。','Every practice adds up.'),tr('查看已经提交的练习、错题与收藏。','Review submitted practice, mistakes and favorites.')) + quizDashboardMarkup();
}

export { numeric3, pieChart3, selectedExams3, chartValue3, lineChart3, dashboardPage3, drawDashboard3,practiceDashboardPage };

// All controls for this feature, in their original override order.
function bindDashboardControls () {
  const section=$('#quizDashboardSection');
  if(section)section.onchange=()=>{quizDashboardSection=section.value;render();};
  $$ ('[data-chart-exam3]').forEach (e => e.onchange = () => {
    if (! ctx.state.chartSelectionSet) {
      ctx.state.chartExamIds = ctx.state.exams.map (x => x.id); ctx.state.chartSelectionSet = true
    }
    flip (ctx.state.chartExamIds, e.dataset.chartExam3, e.checked); render ()
  });
  if ($ ('#chartMetric3')) $ ('#chartMetric3').onchange = e => {
    ctx.state.chartMetric = e.target.value;
    if (! ctx.state.chartSubject) ctx.state.chartSubject = $ ('#chartSubject3').value;
    render ()
  };
  if ($ ('#chartSubject3')) $ ('#chartSubject3').onchange = e => {
    ctx.state.chartSubject = e.target.value;
    render ()
  };
}
export { bindDashboardControls };

// View filters are ephemeral, just like the existing examination chart filters.
let quizDashboardSection='';
function quizDashboardMarkup() {
  const stats=getQuizDashboard(quizDashboardSection);
  const percent=(correct,total)=>total?Math.round(correct/total*100)+'%':'—';
  const metrics=[
    [stats.total,tr('累计答题','Questions completed')],
    [stats.groups,tr('已提交组数','Groups submitted')],
    [stats.accuracy===null?'—':stats.accuracy+'%',tr('整体正确率','Overall accuracy')],
    [stats.timedGroups?quizFormatTime(stats.elapsedSeconds):'—',tr('记录用时','Recorded time')]
  ];
  return '<section class="quiz-dashboard panel" aria-labelledby="quizDashboardTitle"><div class="quiz-dashboard-heading"><div><p class="eyebrow">LEARNING / PRACTICE</p><h2 id="quizDashboardTitle">'+tr('练习的积累，看得见。','Watch your practice add up.')+'</h2><p class="hint">'+tr('只统计整组提交的练习。正确率按总题数加权，重复练习也计入。','Submitted groups only. Accuracy is weighted by question count, including repeat practice.')+'</p></div><button data-go3="quiz">'+tr('前往练习中心','Open practice center')+' ↗</button></div>'+ 
    '<div class="quiz-dashboard-filter"><label for="quizDashboardSection">'+tr('练习范围','Practice section')+'</label><select id="quizDashboardSection"><option value="">'+tr('全部练习','All practice')+'</option>'+stats.sections.map(item=>'<option value="'+esc(item.id)+'"'+(quizDashboardSection===item.id?' selected':'')+'>'+esc(tr(item.zh,item.en))+'</option>').join('')+'</select><p>'+tr('待巩固错题','Mistakes to revisit')+' <strong data-quiz-stat="wrong">'+stats.wrong+'</strong><span aria-hidden="true"> · </span>'+tr('收藏题','Favorites')+' <strong data-quiz-stat="favorites">'+stats.favorites+'</strong></p></div>'+ 
    '<dl class="quiz-dashboard-metrics">'+metrics.map(([value,label],i)=>'<div><dd data-quiz-stat="'+['total','groups','accuracy','time'][i]+'">'+value+'</dd><dt>'+label+'</dt></div>').join('')+'</dl>'+ 
    '<div class="quiz-dashboard-details"><div><h3>'+tr('分板块表现','By section')+'</h3><div class="quiz-section-results">'+stats.sections.filter(item=>!quizDashboardSection||item.id===quizDashboardSection).map(item=>'<div><span>'+esc(tr(item.zh,item.en))+'</span><strong>'+percent(item.correct,item.total)+'</strong><span class="quiz-stat-track" aria-hidden="true"><i style="width:'+(item.total?item.correct/item.total*100:0)+'%"></i></span><small>'+item.total+tr(' 题 · ',' questions · ')+item.groups+tr(' 组',' groups')+'</small></div>').join('')+'</div></div><div><h3>'+tr('最近七组','Last seven groups')+'</h3>'+(stats.recent.length?'<ol class="quiz-recent-results">'+stats.recent.map(record=>'<li><div><strong>'+esc(record.bankTitle)+'</strong><small>'+esc(new Date(record.submittedAt).toLocaleDateString(ctx.state.uiLang==='en'?'en':'zh-CN'))+' · '+record.correct+' / '+record.total+'</small></div><span>'+percent(record.correct,record.total)+'</span></li>').join('')+'</ol>':'<p class="quiz-stats-empty">'+tr('完成并提交第一组练习，积累会从这里开始。','Complete and submit a group to start seeing your progress.')+'</p>')+'</div></div>'+ 
    (stats.timedGroups<stats.groups?'<p class="hint quiz-time-coverage">'+tr('部分旧练习没有用时记录；用时仅汇总含计时信息的 ','Some older groups have no timing data. Time covers ')+stats.timedGroups+tr(' 组。',' timed groups.')+'</p>':'')+'</section>';
}
