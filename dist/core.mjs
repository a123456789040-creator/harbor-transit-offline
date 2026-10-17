import {getCity,pointInLand} from './cities.mjs';
export const W = 1100, H = 700;
export const SHAPES = ['circle', 'triangle', 'square', 'diamond', 'star'];
export const COLORS = ['#ed6846', '#347ab6', '#e5b73c', '#9c65af', '#429c7a'];
export const RIVER = [{x:565,y:0},{x:540,y:120},{x:595,y:240},{x:548,y:355},{x:610,y:470},{x:565,y:590},{x:590,y:700}];
const SPEED = 90, DWELL = .65, EPS = 1e-7;
const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
const result = (ok, message) => ({ok, message});
const station = (s, id) => s.stations.find(v => v.id === id);
function random(s) { s.rng = (Math.imul(s.rng, 1664525)+1013904223) >>> 0; return s.rng/4294967296; }
function makeStation(s, x, y, shape) {
  return {id:s.stations.length, x, y, shape, queue:[], crowd:0, age:0, nextPassenger:5+random(s)*3};
}
export function createState(seed = 20261017,options = {}) {
  const city=options.city||getCity(options.cityId,seed);
  const planning=options.mode==='planning';
  if(planning&&(!city||!Array.isArray(options.lines)||!options.lines.length))throw new Error('實際規劃模式需要城市與實際路線清單。');
  const s = {stations:[], lines:COLORS.map((color,id) => ({id,color,name:['朱橙線','湛藍線','琥珀線','紫藤線','翠綠線'][id],stops:[],trains:[]})),
    unlocked:3, depot:{trains:3,carriages:1,tunnels:3}, time:0, week:1, delivered:0, gameOver:false, upgrade:false, bugMode:false,
    notice:'選擇路線，拖過車站，開始運送乘客。', rng:(Number.isFinite(seed)?seed:20261017)>>>0, nextGrowth:city?.growth||18, nextWeek:70,
    city:city||null,mode:options.mode==='endless'?'endless':city?'campaign':'classic',won:false,autoMode:false,plannedGrowth:true,world:{...(city?.world||{width:W,height:H})},expansions:[]};
  if(city&&options.lines?.length){
    s.referenceLineCount=options.lines.length;
    s.lines=Array.from({length:options.lines.length*(planning?1:2)},(_,id)=>{const line=options.lines[id%options.lines.length],name=line.operator?`${line.operator} ${line.name}`:line.name;return {id,name:name+(id>=options.lines.length?' 2':''),color:line.color,referenceId:line.id,stops:[],trains:[]};});s.unlocked=s.lines.length;
  }
  if(planning){
    s.mode='planning';s.bugMode=true;s.nextGrowth=s.nextWeek=Infinity;
    s.planning={phase:'building',round:1,elapsed:0,limit:300,duration:10,runStart:0,generated:0,revision:0,referenceStations:options.referenceStations?.length?options.referenceStations:city.stations};s.notice='右鍵在陸地建站，5 分鐘內規劃路網；運行 10 秒後繼續下一輪規劃。';
  }
  else if(city){s.depot={...city.depot};for(let i=0;i<3;i++){const p=city.stations[i];s.stations.push({...makeStation(s,p.x,p.y,SHAPES[i]),name:p.name,catalogId:p.id,real:!city.fictional&&!p.planned,planned:!!p.planned,artificial:!!city.fictional,source:p.source||p.wikidata});}}
  else for (const [x,y,shape] of [[260,270,'circle'],[460,420,'triangle'],[770,260,'square']]) s.stations.push(makeStation(s,x,y,shape));
  return s;
}
export function buildStation(s,x,y,shape){
  if(s.planning?.phase!=='building')return result(false,'只能在規劃期限內建站。');
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>s.world.width||y<0||y>s.world.height||!pointInLand(s.city,x,y))return result(false,'請在地圖陸地上建站。');
  if(s.stations.some(stop=>distance(stop,{x,y})<6))return result(false,'與既有車站太近，請換個位置。');
  if(shape!=null&&!SHAPES.includes(shape))return result(false,'車站類型無效。');
  const stop=makeStation(s,x,y,shape||SHAPES[s.stations.length%SHAPES.length]);
  // shortcut: Distant sites also use the nearest station name; add district names if new-area naming is needed.
  const anchor=s.city.fictional?s.city.stations[Math.floor(random(s)*s.city.stations.length)]:s.planning.referenceStations.reduce((nearest,p)=>distance(p,stop)<distance(nearest,stop)?p:nearest),used=new Set(s.stations.map(p=>p.name));
  let name=anchor.name;for(let n=2;used.has(name);n++)name=anchor.name+n;
  stop.name=name;stop.real=false;s.stations.push(stop);s.planning.revision++;
  return result(true,`${stop.name}已設置。`);
}
export function undoStation(s){
  if(s.planning?.phase!=='building'||!s.stations.length||s.stations.at(-1).age>0)return result(false,'只能撤回本輪新建、尚未運行的車站。');
  const id=s.stations.at(-1).id;
  for(const line of s.lines)if(line.stops.includes(id)){let stops=line.stops.filter(stop=>stop!==id);if(stops[0]===stops.at(-1)&&new Set(stops).size<3)stops.pop();if(new Set(stops).size<2)stops=[];setRoute(s,line.id,stops);}
  s.stations.pop();s.planning.revision++;return result(true,'已撤回最後設置的車站。');
}
export function planningProgress(s){
  const p=s.planning;if(!p)return null;
  if(p.metrics?.revision===p.revision)return p.metrics;
  const connected=new Set(s.lines.filter(line=>line.stops.length>1).flatMap(line=>line.stops)),adjacent=new Map([...connected].map(id=>[id,new Set()]));
  for(const line of s.lines)for(let i=1;i<line.stops.length;i++){adjacent.get(line.stops[i-1]).add(line.stops[i]);adjacent.get(line.stops[i]).add(line.stops[i-1]);}
  const visited=new Set();let largest=0;
  for(const id of connected){if(visited.has(id))continue;const pending=[id];let size=0;while(pending.length){const next=pending.pop();if(visited.has(next))continue;visited.add(next);size++;for(const neighbour of adjacent.get(next))if(!visited.has(neighbour))pending.push(neighbour);}largest=Math.max(largest,size);}
  const served=s.stations.filter(stop=>connected.has(stop.id)),covered=s.city.stations.filter(anchor=>served.some(stop=>distance(anchor,stop)<=28)).length;
  const coverage=covered/s.city.stations.length,connectivity=s.stations.length?largest/s.stations.length:0;
  return p.metrics={revision:p.revision,connected:connected.size,lines:s.lines.filter(line=>line.stops.length>1).length,covered,coverage,connectivity,completeness:Math.round(100*(.6*coverage+.4*connectivity))};
}
export function launchPlanning(s,deadline=false){
  if(s.planning?.phase!=='building')return result(false,'目前不在規劃階段。');
  if(!deadline&&!s.lines.some(line=>line.stops.length>1))return result(false,'請先建造至少兩站並連成一條路線。');
  s.planning.phase='running';s.planning.runStart=s.time;s.notice=deadline?'規劃時間到，所有已規劃路線一併運行 10 秒。':'全部路線一併啟動，運行 10 秒後返回規劃。';
  return result(true,s.notice);
}
export function missionProgress(s){
  const connected=new Set(s.lines.flatMap(l=>l.stops)).size,lines=s.lines.filter(l=>l.stops.length>1).length,goal=s.mode==='campaign'?s.city?.goal:null;
  return {delivered:s.delivered,connected,lines,goal,complete:!!goal&&s.delivered>=goal.delivered&&connected>=goal.connected&&lines>=goal.lines};
}
function pairPoints(a, b) {
  if (a.x>b.x || (a.x===b.x && a.y>b.y)) return pairPoints(b,a).reverse();
  const dx=b.x-a.x, dy=b.y-a.y, diagonal=Math.min(Math.abs(dx),Math.abs(dy));
  const bend={x:a.x+Math.sign(dx)*diagonal,y:a.y+Math.sign(dy)*diagonal};
  return distance(a,bend)>EPS && distance(bend,b)>EPS ? [a,bend,b] : [a,b];
}
export function routePoints(s, stops) {
  const points=[];
  for (let i=0;i<stops.length;i++) {
    const node=station(s,stops[i]);
    if (!node) return [];
    if (!i) points.push({x:node.x,y:node.y});
    else points.push(...pairPoints(station(s,stops[i-1]),node).slice(1).map(p=>({x:p.x,y:p.y})));
  }
  return points;
}
const lengthOf = points => points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0);
const cross = (a,b) => a.x*b.y-a.y*b.x;
function crossing(a,b,c,d) {
  const v={x:b.x-a.x,y:b.y-a.y}, w={x:d.x-c.x,y:d.y-c.y}, delta={x:c.x-a.x,y:c.y-a.y};
  const divisor=cross(v,w);
  if (Math.abs(divisor)<EPS) return null;
  const t=cross(delta,w)/divisor, u=cross(delta,v)/divisor;
  return t>=-EPS && t<=1+EPS && u>=-EPS && u<=1+EPS ? {x:a.x+t*v.x,y:a.y+t*v.y} : null;
}
const geographyCrossings=new WeakMap();
function geographicCrossings(s,a,b){
  let cache=geographyCrossings.get(s.city);if(!cache){cache=new Map();geographyCrossings.set(s.city,cache);}
  const key=[`${a.x},${a.y}`,`${b.x},${b.y}`].sort().join(':');if(cache.has(key))return cache.get(key);
  const points=pairPoints(a,b),coast=[],rivers=[];
  const hitPaths=(paths,hits)=>{for(const ring of paths)for(let j=1;j<ring.length;j++)for(let i=1;i<points.length;i++){const h=crossing(points[i-1],points[i],{x:ring[j-1][0],y:ring[j-1][1]},{x:ring[j][0],y:ring[j][1]});if(h&&!hits.some(p=>distance(p,h)<2))hits.push(h);}};
  hitPaths([...s.city.land.flatMap(poly=>poly),...s.city.water.flatMap(poly=>poly)],coast);hitPaths(s.city.rivers,rivers);
  const count=Math.ceil(coast.length/2)+rivers.length;cache.set(key,count);return count;
}
export function tunnelsUsed(s) {
  if(s.city){let total=0;const edges=new Set();for(const line of s.lines)for(let i=1;i<line.stops.length;i++){const a=line.stops[i-1],b=line.stops[i],key=[a,b].sort((x,y)=>x-y).join(':');if(!edges.has(key)){edges.add(key);total+=geographicCrossings(s,station(s,a),station(s,b));}}return total;}
  const hits=[];
  for (const line of s.lines) {
    const points=routePoints(s,line.stops);
    for (let i=1;i<points.length;i++) for (let j=1;j<RIVER.length;j++) {
      const hit=crossing(points[i-1],points[i],RIVER[j-1],RIVER[j]);
      if (hit && !hits.some(p=>distance(p,hit)<.01)) hits.push(hit);
    }
  }
  return hits.length;
}
const isLoop = line => line.stops.length>2 && line.stops[0]===line.stops.at(-1);
const nodes = line => isLoop(line) ? line.stops.slice(0,-1) : line.stops;
function nextIndex(line, from, train) {
  const count=nodes(line).length;
  if (isLoop(line)) return (from+train.dir+count)%count;
  if (from+train.dir<0 || from+train.dir>=count) train.dir*=-1;
  return from+train.dir;
}
function resetTrain(line, train, index=0) {
  train.from=index; train.to=nextIndex(line,index,train); train.progress=0; train.dwell=DWELL; train.serviced=false;
}
function edgePoints(s,line,train) {
  const ids=nodes(line);
  return pairPoints(station(s,ids[train.from]),station(s,ids[train.to]));
}
export function trainPosition(s,line,train) {
  if (line.stops.length<2) return {x:0,y:0,angle:0};
  const points=edgePoints(s,line,train);
  let travel=lengthOf(points)*train.progress;
  for (let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],length=distance(a,b);
    if (travel<=length || i===points.length-1) {
      const t=length?Math.min(1,travel/length):0;
      return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)};
    }
    travel-=length;
  }
}
export function setRoute(s,lineId,stops) {
  const line=s.lines.find(v=>v.id===lineId);
  if(s.planning&&s.planning.phase!=='building')return result(false,'模擬開始後，站點與路線已鎖定。');
  if (s.gameOver) return result(false,'本局已結束，請重新開始。');
  if (!line || line.id>=s.unlocked) return result(false,'這條路線尚未解鎖。');
  if (!Array.isArray(stops) || stops.some(id=>!Number.isInteger(id)||id<0||!station(s,id))) return result(false,'路線包含無效的車站。');
  if (stops.length===1) return result(false,'至少連接兩個車站。');
  const loop=stops.length>2 && stops[0]===stops.at(-1), unique=loop?stops.slice(0,-1):stops;
  if (new Set(unique).size!==unique.length || (loop && unique.length<3)) return result(false,'車站不能重複；環線需至少三站。');
  const proposed={...s,lines:s.lines.map(v=>v===line?{...line,stops}:v)};
  const used=s.bugMode?0:tunnelsUsed(proposed);
  if (!s.bugMode && used>s.depot.tunnels && used>tunnelsUsed(s)) return result(false,'跨河隧道不足，請調整路線或等待每週補給。');
  if (!s.bugMode && stops.length && !line.trains.length && !s.depot.trains) return result(false,'沒有可用列車，請先刪除閒置路線回收列車。');
  if (stops.length===line.stops.length && stops.every((id,i)=>id===line.stops[i])) return result(true,'路線沒有變更。');
  for (const train of line.trains) {
    const position=trainPosition(s,line,train);
    const nearest=line.stops.map(id=>station(s,id)).reduce((a,b)=>distance(a,position)<distance(b,position)?a:b);
    for (const passenger of train.passengers) {
      if (passenger.shape===nearest.shape) s.delivered++;
      else nearest.queue.push(passenger);
    }
    train.passengers=[];
  }
  line.stops=[...stops];
  if(s.planning)s.planning.revision++;
  if (!stops.length) {
    s.depot.trains+=line.trains.filter(t=>!t.bugTrain).length;
    s.depot.carriages+=line.trains.reduce((n,t)=>n+(t.capacity-6)/6-(t.bugCarriages||0),0);
    line.trains=[];
    s.notice='路線已刪除，列車與車廂已回收。';
  } else {
    if (!line.trains.length) {if(!s.bugMode)s.depot.trains--;line.trains.push({passengers:[],capacity:6,dir:1,bugTrain:s.bugMode});}
    line.trains.forEach((t,i)=>resetTrain(line,t,Math.floor(i*unique.length/line.trains.length)));
    s.notice=s.planning?`${line.name}已加入規劃，統一啟動後行駛。`:`${line.name}已更新，乘客會自動轉乘。`;
  }
  return result(true,s.notice);
}
export function addTrain(s,lineId) {
  if(s.planning&&s.planning.phase!=='building')return result(false,'模擬開始後，車輛配置已鎖定。');
  const line=s.lines.find(v=>v.id===lineId);
  if (s.gameOver || !line || line.id>=s.unlocked || line.stops.length<2) return result(false,'請先建立一條路線。');
  if (!s.bugMode && s.depot.trains<1) return result(false,'沒有可用列車。');
  const train={passengers:[],capacity:6,dir:line.trains.length%2?-1:1,bugTrain:s.bugMode};
  resetTrain(line,train,Math.floor(nodes(line).length/2));
  line.trains.push(train);if(!s.bugMode)s.depot.trains--;
  s.notice=`${line.name}增加一輛列車。`;
  return result(true,s.notice);
}
export function addCarriage(s,lineId) {
  if(s.planning&&s.planning.phase!=='building')return result(false,'模擬開始後，車輛配置已鎖定。');
  const line=s.lines.find(v=>v.id===lineId);
  if (s.gameOver || !line || !line.trains.length) return result(false,'請先建立一條路線。');
  if (!s.bugMode && s.depot.carriages<1) return result(false,'沒有可用車廂。');
  const train=line.trains.reduce((a,b)=>a.capacity<=b.capacity?a:b);
  train.capacity+=6;
  if (s.bugMode) train.bugCarriages=(train.bugCarriages||0)+1;
  else s.depot.carriages--;
  s.notice=`${line.name}列車容量增加 6 人。`;
  return result(true,s.notice);
}
export function chooseUpgrade(s,kind) {
  if (!s.upgrade || s.gameOver) return result(false,'目前沒有待領取的每週補給。');
  if (!['line','carriage','tunnel'].includes(kind)) return result(false,'請選擇有效的補給。');
  if (kind==='line' && s.unlocked>=s.lines.length) return result(false,'全部路線都已解鎖，請選擇其他補給。');
  if (kind==='line') s.unlocked++;
  if (kind==='carriage') s.depot.carriages++;
  if (kind==='tunnel') s.depot.tunnels+=2;
  s.upgrade=false;s.notice='補給已到站，城市繼續運轉。';
  return result(true,s.notice);
}
function graph(s) {
  const edges=new Map(s.stations.map(v=>[v.id,new Map()]));
  const add=(a,b,cost)=>edges.get(a).set(b,Math.min(edges.get(a).get(b)??Infinity,cost));
  for (const line of s.lines) for (let i=1;i<line.stops.length;i++) {
    const a=line.stops[i-1],b=line.stops[i],cost=lengthOf(routePoints(s,[a,b]));
    if (!isLoop(line) || line.trains.some(t=>t.dir>0)) add(a,b,cost);
    if (!isLoop(line) || line.trains.some(t=>t.dir<0)) add(b,a,cost);
  }
  return edges;
}
// shortcut: routing compares track distance only; add wait-time estimates when scheduling becomes a gameplay goal.
function shortest(s,from,shape,edges=graph(s)) {
  if (!edges.has(from)) return {path:[],cost:Infinity};
  const costs=new Map([[from,0]]),previous=new Map(),pending=new Set(edges.keys());
  while (pending.size) {
    let current=null,best=Infinity;
    for (const id of pending) if ((costs.get(id)??Infinity)<best) {current=id;best=costs.get(id);}
    if (current===null) break;
    if (station(s,current).shape===shape) {
      const path=[current];while(previous.has(path[0]))path.unshift(previous.get(path[0]));
      return {path,cost:best};
    }
    pending.delete(current);
    for (const [next,cost] of edges.get(current)) if (best+cost<(costs.get(next)??Infinity)-EPS) {
      costs.set(next,best+cost);previous.set(next,current);
    }
  }
  return {path:[],cost:Infinity};
}
export function pathTo(s,fromId,shape) { return shortest(s,fromId,shape).path; }
function serve(s,line,train) {
  const ids=nodes(line), stop=station(s,ids[train.from]), next=ids[train.to], edges=graph(s);
  const edge=lengthOf(edgePoints(s,line,train)), useful=new Map();
  const wantsNext=shape=>{
    if (!useful.has(shape)) {
      const here=shortest(s,stop.id,shape,edges).cost, there=shortest(s,next,shape,edges).cost;
      useful.set(shape,Number.isFinite(here) && edge+there<=here+.001);
    }
    return useful.get(shape);
  };
  const aboard=[];
  for (const p of train.passengers) {
    if (p.shape===stop.shape) s.delivered++;
    else if (wantsNext(p.shape)) aboard.push(p);
    else stop.queue.push(p);
  }
  train.passengers=aboard;
  stop.queue=stop.queue.filter(p=>{
    if (p.shape===stop.shape) {s.delivered++;return false;}
    if (train.passengers.length<train.capacity && wantsNext(p.shape)) {train.passengers.push(p);return false;}
    return true;
  });
}
function moveTrain(s,line,train,dt) {
  if (!train.serviced) {serve(s,line,train);train.serviced=true;}
  while (dt>EPS) {
    if (train.dwell>0) {const used=Math.min(dt,train.dwell);train.dwell-=used;dt-=used;if(dt<=EPS)break;}
    const length=lengthOf(edgePoints(s,line,train)),seconds=length*(1-train.progress)/SPEED;
    if (dt<seconds) {train.progress+=dt*SPEED/length;break;}
    dt-=seconds;train.from=train.to;train.to=nextIndex(line,train.from,train);train.progress=0;train.dwell=DWELL;
    serve(s,line,train);
  }
}
function riverX(y) {
  const i=RIVER.findIndex((p,index)=>index>0 && p.y>=y), a=RIVER[i-1], b=RIVER[i];
  return a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);
}
export function generatedStationCount(s){return s.stations.filter(stop=>stop.generated).length;}
function grow(s) {
  if(s.city&&s.stations.length<s.city.stations.length){const p=s.city.stations[s.stations.length],shape=SHAPES[Math.floor(random(s)*5)];s.stations.push({...makeStation(s,p.x,p.y,shape),name:p.name,catalogId:p.id,real:!s.city.fictional&&!p.planned,planned:!!p.planned,artificial:!!s.city.fictional,source:p.source||p.wikidata});s.notice=`新站開放：${p.name}`;return;}
  if(s.mode==='campaign'&&s.city)return;
  if(s.mode==='endless'){
    const planned=generatedStationCount(s);
    if(!s.plannedGrowth||planned>=50)return;
    let p;
    for(let attempt=0;attempt<200;attempt++){
      const x=80+random(s)*(s.world.width-160),y=100+random(s)*(s.world.height-200);
      const land=!s.city?Math.abs(x-riverX(y))>=48:pointInLand(s.city,x,y)||s.expansions.some(r=>x>r.x&&x<r.x+r.width&&y>r.y&&y<r.y+r.height);
      if(land&&!s.stations.some(v=>distance(v,{x,y})<40)){p={x,y};break;}
    }
    if(!p){if(s.city?.fictional)return;const x=s.world.width;s.world.width+=280;s.expansions.push({x:x+20,y:50,width:240,height:s.world.height-100});p={x:x+140,y:150+random(s)*(s.world.height-300)};}
    const name=s.city?.fictional?s.city.stations[Math.floor(random(s)*s.city.stations.length)].name:String(planned+1);
    s.stations.push({...makeStation(s,p.x,p.y,SHAPES[Math.floor(random(s)*5)]),name,real:false,generated:true,artificial:!!s.city?.fictional});s.notice=`新站 ${name} 開放。`;return;
  }
  if (s.stations.length>=22) return;
  for (let attempt=0;attempt<100;attempt++) {
    const x=80+random(s)*940,y=100+random(s)*500;
    if (Math.abs(x-riverX(y))<48 || s.stations.some(p=>distance(p,{x,y})<90)) continue;
    const available=s.stations.length>=10?5:s.stations.length>=5?4:3;
    const shape=SHAPES[Math.floor(random(s)*available)];
    s.stations.push(makeStation(s,x,y,shape));s.notice='城市擴張：有新車站需要接上路線。';return;
  }
}
export function advance(s,dt) {
  if (!Number.isFinite(dt) || dt<=0 || s.gameOver || s.upgrade || s.won) return;
  const planning=s.planning;
  let remaining=dt;
  while (remaining>EPS && !s.gameOver && !s.upgrade && !s.won) {
    if(planning?.phase==='building'){
      const used=Math.min(remaining,planning.limit-planning.elapsed);planning.elapsed+=used;remaining-=used;
      if(planning.elapsed>=planning.limit-EPS)launchPlanning(s,true);
      continue;
    }
    const step=Math.min(.1,remaining,planning?planning.runStart+planning.duration-s.time:Infinity,Math.max(0,s.nextWeek-s.time));
    if (step>EPS) {
      s.time+=step;remaining-=step;
      if (s.time+EPS>=s.nextGrowth) {grow(s);s.nextGrowth+=s.city?.growth||18;}
      const shapesPresent=[...new Set(s.stations.map(p=>p.shape))];
      for (const stop of s.stations) {
        stop.age+=step;stop.nextPassenger-=step;
        while (stop.nextPassenger<=0) {
          const shapes=shapesPresent.filter(shape=>shape!==stop.shape);
          if (shapes.length){stop.queue.push({shape:shapes[Math.floor(random(s)*shapes.length)]});if(planning)planning.generated++;}
          stop.nextPassenger+=Math.max(2.2,6.2-s.time/120)+random(s)*2;
        }
      }
      for (const line of s.lines) for (const train of line.trains) moveTrain(s,line,train,step);
      for (const stop of s.stations) {
        stop.crowd=Math.max(0,stop.crowd+(stop.queue.length>6?step:-step*.8));
        if (stop.crowd>=26-EPS&&s.mode!=='endless'&&!planning) {s.gameOver=true;s.notice='車站過度擁擠，城市運輸已停止。';}
      }
      if(!s.gameOver&&missionProgress(s).complete){s.won=true;s.notice='關卡目標達成！';}
    }
    if(planning&&s.time>=planning.runStart+planning.duration-EPS){
      s.time=planning.runStart+planning.duration;planning.result={...planningProgress(s),round:planning.round,delivered:s.delivered,generated:planning.generated,stations:s.stations.length};
      planning.round++;planning.phase='building';planning.elapsed=0;s.notice=`10 秒運行完成，開始第 ${planning.round} 輪 5 分鐘規劃。`;
    }
    if (!s.gameOver && !s.won && s.time+EPS>=s.nextWeek) {
      s.time=s.nextWeek;s.nextWeek+=70;s.week++;s.depot.trains++;
      if(s.mode==='endless'){s.depot.carriages++;s.depot.tunnels+=2;s.unlocked=Math.min(s.lines.length,s.unlocked+1);s.notice='無盡每週補給自動入庫：列車、車廂與隧道。';}
      else{s.upgrade=true;s.notice='每週補給：獲得一輛列車，再選擇一項升級。';}
    }
  }
}
