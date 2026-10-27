import * as T from 'three';
import {buildTree} from './tree-model.js';
export function createAlpineAssets(){
let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const owned=new Set();const mats=new Map();function mat(color,extra={}){const key=color+JSON.stringify(extra);if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,roughness:.9,...extra}));return mats.get(key);}
const box=new T.BoxGeometry(1,1,1),ball=new T.IcosahedronGeometry(1,2),cylinder=new T.CylinderGeometry(1,1,1,8);
function mesh(parent,geo,material,x,y,z,sx=1,sy=1,sz=1){owned.add(geo);const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function beam(parent,a,b,r,material){const v=new T.Vector3().subVectors(b,a),m=mesh(parent,cylinder,material,...a.clone().add(b).multiplyScalar(.5).toArray(),r,v.length(),r);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return m;}
function mountains(){const group=new T.Group();
function mountainHash(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);}
function mountainNoise(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 return T.MathUtils.lerp(T.MathUtils.lerp(mountainHash(ix,iz),mountainHash(ix+1,iz),u),T.MathUtils.lerp(mountainHash(ix,iz+1),mountainHash(ix+1,iz+1),u),v);
}
for(let layer=2;layer>=0;layer--){
 const geo=new T.PlaneGeometry(620,210,180,75);geo.rotateX(-Math.PI/2);
 const a=geo.attributes.position,offset=layer*71;
 const peaks=[[-265,42,55],[-191,70,57],[-113,54,46],[-42,88,63],[46,60,49],[126,94,59],[214,63,47],[281,81,62]];
 for(let i=0;i<a.count;i++){
  const x=a.getX(i),localZ=a.getZ(i),z=localZ-285-layer*92;
  let mass=0;
  for(const [px,h,width] of peaks){
   const dx=(x-px-Math.sin(px+layer)*19)/width;
   const dz=(localZ-Math.sin(px*.1+layer)*21)/65;
   // Anisotropic flanks break the rounded cone shape into steep shoulders.
   const angle=Math.atan2(dz,dx);
   const shoulder=1+.16*Math.sin(angle*3+px)+.09*Math.sin(angle*5-layer);
   mass=Math.max(mass,(h+layer*5)*Math.pow(Math.max(0,1-Math.sqrt(dx*dx+dz*dz)*shoulder*.69),1.05));
  }
  const envelope=Math.max(0,Math.sin((localZ+105)/210*Math.PI));
  const ridge=1-Math.abs(mountainNoise(x*.045+offset,z*.048)*2-1);
  const fine=mountainNoise(x*.16-offset,z*.14)-.5;
  const warp=mountainNoise(x*.018+offset,z*.018)*15;
  const ravine=Math.pow(1-Math.abs(mountainNoise((x+warp)*.075,z*.026)*2-1),9);
  const crag=mountainNoise(x*.32,z*.27)-.5;
  const y=-39+mass+envelope*(ridge*5+fine*1.2+crag*.35-ravine*Math.min(4,mass*.07));
  a.setXYZ(i,x,y,z);
 }
 geo.computeVertexNormals();
 const normals=geo.attributes.normal,colors=[];
 for(let i=0;i<a.count;i++){
  const x=a.getX(i),y=a.getY(i),z=a.getZ(i),up=normals.getY(i);
  const variation=mountainNoise(x*.13,z*.12);
  // Snow remains on shelves; steep buttresses expose blue-grey rock.
  const streak=mountainNoise(x*.30+mountainNoise(x*.04,z*.04)*4,z*.07);
  const snow=T.MathUtils.smoothstep(up+variation*.16+streak*.12,.68,.91)*T.MathUtils.smoothstep(y,-32,2);
  const rock=new T.Color('#a6b4c1');
  const frost=new T.Color('#dce5ed');
  const c=rock.lerp(frost,snow);
  // Layer-specific atmospheric tint separates distant ranges.
  c.lerp(new T.Color('#d1d8da'),.22+layer*.17);
  colors.push(c.r,c.g,c.b);
 }
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 const mountain=new T.Mesh(geo,new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,emissive:'#adb7bd',emissiveIntensity:.28}));
 owned.add(geo);mats.set(`mountain-${layer}`,mountain.material);mountain.receiveShadow=true;group.add(mountain);
 // Extend the near foothills below the course horizon, closing the exposed
 // sky band that appeared when the downhill camera was steepened.
 const apronVertices=[],apronColors=[],apronIndices=[];
 const row=75*(180+1);
 for(let j=0;j<=180;j++){
  const index=row+j,x=a.getX(index),y=a.getY(index),z=a.getZ(index);
  apronVertices.push(x,y,z,x,-330,z+45);
  const color=new T.Color('#c3cccf');
  apronColors.push(colors[index*3],colors[index*3+1],colors[index*3+2],color.r,color.g,color.b);
  if(j<180){const k=j*2;apronIndices.push(k,k+1,k+2,k+1,k+3,k+2);}
 }
 const apron=new T.BufferGeometry();apron.setAttribute('position',new T.Float32BufferAttribute(apronVertices,3));apron.setAttribute('color',new T.Float32BufferAttribute(apronColors,3));apron.setIndex(apronIndices);apron.computeVertexNormals();
 owned.add(apron);const foothill=new T.Mesh(apron,mountain.material);group.add(foothill);

}

