import * as THREE from 'three';
import { NODES, EDGES, I18N } from './data.js';
import { openEditorHook } from './config.js';

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => 1 - Math.pow(1 - t, 3);
const backOut = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONT = '"Hiragino Sans","Yu Gothic UI","Segoe UI Variable","Segoe UI",Meiryo,system-ui,sans-serif';
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let lang = 'ja';
try { lang = localStorage.getItem('apisys-lang') || 'ja'; } catch (e) { /* ignore */ }
if (!I18N[lang]) lang = 'ja';
const L = () => I18N[lang];

/* ---------------- renderer (WebGL2) ---------------- */
const cv = $('#gl');
let R;
try { R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch (e) { $('#fb-t').textContent = L().webgl; $('#fallback').classList.add('on'); throw e; }
R.setClearColor(0x000000, 0); R.autoClear = false;

/* ---------------- latar partikel (gaya texture-main) ---------------- */
const bgScene = new THREE.Scene(), bgCam = new THREE.PerspectiveCamera(55, 1, .1, 50); bgCam.position.z = 6;
const BN = 2600, bpos = new Float32Array(BN * 3), bgrid = new Float32Array(BN * 3), bseed = new Float32Array(BN * 3), rb = mulberry(11);
for (let i = 0; i < BN; i++) {
  bpos.set([(rb() - .5) * 14, (rb() - .5) * 8, (rb() - .5) * 6], i * 3);
  bgrid.set([(i % 52) / 51 * 10 - 5, Math.floor(i / 52) / 49 * 6.4 - 3.2, 0], i * 3);
  bseed.set([rb(), rb(), rb()], i * 3);
}
const bgeo = new THREE.BufferGeometry();
bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bgeo.setAttribute('aGrid', new THREE.BufferAttribute(bgrid, 3)); bgeo.setAttribute('aS', new THREE.BufferAttribute(bseed, 3));
const BU = { uT: { value: 0 }, uM: { value: 0 }, uP: { value: 0 }, uPR: { value: 1 }, uMo: { value: new THREE.Vector2(99, 99) } };
const bgPts = new THREE.Points(bgeo, new THREE.ShaderMaterial({ uniforms: BU, transparent: true, depthWrite: false,
  vertexShader: `attribute vec3 aGrid,aS;uniform float uT,uM,uP,uPR;uniform vec2 uMo;varying float vA,vH;
  void main(){vec3 p=position+vec3(sin(uT*.3+aS.x*6.28),cos(uT*.25+aS.y*6.28),sin(uT*.2+aS.z*6.28))*.45;
  vec3 g=aGrid+vec3(0.,0.,sin(uT*1.2+aGrid.x*.8+aGrid.y*.8)*.08);vec3 q=mix(p,g,smoothstep(0.,1.,uM));
  vec2 d=q.xy-uMo;float l=length(d);q.xy+=normalize(d+1e-4)*exp(-l*1.2)*1.1;q.z+=exp(-l*1.5)*.8;
  vH=step(aGrid.x/10.+.5,uP)*uM;vec4 mv=modelViewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;
  gl_PointSize=(3.+4.*aS.x)*uPR*5.5/-mv.z;vA=.55+.35*aS.y;}`,
  fragmentShader: `varying float vA,vH;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;
  gl_FragColor=vec4(mix(vec3(.28,.45,.95),vec3(.06,.7,.66),vH),smoothstep(.5,.1,r)*vA);}` }));
bgPts.frustumCulled = false; bgScene.add(bgPts);
const B = { m: 0, p: 0, mT: 0, pT: 0 }, mouse = new THREE.Vector2(99, 99);

/* ---------------- scene utama ---------------- */
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 1, .1, 120);
const cluster = new THREE.Group(); scene.add(cluster);
const rootFx = new THREE.Group(); scene.add(rootFx);
const S = { base: 14, zoom: 1, zoomT: 1, out: 0, dive: 0, vx: 0, vy: 0, sel: null, hover: null, cHover: 0, focusQ: null, editor: false, spin: 1, start: performance.now(), W: 1, H: 1, K: 1 };
const palette = ['#0fa3a3', '#4b5fe8', '#f2b01e', '#f0732a', '#1fa971', '#1b64e8', '#e8486a'];

function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const GLOW = glowTex();

