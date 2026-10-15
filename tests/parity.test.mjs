// Golden workspace HTML captured from the uploaded v3.1, using synthetic data.
// Only identical school images were changed from embedded data URLs to local paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {setup,root,workspaceHTML} from './support.mjs';
const env=await setup();
const {ctx}=await import('../js/state.js');
const {loadBuiltinData}=await import('../js/data.js');
const {validateDraft}=await import('../js/utils/validation.js');
const {render}=await import('../js/app.js');
await loadBuiltinData();
const input=JSON.parse(await readFile(path.join(root,'tests/fixtures/input.json'),'utf8'));
const snapshots=JSON.parse(await readFile(path.join(root,'tests/fixtures/v3.1-workspaces.json'),'utf8'));
for(const [key,expected]of Object.entries(snapshots))test('v3.1 feature/field parity: '+key,()=>{
  const split=key.indexOf(':'),uiLang=key.slice(0,split),route=key.slice(split+1);
  ctx.state=validateDraft({...structuredClone(input),uiLang,route});render();
  assert.equal(workspaceHTML(env.document),expected);
});
