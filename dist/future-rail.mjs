import {FUTURE_RAIL_DATA} from './future-rail-data.mjs';
import {getCity} from './cities.mjs';
import {routeBetween,railPathLength} from './history-model.mjs';

const statusLabel={construction:'施工中',approved:'已核定',planning:'規劃中',study:'研究構想'};
const dateFor=project=>project.opening.year?`${project.opening.year}-12-31`:'9999-12-31';
const shiftPath=(points,dx,dy)=>{const path=points.map(([x,y])=>[x+dx,y+dy]);if(points.breaks)Object.defineProperty(path,'breaks',{value:points.breaks});return path;};
export function withFutureRail(base){
  const raw=FUTURE_RAIL_DATA[base.cityId];if(!raw?.projects.length)return base;
  const [west,south,east,north]=base.city.bbox,project=stop=>[1100*(stop.lon-west)/(east-west),700*(north-stop.lat)/(north-south)];
  const points=raw.projects.flatMap(p=>p.stops.map(project)),dx=Math.max(0,20-Math.min(20,...points.map(p=>p[0]))),dy=Math.max(0,20-Math.min(20,...points.map(p=>p[1])));
  const world={width:Math.ceil(Math.max(1100,...points.map(p=>p[0]+20))+dx),height:Math.ceil(Math.max(700,...points.map(p=>p[1]+20))+dy)};
  const shiftStation=s=>({...s,x:s.x+dx,y:s.y+dy,lineIds:[...(s.lineIds||[])]}),shiftLeg=l=>({...l,points:shiftPath(l.points,dx,dy)});
  const stations=base.network.stations.map(shiftStation),byId=new Map(stations.map(s=>[s.id,s])),newStations=[],lines=[],legs=[],projects=[];
  for(const p of [...raw.projects].sort((a,b)=>dateFor(a).localeCompare(dateFor(b)))){
    const lineId=`future:${base.cityId}:${p.id}`,date=dateFor(p),ids=[];
    for(const stop of p.stops){
      const [x,y]=project(stop),point={x:x+dx,y:y+dy};
      let station=byId.get(stop.existingId)||stations.find(s=>s.name===stop.name&&Math.hypot(s.x-point.x,s.y-point.y)<10);
      if(!station)station=newStations.find(s=>(stop.code&&s.code===stop.code||s.name===stop.name)&&Math.hypot(s.x-point.x,s.y-point.y)<5);
      if(!station){station={...stop,...point,id:`future-station:${base.cityId}:${newStations.length+1}`,lineIds:[],planned:true,plannedDate:date,targetOpening:p.opening.label,source:p.opening.source,openingSource:p.opening.source,projectName:p.name};newStations.push(station);byId.set(station.id,station);}
      if(!station.lineIds.includes(lineId))station.lineIds.push(lineId);ids.push(station.id);
    }
    const color=p.colorSource?p.color:'#84939b';
    const line={id:lineId,name:`${p.name}（規劃）`,operator:p.operator,color,planned:true,targetOpening:p.opening.label,status:p.status,source:p.opening.source,colorNote:p.colorSource?'依官方計畫／既有路線色':'官方線色未核實，採中性灰'};lines.push(line);
    const projectLegs=[];
    for(let i=1;i<ids.length;i++){if(ids[i]===ids[i-1])continue;const a=byId.get(ids[i-1]),b=byId.get(ids[i]);const leg={id:`${lineId}:${i}`,lineId,from:a.id,to:b.id,points:[[a.x,a.y],[b.x,b.y]],color,planned:true,plannedDate:date,targetOpening:p.opening.label,source:p.opening.source,geometryPrecision:'planning-schematic'};legs.push(leg);projectLegs.push(leg);}
    const route=routeBetween(projectLegs,ids);
    projects.push({...p,lineId,date,stationIds:ids,route});
  }
  const allStations=[...stations,...newStations],allLines=[...base.network.lines,...lines],allLegs=[...base.network.legs.map(shiftLeg),...legs],groups=new Map();
  for(const p of projects){if(!groups.has(p.date))groups.set(p.date,[]);groups.get(p.date).push(p);}
  const futureEvents=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>({date,planned:true,targetOpening:date.startsWith('9999')?'尚未定期的規劃':items.length===1?items[0].opening.label:`${date.slice(0,4)} 年目標計畫（各案時程詳列）`,title:items.map(p=>p.name).join('／'),source:items[0].opening.source,note:items.map(p=>`${p.name}：${p.opening.label}；${statusLabel[p.status]}。${p.opening.note||''}`).join(' ')+' 此為預期時程與規劃示意，不是已通車實績；站間虛線不是精確工程線位。'}));
  const geo={...base.city,world,coverageRect:{x:dx,y:dy,width:1100,height:700}};
  if(dx||dy){for(const key of ['land','water','parks'])geo[key]=base.city[key].map(poly=>poly.map(ring=>shiftPath(ring,dx,dy)));for(const key of ['rivers','waterways'])geo[key]=base.city[key].map(path=>shiftPath(path,dx,dy));geo.roads=Object.fromEntries(Object.entries(base.city.roads).map(([key,paths])=>[key,paths.map(path=>shiftPath(path,dx,dy))]));}
  const city={...getCity(base.cityId),...geo,stations:[...getCity(base.cityId).stations.map(shiftStation),...newStations]};
  const snapshotAt=(date=base.metadata.verifiedOn)=>{
    const actual=base.snapshotAt(date>base.metadata.verifiedOn?base.metadata.verifiedOn:date),active=new Set(projects.filter(p=>p.date<=date).map(p=>p.lineId));
    const visibleStations=[...actual.stations.map(s=>({...shiftStation(s),lineIds:[...(s.lineIds||[]),...(byId.get(s.id)?.lineIds||[]).filter(id=>active.has(id))]})),...newStations.filter(s=>s.plannedDate<=date).map(s=>({...s,lineIds:s.lineIds.filter(id=>active.has(id))}))];
    return {...actual,date,stations:visibleStations,legs:[...actual.legs.map(shiftLeg),...legs.filter(l=>active.has(l.lineId))],lines:[...actual.lines,...lines.filter(l=>active.has(l.id))]};
  };
  const servicesAt=(date=base.metadata.verifiedOn)=>{
    const actual=base.servicesAt(date>base.metadata.verifiedOn?base.metadata.verifiedOn:date).map(s=>({...s,path:shiftPath(s.path,dx,dy)}));
    return [...actual,...projects.filter(p=>p.date<=date&&p.route&&railPathLength(p.route.path)>0).map(p=>({...p.route,id:`planned-service:${p.id}`,name:`${p.name}（規劃示意）`,lineId:p.lineId,lineIds:[p.lineId],stationIds:p.stationIds,stops:p.stationIds.map(id=>byId.get(id).name),color:lines.find(l=>l.id===p.lineId).color,length:railPathLength(p.route.path),kind:'planned-display',source:p.opening.source,note:`${p.opening.label}。未來運行示意；不是官方班表或預測運量。`}))];
  };
  return {...base,city,network:{...base.network,stations:allStations,lines:allLines,legs:allLegs},snapshotAt,servicesAt,future:{...raw,projects,events:futureEvents,horizon:futureEvents.at(-1).date,newStations:newStations.length}};
}
