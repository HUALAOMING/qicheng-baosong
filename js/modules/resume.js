import { ctx } from '../state.js';
import { $, $$, checkbox, esc, flip, head, heading3, icon3, tr, translateLabel, clamp } from '../utils/helpers.js';
import { photoTiles, selectedPhotos } from './images.js';
import { cleanCrop, currentVersion, fieldVisible, moduleStyle } from '../model.js';
import { ACHIEVEMENT_FIELDS, AWARD_FIELDS, BOOK_FIELDS, EDU_FIELDS, EXAM_FIELDS, EXP_FIELDS, MODULE_NAMES, PROFILE, THEMES, MODULES } from '../constants.js';
import { avatarEditor, draftHasContent } from './profile.js';
import { changed, render, v2Action } from '../app.js';
import { EN } from '../data.js';
import { assetBy3, attachmentPanel3, ownerObject3 } from './materials.js';
import { numeric3 } from './dashboard.js';
import { scheduleSave } from '../autosave.js';
import { refreshPreview } from './export.js';
// 启程 · js/modules/resume.js


function customPage () {
  return head ('PERSONAL / CUSTOM CONTENT', tr ('加入属于你的内容。', 'Make room for your own story.'), tr ('添加研究、作品、推荐评价等自由图文模块；在导出页决定是否使用。',
  'Add research, work samples, recommendations or other text and images. Choose what to include when exporting.')) +
  '<div class="actions"><button class="primary" data-v2="addBlock">＋ ' + tr ('添加图文模块', 'Add a content block') + '</button></div><div class="custom-blocks">' +
  (ctx.state.customBlocks.length ? ctx.state.customBlocks.map ((b, i) => '<section class="panel custom-block"><div class="panel-title"><h2>' +
  tr ('模块', 'Block') + ' ' + (i + 1) + '</h2><div class="actions"><button data-block-move="' + b.id + ':-1">↑</button><button data-block-move="' +
  b.id + ':1">↓</button><button data-block-delete="' + b.id + '">' + tr ('删除模块', 'Delete block') + '</button></div></div><label class="field"><span>' +
  tr ('模块标题', 'Block title') + '</span><input data-block="' + b.id + '" data-key="title" value="' + esc (b.title) +
  '"></label><label class="field"><span>' + tr ('内容', 'Content') + '</span><textarea data-block="' + b.id + '" data-key="text" rows="6" placeholder="' +
  tr ('支持分段和项目列表；排版将在导出预览中显示。', 'Use paragraphs and bullet lists; check the result in the export preview.') + '">' +
  esc (b.text) + '</textarea></label><label class="field"><span>' + tr ('图文布局', 'Block layout') + '</span><select data-block="' +
  b.id + '" data-key="layout">' + [['stack', '文字在上，图片在下', 'Text above photos'], ['left', '左图右文', 'Image left, text right'],
  ['right', '左文右图', 'Text left, image right'], ['gallery', '图片组', 'Photo gallery'], ['text', '仅文字', 'Text only']].map (([k,
  z, e]) => '<option value="' + k + '" ' + (b.layout === k ? 'selected' : '') + '>' + tr (z, e) + '</option>').join ('') +
  '</select></label><label class="file-button">' + tr ('批量上传图片', 'Upload photos in batches') + '<input type="file" data-upload="block:' +
  b.id + '" accept="image/*" multiple hidden></label>' + photoTiles (b.photos, 'block-' + b.id) + '</section>').join ('') : '<div class="panel empty">' +
  tr ('暂无自定义内容。可以先添加一个模块，再输入文字或照片。', 'No custom content yet. Add a block to begin.') + '</div>') + '</div>';
}

function vSelect (key, label, opts) {
  const v = currentVersion ();
  return '<label class="field"><span>' + label + '</span><select data-v-setting="' + key + '">' + opts.map (([k, l]) =>
  '<option value="' + k + '" ' + (String (v [key]) === String (k) ? 'selected' : '') + '>' + l + '</option>').join ('') +
  '</select></label>';
}

function slider (key, label, min, max, step, unit) {
  const v = currentVersion ();
  return '<label class="slider-field"><span>' + label + ' <output id="out-' + key + '">' + v [key] + unit + '</output></span><div><input type="range" data-v-range="' +
  key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v [key] + '"><input aria-label="' + label +
  '" type="number" data-v-number="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v [key] +
  '"></div></label>';
}

function stylePanel () {
  const v = currentVersion (), opts = (key, field, choices, value) => '<label class="field"><span>' + key + '</span><select data-module-style="' +
  field + '">' + choices.map (([id, label]) => '<option value="' + id + '" ' + (value === id ? 'selected' : '') + '>' +
  label + '</option>').join ('') + '</select></label>', range = (key, field, min, max, value) => '<label class="field"><span>' +
  key + ' <output>' + value + ' pt</output></span><input type="range" data-module-style="' + field + '" min="' + min +
  '" max="' + max + '" step=".5" value="' + value + '"></label>';
  return '<div class="style-main">' + vSelect ('palette', tr ('简历配色', 'Resume palette'), [...Object.entries (THEMES).map (([k,
  x]) => [k, translateLabel (x)]), ['bw', tr ('纯黑白', 'Black & white')]]) + vSelect ('background', tr ('背景方式', 'Background'),
  [['accent', tr ('白底强调色', 'White with accents')], ['full', tr ('完整主题背景', 'Full theme background')], ['none', tr ('白底黑字',
  'Plain black & white')]]) + vSelect ('orientation', tr ('纸张方向', 'Page orientation'), [['portrait', tr ('A4 纵向', 'A4 portrait')],
  ['landscape', tr ('A4 横向', 'A4 landscape')]]) + vSelect ('exportLang', tr ('导出标题语言', 'Export label language'), [['zh',
  '中文'], ['en', 'English']]) + '<div class="actions">' + [['compact', '紧凑', 'Compact'], ['standard', '标准', 'Standard'],
  ['airy', '舒展', 'Spacious']].map (([k, z, e]) => '<button data-preset="' + k + '">' + tr (z, e) + '</button>').join ('') +
  '</div>' + slider ('margin', tr ('四边页边距', 'Page margins'), 8, 32, 1, ' mm') + slider ('fontSize', tr ('正文字号', 'Body font size'),
  8, 16, .5, ' pt') + slider ('lineHeight', tr ('行距', 'Line spacing'), 1.1, 2, .05, '×') + slider ('gap', tr ('模块间距',
  'Section spacing'), 2, 24, 1, ' pt') + '</div><section class="export-appearance"><div><h3>' + tr ('纸面装饰', 'Paper finish') + '</h3><p class="hint">' +
  tr ('默认保持简洁。需要时再加细框或短强调线，颜色随当前简历配色。', 'A restrained default. Add a fine frame or short accent rule when useful; colors follow the document palette.') +
  '</p></div>' + vSelect ('pageDecoration', tr ('装饰样式', 'Decoration'), [['plain', tr ('简洁 · 细分隔线（默认）', 'Simple · fine rule (default)')], ['frame', tr ('细框 · 四边留白', 'Fine frame · generous edges')], ['editorial', tr ('刊物 · 短强调线', 'Editorial · short accent')]]) +
  '<div class="export-finish-samples" aria-hidden="true"><i class="finish-plain"></i><i class="finish-frame"></i><i class="finish-editorial"></i></div></section><h3>' + tr ('分别设置各模块标题', 'Style individual sections') + '</h3><div class="module-style-grid">' +
  v.order.map (k => {
    const st = moduleStyle (k, v); return '<details class="module-style"><summary>' + esc (v.titles [k]?.trim () || tr (...MODULE_NAMES [k])) +
    '</summary><div class="style-controls">' + range (tr ('大标题字号', 'Section title size'), k + ':titleSize', 10, 28, st.titleSize) +
    opts (tr ('大标题对齐', 'Section title alignment'), k + ':titleAlign', [['left', tr ('靠左', 'Left')], ['center', tr ('居中',
    'Center')]], st.titleAlign) + checkbox (st.titleBold, 'data-module-style="' + k + ':titleBold"', tr ('大标题加粗', 'Bold section title')) +
    range (tr ('小标题字号', 'Item title size'), k + ':subtitleSize', 9, 20, st.subtitleSize) + opts (tr ('小标题对齐', 'Item title alignment'),
    k + ':subtitleAlign', [['left', tr ('靠左', 'Left')], ['center', tr ('居中', 'Center')]], st.subtitleAlign) + checkbox (st.subtitleBold,
    'data-module-style="' + k + ':subtitleBold"', tr ('小标题加粗', 'Bold item title')) + checkbox (st.labelBold, 'data-module-style="' +
    k + ':labelBold"', tr ('字段名称加粗', 'Bold field names')) + '</div></details>'
  }).join ('') + '</div>';
}

