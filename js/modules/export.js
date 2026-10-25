import { ctx } from '../state.js';
import { $, $$, clone, dataBytes, download, esc, loadImage, readFile, safeFilename3, toast, tr, uid } from '../utils/helpers.js';
import { FONT_CJK, FONT_LATIN } from '../data.js';
import { currentVersion, fieldVisible, moduleStyle } from '../model.js';
import { VERSION } from '../constants.js';
import { exportLabel, exportRows, preflight3, textRows } from './resume.js';
import { avatarData, exportPhotoData } from './images.js';
import { assetBy3 } from './materials.js';
import { save } from '../autosave.js';
import { confirmAction } from '../app.js';
import { markdown } from './markdown.js';
// 启程 · js/modules/export.js


function metrics () {
  if (! ctx.metricsCache) ctx.metricsCache = [fontkit.create (dataBytes (FONT_LATIN)), fontkit.create (dataBytes (FONT_CJK))];
  return ctx.metricsCache;
}

function fontFor (cp) {
  const f = metrics ();
  return f [0].hasGlyphForCodePoint (cp) ? 0 : f [1].hasGlyphForCodePoint (cp) ? 1 : 0;
}

function widthOf (text, size) {
  let w = 0;
  for (const c of String (text)) {
    const f = metrics () [fontFor (c.codePointAt (0))];
    w += f.glyphForCodePoint (c.codePointAt (0)).advanceWidth / f.unitsPerEm * size
  }
  return w;
}

async function ensureFonts () {
  if (! ctx.fontFacePromise) ctx.fontFacePromise = (async () => {
    if (typeof FontFace === 'undefined' || ! document.fonts) return; for (const [name, data] of [['QichengLatin', FONT_LATIN],
    ['QichengCJK', FONT_CJK]]) {
      const f = new FontFace (name, dataBytes (data)); await f.load (); document.fonts.add (f)
    }
  }) ();
  return ctx.fontFacePromise;
}

