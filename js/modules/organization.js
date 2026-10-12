import { ctx } from '../state.js';
import { $, $$, esc, heading3, toast, tr, translateLabel } from '../utils/helpers.js';
import { save } from '../autosave.js';
import { changed, render } from '../app.js';
import { SCOPES } from '../constants.js';
// 启程 · js/modules/organization.js


async function moveRecord (kind, id, dir) {
  const a = ctx.state [kind].find (x => x.id === id), mode = ctx.boardMode [kind];
  if (! a) return;
  const group = ctx.state [kind].filter (x => x [mode] === a [mode]), other = group [group.indexOf (a) + dir];
  if (! other) return toast ('已经在本组边缘');
  const i = ctx.state [kind].indexOf (a), j = ctx.state [kind].indexOf (other);
  [ctx.state [kind] [i], ctx.state [kind] [j]] = [ctx.state [kind] [j], ctx.state [kind] [i]];
  await save ();
  render ();
}

async function dropRecord (kind, id, lane, beforeId) {
  const a = ctx.state [kind].find (x => x.id === id), mode = ctx.boardMode [kind];
  if (! a || id === beforeId) return;
  a [mode] = lane;
  ctx.state [kind] = ctx.state [kind].filter (x => x.id !== id);
  const i = ctx.state [kind].findIndex (x => x.id === beforeId);
  if (i >= 0) ctx.state [kind].splice (i, 0, a);
  else {
    const last = ctx.state [kind].map (x => x [mode]).lastIndexOf (lane);
    ctx.state [kind].splice (last + 1, 0, a);
  }
  await save ();
  render ();
  toast ('整理结果已保存');
}

function bindDrag (kind) {
  let dragged = null;
  $$ ('[data-sort-id]').forEach (card => {
    card.addEventListener ('dragstart', e => {
      if (e.target.closest ('button,select')) return e.preventDefault (); dragged = card.dataset.sortId; e.dataTransfer.setData ('text/plain',
      dragged); e.dataTransfer.effectAllowed = 'move'; card.classList.add ('dragging');
    }); card.addEventListener ('dragend', () => {
      card.classList.remove ('dragging'); $$ ('.lane.over').forEach (x => x.classList.remove ('over')); dragged = null;
    }); const handle = card.querySelector ('.drag-handle'); let touch = null; handle.addEventListener ('pointerdown',
    e => {
      if (e.pointerType === 'mouse') return; e.preventDefault (); touch = {
        id : card.dataset.sortId, ghost : null
      }; handle.setPointerCapture (e.pointerId);
    }); handle.addEventListener ('pointermove', e => {
      if (! touch) return; e.preventDefault (); if (! touch.ghost) {
        touch.ghost = card.cloneNode (true); touch.ghost.classList.add ('drag-ghost'); touch.ghost.style.width = Math.min (card.clientWidth,
        250) + 'px'; document.body.appendChild (touch.ghost);
      }
      touch.ghost.style.left = e.clientX - 70 + 'px'; touch.ghost.style.top = e.clientY - 30 + 'px'; $$ ('.lane').forEach (l =>
      l.classList.remove ('over')); document.elementFromPoint (e.clientX, e.clientY)?.closest ('.lane')?.classList.add ('over'); if (e.clientY > window.innerHeight - 90) window.scrollBy (0,
      16); if (e.clientY < 90) window.scrollBy (0, - 16);
    }); handle.addEventListener ('pointerup', e => {
      if (! touch) return; const target = document.elementFromPoint (e.clientX, e.clientY), lane = target?.closest ('.lane'),
      before = target?.closest ('[data-sort-id]'); touch.ghost?.remove (); const id = touch.id; touch = null; $$ ('.lane.over').forEach (x =>
      x.classList.remove ('over')); if (lane) dropRecord (kind, id, lane.dataset.lane, before?.dataset.sortId);
    }); handle.addEventListener ('pointercancel', () => {
      touch?.ghost?.remove (); touch = null; $$ ('.lane.over').forEach (x => x.classList.remove ('over'));
    });
  });
  $$ ('.lane').forEach (l => {
    l.addEventListener ('dragover', e => {
      e.preventDefault (); l.classList.add ('over');
    }); l.addEventListener ('dragleave', e => {
      if (! l.contains (e.relatedTarget)) l.classList.remove ('over');
    }); l.addEventListener ('drop', e => {
      e.preventDefault (); dropRecord (kind, dragged || e.dataTransfer.getData ('text/plain'), l.dataset.lane, e.target.closest ('[data-sort-id]')?.dataset.sortId);
    });
  });
}

