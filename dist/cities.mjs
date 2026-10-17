import {GEOGRAPHY} from './geo-data.mjs';
import {createArtificialCity} from './artificial-city.mjs';
const specs=[
  ['hongkong','香港','維多利亞港兩岸，讓島嶼與半島互相連通。',60,8,2],
  ['taipei','台北','跨越淡水河與新店溪，串連雙北生活圈。',90,10,2],
  ['newyork','紐約','從曼哈頓延伸到布魯克林與皇后區。',120,12,3],
  ['kansai','大阪・京都','沿淀川走廊，把兩座城市連成一個路網。',150,14,3],
  ['tokyo','東京','串起副都心、下町與東京灣岸。',180,16,4],
];
export const CITIES=specs.map(([id,name,description,delivered,connected,lines],i)=>({
  ...GEOGRAPHY[id],id,name,description,goal:{delivered,connected,lines},depot:{trains:4,carriages:2,tunnels:id==='kansai'?12:4+i},growth:18,
  labels:[],fictional:false,
}));
CITIES.push(createArtificialCity(CITIES));
export const getCity=(id,seed)=>{const city=CITIES.find(c=>c.id===id);return city?.fictional&&seed!==undefined?createArtificialCity(CITIES.slice(0,5),seed):city;};
export function pointInLand(city,x,y){
  const inside=ring=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  if(city.water.some(poly=>inside(poly[0])&&!poly.slice(1).some(inside)))return false;
  for(const river of city.rivers)for(let i=1;i<river.length;i++){const a=river[i-1],b=river[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<6)return false;}
  return city.land.some(poly=>inside(poly[0])&&!poly.slice(1).some(inside));
}
