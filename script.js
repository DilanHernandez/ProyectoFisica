/* ═══════════════════════════════════════════════════════════════
   BillarFísica — script.js  v7
   ───────────────────────────────────────────────────────────────
   CONVENCIÓN DE COORDENADAS:
     MUNDO:  X+ = derecha, Y+ = arriba  (física estándar)
     CANVAS: X+ = derecha, Y+ = abajo   (DOM)
     Velocidades almacenadas en MUNDO. Flip Y solo en w2c/c2w.
     vx = v·cos(θ),  vy = v·sin(θ)  (mundo, sin inversión)

   NOVEDADES v7:
     · Zoom fuerte: WORLD_W=28, WORLD_H=17 (+27% más espacio)
     · Tronera circular tipo bolsillo de billar (radio fijo)
     · Tronera se mueve a posición aleatoria válida al encestar
     · Puntuación acumulativa (100 pts × enceste)
     · Flash verde + pulso CSS en acierto
     · Animación de texto "¡Encestado!" sobre la tronera
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ══════════════════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════════════════ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('btn-' + name).classList.add('active');
  if (name === 'simulator') requestAnimationFrame(initSimulator);
  if (name === 'home')      initHero();
}

/* ══════════════════════════════════════════════════════
   HERO CANVAS — animación decorativa
══════════════════════════════════════════════════════ */
let heroRaf = null;

function initHero() {
  const hc = document.getElementById('hero-canvas');
  if (!hc) return;
  if (heroRaf) cancelAnimationFrame(heroRaf);
  const hx = hc.getContext('2d');
  const W = hc.width, H = hc.height;
  const balls = [
    { x:80,  y:140, vx:1.4, vy:0.5,  r:22, col:'#F0EDE0', stroke:'#B8B090' },
    { x:290, y:145, vx:-1.1,vy:0.7,  r:20, col:'#E05050', stroke:'#A03030' },
    { x:185, y:52,  vx:0.4, vy:0.9,  r:15, col:'#5289AD', stroke:'#3a6a8a' },
  ];
  function loop() {
    hx.fillStyle='#2A5C45'; hx.fillRect(0,0,W,H);
    hx.strokeStyle='#1A3C2A'; hx.lineWidth=8; hx.strokeRect(4,4,W-8,H-8);
    hx.strokeStyle='rgba(255,255,255,0.05)'; hx.lineWidth=1;
    for(let x=0;x<=W;x+=36){hx.beginPath();hx.moveTo(x,0);hx.lineTo(x,H);hx.stroke();}
    for(let y=0;y<=H;y+=36){hx.beginPath();hx.moveTo(0,y);hx.lineTo(W,y);hx.stroke();}
    hx.strokeStyle='rgba(255,255,255,0.18)'; hx.lineWidth=1.5;
    hx.beginPath();hx.moveTo(0,H/2);hx.lineTo(W,H/2);hx.stroke();
    hx.beginPath();hx.moveTo(W/2,0);hx.lineTo(W/2,H);hx.stroke();
    /* tronera decorativa */
    hx.save(); hx.strokeStyle='rgba(46,200,100,0.6)'; hx.lineWidth=2.5;
    hx.beginPath(); hx.arc(320,210,16,0,Math.PI*2); hx.stroke(); hx.restore();
    for(const b of balls){
      b.x+=b.vx; b.y+=b.vy;
      if(b.x<b.r||b.x>W-b.r)b.vx*=-1;
      if(b.y<b.r||b.y>H-b.r)b.vy*=-1;
      for(const c of balls){
        if(b===c)continue;
        const dx=c.x-b.x,dy=c.y-b.y,d=Math.hypot(dx,dy);
        if(d<b.r+c.r&&d>0.001){
          const nx=dx/d,ny=dy/d,dot=(b.vx-c.vx)*nx+(b.vy-c.vy)*ny;
          if(dot>0){b.vx-=dot*nx;b.vy-=dot*ny;c.vx+=dot*nx;c.vy+=dot*ny;
            const ov=(b.r+c.r-d)/2;b.x-=nx*ov;b.y-=ny*ov;c.x+=nx*ov;c.y+=ny*ov;}
        }
      }
      hx.save(); hx.shadowColor='rgba(0,0,0,0.4)'; hx.shadowBlur=10; hx.shadowOffsetY=4;
      const g=hx.createRadialGradient(b.x-b.r*.3,b.y-b.r*.3,0,b.x,b.y,b.r);
      g.addColorStop(0,'rgba(255,255,255,0.6)');g.addColorStop(0.5,b.col);g.addColorStop(1,'rgba(0,0,0,0.3)');
      hx.beginPath();hx.arc(b.x,b.y,b.r,0,Math.PI*2);hx.fillStyle=g;hx.fill();
      hx.strokeStyle=b.stroke;hx.lineWidth=1.5;hx.shadowBlur=0;hx.stroke();
      hx.restore();
    }
    heroRaf=requestAnimationFrame(loop);
  }
  loop();
}

/* ══════════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════════ */
/* Mundo ampliado para fuerte zoom-out */
const WORLD_W   = 28;    /* metros — ancho visible                 */
const WORLD_H   = 17;    /* metros — alto visible                  */
const BALL_R    = 0.5;   /* radio de cada esfera (m)               */
const DT        = 1/60;  /* paso de tiempo (s)                     */
const VEC_SCALE = 0.55;  /* escala del vector de velocidad         */
const SIM_LIMIT = 5.0;   /* tiempo máximo por intento (s)          */

/* Posiciones iniciales por defecto */
const DEF_CUE_X = -6.0, DEF_CUE_Y =  0;
const DEF_TGT_X =  1.5, DEF_TGT_Y =  0;

/*
 * TRONERA (pocket) — circular, tipo bolsillo de billar.
 * Radio en metros.  El "objetivo" es este círculo.
 * La posición se generará aleatoriamente con randomGoal().
 */
