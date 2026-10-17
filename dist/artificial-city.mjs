const SIZE=2400,CENTRE=SIZE/2,TAU=Math.PI*2;
const point=(r,a)=>[+(CENTRE+r*Math.cos(a)).toFixed(3),+(CENTRE+r*Math.sin(a)).toFixed(3)];
const circle=r=>Array.from({length:129},(_,i)=>point(r,i*TAU/128));
function sector(inner,outer,q){
  const start=q*Math.PI/2,end=start+Math.PI/2,ring=[];
  for(let i=0;i<=32;i++)ring.push(point(outer,start+Math.asin(40/outer)+(Math.PI/2-2*Math.asin(40/outer))*i/32));
  for(let i=0;i<=32;i++)ring.push(point(inner,end-Math.asin(40/inner)-(Math.PI/2-2*Math.asin(40/inner))*i/32));
  ring.push(ring[0]);return [ring];
}
const rectangle=(x1,y1,x2,y2)=>[[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]];
const land=[[circle(280)],...[ [360,650],[740,1060] ].flatMap(([a,b])=>Array.from({length:4},(_,q)=>sector(a,b,q)))];
const water=[[circle(360),circle(280)],[circle(740),circle(650)],rectangle(1160,0,1240,920),rectangle(1160,1480,1240,2400),rectangle(0,1160,920,1240),rectangle(1480,1160,2400,1240)];
const palette=['#d6604d','#397fa9','#daab35','#865aab','#43917a','#a86b43','#bd567d','#527d86'];
export const ARTIFICIAL_LINES=Array.from({length:24},(_,i)=>({id:`artificial:${i+1}`,name:`自訂路線 ${i+1}`,color:palette[i%palette.length]}));
export function createArtificialCity(cities,seed=20261017){
  seed=Number.isFinite(seed)?seed:20261017;
  let rng=seed>>>0;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  const names=cities.flatMap(c=>c.stations.map(s=>({name:s.name,source:s.source,sourceCity:c.name,sourceId:s.id})));
  for(let i=names.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[names[i],names[j]]=[names[j],names[i]];}
  const used=new Map(),stations=names.map((source,i)=>{
    const n=(used.get(source.name)||0)+1;used.set(source.name,n);
    const tier=i<200?[30,250,i,200]:i<1100?[390,620,i-200,900]:[770,1030,i-1100,Math.max(1,names.length-1100)];
    const r=Math.sqrt(tier[0]**2+(tier[1]**2-tier[0]**2)*(tier[2]+.5)/tier[3]);let angle=i*2.399963229728653+seed%360;
    if(i>=200){const q=Math.floor((angle%TAU)/ (Math.PI/2)),within=angle%(Math.PI/2),margin=Math.asin(60/r);angle=q*Math.PI/2+margin+within/(Math.PI/2)*(Math.PI/2-2*margin);}
    const [x,y]=point(r,angle);
    return {...source,name:source.name+(n>1?n:''),id:`artificial-station:${i}`,x,y,real:false,artificial:true};
  });
  return {id:'international',name:'環海自建城',description:'中央圓島、兩層扇形環陸與環形運河，東南西北四條大水道；由你規劃整座人工城市。',world:{width:SIZE,height:SIZE},land,water,parks:[],waterways:[],roads:{highway:[],major_road:[]},rivers:[],stations,labels:[{name:'中央圓島',x:1200,y:1190},{name:'第一環陸',x:1510,y:1510},{name:'第二環陸',x:1800,y:1800}],fictional:true,goal:{delivered:250,connected:24,lines:5},depot:{trains:8,carriages:6,tunnels:64},growth:15,sourceUrls:[],officialUrl:'',seed};
}
