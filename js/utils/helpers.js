import { ctx } from '../state.js';
import { EN } from '../data.js';
// 启程 · js/utils/helpers.js

const $ = s => document.querySelector (s);

const $$ = s => [...document.querySelectorAll (s)];

const esc = v => String (v ?? '').replace (/[&<>"']/g, c => ( {
  '&' : '&amp;', '<' : '&lt;', '>' : '&gt;', '"' : '&quot;', "'" : '&#39;'
}
[c]));

const clone = v => typeof structuredClone === 'function' ? structuredClone (v) : JSON.parse (JSON.stringify (v));

const uid = () => 'r' + Date.now ().toString (36) + Math.random ().toString (36).slice (2, 9);

const tr = (zh, en) => ctx.state?.uiLang === 'en' ? en : zh;

function clamp (v, min, max, fallback) {
  return Number.isFinite (Number (v)) ? Math.max (min, Math.min (max, Number (v))) : fallback;
}

function toastV1 (s) {
  const el = $ ('#toast');
  if (! el) return;
  el.textContent = s;
  el.classList.add ('show');
  clearTimeout (toast.timer);
  toast.timer = setTimeout (() => el.classList.remove ('show'), 4000);
}

const options = (list, current, empty) => (empty ? '<option value="">' + esc (empty) + '</option>' : '') + list.map (v =>
'<option value="' + esc (v) + '" ' + (v === current ? 'selected' : '') + '>' + esc (v) + '</option>').join ('');

function input (path, label, value = '', placeholder = '', type = 'text', extra = '') {
  return '<label class="field"><span>' + esc (label) + '</span><input type="' + type + '" data-bind="' + path + '" value="' +
  esc (value) + '" placeholder="' + esc (placeholder) + '" ' + extra + '></label>';
}

function area (path, label, value = '', placeholder = '', extra = '') {
  return '<label class="field"><span>' + esc (label) + '</span><textarea data-bind="' + path + '" placeholder="' + esc (placeholder) +
  '" ' + extra + '>' + esc (value) + '</textarea></label>';
}

function select (path, label, value, list, empty) {
  return '<label class="field"><span>' + esc (label) + '</span><select data-bind="' + path + '">' + options (list, value,
  empty) + '</select></label>';
}

function head (eyebrow, title, description = '') {
  return '<div class="page-head"><div><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1>' + (description ?
  '<p>' + description + '</p>' : '') + '</div></div>';
}

const readFile = f => new Promise ((resolve, reject) => {
  const r = new FileReader (); r.onload = () => resolve (r.result); r.onerror = () => reject (Error ('文件读取失败')); r.readAsDataURL (f)
});

const loadImage = data => new Promise ((resolve, reject) => {
  const i = new Image (); i.onload = () => resolve (i); i.onerror = () => reject (Error ('照片无法读取')); i.src = data
});

function download22 (content, mime, name) {
  const blob = content instanceof Blob ? content : new Blob ([content], {
    type : mime
  });
  const url = URL.createObjectURL (blob);
  if (true) {
    const dialog = $ ('#downloadDialog'), link = $ ('#downloadLink'), share = $ ('#shareFile');
    if (ctx.activeDownload) URL.revokeObjectURL (ctx.activeDownload.url);
    ctx.activeDownload = {
      blob, url, name
    };
    $ ('#downloadDescription').textContent = name + ' · ' + (blob.size / 1024).toFixed (0) + ' KB';
    link.href = url;
    link.download = name;
    let file = null;
    try {
      file = new File ([blob], name, {
        type : blob.type || mime
      })
    }
    catch {
    }
    let canShare = false;
    try {
      canShare = ! ! (file && navigator.canShare?.( {
        files : [file]
      }));
    }
    catch {
    }
    share.hidden = ! canShare;
    const open = $ ('#openGeneratedFile');
    open.href = url;
    open.hidden = ! /^(application\/pdf|image\/|text\/html)/.test (mime);
    share.onclick = async () => {
      try {
        await navigator.share ( {
          files : [file], title : '启程 · 简历文件'
        })
      }
      catch (err) {
        if (err.name !== 'AbortError') toast ('请点击“保存文件”，或用系统浏览器打开。')
      }
    };
    $ ('#closeDownload').onclick = () => dialog.close ();
    if (! dialog.open) dialog.showModal ();
    translateUI ();
    dialog.onclose = () => {
      const previous = ctx.activeDownload;
      setTimeout (() => {
        if (ctx.activeDownload === previous) {
          URL.revokeObjectURL (previous.url); ctx.activeDownload = null
        }
      }, 60000)
    };
    return
  }
  const a = document.createElement ('a');
  a.href = url;
  a.download = name;
  document.body.append (a);
  a.click ();
  a.remove ();
  setTimeout (() => URL.revokeObjectURL (url), 60000)
}

function dataBytes (data) {
  const s = atob (data.split (',') [1]);
  return Uint8Array.from (s, c => c.charCodeAt (0))
}