return group;}
function rockModel(){
 const x=0,z=0,r=1;
 const geo=new T.IcosahedronGeometry(1,3),a=geo.attributes.position;
 const phase=random()*8,stretch=.75+random()*.65;
 for(let j=0;j<a.count;j++){
  const vx=a.getX(j),vy=a.getY(j),vz=a.getZ(j);
  // Broad weathered lobes retain asymmetry without pointed triangular chips.
  const weathering=1+.08*Math.sin(vx*3+vy*2+phase)+.055*Math.sin(vz*4-vy*3+phase);
  // Project toward a rounded block, then clip broad, slanted weathered faces.
  const block=1/Math.pow(Math.pow(Math.abs(vx),5)+Math.pow(Math.abs(vy),5)+Math.pow(Math.abs(vz),5),1/5);
  const bx=vx*block,by=vy*block,bz=vz*block;
  const top=Math.min(by,.73+bx*.14-bz*.09);
  const face=Math.min(bx,.84+bz*.16);
  a.setXYZ(j,(face*weathering+top*.15)*stretch,top*weathering*.62,bz*weathering*.73);
 }
 geo.computeVertexNormals();
 // Icosahedron vertices are duplicated per triangle: average shared normals
 // explicitly so lighting flows across the surface instead of outlining facets.
 const normals=geo.attributes.normal,sums=new Map(),keys=[];
 for(let j=0;j<a.count;j++){
  const key=[a.getX(j),a.getY(j),a.getZ(j)].map(v=>Math.round(v*100000)).join(',');keys.push(key);
  if(!sums.has(key))sums.set(key,new T.Vector3());
  sums.get(key).add(new T.Vector3().fromBufferAttribute(normals,j));
 }
 for(const n of sums.values())n.normalize();
 const colors=[];
 for(let j=0;j<a.count;j++){
  const n=sums.get(keys[j]);normals.setXYZ(j,n.x,n.y,n.z);
  const vx=a.getX(j),vy=a.getY(j),vz=a.getZ(j);
  const grain=.5+.5*Math.sin(vx*11+phase)*Math.sin(vz*13+vy*7);
  const rock=new T.Color('#7b858c').multiplyScalar(.92+grain*.12);
  // Continuous snow coverage avoids separate triangular white plates.
  const snow=T.MathUtils.smoothstep(vy+.04*Math.sin(vx*8+phase),.18,.38)*T.MathUtils.smoothstep(n.y,.25,.65);
  rock.lerp(new T.Color('#e6edf1'),snow);colors.push(rock.r,rock.g,rock.b);
 }
 geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 const group=new T.Group();group.position.set(x,r*.20,z);group.scale.setScalar(r);group.rotation.y=random()*Math.PI*2;
 mesh(group,geo,mat('#ffffff',{vertexColors:true,roughness:1}),0,0,0);return group;
}

