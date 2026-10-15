import {readFile,writeFile} from 'node:fs/promises';
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
const resourceNames=['english-grammar','english-vocabulary','chinese-ancient-culture','chinese-usage','daily-quotes'];
const entries=[];
for (const id of resourceNames) {
  const bytes=await readFile(path.join(resourceRoot,id+'.json'));
  const resource=JSON.parse(bytes);
  entries.push({id,type:id==='daily-quotes'?'quotes':'quiz-bank',version:resource.bank?.version||resource.version,url:id+'.json',sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(path.join(resourceRoot,'manifest.json'),JSON.stringify({schemaVersion:1,resources:entries},null,2)+'\n');
console.log('Prepared 5 resource checksums; source content is unchanged.');
