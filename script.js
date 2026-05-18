/**
 * =====================================================
 * SIMULADOR DE TIRO PARABÓLICO ACME — script.js
 * Física, Canvas, Animaciones, Personajes, Lógica
 * =====================================================
 */

// ──────────────────────────────────────────────────
// CONFIGURACIÓN GLOBAL
// ──────────────────────────────────────────────────
const CONFIG = {
  gravity: 9.8,
  scale: 4.5,            // píxeles por metro
  groundFraction: 0.80,  // fracción del canvas que es suelo
  fps: 60,
  rocketLength: 26,
  rocketWidth: 12,
  trailLength: 70,
  targetX: 0.82,
  targetTolerance: 58,
};

// ──────────────────────────────────────────────────
// ESTADO GLOBAL
// ──────────────────────────────────────────────────
const STATE = {
  screen: 'intro',
  darkMode: false,
  projectileType: 'parabolico',
  velocity: 60,
  angle: 45,
  height: 0,
  gravity: 9.8,
  isFlying: false,
  tries: 0,
  score: 0,

  rocketX: 0, rocketY: 0, rocketVx: 0, rocketVy: 0,
  flightTime: 0,
  trail: [],
  explosionParticles: [],
  dustParticles: [],
  maxHeightReached: 0,
  distanceReached: 0,

  clouds: [],
  animFrame: null,
};

// ──────────────────────────────────────────────────
// REFERENCIAS DOM
// ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  modalWelcome: $('modal-welcome'),
  btnEnter:     $('btn-enter'),
  canvasModal:  $('canvas-modal'),
  screenIntro:  $('screen-intro'),
  screenSim:    $('screen-sim'),
  btnStart:     $('btn-start'),
  btnLaunch:    $('btn-launch'),
  btnDark:      $('btn-dark-mode'),
  btnTheory:    $('btn-theory'),
  btnHome:      $('btn-home'),
  btnResetSim:  $('btn-reset-sim'),
  btnParabolico:$('btn-parabolico'),
  btnSemi:      $('btn-semi'),
  groupAngle:   $('group-angle'),

  sliderVel:    $('slider-vel'),   inputVel:    $('input-vel'),
  sliderAngle:  $('slider-angle'), inputAngle:  $('input-angle'),
  sliderHeight: $('slider-height'),inputHeight: $('input-height'),
  sliderGravity:$('slider-gravity'),inputGravity:$('input-gravity'),

  statDist:  $('stat-dist'),
  statAlt:   $('stat-alt'),
  statTime:  $('stat-time'),
  statTries: $('stat-tries'),

  predTime:  $('pred-time'),
  predRange: $('pred-range'),
  predHmax:  $('pred-hmax'),

  msgOverlay: $('msg-overlay'),
  msgIcon:    $('msg-icon'),
  msgText:    $('msg-text'),
  msgStats:   $('msg-stats'),
  msgButtons: $('msg-buttons'),

  canvasMain:  $('canvas-main'),
  canvasIntro: $('canvas-intro'),
  canvasAngle: $('canvas-angle'),
  canvasGraph: $('canvas-graph'),
  tooltip:     $('tooltip'),
};

// ──────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────
window.addEventListener('load', () => {
  initIntroCanvas();
  setupEventListeners();
  updatePredictions();
  updateAngleIndicator();
  generateClouds();
  animateIntroScene();
  animateModalCanvas();   // ← canvas decorativo del modal
});

window.addEventListener('resize', () => {
  if (STATE.screen === 'sim') resizeMainCanvas();
  _stars = null;
});

// ──────────────────────────────────────────────────
// MODAL DE BIENVENIDA
// ──────────────────────────────────────────────────

/**
 * Canvas decorativo pequeño dentro del modal.
 * Muestra escena desierto compacta con coyote + ave + cohete animado.
 */
let _modalClouds = [];
let _modalRocketX = 0;
let _modalRocketPhase = 0; // 0=idle, 1=flying
let _modalRX = 0, _modalRY = 0, _modalRVx = 0, _modalRVy = 0;
let _modalTrail = [];

function animateModalCanvas() {
  const canvas = DOM.canvasModal;
  if (!canvas) return;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');

  // Generar nubes del modal
  if (_modalClouds.length === 0) {
    for (let i = 0; i < 4; i++) {
      _modalClouds.push({
        x: Math.random() * W, y: 8 + Math.random() * 25,
        w: 60 + Math.random() * 80, h: 28 + Math.random() * 18,
        speed: 0.15 + Math.random() * 0.25,
      });
    }
  }

  // Lanzar cohete cada ~3 segundos
  const now = Date.now();
  if (!_modalLastLaunch) _modalLastLaunch = now;
  if (now - _modalLastLaunch > 3200 && _modalRocketPhase === 0) {
    _modalRocketPhase = 1;
    _modalLastLaunch  = now;
    const angle = 38 * Math.PI / 180;
    const speed = 90;
    _modalRX  = W * 0.1;
    _modalRY  = H * 0.75;
    _modalRVx = Math.cos(angle) * speed;
    _modalRVy = Math.sin(angle) * speed;
    _modalTrail = [];
  }

  const dt = 1 / 60;
  ctx.clearRect(0, 0, W, H);

  // Cielo
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
  sky.addColorStop(0, '#1a78d8'); sky.addColorStop(1, '#7ecef4');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.72);

  // Suelo
  const grd = ctx.createLinearGradient(0, H * 0.72, 0, H);
  grd.addColorStop(0, '#f0a830'); grd.addColorStop(1, '#c87820');
  ctx.fillStyle = grd; ctx.fillRect(0, H * 0.72, W, H);

  // Línea del suelo
  ctx.strokeStyle = '#d08020'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H * 0.72); ctx.lineTo(W, H * 0.72); ctx.stroke();

  // Sol pequeño
  drawSun(ctx, W * 0.88, H * 0.14, 14);

  // Nubes
  _modalClouds.forEach(c => {
    c.x -= c.speed;
    if (c.x + c.w < 0) c.x = W + c.w;
    drawCloud(ctx, c.x, c.y, c.w, c.h, 0.8);
  });

  // Montañas mini
  ctx.fillStyle = '#9060a8';
  ctx.beginPath(); ctx.moveTo(0, H * 0.72);
  [[0,.3],[.1,.1],[.22,.2],[.35,.05],[.5,.18],[.65,.08],[.8,.2],[1,.1],[1,1]]
    .forEach(([fx,fy]) => ctx.lineTo(fx*W, H*0.72 - fy*H*0.55));
  ctx.closePath(); ctx.fill();

  // Cactus pequeños
  drawCactus(ctx, W * 0.12, H * 0.72, 12);
  drawCactus(ctx, W * 0.45, H * 0.72, 9);
  drawCactus(ctx, W * 0.68, H * 0.72, 14);

  // Personajes pequeños
  const sc = H / 400;
  drawCoyote(ctx, W * 0.06, H * 0.72, sc * 0.62);
  drawRoadrunner(ctx, W * 0.84, H * 0.72, sc * 0.55);

  // Cohete animado
  if (_modalRocketPhase === 1) {
    _modalRVy -= 9.8 * 4.5 * dt;
    _modalRX  += _modalRVx * dt;
    _modalRY  -= _modalRVy * dt;
    _modalTrail.push({ x: _modalRX, y: _modalRY });
    if (_modalTrail.length > 30) _modalTrail.shift();

    // Trail
    for (let i = 1; i < _modalTrail.length; i++) {
      const a = i / _modalTrail.length;
      ctx.strokeStyle = `rgba(245,197,24,${a * 0.7})`;
      ctx.lineWidth = a * 2.5;
      ctx.beginPath();
      ctx.moveTo(_modalTrail[i-1].x, _modalTrail[i-1].y);
      ctx.lineTo(_modalTrail[i].x,   _modalTrail[i].y);
      ctx.stroke();
    }
    drawRocket(ctx, _modalRX, _modalRY, _modalRVx, -_modalRVy);

    if (_modalRY > H * 0.78 || _modalRX > W + 20) {
      _modalRocketPhase = 0;
      _modalTrail = [];
    }
  }

  requestAnimationFrame(animateModalCanvas);
}
let _modalLastLaunch = 0;

// ──────────────────────────────────────────────────
// NUBES
// ──────────────────────────────────────────────────
function generateClouds() {
  STATE.clouds = [];
  for (let i = 0; i < 7; i++) {
    STATE.clouds.push({
      x: Math.random() * 900,
      y: 18 + Math.random() * 70,
      w: 90 + Math.random() * 130,
      h: 42 + Math.random() * 38,
      speed: 0.18 + Math.random() * 0.38,
    });
  }
}

