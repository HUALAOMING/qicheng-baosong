import { storage } from './storage.js';
import { APP_BASE, CLASSICS, resourceFetch } from './data.js';

// Resource content is independent from personal learning records and application releases.
const RESOURCE_SCHEMA_VERSION = 1;
const RESOURCE_BANK_IDS = ['english-grammar', 'english-vocabulary', 'chinese-ancient-culture', 'chinese-usage'];
const RESOURCE_SECTIONS = {english:['grammar','vocabulary'], chinese:['ancient-culture','chinese-usage']};
const RESOURCE_MAX_BYTES = 12 * 1024 * 1024;
let resourceBanks = [], resourceOfficialQuotes = null, resourceCustomQuotes = null;
let resourceClassics = [];
let resourceInitialized = false, resourceInitialization = null, resourceWriteChain = Promise.resolve();

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
  if (!Object.hasOwn(RESOURCE_SECTIONS, bank.subject) || !RESOURCE_SECTIONS[bank.subject].includes(bank.section)) throw new Error('题库科目与章节不匹配。');
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
function parseResource(input) {
  const parsed=resourceParse(input);
  if (['bank','book','quotes'].filter(key=>Object.hasOwn(parsed,key)).length !== 1) throw new Error('JSON 必须且只能包含 bank、book、quotes 中的一种资源。');
  const clean=parsed.bank !== undefined ? validateQuizBank(parsed) : parsed.book !== undefined ? validateClassic(parsed) : validateQuotes(parsed);
  if (clean.bank?.id === 'daily-quotes') throw new Error('daily-quotes 是每日一句专用 ID，不能作为题库 ID。');
  return clean;
}
function validateResourceRecords(records, {allowOfficial = false} = {}) {
  resourceObject(records, '记录');
  const normalized = Object.create(null), banks = new Map();
  const officialIDs = new Set([...RESOURCE_BANK_IDS, ...resourceBanks.filter(item => item.origin === 'official').map(item => item.bank.id)]);
  for (const [key, value] of Object.entries(records)) {
    if (!key.startsWith('resource:')) continue;
    const match = /^resource:(official|custom):((?:classic:)?[A-Za-z0-9][A-Za-z0-9._-]{0,119})$/.exec(key);
    if (!match || (!allowOfficial && match[1] === 'official')) throw new Error('备份含有不允许的资源记录：' + key);
    const [, origin, id] = match;
    if (value?.origin !== origin) throw new Error('资源来源与记录键不一致：' + key);
    const clean = id.startsWith('classic:') ? validateClassic(value) : id === 'daily-quotes' ? validateQuotes(value) : validateQuizBank(value);
    if (clean.book && id !== 'classic:'+clean.book.id) throw new Error('典籍 ID 与记录键不一致。');
    if (clean.bank) {
      if (clean.bank.id !== id || banks.has(id) || (origin === 'custom' && officialIDs.has(id))) throw new Error('资源 ID 冲突：' + id);
      banks.set(id, origin);
    }
    normalized[key] = {...clean, origin};
  }
  return normalized;
}
async function resourceLoad() {
  const records = validateResourceRecords(await storage.getPrefix('resource:'), {allowOfficial:true});
  const embedded = globalThis.QICHENG_RESOURCE_SEEDS, seedsToStore = Object.create(null);
  // Installed resource versions always win. A new application release cannot silently
  // upgrade resources; bundled local seeds initialize only missing official records.
  for (const id of RESOURCE_BANK_IDS) {
    const key = 'resource:official:' + id;
    if (records[key]) continue;
    const input = embedded ? embedded.banks?.find(item => item?.bank?.id === id) : await (await resourceFetch('data/resources/' + id + '.json')).json();
    const clean = validateQuizBank(input);
    if (clean.bank.id !== id) throw new Error('内置题库 ID 与文件不一致：' + id);
    records[key] = seedsToStore[key] = {...clean, origin:'official'};
  }
  // The 4.2 empty placeholder is filled from this app's bundled Guanzi resource once.
  // This is local initialization; the online manifest is still fetched only on request.
  if (!records['resource:official:daily-quotes'] || (records['resource:official:daily-quotes'].version === '1.0.0' && !records['resource:official:daily-quotes'].quotes.length)) {
    const input = embedded ? embedded.quotes : await (await resourceFetch('data/resources/daily-quotes.json')).json();
    const clean=validateQuotes(input);
    if (!records['resource:official:daily-quotes'] || clean.quotes.length) records['resource:official:daily-quotes'] = seedsToStore['resource:official:daily-quotes'] = {...clean, origin:'official'};
  }
  const bankMap = new Map();
  let officialQuotes = null, customQuotes = null;
  const classics=[];
  for (const [key, item] of Object.entries(records)) {
    if (item.book) { classics.push(item); continue; }
    if (key.endsWith(':daily-quotes')) {
      if (item.origin === 'custom') customQuotes = item;
      else officialQuotes = item;
      continue;
    }
    if (bankMap.has(item.bank.id)) throw new Error('自定义题库与官方题库 ID 冲突。');
    bankMap.set(item.bank.id, item);
  }
  if (Object.keys(seedsToStore).length) await storage.setMany(seedsToStore);
  resourceBanks = [...RESOURCE_BANK_IDS.map(id => bankMap.get(id)), ...[...bankMap.values()].filter(item => !RESOURCE_BANK_IDS.includes(item.bank.id))];
  resourceOfficialQuotes = officialQuotes; resourceCustomQuotes = customQuotes; resourceInitialized = true;
  resourceClassics = classics;
  return getResourceVersions();
}
function initializeResources({force = false} = {}) {
  if (force) return reloadResources();
  if (resourceInitialization) return resourceInitialization;
  if (resourceInitialized) return Promise.resolve(getResourceVersions());
  resourceInitialization = resourceLoad().finally(() => { resourceInitialization = null; });
  return resourceInitialization;
}
function resourceEnqueue(operation) {
  const pending = resourceWriteChain.then(operation);
  resourceWriteChain = pending.catch(() => {});
  return pending;
}
function reloadResources() { return resourceEnqueue(async () => { if (resourceInitialization) await resourceInitialization; return resourceLoad(); }); }
function waitForResourceWrites() { return resourceWriteChain; }
function listQuizBanks() { return structuredClone(resourceBanks); }
function getQuotesResource() { return structuredClone(resourceCustomQuotes || resourceOfficialQuotes); }
function getClassicBooks() {
  const books=new Map(CLASSICS.books.map(book=>[book.id, {...book,version:CLASSICS.version,origin:'bundled'}]));
  for (const origin of ['official','custom']) for (const item of resourceClassics.filter(r=>r.origin===origin)) books.set(item.book.id,{...item.book,passages:item.passages,origin});
  return structuredClone([...books.values()]);
}
function getResourceVersions() {
  const quotes = resourceCustomQuotes || resourceOfficialQuotes;
  return {banks:resourceBanks.map(item => ({...item.bank, origin:item.origin, questionCount:item.questions.length})), classics:getClassicBooks().map(book=>({id:book.id,title:book.title,version:book.version,origin:book.origin})), quotes:quotes ? {id:'daily-quotes',version:quotes.version,origin:quotes.origin,count:quotes.quotes.length} : null};
}
function importResourceJSON(input) {
  // Snapshot and validate before queuing, so callers cannot mutate queued input.
  let clean;
  try { clean = parseResource(input); }
  catch (error) { return Promise.reject(error); }
  return resourceEnqueue(async () => {
    await initializeResources();
    const id = clean.book ? 'classic:'+clean.book.id : clean.bank?.id || 'daily-quotes';
    const existing = clean.bank && resourceBanks.find(item => item.bank.id === id);
    if (existing?.origin === 'official') throw new Error('题库 ID 已被官方题库使用，请为自定义题库使用新的 ID。');
    if (existing && (existing.bank.subject !== clean.bank.subject || existing.bank.section !== clean.bank.section)) throw new Error('替换自定义题库不能改变所属科目或章节。');
    const record = {...clean, origin:'custom'};
    await storage.setMany({['resource:custom:' + id]:record});
    if (clean.bank) resourceBanks = existing ? resourceBanks.map(item => item.bank.id === id ? record : item) : [...resourceBanks, record];
    else if (clean.book) resourceClassics = [...resourceClassics.filter(item=>!(item.origin==='custom' && item.book.id===clean.book.id)),record];
    else resourceCustomQuotes = record;
    return structuredClone(record);
  });
}
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
function updateResources(manifestURL = 'data/resources/manifest.json') {
  return resourceEnqueue(async () => {
    await initializeResources();
    const url = resourceSafeURL(manifestURL, APP_BASE);
    const manifest = resourceParse(new TextDecoder('utf-8', {fatal:true}).decode(await resourceDownload(url)));
    if (manifest.schemaVersion !== RESOURCE_SCHEMA_VERSION || !Array.isArray(manifest.resources) || manifest.resources.length > 100) throw new Error('资源清单格式无效。');
    const seen = new Set(), pending = [];
    for (const entry of manifest.resources) {
      resourceObject(entry, '资源清单项'); const id = resourceID(entry.id, '资源 ID'); resourceVersion(entry.version);
      const identity=entry.type+':'+id;
      if (seen.has(identity)) throw new Error('资源清单 ID 重复：' + id); seen.add(identity);
      if (!['quiz-bank','quotes','classic'].includes(entry.type) || (entry.type === 'quotes') !== (id === 'daily-quotes' && entry.type !== 'classic')) throw new Error('资源类型与 ID 不一致。');
      if (typeof entry.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(entry.sha256)) throw new Error('资源缺少有效 SHA-256。');
      const downloadURL = resourceSafeURL(entry.url, url);
      const existing = entry.type === 'quotes' ? resourceOfficialQuotes : entry.type === 'classic' ? resourceClassics.find(item=>item.origin==='official' && item.book.id===id) : resourceBanks.find(item => item.bank.id === id);
      if (existing?.origin === 'custom') throw new Error('更新与自定义题库 ID 冲突：' + id);
      if (!existing || compareResourceVersions(entry.version, existing.bank?.version || existing.book?.version || existing.version) > 0) pending.push({...entry, downloadURL});
    }
    const records = Object.create(null), changed = [];
    // Validate every download before starting the single database transaction.
    for (const entry of pending) {
      const bytes = await resourceDownload(entry.downloadURL);
      if (await resourceDigest(bytes) !== entry.sha256.toLowerCase()) throw new Error('资源 SHA-256 校验失败：' + entry.id);
      const parsed = resourceParse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
      const clean = entry.type === 'quiz-bank' ? validateQuizBank(parsed) : entry.type === 'classic' ? validateClassic(parsed) : validateQuotes(parsed);
      if ((clean.bank?.id || clean.book?.id || 'daily-quotes') !== entry.id || (clean.bank?.version || clean.book?.version || clean.version) !== entry.version) throw new Error('资源 ID 或版本与清单不一致：' + entry.id);
      const existing = resourceBanks.find(item => item.bank.id === entry.id);
      if (clean.bank && existing && (existing.bank.subject !== clean.bank.subject || existing.bank.section !== clean.bank.section)) throw new Error('资源更新不能改变题库所属科目或章节。');
      const record = {...clean, origin:'official'}; records['resource:official:' + (clean.book?'classic:':'') + entry.id] = record; changed.push(record);
    }
    if (changed.length) {
      await storage.setMany(records);
      const nextBanks = new Map(resourceBanks.map(item => [item.bank.id, item]));
      for (const item of changed) {
        if (item.bank) nextBanks.set(item.bank.id,item);
        else if (item.book) resourceClassics=[...resourceClassics.filter(r=>!(r.origin==='official' && r.book.id===item.book.id)),item];
        else resourceOfficialQuotes = item;
      }
      resourceBanks = [...nextBanks.values()];
    }
    return {updated:changed.map(item => item.bank?.id || item.book?.id || 'daily-quotes'), versions:getResourceVersions()};
  });
}

export { RESOURCE_SCHEMA_VERSION, RESOURCE_BANK_IDS, RESOURCE_SECTIONS, validateQuizBank, validateQuotes, validateClassic, validateResourceRecords, compareResourceVersions, initializeResources, reloadResources, listQuizBanks, getClassicBooks, getQuotesResource, getResourceVersions, importResourceJSON, updateResources, waitForResourceWrites };
