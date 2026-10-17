export function mountPinchZoom(canvas,{enabled=()=>true,cancel,zoom}){
  let active=false,previous=null;
  const measure=event=>{const [a,b]=event.targetTouches,r=canvas.getBoundingClientRect();return {x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top,distance:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY))};};
  canvas.addEventListener('touchstart',event=>{
    if(event.targetTouches.length<2||!enabled())return;
    event.preventDefault();active=true;previous=measure(event);cancel();
  },{passive:false});
  canvas.addEventListener('touchmove',event=>{
    if(!active||event.targetTouches.length<2||!enabled())return;
    event.preventDefault();const current=measure(event);if(previous)zoom(current.distance/previous.distance,previous,current);previous=current;
  },{passive:false});
  for(const type of ['touchend','touchcancel'])canvas.addEventListener(type,event=>{
    if(!active)return;event.preventDefault();previous=event.targetTouches.length>=2?measure(event):null;
    if(!event.targetTouches.length)active=false;
  },{passive:false});
  return {get active(){return active;}};
}
