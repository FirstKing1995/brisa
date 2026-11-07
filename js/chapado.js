// A fase colorida: visões em camada própria, com rastro. As mãos flutuam por cima.
import { G, linha, tf, lerp, clamp, suave, faixa, rad } from './motor.js';
import { POSES, montar, mao } from './mao.js';
import { folha, Fumaca } from './objetos.js';
import { ANC_L, ANC_R } from './cenas.js';
import { toqueFlor } from './som.js';

export const DURACAO = 48;

const cor = (h, s = 88, l = 66, a = 1) => `hsla(${h % 360},${s}%,${l}%,${a})`;

export class Chapado {
  constructor() { this.tela = document.createElement('canvas'); this.ctx = this.tela.getContext('2d'); this.t = 0; }

  iniciar(M, largura, altura) {
    this.M = M;
    this.t = 0;
    this.flores = [];
    this.nuvem = new Fumaca();
    this.fitas = [];
    this.acum = 0;
    this.dim(largura, altura);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#05030b';
    this.ctx.fillRect(0, 0, this.tela.width, this.tela.height);
    const n = 6;
    this.hastes = [];
    for (let i = 0; i < n; i++) this.hastes.push({ x: lerp(-320, 320, (i + .5) / n) + (Math.random() - .5) * 40, h: 280 + Math.random() * 420, f: Math.random() * 6, m: 5 + (i % 4) });
    if (M.visao === 'fumaca') {
      for (let i = 0; i < 5; i++) {
        this.fitas.push({ f: this.nuvem.nova(0, 0, { abre: 1.5, vida: 13 }), x: lerp(-280, 280, i / 4), h: M.pal[i % 4] });
      }
    }
  }

  dim(w, h) {
    const W = Math.round(w * .7), H = Math.round(h * .7);
    if (this.tela.width !== W || this.tela.height !== H) { this.tela.width = W; this.tela.height = H; }
  }

  toque(x, y) {
    this.flores.push({ x, y, v: 0, h: this.M.pal[Math.floor(Math.random() * 4)], m: 5 + Math.floor(Math.random() * 5), g: Math.random() * 6 });
    if (this.flores.length > 24) this.flores.shift();
    toqueFlor();
  }

  atualiza(dt) {
    this.t += dt;
    for (const f of this.flores) f.v += dt;
    this.flores = this.flores.filter(f => f.v < 6.5);
    if (this.M.visao === 'fumaca') {
      this.nuvem.atualiza(dt);
      this.acum += dt;
      if (this.acum > .06) {
        this.acum = 0;
        for (const f of this.fitas) this.nuvem.emite(f.f, f.x + Math.sin(this.t * .4 + f.h) * 30, 620);
      }
    }
  }

