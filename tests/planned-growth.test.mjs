import assert from 'node:assert/strict';
import {createState,advance,generatedStationCount} from '../dist/core.mjs';
const grow=s=>{s.nextGrowth=s.time+.01;advance(s,.02);s.stations.forEach(p=>p.nextPassenger=Infinity);};
for(const autoMode of [false,true])for(const id of ['taipei','international']){
  const state=createState(42,{cityId:id,mode:'endless'});state.city={...state.city,stations:state.city.stations.slice(0,3)};state.autoMode=autoMode;
  assert(state.plannedGrowth);state.stations.forEach(p=>p.nextPassenger=Infinity);
  state.plannedGrowth=false;const before=JSON.stringify([state.stations,state.world,state.expansions]);grow(state);assert.equal(state.stations.length,3);assert.equal(generatedStationCount(state),0);assert.deepEqual([state.world,state.expansions],JSON.parse(before).slice(1));assert(state.time>0);
  state.plannedGrowth=true;grow(state);assert.equal(generatedStationCount(state),1);if(id==='taipei')assert.equal(state.stations.at(-1).name,'1');
  state.plannedGrowth=false;grow(state);assert.equal(generatedStationCount(state),1,'switching off preserves existing generated stations');
  state.plannedGrowth=true;for(let n=1;n<50;n++)grow(state);assert.equal(generatedStationCount(state),50);
  state.bugMode=true;const world=JSON.stringify([state.world,state.expansions]),time=state.time;for(let n=0;n<5;n++)grow(state);assert.equal(generatedStationCount(state),50,'BUG mode cannot bypass the station cap');assert(state.time>time);assert.equal(JSON.stringify([state.world,state.expansions]),world);
}
const catalog=createState(42,{cityId:'taipei',mode:'endless'});catalog.plannedGrowth=false;catalog.stations.forEach(p=>p.nextPassenger=Infinity);grow(catalog);assert.equal(catalog.stations.length,4,'switch affects generated stations, not sourced catalog stations');assert.equal(generatedStationCount(catalog),0);
const planned=createState(42,{cityId:'taipei',mode:'endless'});planned.city={...planned.city,stations:[...planned.city.stations.slice(0,3),{...planned.city.stations[3],planned:true}]};planned.plannedGrowth=false;planned.stations.forEach(p=>p.nextPassenger=Infinity);grow(planned);assert(planned.stations.at(-1).planned);assert.equal(generatedStationCount(planned),0,'official future stations are separate from generated stations');
assert(createState(42,{cityId:'taipei'}).plannedGrowth,'new games reset the switch to on');
console.log('PASS: default on, pause/resume, fifty generated stations in manual/auto/BUG play, artificial city, no unused expansion, continuing time and unchanged real/future catalogs');