function mediaPanel22 () {
  const v = currentVersion ();
  return avatarEditor () + checkbox (v.showAvatar, 'data-v-bool="showAvatar"', tr ('导出个人头像', 'Include portrait')) +
  slider ('avatarSize', tr ('头像尺寸', 'Portrait size'), 20, 48, 1, ' mm') + vSelect ('avatarShape', tr ('头像形状', 'Portrait shape'),
  [['square', tr ('方形 1:1', 'Square 1:1')], ['circle', tr ('圆形', 'Circle')], ['id', tr ('证件照长方形 2:3', 'ID photo rectangle 2:3')],
  ['custom', tr ('自定义比例', 'Custom ratio')]]) + (v.avatarShape === 'custom' ? '<div class="crop-custom"><label>' + tr ('头像宽度比例',
  'Portrait ratio width') + '<input type="number" data-avatar-ratio="w" min="1" max="20" step=".1" value="' + v.avatarRatioW +
  '"></label><span>:</span><label>' + tr ('高度比例', 'Height') + '<input type="number" data-avatar-ratio="h" min="1" max="20" step=".1" value="' +
  v.avatarRatioH + '"></label></div>' : '') + vSelect ('photoMode', tr ('证书、证明及内容照片', 'Evidence and content photos'),
  [['appendix', tr ('全部集中到文件末尾', 'Collect all at the end')], ['inline', tr ('随对应内容显示', 'Show with related content')],
  ['none', tr ('不导出这些照片', 'Hide these photos')]]) + vSelect ('photosPerRow', tr ('每行照片数', 'Photos per row'), [[1, '1'],
  [2, '2'], [3, '3']]) + '<p class="hint">' + tr ('文末模式保留对应模块名称与说明；头像仍在基本信息中。未勾选的内容及照片不会导出。', 'Appendices retain the related heading and captions. The portrait stays with basic information. Deselected content and photos are excluded.') +
  '</p><label class="file-button primary">' + tr ('批量上传证明 / 活动照片', 'Batch upload evidence / activity photos') + '<input type="file" data-upload="media" accept="image/*" multiple hidden></label>' +
  photoTiles (ctx.state.media, 'media') + ctx.state.media.map (p => '<label class="field"><span>' + esc (p.name) + ' · ' +
  tr ('关联内容', 'Related content') + '</span><select data-media-link="' + p.id + '">' + [['', tr ('独立附件', 'Standalone attachment')],
  ...ctx.state.awards.map (a => ['awards:' + a.id, a.title]), ...ctx.state.experiences.map (a => ['experiences:' + a.id,
  a.title]), ...ctx.state.practices.map (a => ['practices:' + a.id, a.title]), ...ctx.state.achievements.map (a => ['achievements:' +
  a.id, a.title]), ...ctx.state.learning.books.map (a => ['learning:' + a.id, a.title]), ...ctx.state.customBlocks.map (a =>
  ['custom:' + a.id, a.title])].map (([k, l]) => '<option value="' + k + '" ' + (p.link === k ? 'selected' : '') + '>' +
  esc (l) + '</option>').join ('') + '</select></label>').join ('') + '<h3>' + tr ('选择导出照片', 'Choose photos to export') +
  '</h3>' + allPhotos ().map (p => checkbox (! v.excluded.includes ('photo:' + p.id), 'data-select-item="photo:' + p.id +
  '"', esc (p.caption || p.name)) + (p.caption ? checkbox (fieldVisible ('photo:' + p.id + ':caption'), 'data-field-choice="photo:' +
  p.id + ':caption"', tr ('导出说明：', 'Export caption: ') + esc (p.caption)) : '')).join ('');
}

function filesPanel22 () {
  const v = currentVersion ();
  return '<div class="export-pagination-options">' + checkbox (v.showToc, 'data-v-bool="showToc"', tr ('添加独立目录页（列出已导出的模块）', 'Add a separate contents page')) +
  checkbox (v.showPageNumbers !== false, 'data-v-bool="showPageNumbers"', tr ('显示页码 / 总页数', 'Show page number / total pages')) + '</div><p class="hint">' +
  tr ('PDF、PNG、HTML 与 PPTX 共用分页，目录计入总页数，目录页码指向实际页。Word 使用自动目录和页码域：打开后在目录上选择“更新整个目录”；编辑后再次更新。Markdown 为连续文本，不显示页码。', 'PDF, PNG, HTML and PPTX share physical pagination, including contents pages. Word uses dynamic contents and page-number fields: choose Update entire table after opening and again after edits. Markdown is continuous text without page numbers.') +
  '</p><div class="download-formats">' + [['pdf', 'PDF', tr ('可选择、复制的文字；固定分页', 'Selectable text; fixed pages')], ['docx',
  'Word', tr ('原生段落、可编辑内容', 'Native editable paragraphs')], ['pptx', 'PowerPoint', tr ('可编辑文本框与图片', 'Editable text boxes and images')],
  ['png', 'PNG', tr ('多页打包 ZIP', 'Multiple pages in a ZIP')], ['html', 'HTML', tr ('独立展示网页', 'Standalone display page')],
  ['md', 'Markdown', tr ('纯文字内容', 'Text-only content')]].map (([k, l, d]) => '<button class="export-btn" data-export="' +
  k + '"><strong>' + l + '</strong><small>' + d + '</small></button>').join ('') + '</div><h3>' + tr ('Word 选项', 'Word options') +
  '</h3>' + checkbox (v.wordBW, 'data-v-bool="wordBW"', tr ('黑白 Word，便于后期修改', 'Black-and-white Word')) + checkbox (v.wordImages,
  'data-v-bool="wordImages"', tr ('Word 包含已选择的图片', 'Include selected photos in Word')) + vSelect ('pptMode', tr ('PPTX 模式',
  'PPTX mode'), [['editable', tr ('可编辑文字与图片', 'Editable text and images')], ['image', tr ('整页图片，保持外观', 'Full-page images for fidelity')]]) +
  '<p class="hint">' + tr ('黑白 PDF：在“排版”中选择“纯黑白”。Word / PPT 的字体和换行可能随设备变化，提交前请在目标软件检查。', 'For a monochrome PDF, choose Black & white in Layout. Fonts and line breaks in Word/PPT may vary by device; check in the destination app before submission.') +
  '</p>';
}

function orderPanel () {
  const v = currentVersion ();
  return '<div class="composer-intro"><div><h2>' + tr ('调整模块顺序与显示', 'Arrange sections and visibility') + '</h2><p>' +
  tr ('拖住左侧手柄移动，其他模块会让出位置；右侧勾选决定整块是否导出。', 'Drag the handle to reorder. The other sections move aside; the checkbox controls whether an entire section is included.') +
  '</p></div></div><div class="module-order" id="moduleOrder">' + v.order.map ((k, i) => '<div class="module-order-row ' +
  (v.disabled.includes (k) ? 'is-disabled' : '') + '" data-order-key="' + k + '"><button type="button" class="order-handle" data-order-handle="' +
  k + '" aria-pressed="false" aria-label="' + tr ('拖动', 'Drag') + '">⠿</button><strong>' + esc (v.titles [k]?.trim () || tr (...MODULE_NAMES [k])) +
  '</strong><label class="order-visibility"><input type="checkbox" data-order-visible="' + k + '" ' + (v.disabled.includes (k) ?
  '' : 'checked') + '><span>' + tr ('显示', 'Show') + '</span></label><div class="order-arrows"><button data-module-move="' +
  k + ':-1" aria-label="' + tr ('上移', 'Move up') + '" ' + (i === 0 ? 'disabled' : '') + '>↑</button><button data-module-move="' +
  k + ':1" aria-label="' + tr ('下移', 'Move down') + '" ' + (i === v.order.length - 1 ? 'disabled' : '') + '>↓</button></div></div>').join ('') +
  '</div><p id="orderStatus" class="order-status hint" role="status" aria-live="polite">'+tr('拖动手柄，或聚焦手柄后按 ↑ ↓ 调整。Esc 取消移动。','Drag a handle, or focus it and use ↑ ↓. Press Esc to cancel a drag.')+'</p><button class="primary order-next" data-studio-tab="files">' + tr ('下一步：导出文件 →', 'Next: export files →') +
  '</button>';
}

