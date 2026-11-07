import { G, clamp, lerp, suave, faixa } from './motor.js';
import { PASSOS, C, novaSessao, atualizaEfeitos, sopra } from './cenas.js';
import { flor } from './objetos.js';
import { Chapado, DURACAO } from './chapado.js';
import { iniciarSom, tiqueSom, loop, pararLoops, faseChapada, alternarSom, proximaFaixa, quandoTrocarFaixa } from './som.js';

const tela = document.getElementById('tela');
const ctx = tela.getContext('2d');
const $ = id => document.getElementById(id);
const elCmd = $('comando'), elVerbo = $('verbo'), elDica = $('dica'), elAnel = document.querySelector('#anel .cheio');

const J = {
  modo: 'abertura', idx: 0, u: -1, alvo: 0, toques: 0, seg: false, tempoSeg: 0, tragoCheio: false, tempoSolto: 0,
  auto: false, autoT: 0, cam: -115, sessao: 0, t: 0, flood: 0, fimFade: 0, verbo: '',
};
let W = 0, H = 0, DPR = 1, escala = 1, boilT = 0;
const chapado = new Chapado();

const leNum = k => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const salva = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* sem armazenamento */ } };

function redimensiona() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.round(innerWidth * DPR); H = Math.round(innerHeight * DPR);
  tela.width = W; tela.height = H;
  escala = Math.min(W / 720, H / 1000);
  if (J.modo === 'chapado') chapado.dim(W, H);
}
addEventListener('resize', redimensiona);

const passo = () => PASSOS[J.idx];

function mostraComando() {
  const p = passo();
  if (J.verbo !== p.v) { J.verbo = p.v; elVerbo.textContent = p.v; }
  elCmd.classList.toggle('segurar', p.modo === 'segure');
  elDica.textContent = p.modo === 'segure' ? 'segure' : (p.n || 1) > 1 ? 'toque, toque' : 'toque';
}

function entra(i) {
  J.idx = i; J.u = -1; J.toques = 0; J.alvo = 0; J.seg = J.seg && passo().modo === 'segure'; J.tempoSeg = 0; J.tragoCheio = false; J.autoT = 0;
  pararLoops();
  passo().aoEntrar?.();
  elCmd.classList.remove('ativo');
}

function proximo() {
  const p = passo();
  if (p.loop) loop(p.loop, false);
  if (J.idx === PASSOS.length - 1) { comecaChapado(); return; }
  entra(J.idx + 1);
}

function comecaChapado() {
  J.modo = 'chapado'; J.flood = 0; J.fimFade = 0;
  elCmd.classList.add('ativo'); elVerbo.textContent = ''; elDica.textContent = 'toque na tela, se quiser';
  elCmd.classList.remove('segurar');
  G.unha = C.M.unha;
  chapado.iniciar(C.M, W, H);
  faseChapada(true);
  setTimeout(() => elCmd.classList.remove('ativo'), 6000);
  J.sessao++;
  salva('brisa.sessoes', J.sessao);
  atualizaContagem();
}

function terminaChapado() {
  faseChapada(false);
  J.modo = 'jogo';
  G.cor = '#f4f4f0'; G.fundo = '#000'; G.amp = 1; G.derrete = 0; G.larg = 2.6;
  C.fumaSopro.fitas = []; C.fumaBrasa.fitas = [];
  novaSessao(J.sessao);
  J.cam = -115;
  entra(0);
}

function atualizaContagem() {
  $('contagem').textContent = J.sessao ? `${J.sessao} ${J.sessao === 1 ? 'bolado' : 'bolados'}` : '';
}

// ---------- Comandos ----------
function aperta() {
  if (J.modo === 'chapado') return;
  if (J.modo !== 'jogo') return;
  const p = passo();
  if (J.u < 0) return;
  if (p.modo === 'toque') {
    const n = p.n || 1;
    if (J.toques >= n) return;
    if (J.u < J.alvo - .02 && n > 1) return; // deixa a animação do corte anterior terminar
    J.toques++;
    J.alvo = J.toques >= n ? (p.marco ? 1 : 1) : (J.toques / n) * (p.marco || 1);
    if (p.marco && J.toques >= n) J.alvo = p.marco + .0001;
    p.aoAcao?.(J.toques);
    navigator.vibrate?.(6);
  } else {
    J.seg = true;
    if (p.loop && !J.tragoCheio) loop(p.loop, true);
  }
}

