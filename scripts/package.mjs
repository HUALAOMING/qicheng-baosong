// Buildless app: this helper only refreshes the portable HTML and static cache list.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const root = fileURLToPath(new URL('../',import.meta.url));
await import('./prepare-resources.mjs');
const read = name => readFile(path.join(root,name));
const json = async name => JSON.parse(await read(name));
const modules = [
  'js/state.js','js/data.js','js/utils/helpers.js','js/constants.js','js/model.js','js/storage.js','js/resources.js',
  'js/transfer.js','js/modules/journal.js','js/modules/exam-calendar.js','js/autosave.js','js/utils/validation.js','js/modules/images.js','js/modules/profile.js','js/modules/resume.js',
  'js/modules/records.js','js/modules/organization.js','js/modules/dashboard.js',
  'js/modules/universities.js','js/modules/map.js','js/modules/materials.js','js/modules/export.js',
  'js/modules/markdown.js','js/modules/quiz.js','js/modules/home.js','js/modules/explore.js','js/modules/settings.js','js/pwa.js','js/backup.js','js/events.js','js/app.js'
];
const runtimeModules = (await walk('js')).filter(name => name !== 'js/bootstrap.js');
for (const name of runtimeModules) if (!modules.includes(name)) throw new Error('离线副本缺少模块：' + name + '。请更新 package.mjs 中的模块列表。');
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
for (const css of ['base','resume','layout','themes','pwa','workflow','journal','v5']) html = html.replace('__CSS_css/' + css + '.css__',(await read('css/' + css + '.css')).toString());
for (const [filename,mime] of [['assets/icons/icon.svg','image/svg+xml'],['assets/icons/apple-touch-icon.png','image/png']]) html = html.replaceAll(filename,'data:' + mime + ';base64,' + (await read(filename)).toString('base64'));
html = html.replace(/<script defer src="[^"]+"><\/script>\s*/g,'');
const escapeScript = code => code.replace(/<\/script/gi,'<\\/script');
const vendors = ['docx','pdf-lib','jszip','fontkit','pptxgen'];
const vendorHTML = (await Promise.all(vendors.map(async name => '<script>\n' + escapeScript((await read('assets/vendor/' + name + '.js')).toString()) + '\n</script>'))).join('\n');
let bootstrap = (await read('js/bootstrap.js')).toString().replace(/const\s*\{storage\}\s*=\s*await import\('\.\/storage\.js'\);/g,'').replace(/const\s*\{boot\}\s*=\s*await import\('\.\/app\.js'\);/g,'');
const program = "(() => {\n'use strict';\n" + source + '\n' + bootstrap + '\n})();';
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
const assets = ['index.html','manifest.webmanifest',...await walk('css'),...await walk('js'),...await walk('data'),...await walk('assets')].filter(name => !['data/static-resources.json','data/resources/manifest.json'].includes(name)).sort();
const hash = createHash('sha256');
for(const name of assets) { hash.update(name); hash.update(await read(name)); }
const revision = hash.digest('hex').slice(0,12);
const sw = `// Generated by scripts/package.mjs. Update files, then run npm run package.
const CACHE_PREFIX = 'qicheng-static-' + encodeURIComponent(new URL(self.registration.scope).pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + 'v4-${revision}';
const PRECACHE = ${JSON.stringify(assets)};
const URLS = new Set(PRECACHE.map(path => new URL(path,self.registration.scope).href));
self.addEventListener('install',event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Bound concurrent downloads on mobile. Publish only after every batch succeeds.
      for(let offset=0;offset<PRECACHE.length;offset+=4){
        const batch=PRECACHE.slice(offset,offset+4);
        for(let attempt=0;attempt<2;attempt++){
          try{await cache.addAll(batch.map(path => new Request(new URL(path,self.registration.scope),{cache:'reload'})));break;}
          catch(error){if(attempt===1)throw new Error(batch.join(', ')+' — '+(error.name||'Error')+': '+error.message);}
        }
      }
    } catch(error) {
      await caches.delete(CACHE_NAME);
      try{for(const client of await (self.clients.matchAll?.({type:'window',includeUncontrolled:true})||[]))if(client.url?.startsWith(self.registration.scope))client.postMessage({type:'UPDATE_CACHE_FAILED',detail:error.message});}catch{}
      throw error;
    }
  })());
});
self.addEventListener('activate',event => {
  event.waitUntil((async () => {
    for(const name of await caches.keys()) if(name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event => { if(event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('fetch',event => {
  const request = event.request, url = new URL(request.url);
  if(request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  // Explicit content updates must always reach the network, including cached JSON paths.
  if(request.cache === 'no-store') return;
  if(request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(new URL('index.html',self.registration.scope).href) || fetch(request);
    })()); return;
  }
  const cleanURL = new URL(url); cleanURL.search = ''; cleanURL.hash = '';
  if(!URLS.has(cleanURL.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(cleanURL.href) || fetch(request);
  })());
});
`;
await writeFile(path.join(root,'service-worker.js'),sw);
await writeFile(path.join(root,'data/static-resources.json'),JSON.stringify({revision,assets},null,2));
console.log('Portable HTML and versioned service worker updated: ' + assets.length + ' resources, revision ' + revision);
