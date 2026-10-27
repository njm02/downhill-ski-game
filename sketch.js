import {FaceInput} from './src/face-input.js';
import p5 from 'p5';
import {jumpWrists} from './src/jump-gesture.js';
import {WebcamTutorial} from './src/tutorial.js';
import {Game,sectionAt} from './src/game.js';
import {KeyboardInput,HandInput,angleDelta} from './src/input.js';
import {Renderer} from './src/renderer.js';
import {Renderer3D} from './src/renderer3d.js';
const $=id=>document.getElementById(id),game=new Game(),keyboard=new KeyboardInput(),hands=new HandInput($('webcam'),s=>{$('trackStatus').textContent=s;});
const face=new FaceInput($('webcam'),s=>{$('trackStatus').textContent=s;});
const facePractice=new WebcamTutorial();let facePracticePassed=false,faceSuccessTime=0;
const practice=new WebcamTutorial();let practicePassed=false;
let state='menu',count=3,steer=0,renderer,best=0,muted=true,audio,toastUntil=0,finishUntil=0,lastDebugFrame=-1;
try{best=Number(localStorage.getItem('downhillChallengeBest'))||0;}catch{}
function tone(freq,duration=.13){if(muted)return;try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.start();o.stop(audio.currentTime+duration);}catch{}}
function show(){if(state!=='faceSetup'&&$('faceSetup').open){$('faceSetup').close();$('stage').append($('tracking'));}if(state!=='tutorial'&&$('orientation').open){$('orientation').close();$('stage').append($('tracking'));}face.jumpGesture.reset();face.jumpPending=false;hands.jumpGesture.reset();hands.jumpPending=false;keyboard.consumeJump();for(const [id,visible] of Object.entries({menu:state==='menu',results:state==='results',finishMoment:state==='finish',paused:state==='paused',hud:['play','countdown','paused'].includes(state),countdown:state==='countdown',bottomHint:state==='play',slopeLabel:false}))$(id).hidden=!visible;}
function start(){if($('mode').value==='face'&&(!face.calibrated||!facePracticePassed)){beginFace();return;}if($('mode').value==='hands'&&!practicePassed){beginPractice();return;}if($('mode').value==='hands'&&!hands.calibrated){if(!hands.active)enableCamera();else {$('trackStatus').textContent='Finish calibration with both hands visible before starting.';}return;}game.reset();renderer.trails=[];renderer.spray=[];renderer.lean=0;renderer.camera=0;renderer.lastTrack=-Infinity;count=3;state='countdown';show();tone(500);}
let practiceSuccessTime=0;
function beginPractice(){practiceSuccessTime=0;$('orientation').classList.remove('practice-success');practicePassed=false;practice.reset();$('gestureDemo').dataset.gesture='calibrate';state='tutorial';show();$('practicePreview').append($('tracking'));$('tracking').hidden=false;$('preview').hidden=false;$('orientation').showModal();enableCamera();}
function cancelPractice(){menu();$('chooseCamera').focus();}
$('practiceSkip').onclick=()=>{if(hands.calibrated){practicePassed=true;start();}};$('practiceCancel').onclick=cancelPractice;$('cameraBack').onclick=cancelPractice;$('orientation').addEventListener('cancel',e=>{e.preventDefault();cancelPractice();});
$('practiceRetry').onclick=()=>{practice.reset();enableCamera();};
// Steering uses the fixed, tuned sensitivity from HandInput.
function updatePractice(dt,now,hv,jump){
 const ready=practice.update(dt,{calibrated:hands.calibrated,tracked:hands.active&&now-hands.lastSeen<180&&Object.keys(hands.angles).length===2,steering:hands.raw,jump,wrists:hands.active&&now-hands.lastInference<250?jumpWrists(hands.landmarks):null});
 const copy={calibrate:['Hold both fists still','Close both hands like holding ski poles, with thumbs on top and palms facing each other. Hold still to calibrate.'],neutral:['Return to neutral','Bring both fists upright and hold briefly before the next gesture.'],left:['Turn left','Copy the looping motion below: tilt both fists left at the wrists. Keep your hands in place.'],right:['Turn right','Now tilt both fists right at the wrists, like the example. No hold needed.'],jump:['Raise both fists to jump','Copy the upward motion: lift both fists slightly together. No downward reset needed.'],done:['You’re ready!','All three movements complete. Your race starts next.']};
 const demo=$('gestureDemo'),gesture=practice.step;
 if(demo.dataset.gesture!==gesture){demo.dataset.gesture=gesture;}
 const caption={calibrate:'Closed grips · palms face each other',neutral:'Bring both fists upright',left:'Twist both fists left · keep wrists in place',right:'Twist both fists right · keep wrists in place',jump:'Lift both fists up together',done:'Ready to ski!'}[gesture];
 $('demoCaption').textContent=caption;demo.setAttribute('aria-label',caption);
 const [title,instruction]=copy[practice.step];$('practiceTitle').textContent=title;$('practiceInstruction').textContent=instruction;
 $('practiceStatus').textContent=practice.step==='jump'?'A small upward lift is enough for this check.':$('trackStatus').textContent;
 $('practiceProgress').value=practice.completed.length;$('practiceSkip').disabled=!hands.calibrated;
 for(const name of ['left','right','jump']){const el=$('practice'+name[0].toUpperCase()+name.slice(1));el.classList.toggle('complete',practice.completed.includes(name));el.classList.toggle('current',practice.step===name);el.textContent=(practice.completed.includes(name)?'✓ ':name==='left'?'1 · ':name==='right'?'2 · ':'3 · ')+name[0].toUpperCase()+name.slice(1);}
 $('orientation').classList.toggle('practice-success',ready);
 if(ready&&!document.hidden&&document.hasFocus()){
  practiceSuccessTime+=dt;
  $('practiceTitle').textContent='✓ Controls passed';
  $('practiceInstruction').textContent='You’re ready. Your run starts next.';
  $('practiceStatus').textContent='Left turn, right turn and jump completed';
  if(practiceSuccessTime>=1.3){practicePassed=true;start();}
 }else practiceSuccessTime=0;
}
function menu(){facePracticePassed=false;face.stop();hands.stop();practicePassed=false;$('tracking').hidden=true;state='menu';show();}
function pause(){if(state==='play'||state==='countdown'){state='paused';show();}else if(state==='paused'){count=3;state='countdown';show();}}
function setView(value){$('viewMode').value=value;$('pauseView').value=value;if(renderer){renderer.view=value;renderer.camera=value==='first'?game.x:game.x*.48;}}
$('chooseKeyboard').onclick=()=>{face.stop();hands.stop();$('mode').value='keyboard';$('tracking').hidden=true;start();};
$('chooseCamera').onclick=()=>{face.stop();$('mode').value='hands';beginPractice();};
function beginFace(){facePractice.reset();facePracticePassed=false;faceSuccessTime=0;hands.stop();$('mode').value='face';state='faceSetup';show();$('facePreview').append($('tracking'));$('tracking').hidden=false;$('preview').hidden=false;$('faceStart').disabled=true;$('faceSetup').showModal();face.enable();updateFacePractice(0,performance.now(),false);}
function updateFacePractice(dt,now,jump){
 const tracked=face.active&&now-face.lastSeen<180;
 const ready=facePractice.update(dt,{calibrated:face.calibrated,tracked,steering:face.raw,jump:tracked&&jump});
 const copy={calibrate:['Hold your head still','Look forward with your head comfortably upright to set neutral.'],left:['Tilt left','Tilt your head toward your left shoulder to turn left.'],right:['Tilt right','Now tilt your head toward your right shoulder to turn right.'],jump:['Lift your chin to jump','Return to neutral sideways tilt, lower your chin to resting position, then lift it.'],done:['✓ Controls passed','Left turn, right turn and jump complete. Your run starts next.']};
 const [title,instruction]=copy[facePractice.step];
 $('faceTitle').textContent=title;$('faceInstruction').textContent=instruction;
 $('faceProgress').value=facePractice.completed.length;
 for(const name of ['left','right','jump']){
  const el=$('facePractice'+name);
  el.classList.toggle('complete',facePractice.completed.includes(name));
  el.classList.toggle('current',facePractice.step===name);
  el.textContent=(facePractice.completed.includes(name)?'✓ ':name==='left'?'1 · ':name==='right'?'2 · ':'3 · ')+name[0].toUpperCase()+name.slice(1);
 }
 $('faceSetup').classList.toggle('practice-success',ready);
 facePracticePassed=ready;
 $('faceStart').disabled=!ready;
 if(ready&&tracked&&dt>0){faceSuccessTime+=dt;if(faceSuccessTime>=1.3)start();}else faceSuccessTime=0;
}
$('chooseFace').onclick=beginFace;
$('faceStart').onclick=()=>{if(face.calibrated&&facePracticePassed)start();};
$('faceRetry').onclick=()=>{facePractice.reset();facePracticePassed=false;faceSuccessTime=0;face.enable();updateFacePractice(0,performance.now(),false);};
$('faceBack').onclick=menu;
$('faceSetup').addEventListener('cancel',e=>{e.preventDefault();menu();});
$('pauseView').onchange=e=>setView(e.target.value);
$('restart').onclick=start;$('back').onclick=menu;$('quit').onclick=menu;$('pause').onclick=pause;$('resume').onclick=pause;

