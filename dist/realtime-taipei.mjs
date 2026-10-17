import {TAIPEI_TRAVEL_TIMES,TAIPEI_PUBLIC_SERVICE_FACTS} from './realtime-hk-taipei-data.mjs';
import {createRouteResolver} from './realtime-model.mjs';
const seconds=text=>text.split(':').reduce((n,v)=>n*60+ +v,0)*60,upper=value=>Array.isArray(value)?Math.max(...value):value;
export function taipeiFrequencyPatterns(model){
  const resolve=createRouteResolver(model),patterns=[];
  for(const r of TAIPEI_TRAVEL_TIMES.routes){
    if(/short|beitou-daan|circular/.test(r.id))continue;
    const lineId=r.lineIds[0],fact=TAIPEI_PUBLIC_SERVICE_FACTS.facts.find(f=>f.lineId===lineId);
    if(!fact?.operatingStart||!fact.operatingEnd)continue;
    const peaks=(fact.weekdayPeak||[]).map(p=>({start:seconds(p.start),end:seconds(p.end)})),start=seconds(fact.operatingStart),end=seconds(fact.operatingEnd);
    for(const weekend of [false,true]){
      const boundaries=[...new Set([start,end,28800,82800,...(!weekend?peaks.flatMap(p=>[p.start,p.end]):[])])].filter(s=>s>=start&&s<=end).sort((a,b)=>a-b);
      for(let n=1;n<boundaries.length;n++){
        const a=boundaries[n-1],b=boundaries[n],mid=(a+b)/2;
        let headway=fact.headwaySeconds||fact.offpeakHeadwaySeconds;
        if(mid>=82800)headway=fact.after23HeadwaySeconds||fact.earlyAndAfter23HeadwaySeconds||headway;
        else if(weekend)headway=(mid<28800?fact.holidayEarly?.headwaySeconds:fact.holidayDay?.headwaySeconds)||fact.holidayDayHeadwaySeconds||headway;
        else if(peaks.some(p=>mid>=p.start&&mid<p.end))headway=fact.peakHeadwaySeconds||headway;
        headway=upper(headway);if(!Number.isFinite(headway)||headway<=0)continue;
        for(const reverse of [false,true]){
          const total=r.arrivalOffsets.at(-1),stationIds=reverse?[...r.stationIds].reverse():r.stationIds;
          const arrivals=reverse?[...r.arrivalOffsets].reverse().map((_,i)=>total-(r.departureOffsets.at(-1-i)??r.arrivalOffsets.at(-1-i))):r.arrivalOffsets;
          const departures=reverse?[...r.arrivalOffsets].reverse().map(s=>total-s):r.departureOffsets.map((s,i)=>s??arrivals[i]),route=resolve(lineId,stationIds);
          if(route)patterns.push({id:`${r.id}:${reverse}:${weekend}:${a}`,lineId,name:r.name,stationIds,arrivals,departures,route,start:a,end:b-.001,headway,dayTypes:weekend?['saturday','sunday']:['weekday'],source:fact.source});
        }
      }
    }
  }
  return patterns;
}
