// ═══════════════════════════════════════
// FIELD — Unified App v1.0
// Three movements: Observe (◎) · Collapse (↑) · Decohere (◯)
// ═══════════════════════════════════════

// ── STATE ──
let lang = localStorage.getItem('field_lang') || 'en';
let audioCtx = null, droneNodes = [], breathTimers = [];
let breathRunning = false, breathCycle = 0, curStateName = '', spChosen = 0;
let collapseStage = 0, isTransitioning = false, particlesHidden = false;
let totalObs = parseInt(localStorage.getItem('field_obs') || '0');
let currentMode = 'home'; // 'home','observe','collapse','decohere'

// Observer state
let attentionTimer = null, attentionSec = 0, isCoherent = false;
let fieldActive = false, scatterTO = null, observeParticle = null;
const COHERENCE_SEC = 45;
const METER_DOTS = 9;

// Decohere state
let decBreathTimers = [], decStateName = '', decStateNameES = '';

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
  }
  update() { this.y += this.vy; if (this.y < -5) this.reset(false); }
  draw() { cx.globalAlpha = this.alpha; cx.fillStyle = '#f0cc88';
    cx.beginPath(); cx.arc(this.x, this.y, this.r, 0, Math.PI*2); cx.fill(); cx.globalAlpha = 1; }
}
const bgPts = Array.from({length:70}, () => new Pt());

// ── SUPERPOSITION PARTICLES (Collapse) ──
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
    this.cx += (this.targetCx - this.cx)*0.018;
    this.cy += (this.targetCy - this.cy)*0.018;
    const ds = Math.min(innerWidth, innerHeight);
    this.x = this.cx*innerWidth + Math.cos(this.ph)*this.driftR*(ds/500);
    this.y = this.cy*innerHeight + Math.sin(this.ph*0.73)*this.driftR*0.65*(ds/500);
    const maxY = cv.height*(isIOS?1:1/((window.devicePixelRatio||1)))*0.24;
    if (this.y > maxY && this.targetCy < 0.22) this.targetCy -= 0.001;
    this.alpha += (this.targetAlpha - this.alpha)*0.025;
    this.clarity += (this.targetClarity - this.clarity)*0.03;
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
    this.cx=0.5; this.cy=0.5;
    this.x=innerWidth*0.5; this.y=innerHeight*0.5;
    this.ph=Math.random()*Math.PI*2;
    this.phV=0.004+Math.random()*0.003;
    this.driftR=55+Math.random()*35;
    this.r=5; this.alpha=0; this.targetAlpha=0.9;
    this.scattering=false; this.scatterParts=[];
  }
  update() {
    this.ph+=this.phV;
    this.cx+=(0.5-this.cx)*0.001; this.cy+=(0.5-this.cy)*0.001;
    const ds=Math.min(innerWidth,innerHeight);
    this.x=this.cx*innerWidth+Math.cos(this.ph)*this.driftR*(ds/400);
    this.y=this.cy*innerHeight+Math.sin(this.ph*0.67)*this.driftR*0.7*(ds/400);
    this.alpha+=(this.targetAlpha-this.alpha)*0.02;
  }
  draw() {
    if (this.alpha<0.01) return;
    const blur=(1-clarityLevel)*12, r=this.r+clarityLevel*2;
    const glow=18+clarityLevel*40, ga=0.15+clarityLevel*0.35;
    cx.save();
    if (blur>0.5) cx.filter=`blur(${blur.toFixed(1)}px)`;
    const grad=cx.createRadialGradient(this.x,this.y,0,this.x,this.y,glow);
    grad.addColorStop(0,`rgba(240,204,136,${(ga*this.alpha).toFixed(3)})`);
    grad.addColorStop(1,'rgba(240,204,136,0)');
    cx.fillStyle=grad; cx.beginPath(); cx.arc(this.x,this.y,glow,0,Math.PI*2); cx.fill();
    cx.filter='none'; cx.globalAlpha=this.alpha;
    cx.fillStyle=`rgba(240,204,136,${0.7+clarityLevel*0.3})`;
    cx.beginPath(); cx.arc(this.x,this.y,r,0,Math.PI*2); cx.fill(); cx.restore();
  }
  scatter() {
    this.scattering=true; this.scatterParts=[];
    for (let i=0;i<12;i++) {
      const angle=(Math.PI*2/12)*i+Math.random()*0.4;
      const speed=1.5+Math.random()*2.5;
      this.scatterParts.push({x:this.x,y:this.y,
        vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
        alpha:0.7+Math.random()*0.3,r:1.5+Math.random()*2});
    }
    this.targetAlpha=0;
    setTimeout(()=>{
      this.scattering=false; this.scatterParts=[];
      this.cx=0.5; this.cy=0.5; this.ph=Math.random()*Math.PI*2;
      this.targetAlpha=0.9;
    },1200);
  }
  drawScatter() {
    this.scatterParts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vx*=0.94; p.vy*=0.94; p.alpha*=0.93;
      if (p.alpha<0.01) return;
      cx.globalAlpha=p.alpha; cx.fillStyle='rgba(240,204,136,0.8)';
      cx.beginPath(); cx.arc(p.x,p.y,p.r,0,Math.PI*2); cx.fill();
    });
    cx.globalAlpha=1;
  }
}