// ──────────────────────────────────────────────────
// CANVAS INTRO — escena decorativa
// ──────────────────────────────────────────────────
function initIntroCanvas() {
  DOM.canvasIntro.width = 900;
  DOM.canvasIntro.height = 220;
}

function animateIntroScene() {
  if (!DOM.canvasIntro) return;
  const ctx = DOM.canvasIntro.getContext('2d');
  drawIntroScene(ctx, DOM.canvasIntro.width, DOM.canvasIntro.height);
  requestAnimationFrame(animateIntroScene);
}

function drawIntroScene(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const gY = H * 0.64;

  // Cielo
  const sky = ctx.createLinearGradient(0, 0, 0, gY);
  sky.addColorStop(0, '#1a78d8');
  sky.addColorStop(1, '#7ecef4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, gY);

  // Sol cartoon
  drawSun(ctx, W * 0.87, H * 0.16, 28);

  // Nubes
  STATE.clouds.forEach(c => {
    c.x -= c.speed;
    if (c.x + c.w < 0) c.x = W + c.w;
    drawCloud(ctx, c.x, c.y, c.w, c.h, 0.88);
  });

  // Suelo arenoso
  const grd = ctx.createLinearGradient(0, gY, 0, H);
  grd.addColorStop(0, '#f0a830');
  grd.addColorStop(1, '#c87820');
  ctx.fillStyle = grd;
  ctx.fillRect(0, gY, W, H);

  // Montañas tipo mesa (buttes)
  drawDesertMesas(ctx, W, gY);

  // Cactus decorativos
  drawCactus(ctx, W * 0.13, gY, 38);
  drawCactus(ctx, W * 0.31, gY, 28);
  drawCactus(ctx, W * 0.57, gY, 44);
  drawCactus(ctx, W * 0.76, gY, 22);

  // Personajes
  drawCoyote(ctx, W * 0.07, gY, 0.58);
  drawRoadrunner(ctx, W * 0.88, gY, 0.58);

  // Polvo ambiental
  const t = Date.now() * 0.001;
  drawAmbientDust(ctx, W, H, t);
}

// ──────────────────────────────────────────────────
// ELEMENTOS VISUALES
// ──────────────────────────────────────────────────

function drawSun(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  // Rayos
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 3.5;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
    ctx.lineTo(Math.cos(a) * (r + 17), Math.sin(a) * (r + 17));
    ctx.stroke();
  }
  // Disco
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe040';
  ctx.fill();
  ctx.strokeStyle = '#e6a800';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Cara divertida
  ctx.fillStyle = '#c8800a';
  // Ojos
  ctx.beginPath(); ctx.arc(-8, -5, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -5, 3.5, 0, Math.PI * 2); ctx.fill();
  // Sonrisa grande
  ctx.strokeStyle = '#c8800a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 2, 11, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawCloud(ctx, x, y, w, h, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  // Nubes con contorno suave tipo cartoon
  const cx = x + w * 0.5, cy = y + h * 0.55;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.46, h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  const offsets = [-0.34, -0.1, 0.15, 0.34];
  offsets.forEach((o, i) => {
    ctx.beginPath();
    ctx.arc(cx + o * w, cy - h * 0.05, h * (i % 2 === 0 ? 0.34 : 0.28), 0, Math.PI * 2);
    ctx.fill();
  });
  // Contorno negro fino cartoon
  ctx.globalAlpha = alpha * 0.25;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.46, h * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Mesas / buttes estilo desierto americano */
function drawDesertMesas(ctx, W, groundY) {
  // Capa lejana — montañas moradas
  ctx.fillStyle = '#8060a0';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  const far = [
    [0,.22],[.05,.08],[.12,.18],[.19,.02],[.27,.14],[.35,.06],
    [.44,.16],[.52,.0],[.61,.12],[.7,.05],[.8,.15],[.9,.08],[1,.18],[1,1]
  ];
  far.forEach(([fx,fy]) => ctx.lineTo(fx*W, groundY - fy*groundY*0.62));
  ctx.closePath();
  ctx.fill();

  // Capa media — mesas rojas (buttes)
  const mesa = ctx.createLinearGradient(0, groundY*0.5, 0, groundY);
  mesa.addColorStop(0, '#c05028');
  mesa.addColorStop(1, '#8c3518');
  ctx.fillStyle = mesa;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  // Forma de mesa plana izquierda
  ctx.lineTo(0, groundY * 0.6);
  ctx.lineTo(W * 0.08, groundY * 0.45);
  ctx.lineTo(W * 0.18, groundY * 0.45);
  ctx.lineTo(W * 0.23, groundY * 0.6);
  // Espacio
  ctx.lineTo(W * 0.38, groundY * 0.7);
  // Mesa central
  ctx.lineTo(W * 0.44, groundY * 0.5);
  ctx.lineTo(W * 0.56, groundY * 0.5);
  ctx.lineTo(W * 0.62, groundY * 0.65);
  // Derecha
  ctx.lineTo(W * 0.75, groundY * 0.72);
  ctx.lineTo(W * 0.82, groundY * 0.52);
  ctx.lineTo(W * 0.94, groundY * 0.52);
  ctx.lineTo(W, groundY * 0.62);
  ctx.lineTo(W, groundY);
  ctx.closePath();
  ctx.fill();
  // Contorno cartoon mesas
  ctx.strokeStyle = '#6a2010';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCactus(ctx, x, groundY, h) {
  ctx.save();
  ctx.translate(x, groundY);
  const w = h * 0.24;
  // Tronco
  ctx.fillStyle = '#3da829';
  ctx.strokeStyle = '#1e6e10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w*.5, -h, w, h, [w*.5, w*.5, 0, 0]);
  ctx.fill(); ctx.stroke();
  // Brazo izquierdo
  const aw = w * .72, ah = h * .44;
  ctx.beginPath();
  ctx.roundRect(-w*1.7, -h*.68, aw, ah, [aw*.5, aw*.5, 0, 0]);
  ctx.fill(); ctx.stroke();
  // Brazo derecho
  ctx.beginPath();
  ctx.roundRect(w*.58, -h*.52, aw, ah*.8, [aw*.5, aw*.5, 0, 0]);
  ctx.fill(); ctx.stroke();
  // Espinas
  ctx.strokeStyle = '#a8e040';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const sy = -h*.18 - i*h*.14;
    ctx.beginPath(); ctx.moveTo(-w*.5, sy); ctx.lineTo(-w*.5-6, sy-5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( w*.5, sy); ctx.lineTo( w*.5+6, sy-5); ctx.stroke();
  }
  ctx.restore();
}

/**
 * COYOTE — estilo cartoon clásico mejorado
 * Cuerpo delgado, orejas largas puntiagudas, ojos grandes expresivos,
 * hocico alargado, sombrero de inventor, lentes redondos
 */
function drawCoyote(ctx, x, groundY, scale = 1) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);

  const s = 60;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(2, 0, s*.52, s*.08, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Cola esponjosa ──
  ctx.strokeStyle = '#b87830';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s*.22, -s*.38);
  ctx.quadraticCurveTo(-s*.62, -s*.48, -s*.58, -s*.82);
  ctx.stroke();
  // Punta blanca cola
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-s*.54, -s*.72);
  ctx.lineTo(-s*.58, -s*.84);
  ctx.stroke();

  // ── Patas ──
  ctx.fillStyle = '#b87830';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 1.8;
  // Pata izquierda
  ctx.beginPath();
  ctx.roundRect(-s*.22, -s*.28, s*.14, s*.32, 4);
  ctx.fill(); ctx.stroke();
  // Pie izquierdo (grande, cartoon)
  ctx.beginPath();
  ctx.ellipse(-s*.15, s*.04, s*.12, s*.055, 0, 0, Math.PI*2);
  ctx.fillStyle = '#906028'; ctx.fill(); ctx.stroke();
  // Pata derecha
  ctx.fillStyle = '#b87830';
  ctx.beginPath();
  ctx.roundRect(s*.08, -s*.28, s*.14, s*.32, 4);
  ctx.fill(); ctx.stroke();
  // Pie derecho
  ctx.beginPath();
  ctx.ellipse(s*.15, s*.04, s*.12, s*.055, 0, 0, Math.PI*2);
  ctx.fillStyle = '#906028'; ctx.fill(); ctx.stroke();

  // ── Cuerpo ──
  ctx.fillStyle = '#c88838';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, -s*.58, s*.26, s*.38, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Panza más clara
  ctx.fillStyle = '#e8b870';
  ctx.beginPath();
  ctx.ellipse(s*.04, -s*.55, s*.14, s*.22, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Brazos ──
  ctx.strokeStyle = '#b87830';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  // Brazo izquierdo (sosteniendo algo)
  ctx.beginPath();
  ctx.moveTo(-s*.26, -s*.72);
  ctx.quadraticCurveTo(-s*.56, -s*.88, -s*.52, -s*.66);
  ctx.stroke();
  // Mano izquierda
  ctx.fillStyle = '#c88838';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-s*.52, -s*.66, s*.06, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Brazo derecho (levantado hacia arriba, pose de inventor)
  ctx.strokeStyle = '#b87830';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(s*.26, -s*.72);
  ctx.quadraticCurveTo(s*.56, -s*.95, s*.5, -s*.72);
  ctx.stroke();
  // Mano derecha con destornillador
  ctx.fillStyle = '#c88838';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(s*.5, -s*.72, s*.06, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(s*.5, -s*.78);
  ctx.lineTo(s*.52, -s*.98);
  ctx.stroke();
  ctx.fillStyle = '#f5c518';
  ctx.beginPath();
  ctx.arc(s*.52, -s*.98, 4, 0, Math.PI*2);
  ctx.fill();

  // ── Cuello ──
  ctx.fillStyle = '#c88838';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-s*.1, -s*.96, s*.2, s*.18, 5);
  ctx.fill(); ctx.stroke();

  // ── Cabeza grande cartoon ──
  ctx.fillStyle = '#d09040';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(s*.02, -s*1.14, s*.34, s*.32, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // ── Orejas MUY largas puntiagudas (estilo clásico) ──
  // Oreja izquierda
  ctx.fillStyle = '#c88838';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s*.26, -s*1.3);
  ctx.lineTo(-s*.38, -s*1.8);
  ctx.lineTo(-s*.12, -s*1.32);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Interior oreja izquierda
  ctx.fillStyle = '#e07878';
  ctx.beginPath();
  ctx.moveTo(-s*.25, -s*1.35);
  ctx.lineTo(-s*.35, -s*1.72);
  ctx.lineTo(-s*.14, -s*1.37);
  ctx.closePath();
  ctx.fill();
  // Oreja derecha
  ctx.fillStyle = '#c88838';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s*.18, -s*1.3);
  ctx.lineTo(s*.3, -s*1.82);
  ctx.lineTo(s*.36, -s*1.32);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Interior
  ctx.fillStyle = '#e07878';
  ctx.beginPath();
  ctx.moveTo(s*.2, -s*1.35);
  ctx.lineTo(s*.29, -s*1.75);
  ctx.lineTo(s*.34, -s*1.37);
  ctx.closePath();
  ctx.fill();

  // ── Hocico alargado ──
  ctx.fillStyle = '#e8b060';
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(s*.1, -s*1.02, s*.18, s*.13, 0.12, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Nariz grande negra
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(s*.18, -s*1.06, s*.055, s*.04, 0, 0, Math.PI*2);
  ctx.fill();
  // Destello en nariz
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  ctx.arc(s*.17, -s*1.08, 2, 0, Math.PI*2);
  ctx.fill();
  // Boca expresiva
  ctx.strokeStyle = '#704010';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s*.06, -s*.97);
  ctx.quadraticCurveTo(s*.12, -s*.93, s*.2, -s*.96);
  ctx.stroke();

  // ── Ojos GRANDES cartoon con lentes ──
  // Ojo izquierdo — fondo blanco
  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-s*.12, -s*1.18, s*.1, s*.1, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Lente izquierdo (círculo azul)
  ctx.strokeStyle = '#2266dd';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(-s*.12, -s*1.18, s*.1, s*.1, 0, 0, Math.PI*2);
  ctx.stroke();
  // Pupila izquierda
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-s*.12, -s*1.18, s*.055, 0, Math.PI*2);
  ctx.fill();
  // Brillo ojo izquierdo
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-s*.1, -s*1.2, s*.022, 0, Math.PI*2);
  ctx.fill();

  // Ojo derecho — fondo blanco
  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(s*.18, -s*1.2, s*.1, s*.1, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2266dd';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(s*.18, -s*1.2, s*.1, s*.1, 0, 0, Math.PI*2);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(s*.18, -s*1.2, s*.055, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s*.2, -s*1.22, s*.022, 0, Math.PI*2);
  ctx.fill();

  // Patilla lentes (armazón)
  ctx.strokeStyle = '#2266dd';
  ctx.lineWidth = 2;
  // Puente entre lentes
  ctx.beginPath();
  ctx.moveTo(-s*.02, -s*1.18);
  ctx.lineTo(s*.08, -s*1.19);
  ctx.stroke();
  // Patilla izquierda
  ctx.beginPath();
  ctx.moveTo(-s*.22, -s*1.18);
  ctx.lineTo(-s*.3, -s*1.15);
  ctx.stroke();
  // Patilla derecha
  ctx.beginPath();
  ctx.moveTo(s*.28, -s*1.2);
  ctx.lineTo(s*.36, -s*1.17);
  ctx.stroke();

  // ── Sombrero de inventor alto ──
  ctx.fillStyle = '#1a1a2e';
  ctx.strokeStyle = '#0a0a18';
  ctx.lineWidth = 2;
  // Ala del sombrero
  ctx.beginPath();
  ctx.ellipse(s*.04, -s*1.4, s*.46, s*.09, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Copa alta
  ctx.beginPath();
  ctx.roundRect(-s*.24, -s*1.82, s*.46, s*.42, [s*.04, s*.04, 0, 0]);
  ctx.fill(); ctx.stroke();
  // Banda amarilla del sombrero
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(-s*.24, -s*1.47, s*.46, s*.07);
  // Texto ACME en sombrero
  ctx.fillStyle = '#e8341c';
  ctx.font = `bold ${s*.08}px Georgia`;
  ctx.textAlign = 'center';
  ctx.fillText('ACME', s*.04, -s*1.55);
  // Engranaje decorativo
  ctx.fillStyle = '#ccc';
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1.5;
  const gx = s*.18, gy = -s*1.72, gr = s*.055;
  ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const ga = (i/8)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(gx+Math.cos(ga)*gr, gy+Math.sin(ga)*gr);
    ctx.lineTo(gx+Math.cos(ga)*(gr+s*.03), gy+Math.sin(ga)*(gr+s*.03));
    ctx.stroke();
  }
  // Bombilla en mano (inventando)
  ctx.fillStyle = '#ffe040';
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-s*.52, -s*.72, s*.06, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const ba = (i/6)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(-s*.52+Math.cos(ba)*s*.06, -s*.72+Math.sin(ba)*s*.06);
    ctx.lineTo(-s*.52+Math.cos(ba)*s*.1, -s*.72+Math.sin(ba)*s*.1);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * CORREDOR DEL DESIERTO — estilo cartoon clásico mejorado
 * Patas larguísimas, cuello largo, pico exagerado, plumas de colores,
 * líneas de velocidad, expresión de arrogancia (ojos entrecerrados)
 */
function drawRoadrunner(ctx, x, groundY, scale = 1) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);

  const s = 56;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s*.42, s*.07, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Patas larguísimas (estilo clásico) ──
  ctx.strokeStyle = '#5c4000';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  // Pata izquierda — pose corriendo
  ctx.beginPath();
  ctx.moveTo(-s*.06, -s*.3);
  ctx.lineTo(-s*.1, -s*.08);
  ctx.lineTo(-s*.02, s*.06);
  ctx.stroke();
  // Pata derecha — levantada
  ctx.beginPath();
  ctx.moveTo(s*.1, -s*.3);
  ctx.lineTo(s*.16, -s*.1);
  ctx.lineTo(s*.22, s*.04);
  ctx.stroke();
  // Dedos (2 adelante, 1 atrás — zygodáctilo)
  ctx.lineWidth = 2.5;
  // Pie izq
  ctx.beginPath(); ctx.moveTo(-s*.02, s*.06); ctx.lineTo(s*.1, s*.0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s*.02, s*.06); ctx.lineTo(-s*.12, s*.0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s*.02, s*.06); ctx.lineTo(-s*.04, s*.12); ctx.stroke();
  // Pie der
  ctx.beginPath(); ctx.moveTo(s*.22, s*.04); ctx.lineTo(s*.34, -s*.02); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s*.22, s*.04); ctx.lineTo(s*.16, s*.11); ctx.stroke();

  // ── Cola larga horizontal (característica del corredor) ──
  ctx.fillStyle = '#4a3e28';
  ctx.strokeStyle = '#2e2818';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-s*.32, -s*.5);
  ctx.lineTo(-s*.9, -s*.42);
  ctx.lineTo(-s*.88, -s*.32);
  ctx.lineTo(-s*.7, -s*.28);
  ctx.lineTo(-s*.32, -s*.38);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Rayas decorativas en cola
  ctx.strokeStyle = '#c8b070';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-s*(.4+i*.12), -s*.48);
    ctx.lineTo(-s*(.55+i*.12), -s*.32);
    ctx.stroke();
  }
  // Plumas cola
  ctx.fillStyle = '#2a5c18';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-s*(.75+i*.04), -s*.42);
    ctx.lineTo(-s*(.9+i*.04), -s*.5);
    ctx.lineTo(-s*(.85+i*.04), -s*.35);
    ctx.closePath();
    ctx.fill();
  }

  // ── Cuerpo ──
  ctx.fillStyle = '#786040';
  ctx.strokeStyle = '#3e2e10';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(-s*.05, -s*.5, s*.3, s*.22, -0.18, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Manchas en el cuerpo
  ctx.fillStyle = '#5c4830';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(
      -s*(.18 - i*.09), -s*(.48 + (i%2)*.04),
      s*.04, s*.025, 0, 0, Math.PI*2
    );
    ctx.fill();
  }

  // ── Cuello largo ──
  ctx.fillStyle = '#8a7050';
  ctx.strokeStyle = '#3e2e10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s*.08, -s*.62);
  ctx.quadraticCurveTo(s*.2, -s*.88, s*.16, -s*1.0);
  ctx.quadraticCurveTo(s*.32, -s*.94, s*.32, -s*.7);
  ctx.quadraticCurveTo(s*.3, -s*.6, s*.08, -s*.54);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // ── Cabeza ──
  ctx.fillStyle = '#786040';
  ctx.strokeStyle = '#3e2e10';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(s*.22, -s*1.06, s*.2, s*.16, -0.08, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // ── Penacho largo hacia atrás (muy característico) ──
  ctx.fillStyle = '#2a5c18';
  ctx.strokeStyle = '#1a3c0a';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const px = s*(.08 + i*.06), py = -s*1.18;
    const ex = s*(-.04 + i*.05) - i*3, ey = -s*(1.28 + i*.055);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, 3+i*.5, 0, Math.PI*2);
    ctx.fillStyle = i%2===0 ? '#2a8c28' : '#c8b000';
    ctx.fill();
  }

  // ── Pico largo y plano ──
  ctx.fillStyle = '#d4a020';
  ctx.strokeStyle = '#7a5810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s*.38, -s*1.04);
  ctx.lineTo(s*.82, -s*1.01);
  ctx.lineTo(s*.82, -s*.97);
  ctx.lineTo(s*.38, -s*.96);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Línea en el pico
  ctx.strokeStyle = '#7a5810';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s*.4, -s*1.0);
  ctx.lineTo(s*.8, -s*1.0);
  ctx.stroke();
  // Lengua
  ctx.fillStyle = '#e04040';
  ctx.beginPath();
  ctx.ellipse(s*.7, -s*.95, s*.04, s*.02, 0.2, 0, Math.PI*2);
  ctx.fill();

  // ── Ojo grande expresivo (entrecerrado, arrogante) ──
  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(s*.32, -s*1.1, s*.075, s*.065, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Iris naranja-rojo característico
  ctx.fillStyle = '#ff5500';
  ctx.beginPath();
  ctx.arc(s*.32, -s*1.1, s*.045, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#ff8800';
  ctx.beginPath();
  ctx.arc(s*.32, -s*1.1, s*.025, 0, Math.PI*2);
  ctx.fill();
  // Pupila
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(s*.32, -s*1.1, s*.018, 0, Math.PI*2);
  ctx.fill();
  // Brillo
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s*.33, -s*1.115, s*.008, 0, Math.PI*2);
  ctx.fill();
  // Párpado entrecerrado (media luna superior)
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(s*.32, -s*1.1, s*.075, Math.PI*1.18, Math.PI*1.82, false);
  ctx.stroke();

  // ── Mancha en ojo (parche azul-violeta) ──
  ctx.fillStyle = 'rgba(60,80,200,.45)';
  ctx.beginPath();
  ctx.ellipse(s*.32, -s*1.1, s*.11, s*.09, 0, 0, Math.PI*2);
  ctx.fill();

  // ── Líneas de velocidad ──
  ctx.strokeStyle = 'rgba(255,200,0,.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-s*(.25+i*.1), -s*(.32+i*.06));
    ctx.lineTo(-s*(.55+i*.1), -s*(.32+i*.06));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // "BEEP BEEP" texto cartoon sobre el ave
  ctx.fillStyle = '#f5c518';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  ctx.font = `bold ${s*.14}px Georgia`;
  ctx.textAlign = 'center';
  ctx.strokeText('¡BEEP!', s*.1, -s*1.42);
  ctx.fillText('¡BEEP!', s*.1, -s*1.42);

  ctx.restore();
}

