import { $, $$, esc, tr, toast, uid } from '../utils/helpers.js';
import { storage } from '../storage.js';
import { listPracticeBanks as listQuizBanks } from '../resources.js';
import { render, confirmAction, go3 } from '../app.js';
import { ctx } from '../state.js';

// Draft answers have their own small record; only submission produces formal statistics.
let quizHistory = [], quizMarks = new Map(), quizSession = null, quizDraft = null;
let quizSelectedBank = '', quizMode = 'random', quizSize = 10, quizView = 'setup';
let quizSubmitting = false, quizMarkBusy = false, quizReady = false;
let quizCountdown = false, quizMinutes = 20, quizClockTimer = null;
const QUIZ_MAX_SIZE = 200;
const QUIZ_DRAFT_KEY = 'quiz:draft:active';
let quizDraftTimer = null, quizDraftDirty = false, quizDraftError = false, quizDraftRevision = 0;
let quizDraftChain = Promise.resolve(), quizDraftGeneration = 0;
let quizDraftEditedAt = '';
const quizPendingWrites = new Set();
const quizSections = [
  ['grammar', '英语语法', 'English grammar'], ['vocabulary', '英语词汇', 'English vocabulary'],
  ['ancient-culture', '中国古代文化常识', 'Ancient Chinese culture'], ['chinese-usage', '汉语易错知识', 'Chinese language usage'],
  ['custom','我的题库','My banks']
];

function quizTrackWrite(promise) {
  const pending = promise.finally(() => quizPendingWrites.delete(pending));
  quizPendingWrites.add(pending);
  return pending;
}
async function waitForQuizWrites() {
  await flushQuizDraft();
  await Promise.all([...quizPendingWrites]);
}