function solta() {
  if (!J.seg) return;
  J.seg = false;
  if (J.modo !== 'jogo') return;
  const p = passo();
  if (p.loop) loop(p.loop, false);
  if (p.tragos && J.tempoSeg > .25) { sopra(clamp(J.tempoSeg / 2.4)); }
  J.tempoSeg = 0; J.tragoCheio = false; J.tempoSolto = 0;
}

function apertouTela(e) {
  if (J.modo === 'chapado') {
    const x = (e.clientX * DPR - W / 2) / escala, y = (e.clientY * DPR - H / 2) / escala + J.cam;
    chapado.toque(x, y);
    return;
  }
  aperta();
}
tela.addEventListener('pointerdown', e => { e.preventDefault(); apertouTela(e); });
addEventListener('pointerup', solta);
addEventListener('pointercancel', solta);
addEventListener('blur', solta);
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  if (document.activeElement?.tagName === 'BUTTON' && e.code === 'Enter') return;
  e.preventDefault();
  if (e.repeat) return;
  if (J.modo === 'abertura') { comeca(); return; }
  if (J.modo === 'chapado') { chapado.toque((Math.random() - .5) * 500, (Math.random() - .5) * 600 + 40); return; }
  aperta();
});
addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') solta(); });

function comeca() {
  if (J.modo !== 'abertura') return;
  iniciarSom();
  $('inicio').classList.add('saiu');
  J.modo = 'jogo';
  entra(0);
}
$('comecar').addEventListener('click', comeca);
$('btnSom').addEventListener('click', e => {
  const on = alternarSom();
  e.currentTarget.setAttribute('aria-pressed', on);
  e.currentTarget.setAttribute('aria-label', on ? 'Desligar o som' : 'Ligar o som');
  e.currentTarget.blur();
});
$('btnFaixa').addEventListener('click', e => { proximaFaixa(); e.currentTarget.blur(); });
let tempoFaixa = 0;
quandoTrocarFaixa(nome => {
  const el = $('faixa');
  el.textContent = nome;
  el.classList.toggle('visivel', !!nome);
  clearTimeout(tempoFaixa);
  tempoFaixa = setTimeout(() => el.classList.remove('visivel'), 6000);
});
$('btnAuto').addEventListener('click', e => {
  J.auto = !J.auto;
  e.currentTarget.setAttribute('aria-pressed', J.auto);
  e.currentTarget.blur();
});

// ---------- Modo sozinho ----------
function tiqueAuto(dt) {
  if (!J.auto || J.modo !== 'jogo') return;
  const p = passo();
  if (J.u < 0) return;
  J.autoT += dt;
  if (p.modo === 'toque') {
    if (J.autoT > 1.3 && J.toques < (p.n || 1) && J.u >= J.alvo - .001) { J.autoT = 0; aperta(); }
  } else if (p.tragos) {
    if (!J.seg && J.autoT > 2.8) { J.autoT = 0; aperta(); }
    else if (J.seg && J.tragoCheio && J.autoT > .4) { J.autoT = 0; solta(); }
  } else if (!J.seg && J.autoT > .9) aperta();
}

