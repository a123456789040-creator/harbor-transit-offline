import assert from 'node:assert/strict';
import {loadHistoryCity} from '../dist/history-cities.mjs';
import {createTimetable,frequencyFrame,frequencyDepartures,sampleTrain} from '../dist/realtime-model.mjs';
import {taipeiFrequencyPatterns} from '../dist/realtime-taipei.mjs';

const model=await loadHistoryCity('taipei'),patterns=taipeiFrequencyPatterns(model),epoch=Date.parse('2026-10-17T04:00:00Z');
const station=patterns[0].stationIds[3],rows=frequencyDepartures(model,patterns,station,epoch);
assert(rows.length>5);assert(rows.every(row=>row.departureAt>=epoch&&row.departureAt<=epoch+1800000));
assert(new Set(rows.map(row=>row.nextId)).size>=2,'board includes both physical directions');
assert.equal(new Set(rows.map(row=>row.id)).size,rows.length,'headway bands do not duplicate departure identities');
for(const row of rows.slice(0,10)){
 const at=frequencyFrame(model,patterns,row.departureAt).find(train=>train.id===row.id);
 assert(at?.atStation&&at.fromId===station,'board row and map identify the same train at this station');
 assert.deepEqual(sampleTrain(row,row.departureAt),at);
}
const train=frequencyFrame(model,patterns,epoch).find(t=>!t.atStation),a=sampleTrain(train,epoch+100),b=sampleTrain(train,epoch+200);
assert(a.id===b.id&&Math.hypot(a.x-b.x,a.y-b.y)>0,'subsecond samples move without changing identity');
assert.equal(frequencyDepartures(model,patterns,'missing',epoch).length,0);

const curve={cityId:'newyork',network:{legs:[]},servicesAt:()=>[{id:'curve',lineId:'L',stationIds:['a','b','c'],stopFractions:[0,.5,1],path:[[0,0],[0,10],[10,10]]}]};
const data={city:'newyork',timezone:'America/New_York',source:{url:'fixture'},validUntil:'2026-10-18',stations:['a','b','c'],services:[{weekdays:[1,1,1,1,1,1,1]}],patterns:[{lineId:'L',stops:[0,1,2],arrivals:[0,100,200],departures:[0,120,200]}],trips:[[0,0,86400,'overnight'],[0,0,300,'morning']]};
const timetable=createTimetable(curve,data),midnight=Date.parse('2026-10-18T04:00:00Z');
const [overnight]=timetable.departures('b',midnight);
assert(overnight.id.startsWith('2026-10-17:'),'board preserves previous service day after midnight');
assert.equal(overnight.departureAt,midnight+120000);
const first=sampleTrain(overnight,midnight+50000),second=sampleTrain(overnight,midnight+160000);
assert.equal(first.x,0);assert.equal(second.y,10,'continuous sampling follows the bend, not a chord');
assert.equal(sampleTrain(overnight,midnight-1),null);assert.equal(sampleTrain(overnight,midnight+201000),null);
assert(timetable.departures('b',midnight-60000).some(t=>t.id.startsWith('2026-10-18:morning')),'board includes the next service day within its window');
assert.equal(timetable.departures('b',Date.parse('2026-10-20T12:00:00Z')).length,0,'expired runs never enter the board');
assert.equal(timetable.departures('c',midnight).length,0,'terminating direction has no departure');
console.log('PASS: bidirectional board identities, frequency boundaries, subsecond curves, overnight and next-day service, terminal exclusion and expiry.');
