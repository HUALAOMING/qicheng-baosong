import {mountCropEditor532} from '../crop-editor532.js';
import {rotatedSize532,cropRect532,normalizedCropRect532,fitCropRect532} from '../crop-geometry532.js';
import { $, $$, clamp, esc, loadImage, toast, tr, moveIn } from '../utils/helpers.js';
import { cleanCrop, currentVersion } from '../model.js';
import { ctx } from '../state.js';
import { storage } from '../storage.js';
import { render, changed, confirmAction } from '../app.js';
import { save, scheduleSave } from '../autosave.js';
import { allPhotos } from './resume.js';
import { importAssets3, ownerObject3 } from './materials.js';
// 启程 · js/modules/images.js


async function uploadPhotos (e) {
  return uploadBatch (e.target.files, 'awardDraft')
}

function photoTiles (photos, owner) {
  return '<div class="media-grid">' + photos.map ((p, i) => '<article class="media-tile"><img data-original-asset521="' + esc(p.assetId||'') + '" src="' + esc (p.data) +
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
  const img=await loadImage(data),c=cleanCrop(crop),size=rotatedSize532(img.width,img.height,c.rotation||0);
  if(c.rotation&&!c.rect)c.rect=normalizedCropRect532(cropRect532(c,size.width,size.height,cropAspect(c,size)),size.width,size.height);
  if(c.rect&&['id','square','circle'].includes(c.ratio)){
    const region=fitCropRect532(c.rect.w*size.width,c.rect.h*size.height,cropAspect(c,size));
    c.rect={x:c.rect.x+region.x/size.width,y:c.rect.y+region.y/size.height,w:region.w/size.width,h:region.h/size.height};
  }
  const ratio=c.rect ? (c.rect.w*size.width)/(c.rect.h*size.height) : cropAspect(c,size);
  let cw=480,ch=Math.round(cw/ratio);if(ch>1200){ch=1200;cw=Math.round(ch*ratio);}
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,cw);canvas.height=Math.max(1,ch);
  const x=canvas.getContext('2d');
  if(c.ratio==='circle'){x.beginPath();x.arc(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)/2,0,Math.PI*2);x.clip();}
  else{x.fillStyle='#fff';x.fillRect(0,0,canvas.width,canvas.height);}
  if(c.rect){
    const sx=canvas.width/(c.rect.w*size.width),sy=canvas.height/(c.rect.h*size.height);
    x.scale(sx,sy);x.translate(size.width/2-c.rect.x*size.width,size.height/2-c.rect.y*size.height);x.rotate((c.rotation||0)*Math.PI/180);x.drawImage(img,-img.width/2,-img.height/2);
  }else{
    const scale=Math.max(canvas.width/img.width,canvas.height/img.height)*c.zoom,w=img.width*scale,h=img.height*scale;
    x.drawImage(img,(canvas.width-w)*c.x/100,(canvas.height-h)*c.y/100,w,h);
  }
  return canvas;
}

async function exportPhotoData (photo) {
  photo={...photo,data:await storage.photoData(photo,ctx.state)};
  const c = cleanCrop (photo.crop);
  if (!c.rect && !c.rotation && c.ratio === 'original' && c.zoom === 1 && c.x === 50 && c.y === 50 && /^data:image\/(jpeg|png);/.test (photo.data)) return photo.data;
  const canvas = await cropCanvas (photo.data, c);
  return canvas.toDataURL (c.ratio === 'circle' ? 'image/png' : 'image/jpeg', .92)
}

async function avatarData () {
  if (! ctx.state.avatar) return null;
  const v = currentVersion (), crop = {
    ...ctx.state.avatarCrop, ratio : v.avatarShape, w : v.avatarRatioW, h : v.avatarRatioH
  }, canvas = await cropCanvas (await storage.photoData(ctx.state.avatar,ctx.state), crop);
  return canvas.toDataURL ('image/png')
}

async function openCropDialog(owner,index,queue=[]) {
 const photo=owner==='avatar'?ctx.state.avatar:photoArray(owner)?.[index];if(!photo)return;
 const data=await storage.photoData(photo,ctx.state),img=await loadImage(data),v=currentVersion();
 const working=owner==='avatar'?cleanCrop({...ctx.state.avatarCrop,ratio:v.avatarShape,w:v.avatarRatioW,h:v.avatarRatioH}):cleanCrop(photo.crop);
 let dialog=$('#cropDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='cropDialog';dialog.className='crop-dialog';document.body.appendChild(dialog);}
 const next=()=>{dialog.close();if(queue.length){const item=queue.shift();openCropDialog(item.owner,item.index,queue);}else render();};
 mountCropEditor532(dialog,img,working,{name:photo.name,queueLength:queue.length,cancel:next,close:()=>{dialog.close();render();},apply:async value=>{
  try{
   if(owner==='avatar'){
    ctx.state.avatarCrop={x:value.x,y:value.y,zoom:value.zoom,rotation:value.rotation,rect:value.rect};
    v.avatarShape=value.ratio==='original'?'custom':value.ratio;
    const size=rotatedSize532(img.width,img.height,value.rotation),rw=value.rect.w*size.width,rh=value.rect.h*size.height;
    v.avatarRatioW=Math.max(1,rw/Math.max(rw,rh)*20);v.avatarRatioH=Math.max(1,rh/Math.max(rw,rh)*20);
   }else photo.crop=cleanCrop(value);
   await save();next();
  }catch(error){toast(error.message);}
 }});
 dialog.showModal();
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
  const thumb=$('[data-crop-avatar532]'),avatar=ctx.state.avatar;if(thumb&&avatar)avatarData().then(data=>{if(thumb.isConnected&&ctx.state.avatar===avatar)thumb.src=data;}).catch(()=>{});
  for(const url of originalViewURLs521)URL.revokeObjectURL(url);originalViewURLs521.clear();
  $$('[data-original-asset521]').forEach(async img=>{
    const asset=ctx.state.assets.find(a=>a.id===img.dataset.originalAsset521);if(!asset?._assetBlobRef)return;
    try{const blob=await storage.assetBlob(asset);if(!img.isConnected)return;const url=URL.createObjectURL(blob);originalViewURLs521.add(url);img.src=url;}catch(error){img.alt='原图读取失败：'+error.message;}
  });

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

const originalViewURLs521=new Set();
