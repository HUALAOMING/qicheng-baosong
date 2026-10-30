import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const {quizAIInstructions52,quizAIBrief531,quizAIInstructionMarkdown531,downloadQuizInstructions531,copyQuizBrief531}=await import('../js/ai-instructions52.js');
ctx.state=fresh();

test('downloaded Markdown retains every detailed AI requirement and a valid importer example',async()=>{
 const full=quizAIInstructions52(),markdown=quizAIInstructionMarkdown531();
 assert.match(markdown,/^# 启程/);assert.ok(markdown.includes(full));
 for(const requirement of ['schemaVersion','12 MB','20000','single-choice','true-false','保持 bank.id','题库的科目用于筛选'])assert.ok(markdown.includes(requirement),requirement);
 const example=full.slice(full.indexOf('{\n'),full.indexOf('\n\n二、'));
 assert.equal(JSON.parse(example).questions.length,2);
 downloadQuizInstructions531();
 assert.equal(ctx.activeDownload.name,'启程-AI出题完整指令.md');
 assert.match(ctx.activeDownload.blob.type,/^text\/markdown/);
 assert.equal(await ctx.activeDownload.blob.text(),markdown);
 URL.revokeObjectURL(ctx.activeDownload.url);ctx.activeDownload=null;
});

test('AI clipboard brief gives context and goal with a small explicit request template',async()=>{
 let copied='';navigator.clipboard={writeText:async text=>{copied=text;}};
 await copyQuizBrief531();
 assert.equal(copied,quizAIBrief531());assert.ok(copied.length<600);
 for(const phrase of ['启程-AI出题完整指令.md','教材','主题','题量','难度','资料或来源','严格有效的 JSON'])assert.ok(copied.includes(phrase),phrase);
 assert.ok(!copied.includes('"questions": ['));assert.ok(copied.length<quizAIInstructions52().length/4);
 delete navigator.clipboard;
});
