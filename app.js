// ═══════════════════════════════════════
// FIELD — Unified App v3.1
// Observe · Collapse · Witness
//
// FIXES & IMPROVEMENTS v3.1:
// [UX1]  Back button always visible during Observer (never hidden in countdown)
// [UX2]  isTransitioning flag properly set/cleared — no double-fire on rapid taps
// [UX3]  body-node left position clamped — safe on narrow screens
// [UX4]  Storm screen gets timed fade-out (3min) + tap-anywhere-to-exit
// [UX5]  Settings panel swipe-down to close gesture
// [UX6]  1m duration option hidden for drift/kasina (only noting needs it)
// [UX7]  Landing canvas resize listener uses { once } / cleanup
// [AE1]  obsCoherenceWord + dec-end-line get fieldTitleBreathe animation variant
// [AE2]  Orb hover: brief full-sharp pulse before state collapse
// [AE3]  shadow-orb base opacity raised to .82
// [AE4]  dec-witnessed buttons delayed to 12s (was 8s)
// [AE5]  Crystallised breath glow shifted to deep gold rgba(240,190,60,...)
// [AE6]  mv-hint opacity raised to .42
// [AE7]  tapNext/taph pulse speed varies: collapse-intro 1.8s, observe 3.8s, default 2.8s
// [TECH1] visibilitychange → suspend/resume audioCtx
// [TECH2] _flickering zeroed on spParticle reset
// [TECH3] isTransitioning fully wired
// ═══════════════════════════════════════

// ── STATE ──
let lang = (() => {
  const stored = localStorage.getItem('field_lang');
  if (stored) return stored;
  // Auto-detect: default to Spanish for Spanish-speaking devices
  const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
  return nav.startsWith('es') ? 'es' : 'en';
})();
let audioCtx = null, droneNodes = [], breathTimers = [], decBreathTimers = [];
let breathRunning = false, breathCycle = 0, curStateName = '', spChosen = 0;
let breathOrb = null; // canvas-driven breath orb
let collapseStage = 0, isTransitioning = false, particlesHidden = false;
let totalObs = parseInt(localStorage.getItem('field_obs') || '0');
let currentMode = 'home';
let audioEnabled = true;
let fontLarge = localStorage.getItem('field_font_large') === '1';

// Observer state
let attentionTimer = null, attentionSec = 0, isCoherent = false;
let fieldActive = false, scatterTO = null, observeParticle = null;
const COHERENCE_SEC = 45;
const METER_DOTS = 9;

// Three-signal attention system
let isStill = true, lastMotionTime = 0, lastAffirmTime = 0;
let affirmBonus = 0;
let microToneTimer = null;
let motionCheckInterval = null;

// Witness state
let decStateName = '', decStateNameES = '';
let decBodySpot = 'chest';
let decSomaticTone = '';    // pleasant | unpleasant | neutral
let decSomaticSpoken = '';  // what they said in voice sensing
let collapseBodySpot = 'chest';

// Voice noting state
let voiceRecognition = null;
let voiceActive = false;
let voiceTranscript = '';

// Observe mode state
let obsMode = 'drift';
let obsMinutes = 5;
let obsTimerEnd = 0;
let obsTimerInterval = null;
let kasinaParticle = null;

// Noting state
let obsStorm = false;
let noteCount = 0;
let noteSense = '';
let sessionNoteLog = []; // accumulates sense·tone pairs for AI mirror
let stormTimer = null;

// Storm screen timeout
let stormAutoExitTimer = null;

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
  draw() {
    cx.globalAlpha = this.alpha * bgDimLevel; cx.fillStyle = '#f0cc88';
    cx.beginPath(); cx.arc(this.x, this.y, this.r, 0, Math.PI*2); cx.fill(); cx.globalAlpha = 1;
  }
}
const bgPts = Array.from({length:70}, () => new Pt());
let bgDimTarget = 1; let bgDimLevel = 1;

// ── DEVICE TILT PARALLAX ──
let tiltX = 0, tiltY = 0; // -1 to 1 smoothed
let rawTiltX = 0, rawTiltY = 0;
window.addEventListener('deviceorientation', e => {
  // gamma = left/right (-90 to 90), beta = front/back (-180 to 180)
  rawTiltX = Math.max(-1, Math.min(1, (e.gamma || 0) / 30));
  rawTiltY = Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 40));
}, { passive: true });

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
    this.alpha = 0; this.targetAlpha = 0;
    this.clarity = 0; this.targetClarity = 0;
    this._flickering = false; // [TECH2]
  }
  update() {
    this.ph += this.phV;
    this.cx += (this.targetCx - this.cx) * 0.018;
    this.cy += (this.targetCy - this.cy) * 0.018;
    const ds = Math.min(innerWidth, innerHeight);
    // Tilt parallax — depth by index (outer particles move more)
    const tiltDepth = currentMode === 'home' ? (0.5 + (this.idx % 4) * 0.3) : 0;
    const tiltOffX = tiltX * 18 * tiltDepth;
    const tiltOffY = tiltY * 12 * tiltDepth;
    this.x = this.cx*innerWidth  + Math.cos(this.ph)*this.driftR*(ds/500) + tiltOffX;
    this.y = this.cy*innerHeight + Math.sin(this.ph*0.73)*this.driftR*0.65*(ds/500) + tiltOffY;
    this.alpha += (this.targetAlpha - this.alpha) * 0.025;
    this.clarity += (this.targetClarity - this.clarity) * 0.03;
    if (this._flickering) {
      this.alpha = 0.3 + Math.random()*0.65;
      this.clarity = Math.random()*0.3;
    }
  }
  draw() {
    if (this.alpha < 0.01) return;
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

// ── BREATH ORB — pure canvas, quantum collapse breathing ──
// Driven entirely by elapsed time in RAF loop. No CSS transitions.
class BreathOrb {
  constructor(x, y, palette) {
    this.x = x; this.y = y;
    this.targetX = innerWidth * 0.5;
    this.targetY = innerHeight * 0.5;
    this.alpha = 1;
    this.cycleCount = 0;
    this.maxCycles = 3;
    this.phase = 'settling';
    this.phaseStart = performance.now();
    this.cycleComplete = false;
    this.onCyclesDone = null;
    this.dispRadius = 9;
    this.dispBlur = 0;
    this.dispGlow = 1;
    this.MAX_RADIUS = palette === 'violet' ? Math.min(innerWidth, innerHeight) * 0.36 : 100;
    this.SETTLE = 9500;   // Extended — instructions play during this window
    this.INHALE = 5000;
    this.HOLD   = 1200;
    this.EXHALE = 5500;
    this.REST   = 700;
    this.ripples = [];
    this.flickPh = 0;
    this.onPhaseChange = null;
    this.wordText = '';
    this.wordAlpha = 0;
    this.wordTargetAlpha = 0;
    this.wordScale = 1;
    this.wordVibX = 0;    // vibration offset x
    this.wordVibY = 0;    // vibration offset y
    this.wordVibPh = 0;   // vibration phase
    this.wordGlowIntensity = 0; // 0→1 across cycles
    this.morphStartY = 0;
    this.MORPH_DURATION = 2800;
    this.MORPH_LIFT = innerHeight * 0.55;
    this.onMorphDone = null;
    // Colour palette
    if (palette === 'violet') {
      this.c1 = '210,180,240'; this.c2 = '175,135,215';
      this.c3 = '170,130,210'; this.c4 = '230,210,250'; this.c5 = '200,170,235';
    } else {
      this.c1 = '255,220,140'; this.c2 = '240,190,80';
      this.c3 = '240,190,80';  this.c4 = '255,240,180'; this.c5 = '240,210,140';
    }
  }

  get elapsed() { return performance.now() - this.phaseStart; }

  startPhase(name) {
    this.phase = name;
    this.phaseStart = performance.now();
    if (this.onPhaseChange) this.onPhaseChange(name, this.cycleCount);
  }

  update() {
    const t = this.elapsed;
    this.flickPh += 0.35;
    const flicker = 0.92 + 0.08 * Math.sin(this.flickPh);

    this.x += (this.targetX - this.x) * 0.04;
    this.y += (this.targetY - this.y) * 0.04;

    let targetRadius, targetBlur, targetGlow;

    if (this.phase === 'settling') {
      // Quiet — just sits and breathes gently while instructions play
      const p = Math.min(t / this.SETTLE, 1);
      targetRadius = 9 + 4 * Math.sin(p * Math.PI * 1.5);
      targetBlur   = 0;
      targetGlow   = 0.6 + 0.2 * Math.sin(p * Math.PI);
      if (t > this.SETTLE) this.startPhase('inhale');

    } else if (this.phase === 'inhale') {
      // Expand dramatically — all possibilities
      const p = Math.min(t / this.INHALE, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      targetRadius = 9 + (this.MAX_RADIUS - 9) * ease;
      targetBlur   = 0 + 16 * ease;     // more blur = more superposition
      targetGlow   = 1 - 0.5 * ease;
      // Word gets softer, more diffuse as possibilities expand
      this.wordVibPh += 0.04;
      this.wordVibX = Math.sin(this.wordVibPh) * 1.2 * ease;
      this.wordVibY = Math.cos(this.wordVibPh * 0.7) * 0.8 * ease;
      if (t > this.INHALE) {
        this.ripples.push({ r: this.dispRadius * 0.8, alpha: 0.5 });
        this.startPhase('hold');
      }

    } else if (this.phase === 'hold') {
      targetRadius = this.MAX_RADIUS;
      targetBlur   = 15;
      targetGlow   = 0.45;
      this.wordVibPh += 0.06;
      this.wordVibX = Math.sin(this.wordVibPh) * 2;
      this.wordVibY = Math.cos(this.wordVibPh * 0.8) * 1.2;
      if (t > this.HOLD) this.startPhase('exhale');

    } else if (this.phase === 'exhale') {
      // Collapse — wave function collapses, word becomes dominant
      const p = Math.min(t / this.EXHALE, 1);
      const ease = p < 0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
      targetRadius = this.MAX_RADIUS - (this.MAX_RADIUS - 12) * ease;
      targetBlur   = 15  - 15  * ease;
      targetGlow   = 0.45 + (1.2 + this.cycleCount * (this.cycleCount === 2 ? 1.2 : 0.4)) * ease;
      // Word vibration calms to stillness as it crystallises
      this.wordVibPh += 0.08 * (1 - ease);
      this.wordVibX = Math.sin(this.wordVibPh) * 2 * (1 - ease);
      this.wordVibY = Math.cos(this.wordVibPh * 0.7) * 1.2 * (1 - ease);
      // NOTE: wordGlowIntensity is set by onPhaseChange — not overridden here
      // On final cycle, send extra big ripple at exhale start for drama
      if (t < 60) {
        const ripCount = this.cycleCount === 2 ? 3 : 1;
        if (this.ripples.length < ripCount) {
          if (this.cycleCount === 2) {
            this.ripples.push({ r: 18, alpha: 0.85 });
            this.ripples.push({ r: 10, alpha: 0.6 });
            this.ripples.push({ r: 5,  alpha: 0.45 });
          } else {
            this.ripples.push({ r: 20, alpha: 0.7 });
          }
        }
      }
      if (t > this.EXHALE) {
        this.cycleCount++;
        if (this.cycleCount >= this.maxCycles) {
          this.startPhase('crystallised');
          if (this.onCyclesDone) setTimeout(() => this.onCyclesDone(), 600);
        } else {
          this.startPhase('rest');
        }
      }

    } else if (this.phase === 'rest') {
      targetRadius = 12;
      targetBlur   = 0;
      targetGlow   = 1.4;
      this.wordVibX = 0; this.wordVibY = 0;
      if (t > this.REST) this.startPhase('inhale');

    } else if (this.phase === 'crystallised') {
      const age = Math.min(t / 1400, 1);
      targetRadius = 12 + 6 * Math.sin(age * Math.PI * 0.5);
      targetBlur   = 0;
      targetGlow   = 1.8 + 0.5 * Math.sin(t * 0.003);
      this.wordGlowIntensity = 1;
      this.wordVibX = 0; this.wordVibY = 0;

    } else if (this.phase === 'morph') {
      const p = Math.min(t / this.MORPH_DURATION, 1);
      const ease = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2,2)/2;
      targetRadius = 12 * (1 - ease * 0.85);
      targetBlur   = 0;
      targetGlow   = 1.5 + ease * 2.5;
      this.wordScale = 1 - ease;
      const liftEase = Math.pow(p, 2);
      this.y = this.morphStartY - liftEase * this.MORPH_LIFT;
      if (t > this.MORPH_DURATION) {
        this.phase = 'done';
        if (this.onMorphDone) this.onMorphDone();
      }
    }

    const lerpSpeed = this.phase === 'exhale' ? 0.055 : 0.045;
    this.dispRadius += (targetRadius - this.dispRadius) * lerpSpeed;
    this.dispBlur   += (targetBlur   - this.dispBlur)   * lerpSpeed;
    this.dispGlow   += (targetGlow   - this.dispGlow)   * lerpSpeed;
    this.wordAlpha  += (this.wordTargetAlpha - this.wordAlpha) * 0.03;

    this.ripples = this.ripples.filter(rp => {
      rp.r += 2.2; rp.alpha -= 0.012;
      return rp.alpha > 0;
    });
  }

  draw() {
    const px = this.x, py = this.y;
    const r  = Math.max(0.1, this.dispRadius);
    const bl = Math.max(0, this.dispBlur);
    const gl = this.dispGlow;
    const flicker = 0.92 + 0.08 * Math.sin(this.flickPh);
    const c1=this.c1, c2=this.c2, c3=this.c3, c4=this.c4, c5=this.c5;

    cx.save();

    // ── Ripples ──
    this.ripples.forEach(rp => {
      cx.save();
      cx.globalAlpha = rp.alpha;
      cx.strokeStyle = `rgba(${c3},1)`;
      cx.lineWidth = 1;
      cx.beginPath(); cx.arc(px, py, rp.r, 0, Math.PI * 2); cx.stroke();
      cx.restore();
    });

    // ── Outer corona ──
    const coronaR = r * 3.2 + bl * 10;
    if (coronaR > 1) {
      const corona = cx.createRadialGradient(px, py, r * 0.5, px, py, coronaR);
      corona.addColorStop(0, `rgba(${c2},${(0.18 * gl * this.alpha).toFixed(3)})`);
      corona.addColorStop(1, `rgba(${c2},0)`);
      cx.fillStyle = corona;
      cx.beginPath(); cx.arc(px, py, coronaR, 0, Math.PI * 2); cx.fill();
    }

    // ── Blurry expansion layer ──
    if (bl > 0.5) {
      cx.filter = `blur(${bl.toFixed(1)}px)`;
      const expandR = r * 1.35;
      const expGrad = cx.createRadialGradient(px, py, 0, px, py, expandR);
      expGrad.addColorStop(0, `rgba(${c1},${(0.55 * this.alpha).toFixed(3)})`);
      expGrad.addColorStop(0.5, `rgba(${c2},${(0.25 * this.alpha).toFixed(3)})`);
      expGrad.addColorStop(1, `rgba(${c2},0)`);
      cx.fillStyle = expGrad;
      cx.beginPath(); cx.arc(px, py, expandR, 0, Math.PI * 2); cx.fill();
      cx.filter = 'none';
    }

    // ── Inner glow ──
    const innerR = r * 1.8 + (1 - bl / 22) * 30 * gl;
    const innerGrad = cx.createRadialGradient(px, py, 0, px, py, innerR);
    innerGrad.addColorStop(0, `rgba(${c4},${(0.85 * gl * this.alpha * flicker).toFixed(3)})`);
    innerGrad.addColorStop(0.4, `rgba(${c2},${(0.4 * gl * this.alpha).toFixed(3)})`);
    innerGrad.addColorStop(1, `rgba(${c2},0)`);
    cx.fillStyle = innerGrad;
    cx.beginPath(); cx.arc(px, py, innerR, 0, Math.PI * 2); cx.fill();

    // ── Hard core ──
    const coreAlpha = Math.max(0, 1 - bl / 16) * this.alpha;
    if (coreAlpha > 0.01 && r > 0.1) {
      cx.globalAlpha = coreAlpha * flicker;
      cx.fillStyle = `rgba(${c4},1)`;
      cx.beginPath(); cx.arc(px, py, r, 0, Math.PI * 2); cx.fill();
      cx.globalAlpha = coreAlpha;
      cx.fillStyle = 'rgba(255,255,255,1)';
      cx.beginPath(); cx.arc(px, py, r * 0.4, 0, Math.PI * 2); cx.fill();
    }

    cx.globalAlpha = 1;
    cx.restore();

    // ── State word — centred IN the orb, breathes and vibrates ──
    if (this.wordText && this.wordAlpha > 0.01) {
      const wordA = this.wordAlpha * this.alpha;
      const gi = this.wordGlowIntensity; // 0→1 across cycles

      // Font size grows with glow intensity and scales with orb size
      const baseFontSize = Math.max(22, Math.min(this.MAX_RADIUS * 0.55, innerWidth * 0.13));
      const fontSize = baseFontSize * (0.7 + gi * 0.5) * (this.wordScale !== undefined ? this.wordScale : 1);
      if (fontSize < 2) return;

      // Collapse: word softens on expand, sharpens on collapse
      // Witness: word glows on inhale, fades on exhale — opposite blur logic
      const isExpanded = this.phase === 'inhale' || this.phase === 'hold';
      const isViolet = this.c1 === '210,180,240';
      const wordBlur = isViolet
        ? (isExpanded ? 0 : bl * 0.2)   // witness: sharp on inhale, slight blur on exhale fade
        : (isExpanded ? bl * 0.35 : 0);  // collapse: blurred on expand

      cx.save();
      if (wordBlur > 0.5) cx.filter = `blur(${wordBlur.toFixed(1)}px)`;

      // Glow shadow — intensifies with each cycle and on exhale
      const glowRadius = 12 + gi * 40;
      const glowAlpha = 0.3 + gi * 0.7;
      cx.shadowColor = `rgba(${c5},${(wordA * glowAlpha).toFixed(2)})`;
      cx.shadowBlur = glowRadius;

      // Brightness increases across cycles
      const bright = Math.round(200 + gi * 55);
      const wordColor = `rgba(${bright + 15},${bright},${Math.max(0,bright - 50)},${wordA.toFixed(3)})`;

      cx.globalAlpha = wordA;
      cx.font = `300 ${fontSize.toFixed(1)}px 'Cormorant Garamond', Georgia, serif`;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillStyle = wordColor;

      // Position: centre of orb + vibration offset
      const wx = px;
      const wy = py;
      cx.fillText(this.wordText, wx, wy);

      // Second pass for extra glow on high-intensity moments
      if (gi > 0.5) {
        cx.shadowBlur = glowRadius * 2;
        cx.globalAlpha = wordA * (gi - 0.5) * 0.6;
        cx.fillText(this.wordText, wx, wy);
      }

      cx.shadowBlur = 0;
      cx.filter = 'none';
      cx.restore();
    }
  }
}


// ── OBSERVE PARTICLES ──
let clarityLevel = 0, particleVisible = false;

class KasinaParticle {
  constructor() {
    this.x = innerWidth * 0.5;
    this.y = innerHeight * 0.5;
    this.r = 6;
    this.alpha = 0; this.targetAlpha = 1;
    this.breathPh = 0;
    this.shudderX = 0; this.shudderY = 0;
    this.pulsePh = 0;
    this.shudderPh = 0;
    this.rayPh = 0;
    this.flickPh = 0;
    this.NUM_RAYS = 8;

    // Evolution state — 0 (diffuse) to 7 (crystallised)
    this.stage = 0;
    this.maxStage = 7;
    this.crystallinity = 0;      // 0→1 smooth lerp target
    this.crystallinityDisp = 0;  // displayed value, lerps toward crystallinity
    this.pulseRipples = [];      // tap ripple rings
    this.lastTapTime = 0;
  }

  // Called on each "I am here" tap
  evolve() {
    if (this.stage >= this.maxStage) return false; // already done
    this.stage++;
    this.crystallinity = this.stage / this.maxStage;
    this.lastTapTime = performance.now();
    // Add crystallisation ripple
    this.pulseRipples.push({ r: 10, alpha: 0.9, speed: 3.2 });
    if (navigator.vibrate) navigator.vibrate([12, 18, 22, 26, 30, 36, 44][Math.min(this.stage-1,6)]);
    return this.stage >= this.maxStage; // true = complete
  }

  update() {
    this.breathPh  += 0.016;
    this.pulsePh   += 0.08;
    this.shudderPh += 0.28;
    this.rayPh     += 0.003 + this.crystallinityDisp * 0.005; // rays spin faster as crystallised
    this.flickPh   += 0.35;

    // Shudder reduces as crystallinity increases — becomes perfectly still when done
    const baseShudder = isStill
      ? 0.6 + 0.9 * Math.sin(this.shudderPh) * Math.cos(this.shudderPh * 1.7)
      : 2.5 + 5 * Math.random();
    const shudderFactor = 1 - this.crystallinityDisp * 0.92;
    this.shudderX = (Math.random() - 0.5) * baseShudder * shudderFactor;
    this.shudderY = (Math.random() - 0.5) * baseShudder * shudderFactor;
    this.alpha += (this.targetAlpha - this.alpha) * 0.025;

    // Smooth crystallinity toward target
    this.crystallinityDisp += (this.crystallinity - this.crystallinityDisp) * 0.04;

    // Age ripples
    this.pulseRipples = this.pulseRipples.filter(rp => {
      rp.r += rp.speed; rp.alpha -= 0.015; return rp.alpha > 0;
    });
  }

  draw() {
    if (this.alpha < 0.01) return;
    const c = this.crystallinityDisp; // 0=diffuse, 1=crystallised
    const px = this.x + this.shudderX;
    const py = this.y + this.shudderY;

    // Breath is dampened as crystallinity increases — stillness
    const breathAmp = 0.32 * (1 - c * 0.75);
    const breathFactor = 0.68 + breathAmp * Math.sin(this.breathPh);
    const microPulse   = 1 + (0.07 - c * 0.05) * Math.sin(this.pulsePh);
    const flicker      = 0.88 + 0.12 * Math.sin(this.flickPh);

    // Core grows and sharpens with crystallinity
    const r = (6 + c * 10) * microPulse;

    // Glow halos: at c=0 very large/blurry, at c=1 tight and bright
    const blurScale  = 1 - c * 0.65;  // blur reduces
    const glowScale  = 0.3 + c * 0.7; // glow intensity increases
    const g1 = (22 + c * 18) * breathFactor * blurScale;   // inner
    const g2 = (80 - c * 30) * breathFactor * blurScale;   // mid
    const g3 = (160 - c * 80) * breathFactor * blurScale;  // corona

    cx.save();

    // ── Tap crystallisation ripples ──
    this.pulseRipples.forEach(rp => {
      cx.save();
      cx.globalAlpha = rp.alpha * this.alpha;
      cx.strokeStyle = `rgba(240,220,160,1)`;
      cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(px, py, rp.r, 0, Math.PI * 2); cx.stroke();
      cx.restore();
    });

    // ── Corona ──
    if (g3 > 1) {
      const corona = cx.createRadialGradient(px, py, g2 * 0.5, px, py, g3);
      corona.addColorStop(0, `rgba(240,190,80,${(0.06 * this.alpha * breathFactor * glowScale).toFixed(3)})`);
      corona.addColorStop(1, 'rgba(240,190,80,0)');
      cx.fillStyle = corona;
      cx.beginPath(); cx.arc(px, py, g3, 0, Math.PI * 2); cx.fill();
    }

    // ── Mid halo — blurry at start, tight at end ──
    if (c < 0.95) {
      // Blurry diffuse layer fades out as crystallinity rises
      const blurAmt = Math.max(0, (1 - c) * 18);
      if (blurAmt > 0.5) cx.filter = `blur(${blurAmt.toFixed(1)}px)`;
      const midGrad = cx.createRadialGradient(px, py, 0, px, py, g2);
      midGrad.addColorStop(0, `rgba(255,220,140,${(0.22 * this.alpha * breathFactor * (1-c*0.8) * flicker).toFixed(3)})`);
      midGrad.addColorStop(0.4, `rgba(240,190,80,${(0.14 * this.alpha * breathFactor * (1-c*0.8)).toFixed(3)})`);
      midGrad.addColorStop(1, 'rgba(240,190,80,0)');
      cx.fillStyle = midGrad; cx.beginPath(); cx.arc(px, py, g2, 0, Math.PI * 2); cx.fill();
      cx.filter = 'none';
    }

    // ── Rays — emerge from stage 2 onward, sharpen fully ──
    if (c > 0.2) {
      const rayAlphaBase = (c - 0.2) / 0.8; // 0→1 as c goes 0.2→1
      const rayCount = this.NUM_RAYS;
      for (let i = 0; i < rayCount; i++) {
        const angle = this.rayPh + (Math.PI * 2 / rayCount) * i;
        const lenPulse = 0.55 + 0.45 * Math.sin(this.breathPh * 1.3 + i * 0.8);
        const rayLen   = (g1 * 1.8 + c * 80) * lenPulse * breathFactor;
        const rayWidth = r * (0.18 - c * 0.08);
        const rayAlpha = (0.10 + c * 0.28) * this.alpha * lenPulse * flicker * rayAlphaBase;

        cx.save();
        cx.translate(px, py);
        cx.rotate(angle);
        const rayGrad = cx.createLinearGradient(r, 0, r + rayLen, 0);
        rayGrad.addColorStop(0, `rgba(255,240,160,${rayAlpha.toFixed(3)})`);
        rayGrad.addColorStop(0.5, `rgba(240,190,80,${(rayAlpha * 0.5).toFixed(3)})`);
        rayGrad.addColorStop(1, 'rgba(240,190,80,0)');
        cx.fillStyle = rayGrad;
        cx.beginPath();
        cx.moveTo(r, -rayWidth); cx.lineTo(r + rayLen, 0); cx.lineTo(r, rayWidth);
        cx.closePath(); cx.fill();
        cx.restore();
      }
    }

    // ── Inner glow — tightens and brightens ──
    const innerGrad = cx.createRadialGradient(px, py, 0, px, py, g1);
    innerGrad.addColorStop(0, `rgba(255,248,200,${(0.8 * this.alpha * flicker * glowScale).toFixed(3)})`);
    innerGrad.addColorStop(0.3, `rgba(255,210,100,${(0.55 * this.alpha * breathFactor * glowScale).toFixed(3)})`);
    innerGrad.addColorStop(1, 'rgba(240,190,80,0)');
    cx.fillStyle = innerGrad;
    cx.beginPath(); cx.arc(px, py, g1, 0, Math.PI * 2); cx.fill();

    // ── Hard core — defined and sharp ──
    const coreAlpha = (0.55 + c * 0.45) * this.alpha * (0.85 + 0.15 * flicker);
    cx.globalAlpha = coreAlpha;
    cx.fillStyle = c > 0.7 ? `rgba(255,252,230,1)` : `rgba(240,220,160,1)`;
    cx.beginPath(); cx.arc(px, py, r, 0, Math.PI * 2); cx.fill();

    // ── Hot centre ──
    cx.globalAlpha = this.alpha * (0.7 + c * 0.3);
    cx.fillStyle = 'rgba(255,255,245,1)';
    cx.beginPath(); cx.arc(px, py, r * (0.35 + c * 0.15), 0, Math.PI * 2); cx.fill();

    // ── Stage counter as subtle text (fades at full crystallinity) ──
    if (this.stage > 0 && this.stage < this.maxStage && c < 0.85) {
      cx.globalAlpha = this.alpha * (1 - c) * 0.35;
      cx.fillStyle = 'rgba(240,204,136,1)';
      cx.font = `300 ${Math.round(clamp(11, innerWidth*0.028, 14))}px 'Plus Jakarta Sans', sans-serif`;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.letterSpacing = '0.12em';
      cx.fillText(`${this.stage} · ${this.maxStage}`, px, py + r * 3.8);
    }

    cx.globalAlpha = 1;
    cx.restore();
  }
}
function clamp(min, val, max) { return Math.min(max, Math.max(min, val)); }

class ObsParticle {
  constructor() {
    this.cx = 0.5; this.cy = 0.5;
    this.x = innerWidth*0.5; this.y = innerHeight*0.5;
    this.ph = Math.random()*Math.PI*2;
    this.phV = 0.004 + Math.random()*0.003;
    this.driftR = 55 + Math.random()*35;
    this.r = 15; this.alpha = 0; this.targetAlpha = 0.9;
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
    const r = this.r + clarityLevel*6;
    const glow = (55 + clarityLevel*90) * breathFactor;
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
    bgDimLevel += (bgDimTarget - bgDimLevel) * 0.03;
    // Smooth tilt
    tiltX += (rawTiltX - tiltX) * 0.06;
    tiltY += (rawTiltY - tiltY) * 0.06;
    bgPts.forEach(p => { p.update(); p.draw(); });
    if (currentMode === 'observe' && particleVisible) {
      if (obsMode === 'kasina' && kasinaParticle) {
        kasinaParticle.update(); kasinaParticle.draw();
      } else if (observeParticle) {
        observeParticle.update();
        if (observeParticle.scattering) observeParticle.drawScatter();
        else observeParticle.draw();
      }
    }
    if ((currentMode === 'collapse' || currentMode === 'home' || currentMode === 'witness') && spParticles.length) {
      spParticles.forEach(p => { p.update(); p.draw(); });
    }
    if (breathOrb && currentMode === 'collapse') {
      breathOrb.update(); breathOrb.draw();
      const isInhale = breathOrb.phase === 'inhale' || breathOrb.phase === 'hold';
      const isExhale = breathOrb.phase === 'exhale';
      if (isInhale || isExhale) {
        const orbR = breathOrb.dispRadius;
        const ringR = orbR * 2.8 + 18;
        const progT = Math.min(breathOrb.elapsed / (isInhale ? breathOrb.INHALE : breathOrb.EXHALE), 1);
        const arc = isInhale ? progT * Math.PI * 2 : (1 - progT) * Math.PI * 2;
        const ringAlpha = 0.18 + 0.12 * Math.sin(breathOrb.flickPh * 0.4);
        cx.save();
        cx.globalAlpha = ringAlpha;
        cx.strokeStyle = `rgba(240,210,140,1)`;
        cx.lineWidth = 1;
        cx.lineCap = 'round';
        cx.beginPath();
        cx.arc(breathOrb.x, breathOrb.y, ringR, -Math.PI/2, -Math.PI/2 + arc, false);
        cx.stroke();
        cx.restore();
      }
    }
    // Witness violet breath orb — drawn on same canvas
    if (window._decOrb && (currentMode === 'witness' || currentMode === 'decohere')) {
      window._decOrb.update(); window._decOrb.draw();
      const dOrb = window._decOrb;
      const isInhale = dOrb.phase === 'inhale' || dOrb.phase === 'hold';
      const isExhale = dOrb.phase === 'exhale';
      if (isInhale || isExhale) {
        const orbR = dOrb.dispRadius;
        const ringR = orbR * 2.8 + 18;
        const progT = Math.min(dOrb.elapsed / (isInhale ? dOrb.INHALE : dOrb.EXHALE), 1);
        const arc = isInhale ? progT * Math.PI * 2 : (1 - progT) * Math.PI * 2;
        const ringAlpha = 0.15 + 0.10 * Math.sin(dOrb.flickPh * 0.4);
        cx.save();
        cx.globalAlpha = ringAlpha;
        cx.strokeStyle = 'rgba(190,160,230,1)';
        cx.lineWidth = 1;
        cx.lineCap = 'round';
        cx.beginPath();
        cx.arc(dOrb.x, dOrb.y, ringR, -Math.PI/2, -Math.PI/2 + arc, false);
        cx.stroke();
        cx.restore();
      }
    }
  } catch(e) { console.warn('loop err:', e); }
  requestAnimationFrame(loop);
}
loop();

// ── AUDIO ──
function initAudio() {
  if (audioCtx && audioCtx.state !== 'closed') return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
}

function resumeAudio() {
  if (!audioCtx || audioCtx.state === 'closed') {
    // Recreate destroyed context
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    return;
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

// [TECH1] visibilitychange — resume audio when app returns to foreground
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    resumeAudio();
  } else if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.suspend().catch(() => {});
  }
});

