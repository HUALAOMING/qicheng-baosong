import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const resourceRoot = fileURLToPath(new URL('../data/resources/',import.meta.url));
// Optional one-time conversion of the already reviewed Model Test 31–45 JSON.
// Keep every question ID, answer, explanation and supported inline emphasis verbatim.
if (process.argv[2]) {
  const original = JSON.parse(await readFile(process.argv[2],'utf8'));
  if (!Array.isArray(original) || original.length !== 228) throw new Error('Expected the reviewed 228-question English JSON.');
  for (const [section,expected] of [['Grammar',118],['Vocabulary',110]]) {
    const questions = original.filter(q=>q.section===section).map(q=>({
      id:q.id,type:'single-choice',question:q.question,
      options:Object.entries(q.options).map(([id,text])=>({id,text})),answer:q.answer,explanation:q.explanation
    }));
    if (questions.length!==expected) throw new Error('Unexpected section count: '+section);
    const id='english-'+section.toLowerCase();
    await writeFile(path.join(resourceRoot,id+'.json'),JSON.stringify({schemaVersion:1,bank:{id,name:'English '+section,subject:'english',section:section.toLowerCase(),version:'1.0.0'},questions},null,2)+'\n');
  }
}
const resourceNames=(await readdir(resourceRoot)).filter(name=>name.endsWith('.json') && name!=='manifest.json').sort();
const entries=[];
const seen=new Set();
for (const filename of resourceNames) {
  const bytes=await readFile(path.join(resourceRoot,filename));
  const resource=JSON.parse(bytes);
  const type=resource.bank?'quiz-bank':resource.book?'classic':Array.isArray(resource.quotes)?'quotes':Array.isArray(resource.examSchedule)?'exam-schedule':null;
  const id=resource.bank?.id||resource.book?.id||(type==='exam-schedule'?'exam-schedule':'daily-quotes'), identity=type+':'+id;
  if(!type || resource.schemaVersion!==1 || seen.has(identity))throw new Error('Invalid or duplicate resource: '+filename);
  seen.add(identity);
  entries.push({id,type,version:resource.bank?.version||resource.book?.version||resource.version,url:filename,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(path.join(resourceRoot,'manifest.json'),JSON.stringify({schemaVersion:1,resources:entries},null,2)+'\n');
console.log('Prepared '+entries.length+' resource checksums; source content is unchanged.');