// ── RENDER LOOP ──
function loop() {
  cx.clearRect(0,0,cv.width,cv.height);
  bgPts.forEach(p=>{p.update();p.draw();});
  if (currentMode==='observe' && particleVisible && observeParticle) {
    observeParticle.update();
    if (observeParticle.scattering) observeParticle.drawScatter();
    else observeParticle.draw();
  }
  if ((currentMode==='collapse'||currentMode==='home') && spParticles.length) {
    spParticles.forEach(p=>{p.update();p.draw();});
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
  if (!audioCtx||droneNodes.length) return;
  [432,216,144,108].forEach((f,i)=>{
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.frequency.value=f;
    g.gain.setValueAtTime(0,audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.022-i*0.004,audioCtx.currentTime+3);
    o.connect(g); g.connect(audioCtx.destination); o.start();
    droneNodes.push({o,g});
  });
}
function fadeDrone(out=true,dur=2) {
  if (!audioCtx||!droneNodes.length) return;
  droneNodes.forEach(({g})=>{
    const now=audioCtx.currentTime, cur=g.gain.value;
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(cur,now);
    g.gain.linearRampToValueAtTime(out?0:0.022,now+dur);
  });
  if (out) setTimeout(()=>{droneNodes.forEach(({o})=>{try{o.stop();}catch(e){}});droneNodes=[];},(dur+0.2)*1000);
}
function tryDrone() {
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state==='suspended'){audioCtx.resume().then(playDrone);return;}
  playDrone();
}
function playCollapseSound() {
  if (!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type='sine'; o.frequency.setValueAtTime(220,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(880,audioCtx.currentTime+1);
  g.gain.setValueAtTime(0,audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.12,audioCtx.currentTime+0.2);
  g.gain.linearRampToValueAtTime(0,audioCtx.currentTime+1.6);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+2);
  const b=audioCtx.createOscillator(), bg=audioCtx.createGain();
  b.type='sine'; b.frequency.value=1320;
  bg.gain.setValueAtTime(0,audioCtx.currentTime+0.75);
  bg.gain.linearRampToValueAtTime(0.06,audioCtx.currentTime+0.85);
  bg.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+3.5);
  b.connect(bg); bg.connect(audioCtx.destination);
  b.start(audioCtx.currentTime+0.75); b.stop(audioCtx.currentTime+4);
}
function playExhaleCollapse() {
  if (!audioCtx) return;
  [528,1056,1584].forEach((f,i)=>{
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.frequency.value=f;
    const t0=audioCtx.currentTime+i*0.05;
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(0.055-i*0.015,t0+0.2);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+5.5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0+6);
  });
}
function playObsCoherenceTone() {
  if (!audioCtx) return;
  [660,1320].forEach((f,i)=>{
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type='sine'; o.frequency.value=f;
    const t0=audioCtx.currentTime+i*0.08;
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(0.06-i*0.02,t0+0.3);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+5);
    o.connect(g); g.connect(audioCtx.destination); o.start(t0); o.stop(t0+5.5);
  });
}
function playDecohereRelease() {
  if (!audioCtx) return;
  // Descending tone — release, letting go
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type='sine';
  o.frequency.setValueAtTime(396,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(180,audioCtx.currentTime+3);
  g.gain.setValueAtTime(0,audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.07,audioCtx.currentTime+0.3);
  g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+4.5);
  o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+5);
}
function playScatterSound() {
  if (!audioCtx) return;
  const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.3,audioCtx.sampleRate);
  const d=buf.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const src=audioCtx.createBufferSource(), g=audioCtx.createGain();
  src.buffer=buf; g.gain.setValueAtTime(0.04,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3);
  src.connect(g); g.connect(audioCtx.destination); src.start();
}

// ── SCREEN TRANSITIONS ──
function showScreen(id, preCb) {
  const next = document.getElementById(id);
  document.querySelectorAll('.screen').forEach(s=>{
    if (s===next) return;
    s.style.transition='opacity .8s ease';
    s.style.opacity='0';
    setTimeout(()=>{s.classList.remove('active');s.style.opacity='';s.style.transition='';},800);
  });
  if (preCb) preCb();
  setTimeout(()=>{
    next.classList.add('active');
    next.style.opacity='0'; next.style.transition='none';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      next.style.transition='opacity .8s ease';
      next.style.opacity='1';
      setTimeout(()=>{next.style.transition='';next.style.opacity='';},850);
    }));
  },400);
}

