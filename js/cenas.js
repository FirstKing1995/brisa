// As 13 etapas. Cada desenho é função de u: de -1 a 0 é a preparação automática,
// de 0 a 1 é a ação comandada pelo jogador.
import { G, lerp, clamp, suave, faixa, rad, rng, arco, linha } from './motor.js';
import { POSES, mistura, pincaLocal, posLocalParaMundo, montar, maoFundo, maoFrente, mao } from './mao.js';
import { flor, geraFarelo, desenhaFarelo, tesoura, seda, tubo, baseado, isqueiro, lingua, corpo, Fumaca, desenhaChama, quadros, desenhaQuadro, comVideo } from './objetos.js';

// Cenas desenhadas quadro a quadro (geradas no ChatGPT). Enquanto não carregam, vale a mão de código.
const Q_PEGAR = comVideo(quadros('pegar-flor', 25), 'pegar-flor-video', 72);
const Q_BOLAR = quadros('bolar', 25);
const Q_CORTAR = comVideo(quadros('cortar', 21), 'cortar-video', 81);
const Q_DECHAVAR = quadros('dechavar', 21);
const Q_PLANTA = quadros('plantinha', 22);
const Q_ACENDER = quadros('acender', 22);
const Q_SEDA = quadros('seda', 19);
const Q_LAMBER = quadros('lamber', 22);
const Q_FINALIZAR = quadros('finalizar', 22);
const Q_RELAXAR = quadros('relaxar', 22);
// do lamber ao acender a câmera fica no close de lado; só o fumar volta para a vista de cima
// Acender feito a partir de um vídeo do Gemini (Veo): 102 quadros a 12 por segundo, em grade de 10.
// ?semvideo volta para a tira antiga, para comparar.
const Q_ACV = quadros('acender-video', 102, 10);
const acv = () => !/[?&]semvideo/.test(location.search) && Q_ACV.pronto;
const ACV_BASE = 12, ACV_CHAMA = 20, ACV_FIM = 101, ACV_MARCO = .3;
const closesProntos = () => Q_LAMBER.pronto && Q_FINALIZAR.pronto && Q_ACENDER.pronto;
// a seda desenhada termina na mesma altura da seda dos quadros de colocar a erva
const SEDA_QY = 168;
// close de lado do acender: centro e escala na tela, e onde nasce a faísca no quadro
const CLOSE = { x: 0, y: 115, s: 2.1, faisca: [-34, -75] };
// a seda fica um pouco abaixo do centro dos quadros desenhados
const PLANTA_Y = 165 - 50;

function comAlfa(a, fn) {
  if (a <= 0) return;
  const c = G.ctx, a0 = c.globalAlpha;
  c.globalAlpha = a0 * a;
  fn();
  c.globalAlpha = a0;
}
import { sfx, nota } from './som.js';

const ANC_R = { x: 800, y: 2600 }, ANC_L = { x: -800, y: 2600 }, ANC_T = { x: -1000, y: -2600 }, ANC_E = { x: -2800, y: 240 };
const FORA_R = { x: 460, y: 1500 }, FORA_L = { x: -460, y: 1500 };

// Mundo fixo
const MONTE_Y = -18;
const SEDA_Y = 165, SEDA_H = 92;
const FLAP = 30, TUBO_H = 28;
const TUBO_Y = SEDA_Y + SEDA_H / 2 - FLAP - TUBO_H / 2;
const PEDACOS = [[-44, -14], [-14, -22], [18, -14], [46, -22]];
const JUNTA_ANG = rad(-24), JUNTA_PINCA = [-120, 150], JUNTA_DIST = 28;
const LIGHTER_L = [-62, -172], CHAMA_L = [-62, -210], R_ISQ = -10, ANG_ISQ = rad(-10);
const OMBRO_R = { x: 300, y: 500 }, OMBRO_L = { x: -300, y: 500 }, FORA_I = { x: 520, y: 1300 };
const enfeites = () => ({ pulseira: C.M.pulseira, anel: C.M.anel, tatuagem: C.M.tatuagem });
const baseI = () => ({ flip: false, anc: OMBRO_R, extra: 30, ...enfeites() });
const baseCR = () => ({ flip: false, anc: OMBRO_R, extra: 30, ...enfeites() });
const baseCL = () => ({ flip: true, anc: OMBRO_L, extra: 30 });
const BOCA = { x: 0, y: 245 }, PINCA_BOCA = [2, 236];

export const C = {
  M: null,
  bits: [],
  fumaBrasa: new Fumaca(),
  fumaSopro: new Fumaca(),
  sopros: [],
  fitaBrasa: null,
  pontaAcesa: null,
  puxa: 0,
  segura: 0,
  tinta: 0,
  faiscas: [],
  pos: {},
};

export function novaSessao(n) {
  const R = rng(n * 31 + 7);
  const pal = [[172, 288, 330, 46], [205, 266, 150, 60], [322, 22, 50, 186], [262, 192, 104, 340], [36, 340, 280, 170]];
  const unhas = ['cheia', 'vazia', 'cheia', 'nenhuma'];
  const W = R() > .5 ? 300 : 270;
  const M = {
    n,
    seed: n + 1,
    unha: unhas[n % unhas.length],
    isq: n % 2 ? 'zippo' : 'comum',
    tentativas: 1 + Math.floor(R() * 3),
    sedaW: n === 0 ? 300 : W,
    pulseira: n > 0 && R() > .5,
    anel: n > 0 && R() > .45,
    tatuagem: n > 1 && R() > .5,
    pal: pal[n % pal.length],
    visao: ['mandala', 'fumaca', 'jardim', 'ondas'][n % 4],
    cabelo: ['liso', 'dread', 'cacho'][n % 3],
    subida: 0,
  };
  M.monte = geraFarelo(M.seed, 180, (r, k) => {
    const x = (r() + r() + r() - 1.5) * 62;
    return [x, -r() * Math.max(2, 34 - Math.abs(x) * .62)];
  });
  M.naSeda = geraFarelo(M.seed + 50, 150, (r) => [(r() * 2 - 1) * (M.sedaW / 2 - 28), (r() + r() - 1) * 13]);
  C.M = M;
  G.unha = M.unha;
  C.bits.length = 0; C.faiscas.length = 0; C.tinta = 0; C.puxa = 0; C.pontaAcesa = null;
  if (C.fitaBrasa) { C.fitaBrasa.ativa = false; C.fitaBrasa = null; }
  return M;
}

