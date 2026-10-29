import {storage} from './storage.js';

// Question rows are stable and independent of user learning/history rows.
const BANK_META_PREFIX521='@521:bank:meta:';
const BANK_QUESTION_PREFIX521='@521:bank:q:';
function bankMetaKey521(origin,id){return BANK_META_PREFIX521+origin+':'+id;}
function bankQuestionKey521(origin,id,qid){return BANK_QUESTION_PREFIX521+origin+':'+id+'/'+qid;}
function bankHeader521(record){return {schemaVersion:1,bank:structuredClone(record.bank),origin:record.origin,questionIds:record.questions.map(q=>q.id)};}
async function bankHeaders521(){return Object.values(await storage.getPrefix(BANK_META_PREFIX521));}
async function bankRead521(origin,id){
  const key=bankMetaKey521(origin,id), header=await storage.get(key);
  if(!header)return null;
  const revision=storage.revision?.(key);
  const rows=await storage.getPrefix(BANK_QUESTION_PREFIX521+origin+':'+id+'/');
  if(revision!==undefined){await storage.get(key);if(storage.revision(key)!==revision)throw new Error('读取期间题库被其他窗口修改，请重试。');}
  const questions=header.questionIds.map(qid=>rows[bankQuestionKey521(origin,id,qid)]);
  if(questions.some(q=>!q))throw new Error('题库记录不完整，请从完整备份恢复：'+id);
  const result={schemaVersion:1,bank:header.bank,origin,questions};
  Object.defineProperty(result,'revision521',{value:revision});return result;
}
function bankDelta521(record,previous){
  const header=bankHeader521(record),key=bankMetaKey521(record.origin,record.bank.id);
  const before=new Map((previous?.questions||[]).map(q=>[q.id,q]));
  const writes=Object.create(null), removals=[];
  const oldHeader=previous?bankHeader521(previous):null;
  if(JSON.stringify(header)!==JSON.stringify(oldHeader))writes[key]=header;
  for(const q of record.questions){
    const old=before.get(q.id);
    if(!old||JSON.stringify(old)!==JSON.stringify(q))writes[bankQuestionKey521(record.origin,record.bank.id,q.id)]=q;
    before.delete(q.id);
  }
  for(const id of before.keys())removals.push(bankQuestionKey521(record.origin,record.bank.id,id));
  // Advance the bank's optimistic revision even for an explanation-only edit.
  if(Object.keys(writes).length||removals.length)writes[key]={...header,contentRevision:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};
  return {writes,removals,key};
}
async function bankRemoveKeys521(record){
  const header=await storage.get(bankMetaKey521(record.origin,record.bank.id));
  return [bankMetaKey521(record.origin,record.bank.id),...(header?.questionIds||[]).map(id=>bankQuestionKey521(record.origin,record.bank.id,id))];
}
async function exportBankRecords({allowOfficial=true}={}){
  const result=Object.create(null);
  for(const header of await bankHeaders521()){
    if(!allowOfficial&&header.origin==='official')continue;
    const record=await bankRead521(header.origin,header.bank.id);
    result['resource:'+header.origin+':'+header.bank.id]=record;
  }
  return result;
}
export {BANK_META_PREFIX521,bankMetaKey521,bankQuestionKey521,bankHeaders521,bankRead521,bankDelta521,bankRemoveKeys521,exportBankRecords};
