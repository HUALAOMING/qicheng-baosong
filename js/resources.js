import { storage } from './storage.js';
import { APP_BASE, CLASSICS, resourceFetch } from './data.js';
import {tasks} from './tasks.js';
import {bankQuestionKey521,bankMetaKey521,bankHeaders521,bankRead521,bankDelta521,bankRemoveKeys521,exportBankRecords} from './bank-store521.js';

// Resource content is independent from personal learning records and application releases.
const RESOURCE_SCHEMA_VERSION = 1;
const RESOURCE_BANK_IDS = ['english-grammar', 'english-vocabulary', 'chinese-ancient-culture', 'chinese-usage'];
const RESOURCE_SECTIONS = {english:['grammar','vocabulary'], chinese:['ancient-culture','chinese-usage'],custom:['custom']};
const RESOURCE_MAX_BYTES = 12 * 1024 * 1024;
// Verified source history for the unchanged 1.0.0 default banks (GitHub commit 7e4b621).
const RESOURCE_DEFAULT_UPDATED_AT52 = '2026-10-15T22:46:16.000Z';
let resourceBanks = [], resourceOfficialQuotes = null, resourceCustomQuotes = null;
let resourceClassics = [];
const EXAM_SCHEDULE_ID = 'exam-schedule';
let resourceOfficialSchedule = null, resourceCustomSchedule = null;
const QUIZ_LIBRARY_KEY = 'settings:quiz-library';
let quizLibrary = {schemaVersion:1, banks:[], assignments:{}};
let resourceInitialized = false, resourceInitialization = null, resourceWriteChain = Promise.resolve();
const resourcePendingWrites = new Set();

function resourceObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + '必须是对象。');
  return value;
}
function resourceString(value, label, max = 20000, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error(label + '必须是有效文本。');
  return value;
}
function resourceID(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value)) throw new Error(label + '必须是稳定的字母、数字、点、下划线或连字符标识。');
  return value;
}
function resourceVersion(value) {
  if (typeof value !== 'string' || value.length > 120 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value)) throw new Error('资源版本必须符合语义化版本格式，例如 1.0.0。');
  return value;
}
function compareResourceVersions(left, right) {
  const a = resourceVersion(left).split('+')[0].split('-'), b = resourceVersion(right).split('+')[0].split('-');
  const an = a[0].split('.'), bn = b[0].split('.');
  for (let i = 0; i < 3; i++) { const x = BigInt(an[i]), y = BigInt(bn[i]); if (x !== y) return x > y ? 1 : -1; }
  const ap = a.slice(1).join('-'), bp = b.slice(1).join('-');
  if (!ap || !bp) return ap === bp ? 0 : ap ? -1 : 1;
  const as = ap.split('.'), bs = bp.split('.');
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    if (as[i] === bs[i]) continue;
    if (as[i] === undefined || bs[i] === undefined) return as[i] === undefined ? -1 : 1;
    const ai = /^\d+$/.test(as[i]), bi = /^\d+$/.test(bs[i]);
    if (ai && bi) return BigInt(as[i]) > BigInt(bs[i]) ? 1 : -1;
    if (ai !== bi) return ai ? -1 : 1;
    return as[i] > bs[i] ? 1 : -1;
  }
  return 0;
}
function resourceParse(input) {
  if (typeof input !== 'string') return resourceObject(input, '资源');
  if (new TextEncoder().encode(input).byteLength > RESOURCE_MAX_BYTES) throw new Error('资源文件超过 12 MB。');
  try { return resourceObject(JSON.parse(input), '资源'); } catch (error) { throw new Error('资源 JSON 无法读取：' + error.message); }
}
function validateQuizBank(input) {
  const data = resourceParse(input);
  if (data.schemaVersion !== RESOURCE_SCHEMA_VERSION) throw new Error('不支持的题库 schemaVersion。');
  const bank = resourceObject(data.bank, 'bank');
  const cleanBank = {id:resourceID(bank.id, '题库 ID'), name:resourceString(bank.name, '题库名称', 200), subject:bank.subject, section:bank.section, version:resourceVersion(bank.version)};
  if (bank.id === 'daily-quotes') throw new Error('daily-quotes 是名言资源的保留 ID。');
  resourceID(bank.subject,'科目 ID');resourceID(bank.section,'资源分组 ID');
  if (['english','chinese'].includes(bank.subject) && !RESOURCE_SECTIONS[bank.subject].includes(bank.section)) throw new Error('题库科目与章节不匹配。');
  if (bank.updatedAt !== undefined) {
    if(typeof bank.updatedAt!=='string'||bank.updatedAt.length>100||!Number.isFinite(Date.parse(bank.updatedAt)))throw new Error('题库更新时间必须是有效日期。');
    cleanBank.updatedAt=new Date(bank.updatedAt).toISOString();
  }
  if (bank.source !== undefined) cleanBank.source = resourceString(bank.source, '题库来源', 2000, true);
  if (!Array.isArray(data.questions) || data.questions.length > 20000) throw new Error('questions 必须是最多 20000 项的数组。');
  const seen = new Set();
  const questions = data.questions.map((entry, index) => {
    const q = resourceObject(entry, '第 ' + (index + 1) + ' 题');
    const id = resourceID(q.id, '题目 ID');
    if (seen.has(id)) throw new Error('题目 ID 重复：' + id); seen.add(id);
    const clean = {id, type:q.type, question:resourceString(q.question, '题干'), explanation:resourceString(q.explanation, '解析', 40000, true)};
    if (q.type === 'single-choice') {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 12) throw new Error('单选题必须有 2–12 个选项。');
      const optionIDs = new Set();
      clean.options = q.options.map(option => {
        resourceObject(option, '选项'); const optionID = resourceID(option.id, '选项 ID');
        if (optionIDs.has(optionID)) throw new Error('选项 ID 重复：' + optionID); optionIDs.add(optionID);
        return {id:optionID, text:resourceString(option.text, '选项文本')};
      });
      if (typeof q.answer !== 'string' || !optionIDs.has(q.answer)) throw new Error('正确答案必须指向一个现有选项。');
      clean.answer = q.answer;
    } else if (q.type === 'true-false') {
      if (typeof q.answer !== 'boolean') throw new Error('判断题答案必须是 true 或 false。');
      if (q.options !== undefined) throw new Error('判断题不应包含 options。');
      clean.answer = q.answer;
    } else throw new Error('不支持的题型：' + q.type);
    if (q.source !== undefined) clean.source = resourceString(q.source, '题目来源', 2000, true);
    if(q.category!==undefined)clean.category=resourceString(q.category,'题目分类',200,true);
    if(q.tags!==undefined){if(!Array.isArray(q.tags)||q.tags.length>30||q.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>100)||new Set(q.tags).size!==q.tags.length)throw new Error('题目标签需为最多30个不重复文本。');clean.tags=[...q.tags];}
    return clean;
  });
  return {schemaVersion:RESOURCE_SCHEMA_VERSION, bank:cleanBank, questions};
}
function validateQuotes(input) {
  const data = resourceParse(input);
  if (data.schemaVersion !== RESOURCE_SCHEMA_VERSION) throw new Error('不支持的名言 schemaVersion。');
  if (!Array.isArray(data.quotes) || data.quotes.length > 20000) throw new Error('quotes 必须是最多 20000 项的数组。');
  const seen = new Set();
  return {schemaVersion:RESOURCE_SCHEMA_VERSION, version:resourceVersion(data.version), quotes:data.quotes.map(entry => {
    resourceObject(entry, '名言'); const id = resourceID(entry.id, '名言 ID');
    if (seen.has(id)) throw new Error('名言 ID 重复：' + id); seen.add(id);
    const clean = {id, text:resourceString(entry.text, '名言文本', 2000), source:resourceString(entry.source ?? '', '名言出处', 1000, true)};
    if (entry.bookId !== undefined || entry.passageId !== undefined) {
      clean.bookId = resourceID(entry.bookId, '典籍 ID');
      clean.passageId = resourceID(entry.passageId, '段落 ID');
    }
    return clean;
  })};
}
function validateClassic(input) {
  const data = resourceParse(input);
  if (data.schemaVersion !== 1) throw new Error('不支持的典籍 schemaVersion。');
  resourceObject(data.book, 'book');
  const book = {id:resourceID(data.book.id,'典籍 ID'),title:resourceString(data.book.title,'书名',200),version:resourceVersion(data.book.version),
    englishTitle:resourceString(data.book.englishTitle ?? '', '英文书名',200,true),subtitle:resourceString(data.book.subtitle ?? '', '简介',2000,true)};
  if (!Array.isArray(data.passages) || !data.passages.length || data.passages.length > 20000) throw new Error('passages 必须有 1–20000 条正文。');
  const seen = new Set();
  const passages = data.passages.map(p => {
    resourceObject(p,'段落'); const id=resourceID(p.id,'段落 ID');
    if (seen.has(id)) throw new Error('段落 ID 重复：'+id); seen.add(id);
    return {id,chapter:resourceString(p.chapter ?? '', '篇目',500,true),text:resourceString(p.text,'原文',40000),explanation:resourceString(p.explanation ?? '', '简释',40000,true)};
  });
  return {schemaVersion:1,book,passages};
}
function validateExamSchedule(input) {
  const data=resourceParse(input);
  if(data.schemaVersion!==1 || !Array.isArray(data.examSchedule) || data.examSchedule.length>20000)throw new Error('考试日程需要 schemaVersion: 1 和最多 20000 项的 examSchedule 数组。');
  const seen=new Set();
  return {schemaVersion:1,version:resourceVersion(data.version),examSchedule:data.examSchedule.map(entry=>{
    resourceObject(entry,'考试安排');const id=resourceID(entry.id,'考试安排 ID');if(seen.has(id))throw new Error('考试安排 ID 重复：'+id);seen.add(id);
    const date=resourceString(entry.date,'考试日期',10),parsed=new Date(date+'T12:00:00');
    if(!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||[parsed.getFullYear(),String(parsed.getMonth()+1).padStart(2,'0'),String(parsed.getDate()).padStart(2,'0')].join('-')!==date)throw new Error('考试日期必须是有效的 YYYY-MM-DD。');
    if(!['written','interview'].includes(entry.stage))throw new Error('考试阶段必须是 written（笔试）或 interview（面试）。');
    const clean={id,schoolId:resourceID(entry.schoolId,'院校 ID'),schoolName:resourceString(entry.schoolName,'院校名称',200),date,stage:entry.stage};
    for(const key of ['startTime','endTime'])if(entry[key]!==undefined){if(typeof entry[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry[key]))throw new Error('考试时间必须是 HH:mm。');clean[key]=entry[key];}
    if(clean.endTime&&(!clean.startTime||clean.endTime<=clean.startTime))throw new Error('考试结束时间必须晚于开始时间。跨日考试请按天拆分记录。');
    for(const [key,max] of [['location',1000],['note',4000]])if(entry[key]!==undefined)clean[key]=resourceString(entry[key],key,max,true);
    return clean;
  })};
}
function parseResource(input) {
  const parsed=resourceParse(input);
  if (['bank','book','quotes','examSchedule'].filter(key=>Object.hasOwn(parsed,key)).length !== 1) throw new Error('JSON 必须且只能包含 bank、book、quotes、examSchedule 中的一种资源。');
  const clean=parsed.bank !== undefined ? validateQuizBank(parsed) : parsed.book !== undefined ? validateClassic(parsed) : parsed.examSchedule!==undefined ? validateExamSchedule(parsed) : validateQuotes(parsed);
  if (clean.bank?.id === 'daily-quotes') throw new Error('daily-quotes 是每日一句专用 ID，不能作为题库 ID。');
  return clean;
}
function validateResourceRecords(records, {allowOfficial = false} = {}) {
  resourceObject(records, '记录');
  validateQuestionUserRecords(records);
  const normalized = Object.create(null), banks = new Map();
  if (Object.hasOwn(records, QUIZ_LIBRARY_KEY)) normalized[QUIZ_LIBRARY_KEY] = validateQuizLibrary(records[QUIZ_LIBRARY_KEY]);
  const officialIDs = new Set([...RESOURCE_BANK_IDS, ...resourceBanks.filter(item => item.origin === 'official').map(item => item.bank.id)]);
  for (const [key, value] of Object.entries(records)) {
    if (!key.startsWith('resource:')) continue;
    const match = /^resource:(official|custom):((?:classic:|schedule:)?[A-Za-z0-9][A-Za-z0-9._-]{0,119})$/.exec(key);
    if (!match || (!allowOfficial && match[1] === 'official')) throw new Error('备份含有不允许的资源记录：' + key);
    const [, origin, id] = match;
    if (value?.origin !== origin) throw new Error('资源来源与记录键不一致：' + key);
    if(id.startsWith('schedule:')&&id!=='schedule:'+EXAM_SCHEDULE_ID)throw new Error('未知的考试日程记录。');
    const clean = id.startsWith('classic:') ? validateClassic(value) : id === 'daily-quotes' ? validateQuotes(value) : id==='schedule:'+EXAM_SCHEDULE_ID ? validateExamSchedule(value) : validateQuizBank(value);
    if (clean.book && id !== 'classic:'+clean.book.id) throw new Error('典籍 ID 与记录键不一致。');
    if (clean.bank) {
      if (clean.bank.id !== id || banks.has(id) || (origin === 'custom' && officialIDs.has(id))) throw new Error('资源 ID 冲突：' + id);
      banks.set(id, origin);
    }
    normalized[key] = {...clean, origin};
  }
  return normalized;
}
async function initializeHomeResources() {
  const embedded=globalThis.QICHENG_RESOURCE_SEEDS;
  const records=Object.create(null), seeds=Object.create(null);
  for(const origin of ['official','custom'])for(const id of ['daily-quotes','schedule:'+EXAM_SCHEDULE_ID]){
    const key='resource:'+origin+':'+id,value=await storage.get(key);if(value)records[key]=value;
  }
  if(!records['resource:official:daily-quotes']||(records['resource:official:daily-quotes'].version==='1.0.0'&&!records['resource:official:daily-quotes'].quotes?.length)){
    const input=embedded?embedded.quotes:await(await resourceFetch('data/resources/daily-quotes.json')).json();
    const clean=validateQuotes(input);
    if(!records['resource:official:daily-quotes']||clean.quotes.length)records['resource:official:daily-quotes']=seeds['resource:official:daily-quotes']={...clean,origin:'official'};
  }
  if(!records['resource:official:schedule:'+EXAM_SCHEDULE_ID]){
    const input=embedded?embedded.examSchedule??{schemaVersion:1,version:'1.0.0',examSchedule:[]}:await(await resourceFetch('data/resources/exam-schedule.json')).json();
    records['resource:official:schedule:'+EXAM_SCHEDULE_ID]=seeds['resource:official:schedule:'+EXAM_SCHEDULE_ID]={...validateExamSchedule(input),origin:'official'};
  }
  if(Object.keys(seeds).length)await storage.setMany(seeds);
  resourceOfficialQuotes=records['resource:official:daily-quotes'];resourceCustomQuotes=records['resource:custom:daily-quotes']||null;
  resourceOfficialSchedule=records['resource:official:schedule:'+EXAM_SCHEDULE_ID];resourceCustomSchedule=records['resource:custom:schedule:'+EXAM_SCHEDULE_ID]||null;
  // Custom classics are needed only when a user chose one for the daily quote.
  const customClassics=await storage.getPrefix('resource:custom:classic:');
  const officialClassics=await storage.getPrefix('resource:official:classic:');
  resourceClassics=Object.values({...officialClassics,...customClassics});
}
async function resourceLoad({metadataOnly=false}={}) {
  await initializeHomeResources();
  const legacy=await storage.getPrefix('resource:');
  const headers=await bankHeaders521(), seeds=Object.create(null), remove=[];
  const existing=new Map(headers.map(header=>[header.bank.id,header]));
  // A one-time, single transaction migration preserves bank IDs and learning keys.
  for(const [key,value] of Object.entries(legacy))if(value?.bank){
    const clean={...validateQuizBank(value),origin:value.origin};
    const delta=bankDelta521(clean,null);Object.assign(seeds,delta.writes);remove.push(key);existing.set(clean.bank.id,{...clean,questionIds:clean.questions.map(q=>q.id)});
  }
  const embedded=globalThis.QICHENG_RESOURCE_SEEDS;
  for(const id of RESOURCE_BANK_IDS)if(!existing.has(id)){
    const input=embedded?embedded.banks?.find(item=>item?.bank?.id===id):await(await resourceFetch('data/resources/'+id+'.json')).json();
    const clean={...validateQuizBank(input),origin:'official'};
    if(clean.bank.id!==id)throw new Error('内置题库 ID 与文件不一致：'+id);
    const delta=bankDelta521(clean,null);Object.assign(seeds,delta.writes);existing.set(id,{...clean,questionIds:clean.questions.map(q=>q.id)});
  }
  if(Object.keys(seeds).length||remove.length)await storage.setMany(seeds,remove);
  quizLibrary=validateQuizLibrary(await storage.get(QUIZ_LIBRARY_KEY)??{schemaVersion:1,banks:[],assignments:{}});
  const ordered=[...RESOURCE_BANK_IDS.map(id=>existing.get(id)),...[...existing.values()].filter(item=>!RESOURCE_BANK_IDS.includes(item.bank.id))];
  resourceBanks=ordered.map(header=>({schemaVersion:1,bank:header.bank,origin:header.origin,questionCount:header.questionIds.length,questionIDs521:new Set(header.questionIds),questions:[],loaded521:false}));
  resourceInitialized=true;
  if(!metadataOnly)await Promise.all(resourceBanks.map(item=>loadBank521(item.bank.id)));
  return getResourceVersions();
}
async function loadBank521(id,refresh=false){
  const item=resourceBanks.find(item=>item.bank.id===id);if(!item)throw new Error('题库已移除：'+id);
  if(item.loaded521&&!refresh)return item;
  if(item.loaded521&&refresh&&item.bankRevision521!==undefined){const key=bankMetaKey521(item.origin,id);await storage.get(key);if(storage.revision(key)===item.bankRevision521)return item;}
  const record=await bankRead521(item.origin,id);if(!record)throw new Error('未找到本地题库：'+id);
  Object.assign(item,record,{questionCount:record.questions.length,questionIDs521:new Set(record.questions.map(q=>q.id)),bankRevision521:record.revision521,loaded521:true});return item;
}
async function loadPracticeBank(id){
  await initializeResources({metadataOnly:true});
  const sourceIDs=[id,...resourceBanks.filter(item=>item.origin==='custom'&&(assignedQuizTarget(item.bank.id)||defaultQuizTarget(item.bank))===id).map(item=>item.bank.id)];
  await Promise.all(sourceIDs.filter(source=>resourceBanks.some(item=>item.bank.id===source)).map(loadBank521));
  return getPracticeBank(id);
}
async function initializeResources({force=false,metadataOnly=false}={}){
  if(force)return reloadResources({metadataOnly});
  if(resourceInitialization)await resourceInitialization;
  else if(!resourceInitialized){resourceInitialization=resourceLoad({metadataOnly}).finally(()=>{resourceInitialization=null;});await resourceInitialization;}
  if(!metadataOnly)await Promise.all(resourceBanks.filter(item=>!item.loaded521).map(item=>loadBank521(item.bank.id)));
  return getResourceVersions();
}
function resourceEnqueue(operation) {
  const pending = resourceWriteChain.then(operation);
  resourceWriteChain = pending.catch(() => {});
  resourcePendingWrites.add(pending);
  pending.then(()=>resourcePendingWrites.delete(pending),()=>resourcePendingWrites.delete(pending));
  return pending;
}
function reloadResources(options={}) { return resourceEnqueue(async () => { if (resourceInitialization) await resourceInitialization; return resourceLoad(options); }); }
async function waitForResourceWrites() { while(resourcePendingWrites.size)await Promise.all([...resourcePendingWrites]); }
function listQuizBanks() { return resourceBanks.map(({loaded521,questionCount,questionIDs521,bankRevision521,...record})=>structuredClone(record)); }
function listPracticeBankSummaries(){
 const collections=resourceBanks.filter(item=>item.origin==='official').map(item=>({schemaVersion:1,bank:structuredClone(item.bank),origin:item.origin,questionCount:item.questionCount??item.questions.length,sourceBankIds:[item.bank.id]}));
 for(const bank of quizLibrary.banks)collections.push({schemaVersion:1,bank:structuredClone(bank),origin:'custom',questionCount:0,sourceBankIds:[bank.id]});
 for(const item of resourceBanks.filter(item=>item.origin==='custom')){const target=collections.find(bank=>bank.bank.id===(assignedQuizTarget(item.bank.id)||defaultQuizTarget(item.bank)));if(target){target.questionCount+=item.questionCount??item.questions.length;target.sourceBankIds.push(item.bank.id);}}
 return collections;
}
function listImportedQuizPackSummaries(){return resourceBanks.filter(item=>item.origin==='custom').map(item=>({schemaVersion:1,bank:structuredClone(item.bank),origin:item.origin,questionCount:item.questionCount??item.questions.length,targetBankId:assignedQuizTarget(item.bank.id)||defaultQuizTarget(item.bank)}));}

