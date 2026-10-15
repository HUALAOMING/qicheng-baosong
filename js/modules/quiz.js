import { $, $$, esc, tr, toast, uid } from '../utils/helpers.js';
import { storage } from '../storage.js';
import { listQuizBanks } from '../resources.js';
import { render, confirmAction } from '../app.js';
import { ctx } from '../state.js';

// Answer drafts live only here. Committed groups and individual marks own their keys.
let quizHistory = [], quizMarks = new Map(), quizSession = null;
let quizSelectedBank = '', quizMode = 'random', quizSize = 10, quizView = 'setup';
let quizSubmitting = false, quizMarkBusy = false, quizReady = false;
const quizPendingWrites = new Set();
const quizSections = [
  ['grammar', '英语语法', 'English grammar'], ['vocabulary', '英语词汇', 'English vocabulary'],
  ['ancient-culture', '中国古代文化常识', 'Ancient Chinese culture'], ['chinese-usage', '汉语易错知识', 'Chinese language usage']
];

function quizTrackWrite(promise) {
  const pending = promise.finally(() => quizPendingWrites.delete(pending));
  quizPendingWrites.add(pending);
  return pending;
}
function waitForQuizWrites() { return Promise.all([...quizPendingWrites]); }

function quizMarkKey(bankId, questionId) {
  return 'quiz:mark:' + encodeURIComponent(bankId) + '/' + encodeURIComponent(questionId);
}
function quizClone(value) { return JSON.parse(JSON.stringify(value)); }
function quizText(value) {
  // Escape first: attributes, entities and every other tag remain inert text.
  return esc(value).replace(/&lt;(\/?)(i|u)&gt;/g, '<$1$2>');
}
function quizIsObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function quizValidQuestion(question) {
  if (!quizIsObject(question) || typeof question.id !== 'string' || !question.id || typeof question.question !== 'string' || !question.question.trim() || typeof question.explanation !== 'string') return false;
  if (question.type === 'true-false') return typeof question.answer === 'boolean';
  if (question.type !== 'single-choice' || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 26) return false;
  const ids = new Set();
  for (const option of question.options) {
    if (!quizIsObject(option) || typeof option.id !== 'string' || !option.id || typeof option.text !== 'string' || ids.has(option.id)) return false;
    ids.add(option.id);
  }
  return typeof question.answer === 'string' && ids.has(question.answer);
}
function quizValidAnswer(question, answer) {
  return question.type === 'true-false' ? typeof answer === 'boolean' : question.options.some(option => option.id === answer);
}
function validateQuizRecords(records) {
  if (!quizIsObject(records)) throw new Error('练习备份格式无效。');
  for (const [key, value] of Object.entries(records)) {
    if (!key.startsWith('quiz:')) continue;
    let valid = false;
    if (key.startsWith('quiz:mark:')) {
      valid = quizIsObject(value) && typeof value.bankId === 'string' && !!value.bankId && typeof value.questionId === 'string' && !!value.questionId && typeof value.wrong === 'boolean' && typeof value.favorite === 'boolean' && key === quizMarkKey(value.bankId, value.questionId);
    } else if (key.startsWith('quiz:record:') && quizIsObject(value)) {
      valid = typeof value.id === 'string' && !!value.id && key === 'quiz:record:' + value.id && typeof value.bankId === 'string' && !!value.bankId && typeof value.bankTitle === 'string' && quizSections.some(section => section[0] === value.section) && ['random', 'wrong', 'favorites'].includes(value.mode) && [10, 20].includes(value.requestedSize) && Array.isArray(value.questions) && value.questions.length > 0 && value.questions.length <= value.requestedSize && value.questions.every(quizValidQuestion) && new Set(value.questions.map(question => question.id)).size === value.questions.length && Array.isArray(value.answers) && value.answers.length === value.questions.length && value.questions.every((question, index) => quizValidAnswer(question, value.answers[index])) && value.total === value.questions.length && Number.isInteger(value.correct) && value.correct === value.questions.filter((question, index) => question.answer === value.answers[index]).length && typeof value.submittedAt === 'string' && Number.isFinite(Date.parse(value.submittedAt));
    }
    if (!valid) throw new Error('练习备份记录无效：' + key);
  }
  return records;
}
function resetQuiz() {
  quizHistory = []; quizMarks = new Map(); quizSession = null;
  quizSelectedBank = ''; quizMode = 'random'; quizSize = 10; quizView = 'setup';
  quizSubmitting = false; quizMarkBusy = false; quizReady = false;
}
async function initializeQuiz(records) {
  const loaded = records === undefined ? await storage.getAll() : records;
  validateQuizRecords(loaded);
  resetQuiz();
  for (const [key, value] of Object.entries(loaded)) {
    if (key.startsWith('quiz:record:')) quizHistory.push(quizClone(value));
    if (key.startsWith('quiz:mark:')) quizMarks.set(key, quizClone(value));
  }
  quizHistory.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  quizReady = true;
}
function getRecentQuiz() { return quizHistory.length ? quizClone(quizHistory[0]) : null; }
function quizGetMark(bankId, questionId) {
  return quizMarks.get(quizMarkKey(bankId, questionId)) || {bankId, questionId, wrong: false, favorite: false};
}
function quizPool(resource, mode) {
  return resource.questions.filter(question => mode === 'random' || quizGetMark(resource.bank.id, question.id)[mode === 'wrong' ? 'wrong' : 'favorite']);
}
function quizStart(bankId, mode = 'random', requestedSize = 10, random = Math.random) {
  if (!quizReady || quizSubmitting || quizMarkBusy || ctx.persistencePaused) throw new Error('请等待本地数据准备完成。');
  if (![10, 20].includes(requestedSize) || !['random', 'wrong', 'favorites'].includes(mode)) throw new Error('请选择每组 10 题或 20 题。');
  const resource = listQuizBanks().find(item => item.bank.id === bankId);
  if (!resource) throw new Error('题库已移除，请重新选择。');
  const pool = [...quizPool(resource, mode)];
  if (!pool.length) throw new Error(mode === 'wrong' ? '此题库暂无待巩固错题。' : mode === 'favorites' ? '此题库暂无收藏题。' : '此题库暂未收录题目。');
  for (let index = pool.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  const questions = quizClone(pool.slice(0, requestedSize));
  for (const question of questions) {
    question.options?.forEach(Object.freeze);
    if (question.options) Object.freeze(question.options);
    Object.freeze(question);
  }
  Object.freeze(questions);
  quizSession = {id: uid(), bankId, bankTitle: resource.bank.name, section: resource.bank.section, mode, requestedSize, questions, answers: questions.map(() => null), index: 0, record: null};
  quizSelectedBank = bankId; quizMode = mode; quizSize = requestedSize; quizView = 'session';
  return quizClone(quizSession);
}
function quizAnswer(index, answer) {
  if (!quizSession || quizSession.record || quizSubmitting || ctx.persistencePaused) return false;
  const question = quizSession.questions[index];
  if (!question || !quizValidAnswer(question, answer)) return false;
  quizSession.answers[index] = answer;
  return true;
}
async function quizFavorite(bankId, questionId) {
  if (!quizReady || quizMarkBusy || quizSubmitting || ctx.persistencePaused) return false;
  quizMarkBusy = true;
  try {
    const mark = {...quizGetMark(bankId, questionId)};
    mark.favorite = !mark.favorite;
    await quizTrackWrite(storage.set(quizMarkKey(bankId, questionId), mark));
    quizMarks.set(quizMarkKey(bankId, questionId), mark);
    return mark.favorite;
  } finally { quizMarkBusy = false; }
}
async function quizSubmit() {
  if (!quizSession || quizSession.record || quizSubmitting || ctx.persistencePaused) return null;
  if (quizMarkBusy) throw new Error('收藏正在保存，请稍后提交。');
  const missing = quizSession.answers.findIndex(answer => answer === null);
  if (missing !== -1) { quizSession.index = missing; throw new Error('请完成全部题目后交卷，第 ' + (missing + 1) + ' 题尚未作答。'); }
  quizSubmitting = true;
  const session = quizSession;
  try {
    const record = {id: session.id, bankId: session.bankId, bankTitle: session.bankTitle, section: session.section, mode: session.mode, requestedSize: session.requestedSize, questions: quizClone(session.questions), answers: [...session.answers], correct: session.questions.filter((question, index) => question.answer === session.answers[index]).length, total: session.questions.length, submittedAt: new Date().toISOString()};
    const writes = {['quiz:record:' + record.id]: record};
    for (let index = 0; index < session.questions.length; index++) {
      const question = session.questions[index], previous = quizGetMark(session.bankId, question.id), wrong = question.answer !== session.answers[index];
      if (previous.wrong !== wrong) writes[quizMarkKey(session.bankId, question.id)] = {...previous, wrong};
    }
    await quizTrackWrite(storage.setMany(writes));
    // Statistics and review become visible only after the complete transaction commits.
    for (const [key, value] of Object.entries(writes)) if (key.startsWith('quiz:mark:')) quizMarks.set(key, value);
    quizHistory.unshift(quizClone(record)); session.record = record;
    return quizClone(record);
  } finally { quizSubmitting = false; }
}
function quizChoiceLabel(question, answer) {
  if (question.type === 'true-false') return answer ? tr('正确', 'True') : tr('错误', 'False');
  const option = question.options.find(item => item.id === answer);
  return option ? esc(option.id) + '. ' + quizText(option.text) : '';
}
function quizSetupPage() {
  const banks = listQuizBanks();
  if (!banks.some(resource => resource.bank.id === quizSelectedBank)) quizSelectedBank = banks.find(resource => resource.questions.length)?.bank.id || banks[0]?.bank.id || '';
  const selected = banks.find(resource => resource.bank.id === quizSelectedBank);
  const count = selected ? quizPool(selected, quizMode).length : 0;
  const cards = quizSections.map(([section, zh, en]) => {
    const resources = banks.filter(resource => resource.bank.section === section);
    return '<section class="quiz-section"><h2>' + tr(zh, en) + '</h2>' + (resources.length ? resources.map(resource => '<button type="button" class="quiz-bank ' + (resource.bank.id === quizSelectedBank ? 'selected' : '') + '" data-quiz-bank="' + esc(resource.bank.id) + '" aria-pressed="' + (resource.bank.id === quizSelectedBank) + '"><strong>' + esc(resource.bank.name) + '</strong><span>' + resource.questions.length + tr(' 题', ' questions') + (resource.origin === 'custom' ? tr(' · 自定义', ' · Custom') : '') + '</span>' + (resource.questions.length ? '' : '<small>' + tr('暂无题目 · 可导入题库', 'No questions · Import a bank') + '</small>') + '</button>').join('') : '<div class="quiz-empty">' + tr('暂无题目 · 可导入题库', 'No questions · Import a bank') + '</div>') + '</section>';
  }).join('');
  const resume = quizSession && !quizSession.record ? '<div class="quiz-notice">' + tr('有一组练习尚未交卷。', 'You have an unfinished group.') + ' <button type="button" data-quiz-resume>' + tr('继续作答', 'Resume') + '</button></div>' : '';
  const history = quizHistory.length ? '<div class="quiz-history"><h2>' + tr('已完成的练习', 'Completed groups') + '</h2>' + quizHistory.slice(0, 30).map(record => '<button type="button" data-quiz-review="' + esc(record.id) + '"><span>' + esc(record.bankTitle) + '</span><span>' + record.correct + ' / ' + record.total + ' · ' + Math.round(record.correct / record.total * 100) + '%</span><small>' + esc(new Date(record.submittedAt).toLocaleString()) + '</small></button>').join('') + '</div>' : '<p class="quiz-empty">' + tr('交卷后，这里会显示成绩与解析。', 'Submit a group to see results and explanations here.') + '</p>';
  return '<div class="quiz-setup">' + resume + '<div class="quiz-grid">' + cards + '</div><section class="quiz-controls card"><label>' + tr('练习方式', 'Practice mode') + '<select id="quizMode">' + [['random', '随机练习', 'Random'], ['wrong', '错题巩固', 'Wrong answers'], ['favorites', '收藏练习', 'Favorites']].map(([value, zh, en]) => '<option value="' + value + '"' + (value === quizMode ? ' selected' : '') + '>' + tr(zh, en) + '</option>').join('') + '</select></label><label>' + tr('每组题数', 'Group size') + '<select id="quizSize"><option value="10"' + (quizSize === 10 ? ' selected' : '') + '>10</option><option value="20"' + (quizSize === 20 ? ' selected' : '') + '>20</option></select></label><button type="button" class="primary" data-quiz-start' + (!count || !quizReady ? ' disabled' : '') + '>' + tr('开始练习', 'Start practice') + '</button><p class="quiz-notice" role="status">' + (!quizReady ? tr('正在读取本地练习记录。', 'Loading local practice records.') : !count ? tr('当前范围暂无题目，请更换题库或练习方式。', 'No questions in this selection. Choose another bank or mode.') : count < quizSize ? tr('当前范围只有 ', 'Only ') + count + tr(' 题，本组将练习全部可用题目。', ' questions available; this group uses all of them.') : count + tr(' 道可用题目 · 交卷后统一批改', ' available questions · Graded on submission')) + '</p></section>' + history + '</div>';
}
function quizSessionPage() {
  const session = quizSession, question = session.questions[session.index], answer = session.answers[session.index], reviewed = !!session.record;
  const answered = session.answers.filter(value => value !== null).length;
  const choices = question.type === 'true-false' ? [{id: true, text: tr('正确', 'True')}, {id: false, text: tr('错误', 'False')}] : question.options;
  const favorite = quizGetMark(session.bankId, question.id).favorite;
  const result = reviewed ? '<section class="quiz-result card" role="status"><h2>' + tr('本组已交卷', 'Group submitted') + '</h2><dl class="quiz-result-stats">' + [[tr('总题数', 'Questions'), session.record.total], [tr('正确题数', 'Correct'), session.record.correct], [tr('错误题数', 'Incorrect'), session.record.total - session.record.correct], [tr('正确率', 'Accuracy'), Math.round(session.record.correct / session.record.total * 100) + '%']].map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') + '</dl><p>' + tr('可逐题查看答案与解析，错题已更新。', 'Review answers and explanations. Wrong answers have been updated.') + '</p></section>' : '';
  return '<div class="quiz-session">' + result + '<div class="quiz-actions"><button type="button" data-quiz-back>' + tr('返回题库', 'Back to banks') + '</button><strong>' + esc(session.bankTitle) + '</strong><span class="quiz-progress" role="status">' + tr('已答 ', 'Answered ') + answered + ' / ' + session.questions.length + '</span></div>' + (session.questions.length < session.requestedSize ? '<p class="quiz-notice">' + tr('当前范围不足所选题数，本组共 ', 'Fewer questions were available. This group has ') + session.questions.length + tr(' 题。', ' questions.') + '</p>' : '') + '<nav class="quiz-jumps" aria-label="' + tr('题目导航', 'Question navigation') + '">' + session.questions.map((item, index) => '<button type="button" class="quiz-jump' + (index === session.index ? ' active' : '') + (session.answers[index] !== null ? ' answered' : '') + (reviewed ? item.answer === session.answers[index] ? ' correct' : ' incorrect' : '') + '" data-quiz-jump="' + index + '" aria-label="' + tr('第 ', 'Question ') + (index + 1) + (session.answers[index] !== null ? tr(' 题，已答', ', answered') : tr(' 题，未答', ', unanswered')) + (reviewed ? item.answer === session.answers[index] ? tr('，正确', ', correct') : tr('，错误', ', incorrect') : '') + '"' + (index === session.index ? ' aria-current="step"' : '') + '>' + (index + 1) + '</button>').join('') + '</nav><section class="quiz-question card" aria-labelledby="quizQuestion"><div class="quiz-actions"><span>' + (session.index + 1) + ' / ' + session.questions.length + ' · ' + esc(question.id) + '</span><button type="button" data-quiz-favorite aria-pressed="' + favorite + '"' + (quizSubmitting || quizMarkBusy ? ' disabled' : '') + '>' + (favorite ? tr('★ 已收藏', '★ Saved') : tr('☆ 收藏此题', '☆ Save question')) + '</button></div><h2 id="quizQuestion">' + quizText(question.question) + '</h2><div class="quiz-options" role="group" aria-label="' + tr('选择答案', 'Choose an answer') + '">' + choices.map((option, index) => '<button type="button" class="quiz-option' + (answer === option.id ? ' selected' : '') + (reviewed && option.id === question.answer ? ' correct' : reviewed && answer === option.id ? ' incorrect' : '') + '" data-quiz-option="' + index + '" aria-pressed="' + (answer === option.id) + '"' + (reviewed || quizSubmitting ? ' disabled' : '') + '>' + (question.type === 'single-choice' ? '<b>' + esc(option.id) + '</b> ' : '') + '<span>' + quizText(option.text) + '</span></button>').join('') + '</div>' + (reviewed ? '<div class="quiz-explanation"><p><strong>' + tr('你的答案：', 'Your answer: ') + '</strong>' + quizChoiceLabel(question, answer) + '</p><p><strong>' + tr('正确答案：', 'Correct answer: ') + '</strong>' + quizChoiceLabel(question, question.answer) + '</p><p><strong>' + tr('解析：', 'Explanation: ') + '</strong>' + quizText(question.explanation || tr('此题暂未提供解析。', 'No explanation provided.')) + '</p></div>' : '<p class="quiz-notice">' + tr('交卷前可自由修改答案，交卷后统一查看结果与解析。', 'You can change answers until submission. Results and explanations appear afterwards.') + '</p>') + '<div class="quiz-actions"><button type="button" data-quiz-prev' + (session.index === 0 ? ' disabled' : '') + '>' + tr('上一题', 'Previous') + '</button><button type="button" data-quiz-next' + (session.index === session.questions.length - 1 ? ' disabled' : '') + '>' + tr('下一题', 'Next') + '</button>' + (!reviewed ? '<button type="button" class="primary" data-quiz-submit' + (quizSubmitting || quizMarkBusy ? ' disabled' : '') + '>' + (quizSubmitting ? tr('正在保存…', 'Saving…') : tr('提交本组', 'Submit group')) + '</button>' : '') + '</div></section></div>';
}
function quizPage() {
  return '<button class="home-text-button" data-go3="explore">← ' + tr('返回学习拓展中心','Back to learning center') + '</button><div class="page-head"><div><div class="eyebrow">QUIZ</div><h1>' + tr('答题训练', 'Practice groups') + '</h1><p>' + tr('选择题库，完成一组练习，再统一复盘。', 'Choose a bank, complete a group, then review it together.') + '</p></div></div>' + (quizView === 'session' && quizSession ? quizSessionPage() : quizSetupPage());
}
function quizRender() { if (ctx.state?.route === 'quiz') render(); }
function bindQuizControls() {
  $$('[data-quiz-bank]').forEach(button => button.onclick = () => { quizSelectedBank = button.dataset.quizBank; quizRender(); });
  if ($('#quizMode')) $('#quizMode').onchange = event => { quizMode = event.target.value; quizRender(); };
  if ($('#quizSize')) $('#quizSize').onchange = event => { quizSize = Number(event.target.value); quizRender(); };
  const start = $('[data-quiz-start]');
  if (start) start.onclick = async () => {
    if (quizSession && !quizSession.record && !await confirmAction(tr('开始新一组练习？', 'Start another group?'), tr('当前未交卷答案将被替换，不计入成绩。', 'Your unfinished answers will be replaced without recording a result.'))) return;
    try { quizStart(quizSelectedBank, quizMode, quizSize); quizRender(); } catch (error) { toast(error.message); }
  };
  const resume = $('[data-quiz-resume]'); if (resume) resume.onclick = () => { quizView = 'session'; quizRender(); };
  const back = $('[data-quiz-back]'); if (back) back.onclick = () => { quizView = 'setup'; quizRender(); };
  $$('[data-quiz-review]').forEach(button => button.onclick = async () => {
    if (quizSession && !quizSession.record && !await confirmAction(tr('查看历史练习？', 'Review a past group?'), tr('当前未交卷答案将被替换，不计入成绩。', 'Your unfinished answers will be replaced without recording a result.'))) return;
    const record = quizHistory.find(item => item.id === button.dataset.quizReview);
    if (record) { quizSession = {...quizClone(record), index: 0, record: quizClone(record)}; quizView = 'session'; quizRender(); }
  });
  $$('[data-quiz-jump]').forEach(button => button.onclick = () => { quizSession.index = Number(button.dataset.quizJump); quizRender(); });
  const prev = $('[data-quiz-prev]'); if (prev) prev.onclick = () => { quizSession.index = Math.max(0, quizSession.index - 1); quizRender(); };
  const next = $('[data-quiz-next]'); if (next) next.onclick = () => { quizSession.index = Math.min(quizSession.questions.length - 1, quizSession.index + 1); quizRender(); };
  $$('[data-quiz-option]').forEach(button => button.onclick = () => {
    const question = quizSession.questions[quizSession.index], index = Number(button.dataset.quizOption);
    if (quizAnswer(quizSession.index, question.type === 'true-false' ? index === 0 : question.options[index].id)) quizRender();
  });
  const favorite = $('[data-quiz-favorite]'); if (favorite) favorite.onclick = async () => {
    favorite.disabled = true;
    try { await quizFavorite(quizSession.bankId, quizSession.questions[quizSession.index].id); } catch (error) { toast(tr('收藏保存失败：', 'Could not save favorite: ') + error.message); }
    quizRender();
  };
  const submit = $('[data-quiz-submit]'); if (submit) submit.onclick = async () => {
    submit.disabled = true;
    try { await quizSubmit(); } catch (error) { toast(tr('尚未交卷：', 'Group not submitted: ') + error.message); }
    quizRender();
  };
}

export { initializeQuiz, resetQuiz, quizPage, bindQuizControls, getRecentQuiz, validateQuizRecords, waitForQuizWrites, quizStart, quizAnswer, quizSubmit, quizFavorite, quizMarkKey, quizText };
