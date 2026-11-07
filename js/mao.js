// Mão articulada: pulso na origem, dedos para cima (-y), polegar à esquerda (-x).
// Dedo = [ângulo da base, dobra 1, dobra 2], em graus. Negativo dobra para o lado do polegar.
import { G, linha, arredonda, lerp, rad } from './motor.js';

const DEDOS = {
  i: { b: [-42, -112], l: [42, 28, 22], w: [13, 11.5, 10, 8.5] },
  m: { b: [-14, -120], l: [46, 31, 23], w: [13.5, 12, 10.5, 9] },
  r: { b: [14, -116], l: [42, 29, 22], w: [13, 11.5, 10, 8.5] },
  p: { b: [40, -102], l: [32, 22, 18], w: [11.5, 10, 9, 7.5] },
  t: { b: [-58, -55], l: [44, 34, 26], w: [17, 15, 13, 10.5] },
};
const NOMES = ['t', 'i', 'm', 'r', 'p'];
const ORDEM = ['p', 'r', 'm', 'i', 't'];

const PALMA = [
  [-38, 0], [-52, -22], [-63, -48], [-62, -80], [-56, -108], [-30, -124], [0, -130],
  [28, -126], [52, -104], [57, -70], [50, -34], [38, 0],
];

export const POSES = {
  relax: { t: [-52, 12, 10], i: [-8, -14, -10], m: [0, -14, -12], r: [8, -14, -12], p: [18, -14, -10], fr: 't' },
  aberta: { t: [-68, 8, 6], i: [-14, -4, -3], m: [-3, -3, -2], r: [8, -3, -3], p: [22, -3, -3], fr: 't' },
  pinca: { t: [-40, 15, 7], i: [-30, -50, -45], m: [-14, -48, -42], r: [0, -50, -42], p: [14, -46, -38], fr: 't' },
  pincaAb: { t: [-60, 8, 5], i: [-18, -30, -26], m: [-8, -36, -32], r: [3, -38, -34], p: [15, -36, -30], fr: 't' },
  esfrega: { t: [-44, 20, 10], i: [-26, -46, -50], m: [-14, -48, -42], r: [0, -50, -42], p: [14, -46, -38], fr: 't' },
  tesA: { t: [-66, 2, 4], i: [-12, -26, -22], m: [-10, -48, -44], r: [2, -52, -46], p: [14, -50, -42], fr: 'ti' },
  tesF: { t: [-50, 10, 8], i: [-24, -38, -32], m: [-10, -48, -44], r: [2, -52, -46], p: [14, -50, -42], fr: 'ti' },
  punho: { t: [-14, 8, 6], i: [-3, -9, -30], m: [0, -9, -30], r: [3, -9, -30], p: [7, -9, -30], fr: 'imrpt' },
  punhoFlick: { t: [-3, -4, -12], i: [-3, -9, -30], m: [0, -9, -30], r: [3, -9, -30], p: [7, -9, -30], fr: 'imrpt' },
};

export function mistura(a, b, k) {
  const r = { fr: k > .5 ? b.fr : a.fr };
  for (const n of NOMES) r[n] = [lerp(a[n][0], b[n][0], k), lerp(a[n][1], b[n][1], k), lerp(a[n][2], b[n][2], k)];
  return r;
}

function juntas(pose, n) {
  const d = DEDOS[n], g = pose[n];
  let [x, y] = d.b, a = 0;
  const out = [[x, y]];
  for (let i = 0; i < 3; i++) {
    a += g[i];
    x += Math.sin(rad(a)) * d.l[i];
    y -= Math.cos(rad(a)) * d.l[i];
    out.push([x, y]);
  }
  return out;
}

