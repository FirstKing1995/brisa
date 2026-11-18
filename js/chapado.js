// A fase colorida: uma viagem feita com os próprios desenhos dos vídeos (o rosto do chapar,
// a flor do começo e a fumaça do cinzeiro). Tudo é desenhado em branco numa camada à parte e
// depois tingido por um arco-íris que gira devagar; a camada final guarda um rastro curto.
import { lerp, clamp, suave } from './motor.js';
import { quadros } from './objetos.js';
import { toqueFlor } from './som.js';

export const DURACAO = 48;

const Q_ROSTO = quadros('chapar-video', 61, 10);
const Q_FLOR = quadros('final-flor', 1);
const Q_FUMACA = quadros('final-fumaca', 1);
const ROSTO = { x: 0, y: 115, s: 2.1 };

const cor = (h, s = 88, l = 66, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

// Desenha um quadro da grade centrado em (x, y), girado e escalado, somando luz.
function sprite(c, q, f, x, y, s, r = 0, a = 1) {
  if (!q.pronto || a <= .003 || s <= .001) return;
  const linhas = Math.ceil(q.n / q.colunas);
  const w = q.img.width / q.colunas, h = q.img.height / linhas;
  f = Math.max(0, Math.min(q.n - 1, Math.round(f)));
  c.save();
  c.translate(x, y);
  if (r) c.rotate(r);
  c.globalAlpha = a;
  c.drawImage(q.img, (f % q.colunas) * w, Math.floor(f / q.colunas) * h, w, h, -w * s / 2, -h * s / 2, w * s, h * s);
  c.restore();
}

// fios de fumaça só dos lados, para não passarem por cima do rosto
const foraDoRosto = lado => lado * (430 + Math.random() * 330);

export class Chapado {
  constructor() {
    this.tela = document.createElement('canvas'); this.ctx = this.tela.getContext('2d');
    this.branco = document.createElement('canvas'); this.cb = this.branco.getContext('2d');
    this.t = 0;
  }

  iniciar(M, largura, altura) {
    this.M = M;
    this.t = 0;
    this.flores = [];
    this.dim(largura, altura);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#05030b';
    this.ctx.fillRect(0, 0, this.tela.width, this.tela.height);
    // Fios de fumaça que sobem em volta do rosto (visão "fumaca") e lanternas de flor ("jardim").
    this.fios = Array.from({ length: 8 }, (_, i) => ({ x: foraDoRosto(i % 2 ? 1 : -1), f: Math.random(), v: .045 + Math.random() * .03, e: .9 + Math.random() * .7, l: i % 2 ? 1 : -1 }));
    this.lanternas = Array.from({ length: 14 }, (_, i) => ({ l: i % 2 ? 1 : -1, x: (i % 2 ? 1 : -1) * (400 + Math.random() * 420), f: Math.random(), v: .03 + Math.random() * .025, g: Math.random() * 6, e: .7 + Math.random() * .8 }));
  }

  dim(w, h) {
    const W = Math.round(w * .7), H = Math.round(h * .7);
    for (const c of [this.tela, this.branco]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  }

  toque(x, y) {
    this.flores.push({ x, y, v: 0, g: (Math.random() - .5) * 1.2, giro: (Math.random() - .5) * .5, e: 1.6 + Math.random() * 1.4 });
    if (this.flores.length > 18) this.flores.shift();
    toqueFlor();
  }

  atualiza(dt) {
    this.t += dt;
    for (const f of this.flores) f.v += dt;
    this.flores = this.flores.filter(f => f.v < 7);
    for (const f of this.fios) { f.f += dt * f.v; if (f.f > 1) { f.f -= 1; f.x = foraDoRosto(f.l); } }
    for (const f of this.lanternas) { f.f += dt * f.v; if (f.f > 1) { f.f -= 1; f.x = f.l * (400 + Math.random() * 420); } }
  }

  // Pinta a camada. escala e camY são os da câmera do jogo.
  pinta(escala, camY) {
    const c = this.ctx, b = this.cb, w = this.tela.width, h = this.tela.height, t = this.t, pal = this.M.pal;
    const s = escala * .7;
    const abre = suave(t / 7);

    // Rastro curto: a camada escurece um pouco a cada quadro.
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(5,3,11,.16)';
    c.fillRect(0, 0, w, h);

    // Manchas de cor que passeiam devagar ao fundo
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const x = w * (.5 + .38 * Math.sin(t * .13 + i * 2.2)), y = h * (.5 + .36 * Math.cos(t * .1 + i * 1.4));
      const r = Math.max(w, h) * (.45 + .1 * Math.sin(t * .2 + i));
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cor(pal[i] + t * 3, 90, 50, .045 * abre));
      g.addColorStop(1, cor(pal[i], 90, 40, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    // 1) Tudo em branco, na camada de apoio
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.fillStyle = '#000';
    b.fillRect(0, 0, w, h);
    b.setTransform(s, 0, 0, s, w / 2, h / 2 - camY * s);
    b.globalCompositeOperation = 'lighter';
    this[this.M.visao]?.(b, t, abre);
    this.rosto(b, t);
    for (const f of this.flores) {
      const k = f.v / 7;
      const a = Math.sin(Math.PI * clamp(k)) * .95;
      sprite(b, Q_FLOR, 0, f.x, f.y - suave(k) * 60, f.e * (.25 + suave(clamp(k * 2.2)) * .9), f.g + f.giro * f.v, a);
    }

    // 2) Tinge o branco com um arco-íris que gira em volta do rosto
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'multiply';
    const cx = w / 2, cy = h / 2 + (ROSTO.y - camY) * s;
    let g;
    if (b.createConicGradient) {
      g = b.createConicGradient(t * .12, cx, cy);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, cor(pal[i % 4] + t * 8, 100, 60));
    } else {
      g = b.createLinearGradient(0, 0, w, h);
      for (let i = 0; i <= 3; i++) g.addColorStop(i / 3, cor(pal[i] + t * 8, 92, 64));
    }
    b.fillStyle = g;
    b.fillRect(0, 0, w, h);

    // 3) Junta na camada final pelo mais claro (somar acumularia o rastro até estourar no branco)
    c.globalCompositeOperation = 'lighten';
    c.drawImage(this.branco, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  // O rosto do fim do chapar fica no centro, respirando devagar.
  rosto(b, t) {
    const r = 1 + .025 * Math.sin(t * .6);
    sprite(b, Q_ROSTO, Q_ROSTO.n - 1, ROSTO.x, ROSTO.y + Math.sin(t * .45) * 6, ROSTO.s * r, Math.sin(t * .23) * .03, 1);
  }

  // Anéis de flores girando em volta do rosto, como um caleidoscópio.
  mandala(b, t, abre) {
    const aneis = [{ n: 8, r: 470, e: 1.05, v: .07 }, { n: 13, r: 720, e: 1.35, v: -.045 }, { n: 19, r: 1000, e: 1.6, v: .03 }];
    aneis.forEach((A, k) => {
      const surge = suave(clamp((t - k * 1.6) / 5));
      if (surge <= 0) return;
      const pulso = 1 + .06 * Math.sin(t * .5 + k * 1.3);
      for (let i = 0; i < A.n; i++) {
        const an = i / A.n * Math.PI * 2 + t * A.v;
        const r = A.r * pulso * lerp(.4, 1, surge);
        sprite(b, Q_FLOR, 0, Math.sin(an) * r, ROSTO.y - Math.cos(an) * r, A.e * surge, an, .75 * surge);
      }
    });
  }

  // Fios de fumaça subindo dos lados.
  fumaca(b, t, abre) {
    for (const f of this.fios) {
      const a = Math.sin(Math.PI * f.f) * .9 * abre;
      sprite(b, Q_FUMACA, 0, f.x + Math.sin(t * .5 + f.x) * 40, 760 - f.f * 1500, f.e * 2.2, Math.sin(t * .3 + f.x) * .12, a);
      // o espelho do fio dá a cara de chama dupla
      b.save(); b.translate(f.x + 60 * f.l, 0); b.scale(-1, 1); b.translate(-(f.x + 60 * f.l), 0);
      sprite(b, Q_FUMACA, 0, f.x + 60 * f.l + Math.sin(t * .5 + f.x + 1) * 40, 820 - f.f * 1500, f.e * 1.6, Math.sin(t * .3 + f.x) * .12, a * .6);
      b.restore();
    }
  }

  // Flores que sobem devagar como lanternas, abrindo enquanto sobem.
  jardim(b, t, abre) {
    for (const f of this.lanternas) {
      const a = Math.sin(Math.PI * f.f) * .95 * abre;
      const y = 820 - f.f * 1700;
      sprite(b, Q_FLOR, 0, f.x + Math.sin(t * .4 + f.g) * 60, y, f.e * (.8 + f.f * 1.3), Math.sin(t * .35 + f.g) * .35, a);
    }
  }

  // Ecos do rosto saindo do centro, um túnel de rostos.
  ondas(b, t, abre) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const fase = ((t * .09 + i / n) % 1);
      const e = ROSTO.s * Math.pow(5, fase) * 1.05;
      const a = Math.sin(Math.PI * fase) * .42 * abre;
      sprite(b, Q_ROSTO, Q_ROSTO.n - 1, ROSTO.x, ROSTO.y + fase * 60, e, Math.sin(t * .2 + i) * .08 * fase, a);
    }
  }
}