function orderRows () {
  return [...($$ ('#moduleOrder .module-order-row'))]
}

// Small, interruptible springs for this list only. Positions and velocities survive retargeting.
const orderSprings = new Map();
let orderFrame = 0, orderCleanup = null;
const orderReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
function orderSpringFrame(now) {
  orderFrame = 0;
  for (const [row, spring] of orderSprings) {
    const dt = Math.min(.032, Math.max(.001, (now-spring.time)/1000));
    spring.time = now;
    // Analytic critically damped spring: stable even after a backgrounded frame.
    for (const axis of ['x','y']) {
      const velocity = axis==='x'?'vx':'vy', displacement=spring[axis], v=spring[velocity];
      const decay=Math.exp(-24*dt), c=v+24*displacement;
      spring[axis]=(displacement+c*dt)*decay;
      spring[velocity]=(v-24*c*dt)*decay;
    }
    row.style.transform='translate3d('+spring.x+'px,'+spring.y+'px,0)';
    if (Math.abs(spring.x)+Math.abs(spring.y)<.15 && Math.abs(spring.vx)+Math.abs(spring.vy)<2) {
      row.style.transform=''; row.classList.remove('order-moving','order-released'); orderSprings.delete(row); spring.done?.();
    }
  }
  if(orderSprings.size)orderFrame=requestAnimationFrame(orderSpringFrame);
}
function orderSpring(row,x,y,vx=0,vy=0,done) {
  if(orderReducedMotion()){row.style.transform='';row.classList.remove('order-moving','order-released');done?.();return;}
  orderSprings.set(row,{x,y,vx,vy,time:performance.now(),done});
  row.style.transform='translate3d('+x+'px,'+y+'px,0)';row.classList.add('order-moving');
  if(!orderFrame)orderFrame=requestAnimationFrame(orderSpringFrame);
}
function cancelOrderInteraction() { orderCleanup?.(); }
export { cancelOrderInteraction };

function settleOrder () {
  const rows=orderRows(), v=currentVersion(), next=rows.map(row=>row.dataset.orderKey);
  rows.forEach((row,index)=>{
    row.querySelector('[data-module-move$=":-1"]').disabled=index===0;
    row.querySelector('[data-module-move$=":1"]').disabled=index===rows.length-1;
    row.querySelector('[data-order-handle]').setAttribute('aria-label',tr('拖动或按上下方向键调整：','Drag or use arrow keys to move: ')+row.querySelector('strong').textContent+'，'+(index+1)+' / '+rows.length);
  });
  if(v.order.join('|')===next.join('|'))return;
  v.order=next;changed(false);
  const status=$('#orderStatus');if(status)status.textContent=tr('顺序已调整，将自动保存。','Order updated. Saving automatically.');
}
function flipOrder(mutate) {
  const rows=orderRows(), before=new Map(rows.map(row=>[row,row.getBoundingClientRect()]));
  const velocities=new Map(rows.map(row=>[row,orderSprings.get(row)]));
  mutate();
  for(const row of rows){row.style.transform='';orderSprings.delete(row);}
  for(const row of rows){
    if(row.classList.contains('drag-placeholder'))continue;
    const first=before.get(row),last=row.getBoundingClientRect(),previous=velocities.get(row);
    orderSpring(row,first.left-last.left,first.top-last.top,previous?.vx||0,previous?.vy||0);
  }
}
function animateOrderMove(button) {
  const row=button.closest('.module-order-row'),dir=Number(button.dataset.moduleMove.split(':')[1]),target=dir<0?row.previousElementSibling:row.nextElementSibling;
  if(!target)return;
  flipOrder(()=>row.parentElement.insertBefore(row,dir<0?target:target.nextElementSibling));
  settleOrder();
}
function bindModuleOrder() {
  const list=$('#moduleOrder');if(!list)return;
  let drag=null,scrollFrame=0;
  const finish=(cancel=false)=>{
    if(!drag)return;
    const d=drag;drag=null;cancelAnimationFrame(scrollFrame);scrollFrame=0;
    document.removeEventListener('pointermove',move,true);
    document.removeEventListener('pointerup',up,true);
    document.removeEventListener('pointercancel',cancelPointer,true);
    document.removeEventListener('keydown',escape,true);
    if(list.hasPointerCapture?.(d.pointerId))list.releasePointerCapture(d.pointerId);
    d.handle.classList.remove('is-grabbed');d.handle.setAttribute('aria-pressed','false');
    if(!d.ghost){
      if(d.frozen)orderSpring(d.row,d.frozen.x,d.frozen.y,d.frozen.vx,d.frozen.vy);
      return;
    }
    if(cancel)flipOrder(()=>d.before.forEach(row=>list.appendChild(row)));
    else settleOrder();
    d.row.classList.remove('drag-placeholder');
    const target=d.row.getBoundingClientRect(),rect=d.ghost.getBoundingClientRect();
    // Release velocity is bounded so an abrupt flick cannot throw the row off-screen.
    const fresh=performance.now()-d.sampleTime<100;
    d.ghost.remove();
    // Hand motion to the real row, so it can be grabbed again while it settles.
    d.row.classList.add('order-released');
    orderSpring(d.row,rect.left-target.left,rect.top-target.top,fresh?Math.max(-900,Math.min(900,d.vx)):0,fresh?Math.max(-900,Math.min(900,d.vy)):0);
    d.handle.focus({preventScroll:true});
    if(cancel){const status=$('#orderStatus');if(status)status.textContent=tr('已取消移动，顺序未更改。','Move cancelled. Order unchanged.');}
  };
  const position=()=>{
    if(!drag?.ghost)return;
    const d=drag;
    // Keep the original grab offset, tracking the pointer directly without an easing delay.
    d.ghost.style.transform='translate3d('+(d.x-d.startX)+'px,'+(d.y-d.startY)+'px,0)';
    const center=d.y-d.dy+d.height/2,others=orderRows().filter(row=>row!==d.row);
    const target=others.find(row=>{const rect=row.getBoundingClientRect();return center<rect.top-(orderSprings.get(row)?.y||0)+rect.height/2;});
    const next=target||null;
    if(d.row.nextElementSibling!==next)flipOrder(()=>{list.insertBefore(d.row,next);});
  };
  const autoScroll=()=>{
    scrollFrame=0;if(!drag?.ghost)return;
    const edge=80,speed=drag.y<edge?-Math.min(18,(edge-drag.y)*.24):drag.y>innerHeight-edge?Math.min(18,(drag.y-innerHeight+edge)*.24):0;
    if(speed){window.scrollBy(0,speed);position();}
    scrollFrame=requestAnimationFrame(autoScroll);
  };
  const move=e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const d=drag,now=performance.now(),dt=Math.max(8,now-d.sampleTime);
    d.vx=(e.clientX-d.x)/dt*1000;d.vy=(e.clientY-d.y)/dt*1000;d.sampleTime=now;d.x=e.clientX;d.y=e.clientY;
    if(!d.ghost){
      if(Math.hypot(d.x-d.startX,d.y-d.startY)<7)return;
      d.ghost=d.row.cloneNode(true);d.ghost.classList.add('order-drag-float');d.ghost.setAttribute('aria-hidden','true');d.ghost.inert=true;
      Object.assign(d.ghost.style,{left:d.left+'px',top:d.top+'px',width:d.width+'px',height:d.height+'px',transform:''});
      document.body.appendChild(d.ghost);d.row.classList.add('drag-placeholder');d.row.style.transform='';
      scrollFrame=requestAnimationFrame(autoScroll);
    }
    position();e.preventDefault();
  };
  const up=e=>{if(drag&&e.pointerId===drag.pointerId){finish(false);e.preventDefault();}};
  const cancelPointer=e=>{if(drag&&e.pointerId===drag.pointerId)finish(true);};
  const escape=e=>{if(e.key==='Escape'){e.preventDefault();finish(true);}};
  $$('[data-order-visible]').forEach(input=>input.onchange=()=>{
    flip(currentVersion().disabled,input.dataset.orderVisible,!input.checked);input.closest('.module-order-row').classList.toggle('is-disabled',!input.checked);changed(false);
  });
  $$('[data-order-handle]').forEach(handle=>{
    handle.onpointerdown=e=>{
      if(drag||!e.isPrimary||e.button!==0)return;
      const row=handle.closest('.module-order-row'),rect=row.getBoundingClientRect();
      const frozen=orderSprings.get(row);orderSprings.delete(row);
      drag={row,handle,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,left:rect.left,top:rect.top,width:rect.width,height:rect.height,before:orderRows(),ghost:null,vx:0,vy:0,sampleTime:performance.now(),frozen};
      list.setPointerCapture?.(e.pointerId);handle.classList.add('is-grabbed');handle.setAttribute('aria-pressed','true');handle.focus({preventScroll:true});
      document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancelPointer,true);document.addEventListener('keydown',escape,true);e.preventDefault();
    };
    handle.onkeydown=e=>{
      if(drag||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
      e.preventDefault();const row=handle.closest('.module-order-row');
      if(e.key==='Home'||e.key==='End'){
        flipOrder(()=>list.insertBefore(row,e.key==='Home'?list.firstElementChild:null));settleOrder();
      }else animateOrderMove(row.querySelector('[data-module-move$=":'+(e.key==='ArrowUp'?-1:1)+'"]'));
      handle.focus({preventScroll:true});
    };
  });
  list.onlostpointercapture=()=>{if(drag)finish(true);};
  orderCleanup=()=>{
    finish(true);cancelAnimationFrame(orderFrame);orderFrame=0;
    for(const [row,spring] of orderSprings){row.style.transform='';row.classList.remove('order-moving','order-released');spring.done?.();}
    orderSprings.clear();orderCleanup=null;
  };
}