// Ponto entre as pontas do polegar e do indicador (local, sem espelho).
export function pincaLocal(pose) {
  const a = juntas(pose, 't')[3], b = juntas(pose, 'i')[3];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function posLocalParaMundo(h, lx, ly) {
  const x = (h.flip ? -lx : lx) * h.s, y = ly * h.s;
  const co = Math.cos(rad(h.r)), si = Math.sin(rad(h.r));
  return [h.x + x * co - y * si, h.y + x * si + y * co];
}

function contornoDedo(cen, larg) {
  const esq = [], dir = [];
  const m = cen.length;
  let tan = [0, -1];
  for (let i = 0; i < m; i++) {
    const a = cen[Math.max(0, i - 1)], b = cen[Math.min(m - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nt = [dx / l, dy / l];
    const nx = -nt[1], ny = nt[0], w = larg[i];
    const e = [cen[i][0] + nx * w, cen[i][1] + ny * w];
    const d = [cen[i][0] - nx * w, cen[i][1] - ny * w];
    // Na parte de dentro das dobras, ignora pontos que andariam para trás.
    const pe = esq[esq.length - 1];
    if (!pe || (e[0] - pe[0]) * nt[0] + (e[1] - pe[1]) * nt[1] > 0) esq.push(e);
    const pd = dir[dir.length - 1];
    if (!pd || (d[0] - pd[0]) * nt[0] + (d[1] - pd[1]) * nt[1] > 0) dir.push(d);
    tan = nt;
  }
  const c = cen[m - 1], w = larg[m - 1], a0 = Math.atan2(tan[0], -tan[1]);
  const ponta = [];
  for (let k = 1; k < 7; k++) {
    const a = a0 - Math.PI * k / 7;
    ponta.push([c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w]);
  }
  return esq.concat(ponta, dir.reverse());
}

// Monta a geometria no mundo a partir do estado { x,y,r,s,flip,pose,anc }.
export function montar(h0) {
  const h = { s: 1, ...h0 };
  const fase = h.flip ? 1.7 : 0;
  h.x += Math.sin(G.t * .7 + fase) * 2.4;
  h.y += Math.cos(G.t * .55 + fase) * 2.4;
  const W = (lx, ly) => posLocalParaMundo(h, lx, ly);

  // Palma e antebraço, que vai até a âncora fora da tela.
  const wl = W(...PALMA[0]), wr = W(...PALMA[PALMA.length - 1]);
  const mx = (wl[0] + wr[0]) / 2, my = (wl[1] + wr[1]) / 2;
  let ax = h.anc.x - mx, ay = h.anc.y - my;
  const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
  const lado = (p, d, fat) => [mx + ax * d + (p[0] - mx) * fat, my + ay * d + (p[1] - my) * fat];
  const palma = arredonda([
    lado(wl, al + (h.extra ?? 300), 1.5), lado(wl, 90, 1.12),
    ...PALMA.map(p => W(p[0], p[1])),
    lado(wr, 90, 1.12), lado(wr, al + (h.extra ?? 300), 1.5),
  ], 2);

  const dedos = {};
  for (const n of NOMES) {
    const d = DEDOS[n], j = juntas(h.pose, n);
    const dir0 = rad(h.pose[n][0]);
    const antes = [j[0][0] - Math.sin(dir0) * 16, j[0][1] + Math.cos(dir0) * 16];
    const cruas = [antes, ...j];
    const sub = arredonda(cruas, 2);
    // largura por comprimento acumulado
    let tot = 0; const ac = [0];
    for (let i = 1; i < sub.length; i++) { tot += Math.hypot(sub[i][0] - sub[i - 1][0], sub[i][1] - sub[i - 1][1]); ac.push(tot); }
    const larg = ac.map(v => {
      const k = v / tot * 4;
      const i = Math.min(3, Math.floor(k));
      return i === 0 ? d.w[0] : lerp(d.w[i - 1], d.w[Math.min(3, i)], k - i);
    });
    const loc = contornoDedo(sub, larg);
    const a = j[2], b = j[3];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const dx = tx / tl, dy = ty / tl, nx = -dy, ny = dx;
    const wn = d.w[3];
    const unha = [];
    for (let k = 0; k < 12; k++) {
      const an = k / 12 * Math.PI * 2;
      const u = Math.cos(an) * wn * .95, v = Math.sin(an) * wn * .62;
      unha.push(W(b[0] - dx * 1.5 + dx * u + nx * v, b[1] - dy * 1.5 + dy * u + ny * v));
    }
    const dobras = [1, 2].map(ij => {
      const p = j[ij], q = j[ij + 1], r = j[ij - 1];
      let vx = q[0] - r[0], vy = q[1] - r[1]; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
      const ww = d.w[ij] * .55, px = -vy, py = vx;
      return [W(p[0] + px * ww, p[1] + py * ww), W(p[0] + vx * 2, p[1] + vy * 2), W(p[0] - px * ww, p[1] - py * ww)];
    });
    dedos[n] = { pts: loc.map(p => W(p[0], p[1])), unha, dobras, ponta: W(b[0], b[1]) };
  }
  const t = dedos.t.ponta, i = dedos.i.ponta;
  return { h, W, palma, dedos, pinca: [(t[0] + i[0]) / 2, (t[1] + i[1]) / 2], pulso: [mx, my], dirBraco: [ax, ay] };
}

function desenhaDedo(d) {
  linha(d.pts, { f: true });
  for (const dd of d.dobras) linha(dd, { w: G.larg * .55, a: .7 });
  if (G.unha === 'cheia') linha(d.unha, { f: G.cor, fechar: true, w: 1 });
  else if (G.unha === 'vazia') linha(d.unha, { fechar: true, w: G.larg * .6, a: .85 });
}

// Palma e dedos de trás. O objeto segurado é desenhado entre maoFundo e maoFrente.
export function maoFundo(m) {
  const fr = m.h.pose.fr || 't';
  for (const n of ORDEM) if (n === 'p' || n === 'r') if (!fr.includes(n)) desenhaDedo(m.dedos[n]);
  linha(m.palma, { f: true });
  const W = m.W;
  linha(arredonda([W(-34, -30), W(-18, -60), W(-14, -96)], 2), { w: G.larg * .55, a: .55 });
  linha(arredonda([W(24, -92), W(14, -74), W(20, -52)], 2), { w: G.larg * .55, a: .4 });
  if (m.h.pulseira) {
    linha(arredonda([W(-40, 18), W(0, 26), W(40, 18)], 2), { w: G.larg * .75 });
    linha(arredonda([W(-40, 28), W(0, 36), W(40, 28)], 2), { w: G.larg * .75 });
  }
  if (m.h.tatuagem) {
    const c = W(14, -62);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + rad(m.h.r);
      linha([c, [c[0] + Math.cos(a) * 12, c[1] + Math.sin(a) * 12]], { w: G.larg * .55 });
    }
  }
  for (const n of ORDEM) if (n === 'm' || n === 'i') if (!fr.includes(n)) desenhaDedo(m.dedos[n]);
  if (!fr.includes('t')) desenhaDedo(m.dedos.t);
}

export function maoFrente(m) {
  const fr = m.h.pose.fr || 't';
  for (const n of ORDEM) if (fr.includes(n)) desenhaDedo(m.dedos[n]);
  if (m.h.anel) {
    const d = m.dedos.r.dobras[0];
    linha(d, { w: G.larg * 1.5 });
  }
}

export function mao(m) { maoFundo(m); maoFrente(m); }
