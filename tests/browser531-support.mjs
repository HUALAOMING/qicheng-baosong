import {homedir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
// Prefer an installed dependency or an explicit module URL. The optional local
// runtime fallback keeps authoring environments usable without publishing paths.
let playwright531;
if(process.env.QICHENG_PLAYWRIGHT_MODULE)playwright531=await import(process.env.QICHENG_PLAYWRIGHT_MODULE);
else{try{playwright531=await import('playwright');}catch{playwright531=await import(pathToFileURL(path.join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules','playwright','index.mjs')).href);}}
export const chromium531=playwright531.chromium;
