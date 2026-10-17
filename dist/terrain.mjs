export function paintTerrain(context,city,scale){
  const {width,height}=city.world||{width:1100,height:700};
  context.save();context.beginPath();context.rect(0,0,width,height);context.clip();
  context.fillStyle=city.coverageRect?'#e4e9e9':'#d1e5ec';context.fillRect(0,0,width,height);
  if(city.coverageRect){const r=city.coverageRect;context.fillStyle='#d1e5ec';context.fillRect(r.x,r.y,r.width,r.height);}
  for(const [polys,fill,stroke] of [[city.land,'#f5f7f6','#bdd2d8'],[city.parks,'#e3eddd',null],[city.water,'#d1e5ec','#bdd2d8']]){
    for(const polygon of polys){context.beginPath();for(const ring of polygon){for(let i=0;i<ring.length;i++)i?context.lineTo(...ring[i]):context.moveTo(...ring[i]);context.closePath();}context.fillStyle=fill;context.fill('evenodd');if(stroke){context.strokeStyle=stroke;context.lineWidth=.5/scale;context.stroke();}}
  }
  for(const [paths,color,width] of [[city.waterways,'#bcdbe5',.65],[city.roads.major_road,'#dedfd7',.65],[city.roads.highway,'#d9d6cb',1]]){
    context.beginPath();for(const points of paths)for(let i=0;i<points.length;i++)i?context.lineTo(...points[i]):context.moveTo(...points[i]);context.strokeStyle=color;context.lineWidth=width/scale;context.stroke();
  }
  context.restore();
}
