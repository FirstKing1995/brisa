// Objetos do ritual: flor, tesoura, seda, baseado, isqueiro, língua, fumaça.
import { G, linha, arredonda, tf, arco, rng, lerp, clamp, rad, suave, faixa } from './motor.js';

// ---------- Folha serrilhada (também usada na mandala) ----------
export function folha(comp, larg, dentes = 6) {
  const a = [], b = [];
  for (let i = 0; i <= dentes; i++) {
    const k = i / dentes;
    const w = Math.sin(Math.PI * Math.pow(k, .8)) * larg;
    const y = -k * comp;
    a.push([-w, y]);
    if (i < dentes) a.push([-w * .68, y - comp / dentes * .58]);
    b.unshift([w, y]);
    if (i < dentes) b.unshift([w * .68, y - comp / dentes * .58]);
  }
  return a.concat(b);
}

// ---------- Quadros desenhados (tira horizontal em anim/) ----------
const cacheQ = {};
export function quadros(nome, n) {
  if (!cacheQ[nome]) {
    const img = new Image();
    const q = { img, n, pronto: false };
    img.onload = () => { q.pronto = true; };
    img.src = `anim/${nome}.png`;
    cacheQ[nome] = q;
  }
  return cacheQ[nome];
}

// f contínuo: mistura o quadro atual com o próximo para o movimento correr sem travadas.
export function desenhaQuadro(q, f, x, y, s = 1, alpha = 1) {
  if (!q.pronto || alpha <= 0) return;
  const c = G.ctx, w = q.img.width / q.n, h = q.img.height;
  f = Math.max(0, Math.min(q.n - 1, f));
  const k = Math.min(q.n - 1, Math.floor(f));
  const t = f - k;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const um = (i, a) => {
    if (a <= 0 || i >= q.n) return;
    c.globalAlpha = alpha * a;
    c.drawImage(q.img, i * w, 0, w, h, x - w * s / 2, y - h * s / 2, w * s, h * s);
  };
  um(k, 1 - t);
  um(k + 1, t);
  c.restore();
}

// ---------- Flor ----------
// Folha em leque: cinco folíolos serrilhados saindo do mesmo ponto.
export function folhaLeque(tam) {
  const partes = [];
  for (const [g, k] of [[-74, .52], [-38, .82], [0, 1], [38, .82], [74, .52]]) {
    const c = tam * k;
    partes.push({ pts: tf(folha(c, c * .13, 7), 0, 0, rad(g)), f: true, fechar: true, w: 2 });
    partes.push({ pts: tf([[0, -4], [0, -c * .82]], 0, 0, rad(g)), w: 1.1, a: .6 });
  }
  return partes;
}

