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
    // Full screen distribution — field surrounds you, not just above
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
    // Full screen — no clamping to top quarter
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
    // Blur matching original Collapse: (1-clarity)*14 + 2 for full superposition feel
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

// ── OBSERVE PARTICLE ──
let clarityLevel = 0, particleVisible = false;
let obsMode = 'drift'; // 'drift' | 'kasina'
let obsMinutes = 5;    // 1 | 5 | 10
let obsTimerEnd = 0;   // epoch ms when session ends
let obsTimerInterval = null;
let kasinaParticle = null;

// ── KASINA PARTICLE — fixed centre, pulses / shudders / vibrates ──
class KasinaParticle {
  constructor() {
    this.x = innerWidth * 0.5;
    this.y = innerHeight * 0.5;
    this.r = 7;
    this.alpha = 0; this.targetAlpha = 1;
    this.breathPh = 0;
    this.shudderX = 0; this.shudderY = 0;
    this.shudderIntensity = 0; // 0..1, rises when phone moves
    this.pulsePh = 0;
    this.shudderPh = 0;
  }
  update() {
    this.breathPh  += 0.018; // ~5.8s breath cycle
    this.pulsePh   += 0.06;  // faster micro-pulse
    this.shudderPh += 0.22;
    // Shudder — tiny random displacement, intensity from motion
    const shudderAmp = isStill ? 0.8 + 1.2*Math.sin(this.shudderPh)*Math.cos(this.shudderPh*1.3)
                                : 3 + 6*Math.random();
    this.shudderX = (Math.random()-0.5) * shudderAmp;
    this.shudderY = (Math.random()-0.5) * shudderAmp;
    this.shudderIntensity += ((!isStill ? 1 : 0) - this.shudderIntensity) * 0.08;
    this.alpha += (this.targetAlpha - this.alpha) * 0.025;
  }
  draw() {
    if (this.alpha < 0.01) return;
    const px = this.x + this.shudderX;
    const py = this.y + this.shudderY;
    const breathFactor = 0.72 + 0.28 * Math.sin(this.breathPh);
    const microPulse   = 1 + 0.04 * Math.sin(this.pulsePh);
    const blur = (1 - clarityLevel) * 10 + 2;
    const r    = (this.r + clarityLevel * 3) * microPulse;
    const glow = (24 + clarityLevel * 50) * breathFactor;
    const ga   = (0.18 + clarityLevel * 0.4) * this.alpha;
    cx.save();
    cx.filter = `blur(${blur.toFixed(1)}px)`;
    const grad = cx.createRadialGradient(px, py, 0, px, py, glow);
    grad.addColorStop(0, `rgba(240,204,136,${(ga).toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(240,180,90,${(ga*0.4).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(240,204,136,0)');
    cx.fillStyle = grad;
    cx.beginPath(); cx.arc(px, py, glow, 0, Math.PI*2); cx.fill();
    cx.filter = 'none';
    cx.globalAlpha = this.alpha;
    cx.fillStyle = `rgba(240,210,140,${0.75 + clarityLevel*0.25})`;
    cx.beginPath(); cx.arc(px, py, r, 0, Math.PI*2); cx.fill();
    cx.restore();
  }
}
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
  try {
    cx.clearRect(0, 0, cv.width, cv.height);
    bgPts.forEach(p => { p.update(); p.draw(); });
    if (currentMode === 'observe' && particleVisible) {
      if (obsMode === 'kasina' && kasinaParticle) {
        kasinaParticle.update(); kasinaParticle.draw();
      } else if (obsMode === 'drift' && observeParticle) {
        observeParticle.update();
        if (observeParticle.scattering) observeParticle.drawScatter();
        else observeParticle.draw();
      }
    }
    if ((currentMode === 'collapse' || currentMode === 'home' || currentMode === 'decohere') && spParticles.length) {
      spParticles.forEach(p => { p.update(); p.draw(); });
    }
  } catch(e) { console.warn('loop err:', e); }
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
  // Always clear ghost words unless entering collapse/field screens
  if (id !== 's-collapse' && id !== 's-field') {
    const gh = document.getElementById('ghosts');
    if (gh) {
      gh.style.transition = 'opacity 0.6s ease';
      gh.style.opacity = '0';
      setTimeout(() => { gh.innerHTML = ''; }, 700);
    }
  }
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
// Apply on load
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
      // Particles bloom from centre — dissolved state rejoining the field
      setTimeout(() => {
        spParticles = Array.from({length:12}, (_,i) => new SpParticle(i,12));
        spParticles.forEach(p => {
          p.x = innerWidth/2 + (Math.random()-0.5)*30;
          p.y = innerHeight/2 + (Math.random()-0.5)*30;
          p.targetAlpha = 0;
          p.targetClarity = 0;
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
  // Clear all lit states
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
    // After Decohere: ◯ glyph glows for 3 minutes
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
// OBSERVE MOVEMENT — three-signal attention
// ══════════════════════════════════════

function buildObsScreen() {
  const screen = document.getElementById('s-observe');
  const t = lang === 'en';
  const modeHint = obsMode === 'kasina'
    ? (t ? 'One point.<br>Hold it gently.' : 'Un punto.<br>Sostenlo suavemente.')
    : (t ? 'One particle.<br>Just watch it.' : 'Una partícula.<br>Solo obsérvala.');
  screen.innerHTML = `
    <div id="obs-hint-txt" style="position:fixed;top:42%;left:50%;transform:translate(-50%,-50%);
      text-align:center;opacity:0;transition:opacity 1.5s ease;z-index:20;pointer-events:none;">
      <div style="font-size:clamp(22px,6vw,30px);font-weight:300;letter-spacing:.12em;
        color:rgba(201,169,110,.5);margin-bottom:18px;">${obsMode==='kasina'?'·':'◎'}</div>
      <div style="font-size:clamp(15px,3.8vw,19px);letter-spacing:.10em;
        color:rgba(240,230,208,.5);line-height:1.9;">${modeHint}</div>
    </div>
    <div id="clarity-ring"></div>
    <div id="obs-timer" style="position:fixed;top:72px;left:50%;transform:translateX(-50%);
      font-size:clamp(14px,3.5vw,17px);letter-spacing:.14em;color:rgba(201,169,110,.3);
      z-index:20;opacity:0;transition:opacity 1.5s ease;font-weight:300;pointer-events:none;"></div>
    <div id="obs-signals" style="position:fixed;bottom:clamp(90px,20vw,120px);left:50%;
      transform:translateX(-50%);display:flex;gap:24px;align-items:flex-end;
      opacity:0;transition:opacity 1.5s ease;z-index:20;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div class="sig-dot" id="sig-still"></div>
        <div class="sig-label">${t?'still':'quieto'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div class="sig-dot" id="sig-present"></div>
        <div class="sig-label">${t?'present':'presente'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div class="sig-dot" id="sig-affirm"></div>
        <div class="sig-label">${t?'here':'aquí'}</div>
      </div>
    </div>
    <div id="meter" style="position:fixed;bottom:clamp(48px,10vw,64px);left:50%;
      transform:translateX(-50%);display:flex;gap:6px;align-items:center;
      z-index:20;opacity:0;transition:opacity 1.5s ease;"></div>
    <div id="scatter-text" style="position:fixed;top:36%;left:50%;transform:translateX(-50%);
      font-size:clamp(13px,3.2vw,16px);letter-spacing:.14em;color:rgba(240,230,208,.45);
      white-space:nowrap;opacity:0;transition:opacity 1s ease;z-index:20;pointer-events:none;"></div>
    <div id="affirmWrap" style="position:fixed;bottom:clamp(140px,32vw,190px);left:50%;
      transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;
      gap:14px;opacity:0;transition:opacity 1.5s ease;z-index:30;">
      <button id="affirmBtn" onclick="doAffirm()"
        style="width:88px;height:88px;border-radius:50%;background:none;
        border:1.5px solid rgba(201,169,110,.35);cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        display:flex;align-items:center;justify-content:center;
        transition:border-color .3s ease,box-shadow .3s ease;
        animation:affirmPulse 4s ease-in-out infinite;">
        <div id="affirmDot" style="width:14px;height:14px;border-radius:50%;
          background:rgba(201,169,110,.55);
          transition:transform .25s ease,background .25s ease;"></div>
      </button>
      <div style="font-size:clamp(11px,2.8vw,14px);letter-spacing:.16em;
        color:rgba(201,169,110,.38);">${t?'i am here':'estoy aquí'}</div>
    </div>
  `;
  buildObsMeter();
  setTimeout(() => {
    const timerEl = document.getElementById('obs-timer');
    if (timerEl) { timerEl.style.transition = 'opacity 1.5s ease'; timerEl.style.opacity = '1'; }
  }, 1000);
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
  if (navigator.vibrate) navigator.vibrate(18);
  currentMode = 'observe'; showBackBtn(); initAudio();
  // Spawn particle immediately at alpha 0 — already running behind setup screen
  isCoherent = false; fieldActive = false; attentionSec = 0;
  affirmBonus = 0; clarityLevel = 0; isStill = true; lastAffirmTime = 0;
  if (obsMode === 'kasina') {
    kasinaParticle = new KasinaParticle(); kasinaParticle.targetAlpha = 0;
    observeParticle = null;
  } else {
    observeParticle = new ObsParticle(); observeParticle.targetAlpha = 0;
    kasinaParticle = null;
  }
  particleVisible = true;
  buildObsSetupScreen();
  showScreen('s-observe');
}

function buildObsSetupScreen() {
  const t = lang === 'en';
  const screen = document.getElementById('s-observe');

  // Build DOM directly — no onclick in innerHTML (iOS Safari blocks it)
  screen.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.id = 'obs-setup';
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:clamp(28px,7vw,44px);padding:clamp(24px,6vw,48px);width:100%;max-width:400px;' +
    'margin:auto;opacity:0;transition:opacity 1.2s ease;';

  // Title
  const title = document.createElement('div');
  title.style.cssText = 'font-size:clamp(14px,3.5vw,17px);letter-spacing:.18em;color:rgba(201,169,110,.45);text-transform:uppercase;';
  title.textContent = t ? 'observe' : 'observar';
  wrap.appendChild(title);

  // ── Particle mode ──
  const modeSection = document.createElement('div');
  modeSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;';

  const modeLabel = document.createElement('div');
  modeLabel.style.cssText = 'font-size:clamp(12px,3vw,15px);letter-spacing:.14em;color:rgba(240,230,208,.35);';
  modeLabel.textContent = t ? 'particle' : 'partícula';
  modeSection.appendChild(modeLabel);

  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:12px;width:100%;max-width:320px;';

  const btnDrift = document.createElement('button');
  btnDrift.id = 'obs-mode-drift';
  btnDrift.style.cssText = 'flex:1;padding:20px 8px;background:none;border:1px solid rgba(201,169,110,.18);' +
    'border-radius:12px;color:rgba(240,230,208,.4);font-family:inherit;' +
    'font-size:clamp(15px,3.8vw,18px);letter-spacing:.08em;cursor:pointer;' +
    '-webkit-tap-highlight-color:transparent;transition:all .3s ease;min-height:64px;';
  btnDrift.textContent = t ? 'drift' : 'deriva';
  btnDrift.addEventListener('click', () => setObsMode('drift'));
  btnDrift.addEventListener('touchend', e => { e.preventDefault(); setObsMode('drift'); });

  const btnKasina = document.createElement('button');
  btnKasina.id = 'obs-mode-kasina';
  btnKasina.style.cssText = 'flex:1;padding:20px 8px;background:none;border:1px solid rgba(201,169,110,.18);' +
    'border-radius:12px;color:rgba(240,230,208,.4);font-family:inherit;' +
    'font-size:clamp(15px,3.8vw,18px);letter-spacing:.08em;cursor:pointer;' +
    '-webkit-tap-highlight-color:transparent;transition:all .3s ease;min-height:64px;';
  btnKasina.textContent = 'kasina';
  btnKasina.addEventListener('click', () => setObsMode('kasina'));
  btnKasina.addEventListener('touchend', e => { e.preventDefault(); setObsMode('kasina'); });

  modeRow.appendChild(btnDrift);
  modeRow.appendChild(btnKasina);
  modeSection.appendChild(modeRow);
  wrap.appendChild(modeSection);

  // ── Duration ──
  const timeSection = document.createElement('div');
  timeSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;';

  const timeLabel = document.createElement('div');
  timeLabel.style.cssText = 'font-size:clamp(12px,3vw,15px);letter-spacing:.14em;color:rgba(240,230,208,.35);';
  timeLabel.textContent = t ? 'duration' : 'duración';
  timeSection.appendChild(timeLabel);

  const timeRow = document.createElement('div');
  timeRow.style.cssText = 'display:flex;gap:10px;width:100%;max-width:320px;';

  [1, 5, 10].forEach(m => {
    const b = document.createElement('button');
    b.id = 'obs-time-' + m;
    b.style.cssText = 'flex:1;padding:20px 6px;background:none;border:1px solid rgba(201,169,110,.18);' +
      'border-radius:12px;color:rgba(240,230,208,.4);font-family:inherit;' +
      'font-size:clamp(14px,3.5vw,17px);letter-spacing:.06em;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;transition:all .3s ease;min-height:64px;';
    b.textContent = m + 'm';
    b.addEventListener('click', () => setObsTime(m));
    b.addEventListener('touchend', e => { e.preventDefault(); setObsTime(m); });
    timeRow.appendChild(b);
  });

  timeSection.appendChild(timeRow);
  wrap.appendChild(timeSection);

  // ── Enter ──
  const enterBtn = document.createElement('button');
  enterBtn.style.cssText = 'background:none;border:none;font-family:inherit;' +
    'font-size:clamp(14px,3.5vw,17px);letter-spacing:.18em;color:rgba(201,169,110,.55);' +
    'cursor:pointer;padding:24px 48px;-webkit-tap-highlight-color:transparent;transition:color .4s ease;min-height:64px;';
  enterBtn.textContent = t ? 'enter' : 'entrar';
  enterBtn.addEventListener('click', enterObserve);
  enterBtn.addEventListener('touchend', e => { e.preventDefault(); enterObserve(); });
  wrap.appendChild(enterBtn);

  screen.appendChild(wrap);

  // Fade in
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wrap.style.opacity = '1';
  }));

  // Apply current selections
  setObsMode(obsMode);
  setObsTime(obsMinutes);
}

function setObsMode(mode) {
  obsMode = mode;
  const drift  = document.getElementById('obs-mode-drift');
  const kasina = document.getElementById('obs-mode-kasina');
  if (drift) {
    drift.style.borderColor = mode==='drift' ? 'rgba(201,169,110,.7)' : 'rgba(201,169,110,.18)';
    drift.style.color       = mode==='drift' ? 'rgba(240,204,136,.9)' : 'rgba(240,230,208,.45)';
  }
  if (kasina) {
    kasina.style.borderColor = mode==='kasina' ? 'rgba(201,169,110,.7)' : 'rgba(201,169,110,.18)';
    kasina.style.color       = mode==='kasina' ? 'rgba(240,204,136,.9)' : 'rgba(240,230,208,.45)';
  }
  // Swap particle type silently — keeps same alpha, no jump
  if (currentMode === 'observe') {
    const curAlpha = (observeParticle ? observeParticle.alpha : 0) ||
                     (kasinaParticle  ? kasinaParticle.alpha  : 0);
    if (mode === 'kasina' && !kasinaParticle) {
      kasinaParticle = new KasinaParticle();
      kasinaParticle.alpha = curAlpha; kasinaParticle.targetAlpha = curAlpha;
      observeParticle = null;
    } else if (mode === 'drift' && !observeParticle) {
      observeParticle = new ObsParticle();
      observeParticle.alpha = curAlpha; observeParticle.targetAlpha = curAlpha;
      kasinaParticle = null;
    }
  }
}

function setObsTime(mins) {
  obsMinutes = mins;
  [1,5,10].forEach(m => {
    const btn = document.getElementById('obs-time-'+m);
    if (!btn) return;
    btn.style.borderColor = m===mins ? 'rgba(201,169,110,.7)' : 'rgba(201,169,110,.18)';
    btn.style.color       = m===mins ? 'rgba(240,204,136,.9)' : 'rgba(240,230,208,.45)';
  });
}

function enterObserve() {
  initAudio(); // ensure audioCtx exists before any .state check
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  fadeDrone(true, 1); spParticles = [];
  // Fade out setup, build observe screen
  const setup = document.getElementById('obs-setup');
  if (setup) { setup.style.transition = 'opacity 0.8s ease'; setup.style.opacity = '0'; }
  setTimeout(() => {
    buildObsScreen();
    // Particle already running — just raise alpha to visible
    if (obsMode === 'kasina' && kasinaParticle) {
      kasinaParticle.targetAlpha = 1;
    } else if (observeParticle) {
      observeParticle.targetAlpha = 0.9;
    }
    // Subtle observe drone
    if (audioCtx && !droneNodes.length && currentMode === 'observe') {
      try {
        [40,80,120].forEach((f,i) => {
          const o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0, audioCtx.currentTime);
          g.gain.linearRampToValueAtTime(0.015-i*0.004, audioCtx.currentTime+3);
          o.connect(g); g.connect(audioCtx.destination); o.start();
          droneNodes.push({o, g, frequency: o.frequency});
        });
      } catch(e) { console.warn('obs drone:', e); }
    }
    // Set timer end
    obsTimerEnd = Date.now() + obsMinutes * 60 * 1000;
    // Fade in hint
    setTimeout(() => {
      const hint = document.getElementById('obs-hint-txt');
      if (hint) { hint.style.transition = 'opacity 1.5s ease'; hint.style.opacity = '1'; }
    }, 300);
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
      startObsTimer();
      const sigs = document.getElementById('obs-signals');
      const meter = document.getElementById('meter');
      const wrap = document.getElementById('affirmWrap');
      if (sigs) { sigs.style.transition = 'opacity 1.5s ease'; sigs.style.opacity = '1'; }
      if (meter) { meter.style.transition = 'opacity 1.5s ease'; meter.style.opacity = '1'; }
      if (wrap) { wrap.style.transition = 'opacity 1.5s ease'; wrap.style.opacity = '1'; }
    }, 4500);
  }, 900);
}

function startObsTimer() {
  clearInterval(obsTimerInterval);
  obsTimerInterval = setInterval(() => {
    if (!fieldActive || isCoherent || currentMode !== 'observe') return;
    const remaining = obsTimerEnd - Date.now();
    const el = document.getElementById('obs-timer');
    if (el) {
      const secs = Math.max(0, Math.ceil(remaining / 1000));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      el.textContent = m + ':' + String(s).padStart(2, '0');
    }
    if (remaining <= 0) {
      clearInterval(obsTimerInterval);
      reachObsCoherence();
    }
  }, 1000);
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
  ['obs-signals','meter','affirmWrap','scatter-text','obs-hint-txt','obs-timer'].forEach(id => {
    const el = document.getElementById(id); if (el) { el.style.transition = 'opacity 1.5s ease'; el.style.opacity = '0'; }
  });
  // Count both total and observe-specific
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
  clearInterval(attentionTimer); clearInterval(microToneTimer);
  clearInterval(motionCheckInterval); clearInterval(obsTimerInterval);
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
    // Brief delay before showing ghosts so screen fade completes first
    setTimeout(() => {
      document.getElementById('ghosts').style.transition = 'opacity 1.2s ease';
      document.getElementById('ghosts').style.opacity = '1';
      buildGhosts(state.name);
    }, 200);
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
  // Opacity controlled by caller — no direct set here
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
      // If already visible, fade out first; if already hidden, just set and fade in
      const isVisible = parseFloat(btext.style.opacity||'0') > 0.05;
      if (isVisible) {
        btext.style.transition='opacity 0.5s ease'; btext.style.opacity='0';
        bDelay(()=>{ btext.className='btext'+(cls?' '+cls:''); btext.textContent=text; btext.style.transition='opacity 0.9s ease'; btext.style.opacity='1'; }, 550);
      } else {
        btext.className='btext'+(cls?' '+cls:''); btext.textContent=text;
        btext.style.transition='opacity 1.1s ease'; btext.style.opacity='1';
      }
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
  if (navigator.vibrate) navigator.vibrate(18);
  currentMode = 'decohere'; showBackBtn();
  clearGhosts();
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

  // Reset all layers to zero — clean slate, no flash
  const ackLayer   = document.getElementById('dec-ack-layer');
  const breathLayer= document.getElementById('dec-breath-layer');
  const wordEl     = document.getElementById('dec-word');
  const ackLine    = document.getElementById('dec-ack-line');
  const btext      = document.getElementById('dec-btext');
  const bp         = document.getElementById('dec-bp');

  // Kill transitions temporarily so reset is instant
  [ackLayer, breathLayer, wordEl, ackLine, btext, bp].forEach(el => {
    if (el) { el.style.transition = 'none'; el.style.opacity = '0'; }
  });

  // Set content before anything is visible
  wordEl.innerHTML = '';
  displayName.split('').forEach(ch => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    span.style.cssText = 'display:inline-block;transition:none;';
    wordEl.appendChild(span);
  });
  ackLine.textContent = lang==='en' ? 'seen.' : 'visto.';

  // Reset breath layer elements
  [0,1,2].forEach(i => {
    const d = document.getElementById('dec-dot'+i);
    if (d) d.classList.remove('done');
  });
  if (bp) { bp.style.transform='scale(1)'; bp.style.filter=''; bp.style.background='rgba(180,175,165,.5)'; }

  showScreen('s-dec-breath', () => {
    // Re-enable transitions after screen is visible
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wordEl.style.transition = 'color 3s ease, opacity 2s ease';
      ackLayer.style.transition = 'opacity 1s ease';
      ackLine.style.transition = 'opacity 1.4s ease';

      // Fade word in
      setTimeout(() => { wordEl.style.opacity = '1'; }, 100);
      // Fade ack layer in (contains "yes. this is real.")
      setTimeout(() => { ackLayer.style.opacity = '1'; }, 200);
      // Fade ack line in after word settles
      setTimeout(() => { ackLine.style.opacity = '1'; }, 1400);

      // After 5s — cross-fade: ack layer out, breath layer in (word stays put)
      setTimeout(() => startDecBreath(displayName), 5000);
    }));
  });
}

// PHASE 2: Breath cycles — all 10 improvements
function startDecBreath(displayName) {
  const t = TRANSLATIONS[lang];
  const ackLayer    = document.getElementById('dec-ack-layer');
  const breathLayer = document.getElementById('dec-breath-layer');
  const wordEl      = document.getElementById('dec-word');
  const btext       = document.getElementById('dec-btext');
  const bp          = document.getElementById('dec-bp');
  const letters     = Array.from(wordEl.querySelectorAll('span'));

  // Assign per-letter stagger transitions — smooth, no jank
  letters.forEach((span, i) => {
    const dur  = (1.8 + Math.random()*1.4).toFixed(2);
    const dly  = (Math.random()*0.6).toFixed(2);
    span.style.transition =
      `opacity ${dur}s ease ${dly}s,` +
      `transform ${(parseFloat(dur)+0.4).toFixed(2)}s ease ${dly}s,` +
      `color 2s ease,filter ${dur}s ease ${dly}s`;
  });

  // Hide back button during dissolution — no escape affordance
  const backBtn = document.getElementById('backBtn');
  if (backBtn) { backBtn.style.opacity='0'; backBtn.style.pointerEvents='none'; }

  // Cross-fade: ack layer out, breath layer in — word stays put
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
    const isVisible = parseFloat(btext.style.opacity||'0') > 0.05;
    if (isVisible) {
      btext.style.transition = 'opacity 0.5s ease';
      btext.style.opacity = '0';
      const id = setTimeout(() => {
        btext.textContent = txt;
        btext.style.transition = 'opacity 1s ease';
        btext.style.opacity = '1';
      }, 550);
      decBreathTimers.push(id);
    } else {
      btext.textContent = txt;
      btext.style.transition = 'opacity 1.2s ease';
      btext.style.opacity = '1';
    }
  }
  function hideBtext() {
    if (!btext) return;
    btext.style.transition = 'opacity 0.8s ease';
    btext.style.opacity = '0';
  }

  // Fire exhale ripple on a given cycle index
  function fireRipple(idx) {
    const rip = document.getElementById('dec-rip'+idx);
    if (!rip) return;
    rip.classList.remove('go');
    void rip.offsetWidth; // force reflow
    rip.classList.add('go');
  }

  // Modulate drone pitch subtly on inhale/exhale
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
      // Restore back button
      if (backBtn) { backBtn.style.opacity='1'; backBtn.style.pointerEvents='all'; }

      // Phase 3a: letter fragmentation — drift apart before dissolving
      dDelay(() => {
        hideBtext();
        letters.forEach((span, i) => {
          const tx = (Math.random()-0.5)*80;
          const ty = (Math.random()-0.5)*60 - 20;
          const rot = (Math.random()-0.5)*25;
          span.style.opacity = '0';
          span.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg)`;
          span.style.filter = 'blur(10px)';
        });
        // bp particle pulses bright then fades — becomes the residual glow
        if (bp) {
          bp.style.transition = 'transform 1.2s cubic-bezier(.4,0,.2,1),opacity 1.8s ease,background 1.2s ease,box-shadow 1.2s ease';
          bp.style.transform = 'scale(4)';
          bp.style.background = 'rgba(240,204,136,.8)';
          bp.style.boxShadow = '0 0 40px rgba(240,204,136,.6)';
        }
        playDecohereRelease();
      }, 400);

