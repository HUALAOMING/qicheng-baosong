// Static application resources; these never enter a user backup.
const APP_BASE = new URL ('./', document.baseURI);
let SCHOOL_DETAILS3 = [], SCHOOLS = [], CHINA_VECTOR31 = {
}, SCHOOL_EXAMS302 = {
}, SCHOOL_DATES31 = {
}, EN = {
};
let FONT_LATIN = '', FONT_CJK = '';
const BUILTIN_PATHS = ['data/universities.json', 'data/schools.json', 'data/china-map.json', 'data/university-exams.json',
'data/university-dates.json', 'data/translations.json'];
async function resourceFetch (path) {
  const controller = new AbortController ();
  const timeout = setTimeout (() => controller.abort (), 20000);
  try {
    const response = await fetch (new URL (path, APP_BASE), {
      signal : controller.signal
    });
    if (! response.ok) throw new Error ('无法读取资源：' + path);
    return response;
  }
  finally {
    clearTimeout (timeout);
  }
}
function bytesToDataURL (buffer, mime) {
  const bytes = new Uint8Array (buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode (...bytes.subarray (i, i + 32768));
  return 'data:' + mime + ';base64,' + btoa (binary);
}
async function loadBuiltinData () {
  const bundled = globalThis.QICHENG_STATIC;
  if (bundled) {
    [SCHOOL_DETAILS3, SCHOOLS, CHINA_VECTOR31, SCHOOL_EXAMS302, SCHOOL_DATES31, EN] = bundled.data;
    FONT_LATIN = bundled.fonts [0];
    FONT_CJK = bundled.fonts [1];
    return;
  }
  const data = await Promise.all (BUILTIN_PATHS.map (async path => (await resourceFetch (path)).json ()));
  [SCHOOL_DETAILS3, SCHOOLS, CHINA_VECTOR31, SCHOOL_EXAMS302, SCHOOL_DATES31, EN] = data;
  const fonts = await Promise.all (['latin', 'cjk'].map (async name => bytesToDataURL (await (await resourceFetch ('assets/fonts/' +
  name + '.ttf')).arrayBuffer (), 'font/ttf')));
  [FONT_LATIN, FONT_CJK] = fonts;
}
export { APP_BASE, SCHOOL_DETAILS3, SCHOOLS, CHINA_VECTOR31, SCHOOL_EXAMS302, SCHOOL_DATES31, EN, FONT_LATIN, FONT_CJK, loadBuiltinData, resourceFetch, bytesToDataURL };
