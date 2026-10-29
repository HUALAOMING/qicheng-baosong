// Buildless app: this helper only refreshes the portable HTML and static cache list.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {createServiceWorker521} from './service-worker-template.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
await import('./prepare-resources.mjs');
const read = name => readFile(path.join(root,name));
const json = async name => JSON.parse(await read(name));
const orderedModules = [
  'js/state.js','js/data.js','js/utils/helpers.js','js/constants.js','js/model.js','js/storage.js','js/bank-store521.js','js/resources.js',
  'js/local-files52.js','js/ai-instructions52.js','js/modules/introductions.js','js/modules/page-help52.js','js/transfer.js','js/modules/journal.js','js/modules/exam-calendar.js','js/autosave.js','js/utils/validation.js','js/modules/images.js','js/modules/profile.js','js/modules/resume.js',
  'js/modules/records.js','js/modules/organization.js','js/modules/dashboard.js',
  'js/modules/universities.js','js/modules/map.js','js/modules/materials.js','js/modules/export.js',
  'js/modules/markdown.js','js/modules/quiz.js','js/modules/home.js','js/modules/explore.js','js/modules/settings.js','js/pwa.js','js/backup.js','js/events.js','js/app.js'
];
const runtimeModules = (await walk('js')).filter(name => name !== 'js/bootstrap.js');
// New small support modules precede consumers. Existing cycle-sensitive order is retained.
const newModules53=runtimeModules.filter(name=>!orderedModules.includes(name));
const modules=[...orderedModules.slice(0,4),...newModules53,...orderedModules.slice(4)];
const dataNames = ['universities','schools','china-map','university-exams','university-dates','translations','classics','resource-examples'];
const data = await Promise.all(dataNames.map(name => json('data/' + name + '.json')));
for (const university of data[0]) {
  if (!university.logo?.startsWith('assets/')) continue;
  const mime = ({png:'image/png',jpg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'})[university.logo.split('.').pop()];
  university.logo = 'data:' + mime + ';base64,' + (await read(university.logo)).toString('base64');
}
const fonts = await Promise.all(['latin','cjk'].map(async name => 'data:font/ttf;base64,' + (await read('assets/fonts/' + name + '.ttf')).toString('base64')));
const staticData = JSON.stringify({data,fonts}).replace(/</g,'\\u003c');
const resourceSeeds = JSON.stringify({banks:await Promise.all(['english-grammar','english-vocabulary','chinese-ancient-culture','chinese-usage'].map(id=>json('data/resources/'+id+'.json'))),quotes:await json('data/resources/daily-quotes.json'),examSchedule:await json('data/resources/exam-schedule.json')}).replace(/</g,'\\u003c');
const source = (await Promise.all(modules.map(async name => (await read(name)).toString().replace(/^import\s+[^\n]*;\s*$/gm,'').replace(/^export\s*\{[^}]*\};\s*$/gm,'')))).join('\n\n');
let html = (await read('index.html')).toString();
html = html.replace(/<link rel="manifest"[^>]*>\s*/g,'');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,filename) => '<style data-source="' + filename + '">__CSS_' + filename + '__</style>');
const readCSS521=new Map(await Promise.all([...html.matchAll(/__CSS_(.+?)__/g)].map(async match=>[match[1],(await read(match[1])).toString()])));
for (const match of [...html.matchAll(/__CSS_(.+?)__/g)]) html=html.replace(match[0],()=>readCSS521.get(match[1]));
if(html.includes('__CSS_'))throw new Error('独立 HTML 仍有未内联的样式。');
for (const [filename,mime] of [['assets/icons/icon.svg','image/svg+xml'],['assets/icons/apple-touch-icon.png','image/png']]) html = html.replaceAll(filename,'data:' + mime + ';base64,' + (await read(filename)).toString('base64'));
html = html.replace(/<script defer src="[^"]+"><\/script>\s*/g,'');
const escapeScript = code => code.replace(/<\/script/gi,'<\\/script');
const vendors = ['docx','pdf-lib','jszip','fontkit','pptxgen'];
const vendorHTML = (await Promise.all(vendors.map(async name => '<script type="application/qicheng-vendor" id="qichengVendor521-'+name+'">\n' + escapeScript((await read('assets/vendor/' + name + '.js')).toString()) + '\n</script>'))).join('\n');
let bootstrap = (await read('js/bootstrap.js')).toString().replace(/const\s*\{storage\}\s*=\s*await import\('\.\/storage\.js'\);/g,'').replace(/const\s*\{boot\}\s*=\s*await import\('\.\/app\.js'\);/g,'');
const featureSources53={resume:'js/resume53.js',export:'js/export53.js',learning:'js/learning53.js',search:'js/search53.js'};
const featureRegistry53=[];
for(const [name,file] of Object.entries(featureSources53)){
 const code=(await read(file)).toString();const names=[...code.matchAll(/export\s*\{([^}]+)\}/g)].flatMap(match=>match[1].split(',').map(v=>v.trim()).filter(Boolean));
 featureRegistry53.push(JSON.stringify(name)+':{'+names.join(',')+'}');
}
const portableRegistry53='globalThis.QICHENG_PORTABLE_FEATURES53={'+featureRegistry53.join(',')+'};';
const program = "(() => {\n'use strict';\n" + source + '\n'+portableRegistry53+'\n' + bootstrap + '\n})();';
new Script(program, {filename:'editable-template-inline.js'});
html = html.replace('</body>',() =>
  '<script id="qichengEmbedded" type="application/json">null</script>\n' +
  '<script>globalThis.QICHENG_EMBEDDED=JSON.parse(document.getElementById("qichengEmbedded").textContent);globalThis.QICHENG_STATIC=' + staticData + ';globalThis.QICHENG_RESOURCE_SEEDS=' + resourceSeeds + ';</script>\n' +
  vendorHTML + '\n<script>globalThis.QICHENG_PORTABLE_TEMPLATE="<!doctype html>\\n"+document.documentElement.outerHTML;\n' + escapeScript(program) + '\n</script>\n</body>');
await writeFile(path.join(root,'assets/editable-template.html'),html);
async function walk(relative) {
  const entries = await readdir(path.join(root,relative),{withFileTypes:true});
  const result = [];
  for (const e of entries) { const p = path.posix.join(relative,e.name); if(e.isDirectory()) result.push(...await walk(p)); else result.push(p); }
  return result;
}
const assets = ['index.html','manifest.webmanifest',...await walk('css'),...await walk('js'),...await walk('data'),...await walk('assets'),...await walk('workers')].filter(name => !['data/static-resources.json','data/resources/manifest.json'].includes(name)).sort();
const hashes = {};
const hash = createHash('sha256');
// A lifecycle-only worker change must never write/delete the active cache.
hash.update(await read('scripts/service-worker-template.mjs'));
hash.update((await read('package.json')).toString());
for(const name of assets) {
  const bytes=await read(name);hashes[name]=createHash('sha256').update(bytes).digest('hex');
  hash.update(name);hash.update(hashes[name]);
}
const revision = hash.digest('hex').slice(0,12);
const {version:appVersion}=await json('package.json');
const sw = createServiceWorker521({revision,assets,hashes,appVersion});
await writeFile(path.join(root,'service-worker.js'),sw);
await writeFile(path.join(root,'data/static-resources.json'),JSON.stringify({revision,appVersion,assets,hashes},null,2));
console.log('Portable HTML and versioned service worker updated: ' + assets.length + ' resources, revision ' + revision);
