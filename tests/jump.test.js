import test from 'node:test';
import assert from 'node:assert/strict';
import {JumpGesture} from '../src/jump-gesture.js';
import {Game,route} from '../src/game.js';
const wrists=(l=.6,r=l,x=.3)=>({Left:{x,y:l},Right:{x:x+.4,y:r}});
function ready(){const d=new JumpGesture();for(let t=0;t<=260;t+=65)d.update(wrists(),t);assert.ok(d.armed);return d;}
function thrust(d,start=325){return [0,1,2,3].map(i=>d.update(wrists(.6-(i+1)*.03),start+i*65));}
test('both hands thrusting up trigger once; holding up cannot repeat',()=>{
 const d=ready();assert.equal(thrust(d).filter(Boolean).length,1);
 for(let t=585;t<2200;t+=65)assert.equal(d.update(wrists(.48),t),false);
 assert.equal(d.armed,true);
 for(let t=2210;t<=2600;t+=65)d.update(wrists(),t);
 assert.ok(d.armed);assert.equal(thrust(d,2665).filter(Boolean).length,1);
});
test('one hand, slow lifts, sideways movement and tracking reacquisition do not jump',()=>{
 for(const type of ['one','slow','sideways']){const d=ready();for(let i=0;i<25;i++){
  const y=.6-i*(type==='slow'?.005:.025);
  const w=type==='one'?wrists(y,.6):type==='sideways'?wrists(.6,.6,.3+i*.03):wrists(y);
  assert.equal(d.update(w,325+i*65),false,type);
 }}
 const d=ready();d.update(null,325);assert.equal(d.update(wrists(.4),390),false);
 assert.equal(d.update(wrists(.3),455,false),false);
});
function advance(g,seconds){for(let i=0;i<Math.round(seconds*120);i++){g.objects=[];g.step(1/120,0);}}
test('jump has finite airtime, cooldown, and resets',()=>{
 const g=new Game();assert.equal(g.jump(),true);assert.equal(g.jump(),false);
 advance(g,.4);assert.ok(g.jumpHeight>55);
 advance(g,.5);assert.equal(g.jumpHeight,0);assert.equal(g.jumpTime,0);assert.equal(g.jump(),false);
 advance(g,.4);assert.equal(g.jump(),true);g.reset();assert.equal(g.jumpHeight,0);assert.equal(g.jumpCooldown,0);
});
test('free jump clears rocks and riders at height, but not trees; early takeoff is vulnerable',()=>{
 for(const type of ['rock','tree','ai']){
  const g=new Game();g.jump();advance(g,.4);
  if(type==='ai')g.x=route(g.z+1+80/120);
  g.objects=[{type,x:g.x,z:g.z+1,r:24,side:0,phase:0}];g.step(1/120,0);
  assert.equal(g.ended,type==='tree',type);
 }
 const g=new Game();g.objects=[{type:'rock',x:0,z:1,r:24}];g.jump();g.step(1/120,0);assert.ok(g.ended);
});

test('small thrust and slightly staggered hands register without requiring continued motion',()=>{
 const small=ready();assert.equal(small.update(wrists(.59),325),false);assert.equal(small.update(wrists(.54),390),true);
 const staggered=ready();
 assert.equal(staggered.update(wrists(.54,.6),325),false);
 assert.equal(staggered.update(wrists(.54,.59),390),false);
 assert.equal(staggered.update(wrists(.54,.54),455),true);
});
test('jump wrist extraction is independent of edge-on knuckle orientation',async()=>{
 const {jumpWrists}=await import('../src/jump-gesture.js');
 const lm=x=>Array.from({length:21},()=>({x,y:.5,z:0}));
 const w=jumpWrists([lm(.3),lm(.7)]);
 assert.equal(w.Left.x,.7);assert.equal(w.Right.x,.3);
 assert.equal(jumpWrists([lm(.3)]),null);
});