const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return `${f(0)},${f(8)},${f(4)}`;
};
export { hsl };

function corFumaca() {
  const k = C.tinta;
  if (k <= 0) return '244,244,240';
  const c = hsl(C.M.pal[0], 72 * k, lerp(95, 66, k));
  return c;
}

// ---------- Trilhas ----------
function resolve(k, base) {
  const pose = typeof k.pose === 'string' ? POSES[k.pose] : k.pose;
  const r = k.r ?? 0, s = k.s ?? base.s ?? 1, flip = k.flip ?? base.flip ?? false;
  let x = k.x, y = k.y;
  if (k.at) {
    const ref = k.ref || pincaLocal(pose);
    const a = posLocalParaMundo({ x: 0, y: 0, r, s, flip }, ref[0], ref[1]);
    x = k.at[0] - a[0]; y = k.at[1] - a[1];
  }
  return { x, y, r, s, flip, pose, anc: k.anc || base.anc, extra: k.extra ?? base.extra ?? 300 };
}

function trilha(u, keys, base) {
  let i = 0;
  while (i < keys.length - 2 && u >= keys[i + 1][0]) i++;
  const A = resolve(keys[i][1], base), B = resolve(keys[Math.min(i + 1, keys.length - 1)][1], base);
  const k = suave(faixa(u, keys[i][0], keys[Math.min(i + 1, keys.length - 1)][0] || 1e-3));
  return {
    x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), r: lerp(A.r, B.r, k), s: lerp(A.s, B.s, k), flip: A.flip,
    pose: mistura(A.pose, B.pose, k),
    anc: { x: lerp(A.anc.x, B.anc.x, k), y: lerp(A.anc.y, B.anc.y, k) },
    extra: lerp(A.extra, B.extra, k),
    pulseira: base.pulseira, anel: base.anel, tatuagem: base.tatuagem,
  };
}

const baseR = () => ({ flip: false, anc: ANC_R, pulseira: C.M.pulseira, anel: C.M.anel, tatuagem: C.M.tatuagem });
const baseL = () => ({ flip: true, anc: ANC_L });
const baseT = () => ({ flip: false, anc: ANC_T });

// ---------- Peças em comum ----------
function florNaPinca(m, s, ang = 0) {
  const co = Math.cos(ang), si = Math.sin(ang);
  const cx = m.pinca[0] + si * 78 * s, cy = m.pinca[1] - co * 78 * s;
  flor(cx, cy, ang, s, C.M.seed);
  return [cx, cy];
}

const qtdMonte = v => C.M.monte.length * v;

function monte(v) { desenhaFarelo(C.M.monte, qtdMonte(v), 0, MONTE_Y); }

function papelPosto(qtd = 1) {
  const W = C.M.sedaW;
  seda(0, SEDA_Y, W, SEDA_H);
  desenhaFarelo(C.M.naSeda, C.M.naSeda.length * qtd, 0, SEDA_Y);
}

function estrelinha(x, y, k) {
  if (k <= 0) return;
  const L = 16 * k;
  linha([[x - L, y], [x + L, y]], { w: 1.8, a: k });
  linha([[x, y - L], [x, y + L]], { w: 1.8, a: k });
}

function juntaFinal(pinca, ang, comp = 300, o = {}) {
  const fx = pinca[0] - Math.cos(ang) * JUNTA_DIST, fy = pinca[1] - Math.sin(ang) * JUNTA_DIST;
  return baseado(fx, fy, ang, 300, comp, o);
}

const DESLIZE = 100, LINGUA_Y = 206;
const pontaJunta = W => [JUNTA_PINCA[0] + Math.cos(JUNTA_ANG) * (W - JUNTA_DIST), JUNTA_PINCA[1] + Math.sin(JUNTA_ANG) * (W - JUNTA_DIST)];

// Mãos em repouso depois de terminar de bolar e segurar
const keyJunta = { at: JUNTA_PINCA, pose: 'pinca', r: 22 };

function emiteBits(x, y, alvoY, n = 1) {
  for (let i = 0; i < n; i++) {
    C.bits.push({ x: x + (Math.random() - .5) * 12, y, vx: (Math.random() - .5) * 18, vy: 10 + Math.random() * 40, alvo: alvoY + (Math.random() - .5) * 18, a: Math.random() * 3, c: 2 + Math.random() * 4 });
  }
}

function desenhaBits() {
  const c = G.ctx;
  c.beginPath();
  for (const b of C.bits) {
    c.moveTo(b.x - Math.cos(b.a) * b.c, b.y - Math.sin(b.a) * b.c);
    c.lineTo(b.x + Math.cos(b.a) * b.c, b.y + Math.sin(b.a) * b.c);
  }
  c.strokeStyle = G.cor; c.lineWidth = 1.7; c.lineCap = 'round'; c.stroke();
  for (const f of C.faiscas) {
    const a = clamp(f.v / .35);
    linha([[f.x, f.y], [f.x - f.vx * .03, f.y - f.vy * .03]], { w: 1.8, a });
  }
}