const ICONS = {
  clip: 'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h4', image: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M16 9a1 1 0 1 0 .01 0',
  plan: 'M3 3h18v18H3z M3 12h9 M12 3v9 M12 17h9 M16 12v9', pin: 'M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10z M12 8.5a2.5 2.5 0 1 0 .01 0',
  slides: 'M7 6h10v12H7z M3 8v8 M21 8v8', chat: 'M4 4h16v12H9l-5 4z M8 9h8 M8 12h5', cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5',
  camera: 'M3 8h4l2-3h6l2 3h4v12H3z M12 11a3.5 3.5 0 1 0 .01 0', note: 'M5 3h10l4 4v14H5z M15 3v4h4 M8 12h8 M8 16h6',
  play: 'M12 3a9 9 0 1 0 .01 0 M10 8.5v7l6-3.5z', music: 'M9 18V6l11-2v12 M9 18a3 3 0 1 1-.01 0 M20 16a3 3 0 1 1-.01 0',
  globe: 'M12 3a9 9 0 1 0 .01 0 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18', spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 8.5 4.8 4.8 0 0 0 7 18z',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  list: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01', code: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16',
  vr: 'M3 8h18v9h-5l-2-3h-4l-2 3H3z', qr: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h3v3h-3z M20 14v3 M14 20h3 M20 20h1',
  compress: 'M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9.5a2.5 2.5 0 1 0 .01 0',
  target: 'M12 3a9 9 0 1 0 .01 0 M12 8a4 4 0 1 0 .01 0 M12 1v4 M12 19v4 M1 12h4 M19 12h4', window: 'M3 5h18v14H3z M3 9h18 M6 7h.01 M9 7h.01',
  id: 'M3 6h18v12H3z M7 11a2 2 0 1 0 .01 0 M5 16c.5-2 4.5-2 5 0 M14 10h5 M14 14h4', phone: 'M7 2h10v20H7z M11 19h2',
  rocket: 'M12 3c4 2 6 6 5 11l-5 4-5-4c-1-5 1-9 5-11z M12 10a1.5 1.5 0 1 0 .01 0 M8 17l-3 4 M16 17l3 4',
  translate: 'M3 5h10 M8 3v2 M5 5c1 4 4 7 8 8 M11 5c-1 4-4 7-8 8 M13 21l4-10 4 10 M14.5 18h5',
  magnify: 'M10.5 3a7.5 7.5 0 1 0 .01 0 M16 16l5 5 M10.5 7v7 M7 10.5h7', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  pencil: 'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4', zip: 'M4 7h16v13H4z M3 3h18v4H3z M12 7v8 M10 11h4',
};
function iconTex(name) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.scale(128 / 24, 128 / 24);
  x.strokeStyle = '#fff'; x.lineWidth = 1.7; x.lineCap = x.lineJoin = 'round'; x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 1.2; x.stroke(new Path2D(ICONS[name]));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* shader bubble kaca-glossy */
const VS = `varying vec3 vN;varying vec3 vV;varying vec3 vP;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vP=position;gl_Position=projectionMatrix*mv;}`;
const nodeMat = col => new THREE.ShaderMaterial({ transparent: true, uniforms: { uC: { value: new THREE.Color(col) }, uH: { value: 0 }, uA: { value: 1 } }, vertexShader: VS,
  fragmentShader: `uniform vec3 uC;uniform float uH,uA;varying vec3 vN;varying vec3 vV;varying vec3 vP;
  void main(){vec3 n=normalize(vN),v=normalize(vV);float nv=clamp(dot(n,v),0.,1.);float fr=pow(1.-nv,2.6);vec3 L=normalize(vec3(-.5,.8,.6));
  float dif=clamp(dot(n,L)*.5+.5,0.,1.);vec3 base=mix(uC*.7,uC*1.15,dif);vec3 h=normalize(L+v);float sp=pow(max(dot(n,h),0.),52.);
  vec3 col=base+vec3(sp*.75)+mix(uC,vec3(1.),.7)*fr*.5+vec3(.1)*uH;gl_FragColor=vec4(col,uA*(.94+.06*fr));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }` });
const centerMat = new THREE.ShaderMaterial({ transparent: true, uniforms: { uT: { value: 0 }, uA: { value: 1 }, uH: { value: 0 }, uC1: { value: new THREE.Color('#0fa3a3') }, uC2: { value: new THREE.Color('#4b5fe8') }, uC3: { value: new THREE.Color('#f2b01e') } }, vertexShader: VS,
  fragmentShader: `uniform float uT,uA,uH;uniform vec3 uC1,uC2,uC3;varying vec3 vN;varying vec3 vV;varying vec3 vP;
  void main(){vec3 n=normalize(vN),v=normalize(vV);vec3 p=normalize(vP);float nv=clamp(dot(n,v),0.,1.);float fr=pow(1.-nv,2.4);
  float s=sin(p.x*4.+uT*.6)+sin(p.y*5.-uT*.5)+sin(p.z*4.+uT*.4)+sin((p.x+p.y)*7.+uT*.9)*.5;float g=smoothstep(-1.4,1.4,p.y*.9+s*.22);
  vec3 col=mix(uC1,uC2,g);col=mix(col,uC3,smoothstep(.55,1.,sin(s*1.3+p.z*3.-uT*.4)*.5+.5)*.16);
  vec3 L=normalize(vec3(-.5,.8,.6));float dif=clamp(dot(n,L)*.5+.5,0.,1.);col*=.6+.5*dif;vec3 h=normalize(L+v);col+=vec3(pow(max(dot(n,h),0.),60.)*.6);
  col+=vec3(1.)*fr*.26+vec3(.08)*uH;gl_FragColor=vec4(col,uA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }` });

