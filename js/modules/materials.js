import { getCurrentBackup } from '../backup.js';
import { ctx } from '../state.js';
import { $, $$, checkbox, dataBytes, download, esc, formatSize3, heading3, icon3, loadImage, readFile, safeFilename3, toast, tr, uid, moveIn } from '../utils/helpers.js';
import { cleanCrop, normalizeAssets3, snapshot3 } from '../model.js';
import { save, scheduleSave } from '../autosave.js';
import { confirmAction, render, changed } from '../app.js';
import { openCropDialog, photoArray } from './images.js';
import { MODULE_NAMES } from '../constants.js';
// 启程 · js/modules/materials.js


function ownerObject3 (owner) {
  if (owner === 'avatar') return null;
  if (['awardDraft', 'experienceDraft', 'practiceDraft', 'achievementDraft', 'bookDraft'].includes (owner)) return ctx.state [owner];
  if (owner === 'media') return {
    photos : ctx.state.media
  };
  const parts = owner.replace (/^block-/, 'custom:').replace (/^block:/, 'custom:').split (':'), kind = parts [0], id = parts.slice (1).join (':');
  return (kind === 'learning' ? ctx.state.learning.books : kind === 'custom' ? ctx.state.customBlocks : ctx.state [kind] ||
  []).find (x => x.id === id)
}

function assetBy3 (id) {
  return ctx.state.assets.find (a => a.id === id)
}

function attachmentPanel3 (owner) {
  const x = ownerObject3 (owner);
  if (! x) return '';
  const photos = x.photos || [], files = (x.attachments || []).map (assetBy3).filter (Boolean);
  return '<div class="attachment-panel"><div class="panel-title"><h3>' + tr ('图片与文件附件', 'Photos & attachments') + '</h3><span class="badge">' +
  (photos.length + files.length) + '</span></div><div class="actions"><label class="file-button">' + icon3 ('folder') +
  tr ('从本地上传', 'Upload from device') + '<input type="file" data-import3="' + esc (owner) + '" multiple hidden></label><button type="button" data-picker3="' +
  esc (owner) + '">' + tr ('从资料中心选择', 'Choose from Materials') + '</button></div>' + (photos.length ? '<div class="attachment-photos">' +
  photos.map ((p, i) => '<article><img src="' + esc (p.data) + '" alt="' + esc (p.name) + '"><input data-caption3="' +
  esc (owner) + '" data-index="' + i + '" value="' + esc (p.caption || '') + '" placeholder="' + tr ('照片说明', 'Caption') +
  '"><div class="actions"><button type="button" data-crop-photo="' + esc (owner) + ':' + i + '">' + tr ('裁剪', 'Crop') +
  '</button><button type="button" data-photo-move3="' + esc (owner) + '" data-index="' + i + '" data-dir="-1" aria-label="' +
  tr ('照片上移', 'Move photo up') + '" ' + (! i ? 'disabled' : '') + '>↑</button><button type="button" data-photo-move3="' +
  esc (owner) + '" data-index="' + i + '" data-dir="1" aria-label="' + tr ('照片下移', 'Move photo down') + '" ' + (i === photos.length - 1 ?
  'disabled' : '') + '>↓</button><button type="button" data-unlink-photo3="' + esc (owner) + '" data-index="' + i +
  '">' + tr ('移除关联', 'Unlink') + '</button></div></article>').join ('') + '</div>' : '') + (files.length ? '<div class="attachment-files">' +
  files.map (a => '<div><span>' + icon3 ('folder') + esc (a.name) + ' <small>' + formatSize3 (a.size) + '</small></span><div><button type="button" data-download-asset3="' +
  a.id + '">' + tr ('下载', 'Download') + '</button><button type="button" data-unlink-file3="' + esc (owner) + '" data-id="' +
  a.id + '">' + tr ('移除关联', 'Unlink') + '</button></div></div>').join ('') + '</div>' : '') + '</div>'
}