const exportLabel = (z, e) => currentVersion ().exportLang === 'en' ? e : z;

function exportRows22 () {
  const v = currentVersion (), out = [], photos = v.photoMode === 'none' ? [] : selectedPhotos ();
  const allowed = k => ! v.disabled.includes (k), visible = (key, defaultOn = true) => fieldVisible (key, defaultOn),
  selected = (k, x) => ! v.excluded.includes (k + ':' + x.id);
  const section = (key, title) => ( {
    kind : 'section', text : v.titles [key]?.trim () || title, module : key, breakBefore : v.breaks.includes (key)
  });
  const body = (text, kind = 'body', fieldKey = '') => ( {
    kind, text, fieldKey
  });
  const field = (label, value, kind = 'body', fieldKey = '') => ( {
    kind, label : label + '：', value : String (value), text : label + '：' + value, fieldKey
  });
  const scoped = (kind, item, key) => kind + ':' + item.id + ':' + key;
  for (const key of v.order) {
    if (! allowed (key)) continue;
    const r = [];
    if (key === 'profile') for (const [k, l] of PROFILE) {
      const val = k === 'targetSchool' && v.target ? v.target : ctx.state.profile [k];
      if (val && visible ('profile.' + k)) r.push (field (exportLabel (l, EN [l] || l), val, 'meta', 'profile.' + k))
    }
    if (key === 'education') for (const x of ctx.state.education.filter (x => selected ('education', x))) {
      const filled = EDU_FIELDS.some (([k]) => x [k]);
      if (! filled) continue;
      const stageKey = scoped ('education', x, 'stage');
      if (visible (stageKey)) r.push (body (exportLabel (x.stage, EN [x.stage] || x.stage), 'entry', stageKey));
      for (const [k, l] of EDU_FIELDS) if (x [k] && visible (scoped ('education', x, k))) r.push (field (exportLabel (l,
      EN [l] || l), x [k], 'body', scoped ('education', x, k)))
    }
    if (key === 'statement') {
      if (ctx.state.statement.zh && visible ('statement.zh')) r.push (body (ctx.state.statement.zh, 'body', 'statement.zh'));
      if (ctx.state.statement.en && visible ('statement.en')) {
        if (ctx.state.statement.zh && visible ('statement.zh')) r.push (body ('Personal Statement', 'entry'));
        r.push (body (ctx.state.statement.en, 'body', 'statement.en'))
      }
    }
    if (key === 'academics') for (const [k, z, e] of [['languageLearning', '语言学习', 'Language learning'], ['certificates',
    '证书与等级', 'Certificates']]) if (ctx.state.academics [k] && visible ('academics.' + k)) r.push (field (exportLabel (z,
    e), ctx.state.academics [k], 'body', 'academics.' + k));
    if (key === 'strengths') for (const [k, z, e] of [['strengths', '个人特长', 'Skills'], ['hobbies', '兴趣爱好', 'Interests']]) if (ctx.state.statement [k] &&
    visible ('statement.' + k)) r.push (field (exportLabel (z, e), ctx.state.statement [k], 'body', 'statement.' + k));
    if (key === 'exams') for (const x of ctx.state.exams.filter (x => selected ('exams', x))) {
      if (x.title && visible (scoped ('exams', x, 'title'))) r.push (body (x.title, 'entry', scoped ('exams', x, 'title')));
      for (const [k, l] of EXAM_FIELDS) if (k !== 'title' && x [k] && visible (scoped ('exams', x, k))) r.push (field (exportLabel (l,
      EN [l] || l), x [k], 'body', scoped ('exams', x, k)));
      for (const [index, sub] of x.subjects.entries ()) {
        if (! [sub.name, sub.score, sub.fullMark, sub.rank].some (Boolean)) continue;
        for (const [k, z, e] of [['name', '科目名称', 'Subject'], ['score', '分科成绩', 'Score'], ['fullMark', '科目满分', 'Full mark'],
        ['rank', '单科排名', 'Subject rank']]) if (sub [k] && visible (scoped ('exams', x, 'subjects:' + sub.id + ':' + k))) r.push (field (exportLabel (z,
        e), sub [k], 'body', scoped ('exams', x, 'subjects:' + sub.id + ':' + k)))
      }
    }
    if (key === 'awards' || key === 'experiences') for (const x of ctx.state [key].filter (x => selected (key, x))) {
      if (x.title && visible (scoped (key, x, 'title'))) r.push (body (x.title, 'entry', scoped (key, x, 'title')));
      for (const [k, l] of key === 'awards' ? AWARD_FIELDS : EXP_FIELDS) if (k !== 'title' && x [k] && visible (scoped (key,
      x, k))) r.push (field (exportLabel (l, EN [l] || l), x [k], 'body', scoped (key, x, k)));
      if (x.priority && visible (scoped (key, x, 'priority'), false)) r.push (field (exportLabel ('整理优先级', 'Display priority'),
      x.priority, 'body', scoped (key, x, 'priority')));
      const summary = v.summaries [key + ':' + x.id];
      if (summary?.trim () && visible (scoped (key, x, 'summary'))) r.push (field (exportLabel ('简历表述', 'Resume summary'),
      summary.trim (), 'body', scoped (key, x, 'summary')));
      if (v.photoMode === 'inline') {
        const own = photos.filter (p => p.owner === key + ':' + x.id);
        if (own.length) r.push ( {
          kind : 'photos', photos : own
        })
      }
    }
    if (key === 'custom') for (const b of ctx.state.customBlocks.filter (b => selected ('custom', b))) {
      if (b.title && visible (scoped ('custom', b, 'title'))) r.push (body (b.title, 'entry', scoped ('custom', b, 'title')));
      const own = photos.filter (p => p.owner === 'custom:' + b.id), showText = b.text && visible (scoped ('custom', b,
      'text'));
      if (v.photoMode === 'inline' && b.layout !== 'text' && own.length) r.push ( {
        kind : 'custom', text : showText ? b.text : '', photos : own, layout : b.layout, fieldKey : scoped ('custom', b, 'text')
      });
      else {
        if (showText) r.push (body (b.text, 'body', scoped ('custom', b, 'text')));
        if (v.photoMode === 'inline' && own.length) r.push ( {
          kind : 'photos', photos : own
        })
      }
    }
    if (key === 'learning') {
      for (const [k, z, e] of [['readingNotes', '阅读随记与已有书单', 'Reading notes and book list'], ['plan', '学习计划', 'Study plan'],
      ['notes', '其他学习记录', 'Other learning notes']]) if (ctx.state.learning [k] && visible ('learning.' + k)) r.push (field (exportLabel (z,
      e), ctx.state.learning [k], 'body', 'learning.' + k));
      for (const x of ctx.state.learning.books.filter (x => selected ('learning', x))) {
        if (x.title && visible (scoped ('learning', x, 'title'))) r.push (body (x.title, 'entry', scoped ('learning', x, 'title')));
        for (const [k, l] of BOOK_FIELDS) if (k !== 'title' && x [k] && visible (scoped ('learning', x, k))) r.push (field (exportLabel (l,
        EN [l] || l), x [k], 'body', scoped ('learning', x, k)))
      }
    }
    if (r.length || (key === 'profile' && v.showAvatar && ctx.state.avatar)) {
      out.push (section (key, MODULE_NAMES [key] [v.exportLang === 'en' ? 1 : 0]));
      if (key === 'profile' && v.showAvatar && ctx.state.avatar) out [out.length - 1].avatar = true;
      out.push (...r.map (row => ( {
        ...row, module : key
      })))
    }
  }
  if (v.photoMode === 'appendix' && photos.length) {
    out.push ( {
      kind : 'section', text : exportLabel ('证明材料与照片附件', 'Evidence & photo appendix'), breakBefore : true, module : 'appendix'
    });
    let prev = '';
    for (const p of photos) {
      if (p.heading !== prev) {
        out.push (body (p.heading, 'entry'));
        prev = p.heading
      }
      const last = out [out.length - 1];
      if (last.kind === 'photos') last.photos.push (p);
      else out.push ( {
        kind : 'photos', photos : [p]
      })
    }
  }
  if (v.photoMode === 'inline') {
    const unattached = photos.filter (p => ! p.owner);
    if (unattached.length) out.push ( {
      kind : 'section', text : exportLabel ('补充照片', 'Additional photos'), module : 'appendix'
    }, {
      kind : 'photos', photos : unattached, module : 'appendix'
    })
  }
  return out;
}