function getExamScheduleResource() {return structuredClone(resourceCustomSchedule||resourceOfficialSchedule||{schemaVersion:1,version:'1.0.0',examSchedule:[]});}
function validateQuizLibrary(input) {
  resourceObject(input, '题库目录');
  if (input.schemaVersion !== 1 || !Array.isArray(input.banks) || input.banks.length > 200) throw new Error('题库目录格式无效。');
  const seen = new Set(RESOURCE_BANK_IDS);
  const banks = input.banks.map(bank => {
    const clean = validateQuizBank({schemaVersion:1,bank,questions:[]}).bank;
    if (seen.has(clean.id)) throw new Error('题库目录 ID 重复。');
    seen.add(clean.id); return clean;
  });
  resourceObject(input.assignments, '题目包归属');
  const assignments = Object.create(null);
  for (const [source, target] of Object.entries(input.assignments)) {
    resourceID(source, '题目包 ID'); resourceID(target, '目标题库 ID');
    if (!seen.has(target)) throw new Error('题目包的目标题库不存在。');
    assignments[source] = target;
  }
  return {schemaVersion:1,banks,assignments};
}
function defaultQuizTarget(bank) {
  if(!['english','chinese'].includes(bank.subject))return undefined;
  return RESOURCE_BANK_IDS.find(id => resourceBanks.find(item => item.bank.id === id)?.bank.section === bank.section);
}
function assignedQuizTarget(id, library = quizLibrary) {
  return Object.hasOwn(library.assignments,id) ? library.assignments[id] : undefined;
}
function getPracticeBank(id){
  const summary=listPracticeBankSummaries().find(item=>item.bank.id===id);if(!summary)return null;
  const questions=[];
  for(const sourceID of summary.sourceBankIds){
    const item=resourceBanks.find(item=>item.bank.id===sourceID);if(!item)continue;
    for(const question of item.questions){
      const clean=structuredClone(question);
      if(item.origin==='custom')Object.assign(clean,{id:JSON.stringify([item.bank.id,question.id]),learningBankId:item.bank.id,learningQuestionId:question.id});
      questions.push(clean);
    }
  }
  return {...summary,questions};
}
function listPracticeBanks(){return listPracticeBankSummaries().map(item=>getPracticeBank(item.bank.id));}
function listImportedQuizPacks() {
  return resourceBanks.filter(item => item.origin === 'custom').map(item => ({...structuredClone(item),targetBankId:assignedQuizTarget(item.bank.id) || defaultQuizTarget(item.bank)}));
}
function createPracticeBank({name, subject='custom', section='custom'}) {
  return resourceEnqueue(async () => {
    await initializeResources({metadataOnly:true});
    const id = 'user-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    const bank = validateQuizBank({schemaVersion:1,bank:{id,name:name?.trim(),subject,section,version:'1.0.0'},questions:[]}).bank;
    const next = validateQuizLibrary({...quizLibrary,banks:[...quizLibrary.banks,bank]});
    await storage.set(QUIZ_LIBRARY_KEY,next); quizLibrary = next;
    return structuredClone(bank);
  });
}
function deleteImportedQuizPack(id) {
  return resourceEnqueue(async () => {
    await initializeResources({metadataOnly:true});
    if (!resourceBanks.some(item => item.origin === 'custom' && item.bank.id === id)) throw new Error('未找到这个导入题目包。');
    const next = structuredClone(quizLibrary); delete next.assignments[id];
    const record=resourceBanks.find(item=>item.bank.id===id&&item.origin==='custom');
    await storage.setMany({[QUIZ_LIBRARY_KEY]:next},record?await bankRemoveKeys521(record):[]);
    quizLibrary = next; resourceBanks = resourceBanks.filter(item => !(item.origin === 'custom' && item.bank.id === id));
  });
}
function moveImportedQuizPack(id,targetBankId) {
  return resourceEnqueue(async()=>{
    await initializeResources({metadataOnly:true});
    const pack=listImportedQuizPacks().find(item=>item.bank.id===id);
    if(!pack)throw new Error('未找到这个题目资源包。');
    if(!listPracticeBanks().some(item=>item.bank.id===targetBankId))throw new Error('目标题库不存在。');
    if(pack.targetBankId===targetBankId)return false;
    const next=validateQuizLibrary({...quizLibrary,assignments:{...quizLibrary.assignments,[id]:targetBankId}});
    await storage.set(QUIZ_LIBRARY_KEY,next);quizLibrary=next;return true;
  });
}
function deletePracticeBank(id) {
  return resourceEnqueue(async () => {
    await initializeResources({metadataOnly:true});
    if (!quizLibrary.banks.some(bank => bank.id === id)) throw new Error('默认题库不能删除。');
    const removed = listImportedQuizPacks().filter(item => item.targetBankId === id).map(item => item.bank.id);
    const next = validateQuizLibrary({...quizLibrary,banks:quizLibrary.banks.filter(bank => bank.id !== id),assignments:Object.fromEntries(Object.entries(quizLibrary.assignments).filter(([source,target]) => target !== id && !removed.includes(source)))});
    const removeKeys=(await Promise.all(resourceBanks.filter(item=>removed.includes(item.bank.id)).map(bankRemoveKeys521))).flat();
    await storage.setMany({[QUIZ_LIBRARY_KEY]:next},removeKeys);
    quizLibrary = next; resourceBanks = resourceBanks.filter(item => !removed.includes(item.bank.id));
  });
}
function getQuotesResource() { return structuredClone(resourceCustomQuotes || resourceOfficialQuotes); }
function getClassicBooks() {
  const books=new Map(CLASSICS.books.map(book=>[book.id, {...book,version:CLASSICS.version,origin:'bundled'}]));
  for (const origin of ['official','custom']) for (const item of resourceClassics.filter(r=>r.origin===origin)) books.set(item.book.id,{...item.book,passages:item.passages,origin});
  return structuredClone([...books.values()]);
}
function getResourceVersions() {
  const quotes = resourceCustomQuotes || resourceOfficialQuotes;
  const schedule=resourceCustomSchedule||resourceOfficialSchedule;
  return {banks:resourceBanks.map(item => ({...item.bank, updatedAt:item.bank.updatedAt||(item.origin!=='custom'&&RESOURCE_BANK_IDS.includes(item.bank.id)&&item.bank.version==='1.0.0'?RESOURCE_DEFAULT_UPDATED_AT52:''), origin:item.origin, questionCount:item.questionCount??item.questions.length})), classics:getClassicBooks().map(book=>({id:book.id,title:book.title,version:book.version,origin:book.origin})), quotes:quotes ? {id:'daily-quotes',version:quotes.version,origin:quotes.origin,count:quotes.quotes.length} : null,examSchedule:{id:EXAM_SCHEDULE_ID,version:schedule?.version||'1.0.0',origin:schedule?.origin||'bundled',count:schedule?.examSchedule.length||0}};
}
const preparedResourcePlans521=new WeakMap();
const resourceYield521=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():typeof MessageChannel!=='undefined'?new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);}):new Promise(resolve=>setTimeout(resolve,0));
async function validateQuizBankAsync521(input,task){
  const data=resourceParse(input),header=validateQuizBank({...data,questions:[]}),questions=[],seen=new Set();
  if(!Array.isArray(data.questions)||data.questions.length>20000)throw new Error('questions 必须是最多 20000 项的数组。');
  for(let offset=0;offset<data.questions.length;offset+=200){
    const chunk=validateQuizBank({...data,questions:data.questions.slice(offset,offset+200)}).questions;
    for(const q of chunk){if(seen.has(q.id))throw new Error('题目 ID 重复：'+q.id);seen.add(q.id);questions.push(q);}
    task?.stage('验证数据',{done:questions.length,total:data.questions.length});await resourceYield521();
  }
  return {...header,questions};
}
function resourceChanges521(before,after){
  const old=new Map((before?.questions||[]).map(q=>[q.id,q]));
  let added=0,changed=0,unchanged=0,answerChanged=0,duplicateContent=0;
  const contents=new Set();
  for(const q of after.questions){
    const identity=JSON.stringify([q.type,q.question.trim(),q.options||null]);
    if(contents.has(identity))duplicateContent++;contents.add(identity);
    const previous=old.get(q.id);
    if(!previous)added++;else if(JSON.stringify(previous)===JSON.stringify(q))unchanged++;else{changed++;if(previous.answer!==q.answer||previous.type!==q.type||JSON.stringify(previous.options)!==JSON.stringify(q.options))answerChanged++;}
    old.delete(q.id);
  }
  return {added,changed,unchanged,removed:old.size,answerChanged,duplicateContent,total:after.questions.length};
}
function resourceImportSummary(plan){
  const s=plan.summary;
  if(!s)return '资源已校验。';
  return '新增 '+s.added+'，修改 '+s.changed+'，未变 '+s.unchanged+'，移除 '+s.removed+' 道；答案或选项变更 '+s.answerChanged+' 道；重复内容 '+s.duplicateContent+' 道。历史成绩保留原题快照，错题、收藏和笔记保留稳定 ID。移除的题目不再进入新练习。';
}
async function prepareResourceImport(input,options={}){
  const task=options.task||tasks.start('题库导入预检');
  try{
    task.stage('解析 JSON');const parsed=resourceParse(input);await resourceYield521();
    await initializeResources({metadataOnly:true});
    let clean,origin='custom',isPatch=!!parsed.patch,patchRevision521,localWrites521={},localRemovals53=[];
    if(!isPatch&&['bank','book','quotes','examSchedule'].filter(key=>Object.hasOwn(parsed,key)).length!==1)throw new Error('JSON 必须且只能包含一种资源。');
    if(isPatch){
      if(parsed.schemaVersion!==1||Object.keys(parsed).some(key=>!['schemaVersion','patch'].includes(key)))throw new Error('补丁需 schemaVersion:1 和唯一 patch 对象。');
      const patch=resourceObject(parsed.patch,'patch'),id=resourceID(patch.bankId,'补丁题库 ID');
      const existing=resourceBanks.find(item=>item.bank.id===id);if(!existing)throw new Error('补丁题库不存在：'+id);
      const base=await loadBank521(id,true);origin=base.origin;patchRevision521=base.bankRevision521;
      if(patch.baseVersion!==undefined&&patch.baseVersion!==base.bank.version)throw new Error('补丁基础版本与已安装题库不符，请重新生成。');
      if(!Array.isArray(patch.questions)||patch.questions.length>20000)throw new Error('补丁 questions 必须是最多 20000 项的数组。');
      const questionMap=new Map(base.questions.map(q=>[q.id,structuredClone(q)])),seen=new Set();
      for(let index=0;index<patch.questions.length;index++){
        const entry=resourceObject(patch.questions[index],'题目补丁'),qid=resourceID(entry.id,'题目 ID');
        if(Object.keys(entry).some(key=>!['id','set'].includes(key))||seen.has(qid))throw new Error('重复或无效的题目补丁：'+qid);seen.add(qid);
        if(!questionMap.has(qid))throw new Error('补丁不能隐式新增题目：'+qid);
        const fields=resourceObject(entry.set,'set');if(!Object.keys(fields).length||Object.keys(fields).some(key=>!['question','explanation','answer','options','source','category','tags'].includes(key)))throw new Error('补丁仅允许修改 question/explanation/answer/options/source 字段。');
        questionMap.set(qid,{...questionMap.get(qid),...structuredClone(fields)});
        if(index%200===0){task.stage('验证补丁字段',{done:index,total:patch.questions.length});await resourceYield521();}
      }
      if(patch.deleteIds!==undefined){if(!Array.isArray(patch.deleteIds)||new Set(patch.deleteIds).size!==patch.deleteIds.length)throw new Error('deleteIds 必须为不重复的题目 ID 数组。');for(const qid of patch.deleteIds){resourceID(qid,'删除题目 ID');if(seen.has(qid)||!questionMap.delete(qid))throw new Error('删除题目不存在或同时被修改：'+qid);}}
      if(Object.keys(patch).some(key=>!['bankId','baseVersion','version','questions','deleteIds'].includes(key)))throw new Error('补丁包含未知字段。');
      clean=await validateQuizBankAsync521({schemaVersion:1,bank:{...base.bank,...(patch.version?{version:patch.version}:{})},questions:[...questionMap.values()]},task);
    }else{
      clean=parsed.bank?await validateQuizBankAsync521(parsed,task):parseResource(parsed);
      if(clean.bank&&(options.targetBankId||options.newBankName)&&RESOURCE_BANK_IDS.includes(clean.bank.id))clean.bank.id='local-pack-'+clean.bank.id;
    }
    const id=clean.book?'classic:'+clean.book.id:clean.bank?.id||(clean.examSchedule?'schedule:'+EXAM_SCHEDULE_ID:'daily-quotes');
    const existing=clean.bank?resourceBanks.find(item=>item.bank.id===id):null;
    if(!isPatch&&existing?.origin==='official')throw new Error('题库 ID 已被官方题库使用，请为自定义题库使用新的 ID。');
    if(existing&&(existing.bank.subject!==clean.bank.subject||existing.bank.section!==clean.bank.section))throw new Error('替换自定义题库不能改变所属科目或章节。');
    const before=existing?await loadBank521(id,!isPatch):null;
    const metaKey=clean.bank?bankMetaKey521(origin,id):'resource:'+origin+':'+id;
    if(!existing){const disk=await storage.get(metaKey);if(disk?.bank)throw new Error('题库已在其他窗口创建，请重新载入后预检。');}const revision=isPatch?patchRevision521:before?.bankRevision521??storage.revision?.(metaKey);
    if(options.mode!==undefined&&!['replace','append'].includes(options.mode))throw new Error('不支持的导入模式。');
    if(clean.bank&&before&&options.mode==='append'){const merged=new Map(before.questions.map(q=>[q.id,q]));for(const q of clean.questions)merged.set(q.id,q);clean={...clean,questions:[...merged.values()]};}
    if(clean.bank&&before&&options.mode==='append'){const oldIDs=new Set(before.questions.map(q=>q.id));for(const q of clean.questions)if(!oldIDs.has(q.id)){const key=questionEditKey521(origin,id,q.id);localWrites521[key]={schemaVersion:1,origin,bankId:id,questionId:q.id,kind:'created',base:null,baseVersion:before.bank.version,updatedAt:new Date().toISOString()};}}
    if(options.resolveLocalConflicts!==undefined&&options.resolveLocalConflicts!=='incoming')throw new Error('冲突处理选项无效。');
    if(clean.bank&&before&&!isPatch){clean=await protectQuestionEdits521(clean,before,{takeIncoming:options.resolveLocalConflicts==='incoming'});localRemovals53=clean.resolvedEditKeys53;}
    if(isPatch){const next=new Map(clean.questions.map(q=>[q.id,q]));for(const qid of [...parsed.patch.questions.map(q=>q.id),...(parsed.patch.deleteIds||[])]){const old=before.questions.find(q=>q.id===qid),value=next.get(qid);if(JSON.stringify(old)===JSON.stringify(value))continue;const key=questionEditKey521(origin,id,qid),prior=await storage.get(key);localWrites521[key]={schemaVersion:1,origin,bankId:id,questionId:qid,kind:!value?'deleted':prior?.kind==='created'?'created':'modified',base:prior?prior.base:old??null,baseVersion:prior?.baseVersion??before.bank.version,updatedAt:new Date().toISOString()};}}
    task.stage('检测重复与冲突');const summary=clean.bank?resourceChanges521(before,clean):null;
    const plan=Object.freeze({id,name:clean.bank?.name||clean.book?.title||id,summary:summary?Object.freeze(summary):null,isPatch});
    preparedResourcePlans521.set(plan,{clean:structuredClone(clean),origin,options:{targetBankId:options.targetBankId,newBankName:options.newBankName},revision,metaKey,task,localWrites521,localRemovals53});
    task.succeed(summary?'已预检 '+summary.total+' 道，等待确认；尚未写入数据库。':'资源已预检，等待确认。');return plan;
  }catch(error){task.fail(error);throw error;}
}
function applyPreparedResourceImport(plan){
  const prepared=preparedResourcePlans521.get(plan);if(!prepared)return Promise.reject(new Error('导入预检已失效，请重新选择文件。'));
  return resourceEnqueue(async()=>{
    const task=tasks.start(plan.isPatch?'题库补丁更新':'题库导入');
    try{
      const {clean,origin,metaKey,revision,options,localWrites521,localRemovals53}=prepared;let {targetBankId,newBankName}=options;
      const existing=clean.bank?resourceBanks.find(item=>item.bank.id===clean.bank.id):null;
      const before=existing?await loadBank521(clean.bank.id):null;
      const record={...structuredClone(clean),origin},next=structuredClone(quizLibrary);
      if(clean.bank&&!plan.isPatch){
        if(newBankName!==undefined){
          if(targetBankId)throw new Error('请选择已有题库或新建题库，不能同时指定。');
          const bank=validateQuizBank({schemaVersion:1,bank:{id:'user-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name:typeof newBankName==='string'?newBankName.trim():newBankName,subject:'custom',section:'custom',version:'1.0.0'},questions:[]}).bank;
          next.banks.push(bank);targetBankId=bank.id;
        }
        const target=targetBankId||assignedQuizTarget(clean.bank.id,next)||defaultQuizTarget(clean.bank);
        if(!listPracticeBankSummaries().some(item=>item.bank.id===target)&&!next.banks.some(item=>item.id===target))throw new Error('请选择一个现有题库，或先新建题库。');
        next.assignments[clean.bank.id]=target;
      }
      const library=clean.bank?validateQuizLibrary(next):next;
      let writes=Object.create(null),removals=[];
      if(clean.bank){const delta=bankDelta521(record,before);writes=delta.writes;removals=delta.removals;if(JSON.stringify(library)!==JSON.stringify(quizLibrary))writes[QUIZ_LIBRARY_KEY]=library;}
      else writes[metaKey]=record;
      Object.assign(writes,localWrites521);removals.push(...(localRemovals53||[]));
      task.stage('写入数据库 · 等待事务提交',{done:0,total:Object.keys(writes).length+removals.length});
      // The metadata guard covers even updates to different question rows.
      if(Object.keys(writes).length||removals.length)await storage.setMany(writes,removals,{bankDelta:!!clean.bank,expected:revision===undefined?{}:{[metaKey]:revision}});
      else if(revision!==undefined){await storage.get(metaKey);if(storage.revision(metaKey)!==revision)throw new Error('题库已被其他窗口修改，请重新预检。');}
      if(clean.bank){quizLibrary=library;const item={...record,bankRevision521:storage.revision?.(metaKey),questionCount:record.questions.length,questionIDs521:new Set(record.questions.map(q=>q.id)),loaded521:true};resourceBanks=existing?resourceBanks.map(old=>old.bank.id===clean.bank.id?item:old):[...resourceBanks,item];}
      else if(clean.book)resourceClassics=[...resourceClassics.filter(item=>!(item.origin===origin&&item.book.id===clean.book.id)),record];
      else if(clean.examSchedule){if(origin==='official')resourceOfficialSchedule=record;else resourceCustomSchedule=record;}
      else {if(origin==='official')resourceOfficialQuotes=record;else resourceCustomQuotes=record;}
      preparedResourcePlans521.delete(plan);task.succeed(clean.bank?'事务已提交。'+resourceImportSummary(plan):'资源已提交到本机数据库。');return structuredClone(record);
    }catch(error){task.fail(error);throw error;}
  });
}
async function importResourceJSON(input,options={}){return applyPreparedResourceImport(await prepareResourceImport(input,options));}
function resourceSafeURL(value, base) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('资源 URL 无效。');
  const url = new URL(value, base);
  const local = url.origin === APP_BASE.origin && ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.hash) throw new Error('资源 URL 必须使用 HTTPS（本机同源测试可使用 HTTP）。');
  return url;
}
async function resourceDownload(url) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url.href, {cache:'no-store', signal:controller.signal, redirect:'error', credentials:'omit'});
    if (!response.ok) throw new Error('资源下载失败：' + response.status);
    if (Number(response.headers?.get('content-length')) > RESOURCE_MAX_BYTES) throw new Error('资源文件超过 12 MB。');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > RESOURCE_MAX_BYTES) throw new Error('资源文件超过 12 MB。');
    return bytes;
  } finally { clearTimeout(timeout); }
}
async function resourceDigest(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('当前浏览器无法校验资源，请使用 HTTPS 或导入本地资源文件。');
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2,'0')).join('');
}
function updateResources(manifestURL = 'data/resources/manifest.json', {confirm}={}) {
  return resourceEnqueue(async () => {
    const task=tasks.start('题库批量更新');
    try {
    task.stage('读取资源更新清单');
    await initializeResources({metadataOnly:true});
    const url = resourceSafeURL(manifestURL, APP_BASE);
    const manifest = resourceParse(new TextDecoder('utf-8', {fatal:true}).decode(await resourceDownload(url)));
    if (manifest.schemaVersion !== RESOURCE_SCHEMA_VERSION || !Array.isArray(manifest.resources) || manifest.resources.length > 100) throw new Error('资源清单格式无效。');
    const seen = new Set(), pending = [];
    for (const entry of manifest.resources) {
      resourceObject(entry, '资源清单项'); const id = resourceID(entry.id, '资源 ID'); resourceVersion(entry.version);
      const identity=entry.type+':'+id;
      if (seen.has(identity)) throw new Error('资源清单 ID 重复：' + id); seen.add(identity);
      if (!['quiz-bank','quotes','classic','exam-schedule'].includes(entry.type) || (entry.type==='quotes'&&id!=='daily-quotes') || (entry.type==='exam-schedule'&&id!==EXAM_SCHEDULE_ID) || (entry.type==='quiz-bank'&&id==='daily-quotes')) throw new Error('资源类型与 ID 不一致。');
      if (typeof entry.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(entry.sha256)) throw new Error('资源缺少有效 SHA-256。');
      const downloadURL = resourceSafeURL(entry.url, url);
      const existing = entry.type==='exam-schedule' ? resourceOfficialSchedule : entry.type === 'quotes' ? resourceOfficialQuotes : entry.type === 'classic' ? resourceClassics.find(item=>item.origin==='official' && item.book.id===id) : resourceBanks.find(item => item.bank.id === id);
      if (existing?.origin === 'custom') throw new Error('更新与自定义题库 ID 冲突：' + id);
      if (!existing || compareResourceVersions(entry.version, existing.bank?.version || existing.book?.version || existing.version) > 0) pending.push({...entry, downloadURL});
    }
    const records = Object.create(null), changed = [], removals=[], expected={}, summaries=[];
    // Validate every download before starting the single database transaction.
    for (const [entryIndex,entry] of pending.entries()) {
      task.stage('下载并校验资源',{done:entryIndex,total:pending.length});
      const bytes = await resourceDownload(entry.downloadURL);
      if (await resourceDigest(bytes) !== entry.sha256.toLowerCase()) throw new Error('资源 SHA-256 校验失败：' + entry.id);
      const parsed = resourceParse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
      const clean = entry.type === 'quiz-bank' ? await validateQuizBankAsync521(parsed,task) : entry.type === 'classic' ? validateClassic(parsed) : entry.type==='exam-schedule' ? validateExamSchedule(parsed) : validateQuotes(parsed);
      if ((clean.bank?.id || clean.book?.id || (clean.examSchedule?EXAM_SCHEDULE_ID:'daily-quotes')) !== entry.id || (clean.bank?.version || clean.book?.version || clean.version) !== entry.version) throw new Error('资源 ID 或版本与清单不一致：' + entry.id);
      const existing = resourceBanks.find(item => item.bank.id === entry.id);
      if (clean.bank && existing && (existing.bank.subject !== clean.bank.subject || existing.bank.section !== clean.bank.section)) throw new Error('资源更新不能改变题库所属科目或章节。');
      if(clean.bank&&!clean.bank.updatedAt){
        if(entry.updatedAt!==undefined&&(typeof entry.updatedAt!=='string'||!Number.isFinite(Date.parse(entry.updatedAt))))throw new Error('资源清单的更新时间无效：'+entry.id);
        clean.bank.updatedAt=entry.updatedAt?new Date(entry.updatedAt).toISOString():new Date().toISOString();
      }
      let record = {...clean, origin:'official'};
      if(clean.bank){
        const before=existing?await loadBank521(entry.id,true):null;
        if(before)record=await protectQuestionEdits521(record,before);
        const delta=bankDelta521(record,before);
        Object.assign(records,delta.writes);removals.push(...delta.removals);
        if(storage.revision)expected[delta.key]=before?.bankRevision521??storage.revision(delta.key);
        summaries.push({id:entry.id,...resourceChanges521(before,record)});
      }else records['resource:official:' + (clean.book?'classic:':clean.examSchedule?'schedule:':'') + entry.id] = record;
      changed.push(record);
      task.stage('下载并校验资源',{done:entryIndex+1,total:pending.length});
    }
    if (changed.length) {
      if(confirm&&!await confirm(summaries)){task.succeed('已取消更新，原题库已保留。');return {updated:[],cancelled:true,versions:getResourceVersions()};}
      task.stage('写入数据库 · 等待事务提交',{done:0,total:Object.keys(records).length+removals.length});
      await storage.setMany(records,removals,{expected});
      const nextBanks = new Map(resourceBanks.map(item => [item.bank.id, item]));
      for (const item of changed) {
        if (item.bank) nextBanks.set(item.bank.id,{...item,questionCount:item.questions.length,questionIDs521:new Set(item.questions.map(q=>q.id)),loaded521:true});
        else if (item.book) resourceClassics=[...resourceClassics.filter(r=>!(r.origin==='official' && r.book.id===item.book.id)),item];
        else if(item.examSchedule)resourceOfficialSchedule=item;
        else resourceOfficialQuotes = item;
      }
      resourceBanks = [...nextBanks.values()];
    }
    task.succeed(changed.length?'全部资源事务已提交。':'已安装资源均为最新版本。');
    return {updated:changed.map(item => item.bank?.id || item.book?.id || (item.examSchedule?EXAM_SCHEDULE_ID:'daily-quotes')), summaries, versions:getResourceVersions()};
    }catch(error){task.fail(error);throw error;}
  });
}