const GOAL_R = 0.85;   /* radio del agujero en metros (~4× bola)   */

/* Paleta canvas */
const C = {
  felt:      '#2A5C45', rail: '#1A3020',
  gridFaint: 'rgba(255,255,255,0.04)',
  gridMid:   'rgba(255,255,255,0.09)',
  axis:      'rgba(172,188,191,0.45)',
  axisLbl:   'rgba(172,188,191,0.65)',
  cue:       '#F0EDE0', cueHi:'#FFFFFF', cueStroke:'#C8C4AC',
  cueGlow:   'rgba(240,237,224,0.5)',
  tgt:       '#E05050', tgtHi:'#F88080', tgtStroke:'#A03030',
  tgtGlow:   'rgba(224,80,80,0.45)',
  vecCue:    '#5289AD',
  vx:        '#D97706', vy: '#3A8C8A',
  goalRim:   'rgba(46,200,120,0.85)',
  goalFill:  'rgba(0,0,0,0.75)',
  goalGlow:  'rgba(46,200,120,0.4)',
  flash:     'rgba(255,230,100,0.18)',
  scoreText: '#FFD700',
};

/* ══════════════════════════════════════════════════════
   ESTADO GLOBAL
══════════════════════════════════════════════════════ */
/** @type {HTMLCanvasElement} */ let CV  = null;
/** @type {CanvasRenderingContext2D} */ let CTX = null;
let SCALE = 1;

let running     = false;
let collided    = false;
let gameOver    = false;
let goalReached = false;
let simTime     = 0;
let initKE      = 0;
let simRaf      = null;
let flashFrames = 0;
let listenersOK = false;

/* Puntuación acumulativa — persiste entre intentos */
let score = 0;
let goalsScored = 0;  /* cuántas troneras encestadas en esta sesión */

/* Tronera actual {x, y} en coordenadas mundo */
let goalPos = { x: 8.5, y: 0 };

/* Animación de texto al encestar */
let pocketAnim = null;  /* { x,y, alpha, text, frames } */

/**
 * @typedef {{ x:number, y:number, vx:number, vy:number, m:number, r:number }} Ball
 */
/** @type {Ball} */ let B1 = null;
/** @type {Ball} */ let B2 = null;

let drag = null;

/* ══════════════════════════════════════════════════════
   COORDENADAS  mundo ↔ canvas
══════════════════════════════════════════════════════ */
function w2c(wx, wy) {
  return {
    x:  CV.width  * 0.5 + wx * SCALE,
    y:  CV.height * 0.5 - wy * SCALE,
  };
}
function c2w(cx, cy) {
  return {
    x:  (cx - CV.width  * 0.5) / SCALE,
    y: -(cy - CV.height * 0.5) / SCALE,
  };
}
const clampX = (x,r) => Math.max(-(WORLD_W/2-r), Math.min(WORLD_W/2-r, x));
const clampY = (y,r) => Math.max(-(WORLD_H/2-r), Math.min(WORLD_H/2-r, y));

/* ══════════════════════════════════════════════════════
   AJUSTE DEL CANVAS
══════════════════════════════════════════════════════ */
function fitCanvas() {
  const rect = CV.parentElement.getBoundingClientRect();
  const W = Math.floor(rect.width);
  const H = Math.floor(rect.height);
  if (W < 10 || H < 10) return false;
  CV.width  = W;
  CV.height = H;
  SCALE = Math.min(W / WORLD_W, H / WORLD_H);
  return true;
}
function onResize() {
  if (!CV || !fitCanvas()) return;
  if (B1) { B1.x=clampX(B1.x,BALL_R); B1.y=clampY(B1.y,BALL_R); }
  if (B2) { B2.x=clampX(B2.x,BALL_R); B2.y=clampY(B2.y,BALL_R); }
  drawFrame();
}

/* ══════════════════════════════════════════════════════
   TRONERA ALEATORIA
══════════════════════════════════════════════════════ */
/**
 * randomGoal — elige una posición aleatoria válida para la tronera.
 * Reglas:
 *  · Al menos 2×GOAL_R de margen a los bordes del mundo
 *  · Al menos 3 metros de B2 para no estar encima del objetivo
 *  · Al menos 4 metros de B1 (bola blanca) — posición actual
 *  · Preferiblemente en el lado derecho del campo (x > 2)
 *    para premiar tiros hacia adelante
 */
function randomGoal() {
  const margin = GOAL_R + 0.5;
  const xMin = -(WORLD_W/2 - margin);
  const xMax =  (WORLD_W/2 - margin);
  const yMin = -(WORLD_H/2 - margin);
  const yMax =  (WORLD_H/2 - margin);

  /* Zona preferida: lado derecho */
  const preferRight = Math.random() < 0.75;
  const rxMin = preferRight ? 2.5 : xMin;

  let attempts = 0;
  while (attempts < 200) {
    attempts++;
    const x = rxMin + Math.random() * (xMax - rxMin);
    const y = yMin  + Math.random() * (yMax - yMin);

    /* Distancia mínima a B2 */
    if (B2 && Math.hypot(x-B2.x, y-B2.y) < 3) continue;
    /* Distancia mínima a B1 */
    if (B1 && Math.hypot(x-B1.x, y-B1.y) < 4) continue;

    return { x, y };
  }
  /* Fallback seguro */
  return { x: 8, y: preferRight ? 2 : -2 };
}

/* ══════════════════════════════════════════════════════
   INICIALIZACIÓN
══════════════════════════════════════════════════════ */
function initSimulator() {
  CV  = document.getElementById('sim-canvas');
  if (!CV) return;
  CTX = CV.getContext('2d');

  if (!fitCanvas()) { requestAnimationFrame(initSimulator); return; }

  if (!listenersOK) {
    listenersOK = true;
    setupPanelListeners();
    setupCanvasListeners();
    window.addEventListener('resize', onResize);
  }

  if (!B1 || !B2) spawnBalls();

  drawFrame();
  updateStats();
  updateTimerUI(SIM_LIMIT, 1.0);
}

