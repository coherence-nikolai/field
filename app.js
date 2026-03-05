// ═══════════════════════════════════════
// FIELD — Unified App v2.0
// Observe · Collapse · Decohere
// ═══════════════════════════════════════

// ── STATE ──
let lang = localStorage.getItem('field_lang') || 'en';
let audioCtx = null, droneNodes = [], breathTimers = [], decBreathTimers = [];
let breathRunning = false, breathCycle = 0, curStateName = '', spChosen = 0;
let collapseStage = 0, isTransitioning = false, particlesHidden = false;
let totalObs = parseInt(localStorage.getItem('field_obs') || '0');
let currentMode = 'home';

// Observer state
let attentionTimer = null, attentionSec = 0, isCoherent = false;
let fieldActive = false, scatterTO = null, observeParticle = null;
const COHERENCE_SEC = 45;
const METER_DOTS = 9;

// Three-signal attention system
let isStill = true, lastMotionTime = 0, lastAffirmTime = 0;
let affirmBonus = 0; // extra seconds from affirmations
let microToneTimer = null;
let motionCheckInterval = null;

// Decohere state
let decStateName = '', decStateNameES = '';

// ── CANVAS ──
const cv = document.getElementById('cv');
const cx = cv.getContext('2d');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

function rsz() {
  if (isIOS) { cv.width = innerWidth; cv.height = innerHeight; }
  else {
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    cx.resetTransform(); cx.scale(dpr, dpr);
  }
}
window.addEventListener('resize', rsz); rsz();

// ── BACKGROUND PARTICLES ──
class Pt {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * innerWidth;
    this.y = init ? Math.random() * innerHeight : innerHeight + 5;
    this.vy = -(0.08 + Math.random() * 0.18);
    this.r = Math.random() * 0.9 + 0.2;
    this.alpha = Math.random() * 0.22 + 0.04;
    this.targetAlpha = this.alpha;
  }
  update() { this.y += this.vy; if (this.y < -5) this.reset(false); this.alpha += (this.targetAlpha - this.alpha) * 0.04; }
  draw() { cx.globalAlpha = this.alpha; cx.fillStyle = '#f0cc88';
    cx.beginPath(); cx.arc(this.x, this.y, this.r, 0, Math.PI*2); cx.fill(); cx.globalAlpha = 1; }
}
const bgPts = Array.from({length:70}, () => new Pt());

// ── SUPERPOSITION PARTICLES ──
class SpParticle {
  constructor(i, total) {
    this.idx = i;
    const angle = (Math.PI*2/total)*i + Math.random()*0.3;
    const r = 0.25 + Math.random()*0.12;
    this.cx = 0.5 + Math.cos(angle)*r; this.cy = 0.5 + Math.sin(angle)*r;
    this.targetCx = this.cx; this.targetCy = this.cy;
    this.x = this.cx*innerWidth; this.y = this.cy*innerHeight;
    this.ph = Math.random()*Math.PI*2;
    this.phV = 0.006 + Math.random()*0.005;
    this.driftR = 18 + Math.random()*14;
    this.r = 2.2 + Math.random()*1.2;
    this.alpha = 0; this.targetAlpha = 0.55;
    this.clarity = 0; this.targetClarity = 0;
    this._flickering = false;
  }
  update() {
    this.ph += this.phV;
    this.cx += (this.targetCx - this.cx) * 0.018;
    this.cy += (this.targetCy - this.cy) * 0.018;
    const ds = Math.min(innerWidth, innerHeight);
    this.x = this.cx*innerWidth + Math.cos(this.ph)*this.driftR*(ds/500);
    this.y = this.cy*innerHeight + Math.sin(this.ph*0.73)*this.driftR*0.65*(ds/500);
    const maxY = cv.height*(isIOS?1:1/((window.devicePixelRatio||1)))*0.24;
    if (this.y > maxY && this.targetCy < 0.22) this.targetCy -= 0.001;
    this.alpha += (this.targetAlpha - this.alpha) * 0.025;
    this.clarity += (this.targetClarity - this.clarity) * 0.03;
    if (this._flickering) {
      this.alpha = 0.3 + Math.random()*0.65;
      this.clarity = Math.random()*0.3;
    }
  }
  draw() {
    if (this.alpha < 0.01 || particlesHidden) return;
    const blur = (1-this.clarity)*4.5;
    const glow = 10 + this.clarity*28;
    cx.save();
    if (blur > 0.3) cx.filter = `blur(${blur.toFixed(1)}px)`;
    const grad = cx.createRadialGradient(this.x,this.y,0,this.x,this.y,glow);
    grad.addColorStop(0, `rgba(240,204,136,${(this.alpha*0.45).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(240,204,136,0)');
    cx.fillStyle = grad;
    cx.beginPath(); cx.arc(this.x,this.y,glow,0,Math.PI*2); cx.fill();
    cx.filter = 'none';
    cx.globalAlpha = this.alpha;
    cx.fillStyle = `rgba(240,204,136,${0.6+this.clarity*0.4})`;
    cx.beginPath(); cx.arc(this.x,this.y,this.r,0,Math.PI*2); cx.fill();
    cx.restore();
  }
}
let spParticles = [];

// ── OBSERVE PARTICLE ──
let clarityLevel = 0, particleVisible = false;
class ObsParticle {
  constructor() {
    this.cx = 0.5; this.cy = 0.5;
    this.x = innerWidth*0.5; this.y = innerHeight*0.5;
    this.ph = Math.random()*Math.PI*2;
    this.phV = 0.004 + Math.random()*0.003;
    this.driftR = 55 + Math.random()*35;
    this.r = 5; this.alpha = 0; this.targetAlpha = 0.9;
    this.breathPh = 0; // 0..2π for breathing glow
    this.scattering = false; this.scatterParts = [];
  }
  update() {
    this.ph += this.phV;
    this.breathPh += 0.017; // ~6s full breath cycle
    this.cx += (0.5-this.cx)*0.001; this.cy += (0.5-this.cy)*0.001;
    const ds = Math.min(innerWidth, innerHeight);
    // Device motion: particle drifts away when phone moves
    const motionFactor = isStill ? 1 : 0.5;
    this.x = this.cx*innerWidth + Math.cos(this.ph)*this.driftR*(ds/400)*motionFactor;
    this.y = this.cy*innerHeight + Math.sin(this.ph*0.67)*this.driftR*0.7*(ds/400)*motionFactor;
    this.alpha += (this.targetAlpha - this.alpha)*0.02;
  }
  draw() {
    if (this.alpha < 0.01) return;
    // Breathing glow — expands and contracts on 6s cycle
    const breathFactor = 0.7 + 0.3*Math.sin(this.breathPh);
    const stillFactor = isStill ? 1 : 0.4; // dims when phone moving
    const blur = (1-clarityLevel)*12;
    const r = this.r + clarityLevel*2;
    const glow = (18 + clarityLevel*40) * breathFactor;
    const ga = (0.15 + clarityLevel*0.35) * stillFactor;
    cx.save();
    if (blur > 0.5) cx.filter = `blur(${blur.toFixed(1)}px)`;
    const grad = cx.createRadialGradient(this.x,this.y,0,this.x,this.y,glow);
    grad.addColorStop(0, `rgba(240,204,136,${(ga*this.alpha).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(240,204,136,0)');
    cx.fillStyle = grad; cx.beginPath(); cx.arc(this.x,this.y,glow,0,Math.PI*2); cx.fill();
    cx.filter = 'none';
    cx.globalAlpha = this.alpha * stillFactor;
    cx.fillStyle = `rgba(240,204,136,${0.7+clarityLevel*0.3})`;
    cx.beginPath(); cx.arc(this.x,this.y,r,0,Math.PI*2); cx.fill();
    cx.restore();
  }
  scatter() {
    this.scattering = true; this.scatterParts = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI*2/12)*i + Math.random()*0.4;
      const speed = 1.5 + Math.random()*2.5;
      this.scatterParts.push({x:this.x, y:this.y,
        vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        alpha:0.7+Math.random()*0.3, r:1.5+Math.random()*2});
    }
    this.targetAlpha = 0;
    setTimeout(() => {
      this.scattering = false; this.scatterParts = [];
      this.cx = 0.5; this.cy = 0.5; this.ph = Math.random()*Math.PI*2;
      this.targetAlpha = 0.9;
    }, 1200);
  }
  drawScatter() {
    this.scatterParts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.alpha *= 0.93;
      if (p.alpha < 0.01) return;
      cx.globalAlpha = p.alpha; cx.fillStyle = 'rgba(240,204,136,0.8)';
      cx.beginPath(); cx.arc(p.x,p.y,p.r,0,Math.PI*2); cx.fill();
    });
    cx.globalAlpha = 1;
  }
}

