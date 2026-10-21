import assert from 'node:assert/strict';
import {createState,advance,setRoute,removeSegment,hasSegment,lineSections,connectedStationIds,addTrain,addCarriage,pathTo,trainPosition,tunnelsUsed,missionProgress} from '../dist/core.mjs';

const grow=s=>{s.nextGrowth=s.time+.01;advance(s,.02);s.stations.forEach(stop=>stop.nextPassenger=Infinity);};
for(const cityId of ['hongkong','taipei','newyork','kansai','tokyo','international']){
  const a=createState(42,{cityId,mode:'endless',stationGeneration:'random'}),b=createState(42,{cityId,mode:'endless',stationGeneration:'random'});
  for(const s of [a,b]){s.city={...s.city,stations:s.city.stations.slice(0,9)};s.plannedGrowth=false;s.nextWeek=Infinity;s.stations.forEach(stop=>stop.nextPassenger=Infinity);}
  for(let i=0;i<8;i++){grow(a);grow(b);}
  assert.equal(a.stations.length,9);assert.deepEqual(a,b,'seeded random station order is deterministic');
  assert.equal(new Set(a.stations.map(stop=>stop.catalogId)).size,9,'no repeated catalog station');
  for(const stop of a.stations){const real=a.city.stations.find(p=>p.id===stop.catalogId);assert.deepEqual([stop.name,stop.x,stop.y],[real.name,real.x,real.y]);}
  assert.notDeepEqual(a.stations.map(stop=>stop.catalogId),a.city.stations.map(stop=>stop.id),'random order differs from sequential catalog');
}
const ordered=createState(42,{cityId:'taipei',mode:'endless'});ordered.stations.forEach(stop=>stop.nextPassenger=Infinity);ordered.stationGeneration='random';grow(ordered);ordered.stationGeneration='ordered';grow(ordered);
assert.equal(ordered.stations.at(-1).catalogId,ordered.city.stations.find(p=>!ordered.stations.slice(0,-1).some(stop=>stop.catalogId===p.id)).id,'switching back fills the next unopened catalog station');

const fresh=()=>{const s=createState(42);s.nextGrowth=s.nextWeek=Infinity;s.depot.tunnels=99;s.stations=Array.from({length:6},(_,id)=>({id,x:100+id*60,y:200,shape:['circle','triangle','square','diamond','star','circle'][id],queue:[],crowd:0,age:0,nextPassenger:Infinity}));return s;};
const passengers=s=>s.delivered+s.stations.reduce((n,p)=>n+p.queue.length,0)+s.lines.reduce((n,l)=>n+l.trains.reduce((v,t)=>v+t.passengers.length,0),0);
let s=fresh();assert(setRoute(s,0,[0,1,2,3,4]).ok);assert(addTrain(s,0).ok);assert(addCarriage(s,0).ok);s.lines[0].trains[0].passengers=[{shape:'star'}];
const stock=structuredClone(s.depot),fleet=s.lines[0].trains.length;
assert(removeSegment(s,0,2).ok);assert.deepEqual(lineSections(s.lines[0]),[[0,1],[2,3,4]]);assert.equal(s.lines[0].trains.length,fleet);assert.deepEqual(s.depot,stock);assert.equal(passengers(s),1);assert.deepEqual(pathTo(s,0,'star'),[],'passengers cannot cross a removed segment');
assert(removeSegment(s,0,3).ok);assert.deepEqual(lineSections(s.lines[0]),[[0,1],[3,4]]);assert.deepEqual([...connectedStationIds(s)],[0,1,3,4]);assert.equal(missionProgress(s).connected,4,'isolated intermediate station is unconnected');
for(let i=0;i<200;i++){advance(s,.1);for(const train of s.lines[0].trains){assert(hasSegment(s.lines[0],Math.max(train.from,train.to)),'train stays on active track');assert(Number.isFinite(trainPosition(s,s.lines[0],train).x));}}assert.equal(passengers(s),1);
const before=JSON.stringify(s);for(const index of [-1,0,2,9,1.5])assert(!removeSegment(s,0,index).ok);assert.equal(JSON.stringify(s),before,'invalid deletion does not mutate routes or passengers');
assert(setRoute(s,0,[0,1,2,3,4]).ok);assert.deepEqual(pathTo(s,0,'star'),[0,1,2,3,4],'redrawing reconnects removed track');
for(let i=1;i<5;i++)assert(removeSegment(s,0,i).ok);assert.equal(s.lines[0].trains.length,0);assert.equal(s.depot.trains,3);assert.equal(s.depot.carriages,1);assert.equal(passengers(s),1);assert.equal(connectedStationIds(s).size,0);assert(!addTrain(s,0).ok,'all cuts leave no track to run on');

s=fresh();assert(setRoute(s,0,[0,1,2,3,0]).ok);assert(removeSegment(s,0,2).ok);
assert.deepEqual(lineSections(s.lines[0]),[[2,3,0,1]],'broken loop is one continuous reversing section');assert.deepEqual(pathTo(s,1,'square'),[1,0,3,2],'passenger routing supports both directions after a loop is cut');
for(let i=0;i<200;i++){advance(s,.1);const train=s.lines[0].trains[0],ids=s.lines[0].stops;assert(![[ids[train.from],ids[train.to]],[ids[train.to],ids[train.from]]].some(pair=>pair[0]===1&&pair[1]===2),'broken loop becomes a reversing route');}
s=createState(42);assert(setRoute(s,0,[0,1,2]).ok);assert.equal(tunnelsUsed(s),1);assert(removeSegment(s,0,2).ok);assert.equal(tunnelsUsed(s),0,'removed river crossing releases tunnel capacity');
s.gameOver=true;const ended=JSON.stringify(s);assert(!removeSegment(s,0,1).ok);assert.equal(JSON.stringify(s),ended);
const planning=createState(42,{cityId:'taipei',mode:'planning',lines:[{id:'test',name:'test',color:'#123456'}]});assert(!removeSegment(planning,0,1).ok);
console.log('PASS: random catalog order in six cities, unique real names/positions, sequential fallback, split track, isolated counts, no train/passenger gap crossing, loops, paid fleet/carriage conservation, tunnel refund and mode locks');