/* ══════════════════════════════════════════════════════
   CREACIÓN DE BOLAS
══════════════════════════════════════════════════════ */
function spawnBalls() {
  const p = readPanel();
  B1 = {
    x:  DEF_CUE_X, y: DEF_CUE_Y,
    vx: p.v1*Math.cos(p.a1),
    vy: p.v1*Math.sin(p.a1),   /* sin negación — mundo Y+ = arriba */
    m: p.m1, r: BALL_R,
  };
  B2 = { x:DEF_TGT_X, y:DEF_TGT_Y, vx:0, vy:0, m:p.m2, r:BALL_R };
  ensureNoOverlap();
  collided=false; goalReached=false; gameOver=false; simTime=0;
  initKE = KE(B1)+KE(B2);
}

function syncB1FromPanel() {
  if (!B1) return spawnBalls();
  const p = readPanel();
  B1.vx = p.v1*Math.cos(p.a1);
  B1.vy = p.v1*Math.sin(p.a1);
  B1.m  = p.m1;
  if (B2) B2.m = p.m2;
  initKE = KE(B1)+KE(B2);
}

function readPanel() {
  const m1 = Math.max(0.1, parseFloat(document.getElementById('m1').value)||2);
  const m2 = Math.max(0.1, parseFloat(document.getElementById('m2').value)||2);
  const v1 = Math.max(0.1, parseFloat(document.getElementById('v1').value)||6);
  const a1 = (parseFloat(document.getElementById('a1').value)||0)*Math.PI/180;
  return { m1, m2, v1, a1 };
}

/* ══════════════════════════════════════════════════════
   LISTENERS DEL PANEL
══════════════════════════════════════════════════════ */
function setupPanelListeners() {
  document.getElementById('a1')?.addEventListener('input', function() {
    document.getElementById('a1-val').textContent = this.value+'°';
    if (!running) { syncB1FromPanel(); drawFrame(); updateStats(); }
  });
  ['v1','m1','m2'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (!running) { syncB1FromPanel(); drawFrame(); updateStats(); }
    });
  });
  document.querySelectorAll('input[name="ctype"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('rest-row').style.display =
        (r.value==='inelastic'&&r.checked)?'flex':'none';
      updateStats();
    });
  });
  document.getElementById('restitution')?.addEventListener('input', function() {
    document.getElementById('rest-val').textContent = parseFloat(this.value).toFixed(2);
  });
}

/* ══════════════════════════════════════════════════════
   CONTROLES DE SIMULACIÓN
══════════════════════════════════════════════════════ */
function simStart() {
  if (running||gameOver) return;
  if (!B1||!B2) spawnBalls();
  syncB1FromPanel();
  initKE = KE(B1)+KE(B2);
  collided=false; goalReached=false; flashFrames=0;
  running=true; simTime=0;

  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  setStatus('run','Simulación en curso… ¡apunta a la tronera!');
  fadeHint();
  if (simRaf) cancelAnimationFrame(simRaf);

  let lastT = null;
  function loop(ts) {
    if (!running) return;
    if (lastT !== null) {
      const dt = Math.min((ts-lastT)/1000, 0.05);
      simTime += dt;
    }
    lastT = ts;

    physicsStep();
    if (flashFrames>0) flashFrames--;
    if (pocketAnim) {
      pocketAnim.frames--;
      pocketAnim.alpha = Math.max(0, pocketAnim.frames/40);
      if (pocketAnim.frames<=0) pocketAnim=null;
    }

    /* Comprobar tronera alcanzada */
    if (collided && !goalReached && isBallInPocket(B2)) {
      goalReached = true;
      triggerPocketSuccess();
      return;
    }

    /* Tiempo agotado */
    const remaining = Math.max(0, SIM_LIMIT-simTime);
    updateTimerUI(remaining, remaining/SIM_LIMIT);
    if (remaining<=0) { triggerTimeout(); return; }

    drawFrame();
    updateStats();
    simRaf = requestAnimationFrame(loop);
  }
  simRaf = requestAnimationFrame(loop);
}

function simPause() {
  if (gameOver) return;
  running = !running;
  if (running) {
    setStatus('run','Simulación en curso…');
    document.getElementById('btn-pause').innerHTML=
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar';
    simStart();
  } else {
    setStatus('pause','Pausado');
    document.getElementById('btn-pause').innerHTML=
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Reanudar';
    cancelAnimationFrame(simRaf);
  }
}

function simReset() {
  running=false; gameOver=false; collided=false;
  goalReached=false; simTime=0; flashFrames=0; pocketAnim=null;
  if (simRaf) cancelAnimationFrame(simRaf);

  document.getElementById('btn-start').disabled=false;
  document.getElementById('btn-pause').disabled=true;
  document.getElementById('btn-pause').innerHTML=
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar';

  const badge=document.getElementById('collision-badge');
  if(badge){badge.textContent='';badge.classList.add('hidden');}

  hideResultOverlay();
  setStatus('idle','Configura y lanza la bola blanca hacia la tronera 🕳️');
  showHint();
  updateTimerUI(SIM_LIMIT,1.0);

  B1=null; B2=null;
  spawnBalls();
  drawFrame();
  updateStats();
}