// ── RENDER LOOP ──
function loop() {
  cx.clearRect(0, 0, cv.width, cv.height);
  bgPts.forEach(p => { p.update(); p.draw(); });
  if (currentMode === 'observe' && particleVisible && observeParticle) {
    observeParticle.update();
    if (observeParticle.scattering) observeParticle.drawScatter();
    else observeParticle.draw();
  }
  if ((currentMode === 'collapse' || currentMode === 'home' || currentMode === 'decohere') && spParticles.length) {
    spParticles.forEach(p => { p.update(); p.draw(); });
  }
  requestAnimationFrame(loop);
}
loop();

// ── AUDIO ──
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
}
function playDrone() {
  if (!audioCtx || droneNodes.length) return;
  [432,216,144,108].forEach((f,i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.022-i*0.004, audioCtx.currentTime+3);
    o.connect(g); g.connect(audioCtx.destination); o.start();
    droneNodes.push({o, g});
  });
}
function fadeDrone(out=true, dur=2) {
  if (!audioCtx || !droneNodes.length) return;
  droneNodes.forEach(({g}) => {
    const now = audioCtx.currentTime, cur = g.gain.value;
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(cur, now);
    g.gain.linearRampToValueAtTime(out ? 0 : 0.022, now+dur);
  });
  if (out) setTimeout(() => { droneNodes.forEach(({o}) => { try{o.stop();}catch(e){} }); droneNodes = []; }, (dur+0.2)*1000);
}
function tryDrone() {
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') { audioCtx.resume().then(playDrone); return; }
  playDrone();
}
function playCollapseSound() {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(220, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime+1);
  g.gain.setValueAtTime(0, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime+0.2);
  g.gain.linearRampToValueAtTime(0, audioCtx.currentTime+1.6);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+2);
  const b = audioCtx.createOscillator(), bg = audioCtx.createGain();
  b.type = 'sine'; b.frequency.value = 1320;
  bg.gain.setValueAtTime(0, audioCtx.currentTime+0.75);
  bg.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime+0.85);
  bg.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+3.5);
  b.connect(bg); bg.connect(audioCtx.destination);
  b.start(audioCtx.currentTime+0.75); b.stop(audioCtx.currentTime+4);
}
function playExhaleCollapse() {
  if (!audioCtx) return;
  [528,1056,1584].forEach((f,i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + i*0.05;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.055-i*0.015, t0+0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+5.5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0+6);
  });
}
function playObsCoherenceTone() {
  if (!audioCtx) return;
  [660,1320].forEach((f,i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + i*0.08;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.06-i*0.02, t0+0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0+5.5);
  });
}
// Micro-tone: barely-there harmonic shimmer every ~12s when coherent
function playMicroTone() {
  if (!audioCtx || !fieldActive || isCoherent) return;
  const freq = isStill ? 660 : 550; // higher when still, lower when drifting
  [freq, freq*2].forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + i*0.06;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.018 - i*0.006, t0+0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+3);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0+3.5);
  });
}
function playAffirmSound() {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.value = 792;
  g.gain.setValueAtTime(0, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime+0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+1.2);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+1.5);
}
function playDecohereRelease() {
  if (!audioCtx) return;
  [396, 180, 90].forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + i*0.15;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.05 - i*0.012, t0+0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+6);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0+7);
  });
}
function playScatterSound() {
  if (!audioCtx) return;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate*0.3, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
  const src = audioCtx.createBufferSource(), g = audioCtx.createGain();
  src.buffer = buf; g.gain.setValueAtTime(0.04, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.3);
  src.connect(g); g.connect(audioCtx.destination); src.start();
}

// ── SCREEN TRANSITIONS — smooth, no flashes ──
function showScreen(id, postCb) {
  const next = document.getElementById(id);
  const current = document.querySelector('.screen.active');
  if (current === next) { if (postCb) postCb(); return; }
  // Fade out current
  if (current) {
    current.style.transition = 'opacity 0.7s ease';
    current.style.opacity = '0';
    setTimeout(() => {
      current.classList.remove('active');
      current.style.opacity = '';
      current.style.transition = '';
    }, 720);
  }
  // Fade in next after short delay
  setTimeout(() => {
    next.style.opacity = '0';
    next.style.transition = 'none';
    next.classList.add('active');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      next.style.transition = 'opacity 0.8s ease';
      next.style.opacity = '1';
      setTimeout(() => {
        next.style.opacity = '';
        next.style.transition = '';
        if (postCb) postCb();
      }, 820);
    }));
  }, 400);
}