const cacheFlor = new Map();
function geraFlor(seed) {
  if (cacheFlor.has(seed)) return cacheFlor.get(seed);
  const R = rng(seed * 7919 + 13), g = [];
  // folhas em leque atrás do botão
  const lados = [rad(-104 - R() * 18), rad(96 + R() * 22)];
  for (const a of lados) {
    for (const p of folhaLeque(72 + R() * 16)) {
      g.push({ ...p, pts: tf(p.pts, Math.sin(a) * 24, 30 - Math.cos(a) * 12, a) });
    }
  }
  // cabo
  g.push({ pts: [[-5, 46], [-4, 84], [4, 86], [5, 46]], f: true });
  // gominhos pontudos, de cima para baixo: os de baixo cobrem os de cima
  const larg = 40 + R() * 9;
  const fileiras = 11;
  // miolo escuro para as folhas de trás não aparecerem entre os gominhos
  g.push({ pts: arco(0, -8, larg * .92, 62, 0, Math.PI * 2, 22), f: true, fechar: true, semTraco: true });
  for (let i = 0; i < fileiras; i++) {
    const s = i / (fileiras - 1);
    const y = -66 + s * 112;
    const w = larg * (Math.pow(Math.sin(Math.PI * Math.min(1, s * .93 + .07)), .7)) * (.72 + .28 * s);
    const n = Math.max(1, Math.round(2 * w / 11) + 1);
    for (let k = 0; k < n; k++) {
      const q = n === 1 ? 0 : k / (n - 1) * 2 - 1;
      const x = q * w + (R() - .5) * 5;
      const c = 19 + R() * 10, l = 7 + R() * 3;
      const ang = q * .55 + (R() - .5) * .22;
      const gomo = arredonda([[-1, 6], [-l, -c * .36], [-l * .55, -c * .72], [0, -c], [l * .55, -c * .72], [l, -c * .36], [1, 6]], 1);
      g.push({ pts: tf(gomo, x, y + Math.abs(q) * 4, ang), f: true, fechar: true, w: 2 });
      if (R() > .45) g.push({ pts: tf([[0, -3], [0, -c * .55]], x, y + Math.abs(q) * 4, ang), w: 1, a: .55 });
    }
    // folhinha serrilhada escapando pelo lado
    if (i > 1 && i < 8 && R() > .45) {
      const lado = R() > .5 ? 1 : -1;
      g.push({ pts: tf(folha(24 + R() * 12, 6, 4), lado * (w + 2), y, lado * (.9 + R() * .5)), f: true, fechar: true, w: 1.8 });
    }
  }
  // pelinhos enrolados nas pontas
  for (let i = 0; i < 18; i++) {
    const s = R(), x = (R() * 2 - 1) * larg * .95 * Math.sin(Math.PI * s), y = -82 + s * 118;
    const dx = (x >= 0 ? 1 : -1) * (5 + R() * 13), dy = -5 - R() * 12;
    g.push({ pts: arredonda([[x, y], [x + dx * .4, y + dy], [x + dx, y + dy * .9], [x + dx * 1.2, y + dy * .3]], 2), w: 1.3, a: .9 });
  }
  cacheFlor.set(seed, g);
  return g;
}

export function flor(x, y, r = 0, s = 1, seed = 1, alpha = 1) {
  if (alpha <= 0 || s <= 0) return;
  const c = G.ctx, a0 = c.globalAlpha;
  c.globalAlpha = a0 * alpha;
  for (const p of geraFlor(seed)) {
    linha(tf(p.pts, x, y, r, s), { f: p.f, fechar: p.fechar, semTraco: p.semTraco, w: Math.max(1, (p.w || G.larg) * Math.min(1, s + .25)), a: p.a });
  }
  c.globalAlpha = a0;
}

// ---------- Farelo (montinho e o que vai na seda) ----------
export function geraFarelo(seed, n, fx) {
  const R = rng(seed * 104729 + 5), l = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = fx(R, i / n);
    l.push({ x, y, a: R() * Math.PI, c: 2 + R() * 5, tipo: R() });
  }
  return l;
}
export function desenhaFarelo(lista, qtd, ox = 0, oy = 0, esc = 1, escY = 1) {
  const c = G.ctx;
  c.beginPath();
  const n = Math.min(lista.length, Math.floor(qtd));
  for (let i = 0; i < n; i++) {
    const f = lista[i];
    const x = ox + f.x * esc, y = oy + f.y * escY;
    const dx = Math.cos(f.a) * f.c, dy = Math.sin(f.a) * f.c;
    c.moveTo(x - dx, y - dy);
    c.lineTo(x + dx, y + dy);
    if (f.tipo > .7) { c.moveTo(x, y); c.lineTo(x + dy * .6, y - dx * .6); }
  }
  c.strokeStyle = G.cor;
  c.lineWidth = 1.7;
  c.lineCap = 'round';
  c.stroke();
}

