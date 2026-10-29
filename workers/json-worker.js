self.onmessage=event=>{
  try{self.postMessage({value:JSON.parse(event.data.text.replace(/^\uFEFF/,''))});}
  catch(error){self.postMessage({error:'JSON 无法解析：'+error.message});}
};