async function addAsset3 (file, kind) {
  if (file.size > 50 * 1048576) throw Error (tr ('单个文件应小于50MB', 'Each file must be under 50 MB'));
  if (ctx.state.assets.length >= 1500) throw Error (tr ('最多支持1500项资料', 'Up to 1500 materials'));
  const data = await readFile (file);
  if (kind === 'image') await loadImage (data);
  let a = ctx.state.assets.find (a => a.kind !== 'export' && a.data === data);
  if (! a) {
    a = {
      id : uid (), name : file.name, mime : file.type || 'application/octet-stream', kind : kind || (/^image\/(jpeg|png|webp|gif)$/.test (file.type) ?
      'image' : 'file'), data, size : file.size, createdAt : new Date ().toISOString (), source : 'upload'
    };
    ctx.state.assets.push (a)
  }
  return a
}

function linkAsset3 (asset, owner) {
  if (owner === 'center') return null;
  if (owner === 'avatar') {
    if (asset.kind !== 'image') return null;
    ctx.state.avatar = {
      id : uid (), assetId : asset.id, name : asset.name, data : asset.data, caption : '', crop : cleanCrop ()
    };
    ctx.state.avatarCrop = {
      x : 50, y : 50, zoom : 1
    };
    return {
      owner : 'avatar', index : 0
    }
  }
  const x = ownerObject3 (owner);
  if (! x) return null;
  if (asset.kind === 'image') {
    x.photos ||= [];
    if (x.photos.some (p => p.assetId === asset.id)) return null;
    x.photos.push ( {
      id : uid (), assetId : asset.id, name : asset.name, data : asset.data, caption : '', crop : cleanCrop ()
    });
    return {
      owner, index : x.photos.length - 1
    }
  }
  x.attachments ||= [];
  if (! x.attachments.includes (asset.id)) x.attachments.push (asset.id);
  return null
}

async function importAssets3 (files, owner = 'center') {
  if (ctx.busy || ctx.uploadBusy) return;
  const list = [...files];
  if (! list.length) return;
  if (list.length > 50) return toast (tr ('一次最多选择50个文件', 'Select up to 50 files at a time'));
  ctx.uploadBusy = true;
  ctx.busy = true;
  const queue = [], errors = [];
  try {
    for (const f of owner === 'avatar' ? list.slice (0, 1) : list) {
      try {
        if (owner === 'avatar' && ! /^image\/(jpeg|png|webp|gif)$/.test (f.type)) throw Error (tr ('请选择 JPG、PNG、WebP 或 GIF 照片',
        'Choose JPG, PNG, WebP or GIF'));
        const a = await addAsset3 (f), ref = linkAsset3 (a, owner);
        if (ref) queue.push (ref)
      }
      catch (e) {
        errors.push (f.name + ': ' + e.message)
      }
    }
    normalizeAssets3 ();
    await save ();
    render ();
    toast (tr ('资料已添加', 'Materials added') + (errors.length ? ' · ' + errors.join ('; ') : ''))
  }
  finally {
    ctx.busy = false;
    ctx.uploadBusy = false
  }
  if (queue.length) {
    const first = queue.shift ();
    openCropDialog (first.owner, first.index, queue)
  }
}

function assetUsage3 (id) {
  const result = [];
  for (const [kind, arr] of [['awards', ctx.state.awards], ['experiences', ctx.state.experiences], ['practices', ctx.state.practices],
  ['achievements', ctx.state.achievements], ['custom', ctx.state.customBlocks], ['learning', ctx.state.learning.books]]) for (const x of arr) if (x.photos?.some (p =>
  p.assetId === id) || x.attachments?.includes (id)) result.push ( {
    owner : kind + ':' + x.id, label : x.title || kind
  });
  if (ctx.state.avatar?.assetId === id) result.push ( {
    owner : 'avatar', label : tr ('个人照片', 'Portrait')
  });
  return result
}