function scopeOrder3 (scope) {
  const i = SCOPES.indexOf (scope);
  return i < 0 ? 5 : i
}

function organizeMode3 (kind) {
  return ctx.state.organizeModes?.[kind] || (kind === 'awards' ? 'scope' : 'custom')
}

function organizationPage3 (kind) {
  const mode = organizeMode3 (kind), arr = ctx.state [kind], names = {
    awards : ['荣誉', 'awards'], experiences : ['个人经历', 'experience'], practices : ['社会实践', 'social practice']
  }, lanes = mode === 'custom' ? [tr ('自由排序', 'Custom order')] : mode === 'scope' ? [...SCOPES, tr ('未填写级别', 'No scope entered')] : [...new Set (arr.map (x =>
  x.category || tr ('未分类', 'Uncategorized')))];
  return heading3 ('ORGANIZE / ' + kind.toUpperCase (), tr ('为' + names [kind] [0] + '，排出清晰的顺序。', 'Arrange your ' +
  names [kind] [1] + '.'), tr ('拖住手柄排序，或点击上下箭头。自由排序可跨记录调整，分类视图可在类别之间移动。', 'Drag the handle or use the arrows. Custom order moves records freely; category view also lets you move between categories.')) +
  '<section class="panel organization3"><div class="organization-toolbar3"><div class="segmented3">' + [['custom', '自由排序',
  'Custom order'], ...(kind === 'awards' ? [['scope', '按奖项级别', 'Award scope']] : []), ['category', '按类别整理', 'Category']].map (([id,
  z, e]) => '<button class="' + (mode === id ? 'active' : '') + '" data-organize-mode3="' + kind + ':' + id + '" aria-pressed="' +
  (mode === id) + '">' + tr (z, e) + '</button>').join ('') + '</div><span class="badge">' + arr.length + ' ' + tr ('条记录',
  'records') + '</span></div>' + (kind === 'awards' && mode === 'scope' ? '<p class="hint">' + tr ('默认顺序：国家级及以上 → 省级 → 市级 → 区级 → 校级。同一级别内可拖动；跨级别调整请切换自由排序。',
  'Default: national & above → provincial → municipal → district → school. Drag within a scope, or use Custom order to move freely.') +
  '</p>' : '') + '<div id="organizeList3" data-organize-kind3="' + kind + '">' + (arr.length ? lanes.map ((lane) =>
  {
    const list = mode === 'custom' ? arr : arr.filter (x => mode === 'scope' ? (x.scope || tr ('未填写级别', 'No scope entered')) === lane : (x.category ||
    tr ('未分类', 'Uncategorized')) === lane); return '<section class="order-lane3" data-order-lane3="' + esc (lane) + '"><div class="lane-label3"><h3>' +
    esc (translateLabel (lane)) + '</h3><span>' + list.length + '</span></div><div class="record-order-list3">' + list.map ((x,
    i) => '<article class="record-order3" data-record-order3="' + x.id + '"><span class="record-drag-handle3" data-record-handle3="' +
    x.id + '" aria-label="' + tr ('拖动记录', 'Drag record') + '">⠿</span><div class="order-record-text3"><strong>' + esc (x.title) +
    '</strong><p>' + esc ([x.scope, x.category, x.role, x.date].filter (Boolean).join (' · ')) + '</p></div><div class="order-record-actions3"><button data-record-move3="' +
    x.id + ':-1" aria-label="' + tr ('上移', 'Move up') + '" ' + (! i ? 'disabled' : '') + '>↑</button><button data-record-move3="' +
    x.id + ':1" aria-label="' + tr ('下移', 'Move down') + '" ' + (i === list.length - 1 ? 'disabled' : '') + '>↓</button><button data-edit3="' +
    kind + ':' + x.id + '">' + tr ('编辑', 'Edit') + '</button></div></article>').join ('') + '<div class="order-dropzone3">' +
    tr ('拖动到这里', 'Drop here') + '</div></div></section>'
  }).join ('') : '<div class="empty3">' + tr ('还没有记录。先录入，再整理。', 'Add some records before organizing.') + '<button data-go3="' +
  kind + '">' + tr ('去录入', 'Add a record') + '</button></div>') + '</div></section>'
}

