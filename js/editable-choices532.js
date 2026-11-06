// Native datalist pickers interrupt editing on iPadOS. Suggestions are explicit actions.
let choiceSequence532=0, openChoice532=null, choiceObserver532=null, choiceDocument532=null;
function closeEditableChoice532(){if(openChoice532){openChoice532.list.hidden=true;openChoice532.button.setAttribute('aria-expanded','false');openChoice532.input.setAttribute('aria-expanded','false');openChoice532=null;}}
function bindEditableChoices532(root=document){
 for(const input of root.querySelectorAll('input[list]')){
  const source=document.getElementById(input.getAttribute('list'));if(!source)continue;
  const values=[...new Set([...source.querySelectorAll('option')].map(option=>option.value||option.textContent).filter(Boolean))];
  input.removeAttribute('list');input.autocomplete='off';if(!values.length)continue;
  const box=document.createElement('span'),button=document.createElement('button'),list=document.createElement('span');
  box.className='editable-choice532';list.className='editable-choice-menu532';list.id='editableChoices532-'+(++choiceSequence532);list.hidden=true;list.setAttribute('role','listbox');
  const english=document.documentElement.lang==='en';button.type='button';button.className='editable-choice-toggle532';button.textContent=english?'Choose':'选择';button.setAttribute('aria-label',english?'Show suggestions; typing remains free':'展开可选项，也可自由输入');button.setAttribute('aria-controls',list.id);button.setAttribute('aria-expanded','false');
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','none');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
  input.parentNode.insertBefore(box,input);box.append(input,button,list);
  const open=()=>{closeEditableChoice532();for(const item of list.children)item.setAttribute('aria-selected',String(item.textContent===input.value));list.hidden=false;button.setAttribute('aria-expanded','true');input.setAttribute('aria-expanded','true');openChoice532={box,list,button,input};};
  for(const value of values){const item=document.createElement('button');item.type='button';item.textContent=value;item.setAttribute('role','option');item.setAttribute('aria-selected',String(value===input.value));item.onpointerdown=e=>e.preventDefault();item.onclick=e=>{e.preventDefault();input.value=value;closeEditableChoice532();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));if(input.isConnected)input.focus({preventScroll:true});};list.append(item);}
  button.onclick=e=>{e.preventDefault();if(list.hidden)open();else closeEditableChoice532();};
  input.addEventListener('input',closeEditableChoice532);input.addEventListener('compositionstart',closeEditableChoice532);
  box.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Escape'){e.preventDefault();closeEditableChoice532();input.focus({preventScroll:true});}else if(e.key==='ArrowDown'){e.preventDefault();if(list.hidden)open();const items=[...list.children],index=items.indexOf(document.activeElement);items[(index+1)%items.length]?.focus();}else if(e.key==='ArrowUp'&&!list.hidden){e.preventDefault();const items=[...list.children],index=items.indexOf(document.activeElement);items[(index-1+items.length)%items.length]?.focus();}else if(e.key==='Tab')closeEditableChoice532();});
 }
 if(choiceDocument532!==document){choiceDocument532=document;document.addEventListener('pointerdown',e=>{if(openChoice532&&!openChoice532.box.contains(e.target))closeEditableChoice532();},true);}
 if(!choiceObserver532&&typeof MutationObserver!=='undefined'&&document.body){choiceObserver532=new MutationObserver(()=>{if(openChoice532&&!openChoice532.box.isConnected)closeEditableChoice532();bindEditableChoices532();});choiceObserver532.observe(document.body,{childList:true,subtree:true});}
}
export {bindEditableChoices532,closeEditableChoice532};