test('terrain ramps score once, with a larger timed boost bonus',()=>{
 for(const boost of [false,true]){
  const g=new Game();g.objects=[{type:'ramp',x:0,z:1,width:105}];
  if(boost)g.jump();g.step(.02,0);assert.equal(g.score,boost?25:10);
  g.step(.02,0);assert.equal(g.score,boost?25:10);
  g.reset();assert.equal(g.score,0);
 }
});
test('free jumping does not award farmable ramp points and riders require clearance',()=>{
 const g=new Game();g.objects=[];g.jump();g.step(.02,0);assert.equal(g.score,0);
 g.x=route(g.z+1+80/120);g.objects=[{type:'ai',x:g.x,z:g.z+1,r:15,side:0,phase:0}];
 g.step(1/120,0);assert.ok(g.ended);
});

test('webcam upward motion launches on flat terrain without ramps or a steady hold',async()=>{
 const {HandInput}=await import('../src/input.js');
 const video={readyState:2,currentTime:0,videoWidth:640,videoHeight:480};
 const hand=new HandInput(video,()=>{});hand.active=true;hand.calibrated=true;hand.jumpEnabled=true;
 let y=.6;hand.model={detectForVideo:()=>({landmarks:[.3,.7].map(x=>Array.from({length:21},()=>({x,y,z:0})))})};
 hand.update(.016,1000);assert.equal(hand.consumeJump(),false);
 y=.56;video.currentTime=.07;hand.update(.07,1070);
 const g=new Game();g.objects=[];g.next=Infinity;
 assert.equal(hand.consumeJump(),true);assert.equal(g.jump(),true);
 for(let i=0;i<40;i++)g.step(1/120,0);
 assert.ok(g.jumpHeight>48);assert.equal(g.ramps,0);assert.equal(g.ended,false);
});

test('slight simultaneous lift jumps again after cooldown without any downward reset',()=>{
 const d=ready();assert.equal(d.update(wrists(.56),325),true);
 for(let t=390;t<=1800;t+=65)assert.equal(d.update(wrists(.56),t),false);
 assert.equal(d.update(wrists(.52),1820),true);
});
test('small jitter and one-fist lifts do not trigger the sensitive jump detector',()=>{
 const d=ready();for(let t=325;t<1000;t+=65)assert.equal(d.update(wrists(.6+Math.sin(t)*.004),t),false);
 assert.equal(d.update(wrists(.57,.6),1040),false);
});

test('ordinary two-hand drift and sudden landmark jumps are rejected',()=>{
 const d=ready();
 assert.equal(d.update(wrists(.58),325),false);
 assert.equal(d.update(wrists(.6),390),false);
 assert.equal(d.update(wrists(.40),455),false);
});

test('small distant hands use a scale-relative lift with temporal confirmation',()=>{
 const d=ready();
 const small=y=>{const w=wrists(y);w.Left.handSize=w.Right.handSize=.07;return w;};
 for(let t=325;t<=585;t+=65)d.update(small(.6),t);
 assert.equal(d.update(small(.589),650),false);
 assert.equal(d.update(small(.577),715),true);
 const jitter=ready();for(let t=325;t<1300;t+=65)assert.equal(jitter.update(small(.6+Math.sin(t)*.006),t),false);
});

test('quick distant-hand lift can finish between frames and staggered fists can stop',()=>{
 const d=ready(),small=y=>{const w=wrists(y);w.Left.handSize=w.Right.handSize=.07;return w;};
 for(let t=325;t<=585;t+=65)d.update(small(.6),t);
 assert.equal(d.update(small(.575),650),true);
 assert.equal(d.update(small(.575),715),false);
 const staggered=ready();
 assert.equal(staggered.update(wrists(.55,.6),325),false);
 assert.equal(staggered.update(wrists(.55,.6),390),false);
 assert.equal(staggered.update(wrists(.55,.55),520),true);
});
