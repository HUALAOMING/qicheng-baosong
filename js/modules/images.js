import { $, $$, clamp, esc, loadImage, toast, tr, moveIn } from '../utils/helpers.js';
import { cleanCrop, currentVersion } from '../model.js';
import { ctx } from '../state.js';
import { render, changed, confirmAction } from '../app.js';
import { save, scheduleSave } from '../autosave.js';
import { allPhotos } from './resume.js';
import { importAssets3, ownerObject3 } from './materials.js';
// 启程 · js/modules/images.js


async function uploadPhotos (e) {
  return uploadBatch (e.target.files, 'awardDraft')
}

function photoTiles (photos, owner) {
  return '<div class="media-grid">' + photos.map ((p, i) => '<article class="media-tile"><img src="' + esc (p.data) +
  '" alt="' + esc (p.caption || p.name) + '"><input aria-label="' + tr ('照片说明', 'Photo caption') + '" placeholder="' +
  tr ('照片说明', 'Photo caption') + '" data-photo-caption="' + owner + ':' + i + '" value="' + esc (p.caption || '') +
  '"><div class="actions"><button data-crop-photo="' + owner + ':' + i + '">' + tr ('裁剪', 'Crop') + '</button><button data-photo-move="' +
  owner + ':' + i + ':-1' + '">↑</button><button data-photo-move="' + owner + ':' + i + ':1' + '">↓</button><button data-photo-delete="' +
  owner + ':' + i + '">' + tr ('移除', 'Remove') + '</button></div></article>').join ('') + '</div>';
}

function cropAspect (crop, img) {
  if (crop.ratio === 'id') return 2 / 3;
  if (['square', 'circle'].includes (crop.ratio)) return 1;
  if (crop.ratio === 'custom') return clamp (crop.w, 1, 20, 2) / clamp (crop.h, 1, 20, 3);
  return img.width / img.height
}

async function cropCanvas (data, crop) {
  const img = await loadImage (data), ratio = cropAspect (crop, img);
  let cw = 480, ch = Math.round (cw / ratio);
  if (ch > 1200) {
    ch = 1200;
    cw = Math.round (ch * ratio)
  }
  const canvas = document.createElement ('canvas');
  canvas.width = Math.max (1, cw);
  canvas.height = Math.max (1, ch);
  const x = canvas.getContext ('2d');
  if (crop.ratio !== 'circle') {
    x.fillStyle = '#fff';
    x.fillRect (0, 0, cw, ch)
  }
  else {
    x.beginPath ();
    x.arc (cw / 2, ch / 2, Math.min (cw, ch) / 2, 0, Math.PI * 2);
    x.clip ()
  }
  const scale = Math.max (cw / img.width, ch / img.height) * clamp (crop.zoom, 1, 3, 1), w = img.width * scale, h = img.height * scale;
  x.drawImage (img, (cw - w) * clamp (crop.x, 0, 100, 50) / 100, (ch - h) * clamp (crop.y, 0, 100, 50) / 100, w, h);
  return canvas
}

async function exportPhotoData (photo) {
  const c = cleanCrop (photo.crop);
  if (c.ratio === 'original' && c.zoom === 1 && c.x === 50 && c.y === 50 && /^data:image\/(jpeg|png);/.test (photo.data)) return photo.data;
  const canvas = await cropCanvas (photo.data, c);
  return canvas.toDataURL (c.ratio === 'circle' ? 'image/png' : 'image/jpeg', .92)
}

async function avatarData () {
  if (! ctx.state.avatar) return null;
  const v = currentVersion (), crop = {
    ...ctx.state.avatarCrop, ratio : v.avatarShape, w : v.avatarRatioW, h : v.avatarRatioH
  }, canvas = await cropCanvas (ctx.state.avatar.data, crop);
  return canvas.toDataURL ('image/png')
}

