import {TAIPEI_GEOGRAPHY as city} from './taipei-geography.mjs';
import {RAIL_GEOMETRY,RAIL_SOURCES} from './taipei-rail-data.mjs';
import {HISTORY_LINES,HISTORY_EVENTS,HISTORY_ALIASES,HISTORY_OPERATION_ERAS,HISTORY_METADATA,CURRENT_SERVICES} from './taipei-history-data.mjs';

const gaps=[];
const normal=name=>name.normalize('NFKC').replace(/臺/g,'台').replace(/_[A-Z]+\d+[A-Za-z]?$/,'').replace(/\([^)]*\)/g,'').replace(/站$/,'').replace(/[\s/／・·-]/g,'');
const catalog=city.stations.map((s,index)=>({...s,index,lineIds:[],opened:null}));
const byName=new Map(catalog.map(s=>[normal(s.name),s]));
for(const [name,aliases] of Object.entries(HISTORY_ALIASES))for(const alias of aliases){const station=byName.get(normal(name));if(station)byName.set(normal(alias),station);}
const stationNamed=name=>byName.get(normal(name));
for(const line of HISTORY_LINES)for(const name of line.stops){const station=stationNamed(name);if(station&&station.name!==name){station.originalName??=station.name;station.name=name;}}
const [west,south,east,north]=city.bbox;
const project=([lon,lat])=>[(lon-west)/(east-west)*1100,(north-lat)/(north-south)*700];
const metres=([lon,lat])=>[lon*100800,lat*111100];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