// ── LANG ──
function toggleLang() {
  lang = lang === 'en' ? 'es' : 'en';
  localStorage.setItem('field_lang', lang);
  applyLang();
}
function applyLang() {
  const t = TRANSLATIONS[lang];
  document.getElementById('langBtn').textContent = lang === 'en' ? 'EN / ES' : 'ES / EN';
  document.getElementById('homeFieldSub').textContent = t.fieldSub;
  document.getElementById('mvObserveLabel').textContent = t.observeLabel;
  document.getElementById('mvCollapseLabel').textContent = t.collapseLabel;
  document.getElementById('mvDecohereLabel').textContent = t.decohere_label;
  document.getElementById('mvObserveHint').textContent = t.observeHint;
  document.getElementById('mvCollapseHint').textContent = t.collapseHint;
  document.getElementById('mvDecohereHint').textContent = t.decohereHint;
  document.getElementById('retBtn').textContent = t.retBtn;
  document.getElementById('decRetBtn').textContent = t.decRetBtn;
  document.getElementById('decAgainBtn').textContent = t.decAgainBtn;
  document.getElementById('obsCohWord').textContent = t.obsCoherenceWord;
  document.getElementById('obsCohLine').innerHTML = t.obsCoherenceLine.replace(/\n/g,'<br>');
  document.getElementById('obsCohTap').textContent = t.obsCoherenceTap;
  document.getElementById('revisitBtn').textContent = 'revisit introduction';
  updateHomeCount();
}
function updateHomeCount() {
  const n = parseInt(localStorage.getItem('field_obs')||'0');
  const t = TRANSLATIONS[lang];
  const el = document.getElementById('homeCount');
  if (el) el.textContent = n > 0 ? t.obsCount(n) : '';
}

// ── HOME ──
function goHome() {
  currentMode = 'home';
  clearAllBreath(); clearObserver(); clearAllDec();
  fadeDrone(true, 1.5);
  particlesHidden = false; collapseStage = 0; breathRunning = false;
  document.querySelectorAll('.cp-stage').forEach(s => { s.classList.remove('on'); s.style.cssText = ''; });
  document.getElementById('backBtn').style.opacity = '0';
  document.getElementById('backBtn').style.pointerEvents = 'none';
  document.querySelectorAll('.al').forEach(a => a.classList.remove('on'));
  spParticles = []; particleVisible = false;
  showScreen('s-home', () => {
    setTimeout(() => { initSpParticles(12); tryDrone(); }, 200);
    document.querySelectorAll('.al').forEach(a => a.classList.add('on'));
  });
  updateHomeCount();
}
function initSpParticles(n) {
  spParticles = Array.from({length:n}, (_,i) => new SpParticle(i,n));
  spParticles.forEach(p => { p.targetAlpha = 0.4+Math.random()*0.3; p.targetClarity = 0; });
}
function showBackBtn() {
  document.getElementById('backBtn').style.opacity = '1';
  document.getElementById('backBtn').style.pointerEvents = 'all';
}

// ══════════════════════════════════════
// OBSERVE MOVEMENT — three-signal attention
// ══════════════════════════════════════

function buildObsScreen() {
  const screen = document.getElementById('s-observe');
  screen.innerHTML = `
    <div id="obs-hint-txt" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;opacity:0;transition:opacity 2s ease;z-index:20;">
      <div style="font-size:clamp(26px,7vw,38px);font-weight:300;letter-spacing:.12em;color:rgba(201,169,110,.55);margin-bottom:16px;">◎</div>
      <div style="font-size:clamp(11px,2.8vw,14px);letter-spacing:.12em;color:rgba(240,230,208,.45);line-height:1.8;">
        ${lang==='en'?'One particle.<br>Just watch it.':'Una partícula.<br>Solo obsérvala.'}
      </div>
    </div>
    <div id="clarity-ring"></div>
    <div id="obs-signals" style="position:fixed;bottom:90px;left:50%;transform:translateX(-50%);display:flex;gap:20px;align-items:flex-end;opacity:0;transition:opacity 2s ease;z-index:20;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div class="sig-dot" id="sig-still"></div>
        <div class="sig-label">${lang==='en'?'still':'quieto'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div class="sig-dot" id="sig-present"></div>
        <div class="sig-label">${lang==='en'?'present':'presente'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div class="sig-dot" id="sig-affirm"></div>
        <div class="sig-label">${lang==='en'?'here':'aquí'}</div>
      </div>
    </div>
    <div id="meter" style="position:fixed;bottom:46px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;z-index:20;opacity:0;transition:opacity 2s ease;"></div>
    <div id="scatter-text" style="position:fixed;top:38%;left:50%;transform:translateX(-50%);font-size:clamp(11px,2.8vw,13px);letter-spacing:.14em;color:rgba(240,230,208,.45);white-space:nowrap;opacity:0;transition:opacity 1s ease;z-index:20;"></div>
    <button id="affirmBtn" onclick="doAffirm()" style="position:fixed;bottom:130px;right:clamp(24px,6vw,48px);width:48px;height:48px;border-radius:50%;background:none;border:1px solid rgba(201,169,110,.15);cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 2s ease,border-color .3s ease,box-shadow .3s ease;z-index:30;">
      <div id="affirmDot" style="width:8px;height:8px;border-radius:50%;background:rgba(201,169,110,.4);transition:transform .3s ease,background .3s ease;animation:affirmPulse 3s ease-in-out infinite;"></div>
    </button>
  `;
  buildObsMeter();
}

function buildObsMeter() {
  const m = document.getElementById('meter'); if (!m) return;
  m.innerHTML = '';
  for (let i = 0; i < METER_DOTS; i++) {
    const d = document.createElement('div'); d.className = 'mdot'; d.id = 'mdot'+i; m.appendChild(d);
  }
}

function updateObsMeter() {
  const progress = Math.min((attentionSec + affirmBonus) / COHERENCE_SEC, 1);
  const lit = Math.floor(progress * METER_DOTS);
  for (let i = 0; i < METER_DOTS; i++) {
    const d = document.getElementById('mdot'+i);
    if (d) d.classList.toggle('lit', i < lit);
  }
  clarityLevel = Math.min(progress, 1);
  updateClarityRing();
  // Update signal dots
  updateSignalDots();
}

function updateSignalDots() {
  const ss = document.getElementById('sig-still');
  const sp = document.getElementById('sig-present');
  const sa = document.getElementById('sig-affirm');
  if (ss) ss.style.background = isStill ? 'var(--gold)' : 'rgba(201,169,110,.18)';
  if (ss) ss.style.boxShadow = isStill ? '0 0 8px rgba(201,169,110,.6)' : 'none';
  // Present = particle alpha above threshold (proxy: clarity building)
  const isPresent = clarityLevel > 0.05 && isStill;
  if (sp) sp.style.background = isPresent ? 'var(--gold)' : 'rgba(201,169,110,.18)';
  if (sp) sp.style.boxShadow = isPresent ? '0 0 8px rgba(201,169,110,.6)' : 'none';
  // Affirm = recent tap
  const recentAffirm = Date.now() - lastAffirmTime < 4000;
  if (sa) sa.style.background = recentAffirm ? 'rgba(240,204,136,.9)' : 'rgba(201,169,110,.18)';
  if (sa) sa.style.boxShadow = recentAffirm ? '0 0 12px rgba(240,204,136,.7)' : 'none';
}

