// ═══════════════════════════════════════
// FIELD — Unified App v2.1
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
let COHERENCE_SEC = 60; // default 1 min — overridden by duration choice
let obsTargetSec = 60;
const METER_DOTS = 9;

// Observer mode: 'wander' (original) or 'kasina' (static flame)
let obsMode = 'wander';

// Three-signal attention system
let isStill = true, lastMotionTime = 0, lastAffirmTime = 0;
let affirmBonus = 0;
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
    const angle = (Math.PI*2/total)*i + Math.random()*0.5;
    const r = 0.28 + Math.random()*0.18;
    this.cx = 0.5 + Math.cos(angle)*r; this.cy = 0.45 + Math.sin(angle)*r;
    this.targetCx = this.cx; this.targetCy = this.cy;
    this.x = this.cx*innerWidth; this.y = this.cy*innerHeight;
    this.ph = Math.random()*Math.PI*2;
    this.phV = 0.005 + Math.random()*0.005;
    this.driftR = 20 + Math.random()*18;
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
    this.alpha += (this.targetAlpha - this.alpha) * 0.025;
    this.clarity += (this.targetClarity - this.clarity) * 0.03;
    if (this._flickering) {
      this.alpha = 0.3 + Math.random()*0.65;
      this.clarity = Math.random()*0.3;
    }
  }
  draw() {
    if (this.alpha < 0.01 || particlesHidden) return;
    const blur = (1-this.clarity)*20 + 4;
    const glow = 10 + this.clarity*28;
    cx.save();
    cx.filter = `blur(${blur.toFixed(1)}px)`;
    const grad = cx.createRadialGradient(this.x,this.y,0,this.x,this.y,glow);
    grad.addColorStop(0, `rgba(240,204,136,${(this.alpha*0.45).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(240,204,136,0)');
    cx.fillStyle = grad;
    cx.beginPath(); cx.arc(this.x,this.y,glow,0,Math.PI*2); cx.fill();
    cx.globalAlpha = this.alpha;
    cx.fillStyle = `rgba(240,204,136,${(0.5+this.clarity*0.5).toFixed(3)})`;
    cx.beginPath(); cx.arc(this.x,this.y,this.r,0,Math.PI*2); cx.fill();
    cx.restore();
  }
}
let spParticles = [];

// ── OBSERVE PARTICLE (wander mode) ──
let clarityLevel = 0, particleVisible = false;
class ObsParticle {
  constructor() {
    this.cx = 0.5; this.cy = 0.5;
    this.x = innerWidth*0.5; this.y = innerHeight*0.5;
    this.ph = Math.random()*Math.PI*2;
    this.phV = 0.004 + Math.random()*0.003;
    this.driftR = 55 + Math.random()*35;
    this.r = 5; this.alpha = 0; this.targetAlpha = 0.9;
    this.breathPh = 0;
    this.scattering = false; this.scatterParts = [];
  }
  update() {
    this.ph += this.phV;
    this.breathPh += 0.017;
    this.cx += (0.5-this.cx)*0.001; this.cy += (0.5-this.cy)*0.001;
    const ds = Math.min(innerWidth, innerHeight);
    const motionFactor = isStill ? 1 : 0.5;
    this.x = this.cx*innerWidth + Math.cos(this.ph)*this.driftR*(ds/400)*motionFactor;
    this.y = this.cy*innerHeight + Math.sin(this.ph*0.67)*this.driftR*0.7*(ds/400)*motionFactor;
    this.alpha += (this.targetAlpha - this.alpha)*0.02;
  }
  draw() {
    if (this.alpha < 0.01) return;
    const breathFactor = 0.7 + 0.3*Math.sin(this.breathPh);
    const stillFactor = isStill ? 1 : 0.4;
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

// ── KASINA PARTICLE (static flame — stays centred, pulses + micro-shudders) ──
class KasinaParticle {
  constructor() {
    this.x = innerWidth * 0.5;
    this.y = innerHeight * 0.5;
    this.breathPh = 0;
    this.shudderPh = 0;
    this.shudderX = 0; this.shudderY = 0;
    this.shudderTargetX = 0; this.shudderTargetY = 0;
    this.shudderTimer = 0;
    this.alpha = 0; this.targetAlpha = 1;
    this.r = 6;
    // Flame flicker state
    this.flickerPh = Math.random()*Math.PI*2;
    this.flickerV = 0.08 + Math.random()*0.04;
    // Radiate rings timing
    this.ringPh = 0;
  }
  update() {
    this.x = innerWidth * 0.5;
    this.y = innerHeight * 0.5;
    this.breathPh += 0.012; // slow 8s breath
    this.flickerPh += this.flickerV;
    this.ringPh += 0.018;
    this.alpha += (this.targetAlpha - this.alpha) * 0.025;

    // Micro shudder — tiny random quiver, never leaves centre by more than 3px
    this.shudderTimer++;
    if (this.shudderTimer > 8 + Math.random()*12) {
      this.shudderTargetX = (Math.random()-0.5) * 4;
      this.shudderTargetY = (Math.random()-0.5) * 4;
      this.shudderTimer = 0;
    }
    this.shudderX += (this.shudderTargetX - this.shudderX) * 0.18;
    this.shudderY += (this.shudderTargetY - this.shudderY) * 0.18;
  }
  draw() {
    if (this.alpha < 0.01) return;
    const px = this.x + this.shudderX;
    const py = this.y + this.shudderY;

    // Clarity-driven expansion
    const breathScale = 0.75 + 0.25*Math.sin(this.breathPh);
    const flickerScale = 1 + 0.06*Math.sin(this.flickerPh) + 0.03*Math.sin(this.flickerPh*2.3);
    const clarityScale = 1 + clarityLevel * 0.8;

    const r = this.r * breathScale * flickerScale * clarityScale;
    const glow = (26 + clarityLevel*55) * breathScale * flickerScale;
    const coreAlpha = (0.85 + 0.15*Math.sin(this.flickerPh)) * this.alpha;
    const glowAlpha = (0.18 + clarityLevel*0.28) * breathScale * this.alpha;

    cx.save();

    // Outer aura — large, diffuse
    const aura = cx.createRadialGradient(px, py, 0, px, py, glow * 2.5);
    aura.addColorStop(0, `rgba(240,204,136,${(glowAlpha*0.35).toFixed(3)})`);
    aura.addColorStop(0.5, `rgba(240,204,136,${(glowAlpha*0.12).toFixed(3)})`);
    aura.addColorStop(1, 'rgba(240,204,136,0)');
    cx.fillStyle = aura;
    cx.beginPath(); cx.arc(px, py, glow*2.5, 0, Math.PI*2); cx.fill();

    // Mid glow
    const grad = cx.createRadialGradient(px, py, 0, px, py, glow);
    grad.addColorStop(0, `rgba(255,240,200,${(glowAlpha*0.9).toFixed(3)})`);
    grad.addColorStop(0.4, `rgba(240,204,136,${(glowAlpha*0.5).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(240,204,136,0)');
    cx.fillStyle = grad;
    cx.beginPath(); cx.arc(px, py, glow, 0, Math.PI*2); cx.fill();

    // Sharp core — no blur
    cx.globalAlpha = coreAlpha;
    // Warm white centre
    const core = cx.createRadialGradient(px, py, 0, px, py, r);
    core.addColorStop(0, 'rgba(255,252,240,1)');
    core.addColorStop(0.35, 'rgba(255,232,160,0.95)');
    core.addColorStop(1, 'rgba(240,180,80,0.4)');
    cx.fillStyle = core;
    cx.beginPath(); cx.arc(px, py, r, 0, Math.PI*2); cx.fill();

    // Radiating ring — pulses outward every ~3s
    const ringProgress = (Math.sin(this.ringPh) + 1) / 2; // 0..1
    if (ringProgress > 0.02) {
      const ringR = 30 + ringProgress * 80 * clarityScale;
      const ringAlpha = (1 - ringProgress) * 0.18 * this.alpha;
      cx.globalAlpha = ringAlpha;
      cx.strokeStyle = 'rgba(240,204,136,1)';
      cx.lineWidth = 0.8;
      cx.beginPath(); cx.arc(px, py, ringR, 0, Math.PI*2); cx.stroke();
    }

    cx.restore();
  }
}
let kasinaParticle = null;

// ── RENDER LOOP ──
function loop() {
  cx.clearRect(0, 0, cv.width, cv.height);
  bgPts.forEach(p => { p.update(); p.draw(); });
  if (currentMode === 'observe' && particleVisible) {
    if (obsMode === 'kasina' && kasinaParticle) {
      kasinaParticle.update();
      kasinaParticle.draw();
    } else if (obsMode === 'wander' && observeParticle) {
      observeParticle.update();
      if (observeParticle.scattering) observeParticle.drawScatter();
      else observeParticle.draw();
    }
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
  if (!audioEnabled) return;
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
function playMicroTone() {
  if (!audioCtx || !fieldActive || isCoherent) return;
  const freq = isStill ? 660 : 550;
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

// ── SCREEN TRANSITIONS ──
function showScreen(id, postCb) {
  if (id !== 's-collapse' && id !== 's-field') {
    const gh = document.getElementById('ghosts');
    if (gh && gh.style.opacity !== '0') {
      gh.style.opacity = '0';
      setTimeout(() => { if (gh.innerHTML && id !== 's-collapse') gh.innerHTML = ''; }, 900);
    }
  }
  const next = document.getElementById(id);
  const current = document.querySelector('.screen.active');
  if (current === next) { if (postCb) postCb(); return; }
  if (current) {
    current.style.transition = 'opacity 0.7s ease';
    current.style.opacity = '0';
    setTimeout(() => {
      current.classList.remove('active');
      current.style.opacity = '';
      current.style.transition = '';
    }, 720);
  }
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

// ── AUDIO TOGGLE ──
let audioEnabled = true;
function toggleAudio() {
  audioEnabled = !audioEnabled;
  const btn = document.getElementById('audioBtn');
  if (audioEnabled) {
    btn.classList.remove('muted');
    btn.title = 'toggle audio';
    tryDrone();
  } else {
    btn.classList.add('muted');
    btn.title = 'audio off';
    fadeDrone(true, 0.8);
  }
}

// ── FONT SIZE TOGGLE ──
let fontLarge = localStorage.getItem('field_font_large') === '1';
function toggleFont() {
  fontLarge = !fontLarge;
  localStorage.setItem('field_font_large', fontLarge ? '1' : '0');
  document.body.classList.toggle('fs-large', fontLarge);
  const btn = document.getElementById('fontBtn');
  if (btn) btn.classList.toggle('active', fontLarge);
}
if (fontLarge) {
  document.body.classList.add('fs-large');
  const btn = document.getElementById('fontBtn');
  if (btn) btn.classList.add('active');
}

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
function clearGhosts() {
  const gh = document.getElementById('ghosts');
  if (gh) { gh.style.opacity = '0'; setTimeout(() => { gh.innerHTML = ''; }, 900); }
}
function goHome() {
  const cameFromDecohere = currentMode === 'decohere-end';
  currentMode = 'home';
  clearAllBreath(); clearObserver(); clearAllDec();
  clearGhosts();
  fadeDrone(true, 1.5);
  particlesHidden = false; collapseStage = 0; breathRunning = false;
  document.querySelectorAll('.cp-stage').forEach(s => { s.classList.remove('on'); s.style.cssText = ''; });
  document.getElementById('backBtn').style.opacity = '0';
  document.getElementById('backBtn').style.pointerEvents = 'none';
  document.querySelectorAll('.al').forEach(a => a.classList.remove('on'));
  spParticles = []; particleVisible = false;
  showScreen('s-home', () => {
    document.querySelectorAll('.al').forEach(a => a.classList.add('on'));
    if (cameFromDecohere) {
      setTimeout(() => {
        spParticles = Array.from({length:12}, (_,i) => new SpParticle(i,12));
        spParticles.forEach(p => {
          p.x = innerWidth/2 + (Math.random()-0.5)*30;
          p.y = innerHeight/2 + (Math.random()-0.5)*30;
          p.targetAlpha = 0; p.targetClarity = 0;
        });
        setTimeout(() => {
          spParticles.forEach(p => { p.targetAlpha = 0.4+Math.random()*0.3; });
        }, 300);
      }, 100);
    } else {
      setTimeout(() => { initSpParticles(12); tryDrone(); }, 200);
    }
    tryDrone();
  });
  updateHomeCount();
  document.querySelectorAll('.movement').forEach(m => m.classList.remove('lit'));
  setTimeout(() => {
    const obs = parseInt(localStorage.getItem('field_obs')||'0');
    const dec = parseInt(localStorage.getItem('field_obs_decohere')||'0');
    const obv = parseInt(localStorage.getItem('field_obs_observe')||'0');
    const max = Math.max(obs, dec, obv);
    if (max === 0) return;
    const mvId = max === obs ? 'mv-collapse' : max === dec ? 'mv-decohere' : 'mv-observe';
    const el = document.getElementById(mvId);
    if (el) el.classList.add('lit');
    if (cameFromDecohere) {
      const decEl = document.getElementById('mv-decohere');
      if (decEl) {
        decEl.classList.add('just-released');
        setTimeout(() => { if (decEl) decEl.classList.remove('just-released'); }, 180000);
      }
    }
  }, 800);
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
// OBSERVE MOVEMENT — setup screen
// ══════════════════════════════════════

function startObserve() {
  if (navigator.vibrate) navigator.vibrate(18);
  currentMode = 'observe-setup';
  showBackBtn();
  showScreen('s-observe-setup');
}

// Called when user picks duration + mode on setup screen
function beginObserveSession(mins, mode) {
  obsTargetSec = mins * 60;
  COHERENCE_SEC = obsTargetSec;
  obsMode = mode;
  if (navigator.vibrate) navigator.vibrate(18);
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  fadeDrone(true, 1); spParticles = [];
  buildObsScreen();
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

  if (obsMode === 'kasina') {
    kasinaParticle = new KasinaParticle();
  } else {
    observeParticle = new ObsParticle();
  }
  particleVisible = true;

  showScreen('s-observe', () => {
    setTimeout(() => {
      const hint = document.getElementById('obs-hint-txt');
      if (hint) hint.style.opacity = '1';
    }, 600);
    setTimeout(() => {
      const hint = document.getElementById('obs-hint-txt');
      if (hint) { hint.style.transition = 'opacity 1.5s ease'; hint.style.opacity = '0'; }
    }, 3500);
    setTimeout(() => {
      if (currentMode !== 'observe') return;
      currentMode = 'observe';
      fieldActive = true;
      startAttentionTimer();
      startMicroTones();
      startMotionCheck();
      const sigs = document.getElementById('obs-signals');
      const meter = document.getElementById('obs-meter-wrap');
      const btn = document.getElementById('affirmBtn');
      if (sigs) sigs.style.opacity = '1';
      if (meter) meter.style.opacity = '1';
      if (btn) btn.style.opacity = '1';
    }, 4500);
  });
}

function buildObsScreen() {
  const screen = document.getElementById('s-observe');
  const modeLabel = obsMode === 'kasina'
    ? (lang==='en' ? 'Rest your gaze on the light.' : 'Descansa la mirada en la luz.')
    : (lang==='en' ? 'One particle.<br>Just watch it.' : 'Una partícula.<br>Solo obsérvala.');

  const minLabel = obsTargetSec === 60 ? '1 min'
    : obsTargetSec === 300 ? '5 min' : '10 min';

  screen.innerHTML = `
    <div id="obs-hint-txt" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;opacity:0;transition:opacity 2s ease;z-index:20;pointer-events:none;">
      <div style="font-size:clamp(26px,7vw,38px);font-weight:300;letter-spacing:.12em;color:rgba(201,169,110,.55);margin-bottom:16px;">${obsMode==='kasina'?'◈':'◎'}</div>
      <div style="font-size:clamp(11px,2.8vw,14px);letter-spacing:.12em;color:rgba(240,230,208,.45);line-height:1.8;">
        ${modeLabel}
      </div>
      <div style="font-size:clamp(10px,2.4vw,12px);letter-spacing:.16em;color:rgba(201,169,110,.28);margin-top:10px;">${minLabel}</div>
    </div>
    <div id="clarity-ring"></div>

    <!-- TIME REMAINING arc -->
    <canvas id="obs-timer-arc" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:3;opacity:0;transition:opacity 2s ease;"></canvas>

    <!-- SIGNALS — moved to left side, vertical stack, clearly labelled -->
    <div id="obs-signals" style="position:fixed;left:clamp(18px,5vw,32px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:18px;align-items:flex-start;opacity:0;transition:opacity 2s ease;z-index:20;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="sig-dot" id="sig-still"></div>
        <div class="sig-label">${lang==='en'?'still':'quieto'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="sig-dot" id="sig-present"></div>
        <div class="sig-label">${lang==='en'?'present':'presente'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="sig-dot" id="sig-affirm"></div>
        <div class="sig-label">${lang==='en'?'here':'aquí'}</div>
      </div>
    </div>

    <!-- METER — dots at top -->
    <div id="obs-meter-wrap" style="position:fixed;top:clamp(68px,14vw,88px);left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;z-index:20;opacity:0;transition:opacity 2s ease;">
      <div id="meter"></div>
    </div>

    <div id="scatter-text" style="position:fixed;top:38%;left:50%;transform:translateX(-50%);font-size:clamp(11px,2.8vw,13px);letter-spacing:.14em;color:rgba(240,230,208,.45);white-space:nowrap;opacity:0;transition:opacity 1s ease;z-index:20;pointer-events:none;"></div>

    <!-- PRESENCE BUTTON — large, clearly visible, bottom centre -->
    <button id="affirmBtn" onclick="doAffirm()"
      style="position:fixed;bottom:clamp(80px,18vw,110px);left:50%;transform:translateX(-50%);
        width:auto;min-width:120px;height:52px;
        border-radius:26px;
        background:rgba(201,169,110,0.08);
        border:1px solid rgba(201,169,110,0.30);
        cursor:pointer;-webkit-tap-highlight-color:transparent;
        display:flex;align-items:center;justify-content:center;gap:10px;
        opacity:0;transition:opacity 2s ease,border-color .3s ease,background .3s ease,box-shadow .3s ease;
        z-index:30;padding:0 20px;color:rgba(201,169,110,0.70);
        font-family:inherit;font-size:clamp(11px,2.8vw,13px);letter-spacing:.14em;font-weight:300;">
      <div id="affirmDot" style="width:7px;height:7px;border-radius:50%;background:rgba(201,169,110,.55);flex-shrink:0;transition:transform .3s ease,background .3s ease;animation:affirmPulse 3s ease-in-out infinite;"></div>
      <span id="affirmLabel">${lang==='en'?'I am here':'estoy aquí'}</span>
    </button>
  `;
  buildObsMeter();
  initTimerArc();
}

function initTimerArc() {
  const arc = document.getElementById('obs-timer-arc');
  if (!arc) return;
  const size = Math.min(innerWidth, innerHeight) * 0.72;
  arc.width = size; arc.height = size;
  arc.style.width = size + 'px'; arc.style.height = size + 'px';
  arc.style.marginLeft = -size/2 + 'px'; arc.style.marginTop = -size/2 + 'px';
}

function drawTimerArc() {
  const arc = document.getElementById('obs-timer-arc');
  if (!arc) return;
  const c = arc.getContext('2d');
  const size = arc.width;
  c.clearRect(0,0,size,size);
  const progress = Math.min((attentionSec + affirmBonus) / obsTargetSec, 1);
  const cx2 = size/2, cy2 = size/2, r = size/2 - 2;
  // Background ring — very faint
  c.beginPath(); c.arc(cx2,cy2,r,0,Math.PI*2);
  c.strokeStyle = 'rgba(201,169,110,0.06)'; c.lineWidth = 1; c.stroke();
  // Progress arc
  if (progress > 0.005) {
    c.beginPath();
    c.arc(cx2, cy2, r, -Math.PI/2, -Math.PI/2 + progress*Math.PI*2);
    c.strokeStyle = `rgba(201,169,110,${0.15 + progress*0.35})`;
    c.lineWidth = 1.5; c.stroke();
  }
}

function buildObsMeter() {
  const m = document.getElementById('meter'); if (!m) return;
  m.innerHTML = '';
  for (let i = 0; i < METER_DOTS; i++) {
    const d = document.createElement('div'); d.className = 'mdot'; d.id = 'mdot'+i; m.appendChild(d);
  }
}

function updateObsMeter() {
  const progress = Math.min((attentionSec + affirmBonus) / obsTargetSec, 1);
  const lit = Math.floor(progress * METER_DOTS);
  for (let i = 0; i < METER_DOTS; i++) {
    const d = document.getElementById('mdot'+i);
    if (d) d.classList.toggle('lit', i < lit);
  }
  clarityLevel = Math.min(progress, 1);
  updateClarityRing();
  updateSignalDots();
  drawTimerArc();
  // Show timer arc once session starts
  const arc = document.getElementById('obs-timer-arc');
  if (arc && attentionSec > 2) arc.style.opacity = '0.9';
}

function updateSignalDots() {
  const ss = document.getElementById('sig-still');
  const sp2 = document.getElementById('sig-present');
  const sa = document.getElementById('sig-affirm');
  if (ss) ss.style.background = isStill ? 'var(--gold)' : 'rgba(201,169,110,.18)';
  if (ss) ss.style.boxShadow = isStill ? '0 0 8px rgba(201,169,110,.6)' : 'none';
  const isPresent = clarityLevel > 0.05 && isStill;
  if (sp2) sp2.style.background = isPresent ? 'var(--gold)' : 'rgba(201,169,110,.18)';
  if (sp2) sp2.style.boxShadow = isPresent ? '0 0 8px rgba(201,169,110,.6)' : 'none';
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

function startAttentionTimer() {
  clearInterval(attentionTimer);
  attentionTimer = setInterval(() => {
    if (!fieldActive || isCoherent) return;
    if (isStill) attentionSec++;
    updateObsMeter();
    if (attentionSec + affirmBonus >= obsTargetSec) reachObsCoherence();
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
    isStill = timeSinceMotion > 1800;
    if (!wasStill && isStill) {
      if (observeParticle && obsMode === 'wander') { observeParticle.cx = 0.5; observeParticle.cy = 0.5; }
    }
    updateSignalDots();
  }, 300);
}

function doAffirm() {
  if (!fieldActive || isCoherent) return;
  lastAffirmTime = Date.now();
  affirmBonus = Math.min(affirmBonus + 1.5, 12);
  playAffirmSound();
  if (navigator.vibrate) navigator.vibrate(18);
  const btn = document.getElementById('affirmBtn');
  const dot = document.getElementById('affirmDot');
  if (btn) {
    btn.style.borderColor = 'rgba(201,169,110,.7)';
    btn.style.background = 'rgba(201,169,110,.15)';
    btn.style.boxShadow = '0 0 20px rgba(201,169,110,.3)';
  }
  if (dot) { dot.style.transform = 'scale(2)'; dot.style.background = 'rgba(240,204,136,.95)'; }
  const ring = document.getElementById('clarity-ring');
  if (ring) { ring.style.boxShadow = `0 0 ${40+clarityLevel*60}px rgba(201,169,110,.4)`; }
  setTimeout(() => {
    if (btn) { btn.style.borderColor = ''; btn.style.background = ''; btn.style.boxShadow = ''; }
    if (dot) { dot.style.transform = ''; dot.style.background = ''; }
    if (ring) ring.style.boxShadow = '';
    updateSignalDots();
  }, 600);
  updateObsMeter();
  if (attentionSec + affirmBonus >= obsTargetSec) reachObsCoherence();
}

function obsScatter() {
  if (isCoherent || !fieldActive || obsMode === 'kasina') return;
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
  ['obs-signals','obs-meter-wrap','affirmBtn','scatter-text','obs-hint-txt','obs-timer-arc'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.style.transition = 'opacity 1.5s ease'; el.style.opacity = '0'; }
  });
  const n = parseInt(localStorage.getItem('field_obs')||'0') + 1;
  localStorage.setItem('field_obs', n); totalObs = n;
  const no = parseInt(localStorage.getItem('field_obs_observe')||'0') + 1;
  localStorage.setItem('field_obs_observe', no);
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
  isStill = true; kasinaParticle = null;
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
      if (mag > 6 && Date.now() - lastMotionTime > 1500) obsScatter();
    }
  });
}

// Tap observe screen — scatter only in wander mode
document.getElementById('s-observe').addEventListener('click', e => {
  if (e.target.closest('#chrome') || e.target.closest('#affirmBtn')) return;
  if (fieldActive && !isCoherent && obsMode === 'wander') obsScatter();
});
document.getElementById('s-observe').addEventListener('touchend', e => {
  if (e.target.closest('#chrome') || e.target.closest('#affirmBtn')) return;
  e.preventDefault();
  if (fieldActive && !isCoherent && obsMode === 'wander') obsScatter();
});

// ══════════════════════════════════════
// OBSERVE SETUP SCREEN
// ══════════════════════════════════════

function buildObsSetupScreen() {
  const screen = document.getElementById('s-observe-setup');
  const isEn = lang === 'en';
  screen.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:clamp(28px,7vw,44px);
      width:100%;max-width:340px;text-align:center;">

      <!-- Title -->
      <div style="font-size:clamp(13px,3.2vw,16px);letter-spacing:.18em;
        color:rgba(201,169,110,.45);font-weight:300;">
        ${isEn ? 'OBSERVE' : 'OBSERVAR'}
      </div>

      <!-- Duration -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;">
        <div style="font-size:clamp(11px,2.8vw,13px);letter-spacing:.14em;
          color:rgba(240,230,208,.28);margin-bottom:2px;">
          ${isEn ? 'duration' : 'duración'}
        </div>
        <div style="display:flex;gap:10px;width:100%;justify-content:center;">
          <button class="obs-setup-btn" id="dur-1" onclick="selectDur(1)"
            style="flex:1;max-width:90px;">1 min</button>
          <button class="obs-setup-btn active" id="dur-5" onclick="selectDur(5)"
            style="flex:1;max-width:90px;">5 min</button>
          <button class="obs-setup-btn" id="dur-10" onclick="selectDur(10)"
            style="flex:1;max-width:90px;">10 min</button>
        </div>
      </div>

      <!-- Mode -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;">
        <div style="font-size:clamp(11px,2.8vw,13px);letter-spacing:.14em;
          color:rgba(240,230,208,.28);margin-bottom:2px;">
          ${isEn ? 'practice' : 'práctica'}
        </div>
        <div style="display:flex;gap:10px;width:100%;justify-content:center;">
          <button class="obs-setup-btn active" id="mode-wander" onclick="selectMode('wander')"
            style="flex:1;max-width:140px;display:flex;flex-direction:column;gap:6px;align-items:center;padding:14px 10px;">
            <span style="font-size:clamp(20px,5vw,26px);color:rgba(201,169,110,.55);">◎</span>
            <span>${isEn ? 'wander' : 'deriva'}</span>
            <span style="font-size:clamp(9px,2.2vw,11px);color:rgba(201,169,110,.28);letter-spacing:.06em;line-height:1.4;">
              ${isEn ? 'follow the particle' : 'sigue la partícula'}
            </span>
          </button>
          <button class="obs-setup-btn" id="mode-kasina" onclick="selectMode('kasina')"
            style="flex:1;max-width:140px;display:flex;flex-direction:column;gap:6px;align-items:center;padding:14px 10px;">
            <span style="font-size:clamp(20px,5vw,26px);color:rgba(201,169,110,.55);">◈</span>
            <span>${isEn ? 'kasina' : 'kasina'}</span>
            <span style="font-size:clamp(9px,2.2vw,11px);color:rgba(201,169,110,.28);letter-spacing:.06em;line-height:1.4;">
              ${isEn ? 'rest on the flame' : 'descansa en la llama'}
            </span>
          </button>
        </div>
      </div>

      <!-- Begin button -->
      <button id="obs-begin-btn" onclick="commitObserve()"
        style="margin-top:8px;background:none;
          border:1px solid rgba(201,169,110,.28);border-radius:4px;
          font-family:inherit;font-size:clamp(12px,3vw,15px);letter-spacing:.18em;
          color:rgba(201,169,110,.65);cursor:pointer;padding:16px 40px;min-height:52px;
          -webkit-tap-highlight-color:transparent;
          transition:color .4s ease,border-color .4s ease;font-weight:300;">
        ${isEn ? 'enter' : 'entrar'}
      </button>
    </div>
  `;
  // Set defaults
  _setupDur = 5;
  _setupMode = 'wander';
}

let _setupDur = 5;
let _setupMode = 'wander';

function selectDur(m) {
  _setupDur = m;
  [1,5,10].forEach(d => {
    const btn = document.getElementById('dur-'+d);
    if (btn) btn.classList.toggle('active', d === m);
  });
}

function selectMode(m) {
  _setupMode = m;
  ['wander','kasina'].forEach(k => {
    const btn = document.getElementById('mode-'+k);
    if (btn) btn.classList.toggle('active', k === m);
  });
}

function commitObserve() {
  beginObserveSession(_setupDur, _setupMode);
}

// Hook into showScreen for setup
const _origShowScreen = showScreen;
// Override startObserve to go to setup
function startObserveSetup() {
  if (navigator.vibrate) navigator.vibrate(18);
  currentMode = 'observe-setup';
  showBackBtn();
  buildObsSetupScreen();
  showScreen('s-observe-setup');
}

// ══════════════════════════════════════
// COLLAPSE MOVEMENT
// ══════════════════════════════════════
let stepIndex = 0;
function startCollapse() {
  if (navigator.vibrate) navigator.vibrate(18);
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
// DECOHERE MOVEMENT
// ══════════════════════════════════════

function startDecohere() {
  if (navigator.vibrate) navigator.vibrate(18);
  currentMode = 'decohere'; showBackBtn();
  fadeDrone(true, 1.5); spParticles = [];
  setTimeout(() => {
    initSpParticles(10);
    spParticles.forEach(p => {
      p.targetAlpha = 0.18 + Math.random()*0.15;
      p.targetClarity = 0;
      p.phV *= 0.4;
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

function startDecAcknowledge() {
  const displayName = lang==='en' ? decStateName : decStateNameES;
  const t = TRANSLATIONS[lang];
  const ackLayer   = document.getElementById('dec-ack-layer');
  const breathLayer= document.getElementById('dec-breath-layer');
  const wordEl     = document.getElementById('dec-word');
  const ackLine    = document.getElementById('dec-ack-line');
  const btext      = document.getElementById('dec-btext');
  const bp         = document.getElementById('dec-bp');
  [ackLayer, breathLayer, wordEl, ackLine, btext, bp].forEach(el => {
    if (el) { el.style.transition = 'none'; el.style.opacity = '0'; }
  });
  wordEl.innerHTML = '';
  displayName.split('').forEach(ch => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    span.style.cssText = 'display:inline-block;transition:none;';
    wordEl.appendChild(span);
  });
  ackLine.textContent = lang==='en' ? 'seen.' : 'visto.';
  [0,1,2].forEach(i => {
    const d = document.getElementById('dec-dot'+i);
    if (d) d.classList.remove('done');
  });
  if (bp) { bp.style.transform='scale(1)'; bp.style.filter=''; bp.style.background='rgba(180,175,165,.5)'; }
  showScreen('s-dec-breath', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wordEl.style.transition = 'color 3s ease, opacity 2s ease';
      ackLayer.style.transition = 'opacity 1s ease';
      ackLine.style.transition = 'opacity 1.4s ease';
      setTimeout(() => { wordEl.style.opacity = '1'; }, 100);
      setTimeout(() => { ackLayer.style.opacity = '1'; }, 200);
      setTimeout(() => { ackLine.style.opacity = '1'; }, 1400);
      setTimeout(() => startDecBreath(displayName), 5000);
    }));
  });
}

function startDecBreath(displayName) {
  const t = TRANSLATIONS[lang];
  const ackLayer    = document.getElementById('dec-ack-layer');
  const breathLayer = document.getElementById('dec-breath-layer');
  const wordEl      = document.getElementById('dec-word');
  const btext       = document.getElementById('dec-btext');
  const bp          = document.getElementById('dec-bp');
  const letters     = Array.from(wordEl.querySelectorAll('span'));
  letters.forEach((span, i) => {
    const dur  = (1.8 + Math.random()*1.4).toFixed(2);
    const dly  = (Math.random()*0.6).toFixed(2);
    span.style.transition =
      `opacity ${dur}s ease ${dly}s,` +
      `transform ${(parseFloat(dur)+0.4).toFixed(2)}s ease ${dly}s,` +
      `color 2s ease,filter ${dur}s ease ${dly}s`;
  });
  const backBtn = document.getElementById('backBtn');
  if (backBtn) { backBtn.style.opacity='0'; backBtn.style.pointerEvents='none'; }
  ackLayer.style.transition = 'opacity 1.2s ease';
  ackLayer.style.opacity = '0';
  setTimeout(() => { ackLayer.style.pointerEvents = 'none'; }, 1200);
  breathLayer.style.transition = 'opacity 1.2s ease';
  setTimeout(() => {
    breathLayer.style.opacity = '1';
    breathLayer.style.pointerEvents = 'all';
    if (bp) { bp.style.transition = 'opacity 1.2s ease'; bp.style.opacity = '1'; }
  }, 400);
  let cycle = 0;
  function dDelay(fn,ms){ const id=setTimeout(fn,ms); decBreathTimers.push(id); return id; }
  function setBtext(txt) {
    if (!btext) return;
    btext.style.transition = 'opacity 0.6s ease'; btext.style.opacity = '0';
    const id = setTimeout(() => { btext.textContent = txt; btext.style.opacity = '1'; }, 650);
    decBreathTimers.push(id);
  }
  function hideBtext() {
    if (!btext) return;
    btext.style.transition = 'opacity 0.8s ease'; btext.style.opacity = '0';
  }
  function fireRipple(idx) {
    const rip = document.getElementById('dec-rip'+idx); if (!rip) return;
    rip.classList.remove('go'); void rip.offsetWidth; rip.classList.add('go');
  }
  function dronePitch(up) {
    if (!droneNodes.length) return;
    droneNodes.forEach(n => {
      if (n.frequency) {
        const base = n.frequency.value;
        n.frequency.setTargetAtTime(up ? base*1.018 : base/1.018, audioCtx.currentTime, 2);
      }
    });
  }
  function runCycle() {
    if (cycle >= 3) {
      if (backBtn) { backBtn.style.opacity='1'; backBtn.style.pointerEvents='all'; }
      dDelay(() => {
        hideBtext();
        letters.forEach((span, i) => {
          const tx = (Math.random()-0.5)*80, ty = (Math.random()-0.5)*60 - 20, rot = (Math.random()-0.5)*25;
          span.style.opacity = '0'; span.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg)`;
          span.style.filter = 'blur(10px)';
        });
        if (bp) {
          bp.style.transition = 'transform 1.2s cubic-bezier(.4,0,.2,1),opacity 1.8s ease,background 1.2s ease,box-shadow 1.2s ease';
          bp.style.transform = 'scale(4)'; bp.style.background = 'rgba(240,204,136,.8)';
          bp.style.boxShadow = '0 0 40px rgba(240,204,136,.6)';
        }
        playDecohereRelease();
      }, 400);
      dDelay(() => {
        if (bp) {
          bp.style.transition = 'transform 3s cubic-bezier(.4,0,.2,1),opacity 3s ease,background 3s ease,box-shadow 3s ease';
          bp.style.transform = 'scale(0.5)'; bp.style.opacity = '0.35';
          bp.style.background = 'rgba(201,169,110,.6)'; bp.style.boxShadow = '0 0 8px rgba(201,169,110,.3)';
        }
      }, 1800);
      dDelay(() => showDecEnd(), 5500);
      return;
    }
    cycle++;
    if (!bp) return;
    setBtext(t.decInhale);
    dDelay(() => {
      const maxScale = 5 + cycle * 2;
      const r = 190 + cycle * 16, g2 = 178 + cycle * 10, b2 = 150 - cycle * 12;
      const glowStr = 0.25 + cycle * 0.18;
      bp.style.transition = 'transform 4s cubic-bezier(.35,0,.15,1),filter 4s ease,background 3.5s ease,box-shadow 3.5s ease';
      bp.style.transform = `scale(${maxScale})`; bp.style.filter = `blur(${3 + cycle * 1.5}px)`;
      bp.style.background = `rgba(${r},${g2},${b2},0.65)`;
      bp.style.boxShadow = `0 0 ${30+cycle*20}px rgba(${r},${g2},${b2},${glowStr})`;
      dronePitch(true);
    }, 100);
    dDelay(() => {
      const nudge = 5 + cycle * 2 + 0.8;
      bp.style.transition = 'transform 2s cubic-bezier(.4,0,.2,1)';
      bp.style.transform = `scale(${nudge})`;
    }, 2200);
    dDelay(() => {
      setBtext(t.decExhale);
      if (navigator.vibrate) navigator.vibrate(22);
      fireRipple(cycle - 1);
      dronePitch(false);
      bp.style.transition = 'transform 4.5s cubic-bezier(.4,0,.2,1),filter 4s ease,background 3s ease,box-shadow 3s ease';
      bp.style.transform = 'scale(1)'; bp.style.filter = 'blur(0px)';
      const residR = 180 + cycle * 12, residG = 170 + cycle * 8, residB = 155 - cycle * 8;
      bp.style.background = `rgba(${residR},${residG},${residB},${0.45 + cycle*0.1})`;
      bp.style.boxShadow = `0 0 ${10+cycle*6}px rgba(${residR},${residG},${residB},${0.2+cycle*0.08})`;
      const wordOpacity = Math.max(0, 1 - cycle * 0.36);
      const wR = 180 + cycle*50, wG = 175 + cycle*35, wB = 165 + cycle*15;
      letters.forEach(span => {
        span.style.opacity = wordOpacity.toFixed(2);
        span.style.color = `rgba(${Math.min(255,wR)},${Math.min(255,wG)},${Math.min(255,wB)},${(wordOpacity+0.05).toFixed(2)})`;
        span.style.filter = `blur(${cycle * 0.8}px)`;
      });
    }, 4400);
    dDelay(() => { const dot = document.getElementById('dec-dot'+(cycle-1)); if (dot) dot.classList.add('done'); }, 8800);
    dDelay(() => { hideBtext(); }, 8000);
    dDelay(runCycle, 10200);
  }
  dDelay(runCycle, 800);
}

