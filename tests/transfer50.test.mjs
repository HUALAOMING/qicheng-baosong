import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {storage}=await import('../js/storage.js');
const {fresh,snapshot3}=await import('../js/model.js');
const saving=await import('../js/autosave.js');
const backup=await import('../js/backup.js');
const resources=await import('../js/resources.js');
const home=await import('../js/modules/home.js');
const journal=await import('../js/modules/journal.js');
const quiz=await import('../js/modules/quiz.js');
await(await import('../js/data.js')).loadBuiltinData();
ctx.state=fresh();saving.initializeSaving301();await resources.initializeResources();await quiz.initializeQuiz();await home.initializeHome();await journal.initializeJournal();

test('device save timestamps are committed atomically with real user changes; reads and official downloads do not change them',async()=>{
 storage.enableActivityTracking();await storage.set('current',snapshot3());
 const first=await storage.get('meta:device');assert.ok(Number.isFinite(Date.parse(first.lastSavedAt)));
 await storage.getAll();await storage.set('resource:official:timestamp-test',{ok:true});assert.deepEqual(await storage.get('meta:device'),first);await storage.remove('resource:official:timestamp-test');
 const records=await storage.getAll();env.factory.failAfter=2;
 await assert.rejects(()=>storage.set('settings:countdown',{name:'failure',date:'2027-01-01'}));
 assert.deepEqual(await storage.getAll(),records);
});
test('complete transfer keeps journal and custom user records, omits local receipts and stamps import only on success',async()=>{
 await journal.saveReadingProgress({date:'2026-10-22',book:'管子',startPage:1,endPage:8});
 await journal.saveDailyStatus('2026-10-22','good');await home.saveHomeCountdown({name:'目标',date:'2027-01-15'});
 await storage.set('meta:device',{lastImportedAt:'2000-01-01T00:00:00Z',lastSavedAt:'2001-01-01T00:00:00Z'});
 const data=await backup.getCurrentBackup();assert.equal(Object.keys(data.data).some(key=>key.startsWith('meta:')||key.startsWith('resource:official:')),false);assert.ok(Object.keys(data.data).some(key=>key.startsWith('journal:reading:')));assert.equal(data.data['journal:day:2026-10-22'].status,'good');
 await backup.commitBackup(data);const receipt=await storage.get('meta:device');assert.equal(receipt.sourceCreatedAt,data.createdAt);assert.notEqual(receipt.lastImportedAt,'2000-01-01T00:00:00Z');assert.ok(Number.isFinite(Date.parse(receipt.lastSavedAt)));assert.equal(journal.getLatestReading().book,'管子');
 const before=await storage.getAll(),bad=structuredClone(data);bad.data['journal:day:2026-10-22'].status='invalid';await assert.rejects(()=>backup.commitBackup(bad));assert.deepEqual(await storage.getAll(),before);
 env.factory.failAfter=2;await assert.rejects(()=>backup.commitBackup(data));assert.deepEqual(await storage.getAll(),before);
});
test('an unsaved answer draft is included in an emergency JSON even if its database write fails',async()=>{
 await quiz.initializeQuiz({});const session=quiz.quizStart('english-grammar','random',7);quiz.quizAnswer(0,session.questions[0].options[0].id);
 env.factory.failWrite=true;
 const file=await backup.getCurrentBackup();assert.equal(file.data[quiz.QUIZ_DRAFT_KEY].answers[0],session.questions[0].options[0].id);assert.equal(file.data[quiz.QUIZ_DRAFT_KEY].questions.length,7);backup.parseBackup(file);assert.equal(quiz.getRecentQuiz(),null);
 await quiz.waitForQuizWrites();storage.enableActivityTracking(false);
});