function materialsPage3 (kind) {
  normalizeAssets3 ();
  const list = ctx.state.assets.filter (a => a.kind === kind && (! ctx.assetSearch3 || a.name.toLowerCase ().includes (ctx.assetSearch3.toLowerCase ())));
  return heading3 ('MATERIALS / ' + (kind === 'image' ? 'IMAGES' : 'FILES'), tr (kind === 'image' ? '让每张照片，都有归处。' : '把文件，收在同一个地方。',
  kind === 'image' ? 'One place for every image.' : 'All your files, in one place.'), tr ('从任何页面上传都会同步到这里；也可以在这里上传，再关联到其他记录。',
  'Uploads from every page appear here. Upload here and attach them to your records later.')) + '<section class="panel material-toolbar"><label class="search3">' +
  icon3 ('search') + '<input id="assetSearch3" value="' + esc (ctx.assetSearch3) + '" placeholder="' + tr ('按文件名搜索',
  'Search filenames') + '"></label><label class="file-button primary">＋ ' + tr ('添加资料', 'Add materials') + '<input type="file" data-import3="center" ' +
  (kind === 'image' ? 'accept="image/jpeg,image/png,image/webp,image/gif"' : '') + ' multiple hidden></label><span class="badge">' +
  list.length + ' ' + tr ('项', 'items') + '</span></section><div class="asset-grid3 ' + (kind === 'file' ? 'asset-files3' : '') +
  '">' + (list.length ? list.map (a => {
    const use = assetUsage3 (a.id); return '<article class="asset-card3">' + (kind === 'image' ? '<div class="asset-image"><img src="' +
    esc (a.data) + '" alt="' + esc (a.name) + '"></div>' : '<div class="file-mark3">' + icon3 ('folder') + '<span>' +
    esc (a.name.split ('.').pop ().toUpperCase ().slice (0, 8)) + '</span></div>') + '<div class="asset-info"><h3 title="' +
    esc (a.name) + '">' + esc (a.name) + '</h3><p>' + formatSize3 (a.size) + ' · ' + new Date (a.createdAt).toLocaleDateString () +
    '</p><small>' + tr ('关联 ', 'Linked to ') + use.length + tr (' 处', ' records') + '</small><div class="actions"><button data-download-asset3="' +
    a.id + '">' + tr ('下载', 'Download') + '</button><button data-attach-asset3="' + a.id + '">' + tr ('关联', 'Attach') +
    '</button><button data-delete-asset3="' + a.id + '">' + tr ('删除', 'Delete') + '</button></div></div></article>'
  }).join ('') : '<div class="panel empty3">' + icon3 ('folder') + '<p>' + tr ('还没有资料。上传后会自动保存到这里。', 'No materials yet. Uploads are saved here automatically.') +
  '</p></div>') + '</div>'
}

function outputsPage3 () {
  return heading3 ('MATERIALS / OUTPUTS', tr ('每一次导出，留存于此。', 'Every exported document, kept here.'), tr ('保存生成的简历、阅读档案和其他文档，可再次下载或删除。',
  'Download your generated resumes, reading dossiers and other documents again.')) + '<section class="panel"><div class="outputs-list3">' +
  (ctx.state.exportHistory.length ? [...ctx.state.exportHistory].reverse ().map (x => {
    const a = assetBy3 (x.assetId); return a ? '<article><div class="output-icon">' + icon3 ('export') + '</div><div><h3>' +
    esc (a.name) + '</h3><p>' + tr (x.purpose === 'reading' ? '阅读资料' : x.purpose === 'custom' ? '自定义文档' : '申请简历', x.purpose === 'reading' ?
    'Reading dossier' : x.purpose === 'custom' ? 'Custom document' : 'Application resume') + ' · ' + x.type.toUpperCase () +
    ' · ' + formatSize3 (a.size) + ' · ' + new Date (x.createdAt).toLocaleString () + '</p></div><div class="actions"><button data-download-asset3="' +
    a.id + '">' + tr ('下载', 'Download') + '</button><button data-delete-asset3="' + a.id + '">' + tr ('删除', 'Delete') +
    '</button></div></article>' : ''
  }).join ('') : '<div class="empty3">' + icon3 ('export') + '<p>' + tr ('导出的文件会自动保存在这里。', 'Exported files are automatically kept here.') +
  '</p><button data-go3="studio" class="primary">' + tr ('开始编排', 'Create a document') + '</button></div>') + '</div></section>'
}

