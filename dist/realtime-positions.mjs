import {createRouteResolver,freshTimestamp,locateRun,sampleRoute} from './realtime-model.mjs';
import {TAIPEI_TRAVEL_TIMES,HONGKONG_LIVE} from './realtime-hk-taipei-data.mjs';
export function createLivePositions(model,schedule){
  const resolve=createRouteResolver(model),stations=new Map(model.network.stations.map(s=>[s.id,s])),tripPatterns=new Map();
  if(schedule?.city==='newyork')for(const [pattern,,,id] of schedule.trips)tripPatterns.set(id.split('_').slice(-2).join('_'),schedule.patterns[pattern]);
  const taipeiRoutes=TAIPEI_TRAVEL_TIMES.routes.flatMap(r=>[r,{...r,stationIds:[...r.stationIds].reverse(),arrivalOffsets:[...r.arrivalOffsets].reverse().map((_,i)=>r.arrivalOffsets.at(-1)-(r.departureOffsets.at(-1-i)??r.arrivalOffsets.at(-1-i))),departureOffsets:[...r.arrivalOffsets].reverse().map(s=>r.arrivalOffsets.at(-1)-s)}]);
  return {
    mta(packet,now){
      if(!schedule?.gtfsStops)return [];
      return (packet?.feeds||[]).filter(f=>freshTimestamp(f.timestamp*1000,now,60000)).flatMap(feed=>feed.vehicles.flatMap(v=>{
        const stationId=schedule.stations[schedule.gtfsStops[v.stopId]],station=stations.get(stationId);if(!station)return [];
        const p=tripPatterns.get(v.tripId),ids=p?.stops.map(i=>schedule.stations[i]),index=ids?.indexOf(stationId),route=index>=0&&resolve(p.lineId,ids,p.historyServiceId);
        const previous=index>0?index-1:index,atStation=v.status===1,point=route?sampleRoute(route,atStation||previous===index?route.fractions[index]:(route.fractions[previous]+route.fractions[index])/2):station;
        return [{...point,id:`mta:${feed.id}:${v.id}`,lineId:v.routeId,stationIds:ids||[stationId],fromId:ids?.[previous]||stationId,toId:stationId,destination:p?.headsign||'',atStation,kind:'live-station-status',timestamp:feed.timestamp*1000,movementTimestamp:v.timestamp*1000,status:v.status,nextIn:null}];
      }));
    },
    taipei(events,now){
      return events.filter(e=>freshTimestamp(e.timestamp,now,90000)).map(e=>{
        const station=stations.get(e.stationId),candidates=taipeiRoutes.filter(r=>{const i=r.stationIds.indexOf(e.stationId),d=r.stationIds.indexOf(e.destinationId);return i>=0&&d>i;}).sort((a,b)=>(a.stationIds.at(-1)===e.destinationId?-1:0)-(b.stationIds.at(-1)===e.destinationId?-1:0));
        const r=candidates[0],index=r?.stationIds.indexOf(e.stationId),lineId=r?.lineIds[0]||station.lineIds[0];
        if(!r)return {...station,...e,lineId,fromId:e.stationId,toId:e.stationId,atStation:true,nextIn:null};
        const elapsed=r.arrivalOffsets[index]+(now-e.timestamp)/1000,phase=locateRun(r.arrivalOffsets,r.departureOffsets.map((d,i)=>d??r.arrivalOffsets[i]),elapsed),route=resolve(lineId,r.stationIds);
        if(!phase||!route)return {...station,...e,lineId,fromId:e.stationId,toId:e.stationId,atStation:true,nextIn:null};
        const fraction=route.fractions[phase.from]+(route.fractions[phase.to]-route.fractions[phase.from])*phase.progress;
        return {...sampleRoute(route,fraction),...e,lineId,stationIds:r.stationIds,fromId:r.stationIds[phase.from],toId:r.stationIds[phase.to],atStation:phase.atStation,nextIn:Math.max(0,phase.nextAt-elapsed),kind:'live-entry-estimate'};
      });
    },
    hongkong(arrivals,now){
      const services=model.servicesAt(),seen=new Set();
      return arrivals.filter(r=>freshTimestamp(r.timestamp,now)&&r.arrival>=now-15000).filter(r=>{const key=`${r.lineId}:${r.stationId}:${r.direction}`;if(seen.has(key))return false;seen.add(key);return true;}).map(r=>{
        const station=stations.get(r.stationId),destinationId=HONGKONG_LIVE.stations.find(s=>s.lineId===r.lineId&&s.code===r.destinationCode)?.stationId;
        const service=services.find(s=>s.lineId===r.lineId&&s.stationIds?.includes(r.stationId)&&s.stationIds.includes(destinationId)&&(destinationId!==r.stationId||[s.stationIds[0],s.stationIds.at(-1)].includes(destinationId)));
        const ids=service&&(service.stationIds.indexOf(destinationId)<service.stationIds.indexOf(r.stationId)||destinationId===service.stationIds[0]?[...service.stationIds].reverse():service.stationIds),index=ids?.indexOf(r.stationId),remaining=(r.arrival-now)/1000,route=service&&resolve(r.lineId,ids,service.id);
        let point=route?sampleRoute(route,route.fractions[index]):station,fromId=r.stationId;
        // shortcut: ETA has no vehicle location; the final 90 seconds are an explicitly labelled arrival illustration.
        if(route&&index>0&&remaining>=0&&remaining<=90){const a=route.fractions[index-1],b=route.fractions[index];point=sampleRoute(route,a+(b-a)*(1-remaining/90));fromId=ids[index-1];}
        return {...point,...r,fromId,toId:r.stationId,destination:stations.get(destinationId)?.name||r.destinationCode,atStation:remaining<=0,nextIn:Math.max(0,remaining),kind:'arrival-illustration'};
      });
    }
  };
}
