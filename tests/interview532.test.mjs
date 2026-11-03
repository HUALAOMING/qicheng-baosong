import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FakeFactory,makeDocument} from './support.mjs';
globalThis.document=makeDocument();globalThis.indexedDB=new FakeFactory();
const r=await import('../js/resources.js'),{storage}=await import('../js/storage.js');
const data=JSON.parse(await readFile(new URL('../data/resources/english-interview-expressions.json',import.meta.url)));
test('50 bilingual expressions use the unchanged classic import schema and retain established IDs',()=>{assert.deepEqual(r.validateClassic(data),data);assert.equal(data.passages.length,50);assert.equal(new Set(data.passages.map(p=>p.id)).size,50);assert.equal(data.book.version,'1.1.0');assert.equal(data.passages[0].id,'interview-expression-001');assert.ok(data.passages[0].text.startsWith('The limits of my language'));assert.equal(data.passages[23].id,'interview-expression-024');for(const p of data.passages){assert.match(p.text,/[A-Za-z]/);assert.match(p.text,/[\u4e00-\u9fff]/);assert.match(p.explanation,/https:\/\//);}});
test('later same-ID JSON imports extend the collection, while a new book ID adds a separate entry',async()=>{
 globalThis.QICHENG_RESOURCE_SEEDS={banks:await Promise.all(r.RESOURCE_BANK_IDS.map(async id=>JSON.parse(await readFile(new URL('../data/resources/'+id+'.json',import.meta.url))))),quotes:JSON.parse(await readFile(new URL('../data/resources/daily-quotes.json',import.meta.url)))};
 await r.initializeResources();await r.importResourceJSON(data);
 const extra=structuredClone(data);extra.book.version='1.1.1';extra.passages.push({id:'interview-expression-051',chapter:'后续积累',text:'A future expression.\n后续表达。',explanation:'A user-authored entry.'});await r.importResourceJSON(extra);
 assert.equal(r.getClassicBooks().find(b=>b.id===data.book.id).passages.length,51);
 const another=structuredClone(data);another.book.id='my-interview-notebook';another.book.title='我的面试积累';await r.importResourceJSON(another);assert.equal(r.getClassicBooks().find(b=>b.id===data.book.id).passages.length,51);assert.equal(r.getClassicBooks().find(b=>b.id===another.book.id).passages.length,50);
 const stored=await storage.get('resource:custom:classic:'+data.book.id);assert.equal(r.validateResourceRecords({['resource:custom:classic:'+data.book.id]:stored})['resource:custom:classic:'+data.book.id].passages.length,51);
});
