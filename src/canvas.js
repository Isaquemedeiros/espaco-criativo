// Desenho do átomo, poeira e fio do tempo (portado dos protótipos)
const spr = {}, bl = {};
export function sprite(col) {
  if (spr[col]) return spr[col];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(' + col + ',0.9)'); g.addColorStop(0.5, 'rgba(' + col + ',0.25)'); g.addColorStop(1, 'rgba(' + col + ',0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (spr[col] = cv);
}
function ball(col) {
  if (bl[col]) return bl[col];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(24, 22, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(' + col + ',0.95)'); g.addColorStop(0.85, 'rgba(' + col + ',0.55)'); g.addColorStop(1, 'rgba(' + col + ',0)');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, 6.283); x.fill(); return (bl[col] = cv);
}
const NU = (() => { const r = []; for (let i = 0; i < 13; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u), d = i === 0 ? 0 : 0.55 + Math.random() * 0.45; r.push([s * Math.cos(th) * d, u * d, s * Math.sin(th) * d, Math.random() * 6.283, i % 2]); } return r; })();

export function makeDust(n, w, h) { const r = []; for (let i = 0; i < n; i++) r.push([Math.random() * w, Math.random() * h, Math.random() * 6]); return r; }
export function drawDust(c, t, ns, al, D) {
  for (let i = 0; i < D.length; i++) {
    const a = D[i], tw = 0.5 + 0.5 * Math.sin(t * 0.9 + a[2]);
    c.fillStyle = 'rgba(' + ns + ',' + ((0.12 + 0.25 * tw) * al).toFixed(3) + ')'; c.fillRect(a[0] - 1, a[1] - 1, 2, 2);
    if (i % 9 === 0) { c.globalAlpha = 0.5 * tw * al; c.drawImage(sprite(ns), a[0] - 6, a[1] - 6, 12, 12); c.globalAlpha = 1; }
  }
}
// st: {at, as, cy, wakeT}
export function drawAtom(c, t, ns, es, sleep, st, ox) {
  const wk = st.wakeT, k = st.as, oy = st.cy + Math.sin(t * 0.6) * 3;
  const spd = sleep ? 0.22 : 0.55 + 0.55 * wk; st.at += 0.016 * spd; const A = st.at, lum = sleep ? 0.45 : 0.55 + 0.45 * wk;
  const g = c.createRadialGradient(ox, oy, 0, ox, oy, 200 * k); g.addColorStop(0, 'rgba(' + ns + ',' + (0.28 * lum).toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(' + ns + ',' + (0.08 * lum).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + ns + ',0)');
  c.fillStyle = g; c.fillRect(ox - 220 * k, oy - 220 * k, 440 * k, 440 * k);
  const O = [[0, 1.0, 0], [1.05, 0.82, 2.1], [-1.05, 0.68, 4.2]], rx = 155 * k, ry = 50 * k, E = [];
  O.forEach((o, n) => {
    c.save(); c.translate(ox, oy); c.rotate(o[0]); c.lineWidth = 1; c.strokeStyle = 'rgba(' + ns + ',' + (0.28 * lum).toFixed(3) + ')'; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 6.283); c.stroke(); c.restore();
    for (let m = 0; m < (n === 0 ? 2 : 1); m++) E.push({ o, a: A * o[1] * 2.2 + o[2] + m * Math.PI });
  });
  const pt = (o, a) => { const x = Math.cos(a) * rx, y = Math.sin(a) * ry, cr = Math.cos(o[0]), sr = Math.sin(o[0]); return [ox + x * cr - y * sr, oy + x * sr + y * cr, Math.sin(a)]; };
  const drawE = e => {
    const hd = pt(e.o, e.a); c.lineCap = 'round';
    for (let j = 1; j < 22; j++) { const p1 = pt(e.o, e.a - (j - 1) * 0.045), p2 = pt(e.o, e.a - j * 0.045), al = (1 - j / 22) * lum; c.lineWidth = (2.4 * (1 - j / 22) + 0.4) * Math.max(0.6, k); c.strokeStyle = 'rgba(' + es + ',' + (0.7 * al).toFixed(3) + ')'; c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke(); }
    const r = (hd[2] > 0 ? 13 : 10) * k * 1.25; c.globalAlpha = lum * (hd[2] > 0 ? 1 : 0.6); c.drawImage(sprite(es), hd[0] - r, hd[1] - r, r * 2, r * 2); c.globalAlpha = 1;
  };
  E.forEach(e => { if (Math.sin(e.a) < 0) drawE(e); });
  c.globalAlpha = lum; c.drawImage(sprite(ns), ox - 60 * k, oy - 60 * k, 120 * k, 120 * k); c.globalAlpha = 1;
  const rot = A * 0.6, cr = Math.cos(rot), sr = Math.sin(rot);
  const NP = NU.map(q => { const x = q[0] * cr + q[2] * sr, z = -q[0] * sr + q[2] * cr, j = Math.sin(t * 3 + q[3]) * 0.05; return [ox + (x + j) * 24 * k, oy + (q[1] + j) * 24 * k, z, q[4]]; }).sort((a, b) => a[2] - b[2]);
  c.globalCompositeOperation = 'source-over';
  NP.forEach(p => { const r = 13 * k * (1 + p[2] * 0.12); c.globalAlpha = 0.6 + 0.4 * lum; c.drawImage(ball(p[3] ? es : ns), p[0] - r, p[1] - r, r * 2, r * 2); });
  c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
  E.forEach(e => { if (Math.sin(e.a) >= 0) drawE(e); });
}
const cat = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return [0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)); };
// TL: pontos dos dias; pend[i]: dia com algo pra trás; today: índice; vertical: celular
export function drawTime(c, t, ns, TL, pend, today, vertical) {
  const SEG = vertical ? 24 : 30, n = TL.length;
  const first = vertical ? [TL[0][0] + 20, TL[0][1] - 60] : [TL[0][0] - 140, TL[0][1] + 40];
  const last = vertical ? [TL[n - 1][0] - 20, TL[n - 1][1] + 50] : [TL[n - 1][0] + 140, TL[n - 1][1] - 40];
  const ext = [first].concat(TL).concat([last]), pts = [];
  for (let i = 0; i < ext.length - 1; i++) { const p0 = ext[Math.max(0, i - 1)], p3 = ext[Math.min(ext.length - 1, i + 2)]; for (let j = 0; j < SEG; j++) pts.push(cat(p0, ext[i], ext[i + 1], p3, j / SEG)); }
  const N = pts.length; c.lineCap = 'round';
  for (let st = 0; st < 4; st++) {
    c.beginPath();
    for (let i = 0; i < N; i++) { const w = Math.sin(i * (vertical ? 0.08 : 0.07) + t * (0.6 + st * 0.2) + st * 1.7) * (st === 0 ? 0 : (vertical ? 4 + st * 2.5 : 5 + st * 3)); const x = pts[i][0] + (vertical ? w : 0), y = pts[i][1] + (vertical ? 0 : w); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.lineWidth = st === 0 ? 1.6 : 0.6; c.strokeStyle = 'rgba(' + ns + ',' + (st === 0 ? 0.7 : 0.22) + ')'; c.stroke();
  }
  if (!vertical) for (let i = 0; i < N; i += 3) { const ww = Math.sin(i * 0.5 + t) * 10; c.fillStyle = 'rgba(' + ns + ',0.3)'; c.fillRect(pts[i][0], pts[i][1] + ww, 1.3, 1.3); }
  const H = vertical ? 14 : 20;
  TL.forEach((p, d) => {
    if (!pend[d]) return; const ci = (d + 1) * SEG;
    c.lineWidth = 7; c.strokeStyle = 'rgba(255,165,61,0.18)'; c.beginPath();
    for (let i = ci - H; i <= ci + H; i++) { if (i === ci - H) c.moveTo(pts[i][0], pts[i][1]); else c.lineTo(pts[i][0], pts[i][1]); }
    c.stroke(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,170,70,0.9)'; c.stroke();
  });
  const K = vertical ? 3 : 4, len = vertical ? 40 : 50;
  for (let k = 0; k < K; k++) {
    const hd = Math.floor(((t * (vertical ? 0.05 : 0.045) + k / K) % 1) * (N - 1));
    for (let i = Math.max(1, hd - len); i <= hd; i++) {
      const a = Math.pow((i - (hd - len)) / len, 1.6);
      c.lineWidth = 4; c.strokeStyle = 'rgba(' + ns + ',' + (0.2 * a).toFixed(3) + ')'; c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
      c.lineWidth = 1.4; c.strokeStyle = 'rgba(225,240,255,' + (0.9 * a).toFixed(3) + ')'; c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    }
  }
  TL.forEach((p, d) => {
    const col = pend[d] ? '255,170,70' : (d === today ? ns : '220,232,250'), hh = d === today ? (vertical ? 14 : 16) : (vertical ? 10 : 11);
    c.lineWidth = d === today ? 2.2 : 1.4; c.strokeStyle = 'rgba(' + col + ',' + (d === today || pend[d] ? 0.95 : 0.6) + ')'; c.beginPath();
    if (vertical) { c.moveTo(p[0] - hh, p[1]); c.lineTo(p[0] + hh, p[1]); } else { c.moveTo(p[0], p[1] - hh); c.lineTo(p[0], p[1] + hh); }
    c.stroke();
  });
}
