import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,branchAt,route,sectionAt,FINISH_Z} from '../src/game.js';
test('only regular gates score; expert alternatives are disabled',()=>{
 for(const expert of [false,true]){const g=new Game();g.x=expert?220:0;g.objects=[{type:'gate',x:0,bonusX:220,z:1,width:90}];g.step(.02,0);g.step(.02,0);assert.equal(g.score,expert?0:10);assert.equal(g.missed,expert?1:0);assert.equal(g.passed,expert?0:1);assert.equal(g.bonusGates,0);}
});
test('ramps launch automatically, timed input boosts, and off-ramp paths do not launch',()=>{
 for(const mode of ['auto','boost','avoid']){const g=new Game();g.objects=[{type:'ramp',x:0,z:1,width:105}];if(mode==='boost')g.jump();if(mode==='avoid')g.x=150;g.step(.02,0);assert.equal(g.ramps,mode==='avoid'?0:1);if(mode!=='avoid')assert.equal(g.jumpPeak,mode==='boost'?110:78);assert.equal(g.boosts,mode==='boost'?1:0);}
});
test('forks rejoin, sections progress, and finish approach is free of obstacles',()=>{
 assert.equal(branchAt(4500),null);assert.equal(branchAt(9300),null);assert.ok(branchAt(6900).x<-500);assert.ok(branchAt(15400).x>500);
 assert.equal(sectionAt(0),'RESORT PISTE');assert.equal(sectionAt(7000),'PINE FOREST');assert.equal(sectionAt(16000),'POWDER BOWL');assert.equal(sectionAt(26000),'SUMMIT RACE');
 const g=new Game();g.z=FINISH_Z-1000;g.generate();assert.ok(g.objects.every(o=>o.z<FINISH_Z-650));
 g.elapsed=89.99;g.objects=[];g.step(.02,0);assert.equal(g.elapsed,90);assert.ok(g.ended);
 g.reset();assert.equal(g.ramps,0);assert.equal(g.boosts,0);assert.equal(g.bonusGates,0);
});

test('expert slaloms alternate far sides, remain in bounds and can be followed at race speed',()=>{
 for(const start of [4500,13000,22000]){
  let x=route(start),vx=0,maxError=0;
  for(let z=start;z<start+4800;z+=4){
   const target=branchAt(z)?.x??route(z),ahead=branchAt(z+25)?.x??route(z+25);
   const dt=4/560,steer=Math.max(-1,Math.min(1,(ahead-x)/35));
   vx+=(steer*360-vx)*(1-Math.exp(-dt*9));x+=vx*dt;
   maxError=Math.max(maxError,Math.abs(target-x));
   assert.ok(Math.abs(target)<750);
  }
  assert.ok(maxError<45,`expert route ${start} deviation ${maxError}`);
 }
});