/* ---------------- pusat: API System ---------------- */
const CR = 1.75;
const centerMesh = new THREE.Mesh(new THREE.SphereGeometry(CR, 64, 48), centerMat); rootFx.add(centerMesh);
const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(CR * 1.16, 2), new THREE.MeshBasicMaterial({ color: 0x4b5fe8, wireframe: true, transparent: true, opacity: .16, depthWrite: false })); rootFx.add(wire);
const cRings = [];
[[CR * 1.5, .012, '#0fa3a3', [1.2, .2, 0], .22], [CR * 1.78, .01, '#4b5fe8', [.4, 1.1, .3], -.16], [CR * 2.05, .009, '#f2b01e', [1.5, .9, .6], .12]].forEach(([r, w, c, e, sp]) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 160), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .55, depthWrite: false })); m.rotation.set(...e); m.userData.sp = sp; rootFx.add(m); cRings.push(m);
});
const cHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: 0x4b9fe8, transparent: true, opacity: .42, depthWrite: false })); cHalo.scale.setScalar(CR * 5.2); cHalo.renderOrder = -2; rootFx.add(cHalo);
const cArcs = new THREE.Group(); rootFx.add(cArcs);
[[CR * 1.32, 0.3, 1.1, '#f0732a'], [CR * 1.32, 3.6, .9, '#f0732a'], [CR * 1.42, 2.1, .7, '#1fa971'], [CR * 1.42, 5.2, .6, '#1b64e8']].forEach(([r, a0, l, c], i) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, .016, 6, 60, l), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .8 })); m.rotation.z = a0; m.userData.sp = (i % 2 ? -1 : 1) * (.3 + i * .08); cArcs.add(m);
});
const cCv = document.createElement('canvas'); cCv.width = 1024; cCv.height = 512;
const cTex = new THREE.CanvasTexture(cCv); cTex.colorSpace = THREE.SRGBColorSpace; cTex.anisotropy = 8;
const cText = new THREE.Sprite(new THREE.SpriteMaterial({ map: cTex, transparent: true, depthWrite: false })); cText.scale.set(3.1, 1.55, 1); rootFx.add(cText);
function fitFont(x, text, weight, size, maxW) { do { x.font = `${weight} ${size}px ${FONT}`; size -= 2; } while (x.measureText(text).width > maxW && size > 14); }
function drawCenter() {
  const x = cCv.getContext('2d'), t = L(); x.clearRect(0, 0, 1024, 512); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(8,30,70,.4)'; x.shadowBlur = 16; x.fillStyle = '#fff';
  fitFont(x, t.centerMain, 700, 150, 820); x.fillText(t.centerMain, 512, 170);
  x.shadowBlur = 8; fitFont(x, t.centerSub, 500, 46, 860); x.fillText(t.centerSub, 512, 285);
  x.globalAlpha = .82; fitFont(x, t.centerEn, 400, 32, 860); x.fillText(t.centerEn, 512, 345);
  x.globalAlpha = .9; x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.2)'; const hw = 440; x.beginPath(); if (x.roundRect) x.roundRect(512 - hw / 2, 400, hw, 56, 28); else x.rect(512 - hw / 2, 400, hw, 56); x.fill();
  x.fillStyle = '#fff'; fitFont(x, t.centerHint, 500, 28, hw - 40); x.fillText(t.centerHint, 512, 429); x.globalAlpha = 1; cTex.needsUpdate = true;
}

/* ---------------- bubble data ---------------- */
const rng = mulberry(7), N = NODES.length, nodes = [], byId = {};
NODES.forEach((d, i) => {
  const zc = (1 - (i + .5) / N * 2) * .74, rr = Math.sqrt(1 - zc * zc), th = i * 2.399963 + .6, rad = (4.7 + rng() * 1.2) * (N > 20 ? 1.08 : 1);
  const pos = new THREE.Vector3(Math.cos(th) * rr, Math.sin(th) * rr * .86, zc).multiplyScalar(rad);
  const g = new THREE.Group(); g.position.copy(pos); cluster.add(g);
  const mat = nodeMat(d.color), mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat); g.add(mesh);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: new THREE.Color(d.color), transparent: true, opacity: .3, depthWrite: false })); halo.scale.setScalar(d.size * 3.6); halo.renderOrder = -2; g.add(halo);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(d.icon), transparent: true, depthWrite: false })); icon.scale.setScalar(d.size * 1.15); g.add(icon);
  const rg = new THREE.Group(); g.add(rg); const spin = new THREE.Group(); rg.add(spin);
  [[1.42, rng() * 6.28, 1.0, d.color], [1.62, rng() * 6.28, .8, palette[i % palette.length]]].forEach(([k, a0, l, c], j) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(d.size * k, .012, 6, 40, l), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .75 })); m.rotation.z = a0; m.userData.sp = (j ? -1 : 1) * (.35 + rng() * .4); spin.add(m);
  });
  const n = { d, i, g, mesh, mat, halo, icon, rg, spin, r: d.size, pos, appear: 0, hover: 0, sel: 0, links: [] };
  mesh.userData.node = n; nodes.push(n); byId[d.id] = n;
});