// ---------- Tesoura: as argolas ficam nas pontas do polegar e do indicador ----------
export function tesoura(t, i, piv) {
  const lamina = (de) => {
    const dx = piv[0] - de[0], dy = piv[1] - de[1], l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const ponta = [piv[0] + ux * 122, piv[1] + uy * 122];
    linha([[piv[0] + nx * 7, piv[1] + ny * 7], ponta, [piv[0] - nx * 2, piv[1] - ny * 2]], { f: true, fechar: true, w: 2.6 });
    linha([de, piv], { w: 4.6 });
    linha(arco(de[0], de[1], 19, 19, 0, Math.PI * 2, 18), { w: 3 });
  };
  lamina(t); lamina(i);
  linha(arco(piv[0], piv[1], 4, 4, 0, Math.PI * 2, 8), { f: true, fechar: true, w: 2 });
}

// ---------- Seda ----------
// Papel com pino no centro (x,y). corteBaixo: até onde vai a borda de baixo, usado ao enrolar.
export function seda(x, y, w, h, r = 0, opts = {}) {
  const hw = w / 2, hh = h / 2;
  const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const sub = [];
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    for (let k = 0; k < 8; k++) sub.push([lerp(a[0], b[0], k / 8), lerp(a[1], b[1], k / 8)]);
  }
  linha(tf(sub, x, y, r), { f: true, fechar: true, w: 2.6 });
  if (opts.dobra !== false) linha(tf([[-hw + 6, 0], [hw - 6, 0]], x, y, r), { w: 1, a: .22 });
  if (opts.cola !== false) {
    const yc = hh - 9;
    for (let xx = -hw + 10; xx < hw - 14; xx += 20) {
      linha(tf([[xx, yc], [xx + 11, yc]], x, y, r), { w: 1.3, a: .6 });
    }
  }
}

// Tubo enrolado, horizontal.
export function tubo(x, y, w, h) {
  const hw = w / 2, hh = h / 2;
  const topo = [], base = [];
  for (let i = 0; i <= 20; i++) {
    const xx = lerp(-hw, hw, i / 20);
    topo.push([x + xx, y - hh]);
    base.unshift([x + xx, y + hh]);
  }
  const d = arco(x + hw, y, 5, hh, -Math.PI / 2, Math.PI / 2, 6);
  const e = arco(x - hw, y, 5, hh, Math.PI / 2, Math.PI * 1.5, 6);
  linha(topo.concat(d, base, e), { f: true, fechar: true, w: 2.8 });
  linha(arco(x - hw, y, 5, hh, -Math.PI / 2, Math.PI / 2, 6), { w: 1.4, a: .7 });
}

// ---------- Baseado ----------
// Vai do filtro (fx,fy) na direção ang. comp diminui ao queimar. torce: 0 a 1. aceso: brasa.
export function baseado(fx, fy, ang, compTotal, comp, { torce = 1, aceso = 0, brilho = 0, cor } = {}) {
  const co = Math.cos(ang), si = Math.sin(ang);
  const P = (u, v) => [fx + co * u - si * v, fy + si * u + co * v];
  const W = u => lerp(11, 17.5, clamp(u / compTotal));
  const sup = [], inf = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const u = comp * i / n;
    sup.push(P(u, -W(u)));
    inf.unshift(P(u, W(u)));
  }
  let cauda = [];
  if (!aceso && torce > 0) {
    const L = 34 * torce;
    cauda = [P(comp + L * .5, -3), P(comp + L * .8, -7), P(comp + L, 2), P(comp + L * .72, 5), P(comp + L * .45, 3)];
  }
  linha([...sup, ...cauda, ...inf, P(-4, W(0) - 1), P(-4, -W(0) + 1)], { f: true, fechar: true, w: 2.8 });
  // filtro em espiral
  linha([P(44, -W(44)), P(46, W(44))], { w: 1.8 });
  linha(arredonda([P(-3, -6), P(-3, 5), P(-1, 7), P(1, 0), P(-1, -3)], 2), { w: 1.6, a: .85 });
  // emenda da seda
  for (let u = 60; u < comp - 18; u += 54) {
    linha([P(u, -W(u) * .5), P(u + 22, -W(u) * .15)], { w: 1.2, a: .5 });
  }
  const pontaP = P(comp, 0);
  if (aceso > 0) {
    const w = W(comp);
    // cinza e brasa
    const c = G.ctx;
    const raio = (18 + 34 * brilho) * aceso;
    const g = c.createRadialGradient(pontaP[0], pontaP[1], 0, pontaP[0], pontaP[1], raio);
    const cb = cor || '255,255,255';
    g.addColorStop(0, `rgba(${cb},${.5 + .4 * brilho})`);
    g.addColorStop(1, `rgba(${cb},0)`);
    c.fillStyle = g;
    c.beginPath(); c.arc(pontaP[0], pontaP[1], raio, 0, Math.PI * 2); c.fill();
    linha(arredonda([P(comp, -w), P(comp + 7, -w * .6), P(comp + 10, 0), P(comp + 7, w * .6), P(comp, w)], 1), { f: `rgba(${cb},${.45 + .55 * brilho})`, fechar: true, w: 2.2 });
    return P(comp + 8, 0);
  }
  return pontaP;
}

