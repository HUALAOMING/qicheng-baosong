import {storage} from './storage.js';
import {ctx} from './state.js';
import {saveAllLocal} from './backup.js';
let deviceSettings53={mode:'auto',startRoute:'home',practiceSize:10,homeCards:true};
let effectiveMode53='full',modeListener53=null;
function canEditWorkspace53(width=globalThis.innerWidth||1200,landscape=globalThis.matchMedia?.('(orientation: landscape)')?.matches??width>=900){return width>=900||(landscape&&width>=820);}
function computeMode53(){return deviceSettings53.mode==='auto'?(canEditWorkspace53()?'full':'lite'):deviceSettings53.mode;}
function isLite53(){return effectiveMode53==='lite';}
function applyDeviceMode53(){effectiveMode53=computeMode53();if(globalThis.document?.body){document.body.dataset.runMode=effectiveMode53;document.body.classList.toggle('compact-work53',effectiveMode53==='lite');}return effectiveMode53;}
async function initializeRuntime53(onChange){
 const stored=await storage.get('meta:device-preferences53');
 if(stored&&typeof stored==='object'){if(['auto','full','lite'].includes(stored.mode))deviceSettings53.mode=stored.mode;if(['home','quiz','resumes','reading','learning-review'].includes(stored.startRoute))deviceSettings53.startRoute=stored.startRoute;if(Number.isInteger(stored.practiceSize)&&stored.practiceSize>=1&&stored.practiceSize<=200)deviceSettings53.practiceSize=stored.practiceSize;if(typeof stored.homeCards==='boolean')deviceSettings53.homeCards=stored.homeCards;}
 applyDeviceMode53();
 if(!modeListener53&&globalThis.matchMedia){modeListener53=()=>{if(document.activeElement?.matches?.('input,textarea,[contenteditable=true]')&&!globalThis.screen?.orientation?.type)return;const before=effectiveMode53;applyDeviceMode53();if(before!==effectiveMode53)onChange?.();};matchMedia('(orientation: landscape)').addEventListener?.('change',modeListener53);}
 return {...deviceSettings53};
}
async function saveDeviceSettings53(patch){
 const next={...deviceSettings53,...patch};
 if(!['auto','full','lite'].includes(next.mode)||!['home','quiz','resumes','reading','learning-review'].includes(next.startRoute)||!Number.isInteger(next.practiceSize)||next.practiceSize<1||next.practiceSize>200||typeof next.homeCards!=='boolean')throw new Error('设备偏好无效。');
 if(ctx.initialized)await saveAllLocal();
 await storage.set('meta:device-preferences53',next);Object.assign(deviceSettings53,next);applyDeviceMode53();return {...next};
}
function workspaceHint53(){return '<section class="panel mode-hint53"><h2>当前空间适合审阅</h2><p>完整编辑建议使用更宽窗口或将平板旋转至横屏。当前可继续只读审阅和日常学习。</p><div class="actions"><button data-go3="resumes">返回简历管理</button><button data-mode-lite53>进入精简版</button></div></section>';}
export {deviceSettings53,isLite53,canEditWorkspace53,initializeRuntime53,saveDeviceSettings53,applyDeviceMode53,workspaceHint53};
