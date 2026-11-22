(() => {
  "use strict";
  const designs = {
    backhoe: {
      angle:8, name:"Передний ковш", clean:"./assets/backhoe-body-clean.png",
      // Two lifting linkages seen in perspective. The rear digging arm is outside every mask.
      parts:[
        {pivot:[555,432],ratio:1.16,d:"M310 656 L319 601 Q327 590 350 597 L398 551 Q386 543 392 530 L513 414 Q523 398 551 399 Q577 400 577 420 L565 445 539 470 512 504 503 608 480 620 468 652Z"},
        {pivot:[913,442],d:"M546 656 L553 624 Q555 609 579 606 L646 550 Q644 536 658 521 L771 406 Q786 396 808 401 Q825 402 825 420 L823 434 901 420 Q923 420 927 431 L925 449 Q915 475 875 489 L826 514 817 557 Q814 571 798 579 L762 609 729 665 676 752 654 767 613 705Z"},
        {pivot:[913,442],d:"M12 904 L81 738 Q105 707 105 686 L98 640 Q94 616 116 614 L151 622 556 640 574 642 Q576 628 596 625 Q618 620 632 642 L655 706 Q676 762 690 825 Q703 886 692 936 Q639 958 527 979 L12 931 5 922Z"}
      ],
      fore:"M1008 620 L1044 625 1021 945 987 956 995 868Z"
    },
    excavator: {
      angle:8.5,name:"Стрела экскаватора",
      parts:[{pivot:[899,570],d:"M0 0 H903 L930 232 940 284 940 315 931 357 922 427 924 511 932 546 922 571 910 589 872 587 849 563 846 534 815 506 794 460 772 392 752 320 Q706 288 625 271 L456 222 363 383 328 503 306 612 293 657 326 665 341 723 380 847 455 983 463 1010 H0Z"}],
      fore:"M1005 190 L1110 174 1244 187 1457 374 1501 441 1501 621 923 621 922 573 915 535 929 423 945 286 969 235Z"
    },
    crane: {
      angle:10,name:"Стрела автокрана",
      parts:[
        {pivot:[958,509],d:"M185 149 H927 L927 377 958 405 957 452 943 511 932 562 921 587 887 601 830 583 780 552 760 546 740 536 720 519 700 510 680 500 660 490 640 482 620 466 600 463 580 471 560 474 540 466 500 461 400 450 321 447 309 412 303 393 301 377 233 377 214 393 185 393Z"},
        {pivot:[958,509],hang:[269,367],d:"M223 377 H304 V540 H223Z"}
      ],
      fore:"M977 370 Q992 365 1027 364 L1195 359 1232 450 1330 459 1330 639 930 639 931 563 944 470 955 410Z M812 508 Q815 493 830 496 L895 502 Q909 504 910 517 L910 633 899 633 898 518 826 509 823 632 811 633Z M827 551 L899 555 899 562 826 557Z"
    }
  };
  const fine=matchMedia("(any-hover:hover) and (any-pointer:fine)");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  const review=new URLSearchParams(location.search).get("review")==="motion";
  const root=document.documentElement;
  const cards=[], active=new Set();
  let frame=0;
  function allowed(){return root.hasAttribute("data-motion-enabled")&&!reduced.matches&&!document.hidden;}
  function layer(){
    const canvas=document.createElement("canvas");
    canvas.width=1024;canvas.height=683;
    const ctx=canvas.getContext("2d");
    ctx.scale(canvas.width/1536,canvas.height/1024);
    return {canvas,ctx};
  }
  function copy(ctx,image){ctx.drawImage(image,0,0,1536,1024);}
  function clipped(ctx,path,paint){ctx.save();ctx.clip(path);paint();ctx.restore();}
  function compose(card,photo,clean){
    const full=new Path2D();
    card.parts=card.design.parts.map(part=>{
      const mask=new Path2D(part.d);
      full.addPath(mask);
      const piece=layer();
      clipped(piece.ctx,mask,()=>copy(piece.ctx,photo));
      return {...part,image:piece.canvas};
    });
    const stationary=layer();
    copy(stationary.ctx,photo);
    clipped(stationary.ctx,full,()=>{
      stationary.ctx.clearRect(0,0,1536,1024);
      if(clean) copy(stationary.ctx,clean);
    });
    card.body=stationary.canvas;
    const foreground=layer();
    clipped(foreground.ctx,new Path2D(card.design.fore),()=>copy(foreground.ctx,photo));
    card.foreground=foreground.canvas;
  }
  function paint(card,angle){
    card.angle=angle;
    const canvas=card.canvas;
    canvas.dataset.angleDeg=angle.toFixed(2);
    if(angle<=.001){canvas.hidden=true;card.item.removeAttribute("data-arm-painted");return;}
    const ctx=card.ctx;
    const scale=canvas.width/1680;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(scale,0,0,canvas.height/1160,72*scale,136*canvas.height/1160);
    copy(ctx,card.body);
    for(const part of card.parts){
      ctx.save();
      const radians=angle*(part.ratio||1)*Math.PI/180;
      ctx.translate(...part.pivot);ctx.rotate(radians);ctx.translate(-part.pivot[0],-part.pivot[1]);
      // The crane hook hangs vertically as its suspension point follows the boom.
      if(part.hang){ctx.translate(...part.hang);ctx.rotate(-radians);ctx.translate(-part.hang[0],-part.hang[1]);}
      copy(ctx,part.image);
      ctx.restore();
    }
    copy(ctx,card.foreground);
    canvas.hidden=false;card.item.setAttribute("data-arm-painted","");
  }
  function finish(card,target){
    paint(card,target);
    card.canvas.dataset.phase=target===0?"rest":"raised";
    active.delete(card);
  }
  function tick(now){
    frame=0;
    if(!allowed()){restore();return;}
    for(const card of active){
      const f=Math.min(1,(now-card.started)/card.duration);
      if(f>=1){finish(card,card.target);continue;}
      const ease=f*f*(3-2*f);
      paint(card,card.from+(card.target-card.from)*ease);
    }
    if(active.size)frame=requestAnimationFrame(tick);
  }
  function refresh(card){
    if(!card.ready)return;
    const enabled=allowed();
    const target=enabled&&(card.pinned||card.focused||card.hovered)?card.design.angle:0;
    if(!enabled){card.target=0;finish(card,0);return;}
    if(card.target===target)return;
    card.from=card.angle;card.target=target;
    if(Math.abs(card.from-target)<.01){finish(card,target);return;}
    card.started=performance.now();
    card.duration=Math.max(120,(target?700:550)*Math.abs(target-card.from)/card.design.angle);
    card.canvas.dataset.phase=target?"rising":"lowering";
    active.add(card);
    if(!frame)frame=requestAnimationFrame(tick);
  }
  function restore(){
    if(frame)cancelAnimationFrame(frame);frame=0;
    for(const card of cards){
      card.pinned=false;
      card.button?.setAttribute("aria-pressed","false");
      if(card.button)card.button.disabled=!allowed()||!card.ready;
      if(card.ready){card.target=0;finish(card,0);}
    }
    active.clear();
  }
  function updatePermission(){
    if(!allowed()){restore();return;}
    for(const card of cards){if(card.button)card.button.disabled=!card.ready;refresh(card);}
  }
  async function prepare(card){
    try{
      await card.photo.decode();
      if(card.photo.naturalWidth!==1536||card.photo.naturalHeight!==1024)return;
      let clean=null;
      if(card.design.clean){
        clean=new Image();clean.src=card.design.clean;await clean.decode();
        if(clean.naturalWidth!==1536||clean.naturalHeight!==1024)return;
      }
      compose(card,card.photo,clean);
      card.ready=true;card.canvas.dataset.ready="true";card.canvas.dataset.phase="rest";
      if(card.button)card.button.disabled=!allowed();
      refresh(card);
    }catch{card.canvas.hidden=true;}
  }
  const reviewPanel=review?document.createElement("div"):null;
  if(reviewPanel){
    reviewPanel.className="arm-review";reviewPanel.setAttribute("role","group");
    reviewPanel.setAttribute("aria-label","Фиксация позы для сравнения");
    const title=document.createElement("strong");title.textContent="Поднять для просмотра";reviewPanel.append(title);
    document.querySelector(".feature-list").after(reviewPanel);
  }
  document.querySelectorAll(".featured[data-arm-type]").forEach(item=>{
    const type=item.dataset.armType, design=designs[type];
    const photo=item.querySelector(".arm-frame img");
    const canvas=document.createElement("canvas");
    canvas.width=840;canvas.height=580;canvas.hidden=true;
    canvas.setAttribute("aria-hidden","true");canvas.dataset.armType=type;canvas.dataset.ready="false";canvas.dataset.phase="rest";canvas.dataset.angleDeg="0";
    item.querySelector(".arm-plane").append(canvas);
    const card={item,type,design,photo,canvas,ctx:canvas.getContext("2d"),ready:false,angle:0,target:0,hovered:false,focused:false,pinned:false};
    cards.push(card);
    item.addEventListener("pointerenter",e=>{if(fine.matches&&e.pointerType!=="touch"){card.hovered=true;refresh(card);}});
    item.addEventListener("pointerleave",()=>{card.hovered=false;refresh(card);});
    item.addEventListener("pointercancel",()=>{card.hovered=false;refresh(card);});
    item.addEventListener("focusin",()=>{card.focused=item.matches(":focus-visible");refresh(card);});
    item.addEventListener("focusout",e=>{if(!item.contains(e.relatedTarget)){card.focused=false;refresh(card);}});
    if(reviewPanel){
      const button=document.createElement("button");button.className="replay-button";button.type="button";button.disabled=true;
      button.textContent=design.name;button.setAttribute("aria-pressed","false");card.button=button;
      button.addEventListener("click",()=>{if(!allowed())return;card.pinned=!card.pinned;button.setAttribute("aria-pressed",String(card.pinned));refresh(card);});
      reviewPanel.append(button);
    }
    // A lazy catalogue image is decoded when its card approaches the viewport.
    if("IntersectionObserver" in window){const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();prepare(card);}},{rootMargin:"350px"});io.observe(item);}
    else prepare(card);
  });
  new MutationObserver(updatePermission).observe(root,{attributes:true,attributeFilter:["data-motion-enabled"]});
  document.addEventListener("visibilitychange",updatePermission);
  reduced.addEventListener?.("change",updatePermission);
})();