async function enableCamera(){
 $('preview').hidden=false;
 $('practiceRetry').disabled=true;

 try{if(hands.active)hands.calibrate();else await hands.enable();}
 finally{$('practiceRetry').disabled=false;}
}

$('recenter').onclick=()=>{if(state==='play'||state==='countdown'){state='paused';show();}if($('mode').value==='face')face.enable();else enableCamera();};
$('previewToggle').onclick=()=>$('preview').hidden=!$('preview').hidden;
addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();pause();}});addEventListener('blur',()=>{if(state==='play'||state==='countdown'){state='paused';show();}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='play'||state==='countdown')){state='paused';show();}});addEventListener('pagehide',()=>{hands.stop();face.stop();});
new p5(p=>{p.setup=()=>{
 const el=$('stage'),surface=p.createCanvas(el.clientWidth,el.clientHeight);surface.parent('canvas');p.pixelDensity(1);
 const classic=new Renderer(p);let modern;
 function graphics(mode){
  const view=$('viewMode').value;
  try{if(mode==='3d')modern??=new Renderer3D($('canvas'));}
  catch(error){console.error('3D renderer unavailable',error);mode='classic';$('toast').textContent='3D unavailable · using classic graphics';toastUntil=performance.now()+8000;}
  renderer=mode==='3d'?modern:classic;surface.elt.style.display=mode==='3d'?'none':'block';if(modern)modern.webgl.domElement.style.display=mode==='3d'?'block':'none';
  renderer.trails=[];renderer.spray=[];renderer.lastTrack=-Infinity;setView(view);$('graphicsMode').value=mode;
 }
 $('graphicsMode').onchange=e=>graphics(e.target.value);
 graphics(new URLSearchParams(location.search).get('graphics')==='classic'?'classic':'3d');
 new ResizeObserver(()=>{p.resizeCanvas(el.clientWidth,el.clientHeight);modern?.resize(el.clientWidth,el.clientHeight);}).observe(el);
 addEventListener('pagehide',()=>modern?.dispose(),{once:true});show();
};p.draw=()=>{const dt=Math.min(p.deltaTime/1000,.05),now=performance.now();face.jumpEnabled=$('mode').value==='face'&&(state==='play'||(state==='faceSetup'&&facePractice.step==='jump'&&document.hasFocus()&&!document.hidden));hands.jumpEnabled=state==='play'||(state==='tutorial'&&practice.step==='jump');const faceMode=$('mode').value==='face',hv=faceMode?face.update(dt,now):hands.update(dt,now),kv=keyboard.get();if(faceMode){$('angles').textContent=face.active?`Head tilt ${Math.round((face.angle-face.neutral)*180/Math.PI)}° · mirror view`:'';if(!$('preview').hidden)face.drawDebug($('landmarks'));}const keyJump=keyboard.consumeJump(),handJump=hands.consumeJump(),faceJump=face.consumeJump();if(state==='faceSetup')updateFacePractice(document.hasFocus()&&!document.hidden?dt:0,now,faceJump);if(state==='tutorial')updatePractice(document.hasFocus()&&!document.hidden?dt:0,now,hv,handJump);if(state==='play'&&(keyJump||(faceMode&&faceJump)||($('mode').value==='hands'&&handJump)))game.jump();$('jumpStatus').textContent=game.jumpTime>0?'AIRBORNE':game.jumpCooldown>0?'JUMP RECHARGING':(faceMode?'CHIN UP / SPACE · JUMP':$('mode').value!=='hands'?'SPACE · JUMP':hands.jumpGesture.message+' / SPACE');steer=kv||($('mode').value==='keyboard'?0:hv);$('needle').style.left=`${50+hv*47}%`;if(hands.active){$('angles').textContent=['Left','Right'].map(k=>`${k==='Left'?'L':'R'} ${hands.angles[k]===undefined?'—':Math.round(angleDelta(hands.angles[k],hands.neutral[k]||0)*180/Math.PI)+'°'}`).join(' / ')+' · mirror view';if(!$('preview').hidden&&hands.lastInference!==lastDebugFrame){hands.drawDebug($('landmarks'));lastDebugFrame=hands.lastInference;}}if(state==='countdown'){const old=Math.ceil(count);count-=dt;$('countdown').textContent=count>0?Math.ceil(count):'GO';if(Math.ceil(count)!==old)tone(count>0?550:880);if(count<-.5){state='play';show();}}if(state==='play'){// Small fixed steps prevent tunneling and preserve elapsed time on slower frames.
 let remain=dt;while(remain>0&&!game.ended){const step=Math.min(remain,1/120);game.step(step,steer);remain-=step;}for(const event of game.events.splice(0)){if(event==='wildlifeWarn'){tone(340,.22);$('toast').textContent='🐾 Fresh tracks · one tree is shaking';toastUntil=now+1400;}if(event==='jump'){tone(620,.16);$('toast').textContent='JUMP!';toastUntil=now+500;}if(event==='ramp'||event==='boost'){tone(event==='boost'?1100:740,.2);$('toast').textContent=event==='boost'?'+25 · PERFECT TAKEOFF!':'+10 · TERRAIN JUMP';toastUntil=now+900;}if(event==='land'){tone(230,.07);}if(event==='gate'){tone(880);$('toast').textContent=`+${game.lastGatePoints} · GATE`;toastUntil=now+850;}if(event==='miss'){$('toast').textContent='GATE MISSED';toastUntil=now+650;}if(event==='end'){tone(160,.4);state=game.elapsed>=90?'finish':'results';finishUntil=now+2800;$('finalBonus').textContent=game.bonusGates;$('finalBoosts').textContent=game.boosts;$('finalScore').textContent=game.score;$('finalGates').textContent=game.passed;$('finalTime').textContent=`${game.elapsed.toFixed(1)}s`;$('resultTitle').textContent=game.elapsed>=90?'Peak performance.':'One more line?';$('resultReason').textContent=game.reason;if(game.score>best){best=game.score;try{localStorage.setItem('downhillChallengeBest',best);}catch{}$('resultLabel').textContent='NEW PERSONAL BEST';}else $('resultLabel').textContent='RUN COMPLETE';show();}}}if(state==='finish'&&now>=finishUntil){state='results';show();} $('sectionName').textContent=['play','countdown','paused'].includes(state)?sectionAt(game.z):'';if(now>toastUntil)$('toast').textContent='';const seconds=Math.ceil(90-game.elapsed);$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;$('score').textContent=String(game.score).padStart(3,'0');$('gates').textContent=game.passed;renderer.draw(game,dt,state==='play',steer);};});
