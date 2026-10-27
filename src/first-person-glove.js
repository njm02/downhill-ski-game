import * as T from 'three';
// Approved continuous glove silhouette shared by gameplay and the still study.
export function gloveGeometry(side){
 const positions=[],indices=[],segments=40,rows=36;
 const profiles=[[-.15,.043,.041,.025],[-.10,.050,.045,.018],[-.055,.060,.048,.008],[-.01,.078,.057,0],[.035,.081,.060,-.006],[.070,.073,.055,-.010],[.095,.052,.039,-.010],[.108,.003,.003,-.010]];
 for(let row=0;row<=rows;row++){
  const y=-.15+row/rows*.258;let k=0;while(k<profiles.length-2&&y>profiles[k+1][0])k++;
  const a=profiles[k],b=profiles[k+1],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  const blend=column=>{
   const prev=profiles[Math.max(0,k-1)][column],next=profiles[Math.min(profiles.length-1,k+2)][column];
   return .5*((2*a[column])+(-prev+b[column])*t+(2*prev-5*a[column]+4*b[column]-next)*t*t+(-prev+3*a[column]-3*b[column]+next)*t*t*t);
  };
  const width=Math.max(.003,blend(1)),depth=Math.max(.003,blend(2)),center=blend(3);
  for(let j=0;j<=segments;j++){
   const angle=j/segments*Math.PI*2,c=Math.cos(angle),sn=Math.sin(angle);
   // Thumb folds diagonally across the inner grip, blended into the palm.
   const inner=Math.pow(Math.max(0,-side*c),5);
   const thumb=.020*Math.exp(-Math.pow((y-.025+sn*.023)/.035,2))*inner;
   const thumbFold=.003*Math.exp(-Math.pow((y+.012+sn*.023)/.009,2))*inner;
   const knuckle=.0025*Math.sin(y*175)*Math.exp(-Math.pow((y-.025)/.060,4))*Math.max(0,-sn);
   positions.push(c*(width+thumb-thumbFold),y,center+sn*(depth+knuckle)*(sn>0?.90:1)+thumb*.35);
   if(row<rows&&j<segments){const n=row*(segments+1)+j;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}