function updateClarityRing() {
  const ring = document.getElementById('clarity-ring'); if (!ring) return;
  const c = clarityLevel;
  if (c < 0.05) { ring.style.borderColor = 'rgba(201,169,110,0)'; ring.style.boxShadow = 'none'; return; }
  const s = 100 + c*30, m = -(50+c*15);
  ring.style.width = s+'px'; ring.style.height = s+'px';
  ring.style.marginLeft = m+'px'; ring.style.marginTop = m+'px';
  ring.style.borderColor = `rgba(201,169,110,${(c*0.3).toFixed(3)})`;
  ring.style.boxShadow = `0 0 ${20+c*40}px rgba(201,169,110,${(c*0.15).toFixed(3)})`;
}

function startObserve() {
  currentMode = 'observe'; showBackBtn(); initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  fadeDrone(true, 1); spParticles = [];
  buildObsScreen();
  // Subtle observe drone
  setTimeout(() => {
    if (!droneNodes.length && currentMode === 'observe') {
      [40,80,120].forEach((f,i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0.015-i*0.004, audioCtx.currentTime+3);
        o.connect(g); g.connect(audioCtx.destination); o.start();
        droneNodes.push({o, g});
      });
    }
  }, 1200);
  isCoherent = false; fieldActive = false; attentionSec = 0; affirmBonus = 0; clarityLevel = 0;
  isStill = true; lastAffirmTime = 0;
  observeParticle = new ObsParticle(); particleVisible = true;
  showScreen('s-observe', () => {
    // Fade in hint
    setTimeout(() => {
      const hint = document.getElementById('obs-hint-txt');
      if (hint) hint.style.opacity = '1';
    }, 600);
    // Fade hint out, show signals and meter
    setTimeout(() => {
      const hint = document.getElementById('obs-hint-txt');
      if (hint) { hint.style.transition = 'opacity 1.5s ease'; hint.style.opacity = '0'; }
    }, 3500);
    setTimeout(() => {
      if (currentMode !== 'observe') return;
      fieldActive = true;
      startAttentionTimer();
      startMicroTones();
      startMotionCheck();
      const sigs = document.getElementById('obs-signals');
      const meter = document.getElementById('meter');
      const btn = document.getElementById('affirmBtn');
      if (sigs) sigs.style.opacity = '1';
      if (meter) meter.style.opacity = '1';
      if (btn) btn.style.opacity = '1';
    }, 4500);
  });
}

function startAttentionTimer() {
  clearInterval(attentionTimer);
  attentionTimer = setInterval(() => {
    if (!fieldActive || isCoherent) return;
    if (isStill) attentionSec++;
    // Meter only advances when still
    updateObsMeter();
    if (attentionSec + affirmBonus >= COHERENCE_SEC) reachObsCoherence();
  }, 1000);
}

function startMicroTones() {
  clearInterval(microToneTimer);
  microToneTimer = setInterval(() => {
    if (fieldActive && !isCoherent && currentMode === 'observe') playMicroTone();
  }, 12000);
}

function startMotionCheck() {
  clearInterval(motionCheckInterval);
  motionCheckInterval = setInterval(() => {
    if (currentMode !== 'observe') return;
    const timeSinceMotion = Date.now() - lastMotionTime;
    const wasStill = isStill;
    isStill = timeSinceMotion > 1800; // still if no motion for 1.8s
    if (!wasStill && isStill) {
      // Became still — particle returns
      if (observeParticle) { observeParticle.cx = 0.5; observeParticle.cy = 0.5; }
    }
    updateSignalDots();
  }, 300);
}

// Affirmation button
function doAffirm() {
  if (!fieldActive || isCoherent) return;
  lastAffirmTime = Date.now();
  affirmBonus = Math.min(affirmBonus + 1.5, 12); // max 12s bonus from affirmations
  playAffirmSound();
  if (navigator.vibrate) navigator.vibrate(18);
  // Visual bloom on button
  const btn = document.getElementById('affirmBtn');
  const dot = document.getElementById('affirmDot');
  if (btn) { btn.style.borderColor = 'rgba(201,169,110,.6)'; btn.style.boxShadow = '0 0 16px rgba(201,169,110,.35)'; }
  if (dot) { dot.style.transform = 'scale(2.2)'; dot.style.background = 'rgba(240,204,136,.9)'; }
  // Clarity ring flash
  const ring = document.getElementById('clarity-ring');
  if (ring) { ring.style.boxShadow = `0 0 ${40+clarityLevel*60}px rgba(201,169,110,.4)`; }
  setTimeout(() => {
    if (btn) { btn.style.borderColor = ''; btn.style.boxShadow = ''; }
    if (dot) { dot.style.transform = ''; dot.style.background = ''; }
    if (ring) ring.style.boxShadow = '';
    updateSignalDots();
  }, 600);
  updateObsMeter();
  if (attentionSec + affirmBonus >= COHERENCE_SEC) reachObsCoherence();
}

function obsScatter() {
  if (isCoherent || !fieldActive) return;
  if (observeParticle) observeParticle.scatter();
  playScatterSound();
  attentionSec = 0; affirmBonus = 0;
  updateObsMeter(); clarityLevel = 0;
  const st = document.getElementById('scatter-text');
  if (st) { st.textContent = TRANSLATIONS[lang].obsScatter; st.style.opacity = '1'; }
  clearTimeout(scatterTO);
  scatterTO = setTimeout(() => { if (st) st.style.opacity = '0'; }, 2500);
}

function reachObsCoherence() {
  isCoherent = true; clearInterval(attentionTimer); clearInterval(microToneTimer); clearInterval(motionCheckInterval);
  clarityLevel = 1; updateClarityRing(); playObsCoherenceTone(); fadeDrone(true, 3);
  // Hide signals
  ['obs-signals','meter','affirmBtn','scatter-text','obs-hint-txt'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.style.transition = 'opacity 1.5s ease'; el.style.opacity = '0'; }
  });
  // Count
  const n = parseInt(localStorage.getItem('field_obs')||'0') + 1;
  localStorage.setItem('field_obs', n); totalObs = n;
  setTimeout(() => {
    particleVisible = false;
    document.getElementById('obsCohWord').textContent = TRANSLATIONS[lang].obsCoherenceWord;
    document.getElementById('obsCohLine').innerHTML = TRANSLATIONS[lang].obsCoherenceLine.replace(/\n/g,'<br>');
    document.getElementById('obsCohTap').textContent = TRANSLATIONS[lang].obsCoherenceTap;
    showScreen('s-obs-coherence');
  }, 2200);
}