// Resume on any user touch — catches iOS first-interaction requirement
document.addEventListener('touchstart', () => { resumeAudio(); }, { passive: true, capture: true });
document.addEventListener('click', () => { resumeAudio(); }, { passive: true, capture: true });

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
function playBreathInhale() {
  if (!audioCtx) return;
  // Sine layer — rising harmonic
  [[220,0],[330,0.08],[440,0.16]].forEach(([f, delay]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.85, audioCtx.currentTime + delay);
    o.frequency.linearRampToValueAtTime(f, audioCtx.currentTime + delay + 3.5);
    const t0 = audioCtx.currentTime + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.028 - delay * 0.04, t0 + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.8);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 5.2);
  });
  // Noise layer — breath texture
  try {
    const bufLen = audioCtx.sampleRate * 5;
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 900; filt.Q.value = 0.4;
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0, audioCtx.currentTime);
    g2.gain.linearRampToValueAtTime(0.012, audioCtx.currentTime + 1.2);
    g2.gain.linearRampToValueAtTime(0.018, audioCtx.currentTime + 3.5);
    g2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 5);
    src.connect(filt); filt.connect(g2); g2.connect(audioCtx.destination);
    src.start(); src.stop(audioCtx.currentTime + 5.2);
  } catch(e) {}
}
function playBreathExhale() {
  if (!audioCtx) return;
  // Sine layer — descending settling
  [[440,0],[330,0.1],[220,0.2]].forEach(([f, delay]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, audioCtx.currentTime + delay);
    o.frequency.exponentialRampToValueAtTime(f * 0.75, audioCtx.currentTime + delay + 4.5);
    const t0 = audioCtx.currentTime + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.032 - delay * 0.04, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 6);
  });
  // Noise layer — releasing breath texture
  try {
    const bufLen = audioCtx.sampleRate * 6;
    const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 600; filt.Q.value = 0.3;
    const g2 = audioCtx.createGain();
    g2.gain.setValueAtTime(0, audioCtx.currentTime);
    g2.gain.linearRampToValueAtTime(0.016, audioCtx.currentTime + 0.4);
    g2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 5.5);
    src.connect(filt); filt.connect(g2); g2.connect(audioCtx.destination);
    src.start(); src.stop(audioCtx.currentTime + 6);
  } catch(e) {}
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
function playTonePleasant() {
  if (!audioCtx) return;
  [[528, 0], [660, 0.22], [792, 0.42]].forEach(([f, delay]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 1.6);
  });
}
function playToneUnpleasant() {
  if (!audioCtx) return;
  [[440, 0], [330, 0.22], [264, 0.42]].forEach(([f, delay]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + delay;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.045, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 1.8);
  });
}
function playTap() {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.value = 880;
  g.gain.setValueAtTime(0, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.022, audioCtx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.22);
}
const SENSE_FREQS = { seeing: 1320, hearing: 880, body: 528, mind: 660, taste: 440, smell: 396 };
function playNoteSense(key) {
  if (!audioCtx) return;
  const freq = SENSE_FREQS[key] || 660;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.045, audioCtx.currentTime + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.0);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 1.2);
  // soft harmonic
  const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
  o2.type = 'sine'; o2.frequency.value = freq * 2;
  g2.gain.setValueAtTime(0, audioCtx.currentTime + 0.05);
  g2.gain.linearRampToValueAtTime(0.018, audioCtx.currentTime + 0.12);
  g2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.4);
  o2.connect(g2); g2.connect(audioCtx.destination); o2.start(audioCtx.currentTime + 0.05); o2.stop(audioCtx.currentTime + 1.6);
}
function playBackNav() {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(440, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.4);
  g.gain.setValueAtTime(0, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.03, audioCtx.currentTime + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.7);
}
function playToneNeutral() {
  if (!audioCtx) return;
  g.gain.setValueAtTime(0, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 2.2);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 2.5);
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

// ── MOVEMENT AUDIO SIGNATURES ──
function playObserveSignature() {
  if (!audioCtx) return;
  [432, 540, 648].forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + i * 0.3;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.038 - i*0.008, t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 4);
  });
}
function playCollapseSignature() {
  if (!audioCtx) return;
  const freqs = [528, 264];
  freqs.forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + i * 0.08;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.06 - i*0.02, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 3);
  });
}
function playDecohereSignature() {
  if (!audioCtx) return;
  [288, 192, 144].forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t0 = audioCtx.currentTime + i * 0.25;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.042 - i*0.01, t0 + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0 + 5);
  });
}

// ── SCREEN TRANSITIONS ──
function showScreen(id, postCb) {
  resumeAudio();
  const gh = document.getElementById('ghosts');
  if (gh) {
    if (id !== 's-collapse' && id !== 's-field') {
      gh.style.transition = 'none';
      gh.style.opacity = '0';
      gh.innerHTML = '';
    }
  }
  const next = document.getElementById(id);
  const current = document.querySelector('.screen.active');
  if (current === next) { if (postCb) postCb(); return; }

  const showNext = () => {
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
  };

  if (current) {
    current.style.transition = 'opacity 0.65s ease';
    current.style.opacity = '0';
    setTimeout(() => {
      current.classList.remove('active');
      current.style.opacity = '';
      current.style.transition = '';
      setTimeout(showNext, 40);
    }, 660);
  } else {
    showNext();
  }
}