      // Phase 3b: bp contracts to tiny residual glow
      dDelay(() => {
        if (bp) {
          bp.style.transition = 'transform 3s cubic-bezier(.4,0,.2,1),opacity 3s ease,background 3s ease,box-shadow 3s ease';
          bp.style.transform = 'scale(0.5)';
          bp.style.opacity = '0.35';
          bp.style.background = 'rgba(201,169,110,.6)';
          bp.style.boxShadow = '0 0 8px rgba(201,169,110,.3)';
        }
      }, 1800);

      dDelay(() => showDecEnd(), 5500);
      return;
    }
    cycle++;
    if (!bp) return;

    const inhaleText = t.decInhale;
    const exhaleText = t.decExhale;

    // ── INHALE PHASE ──
    // Show inhale text immediately
    setBtext(inhaleText);

    // bp expands, warms, brightens — covers word
    dDelay(() => {
      // Scale grows progressively each cycle: 5 → 7 → 9 — big enough to envelop word
      const maxScale = 5 + cycle * 2;
      // Warmer and brighter each cycle
      const r = 190 + cycle * 16, g = 178 + cycle * 10, b = 150 - cycle * 12;
      const glowStr = 0.25 + cycle * 0.18;
      bp.style.transition =
        'transform 4s cubic-bezier(.35,0,.15,1),' +
        'filter 4s ease,' +
        'background 3.5s ease,' +
        'box-shadow 3.5s ease';
      bp.style.transform = `scale(${maxScale})`;
      bp.style.filter = `blur(${3 + cycle * 1.5}px)`;
      bp.style.background = `rgba(${r},${g},${b},0.65)`;
      bp.style.boxShadow = `0 0 ${30+cycle*20}px rgba(${r},${g},${b},${glowStr})`;
      // Pitch up drone
      dronePitch(true);
    }, 100);

    // Top-up cue at 2s
    dDelay(() => {
      // Nudge scale a little more — the "and once more" sip
      const nudge = 5 + cycle * 2 + 0.8;
      bp.style.transition = 'transform 2s cubic-bezier(.4,0,.2,1)';
      bp.style.transform = `scale(${nudge})`;
    }, 2200);

    // ── EXHALE PHASE ──
    dDelay(() => {
      setBtext(exhaleText);
      // Haptic pulse on exhale
      if (navigator.vibrate) navigator.vibrate(22);
      // Fire ripple ring
      fireRipple(cycle - 1);
      // Pitch down drone
      dronePitch(false);

      // bp contracts — smooth, long ease
      bp.style.transition =
        'transform 4.5s cubic-bezier(.4,0,.2,1),' +
        'filter 4s ease,' +
        'background 3s ease,' +
        'box-shadow 3s ease';
      bp.style.transform = 'scale(1)';
      bp.style.filter = 'blur(0px)';
      // After contraction, residual warmth remains
      const residR = 180 + cycle * 12, residG = 170 + cycle * 8, residB = 155 - cycle * 8;
      bp.style.background = `rgba(${residR},${residG},${residB},${0.45 + cycle*0.1})`;
      bp.style.boxShadow = `0 0 ${10+cycle*6}px rgba(${residR},${residG},${residB},${0.2+cycle*0.08})`;

      // Word reappears but more dissolved — opacity steps: 1 → 0.62 → 0.28 → 0 (handled at cycle end)
      const wordOpacity = Math.max(0, 1 - cycle * 0.36);
      const wR = 180 + cycle*50, wG = 175 + cycle*35, wB = 165 + cycle*15;
      letters.forEach(span => {
        span.style.opacity = wordOpacity.toFixed(2);
        span.style.color = `rgba(${Math.min(255,wR)},${Math.min(255,wG)},${Math.min(255,wB)},${(wordOpacity+0.05).toFixed(2)})`;
        // Subtle blur accumulates
        span.style.filter = `blur(${cycle * 0.8}px)`;
      });
    }, 4400);

    // Mark cycle dot done
    dDelay(() => {
      const dot = document.getElementById('dec-dot'+(cycle-1));
      if (dot) dot.classList.add('done');
    }, 8800);

    // Hide btext, pause before next cycle
    dDelay(() => { hideBtext(); }, 8000);
    dDelay(runCycle, 10200);
  }

  dDelay(runCycle, 800);
}

