// Shader from the supplied MorphGallery reference.
(()=>{
const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
const FRAG = `
precision highp float;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform vec2 u_resolution;
uniform float u_fromAspect;
uniform float u_toAspect;
uniform float u_scale;
uniform float u_direction;
uniform float u_edge;
uniform float u_drift;

varying vec2 v_uv;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
   -0.577350269189626,
    0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
  );
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 v) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(v);
    v *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// The drift below pushes UVs past the edge of the image, and CLAMP_TO_EDGE
// answers that by smearing the last row of pixels into long vertical streaks.
// Reflecting instead keeps real picture there. Done in the shader because
// MIRRORED_REPEAT is illegal on the non-power-of-two textures photos produce.
vec2 mirror(vec2 uv) {
  return 1.0 - abs(1.0 - mod(uv, 2.0));
}

vec2 coverUV(vec2 uv, float imgAspect) {
  float canvasAspect = u_resolution.x / u_resolution.y;
  vec2 scale = (canvasAspect > imgAspect)
    ? vec2(1.0, imgAspect / canvasAspect)
    : vec2(canvasAspect / imgAspect, 1.0);
  return mirror((uv - 0.5) * scale + 0.5);
}

void main() {
  // Widen the sweep by one edge at each end, so progress 0 and 1 are fully
  // one image or the other rather than already half-dissolved.
  float adjusted = u_progress * (1.0 + 2.0 * u_edge) - u_edge;

  float noise = fbm(v_uv * u_scale + vec2(0.0, u_progress * u_direction)) * 0.5 + 0.5;
  // Bias the threshold by how bright the incoming frame is here: its lit areas
  // cross the front first, so the new image appears to burn through the old.
  noise = smoothstep(
    0.0,
    2.0,
    length(texture2D(u_to, coverUV(v_uv, u_toAspect)).rgb) + noise
  );

  float mixFactor = 1.0 - smoothstep(adjusted - u_edge, adjusted + u_edge, noise);

  // Both frames slide, by different amounts and in opposite directions, so the
  // tatters have parallax against each other instead of sitting in one plane.
  vec2 fromUV = coverUV(
    v_uv + vec2(0.0, noise * u_progress * u_drift * u_direction),
    u_fromAspect
  );
  vec2 toUV = coverUV(
    v_uv + vec2(0.0, noise * (1.0 - u_progress) * -0.5 * u_drift * u_direction),
    u_toAspect
  );

  gl_FragColor = mix(texture2D(u_from, fromUV), texture2D(u_to, toUV), mixFactor);
}
`;
const root=document.querySelector('#gallery'),canvas=document.querySelector('#morph-canvas');
const images=[...root.querySelectorAll('.gallery-image')],thumbs=[...root.querySelectorAll('[data-slide]')];
const captions=[
 ['МЕХАНИЗМЫ','Соберите свою систему.','Соедините тела с рычагом, пружиной и тросом в одной сцене.'],
 ['ТАЙМЛАЙН','Вернитесь к моменту открытия.','Поставьте опыт на паузу, перемотайте время и продолжите движение.'],
 ['ПРУЖИНЫ','Измените силу связи.','Задайте жёсткость, длину и затухание пружины. Исследуйте движение тел.'],
 ['УЧЕБНЫЕ ИСТОЧНИКИ','Свяжите опыт с теорией.','Найдите учебные источники по теме механики и своему классу.'],
 ['РАБОЧАЯ ОБЛАСТЬ','Ваше пространство для вопросов.','Собирайте сцену из каталога, управляйте опытом и сохраняйте результат.']
];
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),pauseButton=root.querySelector('.pause-button');
let active=0,from=0,to=0,start=0,progress=1,raf=0,timer=0,userPaused=false,hover=false,focused=false,visible=true,gl=null,program=null,buffer=null,textures=[],aspects=[],uniforms={},direction=1,disposed=false,swipe=null;
function fallback(){cancelAnimationFrame(raf);raf=0;canvas.style.opacity='0';root.dataset.renderer='fallback';gl=null;}
function resize(){if(!gl)return;const ratio=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*ratio),h=Math.round(canvas.clientHeight*ratio);if(!w||!h)return;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}render();}
function render(){if(!gl||!program)return;const a=textures[from],b=textures[to];if(!a||!b)return;gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,a);gl.uniform1i(uniforms.from,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,b);gl.uniform1i(uniforms.to,1);gl.uniform1f(uniforms.progress,progress);gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform1f(uniforms.fromAspect,aspects[from]);gl.uniform1f(uniforms.toAspect,aspects[to]);gl.uniform1f(uniforms.scale,3.5);gl.uniform1f(uniforms.direction,direction);gl.uniform1f(uniforms.edge,.15);gl.uniform1f(uniforms.drift,.5);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
function animate(now){raf=0;if(document.hidden||!visible||!gl)return;const t=reduced.matches?1:Math.min((now-start)/700,1);progress=t<.5?16*t**5:1-(-2*t+2)**5/2;render();if(t<1)raf=requestAnimationFrame(animate);}
function show(index,manual=false){const next=(index+images.length)%images.length;if(next===active)return;if(progress<1){from=active;progress=1;render()}const previous=active;active=next;from=previous;to=active;direction=((active-previous+images.length)%images.length)*2<=images.length?1:-1;start=performance.now();progress=reduced.matches?1:0;const num=String(active+1).padStart(2,'0'),data=captions[active];document.querySelector('#slide-category').textContent=num+' / '+data[0];document.querySelector('#slide-title').textContent=data[1];document.querySelector('#slide-description').textContent=data[2];document.querySelector('#slide-count').innerHTML=num+' <span>/ 05</span>';images.forEach((img,i)=>{img.classList.toggle('active',i===active);img.setAttribute('aria-hidden',String(i!==active))});thumbs.forEach((button,i)=>button.setAttribute('aria-current',String(i===active)));const status=document.querySelector('#gallery-status');status.setAttribute('aria-live',manual?'polite':'off');status.textContent=`Снимок ${active+1} из 5: ${data[0].toLowerCase()}`;if(gl){cancelAnimationFrame(raf);if(reduced.matches)render();else raf=requestAnimationFrame(animate)}schedule();}
function schedule(){clearTimeout(timer);if(!userPaused&&!hover&&!focused&&!document.hidden&&visible&&!reduced.matches)timer=setTimeout(()=>show(active+1),2500);}
root.querySelector('[data-gallery-prev]').addEventListener('click',()=>show(active-1,true));root.querySelector('[data-gallery-next]').addEventListener('click',()=>show(active+1,true));thumbs.forEach((button,i)=>button.addEventListener('click',()=>show(i,true)));
pauseButton.addEventListener('click',()=>{userPaused=!userPaused;pauseButton.setAttribute('aria-pressed',String(userPaused));pauseButton.setAttribute('aria-label',userPaused?'Включить автопоказ':'Остановить автопоказ');pauseButton.textContent=userPaused?'▷':'Ⅱ';schedule()});
root.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();show(active+(e.key==='ArrowRight'?1:-1),true)}});root.addEventListener('pointerdown',e=>{swipe=e.clientX});root.addEventListener('pointerup',e=>{if(swipe!==null&&Math.abs(e.clientX-swipe)>48)show(active+(e.clientX<swipe?1:-1),true);swipe=null});root.addEventListener('pointercancel',()=>swipe=null);root.addEventListener('mouseenter',()=>{hover=true;schedule()});root.addEventListener('mouseleave',()=>{hover=false;schedule()});root.addEventListener('focusin',()=>{focused=true;schedule()});root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget)){focused=false;schedule()}});
document.addEventListener('visibilitychange',()=>{schedule();if(document.hidden){cancelAnimationFrame(raf);raf=0}else if(gl&&progress<1){start=performance.now()-700;raf=requestAnimationFrame(animate)}});reduced.addEventListener('change',()=>{if(reduced.matches){progress=1;cancelAnimationFrame(raf);render()}schedule()});
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();if(!visible){cancelAnimationFrame(raf);raf=0}else if(gl){progress=1;render()}},{threshold:.01}).observe(root);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback()});
async function setup(){try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)return fallback();const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader};const vertex=compile(gl.VERTEX_SHADER,VERT),fragment=compile(gl.FRAGMENT_SHADER,FRAG);program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('shader link');gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);for(const name of ['from','to','progress','resolution','fromAspect','toAspect','scale','direction','edge','drift'])uniforms[name]=gl.getUniformLocation(program,'u_'+name);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
await Promise.all(images.map(async(img,i)=>{if(!img.complete)await new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true})});if(!img.naturalWidth)throw Error('missing image');if(!gl||disposed)return;const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);textures[i]=texture;aspects[i]=img.naturalWidth/img.naturalHeight}));if(!gl)return;from=to=active;progress=1;resize();canvas.style.opacity='1';root.dataset.renderer='webgl';new ResizeObserver(resize).observe(root);
}catch(error){fallback()}}
setup();schedule();addEventListener('pagehide',()=>{disposed=true;clearTimeout(timer);cancelAnimationFrame(raf);if(gl){textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program)}});



})();
