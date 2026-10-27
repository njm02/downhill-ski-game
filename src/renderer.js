import {route,clamp,branchAt,sectionAt,FINISH_Z} from './game.js';

const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

export class Renderer{
 constructor(p){this.p=p;this.view='third';this.eyeLift=0;this.terrainRows=new Map();this.trails=[];this.camera=0;this.worldZ=0;this.groundHeight=0;this.lean=0;this.spray=[];this.sprayEmission=0;}
 // Elevated oblique camera. The player and every world feature share this
 // projection, including terrain elevation, collision markers, and ski tracks.
 elevation(x,z){
  const lateral=x-route(z),fork=branchAt(z),distance=fork?Math.min(Math.abs(lateral),Math.abs(x-fork.x)):Math.abs(lateral),bank=clamp((distance-170)/580,0,1);
  // Broad rollers, cross-slope folds, and steeper powder banks share one surface.
  // Smooth gradients keep upcoming gates visible instead of hiding them behind cliffs.
  const rollers=38*Math.sin(z/390)+18*Math.sin(z/175);
  const folds=16*Math.sin(lateral/240+z/620);
  return rollers+folds+bank*(50+this.p.noise(x*.002,z*.0018)*145);
 }
 project(x,z,height=this.elevation(x,this.worldZ+z)){
 if(this.view==='first'){
  const s=800/(Math.max(-30,z)+160);
  return {x:640+(x-this.camera)*s-this.lean*12,y:180+(90+this.eyeLift-(height-this.groundHeight))*s,s};
 }
 const s=.82*1100/(1100+z*.5);return{x:640+(x-this.camera)*s,y:535-z*.68*s-(height-this.groundHeight)*s,s};}
 poly(points,color){const p=this.p;p.fill(color);p.beginShape();points.forEach(q=>p.vertex(...q));p.endShape(p.CLOSE);}
 terrainRow(z){
  if(this.terrainRows.has(z))return this.terrainRows.get(z);
  const row=[],forest=sectionAt(z)==='PINE FOREST',powder=sectionAt(z)==='POWDER BOWL';
  for(let x=-1900;x<1900;x+=100){
   const height=this.elevation(x,z),dx=(this.elevation(x+30,z)-height)/30,dz=(this.elevation(x,z+30)-height)/30;
   const shade=clamp(dx*25+dz*28,-18,23)+this.p.noise(x*.009,z*.009)*2;
   row.push({vertices:[[x,z],[x+100,z],[x+100,z+100],[x,z+100]].map(([xx,zz])=>[xx,zz,this.elevation(xx,zz)]),color:[239-shade-(forest?9:0),244-shade*.75-(forest?5:0),247-shade*.4+(powder?3:0)]});
  }
  this.terrainRows.set(z,row);return row;
 }
 terrain(game){
 const p=this.p,step=100,start=Math.floor((game.z-400)/step)*step;
 p.noStroke();p.background('#e6edf3');if(this.view==='first')this.sky();
 // Cache world-space geometry and lighting; only projection changes per frame.
 for(const z of this.terrainRows.keys())if(z<start||z>start+2200)this.terrainRows.delete(z);
 for(let wz=start+2200;wz>=start;wz-=step){
  if(this.view==='first'&&wz+100<game.z-30)continue;
  for(const tile of this.terrainRow(wz)){
   const points=tile.vertices.map(([x,z,h])=>this.project(x,z-game.z,h));
   if(points.every(q=>q.x<-150)||points.every(q=>q.x>1430)||points.every(q=>q.y<-130))continue;
   p.fill(...tile.color);p.beginShape();for(const q of points)p.vertex(q.x,q.y);p.endShape(p.CLOSE);
  }
 }
 // Fine wind-sculpted ridges, kept outside the racing line.
 p.noFill();
 for(let i=Math.floor((game.z-250)/110);i<(game.z+1800)/110;i++){
  for(const side of [-1,1]){
   const wz=i*110,x=route(wz)+side*(230+hash(i*7+side)*590),q=this.project(x,wz-game.z);
   p.stroke(181,201,218,28);p.strokeWeight(1.1*q.s);p.beginShape();
   for(let j=-3;j<=3;j++){const pt=this.project(x+j*18,wz-game.z+Math.sin(j*.5)*6);p.curveVertex(pt.x,pt.y);}p.endShape();
  }
 }
 p.noStroke();
 // Very faint old tracks run through the landscape, separate from fresh tracks.
 for(const offset of [-5,5]){p.noFill();p.stroke(173,194,209,40);p.strokeWeight(1);p.beginShape();for(let z=-350;z<1850;z+=30){const wz=game.z+z,q=this.project(route(wz)+150+Math.sin(wz/240)*45+offset,z);p.vertex(q.x,q.y);}p.endShape();}p.noStroke();
 }
 draw(game,dt,active,steer){
 const p=this.p;p.push();p.scale(p.width/1280,p.height/720);
 this.worldZ=game.z;this.groundHeight=this.elevation(game.x,game.z);if(this.view==='first')this.camera=game.x;else this.camera+=(game.x*.48-this.camera)*(1-Math.exp(-dt*2));this.eyeLift=game.jumpHeight*.65;this.lean+=(steer-this.lean)*(1-Math.exp(-dt*9));
 this.terrain(game);
 this.resortGround(game);this.raceGround(game);
 if(active){
  const last=this.trails.at(-1);if(!last||game.z-last.z>3)this.trails.push({x:game.x,z:game.z,airborne:game.jumpTime>0});
  const turn=Math.max(0,(Math.abs(this.lean)-.24)/.76);if(game.jumpTime===0&&turn>0){this.sprayEmission+=dt*(90+turn*260);while(this.sprayEmission>=1){this.sprayEmission--;const side=Math.sign(this.lean);this.spray.push({x:game.x-side*(8+Math.random()*10),z:game.z-4,life:0,vx:-side*(35+turn*(38+Math.random()*38)),vy:32+turn*(48+Math.random()*48),size:2+turn*(3+Math.random()*4)});}}else this.sprayEmission=0;
 }
 this.trails=this.trails.filter(t=>t.z>game.z-900);
 // Shallow double ski grooves with a bright sunward lip.
 for(const side of this.view==='first'?[]:[-6,6]){
  for(const lip of [false,true]){p.noFill();p.stroke(lip?'#ffffffb8':'#a9c2d373');p.strokeWeight(lip?1:2.2);p.beginShape();for(const t of this.trails){if(t.airborne){p.endShape();p.beginShape();continue;}const q=this.project(t.x+side+(lip?1.5:0),t.z-game.z);p.vertex(q.x,q.y);}p.endShape();}
 }
 p.noStroke();
 const objects=game.objects.filter(o=>o.z-game.z>-350&&o.z-game.z<1900).map(o=>({...o,depth:o.z-game.z}));
 // Distant forest stays outside the player's reachable area; it is scenery only.
 for(let i=Math.floor((game.z-350)/135);i<(game.z+1900)/135;i++){
  for(const side of [-1,1])for(let j=0;j<(sectionAt(game.z)==='PINE FOREST'?5:sectionAt(game.z)==='POWDER BOWL'?1:3);j++){
   const seed=hash(i*31+j*11+side*3),x=side*(940+j*120+seed*80),z=i*135+hash(i+j)*110;
   objects.push({type:j===2&&seed>.6?'cliff':'tree',x,depth:z-game.z,scale:1+seed*.5,seed});
  }
 }
 for(let i=Math.floor((game.z-400)/1500);i<(game.z+1900)/1500;i++){
  const z=i*1500+600;
  objects.push({type:'mountain',x:1120,depth:z-game.z,seed:hash(i)});
  objects.push({type:'chalet',x:-980,depth:z+350-game.z});
  for(const side of [-1,1])objects.push({type:'tower',x:side*990,depth:z+(side+1)*350-game.z});
 }
 if(this.view!=='first')objects.push({type:'player',x:game.x,depth:0});objects.sort((a,b)=>b.depth-a.depth);
 for(const o of objects){if(this.view==='first'&&o.depth<0)continue;if((o.type==='bear'||o.type==='yeti')&&!o.moving)continue;const q=this.project(o.x,o.depth);if(q.x<-200||q.x>1480||q.y<-200||q.y>1000){const bonus=o.type==='gate'&&o.bonusX!=null?this.project(o.bonusX,o.depth):null;if(!bonus||bonus.x<-200||bonus.x>1480||bonus.y<-200||bonus.y>1000)continue;}
  p.push();p.translate(q.x,q.y);p.scale(q.s);
  if(o.type==='tree'){if(o.shakeUntil>game.elapsed)p.rotate(Math.sin(game.elapsed*34+(o.seed||0))*Math.min(.12,(o.shakeUntil-game.elapsed)*.12));this.tree(o.scale,o.seed);}
  else if(o.type==='rock'||o.type==='cliff')this.rock(o.type==='cliff'?o.scale*2.8:o.scale,o.seed);
  else if(o.type==='gate'){this.gate(o);if(o.bonusX!=null){p.pop();const b=this.project(o.bonusX,o.depth);p.push();p.translate(b.x,b.y);p.scale(b.s);this.gate({...o,width:o.width-12});p.fill('#b45820');p.textAlign(p.CENTER);p.textSize(13);p.text('EXPERT · 2×',0,-65);}}
  else if(o.type==='bear'||o.type==='yeti')this.wildlife(o,game.elapsed);
  else if(o.type==='ramp')this.ramp();
  else if(o.type==='mountain')this.mountain(o.seed);
  else if(o.type==='chalet')this.chalet();
  else if(o.type==='tower')this.liftTower();
  else this.skier(o.type==='player'?this.lean:Math.sin(game.elapsed+o.phase)*.25,o.type==='player'?'#e56842':'#51809c',o.type==='player'?game.jumpHeight:0);p.pop();
 }
 // Powder spray persists in world space after a carve.
 for(const flake of this.spray){if(this.view==='first'&&flake.z<game.z)continue;if(active){flake.life+=dt;flake.x+=flake.vx*dt;}const q=this.project(flake.x,flake.z-game.z);p.fill(255,255,255,Math.max(0,1-flake.life/.7)*190);p.ellipse(q.x+flake.vx*flake.life*.08,q.y-flake.vy*flake.life*.6,flake.size*q.s*(1+flake.life*1.5),flake.size*q.s*(.7+flake.life));}
 this.spray=this.spray.filter(f=>f.life<.7&&f.z>game.z-350);
 this.lifts(game);
 // Distance haze and a soft sun wash without a visible sky/horizon.
 const ctx=p.drawingContext;const haze=ctx.createLinearGradient(0,0,0,260);haze.addColorStop(0,'rgba(185,207,224,0.28)');haze.addColorStop(1,'rgba(217,230,239,0)');ctx.fillStyle=haze;ctx.fillRect(0,0,1280,260);
 const sun=ctx.createLinearGradient(0,0,1280,720);sun.addColorStop(0,'rgba(255,243,214,0.12)');sun.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=sun;ctx.fillRect(0,0,1280,720);
 if(this.view==='first')this.firstPersonSkis(game);
 p.pop();
 }
 sky(){
  const p=this.p,ctx=p.drawingContext,sky=ctx.createLinearGradient(0,0,0,260);
  sky.addColorStop(0,'#8eb7d1');sky.addColorStop(1,'#e6edf3');ctx.fillStyle=sky;ctx.fillRect(0,0,1280,290);
  for(let layer=0;layer<3;layer++){
   const points=[[-100,310]];
   for(let x=-100;x<=1400;x+=80)points.push([x,140+layer*28-55*hash(x+layer*13)-Math.sin(x*.009+layer)*35]);
   points.push([1400,310]);this.poly(points,['#b7cddd','#cbdce7','#dce7ed'][layer]);
  }
 }
 firstPersonSkis(game){
  const p=this.p;p.push();p.translate(640,720+Math.min(game.jumpHeight*.18,18));p.rotate(this.lean*.045);
  for(const side of [-1,1]){
   p.push();p.translate(side*58+this.lean*16,0);p.rotate(this.lean*.13);
   this.poly([[-20,20],[-14,-155],[-10,-192],[0,-205],[10,-192],[14,-155],[20,20]],'#234652');
   this.poly([[-13,20],[-9,-155],[-6,-188],[0,-196],[6,-188],[9,-155],[13,20]],'#ed7850');
   p.stroke('#fff3df');p.strokeWeight(3);p.line(0,-180,0,-55);p.noStroke();
   p.fill('#183c4a');p.rect(-17,-44,34,64,9);p.fill('#aec7ce');p.rect(-12,-33,24,8,3);p.pop();
  }
  // Pole shafts remain at the edges so they do not obscure the next gate.
  for(const side of [-1,1]){p.stroke('#405c69');p.strokeWeight(5);p.line(side*210,15,side*290,-125);p.noStroke();p.fill('#264c59');p.ellipse(side*280,-110,30,42);}
  p.pop();
 }
 raceGround(game){
  const p=this.p;
  // World-space ribbons make the fork visible well before its first gate.
  for(let z=Math.floor((game.z-300)/50)*50;z<game.z+1900;z+=50){
   const b=branchAt(z),next=branchAt(z+50);
   if(b&&next){for(const [x1,x2,color] of [[route(z),route(z+50),'#d9e9ee90'],[b.x,next.x,'#ebcfaa90']]){
    const a=this.project(x1-55,z-game.z),c=this.project(x1+55,z-game.z),d=this.project(x2+55,z+50-game.z),e=this.project(x2-55,z+50-game.z);
    this.poly([[a.x,a.y],[c.x,c.y],[d.x,d.y],[e.x,e.y]],color);
   }}
  }
  if(sectionAt(game.z)==='SUMMIT RACE')for(let z=Math.floor(game.z/180)*180;z<Math.min(game.z+1800,FINISH_Z-200);z+=180)for(const side of [-1,1]){
   const q=this.project(route(z)+side*105,z-game.z);p.stroke('#e76540');p.strokeWeight(2*q.s);p.line(q.x,q.y,q.x,q.y-32*q.s);p.noStroke();p.fill('#e76540');p.triangle(q.x,q.y-32*q.s,q.x+side*18*q.s,q.y-26*q.s,q.x,q.y-20*q.s);
  }
  for(const start of [4500,13000,22000])if(start-game.z>-200&&start-game.z<1800){
   const q=this.project(route(start),start-game.z);p.push();p.translate(q.x,q.y);p.scale(q.s);p.fill('#234958');p.rect(-110,-90,220,40,4);p.fill('white');p.textAlign(p.CENTER);p.textSize(12);p.text(start===13000?'PISTE ←  /  TRAIL →':'← TRAIL  /  PISTE →',0,-66);p.pop();
  }
  if(FINISH_Z-game.z<1900){
   const q=this.project(0,FINISH_Z-game.z);p.push();p.translate(q.x,q.y);p.scale(q.s);
   p.stroke('#244b59');p.strokeWeight(8);p.line(-850,0,-850,-145);p.line(850,0,850,-145);p.noStroke();p.fill('#e76540');p.rect(-850,-145,1700,50);p.fill('white');p.textAlign(p.CENTER);p.textSize(30);p.text('FINISH · DOWNHILL SKI',0,-110);
   for(let i=0;i<68;i++){p.fill(i%2?'#244b59':'#ffffff');p.quad(-850+i*25,0,-825+i*25,0,-825+i*25,15,-850+i*25,15);}
   for(const side of [-1,1])for(let i=0;i<8;i++){p.push();p.translate(side*(870+i%2*30),-i*18);p.fill(i%2?'#dc6a48':'#478aab');p.ellipse(0,-14,12,22);p.fill('#f4d3b2');p.ellipse(0,-29,9,9);p.pop();}p.pop();
  }
 }
 ramp(){
  const p=this.p;this.poly([[-55,20],[55,20],[48,-38],[-48,-38]],'#c5dce8');
  this.poly([[-48,-38],[48,-38],[48,-52],[-48,-52]],'#f9fdff');
  p.noFill();p.stroke('#4f9fbc');p.strokeWeight(3);
  for(const y of [-5,-22]){p.beginShape();p.vertex(-17,y+8);p.vertex(0,y);p.vertex(17,y+8);p.endShape();}p.noStroke();
 }
 // Resort infrastructure is beyond the reachable x range (±820). Cables
 // cross overhead; their support towers never obstruct the skiing corridor.
 resortGround(game){
  const p=this.p;
  const point=(x,z,h=0)=>{const q=this.project(x,z-game.z);return[q.x,q.y-h*q.s];};
  for(const side of [-1,1]){
   for(let i=Math.floor((game.z-400)/90);i<(game.z+1900)/90;i++){
    const z=i*90,x=side*(865+Math.sin(z/540)*12),nx=side*(865+Math.sin((z+90)/540)*12);
    const net=Math.floor(i/8)%2===0;
    const a=point(x,z),b=point(nx,z+90),at=point(x,z,28),bt=point(nx,z+90,28);
    if(a[0]<-80&&b[0]<-80||a[0]>1360&&b[0]>1360)continue;
    p.stroke('#8ca4b544');p.strokeWeight(2);p.line(...a,a[0]+25,a[1]+16);
    if(net){
     this.poly([a,b,bt,at],'#e67a4926');
     p.stroke('#e47549b0');p.strokeWeight(.8);
     for(let j=0;j<=8;j++){const t=j/8;p.line(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,at[0]+(bt[0]-at[0])*t,at[1]+(bt[1]-at[1])*t);}
     for(let h=4;h<=28;h+=6){const u=point(x,z,h),v=point(nx,z+90,h);p.line(...u,...v);}
    }else{
     p.stroke('#8c7d6c');p.strokeWeight(3);
     for(const h of [10,24])p.line(...point(x,z,h),...point(nx,z+90,h));
     p.stroke('#f9fcfa');p.strokeWeight(1.5);p.line(...point(x,z,26),...point(nx,z+90,26));
    }
    p.stroke(net?'#d96a43':'#726d61');p.strokeWeight(3);p.line(...a,...point(x,z,33));p.noStroke();
    if(i%9===0){p.push();p.translate(...point(x,z,36));p.scale(this.project(x,z-game.z).s);p.fill('#417d96');p.rect(-17,-12,34,16,2);p.fill('#fcfcf2');p.textAlign(p.CENTER,p.CENTER);p.textSize(7);p.text('PISTE 01',0,-4);p.pop();}
   }
  }
  // Grooming marks on an outer service track; soft, world-anchored corduroy.
  p.noFill();p.stroke('#a7becd24');p.strokeWeight(.65);
  for(let lane=0;lane<12;lane++){
   p.beginShape();for(let z=-350;z<1900;z+=60){const q=this.project(-760+lane*5,z);p.vertex(q.x,q.y);}p.endShape();
  }p.noStroke();
 }
 mountain(seed){
  const p=this.p;p.push();p.scale(1+seed*.3);
  this.poly([[-160,20],[-120,-90],[-60,-130],[-15,-235],[45,-165],[90,-180],[165,-48],[210,20]],'#a0b4c2');
  this.poly([[-15,-235],[45,-165],[90,-180],[165,-48],[210,20],[20,-30]],'#7c96a8');
  this.poly([[-160,20],[-120,-90],[-60,-130],[-15,-235],[5,-170],[-20,-125],[-12,-100],[-60,-62],[-80,-20]],'#edf4f6');
  this.poly([[-15,-235],[45,-165],[90,-180],[123,-112],[88,-135],[65,-116],[39,-140],[12,-122],[5,-170]],'#e1ecf2');
  this.poly([[-60,-62],[-12,-100],[20,-30],[100,10],[-80,35]],'#d4e2eb');
  p.stroke('#566f833b');p.strokeWeight(2);p.line(45,-151,76,-70);p.line(105,-111,142,-42);p.noStroke();p.pop();
 }
 chalet(){
  const p=this.p;
  this.poly([[-70,0],[66,14],[155,58],[60,65]],'#8ba4b739');
  this.poly([[-65,-8],[35,8],[35,-48],[-65,-62]],'#9a7b60');
  this.poly([[35,8],[80,-12],[80,-65],[35,-48]],'#715e51');
  for(let y=-53;y<-8;y+=9){p.stroke('#644e433f');p.strokeWeight(1);p.line(-65,y,35,y+14);}p.noStroke();
  this.poly([[-80,-60],[-15,-108],[96,-76],[39,-38]],'#f6faf8');
  this.poly([[-15,-108],[96,-76],[88,-69],[38,-48]],'#d2e1e9');
  this.poly([[-80,-60],[39,-38],[39,-32],[-80,-54]],'#c1cfd4');
  for(const x of [-48,-17]){p.fill('#3a5a6d');p.rect(x,-42,17,21);p.stroke('#e6c494');p.strokeWeight(2);p.line(x+8,-42,x+8,-21);p.line(x,-31,x+17,-31);p.noStroke();}
  this.poly([[9,4],[25,7],[25,-25],[9,-28]],'#514c46');
  this.poly([[48,-26],[68,-34],[68,-51],[48,-43]],'#adc9d7');
  this.poly([[-6,-90],[5,-87],[5,-121],[-6,-123]],'#8b9395');
  this.poly([[-9,-123],[7,-121],[10,-125],[-7,-128]],'#f4f7f5');
  p.fill('#e8ece7');p.rect(-55,-11,70,11,2);p.fill('#497084');p.textAlign(p.CENTER,p.CENTER);p.textSize(7);p.text('NORTH RIDGE',-20,-5);
 }
 liftTower(){
  const p=this.p;this.poly([[-9,3],[11,8],[134,82],[145,77],[14,-4]],'#829cb43b');
  this.poly([[-12,5],[11,8],[16,-2],[-7,-7]],'#c1cdd2');
  this.poly([[-5,0],[5,0],[3,-430],[-3,-430]],'#758c99');
  this.poly([[-3,-430],[0,-430],[0,0],[-5,0]],'#b4c6cd');
  p.stroke('#566f7c');p.strokeWeight(5);p.line(-25,-430,25,-430);p.strokeWeight(2);p.line(-19,-430,-3,-400);p.line(19,-430,3,-400);
  for(const side of [-1,1])for(let i=0;i<3;i++){p.noStroke();p.fill('#435a68');p.ellipse(side*(14+i*5),-432,5,5);}
  p.stroke('#c3d0d6');p.strokeWeight(1);for(let y=-12;y>-420;y-=10)p.line(-3,y,3,y);p.noStroke();
 }
 lifts(game){
  const p=this.p;
  for(let i=Math.floor((game.z-1100)/1500);i<(game.z+1900)/1500;i++){
   const base=i*1500+600;
   const cabinPoint=(t,lane)=>{const x=-990+1980*t+lane*15,z=base+700*t;const q=this.project(x,z-game.z);return {...q,depth:z-game.z,x:q.x,y:q.y-(432-Math.sin(t*Math.PI)*30)*q.s};};
   if(base-game.z>1900||base+700-game.z< -350)continue;
   // Two cable directions with a shallow catenary sag.
   for(const lane of [-1,1]){
    p.noFill();p.stroke('#4c6577a0');p.strokeWeight(1.2);p.beginShape();for(let j=0;j<=40;j++){const q=cabinPoint(j/40,lane);p.vertex(q.x,q.y);}p.endShape();p.noStroke();
    for(let j=0;j<4;j++){
     const t=((j/4+(lane<0?.125:0)+game.elapsed*.009*lane)%1+1)%1,q=cabinPoint(t,lane);
     if((this.view==='first'&&q.depth<0)||q.x< -80||q.x>1360||q.y< -80||q.y>800)continue;
     p.push();p.translate(q.x,q.y);p.scale(q.s);
     p.stroke('#536b79');p.strokeWeight(2);p.line(0,0,0,13);p.line(0,13,6,18);p.noStroke();
     if(i%2===0){
      // Enclosed gondola, glass panes and a snowy roof.
      this.poly([[-15,18],[12,16],[18,23],[17,42],[-10,45],[-16,37]],'#d56448');
      this.poly([[12,16],[18,23],[17,42],[11,39]],'#a94635');
      this.poly([[-12,22],[10,20],[10,33],[-11,35]],'#35586c');
      this.poly([[12,21],[16,24],[15,34],[12,33]],'#9ab9c9');
      p.stroke('#94b8c7');p.strokeWeight(1);p.line(-2,21,-2,34);p.line(-10,24,7,22);p.noStroke();
      this.poly([[-17,18],[-11,14],[12,13],[18,18]],'#f1f6f5');
     }else{
      // Open chairlift with safety bar and tiny riders.
      p.stroke('#526c7a');p.strokeWeight(2);p.line(-14,17,-14,36);p.line(14,17,14,36);p.line(-14,17,14,17);p.strokeWeight(4);p.line(-13,33,13,33);
      for(const x of [-6,6]){p.stroke(x<0?'#d47046':'#527e96');p.strokeWeight(5);p.line(x,24,x,31);p.noStroke();p.fill('#e7ece8');p.ellipse(x,21,6);p.stroke('#3d5365');p.strokeWeight(2);p.line(x-2,33,x-3,44);p.line(x+2,33,x+1,44);p.line(x-5,45,x+4,45);}
      p.stroke('#8095a0');p.strokeWeight(2);p.line(-14,29,14,29);p.noStroke();
     }p.pop();
    }
   }
  }
 }
 tree(scale=1,seed=.5){
 const p=this.p;p.push();p.scale(scale*.82);
 // A softly layered, elongated silhouette anchors the tree to the snow.
 for(let pass=2;pass>=0;pass--){p.push();p.translate(pass*2,pass);this.poly([[-15,2],[20,10],[104,65],[123,67],[102,45],[54,18],[3,-5]],pass===0?'#8faac340':'#9db5ca12');p.pop();}
 p.fill('#6d7875');p.quad(-3,3,4,3,5,-27,-3,-27);
 const tiers=5,twist=(seed-.5)*5;
 for(let i=0;i<tiers;i++){
  const y=-10-i*17,w=32-i*5.1,tip=y-37;
  this.poly([[-w,y-2],[-w*.7,y-11],[-w*.5,y-13],[twist,tip],[w*.55,y-16],[w*.7,y-10],[w,y-3],[w*.65,y+1],[w*.35,y-2],[0,y+5],[-w*.35,y+1],[-w*.7,y+2]],'#496d6c');
  this.poly([[twist,tip],[w*.55,y-16],[w*.7,y-10],[w,y-3],[w*.65,y+1],[w*.35,y-2],[0,y+5]],'#35575b');
  this.poly([[-w*.92,y-5],[-w*.55,y-16],[twist,tip],[w*.52,y-17],[w*.84,y-8],[w*.46,y-9],[w*.17,y-6],[-w*.13,y-10],[-w*.4,y-7],[-w*.6,y-11]],'#f5f8f6');
  this.poly([[twist,tip],[w*.52,y-17],[w*.84,y-8],[w*.46,y-9],[w*.17,y-6],[0,y-12]],'#d1e0e7');
  p.stroke('#ffffffb0');p.strokeWeight(1);p.line(-w*.5,y-16,twist,tip);p.noStroke();
 }
 p.pop();
 }
 wildlife(o,time){
 const p=this.p,yeti=o.type==='yeti',fur=yeti?'#e6edf0':'#8b542e',dark=yeti?'#79b6c9':'#d6ae7e',phase=time*10.5+(o.phase||0),stride=o.moving?Math.sin(phase)*7*Math.min(1,(o.runSpeed||0)/230):0;p.push();p.scale(o.direction,1);p.translate(0,-(o.moving?Math.abs(Math.sin(phase*2)) * 2:0));
 p.fill('#8295a255');p.ellipse(0,4,85,15);p.noStroke();if(o.warned&&!o.moving){p.fill('#b5c8d0aa');for(const side of [-1,1]){const x=o.origin-o.x+side*16;p.ellipse(x,1,11,7);for(const toe of [-1,0,1])p.ellipse(x+toe*5,-3,4,4);}}
 if(yeti){p.fill(fur);p.ellipse(-3,-43,54,68);p.ellipse(5,-88,35,37);p.fill(dark);p.ellipse(18,-83,24,22);p.fill('#183946');p.ellipse(20,-89,4,4);p.ellipse(12,-89,4,4);p.fill(fur);for(let i=0;i<8;i++){const x=-30+i*8;p.triangle(x,-51,x+10,-51,x+5,-69-(i%3)*4);}}
 else{p.fill(fur);p.ellipse(-8,-31,76,34);p.ellipse(24,-55,36,35);p.fill(dark);p.ellipse(42,-48,22,16);p.fill('#201a17');p.ellipse(51,-51,5,5);p.fill('#fff0d2');p.ellipse(32,-62,6,8);p.fill(fur);p.triangle(10,-68,18,-93,29,-66);}
 p.stroke(fur);p.strokeWeight(yeti?9:8);const legs=yeti?[-20,13]:[-30,13];legs.forEach((x,i)=>{const swing=o.moving?Math.sin(phase+(i%2)*Math.PI)*7:0;p.line(x,-27,x+swing,-2);p.line(x+swing,-2,x+swing+7,0);});if(yeti){p.line(-22,-60,-25-stride,-30);p.line(17,-60,20+stride,-30);}p.noStroke();p.pop();
 }
 rock(scale=1,seed=.5){
 const p=this.p;p.push();p.scale(scale);this.poly([[-22,4],[10,15],[52,27],[66,21],[24,-5]],'#8faac333');
 this.poly([[-27,-2],[-23,-16],[-9,-27],[9,-30],[27,-15],[29,1],[10,9],[-12,5]],'#9babb5');
 this.poly([[9,-30],[27,-15],[29,1],[10,9],[4,-7]],'#738994');
 this.poly([[-23,-16],[-9,-27],[9,-30],[27,-15],[14,-16],[7,-12],[-4,-16],[-15,-11]],'#fafcfa');
 this.poly([[9,-30],[27,-15],[14,-16],[7,-12],[4,-20]],'#dae5eb');
 p.stroke('#677f8d55');p.strokeWeight(1);p.line(4,-7,10,5);p.line(-19,-4,-10,-8);p.noStroke();
 p.fill('#f8fbfa');p.ellipse(-13,4,25,6);p.pop();
 }
 gate(o){
 const p=this.p,half=o.width/2;
 this.poly([[-half,0],[-half+28,17],[half+28,17],[half,0]],'#8faac31a');
 for(const side of [-1,1]){const x=side*half;p.stroke('#8da6ba70');p.strokeWeight(1.5);p.line(x,0,x+29,18);p.stroke('#d95143');p.strokeWeight(2);p.line(x,0,x,-38);p.noStroke();p.fill('#ffffff');p.ellipse(x,0,6,2);}
 this.poly([[-half,-36],[0,-33],[half,-36],[half,-23],[0,-20],[-half,-23]],'#e25a49');
 this.poly([[0,-33],[half,-36],[half,-23],[0,-20]],'#cf4f43');
 p.stroke('#ffb6a18a');p.strokeWeight(1);p.line(-half,-35,0,-32);p.line(0,-32,half,-35);p.noStroke();
 this.poly([[-6,-25],[0,-31],[6,-25],[1,-26],[0,-28],[-2,-26]],'#fff8eb');
 }
 skier(lean,color,height=0){
 const p=this.p;p.push();p.scale(.8);
 this.poly([[-9,3],[13,11],[39,29],[53,25],[29,9],[5,-5]],'#819fb044');
 p.translate(0,-height/.8);
 p.push();p.rotate(lean*.23);
 // Raised curved ski tips, bindings, bent knees and compact downhill posture.
 for(const side of [-1,1]){p.stroke('#325264');p.strokeWeight(4);p.line(side*8,-16,side*10,23);p.stroke('#f09260');p.strokeWeight(2);p.line(side*8,-17,side*10,20);p.noFill();p.stroke('#325264');p.arc(side*8,-17,4,7,p.PI,p.TWO_PI);}
 p.stroke('#263e51');p.strokeWeight(6);p.line(-8,4,-10,-10);p.line(-10,-10,-4,-20);p.line(8,4,9,-10);p.line(9,-10,4,-20);p.stroke('#6a8393');p.strokeWeight(2);p.line(-8,3,-9,-3);p.line(8,3,8,-3);p.noStroke();
 p.translate(lean*6,0);
 this.poly([[-11,-15],[-14,-32],[-6,-39],[7,-38],[14,-30],[10,-14],[1,-11]],color);
 this.poly([[1,-35],[7,-38],[14,-30],[10,-14],[1,-11]],'#b84b39');
 this.poly([[-7,-32],[3,-33],[6,-20],[-5,-19]],'#304f60');
 p.stroke(color);p.strokeWeight(6);p.line(-11,-29,-18,-19);p.line(11,-29,19,-21);
 p.stroke('#5c7788');p.strokeWeight(1.2);p.line(-18,-19,-28,12);p.line(19,-21,29,9);p.strokeWeight(3);p.line(-30,12,-25,12);p.line(27,9,32,9);p.noStroke();
 p.fill('#213a50');p.ellipse(-18,-19,5,6);p.ellipse(19,-21,5,6);
 p.fill('#f8faf6');p.ellipse(0,-39,17,17);p.fill('#d7e3e9');p.arc(0,-39,17,17,-p.HALF_PI,p.HALF_PI);p.fill('#263f52');p.ellipse(1,-35,15,7);p.fill('#e5ae69');p.ellipse(4,-36,7,3);
 p.pop();p.pop();
 }
}