// ── LANG ──
function toggleLang() {
  lang = lang==='en'?'es':'en';
  localStorage.setItem('field_lang',lang);
  document.getElementById('langBtn').textContent = lang==='en'?'EN / ES':'ES / EN';
  applyLang();
}
function applyLang() {
  const t=TRANSLATIONS[lang];
  document.getElementById('langBtn').textContent=lang==='en'?'EN / ES':'ES / EN';
  document.getElementById('homeFieldSub').textContent=t.fieldSub;
  document.getElementById('mvObserveLabel').textContent=t.observeLabel;
  document.getElementById('mvCollapseLabel').textContent=t.collapseLabel;
  document.getElementById('mvDecohereLabel').textContent=t.decohere_label;
  document.getElementById('mvObserveHint').textContent=t.observeHint;
  document.getElementById('mvCollapseHint').textContent=t.collapseHint;
  document.getElementById('mvDecohereHint').textContent=t.decohereHint;
  document.getElementById('retBtn').textContent=t.retBtn;
  document.getElementById('stillBack').textContent=t.stillTxt.split('\n')[1]||t.retBtn;
  document.getElementById('revisitBtn').textContent=t.readyBtn||'revisit introduction';
  document.getElementById('decArrivalLine').textContent=t.decArrivalLine;
  document.getElementById('decArrivalSub').textContent=t.decArrivalSub;
  document.getElementById('decRetBtn').textContent=t.decRetBtn;
  document.getElementById('decAgainBtn').textContent=t.decAgainBtn;
  document.getElementById('obsCohWord').textContent=t.obsCoherenceWord;
  document.getElementById('obsCohLine').innerHTML=t.obsCoherenceLine.replace(/\n/g,'<br>');
  document.getElementById('obsCohTap').textContent=t.obsCoherenceTap;
  document.getElementById('obsTrainHint').innerHTML=t.obsTrainHint.replace(/\n/g,'<br>');
  updateHomeCount();
}

function updateHomeCount() {
  const n=parseInt(localStorage.getItem('field_obs')||'0');
  const t=TRANSLATIONS[lang];
  const el=document.getElementById('homeCount');
  if (el) el.textContent=n>0?t.obsCount(n):'';
}

// ── HOME ──
function goHome() {
  currentMode='home';
  clearAllBreath(); clearObserver(); clearAllDec();
  fadeDrone(true,1.5);
  particlesHidden=false; collapseStage=0; breathRunning=false;
  document.querySelectorAll('.cp-stage').forEach(s=>{s.classList.remove('on');s.style.cssText='';});
  document.getElementById('backBtn').style.opacity='0';
  document.getElementById('backBtn').style.pointerEvents='none';
  document.querySelectorAll('.al').forEach(a=>a.classList.remove('on'));
  spParticles=[]; particleVisible=false;
  showScreen('s-home',()=>{
    setTimeout(()=>{ initSpParticles(12); tryDrone(); },200);
  });
  updateHomeCount();
}

function initSpParticles(n) {
  spParticles=Array.from({length:n},(_,i)=>new SpParticle(i,n));
  spParticles.forEach(p=>{p.targetAlpha=0.4+Math.random()*0.3;p.targetClarity=0;});
}

// Show back button when in a movement
function showBackBtn() {
  document.getElementById('backBtn').style.opacity='1';
  document.getElementById('backBtn').style.pointerEvents='all';
}

