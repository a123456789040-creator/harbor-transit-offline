import {joinRailPaths,railPathLength,samplePath} from './rail-path.mjs';
export {samplePath,railPathLength};
export function effectiveOpening(item){const value=item.opened||item.date;if(!value)return null;return item.openingPrecision==='year'||item.precision==='year'||/^\d{4}$/.test(value)?`${value.slice(0,4)}-12-31`:value;}
export function formatOpening(item){if(item.historyOmitted)return '公開版未附通車日期';if(item.planned)return item.targetOpening||'通車時程未定';const value=item.opened||item.date;if(!value)return '開通日期待核對';return item.openingPrecision==='year'||item.precision==='year'||/^\d{4}$/.test(value)?`${value.slice(0,4)} 年（年度資料）`:value;}
export function routeBetween(legs,stops){
  const adjacent=new Map();for(const leg of legs){if(leg.from==null||leg.to==null)continue;for(const [a,b,reverse] of [[leg.from,leg.to,false],[leg.to,leg.from,true]]){if(!adjacent.has(a))adjacent.set(a,[]);adjacent.get(a).push({to:b,leg,reverse,length:railPathLength(leg.points)});}}
  const parts=[],legIds=[],stopDistances=[0];let travelled=0;
  for(let n=1;n<stops.length;n++){
    const from=stops[n-1],to=stops[n],queue=[{id:from,cost:0}],costs=new Map([[from,0]]),previous=new Map();
    while(queue.length){queue.sort((a,b)=>b.cost-a.cost);const node=queue.pop();if(node.cost!==costs.get(node.id))continue;if(node.id===to)break;
      for(const edge of adjacent.get(node.id)||[]){const cost=node.cost+edge.length;if(cost<(costs.get(edge.to)??Infinity)){costs.set(edge.to,cost);previous.set(edge.to,{from:node.id,...edge});queue.push({id:edge.to,cost});}}
    }
    if(!costs.has(to))return null;const chosen=[];for(let id=to;id!==from;){const edge=previous.get(id);if(!edge)return null;chosen.unshift(edge);id=edge.from;}
    for(const edge of chosen){parts.push(edge.reverse?[...edge.leg.points].reverse():edge.leg.points);legIds.push(edge.leg.id);travelled+=edge.length;}stopDistances.push(travelled);
  }
  return {...joinRailPaths(parts),legIds,stopFractions:stopDistances.map(d=>travelled?d/travelled:0)};
}
function geometryServices(legs,lines){
  const services=[],key=p=>p.map(v=>v.toFixed(3)).join(',');
  for(const line of lines){
    const selected=legs.filter(leg=>leg.lineId===line.id),endpoints=new Map();
    for(const leg of selected)for(const end of [leg.points[0],leg.points.at(-1)]){const id=key(end);if(!endpoints.has(id))endpoints.set(id,[]);endpoints.get(id).push(leg);}
    const remaining=new Set(selected),chains=[];
    while(remaining.size){const start=[...remaining].find(leg=>(endpoints.get(key(leg.points[0]))?.length!==2||endpoints.get(key(leg.points.at(-1)))?.length!==2))||remaining.values().next().value;
      let current=start,at=endpoints.get(key(start.points[0]))?.length!==2?key(start.points[0]):key(start.points.at(-1));const parts=[],ids=[];
      while(current&&remaining.has(current)){remaining.delete(current);const forward=key(current.points[0])===at,points=forward?current.points:[...current.points].reverse();parts.push(points);ids.push(current.id);at=key(points.at(-1));const next=endpoints.get(at)||[];current=next.length===2?next.find(leg=>remaining.has(leg)):null;}
      const joined=joinRailPaths(parts),length=railPathLength(joined.path);if(length)chains.push({...joined,length,legIds:ids});
    }
    const longest=chains.sort((a,b)=>b.length-a.length)[0];
    if(longest)services.push({id:`geometry-${line.id}`,name:line.name,color:line.color,lineIds:[line.id],stops:['已開通線位起點','已開通線位終點'],...longest,stopFractions:[0,1],kind:'geometry-display',source:line.source||selected[0]?.source,note:'沿已開通的真實線位展示動態；不是當年完整交路、停靠站或實際時刻表。'});
  }
  return services;
}
export function createHistoryModel(data,city){
  const metadata=data.metadata,stations=data.stations.map(s=>({...s,lineIds:[...new Set(s.lineIds||[])]})),byId=new Map(stations.map(s=>[s.id,s]));
  const lines=data.lines.map(line=>({...line})),legs=data.legs.filter(leg=>leg.points?.length>=2).map(leg=>({...leg,color:leg.color||lines.find(line=>line.id===leg.lineId)?.color||'#617784'}));
  const eventMap=new Map();
  for(const event of data.events||[]){const date=effectiveOpening(event);if(date&&date<=metadata.verifiedOn)eventMap.set(date,{...event,date});}
  for(const item of [...stations,...legs]){const date=effectiveOpening(item);if(date&&date<=metadata.verifiedOn&&!eventMap.has(date))eventMap.set(date,{date,precision:item.openingPrecision,title:item.openingPrecision==='year'?`${date.slice(0,4)} 年車站／路段開通`:'車站／路段開通',source:item.openingSource||item.source,note:'依來源記錄中的現存車站與路段開通時間彙整。'});}
  const events=[...eventMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const network={stations,lines,legs,events,metadata,gaps:data.gaps||[]};
  const snapshots=new Map(),serviceCache=new Map();
  function snapshotAt(date=metadata.verifiedOn){
    if(snapshots.has(date))return snapshots.get(date);const current=date>=metadata.verifiedOn;
    const visible=item=>{const opened=effectiveOpening(item);return opened?opened<=date:current;};
    const activeLegs=legs.filter(visible),activeStations=stations.filter(visible),lineIds=new Set([...activeLegs.map(leg=>leg.lineId),...activeStations.flatMap(station=>station.lineIds)]);
    const result={date,stations:activeStations,legs:activeLegs,lines:lines.filter(line=>lineIds.has(line.id)),events:events.filter(event=>event.date<=date),gaps:network.gaps};snapshots.set(date,result);return result;
  }
  function servicesAt(date=metadata.verifiedOn){
    if(serviceCache.has(date))return serviceCache.get(date);const active=snapshotAt(date),result=[];
    for(const service of data.services||[]){
      if((service.from||metadata.verifiedOn)>date||service.until&&date>=service.until)continue;
      const allowed=active.legs.filter(leg=>(service.lineIds||[service.lineId]).includes(leg.lineId));
      let joined;
      if(service.paths?.length)joined=joinRailPaths(service.paths);
      else if(service.path?.length){joined=joinRailPaths([service.path]);if(service.pathBreaks?.length){Object.defineProperty(joined.path,'breaks',{value:service.pathBreaks,configurable:true});}}
      else joined=routeBetween(allowed,service.stops||[]);
      if(!joined?.path.length)continue;const length=railPathLength(joined.path);if(!length)continue;
      result.push({...service,...joined,length,stationIds:service.stops||[],stops:(service.stops||[]).map(id=>byId.get(id)?.name||String(id)),color:service.color||lines.find(line=>line.id===(service.lineId||service.lineIds?.[0]))?.color||'#617784',stopFractions:service.stopFractions||joined.stopFractions||[0,1]});
    }
    const covered=new Set(result.flatMap(service=>service.lineIds||[service.lineId]));result.push(...geometryServices(active.legs,active.lines.filter(line=>!covered.has(line.id))));
    serviceCache.set(date,result);return result;
  }
  return {cityId:metadata.id,city,metadata,network,events,ridership:data.ridership||{},operationEras:data.operationEras||[],snapshotAt,servicesAt,samplePath};
}
