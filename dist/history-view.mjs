import {startI18n} from './i18n.mjs';
startI18n();
import {paintTerrain} from './terrain.mjs';
import {HISTORY_CITIES,loadHistoryCity} from './history-cities.mjs';
import {formatOpening} from './history-model.mjs';
import {mountDisplaySettings} from './display-settings.mjs';
import {paintRailLines} from './rail-map.mjs';
import {mountPinchZoom} from './touch-map.mjs';
import {futurePreference,saveFuturePreference} from './future-settings.mjs';

const $=id=>document.getElementById(id),canvas=$('history-map'),ctx=canvas.getContext('2d');
const requested=new URLSearchParams(location.search).get('city'),cityId=HISTORY_CITIES.some(city=>city.id===requested)?requested:'taipei';
const includeFuture=futurePreference(),model=await loadHistoryCity(cityId,includeFuture);
const {city,network:HISTORY_NETWORK,events:HISTORY_EVENTS,operationEras:HISTORY_OPERATION_ERAS,metadata:HISTORY_METADATA,ridership:RIDERSHIP,snapshotAt,servicesAt,samplePath}=model;
const today=HISTORY_METADATA.verifiedOn;
const sourcePage=cityId==='taipei'?'sources.html#history':'sources.html#world-history';
const events=[...HISTORY_EVENTS,{date:today,title:'截至今日的路網',source:sourcePage,note:'已公布運量保留原統計期間；不推估未公布月份。',sections:[]},...(model.future?.events||[])];
let index=0,started=false,playing=false,speed=1,elapsed=0,clock=0,last=0,zoom=1,panX=0,panY=0;
const display=mountDisplaySettings($('display-settings'));
let snapshot,services,newIds=new Set(),terrainCache=null,networkCache=null,transform={scale:1,x:0,y:0},drag=null,hovered=null;
const option=(value,label)=>{const el=document.createElement('option');el.value=value;el.textContent=label;return el;};
document.title=`${HISTORY_METADATA.name}軌道時光｜河港路網`;
$('history-title').textContent=$('history-setup-title').textContent=`${HISTORY_METADATA.name}軌道時光`;$('history-scope').textContent=HISTORY_METADATA.scope;
$('history-scope').title=HISTORY_METADATA.scope;
$('history-disclosure').textContent=HISTORY_METADATA.notes?.join(' ')||'唯讀回顧以常態交路呈現開通歷程，不重演災害停駛或每日特殊班次。站名及站碼採現行版本供比對。';
if(includeFuture)$('history-disclosure').textContent+=' 未來規劃已開啟：預計年份、年代目標及未定期分別標示；虛線與新站位置為規劃示意，非精確工程線位。';
$('history-future-toggle').textContent=`未來規劃：${includeFuture?'開':'關'}`;$('history-future-toggle').setAttribute('aria-pressed',String(includeFuture));
$('history-future-toggle').onclick=()=>{saveFuturePreference(!includeFuture);const url=new URL(location.href);url.searchParams.set('future',includeFuture?'0':'1');location.assign(url);};
$('history-source-link').href=$('history-map-source').href=sourcePage;
$('history-track-credit').textContent=cityId==='taipei'?'軌道：國土測繪中心／臺北市政府':'軌道／站史：各城市公開圖資與所列文獻';
$('services-heading').textContent=cityId==='taipei'?'常態交路':'交路與線位展示';
for(const item of HISTORY_CITIES){$('history-city').append(option(item.id,item.name));const a=document.createElement('a');a.href=`history.html?city=${item.id}&future=${includeFuture?1:0}`;a.textContent=item.name;if(item.id===cityId)a.setAttribute('aria-current','page');$('history-city-nav').append(a);}
$('history-city').value=cityId;
$('history-city').onchange=()=>{if(started)return;const url=new URL(location.href);url.searchParams.set('city',$('history-city').value);location.assign(url);};
events.forEach((event,i)=>$('history-event').append(option(i,`${formatOpening(event)} · ${event.title}`)));
$('history-position').max=events.length-1;
const availableYears=new Set(Object.values(RIDERSHIP).flatMap(system=>system.records.map(record=>record.year))),firstYear=Number(events[0].date.slice(0,4));
for(let year=Math.min(firstYear,...availableYears);year<=Number(today.slice(0,4));year++)$('ridership-year').append(option(year,`${year} 年／年度${availableYears.has(year)?' ●':''}`));
$('timeline-first').textContent=model.metadata.historyOmitted?`${firstYear} · 現況快照`:`${firstYear} · 鐵道啟程`;$('timeline-last').textContent=model.future?'未來規劃（含時程待定）':`${today.slice(0,4)} · 今日路網`;
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;};
const link=(text,url)=>{const el=node('a',text);el.href=url;el.target='_blank';el.rel='noreferrer';return el;};
function updatePlayback(){
  $('history-play').textContent=playing?'暫停回顧 Ⅱ':index===events.length-1?'重新回顧 ↺':'播放回顧 ▶';
  $('history-play').setAttribute('aria-pressed',String(playing));
}
function renderRidership(){
  const year=Number($('ridership-year').value),container=$('ridership-values');container.replaceChildren();
  $('ridership-year').disabled=!!events[index].planned;
  if(events[index].planned){container.append(node('p','未來階段尚無實際運量；不以歷年數字或動畫推估未來運量。','missing'));return;}
  for(const [id,system] of Object.entries(RIDERSHIP)){
    const record=system.records.find(r=>r.year===year),row=node('div',null,'ridership-record'),heading=node('div');
    const approximate=record&&(record.approximate||record.precision==='million'||record.precision==='thousand');
    row.dataset.operator=id;heading.append(node('span',system.label),node('strong',record?`${approximate?'約 ':''}${record.total.toLocaleString('en-US')}`:'尚無可核對資料',record?'':'missing'));row.append(heading);
    if(record){row.append(node('small',`${record.period.replace('..',' 至 ')} · ${record.complete?'已公布年度營運期間':'部分年度，非全年'}`),link('官方統計 ↗',record.source));
      if(system.note)row.append(node('small',system.note));
      if(record.notes){const details=node('details');details.append(node('summary','統計口徑說明'),node('small',record.notes));row.append(details);}}
    container.append(row);
  }
  if(cityId==='taipei'&&year>=2026){const row=node('div',null,'ridership-record'),heading=node('div');heading.append(node('span','三鶯線'),node('strong','尚無可核對資料','missing'));row.append(heading,node('small','2026-06-30 通車；不推估未公布運量。'));container.append(row);}
}
function selectEvent(next){
  index=Math.max(0,Math.min(events.length-1,Number(next)));elapsed=0;
  const event=events[index],previous=index?snapshotAt(events[index-1].date).stations:[];
  snapshot=snapshotAt(event.date);services=servicesAt(event.date);newIds=new Set(snapshot.stations.filter(s=>!previous.some(p=>p.id===s.id)).map(s=>s.id));
  $('event-date').textContent=event.planned?event.targetOpening:event.precision==='year'||event.openingPrecision==='year'?`${event.date.slice(0,4)} 年`:event.date.replaceAll('-','.');$('event-title').textContent=event.title;
  $('opening-phase-label').textContent=event.planned?'未來規劃・非通車紀錄':model.metadata.historyOmitted?'現況路網快照':'當次開通';
  $('line-legend-heading').textContent=event.planned?'已開通與規劃路線':'已開通路線';
  $('event-note').textContent=event.note||'當次開通路段及車站一併呈現。';
  $('network-count').textContent=`${snapshot.stations.length} 站 · ${snapshot.lines.length} 線／分支`;
  const batch=snapshot.stations.filter(s=>newIds.has(s.id));
  $('new-stations').textContent=!event.planned&&event.date===today?'資料核對至 '+today:`${event.planned?'規劃新增':'新增'} ${newIds.size} 站：${batch.slice(0,12).map(s=>s.name).join('、')}${batch.length>12?'…（完整站名見下方清單）':''}`;
  $('station-inventory-summary').textContent=`查看全部 ${snapshot.stations.length} 站與${event.planned?'預計時程':'開通資料'}`;
  const list=$('station-inventory-list');list.replaceChildren();for(const station of snapshot.stations){const item=node('li'),source=station.openingSource||station.source;item.append(node('span',`${station.name} · ${formatOpening(station)}`));if(typeof source==='string')item.append(document.createTextNode(' '),link('來源',source));list.append(item);}
  $('opening-source').href=Array.isArray(event.source)?event.source[0]:event.source||sourcePage;$('opening-source').textContent=event.planned?'查看官方計畫與預計時程 ↗':event.date===today?'查看資料來源與限制 ↗':'查看開通資料 ↗';
  $('history-position').value=index;$('history-event').value=index;$('event-position').textContent=`${index+1} / ${events.length}`;
  $('history-prev').disabled=index===0;$('history-next').disabled=index===events.length-1;
  $('line-legend').replaceChildren();
  for(const line of snapshot.lines){const item=node('span',null,'legend-line'),swatch=node('i',null,'line-swatch');swatch.style.background=line.color;if(line.planned){swatch.style.background='none';swatch.style.borderTop=`2px dashed ${line.color}`;swatch.style.height='0';}item.title=line.planned?`${line.targetOpening} · ${line.colorNote}`:line.colorNote||(line.colorVerified===false?'線色或代表服務顏色詳見來源說明':'');item.append(swatch,node('span',line.name));$('line-legend').append(item);}
  const era=HISTORY_OPERATION_ERAS.find(e=>e.from<=event.date&&(!e.until||event.date<e.until));
  const illustrative=services.filter(service=>service.kind==='geometry-display').length;
  $('era-description').textContent=era?.description||(illustrative?'沿已開通的實際線位展示動態；未核對的歷史完整交路與班距不推測。':'依所列來源有效期的公開運行資料展示；未核實歷史班距留空。');$('services').replaceChildren();
  // Opposite directions share a stopping pattern; show each pattern once in the text list.
  for(const service of services.filter(s=>!s.id.endsWith('-back'))){
    const row=node('div',null,'service-row');row.append(node('strong',service.name||service.stops.join(' → ')));
    row.append(node('div',service.stops.join(' → ')));
    row.append(node('div',service.headwayMin?`公開班距 ${+service.headwayMin.toFixed(2)}–${+service.headwayMax.toFixed(2)} 分鐘${service.headwayNote?' · '+service.headwayNote:''}`:'此階段班距尚未核實'));
    if(service.note)row.append(node('div',service.note));if(service.source)row.append(link('營運資料 ↗',service.source));$('services').append(row);
  }
  const year=Number(event.date.slice(0,4)),previousAvailable=[...availableYears].filter(value=>value<=year).sort((a,b)=>b-a)[0];
  $('ridership-year').value=availableYears.has(year)?year:previousAvailable??year;renderRidership();updatePlayback();hovered=null;$('hover-info').textContent='滑過車站查看站名 · 滾輪縮放／拖曳平移';
}
function trainFraction(service,t){
  const travel=Math.max(18,service.length/7),stops=service.stopFractions||[0,1],dwell=.6,cycle=travel+stops.length*dwell;
  let phase=t%cycle,previous=0;
  for(const fraction of stops){const leg=(fraction-previous)*travel;if(phase<leg)return previous+phase/travel;phase-=leg;if(phase<dwell)return fraction;phase-=dwell;previous=fraction;}
  return 1;
}
function paintStation(context,station,scale,highlight=false){
  const size=display.values.station/100;
  context.beginPath();context.arc(station.x,station.y,(highlight?4:2.3)*size/scale,0,2*Math.PI);context.fillStyle=station.planned?'#fff0d5':'#fff';context.fill();context.lineWidth=1.1*size/scale;context.strokeStyle=station.planned?'#ad7b3e':newIds.has(station.id)?'#263f52':'#677b86';context.setLineDash(station.planned?[2/scale,2/scale]:[]);context.stroke();context.setLineDash([]);
  if(zoom>=2.2||highlight){context.font=`${10/scale}px "Microsoft JhengHei",sans-serif`;context.lineWidth=3/scale;context.strokeStyle='#ffffffed';context.strokeText(station.name,station.x+5/scale,station.y-5/scale);context.fillStyle='#314c5e';context.fillText(station.name,station.x+5/scale,station.y-5/scale);}
}
function draw(now){
  const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(started)clock+=dt;
  if(playing){elapsed+=dt*speed;if(elapsed>=7){if(index<events.length-1)selectEvent(index+1);else{playing=false;updatePlayback();}}}
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const world=city.world||{width:1100,height:700},scale=Math.min(rect.width/world.width,(rect.height-70)/world.height)*zoom;
  transform={scale,x:(rect.width-world.width*scale)/2+panX,y:55+(rect.height-55-world.height*scale)/2+panY};
  const key=[w,h,scale,transform.x,transform.y].join(':');
  if(terrainCache?.key!==key){const background=terrainCache?.canvas||document.createElement('canvas');background.width=w;background.height=h;
    const context=background.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.fillStyle='#d1e5ec';context.fillRect(0,0,rect.width,rect.height);context.translate(transform.x,transform.y);context.scale(scale,scale);paintTerrain(context,city,scale);terrainCache={key,canvas:background};}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.drawImage(terrainCache.canvas,0,0,w,h,0,0,rect.width,rect.height);
  const networkKey=[key,index,display.values.station,display.values.line].join(':');
  if(networkCache?.key!==networkKey){
    const foreground=networkCache?.canvas||document.createElement('canvas');foreground.width=w;foreground.height=h;
    const context=foreground.getContext('2d');context.setTransform(dpr,0,0,dpr,0,0);context.translate(transform.x,transform.y);context.scale(scale,scale);
    paintRailLines(context,snapshot.legs,scale,display.values.line/100,world);for(const station of snapshot.stations)paintStation(context,station,scale);
    networkCache={key:networkKey,canvas:foreground};
  }
  ctx.drawImage(networkCache.canvas,0,0,w,h,0,0,rect.width,rect.height);
  ctx.translate(transform.x,transform.y);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
  const trainSize=display.values.train/100;if(hovered)paintStation(ctx,hovered,scale,true);
  for(let i=0;i<services.length;i++){
    const service=services[i];if(!service.path?.length)continue;
    const position=samplePath(service.path,trainFraction(service,clock+i*5.17));
    ctx.save();ctx.translate(position.x,position.y);ctx.rotate(position.angle);ctx.scale(trainSize,trainSize);ctx.fillStyle=service.color;ctx.strokeStyle='#fff';ctx.lineWidth=1/scale;
    ctx.beginPath();ctx.roundRect(-4/scale,-1.8/scale,8/scale,3.6/scale,1/scale);ctx.fill();ctx.stroke();ctx.restore();
  }
  requestAnimationFrame(draw);
}
function zoomAt(next,x,y){const old=zoom,cx=canvas.clientWidth/2,cy=(canvas.clientHeight+55)/2;zoom=Math.max(.7,Math.min(16,next));panX=(panX+cx-x)*zoom/old-cx+x;panY=(panY+cy-y)*zoom/old-cy+y;}
$('zoom-in').onclick=()=>zoomAt(zoom*1.4,canvas.clientWidth/2,canvas.clientHeight/2);
$('zoom-out').onclick=()=>zoomAt(zoom/1.4,canvas.clientWidth/2,canvas.clientHeight/2);
$('zoom-fit').onclick=()=>{zoom=1;panX=panY=0;};
canvas.addEventListener('wheel',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect();zoomAt(zoom*Math.exp(-event.deltaY*.001),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
function inspectStation(event){
  const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left-transform.x)/transform.scale,y=(event.clientY-rect.top-transform.y)/transform.scale,radius=event.pointerType==='touch'?14:7;
  hovered=snapshot.stations.reduce((nearest,s)=>Math.hypot(s.x-x,s.y-y)<radius/transform.scale&&(!nearest||Math.hypot(s.x-x,s.y-y)<Math.hypot(nearest.x-x,nearest.y-y))?s:nearest,null);
  $('hover-info').textContent=hovered?`${hovered.name} · ${formatOpening(hovered)}`:'點選或滑過車站查看站名 · 雙指縮放／拖曳平移';
}
canvas.addEventListener('pointerdown',event=>{if(pinch.active)return;if(event.pointerType==='touch')inspectStation(event);drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{
  if(drag){panX+=event.clientX-drag.x;panY+=event.clientY-drag.y;drag={x:event.clientX,y:event.clientY};return;}
  inspectStation(event);
});
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{drag=null;});
const pinch=mountPinchZoom(canvas,{cancel:()=>{drag=null;},zoom:(ratio,from,to)=>{zoomAt(zoom*ratio,from.x,from.y);panX+=to.x-from.x;panY+=to.y-from.y;}});
$('history-play').onclick=()=>{if(!started)return;if(index===events.length-1){selectEvent(0);playing=true;}else playing=!playing;updatePlayback();};
$('history-prev').onclick=()=>selectEvent(index-1);$('history-next').onclick=()=>selectEvent(index+1);
$('history-position').oninput=event=>selectEvent(event.target.value);$('history-event').onchange=event=>selectEvent(event.target.value);
$('history-speed').onchange=event=>{speed=Number(event.target.value);};$('ridership-year').onchange=renderRidership;
document.addEventListener('keydown',event=>{if(event.code==='Space'&&!['SELECT','INPUT','BUTTON'].includes(document.activeElement.tagName)){event.preventDefault();$('history-play').click();}});
$('history-start').onclick=()=>{started=true;display.lock();$('history-city').disabled=$('history-future-toggle').disabled=true;$('history-setup').close();playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;updatePlayback();$('history-play').focus();};
$('history-setup').addEventListener('cancel',event=>event.preventDefault());
selectEvent(0);$('history-setup').showModal();requestAnimationFrame(draw);
if(new URLSearchParams(location.search).has('test'))window.historyTransit={selectEvent,get cityId(){return cityId;},get metadata(){return HISTORY_METADATA;},get events(){return events;},get ridership(){return RIDERSHIP;},get index(){return index;},get snapshot(){return snapshot;},get services(){return services;},get clock(){return clock;},get display(){return display.values;},get view(){return {...transform,zoom};},network:HISTORY_NETWORK};