export { RESOURCE_SCHEMA_VERSION, RESOURCE_BANK_IDS, RESOURCE_SECTIONS, validateQuizBank, validateQuotes, validateClassic, validateResourceRecords, compareResourceVersions, initializeResources, reloadResources, listQuizBanks, getClassicBooks, getQuotesResource, getResourceVersions, importResourceJSON, updateResources, waitForResourceWrites };
export { QUIZ_LIBRARY_KEY, validateQuizLibrary, listPracticeBanks, listImportedQuizPacks, createPracticeBank, deletePracticeBank, deleteImportedQuizPack,moveImportedQuizPack };
export {validateExamSchedule,getExamScheduleResource,EXAM_SCHEDULE_ID};

export {getPracticeBank,initializeHomeResources,loadPracticeBank,listPracticeBankSummaries,listImportedQuizPackSummaries,prepareResourceImport,applyPreparedResourceImport,resourceImportSummary,exportBankRecords};

function countPracticeMarks(id,field,marks){const sources=listPracticeBankSummaries().find(item=>item.bank.id===id)?.sourceBankIds||[];return marks.filter(mark=>sources.includes(mark.bankId)&&mark[field]&&resourceBanks.find(item=>item.bank.id===mark.bankId)?.questionIDs521?.has(mark.questionId)).length;}
export {countPracticeMarks};

