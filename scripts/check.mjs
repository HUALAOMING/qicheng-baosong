import {readFile,readdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
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
for(const filename of resources.assets) await access(path.join(root,filename));
console.log('Syntax, module paths, icons, university images and all precache paths verified.');
