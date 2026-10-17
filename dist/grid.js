// Canvas adaptation of the supplied 21st.dev KineticGrid reference.
// No React runtime is needed for this static download page.
(()=>{
 const canvas=document.querySelector('#kinetic-grid'),ctx=canvas.getContext('2d');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let w=0,h=0,frame=0,ripples=[];
 const mouse={x:-9999,y:-9999},target={...mouse};
 function size(){w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);paint(performance.now());}
 function paint(now){ctx.clearRect(0,0,w,h);ctx.fillStyle='#101113';ctx.fillRect(0,0,w,h);ctx.fillStyle='#ffffff0b';for(let x=14;x<w;x+=28)for(let y=14;y<h;y+=28){ctx.beginPath();ctx.arc(x,y,.7,0,Math.PI*2);ctx.fill()}
 const cols=Math.max(2,Math.ceil(w/55)),rows=Math.max(2,Math.ceil(h/55)),pts=[];
 ripples=ripples.filter(r=>(now-r.born)<850);
 for(let row=0;row<=rows;row++){pts[row]=[];for(let col=0;col<=cols;col++){let x=col*w/cols,y=row*h/rows;const pin=Math.min(col/1.5,(cols-col)/1.5,1)**2*Math.min(row/1.5,(rows-row)/1.5,1)**2,dx=x-mouse.x,dy=y-mouse.y,d=Math.hypot(dx,dy),pr=Math.max(0,1-d/260)*pin;
 if(d>0&&d<260){const warp=(1-d/260)**2*Math.min(1,d/60)*24*pin;x-=dx/d*warp;y-=dy/d*warp}
 for(const r of ripples){const rx=x-r.x,ry=y-r.y,rd=Math.hypot(rx,ry),age=(now-r.born)/1000,diff=rd-age*400;if(rd&&Math.abs(diff)<55){const v=(1-Math.abs(diff)/55)*Math.max(0,1-age*1.2)*18*pin*(diff<0?1:-1);x+=rx/rd*v;y+=ry/rd*v}}
 pts[row][col]={x,y,pr};}}
 function line(a,b){const p=(a.pr+b.pr)/2;ctx.strokeStyle=`rgba(${Math.round(255-181*p)},${Math.round(255-97*p)},255,${.09+.7*p})`;ctx.lineWidth=.7+p*.8;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){const p=pts[r][c];if(c<cols)line(p,pts[r][c+1]);if(r<rows)line(p,pts[r+1][c]);ctx.fillStyle=`rgba(164,191,255,${.16+p.pr*.7})`;ctx.beginPath();ctx.arc(p.x,p.y,1.3+p.pr*1.8,0,Math.PI*2);ctx.fill()}
 for(const r of ripples){const age=(now-r.born)/1000;ctx.strokeStyle=`rgba(100,180,255,${Math.max(0,1-age*1.2)*.28})`;ctx.beginPath();ctx.arc(r.x,r.y,Math.max(0,age*400),0,Math.PI*2);ctx.stroke()}}
 function tick(now){frame=0;if(document.hidden||reduced.matches)return;mouse.x+=(target.x-mouse.x)*.08;mouse.y+=(target.y-mouse.y)*.08;paint(now);frame=requestAnimationFrame(tick)}
 function restart(){cancelAnimationFrame(frame);frame=0;if(reduced.matches)paint(performance.now());else if(!document.hidden)frame=requestAnimationFrame(tick)}
 addEventListener('resize',size);addEventListener('pointermove',e=>{target.x=e.clientX;target.y=e.clientY},{passive:true});addEventListener('pointerout',e=>{if(!e.relatedTarget){target.x=-9999;target.y=-9999}},{passive:true});addEventListener('click',e=>{if(!reduced.matches){ripples.push({x:e.clientX,y:e.clientY,born:performance.now()});ripples=ripples.slice(-8)}});document.addEventListener('visibilitychange',restart);reduced.addEventListener('change',restart);size();restart();
 fetch('downloads/release.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(r=>document.querySelectorAll('[data-size]').forEach(el=>el.textContent=`${(r.size_bytes/1048576).toFixed(1)} МБ`)).catch(()=>document.querySelectorAll('[data-size]').forEach(el=>el.textContent='см. архив'));
})();
