// Todo o som é sintetizado na hora: nada de arquivo de áudio.
let ctx = null, mestre, musica, efeitos, filtro, eco, pausaNotas = 0, ligado = true, chapado = 0, acorde = 0, relogio = 0;
let ruidoBuf = null;
const loops = {};
const ACORDES = [
  [110, 164.81, 196, 261.63],
  [87.31, 130.81, 174.61, 220],
  [130.81, 196, 246.94, 329.63],
  [98, 146.83, 196, 246.94],
];
const FIXAS = [['brisa', 'Brisa'], ['fumaca', 'Fumaça']];
const REGGAE = [['so-brisa', 'Só brisa'], ['viagem', 'Viagem'], ['ovelha', 'Ovelha'], ['felix-felices', 'Felix Felices'], ['noite-de-loucuras', 'Noite de Loucuras'], ['de-volta-pro-passado', 'De Volta Pro Passado']];
let fila = [], faixaI = -1, tocador = null, musGanho = null, musFiltro = null, falhas = 0, semMusica = false, aoTrocar = null;
export const quandoTrocarFaixa = fn => { aoTrocar = fn; };
const ESCALA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
let vozes = [];

function criaRuido() {
  const n = ctx.sampleRate * 3, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let ult = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; ult = (ult + .03 * w) / 1.03; d[i] = ult * 3 + w * .25; }
  return b;
}

function criaReverb() {
  const seg = 3.4, n = Math.floor(ctx.sampleRate * seg), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
  }
  const r = ctx.createConvolver(); r.buffer = b; return r;
}

export function iniciarSom() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  mestre = ctx.createGain(); mestre.gain.value = ligado ? .9 : 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  mestre.connect(comp); comp.connect(ctx.destination);
  musica = ctx.createGain(); musica.gain.value = 0;
  efeitos = ctx.createGain(); efeitos.gain.value = .85;
  filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 620; filtro.Q.value = .4;
  eco = criaReverb();
  const ecoG = ctx.createGain(); ecoG.gain.value = .42;
  musica.connect(filtro); filtro.connect(mestre); filtro.connect(ecoG); ecoG.connect(eco); eco.connect(mestre);
  efeitos.connect(mestre);
  ruidoBuf = criaRuido();

  // Vozes do tapete
  for (let i = 0; i < 4; i++) {
    const g = ctx.createGain(); g.gain.value = .16 - i * .018;
    const a = ctx.createOscillator(), b = ctx.createOscillator();
    a.type = 'sine'; b.type = 'triangle'; b.detune.value = 6 + i * 2;
    const gb = ctx.createGain(); gb.gain.value = .35;
    a.connect(g); b.connect(gb); gb.connect(g); g.connect(musica);
    a.start(); b.start();
    vozes.push({ a, b });
  }
  // Chiado de fundo, bem baixo
  const ch = ctx.createBufferSource(); ch.buffer = ruidoBuf; ch.loop = true;
  const chF = ctx.createBiquadFilter(); chF.type = 'bandpass'; chF.frequency.value = 2400; chF.Q.value = .3;
  const chG = ctx.createGain(); chG.gain.value = .012;
  ch.connect(chF); chF.connect(chG); chG.connect(mestre); ch.start();
  // Tremor lento no filtro
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
  lfo.frequency.value = .07; lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(filtro.frequency); lfo.start();
  mudaAcorde(0);
  iniciarPlaylist();
}

// ---------- Playlist: Brisa e Fumaça abrem, depois o reggae em ordem sorteada, sempre em volta.
function embaralha(l) {
  l = l.slice();
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

function iniciarPlaylist() {
  fila = [...FIXAS, ...embaralha(REGGAE)];
  tocador = new Audio();
  tocador.preload = 'auto';
  musFiltro = ctx.createBiquadFilter(); musFiltro.type = 'lowpass'; musFiltro.frequency.value = 3200; musFiltro.Q.value = .3;
  musGanho = ctx.createGain(); musGanho.gain.value = 0;
  ctx.createMediaElementSource(tocador).connect(musFiltro);
  musFiltro.connect(musGanho); musGanho.connect(mestre);
  musGanho.gain.setTargetAtTime(.6, ctx.currentTime, 1.6);
  tocador.addEventListener('ended', proximaFaixa);
  tocador.addEventListener('error', () => {
    if (++falhas >= 3) { usarTapete(); return; }
    proximaFaixa();
  });
  tocador.addEventListener('playing', () => { falhas = 0; });
  proximaFaixa();
}

// Sem conseguir tocar as músicas, volta o tapete sintetizado.
function usarTapete() {
  semMusica = true;
  aoTrocar?.('');
  if (ctx) musica.gain.setTargetAtTime(chapado ? .62 : .42, ctx.currentTime, 2);
}

export function proximaFaixa() {
  if (!tocador || semMusica) return;
  faixaI = (faixaI + 1) % fila.length;
  if (faixaI === 0 && tocador.src) fila = embaralha(fila);
  const [arq, nome] = fila[faixaI];
  tocador.src = `musicas/${arq}.mp3`;
  tocador.play().catch(() => {});
  aoTrocar?.(nome);
}

function mudaAcorde(i) {
  const a = ACORDES[i % ACORDES.length], t = ctx.currentTime;
  vozes.forEach((v, k) => {
    v.a.frequency.setTargetAtTime(a[k], t, 2.2);
    v.b.frequency.setTargetAtTime(a[k] * (chapado ? 2 : 1), t, 2.2);
  });
}

export function nota(freq, vol = .09, dur = 2.6) {
  if (!ctx || !semMusica) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  o2.type = 'triangle'; o2.frequency.value = freq * 2.001;
  const g2 = ctx.createGain(); g2.gain.value = .14;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + .015);
  g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(filtro);
  o.start(t); o2.start(t); o.stop(t + dur + .1); o2.stop(t + dur + .1);
}