// ── SETTINGS PANEL ──
// [UX5] Swipe-down to close settings panel
(function initSettingsSwipe() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  let startY = 0, isDragging = false;

  panel.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    isDragging = false;
  }, { passive: true });

  panel.addEventListener('touchmove', e => {
    const dy = e.touches[0].clientY - startY;
    if (dy > 8) {
      isDragging = true;
      const clampedDy = Math.max(0, dy);
      panel.style.transition = 'none';
      panel.style.transform = `translateY(${clampedDy}px)`;
    }
  }, { passive: true });

  panel.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - startY;
    panel.style.transition = '';
    panel.style.transform = '';
    if (isDragging && dy > 80) {
      closeSettings();
    }
    isDragging = false;
  });
})();

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  if (panel.classList.contains('open')) closeSettings();
  else openSettings();
}
function openSettings() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  updateSettingsToggles();
  panel.classList.add('open');
  const backdrop = document.getElementById('settings-backdrop');
  if (backdrop) backdrop.classList.add('open');
}
function closeSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) panel.classList.remove('open');
  const backdrop = document.getElementById('settings-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}
function updateSettingsToggles() {
  const audioToggle = document.getElementById('st-audio');
  const fontToggle = document.getElementById('st-font');
  const langToggle = document.getElementById('st-lang');
  if (audioToggle) audioToggle.classList.toggle('active', audioEnabled);
  if (fontToggle) fontToggle.classList.toggle('active', fontLarge);
  if (langToggle) langToggle.textContent = lang === 'en' ? 'EN' : 'ES';
  const apiKey = localStorage.getItem('field_api_key') || '';
  const apiInput = document.getElementById('st-api-input');
  const apiStatus = document.getElementById('st-api-status');
  if (apiInput) apiInput.value = apiKey ? '••••••••••••••••••••••••' : '';
  if (apiInput) apiInput.placeholder = apiKey ? '' : 'sk-ant-...';
  if (apiStatus) apiStatus.textContent = apiKey ? 'key saved ·' : 'no key';
  if (apiStatus) apiStatus.style.color = apiKey ? 'rgba(201,169,110,.85)' : 'rgba(240,230,208,.2)';
}
function saveApiKey() {
  const input = document.getElementById('st-api-input');
  if (!input) return;
  const val = input.value.trim();
  if (val && val !== '••••••••••••••••••••••••') {
    localStorage.setItem('field_api_key', val);
  }
  updateSettingsToggles();
  input.value = '';
  input.placeholder = 'saved';
  setTimeout(() => { input.placeholder = ''; updateSettingsToggles(); }, 1500);
}
function clearApiKey() {
  localStorage.removeItem('field_api_key');
  updateSettingsToggles();
}
function settingsToggleAudio() {
  audioEnabled = !audioEnabled;
  if (audioEnabled) tryDrone();
  else fadeDrone(true, 0.8);
  updateSettingsToggles();
}
function settingsToggleFont() {
  fontLarge = !fontLarge;
  localStorage.setItem('field_font_large', fontLarge ? '1' : '0');
  document.body.classList.toggle('fs-large', fontLarge);
  updateSettingsToggles();
}
function settingsToggleLang() {
  lang = lang === 'en' ? 'es' : 'en';
  localStorage.setItem('field_lang', lang);
  applyLang();
  updateSettingsToggles();
}

// ── LANG ──
function toggleLang() {
  lang = lang === 'en' ? 'es' : 'en';
  localStorage.setItem('field_lang', lang);
  applyLang();
}
function applyLang() {
  const t = TRANSLATIONS[lang];
  document.getElementById('homeFieldSub').textContent = t.fieldSub;
  document.getElementById('mvObserveLabel').textContent = t.observeLabel;
  document.getElementById('mvCollapseLabel').textContent = t.collapseLabel;
  document.getElementById('mvWitnessLabel').textContent = t.decohere_label;
  document.getElementById('mvObserveHint').textContent = t.observeHint;
  document.getElementById('mvCollapseHint').textContent = t.collapseHint;
  document.getElementById('mvWitnessHint').textContent = t.decohereHint;
  document.getElementById('retBtn').textContent = t.retBtn;
  document.getElementById('decRetBtn').textContent = t.decRetBtn;
  document.getElementById('decAgainBtn').textContent = t.decAgainBtn;
  document.getElementById('obsCohWord').textContent = t.obsCoherenceWord;
  document.getElementById('obsCohLine').innerHTML = t.obsCoherenceLine.replace(/\n/g,'<br>');
  document.getElementById('obsCohTap').textContent = t.obsCoherenceTap;
  document.getElementById('revisitBtn').textContent = 'revisit introduction';
  // Home screen lang toggle — shows the OTHER language as the option
  const hlb = document.getElementById('homeLangBtn');
  if (hlb) hlb.textContent = lang === 'en' ? 'español' : 'english';
  updateHomeCount();
}
function updateHomeCount() {
  const n = parseInt(localStorage.getItem('field_obs')||'0');
  const t = TRANSLATIONS[lang];
  const el = document.getElementById('homeCount');
  if (!el) return;

  // Streak tracking — store last visit date
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('field_last_visit');
  const streakRaw = parseInt(localStorage.getItem('field_streak')||'0');
  let streak = streakRaw;
  if (lastVisit !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    streak = (lastVisit === yesterday) ? streakRaw + 1 : 1;
    localStorage.setItem('field_streak', streak);
    localStorage.setItem('field_last_visit', today);
  }

  if (n > 0) {
    let text = t.obsCount(n);
    if (streak >= 2) text += `  ·  ${streak}${lang==='en'?' days':' días'}`;
    el.textContent = text;
  } else {
    el.textContent = '';
  }
}

// ── HOME ──
function clearGhosts() {
  const gh = document.getElementById('ghosts');
  if (gh) { gh.style.transition = 'opacity 0.4s ease'; gh.style.opacity = '0';
    setTimeout(() => { gh.innerHTML = ''; gh.style.transition = ''; }, 450); }
}
function goHome() {
  closeSettings();
  const cameFromDecohere = currentMode === 'witness-end' || currentMode === 'witness';
  currentMode = 'home';
  clearAllBreath(); clearObserver(); clearAllDec();
  clearGhosts();
  // Clear witness/decohere state
  const grid = document.getElementById('shadowGrid');
  if (grid) grid.innerHTML = '';
  const fc = document.getElementById('fc');
  if (fc) { fc.style.opacity = '0'; }
  if (window._decOrb) { window._decOrb = null; }
  companionAsked = false;
  decSomaticTone = ''; decSomaticSpoken = ''; chamberSystemActive = '';
  restoreCircadianPalette();
  const cw = document.getElementById('companion-wrap');
  if (cw) { cw.innerHTML = ''; } // restore from any movement-specific palette
  fadeDrone(true, 1.5);
  particlesHidden = false; collapseStage = 0; breathRunning = false; bgDimTarget = 1;
  isTransitioning = false; // [TECH3] reset on return home
  document.querySelectorAll('.cp-stage').forEach(s => { s.classList.remove('on'); s.style.cssText = ''; });
  document.getElementById('backBtn').style.opacity = '0';
  document.getElementById('backBtn').style.pointerEvents = 'none';
  document.querySelectorAll('.al').forEach(a => a.classList.remove('on'));
  spParticles.forEach(p => { p._flickering = false; }); // [TECH2]
  spParticles = []; particleVisible = false;

  // Clear storm auto-exit timer
  if (stormAutoExitTimer) { clearTimeout(stormAutoExitTimer); stormAutoExitTimer = null; }

  showScreen('s-home', () => {
    document.querySelectorAll('.al').forEach(a => a.classList.add('on'));
    if (cameFromDecohere) {
      setTimeout(() => {
        spParticles = Array.from({length:12}, (_,i) => new SpParticle(i,12));
        spParticles.forEach(p => {
          p._flickering = false;
          p.x = innerWidth/2 + (Math.random()-0.5)*30;
          p.y = innerHeight/2 + (Math.random()-0.5)*30;
          p.targetAlpha = 0;
          p.targetClarity = 0;
        });
        setTimeout(() => {
          spParticles.forEach(p => { p.targetAlpha = 0.42+Math.random()*0.22; });
        }, 300);
        // Pulse movement glyphs once — gentle acknowledgement
        setTimeout(() => {
          document.querySelectorAll('.movement').forEach((m, i) => {
            setTimeout(() => {
              m.classList.add('lit');
              setTimeout(() => m.classList.remove('lit'), 1200);
            }, i * 180);
          });
        }, 1800);
      }, 100);
    } else {
      setTimeout(() => { initSpParticles(12); tryDrone(); }, 200);
    }
    tryDrone();
    // Companion check-in — shows after 3+ sessions if API key present
    setTimeout(() => maybeShowCompanion(), 1200);
  });
  updateHomeCount();
  document.querySelectorAll('.movement').forEach(m => m.classList.remove('lit'));

  // Guided entry hint — show for users who haven't done Collapse yet
  const hintEl = document.getElementById('guided-hint');
  const collapseCount = parseInt(localStorage.getItem('field_obs')||'0');
  if (hintEl) {
    const t = lang === 'en';
    if (collapseCount === 0) {
      hintEl.textContent = t ? 'new here? · begin with ↑' : '¿nuevo aquí? · empieza con ↑';
      setTimeout(() => { hintEl.style.opacity = '1'; }, 1800);
    } else {
      hintEl.style.opacity = '0';
    }
  }

  // Returning user whisper — quiet continuity, no gamification
  if (collapseCount > 0) {
    const whisperEl = document.createElement('div');
    whisperEl.style.cssText = `position:fixed;bottom:clamp(96px,18vw,128px);left:50%;
      transform:translateX(-50%);font-size:clamp(10px,2.5vw,12px);
      letter-spacing:.22em;text-transform:uppercase;
      color:rgba(240,220,180,.22);pointer-events:none;z-index:2;
      opacity:0;transition:opacity 2s ease;white-space:nowrap;`;
    // Days since first use (approximate via session count)
    const sessionLabel = collapseCount === 1
      ? (lang === 'en' ? 'first return' : 'primer retorno')
      : (lang === 'en' ? `session ${collapseCount + 1}` : `sesión ${collapseCount + 1}`);
    whisperEl.textContent = sessionLabel;
    document.body.appendChild(whisperEl);
    setTimeout(() => { whisperEl.style.opacity = '1'; }, 2800);
    setTimeout(() => { whisperEl.style.opacity = '0'; }, 7000);
    setTimeout(() => { whisperEl.remove(); }, 9000);
  }
  setTimeout(() => {
    const obs = parseInt(localStorage.getItem('field_obs')||'0');
    const dec = parseInt(localStorage.getItem('field_obs_witness')||'0');
    const obv = parseInt(localStorage.getItem('field_obs_observe')||'0');
    const max = Math.max(obs, dec, obv);
    if (max === 0) return;
    const mvId = max === obs ? 'mv-collapse' : max === dec ? 'mv-witness' : 'mv-observe';
    const el = document.getElementById(mvId);
    if (el) el.classList.add('lit');
    if (cameFromDecohere) {
      const decEl = document.getElementById('mv-witness');
      if (decEl) {
        decEl.classList.add('just-released');
        setTimeout(() => { if (decEl) decEl.classList.remove('just-released'); }, 180000);
      }
    }
  }, 800);
}
function initSpParticles(n) {
  spParticles = Array.from({length:n}, (_,i) => new SpParticle(i,n));
  const isHome = currentMode === 'home';
  spParticles.forEach(p => {
    p._flickering = false; // [TECH2]
    p.targetAlpha = isHome ? (0.42+Math.random()*0.22) : (0.4+Math.random()*0.3);
    p.targetClarity = 0;
  });
}
function showBackBtn() {
  const btn = document.getElementById('backBtn');
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'all';
  btn.onclick = () => { if(audioCtx) playBackNav(); goHome(); };
}

// ══════════════════════════════════════
// OBSERVE MOVEMENT
// ══════════════════════════════════════

const NOTE_SENSES = {
  en: [
    {key:'seeing', label:'seeing', glyph:'◌'},
    {key:'hearing', label:'hearing', glyph:'~'},
    {key:'body', label:'body', glyph:'◎'},
    {key:'mind', label:'mind', glyph:'◉'},
    {key:'taste', label:'taste', glyph:'·'},
    {key:'smell', label:'smell', glyph:'˚'}
  ],
  es: [
    {key:'seeing', label:'ver', glyph:'◌'},
    {key:'hearing', label:'oír', glyph:'~'},
    {key:'body', label:'cuerpo', glyph:'◎'},
    {key:'mind', label:'mente', glyph:'◉'},
    {key:'taste', label:'gusto', glyph:'·'},
    {key:'smell', label:'olor', glyph:'˚'}
  ]
};
const NOTE_TONES = {
  en: [
    {key:'pleasant',  label:'+', word:'pleasant',   color:'rgba(201,169,110,', border:'rgba(201,140, 60,'},
    {key:'unpleasant',label:'–', word:'unpleasant',  color:'rgba(110,150,201,', border:'rgba( 80,120,200,'},
    {key:'neutral',   label:'○', word:'neutral',     color:'rgba(180,175,165,', border:'rgba(160,155,145,'}
  ],
  es: [
    {key:'pleasant',  label:'+', word:'agradable',   color:'rgba(201,169,110,', border:'rgba(201,140, 60,'},
    {key:'unpleasant',label:'–', word:'desagradable', color:'rgba(110,150,201,', border:'rgba( 80,120,200,'},
    {key:'neutral',   label:'○', word:'neutro',       color:'rgba(180,175,165,', border:'rgba(160,155,145,'}
  ]
};
const STORM_WORDS = {
  en: ['changing','passing','not self','empty','thinking','tightening','sound','pressure'],
  es: ['cambiando','pasando','no yo','vacío','pensando','tensión','sonido','presión']
};

function buildObsScreen() {
  const t = lang === 'en';
  const screen = document.getElementById('s-observe');

  if (obsMode === 'noting') {
    // ── TWO-SCREEN NOTING FLOW ──
    // Screen 1: Sense — full screen, one question
    // Screen 2: Tone — full screen, auto-shown after sense tap
    screen.innerHTML = `
      <div id="noting-sense-screen" class="noting-phase active-phase">
        <div class="noting-step-dots"><span class="nsdot active"></span><span class="nsdot"></span></div>
        <div class="noting-question">${t ? 'what are you noticing?' : '¿qué estás notando?'}</div>
        <div class="noting-sub">${t ? 'one sense, right now' : 'un sentido, ahora mismo'}</div>
        <div id="senseRow" class="sense-row-full"></div>
        <div id="stormWord" class="storm-word"></div>
        <div id="noteCounter" class="note-counter">${t?'notes':'notas'} · 0</div>
        <div id="obs-timer-noting" style="font-size:clamp(11px,2.8vw,13px);letter-spacing:.18em;color:rgba(201,169,110,.35);"></div>
        <div id="noting-progress" style="display:flex;gap:6px;justify-content:center;margin-top:4px;"></div>
      </div>
      <div id="noting-tone-screen" class="noting-phase noting-tone-phase">
        <div class="tone-zone-header">
          <div class="noting-question" id="noting-sense-label"></div>
          <div class="noting-sub">${t ? 'how does it feel?' : '¿cómo se siente?'}</div>
        </div>
        <div id="toneRow" class="tone-zone-row"></div>
      </div>`;

    // Progress dots
    const prog = document.getElementById('noting-progress');
    const target = obsStorm ? 10 : 7;
    for (let i = 0; i < target; i++) {
      const d = document.createElement('div');
      d.className = 'mdot'; d.id = 'ndot' + i;
      prog.appendChild(d);
    }

    // Sense buttons — full screen style
    const senseRow = document.getElementById('senseRow');
    NOTE_SENSES[lang].forEach(s => {
      const b = document.createElement('button');
      b.className = 'sense-chip-full';
      b.innerHTML = `<span class="scf-glyph">${s.glyph}</span><span class="scf-label">${s.label}</span>`;
      let _senseFired = false;
      const fireSense = () => {
        if (_senseFired) return;
        _senseFired = true;
        setTimeout(() => { _senseFired = false; }, 800);
        chooseNoteSense(s.key, b);
      };
      b.onclick = fireSense;
      b.addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
      b.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); fireSense(); });
      senseRow.appendChild(b);
    });

    // Tone zones — full screen thirds, no centering issues
    const toneRow = document.getElementById('toneRow');
    const toneZones = lang === 'en'
      ? [{key:'neutral',   symbol:'○', word:'neither',    color:'rgba(180,175,165,', bg:'rgba(180,175,165,.05)'},
         {key:'pleasant',  symbol:'+', word:'good',       color:'rgba(201,169,110,', bg:'rgba(201,169,110,.07)'},
         {key:'unpleasant',symbol:'–', word:'difficult',  color:'rgba(110,150,201,', bg:'rgba(110,150,201,.07)'}]
      : [{key:'neutral',   symbol:'○', word:'ninguno',    color:'rgba(180,175,165,', bg:'rgba(180,175,165,.05)'},
         {key:'pleasant',  symbol:'+', word:'bueno',      color:'rgba(201,169,110,', bg:'rgba(201,169,110,.07)'},
         {key:'unpleasant',symbol:'–', word:'difícil',    color:'rgba(110,150,201,', bg:'rgba(110,150,201,.07)'}];

    toneZones.forEach(tone => {
      const z = document.createElement('div');
      z.className = 'tone-zone';
      z.dataset.toneKey = tone.key;
      z.style.cssText = `background:${tone.bg};border-bottom:1px solid rgba(240,230,208,.06);`;
      z.innerHTML = `<span class="tz-symbol" style="color:${tone.color}0.85)">${tone.symbol}</span><span class="tz-word" style="color:${tone.color}0.75)">${tone.word}</span>`;

      let _fired = false;
      const fire = () => {
        // DEBUG — show what's happening
        const dbg = document.createElement('div');
        dbg.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:red;color:white;padding:8px 16px;z-index:9999;font-size:16px;border-radius:8px;pointer-events:none;';
        dbg.textContent = `tap:${tone.key} sense:${noteSense} fired:${_fired}`;
        document.body.appendChild(dbg);
        setTimeout(() => dbg.remove(), 2000);

        if (_fired) return;
        _fired = true;
        z.style.background = tone.bg.replace('.07)', '.18)').replace('.05)', '.14)');
        if (navigator.vibrate) navigator.vibrate(10);
        setTimeout(() => chooseNoteTone(tone.key, z), 80);
      };
      z.onclick = fire;
      z.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); fire(); });
      toneRow.appendChild(z);
    });

    const stormLink = document.createElement('div');
    stormLink.style.cssText = 'position:absolute;bottom:clamp(28px,7vh,48px);left:50%;transform:translateX(-50%);font-size:clamp(11px,2.8vw,13px);letter-spacing:.18em;color:rgba(240,204,136,.58);cursor:pointer;padding:8px 16px;white-space:nowrap;-webkit-tap-highlight-color:transparent;';
    stormLink.textContent = lang === 'en' ? 'enter storm' : 'entrar tormenta';
    stormLink.addEventListener('click', () => { if(audioCtx) playTap(); const obsScr = document.getElementById('s-observe'); if (obsScr) { obsScr.style.transition = 'opacity 0.3s ease'; obsScr.style.opacity = '0'; } setTimeout(() => { clearObserver(); startStormScreen(); }, 280); });

    // Voice noting button — only if Web Speech API available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const voiceWrap = document.createElement('div');
      voiceWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;margin-top:4px;';

      const micBtn = document.createElement('button');
      micBtn.id = 'mic-btn';
      micBtn.innerHTML = '&#127908;';
      micBtn.style.cssText = 'background:none;border:1px solid rgba(201,169,110,.18);border-radius:50%;' +
        'width:52px;height:52px;font-size:22px;color:rgba(201,169,110,.80);cursor:pointer;' +
        '-webkit-tap-highlight-color:transparent;transition:all .4s ease;display:flex;' +
        'align-items:center;justify-content:center;line-height:1;';
      micBtn.title = t ? 'voice note' : 'nota de voz';

      const voiceLabel = document.createElement('div');
      voiceLabel.id = 'voice-label';
      voiceLabel.style.cssText = 'font-size:clamp(10px,2.5vw,12px);letter-spacing:.14em;color:rgba(201,169,110,.60);';
      voiceLabel.textContent = t ? 'voice' : 'voz';

      const voiceTranscriptEl = document.createElement('div');
      voiceTranscriptEl.id = 'voice-transcript';
      voiceTranscriptEl.style.cssText = 'font-size:clamp(18px,5vw,24px);letter-spacing:.04em;' +
        'color:rgba(240,230,208,.68);font-style:italic;min-height:22px;max-width:280px;' +
        'text-align:center;line-height:1.5;opacity:0;transition:opacity .6s ease;';

      micBtn.addEventListener('click', () => toggleVoiceNoting(micBtn, voiceTranscriptEl));
      micBtn.addEventListener('touchend', e => { e.preventDefault(); toggleVoiceNoting(micBtn, voiceTranscriptEl); });

      voiceWrap.appendChild(micBtn);
      voiceWrap.appendChild(voiceLabel);
      voiceWrap.appendChild(voiceTranscriptEl);
      document.getElementById('noting-sense-screen').appendChild(voiceWrap);
    }

    document.getElementById('noting-sense-screen').appendChild(stormLink);
    return;
  }

  // DRIFT / KASINA mode
  const modeHint = obsMode === 'kasina'
    ? (t ? 'Hold it in attention.<br>Each touch crystallises it.' : 'Sostenlo en atención.<br>Cada toque lo cristaliza.')
    : (t ? 'One particle.<br>Just watch it.' : 'Una partícula.<br>Solo obsérvala.');
  const hintTop = obsMode === 'kasina' ? '62%' : '42%';
  screen.innerHTML = `
    <div id="obs-hint-txt" style="position:fixed;top:${hintTop};left:50%;transform:translate(-50%,-50%);
      text-align:center;opacity:0;transition:opacity 1.5s ease;z-index:20;pointer-events:none;">
      <div style="font-size:clamp(22px,6vw,30px);font-weight:300;letter-spacing:.12em;
        color:rgba(201,169,110,.85);margin-bottom:18px;">${obsMode==='kasina'?'·':'◎'}</div>
      <div style="font-size:clamp(15px,3.8vw,19px);letter-spacing:.10em;
        color:rgba(240,230,208,.88);line-height:1.9;">${modeHint}</div>
    </div>
    <div id="clarity-ring"></div>
    <div id="obs-timer" style="position:fixed;top:72px;left:50%;transform:translateX(-50%);
      font-size:clamp(14px,3.5vw,17px);letter-spacing:.14em;color:rgba(201,169,110,.3);
      z-index:20;opacity:0;transition:opacity 1.5s ease;font-weight:300;pointer-events:none;"></div>
    <div id="obs-signals" style="position:fixed;bottom:clamp(52px,12vw,72px);left:50%;
      transform:translateX(-50%);display:flex;gap:20px;align-items:center;
      opacity:0;transition:opacity 1.5s ease;z-index:20;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div class="sig-dot" id="sig-still"></div>
        <div class="sig-label">${t?'still':'quieto'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div class="sig-dot" id="sig-present"></div>
        <div class="sig-label">${t?'present':'presente'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
        <div class="sig-dot" id="sig-affirm"></div>
        <div class="sig-label">${t?'here':'aquí'}</div>
      </div>
      <button id="affirmBtn" onclick="doAffirm()"
        style="background:none;border:1px solid rgba(201,169,110,.85);border-radius:30px;
        padding:8px 18px;cursor:pointer;margin-left:8px;
        -webkit-tap-highlight-color:transparent;touch-action:manipulation;
        font-family:inherit;font-size:clamp(10px,2.5vw,12px);letter-spacing:.16em;
        color:rgba(201,169,110,.80);transition:border-color .3s ease,color .3s ease;
        min-height:36px;white-space:nowrap;">
        ${obsMode === 'kasina' ? (t?'crystallise':'cristalizar') : (t?'i am here':'estoy aquí')}
      </button>
    </div>
    <div id="meter" style="position:fixed;bottom:clamp(112px,24vw,140px);left:50%;
      transform:translateX(-50%);display:flex;gap:6px;align-items:center;
      z-index:20;opacity:0;transition:opacity 1.5s ease;"></div>
    <div id="scatter-text" style="position:fixed;top:36%;left:50%;transform:translateX(-50%);
      font-size:clamp(13px,3.2vw,16px);letter-spacing:.14em;color:rgba(240,230,208,.82);
      white-space:nowrap;opacity:0;transition:opacity 1s ease;z-index:20;pointer-events:none;"></div>
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
  updateSignalDots();
}

function updateSignalDots() {
  const ss = document.getElementById('sig-still');
  const sp = document.getElementById('sig-present');
  const sa = document.getElementById('sig-affirm');
  if (ss) ss.style.background = isStill ? 'var(--gold)' : 'rgba(201,169,110,.18)';
  if (ss) ss.style.boxShadow = isStill ? '0 0 8px rgba(201,169,110,.88)' : 'none';
  const isPresent = clarityLevel > 0.05 && isStill;
  if (sp) sp.style.background = isPresent ? 'var(--gold)' : 'rgba(201,169,110,.18)';
  if (sp) sp.style.boxShadow = isPresent ? '0 0 8px rgba(201,169,110,.88)' : 'none';
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
  currentMode = 'observe';
  showBackBtn(); // [UX1] shown immediately, before any field activation
  document.getElementById('backBtn').onclick = () => goHome();
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  playObserveSignature();
  const ring = document.getElementById('clarity-ring');
  if (ring) ring.style.display = 'block';
  isCoherent = false; fieldActive = false; attentionSec = 0;
  affirmBonus = 0; clarityLevel = 0; isStill = true; lastAffirmTime = 0;
  if (obsMode === 'kasina') {
    kasinaParticle = new KasinaParticle(); kasinaParticle.targetAlpha = 0;
    observeParticle = null; particleVisible = true;
  } else if (obsMode === 'noting') {
    observeParticle = null; kasinaParticle = null; particleVisible = false;
  } else {
    observeParticle = new ObsParticle(); observeParticle.targetAlpha = 0;
    kasinaParticle = null; particleVisible = true;
  }
  buildObsSetupScreen();
  showScreen('s-observe');
}

function buildObsSetupScreen() {
  const t = lang === 'en';
  const screen = document.getElementById('s-observe');
  screen.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.id = 'obs-setup';
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:clamp(28px,7vw,44px);padding:clamp(24px,6vw,48px);width:100%;max-width:400px;' +
    'margin:auto;opacity:0;transition:opacity 1.2s ease;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:clamp(14px,3.5vw,17px);letter-spacing:.18em;color:rgba(201,169,110,.80);text-transform:uppercase;';
  title.textContent = t ? 'observe' : 'observar';
  wrap.appendChild(title);

  // ── Particle mode ──
  const modeSection = document.createElement('div');
  modeSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;';
  const modeLabel = document.createElement('div');
  modeLabel.style.cssText = 'font-size:clamp(12px,3vw,15px);letter-spacing:.14em;color:rgba(240,230,208,.90);';
  modeLabel.textContent = t ? 'particle' : 'partícula';
  modeSection.appendChild(modeLabel);
  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;gap:12px;width:100%;max-width:320px;';

  const makeModeBtn = (id, label, mode) => {
    const b = document.createElement('button');
    b.id = id;
    b.style.cssText = 'flex:1;padding:20px 8px;background:none;border:1px solid rgba(201,169,110,.18);' +
      'border-radius:12px;color:rgba(240,230,208,.4);font-family:inherit;' +
      'font-size:clamp(15px,3.8vw,18px);letter-spacing:.08em;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;transition:all .3s ease;min-height:64px;';
    b.textContent = label;
    b.addEventListener('click', () => setObsMode(mode));
    b.addEventListener('touchend', e => { e.preventDefault(); setObsMode(mode); });
    return b;
  };
  modeRow.appendChild(makeModeBtn('obs-mode-drift', t ? 'drift' : 'deriva', 'drift'));
  modeRow.appendChild(makeModeBtn('obs-mode-kasina', 'kasina', 'kasina'));
  modeRow.appendChild(makeModeBtn('obs-mode-noting', t ? 'noting' : 'notar', 'noting'));
  modeSection.appendChild(modeRow);
  wrap.appendChild(modeSection);

  // ── Storm style (noting only) ──
  const stormWrap = document.createElement('div');
  stormWrap.id = 'stormWrap';
  stormWrap.style.cssText = 'display:none;flex-direction:column;align-items:center;gap:12px;width:100%;';
  const stormLabel = document.createElement('div');
  stormLabel.style.cssText = 'font-size:clamp(12px,3vw,15px);letter-spacing:.14em;color:rgba(240,230,208,.90);';
  stormLabel.textContent = t ? 'style' : 'estilo';
  const stormRow = document.createElement('div');
  stormRow.style.cssText = 'display:flex;gap:12px;width:100%;max-width:320px;';
  const makeStormBtn = (id, label, on) => {
    const b = document.createElement('button');
    b.id = id;
    b.style.cssText = 'flex:1;padding:16px 8px;background:none;border:1px solid rgba(201,169,110,.18);' +
      'border-radius:12px;color:rgba(240,230,208,.4);font-family:inherit;' +
      'font-size:clamp(14px,3.4vw,17px);letter-spacing:.08em;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;transition:all .3s ease;min-height:54px;';
    b.textContent = label;
    b.addEventListener('click', () => setStormMode(on));
    b.addEventListener('touchend', e => { e.preventDefault(); setStormMode(on); });
    return b;
  };
  stormRow.appendChild(makeStormBtn('obs-storm-calm', t ? 'normal' : 'normal', false));
  stormRow.appendChild(makeStormBtn('obs-storm-storm', t ? 'storm' : 'tormenta', true));
  stormWrap.appendChild(stormLabel);
  stormWrap.appendChild(stormRow);
  wrap.appendChild(stormWrap);

  // ── Duration ──
  // [UX6] 1m option hidden for drift/kasina modes; only showing for noting
  const timeSection = document.createElement('div');
  timeSection.id = 'obs-time-section';
  timeSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;';
  const timeLabel = document.createElement('div');
  timeLabel.style.cssText = 'font-size:clamp(12px,3vw,15px);letter-spacing:.14em;color:rgba(240,230,208,.90);';
  timeLabel.textContent = t ? 'duration' : 'duración';
  timeSection.appendChild(timeLabel);
  const timeRow = document.createElement('div');
  timeRow.id = 'obs-time-row';
  timeRow.style.cssText = 'display:flex;gap:10px;width:100%;max-width:320px;';
  [1, 5, 10].forEach(m => {
    const b = document.createElement('button');
    b.id = 'obs-time-' + m;
    b.style.cssText = 'flex:1;padding:20px 6px;background:none;border:1px solid rgba(201,169,110,.18);' +
      'border-radius:12px;color:rgba(240,230,208,.4);font-family:inherit;' +
      'font-size:clamp(14px,3.5vw,17px);letter-spacing:.06em;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;transition:all .3s ease;min-height:64px;';
    b.textContent = m + 'm';
    if (m === 1) b.dataset.notingOnly = '1';
    b.addEventListener('click', () => setObsTime(m));
    b.addEventListener('touchend', e => { e.preventDefault(); setObsTime(m); });
    timeRow.appendChild(b);
  });
  timeSection.appendChild(timeRow);
  wrap.appendChild(timeSection);

  // ── Enter ──
  const enterBtn = document.createElement('button');
  enterBtn.style.cssText = 'background:none;border:1px solid rgba(201,169,110,.38);border-radius:12px;font-family:inherit;' +
    'font-size:clamp(16px,4vw,20px);letter-spacing:.22em;color:rgba(201,169,110,.85);' +
    'cursor:pointer;padding:20px 56px;-webkit-tap-highlight-color:transparent;transition:all .4s ease;min-height:64px;';
  enterBtn.textContent = t ? 'enter' : 'entrar';
  let _enterFired = false;
  const fireEnter = () => { if (_enterFired) return; _enterFired = true; if(audioCtx) playTap(); enterObserve(); };
  enterBtn.addEventListener('click', fireEnter);
  enterBtn.addEventListener('touchend', e => { e.preventDefault(); fireEnter(); });
  wrap.appendChild(enterBtn);

  screen.appendChild(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => { wrap.style.opacity = '1'; }));
  setObsMode(obsMode);
  setObsTime(obsMinutes);
  setStormMode(obsStorm);
}

function updateDurationVisibility() {
  // 1m available for all modes — short sits matter
  const btn1m = document.getElementById('obs-time-1');
  if (!btn1m) return;
  btn1m.style.display = '';
}

function setObsMode(mode) {
  obsMode = mode;
  const ids = ['drift','kasina','noting'];
  ids.forEach(id => {
    const el = document.getElementById('obs-mode-'+id);
    if (el) {
      el.style.borderColor = id===mode ? 'rgba(201,169,110,.90)' : 'rgba(201,169,110,.18)';
      el.style.color = id===mode ? 'rgba(240,204,136,.9)' : 'rgba(240,230,208,.82)';
    }
  });
  const stormWrap = document.getElementById('stormWrap');
  if (stormWrap) stormWrap.style.display = mode === 'noting' ? 'flex' : 'none';
  updateDurationVisibility(); // [UX6]
  if (currentMode === 'observe') {
    const curAlpha = (observeParticle ? observeParticle.alpha : 0) || (kasinaParticle ? kasinaParticle.alpha : 0);
    if (mode === 'kasina' && !kasinaParticle) {
      kasinaParticle = new KasinaParticle();
      kasinaParticle.alpha = curAlpha; kasinaParticle.targetAlpha = curAlpha;
      observeParticle = null;
    } else if ((mode === 'drift' || mode === 'noting') && !observeParticle) {
      observeParticle = new ObsParticle();
      observeParticle.alpha = curAlpha; observeParticle.targetAlpha = curAlpha;
      kasinaParticle = null;
    }
  }
}

function setStormMode(on) {
  obsStorm = !!on;
  const calm = document.getElementById('obs-storm-calm');
  const storm = document.getElementById('obs-storm-storm');
  if (calm) {
    calm.style.borderColor = !obsStorm ? 'rgba(201,169,110,.90)' : 'rgba(201,169,110,.18)';
    calm.style.color = !obsStorm ? 'rgba(240,204,136,.9)' : 'rgba(240,230,208,.82)';
  }
  if (storm) {
    storm.style.borderColor = obsStorm ? 'rgba(201,169,110,.90)' : 'rgba(201,169,110,.18)';
    storm.style.color = obsStorm ? 'rgba(240,204,136,.9)' : 'rgba(240,230,208,.82)';
  }
}

function setObsTime(mins) {
  obsMinutes = mins;
  [1,5,10].forEach(m => {
    const btn = document.getElementById('obs-time-'+m);
    if (!btn) return;
    btn.style.borderColor = m===mins ? 'rgba(201,169,110,.90)' : 'rgba(201,169,110,.18)';
    btn.style.color = m===mins ? 'rgba(240,204,136,.9)' : 'rgba(240,230,208,.82)';
  });
}

function enterObserve() {
  if (enterObserve._running) return;
  enterObserve._running = true;
  setTimeout(() => { enterObserve._running = false; }, 2000);
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      // Pre-warm audio on noting entry with a silent pulse so first tap has no delay
      if (obsMode === 'noting' && audioCtx) {
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, audioCtx.currentTime);
        g.connect(audioCtx.destination);
        setTimeout(() => { try { g.disconnect(); } catch(e) {} }, 100);
      }
    }).catch(()=>{});
  }
  fadeDrone(true, 1); spParticles = [];
  // [UX1] Back button always visible — set immediately and never removed
  showBackBtn();
  document.getElementById('backBtn').onclick = () => goHome();
  const setup = document.getElementById('obs-setup');
  if (setup) { setup.style.transition = 'opacity 0.8s ease'; setup.style.opacity = '0'; }

  setTimeout(() => {
    if (obsMode === 'noting') {
      noteCount = 0; noteSense = ''; sessionNoteLog = []; clarityLevel = 0; fieldActive = true; isCoherent = false;
      // No particle during noting — inward attention only
      observeParticle = null; kasinaParticle = null; particleVisible = false;

      if (obsStorm) {
        // Storm + noting — go straight to storm screen
        buildObsScreen();
        const obsScr = document.getElementById('s-observe');
        if (obsScr) { obsScr.style.transition = 'none'; obsScr.style.opacity = '1'; }
        obsTimerEnd = Date.now() + obsMinutes * 60 * 1000;
        startObsTimer();
        startStormScreen();
        return;
      }
    } else {
      if (obsMode === 'kasina' && kasinaParticle) { kasinaParticle.targetAlpha = 1; }
      else if (observeParticle) { observeParticle.targetAlpha = 0.9; }
    }

    buildObsScreen();
    // Reset any opacity from setup screen fade
    const obsScr = document.getElementById('s-observe');
    if (obsScr) { obsScr.style.transition = 'none'; obsScr.style.opacity = '1'; }
    // [UX1] Re-assert after buildObsScreen() — innerHTML rebuild doesn't touch chrome
    showBackBtn();
    document.getElementById('backBtn').onclick = () => goHome();

    if (audioCtx && !droneNodes.length && currentMode === 'observe') {
      try {
        [180, 360, 270].forEach((f,i) => {
          const o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          g.gain.setValueAtTime(0, audioCtx.currentTime);
          g.gain.linearRampToValueAtTime(0.015-i*0.004, audioCtx.currentTime+3);
          o.connect(g); g.connect(audioCtx.destination); o.start();
          droneNodes.push({o, g, frequency: o.frequency});
        });
      } catch(e) { console.warn('obs drone:', e); }
    }

    obsTimerEnd = Date.now() + obsMinutes * 60 * 1000;

    if (obsMode === 'noting') {
      startObsTimer();
      startNotingStorm();
      // [UX1] Explicitly keep back button visible for noting sessions
      showBackBtn();
      document.getElementById('backBtn').onclick = () => goHome();
      return;
    }

    // Assert back button immediately — before field activation delay
    showBackBtn();
    document.getElementById('backBtn').onclick = () => goHome();

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
      // [UX1] Re-assert back button after field activation — never hidden during countdown
      showBackBtn();
      document.getElementById('backBtn').onclick = () => goHome();
      const sigs = document.getElementById('obs-signals');
      const meter = document.getElementById('meter');
      if (sigs) { sigs.style.transition = 'opacity 1.5s ease'; sigs.style.opacity = '1'; }
      if (meter) { meter.style.transition = 'opacity 1.5s ease'; meter.style.opacity = '1'; }
    }, 4500);
  }, 900);
}

function startObsTimer() {
  clearInterval(obsTimerInterval);
  const target = obsStorm ? 10 : 7;
  // Heartbeat — re-assert back button every tick so nothing can hide it
  const assertBack = () => {
    const btn = document.getElementById('backBtn');
    if (btn && currentMode === 'observe') {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'all';
    }
  };
  obsTimerInterval = setInterval(() => {
    assertBack();
    if (!fieldActive || isCoherent || currentMode !== 'observe') return;
    const remaining = obsTimerEnd - Date.now();

    if (obsMode === 'noting') {
      const timerEl = document.getElementById('obs-timer-noting');
      if (timerEl) {
        const secs = Math.max(0, Math.ceil(remaining / 1000));
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        timerEl.textContent = m + ':' + String(s).padStart(2, '0');
      }
      for (let i = 0; i < target; i++) {
        const d = document.getElementById('ndot' + i);
        if (d) d.classList.toggle('lit', i < noteCount);
      }
      if (remaining <= 0 || noteCount >= target) {
        clearInterval(obsTimerInterval);
        reachObsCoherence();
      }
      return;
    }

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
  }, 500);
}

function startAttentionTimer() {
  clearInterval(attentionTimer);
  attentionTimer = setInterval(() => {
    if (!fieldActive || isCoherent) return;
    if (isStill) attentionSec++;
    updateObsMeter();
    if (obsMinutes === 0 && attentionSec + affirmBonus >= COHERENCE_SEC) reachObsCoherence();
  }, 1000);
}

function startMicroTones() {
  clearInterval(microToneTimer);
  microToneTimer = setInterval(() => {
    if (!fieldActive || isCoherent || currentMode !== 'observe') return;
    if (obsMode === 'kasina') {
      // Kasina: very soft high shimmer pulsing with clarity
      if (!audioCtx) return;
      const shimmerFreq = 1296 + clarityLevel * 432;
      const os = audioCtx.createOscillator(), gs = audioCtx.createGain();
      os.type = 'sine'; os.frequency.value = shimmerFreq;
      const gain = 0.006 + clarityLevel * 0.012;
      gs.gain.setValueAtTime(0, audioCtx.currentTime);
      gs.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + 0.3);
      gs.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 3);
      os.connect(gs); gs.connect(audioCtx.destination); os.start(); os.stop(audioCtx.currentTime + 3.5);
    } else {
      playMicroTone();
    }
  }, obsMode === 'kasina' ? 6000 : 12000);
}

function startMotionCheck() {
  clearInterval(motionCheckInterval);
  motionCheckInterval = setInterval(() => {
    if (currentMode !== 'observe') return;
    const timeSinceMotion = Date.now() - lastMotionTime;
    const wasStill = isStill;
    isStill = timeSinceMotion > 1800;
    if (!wasStill && isStill) {
      if (observeParticle) { observeParticle.cx = 0.5; observeParticle.cy = 0.5; }
    }
    updateSignalDots();
  }, 300);
}

function doAffirm() {
  if (!fieldActive || isCoherent) return;
  lastAffirmTime = Date.now();
  playAffirmSound();

  if (obsMode === 'kasina' && kasinaParticle) {
    // Kasina: each tap crystallises the object one stage
    const done = kasinaParticle.evolve();
    // Flash the affirmBtn
    const btn = document.getElementById('affirmBtn');
    if (btn) {
      btn.style.borderColor = 'rgba(255,240,160,.9)';
      btn.style.color = 'rgba(255,248,200,.95)';
      btn.style.boxShadow = '0 0 28px rgba(240,200,80,.45)';
      setTimeout(() => { if (btn) { btn.style.borderColor = ''; btn.style.color = ''; btn.style.boxShadow = ''; } }, 700);
    }
    // Update affirmBtn label to show stage progress
    if (btn && !done) {
      const remaining = kasinaParticle.maxStage - kasinaParticle.stage;
      btn.style.transition = 'all .3s ease';
    }
    if (done) {
      // Full crystallisation — brief hold then coherence
      const btn2 = document.getElementById('affirmBtn');
      if (btn2) { btn2.textContent = lang === 'en' ? 'crystallised' : 'cristalizado'; btn2.style.color = 'rgba(255,248,200,.95)'; btn2.style.borderColor = 'rgba(255,240,160,.8)'; }
      setTimeout(() => reachObsCoherence(), 1800);
    } else {
      updateSignalDots();
    }
    return;
  }

  // Drift mode
  affirmBonus = Math.min(affirmBonus + 1.5, 12);
  const btn = document.getElementById('affirmBtn');
  if (btn) { btn.style.borderColor = 'rgba(201,169,110,.90)'; btn.style.color = 'rgba(240,210,140,.9)'; btn.style.boxShadow = '0 0 20px rgba(201,169,110,.3)'; }
  const ring = document.getElementById('clarity-ring');
  if (ring) { ring.style.boxShadow = `0 0 ${40+clarityLevel*60}px rgba(201,169,110,.4)`; }
  setTimeout(() => {
    if (btn) { btn.style.borderColor = ''; btn.style.color = ''; btn.style.boxShadow = ''; }
    if (ring) ring.style.boxShadow = '';
    updateSignalDots();
  }, 600);
  updateObsMeter();
  if (obsMinutes === 0 && attentionSec + affirmBonus >= COHERENCE_SEC) reachObsCoherence();
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
  clearStormTimer();
  isCoherent = true;
  clearInterval(attentionTimer); clearInterval(microToneTimer);
  clearInterval(motionCheckInterval); clearInterval(obsTimerInterval);
  playObsCoherenceTone(); fadeDrone(true, 3);
  // Back button always available
  showBackBtn();
  document.getElementById('backBtn').onclick = () => goHome();

  ['obs-signals','meter','scatter-text','obs-hint-txt','obs-timer',
   'obs-timer-noting','noteCounter','senseRow','toneRow','noting-progress','stormWord'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.transition = 'opacity 1.5s ease'; el.style.opacity = '0'; }
  });
  const altWrap = document.querySelector('.observe-alt-wrap');
  if (altWrap) { altWrap.style.transition = 'opacity 1.5s ease'; altWrap.style.opacity = '0'; }

  const n = parseInt(localStorage.getItem('field_obs')||'0') + 1;
  localStorage.setItem('field_obs', n); totalObs = n;
  const no = parseInt(localStorage.getItem('field_obs_observe')||'0') + 1;
  localStorage.setItem('field_obs_observe', no);

  const isNoting = obsMode === 'noting';
  const cohWord = isNoting
    ? (lang === 'en' ? 'A W A R E N E S S' : 'C O N C I E N C I A')
    : TRANSLATIONS[lang].obsCoherenceWord;
  const cohLine = isNoting
    ? (lang === 'en'
        ? 'You named what was present.\nThe field received it.\nThis is the practice.'
        : 'Nombraste lo que estaba presente.\nEl campo lo recibió.\nEso es suficiente.')
    : TRANSLATIONS[lang].obsCoherenceLine;

  setTimeout(() => {
    particleVisible = false;
    document.getElementById('obsCohWord').textContent = cohWord;
    document.getElementById('obsCohLine').innerHTML = cohLine.replace(/\n/g,'<br>');
    document.getElementById('obsCohTap').textContent = TRANSLATIONS[lang].obsCoherenceTap;
    // Reset AI mirror
    const mirrorEl = document.getElementById('obsCohAI');
    if (mirrorEl) { mirrorEl.textContent = ''; mirrorEl.style.opacity = '0'; }
    showScreen('s-obs-coherence');
    // Fire observe AI mirror after screen settles (noting only)
    if (isNoting && sessionNoteLog.length >= 3) {
      setTimeout(() => runObserveAI([...sessionNoteLog]), 1800);
    }
  }, 2200);
}

// ── VOICE NOTING ──
function toggleVoiceNoting(micBtn, transcriptEl) {
  if (voiceActive) {
    stopVoiceNoting(micBtn, transcriptEl);
  } else {
    startVoiceNoting(micBtn, transcriptEl);
  }
}

function startVoiceNoting(micBtn, transcriptEl) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = lang === 'es' ? 'es-ES' : 'en-US';

  voiceActive = true;
  micBtn.innerHTML = '&#9679;';
  micBtn.style.borderColor = 'rgba(201,169,110,.90)';
  micBtn.style.color = 'rgba(240,204,136,.9)';
  micBtn.style.boxShadow = '0 0 18px rgba(201,169,110,.3)';
  micBtn.style.animation = 'micPulse 1.4s ease-in-out infinite';

  const voiceLabel = document.getElementById('voice-label');
  if (voiceLabel) voiceLabel.textContent = lang === 'en' ? 'listening...' : 'escuchando...';

  let finalTranscript = '';
  let silenceTimer = null;

  voiceRecognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) { finalTranscript += t + ' '; }
      else { interim = t; }
    }
    const display = (finalTranscript + interim).trim();
    voiceTranscript = display;
    if (transcriptEl) {
      transcriptEl.textContent = display;
      transcriptEl.style.opacity = display ? '1' : '0';
    }
    // Auto-note after 2.4s silence
    clearTimeout(silenceTimer);
    if (finalTranscript.trim().length > 2) {
      silenceTimer = setTimeout(() => {
        if (voiceActive && finalTranscript.trim()) {
          autoNoteFromVoice(finalTranscript.trim());
          finalTranscript = '';
          if (transcriptEl) { transcriptEl.style.opacity = '0'; }
          setTimeout(() => { if (transcriptEl) transcriptEl.textContent = ''; }, 600);
        }
      }, 4000); // was 2400 — more time to breathe between notes
    }
  };

  voiceRecognition.onerror = () => stopVoiceNoting(micBtn, transcriptEl);
  voiceRecognition.onend = () => {
    // Auto-restart if still supposed to be active
    if (voiceActive) {
      try { voiceRecognition.start(); } catch(e) {}
    }
  };

  try { voiceRecognition.start(); } catch(e) { voiceActive = false; }
}

function stopVoiceNoting(micBtn, transcriptEl) {
  voiceActive = false;
  if (voiceRecognition) {
    try { voiceRecognition.stop(); } catch(e) {}
    voiceRecognition = null;
  }
  if (micBtn) {
    micBtn.innerHTML = '&#127908;';
    micBtn.style.borderColor = 'rgba(201,169,110,.18)';
    micBtn.style.color = 'rgba(201,169,110,.80)';
    micBtn.style.boxShadow = 'none';
    micBtn.style.animation = 'none';
  }
  const voiceLabel = document.getElementById('voice-label');
  if (voiceLabel) voiceLabel.textContent = lang === 'en' ? 'voice' : 'voz';
  if (transcriptEl) { transcriptEl.style.opacity = '0'; }
  voiceTranscript = '';
}

function autoNoteFromVoice(transcript) {
  // Map spoken words to sense + tone, or just increment as a mind/neutral note
  const lower = transcript.toLowerCase();
  let sense = 'mind';
  let tone = 'neutral';

  // Rough sense detection from keywords
  if (/see|look|light|dark|colour|color|shape|vision|saw/.test(lower)) sense = 'seeing';
  else if (/hear|sound|noise|voice|ring|tone|quiet/.test(lower)) sense = 'hearing';
  else if (/smell|scent|odour|aroma/.test(lower)) sense = 'smell';
  else if (/taste|bitter|sweet|sour/.test(lower)) sense = 'taste';
  else if (/feel|tight|heavy|light|pain|warm|cold|pressure|breath|chest|stomach|head|heart/.test(lower)) sense = 'body';

  // Rough tone detection
  const pleasantWords = /calm|peace|open|ease|gentle|warm|bright|soft|clear|good|nice|relax|free/;
  const unpleasantWords = /tight|heavy|pain|fear|worry|anxious|stuck|dark|hard|difficult|scared|angry|sad/;
  if (pleasantWords.test(lower)) tone = 'pleasant';
  else if (unpleasantWords.test(lower)) tone = 'unpleasant';

  // Show transcript briefly as confirmation
  const counter = document.getElementById('noteCounter');
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
    'font-size:clamp(20px,5.5vw,28px);letter-spacing:.1em;color:rgba(240,204,136,.85);' +
    'pointer-events:none;z-index:50;opacity:0;transition:opacity .5s ease;text-align:center;' +
    'font-style:italic;max-width:260px;line-height:1.5;';
  flash.textContent = transcript.length > 40 ? transcript.slice(0, 40) + '…' : transcript;
  document.body.appendChild(flash);
  requestAnimationFrame(() => { flash.style.opacity = '1'; });
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => flash.remove(), 600);
  }, 1800);

  // Trigger a virtual sense+tone note
  const fakeSenseBtn = document.querySelector(`.sense-chip`);
  chooseNoteSense(sense, null);
  setTimeout(() => {
    const fakeToneBtn = document.querySelector(`.tone-chip[data-tone-key="${tone}"]`);
    chooseNoteTone(tone, fakeToneBtn);
  }, 120);
}

function clearObserver() {
  if (voiceActive) stopVoiceNoting(null, null);
  clearInterval(attentionTimer); clearInterval(microToneTimer);
  clearInterval(motionCheckInterval); clearInterval(obsTimerInterval);
  fieldActive = false; isCoherent = false;
  particleVisible = false; attentionSec = 0; affirmBonus = 0; clarityLevel = 0;
  isStill = true; kasinaParticle = null;
  noteCount = 0; noteSense = ''; sessionNoteLog = [];
  clearTimeout(scatterTO);
  const ring = document.getElementById('clarity-ring');
  if (ring) { ring.style.display = 'none'; ring.style.borderColor = 'rgba(201,169,110,0)'; ring.style.boxShadow = 'none'; }
}

// Noting helpers
function chooseNoteSense(key, el) {
  noteSense = key;
  if (audioCtx) playNoteSense(key); else { initAudio(); if(audioCtx) playNoteSense(key); }

  // Flash selected sense chip
  document.querySelectorAll('.sense-chip-full').forEach(x => x.classList.remove('active'));
  if (el) el.classList.add('active');

  // Update tone screen header with the chosen sense
  const senseLabel = document.getElementById('noting-sense-label');
  const senseObj = NOTE_SENSES[lang].find(s => s.key === key);
  if (senseLabel && senseObj) senseLabel.textContent = senseObj.label;

  // Slide to tone screen after brief delay
  setTimeout(() => {
    const s1 = document.getElementById('noting-sense-screen');
    const s2 = document.getElementById('noting-tone-screen');
    if (s1) { s1.style.transition = 'opacity 0.3s ease, transform 0.35s ease'; s1.style.opacity = '0'; s1.style.transform = 'translateX(-24px)'; }
    setTimeout(() => {
      if (s1) s1.classList.remove('active-phase');
      if (s2) {
        s2.classList.add('active-phase');
        s2.style.opacity = '0'; s2.style.transform = 'translateX(24px)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          s2.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
          s2.style.opacity = '1'; s2.style.transform = 'translateX(0)';
        }));
      }
    }, 300);
  }, 150);
}
function chooseNoteTone(key, el) {
  if (!noteSense) return;
  noteCount += 1;
  const target = obsStorm ? 10 : 7;
  document.querySelectorAll('.tone-chip-full').forEach(x => x.classList.remove('active'));
  if (el) el.classList.add('active');
  const counter = document.getElementById('noteCounter');
  if (counter) counter.textContent = (lang==='en'?'notes':'notas') + ' · ' + noteCount;
  for (let i = 0; i < target; i++) {
    const d = document.getElementById('ndot' + i);
    if (d) d.classList.toggle('lit', i < noteCount);
  }
  if (key === 'pleasant') playTonePleasant();
  else if (key === 'unpleasant') playToneUnpleasant();
  else playToneNeutral();
  pulseStormWord(noteSense + ' · ' + key);
  sessionNoteLog.push(noteSense + ' · ' + key);
  if (obsStorm && currentMode === 'storm') addStormNoteLog(noteSense, key);

  const savedSense = noteSense;
  noteSense = '';

  if (noteCount >= target) {
    clearInterval(obsTimerInterval);
    reachObsCoherence();
    return;
  }

  // Slide back to sense screen
  setTimeout(() => {
    const s1 = document.getElementById('noting-sense-screen');
    const s2 = document.getElementById('noting-tone-screen');
    if (s2) { s2.style.transition = 'opacity 0.3s ease, transform 0.35s ease'; s2.style.opacity = '0'; s2.style.transform = 'translateX(24px)'; }
    setTimeout(() => {
      if (s2) s2.classList.remove('active-phase');
      document.querySelectorAll('.sense-chip-full').forEach(x => x.classList.remove('active'));
      if (s1) {
        s1.classList.add('active-phase');
        s1.style.opacity = '0'; s1.style.transform = 'translateX(-24px)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          s1.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
          s1.style.opacity = '1'; s1.style.transform = 'translateX(0)';
        }));
      }
    }, 300);
  }, 280);
}
let stormNoteLog = [];
function addStormNoteLog(sense, tone) {
  const log = document.getElementById('storm-note-log');
  if (!log) return;
  const entry = sense + ' · ' + tone;
  stormNoteLog.push(entry);
  if (stormNoteLog.length > 5) stormNoteLog.shift();
  // Rebuild display
  log.innerHTML = '';
  stormNoteLog.forEach((text, i) => {
    const el = document.createElement('div');
    const age = stormNoteLog.length - 1 - i; // 0 = newest
    const opacity = (0.85 - age * 0.14).toFixed(2);
    const size = age === 0 ? 'clamp(14px,3.8vw,18px)' : 'clamp(11px,3vw,14px)';
    el.style.cssText = `font-size:${size};letter-spacing:.14em;font-weight:300;
      font-family:'Plus Jakarta Sans',sans-serif;color:rgba(240,204,136,${opacity});
      text-align:center;transition:opacity 0.3s ease;white-space:nowrap;`;
    el.textContent = text;
    log.appendChild(el);
    // Newest flashes in
    if (age === 0) {
      el.style.opacity = '0';
      requestAnimationFrame(() => { el.style.transition = 'opacity 0.25s ease'; el.style.opacity = '1'; });
    }
  });
}

function startNotingStorm() {
  clearStormTimer();
  if (!obsStorm) return;
  stormTimer = setInterval(() => {
    if (currentMode !== 'observe' || obsMode !== 'noting' || isCoherent) return;
    const words = STORM_WORDS[lang];
    const word = words[Math.floor(Math.random() * words.length)];
    pulseStormWord(word);
  }, 5500); // was 2600 — much slower
}
function clearStormTimer() {
  if (stormTimer) clearInterval(stormTimer);
  stormTimer = null;
}
function pulseStormWord(word) {
  const el = document.getElementById('stormWord');
  if (!el) return;
  el.textContent = word;
  el.style.opacity = '1';
  setTimeout(() => { if (el) el.style.opacity = '0'; }, 900);
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

document.getElementById('s-observe').addEventListener('click', e => {
  if (e.target.closest('#chrome') || e.target.closest('#affirmBtn') || e.target.closest('#settings-panel')) return;
  if (fieldActive && !isCoherent && obsMode !== 'noting') obsScatter();
});
document.getElementById('s-observe').addEventListener('touchend', e => {
  if (e.target.closest('#chrome') || e.target.closest('#affirmBtn') || e.target.closest('#settings-panel')) return;
  if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.sense-chip') || e.target.closest('.tone-chip')) return;
  if (fieldActive && !isCoherent && obsMode === 'drift') {
    e.preventDefault();
    obsScatter();
  }
});

// ══════════════════════════════════════
// COLLAPSE MOVEMENT
// ══════════════════════════════════════
let stepIndex = 0;
let _chargeTimer = null;
let _charging = false;
function chargeCollapse(e) {
  if (e.type === 'touchstart') e.preventDefault();
  if (_charging) return;
  _charging = true;
  const mv = document.getElementById('mv-collapse');
  if (mv) mv.classList.add('charging');
  if (navigator.vibrate) navigator.vibrate(6);
  // Auto-launch after 600ms hold (feels decisive without being fussy)
  _chargeTimer = setTimeout(() => {
    const mv2 = document.getElementById('mv-collapse');
    if (mv2) { mv2.classList.remove('charging'); mv2.classList.add('crystallised'); }
    if (navigator.vibrate) navigator.vibrate([10, 40, 18]);
    setTimeout(() => {
      const mv3 = document.getElementById('mv-collapse');
      if (mv3) mv3.classList.remove('crystallised');
      _charging = false;
      startCollapse();
    }, 320);
  }, 600);
}
function releaseCollapse(e) {
  if (e.type === 'touchend') e.preventDefault();
  const wasCharging = _charging;
  const timerWasActive = !!_chargeTimer;
  clearTimeout(_chargeTimer);
  _chargeTimer = null;
  const mv = document.getElementById('mv-collapse');
  if (mv) { mv.classList.remove('charging'); }
  // Only launch on quick tap (timer was still pending when released)
  // If timer already fired (hold complete), startCollapse already called
  if (wasCharging && timerWasActive) {
    _charging = false;
    startCollapse();
  }
}
function cancelCharge() {
  clearTimeout(_chargeTimer);
  _charging = false;
  const mv = document.getElementById('mv-collapse');
  if (mv) mv.classList.remove('charging');
}

function startCollapse() {
  if (navigator.vibrate) navigator.vibrate(18);
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  playCollapseSignature();
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
  // [AE7] Collapse intro tap hint — faster pulse (1.8s) to suggest forward momentum
  const hint = document.createElement('div'); hint.id = 'taph'; hint.textContent = t.tapHint;
  hint.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);font-size:var(--fl);letter-spacing:.14em;color:rgba(201,169,110,.38);animation:pulseCollapse 1.8s ease-in-out infinite;pointer-events:none;z-index:20;white-space:nowrap;font-weight:300;';
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
  // [TECH2] zero _flickering on reset
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
    const size = len<=5?'clamp(38px,11vw,54px)':len<=7?'clamp(32px,9vw,46px)':len<=8?'clamp(28px,7.5vw,38px)':len<=10?'clamp(24px,6.5vw,32px)':'clamp(21px,5.5vw,28px)';
    o.innerHTML = `<div class="oname" style="font-size:${size}">${st.name}</div>`;
    // [AE2] Orb hover: brief sharp-pulse before collapse
    const go = () => {
      if (isTransitioning) return; // [TECH3]
      o.style.filter = 'blur(0px)';
      o.style.opacity = '1';
      o.querySelector('.oname').style.color = 'rgba(255,235,180,1)';
      o.querySelector('.oname').style.textShadow = '0 0 40px rgba(255,210,80,.75), 0 0 80px rgba(255,190,40,.4)';
      setTimeout(() => {
        document.querySelectorAll('.orb').forEach(el => { el.classList.remove('collapsing'); el.classList.add('fading'); });
        o.classList.remove('fading'); o.classList.add('collapsing');
        spChosen = idx;
        setTimeout(() => selectState(st), 320);
      }, 180);
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
  if (isTransitioning) return; // [TECH3]
  isTransitioning = true; // [TECH3]
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
  // Log this session for companion check-in
  logSession({ type: 'collapse', state: state.name, ts: Date.now() });
  document.getElementById('obsNote').innerHTML = '';
  document.getElementById('obsNote5').innerHTML = '';
  document.getElementById('closing').style.opacity = '0'; document.getElementById('closing').textContent = '';
  document.getElementById('qlabel6').textContent = t.qlabel;
  const chosen = spParticles[spChosen%Math.max(spParticles.length,1)];
  if (chosen) { chosen.cx=0.5; chosen.cy=0.14; chosen.x=0.5*innerWidth; chosen.y=0.14*innerHeight; }
  initScene('state_chosen', spChosen);
  collapseStage = 0;
  document.querySelectorAll('.cp-stage').forEach(s => { s.classList.remove('on'); s.style.cssText=''; });
  // cs3 (imagination prompt stage) resets naturally with cp-stage cssText clear
  clearAllBreath();
  document.getElementById('tapNext').textContent = t.tapHint;
  particlesHidden = false;
  fadeDrone(true, 1.5);
  showScreen('s-collapse', () => {
    isTransitioning = false; // [TECH3] clear after transition completes
    setTimeout(() => {
      const gh = document.getElementById('ghosts');
      gh.style.transition = 'none'; gh.style.opacity = '0';
      buildGhosts(state.name);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        gh.style.transition = 'opacity 1.4s ease'; gh.style.opacity = '1';
      }));
    }, 300);
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
}
function showCollapseStage(n) {
  if (isTransitioning) return; // [TECH3]
  if (n === 5) n = 6;
  const current = document.querySelector('.cp-stage.on');
  if (n===4) {
    particlesHidden = true; bgDimTarget = 0.3;
    const gh = document.getElementById('ghosts');
    if (gh) { gh.style.transition = 'opacity 0.3s ease'; gh.style.opacity = '0';
      setTimeout(() => { gh.innerHTML = ''; }, 350); }
  }
  else if (n===5) {
    const chosen = spParticles[spChosen%Math.max(spParticles.length,1)];
    if (chosen) { chosen.cx=0.5; chosen.cy=0.5; chosen.targetCx=0.5; chosen.targetCy=0.14; chosen.x=0.5*innerWidth; chosen.y=0.5*innerHeight; chosen.targetAlpha=1; chosen.targetClarity=1; chosen._flickering=false; }
    breathOrb = null;
    particlesHidden = false; initScene('state_chosen', spChosen);
  } else { particlesHidden = false; initScene('state_chosen', spChosen); }
  const reveal = () => {
    collapseStage = n; const el = document.getElementById('cs'+n); if (!el) return;
    el.style.cssText = 'opacity:0;pointer-events:none;transition:none;visibility:hidden;';
    el.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.visibility = 'visible'; el.style.transition = 'opacity 1.4s ease';
      el.style.opacity = '1'; el.style.pointerEvents = 'all';
      setTimeout(() => { el.style.cssText = ''; }, 1450);
    }));
    const tapEl = document.getElementById('tapNext');
    tapEl.style.transition = 'opacity 0.7s ease';
    tapEl.style.opacity = n<6 ? '1' : '0';
    if (n===4) {
      // Fire collapse AI amplifier + start breath
      const ip = document.getElementById('imagPrompt');
      const ampEl = document.getElementById('collapseAI');
      if (ampEl) {
        ampEl.textContent = '';
        ampEl.style.opacity = '0';
        const cs4 = document.getElementById('cs4');
        if (cs4 && ampEl.parentNode !== cs4) cs4.appendChild(ampEl);
        ampEl.style.cssText = 'position:fixed;bottom:clamp(80px,16vh,120px);left:50%;transform:translateX(-50%);width:90%;max-width:340px;text-align:center;z-index:20;pointer-events:none;opacity:0;color:rgba(240,230,208,.92);font-size:clamp(14px,3.8vw,17px);font-weight:300;font-style:italic;letter-spacing:.06em;line-height:1.7;transition:opacity 1.4s ease;font-family:\'Cormorant Garamond\',Georgia,serif;';
      }
      const imagText = ip ? ip.textContent : '';
      if (imagText) {
        setTimeout(() => runCollapseAI(curStateName, imagText), 800);
      }
      startBreath();
    }
  };
  if (current) {
    isTransitioning = true;
    current.style.transition = 'opacity 1s ease'; current.style.opacity = '0'; current.style.pointerEvents = 'none';
    setTimeout(() => {
      current.classList.remove('on'); current.style.cssText='opacity:0;visibility:hidden;display:none;';
      isTransitioning = false;
      reveal();
    }, 1050);
  } else reveal();
}
document.getElementById('s-collapse').addEventListener('click', e => {
  if (e.target.id==='retBtn'||e.target.classList.contains('return-btn')) return;
  if (e.target.closest('#chrome') || e.target.closest('#settings-panel')) return;
  if (collapseStage===4 && breathRunning) return;
  if (isTransitioning) return; // [TECH3]
  if (collapseStage<6) showCollapseStage(collapseStage+1);
});
document.getElementById('retBtn').addEventListener('click', () => {
  if(audioCtx) playBackNav();
  clearAllBreath(); particlesHidden = false; collapseStage = 0; isTransitioning = false;
  document.querySelectorAll('.cp-stage').forEach(s => { s.classList.remove('on'); s.style.cssText=''; });
  document.getElementById('ghosts').style.opacity = '0';
  setTimeout(() => { document.getElementById('ghosts').innerHTML=''; }, 900);
  showScreen('s-field', () => { buildCollapseField(); tryDrone(); });
});

// Breath
function bDelay(fn,ms){ const t=setTimeout(fn,ms); breathTimers.push(t); return t; }
function clearAllBreath(){
  breathTimers.forEach(clearTimeout); breathTimers=[]; breathRunning=false;
  breathOrb = null;
  const sw = document.getElementById('breath-state-word');
  if (sw && sw.parentNode) sw.parentNode.removeChild(sw);
  // Ensure DOM bp is hidden (legacy safety)
  const bp = document.getElementById('bp'); if (bp) { bp.style.opacity='0'; bp.className='bp neutral'; }
  const rp = document.getElementById('bripple'); if (rp) rp.className='bripple';
}

function startBreath() {
  clearAllBreath(); breathRunning = true;
  const stateName = curStateName;
  const btext = document.getElementById('btext');
  const cycleIn  = lang === 'en' ? 'inhale' : 'inhala';
  const cycleOut = lang === 'en' ? 'exhale' : 'exhala';
  const inviteLine1 = lang === 'en' ? 'breathe in all possibilities' : 'inhala todas las posibilidades';
  const inviteLine2 = (lang === 'en' ? 'exhale into · ' : 'exhala hacia · ') + stateName;

  // imagPre is on cs3 (previous stage) — already hidden by stage transition

  const bp = document.getElementById('bp'); if (bp) bp.style.opacity = '0';
  const rp = document.getElementById('bripple'); if (rp) rp.className = 'bripple';

  btext.style.transition = 'none'; btext.style.opacity = '0';
  btext.textContent = ''; btext.className = 'btext';
  [0,1,2].forEach(i=>{ const d=document.getElementById('bdot'+i); if(d) d.classList.remove('done'); });

  const chosen = spParticles[spChosen % Math.max(spParticles.length, 1)];
  const startX = chosen ? chosen.x : innerWidth * 0.5;
  const startY = chosen ? chosen.y : innerHeight * 0.5;

  spParticles.forEach(sp => { sp.targetAlpha = 0; });

  breathOrb = new BreathOrb(startX, startY);
  breathOrb.targetX = innerWidth * 0.5;
  breathOrb.targetY = innerHeight * 0.5;

  // Word lives INSIDE the orb — set immediately, alpha builds with first exhale
  breathOrb.wordText = stateName;
  breathOrb.wordTargetAlpha = 0;
  breathOrb.wordGlowIntensity = 0;

  function showText(text, cls, delayMs) {
    bDelay(() => {
      const visible = parseFloat(btext.style.opacity || '0') > 0.05;
      if (visible) {
        btext.style.transition = 'opacity 0.4s ease'; btext.style.opacity = '0';
        bDelay(() => {
          btext.className = 'btext ' + cls; btext.textContent = text;
          btext.style.transition = 'opacity 0.9s ease'; btext.style.opacity = '1';
        }, 450);
      } else {
        btext.className = 'btext ' + cls; btext.textContent = text;
        btext.style.transition = 'opacity 1.1s ease'; btext.style.opacity = '1';
      }
    }, delayMs || 0);
  }
  function hideText(delayMs) {
    bDelay(() => { btext.style.transition = 'opacity 0.8s ease'; btext.style.opacity = '0'; }, delayMs || 0);
  }

  // ── Pre-breath instruction sequence (during SETTLE = 9500ms) ──
  // Line 1: "breathe in all possibilities" — 0.8s to 4.5s
  bDelay(() => {
    btext.className = 'btext intro';
    btext.textContent = inviteLine1;
    btext.style.transition = 'opacity 2.5s ease'; btext.style.opacity = '1';
  }, 800);
  hideText(4600);

  // Line 2: "exhale into · [word]" — 5.5s to 9s — word also glows faintly in orb
  bDelay(() => {
    btext.className = 'btext intro-gold';
    btext.textContent = inviteLine2;
    btext.style.transition = 'opacity 2s ease'; btext.style.opacity = '1';
    // Word appears faintly inside orb as its name is spoken
    if (breathOrb) { breathOrb.wordTargetAlpha = 0.28; }
  }, 5500);
  hideText(9200);

  // ── Wire up BreathOrb phase changes ──
  const INHALE = breathOrb.INHALE, HOLD = breathOrb.HOLD, EXHALE = breathOrb.EXHALE, REST = breathOrb.REST;

  breathOrb.onPhaseChange = (phase, cycle) => {
    if (phase === 'inhale') {
      // Inhale: word stays dim — possibilities are open, not yet chosen
      // Cycle 2 (third): word barely visible, anticipation before the final crystallisation
      const inAlphas = [0.18, 0.22, 0.30];
      if (breathOrb) breathOrb.wordTargetAlpha = inAlphas[Math.min(cycle, 2)];
      bDelay(() => { showText(cycleIn, 'cycle', 0); }, 400);
      bDelay(() => { btext.style.transition='opacity 0.8s ease'; btext.style.opacity='0'; }, INHALE - 800);
      playBreathInhale();

    } else if (phase === 'exhale') {
      // Dramatic jump: cycles 0+1 stay subtle, cycle 2 = full explosion
      const exAlphas    = [0.38, 0.52, 1.0];
      const exGlows     = [0.05, 0.12, 1.0];  // glow almost nothing until final
      if (breathOrb) {
        breathOrb.wordTargetAlpha    = exAlphas[Math.min(cycle, 2)];
        breathOrb.wordGlowIntensity  = exGlows[Math.min(cycle, 2)];
      }
      showText(cycleOut, 'cycle-exhale', 100);
      bDelay(() => { btext.style.transition='opacity 0.8s ease'; btext.style.opacity='0'; }, EXHALE - 800);
      playBreathExhale();
      playExhaleCollapse();
      if (cycle === 2 && navigator.vibrate) navigator.vibrate([30, 60, 50, 80, 80]);
      const cw = document.getElementById('cword'); if (cw) cw.classList.add('exhaling');

    } else if (phase === 'rest') {
      const cw = document.getElementById('cword'); if (cw) cw.classList.remove('exhaling');
      const dot = document.getElementById('bdot' + (cycle - 1));
      if (dot) dot.classList.add('done');

    } else if (phase === 'hold') {
      if (breathOrb) breathOrb.wordTargetAlpha = Math.max(0.10, breathOrb.wordAlpha * 0.5);

    } else if (phase === 'crystallised') {
      // Final state — word at full glory, max glow
      if (breathOrb) { breathOrb.wordTargetAlpha = 1; breathOrb.wordGlowIntensity = 1; }
      const dot2 = document.getElementById('bdot2');
      if (dot2) dot2.classList.add('done');
    }
  };

  breathOrb.onCyclesDone = () => {
    breathRunning = false;
    btext.style.transition = 'opacity 0.9s ease'; btext.style.opacity = '0';

    setTimeout(() => {
      if (!breathOrb) return;
      breathOrb.morphStartY = breathOrb.y;
      breathOrb.wordTargetAlpha = 0;
      breathOrb.startPhase('morph');

      breathOrb.onMorphDone = () => {
        if (chosen) {
          chosen.x  = breathOrb ? breathOrb.x : innerWidth * 0.5;
          chosen.y  = breathOrb ? breathOrb.y : innerHeight * 0.2;
          chosen.cx = chosen.x / innerWidth;
          chosen.cy = chosen.y / innerHeight;
          chosen.targetCx = 0.5;
          chosen.targetCy = 0.14;
          chosen.targetAlpha = 1;
          chosen.targetClarity = 1;
          chosen._flickering = false;
        }
        requestAnimationFrame(() => { breathOrb = null; });
        initScene('state_chosen', spChosen);
        const tapEl = document.getElementById('tapNext');
        bDelay(() => { tapEl.style.transition = 'opacity 0.8s ease'; tapEl.style.opacity = '1'; }, 1600);
      };
    }, 800);
  };
}

function goStill() {
  const t = TRANSLATIONS[lang];
  document.getElementById('stillTxt').innerHTML = t.stillTxt.replace(/\n/g,'<br>');
  showScreen('s-still');
  document.getElementById('stillBack').onclick = () => goHome();
}

// ══════════════════════════════════════
// STORM SCREEN
// ══════════════════════════════════════
const DHAMMA_WORDS = {
  en: ['arising','passing','empty','changing','not self','conditioned','just this',
       'appearing','dissolving','fabricated','contact','known','impermanent',
       'without centre','already gone','fading','here','gone','felt','noted'],
  es: ['surgiendo','pasando','vacío','cambiando','no yo','condicionado','solo esto',
       'apareciendo','disolviéndose','fabricado','contacto','conocido','impermanente',
       'sin centro','ya se fue','desvaneciendo','aquí','ido','sentido','notado']
};

let stormScreenTimer = null;
let stormScreenRafId = null;
let stormActiveWords = [];

function startStormScreen() {
  currentMode = 'storm';
  showBackBtn();
  document.getElementById('backBtn').onclick = () => exitStormScreen();

  // [UX4] Tap-anywhere-to-exit on storm screen
  const stormScreen = document.getElementById('s-storm');
  const stormExitTap = (e) => {
    if (e.target.closest('#chrome') || e.target.closest('#settings-panel')) return;
    exitStormScreen();
    stormScreen.removeEventListener('click', stormExitTap);
  };
  // Brief delay before activating so the tap that started storm doesn't immediately exit
  setTimeout(() => {
    stormScreen.addEventListener('click', stormExitTap);
  }, 1200);

  showScreen('s-storm', () => {
    if (spParticles.length === 0) initSpParticles(10);
    spParticles.forEach(p => { p.targetAlpha = 0.12 + Math.random()*0.1; p.targetClarity = 0; p._flickering = false; });
    initStormWords();
    playStormAmbient();

    // [UX4] Auto-exit after 3 minutes
    if (stormAutoExitTimer) clearTimeout(stormAutoExitTimer);
    stormAutoExitTimer = setTimeout(() => {
      if (currentMode === 'storm') exitStormScreen();
    }, 180000);
  });
  bgDimTarget = 0.25;
  fadeDrone(true, 2);
}

function exitStormScreen() {
  stopStormWords();
  stopStormAmbient();
  stormNoteLog = [];
  const log = document.getElementById('storm-note-log');
  if (log) log.innerHTML = '';
  bgDimTarget = 1;
  if (stormAutoExitTimer) { clearTimeout(stormAutoExitTimer); stormAutoExitTimer = null; }
  currentMode = 'observe';
  goHome();
}

function initStormWords() {
  const layer = document.getElementById('storm-words-layer');
  if (!layer) return;
  layer.innerHTML = '';
  stormActiveWords = [];
  stopStormWords();

  const spawnNext = () => {
    if (currentMode !== 'storm') return;
    spawnStormWord();
    const next = 1500 + Math.random() * 1500; // fast — overwhelming pace
    stormScreenTimer = setTimeout(spawnNext, next);
  };
  // Seed with two words immediately
  spawnStormWord();
  setTimeout(() => spawnStormWord(), 400);
  stormScreenTimer = setTimeout(spawnNext, 1200);

  const animateStorm = () => {
    if (currentMode !== 'storm') return;
    stormActiveWords = stormActiveWords.filter(w => {
      w.phase += 0.008;
      w.alpha += (w.targetAlpha - w.alpha) * 0.09; // faster fade in/out
      w.x += w.vx;
      w.y += w.vy;
      const a = w.alpha.toFixed(3);
      w.el.style.color = `rgba(240,204,136,${a})`;
      w.el.style.left = w.x + 'px';
      w.el.style.top = w.y + 'px';
      if (w.targetAlpha === 0 && w.alpha < 0.01) {
        w.el.remove();
        return false;
      }
      if (!w.fading && Date.now() - w.born > w.holdMs) {
        w.fading = true;
        w.targetAlpha = 0;
      }
      return true;
    });
    stormScreenRafId = requestAnimationFrame(animateStorm);
  };
  stormScreenRafId = requestAnimationFrame(animateStorm);

  const collapseLoop = () => {
    if (currentMode !== 'storm') return;
    if (spParticles.length > 0) {
      const sp = spParticles[Math.floor(Math.random() * spParticles.length)];
      const origAlpha = sp.targetAlpha;
      sp.targetClarity = 0.8 + Math.random() * 0.2;
      sp.targetAlpha = 0.9;
      setTimeout(() => {
        sp.targetClarity = 0;
        sp.targetAlpha = origAlpha;
      }, 900 + Math.random() * 600);
    }
    setTimeout(collapseLoop, 3000 + Math.random() * 4000);
  };
  setTimeout(collapseLoop, 2000);
}

function spawnStormWord() {
  const layer = document.getElementById('storm-words-layer');
  if (!layer || stormActiveWords.length > 9) return;
  const words = DHAMMA_WORDS[lang];
  const word = words[Math.floor(Math.random() * words.length)];
  const el = document.createElement('div');
  el.className = 'sw-word';
  el.textContent = word;
  // Single readable size — centred, no overflow
  el.style.fontSize = 'clamp(18px,5vw,28px)';
  el.style.maxWidth = (innerWidth - 48) + 'px';
  el.style.overflow = 'hidden';
  el.style.textOverflow = 'ellipsis';
  el.style.whiteSpace = 'nowrap';
  el.style.color = 'rgba(240,204,136,0)';
  el.style.textAlign = 'center';
  layer.appendChild(el);
  const wordW = Math.min(el.offsetWidth || 120, innerWidth - 48);
  const wordH = el.offsetHeight || 30;
  const safeL = 24;
  const safeR = innerWidth - wordW - 24;
  const safeT = 100;
  const safeB = innerHeight - wordH - 100;
  const x = safeL + Math.random() * Math.max(0, safeR - safeL);
  const y = safeT + Math.random() * Math.max(0, safeB - safeT);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const speed = 0.018 + Math.random() * 0.025; // much slower drift
  const angle = Math.random() * Math.PI * 2;
  const maxAlpha = 0.45 + Math.random() * 0.35;
  const wordObj = {
    el, x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 0.008,
    alpha: 0,
    targetAlpha: maxAlpha,
    phase: Math.random() * Math.PI * 2,
    born: Date.now(),
    holdMs: 2500 + Math.random() * 2000,  // 2.5–4.5s — readable but not lingering
    fading: false
  };
  stormActiveWords.push(wordObj);
}

let stormAmbientNodes = [];
function playStormAmbient() {
  if (!audioCtx || stormAmbientNodes.length) return;
  // Calming tones — soft sine harmonics with slow breathing LFO
  const freqs = [110, 165, 220];
  freqs.forEach((f, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    lfo.type = 'sine';
    lfo.frequency.value = 0.06 + i * 0.02; // very slow breath-like swell
    lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.022 - i * 0.006, audioCtx.currentTime + 3);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); lfo.start();
    stormAmbientNodes.push({ o, g, lfo });
  });
}
function stopStormAmbient() {
  stormAmbientNodes.forEach(({ o, g, lfo }) => {
    try {
      const now = audioCtx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + 1.5);
      setTimeout(() => { try { o.stop(); lfo.stop(); } catch(e) {} }, 1800);
    } catch(e) {}
  });
  stormAmbientNodes = [];
}

function stopStormWords() {
  if (stormScreenTimer) clearTimeout(stormScreenTimer);
  stormScreenTimer = null;
  if (stormScreenRafId) cancelAnimationFrame(stormScreenRafId);
  stormScreenRafId = null;
  stormActiveWords.forEach(w => w.el.remove());
  stormActiveWords = [];
  const layer = document.getElementById('storm-words-layer');
  if (layer) layer.innerHTML = '';
}

// Body position calculation — safe across all screen sizes
function getDecBodyPos(spot) {
  const vh = window.innerHeight;
  const chromeH = 56;
  const safeBottom = 80;
  const usable = vh - chromeH - safeBottom;
  const spots = ['head','throat','chest','stomach','pelvis'];
  const idx = spots.indexOf(spot);
  const fraction = idx / (spots.length - 1);
  const wordTopPx = chromeH + 20 + fraction * (usable * 0.35);
  const particleTopPx = wordTopPx + 60;
  const dotsTopPx = Math.min(particleTopPx + 100, vh - safeBottom - 40);
  const textTopPx = Math.min(dotsTopPx + 50, vh - safeBottom);
  return {
    wordTop: wordTopPx + 'px',
    particleTop: particleTopPx + 'px',
    dotsTop: dotsTopPx + 'px',
    textTop: textTopPx + 'px'
  };
}

function startDecohere() {
  if (navigator.vibrate) navigator.vibrate(18);
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
  playDecohereSignature();
  currentMode = 'witness'; showBackBtn();
  document.getElementById('backBtn').onclick = () => goHome();
  clearGhosts();
  // Violet colour temperature for Witness movement
  applyDecoherePalette();
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
  // Restore default padding/gap for shadow grid view
  const scr = document.getElementById('s-witness');
  if (scr) { scr.style.paddingTop = ''; scr.style.gap = ''; }
  const arrLine = document.getElementById('decArrivalLine');
  const arrSub  = document.getElementById('decArrivalSub');
  arrLine.textContent = t.decArrivalLine; arrLine.style.opacity = '1';
  arrSub.textContent  = t.decArrivalSub;  arrSub.style.opacity  = '1';
  const tapHint = document.getElementById('decTapHint');
  if (tapHint) tapHint.textContent = lang === 'en' ? 'tap where you feel it in your body' : 'toca donde lo sientes en tu cuerpo';
  showScreen('s-witness');
}

function buildShadowGrid() {
  const grid = document.getElementById('shadowGrid');
  grid.innerHTML = '';
  grid.style.cssText = 'width:100%;flex:1;min-height:0;display:flex;flex-wrap:wrap;' +
    'align-content:center;justify-content:center;gap:clamp(8px,2.5vw,16px);' +
    'padding:0 clamp(16px,5vw,32px);';

  const en = SHADOW_STATES.en, es = SHADOW_STATES.es;

  grid.style.opacity = '0';
  grid.style.transition = 'opacity 1.2s ease';
  setTimeout(() => { grid.style.opacity = '1'; }, 600);

  en.forEach((name, i) => {
    const displayName = lang === 'en' ? name : es[i];

    const o = document.createElement('button');
    o.className = 'shadow-orb';
    o.style.opacity = '0';
    o.style.transition = 'opacity 1.2s ease, color .3s ease, border-color .3s ease, background .3s ease';
    o.textContent = displayName;

    setTimeout(() => { o.style.opacity = '1'; }, 80 * i + 200);

    const go = () => {
      if (audioCtx) playTap();
      decStateName = name; decStateNameES = es[i];
      grid.querySelectorAll('.shadow-orb').forEach(el => {
        el.style.transition = 'opacity 0.5s ease, color 0.5s ease, border-color 0.5s ease';
        el.style.opacity = el === o ? '1' : '0.06';
        if (el === o) {
          el.style.color = 'rgba(240,204,136,1)';
          el.style.borderColor = 'rgba(201,169,110,.85)';
          el.style.background = 'rgba(201,169,110,.10)';
        }
      });
      setTimeout(() => showDecBodyMap(), 700);
    };
    o.addEventListener('click', go);
    o.addEventListener('touchend', e => { e.preventDefault(); go(); });
    grid.appendChild(o);
  });
}

// ══════════════════════════════════════
// SHARED BODY MAP — used by both Decohere and Collapse
// mode: 'witness' | 'collapse'
// payload: shadow state name (witness) | state object (collapse)
// ══════════════════════════════════════
function showBodyMap(mode, payload) {
  // For witness: replace shadow grid in s-decohere
  // For collapse: show s-bodymap screen
  const isDecohere = mode === 'witness';

  const BODY_PTS = [
    // Head — filled oval, not a ring
    ...(() => {
      const pts = []; const cx=0.5, cy=0.09, rw=0.065, rh=0.075;
      // Fill oval with grid of points
      for(let dy=-rh; dy<=rh; dy+=rh*0.42) {
        for(let dx=-rw; dx<=rw; dx+=rw*0.38) {
          if((dx*dx)/(rw*rw)+(dy*dy)/(rh*rh) <= 1) {
            pts.push([cx+dx, cy+dy, 1.1, 5]);
          }
        }
      }
      return pts;
    })(),
    [0.5, 0.165, 1, 5],
    [0.26, 0.215, 1.3, 7], [0.38, 0.20, 1, 5], [0.5, 0.195, 0.9, 4],
    [0.62, 0.20, 1, 5], [0.74, 0.215, 1.3, 7],
    [0.21, 0.28, 1, 5], [0.18, 0.35, 1, 4], [0.16, 0.42, 1, 4],
    [0.79, 0.28, 1, 5], [0.82, 0.35, 1, 4], [0.84, 0.42, 1, 4],
    [0.27, 0.26, 1, 4], [0.25, 0.34, 1, 4], [0.24, 0.42, 1, 4],
    [0.73, 0.26, 1, 4], [0.75, 0.34, 1, 4], [0.76, 0.42, 1, 4],
    [0.5, 0.25, 1, 4], [0.42, 0.28, 0.8, 3], [0.58, 0.28, 0.8, 3],
    [0.30, 0.50, 1, 4], [0.38, 0.505, 0.8, 3], [0.5, 0.51, 0.9, 4],
    [0.62, 0.505, 0.8, 3], [0.70, 0.50, 1, 4],
    [0.14, 0.50, 1, 4], [0.12, 0.57, 1, 4],
    [0.86, 0.50, 1, 4], [0.88, 0.57, 1, 4],
    [0.28, 0.595, 1.2, 6], [0.38, 0.60, 1, 4], [0.5, 0.605, 1, 4],
    [0.62, 0.60, 1, 4], [0.72, 0.595, 1.2, 6],
  ];

  const SPOT_BANDS = {
    head:    [0.00, 0.20],
    throat:  [0.14, 0.26],
    chest:   [0.22, 0.44],
    stomach: [0.42, 0.56],
    pelvis:  [0.54, 0.70],
  };

  const BODY_SPOTS = {
    en: [
      {key:'head',    label:'head',    top:9},
      {key:'throat',  label:'throat',  top:22},
      {key:'chest',   label:'chest',   top:36},
      {key:'stomach', label:'stomach', top:52},
      {key:'pelvis',  label:'pelvis',  top:66},
    ],
    es: [
      {key:'head',    label:'cabeza',   top:9},
      {key:'throat',  label:'garganta', top:22},
      {key:'chest',   label:'pecho',    top:36},
      {key:'stomach', label:'vientre',  top:52},
      {key:'pelvis',  label:'pelvis',   top:66},
    ]
  };

  // Colours per mode
  const spotColor    = isDecohere ? 'rgba(200,185,210,' : 'rgba(240,204,136,';
  const spotGlow     = isDecohere ? 'rgba(180,160,200,' : 'rgba(240,190,80,';
  const ptColor      = isDecohere ? 'rgba(230,215,245,1)' : 'rgba(240,210,140,1)';
  const ptGlowColor  = isDecohere ? 'rgba(210,185,235,' : 'rgba(240,204,136,';

  const question = isDecohere
    ? (lang === 'en' ? 'Where does it live in you?' : '¿Dónde vive en ti?')
    : (lang === 'en' ? 'Where does it want to land?' : '¿Dónde quiere aterrizar?');

  // Build DOM into the right container
  let container, wrap;
  if (isDecohere) {
    const grid = document.getElementById('shadowGrid');
    const line = document.getElementById('decArrivalLine');
    const sub  = document.getElementById('decArrivalSub');
    if (line) { line.style.transition = 'opacity 0.5s ease'; line.style.opacity = '0'; }
    if (sub)  { sub.style.transition  = 'opacity 0.5s ease'; sub.style.opacity  = '0'; }
    // Remove padding constraints — full screen figure
    const scr = document.getElementById('s-witness');
    if (scr) { scr.style.paddingTop = '0'; scr.style.gap = '0'; }
    grid.innerHTML = '<div id="bodymapWrap" style="position:fixed;inset:0;z-index:10;background:var(--bg);"></div>';
    wrap = document.getElementById('bodymapWrap');
    // Hide main canvas during witness body map
    const mainCv = document.getElementById('cv');
    if (mainCv) mainCv.style.opacity = '0';
  } else {
    // Collapse: use dedicated s-bodymap screen
    const screen = document.getElementById('s-bodymap');
    screen.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText = 'font-size:clamp(13px,3.2vw,16px);letter-spacing:.18em;color:rgba(201,169,110,.38);text-transform:uppercase;margin-bottom:6px;';
    header.textContent = lang === 'en' ? 'where does it want to land?' : '¿dónde quiere aterrizar?';
    screen.appendChild(header);
    const bwrap = document.createElement('div');
    bwrap.className = 'bodymap-wrap';
    bwrap.id = 'bodymapWrap';
    screen.appendChild(bwrap);
    wrap = bwrap;
    showScreen('s-bodymap');
  }

  // ── Decohere: full-screen canvas figure ──
  if (isDecohere) {
    const W = innerWidth, H = innerHeight;

    // Subtle question hint at bottom
    const qEl = document.createElement('div');
    qEl.style.cssText = `position:absolute;bottom:clamp(36px,10vh,60px);left:50%;
      transform:translateX(-50%);font-size:clamp(20px,5.5vw,28px);font-weight:300;
      color:rgba(240,230,208,.88);letter-spacing:.03em;text-align:center;
      pointer-events:none;z-index:2;white-space:nowrap;
      font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
      transition:opacity 0.8s ease;`;
    qEl.textContent = question;
    wrap.appendChild(qEl);

    // Tap instruction below question
    const tapEl = document.createElement('div');
    tapEl.style.cssText = `position:absolute;bottom:clamp(14px,5vh,32px);left:50%;
      transform:translateX(-50%);font-size:clamp(11px,2.8vw,14px);font-weight:300;
      color:rgba(240,230,208,.40);letter-spacing:.10em;text-align:center;
      pointer-events:none;z-index:2;white-space:nowrap;font-style:italic;
      transition:opacity 0.8s ease;`;
    tapEl.textContent = lang === 'en' ? 'tap the area you feel it most' : 'toca donde lo sientes más';
    wrap.appendChild(tapEl);

    // Full-screen canvas
    const fc = document.createElement('canvas');
    fc.width = W; fc.height = H;
    fc.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;transition:opacity 1.2s ease;';
    wrap.appendChild(fc);
    const fx = fc.getContext('2d');

    // Figure layout
    const FIG_TOP = 0.08, FIG_BOT = 0.88;
    const FIG_L = 0.28, FIG_R = 0.72;
    const figH = (FIG_BOT - FIG_TOP) * H;
    const figW = (FIG_R - FIG_L) * W;
    const figX = FIG_L * W, figY = FIG_TOP * H;

    // Shadow word watermark — very faint behind figure
    const watermarkEl = document.createElement('div');
    watermarkEl.style.cssText = `position:absolute;left:50%;top:46%;
      transform:translate(-50%,-50%);
      font-size:clamp(38px,11vw,72px);font-weight:300;
      font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
      color:rgba(180,160,210,.06);letter-spacing:.06em;
      pointer-events:none;z-index:0;white-space:nowrap;
      transition:opacity 0.6s ease;`;
    watermarkEl.textContent = decStateName || '';
    wrap.appendChild(watermarkEl);

    // Shadow word ceremony — appears at tapped zone, glows and fades
    const ceremonyEl = document.createElement('div');
    ceremonyEl.style.cssText = `position:absolute;left:50%;
      transform:translate(-50%,-50%);
      font-size:clamp(26px,7vw,40px);font-weight:300;
      font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
      color:rgba(220,200,240,0);letter-spacing:.06em;
      text-shadow:0 0 0px rgba(180,160,200,0);
      pointer-events:none;z-index:6;white-space:nowrap;
      transition:color 0.5s ease, text-shadow 0.5s ease, opacity 0.8s ease;`;
    ceremonyEl.textContent = decStateName || '';
    wrap.appendChild(ceremonyEl);

    // Zone definitions
    const SPOT_BANDS_Y = {
      head:    [0.00, 0.18],
      throat:  [0.13, 0.24],
      chest:   [0.20, 0.42],
      stomach: [0.40, 0.54],
      pelvis:  [0.52, 0.72],
    };
    const ZONES = [
      { key:'head',    centerY: 0.09 },
      { key:'throat',  centerY: 0.19 },
      { key:'chest',   centerY: 0.31 },
      { key:'stomach', centerY: 0.47 },
      { key:'pelvis',  centerY: 0.62 },
    ];

    // Human silhouette — path-based outline, much more legible
    // All coordinates in normalised [0..1] space relative to figX/figY/figW/figH
    // cx=0.5 is body centre. Drawn as connected strokes = clear human form.
    const SILHOUETTE_PATHS = [
      // Head (circle approximated as arc)
      { type:'arc', cx:0.50, cy:0.085, rx:0.10, ry:0.085 },
      // Neck
      { type:'line', pts:[[0.45,0.165],[0.45,0.195],[0.55,0.195],[0.55,0.165]] },
      // Shoulders + torso outline
      { type:'poly', pts:[
        [0.45,0.195],[0.28,0.215],[0.18,0.255],[0.17,0.31],[0.19,0.42],
        [0.22,0.48],[0.27,0.54],[0.30,0.60],[0.31,0.66],
        [0.33,0.74],[0.33,0.82],[0.36,0.88],[0.38,0.92],
        [0.42,0.92],[0.43,0.86],[0.43,0.78],[0.44,0.70],[0.46,0.65],
        [0.50,0.63],
        [0.54,0.65],[0.56,0.70],[0.57,0.78],[0.57,0.86],[0.58,0.92],
        [0.62,0.92],[0.64,0.88],[0.67,0.82],[0.67,0.74],
        [0.69,0.66],[0.70,0.60],[0.73,0.54],[0.78,0.48],
        [0.81,0.42],[0.83,0.31],[0.82,0.255],[0.72,0.215],[0.55,0.195]
      ]},
      // Left arm
      { type:'poly', pts:[
        [0.28,0.215],[0.20,0.30],[0.15,0.38],[0.12,0.46],[0.11,0.54],
        [0.13,0.58],[0.16,0.58],[0.19,0.52],[0.21,0.44],[0.24,0.36],[0.28,0.28]
      ]},
      // Right arm
      { type:'poly', pts:[
        [0.72,0.215],[0.80,0.30],[0.85,0.38],[0.88,0.46],[0.89,0.54],
        [0.87,0.58],[0.84,0.58],[0.81,0.52],[0.79,0.44],[0.76,0.36],[0.72,0.28]
      ]},
    ];

    let activeSpot = null;
    let glowPhase = 0;
    let breathPhase = 0;
    let somatic = false;
    let figRafId = null;

    function toCanvas(nx, ny) {
      return [figX + nx * figW, figY + ny * figH];
    }

    function drawFigure() {
      if (currentMode !== 'witness') { cancelAnimationFrame(figRafId); return; }
      fx.clearRect(0, 0, W, H);
      glowPhase  += 0.022;
      breathPhase += 0.008;

      const breathPulse = 0.5 + 0.5 * Math.sin(breathPhase);

      // Zone glow — flood the active zone with a soft radial wash
      if (activeSpot && SPOT_BANDS_Y[activeSpot]) {
        const [lo, hi] = SPOT_BANDS_Y[activeSpot];
        const zoneCY = figY + ((lo + hi) / 2) * figH;
        const zoneR  = ((hi - lo) / 2) * figH * 1.4;
        const glowPulse = 0.5 + 0.5 * Math.sin(glowPhase * 2.0);
        const zg = fx.createRadialGradient(figX + figW * 0.5, zoneCY, 0, figX + figW * 0.5, zoneCY, zoneR);
        zg.addColorStop(0, `${ptGlowColor}${(0.22 * glowPulse).toFixed(3)})`);
        zg.addColorStop(1, `${ptGlowColor}0)`);
        fx.fillStyle = zg;
        fx.fillRect(0, 0, W, H);
      }

      // Breathing scale — very subtle chest expansion
      const breathScale = 1 + 0.012 * breathPulse;
      fx.save();
      fx.translate(figX + figW * 0.5, figY + figH * 0.5);
      fx.scale(breathScale, breathScale);
      fx.translate(-(figX + figW * 0.5), -(figY + figH * 0.5));

      // Base alpha — pulses gently with breath
      const baseAlpha = 0.52 + 0.18 * breathPulse;
      const glowAlpha = 0.10 + 0.08 * breathPulse;
      const lineW     = 1.4 + 0.4 * breathPulse;

      SILHOUETTE_PATHS.forEach(path => {
        // Is this path in the active zone?
        let inSpot = false;
        if (activeSpot && path.type !== 'arc') {
          const ys = path.pts.map(p => p[1]);
          const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
          const [lo, hi] = SPOT_BANDS_Y[activeSpot] || [0, 0];
          if (midY >= lo && midY <= hi) inSpot = true;
        }
        if (activeSpot && path.type === 'arc') {
          const [lo, hi] = SPOT_BANDS_Y[activeSpot] || [0, 0];
          if (path.cy >= lo && path.cy <= hi) inSpot = true;
        }

        const spotPulse = 0.5 + 0.5 * Math.sin(glowPhase * 2.2);
        const strokeAlpha = inSpot ? 0.88 + 0.12 * spotPulse : baseAlpha;
        const glowW = inSpot ? lineW * 3.5 : lineW * 2.2;
        const glowA = inSpot ? 0.28 * spotPulse : glowAlpha;

        if (path.type === 'arc') {
          const [cx, cy] = toCanvas(path.cx, path.cy);
          const rx = path.rx * figW, ry = path.ry * figH;
          // Glow pass
          fx.globalAlpha = glowA;
          fx.strokeStyle = ptGlowColor + '1)';
          fx.lineWidth = glowW;
          fx.filter = `blur(${inSpot ? 6 : 3}px)`;
          fx.beginPath(); fx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); fx.stroke();
          fx.filter = 'none';
          // Crisp pass
          fx.globalAlpha = strokeAlpha;
          fx.strokeStyle = ptColor;
          fx.lineWidth = lineW;
          fx.beginPath(); fx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); fx.stroke();

        } else if (path.type === 'poly' || path.type === 'line') {
          const canvasPts = path.pts.map(([nx, ny]) => toCanvas(nx, ny));
          // Glow pass
          fx.globalAlpha = glowA;
          fx.strokeStyle = ptGlowColor + '1)';
          fx.lineWidth = glowW;
          fx.lineJoin = 'round'; fx.lineCap = 'round';
          fx.filter = `blur(${inSpot ? 6 : 3}px)`;
          fx.beginPath();
          fx.moveTo(...canvasPts[0]);
          canvasPts.slice(1).forEach(pt => fx.lineTo(...pt));
          if (path.type === 'poly') fx.closePath();
          fx.stroke();
          fx.filter = 'none';
          // Crisp pass
          fx.globalAlpha = strokeAlpha;
          fx.strokeStyle = ptColor;
          fx.lineWidth = lineW;
          fx.beginPath();
          fx.moveTo(...canvasPts[0]);
          canvasPts.slice(1).forEach(pt => fx.lineTo(...pt));
          if (path.type === 'poly') fx.closePath();
          fx.stroke();
        }
        fx.globalAlpha = 1;
      });

      fx.restore();
      figRafId = requestAnimationFrame(drawFigure);
    }
    figRafId = requestAnimationFrame(drawFigure);

    // Invisible hit zones — no visible labels, trust the body
    ZONES.forEach((z) => {
      const [lo, hi] = SPOT_BANDS_Y[z.key];
      const hitTop = figY + lo * figH;
      const hitH2  = (hi - lo) * figH;
      const hitL   = figX - figW * 0.12;
      const hitW   = figW * 1.24;

      const hitBtn = document.createElement('button');
      hitBtn.style.cssText = `position:absolute;left:${hitL}px;top:${hitTop}px;
        width:${hitW}px;height:${hitH2}px;
        background:none;border:none;cursor:pointer;z-index:3;
        -webkit-tap-highlight-color:transparent;`;

      hitBtn.addEventListener('click', () => {
        if (somatic) return;
        somatic = true;
        activeSpot = z.key;

        // Zone tone + overtone
        if (audioCtx) {
          const zoneFreqs = { head:1056, throat:792, chest:528, stomach:396, pelvis:264 };
          const f = zoneFreqs[z.key] || 528;
          const oz = audioCtx.createOscillator(), gz = audioCtx.createGain();
          oz.type='sine'; oz.frequency.value=f;
          gz.gain.setValueAtTime(0,audioCtx.currentTime);
          gz.gain.linearRampToValueAtTime(0.055,audioCtx.currentTime+0.10);
          gz.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+2.8);
          oz.connect(gz); gz.connect(audioCtx.destination); oz.start(); oz.stop(audioCtx.currentTime+3.2);
          const oz2 = audioCtx.createOscillator(), gz2 = audioCtx.createGain();
          oz2.type='sine'; oz2.frequency.value=f*1.5;
          gz2.gain.setValueAtTime(0,audioCtx.currentTime);
          gz2.gain.linearRampToValueAtTime(0.018,audioCtx.currentTime+0.18);
          gz2.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+2.0);
          oz2.connect(gz2); gz2.connect(audioCtx.destination); oz2.start(); oz2.stop(audioCtx.currentTime+2.2);
        }

        // Shadow word appears at the tapped zone location
        const tapY = figY + z.centerY * figH;
        ceremonyEl.style.top = (tapY / H * 100).toFixed(1) + '%';
        ceremonyEl.style.opacity = '1';
        ceremonyEl.style.color = 'rgba(220,200,240,0.92)';
        ceremonyEl.style.textShadow = '0 0 40px rgba(180,160,200,0.55)';

        watermarkEl.style.opacity = '0';
        qEl.style.opacity = '0';

        // After 2.2s — figure dissolves, transition
        setTimeout(() => {
          ceremonyEl.style.transition = 'opacity 1.4s ease, color 1s ease, text-shadow 1s ease';
          ceremonyEl.style.opacity = '0';
          fc.style.opacity = '0'; // canvas fades = body-to-orb dissolve

          setTimeout(() => {
            cancelAnimationFrame(figRafId);
            decBodySpot = z.key;
            const mainCv = document.getElementById('cv');
            if (mainCv) { mainCv.style.transition = 'opacity 0.8s ease'; mainCv.style.opacity = '1'; }

            // Tone picker — pleasant / unpleasant / neutral
            showTonePicker(wrap, (toneKey) => {
              decSomaticTone = toneKey;
              decSomaticSpoken = ''; // reset for new session
              // Log the somatic data
              logSession({ type: 'somatic', shadow: decStateName, zone: z.key, tone: toneKey, ts: Date.now() });
              // Voice sensing layer — speak into the zone before chamber
              showVoiceSensingLayer(wrap, z.key, decStateName, toneKey, (spokenText) => {
                if (spokenText) decSomaticSpoken = spokenText;
                const apiKey = localStorage.getItem('field_api_key');
                if (apiKey) { startDissolutionChamber(); } else { startDecAcknowledge(); }
              });
            });
          }, 900);
        }, 2200);
      });
      hitBtn.addEventListener('touchend', e => { e.preventDefault(); hitBtn.click(); });
      wrap.appendChild(hitBtn);
    });

    return; // decohere path done
  }

  // ── Collapse: original layout (smaller figure, side labels) ──
  const figDiv = document.createElement('div');
  figDiv.className = 'bodymap-figure';
  const fc = document.createElement('canvas');
  fc.width = 180; fc.height = 520;
  figDiv.appendChild(fc);
  wrap.appendChild(figDiv);

  const fx = fc.getContext('2d');
  const W = 180, H = 520;

  let activeSpot = null;
  let glowPhase = 0;
  let figRafId = null;

  function drawFigure() {
    if (currentMode !== 'collapse') { cancelAnimationFrame(figRafId); return; }
    fx.clearRect(0, 0, W, H);
    glowPhase += 0.03;
    BODY_PTS.forEach(([nx, ny, r, gr]) => {
      const px = nx * W, py = ny * H;
      let inSpot = false;
      if (activeSpot && SPOT_BANDS[activeSpot]) {
        const [lo, hi] = SPOT_BANDS[activeSpot];
        if (ny >= lo && ny <= hi) inSpot = true;
      }
      const pulse = inSpot ? 0.7 + 0.3 * Math.sin(glowPhase * 2) : 0.5 + 0.12 * Math.sin(glowPhase + nx * 3);
      const alpha = inSpot ? 0.55 + 0.35 * pulse : 0.18 + 0.10 * pulse;
      const glowA = inSpot ? 0.22 * pulse : 0.06 * pulse;
      const glowRad = inSpot ? gr * 1.8 : gr;
      const grad = fx.createRadialGradient(px, py, 0, px, py, glowRad);
      grad.addColorStop(0, `${ptGlowColor}${glowA.toFixed(3)})`);
      grad.addColorStop(1, `${ptGlowColor}0)`);
      fx.fillStyle = grad;
      fx.beginPath(); fx.arc(px, py, glowRad, 0, Math.PI*2); fx.fill();
      fx.globalAlpha = alpha;
      fx.fillStyle = ptColor;
      fx.beginPath(); fx.arc(px, py, r * (inSpot ? 1.5 : 1), 0, Math.PI*2); fx.fill();
      fx.globalAlpha = 1;
    });
    figRafId = requestAnimationFrame(drawFigure);
  }
  figRafId = requestAnimationFrame(drawFigure);

  // Collapse spot buttons (original side labels)
  BODY_SPOTS[lang].forEach((spot, idx) => {
    const b = document.createElement('button');
    b.className = 'body-node';
    b.textContent = spot.label;
    b.style.top = spot.top + '%';
    b.style.opacity = '0';
    b.style.left = 'auto';
    b.style.right = 'max(8px, 18%)';
    b.style.transform = 'translateY(8px)';
    b.style.transition = 'opacity 0.9s ease, transform 0.9s ease, border-color 0.3s ease, color 0.3s ease';

    b.addEventListener('click', () => {
      cancelAnimationFrame(figRafId);
      activeSpot = spot.key;
      document.querySelectorAll('.body-node').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      if (audioCtx) {
        const zoneFreqs = { head:1056, throat:792, chest:528, stomach:396, pelvis:264 };
        const f = zoneFreqs[spot.key] || 528;
        const oz = audioCtx.createOscillator(), gz = audioCtx.createGain();
        oz.type='sine'; oz.frequency.value=f;
        gz.gain.setValueAtTime(0,audioCtx.currentTime);
        gz.gain.linearRampToValueAtTime(0.04,audioCtx.currentTime+0.08);
        gz.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+1.5);
        oz.connect(gz); gz.connect(audioCtx.destination); oz.start(); oz.stop(audioCtx.currentTime+1.8);
      }
      collapseBodySpot = spot.key;
      const spotFraction = idx / (BODY_SPOTS[lang].length - 1);
      const pY = (0.09 + spotFraction * 0.55) * innerHeight;
      const chosen = spParticles[spChosen % Math.max(spParticles.length, 1)];
      if (chosen) {
        chosen.cx = 0.5;
        chosen.cy = 0.09 + spotFraction * 0.55;
        chosen.x = innerWidth * 0.5;
        chosen.y = pY;
      }
      setTimeout(() => {
        showScreen('s-field', () => { selectState(payload); });
      }, 220);
    });
    b.addEventListener('touchend', e => { e.preventDefault(); b.click(); });
    wrap.appendChild(b);
    setTimeout(() => { b.style.opacity = '1'; b.style.transform = 'translateY(0)'; }, 120 * idx);
  });
}

function showDecBodyMap() {
  // Legacy wrapper — routes to shared showBodyMap
  showBodyMap('witness', null);
}

// ══════════════════════════════════════
// VOICE SENSING LAYER
// Between body-map tap and dissolution chamber.
// User speaks what they feel in the body zone;
// AI reflects one quiet line back.
// ══════════════════════════════════════
const VOICE_SENSING_SYSTEM = `You are a somatic mirror. The person has just located a feeling in their body and spoken about it.