// ══════════════════════════════════════
// OBSERVE MOVEMENT
// ══════════════════════════════════════
function buildObsMeter() {
  const m=document.getElementById('meter'); m.innerHTML='';
  for (let i=0;i<METER_DOTS;i++){
    const d=document.createElement('div'); d.className='mdot'; d.id='mdot'+i; m.appendChild(d);
  }
}
function updateObsMeter() {
  const lit=Math.floor((attentionSec/COHERENCE_SEC)*METER_DOTS);
  for (let i=0;i<METER_DOTS;i++){
    const d=document.getElementById('mdot'+i); if(d) d.classList.toggle('lit',i<lit);
  }
  clarityLevel=Math.min(attentionSec/COHERENCE_SEC,1);
  updateClarityRing();
}
function updateClarityRing() {
  const ring=document.getElementById('clarity-ring'), c=clarityLevel;
  if (c<0.05){ring.style.borderColor='rgba(201,169,110,0)';ring.style.boxShadow='none';return;}
  const s=100+c*30, m=-(50+c*15);
  ring.style.width=s+'px'; ring.style.height=s+'px';
  ring.style.marginLeft=m+'px'; ring.style.marginTop=m+'px';
  ring.style.borderColor=`rgba(201,169,110,${(c*0.3).toFixed(3)})`;
  ring.style.boxShadow=`0 0 ${20+c*40}px rgba(201,169,110,${(c*0.15).toFixed(3)})`;
}
function startObserve() {
  currentMode='observe'; showBackBtn(); initAudio();
  if (audioCtx.state==='suspended') audioCtx.resume();
  fadeDrone(true,1); spParticles=[];
  // Subtle observe drone — lower than collapse
  setTimeout(()=>{
    if (!droneNodes.length && currentMode==='observe') {
      [40,80,120].forEach((f,i)=>{
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.type='sine';o.frequency.value=f;
        g.gain.setValueAtTime(0,audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0.015-i*0.004,audioCtx.currentTime+3);
        o.connect(g);g.connect(audioCtx.destination);o.start();
        droneNodes.push({o,g});
      });
    }
  },1200);
  isCoherent=false; fieldActive=false; attentionSec=0; clarityLevel=0;
  updateObsMeter(); updateClarityRing();
  document.getElementById('scatter-text').style.opacity='0';
  document.getElementById('meter').style.opacity='0';
  document.getElementById('obsTrainHint').style.opacity='0';
  observeParticle=new ObsParticle(); particleVisible=true;
  showScreen('s-observe');
  setTimeout(()=>{
    if (currentMode==='observe'){
      document.getElementById('obsTrainHint').textContent=TRANSLATIONS[lang].obsTrainHint.replace(/\n/g,' ');
      document.getElementById('obsTrainHint').style.opacity='1';
    }
  },3500);
  setTimeout(()=>{if(fieldActive)document.getElementById('meter').style.opacity='1';},4000);
  setTimeout(()=>{fieldActive=true;startAttentionTimer();},1000);
  // Scatter on tap
  document.getElementById('s-observe').onclick=e=>{
    if(e.target.closest('#chrome'))return; obsScatter();
  };
  document.getElementById('s-observe').ontouchend=e=>{
    if(e.target.closest('#chrome'))return; e.preventDefault(); obsScatter();
  };
}
function startAttentionTimer() {
  clearInterval(attentionTimer);
  attentionTimer=setInterval(()=>{
    if(!fieldActive||isCoherent) return;
    attentionSec++; updateObsMeter();
    if (attentionSec>=COHERENCE_SEC) reachObsCoherence();
  },1000);
}
function obsScatter() {
  if (isCoherent||!fieldActive) return;
  if (observeParticle) observeParticle.scatter();
  playScatterSound(); attentionSec=0; updateObsMeter(); clarityLevel=0;
  const st=document.getElementById('scatter-text');
  st.textContent=TRANSLATIONS[lang].obsScatter; st.style.opacity='1';
  clearTimeout(scatterTO); scatterTO=setTimeout(()=>{st.style.opacity='0';},2500);
  document.getElementById('obsTrainHint').style.opacity='0';
}
function reachObsCoherence() {
  isCoherent=true; clearInterval(attentionTimer);
  clarityLevel=1; updateClarityRing(); playObsCoherenceTone(); fadeDrone(true,3);
  document.getElementById('meter').style.opacity='0';
  document.getElementById('scatter-text').style.opacity='0';
  document.getElementById('obsTrainHint').style.opacity='0';
  // Count observation
  const n=parseInt(localStorage.getItem('field_obs')||'0')+1;
  localStorage.setItem('field_obs',n); totalObs=n;
  setTimeout(()=>{
    particleVisible=false;
    showScreen('s-obs-coherence');
  },2000);
}
function clearObserver() {
  clearInterval(attentionTimer); fieldActive=false; isCoherent=false;
  particleVisible=false; attentionSec=0; clarityLevel=0;
  clearTimeout(scatterTO);
  const ring=document.getElementById('clarity-ring');
  ring.style.cssText='';
  document.getElementById('meter').style.opacity='0';
  document.getElementById('scatter-text').style.opacity='0';
  document.getElementById('obsTrainHint').style.opacity='0';
}

// Device motion scatter
if (window.DeviceMotionEvent) {
  let lastMotion=0;
  window.addEventListener('devicemotion',e=>{
    if(currentMode!=='observe'||!fieldActive||isCoherent) return;
    const a=e.acceleration; if(!a) return;
    const mag=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);
    const now=Date.now();
    if(mag>4&&now-lastMotion>1500){lastMotion=now;obsScatter();}
  });
}

// ══════════════════════════════════════
// COLLAPSE MOVEMENT
// ══════════════════════════════════════
let stepIndex=0;
function startCollapse() {
  currentMode='collapse'; showBackBtn();
  spParticles=[]; fadeDrone(true,1);
  const visited=localStorage.getItem('field_visited');
  if (visited) {
    // Skip intro for return visitors
    setTimeout(()=>{tryDrone();buildCollapseField();showScreen('s-field');},200);
  } else {
    localStorage.setItem('field_visited','1');
    buildInit(); showScreen('s-init');
  }
}
function revisitIntro() { buildInit(); showScreen('s-init'); }