async function loadPracticeSample(id,{size=10,mode='random',marks=[],random=Math.random}={}){
  await initializeResources({metadataOnly:true});
  const summary=listPracticeBankSummaries().find(item=>item.bank.id===id);if(!summary)throw new Error('题库已移除，请重新选择。');
  const marked=new Set(marks.filter(mark=>mark[mode==='wrong'?'wrong':'favorite']).map(mark=>JSON.stringify([mark.bankId,mark.questionId])));
  const identities=[],headers=[];
  for(const source of summary.sourceBankIds){
    const item=resourceBanks.find(item=>item.bank.id===source);if(!item)continue;
    const key=bankMetaKey521(item.origin,source),header=await storage.get(key);if(!header)throw new Error('题库已在其他窗口移除，请重新载入。');
    headers.push({key,revision:storage.revision?.(key)});
    for(const qid of header.questionIds)if(mode==='random'||marked.has(JSON.stringify([source,qid])))identities.push({origin:item.origin,source,qid});
  }
  // Only lightweight IDs are shuffled. Read and retain at most the requested group.
  for(let index=0;index<Math.min(size,identities.length);index++){
    const other=index+Math.floor(random()*(identities.length-index));[identities[index],identities[other]]=[identities[other],identities[index]];
  }
  const questions=await Promise.all(identities.slice(0,size).map(async({origin,source,qid})=>{
    const question=await storage.get(bankQuestionKey521(origin,source,qid));if(!question)throw new Error('题目已在其他窗口修改，请重新载入题库。');
    return origin==='custom'?{...question,id:JSON.stringify([source,qid]),learningBankId:source,learningQuestionId:qid}:question;
  }));
  for(const header of headers)if(header.revision!==undefined){await storage.get(header.key);if(storage.revision(header.key)!==header.revision)throw new Error('准备练习时题库已在其他窗口更新，请重试。');}
  return {...summary,questions};
}
export {loadPracticeSample};