function quizUpdateDraftStatus() {
  const element = $('#quizDraftStatus');
  if (element) element.textContent = quizDraftError ? tr('答案暂存失败，请备份或重试。','Answers could not be saved. Back up or retry.') : quizDraftDirty ? tr('正在暂存答案…','Saving answers…') : tr('答案已暂存到本机，切换应用后可继续。','Answers saved locally. You can return and continue.');
}
function quizScheduleDraft() {
  if (!quizDraft || ctx.persistencePaused) return;
  quizDraftDirty = true; quizDraftRevision++;
  quizDraftEditedAt = new Date().toISOString();
  clearTimeout(quizDraftTimer);
  quizDraftTimer = setTimeout(() => { quizDraftTimer = null; flushQuizDraft().catch(() => {}); },500);
  quizDraftTimer?.unref?.();
  quizUpdateDraftStatus();
}
function flushQuizDraft() {
  clearTimeout(quizDraftTimer); quizDraftTimer = null;
  if (ctx.persistencePaused || quizSubmitting || !quizDraftDirty || !quizDraft) return quizDraftChain;
  const session = quizDraft, revision = quizDraftRevision, generation = quizDraftGeneration;
  // Questions are immutable. Capture only this session and its answers, never the whole app.
  const answers = [...session.answers], updatedAt = quizDraftEditedAt;
  const run = async () => {
    // A newer flush can already have committed this revision while this one was queued.
    if (generation !== quizDraftGeneration || (!quizDraftDirty && quizDraftRevision === revision)) return;
    try {
      await storage.update(QUIZ_DRAFT_KEY,previous => {
        const base = previous?.id === session.id ? previous : {schemaVersion:1,id:session.id,bankId:session.bankId,bankTitle:session.bankTitle,section:session.section,mode:session.mode,requestedSize:session.requestedSize,questions:session.questions,startedAt:session.startedAt,limitSeconds:session.limitSeconds};
        return {...base,answers,updatedAt};
      });
      if (generation === quizDraftGeneration && quizDraft === session) {
        quizDraftError = false;
        if (quizDraftRevision === revision) quizDraftDirty = false;
      }
    } catch (error) {
      if (generation === quizDraftGeneration) { quizDraftError = true; quizDraftDirty = true; }
      toast(tr('答案暂存失败，请及时备份：','Answers could not be saved. Back up now: ')+error.message);
      throw error;
    } finally { quizUpdateDraftStatus(); }
  };
  const pending = quizTrackWrite(quizDraftChain.then(run,run));
  // Keep failures observable to the caller while allowing an explicit retry to run.
  quizDraftChain = pending.catch(() => {});
  return pending;
}
function getUnfinishedQuiz() {
  return quizDraft ? {id:quizDraft.id,bankId:quizDraft.bankId,bankTitle:quizDraft.bankTitle,answered:quizDraft.answers.filter(answer=>answer!==null).length,total:quizDraft.questions.length,startedAt:quizDraft.startedAt,saveError:quizDraftError} : null;
}
function getQuizDraftRecord() {
  if (!quizDraft) return null;
  const {id,bankId,bankTitle,section,mode,requestedSize,questions,startedAt,limitSeconds,answers} = quizDraft;
  return quizClone({schemaVersion:1,id,bankId,bankTitle,section,mode,requestedSize,questions,startedAt,limitSeconds,answers,updatedAt:quizDraftEditedAt});
}
function hasPendingQuizWrites() { return quizDraftDirty || quizPendingWrites.size > 0; }
function quizResume() {
  if (!quizDraft) return false;
  quizSession = quizDraft; quizView = 'session';
  if (ctx.state?.route !== 'quiz') go3('quiz'); else quizRender();
  return true;
}

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
  if ((question.learningBankId !== undefined || question.learningQuestionId !== undefined) && (typeof question.learningBankId !== 'string' || !question.learningBankId || typeof question.learningQuestionId !== 'string' || !question.learningQuestionId)) return false;
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
function quizValidTiming(timing) {
  return timing === undefined || (quizIsObject(timing) && typeof timing.startedAt === 'string' && Number.isFinite(Date.parse(timing.startedAt)) && Number.isInteger(timing.elapsedSeconds) && timing.elapsedSeconds >= 0 && timing.elapsedSeconds <= 31536000 && Number.isInteger(timing.limitSeconds) && timing.limitSeconds >= 0 && timing.limitSeconds <= 10800);
}
function quizFormatTime(seconds) {
  const n=Math.max(0,Math.floor(seconds));
  return (n>=3600?Math.floor(n/3600)+':':'')+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
function quizTimeState(session=quizSession, now=Date.now()) {
  if(!session)return {elapsedSeconds:0,remainingSeconds:null,expired:false};
  const timing=session.record?.timing;
  const elapsedSeconds=timing?timing.elapsedSeconds:Math.max(0,Math.floor((now-(session.startedAt??now))/1000));
  const limitSeconds=timing?.limitSeconds??session.limitSeconds??0;
  return {elapsedSeconds,remainingSeconds:limitSeconds?Math.max(0,limitSeconds-elapsedSeconds):null,expired:limitSeconds>0&&elapsedSeconds>=limitSeconds};
}
function quizStopClock(){clearTimeout(quizClockTimer);quizClockTimer=null;}
function quizTickClock(){
  quizStopClock();
  if(ctx.state?.route!=='quiz'||quizView!=='session'||!quizSession||quizSession.record||(typeof document!=='undefined'&&document.visibilityState==='hidden'))return;
  const time=quizTimeState(),clock=$('#quizClock'),notice=$('#quizTimeNotice');
  if(clock)clock.textContent=quizFormatTime(time.remainingSeconds??time.elapsedSeconds);
  const used=$('#quizElapsed');if(used)used.textContent=quizFormatTime(time.elapsedSeconds);
  if(notice){const text=time.expired?tr('时间到。答案已保留，可继续完成后提交本组。','Time is up. Your answers are kept; finish and submit when ready.') : '';if(notice.textContent!==text)notice.textContent=text;notice.hidden=!time.expired;}
  quizClockTimer=setTimeout(quizTickClock,1000);quizClockTimer?.unref?.();
}
function refreshQuizClock() { quizTickClock(); }
function quizValidDraft(value) {
  return quizIsObject(value) && value.schemaVersion === 1 && typeof value.id === 'string' && !!value.id && typeof value.bankId === 'string' && !!value.bankId && typeof value.bankTitle === 'string' && quizSections.some(section=>section[0]===value.section) && ['random','wrong','favorites'].includes(value.mode) && Number.isInteger(value.requestedSize) && value.requestedSize>=1 && value.requestedSize<=QUIZ_MAX_SIZE && Number.isInteger(value.startedAt) && value.startedAt>=0 && value.startedAt<=8640000000000000 && Number.isInteger(value.limitSeconds) && value.limitSeconds>=0 && value.limitSeconds<=10800 && typeof value.updatedAt==='string' && Number.isFinite(Date.parse(value.updatedAt)) && Array.isArray(value.questions) && value.questions.length>0 && value.questions.length<=value.requestedSize && value.questions.every(quizValidQuestion) && new Set(value.questions.map(question=>question.id)).size===value.questions.length && Array.isArray(value.answers) && value.answers.length===value.questions.length && value.questions.every((question,index)=>value.answers[index]===null||quizValidAnswer(question,value.answers[index])) && !('record' in value) && !('correct' in value) && !('submittedAt' in value);
}
function validateQuizRecords(records) {
  if (!quizIsObject(records)) throw new Error('练习备份格式无效。');
  for (const [key, value] of Object.entries(records)) {
    if (!key.startsWith('quiz:')) continue;
    let valid = false;
    if (key === QUIZ_DRAFT_KEY) {
      // null is an atomic submission tombstone, not an unfinished group.
      valid = value === null || quizValidDraft(value);
    } else if (key.startsWith('quiz:mark:')) {
      valid = quizIsObject(value) && typeof value.bankId === 'string' && !!value.bankId && typeof value.questionId === 'string' && !!value.questionId && typeof value.wrong === 'boolean' && typeof value.favorite === 'boolean' && key === quizMarkKey(value.bankId, value.questionId);
    } else if (key.startsWith('quiz:record:') && quizIsObject(value)) {
      valid = typeof value.id === 'string' && !!value.id && key === 'quiz:record:' + value.id && typeof value.bankId === 'string' && !!value.bankId && typeof value.bankTitle === 'string' && quizSections.some(section => section[0] === value.section) && ['random', 'wrong', 'favorites'].includes(value.mode) && Number.isInteger(value.requestedSize) && value.requestedSize >= 1 && value.requestedSize <= QUIZ_MAX_SIZE && quizValidTiming(value.timing) && Array.isArray(value.questions) && value.questions.length > 0 && value.questions.length <= value.requestedSize && value.questions.every(quizValidQuestion) && new Set(value.questions.map(question => question.id)).size === value.questions.length && Array.isArray(value.answers) && value.answers.length === value.questions.length && value.questions.every((question, index) => quizValidAnswer(question, value.answers[index])) && value.total === value.questions.length && Number.isInteger(value.correct) && value.correct === value.questions.filter((question, index) => question.answer === value.answers[index]).length && typeof value.submittedAt === 'string' && Number.isFinite(Date.parse(value.submittedAt));
    }
    if (!valid) throw new Error('练习备份记录无效：' + key);
  }
  return records;
}
function resetQuiz() {
  clearTimeout(quizDraftTimer); quizDraftTimer = null;
  quizDraftDirty = false; quizDraftError = false; quizDraftRevision = 0; quizDraftGeneration++; quizDraftEditedAt = '';
  quizStopClock();quizCountdown=false;quizMinutes=20;
  quizHistory = []; quizMarks = new Map(); quizSession = null; quizDraft = null;
  quizSelectedBank = ''; quizMode = 'random'; quizSize = 10; quizView = 'setup';
  quizSubmitting = false; quizMarkBusy = false; quizReady = false;
}
async function initializeQuiz(records) {
  const loaded = records === undefined ? await storage.getPrefix('quiz:') : records;
  validateQuizRecords(loaded);
  resetQuiz();
  const history = [];
  for (const [key, value] of Object.entries(loaded)) {
    if (key.startsWith('quiz:record:')) history.push(value);
    if (key.startsWith('quiz:mark:')) quizMarks.set(key, quizClone(value));
  }
  if (loaded[QUIZ_DRAFT_KEY]) {
    const draft = quizClone(loaded[QUIZ_DRAFT_KEY]);
    quizSession = quizDraft = {...draft,index:Math.max(0,draft.answers.findIndex(answer=>answer===null)),record:null};
    quizDraftEditedAt = draft.updatedAt;
    quizSelectedBank = draft.bankId; quizMode = draft.mode; quizSize = draft.requestedSize;
    quizCountdown = draft.limitSeconds>0; if (quizCountdown) quizMinutes = draft.limitSeconds/60;
    // Startup remains Home and the quiz landing remains a deliberate Resume action.
    quizView = 'setup';
  }
  history.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  // Retain one complete recent result for the existing synchronous API. Older
  // question snapshots stay in IndexedDB and are loaded only when reviewed.
  quizHistory = history.map((record,index)=>index===0?quizClone(record):quizRecordSummary(record));
  quizReady = true;
}
function getRecentQuiz() { return quizHistory.length ? quizClone(quizHistory[0]) : null; }
function quizRecordSummary(record) {
  const {id,bankId,bankTitle,section,mode,total,correct,submittedAt,timing} = record;
  return quizClone({id,bankId,bankTitle,section,mode,total,correct,submittedAt,...(timing?{timing}:{})});
}
function getRecentQuizSummary() { return quizHistory.length ? quizRecordSummary(quizHistory[0]) : null; }
// Read only: unfinished drafts never enter this aggregation, nor trigger storage writes.
function getQuizDashboard(section = '') {
  const banks=listQuizBanks(), names=new Map(banks.filter(item=>item.origin==='custom').map(item=>[item.bank.id,item.bank.name]));
  for(const record of quizHistory)if(record.section==='custom'&&!names.has(record.bankId))names.set(record.bankId,record.bankTitle);
  const matches=(record,id)=>id.startsWith('bank:')?record.bankId===id.slice(5):record.section===id&&!names.has(record.bankId);
  const records=quizHistory.filter(record=>!section||matches(record,section));
  const total=records.reduce((sum,record)=>sum+record.total,0),correct=records.reduce((sum,record)=>sum+record.correct,0),timed=records.filter(record=>record.timing);
  const definitions=[...quizSections.filter(([id])=>id!=='custom'),...[...names].map(([id,name])=>['bank:'+id,name,name])];
  const sections=definitions.map(([id,zh,en])=>{
    const groups=records.filter(record=>matches(record,id));return {id,zh,en,groups:groups.length,total:groups.reduce((sum,record)=>sum+record.total,0),correct:groups.reduce((sum,record)=>sum+record.correct,0)};
  });
  const sectionBanks=section?new Set(banks.filter(item=>section.startsWith('bank:')?item.bank.id===section.slice(5):item.origin!=='custom'&&item.bank.section===section).flatMap(item=>item.sourceBankIds||[item.bank.id])):null;
  const marks=[...quizMarks.values()].filter(mark=>!sectionBanks||sectionBanks.has(mark.bankId));
  return {groups:records.length,total,correct,accuracy:total?Math.round(correct/total*100):null,
    elapsedSeconds:timed.reduce((sum,record)=>sum+record.timing.elapsedSeconds,0),timedGroups:timed.length,
    wrong:marks.filter(mark=>mark.wrong).length,favorites:marks.filter(mark=>mark.favorite).length,
    sections,recent:records.slice(0,7).map(quizRecordSummary)};
}

export { getQuizDashboard, getRecentQuizSummary };
function quizGetMark(bankId, questionId, suppliedQuestion) {
  const question = suppliedQuestion || (quizSession?.bankId === bankId && quizSession.questions.find(q => q.id === questionId)) || listQuizBanks().find(item => item.bank.id === bankId)?.questions.find(q => q.id === questionId);
  if (question?.learningBankId) { bankId = question.learningBankId; questionId = question.learningQuestionId; }
  return quizMarks.get(quizMarkKey(bankId, questionId)) || {bankId, questionId, wrong: false, favorite: false};
}
function quizPool(resource, mode) {
  return resource.questions.filter(question => mode === 'random' || quizGetMark(resource.bank.id, question.id, question)[mode === 'wrong' ? 'wrong' : 'favorite']);
}
function quizStart(bankId, mode = 'random', requestedSize = 10, random = Math.random, {limitSeconds=0} = {}) {
  if (!quizReady || quizSubmitting || quizMarkBusy || ctx.persistencePaused) throw new Error('请等待本地数据准备完成。');
  if (!Number.isInteger(requestedSize) || requestedSize<1 || requestedSize>QUIZ_MAX_SIZE || !['random', 'wrong', 'favorites'].includes(mode)) throw new Error('每组题数请输入 1–200 的整数。');
  if(!Number.isInteger(limitSeconds)||limitSeconds<0||limitSeconds>10800)throw new Error('倒计时应为 1–180 分钟，关闭时为 0。');
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
  quizSession = {id: uid(), bankId, bankTitle: resource.bank.name, section: resource.origin==='custom'?'custom':resource.bank.section, mode, requestedSize, questions, answers: questions.map(() => null), index: 0, record: null, startedAt:Date.now(), limitSeconds};
  quizDraft = quizSession; quizScheduleDraft();
  quizSelectedBank = bankId; quizMode = mode; quizSize = requestedSize;quizCountdown=limitSeconds>0;if(quizCountdown)quizMinutes=limitSeconds/60; quizView = 'session';
  return quizClone(quizSession);
}
function quizAnswer(index, answer) {
  if (!quizSession || quizSession.record || quizSubmitting || ctx.persistencePaused) return false;
  const question = quizSession.questions[index];
  if (!question || !quizValidAnswer(question, answer)) return false;
  if (quizSession.answers[index] === answer) return true;
  quizSession.answers[index] = answer;
  quizScheduleDraft();
  return true;
}
async function quizFavorite(bankId, questionId) {
  if (!quizReady || quizMarkBusy || quizSubmitting || ctx.persistencePaused) return false;
  quizMarkBusy = true;
  try {
    const mark = {...quizGetMark(bankId, questionId)};
    mark.favorite = !mark.favorite;
    await quizTrackWrite(storage.set(quizMarkKey(mark.bankId, mark.questionId), mark));
    quizMarks.set(quizMarkKey(mark.bankId, mark.questionId), mark);
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
    clearTimeout(quizDraftTimer); quizDraftTimer = null;
    await quizDraftChain;
    const record = {id: session.id, bankId: session.bankId, bankTitle: session.bankTitle, section: session.section, mode: session.mode, requestedSize: session.requestedSize, questions: quizClone(session.questions), answers: [...session.answers], correct: session.questions.filter((question, index) => question.answer === session.answers[index]).length, total: session.questions.length, submittedAt: new Date().toISOString(),timing:{startedAt:new Date(session.startedAt).toISOString(),elapsedSeconds:quizTimeState(session).elapsedSeconds,limitSeconds:session.limitSeconds}};
    const writes = {['quiz:record:' + record.id]: record};
    for (let index = 0; index < session.questions.length; index++) {
      const question = session.questions[index], previous = quizGetMark(session.bankId, question.id, question), wrong = question.answer !== session.answers[index];
      if (previous.wrong !== wrong) writes[quizMarkKey(previous.bankId, previous.questionId)] = {...previous, wrong};
    }
    await quizTrackWrite(storage.setMany(writes,[QUIZ_DRAFT_KEY]));
    // Statistics and review become visible only after the complete transaction commits.
    for (const [key, value] of Object.entries(writes)) if (key.startsWith('quiz:mark:')) quizMarks.set(key, value);
    quizHistory.unshift(quizClone(record)); session.record = record;quizStopClock();
    if (quizHistory.length>1) quizHistory[1] = quizRecordSummary(quizHistory[1]);
    quizDraft = null; quizDraftDirty = false; quizDraftError = false; quizDraftGeneration++;
    return quizClone(record);
  } finally { quizSubmitting = false; if (quizDraft && quizDraftDirty) quizScheduleDraft(); }
}
function quizChoiceLabel(question, answer) {
  if (question.type === 'true-false') return answer ? tr('正确', 'True') : tr('错误', 'False');
  const option = question.options.find(item => item.id === answer);
  return option ? esc(option.id) + '. ' + quizText(option.text) : '';
}
function quizBankCard(resource) { return '<button type="button" class="quiz-bank ' + (resource.bank.id === quizSelectedBank ? 'selected' : '') + '" data-quiz-bank="' + esc(resource.bank.id) + '" aria-pressed="' + (resource.bank.id === quizSelectedBank) + '"><span class="quiz-selection-indicator" aria-hidden="true">✓</span><strong>' + esc(resource.bank.name) + '</strong><span>' + resource.questions.length + tr(' 题', ' questions') + (resource.origin === 'custom' ? tr(' · 自定义', ' · Custom') : '') + '</span>' + (resource.questions.length ? '' : '<small>' + tr('暂无题目 · 可导入题库', 'No questions · Import a bank') + '</small>') + '</button>'; }
function quizSetupPage() {
  const banks = listQuizBanks();
  if (!banks.some(resource => resource.bank.id === quizSelectedBank)) quizSelectedBank = banks.find(resource => resource.questions.length)?.bank.id || banks[0]?.bank.id || '';
  const selected = banks.find(resource => resource.bank.id === quizSelectedBank);
  const count = selected ? quizPool(selected, quizMode).length : 0;
  const cards=banks.map(quizBankCard).join('');
  const resume = quizDraft ? '<div class="quiz-notice">' + tr('有一组练习尚未交卷，答案已保留。', 'Your unfinished answers are kept.') + ' <button type="button" data-quiz-resume>' + tr('继续作答', 'Resume') + '</button></div>' : '';
  const history = quizHistory.length ? '<div class="quiz-history"><h2>' + tr('已完成的练习', 'Completed groups') + '</h2>' + quizHistory.slice(0, 30).map(record => '<button type="button" data-quiz-review="' + esc(record.id) + '"><span>' + esc(record.bankTitle) + '</span><span>' + record.correct + ' / ' + record.total + ' · ' + Math.round(record.correct / record.total * 100) + '%</span><small>' + esc(new Date(record.submittedAt).toLocaleString()) + '</small></button>').join('') + '</div>' : '<p class="quiz-empty">' + tr('交卷后，这里会显示成绩与解析。', 'Submit a group to see results and explanations here.') + '</p>';
  return '<div class="quiz-setup"><div class="actions"><button data-action="resources">'+tr('管理题库 / 导入题目','Manage banks / import questions')+'</button></div>' + resume + '<div class="quiz-grid">' + cards + '</div><section class="quiz-controls card"><label>' + tr('练习方式', 'Practice mode') + '<select id="quizMode">' + [['random', '随机练习', 'Random'], ['wrong', '错题巩固', 'Wrong answers'], ['favorites', '收藏练习', 'Favorites']].map(([value, zh, en]) => '<option value="' + value + '"' + (value === quizMode ? ' selected' : '') + '>' + tr(zh, en) + '</option>').join('') + '</select></label><label>' + tr('每组题数', 'Group size') + '<input id="quizSize" type="number" inputmode="numeric" min="1" max="200" step="1" value="'+(Number.isFinite(quizSize)?quizSize:'')+'" required></label><div class="quiz-timing-controls"><label class="quiz-timing-toggle"><input id="quizCountdown" type="checkbox" '+(quizCountdown?'checked':'')+'>'+tr('开启倒计时','Countdown')+'</label><label>'+tr('时长（分钟）','Minutes')+'<input id="quizMinutes" type="number" inputmode="numeric" min="1" max="180" step="1" value="'+quizMinutes+'" '+(quizCountdown?'':'disabled')+'></label></div><button type="button" class="primary" data-quiz-start' + (!count || !quizReady ? ' disabled' : '') + '>' + tr('开始练习', 'Start practice') + '</button><p class="quiz-notice" id="quizSetupStatus" role="status">' + (!quizReady ? tr('正在读取本地练习记录。', 'Loading local practice records.') : !count ? tr('当前范围暂无题目，请更换题库或练习方式。', 'No questions in this selection. Choose another bank or mode.') : count < quizSize ? tr('当前范围只有 ', 'Only ') + count + tr(' 题，本组将练习全部可用题目。', ' questions available; this group uses all of them.') : count + tr(' 道可用题目 · 交卷后统一批改', ' available questions · Graded on submission')) + '</p><p class="quiz-notice">'+tr('题数可手填 1–200；不足时练习全部可用题。倒计时到时只提醒，不自动交卷；计时不触发保存。','Enter 1–200 questions. A smaller pool uses all available questions. Countdown gives a reminder without auto-submission.')+'</p></section>' + history + '</div>';
}
function quizSessionPage() {
  const session = quizSession, question = session.questions[session.index], answer = session.answers[session.index], reviewed = !!session.record;
  const answered = session.answers.filter(value => value !== null).length;
  const choices = question.type === 'true-false' ? [{id: true, text: tr('正确', 'True')}, {id: false, text: tr('错误', 'False')}] : question.options;
  const favorite = quizGetMark(session.bankId, question.id, question).favorite;
  const time=quizTimeState(),limit=session.record?.timing?.limitSeconds??session.limitSeconds??0;
  const clock=reviewed?(session.record.timing?'<p class="quiz-time-summary">'+tr('本组用时 ','Time spent ')+quizFormatTime(time.elapsedSeconds)+(limit?' · '+tr('限时 ','Limit ')+quizFormatTime(limit):'')+'</p>':''):'<section class="quiz-clock-bar" aria-label="'+tr('本组计时','Session timer')+'"><div><span>'+tr(limit?'剩余时间':'已用时间',limit?'Time left':'Time spent')+'</span><strong id="quizClock" role="timer" aria-live="off">'+quizFormatTime(time.remainingSeconds??time.elapsedSeconds)+'</strong></div>'+(limit?'<small>'+tr('已用时 ','Elapsed ')+ '<span id="quizElapsed">'+quizFormatTime(time.elapsedSeconds)+'</span></small>':'')+'<p id="quizTimeNotice" role="status" '+(time.expired?'':'hidden')+'>'+ (time.expired?tr('时间到。答案已保留，可继续完成后提交本组。','Time is up. Finish and submit when ready.'):'')+'</p></section>';
  const result = reviewed ? '<section class="quiz-result card" role="status"><h2>' + tr('本组已交卷', 'Group submitted') + '</h2><dl class="quiz-result-stats">' + [[tr('总题数', 'Questions'), session.record.total], [tr('正确题数', 'Correct'), session.record.correct], [tr('错误题数', 'Incorrect'), session.record.total - session.record.correct], [tr('正确率', 'Accuracy'), Math.round(session.record.correct / session.record.total * 100) + '%']].map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') + '</dl><p>' + tr('可逐题查看答案与解析，错题已更新。', 'Review answers and explanations. Wrong answers have been updated.') + '</p></section>' : '';
  return '<div class="quiz-session">' + clock + result + '<div class="quiz-actions"><button type="button" data-quiz-back>' + tr('返回题库', 'Back to banks') + '</button><strong>' + esc(session.bankTitle) + '</strong><span class="quiz-progress" role="status">' + tr('已答 ', 'Answered ') + answered + ' / ' + session.questions.length + '</span></div>' + (session.questions.length < session.requestedSize ? '<p class="quiz-notice">' + tr('当前范围不足所选题数，本组共 ', 'Fewer questions were available. This group has ') + session.questions.length + tr(' 题。', ' questions.') + '</p>' : '') + '<nav class="quiz-jumps" aria-label="' + tr('题目导航', 'Question navigation') + '">' + session.questions.map((item, index) => '<button type="button" class="quiz-jump' + (index === session.index ? ' active' : '') + (session.answers[index] !== null ? ' answered' : '') + (reviewed ? item.answer === session.answers[index] ? ' correct' : ' incorrect' : '') + '" data-quiz-jump="' + index + '" aria-label="' + tr('第 ', 'Question ') + (index + 1) + (session.answers[index] !== null ? tr(' 题，已答', ', answered') : tr(' 题，未答', ', unanswered')) + (reviewed ? item.answer === session.answers[index] ? tr('，正确', ', correct') : tr('，错误', ', incorrect') : '') + '"' + (index === session.index ? ' aria-current="step"' : '') + '>' + (index + 1) + '</button>').join('') + '</nav><section class="quiz-question card" aria-labelledby="quizQuestion"><div class="quiz-actions"><span>' + (session.index + 1) + ' / ' + session.questions.length + ' · ' + esc(question.learningQuestionId || question.id) + '</span><button type="button" data-quiz-favorite aria-pressed="' + favorite + '"' + (quizSubmitting || quizMarkBusy ? ' disabled' : '') + '>' + (favorite ? tr('★ 已收藏', '★ Saved') : tr('☆ 收藏此题', '☆ Save question')) + '</button></div><h2 id="quizQuestion">' + quizText(question.question) + '</h2><div class="quiz-options" role="group" aria-label="' + tr('选择答案', 'Choose an answer') + '">' + choices.map((option, index) => '<button type="button" class="quiz-option' + (answer === option.id ? ' selected' : '') + (reviewed && option.id === question.answer ? ' correct' : reviewed && answer === option.id ? ' incorrect' : '') + '" data-quiz-option="' + index + '" aria-pressed="' + (answer === option.id) + '"' + (reviewed || quizSubmitting ? ' disabled' : '') + '>' + (question.type === 'single-choice' ? '<b>' + esc(option.id) + '</b> ' : '') + '<span>' + quizText(option.text) + '</span></button>').join('') + '</div>' + (reviewed ? '<div class="quiz-explanation"><p><strong>' + tr('你的答案：', 'Your answer: ') + '</strong>' + quizChoiceLabel(question, answer) + '</p><p><strong>' + tr('正确答案：', 'Correct answer: ') + '</strong>' + quizChoiceLabel(question, question.answer) + '</p><p><strong>' + tr('解析：', 'Explanation: ') + '</strong>' + quizText(question.explanation || tr('此题暂未提供解析。', 'No explanation provided.')) + '</p></div>' : '<p class="quiz-notice">' + tr('交卷前可自由修改答案，交卷后统一查看结果与解析。', 'You can change answers until submission. Results and explanations appear afterwards.') + '</p><p class="quiz-notice" id="quizDraftStatus" role="status"></p>') + '<div class="quiz-actions"><button type="button" data-quiz-prev' + (session.index === 0 ? ' disabled' : '') + '>' + tr('上一题', 'Previous') + '</button><button type="button" data-quiz-next' + (session.index === session.questions.length - 1 ? ' disabled' : '') + '>' + tr('下一题', 'Next') + '</button>' + (!reviewed ? '<button type="button" class="primary" data-quiz-submit' + (quizSubmitting || quizMarkBusy ? ' disabled' : '') + '>' + (quizSubmitting ? tr('正在保存…', 'Saving…') : tr('提交本组', 'Submit group')) + '</button>' : '') + '</div></section></div>';
}
function quizPage() {
  return '<button class="home-text-button" data-go3="explore">← ' + tr('返回学习中心','Back to learning center') + '</button><div class="page-head"><div><div class="eyebrow">LEARNING / PRACTICE</div><h1>' + tr('练习中心', 'Practice center') + '</h1><p>' + tr('选择题库，完成一组练习，再统一复盘。', 'Choose a bank, complete a group, then review it together.') + '</p></div></div>' + (quizView === 'session' && quizSession ? quizSessionPage() : quizSetupPage());
}
function quizRender() { if (ctx.state?.route === 'quiz') render(); }
function bindQuizControls() {
  quizTickClock();
  quizUpdateDraftStatus();
  $$('[data-quiz-bank]').forEach(button => button.onclick = () => { quizSelectedBank = button.dataset.quizBank; quizRender(); });
  if ($('#quizMode')) $('#quizMode').onchange = event => { quizMode = event.target.value; quizRender(); };
  if ($('#quizSize')) $('#quizSize').oninput = event => { quizSize = event.target.value===''?NaN:Number(event.target.value); };
  if($('#quizCountdown'))$('#quizCountdown').onchange=event=>{quizCountdown=event.target.checked;$('#quizMinutes').disabled=!quizCountdown;};
  if($('#quizMinutes'))$('#quizMinutes').oninput=event=>{quizMinutes=event.target.value===''?NaN:Number(event.target.value);};
  const start = $('[data-quiz-start]');
  if (start) start.onclick = async () => {
    if(!$('#quizSize').reportValidity() || (quizCountdown&&!$('#quizMinutes').reportValidity()))return;
    if (quizDraft && !await confirmAction(tr('开始新一组练习？', 'Start another group?'), tr('当前未交卷答案将被替换，不计入成绩。', 'Your unfinished answers will be replaced without recording a result.'))) return;
    try { quizStart(quizSelectedBank, quizMode, quizSize,Math.random,{limitSeconds:quizCountdown?quizMinutes*60:0}); quizRender(); } catch (error) { toast(error.message); }
  };
  $$('[data-quiz-resume]').forEach(button => button.onclick = quizResume);
  const back = $('[data-quiz-back]'); if (back) back.onclick = () => { quizView = 'setup'; quizRender(); };
  $$('[data-quiz-review]').forEach(button => button.onclick = async () => {
    // Reviewing past results keeps the independent unfinished group available to resume.
    button.disabled = true;
    try {
      const summary = quizHistory.find(item => item.id === button.dataset.quizReview);
      if (!summary) return;
      const record = summary.questions ? summary : await storage.get('quiz:record:'+summary.id);
      if (!record) throw new Error(tr('此组记录暂时无法读取，请重试。','Could not read this group. Try again.'));
      validateQuizRecords({['quiz:record:'+record.id]:record});
      quizSession = {...quizClone(record), index: 0, record: quizClone(record)}; quizView = 'session'; quizRender();
    } catch (error) { toast(tr('无法打开练习记录：','Could not open practice: ')+error.message); }
    finally { button.disabled = false; }
  });
  $$('[data-quiz-jump]').forEach(button => button.onclick = () => { quizSession.index = Number(button.dataset.quizJump); quizRender(); });
  const prev = $('[data-quiz-prev]'); if (prev) prev.onclick = () => { quizSession.index = Math.max(0, quizSession.index - 1); quizRender(); };
  const next = $('[data-quiz-next]'); if (next) next.onclick = () => { quizSession.index = Math.min(quizSession.questions.length - 1, quizSession.index + 1); quizRender(); };
  $$('[data-quiz-option]').forEach(button => button.onclick = () => {
    const question = quizSession.questions[quizSession.index], index = Number(button.dataset.quizOption);
    if (quizAnswer(quizSession.index, question.type === 'true-false' ? index === 0 : question.options[index].id)) {
      // Answering changes only local controls; keep the question and scroll position intact.
      $$('[data-quiz-option]').forEach(option => { const selected=option===button; option.classList.toggle('selected',selected); option.setAttribute('aria-pressed',String(selected)); });
      const answered = quizSession.answers.filter(answer=>answer!==null).length;
      const progress = $('.quiz-progress'); if(progress)progress.textContent=tr('已答 ','Answered ')+answered+' / '+quizSession.questions.length;
      const jump = $('[data-quiz-jump="'+quizSession.index+'"]');
      if (jump) { jump.classList.add('answered'); jump.setAttribute('aria-label',tr('第 ','Question ')+(quizSession.index+1)+tr(' 题，已答',', answered')); }
    }
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

export { initializeQuiz, resetQuiz, quizPage, bindQuizControls, getRecentQuiz, validateQuizRecords, waitForQuizWrites, quizStart, quizAnswer, quizSubmit, quizFavorite, quizMarkKey, quizText, quizTimeState, quizFormatTime, QUIZ_MAX_SIZE, QUIZ_DRAFT_KEY, flushQuizDraft, getUnfinishedQuiz, getQuizDraftRecord, quizResume, refreshQuizClock, hasPendingQuizWrites };