function animateRows3 (rows, mutate) {
  const before = new Map (rows.map (r => [r, r.getBoundingClientRect ()]));
  mutate ();
  if (matchMedia ('(prefers-reduced-motion:reduce)').matches) return;
  for (const r of rows) {
    const d = before.get (r).top - r.getBoundingClientRect ().top;
    if (Math.abs (d) > 1) r.animate ([ {
      transform : 'translateY(' + d + 'px)'
    }, {
      transform : 'translateY(0)'
    }], {
      duration : 240, easing : 'cubic-bezier(.2,.75,.2,1)'
    })
  }
}

function settleRecords3 () {
  const el = $ ('#organizeList3');
  if (! el) return;
  const kind = el.dataset.organizeKind3, ids = [...el.querySelectorAll ('[data-record-order3]')].map (r => r.dataset.recordOrder3),
  byId = new Map (ctx.state [kind].map (x => [x.id, x]));
  ctx.state [kind] = ids.map (id => byId.get (id)).filter (Boolean);
  for (const list of $$ ('.record-order-list3')) {
    const rows = [...list.querySelectorAll ('.record-order3')];
    list.closest ('.order-lane3').querySelector ('.lane-label3>span').textContent = rows.length;
    rows.forEach ((r, i) => {
      const x = byId.get (r.dataset.recordOrder3); r.querySelector ('.order-record-text3 p').textContent = [x.scope, x.category,
      x.role, x.date].filter (Boolean).join (' · '); r.querySelector ('[data-record-move3$=":-1"]').disabled = i === 0; r.querySelector ('[data-record-move3$=":1"]').disabled = i === rows.length - 1
    })
  }
  changed (false)
}