/* ── Éxito: tronera alcanzada ── */
function triggerPocketSuccess() {
  running=false; gameOver=false;  /* gameOver=false → puede reiniciar sin reset */
  cancelAnimationFrame(simRaf);

  score += 100;
  goalsScored++;
  updateScoreDisplay();

  /* Animación de texto flotante */
  const gp = w2c(goalPos.x, goalPos.y);
  pocketAnim = { x: gp.x, y: gp.y, alpha: 1, frames: 60,
                  text: '¡Encestado! +100' };

  /* Pulso CSS */
  const wrap = document.getElementById('canvas-wrap');
  wrap.classList.remove('success-pulse');
  void wrap.offsetWidth; /* reflush */
  wrap.classList.add('success-pulse');

  flashFrames = 20;
  drawFrame();
  updateStats();
  setStatus('done',`¡Encestado! +100 pts — Tronera moviéndose…`);

  /* Mover tronera a nueva posición aleatoria tras breve pausa */
  setTimeout(() => {
    goalPos = randomGoal();
    /* Reiniciar bolas sin reiniciar la puntuación */
    running=false; gameOver=false; collided=false;
    goalReached=false; simTime=0; flashFrames=0;

    document.getElementById('btn-start').disabled=false;
    document.getElementById('btn-pause').disabled=true;
    document.getElementById('btn-pause').innerHTML=
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pausar';

    const badge=document.getElementById('collision-badge');
    if(badge){badge.textContent='';badge.classList.add('hidden');}

    hideResultOverlay();
    showHint();
    updateTimerUI(SIM_LIMIT,1.0);

    B1=null; B2=null;
    spawnBalls();
    drawFrame();
    updateStats();
    setStatus('idle','¡Nueva tronera! Configura y vuelve a lanzar 🕳️');
  }, 900);
}

/* ── Tiempo agotado ── */
function triggerTimeout() {
  running=false; gameOver=true;
  cancelAnimationFrame(simRaf);
  updateTimerUI(0,0);
  drawFrame(); updateStats();
  setStatus('fail','Tiempo agotado');
  showResultOverlay('⏰',`Tiempo agotado.\nReinicia la simulación.`,false);
}

function showResultOverlay(icon,msg,success) {
  const ov=document.getElementById('result-overlay');
  const box=document.getElementById('result-box');
  const ico=document.getElementById('result-icon');
  const txt=document.getElementById('result-msg');
  const sc=document.getElementById('result-score');
  if(!ov) return;
  ico.textContent=icon;
  txt.textContent=msg;
  sc.textContent=`Puntuación: ${score} pts (${goalsScored} troneras)`;
  box.style.borderTop=`4px solid ${success?'#2E8B57':'#C0392B'}`;
  ov.classList.remove('hidden');
}
function hideResultOverlay(){
  const ov=document.getElementById('result-overlay');
  if(ov) ov.classList.add('hidden');
}

function updateTimerUI(seconds, fraction) {
  const disp=document.getElementById('timer-display');
  const bar=document.getElementById('timer-bar');
  if(disp){disp.textContent=seconds.toFixed(1)+'s'; disp.className='timer-display'+(fraction<0.3?' urgent':'');}
  if(bar){bar.style.width=(fraction*100)+'%'; bar.className='timer-bar'+(fraction<0.3?' urgent':'');}
}

function updateScoreDisplay() {
  const el=document.getElementById('score-display');
  if(el) el.textContent=score;
}

function setStatus(type,text){
  const d=document.getElementById('status-dot'); if(d) d.className='status-dot '+type;
  const t=document.getElementById('status-text'); if(t) t.textContent=text;
}
function fadeHint(){const h=document.getElementById('drag-hint');if(h)h.style.opacity='0';}
function showHint() {const h=document.getElementById('drag-hint');if(h)h.style.opacity='1';}

function nudge(id,delta){
  const el=document.getElementById(id); if(!el) return;
  const v=parseFloat(el.value)||0;
  const min=el.min!==''?parseFloat(el.min):-Infinity;
  const max=el.max!==''?parseFloat(el.max):Infinity;
  el.value=Math.min(max,Math.max(min,v+delta)).toFixed(1);
  el.dispatchEvent(new Event('input'));
}

/* ══════════════════════════════════════════════════════
   FÍSICA
══════════════════════════════════════════════════════ */
function physicsStep(){
  B1.x+=B1.vx*DT; B1.y+=B1.vy*DT;
  B2.x+=B2.vx*DT; B2.y+=B2.vy*DT;
  wallBounce(B1); wallBounce(B2);
  resolveCollision();
}

function wallBounce(b){
  const hw=WORLD_W/2-b.r, hh=WORLD_H/2-b.r;
  if(b.x<-hw){b.x=-hw;b.vx= Math.abs(b.vx);}
  if(b.x> hw){b.x= hw;b.vx=-Math.abs(b.vx);}
  if(b.y<-hh){b.y=-hh;b.vy= Math.abs(b.vy);}
  if(b.y> hh){b.y= hh;b.vy=-Math.abs(b.vy);}
}

/**
 * Colisión 2D con coeficiente de restitución.
 * j = -(1+e)·vRel_n / (1/m1+1/m2)
 */
function resolveCollision(){
  const dx=B2.x-B1.x, dy=B2.y-B1.y;
  const dist=Math.hypot(dx,dy), minD=B1.r+B2.r;
  if(dist>=minD||dist<1e-9) return;
  const nx=dx/dist, ny=dy/dist;
  /* anti-overlap */
  const ov=minD-dist, totM=B1.m+B2.m;
  B1.x-=nx*ov*(B2.m/totM); B1.y-=ny*ov*(B2.m/totM);
  B2.x+=nx*ov*(B1.m/totM); B2.y+=ny*ov*(B1.m/totM);
  /* velocidad relativa */
  const vRel=(B1.vx-B2.vx)*nx+(B1.vy-B2.vy)*ny;
  if(vRel<=0) return;
  /* coef restitución */
  const isEl=document.querySelector('input[name="ctype"]:checked')?.value==='elastic';
  const e=isEl?1.0:Math.max(0,Math.min(0.99,parseFloat(document.getElementById('restitution').value)||0.7));
  const j=-(1+e)*vRel/(1/B1.m+1/B2.m);
  B1.vx+=(j/B1.m)*nx; B1.vy+=(j/B1.m)*ny;
  B2.vx-=(j/B2.m)*nx; B2.vy-=(j/B2.m)*ny;
  if(!collided){
    collided=true; flashFrames=18;
    const lbl=isEl?'Elástica · e=1.00':`Inelástica · e=${e.toFixed(2)}`;
    const badge=document.getElementById('collision-badge');
    if(badge){badge.textContent='💥 '+lbl; badge.classList.remove('hidden');}
    setStatus('done','¡Colisión! — '+lbl);
  }
}