// PHASE 3: End — witnessed sentence, silence, reformation
function showDecEnd() {
  currentMode = 'decohere-end';
  const t = TRANSLATIONS[lang];
  const nd = parseInt(localStorage.getItem('field_obs_decohere')||'0') + 1;
  localStorage.setItem('field_obs_decohere', nd);

  // Particles bloom outward from centre — reformation
  spParticles = Array.from({length:12}, (_,i) => new SpParticle(i,12));
  spParticles.forEach(p => {
    p.x = innerWidth/2 + (Math.random()-0.5)*20;
    p.y = innerHeight/2 + (Math.random()-0.5)*20;
    p.targetAlpha = 0;
    p.targetClarity = 0;
    p.phV *= 0.5;
  });
  // Bloom: particles radiate outward over 2s
  setTimeout(() => {
    spParticles.forEach(p => {
      p.targetAlpha = 0.22 + Math.random()*0.2;
    });
  }, 600);

  // Populate content
  document.getElementById('decEndLine').textContent = t.decEndLine;
  document.getElementById('decRetBtn').textContent = t.decRetBtn;
  document.getElementById('decAgainBtn').textContent = t.decAgainBtn;

  // Witnessed sentence — unique per state
  const witnessed = document.getElementById('decWitnessed');
  if (witnessed) {
    const sentence = (WITNESSED[lang] && WITNESSED[lang][decStateName]) || '';
    witnessed.textContent = sentence;
    witnessed.style.opacity = '0';
  }

  // Hide btns and sub initially
  const btns = document.querySelector('.dec-btns');
  if (btns) { btns.style.opacity='0'; btns.style.transition='opacity 1.4s ease'; btns.style.pointerEvents='none'; }

  showScreen('s-dec-end', () => {
    // Witnessed sentence fades in after 1.5s — let silence settle first
    setTimeout(() => {
      if (witnessed) witnessed.style.opacity = '1';
    }, 1500);
    // Buttons appear after 8s of silence
    setTimeout(() => {
      if (btns) { btns.style.opacity='1'; btns.style.pointerEvents='all'; }
    }, 8000);
  });
}

function clearAllDec() { decBreathTimers.forEach(clearTimeout); decBreathTimers = []; }

// ── WELCOME INTRO (first launch only) ──
let wlcStep = 0;
const WLC_TOTAL = 3;

function buildWelcome() {
  const t = TRANSLATIONS[lang];
  // Card 0
  document.getElementById('wlc0-big').innerHTML = t.welcomeCard0Big.replace(/\n/g,'<br>');
  document.getElementById('wlc0-small').innerHTML = t.welcomeCard0Small.replace(/\n/g,'<br>');
  // Card 1
  document.getElementById('wlc1-big').innerHTML = t.welcomeCard1Big.replace(/\n/g,'<br>');
  document.getElementById('wlc1-small').innerHTML = t.welcomeCard1Small.replace(/\n/g,'<br>');
  // Card 2
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

// First launch: show welcome. Return visits: show home directly.
if (!localStorage.getItem('field_welcomed')) {
  buildWelcome();
  // Start with welcome screen active, home inactive
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
