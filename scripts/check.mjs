import {readFile,readdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root = fileURLToPath(new URL('../',import.meta.url));
async function walk(dir) {
  const out = [];
  for (const e of await readdir(path.join(root,dir),{withFileTypes:true})) {
    const p = path.join(dir,e.name); if(e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
const files = [...await walk('js'),...await walk('scripts'),'service-worker.js'];
for (const file of files.filter(f => /\.(m?js)$/.test(f))) {
  const result = spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  if(result.status !== 0) throw new Error(file + '\n' + result.stderr);
  const source = await readFile(path.join(root,file),'utf8');
  for(const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) await access(path.resolve(root,path.dirname(file),match[1]));
}
const manifest = JSON.parse(await readFile(path.join(root,'manifest.webmanifest'),'utf8'));
for(const icon of manifest.icons) await access(path.join(root,icon.src));
const universities = JSON.parse(await readFile(path.join(root,'data/universities.json'),'utf8'));
for(const university of universities) if(university.logo?.startsWith('assets/')) await access(path.join(root,university.logo));
const resources = JSON.parse(await readFile(path.join(root,'data/static-resources.json'),'utf8'));
const revisionCheck521=createHash('sha256');
revisionCheck521.update(await readFile(path.join(root,'scripts/service-worker-template.mjs')));
revisionCheck521.update((await readFile(path.join(root,'package.json'))).toString());
for(const filename of resources.assets) {
  await access(path.join(root,filename));
  if(resources.hashes) {
    const actual=createHash('sha256').update(await readFile(path.join(root,filename))).digest('hex');
    if(actual!==resources.hashes[filename])throw new Error('程序资源已变化，需重新运行 npm run package：'+filename);
    revisionCheck521.update(filename);revisionCheck521.update(actual);
  }
}
if(resources.hashes&&revisionCheck521.digest('hex').slice(0,12)!==resources.revision)throw new Error('程序版本或 Service Worker 模板已变化，请重新运行 npm run package。');
console.log('Syntax, module paths, icons, university images and all precache paths verified.');