function clearObserver() {
  clearInterval(attentionTimer); clearInterval(microToneTimer); clearInterval(motionCheckInterval);
  fieldActive = false; isCoherent = false;
  particleVisible = false; attentionSec = 0; affirmBonus = 0; clarityLevel = 0;
  isStill = true;
  clearTimeout(scatterTO);
}

// Device motion
if (window.DeviceMotionEvent) {
  window.addEventListener('devicemotion', e => {
    if (currentMode !== 'observe' || !fieldActive || isCoherent) return;
    const a = e.acceleration; if (!a) return;
    const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2);
    if (mag > 2.5) {
      lastMotionTime = Date.now();
      isStill = false;
      // Scatter if heavy shake
      if (mag > 6 && Date.now() - lastMotionTime > 1500) obsScatter();
    }
  });
}

// Tap observe screen to scatter (not on chrome or affirmBtn)
document.getElementById('s-observe').addEventListener('click', e => {
  if (e.target.closest('#chrome') || e.target.closest('#affirmBtn')) return;
  if (fieldActive && !isCoherent) obsScatter();
});
document.getElementById('s-observe').addEventListener('touchend', e => {
  if (e.target.closest('#chrome') || e.target.closest('#affirmBtn')) return;
  e.preventDefault();
  if (fieldActive && !isCoherent) obsScatter();
});

// ══════════════════════════════════════
// COLLAPSE MOVEMENT
// ══════════════════════════════════════
let stepIndex = 0;
function startCollapse() {
  currentMode = 'collapse'; showBackBtn();
  spParticles = []; fadeDrone(true, 1);
  const visited = localStorage.getItem('field_visited');
  if (visited) {
    setTimeout(() => { tryDrone(); buildCollapseField(); showScreen('s-field'); }, 200);
  } else {
    localStorage.setItem('field_visited', '1');
    buildInit(); showScreen('s-init');
  }
}
function revisitIntro() { buildInit(); showScreen('s-init'); }

