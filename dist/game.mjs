import { W,H,RIVER,createState,setRoute,addTrain,addCarriage,chooseUpgrade,advance,trainPosition,routePoints,tunnelsUsed,missionProgress,buildStation,undoStation,launchPlanning,planningProgress,generatedStationCount } from './core.mjs';
import {CITIES,getCity} from './cities.mjs';
import {ARTIFICIAL_LINES} from './artificial-city.mjs';
import {futurePreference,saveFuturePreference} from './future-settings.mjs';
import {autoManage,advanceAutomatic} from './autopilot.mjs';
import {configureAutoNetwork} from './auto-network.mjs';
import {paintTerrain} from './terrain.mjs';
import {mountDisplaySettings} from './display-settings.mjs';
import {loadHistoryCity} from './history-cities.mjs';
import {paintRailLines} from './rail-map.mjs';
import {mountPinchZoom} from './touch-map.mjs';

const $=id=>document.getElementById(id);
const canvas=$('map'),ctx=canvas.getContext('2d');
const names=['舊城','中央公園','港口','美術館','北門','大學城','市政廳','南岸','新市場','水岸','東門','圖書館','工藝街','西城','植物園','高鐵站','廣場','工業區','劇院','山麓','新都心','文化園'];
const symbols={circle:'○',triangle:'△',square:'□',diamond:'◇',star:'☆'};
const legacy=new URLSearchParams(location.search).has('legacy'),reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
let selectedCity=legacy?null:'hongkong',state=createState(Date.now(),{cityId:selectedCity}),selected=0,paused=false,started=false,speed=1,draft=null,redrawing=false,pointer=null,hover=null,toastUntil=0,last=performance.now(),uiElapsed=0,prevUpgrade=false,prevOver=false,prevWon=false,lastStationCount=0,backlog=0,completed=[];
let transform={scale:1,x:0,y:0},best=0,viewZoom=matchMedia('(max-width:720px)').matches?1.65:1,panX=0,panY=0,panning=null;
let terrainCache=null,buildingTool=false,previousPlanningPhase=null,autoLoading=false,insertion=null,pendingBuild=null;
const referenceModels=new Map(),referenceLoads=new Map();
let futureEnabled=futurePreference();
const futureFor=id=>!!id&&futureEnabled&&!getCity(id)?.fictional,referenceKey=id=>id+(futureFor(id)?':future':''),referenceFor=id=>referenceModels.get(referenceKey(id));
function loadReference(id){
  if(!id)return;
  const key=referenceKey(id),includeFuture=futureFor(id);
  if(!referenceLoads.has(key)){
    const pending=id==='international'?Promise.resolve(referenceModels.set(key,{stations:getCity(id).stations,lines:ARTIFICIAL_LINES,legs:[],services:[]})):loadHistoryCity(id,includeFuture).then(model=>{const date=model.future?.horizon||model.metadata.verifiedOn;referenceModels.set(key,{...model.snapshotAt(date),services:model.servicesAt(date),city:includeFuture?model.city:null,future:model.future});});
    referenceLoads.set(key,pending.then(()=>{if(state.city?.id===id&&key===referenceKey(id)){if(!started&&referenceModels.get(key).city)state=createState(Date.now(),{cityId:id,city:referenceModels.get(key).city});terrainCache=null;updatePicker();updateUI();}return referenceModels.get(key);}).catch(()=>{referenceLoads.delete(key);if(state.city?.id===id&&started)toast('實際路網參考暫時無法載入；可回城市選單重試。');return null;}));
  }
  return referenceLoads.get(key);
}
const display=mountDisplaySettings($('display-settings'));
try{best=Number(localStorage.getItem('harbor-transit-best'))||0;}catch{}
try{completed=JSON.parse(localStorage.getItem('harbor-transit-cities'))||[];if(!Array.isArray(completed))completed=[];}catch{}
const label=s=>s.name||names[s.id]||`第 ${s.id+1} 站`;
const line=()=>state.lines[selected];
const stationScale=(scale=1)=>state.city ? .5/Math.max(1,scale) : 1;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+3200;}
function blocked(){return !started||state.upgrade||state.gameOver||state.won||$('help-dialog').open;}
function cancelDraft(){draft=null;insertion=null;redrawing=false;pointer=null;pendingBuild=null;$('draw-hint').hidden=true;}
function selectLine(id){if(id>=state.unlocked)return;selected=id;buildingTool=false;cancelDraft();updateUI();}
function applyRoute(stops){const r=setRoute(state,selected,stops);toast(r.message||(r.ok?'路線已更新':'無法套用路線'));cancelDraft();updateUI();return r.ok;}
function startInsertion(index){draft=[...line().stops];insertion={start:index,at:index};}
function showDrawHint(){
  $('draw-hint').hidden=false;
  $('draw-text').textContent=`${(state.referenceLineCount||state.autoNetwork)?line().name:String.fromCharCode(65+selected)+' 線'} · ${insertion?'從中段插站，保留兩側路線':'繼續連到下一站'}`;
}
function stationPoint(id){
  if(blocked())return;
  const route=line().stops;
  const station=state.stations.find(s=>s.id===id);
  $('station-title').textContent=`${symbols[station.shape]} ${label(station)}`;
  $('station-copy').textContent=`${station.queue.length} 人候車${station.queue.length?`，前往 ${station.queue.slice(0,12).map(p=>symbols[p.shape]).join(' ')}`:'。路線在同一站交會即可轉乘。'}`;
  if(state.planning&&state.planning.phase!=='building')return;
  if(!draft){
    if(redrawing||!route.length)draft=[id];
    else if(route.includes(id)&&route[0]===route.at(-1))startInsertion(route.indexOf(id)+1);
    else if(route.at(-1)===id)draft=[...route];
    else if(route[0]===id)draft=[...route].reverse();
    else if(route.includes(id))startInsertion(route.indexOf(id)+1);
    else return;
  }else if(insertion){
    if(insertion.at>insertion.start&&draft[insertion.at-2]===id){draft.splice(--insertion.at,1);}
    else if(!draft.includes(id)){draft.splice(insertion.at++,0,id);}
  }else if(draft.at(-1)!==id){
    if(draft.at(-2)===id)draft.pop();
    else if(!draft.includes(id)||(id===draft[0]&&draft.length>=3&&draft[0]!==draft.at(-1)))draft.push(id);
  }
  showDrawHint();
}
function finishDraw(){
  pointer=null;
  if(draft?.length>=2){
    if(JSON.stringify(draft)!==JSON.stringify(line().stops))applyRoute(draft);
  }
}
function mapPoint(event){const r=canvas.getBoundingClientRect();return {x:(event.clientX-r.left-transform.x)/transform.scale,y:(event.clientY-r.top-transform.y)/transform.scale};}
function hit(p){let nearest,dist=25*stationScale(transform.scale)/Math.min(1,transform.scale);for(const s of state.stations){const d=Math.hypot(s.x-p.x,s.y-p.y);if(d<dist){dist=d;nearest=s;}}return nearest;}
function hitSegment(p,radius){
  if(redrawing||(state.planning&&state.planning.phase!=='building'))return null;
  let index=null,nearest=radius/transform.scale;const stops=line().stops;
  for(let i=1;i<stops.length;i++){
    const points=routePoints(state,stops.slice(i-1,i+1));
    for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(distance<nearest){nearest=distance;index=i;}}
  }
  return index;
}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||blocked()||pinch.active)return;
  const p=mapPoint(event),station=hit(p);
  if(state.planning?.phase==='building'&&buildingTool){
    if(event.pointerType==='touch'){pendingBuild={id:event.pointerId,p,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);}else placeStation(p);
    return;
  }
  if(!station){
    const index=hitSegment(p,event.pointerType==='touch'?12:7);
    if(index!==null){startInsertion(index);pointer=event.pointerId;canvas.setPointerCapture(event.pointerId);showDrawHint();return;}
    cancelDraft();panning={id:event.pointerId,x:event.clientX,y:event.clientY,panX,panY};canvas.setPointerCapture(event.pointerId);return;
  }
  pointer=event.pointerId;canvas.setPointerCapture(event.pointerId);stationPoint(station.id);
});
canvas.addEventListener('pointermove',event=>{
  if(pendingBuild?.id===event.pointerId){if(Math.hypot(event.clientX-pendingBuild.x,event.clientY-pendingBuild.y)<10)return;panning={id:event.pointerId,x:pendingBuild.x,y:pendingBuild.y,panX,panY};pendingBuild=null;}
  if(panning?.id===event.pointerId){panX=Math.max(-state.world.width*transform.scale/2,Math.min(state.world.width*transform.scale/2,panning.panX+event.clientX-panning.x));panY=Math.max(-state.world.height*transform.scale/2,Math.min(state.world.height*transform.scale/2,panning.panY+event.clientY-panning.y));return;}
  const p=mapPoint(event);hover=hit(p)?.id??null;
  if(pointer!==event.pointerId||!draft)return;
  if(hover!==null)stationPoint(hover);
});
canvas.addEventListener('pointerup',event=>{if(pendingBuild?.id===event.pointerId){const p=pendingBuild.p;pendingBuild=null;placeStation(p);return;}if(panning?.id===event.pointerId){panning=null;return;}if(pointer===event.pointerId)finishDraw();});
canvas.addEventListener('pointercancel',()=>{panning=null;cancelDraft();});
canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
canvas.addEventListener('pointerleave',()=>{hover=null;});
function placeStation(p){const result=buildStation(state,p.x,p.y,$('station-type').value||undefined);toast(result.message);if(result.ok)cancelDraft();updateUI();}
canvas.addEventListener('contextmenu',event=>{if(state.mode!=='planning')return;event.preventDefault();if(!blocked())placeStation(mapPoint(event));});
$('build-tool').onclick=()=>{if(state.planning?.phase!=='building')return;buildingTool=!buildingTool;cancelDraft();updateUI();};
$('undo-station').onclick=()=>{const result=undoStation(state);toast(result.message);cancelDraft();updateUI();};
$('launch-planning').onclick=()=>{const result=launchPlanning(state);toast(result.message);if(result.ok){cancelDraft();buildingTool=false;paused=false;speed=1;last=performance.now();backlog=0;}updateUI();};
function zoom(delta){viewZoom=Math.max(1,Math.min(8,viewZoom+delta));}
$('zoom-in').onclick=()=>zoom(.3);$('zoom-out').onclick=()=>zoom(-.3);$('zoom-fit').onclick=()=>{viewZoom=1;panX=0;panY=0;};
canvas.addEventListener('wheel',event=>{if(blocked())return;event.preventDefault();zoom(event.deltaY<0?.15:-.15);},{passive:false});
const pinch=mountPinchZoom(canvas,{enabled:()=>!blocked(),cancel:()=>{panning=null;cancelDraft();},zoom:(ratio,from,to)=>{
  const old=viewZoom;viewZoom=Math.max(1,Math.min(8,viewZoom*ratio));const factor=viewZoom/old,cx=canvas.clientWidth/2,cy=(canvas.clientHeight+55)/2;
  panX=(panX+cx-from.x)*factor-cx+to.x;panY=(panY+cy-from.y)*factor-cy+to.y;
}});
async function begin(mode='campaign'){
  const id=selectedCity,network=id?await loadReference(id):null;
  if(id!==selectedCity)return;
  if(id&&!network?.lines.length){toast('城市實際路線尚未載入，請稍後重試。');return;}
  state=createState(mode==='planning'?20261017:Date.now(),{cityId:id,city:network?.city||undefined,mode,lines:network?.lines,referenceStations:network?.stations});selected=0;paused=false;started=true;speed=1;backlog=0;last=performance.now();prevWon=prevOver=prevUpgrade=false;lastStationCount=0;panX=panY=0;viewZoom=state.city?1:matchMedia('(max-width:720px)').matches?1.65:1;cancelDraft();buildingTool=false;previousPlanningPhase=null;renderLines();$('line-filter').value='';
  loadReference(selectedCity);updatePicker();
  display.lock();
  for(const id of ['intro','gameover','upgrade','victory'])$(id).hidden=true;$('station-buttons').replaceChildren();
  updateUI();(state.planning?$('build-tool'):$('pause')).focus();toast(state.planning?`5 分鐘規劃開始：右鍵建站，${state.lines.length} 條路線全部可用。`:state.city?`${state.city.name}出發！連接不同形狀的車站。`:'從舊城 ○ 拖到中央公園 △，再連到港口 □。');
}
$('start').onclick=()=>begin('campaign');
$('start-realtime').onclick=()=>{if(!getCity(selectedCity)?.fictional)location.assign(`realtime.html?city=${selectedCity}${new URLSearchParams(location.search).has('test')?'&test=1':''}`);};
$('start-planning').onclick=()=>begin('planning');
$('pause').onclick=()=>{if(!started||state.gameOver||state.upgrade||state.won||state.planning?.phase==='building')return;paused=!paused;cancelDraft();last=performance.now();backlog=0;updateUI();};
$('speed').onclick=()=>{if(state.planning?.phase==='building')return;speed=state.planning?(speed===1?3:speed===3?10:1):(speed===1?2:speed===2?3:1);updateUI();};
$('cancel-draw').onclick=cancelDraft;
$('redraw').onclick=()=>{if(blocked())return;cancelDraft();redrawing=true;$('draw-hint').hidden=false;$('draw-text').textContent='重畫模式 · 從任意一站開始';toast('原路線會保留到新路線套用。');};
$('trim').onclick=()=>{if(!blocked())applyRoute(line().stops.length<=2?[]:line().stops.slice(0,-1));};
$('clear').onclick=()=>{if(!blocked())applyRoute([]);};
$('add-train').onclick=()=>{if(blocked())return;const r=addTrain(state,selected);toast(r.message);updateUI();};
$('add-carriage').onclick=()=>{if(blocked())return;const r=addCarriage(state,selected);toast(r.message);updateUI();};
$('bug-mode').onclick=()=>{if(blocked()||state.planning)return;state.bugMode=!state.bugMode;toast(state.bugMode?'BUG 模式已開啟：列車、車廂、隧道無限。':'BUG 模式已關閉，已配置的列車、車廂與路線保留。');updateUI();};
$('planned-growth').onclick=()=>{if(blocked()||state.planning)return;state.plannedGrowth=!state.plannedGrowth;toast(state.plannedGrowth?'規劃新站已開啟：用完城市目錄後最多新增 50 站。':'規劃新站已關閉；既有站點與路網保留，城市目錄照常開放。');updateUI();};
for(const b of document.querySelectorAll('[data-upgrade]'))b.onclick=()=>{const r=chooseUpgrade(state,b.dataset.upgrade);toast(r.message);updateUI();if(r.ok)$('pause').focus();};
function reset(){begin(state.mode);}
$('restart').onclick=reset;
$('new-game').onclick=()=>{if(!started)return;if(state.time>0&&!state.gameOver){if(!confirm('重新開始本局？目前的路網與分數會重設，最高分保留。'))return;}reset();};
$('help').onclick=()=>{cancelDraft();$('help-dialog').showModal();};
$('map-sources').onclick=()=>$('help-dialog').showModal();
$('auto-mode').onclick=async()=>{if(blocked()||state.planning)return;if(state.autoMode){state.autoMode=false;toast('自動模式已關閉，保留目前路網，可自行調度。');updateUI();return;}
  const target=state;autoLoading=true;$('auto-mode').disabled=true;updateUI();
  const network=state.city?await loadReference(state.city.id):null;
  autoLoading=false;
  if(state!==target||blocked()){$('auto-mode').disabled=false;updateUI();return;}
  if(state.city&&!state.city.fictional&&!configureAutoNetwork(state,network)){$('auto-mode').disabled=false;toast('真實路網尚未載入，請稍後再試。');updateUI();return;}
  cancelDraft();state.autoMode=true;paused=false;autoManage(state);renderLines();backlog=0;last=performance.now();$('auto-mode').disabled=false;toast(state.autoNetwork?'自動模式：依真實站序分線、保留轉乘，孤站以短接駁銜接。':'自動模式已開啟。');updateUI();};
