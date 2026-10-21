/* API System landing — versi ringan: Canvas 2D, tanpa library, bubble datar 1 warna, rotasi 2D. */
import { NODES, EDGES, I18N } from './data.js';
import { openEditorHook } from './config.js';

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => 1 - Math.pow(1 - t, 3);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONT = '"Hiragino Sans","Yu Gothic UI","Segoe UI Variable","Segoe UI",Meiryo,system-ui,sans-serif';
const COLOR = '#0fa3a3', COLOR_DARK = '#0b7f7f', TAU = Math.PI * 2;

let lang = 'ja';
try { lang = localStorage.getItem('apisys-lang') || 'ja'; } catch (e) { /* ignore */ }
if (!I18N[lang]) lang = 'ja';
const L = () => I18N[lang];

/* ---------------- canvas ---------------- */
const cv = $('#gl'), ctx = cv.getContext('2d');
const S = { W: 1, H: 1, dpr: 1, cx: 0, cy: 0, sx: 1, sy: 1, unit: 40, rc: 60, rot: 0, vel: 0, zoom: 1, zoomT: 1, out: 0,
  sel: null, hover: null, focus: null, editor: false, dirty: true, start: performance.now() };

/* ---------------- data → node ---------------- */
const N = NODES.length, byId = {};
const nodes = NODES.map((d, i) => ({ d, i, size: d.size, nbr: [], ang: 0, ring: 0, ux: 0, uy: 0, x: 0, y: 0, R: 20, r: 20, ap: 0, lines: [], fs: 10 }));
nodes.forEach(n => { byId[n.d.id] = n; });
const edgeList = [], seen = new Set();
EDGES.forEach(([a, b]) => {
  const A = byId[a], B = byId[b], k = [a, b].sort().join('|'); if (!A || !B || seen.has(k)) return; seen.add(k);
  A.nbr.push(B); B.nbr.push(A); edgeList.push([A, B]);
});

/* tata letak: cincin konsentris, urutan sudut direlaksasi supaya garis tidak banyak bersilangan */
(function layout() {
  const order = [...nodes].sort((a, b) => b.nbr.length - a.nbr.length || b.size - a.size);
  const n1 = Math.round(N * .24), n2 = Math.round(N * .35), RAD = [.42, .72, 1];
  const rings = [order.slice(0, n1), order.slice(n1, n1 + n2), order.slice(n1 + n2)];
  rings.forEach((g, gi) => g.forEach((n, k) => { n.ring = gi; n.ang = k / g.length * TAU + gi * .55; }));
  for (let it = 0; it < 40; it++) {
    nodes.forEach(n => {
      let x = Math.cos(n.ang) * RAD[n.ring] * .5, y = Math.sin(n.ang) * RAD[n.ring] * .5;
      n.nbr.forEach(m => { x += Math.cos(m.ang) * RAD[m.ring]; y += Math.sin(m.ang) * RAD[m.ring]; });
      n.tgt = (Math.atan2(y, x) + TAU) % TAU;
    });
    rings.forEach((g, gi) => [...g].sort((a, b) => a.tgt - b.tgt).forEach((n, k) => { n.ang = k / g.length * TAU + gi * .55; }));
  }
  nodes.forEach(n => { n.ux = Math.cos(n.ang) * RAD[n.ring]; n.uy = Math.sin(n.ang) * RAD[n.ring]; });
})();

/* ---------------- teks di dalam bubble ---------------- */
const nm = (n, main) => (lang === 'ja' ? (main ? n.d.ja : n.d.en) : (main ? n.d.en : n.d.ja));
function wrap(text, maxW, cjk) {
  const fits = t => ctx.measureText(t).width <= maxW, lines = []; let cur = '';
  text.split(' ').forEach(w => { const t = cur ? cur + ' ' + w : w; if (fits(t) || !cur) cur = t; else { lines.push(cur); cur = w; } });
  if (cur) lines.push(cur); if (!cjk) return lines;
  return lines.flatMap(l => { if (fits(l)) return [l]; const o = []; let c = ''; [...l].forEach(ch => { if (fits(c + ch) || !c) c += ch; else { o.push(c); c = ch; } }); if (c) o.push(c); return o; });
}
function fitText(n) {
  const text = nm(n, true), cjk = /[^\x00-\x7f]/.test(text), maxW = n.R * 1.8;
  for (let fs = Math.min(15, Math.round(n.R * .36)); fs >= 7; fs--) {
    ctx.font = `600 ${fs}px ${FONT}`; const lines = wrap(text, maxW, cjk);
    if (lines.length <= 3 && lines.every(l => ctx.measureText(l).width <= maxW) && lines.length * fs * 1.2 <= n.R * 1.7) { n.lines = lines; n.fs = fs; return; }
  }
  ctx.font = `600 7px ${FONT}`; n.fs = 7; n.lines = wrap(text, maxW, cjk);
}