  // Pinta a camada. T é a transformação do mundo em pixels desta camada.
  pinta(escala, camY) {
    const c = this.ctx, w = this.tela.width, h = this.tela.height, t = this.t, pal = this.M.pal;
    const s = escala * .7;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(5,3,11,.11)';
    c.fillRect(0, 0, w, h);

    // Manchas de cor que passeiam devagar
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = w * (.5 + .38 * Math.sin(t * .13 + i * 2.2)), y = h * (.5 + .36 * Math.cos(t * .1 + i * 1.4));
      const r = Math.max(w, h) * (.42 + .1 * Math.sin(t * .2 + i));
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cor(pal[i] + t * 3, 90, 52, .05));
      g.addColorStop(1, cor(pal[i], 90, 40, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    c.globalCompositeOperation = 'source-over';
    c.setTransform(s, 0, 0, s, w / 2, h / 2 - camY * s);

    const ctx0 = G.ctx, fundo0 = G.fundo, cor0 = G.cor, amp0 = G.amp, der0 = G.derrete, larg0 = G.larg;
    G.ctx = c; G.fundo = false; G.amp = 1.4; G.derrete = 12 + 6 * Math.sin(t * .2); G.larg = 2.6;

    const abre = suave(t / 6);
    this[this.M.visao]?.(t, abre, pal);

    // Flores de toque
    for (const f of this.flores) {
      const k = f.v / 6.5, r = 30 + suave(k * 2) * 130, a = Math.sin(Math.PI * clamp(k)) * .95;
      for (let i = 0; i < f.m; i++) {
        const ang = f.g + i / f.m * Math.PI * 2 + t * .08;
        G.cor = cor(f.h + i * 12 + t * 5, 90, 72);
        linha(tf(folha(r, r * .24, 4), f.x, f.y, ang), { fechar: true, w: 2.2, a });
      }
    }
    G.ctx = ctx0; G.fundo = fundo0; G.cor = cor0; G.amp = amp0; G.derrete = der0; G.larg = larg0;
  }

  mandala(t, abre, pal) {
    const aneis = [
      { n: 9, r: 90, c: 150, v: .1 },
      { n: 14, r: 215, c: 170, v: -.07 },
      { n: 20, r: 350, c: 190, v: .05 },
      { n: 7, r: 28, c: 90, v: -.14 },
    ];
    aneis.forEach((a, k) => {
      const pulso = 1 + .12 * Math.sin(t * .5 + k);
      G.cor = cor(pal[k] + t * 6, 90, 68);
      const f = folha(a.c * pulso * abre, a.c * .2 * abre, 6);
      for (let i = 0; i < a.n; i++) {
        const an = i / a.n * Math.PI * 2 + t * a.v;
        const r = a.r * abre * pulso;
        linha(tf(f, Math.sin(an) * r * .4, 100 - Math.cos(an) * r * .4, an), { fechar: true });
      }
    });
  }

  jardim(t, abre, pal) {
    for (const [i, b] of this.hastes.entries()) {
      const cresce = suave((t - i * .8) / 9);
      if (cresce <= 0) continue;
      const pts = [];
      const topo = b.h * cresce;
      for (let k = 0; k <= 22; k++) {
        const q = k / 22;
        pts.push([b.x + Math.sin(q * 5 + b.f + t * .3) * 34 * q, 760 - q * (topo + 500)]);
      }
      G.cor = cor(pal[i % 4] + t * 4, 80, 60);
      linha(pts, { w: 2.6 });
      for (let k = 6; k < 20; k += 5) {
        const p = pts[k];
        if (!p) continue;
        linha(tf(folha(70 * cresce, 15 * cresce, 5), p[0], p[1], (k % 2 ? 1 : -1) * 1.1 + Math.sin(t * .4 + k) * .2), { fechar: true, w: 2 });
      }
      const ponta = pts[22];
      G.cor = cor(pal[(i + 1) % 4] + t * 8, 92, 70);
      for (let m = 0; m < b.m; m++) {
        linha(tf(folha(72 * cresce, 17 * cresce, 4), ponta[0], ponta[1], m / b.m * 6.283 + t * .15), { fechar: true });
      }
    }
  }

  ondas(t, abre, pal) {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const y = lerp(-600, 700, i / (n - 1));
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const x = lerp(-960, 960, k / 48);
        const dentro = Math.exp(-(x * x) / 95000);
        const v = Math.sin(x * .012 + t * .7 + i * .42) * 30 + Math.sin(x * .031 - t * .5 + i * .2) * 15;
        pts.push([x, y + v * (.35 + dentro * 1.7) * abre]);
      }
      G.cor = cor(pal[i % 4] + i * 7 + t * 9, 88, 62);
      linha(pts, { w: 2.2 });
    }
  }

  fumaca(t, abre, pal) {
    this.nuvem.fitas.forEach((f, i) => {
      f.cor = this.corRgb(pal[i % 4] + t * 6);
    });
    this.nuvem.desenha();
    G.ctx.globalAlpha = 1;
  }

  corRgb(h) {
    h = ((h % 360) + 360) % 360;
    const s = .86, l = .66, a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))))); };
    return `${f(0)},${f(8)},${f(4)}`;
  }

  // Mãos boiando, por cima de tudo. sai: 0 a 1 quando estão indo embora.
  maos(t, sai, surge) {
    const M = this.M, pal = M.pal;
    const brilho = 62 + 8 * Math.sin(t * .4);
    const hue = [pal[0] + t * 12, pal[1] + t * 12];
    const a = POSES.aberta;
    const onda = (b, fase) => {
      const p = { fr: 't' };
      for (const n of ['t', 'i', 'm', 'r', 'p']) {
        const f = n.charCodeAt(0) * .3 + fase;
        p[n] = [b[n][0] + Math.sin(t * .8 + f) * 5, b[n][1] + Math.sin(t * .7 + f) * 8 - 6, b[n][2] + Math.sin(t * .9 + f) * 9 - 6];
      }
      return p;
    };
    const dy = sai * 1400 + (1 - surge) * 0;
    const R = montar({ x: 196 + Math.sin(t * .35) * 30, y: 330 + Math.sin(t * .5) * 34 + dy, s: 1, r: -8 + Math.sin(t * .3) * 9, flip: false, pose: onda(a, 1), anc: ANC_R, pulseira: M.pulseira, anel: M.anel, tatuagem: M.tatuagem });
    const L = montar({ x: -196 - Math.sin(t * .35) * 30, y: 330 + Math.sin(t * .5 + 2) * 34 + dy, s: 1, r: 8 - Math.sin(t * .3 + 1) * 9, flip: true, pose: onda(a, 3), anc: ANC_L });
    const k = clamp(t / 6);
    G.fundo = `rgba(0,0,0,${lerp(1, .25, k)})`;
    G.amp = lerp(1, 1.6, k);
    G.derrete = lerp(0, 10, k);
    G.cor = k < 1 ? mistura(hue[0], k) : cor(hue[0], 90, brilho);
    mao(R);
    G.cor = k < 1 ? mistura(hue[1], k) : cor(hue[1], 90, brilho);
    mao(L);
  }
}

function mistura(h, k) { return `hsl(${h % 360},${90 * k}%,${lerp(96, 66, k)}%)`; }
