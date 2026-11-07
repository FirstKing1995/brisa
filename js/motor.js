// Utilidades e o traço: tudo no jogo passa por linha(), que dá o tremor de desenho à mão.
export const G = { ctx: null, t: 0, boil: 0, amp: 1, derrete: 0, cor: '#f4f4f0', fundo: '#000', larg: 2.6 };

export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const suave = k => { k = clamp(k); return k * k * (3 - 2 * k); };
export const faixa = (v, a, b) => clamp((v - a) / (b - a));
export const rad = g => g * Math.PI / 180;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tremor que muda 7 vezes por segundo; "derrete" é a ondulação contínua da fase colorida.
function desloca(x, y) {
  const b = G.boil, a = G.amp;
  let dx = (Math.sin(x * .043 + b * 1.7) + Math.sin(y * .071 + b * 2.3) * .7) * a;
  let dy = (Math.sin(y * .049 + b * 1.3 + 2) + Math.sin(x * .067 + b * 2.9) * .7) * a;
  if (G.derrete) {
    dx += Math.sin(y * .011 + G.t * .7) * G.derrete + Math.sin(y * .03 - G.t * .5) * G.derrete * .35;
    dy += Math.sin(x * .013 - G.t * .6) * G.derrete * .8;
  }
  return [x + dx, y + dy];
}

// o: { f: preenche (true = cor de fundo), fechar, w, a, cor, semTraco }
export function linha(pts, o = {}) {
  if (!pts.length) return;
  const c = G.ctx;
  c.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const q = desloca(pts[i][0], pts[i][1]);
    if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
  }
  if (o.fechar) c.closePath();
  const a0 = c.globalAlpha;
  if (o.a !== undefined) c.globalAlpha = a0 * o.a;
  if (o.f) { c.fillStyle = o.f === true ? G.fundo : o.f; c.fill(); }
  if (!o.semTraco) {
    c.strokeStyle = o.cor || G.cor;
    c.lineWidth = o.w || G.larg;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
  c.globalAlpha = a0;
}

// Arredonda uma poligonal (Chaikin), mantendo as pontas quando aberta.
export function arredonda(pts, n = 2, fechada = false) {
  let out = pts;
  for (let k = 0; k < n; k++) {
    const r = [];
    const m = out.length;
    if (!fechada) r.push(out[0]);
    const lim = fechada ? m : m - 1;
    for (let i = 0; i < lim; i++) {
      const a = out[i], b = out[(i + 1) % m];
      r.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]);
      r.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    if (!fechada) r.push(out[m - 1]);
    out = r;
  }
  return out;
}

// Transforma pontos locais em pontos do mundo.
export function tf(pts, x, y, r = 0, s = 1) {
  const co = Math.cos(r) * s, si = Math.sin(r) * s;
  return pts.map(p => [x + p[0] * co - p[1] * si, y + p[0] * si + p[1] * co]);
}

export function arco(cx, cy, rx, ry, a0, a1, n = 12) {
  const r = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    r.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return r;
}
