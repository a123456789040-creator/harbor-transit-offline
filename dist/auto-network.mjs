import {setRoute} from './core.mjs';

const MAX_FEEDER_STOPS=8;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a,b)=>a.length===b.length&&a.every((id,i)=>id===b[i]);
function subsequence(a,b){let i=0;for(const id of b)if(id===a[i])i++;return i===a.length;}
export function configureAutoNetwork(s,network){
  if(s.planning||!s.city||!network?.services?.length)return false;
  if(s.autoNetwork)return true;
  const stations=new Set(network.stations.map(stop=>stop.id)),lines=new Map(network.lines.map(line=>[line.id,line])),raw=[];
  for(const line of network.lines)if(line.stationIds)raw.push({id:`line:${line.id}`,lineIds:[line.id],stationIds:line.stationIds,name:line.name,color:line.color});
  for(const service of network.services)raw.push({...service,id:`service:${service.id}`,lineIds:service.lineIds||[service.lineId]});
  const unique=new Map();
  for(const item of raw){
    const ids=[...new Set((item.stationIds||[]).filter(id=>stations.has(id)))];if(ids.length<2)continue;
    const refs=item.lineIds.filter(id=>lines.has(id));if(!refs.length)continue;
    const key=[ids.join('|'),[...ids].reverse().join('|')].sort()[0]+'::'+[...refs].sort().join('|');
    if(!unique.has(key))unique.set(key,{id:item.id,refs,stations:ids,name:refs.map(id=>lines.get(id).operator?`${lines.get(id).operator} ${lines.get(id).name}`:lines.get(id).name).join('／'),color:item.color||lines.get(refs[0]).color});
  }
  const all=[...unique.values()],patterns=all.filter(p=>!all.some(q=>q!==p&&q.stations.length>p.stations.length&&p.refs.every(id=>q.refs.includes(id))&&(subsequence(p.stations,q.stations)||subsequence(p.stations,[...q.stations].reverse()))));
  const names=new Map(network.stations.map(stop=>[stop.id,stop.name]));
  const repeated=new Set(patterns.filter(pattern=>patterns.filter(other=>other.name===pattern.name).length>1).map(pattern=>pattern.name));
  for(const pattern of patterns)if(repeated.has(pattern.name))pattern.name+=` · ${names.get(pattern.stations[0])}—${names.get(pattern.stations.at(-1))}`;
  if(!patterns.length)return false;
  // Enabling automatic control may rebuild manual routes; setRoute conserves passengers and paid stock.
  for(const line of s.lines)if(line.stops.length)setRoute(s,line.id,[]);
  while(s.lines.length<patterns.length+3){const id=s.lines.length;s.lines.push({id,color:'#698593',name:`待分配路線 ${id+1}`,stops:[],trains:[]});}
  s.autoNetwork={patterns,stationIds:stations,lastKey:null,needsLine:false,waiting:0};
  if(s.bugMode)s.unlocked=s.lines.length;
  return true;
}
function components(s,onlyReference=false){
  const parent=new Map(s.stations.map(stop=>[stop.id,stop.id]));
  const root=id=>{while(parent.get(id)!==id){parent.set(id,parent.get(parent.get(id)));id=parent.get(id);}return id;};
  for(const line of s.lines)if(!onlyReference||line.autoPattern)for(let i=1;i<line.stops.length;i++){const a=root(line.stops[i-1]),b=root(line.stops[i]);parent.set(a,b);}
  return root;
}
export function manageReferenceNetwork(s){
  const auto=s.autoNetwork;if(!auto)return false;
  if(s.bugMode)s.unlocked=s.lines.length;
  const key=()=>[s.stations.length,s.unlocked,s.bugMode,s.depot.trains,s.depot.tunnels,s.lines.map(line=>line.stops.join(',')).join(';')].join(':');
  if(key()===auto.lastKey)return true;
  auto.needsLine=false;auto.needsTunnel=false;
  const apply=(id,stops)=>{const result=setRoute(s,id,stops);if(!result.ok&&result.message.includes('隧道不足'))auto.needsTunnel=true;return result.ok;};
  const emptySlot=()=>{let line=s.lines.slice(0,s.unlocked).find(line=>!line.stops.length);if(!line&&s.bugMode){const id=s.lines.length;line={id,color:'#698593',name:`待分配路線 ${id+1}`,stops:[],trains:[]};s.lines.push(line);s.unlocked=s.lines.length;}return line;};
  const available=new Map();for(const stop of s.stations){const id=stop.catalogId??(stop.real!==false?s.city.stations[stop.id]?.id:null);if(auto.stationIds.has(id))available.set(id,stop.id);}
  const plans=auto.patterns.map(pattern=>({pattern,stops:pattern.stations.filter(id=>available.has(id)).map(id=>available.get(id))})).filter(plan=>plan.stops.length>1);
  const assigned=new Set();
  for(const line of s.lines.filter(line=>line.autoPattern)){
    const plan=plans.find(plan=>plan.pattern.id===line.autoPattern);if(!plan)continue;
    assigned.add(plan.pattern.id);if(!same(line.stops,plan.stops))apply(line.id,plan.stops);
  }
  let referenceStops=new Set(s.lines.filter(line=>line.autoPattern).flatMap(line=>line.stops));
  const referenceRoot=components(s,true);
  for(const line of s.lines.filter(line=>line.autoFeeder&&line.stops.length))if(line.stops.every(id=>referenceStops.has(id)&&referenceRoot(id)===referenceRoot(line.stops[0])))setRoute(s,line.id,[]);
  while(true){
    const ranked=plans.filter(plan=>!assigned.has(plan.pattern.id)).map(plan=>({...plan,gain:plan.stops.filter(id=>!referenceStops.has(id)).length,transfer:plan.stops.filter(id=>referenceStops.has(id)).length})).filter(plan=>plan.gain>0).sort((a,b)=>(b.gain*100+b.transfer*10+b.stops.length)-(a.gain*100+a.transfer*10+a.stops.length)||a.pattern.id.localeCompare(b.pattern.id));
    let changed=false;
    for(const plan of ranked){
      const slot=s.lines.slice(0,s.unlocked).find(line=>!line.stops.length)||s.lines.slice(0,s.unlocked).find(line=>line.autoFeeder&&line.stops.every(id=>referenceStops.has(id)||plan.stops.includes(id)))||emptySlot();
      if(!slot){auto.needsLine=true;continue;}
      if(!s.bugMode&&s.lines.filter(line=>line.autoPattern&&line.stops.length).length>=s.unlocked-1){
        const root=components(s,true),existing=new Set([...referenceStops].map(root)),joined=new Set(plan.stops.filter(id=>referenceStops.has(id)).map(root));
        if(!s.stations.every(stop=>referenceStops.has(stop.id)||plan.stops.includes(stop.id))||joined.size<existing.size){auto.needsLine=true;continue;}
      }
      if(apply(slot.id,plan.stops)){slot.autoPattern=plan.pattern.id;slot.autoFeeder=false;slot.referenceIds=plan.pattern.refs;slot.name=plan.pattern.name;slot.color=plan.pattern.color;assigned.add(plan.pattern.id);referenceStops=new Set([...referenceStops,...plan.stops]);changed=true;break;}
    }
    if(!changed)break;
  }
  const updatedRoot=components(s,true);
  for(const line of s.lines.filter(line=>line.autoFeeder&&line.stops.length))if(line.stops.every(id=>referenceStops.has(id)&&updatedRoot(id)===updatedRoot(line.stops[0])))setRoute(s,line.id,[]);
  // Isolated random openings need short temporary feeders until their real corridor or interchange appears.
  let connected=new Set(s.lines.flatMap(line=>line.stops));
  if(!s.bugMode&&connected.size<s.stations.length&&!s.lines.slice(0,s.unlocked).some(line=>!line.stops.length)){
    const donor=s.lines.filter(line=>line.autoPattern&&line.stops.length<=4).sort((a,b)=>a.stops.length-b.stops.length||a.id-b.id)[0];
    if(donor){donor.autoPattern=null;donor.autoFeeder=true;donor.referenceIds=[];donor.name=`暫時接駁 ${donor.id+1}`;donor.color='#698593';}
  }
  const feeders=s.lines.filter(line=>line.autoFeeder&&line.stops.length);
  for(const stop of s.stations.filter(stop=>!connected.has(stop.id)).sort((a,b)=>b.queue.length-a.queue.length)){
    if(connected.has(stop.id))continue;
    const candidates=[];
    for(const line of feeders){if(new Set(line.stops).size>=MAX_FEEDER_STOPS)continue;
      for(let i=1;i<line.stops.length;i++){const a=s.stations[line.stops[i-1]],b=s.stations[line.stops[i]],direct=distance(a,b),detour=distance(a,stop)+distance(stop,b),short=detour<=Math.max(45,direct*1.7);if(short||!s.bugMode){const stops=[...line.stops];stops.splice(i,0,stop.id);candidates.push({line,stops,cost:detour-direct+(short?0:1000)});}}
      for(const reverse of [false,true]){const ids=reverse?[...line.stops].reverse():line.stops,last=s.stations[ids.at(-1)],previous=ids.length>1?s.stations[ids.at(-2)]:null;
        const direct=previous?distance(previous,stop):0,detour=previous?distance(previous,last)+distance(last,stop):0;
        if(!previous||detour<=Math.max(45,direct*1.7))candidates.push({line,stops:[...ids,stop.id],cost:distance(last,stop)});
      }
    }
    const slot=emptySlot();
    if(slot){const peers=s.stations.filter(peer=>peer.id!==stop.id&&(connected.has(peer.id)||!connected.size)).sort((a,b)=>distance(a,stop)-distance(b,stop));for(const peer of peers.slice(0,3))candidates.push({line:slot,stops:[peer.id,stop.id],cost:distance(peer,stop)+25});}
    candidates.sort((a,b)=>a.cost-b.cost);
    for(const candidate of candidates)if(apply(candidate.line.id,candidate.stops)){const line=candidate.line;line.autoFeeder=true;line.autoPattern=null;line.referenceIds=[];line.name=`暫時接駁 ${line.id+1}`;line.color='#698593';if(!feeders.includes(line))feeders.push(line);connected=new Set([...connected,...candidate.stops]);break;}
  }
  // Connect separate operating components without merging their real line identities.
  while(true){
    const root=components(s),pairs=[];
    for(let i=0;i<s.stations.length;i++)for(let j=i+1;j<s.stations.length;j++)if(connected.has(i)&&connected.has(j)&&root(i)!==root(j))pairs.push({stops:[i,j],cost:distance(s.stations[i],s.stations[j])});
    if(!pairs.length)break;
    let joined=false;
    pairs.sort((a,b)=>a.cost-b.cost);
    for(const pair of pairs){
      for(const feeder of s.lines.filter(line=>line.autoFeeder&&line.stops.length&&line.stops.length<MAX_FEEDER_STOPS)){
        const [a,b]=pair.stops,from=feeder.stops.includes(a)?a:feeder.stops.includes(b)?b:null,to=from===a?b:a;if(from===null)continue;
        const index=feeder.stops.indexOf(from),stops=[...feeder.stops];stops.splice(index===0?0:index+1,0,to);
        if(apply(feeder.id,stops)){joined=true;break;}
      }
      if(joined)break;
    }
    if(!joined){const slot=emptySlot();if(!slot){auto.needsLine=true;break;}
      for(const pair of pairs)if(apply(slot.id,pair.stops)){slot.autoFeeder=true;slot.autoPattern=null;slot.referenceIds=[];slot.name=`轉乘接駁 ${slot.id+1}`;slot.color='#698593';joined=true;break;}
    }
    if(!joined)break;
  }
  auto.waiting=s.stations.filter(stop=>!connected.has(stop.id)).length;
  const finalRoot=components(s);auto.needsTunnel=auto.needsTunnel&&(auto.waiting>0||new Set([...connected].map(finalRoot)).size>1);
  if(auto.waiting)auto.needsLine=true;
  if(auto.needsLine&&s.unlocked===s.lines.length){const id=s.lines.length;s.lines.push({id,color:'#698593',name:`待分配路線 ${id+1}`,stops:[],trains:[]});}
  auto.lastKey=key();return true;
}
