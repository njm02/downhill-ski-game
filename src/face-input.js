import {clamp} from './game.js';
const assetRoot=import.meta.env?.BASE_URL??new URL('../public/',import.meta.url).href;
// Outer eye corners: mirrored screen coordinates make a right tilt positive.
export function eyeRoll(lm,aspect=4/3){
 const a=lm?.[33],b=lm?.[263];
 if(!a||!b)return null;
 const dx=(b.x-a.x)*aspect,dy=b.y-a.y;
 if(dx<.045)return null;
 return -Math.atan2(dy,dx);
}
export function faceSteering(angle,neutral=0){
 const roll=Math.atan2(Math.sin(angle-neutral),Math.cos(angle-neutral));
 const dead=3*Math.PI/180,full=25*Math.PI/180;
 return clamp(Math.sign(roll)*Math.max(0,Math.abs(roll)-dead)/(full-dead),-1,1);
}
// Face-local vertical axis removes image translation and compensates for roll.
export function headPitch(lm,aspect=4/3){
 const top=lm?.[10],chin=lm?.[152];
 if(!top||!chin)return null;
 const vertical=Math.hypot((chin.x-top.x)*aspect,chin.y-top.y);
 if(vertical<.08||!Number.isFinite(chin.z)||!Number.isFinite(top.z))return null;
 return -Math.atan2((chin.z-top.z)*aspect,vertical);
}
export class FaceJump{
 constructor(){this.reset();}
 reset(){this.armed=false;this.since=null;this.lastJump=-Infinity;}
 update(pitch,roll,now,enabled){
  // Allow ordinary steering tilt while jumping; head roll should only reject
  // strongly diagonal poses that make the pitch estimate unreliable.
  if(!enabled||pitch===null||Math.abs(roll)>15*Math.PI/180){this.armed=false;this.since=null;return false;}
  // Return to resting pitch before another jump; holding the chin up cannot repeat.
  if(pitch<5*Math.PI/180){this.armed=true;this.since=null;}
  if(!this.armed||pitch<7*Math.PI/180){this.since=null;return false;}
  this.since??=now;
  // Face inference runs around 15 Hz, so even one clear sampled lift should
  // count; a longer hold requirement can miss a quick chin movement entirely.
  if(now-this.since<0||now-this.lastJump<1250)return false;
  this.armed=false;this.since=null;this.lastJump=now;return true;
 }
}
export class FaceInput{
 constructor(video,status){this.jumpGesture=new FaceJump();this.jumpPending=false;this.jumpEnabled=false;this.pitchSamples=[];this.neutralPitch=0;Object.assign(this,{video,status,active:false,calibrated:false,value:0,raw:0,generation:0,lastSeen:0,lastInference:0,frame:-1,landmarks:[],samples:[],neutral:0,angle:0});}
 async enable(){
  if(this.active){this.calibrate();return;}
  const generation=++this.generation;
  this.status('Loading face-tracking model…');
  try{
   const {FilesetResolver,FaceLandmarker}=await import('@mediapipe/tasks-vision');
   if(!this.model){
    const files=await FilesetResolver.forVisionTasks(`${assetRoot}wasm`);
    const options={baseOptions:{modelAssetPath:`${assetRoot}models/face_landmarker.task`,delegate:'GPU'},runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.6,minFacePresenceConfidence:.6,minTrackingConfidence:.6};
    try{this.model=await FaceLandmarker.createFromOptions(files,options);}catch{options.baseOptions.delegate='CPU';this.model=await FaceLandmarker.createFromOptions(files,options);}
   }
   if(generation!==this.generation)return;
   this.status('Opening camera · allow access if asked…');
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video.srcObject=stream;await this.video.play();
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.active=true;this.frame=-1;this.calibrate();
  }catch(error){if(generation!==this.generation)return;this.stop();this.status(`Face camera unavailable: ${error.message}. Retry or choose keyboard.`);}
 }
 consumeJump(){const jump=this.jumpPending;this.jumpPending=false;return jump;}
 calibrate(){this.jumpGesture.reset();this.jumpPending=false;this.pitchSamples=[];this.samples=[];this.calibrated=false;this.value=this.raw=0;this.status('Look forward and hold your head comfortably upright.');}
 update(dt,now){
  if(this.active&&this.video.readyState>=2&&this.video.currentTime!==this.frame&&now-this.lastInference>65){
   this.frame=this.video.currentTime;this.lastInference=now;
   try{
    this.landmarks=this.model.detectForVideo(this.video,now).faceLandmarks[0]||[];
    const pitch=headPitch(this.landmarks,this.video.videoWidth/this.video.videoHeight);
    const angle=eyeRoll(this.landmarks,this.video.videoWidth/this.video.videoHeight);
    if(angle===null||pitch===null){this.jumpGesture.reset();this.jumpPending=false;this.pitchSamples=[];this.raw=0;this.samples=[];this.status('Face not visible · look toward the camera. Steering centered.');}
    else{
     this.lastSeen=now;this.angle=angle;
     if(!this.calibrated){
      this.pitchSamples.push(pitch);if(this.pitchSamples.length>20)this.pitchSamples.shift();
      this.samples.push(angle);if(this.samples.length>20)this.samples.shift();
      const pitchMean=this.pitchSamples.reduce((sum,v)=>sum+v,0)/this.pitchSamples.length;
      const mean=this.samples.reduce((sum,v)=>sum+v,0)/this.samples.length;
      this.status('Hold still to set your neutral head position…');
      if(this.samples.length===20&&this.samples.every(v=>Math.abs(v-mean)<.06)&&this.pitchSamples.every(v=>Math.abs(v-pitchMean)<.06)){this.neutralPitch=pitchMean;this.neutral=mean;this.calibrated=true;this.status('Ready · tilt your head left and right to test steering.');}
     }else{if(this.jumpGesture.update(pitch-this.neutralPitch,angle-this.neutral,now,this.jumpEnabled))this.jumpPending=true;this.raw=faceSteering(angle,this.neutral);this.status(Math.abs(this.raw)<.01?'Face tracked · neutral':this.raw>0?'Turning RIGHT':'Turning LEFT');}
    }
   }catch{this.stop();this.status('Face tracking interrupted. Retry camera or use keyboard.');}
  }
  if(now-this.lastSeen>250){this.raw=0;this.jumpGesture.reset();this.jumpPending=false;}
  this.value+=(this.raw-this.value)*(1-Math.exp(-dt*10));return this.value;
 }
 stop(){this.jumpGesture.reset();this.jumpPending=false;this.generation++;this.stream?.getTracks().forEach(t=>t.stop());if(this.stream&&this.video.srcObject===this.stream)this.video.srcObject=null;this.stream=null;this.active=false;this.calibrated=false;this.raw=this.value=0;this.landmarks=[];}
 drawDebug(canvas){
  const w=this.video.videoWidth||320,h=this.video.videoHeight||240;canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);
  if(!this.landmarks.length)return;
  ctx.strokeStyle='#55d9ff';ctx.lineWidth=4;ctx.beginPath();
  [33,263].forEach((id,i)=>{const p=this.landmarks[id];ctx[i?'lineTo':'moveTo']((1-p.x)*w,p.y*h);});ctx.stroke();
 }
}
