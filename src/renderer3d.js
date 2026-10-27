import * as THREE from 'three';
import {gloveGeometry} from './first-person-glove.js';
import {createAlpineAssets,createSnowMaterial} from './alpine-assets.js';
import {route,branchAt,clamp,FINISH_Z,sectionAt} from './game.js';
const S=.025;
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function mountainHeight(x,z){
 const fork=branchAt(z),distance=Math.min(Math.abs(x-route(z)),fork?Math.abs(x-fork.x):Infinity);
 const bank=clamp((distance-130)/650,0,1);
 // Visual grade only: gameplay speed, steering and collision coordinates stay unchanged.
 return -z*.42+12*Math.sin(z/520)+5*Math.sin(z/240)+bank*bank*(85+45*Math.sin(x/340+z/850));
}
export class Renderer3D {
 constructor(container,{rendererFactory=()=>new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})}={}){
  this.view='third';this.lean=0;this.turnView=0;this.trails=[];this.spray=[];this.camera=0;this.tiles=new Map();this.objects=new Map();this.lastTrack=-Infinity;
  this.webgl=rendererFactory();
  this.webgl.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));this.webgl.shadowMap.enabled=true;this.webgl.shadowMap.type=THREE.PCFSoftShadowMap;
  this.webgl.outputColorSpace=THREE.SRGBColorSpace;this.webgl.toneMapping=THREE.ACESFilmicToneMapping;this.webgl.toneMappingExposure=1.05;
  this.webgl.domElement.setAttribute('aria-label','Three-dimensional downhill ski course');container.append(this.webgl.domElement);
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e2e5e5');this.scene.fog=new THREE.Fog('#d6dcde',65,145);
  this.root=new THREE.Group();this.scene.add(this.root);
  this.eye=new THREE.PerspectiveCamera(48,1,.1,220);
  this.scene.add(new THREE.HemisphereLight('#dbeeff','#667c91',1.15));
  this.sun=new THREE.DirectionalLight('#ffe4b5',3.5);this.sun.position.set(-22,35,15);this.sun.castShadow=true;
  Object.assign(this.sun.shadow.camera,{left:-30,right:30,top:38,bottom:-28,near:1,far:100});this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00015;
  this.sun.target.position.set(0,0,-10);this.scene.add(this.sun,this.sun.target);
  this.materials=new Map();this.geometries=new Map();this.alpine=createAlpineAssets();this.snowMaterial=createSnowMaterial();
  this.skier=this.makeSkier('#e56b45');this.root.add(this.skier);
  this.scene.add(this.eye);this.firstSkis=new THREE.Group();this.root.add(this.firstSkis);
  for(const side of [-1,1]){
   const ski=new THREE.Group();ski.position.x=side*.18;this.firstSkis.add(ski);
   const vertices=[],indices=[],segments=28;
   for(let i=0;i<=segments;i++){
    const t=i/segments,z=1.15-t*2.45;
    const tip=Math.max(0,(t-.79)/.21),tail=Math.max(0,(.09-t)/.09);
    const width=(.066+.018*Math.pow(Math.abs(t-.48)*2,1.4))*Math.sqrt(Math.max(.015,1-tip*tip*.98));
    const y=.14*tip*tip+.025*tail*tail;
    vertices.push(-width,y,z,width,y,z);
    if(i<segments){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();this.geometries.set(`shaped-ski-${side}`,geo);
   const top=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#2452df',roughness:.35,metalness:.15,side:THREE.DoubleSide}));this.materials.set(`ski-top-${side}`,top.material);ski.add(top);
   const edges=[];for(let i=0;i<segments;i++)for(const edge of [0,1]){const j=(i*2+edge)*3,k=((i+1)*2+edge)*3;edges.push(...vertices.slice(j,j+3),...vertices.slice(k,k+3));}
   const edgeGeo=new THREE.BufferGeometry();edgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));this.geometries.set(`ski-edges-${side}`,edgeGeo);
   const edgeMat=new THREE.LineBasicMaterial({color:'#c6d2d8'});this.materials.set(`ski-edge-${side}`,edgeMat);ski.add(new THREE.LineSegments(edgeGeo,edgeMat));
   this.mesh(ski,'box','#203c4c',0,.009,-.45,.035,.008,.65);
   this.mesh(ski,'box','#ecdfcb',0,.012,-.72,.085,.008,.045);
  }
  this.firstHands=new THREE.Group();this.eye.add(this.firstHands);this.handGrips=[];
  for(const side of [-1,1]){
   const hand=new THREE.Group();hand.position.set(side*.56,-.36,-1.05);this.firstHands.add(hand);this.handGrips.push(hand);
   hand.scale.setScalar(.73);
   const glove=gloveGeometry(side);this.geometries.set(`first-glove-${side}`,glove);
   const palm=new THREE.Mesh(glove,this.material('#344651'));palm.name='refined-glove';hand.add(palm);
   this.mesh(hand,'pole','#192c36',0,.012,-.018,.023,.23,.023);
   const shaft=this.mesh(hand,'pole','#8b9ca4',0,-.51,-.018,.009,.86,.009);shaft.rotation.z=side*.10;
   this.mesh(hand,'pole','#344955',side*.043,-.91,-.018,.052,.012,.052);
  }
  this.firstHands.traverse(part=>{part.castShadow=false;part.receiveShadow=false;});
  // Apply the approved length to the top sheet, edge trim and graphics together.
  for(const ski of this.firstSkis.children)for(const part of ski.children){
   const a=part.geometry?.attributes.position;if(!a)continue;
   // Box accents share cached geometry, so give each its own stretched copy.
   part.geometry=part.geometry.clone();this.geometries.set(`extended-ski-${part.id}`,part.geometry);
   const positions=part.geometry.attributes.position;
   for(let i=0;i<positions.count;i++){const z=positions.getZ(i);positions.setZ(i,z>-.7?-.7+(z+.7)*1.65:-.7+(z+.7)*2.1);}
   part.geometry.computeVertexNormals();part.geometry.computeBoundingSphere();
  }
  this.firstSkis.traverse(part=>{part.castShadow=false;});
  for(const key of ['leftSki','rightSki'])this.skier.userData[key].traverse(part=>{part.castShadow=false;});
  this.finishArch=new THREE.Group();for(const side of [-1,1])this.mesh(this.finishArch,'pole','#426575',side*21,2,0,.1,4,.1);this.mesh(this.finishArch,'box','#df6e4a',0,3.7,0,42,.6,.1);
  for(let i=0;i<42;i++)this.mesh(this.finishArch,'box',i%2?'#254c5b':'#f9faf5',i-20.5,.035,0,1,.035,.7);
  this.root.add(this.finishArch);
  this.trackGeometry=new THREE.BufferGeometry();this.trackArray=new Float32Array(190*2*6*3);this.trackGeometry.setAttribute('position',new THREE.BufferAttribute(this.trackArray,3).setUsage(THREE.DynamicDrawUsage));this.trackGeometry.setDrawRange(0,0);
  this.trackLines=new THREE.Mesh(this.trackGeometry,new THREE.MeshBasicMaterial({color:'#9aafba',transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));this.trackLines.frustumCulled=false;this.root.add(this.trackLines);
  this.snowParticles=[];this.snowEmission=0;
  this.snowGeometry=new THREE.BufferGeometry();this.snowPositions=new Float32Array(240*3);this.snowOpacity=new Float32Array(240);
  this.snowGeometry.setAttribute('position',new THREE.BufferAttribute(this.snowPositions,3).setUsage(THREE.DynamicDrawUsage));
  this.snowGeometry.setAttribute('alpha',new THREE.BufferAttribute(this.snowOpacity,1).setUsage(THREE.DynamicDrawUsage));this.snowGeometry.setDrawRange(0,0);
  this.snowParticleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelRatio:{value:Math.min(globalThis.devicePixelRatio||1,1.5)}},vertexShader:`attribute float alpha;varying float fade;uniform float pixelRatio;
  void main(){fade=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(160.*pixelRatio/max(1.,-p.z),3.,32.);}`,fragmentShader:`varying float fade;void main(){float d=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.2,1.,d))*fade;if(a<.01)discard;gl_FragColor=vec4(.91,.97,1.,a);}`});
  this.snowCloud=new THREE.Points(this.snowGeometry,this.snowParticleMaterial);this.snowCloud.frustumCulled=false;this.root.add(this.snowCloud);
  // A small camera-space spray keeps nearby ski-edge snow visible in first person.
  this.nearSnow=new THREE.Points(this.snowGeometry,this.snowParticleMaterial);this.nearSnow.frustumCulled=false;
  this.nearSnowGeometry=new THREE.BufferGeometry();this.nearSnowPositions=new Float32Array(240*3);
  this.nearSnowGeometry.setAttribute('position',new THREE.BufferAttribute(this.nearSnowPositions,3).setUsage(THREE.DynamicDrawUsage));this.nearSnowGeometry.setAttribute('alpha',this.snowGeometry.attributes.alpha);this.nearSnow.geometry=this.nearSnowGeometry;this.eye.add(this.nearSnow);
  this.makeMountains();this.resize(container.clientWidth,container.clientHeight);
 }
 material(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.86,metalness:0}));return this.materials.get(color);}
 geometry(type){if(!this.geometries.has(type))this.geometries.set(type,type==='cone'?new THREE.ConeGeometry(1,1,7):type==='ball'?new THREE.IcosahedronGeometry(1,1):type==='creature'?new THREE.DodecahedronGeometry(1,0):type==='pole'?new THREE.CylinderGeometry(1,1,1,7):new THREE.BoxGeometry(1,1,1));return this.geometries.get(type);}
 mesh(parent,type,color,x,y,z,sx,sy,sz){const m=new THREE.Mesh(this.geometry(type),this.material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 makeSkier(color){return this.alpine.skier(color);}
 tree(){return this.alpine.tree();}
 gate(width){const g=new THREE.Group(),w=width*S;for(const side of [-1,1])this.mesh(g,'pole','#dd5f45',side*w/2,.58,0,.035,1.16,.035);this.mesh(g,'box','#e66c52',0,.93,0,w,.35,.025);this.mesh(g,'box','#f6eee4',0,.96,-.02,w*.6,.045,.012);return g;}
 wildlifeTufts(g,color,cx,cy,cz,count,rx,ry,rz){
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2,cone=this.mesh(g,'cone',i%3===0?'#f4f6f3':color,cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,cz+Math.sin(a*.7)*rz,.12,.42,.12);cone.rotation.z=-Math.cos(a)*.65;cone.rotation.x=Math.sin(a*.7)*.7;}
 }
 wildlife(type){
  const g=new THREE.Group(),yeti=type==='yeti',fur=yeti?'#e8edf0':'#8b542e';g.userData.limbs=[];
  const part=(color,x,y,z,sx,sy,sz)=>this.mesh(g,'ball',color,x,y,z,sx,sy,sz),facet=(color,x,y,z,sx,sy,sz)=>this.mesh(g,'creature',color,x,y,z,sx,sy,sz);
  const limb=(color,x,y,z,sx,sy,sz,pawColor,phase)=>{const joint=new THREE.Group();joint.position.set(x,y,z);g.add(joint);this.mesh(joint,'ball',color,0,-.25,0,sx,sy,sz);if(pawColor)this.mesh(joint,'ball',pawColor,.035,-.48,0,sx*1.18,.14,sz*1.12);g.userData.limbs.push({joint,phase});};
  if(!yeti){
   facet(fur,-.12,.82,0,1.14,.49,.44);facet('#a86c37',.35,1.04,0,.58,.4,.42);part(fur,.72,1.34,0,.45,.42,.39);part('#d6ae7e',1.09,1.18,0,.39,.2,.29);part('#29201c',1.34,1.27,0,.12,.085,.13);
   for(const side of [-1,1]){part(fur,.58,1.72,side*.29,.2,.22,.17);part('#422c23',.68,1.73,side*.33,.11,.14,.1);part('#fff0d2',.94,1.53,side*.245,.13,.14,.075);part('#211a17',1.01,1.53,side*.29,.05,.085,.045);part('#4b2d20',.93,1.7,side*.26,.18,.04,.07);
    limb(fur,-.62,.59,side*.34,.22,.44,.2,'#583625',side<0?Math.PI:0);limb(fur,.48,.63,side*.37,.19,.45,.18,'#583625',side<0?0:Math.PI);}
   this.wildlifeTufts(g,'#724329',[-.12,.95,0],9,.9,.43,.42);
   this.mesh(g,'ball','#704529',-.99,1.02,0,.18,.15,.15);
  }else{
   facet(fur,-.05,1.12,0,.8,1.12,.54);part('#d8e3e7',-.14,1.58,0,.54,.59,.48);part(fur,.22,2.07,0,.46,.5,.41);part('#82b8cb',.66,1.88,0,.27,.32,.34);part('#214452',.88,1.93,0,.12,.08,.15);part('#3e7184',.72,1.69,0,.22,.09,.3);
   for(const side of [-1,1]){part('#9cc9d6',.54,1.78,side*.25,.19,.17,.13);part('#152e39',.65,2.14,side*.29,.06,.08,.05);part('#214452',.64,2.27,side*.29,.15,.045,.07);part(fur,.18,2.37,side*.39,.21,.2,.17);
    limb(fur,-.03,1.4,side*.52,.25,.84,.24,null,side<0?Math.PI:0);limb(fur,-.42,.76,side*.34,.27,.5,.24,'#aec6cf',side<0?0:Math.PI);}
   for(let i=0;i<5;i++)this.mesh(g,'ball',i%2?'#f6f7f4':'#d4e1e5',.12-i*.09,1.75+i*.16,.35,.12,.32,.11);
   this.wildlifeTufts(g,'#f6f7f4',[-.05,1.25,0],16,.68,.82,.5);this.wildlifeTufts(g,'#cedde2',[-.05,1.25,0],12,.74,.74,.54);
  }
  return g;
 }
 makeObject(o){
  let g=new THREE.Group();
  if(o.type==='tree'){g=this.tree();const seed=o.seed||0,base=o.scale||1,width=base*(.85+hash(seed*97)*.3),height=base*(1.25+hash(seed*173)*.65);g.scale.set(width,height,width*(.9+hash(seed*211)*.2));g.rotation.y=(o.seed||0)*Math.PI*2;}
  if(o.type==='rock'){g=this.alpine.rock(o.seed);g.scale.setScalar(o.r*S*.85);}
  if(o.type==='bear'||o.type==='yeti'){g=this.wildlife(o.type);g.scale.setScalar(.82);const tracks=new THREE.Group();tracks.scale.setScalar(1/.82);g.add(tracks);g.userData.tracks=tracks;for(const offset of [-.16,.16]){const x=(o.origin-o.x)*S+offset,z=offset*1.5;this.mesh(tracks,'ball','#b5c8d0',x,.018,z,.1,.025,.065);for(const toe of [-1,0,1])this.mesh(tracks,'ball','#b5c8d0',x+toe*.07,.018,z+.09,.035,.02,.035);}}
  if(o.type==='gate')g=this.gate(o.width);
  if(o.type==='ai'){g=this.makeSkier('#418ca5');g.scale.set(.512,.608,.576);}
  if(o.type==='ramp'){
   const w=o.width*S,length=2.8,geo=new THREE.BufferGeometry(),vertices=[],indices=[],steps=12;
   const base=mountainHeight(o.x,o.z);
   const surface=(x,z)=> (mountainHeight(o.x+x/S,o.z-z/S)-base)*S+.93*Math.pow(1-z/length,2);
   for(let j=0;j<=steps;j++){
    const z=length*(1-j/steps);for(const x of [-w/2,w/2])vertices.push(x,surface(x,z),z);
    if(j<steps){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
   }
   const floor=(x,z)=>(mountainHeight(o.x+x/S,o.z-z/S)-base)*S-.08;
   const wall=(a,b)=>{const n=vertices.length/3;vertices.push(...a,...b,b[0],floor(b[0],b[2]),b[2],a[0],floor(a[0],a[2]),a[2]);indices.push(n,n+1,n+2,n,n+2,n+3);};
   for(let j=0;j<steps;j++){
    const z1=length*(1-j/steps),z2=length*(1-(j+1)/steps);
    wall([-w/2,surface(-w/2,z1),z1],[-w/2,surface(-w/2,z2),z2]);
    wall([w/2,surface(w/2,z2),z2],[w/2,surface(w/2,z1),z1]);
   }
   wall([-w/2,surface(-w/2,0),0],[w/2,surface(w/2,0),0]);
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
   const m=new THREE.Mesh(geo,this.material('#edf5fa'));m.receiveShadow=true;m.castShadow=true;g.add(m);g.userData.ownedGeometry=geo;
   // Blue edge markers and a takeoff stripe make the snow ramp readable.
   for(const side of [-1,1])for(let j=0;j<steps;j++){
    const x=side*w*.47,z1=length*(1-j/steps),z2=length*(1-(j+1)/steps),y1=surface(x,z1)+.02,y2=surface(x,z2)+.02;
    const stripe=this.mesh(g,'box','#4a9ab2',x,(y1+y2)/2,(z1+z2)/2,.065,.022,Math.hypot(z1-z2,y1-y2));stripe.rotation.x=-Math.atan2(y1-y2,z1-z2);
   }
   this.mesh(g,'box','#4a9ab2',0,surface(0,0)+.02,0,w,.035,.10);
   for(const side of [-1,1]){
    const x=side*(w/2+.12),y=surface(x,0);
    this.mesh(g,'pole','#dc7854',x,y+.28,0,.025,.56,.025);
   }

  }
  return g;
 }
 makeMountains(){
  this.mountains=this.alpine.mountains();this.mountains.scale.setScalar(.28);this.mountains.position.set(0,3,0);
  this.mountains.traverse(o=>{if(o.material)o.material.fog=false;});this.scene.add(this.mountains);
 }
 tile(index){
  const z0=index*400,geo=new THREE.BufferGeometry(),positions=[],colors=[],uvs=[],indices=[],nx=72,nz=12;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
   const x=-1800+i*3600/nx,z=z0+j*400/nz;positions.push(x*S,mountainHeight(x,z)*S,-z*S);uvs.push(x*S/10,-z*S/10);
   const b=branchAt(z),d=Math.min(Math.abs(x-route(z)),b?Math.abs(x-b.x):Infinity),grain=hash(i+j*79+index*113)*.025;
   const color=new THREE.Color(d<90?'#f1f7fa':sectionAt(z)==='PINE FOREST'?'#e1ecf0':'#e9f2f7');color.multiplyScalar(1-grain);colors.push(color.r,color.g,color.b);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);}
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
  const g=new THREE.Group(),ground=new THREE.Mesh(geo,this.snowMaterial);ground.receiveShadow=true;g.add(ground);g.userData.ownedGeometry=geo;
  // Decorative forest remains outside the collision course.
  for(let j=0;j<6;j++)for(const side of [-1,1]){const z=z0+hash(index*13+j)*400,x=side*(1000+hash(index*17+j)*500),tree=this.tree();tree.position.set(x*S,mountainHeight(x,z)*S,-z*S);const treeSeed=index*37+j*7+side*3,width=.75+hash(treeSeed)*.65,height=1.25+hash(treeSeed+91)*1.15;tree.scale.set(width,height,width*(.85+hash(treeSeed+43)*.3));tree.rotation.y=hash(index*31+j)*Math.PI*2;g.add(tree);}
  this.root.add(g);this.tiles.set(index,g);
 }
 resize(w,h){this.webgl.setSize(w,h);this.eye.aspect=w/Math.max(h,1);this.eye.updateProjectionMatrix();}
 draw(game,dt,active,steer){
  this.lean+=(steer-this.lean)*(1-Math.exp(-dt*9));
  if(this.lastViewZ!=null&&game.z<this.lastViewZ)this.turnView=0;
  this.lastViewZ=game.z;
  this.turnView+=(clamp(steer,-1,1)-this.turnView)*(1-Math.exp(-dt*4));
  const ground=mountainHeight(game.x,game.z);
  this.root.position.set(-game.x*S,-ground*S,game.z*S);
  const first=Math.floor((game.z-700)/400),last=Math.floor((game.z+3000)/400);
  for(const [id,g] of this.tiles)if(id<first||id>last){this.root.remove(g);g.userData.ownedGeometry.dispose();this.tiles.delete(id);}
  for(let i=first;i<=last;i++)if(!this.tiles.has(i))this.tile(i);
  const visible=new Set(game.objects.filter(o=>o.z>game.z-200&&o.z<game.z+2400));
  for(const [o,g] of this.objects)if(!visible.has(o)){this.root.remove(g);g.userData.ownedGeometry?.dispose();this.objects.delete(o);}
  for(const o of visible){let g=this.objects.get(o);if(!g){g=this.makeObject(o);this.root.add(g);this.objects.set(o,g);}g.position.set(o.x*S,mountainHeight(o.x,o.z)*S,-o.z*S);g.visible=(o.type!=='bear'&&o.type!=='yeti')||o.moving;if(o.type==='ai')this.animateRider(g,o,game.elapsed);if(o.type==='bear'||o.type==='yeti')g.userData.tracks.visible=o.warned&&!o.moving;if(o.type==='tree')g.rotation.z=o.shakeUntil>game.elapsed?Math.sin(game.elapsed*34+(o.seed||0))*Math.min(.12,(o.shakeUntil-game.elapsed)*.12):0;if(o.type==='bear'||o.type==='yeti'){g.rotation.y=o.direction>0?0:Math.PI;const phase=game.elapsed*10.5+(o.phase||0),stride=o.moving?Math.sin(phase):0,effort=Math.min(1,(o.runSpeed||0)/230);g.position.y+=Math.abs(stride)*.045*effort;g.rotation.z=o.moving?Math.sin(phase*2)*.025*effort:0;g.userData.limbs.forEach(({joint,phase:offset})=>joint.rotation.z=o.moving?Math.sin(phase+offset)*.48*effort:0);}}
  // Ride the same curved surface used to draw the ramp, then carry its
  // lip height into the airborne arc rather than dropping back to terrain.
  if(this.previousRampCount!==game.ramps){this.airRampLift=game.ramps>0?.93:0;this.previousRampCount=game.ramps;}
  let rampLift=0,rampPitch=0;
  if(game.jumpTime===0){
   this.airRampLift=0;
   for(const ramp of game.objects){
    if(ramp.type!=='ramp'||Math.abs(game.x-ramp.x)>ramp.width/2)continue;
    const distance=(ramp.z-game.z)*S;
    if(distance>=0&&distance<=2.8){const t=1-distance/2.8;rampLift=.93*t*t;rampPitch=1.86*t/2.8;break;}
   }
  }else {
   const remaining=Math.pow(game.jumpTime/game.jumpDuration,2);
   rampLift=(this.airRampLift||0)*remaining;
   rampPitch=this.airRampLift?1.86/2.8*remaining:0;
  }
  const visualLift=game.jumpHeight*S+rampLift;
  this.skier.position.set(game.x*S,ground*S+visualLift,-game.z*S);this.skier.rotation.y=-this.lean*.25;this.skier.userData.body.rotation.z=-this.lean*.16;this.skier.visible=this.view!=='first';this.firstSkis.visible=this.view==='first';this.firstHands.visible=this.view==='first';
  for(const hand of this.handGrips){
   // Both wrists roll together, matching the physical steering gesture.
   hand.rotation.z=-this.lean*.23;
   hand.position.y=-.36+Math.min(game.jumpHeight*S,.8)*.075;
  }
  this.firstSkis.rotation.y=-this.lean*.25;
  const slope=(mountainHeight(game.x,game.z+20)-mountainHeight(game.x,game.z-20))/40;
  const targetPitch=Math.atan(slope+rampPitch);
  this.ridingPitch=this.ridingPitch==null?targetPitch:this.ridingPitch+(targetPitch-this.ridingPitch)*(1-Math.exp(-dt*14));
  this.skier.rotation.x=this.ridingPitch;
  // Keep skis on the actual slope beneath the standing-height camera.
  const skiZ=game.z+30;
  this.firstSkis.position.set(game.x*S,mountainHeight(game.x,skiZ)*S+visualLift+rampPitch*.75+.012,-skiZ*S);
  this.firstSkis.rotation.x=this.ridingPitch;this.firstSkis.rotation.z=0;
  // Long ski tips reach the ramp before the body. Sample their full length
  // so a convex ramp cannot occlude them while the camera begins its rise.
  let clearance=0;
  const pitch=this.firstSkis.rotation.x;
  for(let localZ=-2.1;localZ<=2.4;localZ+=.15){
   const sampleZ=skiZ-localZ*Math.cos(pitch)/S;
   let snow=mountainHeight(game.x,sampleZ)*S;
   for(const ramp of game.objects){
    const d=(ramp.z-sampleZ)*S;
    if(ramp.type==='ramp'&&Math.abs(game.x-ramp.x)<ramp.width/2&&d>=0&&d<=2.8){const t=1-d/2.8;snow+=.93*t*t;}
   }
   const skiY=this.firstSkis.position.y-localZ*Math.sin(pitch);
   clearance=Math.max(clearance,snow+.025-skiY);
  }
  // Never sink below the ramp, but ease down as the supporting contact
  // shifts from the tips to the middle of the skis.
  if(game.z===0)this.skiClearance=clearance;
  this.skiClearance=Math.max(clearance,(this.skiClearance??clearance)+(clearance-(this.skiClearance??clearance))*(1-Math.exp(-dt*10)));
  this.firstSkis.position.y+=this.skiClearance;
  // Powder effects disabled; retain the smooth snow surface and ski tracks.
  this.snowCloud.visible=false;this.nearSnow.visible=false;
  this.skier.userData.leftSki.rotation.y=-this.lean*.12;this.skier.userData.rightSki.rotation.y=-this.lean*.12;
  if(active&&game.jumpTime===0&&rampLift===0&&game.z-this.lastTrack>7){this.trails.push({x:game.x,z:game.z});this.lastTrack=game.z;}else if(game.jumpTime>0)this.lastTrack=-Infinity;
  this.trails=this.trails.filter(t=>t.z>game.z-850).slice(-190);let n=0;
  for(let i=1;i<this.trails.length;i++){
   const a=this.trails[i-1],b=this.trails[i];if(b.z-a.z>25)continue;
   for(const side of [-8,8]){
    // Narrow snow grooves with real width, visible from both cameras.
    for(const [t,edge] of [[a,-1],[a,1],[b,-1],[a,1],[b,1],[b,-1]]){
     const x=t.x+side+edge*1.3;
     this.trackArray[n++]=x*S;this.trackArray[n++]=mountainHeight(x,t.z)*S+.045;this.trackArray[n++]=-t.z*S;
    }
   }
  }
  this.trackGeometry.attributes.position.needsUpdate=true;this.trackGeometry.setDrawRange(0,n/3);
  if(this.view==='first'){
   const ahead=(mountainHeight(game.x,game.z+28/S)-ground)*S;
   this.eye.position.set(0,2.0+visualLift,.8);
   const yaw=this.turnView*Math.PI/20; // At most nine degrees; keep the horizon level.
   this.eye.lookAt(Math.sin(yaw)*28.8,ahead+.8+visualLift,.8-Math.cos(yaw)*28.8);
  }else{
   const ahead=(mountainHeight(game.x,game.z+14/S)-ground)*S;
   this.eye.position.set(0,10.5+visualLift*.5,13);
   const yaw=this.turnView*Math.PI/30;
   this.eye.lookAt(Math.sin(yaw)*27,ahead+1,13-Math.cos(yaw)*27);
  }
  this.finishArch.visible=FINISH_Z-game.z<2400;this.finishArch.position.set(0,mountainHeight(0,FINISH_Z)*S,-FINISH_Z*S);
  this.mountains.position.x=-game.x*S*.07;
  this.webgl.render(this.scene,this.eye);
 }
 animateRider(g,o,time){
  const phase=time*.85+o.phase,turn=o.side*Math.sin(phase);
  const lateral=(route(o.z+1)-route(o.z-1))*40+o.side*Math.cos(phase)*45*.85;
  // Face the actual travel direction instead of swivelling independently.
  g.rotation.y=-Math.atan2(lateral,80);
  const grade=(mountainHeight(o.x,o.z+10)-mountainHeight(o.x,o.z-10))/20;
  g.rotation.x=Math.atan(grade);
  g.userData.body.rotation.z=turn*.12;
  g.userData.body.rotation.y=-g.rotation.y*.12;
  for(const key of ['leftSki','rightSki'])g.userData[key].rotation.z=turn*.13;
  // Flex the articulated knees as the edges load, then extend on transition.
  const flex=Math.abs(turn)*.065;
  for(const side of [-1,1]){
   const ankle=new THREE.Vector3(side*.21,.37,.04),knee=new THREE.Vector3(side*.22,.61-flex,-.22-flex),hip=new THREE.Vector3(side*.145,.86,.13);
   for(const [name,a,b] of [[`shin-${side}`,ankle,knee],[`thigh-${side}`,knee,hip]]){
    const part=g.getObjectByName(name);if(!part)continue;
    const direction=b.clone().sub(a);part.position.copy(a).add(b).multiplyScalar(.5);
    part.scale.y=direction.length()/part.userData.restLength;
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
   }
  }
 }
 updateSnow(game,dt,active){
  if(this.lastSnowZ!=null&&game.z<this.lastSnowZ){this.snowParticles=[];this.snowEmission=0;this.wasSnowAirborne=false;}
  this.lastSnowZ=game.z;
  if(active){
   const grounded=game.jumpTime===0&&game.jumpHeight<1;
   if(grounded&&this.wasSnowAirborne){
    for(let j=0;j<42;j++){
     const angle=Math.random()*Math.PI*2,spread=.6+Math.random()*1.8;
     this.snowParticles.push({x:game.x*S+Math.cos(angle)*.24,y:mountainHeight(game.x,game.z)*S+.07,z:-game.z*S,vx:Math.cos(angle)*spread,vy:.8+Math.random()*1.1,vz:Math.sin(angle)*spread,life:.45+Math.random()*.25,age:0});
    }
   }
   this.wasSnowAirborne=!grounded;
   const turn=Math.max(0,(Math.abs(this.lean)-.24)/.76);
   if(grounded&&game.speed>0){
    this.snowEmission+=dt*(8+turn*300)*Math.min(1.5,game.speed/300);
    while(this.snowEmission>=1){
     this.snowEmission--;const side=Math.random()<(.5+this.lean*.25)?-1:1,x=game.x*S+side*(.2+turn*.12),z=-game.z*S+(this.view==='first'?-1.55:.05);
     this.snowParticles.push({x,y:mountainHeight(x/S,-z/S)*S+.12,z,vx:side*(.2+turn*(1.8+Math.random()))+this.lean*.3,vy:.55+turn*(1.7+Math.random()*1.4)+Math.random()*.5,vz:-game.speed*S*(.7+turn*.25)+Math.random()*.7,life:.3+Math.random()*.45,age:0});
    }
   }else this.snowEmission=0;
   for(const p of this.snowParticles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=3.5*dt;
    const floor=mountainHeight(p.x/S,-p.z/S)*S+.025;
    if(p.y<floor){p.y=floor;p.vy=0;p.vx*=Math.exp(-dt*6);p.vz*=Math.exp(-dt*6);}
   }
   this.snowParticles=this.snowParticles.filter(p=>p.age<p.life).slice(-240);
  }
  let i=0;for(const p of this.snowParticles){this.snowPositions.set([p.x,p.y,p.z],i*3);this.snowOpacity[i]=.85*(1-p.age/p.life);i++;}
  this.nearSnow.visible=false; // World-space spray now meets the grounded skis.
  for(let j=0;j<this.snowParticles.length;j++){
   const p=this.snowParticles[j],side=p.vx<0?-1:1;
   this.nearSnowPositions.set([side*.22+p.vx*p.age,-.85+Math.sin(p.age/p.life*Math.PI)*.25,-1.5+p.age*1.4],j*3);
  }
  this.nearSnowGeometry.attributes.position.needsUpdate=true;this.nearSnowGeometry.setDrawRange(0,i);
  this.snowGeometry.attributes.position.needsUpdate=true;this.snowGeometry.attributes.alpha.needsUpdate=true;this.snowGeometry.setDrawRange(0,i);
 }
 dispose(){this.nearSnowGeometry.dispose();this.snowGeometry.dispose();this.snowParticleMaterial.dispose();this.webgl.dispose();this.webgl.domElement.remove();for(const g of this.tiles.values())g.userData.ownedGeometry.dispose();for(const g of this.objects.values())g.userData.ownedGeometry?.dispose();for(const g of this.geometries.values())g.dispose();for(const m of this.materials.values())m.dispose();this.snowMaterial?.bumpMap?.dispose();this.snowMaterial?.dispose();this.alpine.dispose();this.trackGeometry.dispose();this.trackLines.material.dispose();}
}
