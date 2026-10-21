import {setRoute,addTrain,addCarriage,chooseUpgrade,advance,tunnelsUsed,routePoints} from './core.mjs';
import {manageReferenceNetwork} from './auto-network.mjs';
const length=(s,ids)=>{const p=routePoints(s,ids);return p.slice(1).reduce((n,v,i)=>n+Math.hypot(v.x-p[i].x,v.y-p[i].y),0);};
export function autoManage(s){
  if(s.gameOver||s.won||s.planning)return;
  for(const line of s.lines)if(line.breaks?.length)setRoute(s,line.id,line.stops);
  if(s.upgrade){const goal=s.city?.goal;chooseUpgrade(s,s.autoNetwork?.needsTunnel?'tunnel':(s.autoNetwork?.needsLine||goal&&s.unlocked<goal.lines)&&s.unlocked<s.lines.length?'line':s.depot.tunnels-tunnelsUsed(s)<2?'tunnel':'carriage');}
  if(!manageReferenceNetwork(s)){
  let connected=new Set(s.lines.flatMap(l=>l.stops));
  const waiting=s.stations.filter(p=>!connected.has(p.id)).sort((a,b)=>b.queue.length-a.queue.length);
  for(const stop of waiting){
    if(connected.has(stop.id))continue;
    const active=s.lines.filter(l=>l.stops.length).length,desired=Math.min(s.unlocked,Math.max(s.city?.goal.lines||1,Math.ceil(s.stations.length/6))),candidates=[];
    for(const line of s.lines.slice(0,s.unlocked)){
      if(!line.stops.length){
        if(!s.bugMode&&!s.depot.trains)continue;
        const peers=s.stations.filter(p=>p.id!==stop.id&&(connected.has(p.id)||!connected.size));
        peers.sort((a,b)=>Math.hypot(a.x-stop.x,a.y-stop.y)-Math.hypot(b.x-stop.x,b.y-stop.y));
        for(const peer of peers.slice(0,3)){const ids=[peer.id,stop.id];candidates.push({line,ids,cost:length(s,ids)+(active<desired?-10000:1000)});}
      }else{
        const before=length(s,line.stops),loop=line.stops[0]===line.stops.at(-1);
        for(let i=loop?1:0;i<=(loop?line.stops.length-1:line.stops.length);i++){
          const ids=[...line.stops];ids.splice(i,0,stop.id);candidates.push({line,ids,cost:length(s,ids)-before});
        }
      }
    }
    candidates.sort((a,b)=>a.cost-b.cost);
    for(const candidate of candidates){
      const proposed={...s,lines:s.lines.map(l=>l===candidate.line?{...l,stops:candidate.ids}:l)};
      if(!s.bugMode&&tunnelsUsed(proposed)>Math.max(s.depot.tunnels,tunnelsUsed(s)))continue;
      if(setRoute(s,candidate.line.id,candidate.ids).ok){connected=new Set(s.lines.flatMap(l=>l.stops));break;}
    }
  }
  const desired=Math.min(s.unlocked,Math.max(s.city?.goal.lines||1,Math.ceil(s.stations.length/6)));
  for(const empty of s.lines.slice(0,s.unlocked).filter(line=>!line.stops.length)){
    if(s.lines.filter(line=>line.stops.length).length>=desired)break;
    const source=s.lines.filter(line=>new Set(line.stops).size>=4).sort((a,b)=>b.stops.length-a.stops.length)[0];if(!source)break;
    const middle=Math.floor((source.stops.length-1)/2);
    if(setRoute(s,empty.id,source.stops.slice(middle)).ok)setRoute(s,source.id,source.stops.slice(0,middle+1));
  }
  }
  const spare=Math.max(s.autoNetwork?.needsLine?1:0,(s.mode==='campaign'?s.city?.goal.lines||0:0)-s.lines.filter(line=>line.stops.length).length);
  const pressure=line=>line.stops.reduce((n,id)=>n+s.stations[id].queue.length,0)/Math.max(6,line.trains.reduce((n,train)=>n+train.capacity,0))+length(s,line.stops)/Math.max(1,line.trains.length)/720;
  const operating=s.lines.filter(line=>line.stops.length).map(line=>({line,pressure:pressure(line)}));
  for(const {line} of operating.sort((a,b)=>b.pressure-a.pressure||a.line.id-b.line.id)){
    const queue=line.stops.reduce((n,id)=>n+s.stations[id].queue.length,0),target=Math.max(1,Math.ceil(new Set(line.stops).size/4),Math.ceil(length(s,line.stops)*2/(90*8)))+Math.floor(queue/12);
    if(line.trains.length<target&&(s.bugMode||s.depot.trains>spare))addTrain(s,line.id);
    const capacity=line.trains.reduce((n,t)=>n+t.capacity,0);
    if(queue>Math.max(3,capacity/2)&&(s.bugMode||s.depot.carriages))addCarriage(s,line.id);
  }
}
export function advanceAutomatic(s,seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return;
  if(s.planning){advance(s,seconds);return;}
  let remaining=seconds;
  while(remaining>1e-7&&!s.gameOver&&!s.won){autoManage(s);const before=s.time;advance(s,Math.min(1,remaining));const spent=s.time-before;if(spent<=1e-7&&!s.upgrade)break;remaining-=spent;}
  autoManage(s);
}
