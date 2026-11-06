import test from 'node:test';
import assert from 'node:assert/strict';
import {createFolder54,renameFolder54,moveFiles54,removeFolder54,renameFile54,filterFiles54,cleanFileName54} from '../js/file-model54.js';

function fixture54(){return {assets:[{id:'image1',kind:'image',name:'证明.png',data:'immutable-original',_assetBlobRef:'blob1'},{id:'doc1',kind:'file',collection:'resume',name:'通用版.pdf',data:'immutable-pdf',_assetBlobRef:'blob2'},{id:'doc2',kind:'file',name:'资料.docx',data:'immutable-docx'}],assetFolders:[],awards:[{photos:[{assetId:'image1',name:'证明.png',crop:{rotation:90}}],attachments:['doc2']}],versions:[{resume53:{base:{awards:[{photos:[{assetId:'image1',name:'证明.png'}]}]}}}]};}

test('folder operations preserve original asset IDs, bytes and record links; deleting a folder unfiles every item',()=>{
  const state=fixture54(),before=structuredClone(state.assets),refs=structuredClone(state.awards);
  createFolder54(state,'申请材料','folder1');createFolder54(state,'证书','folder2');
  moveFiles54(state,['image1','doc1'],'folder1');renameFolder54(state,'folder1','院校申请');
  assert.deepEqual(filterFiles54(state,{folder:'folder1'}).map(a=>a.id),['image1','doc1']);
  assert.deepEqual(filterFiles54(state,{kind:'resume',folder:'folder1'}).map(a=>a.id),['doc1']);
  removeFolder54(state,'folder1');
  assert.ok(state.assets.every(a=>!a.folderId));assert.deepEqual(state.awards,refs);
  assert.deepEqual(state.assets.map(({folderId,...a})=>a),before);
  assert.equal(state.assetFolders.length,1);
});

test('file rename retains extension and changes photo display references without changing asset storage or crops',()=>{
  const state=fixture54();renameFile54(state,'image1','新证书');
  assert.equal(state.assets[0].name,'新证书.png');assert.equal(state.assets[0].data,'immutable-original');assert.equal(state.assets[0]._assetBlobRef,'blob1');
  assert.equal(state.awards[0].photos[0].name,'新证书.png');assert.equal(state.awards[0].photos[0].crop.rotation,90);
  assert.equal(state.versions[0].resume53.base.awards[0].photos[0].name,'新证书.png');
  assert.deepEqual(state.awards[0].attachments,['doc2']);
  assert.deepEqual(filterFiles54(state,{kind:'image',search:'新证'}).map(a=>a.id),['image1']);
});

test('folder and filename input rejects traversal, duplicate names and missing destinations atomically',()=>{
  const state=fixture54();createFolder54(state,'Resume','folder1');
  assert.throws(()=>createFolder54(state,'resume','folder2'),/同名/);
  for(const bad of ['','../escape','a/b','a\\b','..','<script>']){assert.throws(()=>createFolder54(state,bad,'folder2'));assert.throws(()=>cleanFileName54(bad,'safe.pdf'));}
  assert.throws(()=>moveFiles54(state,['image1'],'missing'),/不存在/);assert.equal(state.assets[0].folderId,undefined);
  createFolder54(state,'成绩','folder2');assert.throws(()=>renameFolder54(state,'folder2','Resume'),/同名/);assert.equal(state.assetFolders[1].name,'成绩');
});