You receive: the body location, the shadow word they named, and what they said.
Your role: reflect one line back — not analysis, not advice. Just a quiet acknowledgement of what you heard.

Rules:
- One line only. Maximum 12 words.
- Field-language: locate, locate it, feel, name, body, present, held, sensation, weight, warmth.
- Do not repeat their words back verbatim. Transform slightly.
- Do not interpret why. Do not ask questions.
- Speak directly, quietly. No metaphor. No poetry.
- Never use: mindfulness, trauma, healing, process, journey, wellbeing.
- Sometimes silence is right: if their words are already clear, just confirm with two words like "It's there." or "You found it."`;

// Tone picker — shown after body zone tap, before voice layer
function showTonePicker(container, onSelect) {
  const t = lang === 'en';
  const tones = t
    ? [{ key:'pleasant', label:'pleasant', color:'rgba(140,200,160,', glow:'rgba(120,180,140,' },
       { key:'unpleasant', label:'unpleasant', color:'rgba(200,140,140,', glow:'rgba(180,120,120,' },
       { key:'neutral', label:'neutral', color:'rgba(200,185,210,', glow:'rgba(180,165,195,' }]
    : [{ key:'pleasant', label:'agradable', color:'rgba(140,200,160,', glow:'rgba(120,180,140,' },
       { key:'unpleasant', label:'desagradable', color:'rgba(200,140,140,', glow:'rgba(180,120,120,' },
       { key:'neutral', label:'neutro', color:'rgba(200,185,210,', glow:'rgba(180,165,195,' }];

  const layer = document.createElement('div');
  layer.style.cssText = `position:fixed;inset:0;z-index:22;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:clamp(20px,6vh,36px);
    background:rgba(14,12,10,0.82);opacity:0;transition:opacity .9s ease;padding:0 32px;`;

  const label = document.createElement('div');
  label.style.cssText = `font-size:clamp(13px,3.2vw,15px);letter-spacing:.18em;
    color:rgba(240,230,208,.35);text-transform:uppercase;text-align:center;`;
  label.textContent = t ? 'its quality' : 'su cualidad';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:clamp(10px,3vw,18px);';

  tones.forEach(tone => {
    const b = document.createElement('button');
    b.style.cssText = `background:none;border:1px solid ${tone.color}0.28);border-radius:24px;
      padding:clamp(8px,2vh,12px) clamp(14px,4vw,22px);cursor:pointer;font-family:inherit;
      font-size:clamp(12px,3vw,15px);letter-spacing:.10em;color:${tone.color}0.65);
      -webkit-tap-highlight-color:transparent;
      transition:all .25s ease;`;
    b.textContent = tone.label;

    const select = () => {
      b.style.borderColor = `${tone.color}0.75)`;
      b.style.color = `${tone.color}0.95)`;
      b.style.boxShadow = `0 0 18px ${tone.glow}0.3)`;
      if (navigator.vibrate) navigator.vibrate(12);
      setTimeout(() => {
        layer.style.opacity = '0';
        setTimeout(() => { layer.remove(); onSelect(tone.key); }, 700);
      }, 280);
    };
    b.onclick = select;
    btnRow.appendChild(b);
  });

  layer.appendChild(label);
  layer.appendChild(btnRow);
  container.appendChild(layer);
  requestAnimationFrame(() => { requestAnimationFrame(() => { layer.style.opacity = '1'; }); });
}

function showVoiceSensingLayer(container, zoneKey, shadowWord, toneKey, onComplete) {
  const hasSpeech = ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const apiKey = localStorage.getItem('field_api_key');

  // If no speech API and no API key, skip entirely
  if (!hasSpeech && !apiKey) { setTimeout(onComplete, 0); return; }

  const t = lang === 'en';
  const zoneLabels = {
    en: { head:'head', throat:'throat', chest:'chest', stomach:'stomach', pelvis:'pelvis' },
    es: { head:'cabeza', throat:'garganta', chest:'pecho', stomach:'vientre', pelvis:'pelvis' }
  };
  const zoneLabel = zoneLabels[lang][zoneKey] || zoneKey;

  // Layer element — sits over body-map wrap, full screen
  const layer = document.createElement('div');
  layer.id = 'voice-sense-layer';
  layer.style.cssText = `position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:clamp(18px,5vh,32px);
    background:rgba(14,12,10,0);transition:background 1.2s ease;padding:0 clamp(24px,8vw,52px);`;
  container.appendChild(layer);

  // Prompt text
  const prompt = document.createElement('div');
  prompt.style.cssText = `font-size:clamp(32px,9vw,48px);font-weight:300;letter-spacing:.05em;
    color:rgba(240,230,208,.95);font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
    text-align:center;line-height:1.4;opacity:0;transition:opacity 1.4s ease;max-width:320px;`;
  const locationLine = t ? `in your ${zoneLabel}` : `en tu ${zoneLabel}`;
  prompt.innerHTML = `${shadowWord}<br><span style="font-size:.6em;color:rgba(240,230,208,.82);letter-spacing:.08em;font-style:normal;">${locationLine}</span>`;
  layer.appendChild(prompt);

  // AI reflection line
  const reflectionEl = document.createElement('div');
  reflectionEl.style.cssText = `font-size:clamp(17px,4.5vw,22px);letter-spacing:.05em;font-style:italic;
    color:rgba(201,169,110,.95);text-align:center;line-height:1.6;min-height:28px;
    opacity:0;transition:opacity 1.2s ease;max-width:300px;`;
  layer.appendChild(reflectionEl);

  // Voice orb button — or text input fallback
  const micWrap = document.createElement('div');
  micWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;';

  let spokenText = '';
  let isListening = false;
  let recog = null;
  let startListening = () => {}; // hoisted — overwritten if speech available

  if (hasSpeech) {
    const Recog = window.SpeechRecognition || window.webkitSpeechRecognition;
    recog = new Recog();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = lang === 'es' ? 'es-ES' : 'en-US';

    const micOrb = document.createElement('button');
    micOrb.style.cssText = `width:72px;height:72px;border-radius:50%;background:none;
      border:1.5px solid rgba(201,169,110,.22);cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      -webkit-tap-highlight-color:transparent;transition:all .4s ease;position:relative;`;
    micOrb.innerHTML = `<span style="font-size:28px;line-height:1;">🎙</span>`;

    const micLabel = document.createElement('div');
    micLabel.style.cssText = `font-size:clamp(10px,2.6vw,12px);letter-spacing:.16em;
      color:rgba(240,230,208,.70);transition:color .4s ease;`;
    micLabel.textContent = t ? 'tap to speak' : 'toca para hablar';

    // Instruction line — what to say
    const instrEl = document.createElement('div');
    instrEl.style.cssText = `font-size:clamp(11px,2.8vw,13px);letter-spacing:.06em;font-style:italic;
      color:rgba(240,230,208,.50);text-align:center;max-width:240px;line-height:1.5;margin-top:4px;`;
    instrEl.textContent = t ? 'describe what you feel there' : 'describe lo que sientes ahí';

    const interimEl = document.createElement('div');
    interimEl.style.cssText = `font-size:clamp(13px,3.2vw,15px);font-style:italic;
      color:rgba(240,230,208,.80);text-align:center;min-height:20px;max-width:260px;
      transition:opacity .4s ease;letter-spacing:.03em;margin-top:8px;`;

    startListening = () => {
      if (isListening) return;
      isListening = true;
      micOrb.style.borderColor = 'rgba(201,169,110,.90)';
      micOrb.style.boxShadow = '0 0 24px rgba(201,169,110,.3)';
      micOrb.style.animation = 'micPulse 1.8s ease-in-out infinite';
      micLabel.textContent = t ? 'listening...' : 'escuchando...';
      micLabel.style.color = 'rgba(201,169,110,.88)';
      instrEl.style.opacity = '0';
      if (navigator.vibrate) navigator.vibrate(10);
      try { recog.start(); } catch(e) {}
    };

    recog.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      interimEl.textContent = final || interim;
      if (final) spokenText = final.trim();
    };

    recog.onend = () => {
      isListening = false;
      micOrb.style.borderColor = '';
      micOrb.style.boxShadow = '';
      micOrb.style.animation = '';
      instrEl.style.opacity = '1';
      if (spokenText) {
        micLabel.textContent = t ? 'received' : 'recibido';
        micLabel.style.color = 'rgba(201,169,110,.85)';
        interimEl.style.color = 'rgba(240,230,208,.70)';
        interimEl.textContent = '"' + spokenText + '"';
        if (apiKey) getVoiceReflection(spokenText, zoneKey, shadowWord, toneKey, reflectionEl, continueBtn);
        else { setTimeout(() => { continueBtn.style.opacity = '1'; continueBtn.style.pointerEvents = 'auto'; }, 1200); }
      } else {
        micLabel.textContent = t ? 'tap to speak' : 'toca para hablar';
        micLabel.style.color = 'rgba(240,230,208,.70)';
      }
    };

    recog.onerror = () => { isListening = false; micLabel.textContent = t ? 'speak' : 'hablar'; };

    micOrb.addEventListener('click', startListening);
    micOrb.addEventListener('touchend', e => { e.preventDefault(); startListening(); });

    micWrap.appendChild(micOrb);
    micWrap.appendChild(micLabel);
    micWrap.appendChild(instrEl);
    micWrap.appendChild(interimEl);
  } else {
    // Text fallback — small input
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = t ? 'describe what you feel...' : 'describe lo que sientes...';
    textInput.style.cssText = `background:none;border:none;border-bottom:1px solid rgba(240,230,208,.14);
      outline:none;font-family:inherit;font-size:clamp(13px,3.2vw,15px);letter-spacing:.06em;
      color:rgba(240,230,208,.90);width:260px;padding:10px 0;text-align:center;
      caret-color:rgba(201,169,110,.8);`;
    textInput.addEventListener('change', () => { spokenText = textInput.value.trim(); });
    textInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        spokenText = textInput.value.trim();
        if (spokenText && apiKey) getVoiceReflection(spokenText, zoneKey, shadowWord, toneKey, reflectionEl, continueBtn);
        else { continueBtn.style.opacity = '1'; continueBtn.style.pointerEvents = 'auto'; }
      }
    });
    micWrap.appendChild(textInput);
  }

  // Continue/skip button — always visible
  const continueBtn = document.createElement('button');
  continueBtn.style.cssText = `background:none;border:none;
    font-size:clamp(10px,2.6vw,12px);letter-spacing:.2em;
    color:rgba(240,230,208,.22);cursor:pointer;padding:10px 20px;
    font-family:inherit;-webkit-tap-highlight-color:transparent;
    transition:color .4s ease;`;
  continueBtn.textContent = t ? 'skip' : 'omitir';
  continueBtn.addEventListener('click', () => {
    layer.style.transition = 'opacity 0.8s ease';
    layer.style.opacity = '0';
    if (recog) { try { recog.abort(); } catch(e){} }
    setTimeout(() => { layer.remove(); onComplete(spokenText || ''); }, 800);
  });
  continueBtn.addEventListener('touchend', e => { e.preventDefault(); continueBtn.click(); });

  layer.appendChild(micWrap);
  layer.appendChild(continueBtn);

  // Reveal + visual invite (no auto-start — mic needs user gesture for permissions)
  requestAnimationFrame(() => {
    layer.style.background = 'rgba(14,12,10,0.88)';
    setTimeout(() => {
      prompt.style.opacity = '1';
      // Pulse the mic orb to invite tap
      if (hasSpeech) {
        const orb = layer.querySelector('button');
        if (orb) {
          orb.style.animation = 'micPulse 2s ease-in-out infinite';
          orb.style.borderColor = 'rgba(201,169,110,.38)';
        }
      }
    }, 300);
  });
}

async function getVoiceReflection(spokenText, zoneKey, shadowWord, toneKey, reflectionEl, continueBtn) {
  const apiKey = localStorage.getItem('field_api_key');
  if (!apiKey) { continueBtn.style.opacity = '1'; continueBtn.style.pointerEvents = 'auto'; return; }

  reflectionEl.style.color = 'rgba(201,169,110,.25)';
  reflectionEl.textContent = '·  ·  ·';

  const toneLabel = { pleasant: 'pleasant', unpleasant: 'unpleasant', neutral: 'neutral' };

  // Show loading
  reflectionEl.style.opacity = '0.4';
  reflectionEl.style.transition = 'opacity 1s ease';
  reflectionEl.textContent = '·  ·  ·';
  reflectionEl.style.color = 'rgba(201,169,110,.90)';
  setTimeout(() => { reflectionEl.style.opacity = '1'; }, 50);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 60,
        system: VOICE_SENSING_SYSTEM,
        messages: [{ role: 'user', content: `Body location: ${zoneKey}. Shadow word: ${shadowWord}. Felt quality: ${toneLabel[toneKey] || toneKey}. What they said: "${spokenText}"` }]
      })
    });
    const data = await res.json();
    const reflection = data.content?.[0]?.text?.trim();
    if (reflection) {
      reflectionEl.style.opacity = '0';
      setTimeout(() => {
        reflectionEl.textContent = reflection;
        reflectionEl.style.color = 'rgba(201,169,110,.95)';
        reflectionEl.style.opacity = '1';
      }, 400);
    } else {
      reflectionEl.style.opacity = '0';
    }
  } catch(e) {
    reflectionEl.style.opacity = '0';
  }

  // Show continue after reflection has time to land
  setTimeout(() => {
    continueBtn.style.opacity = '1';
    continueBtn.style.color = 'rgba(240,230,208,.82)';
  }, 4000);
}

// ══════════════════════════════════════
// SESSION LOG — feeds companion check-in
// ══════════════════════════════════════
function logSession(entry) {
  try {
    const raw = localStorage.getItem('field_sessions');
    const log = raw ? JSON.parse(raw) : [];
    log.push(entry);
    // Keep last 20
    if (log.length > 20) log.splice(0, log.length - 20);
    localStorage.setItem('field_sessions', JSON.stringify(log));
  } catch(e) {}
}
function getSessions() {
  try { return JSON.parse(localStorage.getItem('field_sessions') || '[]'); } catch(e) { return []; }
}

// ══════════════════════════════════════
// COMPANION CHECK-IN — home screen
// ══════════════════════════════════════
const COMPANION_SYSTEM = `You are a field companion — a quiet presence that has been watching someone's practice across many sessions. You know which states they collapse into, what they witness, what patterns emerge.