function buildSkier(color){
const skier=new T.Group();
const orange=mat(color),navy=mat('#293b49');
function limb(a,b,lower,upper,material){
 const direction=new T.Vector3().subVectors(b,a);
 const part=mesh(skier,new T.CylinderGeometry(upper,lower,direction.length(),10),material,...a.clone().add(b).multiplyScalar(.5).toArray());
 part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return part;
}
// Elliptical cross sections with a defined waist and shoulders, instead of a sphere.
function tailoredBody(rings,material){
 const vertices=[],indices=[],segments=12;
 for(const [y,z,width,depth] of rings)for(let j=0;j<segments;j++){
  const angle=j/segments*Math.PI*2;vertices.push(Math.cos(angle)*width,y,z+Math.sin(angle)*depth);
 }
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){
  const a=i*segments+j,b=i*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(skier,geo,material,0,0,0);
}
tailoredBody([[.84,.12,.21,.13],[.98,.11,.23,.15],[1.17,.02,.245,.155],[1.40,-.09,.29,.16],[1.48,-.12,.23,.13],[1.53,-.13,.09,.08]],orange);
tailoredBody([[.77,.14,.19,.12],[.86,.13,.22,.14],[.96,.10,.21,.14]],navy);
for(const side of [-1,1]){
 const shape=new T.Shape();shape.moveTo(-.075,.8);shape.lineTo(-.085,-.9);shape.quadraticCurveTo(0,-1.18,.085,-.9);shape.lineTo(.075,.8);shape.closePath();
 const geo=new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.01});geo.rotateX(Math.PI/2);
 const ski=mesh(skier,geo,mat('#df7047'),side*.21,.055,0);ski.rotation.y=-.04;skier.userData[side<0?'leftSki':'rightSki']=ski;
 mesh(skier,box,navy,side*.21,.22,-.01,.18,.20,.36);
 mesh(skier,box,mat('#55616b'),side*.21,.33,.04,.16,.22,.18);
 const ankle=new T.Vector3(side*.21,.37,.04),knee=new T.Vector3(side*.22,.61,-.22),hip=new T.Vector3(side*.145,.86,.13);
 const shin=limb(ankle,knee,.085,.105,navy),thigh=limb(knee,hip,.105,.13,navy);shin.name=`shin-${side}`;thigh.name=`thigh-${side}`;shin.userData.restLength=knee.distanceTo(ankle);thigh.userData.restLength=hip.distanceTo(knee);
 const shoulder=new T.Vector3(side*.265,1.40,-.10),elbow=new T.Vector3(side*.40,1.15,-.19),hand=new T.Vector3(side*.43,1.06,-.47);
 limb(elbow,shoulder,.085,.11,orange);limb(hand,elbow,.065,.085,orange);
 mesh(skier,box,navy,...hand.toArray(),.115,.14,.14);
 beam(skier,hand,new T.Vector3(side*.70,.05,.86),.012,mat('#586773'));
 mesh(skier,new T.CylinderGeometry(.055,.055,.012,10),navy,side*.69,.12,.80);
 // Backpack straps follow the forward pitch of the torso.
 beam(skier,new T.Vector3(side*.16,1.43,.035),new T.Vector3(side*.14,1.02,.24),.025,navy);
}
mesh(skier,new T.CylinderGeometry(.075,.085,.13,12),mat('#b58e74'),0,1.55,-.15);
const helmet=mesh(skier,new T.SphereGeometry(1,20,14),mat('#304a5b'),0,1.69,-.20,.155,.185,.18);helmet.rotation.x=-.12;
mesh(skier,box,mat('#b5c8d0',{metalness:.4,roughness:.25}),0,1.70,-.367,.25,.075,.025);
// Compact fabric pack with flat panels and subtly beveled corners.
const packShape=new T.Shape();packShape.moveTo(-.13,-.17);packShape.lineTo(.13,-.17);packShape.quadraticCurveTo(.16,-.17,.16,-.12);packShape.lineTo(.16,.15);packShape.quadraticCurveTo(.16,.20,.11,.20);packShape.lineTo(-.11,.20);packShape.quadraticCurveTo(-.16,.20,-.16,.15);packShape.lineTo(-.16,-.12);packShape.quadraticCurveTo(-.16,-.17,-.13,-.17);
const pack=mesh(skier,new T.ExtrudeGeometry(packShape,{depth:.075,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2,steps:1}),navy,0,1.23,.17);pack.rotation.x=-.35;

const body=new T.Group();for(const child of [...skier.children])if(child!==skier.userData.leftSki&&child!==skier.userData.rightSki)body.add(child);skier.add(body);skier.userData.body=body;return skier;
}
function treeModel(){
 // One shared silhouette at every distance avoids visible LOD transitions.
 const model=buildTree('fir',{detail:'near',originalFir:true});model.scale.setScalar(.58);
 model.traverse(o=>{if(o.geometry)owned.add(o.geometry);if(o.material)mats.set(`fir-${o.id}`,o.material);});
 // Preserve the asset's base scale when gameplay varies instance sizes.
 const group=new T.Group();group.add(model);return group;
}
const skierTemplates=new Map();
function skierModel(color){
 if(!skierTemplates.has(color)){
  const model=buildSkier(color);for(const key of ['body','leftSki','rightSki'])model.userData[key].name=key;
  model.userData={};skierTemplates.set(color,model);
 }
 const model=skierTemplates.get(color).clone(true);for(const key of ['body','leftSki','rightSki'])model.userData[key]=model.getObjectByName(key);return model;
}
const trees=treeModel(),rocks=Array.from({length:6},rockModel);
return {mountains,skier:skierModel,tree:()=>trees.clone(true),rock:seed=>rocks[Math.floor(Math.abs(seed||0)*6)%6].clone(true),dispose(){
 const geometries=new Set([box,ball,cylinder,...owned]);for(const root of [trees,...rocks])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
}};
}
export function createSnowMaterial(){
 const size=256,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
 const value=170+Math.sin(u*3+Math.sin(v*2))*16+Math.sin(v*5+Math.sin(u*4))*9+Math.sin(u*71+v*53)*4+Math.sin(u*47-v*83)*3;
 const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 const bump=new T.DataTexture(data,size,size);bump.wrapS=bump.wrapT=T.RepeatWrapping;bump.magFilter=T.LinearFilter;bump.minFilter=T.LinearMipmapLinearFilter;bump.generateMipmaps=true;bump.needsUpdate=true;
 const material=new T.MeshStandardMaterial({vertexColors:true,bumpMap:bump,bumpScale:.07,roughness:.94});
 material.onBeforeCompile=shader=>{
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 snowPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nsnowPosition=position;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 snowPosition;').replace('#include <color_fragment>',`#include <color_fragment>
 float drift=sin(snowPosition.x*.63+sin(snowPosition.z*.31))*sin(snowPosition.z*.47+snowPosition.x*.18);
 diffuseColor.rgb*=mix(vec3(.94,.96,.98),vec3(1.),smoothstep(-.8,.8,drift));
 `);
 };
 return material;
}
