// Jumping uses upward wrist motion, independently of the knuckle orientation
// quality required for steering. No hand-position steering is introduced.
export function jumpWrists(landmarks){
 if(landmarks.length!==2)return null;
 const points=landmarks.map(lm=>{
  const wrist=lm[0];if(!wrist)return null;
  const lengths=[5,9,13,17].map(i=>lm[i]?Math.hypot(lm[i].x-wrist.x,lm[i].y-wrist.y):0).filter(n=>Number.isFinite(n)&&n>.015).sort((a,b)=>a-b);
  return {...wrist,handSize:lengths.length>=3?lengths[Math.floor(lengths.length/2)]:null};
 });
 if(points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 points.sort((a,b)=>b.x-a.x);
 return {Left:points[0],Right:points[1]};
}
export class JumpGesture {
 constructor(){this.reset();}
 reset(){this.armed=false;this.cooldownUntil=0;this.lastTime=0;this.baseline=null;this.previous=null;this.liftStarted=null;this.crossed={};this.message='Show both fists to jump';}
 update(wrists,now,enabled=true){
  if(!enabled){this.reset();return false;}
  const sample=wrists?.Left&&wrists?.Right?{L:wrists.Left,R:wrists.Right}:null;
  if(!sample||['L','R'].some(k=>!Number.isFinite(sample[k].x)||!Number.isFinite(sample[k].y))){this.baseline=null;this.previous=null;this.armed=false;this.message='Show both fists';return false;}
  const dt=Math.max(1,now-this.lastTime);this.lastTime=now;
  const capture=()=>{this.baseline={L:{...sample.L},R:{...sample.R}};this.previous={L:{...sample.L},R:{...sample.R}};this.liftStarted=null;this.crossed={};};
  if(!this.baseline||dt>250){capture();this.armed=now>=this.cooldownUntil;return false;}
  if(['L','R'].some(k=>Math.hypot(sample[k].x-this.previous[k].x,sample[k].y-this.previous[k].y)>.14)){
   capture();this.armed=false;this.message='Tracking shifted · steady both fists';return false;
  }
  if(now<this.cooldownUntil){capture();this.armed=false;this.message='Jump recharging';return false;}
  this.armed=true;this.message='Jump ready · lift both fists';
  const threshold=k=>{const size=this.baseline[k].handSize;return Number.isFinite(size)&&size>0?Math.max(.015,Math.min(.038,size*.21)):.028;};
  // Freeze the recent resting position on the first clear upward movement.
  // No need to catch both wrists in motion on the same camera frame.
  if(this.liftStarted===null&&['L','R'].some(k=>this.previous[k].y-sample[k].y>.006))this.liftStarted=now;
  if(this.liftStarted!==null){
   for(const k of ['L','R']){
    const lift=this.baseline[k].y-sample[k].y;
    if(lift>=threshold(k)&&Math.abs(sample[k].x-this.baseline[k].x)<.16)this.crossed[k]??=now;
    else if(lift<threshold(k)*.5)delete this.crossed[k];
   }
   if(this.crossed.L!==undefined&&this.crossed.R!==undefined&&Math.abs(this.crossed.L-this.crossed.R)<=250){
    this.cooldownUntil=now+1250;capture();this.armed=false;this.message='Jump detected!';return true;
   }
   if(now-this.liftStarted>450){capture();this.message='Lift both fists together';}
  }else{
   // Follow gradual posture changes so leaning or slow drift is not a jump.
   const blend=1-Math.exp(-dt/140);
   for(const k of ['L','R']){this.baseline[k].y+=(sample[k].y-this.baseline[k].y)*blend;this.baseline[k].x+=(sample[k].x-this.baseline[k].x)*blend;this.baseline[k].handSize=sample[k].handSize;}
  }
  this.previous={L:{...sample.L},R:{...sample.R}};return false;
 }
}