const KE  = b => 0.5*b.m*(b.vx*b.vx+b.vy*b.vy);
const MOM = b => b.m*Math.hypot(b.vx,b.vy);

/**
 * isBallInPocket — comprueba si el CENTRO de la bola B2
 * está dentro del radio de la tronera.
 * Usamos B2.r/2 como tolerancia extra (no pide enceste perfecto).
 */
function isBallInPocket(b){
  return Math.hypot(b.x-goalPos.x, b.y-goalPos.y) < GOAL_R + b.r*0.5;
}

function ensureNoOverlap(){
  if(!B1||!B2) return;
  const dx=B2.x-B1.x, dy=B2.y-B1.y;
  const d=Math.hypot(dx,dy), minD=B1.r+B2.r;
  if(d<minD&&d>1e-9){
    const nx=dx/d, ny=dy/d, push=(minD-d)/2+0.02;
    B1.x-=nx*push; B1.y-=ny*push;
    B2.x+=nx*push; B2.y+=ny*push;
    B1.x=clampX(B1.x,BALL_R); B1.y=clampY(B1.y,BALL_R);
    B2.x=clampX(B2.x,BALL_R); B2.y=clampY(B2.y,BALL_R);
  }
}

/* ══════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════ */
function drawFrame(){
  if(!CTX||!CV||CV.width<10) return;
  const W=CV.width, H=CV.height;

  drawTable(W,H);

  if(flashFrames>0){CTX.fillStyle=C.flash; CTX.fillRect(0,0,W,H);}

  drawGrid(W,H);
  drawAxes(W,H);
  drawPocket();       /* tronera circular */

  if(B1) drawVector(B1,C.vecCue);
  if(B2) drawBall(B2,C.tgt,C.tgtHi,C.tgtStroke,C.tgtGlow,'2',false);
  if(B1) drawBall(B1,C.cue,C.cueHi,C.cueStroke,C.cueGlow,'1',true);
  if(B1) drawLabel(B1,'#E8E4D0','Blanca');
  if(B2) drawLabel(B2,'#F8A0A0','Objetivo');

  if(pocketAnim) drawPocketAnim();
}

function drawTable(W,H){
  CTX.fillStyle=C.felt; CTX.fillRect(0,0,W,H);
  CTX.save(); CTX.strokeStyle='rgba(0,0,0,0.03)'; CTX.lineWidth=1;
  for(let i=-H;i<W+H;i+=22){CTX.beginPath();CTX.moveTo(i,0);CTX.lineTo(i+H,H);CTX.stroke();}
  CTX.restore();
  const rw=Math.max(5,Math.round(SCALE*0.14));
  CTX.fillStyle=C.rail;
  CTX.fillRect(0,0,W,rw); CTX.fillRect(0,H-rw,W,rw);
  CTX.fillRect(0,0,rw,H); CTX.fillRect(W-rw,0,rw,H);
  /* troneras de la mesa */
  const pr=Math.max(4,Math.round(SCALE*0.18));
  CTX.fillStyle='#0D1F10';
  for(const [cx,cy] of [[rw,rw],[W-rw,rw],[rw,H-rw],[W-rw,H-rw]]){
    CTX.beginPath();CTX.arc(cx,cy,pr,0,Math.PI*2);CTX.fill();
  }
  CTX.beginPath();CTX.arc(W/2,rw,pr*.8,0,Math.PI*2);CTX.fill();
  CTX.beginPath();CTX.arc(W/2,H-rw,pr*.8,0,Math.PI*2);CTX.fill();
}

function drawGrid(W,H){
  const cx=W/2,cy=H/2;
  CTX.strokeStyle=C.gridFaint; CTX.lineWidth=1;
  for(let x=cx%SCALE;x<=W;x+=SCALE){CTX.beginPath();CTX.moveTo(x,0);CTX.lineTo(x,H);CTX.stroke();}
  for(let y=cy%SCALE;y<=H;y+=SCALE){CTX.beginPath();CTX.moveTo(0,y);CTX.lineTo(W,y);CTX.stroke();}
  CTX.strokeStyle=C.gridMid; CTX.lineWidth=1;
  for(let x=cx%(2*SCALE);x<=W;x+=2*SCALE){CTX.beginPath();CTX.moveTo(x,0);CTX.lineTo(x,H);CTX.stroke();}
  for(let y=cy%(2*SCALE);y<=H;y+=2*SCALE){CTX.beginPath();CTX.moveTo(0,y);CTX.lineTo(W,y);CTX.stroke();}
}