function draftFor3 (kind) {
  return {
    awards : 'awardDraft', experiences : 'experienceDraft', practices : 'practiceDraft', achievements : 'achievementDraft',
    books : 'bookDraft', exams : 'examDraft'
  }
  [kind]
}

function customPage3 () {
  let h = customPage ();
  h = h.replace (/<section class="panel custom-block">[\s\S]*?<\/section>/g, (m) => {
    const id = m.match (/data-block="([^"]+)"/)?.[1]; if (! id) return m; return m.replace (/<label class="file-button">[\s\S]*?<\/label>[\s\S]*?<\/section>$/,
    attachmentPanel3 ('custom:' + id) + '</section>')
  });
  return h
}

function selectionPanel () {
  const v = currentVersion (), choose = (key, label) => checkbox (fieldVisible (key), 'data-field-choice="' + esc (key) +
  '"', label), field = (key, label, val) => val ? choose (key, '<span class="field-name">' + esc (translateLabel (label)) +
  '</span><small class="field-preview">' + esc (String (val).slice (0, 90)) + (String (val).length > 90 ? '…' : '') +
  '</small>') : '';
  const extras = (owner, x) => {
    const photos = allPhotos ().filter (p => p.owner === owner), attachments = (x.attachments || []).map (assetBy3).filter (Boolean);
    return photos.map (p => '<div class="photo-choice">' + checkbox (! v.excluded.includes ('photo:' + p.id), 'data-select-item="photo:' +
    p.id + '"', tr ('照片：', 'Photo: ') + esc (p.name)) + field ('photo:' + p.id + ':caption', '照片说明', p.caption) + '</div>').join ('') +
    attachments.map (a => '<div class="photo-choice">' + field ('attachment:' + owner + ':' + a.id, '文件附件', a.name) +
    '</div>').join ('')
  };
  const record = (kind, x, fields, more = '') => '<details class="record-select"><summary>' + checkbox (! v.excluded.includes (kind +
  ':' + x.id), 'data-select-item="' + kind + ':' + x.id + '"', esc (x.title || x.school || x.type || x.stage || tr ('未命名',
  'Untitled'))) + '</summary><div class="record-fields">' + fields.map (([k, l]) => field (kind + ':' + x.id + ':' +
  k, l, x [k])).join ('') + more + extras (kind + ':' + x.id, x) + '</div></details>';
  const recordsFor = (k) => {
    if (k === 'profile') return PROFILE.map (([f, l]) => field ('profile.' + f, l, f === 'targetSchool' && v.target ?
    v.target : ctx.state.profile [f])).join ('') + checkbox (v.showAvatar, 'data-v-bool="showAvatar"', tr ('个人照片', 'Portrait'));
    if (k === 'education') return ctx.state.education.filter (x => EDU_FIELDS.some (([f]) => x [f])).map (x => record (k,
    x, [['stage', '教育阶段'], ...EDU_FIELDS])).join ('');
    if (k === 'statement') return field ('statement.zh', '中文个人陈述', ctx.state.statement.zh) + field ('statement.en', '英文个人陈述',
    ctx.state.statement.en);
    if (k === 'academics') return field ('academics.languageLearning', '语言学习', ctx.state.academics.languageLearning) +
    field ('academics.certificates', '证书与等级', ctx.state.academics.certificates);
    if (k === 'strengths') return field ('statement.strengths', '个人特长', ctx.state.statement.strengths) + field ('statement.hobbies',
    '兴趣爱好', ctx.state.statement.hobbies);
    if (k === 'exams') return ctx.state.exams.map (x => record (k, x, EXAM_FIELDS, x.subjects.map ((sub, i) => '<div class="subject-choice"><strong>' +
    tr ('科目 ', 'Subject ') + (i + 1) + '</strong>' + [['name', '科目名称'], ['score', '分科成绩'], ['fullMark', '科目满分'], ['rank',
    '单科排名']].map (([f, l]) => field ('exams:' + x.id + ':subjects:' + sub.id + ':' + f, l, sub [f])).join ('') + '</div>').join (''))).join ('');
    if (['awards', 'experiences', 'practices', 'achievements'].includes (k)) return ctx.state [k].map (x => record (k,
    x, k === 'awards' ? AWARD_FIELDS : k === 'achievements' ? ACHIEVEMENT_FIELDS : EXP_FIELDS, field (k + ':' + x.id +
    ':summary', '补充简历表述', v.summaries [k + ':' + x.id]) + '<label class="field"><span>' + tr ('补充简历表述（可选）', 'Additional document summary') +
    '</span><textarea data-summary="' + k + ':' + x.id + '" rows="2">' + esc (v.summaries [k + ':' + x.id] || '') + '</textarea></label>')).join ('');
    if (k === 'custom') return ctx.state.customBlocks.map (x => record (k, x, [['title', '模块标题'], ['text', '正文内容']])).join ('');
    if (k === 'learning') return field ('learning.readingNotes', '阅读随记与已有书单', ctx.state.learning.readingNotes) + field ('learning.plan',
    '学习计划', ctx.state.learning.plan) + field ('learning.notes', '其他学习记录', ctx.state.learning.notes) + ctx.state.learning.books.map (x =>
    record (k, x, BOOK_FIELDS)).join ('');
    return ''
  };
  return '<div class="composer-intro"><div><h2>' + tr ('从你的资料中，逐项选择。', 'Choose from your own materials.') + '</h2><p>' +
  tr ('展开模块，再选择具体记录、字段、照片与附件名称。所有选择仅影响当前文档。', 'Expand each module to choose records, fields, photos and attachment names. Choices only affect this document.') +
  '</p></div><div class="actions"><button data-v2="selectAll">' + tr ('全选', 'Select all') + '</button><button data-v2="selectNone">' +
  tr ('全不选', 'Select none') + '</button></div></div><div class="selection-grid">' + v.order.map ((k, i) => '<details class="selection-module" ' +
  (i === 0 ? 'open' : '') + '><summary>' + checkbox (! v.disabled.includes (k), 'data-select-module="' + k + '"', esc (v.titles [k]?.trim () ||
  tr (...MODULE_NAMES [k]))) + '</summary><div class="module-body"><label class="field"><span>' + tr ('自定义模块标题', 'Custom section title') +
  '</span><input data-module-title="' + k + '" value="' + esc (v.titles [k] || '') + '" placeholder="' + esc (tr (...MODULE_NAMES [k])) +
  '"></label>' + checkbox (v.breaks.includes (k), 'data-break-module="' + k + '"', tr ('从新的一页开始', 'Start on a new page')) +
  '<div class="module-fields">' + (recordsFor (k) || '<p class="hint">' + tr ('尚未填写这一部分。', 'No content entered here yet.') +
  '</p>') + '</div></div></details>').join ('') + '</div>'
}