function showPicker3 (owner) {
  ctx.assetPickerTarget3 = owner;
  let d = $ ('#assetPicker3');
  if (! d) {
    d = document.createElement ('dialog');
    d.id = 'assetPicker3';
    d.className = 'asset-picker3';
    document.body.append (d)
  }
  const list = ctx.state.assets.filter (a => (! ['avatar', 'media'].includes (owner) || a.kind === 'image'));
  d.innerHTML = '<div class="dialog-head3"><h2>' + tr ('从资料中心选择', 'Choose from Materials') + '</h2><button data-close-dialog3="assetPicker3">×</button></div><p class="hint">' +
  tr ('选择已有图片或文件；保留原文件，并添加到当前记录。', 'Select existing files or photos to attach to this record.') + '</p><div class="picker-grid3">' +
  (list.length ? list.map (a => '<label>' + checkbox (false, 'data-picker-asset3="' + a.id + '"', a.kind === 'image' ?
  '<img src="' + esc (a.data) + '" alt="">' : '<span class="file-mark3">' + icon3 ('folder') + '</span>') + '<strong>' +
  esc (a.name) + '</strong><small>' + formatSize3 (a.size) + '</small></label>').join ('') : '<div class="empty">' +
  tr ('资料中心暂无可选文件。请先上传。', 'Upload some materials first.') + '</div>') + '</div><div class="dialog-actions3"><button data-close-dialog3="assetPicker3">' +
  tr ('取消', 'Cancel') + '</button><button class="primary" id="applyAssetPicker3">' + tr ('添加所选', 'Attach selected') +
  '</button></div>';
  d.showModal ();
  $$ ('[data-close-dialog3]').forEach (b => b.onclick = () => d.close ());
  $ ('#applyAssetPicker3').onclick = async () => {
    const queue = [];
    for (const e of $$ ('[data-picker-asset3]:checked')) {
      const ref = linkAsset3 (assetBy3 (e.dataset.pickerAsset3), owner);
      if (ref) queue.push (ref)
    }
    d.close ();
    await save ();
    render ();
    if (queue.length) {
      const first = queue.shift ();
      openCropDialog (first.owner, first.index, queue)
    }
  }
}

async function deleteAsset3 (id) {
  const a = assetBy3 (id);
  if (! a) return;
  const use = assetUsage3 (id);
  if (! await confirmAction (tr ('删除这份资料？', 'Delete this material?'), a.name + tr ('。将删除原始资料，并解除所有记录中的关联。当前关联数量：', '. This removes the source and all links. Linked records: ') +
  use.length, tr ('确认删除', 'Delete'))) return;
  ctx.state.assets = ctx.state.assets.filter (a => a.id !== id);
  ctx.state.exportHistory = ctx.state.exportHistory.filter (x => x.assetId !== id);
  if (ctx.state.avatar?.assetId === id) ctx.state.avatar = null;
  ctx.state.media = ctx.state.media.filter (p => p.assetId !== id);
  for (const o of [ctx.state.awardDraft, ctx.state.experienceDraft, ctx.state.practiceDraft, ctx.state.achievementDraft,
  ctx.state.bookDraft, ...ctx.state.awards, ...ctx.state.experiences, ...ctx.state.practices, ...ctx.state.achievements,
  ...ctx.state.customBlocks, ...ctx.state.learning.books]) {
    o.photos = (o.photos || []).filter (p => p.assetId !== id);
    o.attachments = (o.attachments || []).filter (x => x !== id)
  }
  await save ();
  render ()
}