// ---------- Laço ----------
function atualiza(dt) {
  J.t += dt; G.t = J.t;
  boilT += dt;
  G.boil = Math.floor(boilT * 7);
  tiqueSom(dt);
  atualizaEfeitos(dt);
  tiqueAuto(dt);

  if (J.modo === 'chapado') {
    chapado.atualiza(dt);
    J.flood += dt;
    if (J.flood > DURACAO) { J.fimFade += dt; if (J.fimFade > 6) terminaChapado(); }
    return;
  }
  if (J.modo !== 'jogo') return;

  const p = passo();
  C.segura = lerp(C.segura, J.seg ? 1 : 0, 1 - Math.exp(-dt * 8));
  C.puxa = lerp(C.puxa, (p.tragos && J.seg && !J.tragoCheio) ? 1 : 0, 1 - Math.exp(-dt * (J.seg ? 2.4 : 1.6)));
  J.cam = lerp(J.cam, p.cam, 1 - Math.exp(-dt * 1.4));

  if (J.u < 0) {
    J.u = Math.min(0, J.u + dt / (p.pre || .001));
    if (J.u >= -.25) { mostraComando(); elCmd.classList.add('ativo'); }
  } else if (p.modo === 'toque') {
    if (J.alvo > J.u) J.u = Math.min(J.alvo, J.u + dt / p.dur);
    const n = p.n || 1;
    if (J.toques >= n && p.marco && J.u >= p.marco) J.alvo = 1;
    if (J.toques >= n) elCmd.classList.remove('ativo');
    if (J.u >= 1) proximo();
  } else {
    if (J.seg) {
      J.tempoSeg += dt;
      if (p.tragos && J.tempoSeg > 2.4) {
        if (!J.tragoCheio) { J.tragoCheio = true; loop(p.loop, false); elDica.textContent = 'solte'; J.autoT = 0; }
      } else {
        J.u = Math.min(1, J.u + dt / p.dur);
      }
      if (p.tragos && !J.tragoCheio && elDica.textContent !== 'segure') elDica.textContent = 'segure';
    } else if (p.tragos) elDica.textContent = 'segure';
    p.tique?.(dt, J.u, J.seg);
    if (J.u >= 1) {
      if (p.tragos && J.seg) { const v = clamp(J.tempoSeg / 2.4); J.seg = false; sopra(v); }
      elCmd.classList.remove('ativo');
      proximo();
    }
    elAnel.style.strokeDasharray = `${clamp(J.u) * 100} 100`;
  }
  if (p.modo === 'toque') elAnel.style.strokeDasharray = '0 100';
}

function camera(c = ctx, s = escala, w = W, h = H) {
  c.setTransform(s, 0, 0, s, w / 2, h / 2 - J.cam * s);
}

function desenha() {
  G.ctx = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  camera();

  if (J.modo === 'abertura') {
    flor(0, -210 + Math.sin(J.t * .8) * 6, Math.sin(J.t * .5) * .05, 1.5, 1);
    return;
  }
  if (J.modo === 'jogo') {
    passo().draw(J.u);
    return;
  }
  // Fase colorida: círculo de cor se abre a partir das mãos
  const fim = J.flood > DURACAO ? clamp(J.fimFade / 6) : 0;
  chapado.pinta(escala, J.cam);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const R = Math.hypot(W, H) * suave(J.flood / 5);
  ctx.save();
  ctx.beginPath();
  const cx = W / 2, cy = H / 2 + (200 - J.cam) * escala * .5;
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 1 - fim;
  ctx.drawImage(chapado.tela, 0, 0, W, H);
  ctx.restore();
  ctx.globalAlpha = 1;
  camera();
  chapado.maos(chapado.t, suave(fim * 1.2), 1);
  G.cor = '#f4f4f0'; G.fundo = '#000'; G.amp = 1; G.derrete = 0;
}

let ult = 0;
function quadro(ms) {
  const dt = Math.min(.05, (ms - ult) / 1000 || 0);
  ult = ms;
  atualiza(dt);
  desenha();
  requestAnimationFrame(quadro);
}

// ---------- Partida ----------
redimensiona();
J.sessao = leNum('brisa.sessoes');
novaSessao(J.sessao);
atualizaContagem();
requestAnimationFrame(quadro);

// Gancho de teste: pular etapas e avançar o tempo sem depender da tela.
if (location.hostname === 'localhost') {
  window.__brisa = {
    J, C, PASSOS,
    ir(i, u = 0) { if (J.modo === 'abertura') comeca(); J.modo = 'jogo'; entra(i); J.u = u; J.alvo = Math.max(0, u); J.cam = PASSOS[i].cam; desenha(); },
    avancar(seg) { for (let i = 0; i < seg * 30; i++) atualiza(1 / 30); desenha(); },
    chapar(visao, seg = 8) { if (J.modo === 'abertura') comeca(); C.M.visao = visao || C.M.visao; comecaChapado(); this.avancar(seg); },
    aperta, solta,
  };
}