function drawAxes(W,H){
  const cx=W/2,cy=H/2;
  CTX.save();
  CTX.strokeStyle=C.axis; CTX.lineWidth=1.5;
  CTX.beginPath();CTX.moveTo(0,cy);CTX.lineTo(W,cy);CTX.stroke();
  CTX.beginPath();CTX.moveTo(cx,0);CTX.lineTo(cx,H);CTX.stroke();
  arrowTip(W-10,cy,1,0,C.axis,7);
  arrowTip(cx,10,0,-1,C.axis,7);
  const fs=Math.max(9,Math.round(SCALE*.17));
  CTX.fillStyle=C.axisLbl; CTX.font=`600 ${fs}px Outfit,sans-serif`;
  CTX.fillText('X (m)',W-46,cy-8); CTX.fillText('Y (m)',cx+7,15);
  const mfs=Math.max(8,Math.round(SCALE*.14));
  CTX.font=`400 ${mfs}px DM Mono,monospace`; CTX.textAlign='center';
  const hmW=Math.floor(WORLD_W/2);
  for(let i=-hmW;i<=hmW;i++){
    if(i===0) continue;
    const px=cx+i*SCALE; if(px<12||px>W-12) continue;
    CTX.beginPath();CTX.moveTo(px,cy-3);CTX.lineTo(px,cy+3);CTX.strokeStyle=C.axis;CTX.lineWidth=1;CTX.stroke();
    if(i%2===0){CTX.fillStyle=C.axisLbl;CTX.fillText(i,px,cy+11);}
  }
  CTX.textAlign='right';
  const hmH=Math.floor(WORLD_H/2);
  for(let i=-hmH;i<=hmH;i++){
    if(i===0) continue;
    const py=cy-i*SCALE; if(py<12||py>H-12) continue;
    CTX.beginPath();CTX.moveTo(cx-3,py);CTX.lineTo(cx+3,py);CTX.strokeStyle=C.axis;CTX.lineWidth=1;CTX.stroke();
    if(i%2===0){CTX.fillStyle=C.axisLbl;CTX.fillText(i,cx-6,py+4);}
  }
  CTX.restore();
}

/**
 * drawPocket — dibuja la tronera circular estilo bolsillo de billar.
 * Capas: hoyo negro + anillo exterior verde pulsante + sombra interior.
 */
function drawPocket(){
  const {x:px,y:py}=w2c(goalPos.x,goalPos.y);
  const pr=GOAL_R*SCALE;  /* radio en píxeles */

  const pulse=0.6+0.35*Math.sin(Date.now()/350);
  const glowA=goalReached?1.0:pulse;

  CTX.save();

  /* Sombra exterior (glow verde) */
  CTX.shadowColor=`rgba(46,200,120,${glowA*0.55})`;
  CTX.shadowBlur=pr*0.9;

  /* Hoyo: relleno negro oscuro */
  const hole=CTX.createRadialGradient(px-pr*.25,py-pr*.25,0,px,py,pr);
  hole.addColorStop(0,'#1a2e20');
  hole.addColorStop(0.7,'#0d1510');
  hole.addColorStop(1,'#060c08');
  CTX.beginPath(); CTX.arc(px,py,pr,0,Math.PI*2);
  CTX.fillStyle=hole; CTX.fill();
  CTX.shadowBlur=0;

  /* Anillo exterior — verde brillante */
  CTX.strokeStyle=goalReached?'rgba(46,255,140,1)':
    `rgba(46,200,120,${0.65+0.3*pulse})`;
  CTX.lineWidth=Math.max(1.5, pr*0.18);
  CTX.beginPath(); CTX.arc(px,py,pr,0,Math.PI*2); CTX.stroke();

  /* Anillo interior tenue */
  CTX.strokeStyle=`rgba(46,200,120,${0.2+0.1*pulse})`;
  CTX.lineWidth=1;
  CTX.beginPath(); CTX.arc(px,py,pr*0.65,0,Math.PI*2); CTX.stroke();

  /* Icono central */
  const fs=Math.max(8,Math.round(pr*0.55));
  CTX.fillStyle=goalReached?'rgba(160,255,200,1)':`rgba(46,200,120,${0.7+0.25*pulse})`;
  CTX.font=`bold ${fs}px Outfit,sans-serif`;
  CTX.textAlign='center'; CTX.textBaseline='middle';
  CTX.fillText('🕳', px, py);

  CTX.restore();
}

/** drawPocketAnim — texto flotante "¡Encestado! +100" */
function drawPocketAnim(){
  if(!pocketAnim) return;
  CTX.save();
  CTX.globalAlpha=pocketAnim.alpha;
  const rise=(60-pocketAnim.frames)*1.2; /* sube con el tiempo */
  CTX.fillStyle=C.scoreText;
  CTX.font=`bold ${Math.max(12,Math.round(SCALE*.28))}px Outfit,sans-serif`;
  CTX.textAlign='center'; CTX.textBaseline='middle';
  CTX.shadowColor='rgba(0,0,0,0.6)'; CTX.shadowBlur=6;
  CTX.fillText(pocketAnim.text, pocketAnim.x, pocketAnim.y-rise);
  CTX.restore();
}

/**
 * drawVector — vx/vy en MUNDO. Flip Y solo al convertir a canvas.
 */