/* ---------------- UI: legenda & panel ---------------- */
const legendBtns = {};
nodes.forEach(n => {
  const li = document.createElement('li'), b = document.createElement('button');
  b.innerHTML = `<i style="background:${COLOR}"></i><span></span>`; b.addEventListener('click', () => select(n.d.id));
  li.appendChild(b); $('#lg-l').appendChild(li); legendBtns[n.d.id] = b;
});
function renderInfo() {
  const n = S.sel && byId[S.sel], t = L(); if (!n) return;
  $('#i-dot').style.background = COLOR; $('#i-t').textContent = nm(n, true); $('#i-s').textContent = nm(n, false);
  $('#i-rh').textContent = t.role; $('#i-r').textContent = lang === 'ja' ? n.d.roleJa : n.d.roleEn; $('#i-oh').textContent = t.out; $('#i-o').textContent = n.d.key; $('#i-lh').textContent = t.link;
  const box = $('#i-l'); box.innerHTML = '';
  n.nbr.forEach(m => { const btn = document.createElement('button'); btn.textContent = nm(m, true); btn.addEventListener('click', () => select(m.d.id)); box.appendChild(btn); });
  $('#i-c').textContent = t.toCenter; $('#i-st').textContent = `${t.stage}: ${n.d.stage}`;
}
function applyLang() {
  const t = L(); document.documentElement.lang = lang;
  document.querySelectorAll('#lang button').forEach(b => { const on = b.dataset.l === lang; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  nodes.forEach(n => { legendBtns[n.d.id].lastChild.textContent = nm(n, true); fitText(n); });
  $('#lg-t').textContent = t.legend; $('#hint-t').textContent = t.hint; $('#tag-t').textContent = t.tag(N); $('#op-t').textContent = t.openTitle; $('#ed-t').textContent = t.mountTitle; $('#ed-p').textContent = t.mountText; $('#ed-back').textContent = t.back; $('#info-x').setAttribute('aria-label', t.close);
  renderInfo(); S.dirty = true;
}
function setLang(l) { if (!I18N[l]) return; lang = l; try { localStorage.setItem('apisys-lang', l); } catch (e) { /* ignore */ } applyLang(); }
document.querySelectorAll('#lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.l)));

const wrapAng = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
function select(id) {
  const n = byId[id]; if (!n || S.editor || O.on) return; S.sel = id; renderInfo(); $('#info').classList.add('open');
  Object.values(legendBtns).forEach(b => b.classList.remove('on')); legendBtns[id].classList.add('on');
  const target = innerWidth < 900 ? -Math.PI / 2 : Math.PI; S.focus = S.rot + wrapAng(target - n.ang - S.rot); S.vel = 0; S.dirty = true;
}
function deselect() { S.sel = null; S.focus = null; $('#info').classList.remove('open'); Object.values(legendBtns).forEach(b => b.classList.remove('on')); S.dirty = true; }
$('#info-x').addEventListener('click', deselect);

/* ---------------- interaksi ---------------- */
const P = { down: false, moved: false, sx: 0, sy: 0, a: 0, t: 0 };
const pAng = e => Math.atan2((e.clientY - S.cy) / S.sy, (e.clientX - S.cx) / S.sx);
function pick(e) {
  const x = e.clientX, y = e.clientY;
  for (let i = nodes.length - 1; i >= 0; i--) { const n = nodes[i]; if (Math.hypot(x - n.x, y - n.y) <= n.r + 2) return n; }
  return Math.hypot(x - S.cx, y - S.cy) <= S.rc ? 'center' : null;
}
cv.addEventListener('pointerdown', e => {
  if (S.editor || O.on) return; P.down = true; P.moved = false; P.sx = e.clientX; P.sy = e.clientY; P.a = pAng(e); P.t = performance.now(); S.vel = 0; S.focus = null;
  try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
});
cv.addEventListener('pointermove', e => {
  if (P.down) {
    if (Math.hypot(e.clientX - P.sx, e.clientY - P.sy) > 5) { P.moved = true; cv.classList.add('drag'); }
    if (P.moved) { const a = pAng(e), now = performance.now(), d = wrapAng(a - P.a), dt = Math.max(.008, (now - P.t) / 1000); S.rot += d; S.vel = clamp(S.vel * .6 + d / dt * .4, -3, 3); P.a = a; P.t = now; S.dirty = true; }
  } else if (!S.editor && !O.on) {
    const h = pick(e); if (h !== S.hover) { S.hover = h; cv.classList.toggle('hover', !!h); S.dirty = true; }
  }
});
const up = e => {
  if (!P.down) return; P.down = false; cv.classList.remove('drag'); try { cv.releasePointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  if (P.moved) { if (performance.now() - P.t > 80) S.vel = 0; return; }
  const h = pick(e); if (h === 'center') openEditor(); else if (h) select(h.d.id); else if (S.sel) deselect();
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', () => { P.down = false; cv.classList.remove('drag'); });
cv.addEventListener('pointerleave', () => { if (S.hover) { S.hover = null; cv.classList.remove('hover'); S.dirty = true; } });
cv.addEventListener('wheel', e => { e.preventDefault(); S.zoomT = clamp(S.zoomT * (1 - e.deltaY * .0012), .6, 1.35); S.dirty = true; }, { passive: false });
addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (S.editor) closeEditor(); else if (S.sel) deselect(); });

/* ---------------- opening → editor ---------------- */
const O = { on: false, t0: 0, flashed: false, done: false };
function openEditor() {
  if (O.on || S.editor) return; deselect(); O.on = true; O.t0 = performance.now(); O.flashed = false; O.done = false;
  document.body.classList.add('opening'); $('#opening').classList.add('on'); $('#op-b').style.width = '0%'; $('#op-m').textContent = L().msgs[0];
}
function closeEditor() {
  if (!S.editor) return; S.editor = false; $('#editor').classList.remove('on'); $('#editor').setAttribute('aria-hidden', 'true'); $('#flash').classList.remove('on'); document.body.classList.remove('opening'); O.on = false; S.dirty = true;
}
$('#ed-back').addEventListener('click', closeEditor);
function updateOpening(now) {
  const tt = (now - O.t0) / 1000 * (reduce ? 3 : 1);
  S.out = ease(clamp(tt / 1.5, 0, 1));
  const pr = clamp(tt / 2.1, 0, 1); $('#op-b').style.width = (pr * 100).toFixed(1) + '%'; $('#op-m').textContent = L().msgs[Math.min(L().msgs.length - 1, Math.floor(pr * L().msgs.length))];
  if (!O.flashed && tt > 1.9) { O.flashed = true; $('#flash').classList.add('on'); }
  if (!O.done && tt > 2.3) {
    O.done = true; S.editor = true; O.on = false; $('#opening').classList.remove('on'); $('#editor').classList.add('on'); $('#editor').setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#flash').classList.remove('on'), 350); openEditorHook({ source: 'landing', lang, nodes: NODES.map(n => n.id), time: Date.now() });
  }
}

/* ---------------- ukuran layar ---------------- */
function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 1.5);
  S.W = w; S.H = h; S.dpr = dpr; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S.unit = clamp(Math.min(w, h) * .052, 22, 58); S.rc = S.unit * 1.55;
  const top = w < 900 ? 64 : 76, bottom = w < 900 ? 70 : 28, margin = S.unit * 1.05 + 10;
  S.cx = w / 2; S.cy = (top + h - bottom) / 2; S.sx = Math.max(60, w / 2 - margin); S.sy = Math.max(60, (h - top - bottom) / 2 - margin);
  nodes.forEach(n => { n.R = Math.max(22, S.unit * n.size); });
  applyLang();
}
addEventListener('resize', () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 80); });

