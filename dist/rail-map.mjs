export function paintRailLines(context,legs,scale,lineSize=1,world={width:1100,height:700}){
  context.save();context.beginPath();context.rect(0,0,world.width,world.height);context.clip();context.lineCap='round';context.lineJoin='round';
  for(const leg of legs){context.setLineDash(leg.planned?[5/scale,4/scale]:[]);context.beginPath();leg.points.forEach((point,i)=>i?context.lineTo(...point):context.moveTo(...point));context.strokeStyle='#ffffffc9';context.lineWidth=4.4*lineSize/scale;context.stroke();context.strokeStyle=leg.color;context.lineWidth=2.5*lineSize/scale;context.stroke();}
  context.restore();
}
