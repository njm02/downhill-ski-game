import {JumpGesture,jumpWrists} from './jump-gesture.js';
import {clamp} from './game.js';
// Vite mounts public at the app root; Live Server exposes the actual directory.
const assetRoot=import.meta.env?.BASE_URL??new URL('../public/',import.meta.url).href;
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
// Estimate in-plane roll from the row of knuckle bases inside EACH fist.
// Never use the wrist-to-knuckle vector: pitching a fist toward the camera
// can change that vector even when the knuckle row has not rotated.
// Regression across four MCPs reduces dependence on a single occluded point.
export function orientation(lm,aspect=4/3){
 const ids=[5,9,13,17],weights=[-1.5,-.5,.5,1.5];
 let dx=0,dy=0,dz=0;
 ids.forEach((id,i)=>{dx-=lm[id].x*aspect*weights[i];dy+=lm[id].y*weights[i];dz+=(lm[id].z||0)*aspect*weights[i];});
 const span=Math.hypot(dx,dy);
 // Depth is a validity check ONLY, never a steering signal. Edge-on fists
 // have an unreliable projected roll; center instead of interpreting pitch.
 const facing=Math.abs(dz)/Math.max(span,.00001)<.85;
 return {angle:Math.atan2(dy,dx),quality:span>.025&&facing};
}
// Circular mean avoids wraparound; tolerate ordinary landmark jitter without
// requiring every frame to match the last frame. Never calibrate moving hands.
export function calibrationEstimate(samples){
 if(samples.length<30)return null;
 const neutral={};
 for(const key of ['Left','Right']){
  neutral[key]=Math.atan2(samples.reduce((s,a)=>s+Math.sin(a[key]),0),samples.reduce((s,a)=>s+Math.cos(a[key]),0));
  const deviations=samples.map(a=>angleDelta(a[key],neutral[key]));
  if(Math.sqrt(deviations.reduce((s,d)=>s+d*d,0)/samples.length)>.12||Math.max(...deviations)-Math.min(...deviations)>.4)return null;
 }
 return neutral;
}
// Track identity by wrist proximity, not the model's handedness classification.
// Wrist positions are used ONLY for identity; steering still uses each fist's angle.
export function matchHands(landmarks, previous={}, aspect=4/3){
 const candidates=landmarks.map(lm=>({...orientation(lm,aspect),wrist:lm[0]})).filter(h=>h.quality);
 if(candidates.length!==2)return null;
 const distance=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
 let ordered;
 if(previous.Left&&previous.Right){
  const direct=distance(candidates[0].wrist,previous.Left)+distance(candidates[1].wrist,previous.Right);
  const swapped=distance(candidates[1].wrist,previous.Left)+distance(candidates[0].wrist,previous.Right);
  ordered=swapped<direct?[candidates[1],candidates[0]]:candidates;
 }else ordered=candidates.sort((a,b)=>b.wrist.x-a.wrist.x);
 return {angles:{Left:ordered[0].angle,Right:ordered[1].angle},wrists:{Left:ordered[0].wrist,Right:ordered[1].wrist}};
}
export function combineRotation(a,b,sensitivity=1,invert=false){
 const dead=.07,fullRotation=40*Math.PI/180;
 // Unequal rotation strength is normal with occluded fist landmarks. Reject
 // opposing gestures, not two hands that agree on direction at different angles.
 if(a*b<0&&Math.min(Math.abs(a),Math.abs(b))>dead)return {value:0,conflict:true};
 const mean=(clamp(a,-1.2,1.2)+clamp(b,-1.2,1.2))/2;
 const value=clamp(Math.sign(mean)*Math.max(0,Math.abs(mean)-dead)/(fullRotation-dead)*sensitivity,-1,1);
 return {value:value*(invert?-1:1),conflict:false};
}
export class KeyboardInput{constructor(){this.jumpPending=false;this.keys=new Set();addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat)this.jumpPending=true;}if(['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key)&&!['INPUT','SELECT'].includes(e.target.tagName)){e.preventDefault();this.keys.add(e.key.toLowerCase());}});addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{this.keys.clear();this.jumpPending=false;});}consumeJump(){const jump=this.jumpPending;this.jumpPending=false;return jump;}get(){return Number(this.keys.has('arrowright')||this.keys.has('d'))-Number(this.keys.has('arrowleft')||this.keys.has('a'));}}
export class HandInput{
 constructor(video,status){this.video=video;this.status=status;this.value=0;this.raw=0;this.sensitivity=1;this.invert=false;this.neutral={};this.samples=[];this.calibrated=false;this.lastSeen=0;this.frame=-1;this.lastInference=0;this.angles={};this.active=false;this.landmarks=[];this.generation=0;this.wrists={};this.jumpGesture=new JumpGesture();this.jumpPending=false;this.jumpEnabled=false;}
 async enable(){if(this.active)return;const generation=++this.generation;this.status('Loading hand-tracking model…');try{const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision');const files=await FilesetResolver.forVisionTasks(`${assetRoot}wasm`);if(!this.model){const options={baseOptions:{modelAssetPath:`${assetRoot}models/hand_landmarker.task`,delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6};try{this.model=await HandLandmarker.createFromOptions(files,options);}catch{this.status('Using compatibility tracking mode…');options.baseOptions.delegate='CPU';this.model=await HandLandmarker.createFromOptions(files,options);}}if(generation!==this.generation)return;this.status('Opening camera · allow access if Chrome asks…');const stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}this.video.srcObject=stream;await this.video.play();if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}this.active=true;this.frame=-1;this.calibrate();}catch(e){this.stop();this.status(e.name==='NotAllowedError'?'Camera permission denied. Allow access or use keyboard.':e.name==='NotFoundError'?'No camera found. Use keyboard.':e.name==='NotReadableError'?'Camera is busy or blocked by macOS. Close other camera apps and check Chrome camera access.':`Camera setup failed: ${e.message || e.name}. Try enabling again.`);console.error(e);}}
 consumeJump(){const jump=this.jumpPending;this.jumpPending=false;return jump;}
 calibrate(){this.jumpGesture.reset();this.jumpPending=false;this.wrists={};this.samples=[];this.calibrated=false;this.calibrating=true;this.raw=0;this.value=0;this.status('Calibration: show BOTH relaxed fists, wrists and knuckles visible.');}
 update(dt,now){if(this.active&&this.video.readyState>=2&&this.video.currentTime!==this.frame&&now-this.lastInference>65){this.lastInference=now;this.frame=this.video.currentTime;try{const result=this.model.detectForVideo(this.video,now);this.landmarks=result.landmarks;const matched=matchHands(result.landmarks,this.wrists,this.video.videoWidth/this.video.videoHeight);const angles=matched?.angles||{};if(matched)this.wrists=matched.wrists;this.angles=angles;if(this.jumpGesture.update(jumpWrists(result.landmarks),now,this.calibrated&&this.jumpEnabled))this.jumpPending=true;if(Object.keys(angles).length===2){this.lastSeen=now;if(this.calibrating){this.samples.push(angles);if(this.samples.length>30)this.samples.shift();const neutral=calibrationEstimate(this.samples);this.status(`Calibrating ${Math.min(100,Math.round(this.samples.length/30*100))}% · keep both hands upright and still`);if(neutral){this.neutral=neutral;this.calibrating=false;this.calibrated=true;this.status('Ready! Twist both fists to test the meter, then hit the slopes.');}else if(this.samples.length===30)this.status('Hands detected · hold steady; relax your fists slightly');}else if(this.calibrated){const a=angleDelta(angles.Left,this.neutral.Left),b=angleDelta(angles.Right,this.neutral.Right);const combined=combineRotation(a,b,this.sensitivity,this.invert);this.raw=combined.value;this.status(combined.conflict?'Hands disagree · check each angle in the preview':Math.abs(this.raw)<.01?'Both hands tracked · neutral':this.raw>0?'Turning RIGHT':'Turning LEFT');}}else{if(now-this.lastSeen>500)this.samples=[];this.raw=0;this.status(this.calibrating?`Calibration: ${Object.keys(angles).length}/2 hands visible · separate hands and relax fists`:'Show both knuckle rows facing the camera · steering centered');}}catch(e){this.stop();this.status('Tracking interrupted. Use keyboard or re-enable camera.');console.error(e);}}if(now-this.lastSeen>250)this.raw=0;this.value+=(this.raw-this.value)*(1-Math.exp(-dt*10));return this.value;}
 stop(){this.jumpGesture.reset();this.jumpPending=false;this.generation++;this.video.srcObject?.getTracks().forEach(t=>t.stop());this.video.srcObject=null;this.active=false;this.calibrated=false;this.calibrating=false;this.raw=0;this.value=0;}
 drawDebug(canvas){const w=this.video.videoWidth||320,h=this.video.videoHeight||240;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);for(const lm of this.landmarks){ctx.strokeStyle='#e67048';ctx.lineWidth=2;ctx.beginPath();for(const i of [0,5,9,13,17,0]){ctx.lineTo((1-lm[i].x)*w,lm[i].y*h);}ctx.stroke();ctx.strokeStyle='#55d9ff';ctx.lineWidth=4;ctx.beginPath();[5,9,13,17].forEach((i,n)=>{const x=(1-lm[i].x)*w,y=lm[i].y*h;if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();for(const pt of lm){ctx.fillStyle='#d6fff0';ctx.beginPath();ctx.arc((1-pt.x)*w,pt.y*h,2,0,7);ctx.fill();}}}
}
