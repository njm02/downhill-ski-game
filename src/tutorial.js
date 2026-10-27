// A quick orientation check, intentionally more forgiving than in-race input.
export class WebcamTutorial {
 constructor(){this.reset();}
 reset(){this.step='calibrate';this.hold=0;this.completed=[];this.samples=[];this.time=0;}
 update(dt,{calibrated,tracked,steering,jump,wrists}){
  if(!calibrated){this.reset();return false;}
  if(dt<=0)return false;
  this.time+=Math.min(dt,.05);
  if(this.step==='calibrate')this.step='left';
  if(this.step==='done')return true;
  if(wrists){this.samples.push({t:this.time,l:wrists.Left.y,r:wrists.Right.y});this.samples=this.samples.filter(s=>this.time-s.t<.7);}else this.samples=[];
  const up=wrists&&this.samples.some(s=>s.l-wrists.Left.y>.025&&s.r-wrists.Right.y>.025);
  const valid=this.step==='jump'?(jump||up):tracked&&(this.step==='left'?steering<-.14:steering>.14);
  if(valid){this.completed.push(this.step);this.step=this.step==='left'?'right':this.step==='right'?'jump':'done';this.hold=0;}
  return this.step==='done';
 }
}