function archivePage3 () {
  normalizeAssets3 ();
  const totals = {
    image : 0, file : 0, export : 0
  };
  ctx.state.assets.forEach (a => totals [a.kind] ++);
  return heading3 ('CREATE / PERSONAL ARCHIVE', tr ('把自己的资料，完整带走。', 'Take your personal materials with you.'), tr ('打包图片、附件、已导出的文档与完整进度备份，原图保留原始比例。',
  'Bundle original images, attachments, exported documents and a complete progress backup.')) + '<section class="panel archive-panel3"><div class="archive-symbol3">' +
  icon3 ('folder') + '</div><h2>' + tr ('个人资料 ZIP', 'Personal archive ZIP') + '</h2><div class="archive-counts3">' +
  [['image', '图片', 'images'], ['file', '附件', 'files'], ['export', '导出文档', 'exports']].map (([k, z, e]) => '<div><strong>' +
  totals [k] + '</strong><span>' + tr (z, e) + '</span></div>').join ('') + '</div><p class="hint">' + tr ('另外包含进度备份 JSON、资料索引和恢复说明。',
  'Also includes a JSON progress backup, material index and restore instructions.') + '</p><label class="field"><span>' +
  tr ('压缩包名称', 'ZIP filename') + '</span><input id="packageName3" value="' + esc (ctx.state.filePackageName) + '"></label><button class="primary" data-action3="archive">' +
  icon3 ('export') + tr ('打包导出个人资料', 'Download personal archive') + '</button></section>'
}