// Intro steps
function buildInit() {
  const t=TRANSLATIONS[lang]; stepIndex=0;
  const cont=document.getElementById('s-init'); cont.innerHTML='';
  const steps=STEPS[lang];
  const dotsCont=document.createElement('div'); dotsCont.className='sdots';
  steps.forEach((_,i)=>{
    const d=document.createElement('div'); d.className='sdot'; d.id='sdot'+i; dotsCont.appendChild(d);
  });
  cont.appendChild(dotsCont);
  steps.forEach((s,i)=>{
    const div=document.createElement('div'); div.className='step'+(i===0?' on':''); div.id='step'+i;
    const big=document.createElement('div'); big.className='s-main'; big.innerHTML=s.big.replace(/\n/g,'<br>'); div.appendChild(big);
    if(s.small){const sm=document.createElement('div');sm.className='s-sup';sm.innerHTML=s.small.replace(/\n/g,'<br>');div.appendChild(sm);}
    if(s.note){const nt=document.createElement('div');nt.className='sci-note';nt.innerHTML=s.note;div.appendChild(nt);}
    cont.appendChild(div);
  });
  const hint=document.createElement('div'); hint.id='taph'; hint.textContent=t.tapHint;
  hint.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);font-size:var(--fl);letter-spacing:.14em;color:rgba(201,169,110,.38);animation:pulse 2.8s ease-in-out infinite;pointer-events:none;z-index:20;white-space:nowrap;font-weight:300;';
  cont.appendChild(hint);
  updateInitScene();
}
function advanceStep() {
  if (isTransitioning) return;
  const steps=STEPS[lang];
  if (stepIndex<steps.length-1) {
    document.getElementById('step'+stepIndex).classList.remove('on');
    stepIndex++;
    document.getElementById('step'+stepIndex).classList.add('on');
    document.querySelectorAll('.sdot').forEach((d,i)=>d.classList.toggle('on',i<=stepIndex));
    updateInitScene();
  } else {
    tryDrone(); buildCollapseField(); showScreen('s-field');
  }
}
function updateInitScene() {
  const ps=STEPS[lang][stepIndex]?.ps; initScene(ps||'sp');
}

// Particle scenes for intro
function initScene(scene, chosen) {
  const n=12;
  if (!spParticles.length) spParticles=Array.from({length:n},(_,i)=>new SpParticle(i,n));
  switch(scene) {
    case 'sp':
      spParticles.forEach(p=>{p.targetAlpha=0.35+Math.random()*0.3;p.targetClarity=0;p._flickering=false;});
      break;
    case 'one':
      spParticles.forEach((p,i)=>{p.targetAlpha=i===0?0.9:0.05;p.targetClarity=i===0?1:0;p._flickering=false;});
      if(spParticles[0]){spParticles[0].targetCx=0.5;spParticles[0].targetCy=0.14;}
      break;
    case 'all_labelled':
      spParticles.forEach(p=>{p.targetAlpha=0.45;p.targetClarity=0.1;p._flickering=false;});
      break;
    case 'flicker':
      spParticles.forEach((p,i)=>{
        if(i===chosen||i===0){p._flickering=true;p.targetAlpha=0.8;}
        else{p.targetAlpha=0.05;p._flickering=false;}
      });
      break;
    case 'crystallise':
      spParticles.forEach((p,i)=>{
        p._flickering=false;
        if(i===chosen||i===0){p.targetAlpha=1;p.targetClarity=1;}
        else{p.targetAlpha=0.05;p.targetClarity=0;}
      });
      break;
    case 'collapse_demo':
      spParticles.forEach((p,i)=>{
        p._flickering=false;
        p.targetAlpha=i===0?1:0.05; p.targetClarity=i===0?1:0;
      });
      if(spParticles[0]){spParticles[0].targetCx=0.5;spParticles[0].targetCy=0.14;}
      break;
    case 'stab':
      spParticles.forEach(p=>{p.targetAlpha=0.6;p.targetClarity=0.7;p._flickering=false;});
      break;
    case 'done':
      spParticles.forEach(p=>{p.targetAlpha=0.55;p.targetClarity=0.5;p._flickering=false;});
      break;
    case 'field':
      spParticles.forEach(p=>{p.targetAlpha=0.35+Math.random()*0.25;p.targetClarity=0;p._flickering=false;});
      break;
    case 'state_chosen':
      spParticles.forEach((p,i)=>{
        p._flickering=false;
        if(i===chosen%spParticles.length){p.targetAlpha=1;p.targetClarity=1;}
        else{p.targetAlpha=0.04;p.targetClarity=0;}
      });
      break;
  }
}