function bindOrganize3 () {
  const list = $ ('#organizeList3');
  if (! list) return;
  const kind = list.dataset.organizeKind3;
  $$ ('[data-record-move3]').forEach (b => b.onclick = () => {
    const row = b.closest ('.record-order3'), dir = + b.dataset.recordMove3.split (':') [1], rows = [...row.parentElement.querySelectorAll ('.record-order3')],
    idx = rows.indexOf (row), target = rows [idx + dir]; if (! target) return; animateRows3 ([...list.querySelectorAll ('[data-record-order3]')],
    () => row.parentElement.insertBefore (row, dir < 0 ? target : target.nextSibling)); settleRecords3 ()
  });
  let drag = null;
  const stop = e => {
    if (! drag || drag.pointerId !== e.pointerId) return;
    const {
      row, ghost
    }
    = drag;
    drag = null;
    document.removeEventListener ('pointermove', move, true);
    document.removeEventListener ('pointerup', stop, true);
    document.removeEventListener ('pointercancel', stop, true);
    row.classList.remove ('drag-placeholder');
    if (ghost) {
      const r = row.getBoundingClientRect ();
      ghost.animate ([ {
        left : ghost.style.left, top : ghost.style.top, opacity : .96
      }, {
        left : r.left + 'px', top : r.top + 'px', opacity : 0
      }], {
        duration : 180, fill : 'forwards'
      }).onfinish = () => ghost.remove ();
      settleRecords3 ()
    }
    e.preventDefault ()
  };
  const move = e => {
    if (! drag || drag.pointerId !== e.pointerId) return;
    if (! drag.ghost) {
      if (Math.hypot (e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      const rect = drag.row.getBoundingClientRect ();
      drag.ghost = drag.row.cloneNode (true);
      drag.ghost.classList.add ('record-ghost3');
      drag.ghost.style.width = rect.width + 'px';
      drag.ghost.style.height = rect.height + 'px';
      document.body.append (drag.ghost);
      drag.row.classList.add ('drag-placeholder')
    }
    drag.ghost.style.left = e.clientX - drag.dx + 'px';
    drag.ghost.style.top = e.clientY - drag.dy + 'px';
    const target = document.elementFromPoint (e.clientX, e.clientY), row = target?.closest ('.record-order3'), lane = target?.closest ('.order-lane3'),
    sourceLane = drag.row.closest ('.order-lane3');
    if (lane && (organizeMode3 (kind) !== 'scope' || lane === sourceLane)) {
      if (lane !== sourceLane && organizeMode3 (kind) === 'category') {
        ctx.state [kind].find (x => x.id === drag.row.dataset.recordOrder3).category = lane.dataset.orderLane3
      }
      if (row && row !== drag.row) {
        const r = row.getBoundingClientRect (), after = e.clientY > r.top + r.height / 2;
        animateRows3 ([...list.querySelectorAll ('[data-record-order3]')], () => row.parentElement.insertBefore (drag.row,
        after ? row.nextSibling : row))
      }
      else if (target?.closest ('.order-dropzone3')) animateRows3 ([...list.querySelectorAll ('[data-record-order3]')],
      () => lane.querySelector ('.record-order-list3').insertBefore (drag.row, lane.querySelector ('.order-dropzone3')))
    }
    if (e.clientY > innerHeight - 65) window.scrollBy (0, 18);
    else if (e.clientY < 65) window.scrollBy (0, - 18);
    e.preventDefault ()
  };
  $$ ('[data-record-handle3]').forEach (h => h.onpointerdown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; const row = h.closest ('.record-order3'), r = row.getBoundingClientRect (); drag = {
      row, pointerId : e.pointerId, x : e.clientX, y : e.clientY, dx : e.clientX - r.left, dy : e.clientY - r.top, ghost : null
    }; document.addEventListener ('pointermove', move, true); document.addEventListener ('pointerup', stop, true); document.addEventListener ('pointercancel',
    stop, true); e.preventDefault ()
  })
}

export { moveRecord, dropRecord, bindDrag, scopeOrder3, organizeMode3, organizationPage3, animateRows3, settleRecords3, bindOrganize3 };

// All controls for this feature, in their original override order.
function bindOrganizationControls () {
  $$ ('[data-mode]').forEach (b => b.onclick = () => {
    ctx.boardMode [b.dataset.kind] = b.dataset.mode; render ();
  });
  $$ ('[data-assign]').forEach (el => el.onchange = async () => {
    const [k, id] = el.dataset.assign.split (':'); ctx.state [k].find (x => x.id === id) [el.dataset.property] = el.value; await save (); render ();
  });
  $$ ('[data-move]').forEach (b => b.onclick = () => moveRecord (...b.dataset.move.split (':'), Number (b.dataset.dir)));
  const board = $ ('[data-board]');
  if (board) bindDrag (board.dataset.board);
  $$ ('[data-organize-mode3]').forEach (b => b.onclick = () => {
    const [k, mode] = b.dataset.organizeMode3.split (':'); ctx.state.organizeModes ||= {
    }; ctx.state.organizeModes [k] = mode; if (mode === 'scope') ctx.state [k].sort ((a, b) => scopeOrder3 (a.scope) - scopeOrder3 (b.scope)); if (mode === 'category') {
      const cats = [...new Set (ctx.state [k].map (x => x.category))]; ctx.state [k].sort ((a, b) => cats.indexOf (a.category) - cats.indexOf (b.category))
    }
    changed ()
  });
  bindOrganize3 ();
}
export { bindOrganizationControls };