function buildInit() {
  const t = TRANSLATIONS[lang]; stepIndex = 0;
  const cont = document.getElementById('s-init'); cont.innerHTML = '';
  const steps = STEPS[lang];
  const dotsCont = document.createElement('div'); dotsCont.className = 'sdots';
  steps.forEach((_,i) => {
    const d = document.createElement('div'); d.className = 'sdot'; d.id = 'sdot'+i; dotsCont.appendChild(d);
  });
  cont.appendChild(dotsCont);
  steps.forEach((s,i) => {
    const div = document.createElement('div'); div.className = 'step'+(i===0?' on':''); div.id = 'step'+i;
    const big = document.createElement('div'); big.className = 's-main'; big.innerHTML = s.big.replace(/\n/g,'<br>'); div.appendChild(big);
    if (s.small) { const sm = document.createElement('div'); sm.className = 's-sup'; sm.innerHTML = s.small.replace(/\n/g,'<br>'); div.appendChild(sm); }
    if (s.note) { const nt = document.createElement('div'); nt.className = 'sci-note'; nt.innerHTML = s.note; div.appendChild(nt); }
    cont.appendChild(div);
  });
  const hint = document.createElement('div'); hint.id = 'taph'; hint.textContent = t.tapHint;
  hint.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);font-size:var(--fl);letter-spacing:.14em;color:rgba(201,169,110,.38);animation:pulse 2.8s ease-in-out infinite;pointer-events:none;z-index:20;white-space:nowrap;font-weight:300;';
  cont.appendChild(hint);
  updateInitScene();
}
function advanceStep() {
  if (isTransitioning) return;
  const steps = STEPS[lang];
  if (stepIndex < steps.length-1) {
    document.getElementById('step'+stepIndex).classList.remove('on');
    stepIndex++;
    document.getElementById('step'+stepIndex).classList.add('on');
    document.querySelectorAll('.sdot').forEach((d,i) => d.classList.toggle('on', i<=stepIndex));
    updateInitScene();
  } else {
    tryDrone(); buildCollapseField(); showScreen('s-field');
  }
}
function updateInitScene() {
  const ps = STEPS[lang][stepIndex]?.ps; initScene(ps||'sp');
}
function initScene(scene, chosen) {
  const n = 12;
  if (!spParticles.length) spParticles = Array.from({length:n}, (_,i) => new SpParticle(i,n));
  switch(scene) {
    case 'sp': spParticles.forEach(p => { p.targetAlpha=0.35+Math.random()*0.3; p.targetClarity=0; p._flickering=false; }); break;
    case 'one': spParticles.forEach((p,i) => { p.targetAlpha=i===0?0.9:0.05; p.targetClarity=i===0?1:0; p._flickering=false; }); if(spParticles[0]){spParticles[0].targetCx=0.5;spParticles[0].targetCy=0.14;} break;
    case 'all_labelled': spParticles.forEach(p => { p.targetAlpha=0.45; p.targetClarity=0.1; p._flickering=false; }); break;
    case 'flicker': spParticles.forEach((p,i) => { if(i===chosen||i===0){p._flickering=true;p.targetAlpha=0.8;} else{p.targetAlpha=0.05;p._flickering=false;} }); break;
    case 'crystallise': spParticles.forEach((p,i) => { p._flickering=false; if(i===chosen||i===0){p.targetAlpha=1;p.targetClarity=1;} else{p.targetAlpha=0.05;p.targetClarity=0;} }); break;
    case 'collapse_demo': spParticles.forEach((p,i) => { p._flickering=false; p.targetAlpha=i===0?1:0.05; p.targetClarity=i===0?1:0; }); if(spParticles[0]){spParticles[0].targetCx=0.5;spParticles[0].targetCy=0.14;} break;
    case 'stab': spParticles.forEach(p => { p.targetAlpha=0.6; p.targetClarity=0.7; p._flickering=false; }); break;
    case 'done': spParticles.forEach(p => { p.targetAlpha=0.55; p.targetClarity=0.5; p._flickering=false; }); break;
    case 'field': spParticles.forEach(p => { p.targetAlpha=0.35+Math.random()*0.25; p.targetClarity=0; p._flickering=false; }); break;
    case 'state_chosen': spParticles.forEach((p,i) => { p._flickering=false; if(i===chosen%spParticles.length){p.targetAlpha=1;p.targetClarity=1;} else{p.targetAlpha=0.04;p.targetClarity=0;} }); break;
  }
}
function buildCollapseField() {
  const t = TRANSLATIONS[lang];
  document.getElementById('fline').textContent = t.fieldLine;
  document.getElementById('stillTxt').innerHTML = t.stillTxt.replace(/\n/g,'<br>');
  document.getElementById('stillBack').textContent = t.retBtn;
  document.getElementById('obsCt').textContent = totalObs > 0 ? t.obsCount(totalObs) : '';
  document.getElementById('revisitBtn').textContent = 'revisit introduction';
  const grid = document.getElementById('grid'); grid.innerHTML = '';
  STATES[lang].forEach((st,idx) => {
    const o = document.createElement('div'); o.className = 'orb';
    const driftDur = (2.8+Math.random()*2.4).toFixed(2)+'s';
    const orbpDelay = (-Math.random()*6).toFixed(2)+'s';
    o.style.cssText = `--drift-dur:${driftDur};animation-delay:${orbpDelay};`;
    const len = st.name.length;
    const size = len<=5?'var(--fwm)':len<=7?'clamp(22px,5.5vw,30px)':len<=8?'clamp(18px,4.6vw,25px)':'clamp(15px,3.8vw,20px)';
    o.innerHTML = `<div class="oname" style="font-size:${size}">${st.name}</div>`;
    const go = () => {
      document.querySelectorAll('.orb').forEach(el => { el.classList.remove('collapsing'); el.classList.add('fading'); });
      o.classList.remove('fading'); o.classList.add('collapsing');
      spChosen = idx; setTimeout(() => selectState(st), 320);
    };
    o.addEventListener('click', go);
    o.addEventListener('touchend', e => { e.preventDefault(); go(); });
    grid.appendChild(o);
  });
  document.querySelectorAll('.orb').forEach(el => { el.classList.remove('collapsing','fading'); el.style.filter=''; el.style.opacity=''; });
  document.querySelectorAll('.al').forEach(a => a.classList.add('on'));
  particlesHidden = false; initScene('field');
}
function selectState(state) {
  if (isTransitioning) return;
  if (navigator.vibrate) navigator.vibrate(38);
  initAudio(); if(audioCtx.state==='suspended') audioCtx.resume();
  playCollapseSound();
  const b = document.getElementById('burst');
  b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  const t = TRANSLATIONS[lang];
  curStateName = state.name;
  document.getElementById('cword').textContent = state.name;
  document.getElementById('cword5').textContent = state.name;
  const wl = state.name.length;
  const fs = wl<=5?'clamp(40px,12vw,72px)':wl<=7?'clamp(34px,10vw,60px)':wl<=9?'clamp(26px,8vw,46px)':wl<=11?'clamp(20px,6vw,34px)':'clamp(16px,5vw,26px)';
  ['cword','cword5'].forEach(id => { const el = document.getElementById(id); if(el) el.style.fontSize = fs; });
  document.getElementById('cLabel1').textContent = t.cLabel;
  document.getElementById('cSub1').textContent = t.cSub;
  document.getElementById('ceqNote').textContent = state.eq;
  document.getElementById('imagPrompt').textContent = getImagination(lang, state.name);
  document.getElementById('imagLabel3').textContent = t.imagLabel;
  const n = parseInt(localStorage.getItem('field_st_'+lang+'_'+state.name)||'0') + 1;
  localStorage.setItem('field_st_'+lang+'_'+state.name, n);
  totalObs++; localStorage.setItem('field_obs', totalObs);
  document.getElementById('obsNote').innerHTML = n===1 ? t.obsFirst(state.name) : t.obsMany(state.name,n);
  document.getElementById('obsNote5').innerHTML = n===1 ? t.obsFirst(state.name) : t.obsMany(state.name,n);
  document.getElementById('closing').style.opacity = '0'; document.getElementById('closing').textContent = '';
  document.getElementById('qlabel6').textContent = t.qlabel;
  const chosen = spParticles[spChosen%Math.max(spParticles.length,1)];
  if (chosen) { chosen.cx=0.5; chosen.cy=0.14; chosen.x=0.5*innerWidth; chosen.y=0.14*innerHeight; }
  initScene('state_chosen', spChosen);
  collapseStage = 0;
  document.querySelectorAll('.cp-stage').forEach(s => { s.classList.remove('on'); s.style.cssText=''; });
  clearAllBreath();
  document.getElementById('tapNext').textContent = t.tapHint;
  particlesHidden = false;
  fadeDrone(true, 1.5);
  showScreen('s-collapse', () => {
    document.getElementById('ghosts').style.opacity = '1';
    buildGhosts(state.name);
    setTimeout(() => showCollapseStage(1), 300);
  });
}
function buildGhosts(chosen) {
  const gh = document.getElementById('ghosts'); gh.innerHTML = '';
  STATES[lang].filter(s => s.name !== chosen).forEach(s => {
    const el = document.createElement('div'); el.className = 'gst'; el.textContent = s.name;
    el.style.left = Math.random()*85+'%'; el.style.top = Math.random()*85+'%';
    el.style.animationDelay = (Math.random()*4)+'s'; gh.appendChild(el);
  });
  gh.style.opacity = '1';
}
function showCollapseStage(n) {
  const current = document.querySelector('.cp-stage.on');
  if (n===4) { particlesHidden = true; }
  else if (n===5) {
    const bp = document.getElementById('bp');
    const chosen = spParticles[spChosen%Math.max(spParticles.length,1)];
    if (chosen) { chosen.cx=0.5; chosen.cy=0.5; chosen.targetCx=0.5; chosen.targetCy=0.14; chosen.x=0.5*innerWidth; chosen.y=0.5*innerHeight; chosen.targetAlpha=1; chosen.targetClarity=1; chosen._flickering=false; }
    particlesHidden = false; initScene('state_chosen', spChosen);
    bp.style.transition = 'opacity 1.2s ease'; bp.style.opacity = '0';
    setTimeout(() => { bp.className='bp neutral'; bp.style.opacity=''; bp.style.transition=''; }, 1300);
  } else { particlesHidden = false; initScene('state_chosen', spChosen); }
  const reveal = () => {
    collapseStage = n; const el = document.getElementById('cs'+n); if (!el) return;
    el.style.cssText = 'opacity:0;pointer-events:none;transition:none;visibility:hidden;';
    el.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.visibility = 'visible'; el.style.transition = 'opacity 0.9s ease';
      el.style.opacity = '1'; el.style.pointerEvents = 'all';
      setTimeout(() => { el.style.cssText = ''; }, 950);
    }));
    const tapEl = document.getElementById('tapNext');
    tapEl.style.transition = 'opacity 0.7s ease';
    tapEl.style.opacity = n<6 ? '1' : '0';
    if (n===4) startBreath();
  };
  if (current) {
    current.style.transition = 'opacity 0.7s ease'; current.style.opacity = '0'; current.style.pointerEvents = 'none';
    setTimeout(() => { current.classList.remove('on'); current.style.cssText='opacity:0;visibility:hidden;display:none;'; reveal(); }, 750);
  } else reveal();
}
document.getElementById('s-collapse').addEventListener('click', e => {
  if (e.target.id==='retBtn'||e.target.classList.contains('return-btn')) return;
  if (e.target.closest('#chrome')) return;
  if (collapseStage===4 && breathRunning) return;
  if (collapseStage<6) showCollapseStage(collapseStage+1);
});
document.getElementById('retBtn').addEventListener('click', () => {
  clearAllBreath(); particlesHidden = false; collapseStage = 0;
  document.querySelectorAll('.cp-stage').forEach(s => { s.classList.remove('on'); s.style.cssText=''; });
  document.getElementById('ghosts').style.opacity = '0';
  setTimeout(() => { document.getElementById('ghosts').innerHTML=''; }, 900);
  showScreen('s-field', () => { buildCollapseField(); tryDrone(); });
});