// Field
function buildCollapseField() {
  const t=TRANSLATIONS[lang];
  document.getElementById('fline').textContent=t.fieldLine;
  document.getElementById('stillTxt').innerHTML=t.stillTxt.replace(/\n/g,'<br>');
  document.getElementById('stillBack').textContent=t.retBtn;
  document.getElementById('obsCt').textContent=totalObs>0?t.obsCount(totalObs):'';
  document.getElementById('revisitBtn').textContent='revisit introduction';
  const grid=document.getElementById('grid'); grid.innerHTML='';
  STATES[lang].forEach((st,idx)=>{
    const o=document.createElement('div'); o.className='orb';
    const driftDur=(2.8+Math.random()*2.4).toFixed(2)+'s';
    const orbpDelay=(-Math.random()*6).toFixed(2)+'s';
    o.style.cssText=`--drift-dur:${driftDur};animation-delay:${orbpDelay};`;
    const len=st.name.length;
    const size=len<=5?'var(--fwm)':len<=7?'clamp(22px,5.5vw,30px)':len<=8?'clamp(18px,4.6vw,25px)':'clamp(15px,3.8vw,20px)';
    o.innerHTML=`<div class="oname" style="font-size:${size}">${st.name}</div>`;
    const go=()=>{
      document.querySelectorAll('.orb').forEach(el=>{el.classList.remove('collapsing');el.classList.add('fading');});
      o.classList.remove('fading'); o.classList.add('collapsing');
      spChosen=idx; setTimeout(()=>selectState(st),320);
    };
    o.addEventListener('click',go);
    o.addEventListener('touchend',e=>{e.preventDefault();go();});
    grid.appendChild(o);
  });
  // Reset orbs
  document.querySelectorAll('.orb').forEach(el=>{
    el.classList.remove('collapsing','fading');
    el.style.filter=''; el.style.opacity=''; el.blur();
  });
  document.querySelectorAll('.al').forEach(a=>a.classList.add('on'));
  particlesHidden=false; initScene('field');
}

function selectState(state) {
  if (isTransitioning) return;
  if (navigator.vibrate) navigator.vibrate(38);
  initAudio(); if(audioCtx.state==='suspended') audioCtx.resume();
  playCollapseSound();
  const b=document.getElementById('burst');
  b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  const t=TRANSLATIONS[lang];
  curStateName=state.name;
  document.getElementById('cword').textContent=state.name;
  document.getElementById('cword5').textContent=state.name;
  const wl=state.name.length;
  const fs=wl<=5?'clamp(40px,12vw,72px)':wl<=7?'clamp(34px,10vw,60px)':wl<=9?'clamp(26px,8vw,46px)':wl<=11?'clamp(20px,6vw,34px)':'clamp(16px,5vw,26px)';
  ['cword','cword5'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.fontSize=fs;});
  document.getElementById('cLabel1').textContent=t.cLabel;
  document.getElementById('cSub1').textContent=t.cSub;
  document.getElementById('ceqNote').textContent=state.eq;
  document.getElementById('imagPrompt').textContent=getImagination(lang,state.name);
  document.getElementById('imagLabel3').textContent=t.imagLabel;
  const n=parseInt(localStorage.getItem('field_st_'+lang+'_'+state.name)||'0')+1;
  localStorage.setItem('field_st_'+lang+'_'+state.name,n);
  totalObs++; localStorage.setItem('field_obs',totalObs);
  document.getElementById('obsNote').innerHTML=n===1?t.obsFirst(state.name):t.obsMany(state.name,n);
  document.getElementById('obsNote5').innerHTML=n===1?t.obsFirst(state.name):t.obsMany(state.name,n);
  document.getElementById('closing').style.opacity='0'; document.getElementById('closing').textContent='';
  document.getElementById('qlabel6').textContent=t.qlabel;
  // Snap particle to crossfade position
  const chosen=spParticles[spChosen%Math.max(spParticles.length,1)];
  if(chosen){chosen.cx=0.5;chosen.cy=0.14;chosen.x=0.5*innerWidth;chosen.y=0.14*innerHeight;}
  initScene('state_chosen',spChosen);
  collapseStage=0;
  document.querySelectorAll('.cp-stage').forEach(s=>{s.classList.remove('on');s.style.cssText='';});
  clearAllBreath();
  document.getElementById('tapNext').textContent=t.tapHint;
  particlesHidden=false;
  fadeDrone(true,1.5);
  showScreen('s-collapse',()=>{
    document.getElementById('ghosts').style.opacity='1';
    buildGhosts(state.name);
    setTimeout(()=>showCollapseStage(1),200);
  });
}
function buildGhosts(chosen) {
  const gh=document.getElementById('ghosts'); gh.innerHTML='';
  STATES[lang].filter(s=>s.name!==chosen).forEach(s=>{
    const el=document.createElement('div'); el.className='gst'; el.textContent=s.name;
    el.style.left=Math.random()*85+'%'; el.style.top=Math.random()*85+'%';
    el.style.animationDelay=(Math.random()*4)+'s'; gh.appendChild(el);
  });
  gh.style.opacity='1';
}
function showCollapseStage(n) {
  const current=document.querySelector('.cp-stage.on');
  if (n===4) { particlesHidden=true; }
  else if (n===5) {
    const bp=document.getElementById('bp');
    const chosen=spParticles[spChosen%Math.max(spParticles.length,1)];
    if(chosen){chosen.cx=0.5;chosen.cy=0.5;chosen.targetCx=0.5;chosen.targetCy=0.14;
      chosen.x=0.5*innerWidth;chosen.y=0.5*innerHeight;
      chosen.targetAlpha=1;chosen.targetClarity=1;chosen._flickering=false;}
    particlesHidden=false; initScene('state_chosen',spChosen);
    bp.style.transition='opacity 1.2s ease'; bp.style.opacity='0';
    setTimeout(()=>{bp.className='bp neutral';bp.style.opacity='';bp.style.transition='';},1300);
  } else { particlesHidden=false; initScene('state_chosen',spChosen); }
  const reveal=()=>{
    collapseStage=n; const el=document.getElementById('cs'+n); if(!el) return;
    el.style.cssText='opacity:0;pointer-events:none;transition:none;visibility:hidden;';
    el.classList.add('on');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      el.style.visibility='visible'; el.style.transition='opacity 0.9s ease';
      el.style.opacity='1'; el.style.pointerEvents='all';
      setTimeout(()=>{el.style.cssText='';},950);
    }));
    const tapEl=document.getElementById('tapNext');
    tapEl.style.transition='opacity 0.7s ease';
    tapEl.style.opacity=n<6?'1':'0';
    if(n===4) startBreath();
  };
  if(current){
    current.style.transition='opacity 0.7s ease'; current.style.opacity='0'; current.style.pointerEvents='none';
    setTimeout(()=>{current.classList.remove('on');current.style.cssText='opacity:0;visibility:hidden;display:none;';reveal();},750);
  } else reveal();
}
document.getElementById('s-collapse').addEventListener('click',e=>{
  if(e.target.id==='retBtn'||e.target.classList.contains('return-btn')) return;
  if(e.target.closest('#chrome')) return;
  if(collapseStage===4&&breathRunning) return;
  if(collapseStage<6) showCollapseStage(collapseStage+1);
});
document.getElementById('retBtn').addEventListener('click',()=>{
  clearAllBreath(); particlesHidden=false; collapseStage=0;
  document.querySelectorAll('.cp-stage').forEach(s=>{s.classList.remove('on');s.style.cssText='';});
  document.getElementById('ghosts').style.opacity='0';
  setTimeout(()=>{document.getElementById('ghosts').innerHTML='';},900);
  showScreen('s-field',()=>{buildCollapseField();tryDrone();});
});