// ---------- Isqueiro: origem no centro da parte de cima, sobe em -y ----------
export function isqueiro(x, y, r, tipo, chama = 0) {
  const S = pts => tf(pts, x, y, r);
  if (tipo === 'zippo') {
    linha(S([[-24, -8], [-24, 96], [24, 96], [24, -8]]), { f: true, fechar: true, w: 2.8 });
    linha(S([[-24, 22], [24, 22]]), { w: 2 });
    linha(S([[-21, -8], [-21, -34], [21, -34], [21, -8]]), { f: true, w: 2.4 });
    for (const ox of [-11, 0, 11]) linha(S([[ox, -28], [ox, -14]]), { w: 1.4, a: .7 });
    linha(arredonda(S([[21, -18], [32, -22], [34, -14], [22, -10]]), 2), { f: true, w: 2 });
  } else {
    linha(arredonda(S([[-22, 2], [-24, 50], [-22, 96], [22, 96], [24, 50], [22, 2]]), 1), { f: true, fechar: true, w: 2.8 });
    linha(S([[-22, 26], [22, 26]]), { w: 1.4, a: .6 });
    linha(S([[-18, 2], [-18, -24], [18, -24], [18, 2]]), { f: true, w: 2.4 });
    linha(arco(...S([[0, -10]])[0], 11, 11, 0, Math.PI * 2, 12), { f: true, fechar: true, w: 2.2 });
    for (let a = 0; a < 6; a++) {
      const ang = a / 6 * Math.PI * 2 + G.t;
      const c = S([[0, -10]])[0];
      linha([[c[0] + Math.cos(ang) * 4, c[1] + Math.sin(ang) * 4], [c[0] + Math.cos(ang) * 10, c[1] + Math.sin(ang) * 10]], { w: 1.1, a: .7 });
    }
  }
  if (chama > 0) desenhaChama(S([[0, tipo === 'zippo' ? -38 : -28]])[0], r, chama);
}

export function desenhaChama(p, r, k = 1) {
  const f = Math.sin(G.t * 11) * 3 + Math.sin(G.t * 17) * 2;
  const h = 56 * k;
  const contorno = arredonda([
    [0, 4], [-14 * k, -h * .28], [-9 * k, -h * .6], [f * .6, -h], [6 * k + f * .4, -h * .55], [14 * k, -h * .26], [8 * k, 2],
  ], 3, true);
  linha(tf(contorno, p[0], p[1], r), { f: true, fechar: true, w: 2.6 });
  const dentro = arredonda([[0, -2], [-5 * k, -h * .24], [f * .3, -h * .55], [5 * k, -h * .22]], 2, true);
  linha(tf(dentro, p[0], p[1], r), { w: 1.6, a: .75, fechar: true });
}

