const featureModules53=new Map();
const readyFeatures53=new Map();
async function loadFeature53(name){
  if(globalThis.QICHENG_PORTABLE_FEATURES53?.[name]){const module=globalThis.QICHENG_PORTABLE_FEATURES53[name];readyFeatures53.set(name,module);return module;}
  if(!featureModules53.has(name))featureModules53.set(name,(async()=>{
    if(name==='resume')return import('./resume53.js');
    if(name==='export')return import('./export53.js');
    if(name==='learning')return import('./learning53.js');
    if(name==='search')return import('./search53.js');
    throw new Error('未知功能模块。');
  })().catch(error=>{featureModules53.delete(name);throw error;}));
  const module=await featureModules53.get(name);readyFeatures53.set(name,module);return module;
}
async function flushLoadedFeatures53(){for(const module of readyFeatures53.values())if(module.flushLearning53)await module.flushLearning53();}
function hasPendingFeatures53(){return [...readyFeatures53.values()].some(module=>module.hasPendingLearning53?.());}
function loadedFeature53(name){return readyFeatures53.get(name)||globalThis.QICHENG_PORTABLE_FEATURES53?.[name];}
function pendingFeatureRecords53(){return Object.assign({},...[...readyFeatures53.values()].map(module=>module.getPendingLearningRecords53?.()||{}));}
function resetLoadedFeatures53(){for(const module of readyFeatures53.values())module.resetLearning53?.();}
export {pendingFeatureRecords53,resetLoadedFeatures53,loadFeature53,flushLoadedFeatures53,hasPendingFeatures53,loadedFeature53};
