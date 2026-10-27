import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer3D,mountainHeight} from '../src/renderer3d.js';
import {Game} from '../src/game.js';
function renderer(){return new Renderer3D({clientWidth:1280,clientHeight:720,append(){}},{rendererFactory:()=>({setPixelRatio(){},shadowMap:{},domElement:{setAttribute(){},remove(){}},setSize(){},render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld();},dispose(){}})});}
test('3D scene follows the game, renders both cameras and bounds streamed terrain',()=>{
 const r=renderer(),g=new Game(()=>.3);
 for(const z of [0,6500,13000,22000,34000,0]){
  g.z=z;g.generate();for(const view of ['third','first']){r.view=view;r.draw(g,1/60,true,.5);assert.equal(r.root.position.z,z*.025);assert.equal(r.firstSkis.visible,view==='first');assert.ok(r.tiles.size<=12);assert.ok(r.objects.size<=g.objects.length);}
 }
 assert.equal(g.score,0);assert.equal(g.ended,false);r.dispose();
});
test('3D terrain and object models have finite positions and aligned collision centers',()=>{
 const r=renderer(),g=new Game(()=>.4);r.draw(g,1/60,false,0);
 for(const [o,m] of r.objects){assert.equal(m.position.x,o.x*.025);assert.equal(m.position.z,-o.z*.025);assert.equal(m.position.y,mountainHeight(o.x,o.z)*.025);}
 for(const tile of r.tiles.values())for(const value of tile.children[0].geometry.attributes.position.array)assert.ok(Number.isFinite(value));
 r.dispose();
});

test('generated gates stay clear of ramp approaches and takeoff zones',()=>{
 const g=new Game(()=>.4);
 for(let z=0;z<34000;z+=500){
  g.z=z;g.generate();
  for(const ramp of g.objects.filter(o=>o.type==='ramp')){
   assert.equal(g.objects.some(o=>o.type==='gate'&&o.z>=ramp.z-170&&o.z<=ramp.z+240),false);
  }
 }
});

test('camera turns with steering and smoothly returns to center in both views',()=>{
 const r=renderer(),g=new Game(()=>.4);
 for(const view of ['first','third']){
  r.view=view;r.turnView=0;
  r.draw(g,1/60,true,1);assert.ok(r.turnView>0&&r.turnView<.1);
  for(let i=0;i<120;i++)r.draw(g,1/60,true,1);
  const right=r.eye.quaternion.y;assert.ok(right<0);
  for(let i=0;i<120;i++)r.draw(g,1/60,true,-1);
  assert.ok(r.eye.quaternion.y>0);
  for(let i=0;i<180;i++)r.draw(g,1/60,true,0);
  assert.ok(Math.abs(r.turnView)<.001);
 }
 r.dispose();
});