// ---------- Língua: pino na ponta, cresce para baixo ----------
export function lingua(x, y, r = 0, e = 1) {
  const perfil = [[0, -7], [18, -5], [36, 8], [50, 34], [58, 76], [63, 130], [66, 200], [68, 290]];
  const pts = [...perfil.slice(1).reverse().map(p => [-p[0], p[1]]), ...perfil];
  linha(tf(arredonda(pts, 2), x, y, r, e), { f: true });
  linha(tf(arredonda([[-1, 20], [3, 70], [-2, 150], [1, 285]], 2), x, y, r, e), { w: 1.8, a: .75 });
  for (const [px, py, l] of [[-24, 40, 8], [24, 54, 9], [-34, 92, 10], [30, 110, 8], [-18, 134, 9], [40, 162, 10]]) {
    linha(tf(arredonda([[px, py], [px + 2, py + l * .5], [px, py + l]], 1), x, y, r, e), { w: 1.2, a: .45 });
  }
}

// ---------- Pessoa vista de cima: a frente do rosto aponta para o alto da tela ----------
export const CABECA = { x: 0, y: 365, rx: 104, ry: 120 };
const cacheCabelo = new Map();
function geraCabelo(tipo) {
  if (cacheCabelo.has(tipo)) return cacheCabelo.get(tipo);
  const R = rng(tipo.length * 97 + 3), l = [];
  const cx = 6, cy = 28; // redemoinho, um pouco para trás do centro
  const borda = a => [Math.cos(a) * 100, Math.sin(a) * 114];
  if (tipo === 'cacho') {
    for (let i = 0; i < 62; i++) {
      const a = R() * 6.283, d = Math.sqrt(R()) * .9, b = borda(a);
      const x = b[0] * d, y = b[1] * d, r = 7 + R() * 7, a0 = R() * 6.283;
      l.push({ pts: arco(x, y, r, r, a0, a0 + 4.6, 9), w: 1.5, a: .9 });
    }
  } else {
    const dread = tipo === 'dread';
    const n = dread ? 26 : 46;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + R() * (dread ? .2 : .08), b = borda(a);
      const ini = dread ? .18 + R() * .34 : .08 + R() * .2, fim = dread ? .86 + R() * .14 : .75 + R() * .24;
      const fase = R() * 6.283, curva = dread ? 3 + R() * 3 : 0;
      const pts = [];
      for (let k = 0; k <= 7; k++) {
        const q = lerp(ini, fim, k / 7), gi = (dread ? .34 : .55) * (1 - q);
        const co = Math.cos(gi), si = Math.sin(gi);
        const ond = Math.sin(k * 1.1 + fase) * curva;
        const x = cx * (1 - q) + b[0] * q + ond, y = cy * (1 - q) + b[1] * q - ond * .6;
        pts.push([x * co - y * si, x * si + y * co]);
      }
      l.push({ pts: arredonda(pts, 2), w: dread ? 3.4 : 1.5, a: dread ? .95 : .8 });
    }
  }
  cacheCabelo.set(tipo, l);
  return l;
}

export function corpo(dy = 0, tipo = 'liso') {
  if (dy > 1300) return;
  const { x, y, rx, ry } = CABECA;
  const Y = y + dy;
  // ombros
  linha(arredonda([[-520, 760], [-430, 590], [-330, 505], [-190, 470], [-70, 462], [70, 462], [190, 470], [330, 505], [430, 590], [520, 760]].map(p => [p[0], p[1] + dy]), 3), { f: true });
  linha(arredonda([[-250, 600], [-235, 545], [-205, 515]].map(p => [p[0], p[1] + dy]), 2), { w: 1.6, a: .5 });
  linha(arredonda([[250, 600], [235, 545], [205, 515]].map(p => [p[0], p[1] + dy]), 2), { w: 1.6, a: .5 });
  // orelhas
  for (const lado of [-1, 1]) {
    linha(arco(x + lado * (rx + 2), Y + 12, 13, 25, lado > 0 ? -1.7 : 1.45, lado > 0 ? 1.7 : 4.85, 10), { f: true, w: 2.6 });
  }
  // nariz, despontando na frente
  linha(arredonda([[-17, y - ry + 12 + dy], [-6, y - ry - 8 + dy], [0, y - ry - 13 + dy], [6, y - ry - 8 + dy], [17, y - ry + 12 + dy]], 2), { f: true, w: 2.6 });
  // cabeça
  const ct = [];
  for (let i = 0; i < 44; i++) {
    const a = i / 44 * 6.283;
    ct.push([x + Math.cos(a) * rx * (1 + .02 * Math.sin(a * 7)), Y + Math.sin(a) * ry * (1 + .02 * Math.sin(a * 5))]);
  }
  linha(ct, { f: true, fechar: true, w: 3.2 });
  // linha onde começa o cabelo, na testa
  linha(arredonda([[-88, Y - 62], [-48, Y - 94], [0, Y - 100], [48, Y - 94], [88, Y - 62]], 2), { w: 1.5, a: .65 });
  for (const f of geraCabelo(tipo)) linha(tf(f.pts, x, Y, 0), { w: f.w, a: f.a });
}

