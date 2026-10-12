// Shared in-memory workspace. Persisted data is always read/written through storage.js.
const ctx = {
  state : null, initialized : false, busy : false, uploadBusy : false, persistencePaused : false, timer : null, saveChain : Promise.resolve (),
  saveError : false, saving : false, dirty301 : false, editRevision301 : 0, savedFingerprint301 : null, studioTab : 'content',
  previewDebounce : null, previewToken : 0, layoutCache : null, previewObjectURL : null, activeDownload : null, schoolQuery : '',
  onlyDreams : false, schoolRegion3 : '', schoolView3 : 'map', assetSearch3 : '', assetPickerTarget3 : '', archiveDownload3 : false,
  exportPending3 : null, activeProvince31 : '', editing : {
    awards : null, experiences : null, exams : null, books : null, practices : null, achievements : null
  }, boardMode : {
    awards : 'priority', experiences : 'category'
  }, sortModes3 : {
    awards : 'scope', experiences : 'custom', practices : 'custom'
  }, metricsCache : null, fontFacePromise : null, originalText : new WeakMap (), originalAttrs : new WeakMap ()
};
export { ctx };
