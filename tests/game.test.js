import test from 'node:test';import assert from 'node:assert/strict';import {Game,route,speedAt} from '../src/game.js';import {orientation,angleDelta} from '../src/input.js';
test('passing and missing gates resolve exactly once',()=>{const g=new Game();g.objects=[{type:'gate',x:0,z:1,width:150}];g.step(.02,0);assert.equal(g.score,10);g.step(.02,0);assert.equal(g.score,10);g.objects=[{type:'gate',x:300,z:g.z+1,width:150}];g.step(.02,0);assert.equal(g.missed,1);});
test('obstacle contact ends run',()=>{for(const type of ['tree','rock','ai']){const g=new Game();g.objects=[{type,x:0,z:1,r:24,side:0,phase:0}];g.step(.02,0);assert.ok(g.ended,type);}});
test('90 second run and frame-rate consistency',()=>{const run=hz=>{const g=new Game();for(let i=0;i<hz*90+1;i++){g.objects=[];g.step(1/hz,.1);}return g;};const a=run(60),b=run(120);assert.equal(a.ended,true);assert.equal(a.elapsed,90);assert.ok(Math.abs(a.z-b.z)<2);});
test('procedural obstacles preserve continuous safe corridor',()=>{const g=new Game(()=>.45);for(let z=0;z<30000;z+=1000){g.z=z;g.generate();for(const o of g.objects){if(o.type==='tree'||(o.type==='rock'&&!o.challenge))assert.ok(Math.abs(o.x-route(o.z))-o.r>80);if(o.type==='gate')assert.ok(Math.abs(o.x-route(o.z))<1);}}});
test('route is navigable by an automatic follower at full progression',()=>{const g=new Game();while(!g.ended){const rock=g.objects.find(o=>o.challenge&&o.z>g.z&&o.z-g.z<g.speed*.42);if(rock)g.jump();const target=route(g.z+35);g.step(1/120,Math.max(-1,Math.min(1,(target-g.x)/60)));}assert.equal(g.elapsed,90);assert.ok(g.passed>35);});
// Camera-space fixture: four knuckle bases across a relaxed fist.
function fist(x=.5){const lm=Array.from({length:21},()=>({x,y:.6,z:0}));[5,9,13,17].forEach((id,i)=>lm[id]={x:x+(i-1.5)*.03,y:.4,z:0});return lm;}
test('knuckle roll ignores translation, depth and wrist pitching',()=>{
 const lm=fist(),base=orientation(lm).angle;
 const shifted=lm.map(p=>({x:p.x+.1,y:p.y-.1,z:p.z+.4}));
 assert.ok(Math.abs(angleDelta(orientation(shifted).angle,base))<1e-10);
 const pitched=fist();pitched[0]={x:.1,y:.2,z:-.4};
 assert.ok(Math.abs(angleDelta(orientation(pitched).angle,base))<1e-10);
 for(const scale of [.7,1.4]){
  const depth=lm.map(p=>({...p,x:.5+(p.x-.5)*scale,y:.5+(p.y-.5)*scale,z:p.z+.2}));
  assert.ok(Math.abs(angleDelta(orientation(depth).angle,base))<1e-10);
 }
});
test('actual in-plane fist rotations produce equal opposite steering',()=>{
 const lm=fist(),base=orientation(lm).angle,aspect=4/3;
 for(const angle of [-.5,.5]){
  const rotated=lm.map(p=>{const x=-(p.x-.5)*aspect,y=p.y-.4;return {x:.5-(x*Math.cos(angle)-y*Math.sin(angle))/aspect,y:.4+x*Math.sin(angle)+y*Math.cos(angle),z:0};});
  const out=orientation(rotated);assert.ok(out.quality);
  assert.ok(Math.abs(angleDelta(out.angle,base)-angle)<1e-10);
 }
});
test('edge-on knuckles are rejected rather than converted into steering',()=>{
 const lm=fist();[5,9,13,17].forEach((id,i)=>lm[id].z=i*.1);
 assert.equal(orientation(lm).quality,false);
});

test('calibration accepts steady jitter and rejects moving hands',async()=>{
 const {calibrationEstimate}=await import('../src/input.js');
 const stable=Array.from({length:30},(_,i)=>({Left:.1+Math.sin(i)*.08,Right:-.2+Math.cos(i)*.08}));
 const neutral=calibrationEstimate(stable);
 assert.ok(neutral);assert.ok(Math.abs(neutral.Left-.1)<.02);
 assert.equal(calibrationEstimate(stable.slice(0,20)),null);
 assert.equal(calibrationEstimate(stable.map((s,i)=>({...s,Left:i*.04}))),null);
});
test('lost tracking smoothly centers input',async()=>{
 const {HandInput}=await import('../src/input.js');
 const h=new HandInput({},()=>{});h.value=1;h.raw=1;h.lastSeen=0;
 const value=h.update(.016,1000);assert.ok(value>0&&value<1);assert.equal(h.raw,0);
 for(let i=0;i<60;i++)h.update(.016,1000+i*16);
 assert.ok(h.value<.001);
});

