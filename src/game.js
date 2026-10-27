export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Distance-based progression also applies to terrain generated ahead of the skier.
export const difficultyAt=z=>clamp(z/29000,0,1);
export const route=z=>Math.sin(z/900)*(255+90*difficultyAt(z))+Math.sin(z/430)*80;
export const speedAt=t=>240+260*clamp(t/90,0,1)+60*clamp((t-60)/30,0,1);
export const FINISH_Z=34200;
export const sectionAt=z=>z<6500?'RESORT PISTE':z<15500?'PINE FOREST':z<25500?'POWDER BOWL':'SUMMIT RACE';
// Three signed forks open smoothly and rejoin the main piste.
export function branchAt(z){
 for(const [index,start] of [4500,13000,22000].entries()){
  const t=(z-start)/4800,side=index===1?1:-1;
  if(t>0&&t<1){
   const edge=clamp(Math.min(z-start,start+4800-z)/1500,0,1);
   const blend=edge*edge*(3-2*edge);
   const outer=side*590+75*Math.sin((z-start)/180);
   return {x:route(z)*(1-blend)+outer*blend,start,t,side};
  }
 }
 return null;
}
export function segmentDistance(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(px-ax-t*dx,pz-az-t*dz);}
export class Game{
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.x=0;this.z=0;this.vx=0;this.elapsed=0;this.score=0;this.passed=0;this.missed=0;this.streak=0;this.bestStreak=0;this.multiplier=1;this.lastGatePoints=10;this.speed=speedAt(0);this.ramps=0;this.boosts=0;this.bonusGates=0;this.jumpDuration=.85;this.jumpPeak=58;this.lastJumpAt=-10;this.jumpTime=0;this.jumpHeight=0;this.jumpCooldown=0;this.objects=[];this.lastChallengeZ=0;this.lastWildlifeZ=0;this.wildlifeId=0;this.next=300;this.ended=false;this.reason='';this.events=[];this.generate();}
 generate(){
  while(this.next<this.z+3600){
   const z=this.next,d=difficultyAt(z),c=route(z);
   const branch=branchAt(z);this.objects.push({type:'gate',x:c,z,width:90-22*d,bonusX:null,done:false});
   // Keep ordinary obstacles outside a wide corridor around the entire route.
   for(let i=0;i<8+Math.floor(d*12);i++){
    const oz=z+(this.random()-.5)*260,side=this.random()<.5?-1:1;
    const type=this.random()<(sectionAt(z)==='POWDER BOWL'?.65:.28)?'rock':'tree';
    const ox=route(oz)+side*(120+this.random()*480),fork=branchAt(oz);
    if(fork&&Math.abs(ox-fork.x)<100)continue;
    this.objects.push({type,x:ox,z:oz,r:type==='tree'?21:24,seed:this.random(),scale:.7+this.random()*.6});
   }
   // Isolated approach rocks: jump the direct line or dodge within the clear corridor.
   // At least one gate separates challenges, leaving time to recharge and recover.
   if(z>2800&&z-(this.lastChallengeZ||0)>800&&this.random()<.45+d*.4){
    const rz=z-180;
    this.objects.push({type:'rock',x:branchAt(rz)?.x??route(rz),z:rz,r:24,seed:this.random(),scale:.8,challenge:true});
    this.lastChallengeZ=z;
   }
   // The first creature arrives after the opening stretch; later crossings are spaced out.
   if(!branch&&z>2400&&z-this.lastWildlifeZ>1700&&this.random()<.58){
    const encounterZ=z+240,side=this.random()<.5?-1:1,type=this.random()<.6?'bear':'yeti',origin=route(encounterZ),cueId=++this.wildlifeId;
    this.objects.push({type:'tree',x:origin+side*430,z:encounterZ-65,r:0,seed:this.random(),scale:1.75,entranceTree:true,cueId});
    this.objects.push({type,x:origin+side*430,z:encounterZ,r:type==='bear'?30:27,direction:-side,origin,phase:this.random()*Math.PI*2,moving:false,crossed:false,cueId});
    this.lastWildlifeZ=z;
   }
   if(!branch&&z>6500&&this.random()<.65+d*.35){
    const side=this.random()<.5?-1:1;
    const phase=this.random()*6;
    this.objects.push({type:'ai',x:route(z+100)+side*(175+Math.sin(this.elapsed*.85+phase)*45),z:z+100,r:15,phase,side});
   }
   if(Math.floor(z/3200)!==Math.floor((z-500)/3200)&&z<FINISH_Z-1200)this.objects.push({type:'ramp',x:branchAt(z-360)?.x??route(z-360),z:z-360,width:105,done:false});
   this.next+=540-170*d;
  }
  // Keep landing/recharge zones clear of mandatory centerline rocks.
  const ramps=this.objects.filter(o=>o.type==='ramp');
  this.objects=this.objects.filter(o=>o.z>this.z-250&&o.z<FINISH_Z-650&&!(o.challenge&&ramps.some(r=>Math.abs(r.z-o.z)<800))&&!(o.type==='gate'&&ramps.some(r=>o.z>=r.z-170&&o.z<=r.z+240)));
 }

 launch(boost=false){this.jumpDuration=boost?1.2:.95;this.jumpPeak=boost?110:78;this.jumpTime=this.jumpDuration;this.jumpCooldown=1.25;this.ramps++;this.score+=boost?25:10;if(boost)this.boosts++;this.events.push(boost?'boost':'ramp');}
 jump(){this.lastJumpAt=this.elapsed;if(this.ended||this.jumpTime>0||this.jumpCooldown>0)return false;this.jumpDuration=.85;this.jumpPeak=58;this.jumpTime=.85;this.jumpCooldown=1.25;this.events.push('jump');return true;}
 step(dt,steer){if(this.ended)return;dt=Math.min(dt,1/30);dt=Math.min(dt,90-this.elapsed);const oldX=this.x,oldZ=this.z;this.elapsed+=dt;this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);if(this.jumpTime>0){this.jumpTime=Math.max(0,this.jumpTime-dt);this.jumpHeight=this.jumpPeak*Math.sin(Math.PI*(1-this.jumpTime/this.jumpDuration));if(this.jumpTime===0){this.jumpHeight=0;this.events.push('land');}}this.speed=speedAt(this.elapsed);this.vx+=(steer*360-this.vx)*(1-Math.exp(-dt*9));this.x=clamp(this.x+this.vx*dt,-820,820);this.z+=this.speed*dt;for(const o of this.objects){const obstacleOldX=o.x,obstacleOldZ=o.z;if((o.type==='bear'||o.type==='yeti')&&!o.crossed){if(!o.warned&&o.z-this.z<this.speed*4.2){o.warned=true;this.events.push('wildlifeWarn');this.objects.find(t=>t.entranceTree&&t.cueId===o.cueId).shakeUntil=this.elapsed+1.5;}if(!o.moving&&o.z-this.z<this.speed*2.8){o.moving=true;o.runSpeed=0;}if(o.moving){const maxSpeed=210+45*difficultyAt(o.z);o.runSpeed=Math.min(maxSpeed,(o.runSpeed||0)+360*dt);o.x+=o.direction*o.runSpeed*dt;if(Math.abs(o.x-o.origin)>470){o.moving=false;o.crossed=true;}}}if(o.type==='ai'){o.z+=80*dt;o.x=route(o.z)+o.side*(175+Math.sin(this.elapsed*.85+o.phase)*45);}if(o.type==='ramp'){if(!o.done&&oldZ<o.z&&this.z>=o.z){o.done=true;const cx=oldX+(this.x-oldX)*(o.z-oldZ)/(this.z-oldZ);if(Math.abs(cx-o.x)<o.width/2)this.launch(this.elapsed-this.lastJumpAt<.3);}continue;}if(o.type==='gate'){if(!o.done&&oldZ<o.z&&this.z>=o.z){const crossingX=oldX+(this.x-oldX)*(o.z-oldZ)/(this.z-oldZ);o.done=true;o.bonus=false;o.passed=Math.abs(crossingX-o.x)<o.width/2-8||o.bonus;if(o.passed){this.streak++;this.bestStreak=Math.max(this.bestStreak,this.streak);this.multiplier=1;this.lastGatePoints=10;if(o.bonus)this.bonusGates++;this.score+=this.lastGatePoints;this.passed++;this.events.push('gate');}else{this.streak=0;this.multiplier=1;this.missed++;this.events.push('miss');}}}else if(!o.entranceTree&&!((o.type==='rock'&&this.jumpHeight>32)||(o.type==='ai'&&this.jumpHeight>48))&&segmentDistance(0,0,oldX-obstacleOldX,oldZ-obstacleOldZ,this.x-o.x,this.z-o.z)<o.r+9){this.finish(o.type==='bear'?'A bear crossed your line.':o.type==='yeti'?'A yeti crossed your line.':o.type==='ai'?'You crossed skis with another rider.':o.type==='rock'?'A rock caught your edge.':'You met an evergreen.');break;}}if(this.elapsed>=90&&!this.ended)this.finish('Ninety seconds of mountain, conquered.');this.generate();}
 finish(reason){this.ended=true;this.reason=reason;this.events.push('end');}
}
