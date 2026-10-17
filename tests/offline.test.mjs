import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {loadHistoryCity} from '../dist/history-cities.mjs';
import {createState} from '../dist/core.mjs';
const release=JSON.parse(await readFile(new URL('../release.json',import.meta.url)));
for(const [id,count] of [['taipei',170],['hongkong',167],['newyork',493],['tokyo',955],['kansai',962]]){
  const base=await loadHistoryCity(id);assert.equal(base.snapshotAt().stations.length,count);
  const future=await loadHistoryCity(id,true);assert(future.future.newStations>0);
  const planning=createState(42,{cityId:id,city:future.city,mode:'planning',lines:future.snapshotAt(future.future.horizon).lines});assert(planning.lines.length>base.network.lines.length);
  if(release.edition==='public'&&['tokyo','kansai'].includes(id)){assert.equal(base.events.length,0);assert(base.metadata.historyOmitted);for(const s of base.network.stations){assert(!s.opened&&!s.platformOpenings);assert(s.historyOmitted);}assert(base.network.legs.every(l=>!l.opened&&!l.openingSource));}
}
assert.equal(createState(42,{cityId:'international'}).world.width,2400);
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,HARBOR_PORT:'0'},stdio:['ignore','pipe','pipe']});
try{
  const output=await Promise.race([once(server.stdout,'data').then(([data])=>data.toString().trim()),new Promise((_,reject)=>setTimeout(()=>reject(Error('server startup timeout')),10000).unref())]);
  assert(output.startsWith('http://127.0.0.1:'));const response=await fetch(output);assert.equal(response.status,200);assert(response.headers.get('Content-Security-Policy').includes("connect-src 'self'"));
  assert.equal((await (await fetch(output+'health')).json()).offline,true);
  assert.equal((await fetch(output+'api/realtime?city=newyork')).status,404);
  assert.equal((await fetch(output+'release.json')).status,404);
  assert.equal((await fetch(output+'..%5cLICENSE')).status,403);
  assert.equal((await fetch(output,{method:'POST'})).status,405);
  assert.equal((await fetch(output+'game.mjs',{method:'HEAD'})).status,200);
  console.log('PASS: five offline cities, future quotas, original continent, public data boundaries, loopback server, no live relay, traversal, methods and local-only connections');
}finally{server.kill();await once(server,'exit');}