// Breath
function bDelay(fn,ms){const t=setTimeout(fn,ms);breathTimers.push(t);return t;}
function clearAllBreath(){breathTimers.forEach(clearTimeout);breathTimers=[];breathRunning=false;}
function startBreath() {
  clearAllBreath(); breathRunning=true; breathCycle=0;
  const stateName=curStateName, t=TRANSLATIONS[lang];
  const p=document.getElementById('bp'), ripple=document.getElementById('bripple');
  const btext=document.getElementById('btext');
  p.className='bp neutral'; btext.style.opacity='0'; btext.textContent=''; btext.className='btext';
  ripple.classList.remove('expand');
  [0,1,2].forEach(i=>{const d=document.getElementById('bdot'+i);if(d)d.classList.remove('done');});
  function showText(text,cls,delayMs){
    bDelay(()=>{
      btext.style.transition='opacity 0.5s ease';btext.style.opacity='0';
      bDelay(()=>{btext.className='btext'+(cls?' '+cls:'');btext.textContent=text;
        btext.style.transition='opacity 0.7s ease';btext.style.opacity='1';},520);
    },delayMs||0);
  }
  function hideText(delayMs){bDelay(()=>{btext.style.transition='opacity 0.6s ease';btext.style.opacity='0';},delayMs||0);}
  const p1=lang==='en'?'inhale — return to the open field':'inhala — regresa al campo abierto';
  const p2=lang==='en'?'exhale — collapse into '+stateName:'exhala — colapsa hacia '+stateName;
  showText(p1,'dim',0); showText(p2,'dim',5000); hideText(10500); bDelay(cycle,11500);
  function cycle(){
    if(breathCycle>=3){
      breathRunning=false;
      bDelay(()=>{
        btext.style.transition='opacity 0.8s ease';btext.style.opacity='0';
        p.className='bp crystallised';
        const tapEl=document.getElementById('tapNext');
        bDelay(()=>{tapEl.style.transition='opacity 0.8s ease';tapEl.style.opacity='1';},1800);
      },700);
      return;
    }
    breathCycle++;
    showText(t.breathInhale,'',0);
    bDelay(()=>{p.className='bp inhaling';ripple.classList.remove('expand');void ripple.offsetWidth;},100);
    showText(t.breathHold,'',4500);
    bDelay(()=>{p.className='bp holding';},4500);
    showText(stateName,'gold',7300);
    bDelay(()=>{p.className='bp exhaling';ripple.classList.remove('expand');void ripple.offsetWidth;ripple.classList.add('expand');playExhaleCollapse();},7300);
    hideText(11800);
    bDelay(()=>{const dot=document.getElementById('bdot'+(breathCycle-1));if(dot)dot.classList.add('done');p.className='bp neutral';},11800);
    bDelay(cycle,12800);
  }
}

