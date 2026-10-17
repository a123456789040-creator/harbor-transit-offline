import {routeBetween} from './history-model.mjs';
import {samplePath} from './rail-path.mjs';

export const REALTIME_ZONES={taipei:'Asia/Taipei',hongkong:'Asia/Hong_Kong',tokyo:'Asia/Tokyo',kansai:'Asia/Tokyo',newyork:'America/New_York'};
const formatters=new Map();
export function cityTime(now,timeZone){
  if(!formatters.has(timeZone))formatters.set(timeZone,new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  const p=Object.fromEntries(formatters.get(timeZone).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,seconds:+p.hour*3600+ +p.minute*60+ +p.second,clock:`${p.hour}:${p.minute}:${p.second}`,year:+p.year,month:+p.month,day:+p.day};
}
function localNoon(date,timeZone){
  const target=Date.parse(`${date}T12:00:00Z`);let epoch=target;
  for(let i=0;i<3;i++){const p=cityTime(epoch,timeZone);epoch+=target-Date.parse(`${p.date}T${p.clock}Z`);}
  return epoch;
}
export function serviceDays(now,timeZone){
  const today=cityTime(now,timeZone).date,midnight=Date.parse(today+'T00:00:00Z');
  return [0,1,2].map(offset=>{const date=new Date(midnight-offset*86400000).toISOString().slice(0,10),weekday=new Date(date+'T12:00:00Z').getUTCDay();return {date,weekday,dayType:weekday===0?'sunday':weekday===6?'saturday':'weekday',seconds:(now-(localNoon(date,timeZone)-43200000))/1000};});
}
export function calendarActive(calendar,day){
  const exception=calendar.exceptions?.find(([date])=>date===day.date);
  if(exception)return exception[1]===1;
  return (!calendar.from||day.date>=calendar.from)&&(!calendar.until||day.date<=calendar.until)&&!!calendar.weekdays[(day.weekday+6)%7];
}
export function locateRun(arrivals,departures,seconds){
  if(arrivals.length<2||arrivals.length!==departures.length||seconds<(arrivals[0]??departures[0])||seconds>(departures.at(-1)??arrivals.at(-1)))return null;
  for(let i=0;i<arrivals.length;i++){
    const arrival=arrivals[i]??departures[i],departure=departures[i]??arrivals[i];
    if(seconds>=arrival&&seconds<=departure)return {from:i,to:i,progress:0,atStation:true,nextAt:departure};
    if(i+1<arrivals.length){const next=arrivals[i+1]??departures[i+1];if(seconds>departure&&seconds<next)return {from:i,to:i+1,progress:(seconds-departure)/(next-departure),atStation:false,nextAt:next};}
  }
  return null;
}
export function createRouteResolver(model){
  const services=model.servicesAt(),byId=new Map(services.map(s=>[s.id,s])),cache=new Map();
  return (lineId,stationIds,hint)=>{
    const key=`${lineId}:${hint||''}:${stationIds.join('|')}`;if(cache.has(key))return cache.get(key);
    const candidates=hint?[byId.get(hint)].filter(Boolean):services.filter(s=>s.lineId===lineId||s.lineIds?.includes(lineId));
    let result=null;
    for(const service of candidates){
      if(!service.stationIds?.length||!service.stopFractions||service.stopFractions.length!==service.stationIds.length)continue;
      for(const reverse of [false,true]){
        const ids=reverse?[...service.stationIds].reverse():service.stationIds,fractions=reverse?[...service.stopFractions].reverse():service.stopFractions,selected=[];let previous=-1;
        for(const id of stationIds){const index=ids.indexOf(id,previous+1);if(index<0)break;selected.push(fractions[index]);previous=index;}
        if(selected.length===stationIds.length){result={path:service.path,fractions:selected};break;}
      }
      if(result)break;
    }
    if(!result){const route=routeBetween(model.network.legs.filter(l=>l.lineId===lineId),stationIds);if(route)result={path:route.path,fractions:route.stopFractions};}
    cache.set(key,result);return result;
  };
}
export function sampleRoute(route,fraction){
  const point=samplePath(route.path,fraction);
  return {...point,angle:point.angle+(route.fractions[0]>route.fractions.at(-1)?Math.PI:0)};
}
function positioned(run,phase,route,day,start=0){
  const fraction=route.fractions[phase.from]+(route.fractions[phase.to]-route.fractions[phase.from])*phase.progress,point=sampleRoute(route,fraction);
  return {...point,id:`${day.date}:${run.id}`,operationId:run.operationId?`${day.date}:${run.operationId}`:null,lineId:run.lineId,name:run.name,stationIds:run.stationIds,fromId:run.stationIds[phase.from],toId:run.stationIds[phase.to],destination:run.destination||run.stationIds.at(-1),atStation:phase.atStation,nextIn:Math.max(0,phase.nextAt+start-day.seconds),kind:run.kind||'timetable',source:run.source};
}
export function createTimetable(model,data){
  const resolve=createRouteResolver(model),ny=data.city==='newyork',timeZone=ny?data.timezone:data.metadata.timeZone,cityId=model.cityId,lines=new Set(),runs=[];
  if(ny){
    for(const [patternIndex,calendarIndex,start,id] of data.trips){const p=data.patterns[patternIndex];lines.add(p.lineId);runs.push({id,lineId:p.lineId,name:p.lineId,stationIds:p.stops.map(i=>data.stations[i]),arrivals:p.arrivals,departures:p.departures,start,calendar:data.services[calendarIndex],hint:p.historyServiceId,destination:p.headsign,kind:'timetable',source:data.source.url});}
  }else for(const service of data.services.filter(s=>s.cityId===cityId)){
    lines.add(service.lineId);
    for(const trip of service.trips||[]){
      const compact=Array.isArray(trip),pattern=compact?data.patterns[trip[0]]:trip;
      runs.push({...pattern,id:compact?trip[2]:trip.id,destination:compact?trip[3]:trip.destination,trainNumber:compact?trip[4]:trip.trainNumber,operationId:compact?trip[5]:trip.operationId,sourceIds:compact?trip[6]:trip.sourceIds,lineId:service.lineId,name:service.name,start:compact?trip[1]:0,dayTypes:service.dayTypes,validFrom:service.validFrom,validUntil:service.validUntil,source:(compact?trip[7]:trip.source)||service.source,kind:service.kind||'timetable'});
    }
  }
  const holidays=new Set((data.metadata?.holidays||[]).map(h=>h.date||h));
  return {lines:[...lines],runs: runs.length,timeZone,data,frame(now){
    const days=serviceDays(now,timeZone),trains=[];let expired=false,expiredServices=0;
    if(!ny)expiredServices=data.services.filter(s=>s.cityId===cityId&&(s.validFrom&&days[0].date<s.validFrom||s.validUntil&&days[0].date>s.validUntil)).length;
    for(const day of days){
      if(data.validFrom&&day.date<data.validFrom||data.validUntil&&day.date>data.validUntil){if(day===days[0])expired=true;continue;}
      const dayType=holidays.has(day.date)?'sunday':day.dayType;
      for(const run of runs){
        if(run.calendar?!calendarActive(run.calendar,day):(!run.dayTypes.includes(dayType)||run.validFrom&&day.date<run.validFrom||run.validUntil&&day.date>run.validUntil))continue;
        const phase=locateRun(run.arrivals,run.departures,day.seconds-run.start);if(!phase)continue;
        const route=resolve(run.lineId,run.stationIds,run.hint);if(!route)continue;
        trains.push(positioned(run,phase,route,day,run.start));
      }
    }
    // A through train belongs to both physical segments at their shared station time.
    const seen=new Set(),unique=trains.filter(t=>{if(!t.operationId||!t.atStation)return true;const key=`${t.operationId}:${t.fromId}`;if(seen.has(key))return false;seen.add(key);return true;});
    return {trains:unique,expired,expiredServices};
  }};
}
// shortcut: frequency anchors are illustrative; replace them when a current individual departure timetable is available.
export function frequencyFrame(model,patterns,now){
  const days=serviceDays(now,REALTIME_ZONES[model.cityId]),trains=[];
  for(const p of patterns)for(const day of days){
    if(p.dayTypes&&!p.dayTypes.includes(day.dayType)||p.validFrom&&day.date<p.validFrom||p.validUntil&&day.date>p.validUntil)continue;
    const runtime=p.arrivals.at(-1),first=Math.max(p.start,p.start+Math.ceil((day.seconds-runtime-p.start)/p.headway)*p.headway),end=Math.min(day.seconds,p.end);
    for(let start=first;start<=end;start+=p.headway){const phase=locateRun(p.arrivals,p.departures,day.seconds-start);if(!phase)continue;trains.push(positioned({...p,id:`${p.id}:${start}`,kind:'frequency-estimate'},phase,p.route,day,start));}
  }
  return trains;
}
export function sourceTimestamp(value){
  if(typeof value!=='string')return NaN;const parts=value.match(/^(\d{4})-?(\d{2})-?(\d{2})[ T]?(\d{2}):?(\d{2}):?(\d{2})$/);
  if(!parts)return NaN;
  const local=Date.UTC(+parts[1],+parts[2]-1,+parts[3],+parts[4],+parts[5],+parts[6]);
  if(!Number.isFinite(local)||new Date(local).toISOString().slice(0,19).replace(/[-:T]/g,'')!==parts.slice(1).join(''))return NaN;
  return local-28800000;
}
export function freshTimestamp(timestamp,now,maxAge=120000){return Number.isFinite(timestamp)&&timestamp<=now+60000&&now-timestamp<=maxAge;}
export function parseHongKong(payload,anchor,now){
  const timestamp=sourceTimestamp(payload.curr_time||payload.sys_time),data=payload.data?.[`${anchor.lineId}-${anchor.code}`];
  if(String(payload.status)!=='1'||!freshTimestamp(timestamp,now)||!data)return {timestamp,arrivals:[]};
  return {timestamp,arrivals:['UP','DOWN'].flatMap(direction=>(data[direction]||[]).filter(r=>r.valid==='Y').map(r=>({id:`${anchor.lineId}:${anchor.code}:${direction}:${r.seq}`,lineId:anchor.lineId,stationId:anchor.stationId,destinationCode:r.dest,platform:r.plat,arrival:sourceTimestamp(r.time),timestamp,direction,delayed:payload.isdelay==='Y'}))).filter(r=>Number.isFinite(r.arrival)&&r.arrival>=now-30000)};
}
export function parseTaipei(payload,model,now){
  const normalize=s=>String(s||'').replace(/站$/,'').replaceAll('臺','台').replaceAll('/','／'),stations=new Map(model.network.stations.map(s=>[normalize(s.name),s]));
  if(!Array.isArray(payload))return [];
  return payload.flatMap((r,index)=>{const station=stations.get(normalize(r.Station)),destination=stations.get(normalize(r.Destination)),timestamp=sourceTimestamp(r.UpdateTime);return station&&freshTimestamp(timestamp,now)?[{id:`taipei:${station.id}:${index}`,stationId:station.id,destination:destination?.name||normalize(r.Destination),destinationId:destination?.id,timestamp,kind:'station-event'}]:[];});
}