async function openCropDialog (owner, index, queue = []) {
  const photo = owner === 'avatar' ? ctx.state.avatar : photoArray (owner)?.[index];
  if (! photo) return;
  const v = currentVersion (), working = owner === 'avatar' ? cleanCrop ( {
    ratio : v.avatarShape, w : v.avatarRatioW, h : v.avatarRatioH, ...ctx.state.avatarCrop
  }) : cleanCrop (photo.crop);
  let dialog = $ ('#cropDialog');
  if (! dialog) {
    dialog = document.createElement ('dialog');
    dialog.id = 'cropDialog';
    dialog.className = 'crop-dialog';
    document.body.appendChild (dialog)
  }
  const next = () => {
    dialog.close ();
    if (queue.length) {
      const item = queue.shift ();
      openCropDialog (item.owner, item.index, queue)
    }
    else render ()
  };
  dialog.innerHTML = '<div class="crop-top"><div><div class="eyebrow">QICHENG / CROP</div><h2>' + tr ('裁剪照片', 'Crop photo') +
  '</h2><p>' + esc (photo.name) + '</p></div><button id="cropClose" aria-label="' + tr ('关闭', 'Close') + '">×</button></div><div class="crop-layout"><div class="crop-stage"><canvas id="cropCanvas" aria-label="' +
  tr ('照片裁剪预览', 'Crop preview') + '"></canvas><p class="hint">' + tr ('拖动预览调整位置；原照片保留，可以以后重新裁剪。', 'Drag to reposition. The original photo is kept for later adjustments.') +
  '</p></div><div class="crop-options"><label class="field"><span>' + tr ('裁剪比例', 'Crop ratio') + '</span><select id="cropRatio">' +
  [['original', tr ('原图比例', 'Original')], ['id', tr ('证件照 2:3', 'ID photo 2:3')], ['square', tr ('方形 1:1', 'Square 1:1')],
  ['circle', tr ('圆形 1:1', 'Circle 1:1')], ['custom', tr ('自定义', 'Custom')]].map (([id, label]) => '<option value="' +
  id + '" ' + (working.ratio === id ? 'selected' : '') + '>' + label + '</option>').join ('') + '</select></label><div class="crop-custom"><label>' +
  tr ('宽', 'Width') + '<input id="cropW" type="number" min="1" max="20" step=".1" value="' + working.w + '"></label><span>:</span><label>' +
  tr ('高', 'Height') + '<input id="cropH" type="number" min="1" max="20" step=".1" value="' + working.h + '"></label></div>' +
  [['x', '水平位置', 'Horizontal position'], ['y', '垂直位置', 'Vertical position'], ['zoom', '缩放', 'Zoom']].map (([key, zh,
  en]) => '<label class="crop-range">' + tr (zh, en) + ' <output id="cropOut-' + key + '">' + working [key] + '</output><input type="range" data-crop-edit="' +
  key + '" min="' + (key === 'zoom' ? 1 : 0) + '" max="' + (key === 'zoom' ? 3 : 100) + '" step="' + (key === 'zoom' ?
  .05 : 1) + '" value="' + working [key] + '"></label>').join ('') + '</div></div><div class="crop-actions"><button id="cropSkip">' +
  tr (queue.length ? '跳过并处理下一张' : '取消', 'Skip / cancel') + '</button><button class="primary" id="cropApply">' + tr (queue.length ?
  '应用并处理下一张' : '应用裁剪', 'Apply and next') + '</button></div>';
  dialog.showModal ();
  let drawToken = 0;
  const draw = async () => {
    const token = ++ drawToken;
    try {
      const canvas = await cropCanvas (photo.data, working);
      if (token !== drawToken || ! dialog.open) return;
      const target = $ ('#cropCanvas');
      target.width = canvas.width;
      target.height = canvas.height;
      target.getContext ('2d').drawImage (canvas, 0, 0);
      target.style.aspectRatio = canvas.width + '/' + canvas.height
    }
    catch (e) {
      toast (e.message)
    }
  };
  const toggle = () => {
    dialog.querySelector ('.crop-custom').hidden = working.ratio !== 'custom'
  };
  toggle ();
  draw ();
  $ ('#cropRatio').onchange = e => {
    working.ratio = e.target.value;
    toggle ();
    draw ()
  };
  for (const key of ['w', 'h']) $ ('#crop' + key.toUpperCase ()).oninput = e => {
    working [key] = clamp (e.target.value, 1, 20, key === 'w' ? 2 : 3);
    draw ()
  };
  $$ ('[data-crop-edit]').forEach (e => e.oninput = () => {
    working [e.dataset.cropEdit] = Number (e.value); $ ('#cropOut-' + e.dataset.cropEdit).textContent = e.value; draw ()
  });
  let start = null;
  $ ('#cropCanvas').onpointerdown = e => {
    start = {
      x : e.clientX, y : e.clientY, cx : working.x, cy : working.y
    };
    e.target.setPointerCapture (e.pointerId)
  };
  $ ('#cropCanvas').onpointermove = e => {
    if (! start) return;
    const box = e.target.getBoundingClientRect ();
    working.x = clamp (start.cx + (e.clientX - start.x) / box.width * 90, 0, 100, 50);
    working.y = clamp (start.cy + (e.clientY - start.y) / box.height * 90, 0, 100, 50);
    for (const key of ['x', 'y']) {
      const input = $ ('[data-crop-edit="' + key + '"]');
      input.value = working [key];
      $ ('#cropOut-' + key).textContent = Math.round (working [key])
    }
    draw ()
  };
  $ ('#cropCanvas').onpointerup = () => start = null;
  $ ('#cropCanvas').onpointercancel = () => start = null;
  $ ('#cropClose').onclick = () => {
    dialog.close ();
    render ()
  };
  $ ('#cropSkip').onclick = next;
  $ ('#cropApply').onclick = async () => {
    if (owner === 'avatar') {
      ctx.state.avatarCrop = {
        x : working.x, y : working.y, zoom : working.zoom
      };
      v.avatarShape = working.ratio === 'original' ? 'custom' : working.ratio;
      v.avatarRatioW = working.ratio === 'original' ? Math.max (1, (await loadImage (photo.data)).width / Math.max ((await loadImage (photo.data)).width,
      (await loadImage (photo.data)).height) * 20) : working.w;
      v.avatarRatioH = working.ratio === 'original' ? Math.max (1, (await loadImage (photo.data)).height / Math.max ((await loadImage (photo.data)).width,
      (await loadImage (photo.data)).height) * 20) : working.h
    }
    else photo.crop = cleanCrop (working);
    await save ();
    next ()
  }
}