function drawVector(b,totalColor){
  const {x:px,y:py}=w2c(b.x,b.y);
  const spd=Math.hypot(b.vx,b.vy);
  if(spd<0.001) return;
  const ex=px+b.vx*SCALE*VEC_SCALE;
  const ey=py-b.vy*SCALE*VEC_SCALE;  /* flip Y */

  /* Vx (ámbar punteado) */
  if(Math.abs(b.vx)>0.05){
    CTX.save(); CTX.strokeStyle=C.vx; CTX.lineWidth=1.8;
    CTX.setLineDash([5,3]); CTX.globalAlpha=0.85;
    CTX.beginPath();CTX.moveTo(px,py);CTX.lineTo(ex,py);CTX.stroke();
    CTX.setLineDash([]); CTX.globalAlpha=1;
    arrowTip(ex,py,Math.sign(b.vx),0,C.vx,5);
    CTX.fillStyle=C.vx;
    CTX.font=`500 ${Math.max(8,Math.round(SCALE*.12))}px DM Mono,monospace`;
    CTX.textAlign='center';
    CTX.fillText(`Vx=${b.vx.toFixed(1)}`,(px+ex)/2,py-7);
    CTX.restore();
  }
  /* Vy (teal punteado) */
  if(Math.abs(b.vy)>0.05){
    CTX.save(); CTX.strokeStyle=C.vy; CTX.lineWidth=1.8;
    CTX.setLineDash([5,3]); CTX.globalAlpha=0.85;
    CTX.beginPath();CTX.moveTo(ex,py);CTX.lineTo(ex,ey);CTX.stroke();
    CTX.setLineDash([]); CTX.globalAlpha=1;
    arrowTip(ex,ey,0,Math.sign(py-ey),C.vy,5);
    CTX.fillStyle=C.vy;
    CTX.font=`500 ${Math.max(8,Math.round(SCALE*.12))}px DM Mono,monospace`;
    CTX.textAlign='left';
    CTX.fillText(`Vy=${b.vy.toFixed(1)}`,ex+5,(py+ey)/2);
    CTX.restore();
  }
  /* Vector total */
  CTX.save();
  CTX.strokeStyle=totalColor; CTX.lineWidth=2.5;
  CTX.shadowColor=totalColor+'55'; CTX.shadowBlur=4;
  CTX.beginPath();CTX.moveTo(px,py);CTX.lineTo(ex,ey);CTX.stroke();
  const dcx=ex-px, dcy=ey-py, dlen=Math.hypot(dcx,dcy);
  if(dlen>0) arrowTip(ex,ey,dcx/dlen,dcy/dlen,totalColor,8);
  if(!running){
    CTX.beginPath();CTX.arc(ex,ey,8,0,Math.PI*2);
    CTX.fillStyle=totalColor; CTX.shadowBlur=12; CTX.fill();
    CTX.shadowBlur=0;
    CTX.strokeStyle='rgba(255,255,255,0.75)'; CTX.lineWidth=2; CTX.stroke();
  }
  CTX.restore();
}

function drawBall(b,col,hiCol,stroke,glow,lbl,isCue){
  const {x:px,y:py}=w2c(b.x,b.y);
  const r=b.r*SCALE;
  CTX.save();
  CTX.shadowColor=glow; CTX.shadowBlur=running?16:9; CTX.shadowOffsetY=r*.22;
  const g=CTX.createRadialGradient(px-r*.3,py-r*.35,0,px,py,r);
  g.addColorStop(0,hiCol); g.addColorStop(.45,col); g.addColorStop(1,darken(col,.35));
  CTX.beginPath();CTX.arc(px,py,r,0,Math.PI*2); CTX.fillStyle=g; CTX.fill();
  CTX.shadowBlur=0; CTX.shadowOffsetY=0;
  CTX.strokeStyle=stroke; CTX.lineWidth=1.5; CTX.stroke();
  const sg=CTX.createRadialGradient(px-r*.35,py-r*.4,0,px-r*.2,py-r*.2,r*.55);
  sg.addColorStop(0,'rgba(255,255,255,0.45)'); sg.addColorStop(1,'rgba(255,255,255,0)');
  CTX.beginPath();CTX.arc(px,py,r,0,Math.PI*2); CTX.fillStyle=sg; CTX.fill();
  CTX.restore();
  CTX.save();
  CTX.fillStyle=isCue?'#3A3020':'#fff';
  CTX.font=`bold ${Math.max(10,Math.round(r*.72))}px Outfit,sans-serif`;
  CTX.textAlign='center'; CTX.textBaseline='middle';
  CTX.shadowColor='rgba(0,0,0,0.2)'; CTX.shadowBlur=3;
  CTX.fillText(lbl,px,py); CTX.restore();
  if(!running&&isCue){
    CTX.save(); CTX.strokeStyle='rgba(240,237,224,0.45)'; CTX.lineWidth=1.5;
    CTX.setLineDash([3,3]); CTX.beginPath();CTX.arc(px,py,r+6,0,Math.PI*2);CTX.stroke();
    CTX.restore();
  }
}

function drawLabel(b,col,name){
  const {x:px,y:py}=w2c(b.x,b.y);
  const r=b.r*SCALE;
  const spd=Math.hypot(b.vx,b.vy);
  const txt=`${name}: v=${spd.toFixed(1)} m/s`;
  const fs=Math.max(8,Math.round(SCALE*.13));
  CTX.save(); CTX.font=`500 ${fs}px DM Mono,monospace`; CTX.textAlign='center';
  const tw=CTX.measureText(txt).width;
  const bx=px-tw/2-5, by=py-r-20;
  CTX.fillStyle='rgba(26,50,32,0.80)';
  if(CTX.roundRect){CTX.beginPath();CTX.roundRect(bx,by,tw+10,fs+7,4);CTX.fill();}
  else CTX.fillRect(bx,by,tw+10,fs+7);
  CTX.fillStyle=col; CTX.fillText(txt,px,by+fs+0.5);
  CTX.restore();
}

function arrowTip(x,y,dx,dy,col,sz){
  const ax=-dy,ay=dx;
  CTX.fillStyle=col; CTX.beginPath();
  CTX.moveTo(x,y);
  CTX.lineTo(x-dx*sz+ax*sz*.5,y-dy*sz+ay*sz*.5);
  CTX.lineTo(x-dx*sz-ax*sz*.5,y-dy*sz-ay*sz*.5);
  CTX.closePath(); CTX.fill();
}

