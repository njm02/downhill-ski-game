import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function buildTree(style,{detail='preview',originalFir=true}={}){
 let seed=style==='pine'?98:style==='fir'?25:11;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const parts={wood:[],dark:[],green:[],snow:[]};
 const distant=detail==='far',game=detail!=='preview';
 const smoothFir=style==='fir'&&!originalFir;
 const needle=smoothFir?new T.SphereGeometry(1,game?(distant?5:8):14,game?(distant?3:5):10):new T.ConeGeometry(1,1,7);
 if(!smoothFir)needle.rotateZ(-Math.PI/2);
 // Soft tapered foliage and broad, settled snow layers for the selected fir study.
 if(smoothFir){const a=needle.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),t=.72-.28*x;a.setXYZ(i,x*.58,a.getY(i)*t,a.getZ(i)*t);}needle.computeVertexNormals();}
 const snow=new T.SphereGeometry(1,smoothFir?(game?(distant?5:8):24):9,smoothFir?(game?(distant?3:5):16):6);
 if(smoothFir){
  // Flatten the crown into a settled blanket with a softly rolled edge,
  // rather than a collection of domed snowballs.
  const a=snow.attributes.position;
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
   a.setY(i,y>=0?Math.sin(y*Math.PI/2)*.72:y*.35);
  }
  snow.computeVertexNormals();
 }
 const obj=new T.Object3D();
 function add(kind,base,x,y,z,sx,sy,sz,angle=0,tilt=0){obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.rotation.set(0,-angle,tilt);obj.updateMatrix();parts[kind].push(base.clone().applyMatrix4(obj.matrix));}
 function branch(a,b,r1,r2){const d=b.clone().sub(a),geo=new T.CylinderGeometry(r2,r1,d.length(),7);geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));geo.translate(...a.clone().add(b).multiplyScalar(.5).toArray());parts.wood.push(geo);}
 const pine=style==='pine',fir=style==='fir',height=pine?5.4:6.4;
 branch(new T.Vector3(0,0,0),new T.Vector3(pine?.24:0,style==='fir'?height-.45:height,0),.15,.018);
 const levels=pine?7:distant?8:12;
 for(let layer=0;layer<levels;layer++){
  const fraction=layer/levels,y=(pine?1.7:.65)+fraction*(height-(pine?1.8:.8));
  const radius=(pine?1.8:fir?1.95:1.55)*Math.pow(1-fraction,.72);
  const offset=rand()*Math.PI*2,count=pine?3:distant?4:5;
  for(let k=0;k<count;k++){
   const angle=offset+k*Math.PI*2/count+rand()*.25,length=radius*(.65+rand()*.45);
   const dx=Math.cos(angle),dz=Math.sin(angle),drop=pine?-.05:.25;
   const start=new T.Vector3(pine?fraction*.24:0,y,0),end=start.clone().add(new T.Vector3(dx*length,-drop*length,dz*length));
   branch(start,end,.045*(1-fraction)+.008,.009);
   const shoots=pine?5:distant?3:7;
   for(let j=0;j<shoots;j++){
    const t=.2+j/(shoots-1)*.8,spread=length*(1-t)*.34+.08;
    for(const side of [-1,1]){
     const a=angle+side*.65,x=start.x+dx*length*t,z=dz*length*t,yy=y-drop*length*t+(rand()-.5)*.09;
     const extent=spread*(.8+rand()*.4);
     add(j%2?'green':'dark',needle,x+Math.cos(a)*extent*.3,yy,z+Math.sin(a)*extent*.3,extent*1.4,pine?.14:fir&&!originalFir?.16:.13,extent*.55,a,-.12);
     // Offset pillows on upper boughs; tapered sizes break up repeated shelves.
     if(rand()<(fir?.88:pine?.42:.57))add('snow',snow,x,yy+.10,z,extent*(smoothFir?1.22:.85),(fir?.12:.065)*(1+rand()*(smoothFir?.12:.5)),extent*(smoothFir?.55:.43),a,-.08);
    }
   }
  }
 }
 if(fir){
  // A small snow-covered crown replaces the conspicuous cone spike.
  add('green',snow,0,height-.50,0,.22,.23,.20);
  add('snow',snow,0,height-.35,0,.24,.12,.21);
 }else{const tip=new T.ConeGeometry(.16,.85,8);tip.translate(pine?.24:0,height-.08,0);parts.green.push(tip);}
 const group=new T.Group();
 const colors={wood:'#756353',dark:'#263e36',green:'#3a5445',snow:'#edf1ef'};
 for(const [key,pieces] of Object.entries(parts)){const geo=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:colors[key],roughness:.95}));mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
 needle.dispose();snow.dispose();return group;
}
