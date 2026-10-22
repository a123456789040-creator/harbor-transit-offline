import assert from 'node:assert/strict';
import {createPlaybackClock,cityDateTimeEpoch,cityDateTime} from '../dist/realtime-clock.mjs';

assert.equal(cityDateTimeEpoch('2026-10-23T12:30','Asia/Taipei'),Date.parse('2026-10-23T04:30:00Z'));
assert.equal(cityDateTimeEpoch('2026-10-23T12:30:15','Asia/Tokyo'),Date.parse('2026-10-23T03:30:15Z'));
assert.equal(cityDateTimeEpoch('2026-03-08T02:30','America/New_York'),null,'reject the missing DST hour');
assert.equal(cityDateTimeEpoch('2026-11-01T01:30','America/New_York'),Date.parse('2026-11-01T05:30:00Z'),'repeated hour chooses earlier occurrence');
for(const value of ['2026-02-30T12:00','2026-10-23T25:00','garbage','1800-01-01T00:00','2101-01-01T00:00',''])assert.equal(cityDateTimeEpoch(value,'Asia/Taipei'),null);
for(const zone of ['Asia/Taipei','Asia/Tokyo','America/New_York']){const epoch=Date.parse('2026-10-23T04:30:15Z');assert.equal(cityDateTimeEpoch(cityDateTime(epoch,zone),zone),epoch);}

let wall=Date.parse('2026-10-23T04:00:00Z'),tick=0;
const clock=createPlaybackClock({wallNow:()=>wall,tickNow:()=>tick});
assert(clock.live);assert.equal(clock.now(),wall);wall+=1000;assert.equal(clock.now(),wall);
clock.toggle();assert(clock.paused&&!clock.live);const frozen=clock.now();wall+=999999;tick+=1000;assert.equal(clock.now(),frozen);
clock.toggle();tick+=500;assert.equal(clock.now(),frozen+500);
clock.setSpeed(60);const sped=clock.now();tick+=250;assert.equal(clock.now(),sped+15000,'speed changes preserve the exact current instant');
assert.equal(clock.setSpeed(Infinity),false);assert.equal(clock.setSpeed(-1),false);assert.equal(clock.speed,60);
assert.equal(clock.seek(NaN),false);assert.equal(clock.seek(8.64e15+1),false);
const midnight=Date.parse('2026-10-23T15:59:59Z');clock.seek(midnight);assert(clock.paused);tick+=500;assert.equal(clock.now(),midnight);
clock.toggle();tick+=100;assert.equal(cityDateTime(clock.now(),'Asia/Taipei'),'2026-10-24T00:00:05','playback crosses the real date boundary');
clock.reset();assert(clock.live&&!clock.paused);assert.equal(clock.speed,1);assert.equal(clock.now(),wall);
console.log('PASS: city-local dates, DST gap/fold, invalid dates, live clock, monotonic playback, pause, speed anchoring and cross-midnight reset.');
