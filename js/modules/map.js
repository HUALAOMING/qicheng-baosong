import { filteredSchools3 } from './universities.js';
import { ctx } from '../state.js';
import { CHINA_VECTOR31, SCHOOL_DETAILS3 } from '../data.js';
import { $, $$, download, esc, icon3, tr } from '../utils/helpers.js';
import { go3 } from '../app.js';
// 启程 · js/modules/map.js

function provinceSchools31 (region) {
  return filteredSchools3 ().filter (s => s.region === region)
}

function vectorMapSvg31 () {
  const callouts = {
    '北京' : {
      x : 751, y : 242
    }, '天津' : {
      x : 783, y : 282
    }, '上海' : {
      x : 818, y : 405
    }, '香港' : {
      x : 757, y : 576
    }, '澳门' : {
      x : 690, y : 632
    }
  };
  const paths = CHINA_VECTOR31.provinces.map (p => '<path class="province31 ' + (provinceSchools31 (p.region).length ?
  'has-schools31' : '') + ' ' + (ctx.activeProvince31 === p.region ? 'is-selected31' : '') + '" d="' + p.d + '" data-province31="' +
  esc (p.region) + '" tabindex="0" role="button" aria-label="' + esc (p.name) + '" fill-rule="evenodd"><title>' + esc (p.name) +
  '</title></path>').join ('');
  const labels = CHINA_VECTOR31.provinces.map (p => {
    const c = callouts [p.region], count = provinceSchools31 (p.region).length, txt = p.region + (count ? ' · ' + count : ''),
    [x, y] = p.xy; if (c) return '<path class="map-callout31" d="M' + x + ',' + y + 'L' + c.x + ',' + (c.y + 9) + '"/><g class="map-chip31" data-province31="' +
    esc (p.region) + '" role="button" tabindex="0" aria-label="' + esc (p.name) + '"><rect x="' + c.x + '" y="' + c.y +
    '" width="' + (txt.length * 11 + 14) + '" height="22" rx="6"/><text x="' + (c.x + 7) + '" y="' + (c.y + 15) + '">' +
    esc (txt) + '</text></g>'; return '<text class="province-label31" text-anchor="middle" x="' + x + '" y="' + y + '">' +
    esc (txt) + '</text>'
  }).join ('');
  const inset = CHINA_VECTOR31.provinces.filter (p => p.inset).map (p => '<path class="province31 inset-province31" d="' +
  p.inset + '" fill-rule="evenodd" data-province31="' + esc (p.region) + '" aria-label="' + esc (p.name) + '"><title>' +
  esc (p.name) + '</title></path>').join ('');
  return '<svg class="vector-map31" id="chinaMap31" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" aria-label="' +
  tr ('中国省级院校互动地图', 'Interactive provincial university map') + '"><defs><clipPath id="mainClip31"><rect width="1000" height="668"/></clipPath><clipPath id="insetClip31"><rect x="840" y="457" width="145" height="205" rx="7"/></clipPath></defs><g clip-path="url(#mainClip31)">' +
  paths + '<path class="sea-line31" d="' + CHINA_VECTOR31.sea + '"/></g>' + labels + '<rect class="map-inset-box31" x="835" y="445" width="155" height="232" rx="9"/><g clip-path="url(#insetClip31)">' +
  inset + '<path class="sea-line31" d="' + CHINA_VECTOR31.seaInset + '"/></g><text class="map-inset-title31" text-anchor="middle" x="912" y="667">' +
  tr ('南海诸岛', 'South China Sea islands') + '</text></svg>'
}

function vectorMapPanel31 () {
  return '<section class="panel vector-map-panel31"><div class="map-heading31"><div><div class="eyebrow">FROM HERE TO EVERYWHERE</div><h2>' +
  tr ('从这里，走向更远的世界。', 'From here, to a wider world.') + '</h2><p>' + tr ('点击省份，发现你的下一站。', 'Choose a province to discover your next destination.') +
  '</p></div><button data-map-download31>' + icon3 ('export') + tr ('保存矢量院校图', 'Save vector map') + '</button></div><div class="vector-map-stage31" id="mapStage31">' +
  vectorMapSvg31 () + '<aside id="provincePopup31" class="province-popover31" role="dialog" aria-label="' + tr ('省份院校列表',
  'Universities in this province') + '" hidden></aside></div><div class="map-legend31"><span><i></i>' + tr ('深色省份有匹配院校；数字为当前筛选数量',
  'Deeper colors show matching universities; numbers follow the filters') + '</span><a href="' + CHINA_VECTOR31.source +
  '" target="_blank" rel="noopener noreferrer">' + tr ('省级边界数据', 'Province boundary data') + ' ↗</a></div></section>'
}

function closeProvince31 () {
  ctx.activeProvince31 = '';
  const p = $ ('#provincePopup31');
  if (p) p.hidden = true;
  $$ ('.province31').forEach (el => el.classList.remove ('is-selected31'))
}

