import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../src/renderer.js';
import {Game} from '../src/game.js';
test('first-person projection centers on skier, scales nearby objects and follows jumps',()=>{
 const r=new Renderer({noise:()=>.5});r.view='first';r.camera=200;r.worldZ=1000;r.groundHeight=r.elevation(200,1000);
 const near=r.project(200,100,r.groundHeight),far=r.project(200,1200,r.groundHeight);
 assert.equal(near.x,640);assert.ok(near.s>far.s);assert.ok(near.y>far.y);
 r.eyeLift=40;assert.ok(r.project(200,100,r.groundHeight).y>near.y);
 for(const z of [-400,-160,0,100,1900])assert.ok(Number.isFinite(r.project(0,z).s));
});
test('both views render each mountain section without changing game physics',()=>{
 const gradient={addColorStop(){}};
 const ctx=new Proxy({createLinearGradient:()=>gradient},{get:(obj,k)=>obj[k]??(()=>{})});
 const p=new Proxy({width:1280,height:720,noise:()=>.5,drawingContext:ctx,PI:Math.PI,TWO_PI:Math.PI*2},{get:(obj,k)=>obj[k]??(()=>{})});
 const r=new Renderer(p),g=new Game(()=>.3);
 for(const view of ['third','first'])for(const z of [0,7000,16000,26000,34000]){
  g.z=z;g.generate();const score=g.score;r.view=view;r.draw(g,1/60,false,.4);assert.equal(g.z,z);assert.equal(g.score,score);
 }
});