function allPhotos () {
  const result = [], used = new Set ([ctx.state.awardDraft, ctx.state.experienceDraft, ctx.state.practiceDraft, ctx.state.achievementDraft,
  ctx.state.bookDraft].flatMap (x => (x.photos || []).map (p => p.assetId)));
  for (const [kind, arr] of [['awards', ctx.state.awards], ['experiences', ctx.state.experiences], ['practices', ctx.state.practices],
  ['achievements', ctx.state.achievements], ['custom', ctx.state.customBlocks], ['learning', ctx.state.learning.books]]) for (const x of arr) for (const p of x.photos ||
  []) {
    used.add (p.assetId);
    result.push ( {
      ...p, owner : kind + ':' + x.id, module : kind, heading : fieldVisible (kind + ':' + x.id + ':title') ? x.title : tr ('相关照片',
      'Related photos')
    })
  }
  for (const p of ctx.state.media) {
    const [k, id] = (p.link || '').split (':'), record = ownerObject3 (p.link || '');
    if (! record && used.has (p.assetId)) continue;
    used.add (p.assetId);
    result.push ( {
      ...p, owner : record ? p.link : '', module : record ? k : '', heading : record ? (fieldVisible (k + ':' + id + ':title') ?
      record.title : tr ('相关证明', 'Evidence')) : tr ('补充照片', 'Additional photos')
    })
  }
  for (const a of ctx.state.assets || []) {
    if (a.kind === 'image' && ! used.has (a.id) && a.id !== ctx.state.avatar?.assetId) {
      result.push ( {
        id : a.id, assetId : a.id, name : a.name, data : a.data, caption : a.caption || '', crop : cleanCrop (a.crop), owner : '',
        module : '', heading : tr ('补充照片', 'Additional photos')
      });
      used.add (a.id)
    }
  }
  return result
}

function exportRows () {
  const v = currentVersion (), legacy = exportRows22 (), groups = new Map (), appendix = [];
  let last = '';
  for (const r of legacy) {
    if (r.kind === 'section') last = r.module || 'appendix';
    const k = r.module || last;
    if (k === 'appendix') {
      appendix.push (r);
      continue
    }
    if (! groups.has (k)) groups.set (k, []);
    groups.get (k).push ( {
      ...r, module : k
    })
  }
  const photos = v.photoMode === 'none' ? [] : selectedPhotos (), section = k => ( {
    kind : 'section', text : v.titles [k]?.trim () || MODULE_NAMES [k] [v.exportLang === 'en' ? 1 : 0], module : k, breakBefore : v.breaks.includes (k)
  }), body = (k, text, kind = 'body', fieldKey = '') => ( {
    kind, text, module : k, fieldKey
  }), field = (k, l, val, id) => ( {
    kind : 'body', label : exportLabel (l, EN [l] || l) + '：', value : String (val), text : exportLabel (l, EN [l] ||
    l) + '：' + val, module : k, fieldKey : id
  });
  for (const k of ['practices', 'achievements']) {
    if (v.disabled.includes (k)) continue;
    const rows = [];
    for (const x of ctx.state [k].filter (x => ! v.excluded.includes (k + ':' + x.id))) {
      if (x.title && fieldVisible (k + ':' + x.id + ':title')) rows.push (body (k, x.title, 'entry', k + ':' + x.id + ':title'));
      for (const [f, l] of k === 'practices' ? EXP_FIELDS : ACHIEVEMENT_FIELDS) if (f !== 'title' && x [f] && fieldVisible (k +
      ':' + x.id + ':' + f)) rows.push (field (k, l, x [f], k + ':' + x.id + ':' + f));
      if (v.summaries [k + ':' + x.id] && fieldVisible (k + ':' + x.id + ':summary')) rows.push (field (k, '简历表述', v.summaries [k +
      ':' + x.id], k + ':' + x.id + ':summary'));
      if (v.photoMode === 'inline') {
        const own = photos.filter (p => p.owner === k + ':' + x.id);
        if (own.length) rows.push ( {
          kind : 'photos', photos : own, module : k
        })
      }
    }
    if (rows.length) groups.set (k, [section (k), ...rows])
  }
  for (const [k, arr] of [['awards', ctx.state.awards], ['experiences', ctx.state.experiences], ['practices', ctx.state.practices],
  ['achievements', ctx.state.achievements], ['custom', ctx.state.customBlocks], ['learning', ctx.state.learning.books]]) {
    if (v.disabled.includes (k)) continue;
    let rows = groups.get (k) || [];
    for (const x of arr.filter (x => ! v.excluded.includes (k + ':' + x.id))) {
      const own = photos.filter (p => p.owner === k + ':' + x.id), extra = [];
      if (v.photoMode === 'inline' && k === 'learning' && own.length) extra.push ( {
        kind : 'photos', photos : own, module : k, fieldKey : k + ':' + x.id + ':photos'
      });
      for (const aid of x.attachments || []) {
        const a = assetBy3 (aid), fk = 'attachment:' + k + ':' + x.id + ':' + aid;
        if (a && fieldVisible (fk)) extra.push (field (k, '文件附件', a.name, fk))
      }
      if (! extra.length) continue;
      if (! rows.length) rows.push (section (k));
      let at = - 1;
      for (let i = 0; i < rows.length; i ++) if (rows [i].fieldKey?.startsWith (k + ':' + x.id + ':') || rows [i].photos?.some (p =>
      p.owner === k + ':' + x.id)) at = i;
      if (at < 0) rows.push (...extra);
      else rows.splice (at + 1, 0, ...extra)
    }
    if (rows.length) groups.set (k, rows)
  }
  return v.order.flatMap (k => groups.get (k) || []).concat (appendix)
}

function textRows () {
  const rows = exportRows (), first = rows.findIndex (r => r.module === 'appendix'), main = first < 0 ? rows : rows.slice (0,
  first), caption = (p, module) => ( {
    kind : 'body', module, label : exportLabel ('照片说明', 'Photo caption') + '：', value : p.caption, text : exportLabel ('照片说明',
    'Photo caption') + '：' + p.caption, fieldKey : 'photo:' + p.id + ':caption'
  }), caps = (r) => r.photos.filter (p => p.caption && fieldVisible ('photo:' + p.id + ':caption')).map (p => caption (p,
  r.module)), out = main.flatMap (r => r.kind === 'photos' ? caps (r) : r.kind === 'custom' ? [...(r.text ? [ {
    ...r, kind : 'body', photos : undefined
  }] : []), ...caps (r)] : [r]);
  if (first >= 0) {
    const photos = rows.slice (first).filter (r => r.kind === 'photos').flatMap (r => r.photos).filter (p => p.caption &&
    fieldVisible ('photo:' + p.id + ':caption'));
    if (photos.length) {
      out.push ( {
        kind : 'section', module : 'appendix', text : exportLabel ('照片说明', 'Photo captions'), breakBefore : true
      });
      let previous = '';
      for (const p of photos) {
        if (p.heading !== previous) {
          out.push ( {
            kind : 'entry', module : 'appendix', text : p.heading
          });
          previous = p.heading
        }
        out.push (caption (p, 'appendix'))
      }
    }
  }
  return out
}

function mediaPanel () {
  return mediaPanel22 () + '<div class="actions"><button type="button" data-picker3="media">' + tr ('从资料中心选择照片', 'Choose photos from Materials') +
  '</button><button data-go3="images">' + tr ('打开图片管理', 'Open image management') + '</button></div>'
}

