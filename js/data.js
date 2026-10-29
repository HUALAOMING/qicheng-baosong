// Static application resources; these never enter a user backup.
const APP_BASE = new URL ('./', document.baseURI);
let SCHOOL_DETAILS3 = [], SCHOOLS = [], CHINA_VECTOR31 = {
}, SCHOOL_EXAMS302 = {
}, SCHOOL_DATES31 = {
}, EN = {
};
let FONT_LATIN = '', FONT_CJK = '';
let RESOURCE_EXAMPLES = {samples:{},aiGuide:''};
let CLASSICS = {schemaVersion:1,version:'1.0.0',books:[]};
const BUILTIN_PATHS = ['data/universities.json', 'data/schools.json', 'data/china-map.json', 'data/university-exams.json',
'data/university-dates.json', 'data/translations.json', 'data/classics.json', 'data/resource-examples.json'];
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
let builtinLoading521 = new Map(), fontLoading521 = null;
async function loadBuiltinData () {
  const bundled = globalThis.QICHENG_STATIC;
  if (bundled) {
    [SCHOOL_DETAILS3, SCHOOLS, CHINA_VECTOR31, SCHOOL_EXAMS302, SCHOOL_DATES31, EN, CLASSICS = {schemaVersion:1,version:'1.0.0',books:[]}, RESOURCE_EXAMPLES = {samples:{},aiGuide:''}] = bundled.data;
    FONT_LATIN = bundled.fonts [0];
    FONT_CJK = bundled.fonts [1];
    return;
  }
  // Home needs university summaries and translations; vector map, books and fonts load on demand.
  const [universities, translations, schools] = await Promise.all(['data/universities.json','data/translations.json','data/schools.json'].map(async path => (await resourceFetch(path)).json()));
  SCHOOL_DETAILS3=universities; EN=translations; SCHOOLS=schools;

}
async function loadRouteData(route) {
  if(globalThis.QICHENG_STATIC)return;
  const group = route==='schools'||route.startsWith('school:')?'schools':route==='reading'||route==='explore'||route==='settings'||route.startsWith('classic:')?'reading':route==='exam-calendar'?'exams':'';
  if(!group)return;
  if(!builtinLoading521.has(group))builtinLoading521.set(group,(async()=>{
    if(group==='schools') [SCHOOLS,CHINA_VECTOR31,SCHOOL_EXAMS302,SCHOOL_DATES31]=await Promise.all(['data/schools.json','data/china-map.json','data/university-exams.json','data/university-dates.json'].map(async path=>(await resourceFetch(path)).json()));
    if(group==='reading') [CLASSICS,RESOURCE_EXAMPLES]=await Promise.all(['data/classics.json','data/resource-examples.json'].map(async path=>(await resourceFetch(path)).json()));
    if(group==='exams') [SCHOOL_EXAMS302,SCHOOL_DATES31,SCHOOLS]=await Promise.all(['data/university-exams.json','data/university-dates.json','data/schools.json'].map(async path=>(await resourceFetch(path)).json()));
  })().catch(error=>{builtinLoading521.delete(group);throw error;}));
  return builtinLoading521.get(group);
}
async function loadDocumentFonts() {
  if(FONT_LATIN&&FONT_CJK)return;
  if(!fontLoading521)fontLoading521=Promise.all(['latin','cjk'].map(async name=>bytesToDataURL(await(await resourceFetch('assets/fonts/'+name+'.ttf')).arrayBuffer(),'font/ttf'))).then(fonts=>{[FONT_LATIN,FONT_CJK]=fonts;}).catch(error=>{fontLoading521=null;throw error;});
  return fontLoading521;
}
export { loadRouteData, loadDocumentFonts, APP_BASE, SCHOOL_DETAILS3, SCHOOLS, CHINA_VECTOR31, SCHOOL_EXAMS302, SCHOOL_DATES31, EN, FONT_LATIN, FONT_CJK, CLASSICS, RESOURCE_EXAMPLES, loadBuiltinData, resourceFetch, bytesToDataURL };