function selectedPhotos () {
  const v = currentVersion ();
  return allPhotos ().filter (p => ! v.excluded.includes ('photo:' + p.id) && (! p.owner || ! v.excluded.includes (p.owner)) &&
  (! p.module || ! v.disabled.includes (p.module)));
}

function photoArray (owner) {
  const x = ownerObject3 (owner);
  if (! x) return null;
  x.photos ||= [];
  return x.photos
}

async function uploadBatch (files, target) {
  return importAssets3 (files, target)
}

export { uploadPhotos, photoTiles, cropAspect, cropCanvas, exportPhotoData, avatarData, openCropDialog, selectedPhotos, photoArray, uploadBatch };

// All controls for this feature, in their original override order.
function bindImagesControls () {
  if ($ ('#awardPhotos')) $ ('#awardPhotos').onchange = uploadPhotos;
  $$ ('[data-remove-photo]').forEach (b => b.onclick = async () => {
    ctx.state.awardDraft.photos.splice (Number (b.dataset.removePhoto), 1); await save (); render ();
  });
  $$ ('[data-upload]').forEach (e => e.onchange = () => uploadBatch (e.files, e.dataset.upload));
  $$ ('[data-crop-photo]').forEach (e => e.onclick = () => {
    const parts = e.dataset.cropPhoto.split (':'), i = Number (parts.pop ()); openCropDialog (parts.join (':'), i)
  });
  $$ ('[data-avatar-ratio]').forEach (e => e.onchange = () => {
    currentVersion () [e.dataset.avatarRatio === 'w' ? 'avatarRatioW' : 'avatarRatioH'] = clamp (e.value, 1, 20, 2); changed (false)
  });
  $$ ('[data-crop]').forEach (e => {
    e.oninput = () => {
      ctx.state.avatarCrop [e.dataset.crop] = Number (e.value); e.previousElementSibling.textContent = e.value; const img = $ ('.avatar-thumb img'); if (img) {
        img.style.objectPosition = ctx.state.avatarCrop.x + '% ' + ctx.state.avatarCrop.y + '%'; img.style.transform = 'scale(' +
        ctx.state.avatarCrop.zoom + ')'; img.style.transformOrigin = ctx.state.avatarCrop.x + '% ' + ctx.state.avatarCrop.y +
        '%'
      }
      scheduleSave ()
    }; e.onchange = () => changed (false)
  });
  $$ ('[data-photo-caption]').forEach (e => e.oninput = () => {
    const [o, i] = e.dataset.photoCaption.split (':'); photoArray (o) [Number (i)].caption = e.value; changed (false)
  });
  $$ ('[data-photo-move]').forEach (e => e.onclick = () => {
    const [o, i, d] = e.dataset.photoMove.split (':'); moveIn (photoArray (o), Number (i), Number (d)); changed ()
  });
  $$ ('[data-photo-delete]').forEach (e => e.onclick = async () => {
    if (! await confirmAction (tr ('移除照片？', 'Remove photo?'), tr ('将从素材库中移除这张照片。', 'This photo will be removed from your materials.'))) return; const [o,
    i] = e.dataset.photoDelete.split (':'); photoArray (o).splice (Number (i), 1); changed ()
  });
  $$ ('[data-media-link]').forEach (e => e.onchange = () => {
    ctx.state.media.find (p => p.id === e.dataset.mediaLink).link = e.value; changed (false)
  });
}
export { bindImagesControls };