// Breath
function bDelay(fn,ms){ const t=setTimeout(fn,ms); breathTimers.push(t); return t; }
function clearAllBreath(){ breathTimers.forEach(clearTimeout); breathTimers=[]; breathRunning=false; }
function startBreath() {
  clearAllBreath(); breathRunning=true; breathCycle=0;
  const stateName=curStateName, t=TRANSLATIONS[lang];
  const p=document.getElementById('bp'), ripple=document.getElementById('bripple');
  const btext=document.getElementById('btext');
  p.className='bp neutral'; btext.style.opacity='0'; btext.textContent=''; btext.className='btext';
  ripple.classList.remove('expand');
  [0,1,2].forEach(i=>{ const d=document.getElementById('bdot'+i); if(d) d.classList.remove('done'); });
  function showText(text,cls,delayMs){
    bDelay(()=>{
      btext.style.transition='opacity 0.6s ease'; btext.style.opacity='0';
      bDelay(()=>{ btext.className='btext'+(cls?' '+cls:''); btext.textContent=text; btext.style.transition='opacity 0.8s ease'; btext.style.opacity='1'; }, 650);
    }, delayMs||0);
  }
  function hideText(delayMs){ bDelay(()=>{ btext.style.transition='opacity 0.7s ease'; btext.style.opacity='0'; }, delayMs||0); }
  const p1=lang==='en'?'inhale — return to the open field':'inhala — regresa al campo abierto';
  const p2=lang==='en'?'exhale — collapse into '+stateName:'exhala — colapsa hacia '+stateName;
  showText(p1,'dim',0); showText(p2,'dim',5000); hideText(10500); bDelay(cycle,11500);
  function cycle(){
    if(breathCycle>=3){
      breathRunning=false;
      bDelay(()=>{ btext.style.transition='opacity 0.9s ease'; btext.style.opacity='0'; p.className='bp crystallised'; const tapEl=document.getElementById('tapNext'); bDelay(()=>{ tapEl.style.transition='opacity 0.8s ease'; tapEl.style.opacity='1'; },1800); },700);
      return;
    }
    breathCycle++;
    showText(t.breathInhale,'',0);
    bDelay(()=>{ p.className='bp inhaling'; ripple.classList.remove('expand'); void ripple.offsetWidth; },100);
    showText(t.breathHold,'',4500);
    bDelay(()=>{ p.className='bp holding'; },4500);
    showText(stateName,'gold',7300);
    bDelay(()=>{ p.className='bp exhaling'; ripple.classList.remove('expand'); void ripple.offsetWidth; ripple.classList.add('expand'); playExhaleCollapse(); },7300);
    hideText(11800);
    bDelay(()=>{ const dot=document.getElementById('bdot'+(breathCycle-1)); if(dot) dot.classList.add('done'); p.className='bp neutral'; },11800);
    bDelay(cycle,12800);
  }
}

function goStill() {
  const t = TRANSLATIONS[lang];
  document.getElementById('stillTxt').innerHTML = t.stillTxt.replace(/\n/g,'<br>');
  showScreen('s-still');
  document.getElementById('stillBack').onclick = () => goHome();
}

// ══════════════════════════════════════
// DECOHERE MOVEMENT — somatic release
// ══════════════════════════════════════

function startDecohere() {
  currentMode = 'decohere'; showBackBtn();
  fadeDrone(true, 1.5); spParticles = [];
  // Weight the field — slow heavy particles
  setTimeout(() => {
    initSpParticles(10);
    spParticles.forEach(p => {
      p.targetAlpha = 0.18 + Math.random()*0.15;
      p.targetClarity = 0;
      p.phV *= 0.4; // much slower drift
    });
  }, 300);
  buildShadowGrid();
  const t = TRANSLATIONS[lang];
  document.getElementById('decArrivalLine').textContent = t.decArrivalLine;
  document.getElementById('decArrivalSub').textContent = t.decArrivalSub;
  showScreen('s-decohere');
}

function buildShadowGrid() {
  const grid = document.getElementById('shadowGrid'); grid.innerHTML = '';
  const en = SHADOW_STATES.en, es = SHADOW_STATES.es;
  en.forEach((name,i) => {
    const o = document.createElement('div'); o.className = 'shadow-orb';
    o.textContent = lang==='en' ? name : es[i];
    const go = () => { decStateName=name; decStateNameES=es[i]; startDecAcknowledge(); };
    o.addEventListener('click', go);
    o.addEventListener('touchend', e => { e.preventDefault(); go(); });
    grid.appendChild(o);
  });
}

// PHASE 1: Acknowledgment — word sits alone, seen
function startDecAcknowledge() {
  const displayName = lang==='en' ? decStateName : decStateNameES;
  const t = TRANSLATIONS[lang];
  // Build acknowledge screen dynamically
  const screen = document.getElementById('s-dec-breath');
  screen.innerHTML = `
    <div id="dec-ack-word" style="font-size:clamp(34px,10vw,58px);font-weight:300;letter-spacing:.08em;
      color:rgba(180,175,165,.65);text-align:center;opacity:0;transition:opacity 1.8s ease;
      text-shadow:0 0 40px rgba(150,145,135,.2);">${displayName}</div>
    <div id="dec-ack-line" style="font-size:var(--fs);letter-spacing:.10em;color:rgba(240,230,208,.28);
      margin-top:20px;opacity:0;transition:opacity 1.4s ease;text-align:center;">
      ${lang==='en'?'yes. this is real.':'sí. esto es real.'}
    </div>
  `;
  showScreen('s-dec-breath', () => {
    // Word fades in slowly
    setTimeout(() => {
      const w = document.getElementById('dec-ack-word');
      const l = document.getElementById('dec-ack-line');
      if (w) w.style.opacity = '1';
      setTimeout(() => { if (l) l.style.opacity = '1'; }, 1200);
    }, 400);
    // Hold for 4 seconds, then begin breath
    setTimeout(() => startDecBreath(displayName), 5000);
  });
}