Your role: ask one question. One only. Something that couldn't be asked without knowing their history.

Rules:
- One question only. No preamble. No explanation.
- The question should feel like it comes from careful observation, not from a template.
- It should be slightly uncomfortable — the kind of question that requires honesty.
- Field-language only: collapse, observe, witness, field, state, present, superposition.
- Never use: mindfulness, meditation, wellbeing, journey, practice, healing, growth.
- Under 20 words. Often under 12.
- End with a question mark. Nothing else.`;

let companionActive = false;
let companionAsked = false;

async function maybeShowCompanion() {
  const apiKey = localStorage.getItem('field_api_key');
  if (!apiKey) return;
  const sessions = getSessions();
  if (sessions.length < 3) return; // needs history to be meaningful

  // Only show once per home visit, not every time
  if (companionAsked) return;
  companionAsked = true;

  const el = document.getElementById('companion-wrap');
  if (!el) return;

  // Build a compact session summary
  const states = sessions.filter(s => s.type === 'collapse').map(s => s.state);
  const shadows = sessions.filter(s => s.type === 'witness').map(s => s.shadow);
  const summary = `States collapsed into (most recent first): ${states.slice(-8).reverse().join(', ') || 'none yet'}.
Shadows witnessed: ${shadows.slice(-5).reverse().join(', ') || 'none yet'}.
Total sessions: ${sessions.length}.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 80,
        system: COMPANION_SYSTEM,
        messages: [{ role: 'user', content: summary }]
      })
    });
    const data = await res.json();
    const question = data.content?.[0]?.text?.trim();
    if (!question) return;

    // Show companion question with response field
    el.innerHTML = '';
    const qEl = document.createElement('div');
    qEl.style.cssText = 'font-size:clamp(15px,3.8vw,18px);font-style:italic;letter-spacing:.03em;color:rgba(240,230,208,.52);line-height:1.65;font-family:\'Cormorant Garamond\',Georgia,serif;text-align:center;';
    qEl.textContent = question;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = lang === 'en' ? 'respond...' : 'responder...';
    input.style.cssText = 'background:none;border:none;border-bottom:1px solid rgba(240,230,208,.12);' +
      'outline:none;font-family:inherit;font-size:clamp(13px,3.2vw,15px);letter-spacing:.06em;' +
      'color:rgba(240,230,208,.90);width:100%;max-width:280px;padding:8px 0;text-align:center;' +
      'caret-color:rgba(201,169,110,.8);margin-top:10px;';

    const sendCompanion = async () => {
      const userText = input.value.trim();
      if (!userText) { el.style.opacity = '0'; setTimeout(() => { el.innerHTML = ''; }, 600); return; }
      input.disabled = true;
      input.style.opacity = '0.3';
      // Store the exchange
      logSession({ type: 'companion', q: question, a: userText, ts: Date.now() });
      // Fade out
      setTimeout(() => { el.style.transition = 'opacity 1.4s ease'; el.style.opacity = '0'; setTimeout(() => { el.innerHTML = ''; }, 1500); }, 400);
    };

    input.addEventListener('keydown', e => { if (e.key === 'Enter') sendCompanion(); });

    el.appendChild(qEl);
    el.appendChild(input);
    el.style.opacity = '0';
    el.style.transition = 'opacity 1.8s ease';
    setTimeout(() => { el.style.opacity = '1'; input.focus && input.focus(); }, 600);
  } catch(e) {}
}

