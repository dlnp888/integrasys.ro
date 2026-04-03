(function () {
  var FRAG = `#version 300 es
precision mediump float;
out vec4 fc;

uniform float uTime;
uniform vec2  uResolution;
uniform float uFlakeSize;
uniform float uMinFlakeSize;
uniform float uPixelResolution;
uniform float uSpeed;
uniform float uDepthFade;
uniform float uFarPlane;
uniform vec3  uColor;
uniform float uBrightness;
uniform float uGamma;
uniform float uDensity;
uniform float uVariant;
uniform float uDirection;

#define PI_OVER_6 0.5235988
#define PI_OVER_3 1.0471976
#define M1 1597334677u
#define M2 3812015801u
#define M3 3299493293u
#define F0  2.3283064e-10

const vec3 camK = vec3( 0.57735027,  0.57735027,  0.57735027);
const vec3 camI = vec3( 0.70710678,  0.0,        -0.70710678);
const vec3 camJ = vec3(-0.40824829,  0.81649658, -0.40824829);
const vec2 b1d  = vec2(0.574, 0.819);

uint hh(uint n){ return n*(n^(n>>15u)); }

vec3 hash3(uint n){
  uvec3 v = hh(n)*uvec3(1u,511u,262143u);
  return vec3(v)*F0;
}

float sdFlake(vec2 p){
  float r=length(p);
  float a=atan(p.y,p.x);
  a=abs(mod(a+PI_OVER_6,PI_OVER_3)-PI_OVER_6);
  vec2 q=r*vec2(cos(a),sin(a));
  float d=max(abs(q.y),max(-q.x,q.x-1.0));
  float t1=clamp(dot(q-vec2(.4,0.),b1d),0.,.4);
  float t2=clamp(dot(q-vec2(.7,0.),b1d),0.,.25);
  return min(d,min(length(q-vec2(.4,0.)-t1*b1d),length(q-vec2(.7,0.)-t2*b1d)))*10.;
}

void main(){
  float ps   = max(1.,floor(.5+uResolution.x/uPixelResolution));
  vec2  fc2  = floor(gl_FragCoord.xy/ps);
  vec2  res  = uResolution/ps;
  float irx  = 1./res.x;

  vec3 ray = normalize(vec3((fc2-res*.5)*irx,1.));
  ray = ray.x*camI + ray.y*camJ + ray.z*camK;

  float ts   = uTime*uSpeed;
  vec3  cam  = (cos(uDirection)*.4*camI + sin(uDirection)*.4*camJ + .1*camK)*ts;
  vec3  pos  = cam;

  vec3 ar    = max(abs(ray),vec3(.001));
  vec3 str   = 1./ar;
  vec3 sgn   = step(ray,vec3(0.));
  vec3 ph    = fract(pos)*str;
  ph         = mix(str-ph,ph,sgn);

  float rck  = dot(ray,camK);
  float irck = 1./rck;
  float idf  = 1./uDepthFade;
  float hirx = .5*irx;
  vec3  ta   = ts*.1*vec3(7.,8.,5.);

  float t=0.;
  for(int i=0;i<128;i++){
    if(t>=uFarPlane) break;
    vec3  fp = floor(pos);
    uint  cc = hh(uint(fp.x)*M1^uint(fp.y)*M2^uint(fp.z)*M3);
    float ch = hash3(cc).x;

    if(ch<uDensity){
      vec3 h   = hash3(cc);
      vec3 sa1 = fp.yzx*.073;
      vec3 sa2 = fp.zxy*.27;
      vec3 fp2 = .5-.5*cos(4.*sin(sa1)+4.*sin(sa2)+2.*h+ta);
      fp2      = fp2*.8+.1+fp;

      float ti = dot(fp2-pos,camK)*irck;
      if(ti>0.){
        vec3  tp  = pos+ray*ti-fp2;
        float tx  = dot(tp,camI);
        float ty  = dot(tp,camJ);
        vec2  tuv = abs(vec2(tx,ty));
        float dep = dot(fp2-cam,camK);
        float fsz = max(uFlakeSize,uMinFlakeSize*dep*hirx);

        float dist;
        if(uVariant<.5)       dist=max(tuv.x,tuv.y);
        else if(uVariant<1.5) dist=length(tuv);
        else                  dist=sdFlake(vec2(tx,ty)/fsz)*fsz;

        if(dist<fsz){
          float r2  = uFlakeSize/fsz;
          float lum = exp2(-(t+ti)*idf)*min(1.,r2*r2)*uBrightness;
          fc=vec4(uColor*pow(vec3(lum),vec3(uGamma)),lum);
          return;
        }
      }
    }

    float ns=min(min(ph.x,ph.y),ph.z);
    vec3  sl=step(ph,vec3(ns));
    ph=ph-ns+str*sl; t+=ns;
    pos=mix(pos+ray*ns,floor(pos+ray*ns+.5),sl);
  }
  fc=vec4(0.);
}`;

  var VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position=vec4(p,0.,1.); }`;

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  function initPixelSnow(canvas, opts) {
    var gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: false,
      antialias: false, powerPreference: 'high-performance',
      depth: false, stencil: false
    });
    if (!gl) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]),
      gl.STATIC_DRAW);
    var ploc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(ploc);
    gl.vertexAttribPointer(ploc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uTime','uResolution','uFlakeSize','uMinFlakeSize','uPixelResolution','uSpeed',
     'uDepthFade','uFarPlane','uColor','uBrightness','uGamma','uDensity','uVariant','uDirection']
    .forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });

    var hex = parseInt((opts.color || '#0c70dc').replace('#',''), 16);
    var cr  = ((hex >> 16) & 255) / 255;
    var cg  = ((hex >>  8) & 255) / 255;
    var cb  = ( hex        & 255) / 255;

    function setStatic(w, h) {
      gl.uniform2f(U.uResolution,      w, h);
      gl.uniform1f(U.uFlakeSize,       opts.flakeSize       ?? 0.01);
      gl.uniform1f(U.uMinFlakeSize,    opts.minFlakeSize    ?? 1.25);
      gl.uniform1f(U.uPixelResolution, opts.pixelResolution ?? 200);
      gl.uniform1f(U.uSpeed,           opts.speed           ?? 1.25);
      gl.uniform1f(U.uDepthFade,       opts.depthFade       ?? 8);
      gl.uniform1f(U.uFarPlane,        opts.farPlane        ?? 20);
      gl.uniform3f(U.uColor,           cr, cg, cb);
      gl.uniform1f(U.uBrightness,      opts.brightness      ?? 1);
      gl.uniform1f(U.uGamma,           opts.gamma           ?? 0.4545);
      gl.uniform1f(U.uDensity,         opts.density         ?? 0.3);
      gl.uniform1f(U.uVariant,
        opts.variant === 'round' ? 1 : opts.variant === 'snowflake' ? 2 : 0);
      gl.uniform1f(U.uDirection,
        ((opts.direction ?? 125) * Math.PI) / 180);
    }

    function resize() {
      var w = canvas.offsetWidth, h = canvas.offsetHeight;
      canvas.width  = w * Math.min(devicePixelRatio, 2);
      canvas.height = h * Math.min(devicePixelRatio, 2);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uResolution, canvas.width, canvas.height);
    }

    resize();
    setStatic(canvas.width, canvas.height);

    var ro = new ResizeObserver(resize);
    ro.observe(canvas);

    var visible = true;
    var io = new IntersectionObserver(function(e){ visible = e[0].isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var start = performance.now();
    (function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      gl.uniform1f(U.uTime, (performance.now() - start) * 0.001);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    })();
  }

  document.querySelectorAll('canvas.pixel-snow-bg').forEach(function(c) {
    var opts = {};
    try { opts = JSON.parse(c.dataset.opts || '{}'); } catch(e) {}
    initPixelSnow(c, opts);
  });
})();
