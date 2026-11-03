const bound532=(value,min,max)=>Math.min(max,Math.max(min,value));
function rotatedSize532(width,height,degrees=0){const angle=degrees*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));return {width:Math.max(1,Math.round(width*c+height*s)),height:Math.max(1,Math.round(width*s+height*c))};}
function fitCropRect532(width,height,aspect=0){let w=width,h=height;if(aspect){if(w/h>aspect)w=h*aspect;else h=w/aspect;}return {x:(width-w)/2,y:(height-h)/2,w,h};}
function cropRect532(crop,width,height,aspect=0){
 if(crop.rect)return {x:crop.rect.x*width,y:crop.rect.y*height,w:crop.rect.w*width,h:crop.rect.h*height};
 const fitted=fitCropRect532(width,height,aspect),zoom=crop.zoom||1,w=fitted.w/zoom,h=fitted.h/zoom;
 return {x:(width-w)*(crop.x??50)/100,y:(height-h)*(crop.y??50)/100,w,h};
}
function moveCropRect532(rect,dx,dy,width,height){return {...rect,x:bound532(rect.x+dx,0,width-rect.w),y:bound532(rect.y+dy,0,height-rect.h)};}
function resizeCropRect532(rect,handle,dx,dy,width,height,aspect=0){
 const left=handle.includes('w'),right=handle.includes('e'),top=handle.includes('n'),bottom=handle.includes('s'),min=Math.min(12,width/20,height/20);
 let w=rect.w+(right?dx:left?-dx:0),h=rect.h+(bottom?dy:top?-dy:0);
 if(aspect){
  if((left||right)&&!(top||bottom))h=w/aspect;
  else if((top||bottom)&&!(left||right))w=h*aspect;
  else if(Math.abs(dx)>=Math.abs(dy)*aspect)h=w/aspect;else w=h*aspect;
  const maxW=left?rect.x+rect.w:right?width-rect.x:2*Math.min(rect.x+rect.w/2,width-rect.x-rect.w/2);
  const maxH=top?rect.y+rect.h:bottom?height-rect.y:2*Math.min(rect.y+rect.h/2,height-rect.y-rect.h/2);
  w=bound532(w,Math.min(min*Math.max(1,aspect),maxW,maxH*aspect),Math.min(maxW,maxH*aspect));h=w/aspect;
 }else{w=bound532(w,min,left?rect.x+rect.w:width-rect.x);h=bound532(h,min,top?rect.y+rect.h:height-rect.y);}
 const x=left?rect.x+rect.w-w:right?rect.x:rect.x+(rect.w-w)/2,y=top?rect.y+rect.h-h:bottom?rect.y:rect.y+(rect.h-h)/2;
 return {x:bound532(x,0,width-w),y:bound532(y,0,height-h),w,h};
}
function normalizedCropRect532(rect,width,height){return {x:rect.x/width,y:rect.y/height,w:rect.w/width,h:rect.h/height};}
export {rotatedSize532,fitCropRect532,cropRect532,moveCropRect532,resizeCropRect532,normalizedCropRect532};