export function atualizaEfeitos(dt) {
  for (const b of C.bits) {
    b.vy += 480 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += dt * 4;
  }
  C.bits = C.bits.filter(b => b.y < b.alvo);
  for (const f of C.faiscas) { f.v -= dt; f.vy += 500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
  C.faiscas = C.faiscas.filter(f => f.v > 0);
  C.fumaBrasa.atualiza(dt);
  C.fumaSopro.atualiza(dt);
  for (const q of C.sopros) {
    if ((q.espera -= dt) > 0) continue;
    q.resta -= dt; q.acum += dt;
    while (q.acum > .04) {
      q.acum -= .04;
      C.fumaSopro.emite(q.f, q.x, q.y);
    }
    if (q.resta <= 0) q.f.ativa = false;
  }
  C.sopros = C.sopros.filter(q => q.resta > 0);
  if (C.fitaBrasa && C.pontaAcesa) {
    C.acumula = (C.acumula || 0) + dt;
    while (C.acumula > .045) { C.acumula -= .045; C.fumaBrasa.emite(C.fitaBrasa, C.pontaAcesa[0], C.pontaAcesa[1] - 6); }
  }
}

export function sopra(forca) {
  const n = 2 + Math.round(forca * 2);
  sfx.solta(forca);
  for (let i = 0; i < n; i++) {
    const lado = i - (n - 1) / 2;
    const f = C.fumaSopro.nova(0, 0, { vx: lado * 62, vy: -175 - Math.random() * 40, abre: 1.5, vida: 8, cor: corFumaca() });
    C.sopros.push({ f, espera: i * .2, resta: .8 + forca * .9, acum: 0, x: BOCA.x + lado * 7, y: BOCA.y + 6 });
  }
}

// ---------- Etapas ----------
export const PASSOS = [
  // 0 ------------------------------------------------------------
  {
    v: 'pegar a flor', modo: 'toque', pre: 1.5, cam: -115,
    get dur() { return Q_PEGAR.video?.pronto ? 4 : 2.3; },
    aoAcao: () => sfx.pega(),
    draw(u) {
      const alfa = faixa(u, -1, -.2);
      if (Q_PEGAR.pronto) {
        // quadro 0: só a flor; do 4 ao 24: a mão entra, pega e ergue
        const f = u < 0 ? 0 : 4 + clamp(u) * 20;
        desenhaQuadro(Q_PEGAR, f, 0, -190, 1.35, alfa);
        return;
      }
      const R = montar(trilha(u, [
        [-1, { ...FORA_R, pose: 'pincaAb', r: -14 }],
        [0, { at: [205, -62], pose: 'pincaAb', r: -20 }],
        [.55, { at: [0, -146], pose: 'pincaAb', r: -20 }],
        [.74, { at: [0, -146], pose: 'pinca', r: -20 }],
        [1, { at: [40, -130], pose: 'pinca', r: -10 }],
      ], baseR()));
      maoFundo(R);
      if (u < .74) flor(0, -224 + Math.sin(G.t * .9) * 3, 0, 1, C.M.seed, alfa);
      else florNaPinca(R, 1, .05 * faixa(u, .74, 1));
      maoFrente(R);
    },
  },
  // 1 ------------------------------------------------------------
  {
    v: 'cortar', modo: 'toque', n: 4, marco: .8, dur: 4, pre: 1.1, cam: -115, aoAcao: () => sfx.corte(),
    draw(u) {
      if (!Q_CORTAR.pronto || !Q_PEGAR.pronto) return this.codigo(u);
      // entra: a flor erguida da etapa anterior vira o primeiro quadro do corte
      const k = suave(faixa(u, -1, -.3));
      desenhaQuadro(Q_PEGAR, 24, 0, -190, 1.35, 1 - k);
      desenhaQuadro(Q_CORTAR, u < 0 ? 0 : clamp(u / .8) * 20, 0, -190, 1.35, k);
    },
    codigo(u) {
      const n = 4;
      const fase = clamp(u / .8) * n;
      const cortes = Math.min(n, Math.floor(fase + .5));
      const f = fase >= n ? 0 : fase - Math.floor(fase);
      const poseT = mistura(POSES.tesA, POSES.tesF, Math.sin(Math.PI * clamp(f)));
      const dir = [Math.sin(rad(78)), -Math.cos(rad(78))];
      const piv = [-48, -222];
      const pin = [piv[0] - dir[0] * 72, piv[1] - dir[1] * 72];
      const L = montar(trilha(u, [
        [-1, { x: -1000, y: 60, pose: 'tesA', r: 78 }],
        [0, { at: pin, pose: 'tesA', r: 78 }],
        [.8, { at: pin, pose: 'tesA', r: 78 }],
        [1, { x: -1000, y: 60, pose: 'tesA', r: 78 }],
      ], { flip: true, anc: ANC_E }));
      if (u > 0 && u < .8) L.h.pose = poseT;
      const Lf = u > 0 && u < .8 ? montar({ ...L.h, x: L.h.x, y: L.h.y }) : L;
      const R = montar(trilha(u, [
        [-1, { at: [40, -130], pose: 'pinca', r: -10 }],
        [.8, { at: [40, -130], pose: 'pinca', r: -10 }],
        [1, { ...FORA_R, pose: 'pinca', r: -10 }],
      ], baseR()));

      // pedaços caindo no chão
      for (let k = 0; k < cortes; k++) {
        const ini = k + .5;
        const q = clamp((fase - ini) / .5);
        const fim = PEDACOS[k];
        const x = lerp(30 + k * 6, fim[0], q), y = lerp(-245 + k * 18, fim[1], q * q);
        flor(x, y, (1 - q) * 1.4 + k, .3, C.M.seed + k + 1);
      }
      maoFundo(R);
      florNaPinca(R, 1 - cortes * .15, .05);
      maoFrente(R);

      const t = Lf.dedos.t.ponta, i = Lf.dedos.i.ponta;
      const m = [(t[0] + i[0]) / 2 + dir[0] * 72, (t[1] + i[1]) / 2 + dir[1] * 72];
      maoFundo(Lf);
      tesoura(t, i, m);
      maoFrente(Lf);
    },
  },
  // 2 ------------------------------------------------------------
  {
    v: 'dechavar', modo: 'segure', dur: 6, pre: 1.5, cam: -100, loop: 'esfrega',
    tique(dt, u, seg) {
      if (seg && u < 1 && C.pos.pR) {
        if (Math.random() < dt * 22) emiteBits(C.pos.pR[0], C.pos.pR[1] + 8, MONTE_Y - 6);
        if (Math.random() < dt * 22) emiteBits(C.pos.pL[0], C.pos.pL[1] + 8, MONTE_Y - 6);
      }
    },
    draw(u) {
      if (!Q_DECHAVAR.pronto || !Q_CORTAR.pronto) return this.codigo(u);
      C.pos.pR = C.pos.pL = null;
      const k = suave(faixa(u, -1, -.3));
      desenhaQuadro(Q_CORTAR, 20, 0, -190, 1.35, 1 - k);
      desenhaQuadro(Q_DECHAVAR, u < 0 ? 0 : clamp(u) * 20, 0, -190, 1.35, k);
    },
    codigo(u) {
      const esf = C.segura * (.5 + .5 * Math.sin(G.t * 10));
      const p = mistura(POSES.pinca, POSES.esfrega, esf);
      const keysR = [
        [-1, { ...FORA_R, pose: 'pincaAb', r: -30 }],
        [-.35, { at: [60, -24], pose: 'pincaAb', r: -30 }],
        [-.2, { at: [60, -24], pose: 'pinca', r: -30 }],
        [0, { at: [40, -232], pose: 'pinca', r: -30 }],
        [1, { at: [40, -232], pose: 'pinca', r: -30 }],
      ];
      const keysL = keysR.map(([t, k]) => [t, { ...k, ...(k.x !== undefined ? FORA_L : {}), at: k.at ? [-k.at[0], k.at[1]] : undefined, r: -k.r }]);
      const hr = trilha(u, keysR, baseR()), hl = trilha(u, keysL, baseL());
      if (u >= 0) { hr.pose = p; hl.pose = mistura(POSES.pinca, POSES.esfrega, 1 - esf); hr.x += esf * 2; hl.x -= esf * 2; }
      const R = montar(hr), L = montar(hl);
      C.pos.pR = R.pinca; C.pos.pL = L.pinca;
      monte(clamp(u));
      // pedaços: vão do chão até as pontas dos dedos e vão sumindo
      const sobe = faixa(u, -.2, 0), resto = 1 - clamp(u);
      const P = [R.pinca, L.pinca];
      maoFundo(R); maoFundo(L);
      PEDACOS.forEach((f, k) => {
        const alvo = P[k % 2];
        const x = lerp(f[0], alvo[0] + (k > 1 ? 7 : -5), sobe), y = lerp(f[1], alvo[1] - (k > 1 ? 4 : 0), sobe);
        flor(x, y, k, .3 * (u > 0 ? resto : 1), C.M.seed + k + 1);
      });
      desenhaBits();
      maoFrente(R); maoFrente(L);
    },
  },
  // 3 ------------------------------------------------------------
  {
    v: 'pegar a seda', modo: 'toque', dur: 1.9, pre: 1.1, cam: 30, aoAcao: () => sfx.papel(),
    // o último quadro do dechavar se dissolve no montinho desenhado por código
    draw(u) {
      if (!Q_DECHAVAR.pronto || !Q_SEDA.pronto) return this.codigo(u);
      const k = suave(faixa(u, -1, -.4));
      desenhaQuadro(Q_DECHAVAR, 20, 0, -190, 1.35, 1 - k);
      desenhaQuadro(Q_SEDA, u < 0 ? 0 : clamp(u / .8) * 18, 0, SEDA_QY, 1.4, k);
    },
    codigo(u) {
      const W = C.M.sedaW;
      const fim = [W / 2, SEDA_Y + 22];
      const hr = trilha(u, [
        [-1, { ...FORA_R, pose: 'pinca', r: -30 }],
        [0, { at: [320, 330], pose: 'pinca', r: -30 }],
        [.8, { at: fim, pose: 'pinca', r: -24 }],
        [1, { at: fim, pose: 'pinca', r: -24 }],
      ], baseR());
      const hl = trilha(u, [
        [-1, { at: [40, -232].map((v, i) => i ? v : -v), pose: 'pinca', r: 30 }],
        [-.3, { ...FORA_L, pose: 'pinca', r: 30 }],
        [1, { ...FORA_L, pose: 'pinca', r: 30 }],
      ], baseL());
      const hr0 = trilha(u, [
        [-1, { at: [40, -232], pose: 'pinca', r: -30 }],
        [-.3, { ...FORA_R, pose: 'pinca', r: -30 }],
      ], baseR());
      monte(1);
      if (u < -.3) mao(montar(hr0));
      mao(montar(hl));
      if (u >= -.3) {
        const R = montar(hr);
        maoFundo(R);
        const k = suave(faixa(u, 0, .8));
        const rot = rad(lerp(-14, 0, k));
        const co = Math.cos(rot), si = Math.sin(rot);
        // o papel fica preso entre os dedos pela borda direita
        const cx = R.pinca[0] - co * (W / 2) + si * 22, cy = R.pinca[1] - si * (W / 2) - co * 22;
        seda(cx, cy, W, SEDA_H, rot);
        maoFrente(R);
      }
    },
  },
  // 4 ------------------------------------------------------------
  {
    v: 'colocar a plantinha', modo: 'segure', dur: 5.5, pre: 1.8, cam: 30, loop: 'salpica',
    tique(dt, u, seg) {
      if (seg && u < 1 && C.pos.pT && Math.random() < dt * 34) emiteBits(C.pos.pT[0], C.pos.pT[1] + 6, SEDA_Y + (Math.random() - .5) * 18);
    },
    draw(u) {
      if (!Q_PLANTA.pronto) return this.codigo(u);
      const k = suave(faixa(u, -1, -.3));
      if (Q_SEDA.pronto) desenhaQuadro(Q_SEDA, 18, 0, SEDA_QY, 1.4, 1 - k);
      else comAlfa(1 - k, () => this.codigo(u));
      if (k >= 1) C.pos.pT = null;
      desenhaQuadro(Q_PLANTA, u < 0 ? 0 : clamp(u) * 21, 0, PLANTA_Y, 1.4, k);
    },
    codigo(u) {
      const W = C.M.sedaW;
      const fim = [W / 2, SEDA_Y + 22];
      const R = montar(trilha(u, [[-1, { at: fim, pose: 'pinca', r: -24 }], [1, { at: fim, pose: 'pinca', r: -24 }]], baseR()));
      const faixaX = W / 2 - 34;
      const at = clamp(u);
      const x = lerp(-faixaX, faixaX, at) + Math.sin(at * 34) * 9;
      const esf = C.segura * (.5 + .5 * Math.sin(G.t * 12));
      const hT = trilha(u, [
        [-1, { x: -300, y: -1500, pose: 'pincaAb', r: 168 }],
        [-.45, { at: [0, MONTE_Y - 22], pose: 'pincaAb', r: 168 }],
        [-.28, { at: [0, MONTE_Y - 12], pose: 'pinca', r: 168 }],
        [0, { at: [-faixaX, 62], pose: 'pinca', r: 168 }],
        [1, { at: [faixaX, 62], pose: 'pinca', r: 168 }],
      ], baseT());
      if (u >= 0) {
        const delta = x - lerp(-faixaX, faixaX, at);
        hT.x += delta; hT.pose = mistura(POSES.pinca, POSES.esfrega, esf);
      }
      const T = montar(hT);
      C.pos.pT = T.pinca;
      monte(1 - .94 * at);
      maoFundo(R);
      papelPosto(at);
      maoFrente(R);
      desenhaBits();
      mao(T);
    },
  },
  // 5 ------------------------------------------------------------
  {
    v: 'bolar', modo: 'segure', dur: 4.2, pre: 1.4, cam: 60, loop: 'enrola',
    // A cena desenhada entra por dissolvência sobre o fim da etapa anterior.
    draw(u) {
      if (!Q_BOLAR.pronto) return this.codigo(u);
      const k = suave(faixa(u, -1, -.25));
      if (Q_PLANTA.pronto) desenhaQuadro(Q_PLANTA, 21, 0, PLANTA_Y, 1.4, 1 - k);
      else comAlfa(1 - k, () => this.codigo(u));
      const f = u < 0 ? 0 : clamp(u) * 24;
      desenhaQuadro(Q_BOLAR, f, 0, TUBO_Y + 40, 1.45, k);
    },
    codigo(u) {
      const W = C.M.sedaW;
      const g = suave(clamp(u));
      const topo = SEDA_Y - SEDA_H / 2, baixo = SEDA_Y + SEDA_H / 2;
      const hTubo = lerp(10, TUBO_H, faixa(g, 0, .3));
      const tc = lerp(topo + hTubo / 2, TUBO_Y, g);
      const balanco = C.segura * Math.sin(G.t * 5.5) * 7;
      const xm = W / 2 - 28;
      const R = montar(trilha(u, [
        [-1, { at: [W / 2, SEDA_Y + 22], pose: 'pinca', r: -24 }],
        [0, { at: [xm, topo], pose: 'pinca', r: -16 }],
        [1, { at: [xm, TUBO_Y], pose: 'pinca', r: -16 }],
      ], baseR()));
      const L = montar(trilha(u, [
        [-1, { ...FORA_L, pose: 'pincaAb', r: 16 }],
        [0, { at: [-xm, topo], pose: 'pinca', r: 16 }],
        [1, { at: [-xm, TUBO_Y], pose: 'pinca', r: 16 }],
      ], baseL()));
      const T = u < -.3 ? montar(trilha(u, [
        [-1, { at: [W / 2 - 34, 62], pose: 'pinca', r: 168 }],
        [-.3, { x: -300, y: -1500, pose: 'pincaAb', r: 168 }],
      ], baseT())) : null;
      const off = balanco;
      R.h.y += off * .1;
      monte(.06);
      maoFundo(R); maoFundo(L);
      const yy = tc + off * .2;
      seda(0, (yy + baixo) / 2, W, baixo - yy, 0, { dobra: false });
      desenhaFarelo(C.M.naSeda, C.M.naSeda.length, 0, SEDA_Y);
      if (u > 0) tubo(0, yy, W, hTubo);
      else seda(0, SEDA_Y, W, SEDA_H, 0);
      if (u <= 0) desenhaFarelo(C.M.naSeda, C.M.naSeda.length, 0, SEDA_Y);
      maoFrente(R); maoFrente(L);
      if (T) mao(T);
    },
  },
  // 6 ------------------------------------------------------------
  // A câmera está acima da pessoa: a cabeça sobe na tela e o tubo corre na frente da boca.
  {
    v: 'lamber', modo: 'segure', dur: 3.8, pre: 1.8, cam: 115, loop: 'lambe',
    draw(u) {
      if (!Q_BOLAR.pronto) return this.codigo(u);
      if (closesProntos()) {
        // o bolar se dissolve no close dos lábios
        const k = suave(faixa(u, -1, -.3));
        desenhaQuadro(Q_BOLAR, 24, 0, TUBO_Y + 40, 1.45, 1 - k);
        desenhaQuadro(Q_LAMBER, u < 0 ? 0 : clamp(u) * 21, CLOSE.x, CLOSE.y, CLOSE.s, k);
        return;
      }
      // o último quadro desenhado se dissolve enquanto a cabeça sobe
      const k = suave(faixa(u, -1, -.45));
      comAlfa(k, () => this.codigo(u));
      desenhaQuadro(Q_BOLAR, 24, 0, TUBO_Y + 40, 1.45, 1 - k);
    },
    codigo(u) {
      const W = C.M.sedaW, xm = W / 2 - 28, baixo = SEDA_Y + SEDA_H / 2;
      const k = suave(faixa(u, -1, -.15));
      const at = clamp(u);
      const dx = u < 0 ? lerp(0, DESLIZE, suave(faixa(u, -.5, 0))) : lerp(DESLIZE, -DESLIZE, at);
      const chave = (x, r) => ({ at: [x + dx, TUBO_Y], pose: 'pinca', r });
      const hR = trilha(u, [[-1, { ...chave(xm, -16), anc: ANC_R, extra: 300 }], [-.15, { ...chave(xm, -16), anc: OMBRO_R, extra: 30 }], [1, { ...chave(xm, -16), anc: OMBRO_R, extra: 30 }]], baseR());
      const hL = trilha(u, [[-1, { ...chave(-xm, 16), anc: ANC_L, extra: 300 }], [-.15, { ...chave(-xm, 16), anc: OMBRO_L, extra: 30 }], [1, { ...chave(-xm, 16), anc: OMBRO_L, extra: 30 }]], baseL());
      const R = montar(hR), L = montar(hL);
      maoFundo(R); maoFundo(L);
      seda(dx, (TUBO_Y + baixo) / 2, W, baixo - TUBO_Y, 0, { dobra: false });
      tubo(dx, TUBO_Y, W, TUBO_H);
      // brilho na cola por onde a língua já passou
      if (u > 0) {
        const yc = baixo - 13;
        for (let x = -DESLIZE; x < -dx; x += 24) linha([[x + dx, yc], [x + dx + 13, yc]], { w: 1.4, a: .9 });
      }
      const sai = suave(faixa(u, -.3, 0));
      const treme = C.segura * Math.sin(G.t * 8) * 2.5;
      // só sai depois que a cabeça já chegou; o resto da língua fica escondido embaixo dela
      if (sai > 0) lingua(treme * .6, lerp(285, LINGUA_Y, sai) + treme, rad(Math.sin(G.t * 1.3) * 2), .52);
      corpo(lerp(1000, 0, k), C.M.cabelo);
      maoFrente(R); maoFrente(L);
    },
  },
  // 7 ------------------------------------------------------------
  {
    v: 'finalizar', modo: 'toque', dur: 3, pre: 1, cam: 115, aoAcao: () => { sfx.papel(); setTimeout(() => nota(523.25, .05, 1.6), 1500); },
    draw(u) {
      if (!closesProntos()) return this.codigo(u);
      const k = suave(faixa(u, -1, -.3));
      desenhaQuadro(Q_LAMBER, 21, CLOSE.x, CLOSE.y, CLOSE.s, 1 - k);
      desenhaQuadro(Q_FINALIZAR, u < 0 ? 0 : clamp(u / .9) * 21, CLOSE.x, CLOSE.y, CLOSE.s, k);
    },
    codigo(u) {
      const W = C.M.sedaW;
      const xm = W / 2 - 28, baixo = SEDA_Y + SEDA_H / 2;
      const dx = u < 0 ? lerp(-DESLIZE, 0, suave(faixa(u, -1, -.1))) : 0;
      const fecha = faixa(u, 0, .28);
      const gira = faixa(u, .25, .58);
      const R = montar(trilha(u, [
        [-1, { at: [xm - DESLIZE, TUBO_Y], pose: 'pinca', r: -16 }],
        [-.1, { at: [xm, TUBO_Y], pose: 'pinca', r: -16 }],
        [.22, { at: [xm, TUBO_Y], pose: 'pinca', r: -16 }],
        [.32, { at: [W / 2 + 6, TUBO_Y], pose: 'pinca', r: -16 }],
        [.56, { at: [W / 2 + 6, TUBO_Y], pose: 'esfrega', r: 6 }],
        [.86, { ...FORA_I, pose: 'pincaAb', r: -16 }],
        [1, { ...FORA_I, pose: 'pincaAb', r: -16 }],
      ], baseCR()));
      const L = montar(trilha(u, [
        [-1, { at: [-xm - DESLIZE, TUBO_Y], pose: 'pinca', r: 16 }],
        [-.1, { at: [-xm, TUBO_Y], pose: 'pinca', r: 16 }],
        [.6, { at: [-xm, TUBO_Y], pose: 'pinca', r: 16 }],
        [1, keyJunta],
      ], baseCL()));
      maoFundo(R); maoFundo(L);
      if (u < .28) {
        const flapH = (baixo - TUBO_Y) * (1 - fecha);
        if (flapH > 2) seda(dx, TUBO_Y + flapH / 2, W, flapH, 0, { dobra: false });
        tubo(dx, TUBO_Y, W, TUBO_H);
      } else {
        const ang = lerp(0, JUNTA_ANG, suave(faixa(u, .6, 1)));
        const ponta = juntaFinal(L.pinca, ang, W, { torce: gira });
        estrelinha(ponta[0] + 34, ponta[1] - 8, Math.sin(Math.PI * faixa(u, .55, .85)));
      }
      if (u < 0) lingua(0, lerp(LINGUA_Y, 290, suave(faixa(u, -1, -.5))), 0, .52);
      corpo(0, C.M.cabelo);
      maoFrente(R); maoFrente(L);
    },
  },
  // 8 ------------------------------------------------------------
  {
    v: 'pegar o isqueiro', modo: 'toque', dur: 1.5, pre: .3, cam: 115, aoAcao: () => sfx.pega(),
    // o baseado pronto dá lugar ao primeiro quadro do acender, que sobe de baixo
    draw(u) {
      if (!closesProntos()) return this.codigo(u);
      const k = suave(faixa(u, -1, .7));
      desenhaQuadro(Q_FINALIZAR, 21, CLOSE.x, CLOSE.y, CLOSE.s, 1 - k);
      if (acv()) desenhaQuadro(Q_ACV, ACV_BASE, CLOSE.x, CLOSE.y + 120 * (1 - k), CLOSE.s, k);
      else desenhaQuadro(Q_ACENDER, 0, CLOSE.x, CLOSE.y + 120 * (1 - k), CLOSE.s, k);
    },
    codigo(u) {
      const W = C.M.sedaW;
      const L = montar(trilha(u, [[-1, keyJunta], [1, keyJunta]], baseCL()));
      const R = montar(trilha(u, [
        [0, { ...FORA_I, pose: 'punho', r: R_ISQ }],
        [1, { at: [226, -36], ref: CHAMA_L, pose: 'punho', r: R_ISQ }],
      ], baseI()));
      maoFundo(L);
      juntaFinal(L.pinca, JUNTA_ANG, W, { torce: 1 });
      maoFundo(R);
      const lp = R.W(...LIGHTER_L);
      isqueiro(lp[0], lp[1], ANG_ISQ, C.M.isq, 0);
      corpo(0, C.M.cabelo);
      maoFrente(L);
      maoFrente(R);
    },
  },
  // 9 ------------------------------------------------------------
  {
    v: 'acender', modo: 'toque', pre: .6, cam: 115,
    get n() { return C.M.tentativas; },
    // com o vídeo, os toques ocupam só o começo e o resto (chama, brasa, fumaça) corre em ~5,5 s
    get marco() { return acv() ? ACV_MARCO : .6; },
    get dur() { return acv() ? 7.6 + C.M.tentativas * .3 : 1.6 + C.M.tentativas * .7; },
    aoAcao(k) {
      sfx.clique();
      const R = C.pos.topoIsq;
      if (R) for (let i = 0; i < 10; i++) C.faiscas.push({ x: R[0], y: R[1], vx: (Math.random() - .5) * 240, vy: -60 - Math.random() * 160, v: .2 + Math.random() * .3 });
      if (k >= C.M.tentativas) sfx.fogo();
    },
    // Close de lado: cada toque é uma faísca; no último a chama pega e a brasa acende.
    // Quadros reais na tira: 0 apagado, 3 faísca, 6 a 15 chama, 18 e 21 brasa com fumaça.
    draw(u) {
      if (acv()) return this.video(u);
      if (!Q_ACENDER.pronto) return this.codigo(u);
      const n = C.M.tentativas;
      const fase = clamp(u / .6) * n;
      let f;
      if (fase < n - .85) f = Math.sin(Math.PI * clamp(fase - Math.floor(fase))) > .4 ? 3 : 0;
      else if (u < .6) f = 3 + 12 * faixa(fase, n - .85, n);
      else f = 15 + 6 * faixa(u, .6, 1);
      const k = closesProntos() ? 1 : suave(faixa(u, -1, -.1));
      comAlfa(1 - k, () => this.codigo(u));
      desenhaQuadro(Q_ACENDER, f, CLOSE.x, CLOSE.y, CLOSE.s, k);
      C.pos.topoIsq = [CLOSE.x + CLOSE.faisca[0] * CLOSE.s, CLOSE.y + CLOSE.faisca[1] * CLOSE.s];
      desenhaBits();
    },
    // Toques que falham: a roda gira e solta faísca (12 → 17 → 12). O último leva à chama (20)
    // e daí o vídeo corre até a brasa com fumaça (101).
    video(u) {
      const n = C.M.tentativas;
      const fase = clamp(u / ACV_MARCO) * n;
      let f;
      if (u >= ACV_MARCO) f = ACV_CHAMA + (ACV_FIM - ACV_CHAMA) * faixa(u, ACV_MARCO, 1);
      else if (fase >= n - 1) f = ACV_BASE + (ACV_CHAMA - ACV_BASE) * faixa(fase, n - 1, n);
      else f = ACV_BASE + 5 * Math.sin(Math.PI * clamp(fase - Math.floor(fase)));
      desenhaQuadro(Q_ACV, f, CLOSE.x, CLOSE.y, CLOSE.s, 1);
      C.pos.topoIsq = [CLOSE.x + CLOSE.faisca[0] * CLOSE.s, CLOSE.y + CLOSE.faisca[1] * CLOSE.s];
      desenhaBits();
    },
    codigo(u) {
      const W = C.M.sedaW;
      const n = C.M.tentativas;
      const L = montar(trilha(u, [[-1, keyJunta], [1, keyJunta]], baseCL()));
      const fase = clamp(u / .6) * n;
      const f = fase >= n ? 0 : fase - Math.floor(fase);
      const dentro = Math.sin(Math.PI * clamp(f));
      const tip = pontaJunta(W);
      const hr = trilha(u, [
        [0, { at: [226, -36], ref: CHAMA_L, pose: 'punho', r: R_ISQ }],
        [.6, { at: [226, -36], ref: CHAMA_L, pose: 'punho', r: R_ISQ }],
        [.82, { at: [tip[0] + 14, tip[1] + 44], ref: CHAMA_L, pose: 'punho', r: R_ISQ }],
        [1, { at: [tip[0] + 14, tip[1] + 44], ref: CHAMA_L, pose: 'punho', r: R_ISQ }],
      ], baseI());
      hr.pose = mistura(POSES.punho, POSES.punhoFlick, dentro);
      const R = montar(hr);
      const aceso = faixa(u, .86, 1);
      maoFundo(L);
      juntaFinal(L.pinca, JUNTA_ANG, W, { torce: 1 - aceso, aceso, brilho: aceso * .7 });
      const lp = R.W(...LIGHTER_L);
      const chama = fase >= n - .85 ? suave(faixa(fase, n - .85, n - .6)) : 0;
      maoFundo(R);
      isqueiro(lp[0], lp[1], ANG_ISQ, C.M.isq, chama);
      corpo(0, C.M.cabelo);
      maoFrente(L);
      maoFrente(R);
      C.pos.topoIsq = R.W(...CHAMA_L);
      desenhaBits();
    },
  },
  // 10 -----------------------------------------------------------
  // Tragar: a mão leva o filtro para baixo do nariz. A fumaça sai da frente do rosto.
  {
    v: 'fumar', modo: 'segure', dur: 11, pre: 1, cam: 115, loop: 'traga', tragos: true,
    aoEntrar() {
      if (!C.fitaBrasa) C.fitaBrasa = C.fumaBrasa.nova(0, 0, { abre: .55, vida: 6.5 });
    },
    // o close do acender se dissolve de volta na vista de cima
    draw(u) {
      if (!Q_ACENDER.pronto) return this.codigo(u);
      const k = suave(faixa(u, -1, -.15));
      if (acv()) desenhaQuadro(Q_ACV, ACV_FIM, CLOSE.x, CLOSE.y, CLOSE.s, 1 - k);
      else desenhaQuadro(Q_ACENDER, 21, CLOSE.x, CLOSE.y, CLOSE.s, 1 - k);
      comAlfa(k, () => this.codigo(u));
    },
    codigo(u) {
      const W = C.M.sedaW;
      const pux = suave(C.puxa);
      const pin = [lerp(JUNTA_PINCA[0], PINCA_BOCA[0], pux), lerp(JUNTA_PINCA[1], PINCA_BOCA[1], pux)];
      const rr = lerp(22, 50, pux);
      const L = montar(trilha(0, [[0, { ...keyJunta, at: pin, r: rr }], [1, { ...keyJunta, at: pin, r: rr }]], baseCL()));
      const ang = lerp(JUNTA_ANG, rad(-80), pux);
      const comp = lerp(W, 92, clamp(u));
      C.tinta = clamp(u) * .85;
      const tip = pontaJunta(W);
      let R = null;
      if (u < 0) {
        R = montar(trilha(u, [
          [-1, { at: [tip[0] + 14, tip[1] + 44], ref: CHAMA_L, pose: 'punho', r: R_ISQ }],
          [0, { ...FORA_I, pose: 'punho', r: R_ISQ }],
        ], baseI()));
        const lp = R.W(...LIGHTER_L);
        maoFundo(R);
        isqueiro(lp[0], lp[1], ANG_ISQ, C.M.isq, clamp(-u - .55) * 2);
      }
      const cor = corFumaca();
      maoFundo(L);
      C.pontaAcesa = juntaFinal(L.pinca, ang, comp, { aceso: 1, brilho: .4 + .6 * pux + Math.sin(G.t * 2.3) * .08, cor: C.tinta > .2 ? hsl(C.M.pal[3], 90 * C.tinta, 70) : undefined });
      C.fumaSopro.desenha(cor);
      C.fumaBrasa.desenha(cor);
      corpo(0, C.M.cabelo);
      maoFrente(L);
      if (R) maoFrente(R);
    },
  },
  // 11 -----------------------------------------------------------
  // Relaxar: a cabeça desce e sai de cena, e sobram as duas mãos abertas.
  {
    v: 'relaxar', modo: 'toque', dur: 4.4, pre: .6, cam: 115, aoAcao: () => { sfx.solta(.5); C.fitaBrasa && (C.fitaBrasa.ativa = false); },
    // a vista de cima se dissolve no close do cinzeiro
    draw(u) {
      if (!Q_RELAXAR.pronto) return this.codigo(u);
      const k = suave(faixa(u, -1, .05));
      comAlfa(1 - k, () => this.codigo(u));
      if (k >= 1) {
        C.pontaAcesa = null;
        const cor = corFumaca();
        C.fumaSopro.desenha(cor);
        C.fumaBrasa.desenha(cor);
      }
      desenhaQuadro(Q_RELAXAR, u < 0 ? 0 : clamp(u / .9) * 21, CLOSE.x, CLOSE.y, CLOSE.s * .85, k);
    },
    codigo(u) {
      const comp = 92;
      const L = montar(trilha(u, [
        [-1, keyJunta],
        [.12, keyJunta],
        [.22, { at: [JUNTA_PINCA[0] + 24, JUNTA_PINCA[1] - 34], pose: 'pincaAb', r: 34 }],
        [1, { x: -196, y: 330, pose: 'aberta', r: 8, anc: ANC_L, extra: 300 }],
      ], baseCL()));
      const R = montar(trilha(u, [
        [.2, { ...FORA_I, pose: 'aberta', r: -8 }],
        [1, { x: 196, y: 330, pose: 'aberta', r: -8, anc: ANC_R, extra: 300 }],
      ], baseCR()));
      const cor = corFumaca();
      const k = suave(faixa(u, .25, .85));
      maoFundo(L); maoFundo(R);
      if (u < .2) {
        C.pontaAcesa = juntaFinal(L.pinca, JUNTA_ANG, comp, { aceso: 1, brilho: .35 });
      } else {
        C.pontaAcesa = null;
        const q = faixa(u, .2, .75);
        const pontoX = lerp(JUNTA_PINCA[0] + 40, 420, q), pontoY = lerp(JUNTA_PINCA[1] - 70, 40, q) + q * q * 900;
        baseado(pontoX, pontoY, JUNTA_ANG + q * 7, 300, comp * .9, { aceso: 1, brilho: .3 * (1 - q) });
      }
      C.fumaSopro.desenha(cor);
      C.fumaBrasa.desenha(cor);
      corpo(k * 1400, C.M.cabelo);
      maoFrente(L); maoFrente(R);
    },
  },
  // 12 -----------------------------------------------------------
  {
    v: 'chapar', modo: 'toque', dur: .1, pre: .5, cam: 115, aoAcao: () => sfx.floresce(),
    draw() {
      const cor = corFumaca();
      C.fumaSopro.desenha(cor);
      C.fumaBrasa.desenha(cor);
      if (Q_RELAXAR.pronto) return desenhaQuadro(Q_RELAXAR, 21, CLOSE.x, CLOSE.y, CLOSE.s * .85, 1);
      const L = montar({ x: -196, y: 330, s: 1, r: 8, flip: true, pose: POSES.aberta, anc: ANC_L });
      const R = montar({ x: 196, y: 330, s: 1, r: -8, flip: false, pose: POSES.aberta, anc: ANC_R, pulseira: C.M.pulseira, anel: C.M.anel, tatuagem: C.M.tatuagem });
      mao(L); mao(R);
    },
  },
];

export { ANC_L, ANC_R, FORA_L, FORA_R, arco, desenhaChama };