function openProvince31 (region, event) {
  const popup = $ ('#provincePopup31'), stage = $ ('#mapStage31');
  if (! popup || ! stage) return;
  ctx.activeProvince31 = region;
  $$ ('.province31').forEach (el => el.classList.toggle ('is-selected31', el.dataset.province31 === region));
  const list = provinceSchools31 (region), full = SCHOOL_DETAILS3.filter (s => s.region === region);
  popup.innerHTML = '<header><h3>' + esc (region) + '</h3><button data-close-province31 aria-label="' + tr ('关闭', 'Close') +
  '">×</button></header><p>' + list.length + ' ' + tr ('所院校 · 当前筛选', 'universities · current filters') + '</p>' + (list.length ?
  '<div class="province-schools31">' + list.map (s => '<button data-go3="school:' + encodeURIComponent (s.name) + '">' +
  esc (s.name) + '<span>' + esc (s.abbreviation) + ' ↗</span></button>').join ('') + '</div>' : '<div class="province-empty31">' +
  tr (full.length ? '当前筛选隐藏了本省已收录院校，可清除筛选后查看。' : '当前 49 所院校名单中尚未收录本省院校。', full.length ? 'The current filters hide universities recorded in this province. Clear the filters to see them.' : 'This province has no universities in the current 49-school directory.') +
  '</div>');
  popup.hidden = false;
  const box = stage.getBoundingClientRect (), x = event?.clientX ? event.clientX - box.left : box.width * .52, y = event?.clientY ?
  event.clientY - box.top : box.height * .2;
  popup.style.left = Math.max (12, Math.min (x + 12, box.width - popup.offsetWidth - 12)) + 'px';
  popup.style.top = Math.max (12, Math.min (y + 12, box.height - popup.offsetHeight - 12)) + 'px';
  popup.querySelector ('[data-close-province31]').onclick = closeProvince31;
  popup.querySelectorAll ('[data-go3]').forEach (b => b.onclick = () => {
    closeProvince31 (); go3 (b.dataset.go3)
  });
  if (event?.type === 'keydown') popup.querySelector ('button')?.focus ();
}

function bindMap31 () {
  $$ ('[data-province31]').forEach (p => {
    p.onclick = e => {
      e.stopPropagation (); openProvince31 (p.dataset.province31, e)
    }; p.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault (); openProvince31 (p.dataset.province31, e)
      }
    }
  });
  const svg = $ ('#chinaMap31');
  if (svg) svg.onclick = e => {
    if (e.target === svg) closeProvince31 ()
  };
  $$ ('[data-map-download31]').forEach (b => b.onclick = downloadMap31);
}

function updateMap31 () {
  if (! $ ('#mapStage31')) return;
  $ ('#chinaMap31').outerHTML = vectorMapSvg31 ();
  bindMap31 ();
  if (ctx.activeProvince31) openProvince31 (ctx.activeProvince31)
}

function downloadMap31 () {
  const svg = document.createElement ('div');
  svg.innerHTML = vectorMapSvg31 ();
  const node = svg.firstElementChild, styles = getComputedStyle (document.body), style = document.createElementNS ('http://www.w3.org/2000/svg',
  'style');
  style.textContent = '.province31{fill:' + styles.getPropertyValue ('--map-base') + ';stroke:' + styles.getPropertyValue ('--map-stroke') +
  ';stroke-width:.8}.has-schools31{fill:' + styles.getPropertyValue ('--map-active') + '}.sea-line31{fill:' + styles.getPropertyValue ('--map-base') +
  ';stroke:' + styles.getPropertyValue ('--map-stroke') + ';stroke-width:.7}.province-label31{font:600 11px sans-serif;fill:' +
  styles.getPropertyValue ('--map-label') + '}.map-callout31{stroke:' + styles.getPropertyValue ('--map-stroke') + ';fill:none}.map-chip31 rect,.map-inset-box31{fill:' +
  styles.getPropertyValue ('--map-water') + ';stroke:' + styles.getPropertyValue ('--map-stroke') + '}.map-chip31 text,.map-inset-title31{font:12px sans-serif;fill:' +
  styles.getPropertyValue ('--map-label') + '}';
  node.insertBefore (style, node.firstChild);
  node.setAttribute ('style', 'background:' + styles.getPropertyValue ('--map-water'));
  node.querySelectorAll ('[tabindex],[role]').forEach (el => {
    el.removeAttribute ('tabindex'); el.removeAttribute ('role')
  });
  download (new XMLSerializer ().serializeToString (node), 'image/svg+xml;charset=utf-8', '启程-目标院校图.svg')
}

export { provinceSchools31, vectorMapSvg31, vectorMapPanel31, closeProvince31, openProvince31, bindMap31, updateMap31, downloadMap31 };