// ══════════════════════════════════════
// ══════════════════════════════════════
// AI INTEGRATION — Three movements
// ══════════════════════════════════════

const OBSERVE_AI_SYSTEM = `You are a field mirror. The person has just completed a mindfulness noting session — paying attention to which sense was present and whether it felt pleasant, unpleasant, or neutral.

You receive their note log. Your role is to reflect one quiet pattern back — nothing more.

Rules:
- One response only. No conversation.
- Two sentences maximum. Often one is enough.
- Name what you actually see in the data — a pattern, a frequency, a leaning.
- Do not interpret why. Do not advise. Do not ask questions.
- Speak in plain, quiet language. No metaphor, no poetry.
- If the log is too short to see a pattern (fewer than 3 notes), respond only with: "Not enough yet. Keep noting."
- Never use the words: mindfulness, practice, awareness, meditation, wellbeing.
- You are a mirror, not a guide.`;

const COLLAPSE_AI_SYSTEM = `You are a field amplifier. The person has chosen a quantum state — a way of being they want to collapse into. They are about to breathe it into existence.

You receive the state name and an imagination prompt they were given. Your role is to make it feel more reachable — not by explaining it, but by locating it in their actual life.

Rules:
- One response only. No conversation.
- Two sentences maximum. First grounds it in reality. Second opens toward the breath.
- Speak with quiet confidence. This state is real and available.
- Do not use conditional language — not "maybe", "perhaps", "you might". State it as fact.
- Do not repeat the imagination prompt back to them.
- Never use the words: manifest, attract, visualise, affirmation, law of attraction, positive thinking.
- You are not cheerleading. You are confirming what is already true.`;