function preflight3 () {
  const errors = [], suggestions = [], v = currentVersion (), add = (list, message, route = 'studio') => list.push ( {
    message, route
  });
  if (v.purpose === 'resume') {
    for (const [k, z, e] of [['name', '姓名', 'Name'], ['school', '就读中学', 'High school'], ['birthday', '出生年月日', 'Date of birth'],
    ['schoolLanguage', '高中所学语种', 'High-school foreign language']]) if (! ctx.state.profile [k].trim ()) add (errors, tr ('基本信息缺少：' +
    z, 'Missing basic information: ' + e), 'profile');
    if (! ctx.state.profile.email.trim () && ! ctx.state.profile.phone.trim ()) add (errors, tr ('至少填写一种联系方式：邮箱或电话。',
    'Enter an email address or phone number.'), 'profile');
    if (ctx.state.profile.email && ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test (ctx.state.profile.email)) add (errors, tr ('电子邮箱格式可能有误。',
    'The email address format appears invalid.'), 'profile');
    if (ctx.state.profile.birthday && (isNaN (Date.parse (ctx.state.profile.birthday)) || Date.parse (ctx.state.profile.birthday) > Date.now ())) add (errors,
    tr ('出生日期无效，或晚于当前日期。', 'The birth date is invalid or in the future.'), 'profile');
    if (v.disabled.includes ('profile') || ! fieldVisible ('profile.name')) add (errors, tr ('当前简历未选择基本信息或姓名字段。', 'Basic information or the name field is excluded from this resume.'));
    for (const [k, z, e] of [['targetSchool', '目标院校', 'target university'], ['targetMajor', '申请专业', 'intended major'],
    ['grade', '毕业届别', 'graduation year']]) if (! (k === 'targetSchool' && v.target) && ! ctx.state.profile [k]) add (suggestions,
    tr ('建议补充基本信息：' + z, 'Consider adding your ' + e), 'profile');
    for (const [condition, z, e, route] of [[! ctx.state.education.some (x => x.school), '教育经历', 'education', 'education'],
    [! ctx.state.statement.zh && ! ctx.state.statement.en, '个人陈述', 'a personal statement', 'statement'], [! ctx.state.exams.length,
    '考试成绩', 'exam results', 'academics'], [! ctx.state.awards.length, '个人荣誉', 'honors & awards', 'awards'], [! ctx.state.experiences.length &&
    ! ctx.state.practices.length, '个人经历或社会实践', 'experience or social practice', 'experiences']]) if (condition) add (suggestions,
    tr ('尚未填写' + z + '，可按需要补充。', 'No ' + e + ' saved. Add it if relevant.'), route);
  }
  else if (v.purpose === 'reading' && ! ctx.state.learning.books.length && ! ctx.state.learning.readingNotes && ! ctx.state.learning.notes &&
  ! ctx.state.learning.plan) add (suggestions, tr ('还没有阅读与学习记录，可先录入再导出。', 'No reading or learning records saved yet.'),
  'learning');
  const normalized = s => String (s || '').toLowerCase ().replace (/[\s，。·：:()（）\-_]/g, '');
  for (const [kind, arr] of [['awards', ctx.state.awards], ['experiences', ctx.state.experiences], ['practices', ctx.state.practices],
  ['achievements', ctx.state.achievements], ['exams', ctx.state.exams], ['learning', ctx.state.learning.books]]) {
    const seen = new Map ();
    for (const x of arr) {
      const key = normalized (x.title) + '|' + normalized (x.date);
      if (! normalized (x.title)) continue;
      if (seen.has (key)) add (suggestions, tr ('可能重复录入：', 'Possible duplicate record: ') + x.title, kind === 'exams' ?
      'academics' : kind);
      else seen.set (key, x)
    }
  }
  for (const x of ctx.state.practices) if (ctx.state.experiences.some (y => normalized (y.title) === normalized (x.title) &&
  normalized (y.date) === normalized (x.date))) add (suggestions, tr ('经历与社会实践中可能重复：', 'May be duplicated across experience and practice: ') +
  x.title, 'practices');
  for (const e of (v.disabled.includes ('exams') ? [] : ctx.state.exams.filter (x => ! v.excluded.includes ('exams:' +
  x.id)))) {
    if (numeric3 (e.totalScore) !== null && numeric3 (e.totalFullMark) !== null && numeric3 (e.totalScore) > numeric3 (e.totalFullMark)) add (errors,
    tr ('考试总分高于满分：', 'Total score exceeds full mark: ') + e.title, 'academics');
    for (const s of e.subjects) if (numeric3 (s.score) !== null && numeric3 (s.fullMark) !== null && numeric3 (s.score) > numeric3 (s.fullMark)) add (errors,
    tr ('分科成绩高于满分：', 'Subject score exceeds full mark: ') + e.title + ' / ' + s.name, 'academics');
    if (numeric3 (e.rank) !== null && numeric3 (e.rankTotal) !== null && numeric3 (e.rank) > numeric3 (e.rankTotal)) add (errors,
    tr ('排名超过参考人数：', 'Rank exceeds participant count: ') + e.title, 'academics')
  }
  for (const kind of ['awards', 'experiences', 'practices', 'achievements', 'books', 'exams']) {
    const d = ctx.state [draftFor3 (kind)], arr = kind === 'books' ? ctx.state.learning.books : ctx.state [kind], saved = arr.find (x =>
    x.id === ctx.editing [kind]), content = kind === 'exams' ? draftHasContent ('exams') : Object.entries (d || {
    }).some (([k, v]) => ! ['id', 'category', 'status', 'priority'].includes (k) && (typeof v === 'string' ? v.trim () : Array.isArray (v) &&
    v.length));
    if (d && (saved ? JSON.stringify (d) !== JSON.stringify (saved) : content)) add (suggestions, tr ('有尚未收录的草稿或修改，不会进入导出：',
    'An unsaved draft or edit will not be exported: ') + (d.title || tr ('未命名记录', 'Untitled record')), kind === 'books' ?
    'learning' : kind === 'exams' ? 'academics' : kind)
  }
  if (! exportRows ().length) add (errors, tr ('没有选择可导出的内容。', 'No exportable content has been selected.'));
  return {
    errors, suggestions
  }
}

function preflightPanel3 (compact = false) {
  const p = preflight3 (), items = (arr, cls) => arr.map (x => '<li class="' + cls + '"><span>' + esc (x.message) +
  '</span><button data-go3="' + x.route + '">' + tr ('查看', 'View') + '</button></li>').join ('');
  return '<section class="preflight3 ' + (compact ? 'compact' : '') + '"><div class="panel-title"><h2>' + tr ('导出前检查',
  'Preflight check') + '</h2><div><span class="check-error-count">' + p.errors.length + ' ' + tr ('项错误', 'errors') +
  '</span><span class="check-warn-count">' + p.suggestions.length + ' ' + tr ('项建议', 'suggestions') + '</span></div></div>' +
  (p.errors.length || p.suggestions.length ? '<ul>' + items (p.errors, 'error') + items (p.suggestions, 'suggestion') +
  '</ul>' : '<p class="check-ok3">' + icon3 ('check') + tr ('本次检查未发现错误或建议项。', 'No errors or suggestions found.') + '</p>') +
  '<p class="hint">' + tr ('检查覆盖缺项、格式、成绩范围和疑似重复，不判断材料真实性或学校是否接受。', 'Checks cover missing data, format, score ranges and possible duplicates. They do not assess authenticity or admissions eligibility.') +
  '</p></section>'
}

function previewPage () {
  const v = currentVersion (), final = ctx.studioTab === 'files', tabs = [['content', '内容选择', 'Content'], ['style',
  '排版', 'Layout'], ['media', '照片', 'Photos'], ['order', '模块顺序', 'Order'], ['check', '导出前检查', 'Check'], ['files', '导出文件',
  'Export']];
  return heading3 ('CREATE / COMPOSE', tr ('让每份资料，成为你的作品。', 'Turn your materials into a document.'), tr ('可以制作申请简历，也可以整理阅读档案。选择内容、设置版式、调整顺序，最后导出。',
  'Create an application resume or a reading dossier. Choose content, style, arrange and export.')) + '<section class="panel version-bar version-bar3"><label>' +
  tr ('文档版本', 'Document version') + '<select id="versionChoice">' + ctx.state.versions.map (x => '<option value="' +
  x.id + '" ' + (x.id === v.id ? 'selected' : '') + '>' + esc (x.name) + '</option>').join ('') + '</select></label><label>' +
  tr ('版本名称', 'Version name') + '<input id="versionName" value="' + esc (v.name) + '"></label><label>' + tr ('成果类型',
  'Document purpose') + '<select id="documentPurpose3"><option value="resume" ' + (v.purpose === 'resume' ? 'selected' : '') +
  '>' + tr ('申请简历', 'Application resume') + '</option><option value="reading" ' + (v.purpose === 'reading' ? 'selected' : '') +
  '>' + tr ('阅读与学习档案', 'Reading & learning dossier') + '</option><option value="custom" ' + (v.purpose === 'custom' ?
  'selected' : '') + '>' + tr ('自由组合文档', 'Custom document') + '</option></select></label><label>' + tr ('导出文件名', 'Export filename') +
  '<input id="exportFilename3" value="' + esc (v.filename || v.name) + '" placeholder="' + tr ('自定义文件名', 'Choose a filename') +
  '"></label><input id="versionTarget" value="' + esc (v.target) + '" placeholder="' + tr ('此版本的目标院校（选填）', 'Target university for this version') +
  '"><div class="actions"><button data-v2="duplicateVersion">' + tr ('复制版本', 'Duplicate') + '</button><button data-v2="newVersion">' +
  tr ('新建', 'New') + '</button><button data-v2="deleteVersion" ' + (ctx.state.versions.length === 1 ? 'disabled' : '') +
  '>' + tr ('删除', 'Delete') + '</button></div></section><div class="composer ' + (final ? 'is-final' : 'is-editing') +
  '"><section class="panel composer-controls"><div class="studio-tabs">' + tabs.map (([id, z, e]) => '<button data-studio-tab="' +
  id + '" class="' + (ctx.studioTab === id ? 'primary' : '') + '" aria-pressed="' + (ctx.studioTab === id) + '">' +
  tr (z, e) + '</button>').join ('') + '</div>' + (final ? '' : '<button class="preview-float" data-v2="openPreview">' +
  tr ('查看当前预览', 'Preview document') + ' ↗</button>') + '<div class="studio-panel">' + ( {
    content : selectionPanel, style : stylePanel, media : mediaPanel, order : orderPanel, check : () => preflightPanel3 (false),
    files : filesPanel
  }) [ctx.studioTab] () + '</div></section>' + (final ? '<section class="preview-content"><div class="preview-toolbar"><span id="previewStatus">' +
  tr ('分页预览', 'Page preview') + '</span><button data-action="preview">' + tr ('刷新预览', 'Refresh') + '</button></div><div id="pagePreview" class="page-preview"></div></section>' : '') +
  '</div><dialog id="composerPreview" class="composer-preview"><div class="modal-preview-head"><strong>' + tr ('当前文档预览',
  'Current document preview') + '</strong><button data-v2="closePreview">×</button></div><div id="modalPreviewStatus" class="hint"></div><div id="modalPagePreview" class="page-preview"></div></dialog>'
}