// PHASE 2: Breath cycles — physiological, letter dissolution
function startDecBreath(displayName) {
  const t = TRANSLATIONS[lang];
  const screen = document.getElementById('s-dec-breath');
  // Build breath UI
  screen.innerHTML = `
    <div id="dec-btext" style="font-size:var(--fh);font-weight:300;letter-spacing:.10em;
      color:rgba(240,230,208,.45);text-align:center;min-height:44px;
      transition:opacity 0.7s ease;opacity:0;"></div>
    <div id="dec-word-wrap" style="position:relative;text-align:center;margin:12px 0;">
      <div id="dec-word" style="font-size:clamp(32px,9vw,52px);font-weight:300;letter-spacing:.10em;
        color:rgba(180,175,165,.6);transition:color 3s ease,text-shadow 3s ease;"></div>
    </div>
    <div id="dec-bp-wrap" style="position:relative;width:80px;height:80px;display:flex;align-items:center;justify-content:center;margin-top:8px;">
      <div id="dec-bp" style="width:16px;height:16px;border-radius:50%;
        background:rgba(180,175,165,.5);box-shadow:0 0 12px rgba(160,155,145,.25);
        transition:transform 4s cubic-bezier(.4,0,.2,1),filter 4s ease,background 3s ease,box-shadow 3s ease;"></div>
    </div>
    <div id="dec-bdots" style="display:flex;gap:12px;margin-top:28px;">
      <div class="bdot" id="dec-dot0"></div>
      <div class="bdot" id="dec-dot1"></div>
      <div class="bdot" id="dec-dot2"></div>
    </div>
  `;
  // Render word as spans for letter dissolution
  const wordEl = document.getElementById('dec-word');
  const letters = displayName.split('').map((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    span.style.display = 'inline-block';
    span.style.transition = `opacity ${1.5+Math.random()*2}s ease ${Math.random()*0.8}s, transform ${2+Math.random()*2}s ease ${Math.random()*0.6}s, filter ${2+Math.random()*1.5}s ease`;
    wordEl.appendChild(span);
    return span;
  });

  let cycle = 0;
  function dDelay(fn,ms){ const id=setTimeout(fn,ms); decBreathTimers.push(id); }
  function showBtext(txt, delayMs) {
    dDelay(() => {
      const el = document.getElementById('dec-btext');
      if (!el) return;
      el.style.transition = 'opacity 0.7s ease'; el.style.opacity = '0';
      dDelay(() => { el.textContent = txt; el.style.opacity = '1'; }, 750);
    }, delayMs||0);
  }
  function hideBtext(delayMs) {
    dDelay(() => {
      const el = document.getElementById('dec-btext'); if (!el) return;
      el.style.transition = 'opacity 0.8s ease'; el.style.opacity = '0';
    }, delayMs||0);
  }

  // Fade in breath UI smoothly
  dDelay(() => {
    const bt = document.getElementById('dec-btext');
    if (bt) { bt.style.transition = 'opacity 1s ease'; bt.style.opacity = '1'; }
  }, 200);

  function runCycle() {
    if (cycle >= 3) {
      // Full dissolution — letters drift away
      dDelay(() => {
        letters.forEach((span, i) => {
          const tx = (Math.random()-0.5)*60;
          const ty = -30 - Math.random()*50;
          span.style.opacity = '0';
          span.style.transform = `translate(${tx}px, ${ty}px) rotate(${(Math.random()-0.5)*20}deg)`;
          span.style.filter = 'blur(8px)';
        });
        playDecohereRelease();
        const bp = document.getElementById('dec-bp');
        if (bp) { bp.style.transform='scale(0.3)'; bp.style.opacity='0'; }
        hideBtext(0);
      }, 600);
      // 4 seconds of silence — just particles
      dDelay(() => showDecEnd(), 5000);
      return;
    }
    cycle++;
    const bp = document.getElementById('dec-bp');
    // Double inhale (sniff sniff) — physiological sigh
    const inhaleText = lang==='en' ? 'inhale — sniff in once more' : 'inhala — otro sorbo de aire';
    const holdText = lang==='en' ? '...' : '...';
    const exhaleText = lang==='en' ? `exhale slowly — release ${displayName}` : `exhala despacio — suelta ${displayName}`;
    showBtext(lang==='en'?'inhale':'inhala', 0);
    dDelay(() => { if (bp) { bp.style.transform='scale(2.8)'; bp.style.filter='blur(3px)'; bp.style.background='rgba(190,185,175,.55)'; } }, 100);
    showBtext(inhaleText, 2000);
    dDelay(() => { if (bp) { bp.style.transform='scale(3.2)'; } }, 2000); // second sniff
    showBtext(exhaleText, 4200);
    dDelay(() => {
      if (bp) { bp.style.transform='scale(1)'; bp.style.filter='blur(0)'; bp.style.background='rgba(180,175,165,.5)'; }
      // Word loses substance each exhale — warmth builds
      const opacity = 1 - (cycle * 0.3);
      const warmth = cycle * 60; // RGB shift toward gold
      letters.forEach(span => {
        span.style.opacity = opacity.toString();
        span.style.color = `rgba(${180+warmth},${175+warmth*0.7},${165+warmth*0.2},${opacity+0.1})`;
      });
    }, 4200);
    hideBtext(8800);
    dDelay(() => {
      const dot = document.getElementById('dec-dot'+(cycle-1)); if (dot) dot.classList.add('done');
      if (bp) { bp.style.transform='scale(1)'; bp.style.filter=''; }
    }, 9500);
    dDelay(runCycle, 10500);
  }

  dDelay(runCycle, 800);
}

// PHASE 3: End — silence then reformation
function showDecEnd() {
  const t = TRANSLATIONS[lang];
  // Show Collapse states faintly — superposition restored
  spParticles = Array.from({length:8}, (_,i) => new SpParticle(i,8));
  spParticles.forEach(p => { p.targetAlpha=0; p.targetClarity=0; p.phV *= 0.6; });
  setTimeout(() => {
    spParticles.forEach(p => { p.targetAlpha=0.2+Math.random()*0.18; p.targetClarity=0; });
  }, 1500);
  document.getElementById('decEndLine').textContent = t.decEndLine;
  document.getElementById('decEndSub').innerHTML = t.decEndSub.replace(/\n/g,'<br>');
  document.getElementById('decRetBtn').textContent = t.decRetBtn;
  document.getElementById('decAgainBtn').textContent = t.decAgainBtn;
  showScreen('s-dec-end');
}

function clearAllDec() { decBreathTimers.forEach(clearTimeout); decBreathTimers = []; }

// ── INIT ──
applyLang();
initSpParticles(12);
tryDrone();

window.addEventListener('keydown', e => {
  if (e.key===' '||e.key==='Enter') {
    const active = document.querySelector('.screen.active');
    if (active && active.id==='s-init') advanceStep();
  }
});