// ---------- Fumaça: fitas de pontos levados por um campo que se enrola ----------
export class Fumaca {
  constructor() { this.fitas = []; this.tempo = 0; }
  nova(x, y, opts = {}) {
    const f = { pts: [], ativa: true, fase: Math.random() * 40, vx: opts.vx || 0, vy: opts.vy || 0, abre: opts.abre || 1, vida: opts.vida || 6.5, cor: opts.cor };
    this.fitas.push(f);
    return f;
  }
  emite(f, x, y) {
    f.pts.push({ x, y, ida: 0, vx: f.vx, vy: f.vy });
  }
  atualiza(dt) {
    this.tempo += dt;
    const T = this.tempo;
    for (const f of this.fitas) {
      for (const p of f.pts) {
        p.ida += dt;
        const y = p.y + f.fase * 30;
        const a = 1 + Math.min(p.ida, 5) * .3;
        const u = Math.sin(y * .016 + T * .8 + f.fase) * 24 * a + Math.sin(y * .047 - T * .6 + f.fase) * 15 * a;
        p.x += (u + p.vx) * dt;
        p.y += (-58 - p.ida * 4 + p.vy + Math.cos(p.x * .022 + T * .6) * 8) * dt;
        p.vx *= 1 - .9 * dt;
        p.vy *= 1 - .9 * dt;
      }
      f.pts = f.pts.filter(p => p.ida < f.vida);
    }
    this.fitas = this.fitas.filter(f => f.ativa || f.pts.length);
  }
  // Cada fita são duas linhas que se afastam com a idade, em trechos contínuos que vão sumindo.
  desenha(corTrilha) {
    const c = G.ctx;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const TRECHO = 5;
    for (const f of this.fitas) {
      const P = f.pts, n = P.length;
      if (n < 3) continue;
      c.strokeStyle = `rgb(${f.cor || corTrilha || '244,244,240'})`;
      for (const lado of [-1, 1]) {
        const off = P.map((p, i) => {
          const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
          const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
          const w = Math.min(p.ida, 5) * 4.6 * f.abre * lado;
          return [p.x - dy / dl * w, p.y + dx / dl * w];
        });
        for (let i = 0; i < n - 1; i += TRECHO) {
          const fim = Math.min(n - 1, i + TRECHO);
          const m = P[Math.floor((i + fim) / 2)];
          const al = Math.sin(clamp(m.ida / f.vida) * Math.PI) ** .8 * Math.min(1, m.ida * 3);
          c.globalAlpha = al * .85;
          c.lineWidth = 1.5 + Math.min(m.ida, 5) * .22;
          c.beginPath();
          c.moveTo(off[i][0], off[i][1]);
          for (let k = i + 1; k < fim; k++) {
            c.quadraticCurveTo(off[k][0], off[k][1], (off[k][0] + off[k + 1][0]) / 2, (off[k][1] + off[k + 1][1]) / 2);
          }
          c.lineTo(off[fim][0], off[fim][1]);
          c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
  }
}

export { suave };