// Called after noting session completes — passes note log to AI, shows mirror line
async function runObserveAI(noteLog) {
  const apiKey = localStorage.getItem('field_api_key');
  if (!apiKey || !noteLog || noteLog.length === 0) return;

  const mirrorEl = document.getElementById('obsCohAI');
  if (!mirrorEl) return;

  const logText = noteLog.map((n,i) => `${i+1}. ${n}`).join('\n');
  const userMsg = `Session note log (${noteLog.length} notes):\n${logText}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        system: OBSERVE_AI_SYSTEM,
        messages: [{ role: 'user', content: userMsg }]
      })
    });
    const data = await res.json();
    if (data.content && data.content[0]) {
      const text = data.content[0].text.trim();
      mirrorEl.textContent = text;
      mirrorEl.style.transition = 'opacity 1.6s ease';
      setTimeout(() => { mirrorEl.style.opacity = '1'; }, 100);
    }
  } catch(e) { /* fail silently */ }
}

// Called when collapse pre-breath stage shows — passes state + imagination to AI
async function runCollapseAI(stateName, imagPrompt) {
  const apiKey = localStorage.getItem('field_api_key');
  if (!apiKey) return;

  const ampEl = document.getElementById('collapseAI');
  if (!ampEl) return;

  const userMsg = `State chosen: "${stateName}"\nImagination prompt given: "${imagPrompt}"`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        system: COLLAPSE_AI_SYSTEM,
        messages: [{ role: 'user', content: userMsg }]
      })
    });
    const data = await res.json();
    if (data.content && data.content[0]) {
      const text = data.content[0].text.trim();
      ampEl.textContent = text;
      ampEl.style.color = 'rgba(240,230,208,.92)';
      ampEl.style.opacity = '0';
      ampEl.style.transition = 'opacity 1.4s ease';
      setTimeout(() => { ampEl.style.opacity = '1'; }, 100);
    }
  } catch(e) { /* fail silently */ }
}

// DISSOLUTION CHAMBER — AI Socratic mirror
// Slots between body map and breath
// 3 exchanges max · field-language · sparse
// ══════════════════════════════════════
let chamberExchanges = 0;
let chamberHistory = [];
let chamberTyping = false;

const CHAMBER_SYSTEM = `You are a dissolution chamber — the last door before silence.

The person has just named a shadow state (like "Anxious" or "Heavy") and located it in their body. They are about to enter a breath practice. Your role is to help them be with it, not to fix it.

Rules:
- Maximum 3 exchanges. After the 3rd user message, end with a single closing line and nothing more.
- Ask only one question per response. Never two.
- Speak in field-language: body, presence, sensation, location, quality. Not psychology or advice.
- Be sparse. One to three sentences maximum per response.
- Do not reassure. Do not explain. Do not interpret.
- If they say something, reflect it back as sensation or location, then ask what's true about it right now.
- Your first question opens toward the body. Example: "Where in [zone] does it live most precisely?"
- Never use the words: heal, release, let go, process, trauma, therapy, anxiety, cope.
- You are holding space, not guiding them anywhere.
- After 3 exchanges, your final message ends with a closing line like: "That's enough to carry into the breath." or "The breath can hold the rest."`;


let chamberLastAI = '';
let chamberSystemActive = ''; // set per-session with somatic context

function appendChamberMsg(text, role) {
  const msgs = document.getElementById('chamber-messages');
  if (!msgs) return;
  // Remove 'opening' centering once user has responded
  if (role === 'user') msgs.classList.remove('opening');
  const div = document.createElement('div');
  div.className = `chamber-msg ${role}`;
  div.textContent = text;
  msgs.appendChild(div);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    div.style.opacity = '1';
    msgs.scrollTop = msgs.scrollHeight;
  }));
}

async function chamberCallAI(onDone) {
  const apiKey = localStorage.getItem('field_api_key');
  if (!apiKey) { startDecAcknowledge(); return; }

  chamberTyping = true;

  // Typing indicator
  const msgs = document.getElementById('chamber-messages');
  const dot = document.createElement('div');
  dot.className = 'chamber-msg ai';
  dot.style.opacity = '0.35';
  dot.textContent = '·  ·  ·';
  if (msgs) { msgs.appendChild(dot); msgs.scrollTop = msgs.scrollHeight; }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 180,
        system: chamberSystemActive || CHAMBER_SYSTEM,
        messages: chamberHistory
      })
    });

    const data = await res.json();
    if (dot.parentNode) dot.parentNode.removeChild(dot);

    if (data.content && data.content[0]) {
      const text = data.content[0].text.trim();
      chamberLastAI = text;
      appendChamberMsg(text, 'ai');
      chamberTyping = false;
      if (onDone) onDone();
    } else {
      // API error — skip silently to acknowledge
      chamberTyping = false;
      startDecAcknowledge();
    }
  } catch (err) {
    if (dot.parentNode) dot.parentNode.removeChild(dot);
    chamberTyping = false;
    startDecAcknowledge();
  }
}

function startDissolutionChamber() {
  chamberExchanges = 0;
  chamberHistory   = [];
  chamberTyping    = false;
  chamberLastAI    = '';
  currentMode = 'chamber';
  showBackBtn();
  document.getElementById('backBtn').onclick = () => startDecohere();

  const shadowName = lang === 'en' ? decStateName : decStateNameES;
  const zoneName   = decBodySpot || 'body';
  const toneLabel  = decSomaticTone === 'pleasant' ? 'pleasant' : decSomaticTone === 'unpleasant' ? 'unpleasant' : decSomaticTone === 'neutral' ? 'neutral' : '';
  const spokenLine = decSomaticSpoken ? `\nWhat they said about it: "${decSomaticSpoken}"` : '';
  const toneNote   = toneLabel ? `\nThe quality they named: ${toneLabel}.` : '';

  // Dynamic system prompt enriched with full somatic context
  const chamberSystemFull = CHAMBER_SYSTEM + `

Context for this session:
- Shadow state: "${shadowName}"
- Body location: ${zoneName}${toneNote}${spokenLine}

Your first question should go deeper into what they already named — not restate it. If they spoke something specific, begin there.`;

  const contextEl = document.getElementById('chamber-context');
  const msgsEl    = document.getElementById('chamber-messages');
  const inputWrap = document.getElementById('chamber-input-wrap');
  const skipEl    = document.getElementById('chamber-skip');
  const inputEl   = document.getElementById('chamber-input');

  msgsEl.innerHTML = '';
  msgsEl.classList.add('opening');
  inputEl.value = '';
  inputWrap.style.opacity = '0';
  inputWrap.style.pointerEvents = 'none';
  skipEl.style.opacity = '0';
  skipEl.textContent = lang === 'en' ? 'continue to breath →' : 'continuar a la respiración →';
  contextEl.style.opacity = '0';
  contextEl.textContent = shadowName.toLowerCase() + ' · ' + zoneName + (toneLabel ? ' · ' + toneLabel : '');

  // Seed history with full somatic context
  const seedParts = [`I am with ${shadowName}, and I feel it in my ${zoneName}.`];
  if (toneLabel) seedParts.push(`It feels ${toneLabel}.`);
  if (decSomaticSpoken) seedParts.push(`I described it as: "${decSomaticSpoken}".`);

  chamberHistory = [{
    role: 'user',
    content: seedParts.join(' ')
  }];

  chamberSystemActive = chamberSystemFull;

  applyDecoherePalette();

  showScreen('s-chamber', () => {
    setTimeout(() => { contextEl.style.opacity = '1'; }, 600);
    // Opening AI question arrives after a beat
    setTimeout(() => {
      chamberCallAI(() => {
        // Show input and skip after first AI message
        setTimeout(() => {
          inputWrap.style.opacity = '1';
          inputWrap.style.pointerEvents = 'all';
          inputEl.focus();
          skipEl.style.opacity = '1';
          // Show mic if speech API available
          const micBtn = document.getElementById('chamber-mic');
          if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            micBtn.style.display = 'flex';
          }
        }, 600);
      });
    }, 1800);
  });

  // Skip always available
  skipEl.addEventListener('click', exitChamber);
  skipEl.addEventListener('touchend', e => { e.preventDefault(); exitChamber(); });
}

function chamberSend() {
  if (chamberTyping) return;
  const inputEl   = document.getElementById('chamber-input');
  const inputWrap = document.getElementById('chamber-input-wrap');
  const skipEl    = document.getElementById('chamber-skip');
  const val = inputEl.value.trim();
  if (!val) return;

  inputEl.value = '';
  inputWrap.style.opacity = '0';
  inputWrap.style.pointerEvents = 'none';
  skipEl.style.opacity = '0';

  appendChamberMsg(val, 'user');
  chamberHistory.push({ role: 'assistant', content: chamberLastAI });
  chamberHistory.push({ role: 'user', content: val });
  chamberExchanges++;

  if (chamberExchanges >= 3) {
    // Final exchange — AI goes quiet, "breathe" appears alone
    chamberCallAI(() => {
      setTimeout(() => {
        const skipEl = document.getElementById('chamber-skip');
        if (skipEl) {
          skipEl.textContent = lang === 'en' ? 'breathe' : 'respirar';
          skipEl.style.fontSize = 'clamp(22px,6vw,30px)';
          skipEl.style.fontFamily = "'Cormorant Garamond',Georgia,serif";
          skipEl.style.fontStyle = 'italic';
          skipEl.style.letterSpacing = '.04em';
          skipEl.style.color = 'rgba(240,230,208,.92)';
          skipEl.style.opacity = '1';
        }
      }, 1400);
    });
  } else {
    chamberCallAI(() => {
      setTimeout(() => {
        inputWrap.style.opacity = '1';
        inputWrap.style.pointerEvents = 'all';
        document.getElementById('chamber-input').focus();
        skipEl.style.opacity = '1';
        const micBtn = document.getElementById('chamber-mic');
        if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
          micBtn.style.display = 'flex';
        }
      }, 600);
    });
  }
}

function exitChamber() {
  currentMode = 'witness';
  startDecAcknowledge();
}

let chamberRecognition = null;
let chamberListening = false;

function chamberToggleMic() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
  const micBtn = document.getElementById('chamber-mic');
  const inputEl = document.getElementById('chamber-input');

  if (chamberListening) {
    if (chamberRecognition) chamberRecognition.stop();
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  chamberRecognition = new SR();
  chamberRecognition.lang = lang === 'es' ? 'es-ES' : 'en-US';
  chamberRecognition.continuous = false;
  chamberRecognition.interimResults = true;

  chamberRecognition.onstart = () => {
    chamberListening = true;
    if (micBtn) micBtn.classList.add('listening');
    if (inputEl) inputEl.placeholder = '…';
  };
  chamberRecognition.onresult = e => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    if (inputEl) inputEl.value = transcript;
    if (e.results[e.results.length - 1].isFinal) {
      chamberListening = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (inputEl) inputEl.placeholder = '';
      setTimeout(() => chamberSend(), 400);
    }
  };
  chamberRecognition.onerror = chamberRecognition.onend = () => {
    chamberListening = false;
    if (micBtn) micBtn.classList.remove('listening');
    if (inputEl) inputEl.placeholder = '';
  };
  chamberRecognition.start();
}

// ══════════════════════════════════════
// PHASE 1: Acknowledgment — word fades in alone in silence, then breath begins
function startDecAcknowledge() {
  const displayName = lang==='en' ? decStateName : decStateNameES;

  const ackLayer    = document.getElementById('dec-ack-layer');
  const breathLayer = document.getElementById('dec-breath-layer');
  const wordEl      = document.getElementById('dec-word');
  const btext       = document.getElementById('dec-btext');
  const bp          = document.getElementById('dec-bp');

  [ackLayer, breathLayer, wordEl, btext, bp].forEach(el => {
    if (el) { el.style.transition = 'none'; el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
  });
  const wordOrb = document.getElementById('dec-word-orb');
  if (wordOrb) { wordOrb.style.transition = 'none'; wordOrb.style.opacity = '0'; wordOrb.textContent = ''; }
  // Clear any lingering dec breath timers
  clearAllDec();

  wordEl.innerHTML = '';
  displayName.split('').forEach(ch => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00a0' : ch;
    span.style.cssText = 'display:inline-block;transition:none;';
    wordEl.appendChild(span);
  });

  [0,1,2].forEach(i => {
    const d = document.getElementById('dec-dot'+i);
    if (d) d.classList.remove('done');
  });
  if (bp) {
    bp.style.transform = 'scale(1)';
    bp.style.filter = '';
    bp.style.background = 'rgba(180,175,165,.5)';
    bp.style.opacity = '0';
  }

  // Ensure back button stays visible
  showBackBtn();
  document.getElementById('backBtn').onclick = () => startDecohere();

  showScreen('s-dec-breath', () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wordEl.style.transition = 'color 3s ease, opacity 2.5s ease';
      ackLayer.style.transition = 'opacity 1.2s ease';
      setTimeout(() => {
        wordEl.style.opacity = '1';
        wordEl.style.textShadow = '0 0 48px rgba(240,220,180,.35)';
      }, 300);
      setTimeout(() => { ackLayer.style.opacity = '1'; }, 400);

      // Single 'breathe' prompt — appears at 4s, tap to begin
      let readyEl = document.createElement('div');
      readyEl.style.cssText = `position:fixed;bottom:clamp(70px,14vh,110px);left:50%;
        transform:translateX(-50%);font-size:clamp(13px,3.2vw,16px);letter-spacing:.28em;
        color:rgba(240,230,208,.0);font-weight:300;font-family:'Plus Jakarta Sans',sans-serif;
        text-transform:lowercase;cursor:pointer;z-index:52;padding:14px 28px;
        transition:color 2.5s ease;white-space:nowrap;-webkit-tap-highlight-color:transparent;`;
      readyEl.textContent = lang === 'en' ? 'breathe' : 'respira';
      document.body.appendChild(readyEl);
      setTimeout(() => { readyEl.style.color = 'rgba(240,230,208,.32)'; }, 4000);

      let breathStarted = false;
      const beginBreath = () => {
        if (breathStarted) return;
        breathStarted = true;
        readyEl.style.color = 'rgba(240,230,208,.0)';
        setTimeout(() => { if (readyEl.parentNode) readyEl.remove(); }, 1800);
        startDecBreath(displayName);
      };

      readyEl.addEventListener('click', beginBreath);
      readyEl.addEventListener('touchend', e => { e.preventDefault(); beginBreath(); });
      // Auto-start at 9s
      setTimeout(beginBreath, 9000);
    }));
  });
}

function startDecBreath(displayName) {
  bgDimTarget = 0.25;
  const t = TRANSLATIONS[lang];
  const ackLayer    = document.getElementById('dec-ack-layer');
  const breathLayer = document.getElementById('dec-breath-layer');
  const btext       = document.getElementById('dec-btext');
  const bdots       = document.getElementById('dec-bdots');

  // Hide ack layer, reveal breath layer (just for btext + dots — orb is on canvas)
  ackLayer.style.transition = 'opacity 1.2s ease';
  ackLayer.style.opacity = '0';
  setTimeout(() => { ackLayer.style.pointerEvents = 'none'; }, 1200);

  breathLayer.style.transition = 'opacity 1.2s ease';
  setTimeout(() => { breathLayer.style.opacity = '1'; breathLayer.style.pointerEvents = 'all'; }, 400);

  // Hide legacy CSS dec-bp so it doesn't interfere
  const bp = document.getElementById('dec-bp');
  if (bp) { bp.style.display = 'none'; }
  const wordOrb = document.getElementById('dec-word-orb');
  if (wordOrb) { wordOrb.style.display = 'none'; }

  // bdots
  if (bdots) { bdots.style.top = 'auto'; bdots.style.bottom = 'clamp(80px,14vh,120px)'; }

  const backBtn = document.getElementById('backBtn');
  if (backBtn) { backBtn.style.opacity='1'; backBtn.style.pointerEvents='all'; backBtn.onclick = () => startDecohere(); }

  // ── Violet BreathOrb on the shared canvas ──
  // First: fade and remove the bodymapWrap that covers the canvas
  const bmap = document.getElementById('bodymapWrap');
  if (bmap) {
    bmap.style.transition = 'opacity 1s ease';
    bmap.style.opacity = '0';
    setTimeout(() => { if (bmap.parentNode) bmap.parentNode.removeChild(bmap); }, 1050);
  }
  // Ensure main canvas is visible
  const mainCv = document.getElementById('cv');
  if (mainCv) { mainCv.style.transition = 'opacity 1s ease'; mainCv.style.opacity = '1'; }

  const decOrb = new BreathOrb(innerWidth * 0.5, innerHeight * 0.5, 'violet');
  decOrb.maxCycles = 3;
  // Word lives INSIDE the orb on canvas — steady and present (witnessing, not choosing)
  decOrb.wordText = displayName;
  decOrb.wordTargetAlpha = 0;
  decOrb.wordGlowIntensity = 0.4; // steady moderate glow throughout

  decOrb.onPhaseChange = (phase) => {
    if (phase === 'inhale') {
      // Word glows on inhale — being seen, held in awareness
      decOrb.wordTargetAlpha = 0.85;
      decOrb.wordGlowIntensity = 0.5 + decOrb.cycleCount * 0.15;
    } else if (phase === 'hold') {
      decOrb.wordTargetAlpha = 0.65;
      decOrb.wordGlowIntensity = 0.4;
    } else if (phase === 'exhale') {
      // Word fades on exhale — releasing
      decOrb.wordTargetAlpha = 0.18;
      decOrb.wordGlowIntensity = 0.1;
    } else if (phase === 'rest') {
      decOrb.wordTargetAlpha = 0.25;
    }
  };

  // Register orb so render loop draws it
  window._decOrb = decOrb;

  let cycle = 0;
  const decTimers = [];
  function dDelay(fn,ms){ const id=setTimeout(fn,ms); decTimers.push(id); decBreathTimers.push(id); return id; }

  function setBtext(txt) {
    if (!btext) return;
    const isVisible = parseFloat(btext.style.opacity||'0') > 0.05;
    if (isVisible) {
      btext.style.transition = 'opacity 0.5s ease'; btext.style.opacity = '0';
      const id = setTimeout(() => { btext.textContent = txt; btext.style.transition = 'opacity 1.2s ease'; btext.style.opacity = '1'; }, 550);
      decBreathTimers.push(id);
    } else {
      btext.textContent = txt; btext.style.transition = 'opacity 1.4s ease'; btext.style.opacity = '1';
    }
  }
  function hideBtext() { if (!btext) return; btext.style.transition = 'opacity 0.8s ease'; btext.style.opacity = '0'; }

  function dronePitch(up) {
    if (!droneNodes.length) return;
    droneNodes.forEach(n => { if (n.frequency) { const base = n.frequency.value; n.frequency.setTargetAtTime(up ? base*1.018 : base/1.018, audioCtx.currentTime, 2); } });
  }

  function runCycle() {
    if (cycle >= 3) {
      if (backBtn) { backBtn.style.opacity='1'; backBtn.style.pointerEvents='all'; backBtn.onclick = () => goHome(); }
      dDelay(() => {
        hideBtext();
        // Scatter the word
        if (window._decOrb) { window._decOrb.startPhase('crystallised'); }
        playDecohereRelease();
      }, 400);
      dDelay(() => {
        if (window._decOrb) { window._decOrb.alpha = 0; window._decOrb = null; }
      }, 3200);
      dDelay(() => showDecEnd(), 5000);
      return;
    }
    cycle++;

    const inhaleText = t.decInhale;
    const exhaleText = t.decExhale;
    setBtext(inhaleText);

    // Drive orb phase manually to sync with our timers
    dDelay(() => { 
      if (window._decOrb) { 
        window._decOrb.startPhase('inhale'); 
        window._decOrb.wordTargetAlpha = 0.45;
      } 
      dronePitch(true); 
    }, 100);
    dDelay(() => { if (window._decOrb) window._decOrb.startPhase('hold'); }, 4700);
    dDelay(() => {
      setBtext(exhaleText);
      if (navigator.vibrate) navigator.vibrate(22);
      dronePitch(false);
      if (window._decOrb) window._decOrb.startPhase('exhale');
    }, 6400);

    dDelay(() => {
      const dot = document.getElementById('dec-dot'+(cycle-1));
      if (dot) dot.classList.add('done');
    }, 11500);
    dDelay(() => { hideBtext(); }, 10800);
    dDelay(runCycle, 12400);
  }

  // Pre-breath instructions during first 8s (orb sits still, word whispers in)
  dDelay(() => setBtext(t ? 'breathe in' : 'inhala'), 800);
  dDelay(() => setBtext(t ? `exhale into · ${displayName}` : `exhala hacia · ${displayName}`), 5000);
  dDelay(() => {
    if (window._decOrb) window._decOrb.wordTargetAlpha = 0.28;
  }, 5000);

  dDelay(runCycle, 9000);
}

function showDecEnd() {
  currentMode = 'witness-end';
  const t = TRANSLATIONS[lang];
  const nd = parseInt(localStorage.getItem('field_obs_witness')||'0') + 1;
  localStorage.setItem('field_obs_witness', nd);
  // Log this witness session
  logSession({ type: 'witness', shadow: decStateName, ts: Date.now() });

  spParticles = Array.from({length:12}, (_,i) => new SpParticle(i,12));
  spParticles.forEach(p => {
    p._flickering = false; // [TECH2]
    p.x = innerWidth/2 + (Math.random()-0.5)*20;
    p.y = innerHeight/2 + (Math.random()-0.5)*20;
    p.targetAlpha = 0;
    p.targetClarity = 0;
    p.phV *= 0.5;
  });
  setTimeout(() => {
    spParticles.forEach(p => { p.targetAlpha = 0.22 + Math.random()*0.2; });
  }, 600);

  // decEndLine intentionally left empty — WITNESSED sentence is the complete close
  document.getElementById('decEndLine').textContent = '';
  document.getElementById('decRetBtn').textContent = t.decRetBtn;
  document.getElementById('decAgainBtn').textContent = t.decAgainBtn;

  const witnessed = document.getElementById('decWitnessed');
  if (witnessed) {
    const sentence = (WITNESSED[lang] && WITNESSED[lang][decStateName]) || '';
    witnessed.textContent = sentence;
    witnessed.style.opacity = '0';
  }

  const btns = document.querySelector('.dec-btns');
  if (btns) { btns.style.opacity='0'; btns.style.transition='opacity 1.4s ease'; btns.style.pointerEvents='none'; }

  const backBtn = document.getElementById('backBtn');
  if (backBtn) { backBtn.onclick = () => goHome(); }

  showScreen('s-dec-end', () => {
    // [AE1] decEndLine gets breathing animation — applied via class
    const endLine = document.getElementById('decEndLine');
    if (endLine) endLine.classList.add('breathing-glow');

    setTimeout(() => { if (witnessed) witnessed.style.opacity = '1'; }, 1500);
    // [AE4] Witnessed sentence breathes for longer — buttons at 12s (was 8s)
    setTimeout(() => { if (btns) { btns.style.opacity='1'; btns.style.pointerEvents='all'; } }, 12000);
  });
}

function clearAllDec() {
  decBreathTimers.forEach(clearTimeout); decBreathTimers = [];
  if (window._decOrb) { window._decOrb = null; }
  const dw = document.getElementById('dec-state-word');
  if (dw && dw.parentNode) dw.parentNode.removeChild(dw);
}

// ── WELCOME INTRO ──
let wlcStep = 0;
const WLC_TOTAL = 3;

// ── LANDING PARTICLE SCREEN ──
let landingRaf = null;

function startLandingScreen() {
  document.getElementById('s-home').classList.remove('active');
  document.getElementById('s-landing').classList.add('active');

  const lcv = document.getElementById('landing-cv');
  const lc = lcv.getContext('2d');
  const hint = document.getElementById('landingHint');

  function resizeLanding() { lcv.width = innerWidth; lcv.height = innerHeight; }
  resizeLanding();
  let resizeCleanedUp = false;
  window.addEventListener('resize', resizeLanding);
  function cleanupLandingResize() {
    if (!resizeCleanedUp) { window.removeEventListener('resize', resizeLanding); resizeCleanedUp = true; }
  }

  // Particle state — small, blurry, drifting
  let px = innerWidth * 0.5;
  let py = innerHeight * 0.47;
  let vx = (Math.random() - 0.5) * 0.6;
  let vy = (Math.random() - 0.5) * 0.6;
  let phase = Math.random() * Math.PI * 2;
  let phV = 0.012 + Math.random() * 0.008;
  let pulsePhase = 0; // secondary pulse for vibration

  // Appearance state — starts tiny/blurry, sharpens on tap
  let focusLevel = 0;   // 0 = blurry/dim, 1 = sharp/bright
  let tapFocus = false;
  let collapsing = false;
  let collapseProgress = 0;
  let hintAlpha = 0;
  let age = 0;

  // Show hint after 2.5s
  setTimeout(() => { hintAlpha = 1; hint.style.color = `rgba(240,204,136,0.30)`; }, 2500);

  function drawLanding() {
    if (!document.getElementById('s-landing').classList.contains('active')) {
      cleanupLandingResize(); return;
    }
    lc.clearRect(0, 0, lcv.width, lcv.height);
    phase += phV;
    age++;

    // Drift — gentle Brownian motion with soft boundary
    vx += (Math.random() - 0.5) * 0.04;
    vy += (Math.random() - 0.5) * 0.04;
    vx *= 0.96; vy *= 0.96;
    // Push away from edges
    const marg = 80;
    if (px < marg) vx += 0.08;
    if (px > innerWidth - marg) vx -= 0.08;
    if (py < marg) vy += 0.08;
    if (py > innerHeight - marg) vy -= 0.08;
    px += vx; py += vy;

    // Focus transition
    if (tapFocus && !collapsing) {
      focusLevel = Math.min(focusLevel + 0.04, 1);
    } else if (!tapFocus && !collapsing) {
      focusLevel = Math.max(focusLevel - 0.01, 0);
    }

    const breathe = 0.88 + 0.12 * Math.sin(phase);

    if (collapsing) {
      // Particle implodes inward, screen fades
      collapseProgress += 0.025;
      const t = Math.min(collapseProgress, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      // Particle shrinks and sharpens to nothing
      const r = (9 + focusLevel * 6) * breathe * (1 - eased);
      const gR = r * (4.5 - eased * 3);
      const alpha = 1 - eased;

      // Glow
      const g = lc.createRadialGradient(px, py, 0, px, py, gR);
      g.addColorStop(0, `rgba(240,204,136,${(alpha * 0.45).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(240,204,136,${(alpha * 0.12).toFixed(3)})`);
      g.addColorStop(1, 'rgba(240,204,136,0)');
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(px, py, gR, 0, Math.PI * 2); lc.fill();

      // Core
      lc.globalAlpha = alpha * (0.5 + focusLevel * 0.5);
      lc.fillStyle = 'rgba(240,210,140,1)';
      lc.beginPath(); lc.arc(px, py, Math.max(r, 0.5), 0, Math.PI * 2); lc.fill();
      lc.globalAlpha = 1;

      if (collapseProgress >= 1) {
        cleanupLandingResize();
        cancelAnimationFrame(landingRaf);
        localStorage.setItem('field_welcomed_landing', '1');
        buildWelcome();
        document.getElementById('s-landing').classList.remove('active');
        document.getElementById('s-welcome').classList.add('active');
        const w0 = document.getElementById('wlc0');
        if (w0) {
          w0.style.opacity = '0'; w0.style.transition = 'none'; w0.classList.add('on');
          requestAnimationFrame(() => requestAnimationFrame(() => {
            w0.style.transition = 'opacity 1.2s ease'; w0.style.opacity = '1';
          }));
        }
        return;
      }
    } else {
      // SpParticle-matched rendering — same visual language, 1.4× scale
      pulsePhase += 0.031;
      const microPulse = 1 + 0.07 * Math.sin(pulsePhase);
      const flicker = 0.88 + 0.12 * Math.sin(pulsePhase * 3.7);
      const f = focusLevel;

      // Core radius — matches SpParticle r but larger
      const r = (11 + f * 6) * breathe * microPulse;

      // Glow halos
      const g1 = (28 + f * 32) * breathe;   // inner
      const g2 = (70 + f * 80) * breathe;   // mid
      const g3 = (140 + f * 120) * breathe; // corona

      // Corona
      const corona = lc.createRadialGradient(px, py, g2 * 0.5, px, py, g3);
      corona.addColorStop(0, `rgba(240,190,80,${(0.06 * breathe).toFixed(3)})`);
      corona.addColorStop(1, 'rgba(240,190,80,0)');
      lc.fillStyle = corona;
      lc.beginPath(); lc.arc(px, py, g3, 0, Math.PI * 2); lc.fill();

      // Mid halo
      const midGrad = lc.createRadialGradient(px, py, 0, px, py, g2);
      midGrad.addColorStop(0, `rgba(255,220,140,${(0.22 * breathe * flicker).toFixed(3)})`);
      midGrad.addColorStop(0.4, `rgba(240,190,80,${(0.14 * breathe).toFixed(3)})`);
      midGrad.addColorStop(1, 'rgba(240,190,80,0)');
      lc.fillStyle = midGrad;
      lc.beginPath(); lc.arc(px, py, g2, 0, Math.PI * 2); lc.fill();

      // Rays — emerge as focusLevel rises (matching SpParticle ray logic)
      if (f > 0.15) {
        const rayAlphaBase = (f - 0.15) / 0.85;
        const NUM_RAYS = 8;
        const rayPh = phase * 0.28; // slow rotation from phase
        for (let i = 0; i < NUM_RAYS; i++) {
          const angle = rayPh + (Math.PI * 2 / NUM_RAYS) * i;
          const lenPulse = 0.55 + 0.45 * Math.sin(phase * 1.3 + i * 0.8);
          const rayLen = (g1 * 2.2 + f * 70) * lenPulse * breathe;
          const rayWidth = r * 0.18;
          const rayAlpha = (0.12 + f * 0.22) * lenPulse * flicker * rayAlphaBase;
          lc.save();
          lc.translate(px, py); lc.rotate(angle);
          const rg = lc.createLinearGradient(r, 0, r + rayLen, 0);
          rg.addColorStop(0, `rgba(255,220,140,${rayAlpha.toFixed(3)})`);
          rg.addColorStop(0.5, `rgba(240,190,80,${(rayAlpha*0.5).toFixed(3)})`);
          rg.addColorStop(1, 'rgba(240,190,80,0)');
          lc.fillStyle = rg;
          lc.beginPath();
          lc.moveTo(r, -rayWidth); lc.lineTo(r + rayLen, 0); lc.lineTo(r, rayWidth);
          lc.closePath(); lc.fill();
          lc.restore();
        }
      }

      // Inner glow
      const innerGrad = lc.createRadialGradient(px, py, 0, px, py, g1);
      innerGrad.addColorStop(0, `rgba(255,240,180,${(0.9 * flicker).toFixed(3)})`);
      innerGrad.addColorStop(0.3, `rgba(255,210,120,${(0.55 * breathe).toFixed(3)})`);
      innerGrad.addColorStop(1, 'rgba(240,190,80,0)');
      lc.fillStyle = innerGrad;
      lc.beginPath(); lc.arc(px, py, g1, 0, Math.PI * 2); lc.fill();

      // Hard core
      lc.globalAlpha = 0.62 + f * 0.35;
      lc.fillStyle = 'rgba(255,248,220,1)';
      lc.beginPath(); lc.arc(px, py, r, 0, Math.PI * 2); lc.fill();
      // Hot centre
      lc.globalAlpha = (0.62 + f * 0.35) * 0.7;
      lc.fillStyle = 'rgba(255,255,240,1)';
      lc.beginPath(); lc.arc(px, py, r * 0.4, 0, Math.PI * 2); lc.fill();
      lc.globalAlpha = 1;
    }

    landingRaf = requestAnimationFrame(drawLanding);
  }
  landingRaf = requestAnimationFrame(drawLanding);

  // Pointer/touch: hold to focus, tap to collapse
  let holdTimer = null;

  function onPointerDown(e) {
    if (collapsing) return;
    tapFocus = true;
    // After holding focused for 0.4s, collapse
    holdTimer = setTimeout(() => {
      if (tapFocus && !collapsing) triggerCollapse();
    }, 400);
  }

  function onPointerUp(e) {
    clearTimeout(holdTimer);
    // Quick tap also collapses if focused enough
    if (tapFocus && !collapsing && focusLevel > 0.4) {
      triggerCollapse();
    } else {
      tapFocus = false;
    }
  }

  function triggerCollapse() {
    if (collapsing) return;
    collapsing = true;
    tapFocus = false;
    hint.style.color = 'rgba(240,204,136,0)';
    if (navigator.vibrate) navigator.vibrate(30);
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    playCollapseSignature();
    document.getElementById('s-landing').removeEventListener('click', onTap);
    document.getElementById('s-landing').removeEventListener('touchend', onPointerUp);
    document.getElementById('s-landing').removeEventListener('mousedown', onPointerDown);
    document.getElementById('s-landing').removeEventListener('touchstart', onPointerDown);
  }

  // Simple tap fallback
  function onTap(e) {
    if (collapsing) return;
    tapFocus = true;
    focusLevel = Math.max(focusLevel, 0.5);
    setTimeout(() => { if (!collapsing) triggerCollapse(); }, 180);
  }

  document.getElementById('s-landing').addEventListener('mousedown', onPointerDown);
  document.getElementById('s-landing').addEventListener('mouseup', onPointerUp);
  document.getElementById('s-landing').addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(e); }, { passive: false });
  document.getElementById('s-landing').addEventListener('touchend', e => { e.preventDefault(); onPointerUp(e); });
  document.getElementById('s-landing').addEventListener('click', onTap);
}

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

// ── CIRCADIAN PALETTE ──
function applyCircadianPalette() {
  const h = new Date().getHours();
  const root = document.documentElement.style;

  if (h >= 5 && h < 8) {
    // Dawn — rose-gold, warm amber
    root.setProperty('--gold', '#c9956a');
    root.setProperty('--gold-bright', '#f0b878');
    root.setProperty('--bg', '#0d0806');
    root.setProperty('--cream', '#f0dfc8');
  } else if (h >= 8 && h < 17) {
    // Day — default palette, slightly brighter
    root.setProperty('--gold', '#c9a96e');
    root.setProperty('--gold-bright', '#f0cc88');
    root.setProperty('--bg', '#0a0805');
    root.setProperty('--cream', '#f0e6d0');
  } else if (h >= 17 && h < 20) {
    // Dusk — deeper amber, slightly dimmer
    root.setProperty('--gold', '#c49058');
    root.setProperty('--gold-bright', '#e8b870');
    root.setProperty('--bg', '#0c0906');
    root.setProperty('--cream', '#ecdbc0');
  } else {
    // Night — cooler, moonlike silver-gold
    root.setProperty('--gold', '#a89878');
    root.setProperty('--gold-bright', '#d4c098');
    root.setProperty('--bg', '#080706');
    root.setProperty('--cream', '#e0d8cc');
  }
}

// ── INIT ──
applyLang();
applyCircadianPalette();

// Witness violet palette — applied on entry, restored on exit
function applyDecoherePalette() {
  const root = document.documentElement.style;
  root.setProperty('--gold',       '#9880b8'); // soft violet
  root.setProperty('--gold-bright','#c8aae0'); // bright mauve
  root.setProperty('--bg',         '#070609'); // deep violet-black
  root.setProperty('--cream',      '#e0d8ec'); // lavender cream
}
function restoreCircadianPalette() {
  // Remove overrides — cascade falls back to :root vars set by applyCircadianPalette
  const root = document.documentElement.style;
  root.removeProperty('--gold');
  root.removeProperty('--gold-bright');
  root.removeProperty('--bg');
  root.removeProperty('--cream');
  applyCircadianPalette(); // reapply time-of-day
}
if (fontLarge) document.body.classList.add('fs-large');

if (!localStorage.getItem('field_welcomed')) {
  startLandingScreen();
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
