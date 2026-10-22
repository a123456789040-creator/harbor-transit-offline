const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),base=process.argv[3]||'http://127.0.0.1:8839/';
const epoch=Date.parse('2026-10-17T04:00:00Z');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];fs.mkdirSync('artifacts',{recursive:true});
 try{
  for(const viewport of [{width:1440,height:1000},{width:393,height:852},{width:1024,height:1366}]){
   const context=await browser.newContext({viewport,isMobile:viewport.width<1100,hasTouch:viewport.width<1100}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.stack));
   await page.route('**/api/realtime?city=taipei',r=>r.fulfill({status:502,body:'Unavailable'}));await page.route('**/realtime-cache/taipei.json',r=>r.fulfill({status:404,body:'Unavailable'}));
   await page.goto(new URL('realtime.html?city=taipei&test=1',base).href);await page.waitForFunction(()=>window.realtimeTransit);
   await page.evaluate(t=>realtimeTransit.setTime(t),epoch);await page.locator('#realtime-start').click();
   const station=await page.evaluate(()=>realtimeTransit.trains[0].stationIds[3]);await page.locator('#realtime-station').selectOption(station);
   assert(await page.locator('.departure-direction').count()>=2);const button=page.locator('.departure-row').first();await button.click();const id=await button.getAttribute('data-id');
   assert.equal(await page.evaluate(()=>realtimeTransit.selected),id);assert(await page.evaluate(()=>realtimeTransit.following));
   const departureAt=await page.evaluate(id=>realtimeTransit.boardRows.find(row=>row.id===id).departureAt,id);
   await page.evaluate(t=>realtimeTransit.setTime(t),departureAt+30000);await page.waitForTimeout(100);
   const before=await page.evaluate(()=>realtimeTransit.view);
   await page.evaluate(t=>realtimeTransit.setTime(t),departureAt+30250);await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>realtimeTransit.selected),id,'following keeps the selected departure identity');
   const center=await page.evaluate(()=>{const t=realtimeTransit.drawnTrains.find(t=>t.id===realtimeTransit.selected),v=realtimeTransit.view,c=document.getElementById('realtime-map');return {x:t.x*v.scale+v.x,y:t.y*v.scale+v.y,w:c.clientWidth,h:c.clientHeight};});
   assert(Math.abs(center.x-center.w/2)<1&&Math.abs(center.y-(center.h+60)/2)<1,'camera remains centered on the moving train');
   const after=await page.evaluate(()=>realtimeTransit.view);assert(Math.hypot(after.x-before.x,after.y-before.y)>0,'camera moves between whole seconds');
   await page.locator('#realtime-map').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>realtimeTransit.following),false,'manual pan unlocks camera');
   await page.locator('#follow-toggle').click();assert(await page.evaluate(()=>realtimeTransit.following));
   await page.locator('#zoom-fit').click();assert.equal(await page.evaluate(()=>realtimeTransit.following),false);assert.equal(await page.evaluate(()=>realtimeTransit.view.zoom),1,'fit is not overridden by follow');
   await page.locator('#follow-toggle').click();await page.locator('#station-search').fill('大安森林');await page.locator('#realtime-station').selectOption(await page.locator('#realtime-station option').filter({hasText:'大安森林'}).first().getAttribute('value'));
   assert.equal(await page.evaluate(()=>realtimeTransit.following),false,'choosing a station releases follow');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:path.resolve(`artifacts/realtime-viewing-${viewport.width}.png`),fullPage:true});
   await page.locator('.departure-row').first().click();await page.evaluate(t=>realtimeTransit.setTime(t),departureAt+10800000);assert(await page.locator('#follow-toggle').isDisabled(),'finished train cannot leave camera stuck following old coordinates');
   await page.goto(new URL('realtime.html?city=taipei&test=1&lang=en',base).href);await page.waitForFunction(()=>window.realtimeTransit);await page.evaluate(t=>realtimeTransit.setTime(t),epoch);await page.locator('#realtime-start').click();await page.locator('#realtime-station').selectOption(station);await page.locator('.departure-row').first().click();await page.waitForTimeout(100);
   assert((await page.locator('#station-board h2').textContent()).includes('Station departures'));assert.equal(await page.locator('#follow-toggle').textContent(),'Stop following');assert((await page.locator('.departure-row').first().textContent()).includes('departs in about'));
   await context.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: desktop, phone and tablet station board, same-train follow, subsecond camera, pan/fit unlock, search, completed service and English UI.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
