// Mão articulada: pulso na origem, dedos para cima (-y), polegar à esquerda (-x).
// Dedo = [ângulo da base, dobra 1, dobra 2], em graus. Negativo dobra para o lado do polegar.
import { G, linha, arredonda, lerp, rad } from './motor.js';

// Proporções tiradas de referencias/maos-ref-1.png: palma estreita, dedos longos e afilados.
const DEDOS = {
  i: { b: [-34, -110], l: [50, 34, 28], w: [12, 10.4, 9, 7] },
  m: { b: [-11, -120], l: [55, 38, 30], w: [12.5, 11, 9.2, 7.4] },
  r: { b: [12, -116], l: [50, 35, 28], w: [12, 10.4, 9, 7] },
  p: { b: [34, -102], l: [38, 27, 22], w: [10.4, 9, 7.8, 6.2] },
  t: { b: [-46, -58], l: [50, 40, 32], w: [14, 12, 10, 7.5] },
};
const NOMES = ['t', 'i', 'm', 'r', 'p'];
const ORDEM = ['p', 'r', 'm', 'i', 't'];

const PALMA = [
  [-27, 0], [-44, -24], [-52, -55], [-50, -85], [-44, -108], [-26, -121], [0, -125],
  [26, -119], [44, -103], [48, -70], [41, -34], [27, 0],
];

// tr: dedos que ficam atrás da palma. un: dedos com unha aparente. gw, gl: largura e comprimento dos dedos.
const RECOLHIDOS = { m: [-52, -72, -60], r: [-48, -76, -62], p: [-44, -74, -60], tr: 'mrp', un: 'ti' };
// Punho da pose 5 da referência: dedos dobrados para o lado, empilhados na beira da palma.
const BASES_PUNHO = { i: [-36, -118], m: [-38, -92], r: [-36, -68], p: [-30, -46] };
const FECHADOS = { i: [-92, -6, -16], m: [-94, -6, -16], r: [-92, -6, -16], p: [-88, -6, -16] };
export const POSES = {
  relax: { t: [-52, 12, 10], i: [-10, -14, -10], m: [-2, -14, -12], r: [8, -14, -12], p: [18, -14, -10], fr: 't' },
  aberta: { t: [-64, 8, 6], i: [-16, -4, -3], m: [-4, -3, -2], r: [8, -3, -3], p: [22, -3, -3], fr: 't' },
  pinca: { t: [-52, 14, 8], i: [-35, -45, -40], ...RECOLHIDOS, fr: 't' },
  pincaAb: { t: [-64, 8, 6], i: [-20, -28, -22], ...RECOLHIDOS, fr: 't' },
  esfrega: { t: [-48, 18, 10], i: [-33, -42, -46], ...RECOLHIDOS, fr: 't' },
  tesA: { t: [-68, 2, 4], i: [-12, -24, -20], ...RECOLHIDOS, fr: 'ti' },
  tesF: { t: [-54, 12, 8], i: [-26, -36, -30], ...RECOLHIDOS, fr: 'ti' },
  punho: { t: [2, -6, -8], ...FECHADOS, fr: 'imrpt', un: 't', gw: 1.45, gl: .6, bs: BASES_PUNHO },
  punhoFlick: { t: [-8, -16, -14], ...FECHADOS, fr: 'imrpt', un: 't', gw: 1.45, gl: .6, bs: BASES_PUNHO },
};

export function mistura(a, b, k) {
  const fonte = k > .5 ? b : a;
  const r = { fr: fonte.fr, tr: fonte.tr, un: fonte.un, bs: fonte.bs, gw: lerp(a.gw ?? 1, b.gw ?? 1, k), gl: lerp(a.gl ?? 1, b.gl ?? 1, k) };
  for (const n of NOMES) r[n] = [lerp(a[n][0], b[n][0], k), lerp(a[n][1], b[n][1], k), lerp(a[n][2], b[n][2], k)];
  return r;
}