function darken(hex,f){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-f))},${Math.round(g*(1-f))},${Math.round(b*(1-f))})`;
}

/* ══════════════════════════════════════════════════════
   INTERACCIÓN — ARRASTRE
   getPointerPos corrige escala CSS: factor=canvas.w/rect.w
══════════════════════════════════════════════════════ */
function getPointerPos(clientX,clientY){
  const rect=CV.getBoundingClientRect();
  return {
    cx:(clientX-rect.left)*(CV.width /rect.width),
    cy:(clientY-rect.top )*(CV.height/rect.height),
  };
}

function hitTest(cx,cy){
  if(running||gameOver||!B1) return null;
  /* punta del vector (radio 16px) */
  const tip=vecTipPx(B1);
  if(Math.hypot(cx-tip.x,cy-tip.y)<16) return 'v1';
  /* cuerpo de B1 (radio+8px) */
  const p1=w2c(B1.x,B1.y);
  if(Math.hypot(cx-p1.x,cy-p1.y)<B1.r*SCALE+8) return 'b1';
  return null;
}

function vecTipPx(b){
  const {x:px,y:py}=w2c(b.x,b.y);
  return { x:px+b.vx*SCALE*VEC_SCALE, y:py-b.vy*SCALE*VEC_SCALE };
}

function setupCanvasListeners(){
  CV.addEventListener('mousedown', onMDown);
  CV.addEventListener('mousemove', onMMove);
  CV.addEventListener('mouseup',   onMUp);
  CV.addEventListener('mouseleave',onMUp);
  CV.addEventListener('touchstart',onTStart,{passive:false});
  CV.addEventListener('touchmove', onTMove, {passive:false});
  CV.addEventListener('touchend',  onTEnd,  {passive:false});
}

function onMDown(e){
  if(running||gameOver) return;
  const {cx,cy}=getPointerPos(e.clientX,e.clientY);
  const hit=hitTest(cx,cy); if(!hit) return;
  startDrag(hit,cx,cy); CV.style.cursor='grabbing'; e.preventDefault();
}
function onMMove(e){
  const {cx,cy}=getPointerPos(e.clientX,e.clientY);
  if(!drag){ if(!running&&!gameOver) CV.style.cursor=hitTest(cx,cy)?'grab':'default'; return; }
  moveDrag(cx,cy); e.preventDefault();
}
function onMUp(){ drag=null; CV.style.cursor='default'; }

function onTStart(e){
  if(running||gameOver) return; e.preventDefault();
  const t=e.touches[0];
  const {cx,cy}=getPointerPos(t.clientX,t.clientY);
  const hit=hitTest(cx,cy); if(!hit) return;
  startDrag(hit,cx,cy);
}
function onTMove(e){
  if(!drag) return; e.preventDefault();
  const t=e.touches[0];
  const {cx,cy}=getPointerPos(t.clientX,t.clientY);
  moveDrag(cx,cy);
}
function onTEnd(){ drag=null; }

function startDrag(hit,cx,cy){
  let offX=0,offY=0;
  if(hit==='b1'){ const p=w2c(B1.x,B1.y); offX=cx-p.x; offY=cy-p.y; }
  drag={target:hit,offX,offY};
}

function moveDrag(cx,cy){
  if(!drag||!B1) return;
  const {target,offX,offY}=drag;
  if(target==='b1'){
    const {x:wx,y:wy}=c2w(cx-offX,cy-offY);
    B1.x=clampX(wx,BALL_R); B1.y=clampY(wy,BALL_R);
    ensureNoOverlap();
  } else {
    const {x:bpx,y:bpy}=w2c(B1.x,B1.y);
    let dvx= (cx-bpx)/(SCALE*VEC_SCALE);
    let dvy=-(cy-bpy)/(SCALE*VEC_SCALE);  /* flip Y */
    const spd=Math.hypot(dvx,dvy);
    if(spd>20){dvx=dvx/spd*20;dvy=dvy/spd*20;}
    B1.vx=dvx; B1.vy=dvy;
    const aDeg=Math.round(Math.atan2(dvy,dvx)*180/Math.PI);
    document.getElementById('v1').value=Math.min(20,spd).toFixed(1);
    document.getElementById('a1').value=aDeg;
    document.getElementById('a1-val').textContent=aDeg+'°';
  }
  initKE=KE(B1)+KE(B2);
  drawFrame(); updateStats();
}

/* ══════════════════════════════════════════════════════
   ESTADÍSTICAS
══════════════════════════════════════════════════════ */
function updateStats(){
  if(!B1||!B2) return;
  const v1s=Math.hypot(B1.vx,B1.vy), v2s=Math.hypot(B2.vx,B2.vy);
  const ke1=KE(B1),ke2=KE(B2),p1=MOM(B1),p2=MOM(B2);
  set('d-v1', `${v1s.toFixed(2)} m/s`);
  set('d-vx1',`${B1.vx.toFixed(2)} m/s`);
  set('d-vy1',`${B1.vy.toFixed(2)} m/s`);
  set('d-p1', `${p1.toFixed(2)} kg·m/s`);
  set('d-ke1',`${ke1.toFixed(2)} J`);
  set('d-v2', `${v2s.toFixed(2)} m/s`);
  set('d-vx2',`${B2.vx.toFixed(2)} m/s`);
  set('d-vy2',`${B2.vy.toFixed(2)} m/s`);
  set('d-p2', `${p2.toFixed(2)} kg·m/s`);
  set('d-ke2',`${ke2.toFixed(2)} J`);
  const ptx=B1.vx*B1.m+B2.vx*B2.m, pty=B1.vy*B1.m+B2.vy*B2.m;
  const pTot=Math.hypot(ptx,pty), keTot=ke1+ke2, dKE=keTot-initKE;
  set('d-ptot', `${pTot.toFixed(2)} kg·m/s`);
  set('d-ketot',`${keTot.toFixed(2)} J`);
  set('d-type', document.querySelector('input[name="ctype"]:checked')?.value==='elastic'?'Elástica':'Inelástica');
  const dkeEl=document.getElementById('d-dke');
  if(dkeEl){
    if(collided){dkeEl.textContent=`${dKE.toFixed(2)} J`; dkeEl.style.color=Math.abs(dKE)<0.08?'#4ADE80':'#F87171';}
    else{dkeEl.textContent='—'; dkeEl.style.color='';}
  }
}

function set(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}

/* ══════════════════════════════════════════════════════
   ARRANQUE
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  initHero();
  /* Establecer posición inicial de la tronera */
  goalPos={x:8.5, y:0};
  const sp=document.getElementById('page-simulator');
  if(sp&&sp.classList.contains('active')) requestAnimationFrame(initSimulator);
});
