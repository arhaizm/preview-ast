(() => {
  "use strict";
  const machine = document.querySelector(".hero-machine");
  const photo = machine?.querySelector(".lift");
  if (!machine || !photo) return;

  // Geometry in the original 1536 × 1024 photograph plane.
  // The fixed occlusion paths keep axle, headlights, steps and fenders above the tyres.
  const geometry = [
    {name:"far", cx:622, cy:807, rx:73, ry:128, depth:85, pitch:.292, box:[456,665,244,273],
      cut:"M604 662 L704 662 704 779 655 776 652 724 607 723 Z M598 777 Q595 798 600 826 L704 832 704 775 Z"},
    {name:"near", cx:1021, cy:817, rx:82, ry:145, depth:87, pitch:.287, box:[849,670,258,296],
      cut:"M849 668 L999 668 1030 663 1021 654 849 654 Z"},
    {name:"rear", cx:1418, cy:798, rx:63, ry:126, depth:84, pitch:.308, box:[1269,664,217,263],
      cut:"M1267 661 H1369 Q1353 678 1341 700 L1323 710 1306 710 1304 824 1267 826 Z"}
  ];
  const plane = document.createElement("div");
  plane.className = "wheel-plane";
  plane.setAttribute("aria-hidden","true");
  machine.append(plane);
  let source = null, parts = [], frame = 0, scale = 0, lastWidth = 0, lastHeight = 0;

  function protectedArea(spec) {
    const [x,y,w,h] = spec.box;
    const mask = document.createElement("canvas");
    mask.width=w; mask.height=h;
    const ctx = mask.getContext("2d");
    ctx.translate(-x,-y);
    ctx.fill(new Path2D(spec.cut));
    return ctx.getImageData(0,0,w,h).data;
  }
  function blocked(wheel,x,y) {
    const [left,top,w,h]=wheel.spec.box;
    const xx=Math.round(x)-left, yy=Math.round(y)-top;
    return xx<0 || yy<0 || xx>=w || yy>=h || wheel.mask[(yy*w+xx)*4+3]>30;
  }
  function sourceIndex(x,y) { return (Math.round(y)*1536+Math.round(x))*4; }
  function setupWheel(spec, resolution) {
    const [left,top,w,h]=spec.box;
    const canvas=document.createElement("canvas");
    canvas.dataset.wheel=spec.name;
    canvas.dataset.radius=String(spec.ry);
    canvas.dataset.angleDeg="0";
    canvas.width=Math.max(1,Math.round(w*resolution));
    canvas.height=Math.max(1,Math.round(h*resolution));
    Object.assign(canvas.style,{left:left/1536*100+"%",top:top/1024*100+"%",width:w/1536*100+"%",height:h/1024*100+"%"});
    const ctx=canvas.getContext("2d");
    const wheel={spec,canvas,ctx,mask:protectedArea(spec),pixels:ctx.createImageData(canvas.width,canvas.height),face:[],belt:[]};
    for(let row=0;row<canvas.height;row++) {
      const y=top+(row+.5)*h/canvas.height;
      const ny=(y-spec.cy)/spec.ry;
      if(Math.abs(ny)>=.975) continue;
      const cos=Math.sqrt(1-ny*ny);
      for(let col=0;col<canvas.width;col++) {
        const x=left+(col+.5)*w/canvas.width;
        if(blocked(wheel,x,y)) continue;
        const nx=(x-spec.cx)/spec.rx;
        const radius2=nx*nx+ny*ny;
        const out=(row*canvas.width+col)*4;
        const base=sourceIndex(x,y);
        if(source[base+3]<220) continue;
        if(radius2<.95) {
          const alpha=Math.min(1,(.95-radius2)/.09);
          wheel.face.push({nx,ny,out,base,alpha});
        } else {
          const distance=spec.cx-spec.rx*cos-x;
          const u=distance/spec.depth;
          if(u<=-.035||u>=.965) continue;
          const alpha=Math.min(1,(u+.035)/.12,(.965-u)/.11,(.975-Math.abs(ny))/.13);
          wheel.belt.push({ny,cos,u,out,base,alpha});
        }
      }
    }
    plane.append(canvas);
    return wheel;
  }
  function resize() {
    if(!source) return;
    const width=machine.clientWidth,height=machine.clientHeight;
    if(!width||!height||(lastWidth===width&&lastHeight===height))return;
    lastWidth=width;lastHeight=height;
    scale=Math.min(width/1536,height/1024);
    plane.style.width=(1536*scale)+"px";
    plane.style.height=(1024*scale)+"px";
    const resolution=Math.min(1,Math.max(.22,scale*Math.min(devicePixelRatio||1,1.5)));
    plane.replaceChildren();
    parts=geometry.map(spec=>setupWheel(spec,resolution));
  }

  function drawWheel(wheel,angle) {
    const {spec,pixels}=wheel;
    const out=pixels.data;
    const c=Math.cos(angle),s=Math.sin(angle);
    // Affine inverse rotation in the wheel face plane. Occluded source pixels are
    // replaced only by visible rubber/metal from the opposite side of that same wheel.
    for(const p of wheel.face) {
      const nx=p.nx*c+p.ny*s,ny=p.ny*c-p.nx*s;
      let x=spec.cx+spec.rx*nx,y=spec.cy+spec.ry*ny;
      if(blocked(wheel,x,y)) {
        y=spec.cy-spec.ry*ny;
        if(blocked(wheel,x,y)) {
          x=spec.cx-spec.rx*nx;
          if(blocked(wheel,x,y)){out[p.out+3]=0;continue;}
        }
      }
      const sample=sourceIndex(x,y);
      const alpha=p.alpha*Math.min(1,source[sample+3]/250);
      for(let ch=0;ch<3;ch++) out[p.out+ch]=source[sample+ch];
      out[p.out+3]=Math.round(alpha*255);
    }
    // The visible tyre barrel is a cylindrical projection. Move its photographed
    // chevrons along the surface while retaining the stationary outer silhouette.
    const fraction=(angle/spec.pitch)%1;
    const a=fraction*spec.pitch,b=a-spec.pitch;
    const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
    for(const p of wheel.belt) {
      const ay=spec.cy+spec.ry*(p.ny*ca+p.cos*sa);
      const by=spec.cy+spec.ry*(p.ny*cb+p.cos*sb);
      const ax=spec.cx-spec.rx*(p.cos*ca-p.ny*sa)-spec.depth*p.u;
      const bx=spec.cx-spec.rx*(p.cos*cb-p.ny*sb)-spec.depth*p.u;
      let ia=sourceIndex(ax,ay),ib=sourceIndex(bx,by);
      if(blocked(wheel,ax,ay)||source[ia+3]<230)ia=p.base;
      if(blocked(wheel,bx,by)||source[ib+3]<230)ib=p.base;
      for(let ch=0;ch<3;ch++)out[p.out+ch]=source[ia+ch]*(1-fraction)+source[ib+ch]*fraction;
      out[p.out+3]=Math.round(p.alpha*255);
    }
    wheel.ctx.putImageData(pixels,0,0);
    wheel.canvas.dataset.angleDeg=(angle*180/Math.PI).toFixed(2);
  }
  function finalPose() {
    if(frame)cancelAnimationFrame(frame);
    frame=0;
    plane.hidden=true;
    plane.dataset.phase="rest";
    plane.dataset.distancePx="0";
    for(const w of parts)w.canvas.dataset.angleDeg="0";
  }
  function render() {
    frame=0;
    const state=document.documentElement;
    if(!source||document.hidden||!state.hasAttribute("data-motion-enabled")||!machine.closest(".intro-on")) {finalPose();return;}
    const transform=getComputedStyle(machine).transform;
    const travel=transform==="none"?0:new DOMMatrixReadOnly(transform).m41;
    if(travel<=.1||!scale){finalPose();return;}
    plane.hidden=false;
    plane.dataset.phase="rolling";
    plane.dataset.distancePx=travel.toFixed(2);
    plane.dataset.renderScale=scale.toFixed(5);
    for(const w of parts)drawWheel(w,travel/(scale*w.spec.ry));
    frame=requestAnimationFrame(render);
  }
  function start() {
    if(frame)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(render);
  }
  finalPose();
  machine.addEventListener("animationstart",event=>{if(event.target===machine&&event.animationName==="plant-machine")start();});
  machine.addEventListener("animationend",event=>{if(event.target===machine&&event.animationName==="plant-machine")finalPose();});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)finalPose();else if(machine.closest(".intro-on"))start();});
  new MutationObserver(()=>{if(!document.documentElement.hasAttribute("data-motion-enabled"))finalPose();}).observe(document.documentElement,{attributes:true,attributeFilter:["data-motion-enabled"]});
  async function prepare() {
    try {
      await photo.decode();
      if(photo.naturalWidth!==1536||photo.naturalHeight!==1024) return;
      const buffer=document.createElement("canvas");
      buffer.width=1536;buffer.height=1024;
      const ctx=buffer.getContext("2d",{willReadFrequently:true});
      ctx.drawImage(photo,0,0);
      source=ctx.getImageData(0,0,1536,1024).data;
      resize();
      if("ResizeObserver" in window)new ResizeObserver(resize).observe(machine);
      else window.addEventListener("resize",resize);
      plane.dataset.texture="ready";
      if(machine.closest(".intro-on"))start();
    } catch {finalPose();}
  }
  prepare();
})();