function drawAmbientDust(ctx, W, H, t) {
  for (let i = 0; i < 10; i++) {
    const px = (Math.sin(t*.3 + i*1.7)*.5 + .5) * W;
    const py = H*.75 + Math.sin(t*.5 + i*2.1)*8;
    const r = 4 + Math.sin(t+i)*2;
    ctx.fillStyle = `rgba(200,140,60,${.12 + .1*Math.sin(t+i)})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI*2);
    ctx.fill();
  }
}

// ──────────────────────────────────────────────────
// CANVAS PRINCIPAL — SIMULACIÓN
// ──────────────────────────────────────────────────
function resizeMainCanvas() {
  const canvas = DOM.canvasMain;
  const wrapper = canvas.parentElement;
  canvas.width  = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  _stars = null;
}

// ──────────────────────────────────────────────────
// FÍSICA
// ──────────────────────────────────────────────────
function calculateTrajectory(v0, angleDeg, h0, gravity, type) {
  const points = [];
  const angle  = (type === 'semi') ? 0 : angleDeg * Math.PI / 180;
  const vx = v0 * Math.cos(angle);
  const vy = v0 * Math.sin(angle);
  const disc = vy*vy + 2*gravity*h0;
  const totalTime = (vy + Math.sqrt(Math.max(0, disc))) / gravity;
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = (totalTime * i) / steps;
    const x = vx * t;
    const y = h0 + vy*t - .5*gravity*t*t;
    if (y < 0) break;
    points.push({ x, y, t });
  }
  return { points, totalTime, range: vx * totalTime };
}

function computePredictions(v0, angleDeg, h0, gravity, type) {
  const angle = (type === 'semi') ? 0 : angleDeg * Math.PI / 180;
  const vx = v0 * Math.cos(angle);
  const vy = v0 * Math.sin(angle);
  const disc = vy*vy + 2*gravity*h0;
  const T = (vy + Math.sqrt(Math.max(0, disc))) / gravity;
  const range = vx * T;
  const tHmax = vy / gravity;
  const hmax  = tHmax > 0 ? h0 + vy*tHmax - .5*gravity*tHmax*tHmax : h0;
  return {
    time:  T.toFixed(2),
    range: range.toFixed(1),
    hmax:  Math.max(h0, hmax).toFixed(1),
  };
}

// ──────────────────────────────────────────────────
// MOTOR DE SIMULACIÓN
// ──────────────────────────────────────────────────
let mainAnimId = null;

function startSimulation() {
  if (STATE.isFlying) return;

  STATE.velocity = parseFloat(DOM.inputVel.value);
  STATE.angle    = parseFloat(DOM.inputAngle.value);
  STATE.height   = parseFloat(DOM.inputHeight.value);
  STATE.gravity  = parseFloat(DOM.inputGravity.value);
  STATE.tries++;
  DOM.statTries.textContent = STATE.tries;

  const type  = STATE.projectileType;
  const angle = (type === 'semi') ? 0 : STATE.angle * Math.PI / 180;
  const vx    = STATE.velocity * Math.cos(angle);
  const vy    = STATE.velocity * Math.sin(angle);

  const canvas  = DOM.canvasMain;
  const W       = canvas.width;
  const H       = canvas.height;
  const groundY = H * CONFIG.groundFraction;
  const scale   = CONFIG.scale;

  STATE.rocketX = W * 0.06;
  STATE.rocketY = groundY - STATE.height * scale;
  STATE.rocketVx = vx * scale;
  STATE.rocketVy = vy * scale;
  STATE.flightTime = 0;
  STATE.trail = [];
  STATE.explosionParticles = [];
  STATE.dustParticles = [];
  STATE.maxHeightReached = STATE.height;
  STATE.distanceReached  = 0;
  STATE.isFlying = true;

  DOM.msgOverlay.classList.add('hidden');
  DOM.btnLaunch.disabled = true;
  drawMiniGraph();

  if (mainAnimId) cancelAnimationFrame(mainAnimId);
  mainLoop();
}

function mainLoop() {
  const canvas  = DOM.canvasMain;
  const ctx     = canvas.getContext('2d');
  const W       = canvas.width;
  const H       = canvas.height;
  const groundY = H * CONFIG.groundFraction;
  const dt      = 1 / CONFIG.fps;
  const scale   = CONFIG.scale;

  function frame() {
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, W, H, groundY);

    if (STATE.isFlying) {
      const gPixels  = STATE.gravity * scale;
      STATE.rocketVy += -gPixels * dt;
      STATE.rocketX  += STATE.rocketVx * dt;
      STATE.rocketY  -= STATE.rocketVy * dt;
      STATE.flightTime += dt;

      STATE.distanceReached = (STATE.rocketX - W*.06) / scale;
      const curH = (groundY - STATE.rocketY) / scale;
      if (curH > STATE.maxHeightReached) STATE.maxHeightReached = curH;

      STATE.trail.push({ x: STATE.rocketX, y: STATE.rocketY });
      if (STATE.trail.length > CONFIG.trailLength) STATE.trail.shift();

      updateStats();

      if (STATE.rocketY >= groundY) {
        STATE.rocketY  = groundY;
        STATE.isFlying = false;
        checkHit();
        return;
      }
      if (STATE.rocketX > W + 50) {
        STATE.isFlying = false;
        showMissMessage('escaped');
        return;
      }

      drawTrail(ctx);
      drawRocket(ctx, STATE.rocketX, STATE.rocketY, STATE.rocketVx, -STATE.rocketVy);
    } else {
      drawExplosion(ctx);
      drawDust(ctx);
    }

    // Nubes sobre la escena
    STATE.clouds.forEach(c => {
      c.x -= c.speed;
      if (c.x + c.w < 0) c.x = W + c.w;
      drawCloud(ctx, c.x, c.y * (H/200), c.w * (W/900), c.h * (H/220), .72);
    });

    mainAnimId = requestAnimationFrame(frame);
  }

  frame();
}

// ──────────────────────────────────────────────────
// DRAWSCENE — escena principal del simulador
// ──────────────────────────────────────────────────
function drawScene(ctx, W, H, groundY) {
  const dark = STATE.darkMode;

  // ── Cielo ──
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  if (dark) {
    sky.addColorStop(0, '#05051a');
    sky.addColorStop(1, '#12123a');
  } else {
    sky.addColorStop(0, '#1a78d8');
    sky.addColorStop(1, '#7ecef4');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, groundY);

  // Estrellas nocturnas
  if (dark) {
    const stars = getStars(W, H);
    stars.forEach(s => {
      const a = .4 + .6*Math.sin(Date.now()*.001*s.speed + s.phase);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    });
  }

  // Sol / Luna
  if (dark) {
    drawMoon(ctx, W*.9, H*.07, Math.max(18, W*.024));
  } else {
    drawSun(ctx, W*.9, H*.09, Math.max(22, W*.032));
  }

  // ── Suelo arenoso ──
  const grd = ctx.createLinearGradient(0, groundY, 0, H);
  grd.addColorStop(0, dark ? '#4a3a1a' : '#f0a830');
  grd.addColorStop(1, dark ? '#2a1e08' : '#c87820');
  ctx.fillStyle = grd;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Línea del suelo
  ctx.strokeStyle = dark ? '#6a4a20' : '#d08020';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

  // ── Montañas / mesas de fondo ──
  drawMountainsMain(ctx, W, groundY, dark);

  // ── Cactus ──
  const cPos = [0.1, 0.27, 0.48, 0.68, 0.88];
  cPos.forEach(fx => {
    const ch = 18 + (fx*100 % 22 | 0);
    drawCactus(ctx, fx*W, groundY, ch);
  });

  // ── Camino de tierra (detalle desierto) ──
  drawDesertRoad(ctx, W, groundY);

  // ── Personajes ──
  const charScale = Math.max(.28, Math.min(.62, W/1400));
  drawCoyote(ctx, W*.055, groundY, charScale);
  drawRoadrunner(ctx, W * CONFIG.targetX, groundY, charScale * .88);

  // ── Objetivo / bandera ──
  drawTarget(ctx, W * CONFIG.targetX, groundY, H);

  // ── Indicador de ángulo mientras no vuela ──
  if (!STATE.isFlying && STATE.trail.length === 0) {
    drawAngleIndicatorOnCanvas(ctx, W*.06, groundY);
  }
}

// Camino de tierra en el desierto
function drawDesertRoad(ctx, W, groundY) {
  ctx.fillStyle = 'rgba(180,120,40,.35)';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(0, groundY + 12);
  ctx.lineTo(W, groundY + 12);
  ctx.lineTo(W, groundY);
  ctx.closePath();
  ctx.fill();
  // Líneas de la carretera punteadas
  ctx.strokeStyle = 'rgba(255,220,80,.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(0, groundY + 6);
  ctx.lineTo(W, groundY + 6);
  ctx.stroke();
  ctx.setLineDash([]);
}

let _stars = null;
function getStars(W, H) {
  if (!_stars) {
    _stars = [];
    for (let i = 0; i < 120; i++) {
      _stars.push({
        x: Math.random() * (W || 800),
        y: Math.random() * ((H || 400) * .65),
        r: .5 + Math.random() * 1.5,
        speed: .5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  return _stars;
}

function drawMoon(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#f5f5dc';
  ctx.strokeStyle = '#cccc99';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#05051a';
  ctx.beginPath(); ctx.arc(x + r*.4, y, r*.85, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(100,100,80,.35)';
  ctx.beginPath(); ctx.arc(x-5, y+3, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x-10, y-5, 2, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawMountainsMain(ctx, W, groundY, dark) {
  // Capa lejana — morada
  ctx.fillStyle = dark ? '#1a1a3a' : '#8060a0';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  const far = [
    [0,.22],[.05,.08],[.12,.18],[.19,.02],[.27,.14],[.35,.06],
    [.44,.16],[.52,.0],[.61,.12],[.7,.05],[.8,.15],[.9,.08],[1,.18],[1,1]
  ];
  far.forEach(([fx,fy]) => ctx.lineTo(fx*W, groundY - fy*groundY*.62));
  ctx.closePath(); ctx.fill();

  // Mesas rojizas (buttes)
  const mesa = ctx.createLinearGradient(0, groundY*.4, 0, groundY);
  mesa.addColorStop(0, dark ? '#3a2010' : '#c05028');
  mesa.addColorStop(1, dark ? '#1e1008' : '#8c3518');
  ctx.fillStyle = mesa;
  ctx.strokeStyle = dark ? '#2e1808' : '#7a2810';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(0, groundY*.62);
  ctx.lineTo(W*.08, groundY*.46);
  ctx.lineTo(W*.18, groundY*.46);
  ctx.lineTo(W*.23, groundY*.62);
  ctx.lineTo(W*.38, groundY*.72);
  ctx.lineTo(W*.44, groundY*.52);
  ctx.lineTo(W*.56, groundY*.52);
  ctx.lineTo(W*.62, groundY*.66);
  ctx.lineTo(W*.75, groundY*.73);
  ctx.lineTo(W*.82, groundY*.53);
  ctx.lineTo(W*.94, groundY*.53);
  ctx.lineTo(W, groundY*.64);
  ctx.lineTo(W, groundY);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
}

function drawTarget(ctx, x, groundY, H) {
  ctx.save();
  ctx.translate(x, groundY);
  const poleH = Math.max(36, H*.06);
  // Zona de impacto circular
  ctx.strokeStyle = 'rgba(232,52,28,.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(0, -2, CONFIG.targetTolerance, 0, Math.PI*2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Poste
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, -poleH); ctx.stroke();
  // Bandera
  ctx.fillStyle = '#e8341c';
  ctx.strokeStyle = '#8b0000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -poleH);
  ctx.lineTo(poleH*.55, -poleH*.82);
  ctx.lineTo(0, -poleH*.64);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // ACME en bandera
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${poleH*.13}px Georgia`;
  ctx.textAlign = 'center';
  ctx.fillText('X', poleH*.18, -poleH*.82);
  ctx.restore();
}

function drawAngleIndicatorOnCanvas(ctx, x, groundY) {
  const type  = STATE.projectileType;
  const angle = (type === 'semi') ? 0 : STATE.angle * Math.PI / 180;
  const len   = 70;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.strokeStyle = 'rgba(245,197,24,.85)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len*Math.cos(angle), -len*Math.sin(angle));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(245,197,24,.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 26, -angle, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(245,197,24,.95)';
  ctx.font = 'bold 12px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText(
    (type==='semi') ? '0°' : `${STATE.angle}°`,
    32*Math.cos(angle/2)+4, -32*Math.sin(angle/2)+5
  );
  ctx.restore();
}