function showDecEnd() {
  currentMode = 'decohere-end';
  const t = TRANSLATIONS[lang];
  const nd = parseInt(localStorage.getItem('field_obs_decohere')||'0') + 1;
  localStorage.setItem('field_obs_decohere', nd);
  spParticles = Array.from({length:12}, (_,i) => new SpParticle(i,12));
  spParticles.forEach(p => {
    p.x = innerWidth/2 + (Math.random()-0.5)*20;
    p.y = innerHeight/2 + (Math.random()-0.5)*20;
    p.targetAlpha = 0; p.targetClarity = 0; p.phV *= 0.5;
  });
  setTimeout(() => { spParticles.forEach(p => { p.targetAlpha = 0.22 + Math.random()*0.2; }); }, 600);
  document.getElementById('decEndLine').textContent = t.decEndLine;
  document.getElementById('decRetBtn').textContent = t.decRetBtn;
  document.getElementById('decAgainBtn').textContent = t.decAgainBtn;
  const witnessed = document.getElementById('decWitnessed');
  if (witnessed) {
    const sentence = (WITNESSED[lang] && WITNESSED[lang][decStateName]) || '';
    witnessed.textContent = sentence; witnessed.style.opacity = '0';
  }
  const btns = document.querySelector('.dec-btns');
  if (btns) { btns.style.opacity='0'; btns.style.transition='opacity 1.4s ease'; btns.style.pointerEvents='none'; }
  showScreen('s-dec-end', () => {
    setTimeout(() => { if (witnessed) witnessed.style.opacity = '1'; }, 1500);
    setTimeout(() => { if (btns) { btns.style.opacity='1'; btns.style.pointerEvents='all'; } }, 8000);
  });
}