test('unequal same-direction rotations remain symmetric and responsive',async()=>{
 const {combineRotation}=await import('../src/input.js');
 const right=combineRotation(.95,.2),left=combineRotation(-.95,-.2);
 assert.ok(right.value>.8&&right.value<.85);assert.equal(right.value,-left.value);
 assert.equal(right.conflict,false);
 assert.equal(combineRotation(.4,-.4).conflict,true);
 assert.equal(combineRotation(.02,.03).value,0);
 assert.equal(combineRotation(.4,.4,1,true).value,-combineRotation(.4,.4).value);
});
test('hand identity survives detector order swaps and translation cannot steer',async()=>{
 const {matchHands}=await import('../src/input.js');
 const hand=x=>fist(x);
 const left=hand(.7),right=hand(.3);
 const initial=matchHands([left,right]);
 const swapped=matchHands([right,left],initial.wrists);
 assert.equal(swapped.wrists.Left.x,.7);assert.equal(swapped.wrists.Right.x,.3);
 assert.ok(Math.abs(angleDelta(swapped.angles.Left,initial.angles.Left))<1e-10);
 assert.equal(matchHands([left],initial.wrists),null);
});

test('speed builds steadily throughout the run and resets on restart',()=>{
 const g=new Game();assert.equal(g.speed,240);
 let previous=g.speed;
 for(let i=0;i<90*60;i++){
  g.objects=[];g.step(1/60,0);
  assert.ok(g.speed>=previous);previous=g.speed;
  if(i===30*60-1)assert.ok(Math.abs(g.speed-speedAt(30))<.01);
 }
 assert.ok(Math.abs(g.speed-560)<.01);
 g.reset();assert.equal(g.speed,240);
});

test('gates always award ten points, with no streak multiplier',()=>{
 const g=new Game();let expected=0;
 for(let i=1;i<=20;i++){
  g.objects=[{type:'gate',x:g.x,z:g.z+1,width:90}];g.step(.02,0);
  expected+=10;
  assert.equal(g.score,expected);assert.equal(g.streak,i);
 }
 assert.equal(g.multiplier,1);assert.equal(g.bestStreak,20);
 g.objects=[{type:'gate',x:500,z:g.z+1,width:90}];g.step(.02,0);
 assert.equal(g.streak,0);assert.equal(g.multiplier,1);assert.equal(g.bestStreak,20);
 g.reset();assert.equal(g.bestStreak,0);assert.equal(g.multiplier,1);
});
test('late course tightens gates and spacing; approach rocks leave dodge room',()=>{
 const g=new Game(()=>.2);const first=g.objects.filter(o=>o.type==='gate');
 g.z=25000;g.generate();const late=g.objects.filter(o=>o.type==='gate');
 assert.ok(late.at(-1).width<first[0].width);
 assert.ok(late.at(-1).z-late.at(-2).z<first[1].z-first[0].z);
 const rocks=g.objects.filter(o=>o.challenge);
 assert.ok(rocks.length>0);
 for(const rock of rocks){
  assert.ok(late.some(gate=>Math.abs(gate.z-rock.z-180)<.001));
  for(const side of [-1,1]){
   const x=route(rock.z)+side*65;
   for(const other of g.objects.filter(o=>o.type!=='gate'&&Math.abs(o.z-rock.z)<35))
    assert.ok(Math.hypot(x-other.x,rock.z-other.z)>other.r+9);
  }
 }
 assert.ok(speedAt(90)-speedAt(60)>speedAt(60)-speedAt(30));
});

test('terrain varies along the piste and projection anchors the skier to the ground',async()=>{
 const {Renderer}=await import('../src/renderer.js');
 const r=new Renderer({noise:()=>.5});
 const heights=[];
 for(let z=0;z<3000;z+=100){
  const x=route(z);r.worldZ=z;r.groundHeight=r.elevation(x,z);
  heights.push(r.groundHeight);
  assert.equal(r.project(x,0).y,535);
  assert.ok(Number.isFinite(r.project(x,800).y));
 }
 assert.ok(Math.max(...heights)-Math.min(...heights)>60);
});

test('terrain geometry and lighting are reused without resampling noise each frame',async()=>{
 const {Renderer}=await import('../src/renderer.js');let calls=0;
 const r=new Renderer({noise:()=>{calls++;return .5;}});
 const row=r.terrainRow(1000),initial=calls;
 assert.ok(initial>0);assert.equal(r.terrainRow(1000),row);assert.equal(calls,initial);
 r.terrainRow(1100);assert.ok(calls>initial);
 for(const tile of row)for(const [x,z,height] of tile.vertices)assert.equal(height,r.elevation(x,z));
});

test('wrist steering reaches full strength at forty degrees with unchanged neutral zone',async()=>{
 const {combineRotation}=await import('../src/input.js');
 const radians=d=>d*Math.PI/180;
 assert.equal(combineRotation(.06,.06).value,0);
 for(const sign of [-1,1]){
  assert.equal(combineRotation(sign*radians(40),sign*radians(40)).value,sign);
  const moderate=Math.abs(combineRotation(sign*radians(30),sign*radians(30)).value);
  assert.ok(moderate>.7&&moderate<.75);
 }
});