async function exportArchive3 () {
  if (ctx.busy) return;
  ctx.busy = true;
  toast (tr ('正在打包个人资料…', 'Preparing archive…'));
  try {
    normalizeAssets3 ();
    const zip = new JSZip (), index = [], used = new Set (), folders = {
      image : '01_图片', file : '02_文件附件', export : '03_导出文档'
    };
    for (const a of ctx.state.assets) {
      let name = a.name.replace (/[\\/:*?"<>|\x00-\x1f]/g, '_') || 'File', path = folders [a.kind] + '/' + name, n = 2;
      while (used.has (path)) {
        path = folders [a.kind] + '/' + n + '_' + name;
        n ++
      }
      used.add (path);
      zip.file (path, dataBytes (a.data), {
        binary : true
      });
      index.push ( {
        id : a.id, name : a.name, path, mime : a.mime, size : a.size, linkedRecords : assetUsage3 (a.id).map (x => x.label)
      })
    }
    zip.file ('00_进度备份.json', JSON.stringify (await getCurrentBackup (), null, 2));
    zip.file ('00_资料索引.json', JSON.stringify (index, null, 2));
    zip.file ('恢复说明.md', '# 启程 4.0 Beta 个人资料\n\n将 00_进度备份.json 在启程 4.0 Beta 中通过“恢复备份”导入，即可恢复文字、照片、附件、文档版本与导出历史。\n\n01_图片 保留原始照片；裁剪参数保存在进度中。02_文件附件 为上传的原文件。03_导出文档 为曾生成的成果。\n\nRestore 00_进度备份.json in Qicheng 4.0 Beta to recover your workspace. The image folder contains original files; crop settings remain in the progress backup.\n');
    const blob = await zip.generateAsync ( {
      type : 'blob', mimeType : 'application/zip', compression : 'STORE'
    });
    download (blob, 'application/zip', safeFilename3 (ctx.state.filePackageName) + '.zip');
    toast (tr ('个人资料已打包', 'Archive ready'))
  }
  catch (e) {
    toast (tr ('打包失败：', 'Archive failed: ') + e.message)
  }
  finally {
    ctx.busy = false
  }
}

function bindAssetCards3 () {
  $$ ('.asset-grid3 [data-download-asset3]').forEach (b => b.onclick = () => {
    const a = assetBy3 (b.dataset.downloadAsset3); download (new Blob ([dataBytes (a.data)], {
      type : a.mime
    }), a.mime, a.name)
  });
  $$ ('.asset-grid3 [data-delete-asset3]').forEach (b => b.onclick = () => deleteAsset3 (b.dataset.deleteAsset3));
  $$ ('.asset-grid3 [data-attach-asset3]').forEach (b => b.onclick = () => showAttach3 (b.dataset.attachAsset3))
}

function showAttach3 (id) {
  const a = assetBy3 (id);
  if (! a) return;
  let d = $ ('#attachDestination3');
  if (! d) {
    d = document.createElement ('dialog');
    d.id = 'attachDestination3';
    document.body.append (d)
  }
  const destinations = [...(a.kind === 'image' ? [['avatar', tr ('基本信息：个人照片', 'Profile portrait')]] : []), ...['awards',
  'experiences', 'practices', 'achievements'].flatMap (k => ctx.state [k].map (x => [k + ':' + x.id, tr (...MODULE_NAMES [k]) +
  ' · ' + x.title])), ...ctx.state.customBlocks.map (x => ['custom:' + x.id, tr ('自定义：', 'Custom: ') + (x.title || tr ('未命名',
  'Untitled'))]), ...ctx.state.learning.books.map (x => ['learning:' + x.id, tr ('阅读：', 'Reading: ') + x.title])];
  d.innerHTML = '<form method="dialog"><h2>' + tr ('关联到记录', 'Attach to a record') + '</h2><p>' + esc (a.name) + '</p><label class="field"><span>' +
  tr ('选择已有记录', 'Select a saved record') + '</span><select id="attachmentDestination3">' + destinations.map (([id, label]) =>
  '<option value="' + id + '">' + esc (label) + '</option>').join ('') + '</select></label>' + (destinations.length ?
  '' : '<p>' + tr ('请先录入一条记录。', 'Save a record first.') + '</p>') + '<div class="actions"><button>' + tr ('取消', 'Cancel') +
  '</button><button type="button" class="primary" id="applyAttachment3" ' + (! destinations.length ? 'disabled' : '') +
  '>' + tr ('确认关联', 'Attach') + '</button></div></form>';
  d.showModal ();
  $ ('#applyAttachment3').onclick = async () => {
    const owner = $ ('#attachmentDestination3').value, ref = linkAsset3 (a, owner);
    d.close ();
    await save ();
    render ();
    if (ref) openCropDialog (ref.owner, ref.index)
  }
}

export { ownerObject3, assetBy3, attachmentPanel3, addAsset3, linkAsset3, importAssets3, assetUsage3, materialsPage3, outputsPage3, showPicker3, deleteAsset3, archivePage3, exportArchive3, bindAssetCards3, showAttach3 };

// All controls for this feature, in their original override order.
function bindMaterialsControls () {
  $$ ('[data-import3]').forEach (e => e.onchange = () => importAssets3 (e.files, e.dataset.import3));
  $$ ('[data-picker3]').forEach (b => b.onclick = e => {
    e.preventDefault (); showPicker3 (b.dataset.picker3)
  });
  $$ ('[data-caption3]').forEach (e => e.oninput = () => {
    photoArray (e.dataset.caption3) [+ e.dataset.index].caption = e.value; changed (false)
  });
  $$ ('[data-photo-move3]').forEach (b => b.onclick = () => {
    moveIn (photoArray (b.dataset.photoMove3), + b.dataset.index, + b.dataset.dir); changed ()
  });
  $$ ('[data-unlink-photo3]').forEach (b => b.onclick = () => {
    photoArray (b.dataset.unlinkPhoto3).splice (+ b.dataset.index, 1); changed ()
  });
  $$ ('[data-unlink-file3]').forEach (b => b.onclick = () => {
    const o = ownerObject3 (b.dataset.unlinkFile3); o.attachments = o.attachments.filter (x => x !== b.dataset.id); changed ()
  });
  $$ ('[data-download-asset3]').forEach (b => b.onclick = e => {
    e.preventDefault (); const a = assetBy3 (b.dataset.downloadAsset3); if (a) download (new Blob ([dataBytes (a.data)],
    {
      type : a.mime
    }), a.mime, a.name)
  });
  $$ ('[data-delete-asset3]').forEach (b => b.onclick = () => deleteAsset3 (b.dataset.deleteAsset3));
  $$ ('[data-attach-asset3]').forEach (b => b.onclick = () => showAttach3 (b.dataset.attachAsset3));
  if ($ ('#assetSearch3')) $ ('#assetSearch3').oninput = e => {
    ctx.assetSearch3 = e.target.value;
    const kind = ctx.state.route === 'images' ? 'image' : 'file';
    const fresh = document.createElement ('div');
    fresh.innerHTML = materialsPage3 (kind);
    $ ('.asset-grid3').innerHTML = fresh.querySelector ('.asset-grid3').innerHTML;
    bindAssetCards3 ()
  };
  if ($ ('#packageName3')) $ ('#packageName3').oninput = e => {
    ctx.state.filePackageName = e.target.value;
    scheduleSave ()
  };
}
export { bindMaterialsControls };