function clearAllDec() { decBreathTimers.forEach(clearTimeout); decBreathTimers = []; }

// ── WELCOME INTRO ──
let wlcStep = 0;
const WLC_TOTAL = 3;

function buildWelcome() {
  const t = TRANSLATIONS[lang];
  document.getElementById('wlc0-big').innerHTML = t.welcomeCard0Big.replace(/\n/g,'<br>');
  document.getElementById('wlc0-small').innerHTML = t.welcomeCard0Small.replace(/\n/g,'<br>');
  document.getElementById('wlc1-big').innerHTML = t.welcomeCard1Big.replace(/\n/g,'<br>');
  document.getElementById('wlc1-small').innerHTML = t.welcomeCard1Small.replace(/\n/g,'<br>');
  document.getElementById('wlc2-big').innerHTML = t.welcomeCard2Big.replace(/\n/g,'<br>');
  t.wlcMvLabels.forEach((l,i) => { const el = document.getElementById('wlc-ml'+i); if(el) el.textContent = l; });
  t.wlcMvHints.forEach((h,i) => { const el = document.getElementById('wlc-mh'+i); if(el) el.textContent = h; });
  document.getElementById('wlcEnterBtn').textContent = t.wlcEnterBtn;
  document.getElementById('wlcTapHint').textContent = t.wlcTapHint;
  wlcStep = 0;
  updateWlcDots();
}