function chooseCity(id){terrainCache=null;selectedCity=id;state=createState(Date.now(),{cityId:id,city:referenceFor(id)?.city||undefined});selected=0;lastStationCount=0;panX=panY=0;viewZoom=1;buildingTool=false;renderLines();loadReference(id);updatePicker();updateUI();}
function updatePicker(){
  for(const b of document.querySelectorAll('[data-city]')){b.setAttribute('aria-pressed',String(b.dataset.city===selectedCity));b.querySelector('small').textContent=completed.includes(b.dataset.city)?'✓ 已完成':'';}
  const selectedFuture=referenceFor(selectedCity)?.future;$('future-toggle').disabled=started||!!getCity(selectedCity)?.fictional;$('future-toggle').setAttribute('aria-pressed',String(futureFor(selectedCity)));$('future-toggle').textContent=`未來規劃：${futureFor(selectedCity)?'開':'關'}`;$('future-note').textContent=getCity(selectedCity)?.fictional?'人工城市不套用未來路線；站名隨機取自五城。':selectedFuture?`已收錄 ${selectedFuture.projects.length} 個官方計畫、${selectedFuture.newStations} 個新增站點；預計時程與虛線線位為規劃示意。`:'開啟可加入五城官方未來站點與路線；預計時間不代表已通車。';
  const city=getCity(selectedCity);$('city-description').textContent=city?.description||'原創河港市經典玩法。';$('preview-goal').textContent=city?`關卡目標：送達 ${city.goal.delivered} 人 · 連接 ${city.goal.connected} 站 · 營運 ${city.goal.lines} 線`:'自由規劃';
  $('start-realtime').disabled=!city||city.fictional;$('start-realtime').title=city?.fictional?'環海自建城沒有真實列車班次':'依城市當地時間觀看官方資訊與班次推估';
  const historyName=city&&!city.fictional?city.name:'五城',historyUrl=city&&!city.fictional?`history.html?city=${city.id}&future=${futureFor(city.id)?1:0}`:'history.html?future=0';
  $('history-entry').href=$('history-sidebar-link').href=historyUrl;$('history-entry').firstChild.textContent=`${historyName}歷史回顧 ↗`;$('history-sidebar-link').textContent=`${historyName}歷史回顧 ↗`;
  $('history-entry').querySelector('span').textContent=futureFor(city?.id)?'實際路網・通車歷程・未來預計時程・唯讀觀賞':'實際路網・通車歷程・歷年運量・唯讀觀賞';
  $('start-planning').disabled=!city||!referenceFor(selectedCity)?.lines?.length;
  $('start-planning').firstChild.textContent=`實際規劃模式${referenceFor(selectedCity)?.lines?.length?' · '+referenceFor(selectedCity).lines.length+' 線':''}`;
  const count=referenceFor(selectedCity)?.lines?.length;if(city&&count)$('preview-goal').textContent+=` · 基本玩法 ${count*2} 條路線可自由配置`;
}
$('future-toggle').onclick=()=>{if(started)return;futureEnabled=!futureEnabled;saveFuturePreference(futureEnabled);const url=new URL(location.href);url.searchParams.delete('future');history.replaceState(null,'',url);chooseCity(selectedCity);};
for(const city of CITIES){const b=document.createElement('button');b.dataset.city=city.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<strong>${city.name}</strong><span>${city.fictional?'三層人工大陸・2400 × 2400':`${city.stations.length} 個真實車站`}</span><small></small>`;b.onclick=()=>chooseCity(city.id);$('city-options').append(b);}
$('city-menu').onclick=()=>{if(started&&!state.gameOver&&!state.won&&(state.time>0||state.planning?.elapsed>0)&&!confirm('切換城市將重設本局，完成紀錄與最高分保留。'))return;started=false;display.unlock();cancelDraft();$('intro').hidden=false;$('gameover').hidden=$('victory').hidden=$('upgrade').hidden=true;chooseCity(selectedCity||'hongkong');document.querySelector(`[data-city="${selectedCity}"]`).focus();};
$('next-city').onclick=()=>{const index=CITIES.findIndex(c=>c.id===selectedCity);if(index===CITIES.length-1){$('city-menu').click();return;}selectedCity=CITIES[index+1].id;begin('campaign');};
$('continue-endless').onclick=()=>{state.mode='endless';state.won=false;state.upgrade=false;prevWon=false;$('victory').hidden=true;last=performance.now();backlog=0;updateUI();$('pause').focus();};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!state.gameOver&&!state.autoMode&&state.mode!=='endless'&&!state.planning){paused=true;cancelDraft();last=performance.now();updateUI();}});
document.addEventListener('keydown',event=>{
  if($('help-dialog').open)return;
  const modal=!started?$('intro'):state.upgrade?$('upgrade'):state.gameOver?$('gameover'):state.won?$('victory'):null;
  if(modal){if(event.code==='Tab'){const buttons=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')],first=buttons[0],end=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();end.focus();}else if(!event.shiftKey&&document.activeElement===end){event.preventDefault();first.focus();}}return;}
  if(event.code==='Escape'){cancelDraft();return;}
  if(event.target.matches('input,select,textarea'))return;
  if(event.target===canvas&&state.planning){
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)){event.preventDefault();panX+=event.code==='ArrowLeft'?30:event.code==='ArrowRight'?-30:0;panY+=event.code==='ArrowUp'?30:event.code==='ArrowDown'?-30:0;return;}
    if(event.code==='Enter'&&state.planning.phase==='building'){event.preventDefault();placeStation({x:(canvas.clientWidth/2-transform.x)/transform.scale,y:(canvas.clientHeight/2-transform.y)/transform.scale});return;}
  }
  if(event.target.matches('button,input,select,summary')&&event.code==='Space')return;
  if(event.code==='Space'){event.preventDefault();$('pause').click();}
  if(/^[1-5]$/.test(event.key))selectLine(Number(event.key)-1);
});
function renderLines(){
  $('lines').replaceChildren();
  for(const l of state.lines){const b=document.createElement('button');b.className='route-select';b.style.setProperty('--route',l.color);b.id=`line-${l.id}`;b.setAttribute('aria-label',`選擇 ${(state.referenceLineCount||state.autoNetwork)?l.name:String.fromCharCode(65+l.id)+' 線'}`);
    const badge=document.createElement('span'),name=document.createElement('strong'),count=document.createElement('small');badge.className='route-letter';badge.textContent=(state.referenceLineCount||state.autoNetwork)?l.id+1:String.fromCharCode(65+l.id);name.textContent=l.name;b.append(badge,name,count);b.onclick=()=>selectLine(l.id);$('lines').append(b);}
}
$('line-filter').oninput=()=>updateUI();
const clockText=seconds=>{const value=Math.max(0,Math.ceil(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;};
function updateUI(){
  const planning=state.planning,actual=!!(state.referenceLineCount||state.autoNetwork),building=planning?.phase==='building',editable=!planning||building;
  if($('lines').children.length!==state.lines.length)renderLines();
  const modalOpen=!started||state.upgrade||state.gameOver||state.won;
  for(const element of document.querySelectorAll('.sidebar,.transport,.topbar,.map-controls'))element.inert=modalOpen;
  const l=line(),active=state.lines.flatMap(l=>l.stops);
  const progress=missionProgress(state),goal=progress.goal;
  $('city-caption').textContent=state.city?.name||'河港市';$('mode-caption').textContent=state.mode==='endless'?'無盡模式 · 持續增站':state.city?'目標關卡':'自由規劃 · 經典模式';
  $('map-credit').firstChild.textContent=state.city?.fictional?'原創人工大陸・站名隨機取自五城':state.city?'歷史回顧同款地圖・淡色為實際軌道參考':'原創河港市';
  $('map-credit').querySelector('small').textContent=state.city?.fictional?'環形運河與四向大水道 · 虛構站位':'Protomaps · 官方開放資料 · Wikidata · © OpenStreetMap contributors';
  $('mission-title').textContent=`${state.city?.name||'河港市'}・${state.mode==='endless'?'無盡模式':'關卡目標'}`;
  $('mission-copy').textContent=goal?`送達 ${goal.delivered} 人 · 連接 ${goal.connected} 站 · 營運 ${goal.lines} 線`:state.mode==='endless'?`${state.city?`用完 ${state.city.stations.length} 個真實站點後，才新增規劃站。`:''}時間持續運行，每週自動補給，壅塞不會結束遊戲。`:'保持城市運輸暢通。';
  $('mission-progress').hidden=!goal;$('mission-progress').value=goal?Math.min(1,progress.delivered/goal.delivered)+Math.min(1,progress.connected/goal.connected)+Math.min(1,progress.lines/goal.lines):0;
  $('mission-current').textContent=`${progress.delivered} 人送達 · ${progress.connected} 站連通 · ${progress.lines} 線 · 運行 ${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;
  $('auto-mode').textContent=autoLoading?'正在載入真實路網…':`自動模式：${state.autoMode?(state.autoNetwork?'開 · 參照真實路網':'開'):'關'}`;$('auto-mode').disabled=autoLoading;$('auto-mode').setAttribute('aria-pressed',String(state.autoMode));
  $('score').textContent=state.delivered.toLocaleString();$('week').textContent=`第 ${state.week} 週`;
  const phase=(state.time%70)/70;
  $('day').textContent=['星期一','星期二','星期三','星期四','星期五','星期六','星期日'][Math.min(6,Math.floor(phase*7))];$('week-progress').style.width=`${phase*100}%`;
  $('connected').textContent=`${new Set(active).size} / ${state.stations.length} 站已連接`;
  for(let i=0;i<state.lines.length;i++){const b=$(`line-${i}`),current=state.lines[i];b.hidden=actual&&!current.name.toLocaleLowerCase().includes($('line-filter').value.trim().toLocaleLowerCase());b.disabled=i>=state.unlocked;b.setAttribute('aria-pressed',String(i===selected));b.setAttribute('aria-label',`選擇 ${actual?current.name:String.fromCharCode(65+i)+' 線'}`);b.style.setProperty('--route',current.color);b.querySelector('strong').textContent=current.name;b.querySelector('small').textContent=i>=state.unlocked?'週末解鎖':current.stops.length?`${new Set(current.stops).size} 站`:actual?'待分配':'未開通';}
  $('selected-color').style.background=l.color;$('selected-name').textContent=actual?l.name:`${String.fromCharCode(65+selected)} 線`;
  $('route-count').textContent=l.stops.length?`${new Set(l.stops).size} 站 · ${l.stops[0]===l.stops.at(-1)?'環線':'往返'}`:'尚未開通';
  $('route-instruction').textContent=l.stops.length?'端點可延伸；從中間站或線段拖到新站可插站，保留兩側路線。分支可另選一條線，從共站接出。':'從任意一站拖曳到另一站，建立路線。';
  $('train-count').textContent=l.trains.length;
  $('carriage-count').textContent=l.trains.reduce((n,t)=>n+Math.max(0,Math.round((t.capacity-6)/6)),0);
  $('spare-trains').textContent=state.bugMode?'∞':state.depot.trains;$('spare-carriages').textContent=state.bugMode?'∞':state.depot.carriages;
  $('bug-mode').setAttribute('aria-pressed',String(state.bugMode));$('bug-mode').textContent=`BUG 模式：${state.bugMode?'開':'關'}`;
  $('planned-growth').setAttribute('aria-pressed',String(state.plannedGrowth));$('planned-growth').textContent=`規劃新站：${state.plannedGrowth?'開':'關'}`;$('planned-growth').disabled=blocked();
  $('planned-growth-note').textContent=`規劃新站 ${generatedStationCount(state)} / 50 · ${state.plannedGrowth?'城市目錄用完後新增，手動／自動皆最多 50 站。':'已關閉，既有車站保留；城市目錄照常開放。'}`;
  const used=planning?0:tunnelsUsed(state);$('spare-tunnels').textContent=state.bugMode?'∞':Math.max(0,state.depot.tunnels-used);$('tunnel-note').textContent=planning?'列車、車廂與跨河資源不限；不列入評分。':`隧道已用 ${used} / ${state.bugMode?'∞':state.depot.tunnels}，${state.bugMode?'跨河不受限制':used>state.depot.tunnels?'縮短或撤線可釋出隧道':'跨河時自動配置'}。`;
  $('trim').disabled=$('clear').disabled=!editable||!l.stops.length||blocked();$('redraw').disabled=!editable||blocked();
  $('add-train').disabled=!editable||blocked()||!l.stops.length||(!state.bugMode&&!state.depot.trains);$('add-carriage').disabled=!editable||blocked()||!l.trains.length||(!state.bugMode&&!state.depot.carriages);
  $('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'繼續遊戲':'暫停遊戲');$('pause').textContent=paused?'▶':'Ⅱ';$('speed').textContent=`${speed}×`;
  $('pause-label').hidden=!paused||blocked();
  $('pause').disabled=building;$('speed').disabled=building;
  const congested=state.stations.filter(s=>s.queue.length>6).length;
  $('status').textContent=state.won?'關卡目標達成！':state.gameOver?'本次營運結束。':state.upgrade?'週末補給：請選擇擴充。':paused?'時間已暫停，可以安心規劃路線。':state.autoMode?`自動調度中 · ${state.stations.length} 站 · ${congested} 站壅塞`:draft||redrawing?`連線規劃中${state.mode==='endless'?'':'，時間暫停'}。`:congested?`${congested} 站壅塞中，請增派列車或調整路線。`:`${state.stations.length} 個車站 · ${state.lines.reduce((n,l)=>n+l.trains.length,0)} 輛列車運行中`;
  if(lastStationCount!==state.stations.length){
    $('station-buttons').replaceChildren();for(const s of state.stations){const b=document.createElement('button');b.textContent=`${symbols[s.shape]} ${label(s)}`;b.setAttribute('aria-label',`連接${label(s)} ${symbols[s.shape]}`);b.onclick=()=>{stationPoint(s.id);finishDraw();updateUI();};$('station-buttons').append(b);}if(lastStationCount&&started&&state.stations.length>lastStationCount)toast(`新車站開放：${label(state.stations.at(-1))}。`);lastStationCount=state.stations.length;
  }
  $('upgrade').hidden=!state.upgrade;document.querySelector('[data-upgrade="line"]').disabled=state.unlocked>=state.lines.length;
  if(state.upgrade&&!prevUpgrade){cancelDraft();document.querySelector(`[data-upgrade="${state.unlocked>=state.lines.length?'carriage':'line'}"]`).focus();}
  prevUpgrade=state.upgrade;
  $('gameover').hidden=!state.gameOver;
  if(state.gameOver&&!prevOver){
    cancelDraft();best=Math.max(best,state.delivered);try{localStorage.setItem('harbor-transit-best',String(best));}catch{}
    const worst=state.stations.reduce((a,b)=>a.crowd>b.crowd?a:b);$('loss-reason').textContent=`${label(worst)}持續壅塞，營運在第 ${state.week} 週結束。`;$('final-score').textContent=state.delivered.toLocaleString();$('record').textContent=`本機最高紀錄 ${best.toLocaleString()} 人`;$('restart').focus();
  }prevOver=state.gameOver;
  $('victory').hidden=!state.won;
  if(state.won&&!prevWon){cancelDraft();completed=[...new Set([...completed,state.city.id])];best=Math.max(best,state.delivered);try{localStorage.setItem('harbor-transit-cities',JSON.stringify(completed));localStorage.setItem('harbor-transit-best',String(best));}catch{}$('victory-title').textContent=`${state.city.name}・目標達成！`;$('victory-copy').textContent=`已送達 ${state.delivered} 人，連通 ${progress.connected} 站，營運 ${progress.lines} 條路線。`;$('next-city').textContent=selectedCity==='international'?'返回城市選單':'下一關';$('next-city').focus();updatePicker();}prevWon=state.won;
  $('planning-controls').hidden=!planning;$('line-filter-label').hidden=!actual;$('auto-mode').closest('.mission').hidden=!!planning;$('bug-mode').hidden=$('planned-growth').hidden=$('planned-growth-note').hidden=!!planning;$('lines').classList.toggle('planning-lines',actual);
  if(state.autoMode&&state.autoNetwork)$('status').textContent=`真實站序自動規劃 · ${state.lines.filter(line=>line.autoPattern&&line.stops.length).length} 條實際路線／分支 · ${state.lines.filter(line=>line.autoFeeder&&line.stops.length).length} 條短接駁${state.autoNetwork.waiting?' · '+state.autoNetwork.waiting+' 站待資源補給':''}`;
  if(state.mode==='endless')$('status').textContent+=!state.plannedGrowth?' · 規劃新站已關閉':generatedStationCount(state)>=50?' · 規劃新站已達 50 站上限':'';
  $('planning-last-result').hidden=!planning?.result;
  if(planning){
    const metrics=planningProgress(state),left=building?planning.limit-planning.elapsed:planning.duration-(state.time-planning.runStart);
    $('mode-caption').textContent=`實際規劃 · 第 ${planning.round} 輪 · ${building?'規劃中':'全路網運行中'}`;
    $('week').textContent=building?'規劃倒數':'模擬倒數';$('day').textContent=clockText(left);$('week-progress').style.width=`${100*(1-left/(building?planning.limit:planning.duration))}%`;
    $('planning-clock').textContent=`第 ${planning.round} 輪 · ${building?'規劃剩餘':'運行剩餘'} ${clockText(left)} · ${state.lines.length} 條${state.city?.fictional?'自訂':futureFor(state.city?.id)?'實際＋規劃':'實際'}路線名額`;
    $('planning-name-note').textContent=state.city?.fictional?'站名隨機取自五城目錄，同名依序加 2、3。':'站名沿用歷史地圖最近車站，同名依序加 2、3。';
    $('planning-coverage-note').textContent=state.city?.fictional?'需求參考採人工城市的虛構站位，非真實人口統計。':'需求參考採既有真實站點周邊，非真實人口統計。';
    $('planning-metrics').textContent=`${state.stations.length} 站 · ${metrics.lines} 線 · 完整度 ${metrics.completeness}%（需求參考覆蓋 ${Math.round(metrics.coverage*100)}%／連通 ${Math.round(metrics.connectivity*100)}%）`;
    $('build-tool').disabled=$('undo-station').disabled=$('station-type').disabled=!building;$('undo-station').disabled=!building||!state.stations.length||state.stations.at(-1).age>0;$('launch-planning').disabled=!building;
    $('build-tool').setAttribute('aria-pressed',String(buildingTool));$('build-tool').textContent=`建站工具：${buildingTool?'開':'關'}`;
    $('launch-planning').textContent=building?'啟動全部路線 ▶':'路網已統一啟動';
    $('status').textContent=building?`第 ${planning.round} 輪 · 規劃剩餘 ${clockText(left)} · 右鍵建站、左鍵拉線`:`全路網運行 · 剩餘 ${clockText(left)} · 累計 ${state.delivered} 人次送達 · 配置已鎖定`;
    if(previousPlanningPhase==='building'&&!building){cancelDraft();buildingTool=false;toast(state.notice);}
    if(previousPlanningPhase==='running'&&building){paused=false;speed=1;toast(state.notice);}
    if(planning.result){const result=planning.result;$('planning-last-result').textContent=`第 ${result.round} 輪 10 秒運行完成 · 累計送達 ${result.delivered.toLocaleString()} 人次／需求 ${result.generated.toLocaleString()} 人次 · 完整度 ${result.completeness}%`;}
  }
  previousPlanningPhase=planning?.phase||null;
}
function path(points){ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(points[i].x,points[i].y):ctx.moveTo(points[i].x,points[i].y);}
function shape(kind,x,y,r,fill='#fff',stroke='#304b5d',width=3){
  ctx.beginPath();
  if(kind==='circle')ctx.arc(x,y,r,0,Math.PI*2);
  else if(kind==='square')ctx.rect(x-r*.82,y-r*.82,r*1.64,r*1.64);
  else if(kind==='triangle'){ctx.moveTo(x,y-r*1.15);ctx.lineTo(x+r,y+r*.8);ctx.lineTo(x-r,y+r*.8);ctx.closePath();}
  else if(kind==='diamond'){ctx.moveTo(x,y-r*1.15);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r*1.15);ctx.lineTo(x-r,y);ctx.closePath();}
  else{for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,z=i%2?r*.47:r*1.2;i?ctx.lineTo(x+Math.cos(a)*z,y+Math.sin(a)*z):ctx.moveTo(x+Math.cos(a)*z,y+Math.sin(a)*z);}ctx.closePath();}
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function draw(now){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),cw=Math.round(rect.width*dpr),ch=Math.round(rect.height*dpr);
  if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#f5f7f6';ctx.fillRect(0,0,rect.width,rect.height);
  // Keep the same geographic space on phones; stations retain a usable touch hit area.
  const world=state.world,scale=Math.min(rect.width/world.width,(rect.height-65)/world.height)*viewZoom;transform={scale,x:(rect.width-world.width*scale)/2+panX,y:55+(rect.height-55-world.height*scale)/2+panY};
  if(state.city){
    const key=[state.city.id,cw,ch,scale,transform.x,transform.y,display.values.station,display.values.line].join(':');
    if(terrainCache?.key!==key){
      // The detailed vector background only needs repainting when the view changes.
      const background=terrainCache?.canvas||document.createElement('canvas');background.width=cw;background.height=ch;
      const context=background.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.fillStyle='#d1e5ec';context.fillRect(0,0,rect.width,rect.height);context.translate(transform.x,transform.y);context.scale(scale,scale);paintTerrain(context,state.city,scale);
      const reference=referenceFor(state.city.id);
      if(reference&&!state.city.fictional){
        context.save();context.globalAlpha=.27;paintRailLines(context,reference.legs,scale,display.values.line/100,world);context.restore();
        context.fillStyle='#ffffffa6';context.strokeStyle='#607e8d66';context.lineWidth=.8/scale;
        for(const station of reference.stations){context.beginPath();context.arc(station.x,station.y,2.3*display.values.station/100/scale,0,Math.PI*2);context.fillStyle=station.planned?'#fff0d5':'#ffffffa6';context.strokeStyle=station.planned?'#ad7b3e':'#607e8d66';context.fill();context.stroke();}
      }
      terrainCache={key,canvas:background};
    }
    ctx.drawImage(terrainCache.canvas,0,0,cw,ch,0,0,rect.width,rect.height);
  }
  ctx.translate(transform.x,transform.y);ctx.scale(scale,scale);
  if(state.city){
    for(const area of state.expansions){ctx.fillStyle='#f5f7f6';ctx.fillRect(area.x,area.y,area.width,area.height);ctx.strokeStyle='#bfd4da';ctx.strokeRect(area.x,area.y,area.width,area.height);ctx.fillStyle='#819aa7';ctx.font='12px sans-serif';ctx.fillText('新城規劃區',area.x+20,area.y+25);}
    for(const region of state.city.labels){ctx.fillStyle='#6c8a98';ctx.font='13px "Microsoft JhengHei",sans-serif';ctx.fillText(region.name,region.x,region.y);}
  }
  ctx.strokeStyle='#e7edeb';ctx.lineWidth=1;
  const gridLeft=Math.max(30,Math.floor(-transform.x/scale/48)*48+30),gridRight=Math.min(world.width,(rect.width-transform.x)/scale);
  if(!state.city)for(let x=gridLeft;x<gridRight;x+=48)for(let y=50;y<world.height-20;y+=48){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fillStyle='#dfe8e7';ctx.fill();}
  ctx.lineJoin='round';ctx.lineCap='round';
  if(!state.city){path(RIVER);ctx.strokeStyle='#bdd9e2';ctx.lineWidth=62;ctx.stroke();path(RIVER);ctx.strokeStyle='#d1e5ec';ctx.lineWidth=56;ctx.stroke();ctx.save();ctx.translate(590,520);ctx.rotate(-1.28);ctx.fillStyle='#79a9ba';ctx.font='12px "Microsoft JhengHei",sans-serif';ctx.fillText('河 港 川',0,0);ctx.restore();ctx.font='11px "Microsoft JhengHei",sans-serif';ctx.fillStyle='#b5c4c8';ctx.fillText('舊 城 區',155,160);ctx.fillText('河 岸 新 城',780,480);ctx.fillText('北 港',760,110);}
  const lineSize=display.values.line/100/(state.city?Math.max(1,scale):1);
  for(const l of state.lines){if(l.stops.length<2)continue;path(routePoints(state,l.stops));ctx.strokeStyle='#f5f7f6';ctx.lineWidth=(l.id===selected?9:7)*lineSize;ctx.stroke();path(routePoints(state,l.stops));ctx.strokeStyle=l.color;ctx.globalAlpha=l.id===selected?1:.66;ctx.lineWidth=(l.id===selected?7:5)*lineSize;ctx.stroke();ctx.globalAlpha=1;}
  if(draft?.length>=2){path(routePoints(state,draft));ctx.setLineDash([10,7].map(n=>n/(state.city?Math.max(1,scale):1)));ctx.strokeStyle=line().color;ctx.lineWidth=7*lineSize;ctx.globalAlpha=.7;ctx.stroke();ctx.globalAlpha=1;ctx.setLineDash([]);}
  const served=new Set(state.lines.flatMap(l=>l.stops)),size=stationScale(scale)*display.values.station/100;
  if(state.planning)for(const stop of state.stations.filter(stop=>served.has(stop.id))){ctx.beginPath();ctx.arc(stop.x,stop.y,28,0,Math.PI*2);ctx.fillStyle='#347ab60c';ctx.fill();ctx.strokeStyle='#347ab62b';ctx.lineWidth=.7/scale;ctx.stroke();}
  for(const s of state.stations){
    const r=Math.max(13,9/scale)*size;
    if(!served.has(s.id)){
      ctx.globalAlpha=reducedMotion?.9:.35+.65*(.5+.5*Math.sin(now/230));ctx.beginPath();ctx.arc(s.x,s.y,r+8*size,0,Math.PI*2);ctx.strokeStyle='#e34036';ctx.lineWidth=3*size/Math.min(1,scale);ctx.stroke();ctx.beginPath();ctx.arc(s.x+r+3*size,s.y-r-3*size,3.5*size/Math.min(1,scale),0,Math.PI*2);ctx.fillStyle='#e34036';ctx.fill();ctx.globalAlpha=1;
    }
    if(s.queue.length>6){ctx.beginPath();ctx.arc(s.x,s.y,24*size,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,s.crowd/26));ctx.strokeStyle='#d15b4d';ctx.lineWidth=4*size;ctx.stroke();ctx.beginPath();ctx.arc(s.x,s.y,24*size,0,Math.PI*2);ctx.strokeStyle='#d15b4d22';ctx.lineWidth=4*size;ctx.stroke();}
    if(hover===s.id||(draft&&(insertion?draft[insertion.at-1]:draft.at(-1))===s.id)){ctx.beginPath();ctx.arc(s.x,s.y,21*size,0,Math.PI*2);ctx.fillStyle=line().color+'18';ctx.fill();}
    const serving=state.lines.filter(l=>l.stops.includes(s.id)).length;
    if(serving>1){ctx.beginPath();ctx.arc(s.x,s.y,19*size,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#bcc9cf';ctx.lineWidth=2*size;ctx.stroke();}
    shape(s.shape,s.x,s.y,r,'#fff',s.queue.length>6?'#bd534b':'#304b5d',3*size);
    const q=s.queue.slice(0,16),left=s.x+r+11*size,marker=Math.max(3.3,2/scale)*size/stationScale(),pitch=marker*3.3;
    for(let i=0;i<q.length;i++)shape(q[i].shape,left+(i%6)*pitch,s.y-9*size+Math.floor(i/6)*pitch,marker,'#516b7b',null);
    if(s.queue.length>16){ctx.fillStyle='#bd534b';ctx.font='10px sans-serif';ctx.fillText(`+${s.queue.length-16}`,left,s.y+37);}
    ctx.fillStyle='#728893';ctx.textAlign='center';ctx.font=`${Math.max(11,8/scale)*stationScale(scale)/stationScale()}px "Microsoft JhengHei",sans-serif`;ctx.fillText(label(s),s.x,s.y+r+21*size);ctx.textAlign='left';
  }
  for(const l of state.planning?.phase==='building'?[]:state.lines)for(const t of l.trains){
    const p=trainPosition(state,l,t);if(!p||!Number.isFinite(p.x))continue;
    const vehicleSize=display.values.train/100/(state.city?Math.max(1,scale):1);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle||0);ctx.scale(vehicleSize,vehicleSize);
    ctx.beginPath();ctx.roundRect(-12,-7,24,14,4);ctx.fillStyle=l.color;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
    for(let i=0;i<Math.min(6,t.passengers.length);i++){ctx.fillStyle='#fff';ctx.fillRect(-7+(i%3)*5,-3+Math.floor(i/3)*5,3,3);}
    ctx.restore();
    const added=Math.max(0,Math.round(t.capacity/6)-1);
    if(added){
      const text=`+${added}`,fontSize=9/scale,height=fontSize+4/scale,offset=7*vehicleSize+3/scale;
      ctx.font=`600 ${fontSize}px "Segoe UI",sans-serif`;const width=ctx.measureText(text).width+6/scale;
      ctx.beginPath();ctx.roundRect(p.x-width/2,p.y-offset-height,width,height,3/scale);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=l.color;ctx.lineWidth=1/scale;ctx.stroke();
      ctx.fillStyle=l.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x,p.y-offset-height/2);ctx.textAlign='left';ctx.textBaseline='alphabetic';
    }
  }
  if(performance.now()>toastUntil)$('toast').classList.remove('visible');
}
function simulate(now){
  const elapsed=Math.max(0,(now-last)/1000);last=now;
  if(!started||paused||state.gameOver||state.won||($('help-dialog').open&&!state.planning)){backlog=0;return;}
  if(state.planning){
    const planning=state.planning,building=planning.phase==='building',rate=building?1:speed;backlog+=elapsed;
    const seconds=Math.min(backlog*rate,building?planning.limit-planning.elapsed:planning.duration-(state.time-planning.runStart));
    advance(state,seconds);backlog-=seconds/rate;
    if(!building&&planning.phase==='building')speed=1;
  }else if(state.autoMode||state.mode==='endless'){
    backlog+=elapsed*speed;const seconds=Math.min(10,backlog);
    if(state.autoMode&&!draft&&!redrawing)advanceAutomatic(state,seconds);else advance(state,seconds);
    backlog-=seconds;
  }else if(!draft&&!redrawing&&!document.hidden)advance(state,Math.min(elapsed,.1)*speed);
}
function frame(now){const dt=Math.min((now-last)/1000,.1);if(!document.hidden)simulate(now);uiElapsed+=dt;if(uiElapsed>.12){updateUI();uiElapsed=0;}draw(now);requestAnimationFrame(frame);}
setInterval(()=>{if(document.hidden&&(state.autoMode||state.mode==='endless'||state.planning)){simulate(performance.now());updateUI();}},1000);
if(legacy){$('start').textContent='開始規劃';$('city-options').hidden=true;}
renderLines();loadReference(selectedCity);updatePicker();updateUI();(legacy?$('start'):document.querySelector(`[data-city="${selectedCity}"]`)).focus();requestAnimationFrame(frame);
if(new URLSearchParams(location.search).has('test'))window.harbor={get state(){return state;},get selected(){return selected;},get view(){return transform;},get display(){return display.values;},get referenceNetwork(){return referenceFor(state.city?.id)||null;},setRoute:(id,stops)=>setRoute(state,id,stops),advance:dt=>advance(state,dt),advanceAutomatic:dt=>advanceAutomatic(state,dt),simulateElapsed:dt=>{last-=dt*1000;simulate(performance.now());updateUI();},chooseCity,begin,start:()=>{$('start').click();},reset,selectLine,updateUI,trainPosition,routePoints};
