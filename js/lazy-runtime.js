import { APP_BASE } from './data.js';
const vendorLoads521=new Map();
const vendorNames521={'docx':'docx','pdf-lib':'PDFLib','jszip':'JSZip','fontkit':'fontkit','pptxgen':'PptxGenJS'};
async function ensureVendors(names=Object.keys(vendorNames521)) {
  for(const name of names) {
    if(globalThis[vendorNames521[name]])continue;
    if(!vendorLoads521.has(name))vendorLoads521.set(name,new Promise((resolve,reject)=>{
      const script=document.createElement('script'),embedded=document.getElementById('qichengVendor521-'+name);
      if(embedded){
        try{script.textContent=embedded.textContent;document.head.append(script);if(!globalThis[vendorNames521[name]])throw new Error('内嵌导出组件未正确初始化：'+name);resolve();}
        catch(error){script.remove();reject(error);}return;
      }
      script.src=new URL('assets/vendor/'+name+'.js',APP_BASE).href;
      const finish=()=>{
        clearTimeout(timer);
        script.onload=script.onerror=null;
        if(globalThis[vendorNames521[name]])resolve();
        else {script.remove();reject(new Error('导出组件加载失败，请重试：'+name));}
      };
      const timer=setTimeout(finish,45000);
      script.onload=script.onerror=finish;
      document.head.append(script);
    }).catch(error=>{vendorLoads521.delete(name);throw error;}));
    await vendorLoads521.get(name);
  }
}
export {ensureVendors};