function translateLabel (s) {
  s = String (s ?? '');
  if (ctx.state?.uiLang !== 'en') return s;
  if (EN [s]) return EN [s];
  if (/^启程 v/.test (s)) return s.replace ('启程', 'Qicheng').replace ('离线版', 'Offline');
  if (/^已保存 · /.test (s)) return s.replace ('已保存', 'Saved');
  if (/^只看梦想院校/.test (s)) return s.replace ('只看梦想院校', 'Dream universities only');
  if (/^\d+ 条$/.test (s)) return s.replace (' 条', ' records');
  if (/^\d+ 次考试$/.test (s)) return s.replace (' 次考试', ' exams');
  if (/^\d+ 项荣誉$/.test (s)) return s.replace (' 项荣誉', ' awards');
  if (/^\d+ 段经历$/.test (s)) return s.replace (' 段经历', ' experiences');
  if (/^(单科排名|成绩|科目|满分|移除科目|移除照片) \d+$/.test (s)) {
    const [z, n] = s.split (' ');
    return (EN [z] || ( {
      '移除科目' : 'Remove subject', '移除照片' : 'Remove photo'
    }) [z]) + ' ' + n
  }
  return s;
}

function translateUI (root = document.body) {
  document.documentElement.lang = ctx.state.uiLang === 'en' ? 'en' : 'zh-CN';
  if (! document.createTreeWalker) return;
  const walker = document.createTreeWalker (root, NodeFilter.SHOW_TEXT);
  let n;
  while (n = walker.nextNode ()) {
    const e = n.parentElement;
    if (! e || e.closest ('script,style,textarea,svg,.paper-page,.record h3,#miniName,#miniSchool,.select-record .check span,.module-title,.media-tile')) continue;
    if (! ctx.originalText.has (n)) ctx.originalText.set (n, n.nodeValue);
    const value = ctx.originalText.get (n);
    n.nodeValue = value.replace (value.trim (), translateLabel (value.trim ()));
  }
  for (const e of root.querySelectorAll ('[placeholder],[aria-label],[title]')) {
    let a = ctx.originalAttrs.get (e);
    if (! a) {
      a = {
      };
      for (const k of ['placeholder', 'aria-label', 'title']) if (e.hasAttribute (k)) a [k] = e.getAttribute (k);
      ctx.originalAttrs.set (e, a)
    }
    for (const [k, v] of Object.entries (a)) e.setAttribute (k, translateLabel (v));
  }
}

const checkbox = (checked, attrs, label) => '<label class="check"><input type="checkbox" ' + (checked ? 'checked ' : '') +
attrs + '><span>' + label + '</span></label>';

function toast (s) {
  toastV1 (translateLabel (s));
}

function flip (list, key, on) {
  const i = list.indexOf (key);
  if (on && i < 0) list.push (key);
  if (! on && i >= 0) list.splice (i, 1);
}

function moveIn (arr, index, dir) {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= arr.length) return;
  [arr [index], arr [j]] = [arr [j], arr [index]];
}

function icon3 (kind) {
  const p = {
    calendar : 'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 14h2m6 0h2m-10 4h2', home : 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9', bulb : 'M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z', book : 'M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z', menu : 'M4 6h16M4 12h16M4 18h16', edit : 'm5 16-1 4 4-1L20 7l-3-3L5 16Z', layers : 'm12 3 10 5-10 5L2 8l10-5Zm-9 10 9 5 9-5M3 18l9 5 9-5',
    spark : 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z', chart : 'M4 3v17h17M8 16v-5m5 5V7m5 9V4', folder : 'M3 6h7l2 3h9v11H3V6Z',
    download : 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
    export : 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7', globe : 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 6-5 12 0 18 5-6 5-12 0-18',
    close : 'm6 6 12 12M6 18 18 6', chevron : 'm6 9 6 6 6-6', search : 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    check : 'm4 12 5 5L20 6'
  }
  [kind] || 'M4 4h16v16H4Z';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
  p + '"/></svg>'
}

function validData3 (d) {
  return typeof d === 'string' && /^data:[\w.+\-/]*(?:;[\w=.+-]+)*;base64,[A-Za-z0-9+/=]*$/.test (d)
}

function heading3 (tag, title, desc = '') {
  return '<div class="page-head3"><div class="eyebrow">' + tag + '</div><h1>' + title + '</h1>' + (desc ? '<p>' + desc +
  '</p>' : '') + '</div>'
}

function formatSize3 (n) {
  return n >= 1048576 ? (n / 1048576).toFixed (1) + ' MB' : Math.round (n / 1024) + ' KB'
}

function safeFilename3 (name) {
  return String (name || '启程文档').replace (/[\\/:*?"<>|\x00-\x1f]/g, '_').replace (/\.(?:pdf|docx|pptx|md|html|png|zip)$/i,
  '').trim ().slice (0, 100) || '启程文档'
}

function download (content, mime, name) {
  return download22 (content, mime, name)
}

export { $, $$, esc, clone, uid, tr, clamp, toastV1, options, input, area, select, head, readFile, loadImage, download22, dataBytes, translateLabel, translateUI, checkbox, toast, flip, moveIn, icon3, validData3, heading3, formatSize3, safeFilename3, download };

function savedStatus (message) {
  const element = $ ('#savedStatus');
  if (element) {
    element.textContent = message;
    element.classList.toggle ('saved-error', ctx.saveError);
    const card=element.closest?.('.sidebar-save52');if(card)card.dataset.saveState=ctx.saveError?'error':ctx.saving||ctx.dirty301?'saving':'saved';
    element.setAttribute ('role', 'status');
    element.setAttribute ('aria-live', 'polite');
  }
}
export { savedStatus };
