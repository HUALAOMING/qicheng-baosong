import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectStorage521} from '../js/storage-status.js';
import {tasks} from '../js/tasks.js';
test('persistent storage reflects granted/denied/unsupported and never invents authorization',async()=>{
 assert.equal((await inspectStorage521(false,{})).mode,'unsupported');
 let attempts=0;
 const manager={persisted:async()=>false,persist:async()=>{attempts++;return false;},estimate:async()=>({usage:123,quota:456})};
 assert.deepEqual(await inspectStorage521(false,manager),{mode:'denied',usage:123,quota:456,error:''});assert.equal(attempts,0);
 assert.equal((await inspectStorage521(true,manager)).mode,'denied');assert.equal(attempts,1);
 manager.persist=async()=>true;assert.equal((await inspectStorage521(true,manager)).mode,'granted');
 manager.persisted=async()=>true;manager.persist=async()=>{throw Error('must not ask again');};assert.equal((await inspectStorage521(true,manager)).mode,'granted');
});
test('storage permission and estimate failures are reported separately',async()=>{
 const result=await inspectStorage521(true,{persisted:async()=>{throw Error('permission error');},estimate:async()=>{throw Error('quota error');}});
 assert.equal(result.mode,'error');assert.match(result.error,/permission error/);assert.match(result.error,/quota error/);assert.equal(result.usage,null);
});
test('processed counts cannot complete tasks before commit; failures remain terminal',()=>{
 const task=tasks.start('事务测试');task.stage('写入',{done:100,total:100});assert.equal(task.state.status,'running');
 task.stage('提交事务');assert.equal(task.state.total,null);task.fail(new Error('QuotaExceededError'));
 task.succeed('invalid');assert.equal(task.state.status,'failed');assert.match(task.state.summary,/QuotaExceededError/);
 const success=tasks.start('成功任务');success.stage('校验',{done:4,total:5});success.succeed('5 条已提交');assert.equal(success.state.status,'succeeded');
});
