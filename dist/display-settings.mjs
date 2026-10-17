export const DISPLAY_DEFAULTS=Object.freeze({station:70,train:55,line:55});
export function normalizeDisplaySettings(value){
  return Object.fromEntries(Object.entries(DISPLAY_DEFAULTS).map(([key,fallback])=>[key,typeof value?.[key]==='number'&&Number.isFinite(value[key])?Math.max(25,Math.min(200,Math.round(value[key]/5)*5)):fallback]));
}
export function mountDisplaySettings(host){
  let saved;try{saved=JSON.parse(localStorage.getItem('harbor-transit-display-v1'));}catch{}
  let values=Object.freeze(normalizeDisplaySettings(saved)),locked=false;
  host.classList.add('display-settings');
  host.innerHTML='<fieldset><legend>開始前外觀設定</legend><div class="display-sliders">'+[['station','車站大小'],['train','列車大小'],['line','路線粗細']].map(([key,label])=>`<label for="display-${key}">${label}<output id="display-${key}-value" for="display-${key}"></output><input id="display-${key}" data-size="${key}" type="range" min="25" max="200" step="5"></label>`).join('')+'</div><svg viewBox="0 0 240 30" role="img" aria-label="車站、列車與路線大小即時預覽"><path d="M15 21H95L111 9H225" fill="none" stroke="#0070bd" stroke-linecap="round"/><circle cx="15" cy="21" fill="white" stroke="#304b5d"/><circle cx="225" cy="9" fill="white" stroke="#304b5d"/><rect x="118" y="0" fill="#0070bd" stroke="white"/></svg><small>即時預覽 · 設定會記住，開始後鎖定</small></fieldset>';
  const fieldset=host.querySelector('fieldset');
  function render(){
    for(const [key,value] of Object.entries(values)){host.querySelector(`[data-size=${key}]`).value=value;host.querySelector(`#display-${key}-value`).textContent=`${value}%`;}
    host.querySelector('path').setAttribute('stroke-width',5*values.line/100);
    for(const circle of host.querySelectorAll('circle')){circle.setAttribute('r',6*values.station/100);circle.setAttribute('stroke-width',1.6*values.station/100);}
    const train=host.querySelector('rect'),size=values.train/100;train.setAttribute('width',24*size);train.setAttribute('height',12*size);train.setAttribute('y',9-6*size);train.setAttribute('rx',3*size);train.setAttribute('stroke-width',size);
  }
  host.addEventListener('input',event=>{
    const key=event.target.dataset.size;if(!Object.hasOwn(DISPLAY_DEFAULTS,key))return;
    if(!locked){values=Object.freeze(normalizeDisplaySettings({...values,[key]:event.target.valueAsNumber}));try{localStorage.setItem('harbor-transit-display-v1',JSON.stringify(values));}catch{}}
    render();
  });
  render();
  return {get values(){return values;},lock(){locked=true;fieldset.disabled=true;},unlock(){locked=false;fieldset.disabled=false;render();}};
}