// Public question identities are always source pack IDs, never the presentation-bank ID.
const QUESTION_EDIT_PREFIX521='question:edit:',QUESTION_NOTE_PREFIX521='question:note:';
const questionEditKey521=(origin,bankId,id)=>QUESTION_EDIT_PREFIX521+origin+':'+bankId+'/'+id;
const questionNoteKey521=(bankId,id)=>QUESTION_NOTE_PREFIX521+bankId+'/'+id;
class QuestionUpdateConflict extends Error{constructor(conflicts){super('题库更新与本地修改冲突，未写入任何题目。');this.name='QuestionUpdateConflict';this.code='QUESTION_UPDATE_CONFLICT';this.conflicts=structuredClone(conflicts);}}
function questionClean521(bank,q){return validateQuizBank({schemaVersion:1,bank,questions:[q]}).questions[0];}
function validateQuestionUserRecords(records){
 for(const [key,value]of Object.entries(records)){
  if(!key.startsWith(QUESTION_EDIT_PREFIX521)&&!key.startsWith(QUESTION_NOTE_PREFIX521))continue;
  resourceObject(value,'题目用户记录');resourceID(value.bankId,'来源题包ID');resourceID(value.questionId,'题目ID');
  if(value.schemaVersion!==1||!Number.isFinite(Date.parse(value.updatedAt)))throw new Error('题目用户记录版本或时间无效。');
  if(key.startsWith(QUESTION_NOTE_PREFIX521)){if(key!==questionNoteKey521(value.bankId,value.questionId)||typeof value.text!=='string'||value.text.length>64000)throw new Error('题目批注格式无效。');}
  else{if(!['official','custom'].includes(value.origin)||key!==questionEditKey521(value.origin,value.bankId,value.questionId)||!['created','modified','deleted'].includes(value.kind))throw new Error('题目修改来源无效。');if(value.base!==null){const q=questionClean521({id:value.bankId,name:'Source',subject:'custom',section:'custom',version:'1.0.0'},value.base);if(q.id!==value.questionId)throw new Error('题目修改基线ID不符。');}}
 }
}
async function protectQuestionEdits521(incoming,before,{takeIncoming=false}={}){
 const edits=Object.values(await storage.getPrefix(QUESTION_EDIT_PREFIX521+before.origin+':'+before.bank.id+'/'));
 if(!edits.length)return incoming;
 validateQuestionUserRecords(Object.fromEntries(edits.map(e=>[questionEditKey521(e.origin,e.bankId,e.questionId),e])));
 const current=new Map(before.questions.map(q=>[q.id,q])),next=new Map(incoming.questions.map(q=>[q.id,q])),conflicts=[];
 for(const edit of edits){const remote=next.get(edit.questionId),local=current.get(edit.questionId),same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
  if(edit.kind==='created'&&!remote){if(local)next.set(edit.questionId,local);continue;}
  if(same(remote,edit.base)||same(remote,local)){if(local&&edit.kind!=='deleted')next.set(edit.questionId,local);else next.delete(edit.questionId);continue;}
  conflicts.push({bankId:before.bank.id,questionId:edit.questionId,kind:edit.kind,base:edit.base,local:local??null,incoming:remote??null});
 }
 if(conflicts.length&&!takeIncoming)throw new QuestionUpdateConflict(conflicts);
 const result={...incoming,questions:[...next.values()]};Object.defineProperty(result,'resolvedEditKeys53',{value:takeIncoming?conflicts.map(c=>questionEditKey521(before.origin,c.bankId,c.questionId)):[]});return result;
}
async function questionHeader521(bankId){
 resourceID(bankId,'来源题包ID');await initializeResources({metadataOnly:true});const item=resourceBanks.find(b=>b.bank.id===bankId);if(!item)throw new Error('来源题包不存在。请使用源题包ID，展示题库可先建立手动题包。');
 const key=bankMetaKey521(item.origin,bankId),header=await storage.get(key);if(!header)throw new Error('题包已移除。');return {key,header,revision:storage.revision(key),origin:item.origin};
}
async function readQuestion(bankId,questionId){
 resourceID(questionId,'题目ID');const h=await questionHeader521(bankId);
 const question=await storage.get(bankQuestionKey521(h.origin,bankId,questionId)),local=await storage.get(questionEditKey521(h.origin,bankId,questionId));
 await storage.get(h.key);if(storage.revision(h.key)!==h.revision)throw new Error('读取期间题库已变化，请重试。');
 return {bankId,questionId,origin:h.origin,question:question??null,local:local??null,revision:h.revision,deleted:!question};
}
function mutateQuestion521(bankId,id,fields,mode,options={}){return resourceEnqueue(async()=>{
 resourceID(id,'题目ID');const h=await questionHeader521(bankId);
 if(mode!=='create'&&options.expectedRevision===undefined)throw new Error('修改或删除必须提供读取时的expectedRevision。');
 if(options.expectedRevision!==undefined&&options.expectedRevision!==h.revision)throw new Error('题库已变化，拒绝覆盖旧编辑。');
 const key=bankQuestionKey521(h.origin,bankId,id),editKey=questionEditKey521(h.origin,bankId,id),old=await storage.get(key),edit=await storage.get(editKey);
 if(mode==='create'&&(old||edit))throw new Error('题目ID已存在或已被保留，请使用新ID。');if(mode!=='create'&&!old)throw new Error('题目已删除或不存在。');
 if(mode==='update'&&(Object.keys(fields).some(k=>!['question','type','options','answer','explanation','source','category','tags'].includes(k))))throw new Error('单题修改包含不允许的字段。');
 const next=mode==='delete'?null:questionClean521(h.header.bank,mode==='create'?{...fields,id}:{...old,...fields,id});
 if(next&&JSON.stringify(next)===JSON.stringify(old))return {bankId,questionId:id,question:next,revision:h.revision,unchanged:true};
 const local={schemaVersion:1,origin:h.origin,bankId,questionId:id,kind:mode==='delete'?'deleted':edit?.kind==='created'||mode==='create'?'created':'modified',base:edit?edit.base:old??null,baseVersion:edit?.baseVersion??h.header.bank.version,updatedAt:new Date().toISOString()};
 const ids=mode==='create'?[...h.header.questionIds,id]:mode==='delete'?h.header.questionIds.filter(q=>q!==id):h.header.questionIds;
 const header={...h.header,questionIds:ids,contentRevision:crypto.randomUUID()},writes={[h.key]:header,[editKey]:local},remove=[];if(next)writes[key]=next;else remove.push(key);
 await storage.setMany(writes,remove,{bankDelta:true,expected:{[h.key]:h.revision}});
 const item=resourceBanks.find(b=>b.bank.id===bankId);Object.assign(item,{bank:header.bank,questions:[],questionCount:ids.length,questionIDs521:new Set(ids),loaded521:false,bankRevision521:storage.revision(h.key)});
 return {bankId,questionId:id,question:next,local,revision:storage.revision(h.key)};
});}
function createQuestion(bankId,question,options={}){const id=question.id||crypto.randomUUID();return mutateQuestion521(bankId,id,question,'create',options);}
function updateQuestion(bankId,id,fields,options={}){return mutateQuestion521(bankId,id,fields,'update',options);}
function deleteQuestion(bankId,id,options={}){return mutateQuestion521(bankId,id,{},'delete',options);}
async function queryQuestions(bankId,{offset=0,limit=50,keyword='',type='',category='',expectedRevision}={}){
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>200||typeof keyword!=='string'||keyword.length>200||typeof category!=='string'||category.length>200)throw new Error('分页或筛选参数无效。');
 const h=await questionHeader521(bankId);if(expectedRevision!==undefined&&h.revision!==expectedRevision)throw new Error('分页期间题库已变化，请从头查询。');const items=[];let cursor=offset;const term=keyword.toLocaleLowerCase();
 while(cursor<h.header.questionIds.length&&items.length<limit){const ids=h.header.questionIds.slice(cursor,cursor+((term||type||category)?100:Math.min(100,limit-items.length)));const rows=await storage.readMany(ids.map(id=>bankQuestionKey521(h.origin,bankId,id)));for(const q of rows){cursor++;if(!q)throw new Error('题目读取期间已变化。');if((!category||q.category===category)&&(!type||q.type===type)&&(!term||[q.question,q.explanation,q.source,q.category,...(q.tags||[]),...(q.options||[]).map(o=>o.text)].join(' ').toLocaleLowerCase().includes(term)))items.push(q);if(items.length===limit)break;}if(term||type||category)await resourceYield521();}

 await storage.get(h.key);if(storage.revision(h.key)!==h.revision)throw new Error('查询期间题库已变化，请重试。');return {items,nextOffset:cursor<h.header.questionIds.length?cursor:null,revision:h.revision,total:h.header.questionIds.length};
}
async function saveQuestionNote(bankId,id,text,{expectedRevision}={}){
 resourceID(bankId,'来源题包ID');resourceID(id,'题目ID');if(typeof text!=='string'||text.length>64000)throw new Error('批注最多64000字符。');const key=questionNoteKey521(bankId,id);
 // Capture the caller token explicitly; reading metadata must not bypass stale-edit checks.
 if(expectedRevision===undefined)throw new Error('保存批注必须提供读取时的revision。');
 const value={schemaVersion:1,bankId,questionId:id,text,updatedAt:new Date().toISOString()};await storage.setMany({[key]:value},[],{expected:{[key]:expectedRevision}});return {note:value,revision:storage.revision(key)};
}
async function getQuestionLearning(bankId,id){resourceID(bankId,'来源题包ID');resourceID(id,'题目ID');const key=questionNoteKey521(bankId,id),note=await storage.get(key),revision=storage.revision(key),mark=await storage.get('quiz:mark:'+encodeURIComponent(bankId)+'/'+encodeURIComponent(id));return {note:note??null,noteRevision:revision,mark:mark??{bankId,questionId:id,wrong:false,favorite:false}};}
async function exportQuestionBank(bankId){const h=await questionHeader521(bankId);const data=await bankRead521(h.origin,bankId);return {schemaVersion:1,bank:data.bank,questions:data.questions};}
async function ensureManualQuestionPack(practiceBankId){await initializeResources({metadataOnly:true});const bank=listPracticeBankSummaries().find(b=>b.bank.id===practiceBankId);if(!bank)throw new Error('展示题库不存在。');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(practiceBankId)),id='manual-'+[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');const disk=await storage.get(bankMetaKey521('custom',id));if(disk){await reloadResources({metadataOnly:true});return id;}await importResourceJSON({schemaVersion:1,bank:{id,name:'手动题目 · '+bank.bank.name,subject:'custom',section:'custom',version:'1.0.0'},questions:[]},{targetBankId:practiceBankId});return id;}
async function appendQuestions(bankId,questions){const h=await questionHeader521(bankId);return importResourceJSON({schemaVersion:1,bank:h.header.bank,questions},{mode:'append'});}
function resetQuestionLocalChange(bankId,id,{expectedRevision}={}){return resourceEnqueue(async()=>{
 const h=await questionHeader521(bankId);if(expectedRevision===undefined||expectedRevision!==h.revision)throw new Error('重置需要当前expectedRevision。');resourceID(id,'题目ID');const key=questionEditKey521(h.origin,bankId,id),edit=await storage.get(key);if(!edit)return false;
 const qkey=bankQuestionKey521(h.origin,bankId,id),ids=h.header.questionIds.filter(v=>v!==id);if(edit.base)ids.push(id);const writes={[h.key]:{...h.header,questionIds:ids,contentRevision:crypto.randomUUID()}},remove=[key];if(edit.base)writes[qkey]=edit.base;else remove.push(qkey);
 await storage.setMany(writes,remove,{bankDelta:true,expected:{[h.key]:h.revision}});const item=resourceBanks.find(b=>b.bank.id===bankId);Object.assign(item,{questions:[],questionCount:ids.length,questionIDs521:new Set(ids),loaded521:false});return true;
});}

export {appendQuestions,resetQuestionLocalChange,readQuestion,createQuestion,updateQuestion,deleteQuestion,queryQuestions,saveQuestionNote,getQuestionLearning,exportQuestionBank,ensureManualQuestionPack,QuestionUpdateConflict,validateQuestionUserRecords};

