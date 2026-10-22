import {cityTime} from './realtime-model.mjs';

export function cityDateTime(epoch,zone){const p=cityTime(epoch,zone);return `${p.date}T${p.clock}`;}
export function cityDateTimeEpoch(value,zone){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)||+value.slice(0,4)<1900||+value.slice(0,4)>2100)return null;
  const local=value.length===16?value+':00':value,target=Date.parse(local+'Z');if(!Number.isFinite(target))return null;
  // Nearby offsets cover DST gaps and folds; a repeated local time selects its earlier occurrence.
  const candidates=[-36,0,36].map(hours=>{const probe=target+hours*3600000,p=cityTime(probe,zone);return target-(Date.parse(`${p.date}T${p.clock}Z`)-probe);});
  return candidates.filter(epoch=>cityDateTime(epoch,zone)===local).sort((a,b)=>a-b)[0]??null;
}
export function createPlaybackClock({wallNow=Date.now,tickNow=()=>performance.now()}={}){
  let live=true,paused=false,speed=1,epoch=0,anchor=0;
  const now=()=>live?wallNow():epoch+(paused?0:(tickNow()-anchor)*speed);
  const hold=()=>{epoch=now();anchor=tickNow();live=false;};
  return {now,get live(){return live;},get paused(){return paused;},get speed(){return speed;},
    seek(value){if(!Number.isFinite(value)||!Number.isFinite(new Date(value).getTime()))return false;epoch=value;anchor=tickNow();live=false;paused=true;return true;},
    toggle(){hold();paused=!paused;},
    setSpeed(value){if(![1,10,30,60].includes(value))return false;hold();speed=value;return true;},
    reset(){live=true;paused=false;speed=1;}
  };
}