/* ---------------- koneksi ---------------- */
const edges = [], pulses = [], tmp = new THREE.Vector3();
function curveBetween(a, b, bow) {
  const mid = a.clone().add(b).multiplyScalar(.5), dir = b.clone().sub(a), up = new THREE.Vector3(rng() - .5, rng() - .5, rng() - .5).cross(dir).normalize();
  return new THREE.QuadraticBezierCurve3(a.clone(), mid.multiplyScalar(1.12).add(up.multiplyScalar(bow)), b.clone());
}
function addEdge(kind, a, b, curve, base, ca, cb) {
  let obj, mat;
  if (kind === 'center') { mat = new THREE.MeshBasicMaterial({ color: ca, transparent: true, opacity: base, depthWrite: false }); obj = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .017, 6, false), mat); }
  else {
    const pts = curve.getPoints(28), col = new Float32Array(pts.length * 3), c1 = new THREE.Color(ca), c2 = new THREE.Color(cb), c = new THREE.Color();
    pts.forEach((p, k) => { c.copy(c1).lerp(c2, k / (pts.length - 1)); col.set([c.r, c.g, c.b], k * 3); });
    const geo = new THREE.BufferGeometry().setFromPoints(pts); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: base, depthWrite: false }); obj = new THREE.Line(geo, mat);
  }
  cluster.add(obj); const e = { kind, a, b, curve, mat, base, cur: 0, tgt: base, ca: new THREE.Color(ca), cb: new THREE.Color(cb) };
  edges.push(e); if (a) a.links.push(e); if (b && b !== a) b.links.push(e); return e;
}
nodes.forEach((n, i) => {
  const dir = n.pos.clone().normalize(), end = dir.clone().multiplyScalar(CR * .97), start = n.pos.clone().sub(dir.clone().multiplyScalar(n.r * .95));
  const e = addEdge('center', n, null, curveBetween(start, end, .45 + rng() * .5), .5, n.d.color, '#ffffff');
  for (let k = 0; k < 4; k++) pulses.push({ e, ph: k / 4 + rng() * .1, sp: .16 + rng() * .06, rev: false, s: .15, c: new THREE.Color(n.d.color) });
});
const have = new Set(), key = (a, b) => [a, b].sort().join('|');
EDGES.forEach(([a, b]) => {
  const A = byId[a], B2 = byId[b]; if (!A || !B2) return; have.add(key(a, b));
  const e = addEdge('sem', A, B2, curveBetween(A.pos, B2.pos, 1.1), .62, A.d.color, B2.d.color); e.sem = true;
  for (let k = 0; k < 2; k++) pulses.push({ e, ph: k * .5 + rng() * .2, sp: .1 + rng() * .05, rev: false, s: .1, c: A.d.color === B2.d.color ? new THREE.Color(A.d.color) : new THREE.Color(A.d.color).lerp(new THREE.Color(B2.d.color), .5) });
});
nodes.forEach(n => { nodes.filter(m => m !== n).map(m => [m, m.pos.distanceTo(n.pos)]).sort((p, q) => p[1] - q[1]).slice(0, 2).forEach(([m]) => { const k = key(n.d.id, m.d.id); if (have.has(k)) return; have.add(k); addEdge('near', n, m, curveBetween(n.pos, m.pos, .5), .2, n.d.color, m.d.color); }); });

/* shader titik: pulsa aliran data + debu dekoratif */
const PV = `attribute float aS;attribute float aA;attribute vec3 aC;uniform float uK,uT;uniform float uDrift;varying float vA;varying vec3 vC;
void main(){vec3 p=position;p+=uDrift*vec3(sin(uT*.4+position.y*1.7),cos(uT*.35+position.z*1.3),sin(uT*.3+position.x*1.9))*.22;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aS*uK/-mv.z;vA=aA;vC=aC;}`;
const pointsMat = (ring, drift) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uK: { value: 600 }, uT: { value: 0 }, uDrift: { value: drift } }, vertexShader: PV,
  fragmentShader: `varying float vA;varying vec3 vC;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;${ring ? 'if(r<.4)discard;' : ''}float a=${ring ? 'smoothstep(.5,.44,r)*.8' : 'smoothstep(.5,.15,r)'}*vA;gl_FragColor=vec4(vC,a);
  #include <colorspace_fragment>
  }` });