/* ---------------- gambar ---------------- */
function place(now) {
  const c = Math.cos(S.rot), s = Math.sin(S.rot), z = S.zoom * (1 + S.out * 1.2), el = (now - S.start) / 1000;
  const fo = S.sel ? byId[S.sel] : (S.hover && S.hover !== 'center' ? S.hover : null);
  nodes.forEach(n => {
    n.ap = reduce ? 1 : ease(clamp((el - .15 - n.i * .03) / .5, 0, 1));
    n.x = S.cx + (n.ux * c - n.uy * s) * S.sx * z; n.y = S.cy + (n.ux * s + n.uy * c) * S.sy * z;
    n.r = n.R * n.ap * (n === fo ? 1.1 : 1);
  });
  return fo;
}
function draw(now) {
  const fo = place(now), fade = 1 - S.out * .9, t = L(), cap = ease(clamp((now - S.start) / 1000 / .5, 0, 1)), rc = S.rc * (reduce ? 1 : cap);
  ctx.clearRect(0, 0, S.W, S.H); ctx.globalAlpha = fade; ctx.lineCap = 'round';
  /* garis ke pusat (sangat tipis) */
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(15,163,163,.07)'; ctx.beginPath();
  nodes.forEach(n => { if (n !== fo) { ctx.moveTo(S.cx, S.cy); ctx.lineTo(n.x, n.y); } }); ctx.stroke();
  /* garis relasi */
  ctx.strokeStyle = fo ? 'rgba(15,163,163,.10)' : 'rgba(15,163,163,.30)'; ctx.beginPath();
  edgeList.forEach(([a, b]) => { if (fo && (a === fo || b === fo)) return; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }); ctx.stroke();
  if (fo) {
    ctx.strokeStyle = 'rgba(15,163,163,.9)'; ctx.lineWidth = 2; ctx.beginPath();
    fo.nbr.forEach(m => { ctx.moveTo(fo.x, fo.y); ctx.lineTo(m.x, m.y); }); ctx.stroke();
    ctx.strokeStyle = 'rgba(15,163,163,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(S.cx, S.cy); ctx.lineTo(fo.x, fo.y); ctx.stroke();
  }
  /* bubble pusat */
  ctx.globalAlpha = fade * cap; ctx.fillStyle = COLOR; ctx.beginPath(); ctx.arc(S.cx, S.cy, rc, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(15,163,163,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(S.cx, S.cy, rc + 7, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = Math.round(rc * .3); do { ctx.font = `700 ${fs}px ${FONT}`; fs--; } while (ctx.measureText(t.centerMain).width > rc * 1.7 && fs > 10);
  ctx.fillText(t.centerMain, S.cx, S.cy - rc * .3);
  const sfs = Math.max(8, Math.round(rc * .115)); ctx.font = `500 ${sfs}px ${FONT}`; ctx.globalAlpha = fade * cap * .9;
  wrap(t.centerSub, rc * 1.5, /[^\x00-\x7f]/.test(t.centerSub)).slice(0, 4).forEach((l, k) => ctx.fillText(l, S.cx, S.cy + rc * .12 + k * sfs * 1.25));
  ctx.globalAlpha = fade * cap; ctx.fillStyle = '#5b6b7a'; ctx.font = `500 11px ${FONT}`; ctx.fillText(t.centerHint, S.cx, S.cy + rc + 22);
  /* bubble */
  nodes.forEach(n => {
    if (n.ap <= 0.01) return; const inv = !fo || n === fo || fo.nbr.includes(n);
    ctx.globalAlpha = fade * clamp(n.ap * 1.5, 0, 1) * (inv ? 1 : .3); ctx.fillStyle = n === fo ? COLOR_DARK : COLOR;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, TAU); ctx.fill();
    if (n.ap < .6) return; ctx.fillStyle = '#fff'; ctx.font = `600 ${n.fs}px ${FONT}`; const lh = n.fs * 1.2, y0 = n.y - (n.lines.length - 1) * lh / 2;
    n.lines.forEach((l, k) => ctx.fillText(l, n.x, y0 + k * lh));
  });
  ctx.globalAlpha = 1;
}

/* ---------------- loop ---------------- */
let last = performance.now(), uiShown = false;
function frame(now) {
  requestAnimationFrame(frame); if (document.hidden) { last = now; return; }
  const el = (now - S.start) / 1000, intro = !reduce && el < 2.8;
  if (!uiShown && el > 1.2) { uiShown = true; document.body.classList.remove('loading'); }
  const auto = !reduce && !S.sel && !S.hover && !S.editor && !O.on && !P.down && S.focus === null;
  const moving = P.down || S.focus !== null || O.on || intro || Math.abs(S.vel) > 1e-3 || Math.abs(S.zoomT - S.zoom) > 1e-3 || S.out > .002;
  if (!auto && !moving && !S.dirty) { last = now; return; }
  if (auto && !moving && now - last < 33) return;          /* putaran santai dibatasi ±30 fps */
  const dt = Math.min(.05, (now - last) / 1000); last = now; S.dirty = false;
  if (O.on) updateOpening(now); else if (!S.editor && S.out > 0) { S.out *= Math.exp(-dt * 3); if (S.out < .002) S.out = 0; }
  S.zoom += (S.zoomT - S.zoom) * (1 - Math.exp(-dt * 8)); if (Math.abs(S.zoomT - S.zoom) < 1e-3) S.zoom = S.zoomT;
  if (!P.down) {
    if (S.focus !== null) { const d = S.focus - S.rot; S.rot += d * (1 - Math.exp(-dt * 5)); if (Math.abs(d) < .002) { S.rot = S.focus; S.focus = null; } }
    else { if (Math.abs(S.vel) > 1e-3) { S.rot += S.vel * dt; S.vel *= Math.exp(-dt * 3); } else S.vel = 0; if (auto) S.rot += dt * .045; }
  }
  if (!S.editor) draw(now);
}

/* expose untuk integrasi AI berikutnya: [[API_SYSTEM:PUBLIC_API]] */
window.APISystem = Object.assign(window.APISystem || {}, { openEditor, closeEditor, select, deselect, setLang, nodes: NODES, edges: EDGES, onEditorOpen: (window.APISystem && window.APISystem.onEditorOpen) || null });
resize(); requestAnimationFrame(frame);