function goStill() {
  const t=TRANSLATIONS[lang];
  document.getElementById('stillTxt').innerHTML=t.stillTxt.replace(/\n/g,'<br>');
  showScreen('s-still');
  let stillT=setInterval(()=>{},999999);
  document.getElementById('stillBack').onclick=()=>{clearInterval(stillT);goHome();};
}

// ══════════════════════════════════════
// DECOHERE MOVEMENT
// ══════════════════════════════════════
function startDecohere() {
  currentMode='decohere'; showBackBtn();
  fadeDrone(true,1); spParticles=[];
  buildShadowGrid();
  showScreen('s-decohere');
}
function buildShadowGrid() {
  const grid=document.getElementById('shadowGrid'); grid.innerHTML='';
  const en=SHADOW_STATES.en, es=SHADOW_STATES.es;
  en.forEach((name,i)=>{
    const o=document.createElement('div'); o.className='shadow-orb';
    o.textContent=lang==='en'?name:es[i];
    const go=()=>{ decStateName=name; decStateNameES=es[i]; startDecBreath(); };
    o.addEventListener('click',go);
    o.addEventListener('touchend',e=>{e.preventDefault();go();});
    grid.appendChild(o);
  });
}
function startDecBreath() {
  showScreen('s-dec-breath');
  const displayName=lang==='en'?decStateName:decStateNameES;
  const t=TRANSLATIONS[lang];
  const wordEl=document.getElementById('decWord');
  const btextEl=document.getElementById('decBtext');
  wordEl.textContent=displayName; wordEl.classList.remove('dissolving');
  wordEl.style.opacity='1'; wordEl.style.filter='';
  btextEl.style.opacity='1';
  // 3 breath cycles — acknowledge then release
  let cycle=0;
  function dDelay(fn,ms){const id=setTimeout(fn,ms);decBreathTimers.push(id);}
  function runCycle(){
    if(cycle>=3){
      // Full dissolve
      dDelay(()=>{
        wordEl.classList.add('dissolving');
        playDecohereRelease();
      },400);
      dDelay(()=>{
        wordEl.style.opacity='0';
        btextEl.style.opacity='0';
      },2000);
      dDelay(()=>showDecEnd(),4000);
      return;
    }
    cycle++;
    // Inhale — acknowledge
    btextEl.textContent=t.decBreatheLine(displayName);
    btextEl.style.opacity='1';
    // Partial dissolve builds each exhale
    dDelay(()=>{
      btextEl.textContent=t.decExhaleLine(displayName);
      wordEl.style.opacity=(1-(cycle*0.25)).toString();
      wordEl.style.filter=`blur(${cycle*2}px)`;
    },4500);
    dDelay(()=>{btextEl.style.opacity='0';},8500);
    dDelay(runCycle,10000);
  }
  dDelay(runCycle,1000);
}
function showDecEnd() {
  const t=TRANSLATIONS[lang];
  document.getElementById('decEndLine').textContent=t.decEndLine;
  document.getElementById('decEndSub').innerHTML=t.decEndSub.replace(/\n/g,'<br>');
  document.getElementById('decRetBtn').textContent=t.decRetBtn;
  document.getElementById('decAgainBtn').textContent=t.decAgainBtn;
  // Particle field slowly reforms
  spParticles=Array.from({length:8},(_,i)=>new SpParticle(i,8));
  spParticles.forEach(p=>{p.targetAlpha=0;});
  setTimeout(()=>{spParticles.forEach(p=>{p.targetAlpha=0.25+Math.random()*0.2;p.targetClarity=0;});},500);
  showScreen('s-dec-end');
}
function clearAllDec(){decBreathTimers.forEach(clearTimeout);decBreathTimers=[];}

// ── INIT ──
buildObsMeter();
applyLang();
initSpParticles(12);
tryDrone();

// Keyboard navigation
window.addEventListener('keydown',e=>{
  if(e.key===' '||e.key==='Enter'){
    const active=document.querySelector('.screen.active');
    if(active&&active.id==='s-init') advanceStep();
  }
});