function pointsObj(count, ring, drift) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); geo.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(count), 1)); geo.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const o = new THREE.Points(geo, pointsMat(ring, drift)); o.frustumCulled = false; cluster.add(o); return o;
}
const pPts = pointsObj(pulses.length, false, 0); pPts.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); pPts.geometry.attributes.aA.setUsage(THREE.DynamicDrawUsage);
pulses.forEach((p, i) => { pPts.geometry.attributes.aS.setX(i, p.s); pPts.geometry.attributes.aC.setXYZ(i, p.c.r, p.c.g, p.c.b); });
const dots = pointsObj(110, false, 1), rings = pointsObj(26, true, 1);
[[dots, 110, .08, .2, .85], [rings, 26, .3, .6, 1]].forEach(([o, c, s0, s1, al]) => {
  const g = o.geometry, cc = new THREE.Color();
  for (let i = 0; i < c; i++) {
    const v = new THREE.Vector3(rng() - .5, rng() - .5, rng() - .5).normalize().multiplyScalar(2.9 + rng() * 5.6);
    g.attributes.position.setXYZ(i, v.x, v.y * .9, v.z); g.attributes.aS.setX(i, s0 + rng() * (s1 - s0)); g.attributes.aA.setX(i, al * (.6 + rng() * .4)); cc.set(palette[Math.floor(rng() * palette.length)]); g.attributes.aC.setXYZ(i, cc.r, cc.g, cc.b);
  }
});
const pointMats = [pPts, dots, rings].map(o => o.material);