function filesPanel () {
  return preflightPanel3 (true) + '<div class="export-name3"><label class="field"><span>' + tr ('导出文件名', 'Export filename') +
  '</span><input data-export-filename3 value="' + esc (currentVersion ().filename || currentVersion ().name) + '"></label></div>' +
  filesPanel22 () + '<p class="hint">' + tr ('Word 与 Markdown 可保留已勾选的照片说明与附件名称。附件原文件在资料中心与个人资料 ZIP 中保留，HTML 文档可直接下载所选附件。',
  'Word and Markdown retain selected photo captions and attachment names. Source files remain in Materials and the personal ZIP. Exported HTML includes download links to selected attachments.') +
  '</p>'
}

export { customPage, vSelect, slider, stylePanel, mediaPanel22, filesPanel22, orderPanel, orderRows, settleOrder, flipOrder, animateOrderMove, bindModuleOrder, exportLabel, exportRows22, draftFor3, customPage3, selectionPanel, allPhotos, exportRows, textRows, mediaPanel, preflight3, preflightPanel3, previewPage, filesPanel };

// All controls for this feature, in their original override order.
function bindResumeControls () {
  $$ ('[data-orientation]').forEach (b => b.onclick = () => {
    if (ctx.busy) return; ctx.state.orientation = b.dataset.orientation; scheduleSave (); render (); refreshPreview ();
  });
  $$ ('[data-v2]').forEach (b => b.onclick = () => v2Action (b.dataset.v2));
  $$ ('[data-studio-tab]').forEach (b => b.onclick = () => {
    ctx.studioTab = b.dataset.studioTab; render ()
  });
  $$ ('[data-select-module]').forEach (e => e.onchange = () => {
    flip (currentVersion ().disabled, e.dataset.selectModule, ! e.checked); changed (false)
  });
  $$ ('[data-select-item]').forEach (e => e.onchange = () => {
    flip (currentVersion ().excluded, e.dataset.selectItem, ! e.checked); changed (false)
  });
  $$ ('[data-field-choice]').forEach (e => e.onchange = () => {
    flip (e.dataset.optional === 'true' ? currentVersion ().includedFields : currentVersion ().hiddenFields, e.dataset.fieldChoice,
    e.dataset.optional === 'true' ? e.checked : ! e.checked); changed (false)
  });
  $$ ('[data-break-module]').forEach (e => e.onchange = () => {
    flip (currentVersion ().breaks, e.dataset.breakModule, e.checked); changed (false)
  });
  $$ ('[data-summary]').forEach (e => e.oninput = () => {
    currentVersion ().summaries [e.dataset.summary] = e.value; changed (false)
  });
  $$ ('[data-module-title]').forEach (e => e.oninput = () => {
    currentVersion ().titles [e.dataset.moduleTitle] = e.value; changed (false)
  });
  $$ ('[data-module-move]').forEach (e => e.onclick = () => animateOrderMove (e));
  $$ ('[data-module-style]').forEach (e => {
    const [k, field] = e.dataset.moduleStyle.split (':'); const update = () => {
      const style = currentVersion ().moduleStyles [k] || moduleStyle (k); style [field] = e.type === 'checkbox' ? e.checked : e.type === 'range' ?
      Number (e.value) : e.value; currentVersion ().moduleStyles [k] = style; if (e.type === 'range') e.closest ('label').querySelector ('output').textContent = e.value +
      ' pt'; changed (false)
    }; e.oninput = update; e.onchange = update
  });
  $$ ('[data-v-setting]').forEach (e => e.onchange = () => {
    currentVersion () [e.dataset.vSetting] = e.dataset.vSetting === 'photosPerRow' ? Number (e.value) : e.value; changed (e.dataset.vSetting === 'avatarShape')
  });
  $$ ('[data-v-bool]').forEach (e => e.onchange = () => {
    currentVersion () [e.dataset.vBool] = e.checked; changed (false)
  });
  $$ ('[data-v-range],[data-v-number]').forEach (e => {
    const k = e.dataset.vRange || e.dataset.vNumber; const commit = () => {
      const val = clamp (e.value, + e.min, + e.max, currentVersion () [k]); currentVersion () [k] = val; const pair = $ ('[data-v-' +
      (e.dataset.vRange ? 'number' : 'range') + '="' + k + '"]'); if (pair) pair.value = val; $ ('#out-' + k).textContent = val +
      (k === 'margin' || k === 'avatarSize' ? ' mm' : k === 'lineHeight' ? '×' : ' pt'); ctx.layoutCache = null; scheduleSave ();
    }; e.oninput = () => {
      commit (); if (e.dataset.vNumber) changed (false)
    }; e.onchange = () => {
      commit (); changed (false)
    };
  });
  $$ ('[data-preset]').forEach (e => e.onclick = () => {
    Object.assign (currentVersion (), ( {
      compact : {
        margin : 13, fontSize : 10, lineHeight : 1.3, gap : 6
      }, standard : {
        margin : 18, fontSize : 11, lineHeight : 1.55, gap : 10
      }, airy : {
        margin : 23, fontSize : 12, lineHeight : 1.8, gap : 16
      }
    }) [e.dataset.preset]); changed ()
  });
  if ($ ('#versionChoice')) $ ('#versionChoice').onchange = e => {
    ctx.state.activeVersion = e.target.value;
    ctx.layoutCache = null; render ()
  };
  for (const [id, key] of [['versionName', 'name'], ['versionTarget', 'target']]) if ($ ('#' + id)) $ ('#' + id).oninput = e =>
  {
    currentVersion () [key] = e.target.value;
    changed (false);
    if (key === 'name') $ ('#versionChoice').selectedOptions [0].textContent = e.target.value;
  };
  bindModuleOrder ();
  if ($ ('#exportFilename3')) $ ('#exportFilename3').oninput = e => {
    currentVersion ().filename = e.target.value;
    const pair = $ ('[data-export-filename3]');
    if (pair) pair.value = e.target.value;
    scheduleSave ()
  };
  $$ ('[data-export-filename3]').forEach (e => e.oninput = () => {
    currentVersion ().filename = e.value; $ ('#exportFilename3').value = e.value; scheduleSave ()
  });
  if ($ ('#documentPurpose3')) $ ('#documentPurpose3').onchange = e => {
    const v = currentVersion ();
    v.purpose = e.target.value;
    if (v.purpose === 'reading') {
      v.disabled = MODULES.filter (x => x !== 'learning');
      v.showAvatar = false;
      v.filename = tr ('我的阅读与学习档案', 'My reading and learning dossier')
    }
    else if (v.purpose === 'resume') {
      v.disabled = ['learning'];
      v.showAvatar = true;
      v.filename = v.name
    }
    changed ()
  };
}
export { bindResumeControls };