function juntas(pose, n) {
  const d = DEDOS[n], g = pose[n];
  let [x, y] = pose.bs?.[n] || d.b, a = 0;
  const out = [[x, y]];
  for (let i = 0; i < 3; i++) {
    a += g[i];
    const L = d.l[i] * (n === 't' ? 1 : pose.gl ?? 1);
    x += Math.sin(rad(a)) * L;
    y -= Math.cos(rad(a)) * L;
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
    lado(wl, al + (h.extra ?? 300), 1.3), lado(wl, 90, 1.06),
    ...PALMA.map(p => W(p[0], p[1])),
    lado(wr, 90, 1.06), lado(wr, al + (h.extra ?? 300), 1.3),
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
      const base = i === 0 ? d.w[0] : lerp(d.w[i - 1], d.w[Math.min(3, i)], k - i);
      return n === 't' ? base : base * (h.pose.gw ?? 1);
    });
    const loc = contornoDedo(sub, larg);
    const a = j[2], b = j[3];
    const tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1;
    const dx = tx / tl, dy = ty / tl, nx = -dy, ny = dx;
    const wn = d.w[3] * (n === 't' ? 1 : h.pose.gw ?? 1);
    const unha = [];
    for (let k = 0; k < 12; k++) {
      const an = k / 12 * Math.PI * 2;
      const cu = Math.cos(an);
      const u = cu * wn * 1.35, v = Math.sin(an) * wn * .8 * (1 - .22 * Math.max(0, cu));
      unha.push(W(b[0] + dx * (wn * .1 + u) + nx * v, b[1] + dy * (wn * .1 + u) + ny * v));
    }
    const dobras = [1, 2].map(ij => {
      const p = j[ij], q = j[ij + 1], r = j[ij - 1];
      let vx = q[0] - r[0], vy = q[1] - r[1]; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
      const ww = d.w[ij] * .55, px = -vy, py = vx;
      return [W(p[0] + px * ww, p[1] + py * ww), W(p[0] + vx * 2, p[1] + vy * 2), W(p[0] - px * ww, p[1] - py * ww)];
    });
    dedos[n] = { pts: loc.map(p => W(p[0], p[1])), unha, dobras, ponta: W(b[0], b[1]), temUnha: !h.pose.un || h.pose.un.includes(n) };
  }
  const t = dedos.t.ponta, i = dedos.i.ponta;
  return { h, W, palma, dedos, pinca: [(t[0] + i[0]) / 2, (t[1] + i[1]) / 2], pulso: [mx, my], dirBraco: [ax, ay] };
}

function desenhaDedo(d) {
  linha(d.pts, { f: true });
  // só a dobra do meio, bem discreta, como na referência
  linha(d.dobras[0], { w: G.larg * .45, a: .55 });
  if (d.temUnha) {
    if (G.unha === 'cheia') linha(d.unha, { f: G.cor, fechar: true, w: 1 });
    else if (G.unha === 'vazia') linha(d.unha, { fechar: true, w: G.larg * .6, a: .85 });
  }
}

// Palma e dedos de trás. O objeto segurado é desenhado entre maoFundo e maoFrente.
export function maoFundo(m) {
  const fr = m.h.pose.fr || 't', tr = m.h.pose.tr || '';
  for (const n of ORDEM) if (tr.includes(n) && !fr.includes(n)) desenhaDedo(m.dedos[n]);
  linha(m.palma, { f: true });
  const W = m.W;
  linha(arredonda([W(-28, -30), W(-14, -58), W(-12, -90)], 2), { w: G.larg * .45, a: .5 });
  if (m.h.pulseira) {
    linha(arredonda([W(-29, 16), W(0, 23), W(29, 16)], 2), { w: G.larg * .75 });
    linha(arredonda([W(-29, 25), W(0, 32), W(29, 25)], 2), { w: G.larg * .75 });
  }
  if (m.h.tatuagem) {
    const c = W(10, -62);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + rad(m.h.r);
      linha([c, [c[0] + Math.cos(a) * 10, c[1] + Math.sin(a) * 10]], { w: G.larg * .55 });
    }
  }
  for (const n of ORDEM) if (!tr.includes(n) && !fr.includes(n)) desenhaDedo(m.dedos[n]);
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