function updateWlcDots() {
  for (let i = 0; i < WLC_TOTAL; i++) {
    const d = document.getElementById('wdot'+i);
    if (d) d.classList.toggle('on', i <= wlcStep);
  }
  const hint = document.getElementById('wlcTapHint');
  if (hint) hint.style.opacity = wlcStep === WLC_TOTAL - 1 ? '0' : '1';
}

function advanceWelcome() {
  if (wlcStep >= WLC_TOTAL - 1) return;
  const cur = document.getElementById('wlc' + wlcStep);
  if (!cur) return;
  cur.style.transition = 'opacity 0.8s ease'; cur.style.opacity = '0';
  setTimeout(() => {
    cur.classList.remove('on');
    wlcStep++;
    const next = document.getElementById('wlc' + wlcStep);
    if (next) {
      next.style.opacity = '0'; next.style.transition = 'none'; next.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        next.style.transition = 'opacity 1.1s ease'; next.style.opacity = '1';
      }));
    }
    updateWlcDots();
  }, 800);
}

function enterFromWelcome() {
  localStorage.setItem('field_welcomed', '1');
  showScreen('s-home', () => { initSpParticles(12); tryDrone(); });
}

document.getElementById('s-welcome').addEventListener('click', e => {
  if (e.target.id === 'wlcEnterBtn' || e.target.classList.contains('wlc-enter')) return;
  advanceWelcome();
});
document.getElementById('wlcEnterBtn').addEventListener('click', e => {
  e.stopPropagation();
  enterFromWelcome();
});

// ── INIT ──
applyLang();

// Wire up observe to go to setup
document.getElementById('mv-observe').onclick = startObserveSetup;

if (!localStorage.getItem('field_welcomed')) {
  buildWelcome();
  document.getElementById('s-home').classList.remove('active');
  document.getElementById('s-welcome').classList.add('active');
  initSpParticles(12);
  tryDrone();
} else {
  initSpParticles(12);
  tryDrone();
}

window.addEventListener('keydown', e => {
  if (e.key===' '||e.key==='Enter') {
    const active = document.querySelector('.screen.active');
    if (active && active.id==='s-init') advanceStep();
  }
});