// These merged station complexes have distant platforms; anchors are official MRT station SHP points, dataset 73233.
const platformAnchors={
  'A:台北車站':{point:[121.51432776303326,25.04873111182639],sourceId:'A0000014788'},
  'A:三重':{point:[121.48280943567262,25.05469480742886],sourceId:'F0000008677'},
  'Y:板橋':{point:[121.46461158348343,25.01517684948058],sourceId:'F0000012498'},
};
const graphs=new Map();
function makeGraph(base){
  const nodes=[],segments=[],buckets=new Map(),stationNodes=new Map();
  function node(point){
    // The only cross-source gap is the documented 23m Xiangshan junction; weld it without adding a connector edge.
    if(base==='R'&&distance(metres(point),metres([121.570667,25.032801]))<.2)point=[121.570885,25.032864];
    const p=metres(point),bx=Math.floor(p[0]/.2),by=Math.floor(p[1]/.2);
    for(let x=bx-1;x<=bx+1;x++)for(let y=by-1;y<=by+1;y++)for(const i of buckets.get(`${x}:${y}`)||[])if(distance(nodes[i].p,p)<.2)return i;
    const id=nodes.length;nodes.push({point,p,links:new Map()});const key=`${bx}:${by}`;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);return id;
  }
  for(const path of RAIL_GEOMETRY[base].paths)for(let i=1;i<path.length;i++){
    const a=node(path[i-1]),b=node(path[i]);if(a!==b)segments.push({a,b,cuts:[]});
  }
  function addStation(station){
    if(stationNodes.has(station.id))return;
    const anchor=platformAnchors[`${base}:${station.name.replace(/臺/g,'台')}`],target=metres(anchor?.point||[station.lon,station.lat]);let best;
    for(const segment of segments){
      const a=nodes[segment.a].p,b=nodes[segment.b].p,dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((target[0]-a[0])*dx+(target[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
      const p=[a[0]+t*dx,a[1]+t*dy],d=distance(target,p);if(!best||d<best.d)best={segment,t,p,d};
    }
    if(!best||best.d>150){gaps.push({type:'station-projection',lineId:base,station:station.name,distanceMetres:best?.d,reason:'Station/platform is more than 150m from official GIS geometry.'});return;}
    const id=node([best.p[0]/100800,best.p[1]/111100]);best.segment.cuts.push({t:best.t,id});stationNodes.set(station.id,id);
    (station.platforms??=[]).push({lineId:base,point:project(nodes[id].point),distanceMetres:best.d,...(anchor?{source:'https://data.gov.tw/dataset/73233',sourceId:anchor.sourceId}:{})});
  }
  function connect(a,b){if(a===b)return;const length=distance(nodes[a].p,nodes[b].p);nodes[a].links.set(b,length);nodes[b].links.set(a,length);}
  function finish(){for(const segment of segments){const ordered=[{t:0,id:segment.a},...segment.cuts,{t:1,id:segment.b}].sort((a,b)=>a.t-b.t);for(let i=1;i<ordered.length;i++)connect(ordered[i-1].id,ordered[i].id);}}
  return {nodes,stationNodes,addStation,finish};
}
const lines=HISTORY_LINES.map(line=>{
  const base=line.id.split('-')[0],stations=line.stops.map(name=>{const station=stationNamed(name);if(!station)gaps.push({type:'station-name',lineId:line.id,name});return station;});
  if(!graphs.has(base))graphs.set(base,makeGraph(base));
  for(const station of stations.filter(Boolean)){graphs.get(base).addStation(station);station.lineIds.push(line.id);}
  return {...line,stops:[...line.stops],stationIds:stations.map(s=>s?.id),base};
});
for(const graph of graphs.values())graph.finish();

function shortest(adjacency,from,to){
  if(from===undefined||to===undefined)return null;
  const costs=new Map([[from,0]]),previous=new Map(),queue=[from],done=new Set();
  while(queue.length){
    let best=0;for(let i=1;i<queue.length;i++)if(costs.get(queue[i])<costs.get(queue[best]))best=i;
    const current=queue.splice(best,1)[0];if(current===to){const result=[to];while(previous.has(result[0]))result.unshift(previous.get(result[0]));return result;}
    done.add(current);
    for(const [next,length] of adjacency(current)){
      if(done.has(next))continue;const cost=costs.get(current)+length;if(cost>=(costs.get(next)??Infinity))continue;
      if(!costs.has(next))queue.push(next);costs.set(next,cost);previous.set(next,current);
    }
  }
  return null;
}
function lengthOf(path){let total=0;for(let i=1;i<path.length;i++)total+=distance(path[i-1],path[i]);return total;}
const legs=[];
for(const line of lines){
  const graph=graphs.get(line.base);
  for(let i=1;i<line.stationIds.length;i++){
    const from=line.stationIds[i-1],to=line.stationIds[i],route=shortest(id=>graph.nodes[id].links,graph.stationNodes.get(from),graph.stationNodes.get(to));
    if(!route){gaps.push({type:'unconnected-leg',lineId:line.id,from:line.stops[i-1],to:line.stops[i]});continue;}
    const coordinates=route.map(id=>graph.nodes[id].point),points=coordinates.map(project);
    legs.push({id:`${line.id}:${i-1}`,lineId:line.id,from,to,fromName:line.stops[i-1],toName:line.stops[i],points,length:lengthOf(points),lengthMetres:lengthOf(coordinates.map(metres)),opened:null,color:line.color,source:line.source,geometrySources:RAIL_GEOMETRY[line.base].source});
  }
}
for(const event of HISTORY_EVENTS)for(const section of event.sections){
  const line=lines.find(l=>l.id===section.lineId),a=stationNamed(section.from)?.id,b=stationNamed(section.to)?.id;
  const start=line?.stationIds.indexOf(a)??-1,end=line?.stationIds.indexOf(b)??-1;
  if(start<0||end<0){gaps.push({type:'opening-section',date:event.date,...section});continue;}
  for(let i=Math.min(start,end);i<Math.max(start,end);i++){
    const leg=legs.find(l=>l.id===`${line.id}:${i}`);if(leg&&(!leg.opened||event.date<leg.opened)){leg.opened=event.date;leg.openingSource=event.source;}
  }
}
for(const leg of legs){
  if(!leg.opened){gaps.push({type:'missing-opening',lineId:leg.lineId,from:leg.fromName,to:leg.toName});continue;}
  for(const id of [leg.from,leg.to]){const station=catalog.find(s=>s.id===id);if(!station.opened||leg.opened<station.opened)station.opened=leg.opened;}
}
for(const station of catalog)if(!station.opened)gaps.push({type:'unserved-station',station:station.name,id:station.id});
export const HISTORY_NETWORK={stations:catalog,lines,legs,events:HISTORY_EVENTS.map(e=>({...e,sections:e.sections.map(s=>({...s}))})),gaps,metadata:HISTORY_METADATA,geometrySources:RAIL_SOURCES};

export function snapshotAt(date=HISTORY_METADATA.verifiedOn){
  const active=legs.filter(l=>l.opened&&l.opened<=date),ids=new Set(active.flatMap(l=>[l.from,l.to]));
  return {date,stations:catalog.filter(s=>ids.has(s.id)),legs:active,lines:lines.flatMap(line=>{
    const selected=active.filter(l=>l.lineId===line.id);if(!selected.length)return [];
    const present=new Set(selected.flatMap(l=>[l.from,l.to]));
    return [{...line,stops:line.stops.filter((_,i)=>present.has(line.stationIds[i])),stationIds:line.stationIds.filter(id=>present.has(id)),legs:selected}];
  }),events:HISTORY_NETWORK.events.filter(e=>e.date<=date),gaps};
}

const serviceCache=new Map();
export function servicesAt(date=HISTORY_METADATA.verifiedOn){
  const era=HISTORY_OPERATION_ERAS.find(e=>e.from<=date&&(!e.until||date<e.until));if(!era)return [];
  const current=date>=HISTORY_METADATA.verifiedOn,cacheKey=current?'current':era.from;
  if(serviceCache.has(cacheKey))return serviceCache.get(cacheKey);
  const active=snapshotAt(date).legs,result=[];
  for(const service of current?CURRENT_SERVICES:era.services){
    const allowed=active.filter(l=>!service.lineIds||service.lineIds.includes(l.lineId)),adjacency=new Map();
    for(const leg of allowed)for(const [from,to] of [[leg.from,leg.to],[leg.to,leg.from]]){if(!adjacency.has(from))adjacency.set(from,new Map());const old=adjacency.get(from).get(to);if(!old||leg.length<old.length)adjacency.get(from).set(to,leg);}
    const chosen=[],stopDistances=[0];let complete=true,travelled=0;
    for(let i=1;i<service.stops.length;i++){
      const from=stationNamed(service.stops[i-1])?.id,to=stationNamed(service.stops[i])?.id;
      const route=shortest(id=>[...(adjacency.get(id)||[])].map(([next,leg])=>[next,leg.length]),from,to);
      if(!route){complete=false;break;}
      for(let n=1;n<route.length;n++){const leg=adjacency.get(route[n-1]).get(route[n]);chosen.push({leg,points:leg.from===route[n-1]?leg.points:[...leg.points].reverse()});travelled+=leg.length;}
      stopDistances.push(travelled);
    }
    if(!complete||!chosen.length)continue;
    const paths=[];
    for(const item of chosen){const last=paths.at(-1);if(last&&distance(last.at(-1),item.points[0])<1e-7)last.push(...item.points.slice(1));else paths.push([...item.points]);}
    const path=[],breaks=[];for(const part of paths){if(path.length)breaks.push(path.length);path.push(...part);}
    // Separate platform alignments are real GIS breaks, not drawn connectors; sampling skips their tiny station jumps.
    Object.defineProperty(path,'breaks',{value:breaks});
    result.push({...service,stops:[...service.stops],name:service.name||`${service.stops[0]}—${service.stops.at(-1)}`,path,paths,pathBreaks:breaks,length:travelled,lengthMetres:chosen.reduce((sum,x)=>sum+x.leg.lengthMetres,0),legIds:chosen.map(x=>x.leg.id),stationIds:service.stops.map(name=>stationNamed(name)?.id),stopFractions:stopDistances.map(d=>d/travelled),eraFrom:era.from,description:era.description,source:service.source||era.source});
  }
  serviceCache.set(cacheKey,result);return result;
}

export {samplePath} from './rail-path.mjs';