function wrapText (text, size, width) {
  const lines = [];
  for (const para of String (text).replace (/\r/g, '').split ('\n')) {
    let line = '';
    for (const token of para.match (/[A-Za-zÀ-ž0-9]+(?:['’-][A-Za-zÀ-ž0-9]+)*|[ \t]+|./gu) || []) {
      const pieces = widthOf (token, size) > width ? [...token] : [token];
      for (const part of pieces) {
        if (line && widthOf (line + part, size) > width) {
          lines.push (line.trimEnd ());
          line = part.trimStart ()
        }
        else line += part
      }
    }
    lines.push (line)
  }
  return lines;
}

function exportColors (v = currentVersion ()) {
  const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test (value || '') ? value : fallback;
  return { bg : hex (v.paperColor, '#ffffff'), paper : hex (v.paperColor, '#ffffff'), ink : '#000000', muted : '#000000',
    accent : hex (v.titleColor, '#000000'), line : hex (v.lineColor, '#d6d6d6') };
}

const paperImageCache52 = new Map ();
async function paperBackground52 (v, width, height) {
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test (v.paperImage || '')) return '';
  const key = v.paperImage + '|' + width + '|' + height + '|' + exportColors (v).paper;
  if (!paperImageCache52.has (key)) {
    const task = (async () => {
      const image = await loadImage (v.paperImage), canvas = document.createElement ('canvas'), scale = 2;
      canvas.width = Math.round (width * scale); canvas.height = Math.round (height * scale);
      const draw = canvas.getContext ('2d'), ratio = Math.max (canvas.width / image.width, canvas.height / image.height);
      draw.fillStyle = exportColors (v).paper; draw.fillRect (0, 0, canvas.width, canvas.height);
      draw.drawImage (image, (canvas.width - image.width * ratio) / 2, (canvas.height - image.height * ratio) / 2, image.width * ratio, image.height * ratio);
      return canvas.toDataURL ('image/jpeg', .92);
    }) ();
    paperImageCache52.set (key, task);
    if (paperImageCache52.size > 3) paperImageCache52.delete (paperImageCache52.keys ().next ().value);
    task.catch (() => paperImageCache52.delete (key));
  }
  return paperImageCache52.get (key);
}

// Page numbers refer to physical pages, including every contents page. No fixed +1 assumption.
function buildContentsPages (entries, { W, H, m, contentW, bottom, version : v, colors : c }) {
  if (!v.showToc || !entries.length) return [];
  const pages = [], size = v.fontSize * 1.06, lh = size * v.lineHeight;
  let page, y;
  const next = () => {
    page = { kind : 'toc', items : [] }; pages.push (page); y = m + 32;
    page.items.push ({ kind : 'text', role : 'toc-title', text : exportLabel ('目录', 'Contents') + (pages.length > 1 ? exportLabel ('（续）', ' (continued)') : ''), x : m, y, w : contentW, h : v.fontSize * 2.5, size : v.fontSize * 2, color : c.accent, bold : true });
    y += v.fontSize * 3.7;
  };
  next ();
  entries.forEach ((entry, index) => {
    const lines = wrapText (entry.text, size, contentW - 55);
    // Move the whole entry when it fits a fresh page; exceptionally long titles may span pages.
    if (y + lines.length * lh + v.gap + 8 > bottom && lines.length * lh + v.gap + 8 < bottom - (m + 32 + v.fontSize * 3.7)) next ();
    lines.forEach ((line, lineIndex) => {
      if (y + lh > bottom) next ();
      page.items.push ({ kind : 'text', role : 'toc-entry', sectionIndex : index, text : line, x : m, y, w : contentW - 55, h : lh, size, color : c.ink, bold : false });
      if (lineIndex === lines.length - 1) page.items.push ({ kind : 'text', role : 'toc-page-number', sectionIndex : index, text : '', x : W - m - 35, y, w : 35, h : lh, size, color : c.accent, bold : true });
      y += lh;
    });
    y += v.gap + 8;
  });
  for (const p of pages) for (const item of p.items) if (item.role === 'toc-page-number') item.text = String (entries[item.sectionIndex].page + pages.length);
  return pages;
}

function decorateDocumentPages (plan, margin) {
  const { W, H, pages, colors : c, version : v } = plan, m = margin, width = W - 2 * m;
  const decoration = v.pageDecoration || 'plain';
  pages.forEach ((page, index) => {
    const chrome = plan.backgroundData ? [{ kind : 'image', role : 'paper-background', data : plan.backgroundData, x : 0, y : 0, w : W, h : H }] : [];
    if (decoration === 'frame') {
      const edge = Math.max (10, m * .45), line = .6;
      chrome.push ({ kind : 'line', role : 'page-frame', x : edge, y : edge, w : W - edge * 2, h : line, color : c.line },
      { kind : 'line', role : 'page-frame', x : edge, y : H - edge, w : W - edge * 2, h : line, color : c.line },
      { kind : 'line', role : 'page-frame', x : edge, y : edge, w : line, h : H - edge * 2, color : c.line },
      { kind : 'line', role : 'page-frame', x : W - edge, y : edge, w : line, h : H - edge * 2, color : c.line });
    }
    chrome.push ({ kind : 'line', role : 'page-accent', x : m, y : m, w : decoration === 'editorial' ? Math.min (90, width * .25) : width, h : decoration === 'editorial' ? 3 : 1.2, color : c.line });
    page.items.unshift (...chrome);
    if (v.showPageNumbers !== false) {
      const number = (index + 1) + ' / ' + pages.length;
      page.items.push ({ kind : 'line', role : 'page-footer-line', x : m, y : H - m + 2, w : width, h : .5, color : c.line },
      { kind : 'text', role : 'page-number', text : number, x : W - m - widthOf (number, 8), y : H - m + 8, w : 55, h : 12, size : 8, color : c.muted, bold : false });
    }
  });
  return plan;
}

async function documentPlan () {
  await ensureFonts ();
  const v = clone (currentVersion ()), rows = exportRows (), c = exportColors (v), land = v.orientation === 'landscape',
  W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, m = v.margin * 72 / 25.4, contentW = W - 2 * m, bottom = H - m - 18;
  let pages = [], items, y, portraitBottom = 0, portraitLeft = 0;
  const imageMap = new Map ();
  const imageInfo = async data => {
    if (! imageMap.has (data)) {
      const im = await loadImage (data);
      imageMap.set (data, im)
    }
    return imageMap.get (data)
  };
  const page = () => {
    items = [];
    pages.push ( {
      items
    });
    y = m + 18;
    portraitBottom = 0;
    portraitLeft = 0;
  };
  const ensure = h => {
    if (y + h > bottom && y > m + 20) page ()
  };
  const text = (s, size, color, bold = false, gap = 3, x = m, width = contentW, align = 'left') => {
    if (x === m && y < portraitBottom) width = Math.min (width, portraitLeft - m - 16);
    const lines = wrapText (s, size, width), lh = size * v.lineHeight;
    let firstPage = 0;
    for (const l of lines) {
      ensure (lh);
      if (!firstPage) firstPage = pages.length;
      items.push ( {
        kind : 'text', text : l, x : align === 'center' ? x + (width - widthOf (l, size)) / 2 : x, y, w : width, h : lh, size,
        color, bold
      });
      y += lh
    }
    y += gap;
    return firstPage;
  };
  const fieldText = (r, color) => {
    const labelBold = moduleStyle (r.module, v).labelBold, size = v.fontSize, lh = size * v.lineHeight, width = y < portraitBottom ?
    Math.min (contentW, portraitLeft - m - 16) : contentW, label = r.label, value = r.value, labelW = widthOf (label,
    size) + 4;
    if (labelW > width * .7) {
      text (label, size, c.ink, labelBold, 0);
      text (value, size, color, false, 4);
      return
    }
    const first = wrapText (value, size, Math.max (20, width - labelW)) [0] || '';
    ensure (lh);
    items.push ( {
      kind : 'text', text : label, x : m, y, w : labelW, h : lh, size, color : labelBold ? c.ink : color, bold : labelBold
    });
    if (first) items.push ( {
      kind : 'text', text : first, x : m + labelW, y, w : width - labelW, h : lh, size, color, bold : false
    });
    y += lh;
    const remaining = value.slice (first.length).trimStart ();
    if (remaining) text (remaining, size, color, false, 4);
    else y += 4
  };
  const photoRows = async arr => {
    const n = v.photosPerRow, space = 12, cellW = (contentW - space * (n - 1)) / n;
    for (let i = 0; i < arr.length; i += n) {
      const group = arr.slice (i, i + n), datas = await Promise.all (group.map (exportPhotoData)), infos = await Promise.all (datas.map (imageInfo)),
      sizes = infos.map (im => {
        const scale = Math.min (cellW / im.width, (H * .30) / im.height); return [im.width * scale, im.height * scale]
      }), captions = group.map (p => wrapText (fieldVisible ('photo:' + p.id + ':caption') ? (p.caption || p.name) : '',
      Math.max (8, v.fontSize - 2), cellW)), capH = Math.max (...captions.map (a => a.length)) * Math.max (8, v.fontSize - 2) * 1.35,
      maxH = Math.max (...sizes.map (s => s [1]));
      ensure (maxH + capH + 20);
      const top = y;
      group.forEach ((p, j) => {
        const x = m + j * (cellW + space), [w, h] = sizes [j]; items.push ( {
          kind : 'image', data : datas [j], x : x + (cellW - w) / 2, y : top, w, h, photoId : p.id
        }); captions [j].forEach ((line, k) => items.push ( {
          kind : 'text', text : line, x, y : top + maxH + 7 + k * Math.max (8, v.fontSize - 2) * 1.35, w : cellW, h : Math.max (8,
          v.fontSize - 2) * 1.35, size : Math.max (8, v.fontSize - 2), color : c.muted, bold : false
        }));
      });
      y = top + maxH + capH + 18;
    }
  };
  page ();
  if (! rows.length) text (exportLabel ('尚未选择导出内容', 'No content selected'), 12, c.muted);
  const tocEntries = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex ++) {
    const r = rows [rowIndex], style = moduleStyle (r.module, v);
    if (r.kind === 'entry') {
      let estimate = v.fontSize * v.lineHeight * 1.1 + v.gap;
      for (let j = rowIndex + 1; j < rows.length && ! ['section', 'entry', 'title'].includes (rows [j].kind); j ++) {
        const next = rows [j];
        if (next.kind === 'photos') {
          estimate += H * .30 + 40;
          break
        }
        estimate += wrapText (next.text || '', v.fontSize, contentW).length * v.fontSize * v.lineHeight + 4
      }
      if (estimate < bottom - m - 24) ensure (estimate)
    }
    if (r.breakBefore && y > m + 20) page ();
    if (r.kind === 'section') {
      let estimate = v.gap + v.fontSize * v.lineHeight * 2.5, seenEntry = false;
      for (let j = rowIndex + 1; j < rows.length; j ++) {
        const next = rows [j];
        if (next.kind === 'section' || (next.kind === 'entry' && seenEntry)) break;
        if (next.kind === 'entry') seenEntry = true;
        if (next.kind === 'photos') {
          estimate += H * .24;
          break
        }
        estimate += wrapText (next.text || '', v.fontSize, contentW).length * v.fontSize * v.lineHeight + 5;
        if (! seenEntry && j > rowIndex + 2) break
      }
      if (estimate < bottom - m - 24) ensure (estimate)
    }
    if (r.kind === 'title') {
      ensure (90);
      text (r.text, v.fontSize * 2, c.ink, true, 12);
    }
    else if (r.kind === 'section') {
      if (! r.avatar) y = Math.max (y, portraitBottom);
      ensure (v.gap + v.fontSize * v.lineHeight * 3 + (r.avatar ? v.avatarSize * 72 / 25.4 : 0));
      if (r.avatar) {
        const data = await avatarData (), size = v.avatarSize * 72 / 25.4, height = size * (v.avatarShape === 'id' ? 1.5 : v.avatarShape === 'custom' ?
        v.avatarRatioH / v.avatarRatioW : 1);
        items.push ( {
          kind : 'image', data, x : W - m - size, y, w : size, h : height, portrait : true
        });
        portraitBottom = y + height + 8;
        portraitLeft = W - m - size
      }
      y += v.gap;
      const headingPage = text (r.text, style.titleSize, /^#[0-9a-f]{6}$/i.test (style.titleColor || '') ? style.titleColor : c.accent, style.titleBold, 5, m, contentW, style.titleAlign);
      // The actual text placement wins over estimates, including oversized/wrapped custom headings.
      tocEntries.push ({ text : r.text, page : headingPage });
      items.push ( {
        kind : 'line', x : m, y, w : y < portraitBottom ? portraitLeft - m - 16 : contentW, h : .6, color : c.line
      });
      y += 10;
    }
    else if (r.kind === 'entry') {
      ensure (v.fontSize * v.lineHeight * 3);
      y += v.gap * .45;
      text (r.text, style.subtitleSize, c.ink, style.subtitleBold, 5, m, contentW, style.subtitleAlign)
    }
    else if (r.kind === 'photos') await photoRows (r.photos);
    else if (r.kind === 'custom') {
      if (['left', 'right'].includes (r.layout) && r.photos.length && r.text) {
        const sideData = await exportPhotoData (r.photos [0]), im = await imageInfo (sideData), iw = contentW * .32, ih = Math.min (iw * im.height / im.width,
        H * .28), actualW = ih * im.width / im.height, tw = contentW - iw - 16, lines = wrapText (r.text, v.fontSize, tw),
        blockH = Math.max (ih, lines.length * v.fontSize * v.lineHeight);
        if (blockH < bottom - (m + 18)) {
          ensure (blockH + 12);
          const top = y, ix = r.layout === 'left' ? m : W - m - iw, tx = r.layout === 'left' ? m + iw + 16 : m;
          items.push ( {
            kind : 'image', data : sideData, x : ix + (iw - actualW) / 2, y, w : actualW, h : ih
          });
          text (r.text, v.fontSize, c.ink, false, 0, tx, tw);
          y = Math.max (y, top + ih) + 12;
          if (r.photos [0].caption && fieldVisible ('photo:' + r.photos [0].id + ':caption')) text (r.photos [0].caption, v.fontSize - 1,
          c.muted, false, 6);
          if (r.photos.length > 1) await photoRows (r.photos.slice (1));
        }
        else {
          text (r.text, v.fontSize, c.ink);
          await photoRows (r.photos)
        }
      }
      else {
        if (r.text) text (r.text, v.fontSize, c.ink);
        await photoRows (r.photos)
      }
    }
    else if (r.label) fieldText (r, r.kind === 'meta' ? c.muted : c.ink);
    else text (r.text, v.fontSize, r.kind === 'meta' ? c.muted : c.ink, false, 4);
  }
  const contents = buildContentsPages (tocEntries, { W, H, m, contentW, bottom, version : v, colors : c });
  pages.unshift (...contents);
  return decorateDocumentPages ({ W, H, pages, colors : c, version : v, backgroundData : await paperBackground52 (v, W, H), tocPageCount : contents.length,
    tocEntries : tocEntries.map (entry => ({ ...entry, page : entry.page + contents.length })) }, m);
}

async function canvasPages (plan) {
  const p = plan || await documentPlan (), pages = [];
  for (const page of p.pages) {
    const c = document.createElement ('canvas');
    c.width = Math.round (p.W * 2);
    c.height = Math.round (p.H * 2);
    const x = c.getContext ('2d');
    x.scale (2, 2);
    x.fillStyle = p.colors.bg;
    x.fillRect (0, 0, p.W, p.H);
    for (const it of page.items) {
      if (it.kind === 'text') {
        x.font = (it.bold ? '700 ' : '400 ') + it.size + 'px QichengLatin,QichengCJK,"Microsoft YaHei",sans-serif';
        x.fillStyle = it.color;
        x.fillText (it.text, it.x, it.y + it.size * .86)
      }
      else if (it.kind === 'line') {
        x.fillStyle = it.color;
        x.fillRect (it.x, it.y, it.w, it.h)
      }
      else x.drawImage (await loadImage (it.data), it.x, it.y, it.w, it.h)
    }
    pages.push (c)
  }
  return pages;
}

function planSvg (plan, page) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + plan.W + ' ' + plan.H + '" class="paper-page" role="img" aria-label="' +
  tr ('简历分页预览', 'Resume page preview') + '"><rect width="100%" height="100%" fill="' + plan.colors.bg + '"/>' + page.items.map (i =>
  i.kind === 'text' ? '<text x="' + i.x + '" y="' + (i.y + i.size * .86) + '" font-family="QichengLatin,QichengCJK,sans-serif" font-size="' +
  i.size + '" font-weight="' + (i.bold ? 700 : 400) + '" fill="' + i.color + '">' + esc (i.text) + '</text>' : i.kind === 'line' ?
  '<rect x="' + i.x + '" y="' + i.y + '" width="' + i.w + '" height="' + i.h + '" fill="' + i.color + '"/>' : '<image x="' +
  i.x + '" y="' + i.y + '" width="' + i.w + '" height="' + i.h + '" href="' + i.data + '"/>').join ('') + '</svg>';
}

async function refreshPreview () {
  const token = ++ ctx.previewToken, modal = $ ('#composerPreview')?.open, el = modal ? $ ('#modalPagePreview') : $ ('#pagePreview'),
  status = modal ? $ ('#modalPreviewStatus') : $ ('#previewStatus');
  if (! el) return;
  el.hidden = false;
  el.classList.add ('preview-updating');
  if (status) status.textContent = tr ('正在生成分页预览…', 'Generating page preview…');
  try {
    const plan = await documentPlan ();
    if (token !== ctx.previewToken) return;
    ctx.layoutCache = plan;
    el.innerHTML = plan.pages.map ((p, i) => '<figure>' + planSvg (plan, p) + '<figcaption>' + tr ('第 ', 'Page ') + (i +
    1) + ' / ' + plan.pages.length + '</figcaption></figure>').join ('');
    if (status) status.textContent = plan.pages.length + tr (' 页 · ', ' pages · ') + (plan.version.orientation === 'portrait' ?
    tr ('纵向', 'Portrait') : tr ('横向', 'Landscape')) + ' · ' + plan.version.fontSize + ' pt';
    el.classList.remove ('preview-updating')
  }
  catch (e) {
    if (token === ctx.previewToken) {
      el.innerHTML = '<p>' + esc (tr ('预览失败：', 'Preview failed: ') + e.message) + '</p>';
      el.classList.remove ('preview-updating')
    }
  }
}

function colorRgb (hex) {
  const x = hex.replace ('#', '');
  return PDFLib.rgb (parseInt (x.slice (0, 2), 16) / 255, parseInt (x.slice (2, 4), 16) / 255, parseInt (x.slice (4,
  6), 16) / 255)
}

async function pdfBytes (plan) {
  const p = plan || await documentPlan (), d = await PDFLib.PDFDocument.create ();
  d.registerFontkit (fontkit);
  const fonts = await Promise.all ([d.embedFont (dataBytes (FONT_LATIN), {
    subset : false
  }), d.embedFont (dataBytes (FONT_CJK), {
    subset : false
  })]), images = new Map ();
  for (const pg of p.pages) {
    const page = d.addPage ([p.W, p.H]);
    page.drawRectangle ( {
      x : 0, y : 0, width : p.W, height : p.H, color : colorRgb (p.colors.bg)
    });
    for (const i of pg.items) {
      if (i.kind === 'line') page.drawRectangle ( {
        x : i.x, y : p.H - i.y - i.h, width : i.w, height : i.h, color : colorRgb (i.color)
      });
      else if (i.kind === 'image') {
        let im = images.get (i.data);
        if (! im) {
          im = /^data:image\/png/.test (i.data) ? await d.embedPng (dataBytes (i.data)) : await d.embedJpg (dataBytes (i.data));
          images.set (i.data, im)
        }
        page.drawImage (im, {
          x : i.x, y : p.H - i.y - i.h, width : i.w, height : i.h
        })
      }
      else {
        if (i.bold) page.pushOperators (PDFLib.setTextRenderingMode (PDFLib.TextRenderingMode.FillAndOutline), PDFLib.setLineWidth (.32),
        PDFLib.setStrokingRgbColor (...[1, 3, 5].map (n => parseInt (i.color.slice (n, n + 2), 16) / 255)));
        let x = i.x;
        for (const c of i.text) {
          const fi = fontFor (c.codePointAt (0));
          page.drawText (c, {
            x, y : p.H - i.y - i.size * .86, size : i.size, font : fonts [fi], color : colorRgb (i.color)
          });
          x += widthOf (c, i.size)
        }
        if (i.bold) page.pushOperators (PDFLib.setTextRenderingMode (PDFLib.TextRenderingMode.Fill))
      }
    }
  }
  d.setTitle (currentVersion ().name);
  d.setCreator ('Qicheng Personal Studio ' + VERSION);
  return d.save ();
}

async function wordBlob () {
  const v = clone (currentVersion ()), rows = v.wordImages ? exportRows () : textRows (), col = v.wordBW ? {
    bg : '#ffffff', paper : '#ffffff', ink : '#000000', accent : '#000000', muted : '#000000', line : '#bbbbbb'
  } : exportColors (v), {
    Document, Paragraph, TextRun, Packer, ImageRun, PageBreak, HeadingLevel, AlignmentType, Footer, Header, PageNumber, TableOfContents, BorderStyle
  }
  = docx, children = [];
  const image = async data => {
    const im = await loadImage (data), maxW = (v.orientation === 'landscape' ? 1122 : 794) - v.margin * 7.56, maxH = 320,
    scale = Math.min (1, maxW / im.width, maxH / im.height);
    return new ImageRun ( {
      data : dataBytes (data), type : data.startsWith ('data:image/png') ? 'png' : 'jpg', transformation : {
        width : Math.round (im.width * scale), height : Math.round (im.height * scale)
      }
    })
  };
  if (v.showToc) {
    const entries = rows.filter (r => r.kind === 'section');
    if (entries.length) {
      children.push (new Paragraph ( {
        heading : HeadingLevel.TITLE, children : [new TextRun ( {
          text : exportLabel ('目录', 'Contents'), bold : true, size : v.fontSize * 4
        })]
      }));
      children.push (new TableOfContents (exportLabel ('目录', 'Contents'), {
        headingStyleRange : '1-1', hyperlink : true, beginDirty : true,
        // Visible fallback labels until Word lays out the document and updates the field.
        contentChildren : entries.map (entry => new Paragraph ({ children : [new TextRun ({ text : entry.text, size : v.fontSize * 2 })] }))
      }));
      children.push (new Paragraph ( {
        children : [new PageBreak ()]
      }))
    }
  }
  for (const r of rows) {
    if (r.breakBefore && children.length) children.push (new Paragraph ( {
      children : [new PageBreak ()]
    }));
    if (r.kind === 'photos' || r.kind === 'custom') {
      if (r.text) children.push (new Paragraph ( {
        spacing : {
          line : Math.round (v.lineHeight * 240), after : 80
        }, children : r.text.split ('\n').map ((t, j) => new TextRun ( {
          text : t, break : j ? 1 : 0, size : v.fontSize * 2, color : col.ink.slice (1)
        }))
      }));
      if (v.wordImages) for (const p of r.photos) {
        children.push (new Paragraph ( {
          children : [await image (await exportPhotoData (p))]
        }));
        if (fieldVisible ('photo:' + p.id + ':caption') && (p.caption || p.name)) children.push (new Paragraph ( {
          children : [new TextRun ( {
            text : p.caption || p.name, size : (v.fontSize - 1) * 2, color : col.muted.slice (1)
          })]
        }))
      }
      continue
    }
    if (r.avatar && v.wordImages) {
      const data = await avatarData (), w = v.avatarSize * 3.78, h = w * (v.avatarShape === 'id' ? 1.5 : v.avatarShape === 'custom' ?
      v.avatarRatioH / v.avatarRatioW : 1);
      children.push (new Paragraph ( {
        children : [new ImageRun ( {
          data : dataBytes (data), type : 'png', transformation : {
            width : w, height : h
          }
        })]
      }))
    }
    const style = moduleStyle (r.module, v), heading = r.kind === 'title' ? HeadingLevel.TITLE : r.kind === 'section' ?
    HeadingLevel.HEADING_1 : r.kind === 'entry' ? HeadingLevel.HEADING_2 : undefined, size = Math.round ((r.kind === 'section' ?
    style.titleSize : r.kind === 'entry' ? style.subtitleSize : v.fontSize) * 2);
    let runs;
    if (r.label) {
      runs = [new TextRun ( {
        text : r.label, bold : style.labelBold, font : 'Microsoft YaHei', size, color : (style.labelBold ? col.ink : r.kind === 'meta' ?
        col.muted : col.ink).slice (1)
      }), ...r.value.split ('\n').map ((t, j) => new TextRun ( {
        text : t, break : j ? 1 : 0, font : 'Microsoft YaHei', size, color : col.ink.slice (1)
      }))]
    }
    else runs = String (r.text || '').split ('\n').map ((t, j) => new TextRun ( {
      text : t, break : j ? 1 : 0, bold : r.kind === 'section' ? style.titleBold : r.kind === 'entry' ? style.subtitleBold : false,
      font : 'Microsoft YaHei', size, color : (r.kind === 'section' ? !v.wordBW && /^#[0-9a-f]{6}$/i.test (style.titleColor || '') ? style.titleColor : col.accent : col.ink).slice (1)
    }));
    children.push (new Paragraph ( {
      heading, alignment : (r.kind === 'section' ? style.titleAlign : r.kind === 'entry' ? style.subtitleAlign : 'left') === 'center' ?
      AlignmentType.CENTER : AlignmentType.LEFT, keepNext : ! ! heading, spacing : {
        before : r.kind === 'section' ? v.gap * 20 : 40, after : 80, line : Math.round (v.lineHeight * 240)
      }, border : r.kind === 'section' ? { bottom : { style : BorderStyle.SINGLE, size : 4, color : col.line.slice (1), space : 5 } } : undefined, children : runs
    }))
  }
  const landscape = v.orientation === 'landscape', background = !v.wordBW ? await paperBackground52 (v, landscape ? 841.89 : 595.28, landscape ? 595.28 : 841.89) : '',
  headerChildren = [], border = { style : BorderStyle.SINGLE, size : 4, color : col.line.slice (1), space : 12 };
  if (background) headerChildren.push (new Paragraph ({ children : [new ImageRun ({
    data : dataBytes (background), type : 'jpg', transformation : { width : landscape ? 1122.52 : 793.71, height : landscape ? 793.71 : 1122.52 },
    floating : { horizontalPosition : { relative : 'page', offset : 0 }, verticalPosition : { relative : 'page', offset : 0 }, behindDocument : true, allowOverlap : true, layoutInCell : false, zIndex : 0 }
  })] }));
  headerChildren.push (new Paragraph ({ border : { bottom : { style : BorderStyle.SINGLE, size : v.pageDecoration === 'editorial' ? 12 : 4, color : col.line.slice (1), space : 3 } }, children : [] }));
  const
  doc = new Document ( {
    creator : 'Qicheng Personal Studio ' + VERSION, title : v.name, background : { color : col.paper.slice (1) }, features : { updateFields : true }, styles : {
      default : {
        document : {
          run : {
            font : 'Microsoft YaHei', size : v.fontSize * 2, color : col.ink.slice (1)
          }, paragraph : {
            spacing : {
              line : Math.round (v.lineHeight * 240), after : 80
            }
          }
        }
      }
    }, sections : [ {
      properties : {
        page : {
          size : {
            width : landscape ? 16838 : 11906, height : landscape ? 11906 : 16838
          }, margin : {
            top : v.margin * 56.69, bottom : v.margin * 56.69, left : v.margin * 56.69, right : v.margin * 56.69,
            header : Math.min (500, v.margin * 28), footer : Math.min (500, v.margin * 28)
          }, borders : v.pageDecoration === 'frame' ? { pageBorderTop : border, pageBorderBottom : border, pageBorderLeft : border, pageBorderRight : border } : undefined
        }
      }, footers : v.showPageNumbers !== false ? { default : new Footer ({ children : [new Paragraph ({ alignment : AlignmentType.RIGHT,
        children : [new TextRun ({ children : [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size : 16, color : col.muted.slice (1) })] })] }) } : undefined,
      headers : { default : new Header ({ children : headerChildren }) },
      children : children.length ? children : [new Paragraph ('')]
    }]
  });
  return Packer.toBlob (doc)
}

async function pptBlob (plan) {
  const p = plan || await documentPlan (), ppt = new PptxGenJS ();
  ppt.defineLayout ( {
    name : 'RESUME', width : p.W / 72, height : p.H / 72
  });
  ppt.layout = 'RESUME';
  ppt.author = 'Qicheng Resume Studio';
  ppt.subject = 'Editable application resume';
  ppt.title = currentVersion ().name;
  ppt.lang = currentVersion ().exportLang === 'en' ? 'en-US' : 'zh-CN';
  ppt.theme = {
    headFontFace : 'Microsoft YaHei', bodyFontFace : 'Microsoft YaHei', lang : ppt.lang
  };
  if (p.version.pptMode === 'image') {
    for (const c of await canvasPages (p)) {
      const slide = ppt.addSlide ();
      slide.addImage ( {
        data : c.toDataURL ('image/png'), x : 0, y : 0, w : p.W / 72, h : p.H / 72
      })
    }
  }
  else for (const pg of p.pages) {
    const slide = ppt.addSlide ();
    slide.background = {
      color : p.colors.bg.slice (1)
    };
    for (const i of pg.items) {
      if (i.kind === 'image') slide.addImage ( {
        data : i.data, x : i.x / 72, y : i.y / 72, w : i.w / 72, h : i.h / 72
      });
      else if (i.kind === 'line') slide.addShape (ppt.ShapeType.rect, {
        x : i.x / 72, y : i.y / 72, w : i.w / 72, h : Math.max (.4, i.h) / 72, line : {
          color : i.color.slice (1), transparency : 100
        }, fill : {
          color : i.color.slice (1)
        }
      });
      else if (i.text) slide.addText (i.text, {
        x : i.x / 72, y : (i.y - 1) / 72, w : i.w / 72, h : (i.h + 4) / 72, fontSize : i.size, fontFace : 'Microsoft YaHei',
        bold : i.bold, color : i.color.slice (1), margin : 0, breakLine : false, paraSpaceAfterPt : 0, valign : 'top', wrap : false
      })
    }
  }
  return ppt.write ( {
    outputType : 'blob'
  });
}

function selectedAttachments3 () {
  const v = currentVersion (), ids = [];
  for (const [k, arr] of [['awards', ctx.state.awards], ['experiences', ctx.state.experiences], ['practices', ctx.state.practices],
  ['achievements', ctx.state.achievements], ['custom', ctx.state.customBlocks], ['learning', ctx.state.learning.books]]) if (! v.disabled.includes (k)) for (const x of arr) if (! v.excluded.includes (k +
  ':' + x.id)) for (const id of x.attachments || []) if (fieldVisible ('attachment:' + k + ':' + x.id + ':' + id) &&
  ! ids.includes (id)) ids.push (id);
  return ids.map (assetBy3).filter (Boolean)
}

function exportHTML3 (plan) {
  const v = currentVersion (), style = '@font-face{font-family:QichengLatin;src:url(' + FONT_LATIN + ')}@font-face{font-family:QichengCJK;src:url(' +
  FONT_CJK + ')}body{margin:0;background:#ddd;font-family:system-ui}main{max-width:960px;margin:auto}svg{display:block;width:100%;height:auto;margin:20px 0;background:white}.attachments{padding:25px;background:white;margin:20px 0}.attachments a{display:block;margin:12px 0}@media print{body{background:white}main{max-width:none}svg{margin:0;break-after:page;width:100%}svg:last-child{break-after:auto}.attachments{display:none}@page{size:' +
  (v.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait') + ';margin:0}}', files = selectedAttachments3 ();
  return '<!doctype html><html lang="' + (v.exportLang === 'en' ? 'en' : 'zh-CN') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
  esc (v.name) + '</title><style>' + style + '</style></head><body><main>' + plan.pages.map (p => planSvg (plan, p)).join ('') +
  (files.length ? '<section class="attachments"><h2>' + exportLabel ('附件原文件', 'Original attachments') + '</h2>' + files.map (a =>
  '<a href="' + esc (a.data) + '" download="' + esc (a.name) + '">' + esc (a.name) + '</a>').join ('') + '</section>' : '') +
  '</main></body></html>'
}

async function recordExport3 (blob, name, type) {
  const data = await readFile (blob), a = {
    id : uid (), name, mime : blob.type, kind : 'export', data, size : blob.size, createdAt : new Date ().toISOString (),
    source : 'generated'
  };
  ctx.state.assets.push (a);
  ctx.state.exportHistory.push ( {
    id : uid (), assetId : a.id, name, type, createdAt : a.createdAt, versionId : currentVersion ().id, purpose : currentVersion ().purpose ||
    'resume'
  });
  await save ();
  download (blob, blob.type, name)
}

async function exportFile (type) {
  if (ctx.busy || ctx.uploadBusy) return;
  const check = preflight3 ();
  if (check.errors.length && ! await confirmAction (tr ('导出前检查发现错误', 'Preflight found errors'), check.errors.map (x =>
  x.message).join ('\n') + tr ('\n建议返回修正，也可以确认后继续导出。', '\nConsider fixing them, or confirm to export anyway.'), tr ('仍然导出',
  'Export anyway'))) return;
  if (! exportRows ().length) return toast (tr ('请先选择要导出的内容', 'Select content first'));
  ctx.busy = true;
  $$ ('[data-export]').forEach (b => b.disabled = true);
  toast (tr ('正在生成文件…', 'Generating document…'));
  try {
    await save ();
    const base = safeFilename3 (currentVersion ().filename || currentVersion ().name);
    let blob, name = base + '.' + type;
    if (type === 'md') blob = new Blob ([markdown ()], {
      type : 'text/markdown;charset=utf-8'
    });
    else if (type === 'docx') blob = await wordBlob ();
    else {
      const plan = await documentPlan ();
      if (type === 'pdf') blob = new Blob ([await pdfBytes (plan)], {
        type : 'application/pdf'
      });
      else if (type === 'pptx') blob = await pptBlob (plan);
      else if (type === 'html') blob = new Blob ([exportHTML3 (plan)], {
        type : 'text/html;charset=utf-8'
      });
      else {
        const pages = await canvasPages (plan);
        if (pages.length === 1) blob = await new Promise (r => pages [0].toBlob (r, 'image/png'));
        else {
          const zip = new JSZip ();
          for (let i = 0; i < pages.length; i ++) {
            const b = await new Promise (r => pages [i].toBlob (r, 'image/png'));
            zip.file ('page-' + (i + 1) + '.png', await b.arrayBuffer ())
          }
          blob = await zip.generateAsync ( {
            type : 'blob', mimeType : 'application/zip'
          });
          name = base + '-PNG.zip'
        }
      }
    }
    if (! blob) throw Error (tr ('生成失败，请重试', 'Generation failed. Try again.'));
    await recordExport3 (blob, name, type);
    toast (tr ('文件已生成，并保存在导出内容管理', 'Document created and kept in Exported documents'))
  }
  catch (e) {
    console.error (e);
    toast (tr ('导出失败：', 'Export failed: ') + e.message)
  }
  finally {
    ctx.busy = false;
    $$ ('[data-export]').forEach (b => b.disabled = false)
  }
}

export { metrics, fontFor, widthOf, ensureFonts, wrapText, exportColors, buildContentsPages, decorateDocumentPages, documentPlan, canvasPages, planSvg, refreshPreview, colorRgb, pdfBytes, wordBlob, pptBlob, selectedAttachments3, exportHTML3, recordExport3, exportFile };

// All controls for this feature, in their original override order.
function bindExportControls () {
  $$ ('[data-export]').forEach (b => b.onclick = () => exportFile (b.dataset.export));
}
export { bindExportControls };