/* gelombang cincin (idle ping + opening) */
const wavePool = [];
for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(.992, 1, 128), new THREE.MeshBasicMaterial({ color: 0x4b5fe8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; m.userData = { t: 1, sp: 1, mx: 3 }; rootFx.add(m); wavePool.push(m); }
function ping(color, sp, mx) { const m = wavePool.find(w => w.userData.t >= 1); if (!m) return; m.material.color.set(color); Object.assign(m.userData, { t: 0, sp, mx }); m.visible = true; }

/* ---------------- UI: label, legenda, panel ---------------- */
const labelsEl = $('#labels');
nodes.forEach(n => { const d = document.createElement('div'); d.className = 'nl'; d.innerHTML = '<span></span><small></small>'; labelsEl.appendChild(d); n.label = d; });
const legendBtns = {};
nodes.forEach(n => { const li = document.createElement('li'), b = document.createElement('button'); b.innerHTML = `<i style="background:${n.d.color}"></i><span></span>`; b.addEventListener('click', () => select(n.d.id)); li.appendChild(b); $('#lg-l').appendChild(li); legendBtns[n.d.id] = b; });
const nm = (n, main) => (lang === 'ja' ? (main ? n.d.ja : n.d.en) : (main ? n.d.en : n.d.ja));
function renderInfo() {
  const n = S.sel && byId[S.sel], t = L(); if (!n) return;
  $('#i-dot').style.background = n.d.color; $('#i-t').textContent = nm(n, true); $('#i-s').textContent = nm(n, false);
  $('#i-rh').textContent = t.role; $('#i-r').textContent = lang === 'ja' ? n.d.roleJa : n.d.roleEn; $('#i-oh').textContent = t.out; $('#i-o').textContent = n.d.key; $('#i-lh').textContent = t.link;
  const box = $('#i-l'); box.innerHTML = ''; const seen = new Set();
  EDGES.forEach(([a, b]) => { const o = a === n.d.id ? b : b === n.d.id ? a : null; if (!o || seen.has(o)) return; seen.add(o); const btn = document.createElement('button'); btn.textContent = nm(byId[o], true); btn.addEventListener('click', () => select(o)); box.appendChild(btn); });
  $('#i-c').textContent = t.toCenter; $('#i-st').textContent = `${t.stage}: ${n.d.stage}`;
}
function applyLang() {
  const t = L(); document.documentElement.lang = lang;
  document.querySelectorAll('#lang button').forEach(b => { const on = b.dataset.l === lang; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  nodes.forEach(n => { n.label.firstChild.textContent = nm(n, true); n.label.lastChild.textContent = nm(n, false); legendBtns[n.d.id].lastChild.textContent = nm(n, true); });
  $('#lg-t').textContent = t.legend; $('#hint-t').textContent = t.hint; $('#tag-t').textContent = t.tag(N); $('#op-t').textContent = t.openTitle; $('#ed-t').textContent = t.mountTitle; $('#ed-p').textContent = t.mountText; $('#ed-back').textContent = t.back; $('#info-x').setAttribute('aria-label', t.close);
  drawCenter(); renderInfo();
}
function setLang(l) { if (!I18N[l]) return; lang = l; try { localStorage.setItem('apisys-lang', l); } catch (e) { /* ignore */ } applyLang(); }
document.querySelectorAll('#lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.l)));

function select(id) {
  const n = byId[id]; if (!n || S.editor || O.on) return; S.sel = id; renderInfo(); $('#info').classList.add('open');
  Object.values(legendBtns).forEach(b => b.classList.remove('on')); legendBtns[id].classList.add('on'); nodes.forEach(m => m.label.classList.toggle('on', m === n));
  const tgt = (innerWidth < 900 ? new THREE.Vector3(0, .8, .6) : new THREE.Vector3(-.85, .1, .52)).normalize(); S.focusQ = new THREE.Quaternion().setFromUnitVectors(n.pos.clone().normalize(), tgt);
}
function deselect() { S.sel = null; S.focusQ = null; $('#info').classList.remove('open'); Object.values(legendBtns).forEach(b => b.classList.remove('on')); nodes.forEach(m => m.label.classList.remove('on')); }
$('#info-x').addEventListener('click', deselect);

/* ---------------- interaksi ---------------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), P = { down: false, x: 0, y: 0, sx: 0, sy: 0, moved: false };
const pickables = [centerMesh, ...nodes.map(n => n.mesh)];
function pick(e) { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(pickables, false)[0]; return h ? (h.object === centerMesh ? 'center' : h.object.userData.node) : null; }
cv.addEventListener('pointerdown', e => { if (S.editor || O.on) return; P.down = true; P.moved = false; P.x = P.sx = e.clientX; P.y = P.sy = e.clientY; S.vx = S.vy = 0; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } });
cv.addEventListener('pointermove', e => {
  mouse.set((e.clientX / innerWidth * 2 - 1) * 3.12 * (innerWidth / innerHeight), -(e.clientY / innerHeight * 2 - 1) * 3.12);
  if (P.down) {
    const dx = e.clientX - P.x, dy = e.clientY - P.y; P.x = e.clientX; P.y = e.clientY;
    if (Math.hypot(e.clientX - P.sx, e.clientY - P.sy) > 5) { P.moved = true; cv.classList.add('drag'); S.focusQ = null; }
    if (P.moved) { S.vx = dx * .0055; S.vy = dy * .0055; rot(S.vx, S.vy); }
  } else if (!S.editor && !O.on) { const h = pick(e); S.hover = h === 'center' ? 'center' : h; cv.classList.toggle('hover', !!h); }
});
const up = e => { if (!P.down) return; P.down = false; cv.classList.remove('drag'); try { cv.releasePointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  if (P.moved) return; const h = pick(e); if (h === 'center') openEditor(); else if (h) select(h.d.id); else if (S.sel) deselect(); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { P.down = false; cv.classList.remove('drag'); });
cv.addEventListener('pointerleave', () => { S.hover = null; cv.classList.remove('hover'); });
cv.addEventListener('wheel', e => { e.preventDefault(); S.zoomT = clamp(S.zoomT * (1 + e.deltaY * .0012), .5, 1.45); }, { passive: false });
addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (S.editor) closeEditor(); else if (S.sel) deselect(); });
const qT = new THREE.Quaternion(), eT = new THREE.Euler();
function rot(dx, dy) { qT.setFromEuler(eT.set(dy, dx, 0)); cluster.quaternion.premultiply(qT); }

/* ---------------- opening → editor ---------------- */
const O = { on: false, t0: 0, flashed: false, rings: 0, done: false };
function openEditor() {
  if (O.on || S.editor) return; deselect(); O.on = true; O.t0 = performance.now(); O.flashed = false; O.rings = 0; O.done = false; document.body.classList.add('opening');
  $('#opening').classList.add('on'); $('#op-b').style.width = '0%'; $('#op-m').textContent = L().msgs[0]; B.mT = 1;
}
function closeEditor() {
  if (!S.editor) return; S.editor = false; $('#editor').classList.remove('on'); $('#editor').setAttribute('aria-hidden', 'true'); $('#flash').classList.remove('on'); document.body.classList.remove('opening'); B.mT = 0; B.pT = 0; O.on = false;
}
$('#ed-back').addEventListener('click', closeEditor);
function updateOpening(now) {
  const t = (now - O.t0) / 1000, k = reduce ? 2 : 1, tt = t * k;
  S.out = ease(clamp(tt / 1.7, 0, 1)); S.dive = ease(clamp(tt / 2.3, 0, 1)); S.spin = 1 + S.out * 9; B.pT = clamp(tt / 2.6, 0, 1);
  const pr = clamp(tt / 2.7, 0, 1); $('#op-b').style.width = (pr * 100).toFixed(1) + '%'; $('#op-m').textContent = L().msgs[Math.min(L().msgs.length - 1, Math.floor(pr * L().msgs.length))];
  const sched = [.1, .6, 1.2, 1.9]; while (O.rings < sched.length && tt > sched[O.rings]) { ping(['#0fa3a3', '#4b5fe8', '#f2b01e', '#1fa971'][O.rings], 1.1, 9); O.rings++; }
  if (!O.flashed && tt > 2.8) { O.flashed = true; $('#flash').classList.add('on'); }
  if (!O.done && tt > 3.3) {
    O.done = true; S.editor = true; O.on = false; $('#opening').classList.remove('on'); $('#editor').classList.add('on'); $('#editor').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#flash').classList.remove('on'), 400); openEditorHook({ source: 'landing', lang, nodes: NODES.map(n => n.id), time: Date.now() });
  }
}

/* ---------------- resize ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2); R.setPixelRatio(dpr); R.setSize(w, h, false); S.W = w; S.H = h;
  cam.aspect = bgCam.aspect = w / h; cam.updateProjectionMatrix(); bgCam.updateProjectionMatrix(); BU.uPR.value = dpr;
  const tn = Math.tan(cam.fov * Math.PI / 360); S.base = Math.max(5.9 / tn, 7.0 / (tn * (w / h))) / .9; S.K = h * dpr / (2 * tn); pointMats.forEach(m => { m.uniforms.uK.value = S.K; });
}
addEventListener('resize', resize);

/* ---------------- loop ---------------- */
const wp = new THREE.Vector3(), invQ = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0), toCam = new THREE.Vector3();
let last = performance.now(), uiShown = false;
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000, el = (now - S.start) / 1000;
  if (O.on) updateOpening(now); else if (!S.editor) { const k = 1 - Math.exp(-dt * 2.4); S.out += (0 - S.out) * k; S.dive += (0 - S.dive) * k; S.spin += (1 - S.spin) * k; }
  if (!uiShown && el > 1.6) { uiShown = true; document.body.classList.remove('loading'); }
  S.zoom += (S.zoomT - S.zoom) * (1 - Math.exp(-dt * 6));
  B.m += (B.mT - B.m) * (1 - Math.exp(-dt * 1.6)); B.p += (B.pT - B.p) * (1 - Math.exp(-dt * 4)); BU.uT.value = t; BU.uM.value = B.m; BU.uP.value = B.p; BU.uMo.value.lerp(mouse, .12);
  /* rotasi */
  if (!P.down) {
    if (S.focusQ) cluster.quaternion.slerp(S.focusQ, 1 - Math.exp(-dt * 3.2));
    else { if (Math.abs(S.vx) + Math.abs(S.vy) > 1e-5) { rot(S.vx, S.vy); const d = Math.exp(-dt * 3.2); S.vx *= d; S.vy *= d; } if (!reduce && !S.sel && !S.editor) cluster.quaternion.premultiply(qT.setFromAxisAngle(yAxis, dt * .11 * S.spin)); }
  }
  cluster.scale.setScalar(1 + S.out * 1.9);
  /* kamera */
  const dist = THREE.MathUtils.lerp(S.base * S.zoom, 5.8, S.dive); cam.position.set(0, 0, dist); cam.lookAt(0, 0, 0);
  /* pusat */
  const hC = S.hover === 'center' ? 1 : 0; S.cHover += (hC - S.cHover) * (1 - Math.exp(-dt * 6)); const cs = 1 + .05 * S.cHover + .22 * S.dive; rootFx.scale.setScalar(cs);
  centerMat.uniforms.uT.value = t; centerMat.uniforms.uH.value = S.cHover; wire.rotation.y = t * .08; wire.rotation.x = t * .05;
  cRings.forEach(r => { r.rotation.z += r.userData.sp * dt * S.spin; r.rotation.y += r.userData.sp * .4 * dt; });
  cArcs.children.forEach(a => { a.rotation.z += a.userData.sp * dt * S.spin; }); cArcs.position.set(0, 0, 0); cArcs.quaternion.identity();
  toCam.copy(cam.position).normalize(); cText.position.copy(toCam).multiplyScalar(CR + .05); cText.material.opacity = 1 - S.dive * .9;
  cHalo.material.opacity = .42 + Math.sin(t * 1.4) * .06 + S.cHover * .12;
  if (!O.on && !S.editor && !reduce && Math.floor(t / 3.1) !== Math.floor((t - dt) / 3.1)) ping('#4b5fe8', .55, 3.4);
  wavePool.forEach(w => { const u = w.userData; if (u.t >= 1) { w.visible = false; return; } u.t = Math.min(1, u.t + dt * u.sp * .5); const s = CR * (1.05 + (u.mx - 1.05) * ease(u.t)); w.scale.setScalar(s); w.material.opacity = (1 - u.t) * .55; });
  /* bubble */
  invQ.copy(cluster.quaternion).invert();
  nodes.forEach(n => {
    const ap = reduce ? 1 : clamp((now - S.start) / 1000 - .35 - n.i * Math.min(.11, 1.8 / N), 0, 1.3) / 1.3; n.appear = ap;
    const hv = S.hover && S.hover !== 'center' && S.hover === n ? 1 : 0; n.hover += (hv - n.hover) * (1 - Math.exp(-dt * 8)); n.sel += ((S.sel === n.d.id ? 1 : 0) - n.sel) * (1 - Math.exp(-dt * 6));
    const sc = n.r * (reduce ? 1 : Math.max(.0001, backOut(ap))) * (1 + .14 * n.hover + .1 * n.sel); n.mesh.scale.setScalar(sc);
    n.mat.uniforms.uH.value = n.hover + n.sel * .6; n.mat.uniforms.uA.value = 1 - S.out * .85;
    n.g.position.copy(n.pos).add(tmp.set(Math.sin(t * .6 + n.i * 1.7) * .09, Math.cos(t * .5 + n.i * 2.3) * .09, Math.sin(t * .4 + n.i) * .09));
    n.g.getWorldPosition(wp); toCam.copy(cam.position).sub(wp).normalize().applyQuaternion(invQ); n.icon.position.copy(toCam).multiplyScalar(sc + .03); n.icon.scale.setScalar(sc * 1.15); n.icon.material.opacity = (1 - S.out) * clamp(ap * 2, 0, 1);
    n.halo.scale.setScalar(sc * 3.6); n.halo.material.opacity = (.26 + n.hover * .2 + n.sel * .25) * (1 - S.out) * clamp(ap, 0, 1);
    n.rg.quaternion.copy(invQ); n.rg.scale.setScalar(sc / n.r); n.spin.children.forEach(m => { m.rotation.z += m.userData.sp * dt * S.spin; m.material.opacity = .75 * (1 - S.out) * clamp(ap, 0, 1); });
    /* label HTML */
    const d2 = wp.distanceTo(cam.position), rpx = sc * cluster.scale.x / (d2 * Math.tan(cam.fov * Math.PI / 360)) * S.H / 2; wp.project(cam);
    const x = (wp.x * .5 + .5) * S.W, y = (-wp.y * .5 + .5) * S.H, near = S.base * S.zoom - 6.5, depth = clamp((d2 - near) / 13, 0, 1);
    const behind = d2 > dist, crPx = CR * cs / (dist * Math.tan(cam.fov * Math.PI / 360)) * S.H / 2, occ = behind ? clamp((Math.hypot(x - S.W / 2, y - S.H / 2) - crPx * .8) / (crPx * .25), 0, 1) : 1;
    n.label.style.transform = `translate(${x.toFixed(1)}px,${(y + rpx + 6).toFixed(1)}px) translateX(-50%)`; n.label.style.opacity = (clamp(ap * 1.4 - .3, 0, 1) * (1 - depth * .65) * occ * (S.sel && S.sel !== n.d.id ? .55 : 1)).toFixed(2);
  });
  /* edge */
  const fo = S.sel ? byId[S.sel] : (S.hover && S.hover !== 'center' ? S.hover : null);
  edges.forEach(e => {
    const involved = fo && (e.a === fo || e.b === fo); e.tgt = fo ? (involved ? (e.kind === 'near' ? .55 : 1) : e.base * .3) : e.base;
    e.cur += (e.tgt - e.cur) * (1 - Math.exp(-dt * 6)); const draw = e.b ? Math.min(clamp(e.a.appear * 1.4, 0, 1), clamp(e.b.appear * 1.4, 0, 1)) : clamp(e.a.appear * 1.4, 0, 1);
    e.mat.opacity = e.cur * draw * (1 - S.out * .9); e.f = (involved ? 1 : fo ? .3 : 1) * draw;
  });
  /* pulsa */
  const pa = pPts.geometry.attributes.position, aa = pPts.geometry.attributes.aA;
  pulses.forEach((p, i) => { const u = (p.ph + t * p.sp * S.spin) % 1; p.e.curve.getPoint(u, tmp); pa.setXYZ(i, tmp.x, tmp.y, tmp.z); aa.setX(i, Math.sin(Math.PI * u) * (p.e.f || 0) * (1 - S.out * .85)); });
  pa.needsUpdate = aa.needsUpdate = true; pointMats.forEach(m => { m.uniforms.uT.value = t; }); dots.material.uniforms.uDrift.value = 1; rings.material.uniforms.uDrift.value = 1;
  dots.material.opacity = 1; dots.visible = rings.visible = S.out < .98;
  /* render */
  R.clear(); R.render(bgScene, bgCam); R.clearDepth(); R.render(scene, cam);
}

/* expose untuk integrasi AI berikutnya: [[API_SYSTEM:PUBLIC_API]] */
window.APISystem = Object.assign(window.APISystem || {}, { openEditor, closeEditor, select, deselect, setLang, nodes: NODES, edges: EDGES, onEditorOpen: (window.APISystem && window.APISystem.onEditorOpen) || null });
resize(); applyLang(); requestAnimationFrame(frame);
