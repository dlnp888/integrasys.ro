(function () {
  var VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0., 1.); }`;

  var FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform vec2  uResolution;
uniform vec3  uColor, uColorTwo;
uniform int   uRingCount;

const float HP    = 1.5707963;
const float CYCLE = 3.45;

float fade(float t) {
  return t < uFadeIn
    ? smoothstep(0., uFadeIn, t)
    : 1. - smoothstep(uFadeOut, CYCLE - 0.2, t);
}

float ring(vec2 p, float ri, float cut, float t0, float px) {
  float t  = mod(uTime + t0, CYCLE);
  float r  = ri + t / CYCLE * uScaleRate;
  float d  = abs(length(p) - r);
  float a  = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1. - a, 0.5) * px * uLineThickness;
  float h  = (1. - smoothstep(th, th * 1.5, d)) + 1.;
  d += pow(cut * a, 3.) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}

void main() {
  float px = 1. / min(uResolution.x, uResolution.y);
  vec2 p   = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  float cr = cos(uRotation), sr = sin(uRotation);
  p = mat2(cr, -sr, sr, cr) * p;
  vec3  c   = vec3(0.);
  float rcf = max(float(uRingCount) - 1., 1.);
  for (int i = 0; i < 10; i++) {
    if (i >= uRingCount) break;
    float fi = float(i);
    vec3 rc  = mix(uColor, uColorTwo, fi / rcf);
    c = mix(c, rc, vec3(ring(
      p,
      uBaseRadius + fi * uRadiusStep,
      pow(uRingGap, fi),
      i == 0 ? 0. : 2.95 * fi,
      px
    )));
  }
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100., vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;
  fragColor = vec4(c, max(c.r, max(c.g, c.b)) * uOpacity);
}`;

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.warn('[MagicRings]', gl.getShaderInfoLog(s));
    return s;
  }

  function hexToRgb(hex) {
    var v = parseInt(hex.replace('#', ''), 16);
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
  }

  function init(canvas) {
    var opts = {};
    try { opts = JSON.parse(canvas.dataset.opts || '{}'); } catch(e) {}

    var gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: false,
      antialias: false, depth: false, stencil: false
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
      new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uTime','uResolution','uAttenuation','uLineThickness','uBaseRadius','uRadiusStep',
     'uScaleRate','uOpacity','uNoiseAmount','uRotation','uRingGap','uFadeIn','uFadeOut',
     'uColor','uColorTwo','uRingCount']
    .forEach(function(n) { U[n] = gl.getUniformLocation(prog, n); });

    var c1 = hexToRgb(opts.color    || '#0c70dc');
    var c2 = hexToRgb(opts.colorTwo || '#063070');

    function setUniforms(w, h) {
      gl.uniform2f(U.uResolution,   w, h);
      gl.uniform1f(U.uAttenuation,  opts.attenuation   ?? 7);
      gl.uniform1f(U.uLineThickness,opts.lineThickness  ?? 1.8);
      gl.uniform1f(U.uBaseRadius,   opts.baseRadius     ?? 0.45);
      gl.uniform1f(U.uRadiusStep,   opts.radiusStep     ?? 0.15);
      gl.uniform1f(U.uScaleRate,    opts.scaleRate      ?? 0.12);
      gl.uniform1f(U.uOpacity,      opts.opacity        ?? 0.75);
      gl.uniform1f(U.uNoiseAmount,  opts.noiseAmount    ?? 0.03);
      gl.uniform1f(U.uRotation,     (opts.rotation ?? 0) * Math.PI / 180);
      gl.uniform1f(U.uRingGap,      opts.ringGap        ?? 1.4);
      gl.uniform1f(U.uFadeIn,       opts.fadeIn         ?? 0.6);
      gl.uniform1f(U.uFadeOut,      opts.fadeOut        ?? 0.4);
      gl.uniform3fv(U.uColor,       c1);
      gl.uniform3fv(U.uColorTwo,    c2);
      gl.uniform1i(U.uRingCount,    opts.ringCount      ?? 4);
    }

    function resize() {
      var w = canvas.offsetWidth, h = canvas.offsetHeight;
      var dpr = Math.min(devicePixelRatio, 2);
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      setUniforms(canvas.width, canvas.height);
    }
    resize();

    var ro = new ResizeObserver(resize);
    ro.observe(canvas);

    var visible = true;
    var io = new IntersectionObserver(function(e) { visible = e[0].isIntersecting; }, { threshold: 0 });
    io.observe(canvas);

    gl.clearColor(0,0,0,0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var speed = opts.speed ?? 0.6;
    var start = performance.now();
    (function tick() {
      requestAnimationFrame(tick);
      if (!visible) return;
      gl.uniform1f(U.uTime, (performance.now() - start) * 0.001 * speed);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    })();
  }

  document.querySelectorAll('canvas.magic-rings-bg').forEach(init);
})();