export function toqueFlor() {
  if (semMusica) { notaAoAcaso(.1); return; }
  ruido({ dur: .9, de: 5200, ate: 8200, q: 2, vol: .05, ataque: .03 });
}

export function notaAoAcaso(vol) { nota(ESCALA[Math.floor(Math.random() * ESCALA.length)], vol); }

// Chamado a cada quadro: troca os acordes e solta notas de vez em quando.
export function tiqueSom(dt) {
  if (!ctx) return;
  relogio += dt;
  if (relogio > 16) { relogio = 0; acorde++; mudaAcorde(acorde); }
  pausaNotas -= dt;
  if (semMusica && pausaNotas <= 0) {
    pausaNotas = chapado ? .7 + Math.random() * 1.6 : 3.5 + Math.random() * 5;
    notaAoAcaso(chapado ? .085 : .05);
  }
}

export function faseChapada(on) {
  chapado = on ? 1 : 0;
  if (!ctx) return;
  const t = ctx.currentTime;
  filtro.frequency.cancelScheduledValues(t);
  filtro.frequency.setTargetAtTime(on ? 2600 : 620, t, on ? 3 : 4);
  if (semMusica) musica.gain.setTargetAtTime(on ? .62 : .42, t, 2.5);
  // No preto a música fica abafada e mais baixa; na cor ela se abre inteira.
  if (musFiltro) {
    musFiltro.frequency.setTargetAtTime(on ? 18000 : 3200, t, on ? 2.5 : 3);
    musGanho.gain.setTargetAtTime(on ? .95 : .6, t, 2.5);
  }
  mudaAcorde(acorde);
}

function ruido({ dur = .2, de = 1000, ate = de, q = 1, vol = .2, tipo = 'bandpass', ataque = .005 }) {
  if (!ctx) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = ruidoBuf; s.loop = true;
  f.type = tipo; f.Q.value = q;
  f.frequency.setValueAtTime(de, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, ate), t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(efeitos);
  s.start(t, Math.random() * 2); s.stop(t + dur + .05);
}

export const sfx = {
  toque: () => ruido({ dur: .08, de: 900, q: 2, vol: .06 }),
  pega: () => ruido({ dur: .18, de: 700, ate: 1500, q: 1.2, vol: .14 }),
  corte() {
    ruido({ dur: .05, de: 5200, q: 3, vol: .3 });
    setTimeout(() => ruido({ dur: .07, de: 3400, q: 4, vol: .34 }), 85);
  },
  papel: () => ruido({ dur: .42, de: 2800, ate: 5200, q: .6, vol: .13, ataque: .05 }),
  clique() {
    ruido({ dur: .03, de: 3200, q: 5, vol: .5 });
    setTimeout(() => ruido({ dur: .06, de: 6400, q: 2, vol: .16 }), 26);
  },
  fogo: () => ruido({ dur: .7, de: 500, ate: 1600, q: .5, vol: .3, ataque: .03 }),
  solta: (v = 1) => ruido({ dur: 1.5 + v * 1.6, de: 2000, ate: 340, q: .4, vol: .22, ataque: .08 }),
  floresce: () => ruido({ dur: 3.2, de: 500, ate: 6000, q: .4, vol: .12, ataque: 1.2 }),
};

const LOOPS = {
  esfrega: { freq: 2600, q: .8, vol: .1, mod: 9, modProf: .08 },
  enrola: { freq: 1800, q: .7, vol: .09, mod: 3.2, modProf: .07 },
  salpica: { freq: 5200, q: 1.1, vol: .06, mod: 13, modProf: .05 },
  lambe: { freq: 720, q: 1.4, vol: .1, mod: 2.4, modProf: .06 },
  traga: { freq: 980, q: .6, vol: .17, mod: .3, modProf: .02 },
};

export function loop(nome, on) {
  if (!ctx || !nome) return;
  const t = ctx.currentTime;
  let L = loops[nome];
  if (on && !L) {
    const def = LOOPS[nome];
    const s = ctx.createBufferSource(); s.buffer = ruidoBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = def.freq; f.Q.value = def.q;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = def.mod; lg.gain.value = def.modProf; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(efeitos); s.start(); lfo.start();
    L = loops[nome] = { g, def };
  }
  if (L) L.g.gain.setTargetAtTime(on ? L.def.vol : 0, t, on ? .12 : .2);
}
export function pararLoops() { for (const n in loops) loop(n, false); }

export function alternarSom() {
  ligado = !ligado;
  if (ctx) mestre.gain.setTargetAtTime(ligado ? .9 : 0, ctx.currentTime, .15);
  return ligado;
}
