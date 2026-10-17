const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function joinRailPaths(parts){
  const paths=[];
  for(const part of parts){if(part.length<2)continue;const last=paths.at(-1);if(last&&distance(last.at(-1),part[0])<1e-7)last.push(...part.slice(1));else paths.push([...part]);}
  const path=[],breaks=[];for(const part of paths){if(path.length)breaks.push(path.length);path.push(...part);}
  Object.defineProperty(path,'breaks',{value:breaks,configurable:true});return {path,paths,pathBreaks:breaks};
}
export function railPathLength(path){const breaks=new Set(path.breaks||[]);let total=0;for(let i=1;i<path.length;i++)if(!breaks.has(i))total+=distance(path[i-1],path[i]);return total;}
const pathMetrics=new WeakMap();
export function samplePath(path,fraction){
  if(!path?.length)return null;if(path.length===1)return {x:path[0][0],y:path[0][1],angle:0};
  let metrics=pathMetrics.get(path);
  if(!metrics){const breaks=new Set(path.breaks||[]),segments=[];let total=0;for(let i=1;i<path.length;i++){if(breaks.has(i))continue;const length=distance(path[i-1],path[i]);if(length){total+=length;segments.push({i,length,end:total});}}metrics={segments,total};pathMetrics.set(path,metrics);}
  if(!metrics.total)return {x:path[0][0],y:path[0][1],angle:0};
  const at=Math.max(0,Math.min(1,Number(fraction)||0))*metrics.total;
  let low=0,high=metrics.segments.length-1;while(low<high){const mid=(low+high)>>1;if(metrics.segments[mid].end<at)low=mid+1;else high=mid;}
  const segment=metrics.segments[low],a=path[segment.i-1],b=path[segment.i],t=(at-segment.end+segment.length)/segment.length;
  return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};
}