// ──────────────────────────────────────────────────
// TRAIL, COHETE
// ──────────────────────────────────────────────────
function drawTrail(ctx) {
  if (STATE.trail.length < 2) return;
  for (let i = 1; i < STATE.trail.length; i++) {
    const a  = i / STATE.trail.length;
    const p  = STATE.trail[i];
    const pp = STATE.trail[i-1];
    // Línea brillante
    ctx.strokeStyle = `rgba(245,197,24,${a*.75})`;
    ctx.lineWidth   = a * 3.5;
    ctx.beginPath(); ctx.moveTo(pp.x, pp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    // Humo cartoon
    if (i % 4 === 0) {
      const smoke = Math.random() > .5 ? `rgba(200,200,200,${a*.35})` : `rgba(255,160,50,${a*.28})`;
      ctx.fillStyle = smoke;
      ctx.beginPath();
      ctx.arc(
        p.x + (Math.random()-.5)*8,
        p.y + (Math.random()-.5)*8,
        4 + Math.random()*6, 0, Math.PI*2
      );
      ctx.fill();
    }
  }
}

function drawRocket(ctx, x, y, vx, vy) {
  ctx.save();
  ctx.translate(x, y);
  const angle = Math.atan2(vy, vx);
  ctx.rotate(-angle);

  const L  = CONFIG.rocketLength;
  const W2 = CONFIG.rocketWidth;

  // Llama del motor — squash & stretch
  const flameLen = 22 + Math.random()*14;
  const fl = ctx.createLinearGradient(-L/2 - flameLen, 0, -L/2, 0);
  fl.addColorStop(0, 'rgba(255,80,0,0)');
  fl.addColorStop(.4, 'rgba(255,200,0,.85)');
  fl.addColorStop(1, 'rgba(255,100,0,.95)');
  ctx.fillStyle = fl;
  const fW = W2 * (.9 + Math.random()*.3);
  ctx.beginPath();
  ctx.moveTo(-L/2, fW*.5);
  ctx.quadraticCurveTo(-L/2 - flameLen*.7, 0, -L/2 - flameLen, 0);
  ctx.quadraticCurveTo(-L/2 - flameLen*.7, 0, -L/2, -fW*.5);
  ctx.closePath();
  ctx.fill();

  // Cuerpo del cohete
  ctx.fillStyle = '#e8341c';
  ctx.strokeStyle = '#7a0a00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-L*.5, -W2*.5, L*.75, W2, 2);
  ctx.fill(); ctx.stroke();

  // Ojiva plateada
  ctx.fillStyle = '#d0d0d0';
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(L*.25, -W2*.5);
  ctx.lineTo(L*.55, 0);
  ctx.lineTo(L*.25, W2*.5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Ventana circular
  ctx.fillStyle = '#a8d8ff';
  ctx.strokeStyle = '#4488cc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(L*.05, 0, W2*.3, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();

  // Aletas naranja
  ctx.fillStyle = '#f57c00';
  ctx.strokeStyle = '#8b4500';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-L*.42, -W2*.5);
  ctx.lineTo(-L*.52, -W2*1.5);
  ctx.lineTo(-L*.08, -W2*.5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-L*.42, W2*.5);
  ctx.lineTo(-L*.52, W2*1.5);
  ctx.lineTo(-L*.08, W2*.5);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Logo ACME
  ctx.fillStyle = 'white';
  ctx.font = `bold ${W2*.68}px Georgia`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ACME', -L*.05, 0);

  ctx.restore();
}

// ──────────────────────────────────────────────────
// EXPLOSIÓN Y POLVO
// ──────────────────────────────────────────────────
function triggerExplosion(x, y) {
  STATE.explosionParticles = [];
  for (let i = 0; i < 80; i++) {
    const a     = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 250;
    const cols  = ['#e8341c','#f57c00','#f5c518','#fff','#ffaa00','#ff6600','#cc0000','#ff4488'];
    STATE.explosionParticles.push({
      x, y,
      vx: Math.cos(a)*speed,
      vy: Math.sin(a)*speed,
      life: 1.0,
      decay: .012 + Math.random()*.02,
      r: 5 + Math.random()*15,
      color: cols[Math.floor(Math.random()*cols.length)],
      type: Math.random() > .65 ? 'star' : 'circle',
      gravity: 90 + Math.random()*130,
    });
  }
  // Onda expansiva visual
  STATE.shockwave = { x, y, r: 5, maxR: 80, life: 1.0 };
}

function triggerDust(x, groundY) {
  STATE.dustParticles = [];
  for (let i = 0; i < 55; i++) {
    STATE.dustParticles.push({
      x: x + (Math.random()-.5)*40,
      y: groundY,
      vx: (Math.random()-.5)*100,
      vy: -(25 + Math.random()*100),
      life: 1.0,
      decay: .007 + Math.random()*.014,
      r: 10 + Math.random()*24,
    });
  }
}

function drawExplosion(ctx) {
  const dt = 1/CONFIG.fps;

  // Onda expansiva
  if (STATE.shockwave && STATE.shockwave.life > 0) {
    const sw = STATE.shockwave;
    sw.r   += sw.maxR * dt * 3;
    sw.life -= .04;
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.life * .4);
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  STATE.explosionParticles = STATE.explosionParticles.filter(p => p.life > 0);
  STATE.explosionParticles.forEach(p => {
    p.x   += p.vx * dt;
    p.y   += p.vy * dt;
    p.vy  += p.gravity * dt;
    p.life -= p.decay;
    p.r   *= .97;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    if (p.type === 'star') {
      drawStar5(ctx, p.x, p.y, p.r, p.color);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  });
}

function drawStar5(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a   = (i/10)*Math.PI*2 - Math.PI/2;
    const rad = i%2===0 ? r : r*.4;
    if (i===0) ctx.moveTo(Math.cos(a)*rad, Math.sin(a)*rad);
    else ctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawDust(ctx) {
  const dt = 1/CONFIG.fps;
  STATE.dustParticles = STATE.dustParticles.filter(p => p.life > 0);
  STATE.dustParticles.forEach(p => {
    p.x  += p.vx * dt;
    p.y  += p.vy * dt;
    p.vy += 70 * dt;
    p.vx *= .97;
    p.life -= p.decay;
    p.r  *= 1.012;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life * .55);
    ctx.fillStyle   = STATE.darkMode ? '#886644' : '#d4a850';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ──────────────────────────────────────────────────
// VERIFICAR IMPACTO
// ──────────────────────────────────────────────────
function checkHit() {
  const canvas  = DOM.canvasMain;
  const W       = canvas.width;
  const groundY = canvas.height * CONFIG.groundFraction;
  const targetPx= W * CONFIG.targetX;
  const dist    = Math.abs(STATE.rocketX - targetPx);

  triggerDust(STATE.rocketX, groundY);

  if (dist <= CONFIG.targetTolerance) {
    triggerExplosion(STATE.rocketX, STATE.rocketY);
    spawnConfetti();
    setTimeout(() => showSuccessMessage(), 1300);
  } else {
    triggerExplosion(STATE.rocketX, STATE.rocketY);
    setTimeout(() => showMissMessage('fell'), 1300);
  }
  DOM.btnLaunch.disabled = false;
}

// ──────────────────────────────────────────────────
// MENSAJES
// ──────────────────────────────────────────────────
function showSuccessMessage() {
  DOM.msgIcon.textContent = '🎯';
  DOM.msgText.innerHTML   = `
    <strong>¡Objetivo alcanzado!</strong><br>
    <span style="font-size:.9rem;color:#27ae60;">¡El coyote lo logró esta vez!</span>`;
  buildStatsMessage();
  DOM.msgButtons.innerHTML = `
    <button class="msg-btn success" onclick="resetSimulator()">🔄 Reiniciar Simulador</button>
    <button class="msg-btn secondary" onclick="closeMsgAndRetry()">🚀 Otro Intento</button>`;
  DOM.msgOverlay.classList.remove('hidden');
}

function showMissMessage(reason) {
  DOM.msgIcon.textContent = '💨';
  DOM.msgText.innerHTML   = `
    <strong>El corredor escapó otra vez.</strong><br>
    <span style="font-size:.88rem;color:#e8341c;">
      ${reason==='escaped' ? 'El cohete voló demasiado lejos.' : 'Ajusta velocidad o ángulo e intenta de nuevo.'}
    </span>`;
  buildStatsMessage();
  DOM.msgButtons.innerHTML = `
    <button class="msg-btn primary"   onclick="closeMsgAndRetry()">🚀 Intentar Nuevamente</button>
    <button class="msg-btn secondary" onclick="resetSimulator()">🏠 Reiniciar</button>`;
  DOM.msgOverlay.classList.remove('hidden');
  DOM.btnLaunch.disabled = false;
}

function buildStatsMessage() {
  DOM.msgStats.innerHTML = `
    📏 Distancia:  <strong>${STATE.distanceReached.toFixed(1)} m</strong><br>
    📐 Altura máx: <strong>${STATE.maxHeightReached.toFixed(1)} m</strong><br>
    ⏱  Tiempo:     <strong>${STATE.flightTime.toFixed(2)} s</strong><br>
    🔢 Intentos:   <strong>${STATE.tries}</strong>`;
}

function closeMsgAndRetry() {
  DOM.msgOverlay.classList.add('hidden');
  DOM.btnLaunch.disabled = false;
  mainLoop();  // redibujar escena sin cohete
}

function resetSimulator() {
  if (mainAnimId) cancelAnimationFrame(mainAnimId);
  mainAnimId = null;
  STATE.isFlying = false;
  STATE.trail    = [];
  STATE.explosionParticles = [];
  STATE.dustParticles      = [];
  STATE.tries    = 0;
  DOM.statTries.textContent = '0';
  DOM.msgOverlay.classList.add('hidden');
  DOM.btnLaunch.disabled = false;

  DOM.screenSim.classList.remove('active');
  DOM.screenIntro.classList.add('active');
  STATE.screen = 'intro';
  document.body.classList.remove('dark-mode');
  STATE.darkMode = false;
  DOM.btnDark.textContent = '🌙';
}

// ──────────────────────────────────────────────────
// CONFETI
// ──────────────────────────────────────────────────
function spawnConfetti() {
  const cols = ['#e8341c','#f5c518','#1a78d8','#2ecc71','#e91e63','#ff9800','#9c27b0'];
  for (let i = 0; i < 100; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${8+Math.random()*84}vw;
      top:-14px;
      width:${6+Math.random()*10}px;
      height:${6+Math.random()*10}px;
      background:${cols[Math.floor(Math.random()*cols.length)]};
      animation-duration:${1.6+Math.random()*2.2}s;
      animation-delay:${Math.random()*.9}s;
      border-radius:${Math.random()>.5?'50%':'2px'};`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

// ──────────────────────────────────────────────────
// MINI GRÁFICA
// ──────────────────────────────────────────────────
function drawMiniGraph() {
  const canvas = DOM.canvasGraph;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(0, 0, W, H);

  // Cuadrícula
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo((i/4)*W, 0); ctx.lineTo((i/4)*W, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, (i/4)*H); ctx.lineTo(W, (i/4)*H); ctx.stroke();
  }

  const { points } = calculateTrajectory(
    parseFloat(DOM.inputVel.value),
    parseFloat(DOM.inputAngle.value),
    parseFloat(DOM.inputHeight.value),
    parseFloat(DOM.inputGravity.value),
    STATE.projectileType
  );
  if (points.length < 2) return;

  const maxX = Math.max(...points.map(p=>p.x));
  const maxY = Math.max(...points.map(p=>p.y));
  const px = W*.05, py = H*.1;

  const toC = p => ({
    cx: px + (p.x/(maxX||1))*(W - px*2),
    cy: H-py - (p.y/(maxY||1))*(H - py*2),
  });

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0,   '#f5c518');
  grad.addColorStop(.55, '#e8341c');
  grad.addColorStop(1,   '#1a78d8');

  ctx.strokeStyle = grad;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  points.forEach((p,i) => {
    const { cx, cy } = toC(p);
    if (i===0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
  });
  ctx.stroke();

  // Puntos inicio/fin
  const s = toC(points[0]);
  const e = toC(points[points.length-1]);
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath(); ctx.arc(s.cx, s.cy, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#e8341c';
  ctx.beginPath(); ctx.arc(e.cx, e.cy, 4, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.font = '9px Verdana';
  ctx.fillText('X', W-10, H-3);
  ctx.fillText('Y', 3, 11);
}

// ──────────────────────────────────────────────────
// ANIMACIÓN INTRO (cohete fallido)
// ──────────────────────────────────────────────────
function runIntroAnimation() {
  DOM.screenIntro.classList.remove('active');
  DOM.screenSim.classList.add('active');
  STATE.screen = 'sim';

  resizeMainCanvas();
  generateClouds();
  _stars = null;

  const canvas  = DOM.canvasMain;
  const W       = canvas.width;
  const H       = canvas.height;
  const groundY = H * CONFIG.groundFraction;

  // Cohete con ángulo exagerado — fallará a propósito
  const badAngle = 78 * Math.PI/180;
  const badSpeed = 38;
  STATE.rocketX  = W * .06;
  STATE.rocketY  = groundY;
  STATE.rocketVx = Math.cos(badAngle)*badSpeed*CONFIG.scale;
  STATE.rocketVy = Math.sin(badAngle)*badSpeed*CONFIG.scale;
  STATE.trail    = [];
  STATE.explosionParticles = [];
  STATE.dustParticles      = [];
  STATE.isFlying = true;
  STATE.flightTime = 0;
  STATE.maxHeightReached   = 0;
  STATE.distanceReached    = 0;
  if (STATE.shockwave) STATE.shockwave.life = 0;

  let introExpld = false;
  if (mainAnimId) cancelAnimationFrame(mainAnimId);

  function introFrame() {
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, W, H);
    drawScene(ctx2, W, H, groundY);

    const dt2 = 1/60;
    if (STATE.isFlying) {
      const gPx = STATE.gravity * CONFIG.scale;
      STATE.rocketVy += -gPx * dt2;
      STATE.rocketX  += STATE.rocketVx * dt2;
      STATE.rocketY  -= STATE.rocketVy * dt2;
      STATE.flightTime += dt2;

      STATE.trail.push({ x: STATE.rocketX, y: STATE.rocketY });
      if (STATE.trail.length > CONFIG.trailLength) STATE.trail.shift();

      drawTrail(ctx2);
      drawRocket(ctx2, STATE.rocketX, STATE.rocketY, STATE.rocketVx, -STATE.rocketVy);

      if (STATE.rocketX > W*.42 && !introExpld) {
        introExpld     = true;
        STATE.isFlying = false;
        triggerExplosion(STATE.rocketX, STATE.rocketY);
        triggerDust(STATE.rocketX, groundY+10);
      }
      if (STATE.rocketY >= groundY) {
        STATE.isFlying = false;
        triggerDust(STATE.rocketX, groundY);
      }
    } else {
      drawExplosion(ctx2);
      drawDust(ctx2);
    }

    STATE.clouds.forEach(c => {
      c.x -= c.speed;
      if (c.x + c.w < 0) c.x = W + c.w;
      drawCloud(ctx2, c.x, c.y*(H/220), c.w*(W/900), c.h*(H/220), .72);
    });

    mainAnimId = requestAnimationFrame(introFrame);
  }

  introFrame();

  setTimeout(() => {
    if (mainAnimId) cancelAnimationFrame(mainAnimId);
    STATE.trail    = [];
    STATE.isFlying = false;
    DOM.btnLaunch.disabled = false;

    DOM.msgIcon.textContent = '💥';
    DOM.msgText.innerHTML = `
      <strong>¡El primer cálculo falló!</strong><br>
      <span style="font-size:.88rem;color:#e8341c;">
        Ayuda al coyote a ajustar los valores.
      </span>`;
    DOM.msgStats.innerHTML = '';
    DOM.msgButtons.innerHTML = `
      <button class="msg-btn primary" onclick="closeMsgAndRetry()">
        🔧 ¡Ajustar valores!
      </button>`;
    DOM.msgOverlay.classList.remove('hidden');
  }, 3800);
}

// ──────────────────────────────────────────────────
// REDIBUJADO LIVE DEL CANVAS MIENTRAS SE AJUSTAN INPUTS
// Cuando no hay vuelo activo, redibuja la escena del canvas
// principal para reflejar la nueva altura inicial visualmente.
// ──────────────────────────────────────────────────
function redrawSceneLive() {
  if (STATE.isFlying) return;          // no interrumpir vuelo
  if (STATE.screen !== 'sim') return;  // solo en simulador
  const canvas = DOM.canvasMain;
  if (!canvas || !canvas.width) return;
  const W       = canvas.width;
  const H       = canvas.height;
  if (!W || !H) return;
  const groundY = H * CONFIG.groundFraction;
  const ctx     = canvas.getContext('2d');

  ctx.clearRect(0, 0, W, H);
  drawScene(ctx, W, H, groundY);

  // Dibujar indicador de altura inicial sobre el coyote
  const h0    = parseFloat(DOM.inputHeight.value) || 0;
  const scale = CONFIG.scale;
  const startX = W * 0.06;
  const startY = groundY - h0 * scale;

  if (h0 > 0) {
    // Línea vertical de altura
    ctx.save();
    ctx.strokeStyle = 'rgba(245,197,24,.7)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, groundY);
    ctx.lineTo(startX, startY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Etiqueta
    ctx.fillStyle = 'rgba(245,197,24,.95)';
    ctx.font      = 'bold 12px Verdana';
    ctx.textAlign = 'left';
    ctx.fillText(`h₀ = ${h0} m`, startX + 8, startY - 6);
    // Punto de lanzamiento
    ctx.beginPath();
    ctx.arc(startX, startY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f5c518';
    ctx.fill();
    ctx.strokeStyle = '#7a0a00';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

// ──────────────────────────────────────────────────
// STATS EN TIEMPO REAL
// ──────────────────────────────────────────────────
function updateStats() {
  DOM.statDist.textContent = `${STATE.distanceReached.toFixed(1)} m`;
  DOM.statAlt.textContent  = `${STATE.maxHeightReached.toFixed(1)} m`;
  DOM.statTime.textContent = `${STATE.flightTime.toFixed(1)} s`;
}

function updatePredictions() {
  const pred = computePredictions(
    parseFloat(DOM.inputVel.value),
    parseFloat(DOM.inputAngle.value),
    parseFloat(DOM.inputHeight.value),
    parseFloat(DOM.inputGravity.value),
    STATE.projectileType
  );
  DOM.predTime.textContent  = `${pred.time} s`;
  DOM.predRange.textContent = `${pred.range} m`;
  DOM.predHmax.textContent  = `${pred.hmax} m`;
  drawMiniGraph();
}

function updateAngleIndicator() {
  const canvas = DOM.canvasAngle;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const type     = STATE.projectileType;
  const angleDeg = (type==='semi') ? 0 : parseFloat(DOM.inputAngle.value);
  const angle    = angleDeg * Math.PI / 180;

  // Fondo circular
  ctx.fillStyle = '#0a0a18';
  ctx.beginPath(); ctx.arc(W/2, H/2, W/2-1, 0, Math.PI*2); ctx.fill();

  // Arc de ángulo
  ctx.strokeStyle = 'rgba(26,120,216,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W-9, H-9, 22, -Math.PI/2, -(angle+Math.PI/2), true); ctx.stroke();

  // Línea base
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(8, H-9); ctx.lineTo(W-9, H-9); ctx.stroke();

  // Flecha
  const len = 34, ox = W-9, oy = H-9;
  ctx.strokeStyle = '#e8341c';
  ctx.lineWidth = 2.5;
  ctx.lineCap   = 'round';
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox-len*Math.cos(angle), oy-len*Math.sin(angle)); ctx.stroke();
  ctx.fillStyle = '#e8341c';
  ctx.beginPath(); ctx.arc(ox-len*Math.cos(angle), oy-len*Math.sin(angle), 3.5, 0, Math.PI*2); ctx.fill();

  // Texto
  ctx.fillStyle = '#eee';
  ctx.font = 'bold 11px Verdana';
  ctx.textAlign = 'center';
  ctx.fillText(`${angleDeg}°`, W/2, H/2+5);
}

// ──────────────────────────────────────────────────
// TOOLTIPS
// ──────────────────────────────────────────────────
function setupTooltips() {
  document.querySelectorAll('.tip-icon').forEach(el => {
    el.addEventListener('mouseenter', () => {
      DOM.tooltip.textContent = el.dataset.tip;
      DOM.tooltip.classList.remove('hidden');
    });
    el.addEventListener('mousemove', e => {
      DOM.tooltip.style.left = `${e.clientX + 14}px`;
      DOM.tooltip.style.top  = `${e.clientY - 32}px`;
    });
    el.addEventListener('mouseleave', () => DOM.tooltip.classList.add('hidden'));
  });
}

// ──────────────────────────────────────────────────
// SYNC SLIDERS / INPUTS
// ──────────────────────────────────────────────────
function syncInputs(slider, input, onChange) {
  slider.addEventListener('input', () => { input.value = slider.value; onChange(); });
  input.addEventListener('input',  () => { slider.value = input.value; onChange(); });
}

// ──────────────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────────────
function setupEventListeners() {
  // ── Modal de bienvenida ──
  DOM.btnEnter.addEventListener('click', () => {
    // Ocultar modal con animación
    DOM.modalWelcome.style.transition = 'opacity .4s ease';
    DOM.modalWelcome.style.opacity    = '0';
    setTimeout(() => {
      DOM.modalWelcome.style.display = 'none';
      // Mostrar pantalla intro
      DOM.screenIntro.classList.add('active');
    }, 400);
  });

  DOM.btnStart.addEventListener('click', runIntroAnimation);
  DOM.btnLaunch.addEventListener('click', startSimulation);

  // Botón reiniciar del panel
  DOM.btnResetSim.addEventListener('click', resetSimulator);

  // Sliders — actualizan predicción + gráfica + canvas principal en tiempo real
  syncInputs(DOM.sliderVel,     DOM.inputVel,     () => { updatePredictions(); redrawSceneLive(); });
  syncInputs(DOM.sliderAngle,   DOM.inputAngle,   () => { updateAngleIndicator(); updatePredictions(); redrawSceneLive(); });
  syncInputs(DOM.sliderHeight,  DOM.inputHeight,  () => { updatePredictions(); redrawSceneLive(); });
  syncInputs(DOM.sliderGravity, DOM.inputGravity, () => {
    STATE.gravity = parseFloat(DOM.inputGravity.value);
    updatePredictions();
    redrawSceneLive();
  });

  // Tipo de tiro
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.projectileType = btn.dataset.type;
      if (STATE.projectileType === 'semi') {
        DOM.groupAngle.style.opacity       = '.38';
        DOM.groupAngle.style.pointerEvents = 'none';
        DOM.inputAngle.value  = 0;
        DOM.sliderAngle.value = 0;
      } else {
        DOM.groupAngle.style.opacity       = '1';
        DOM.groupAngle.style.pointerEvents = 'auto';
      }
      updateAngleIndicator();
      updatePredictions();
      redrawSceneLive();
    });
  });

  // Modo oscuro
  DOM.btnDark.addEventListener('click', () => {
    STATE.darkMode = !STATE.darkMode;
    document.body.classList.toggle('dark-mode', STATE.darkMode);
    DOM.btnDark.textContent = STATE.darkMode ? '☀️' : '🌙';
    _stars = null;
    updateAngleIndicator();
  });

  // Teoría — volver a intro
  DOM.btnTheory.addEventListener('click', () => {
    if (mainAnimId) cancelAnimationFrame(mainAnimId);
    mainAnimId = null;
    STATE.isFlying = false;
    DOM.screenSim.classList.remove('active');
    DOM.screenIntro.classList.add('active');
    STATE.screen = 'intro';
  });

  // Home / reiniciar
  DOM.btnHome.addEventListener('click', resetSimulator);

  // Tooltips
  setupTooltips();
}

// ──────────────────────────────────────────────────
// GLOBALS expuestos para onclick en HTML
// ──────────────────────────────────────────────────
window.resetSimulator  = resetSimulator;
window.closeMsgAndRetry = closeMsgAndRetry;
window.startMainLoop   = () => mainLoop();
