/* ════════════════════════════════════════════════════════════
   Procedural ambient — calm solo piano (Web Audio API)
   ════════════════════════════════════════════════════════════ */
class Ambient {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.timer = null;
    this.playing = false;
    // Fmaj7add9 — warm, hopeful, emotionally grounded
    this.scale = [174.61, 220.00, 261.63, 329.63, 349.23, 392.00, 440.00, 523.25];
    this.weights = [3, 2, 3, 2, 1, 2, 1, 1];
  }
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    const reverb = this.ctx.createConvolver();
    reverb.buffer = this.makeIR(3.6, 2.2);
    const dry = this.ctx.createGain(); dry.gain.value = 0.55;
    const wet = this.ctx.createGain(); wet.gain.value = 0.7;
    dry.connect(this.master);
    wet.connect(reverb);
    reverb.connect(this.master);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    lp.Q.value = 0.4;
    lp.connect(dry); lp.connect(wet);
    this.bus = lp;
  }
  makeIR(seconds, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const ir = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return ir;
  }
  pickNote() {
    const total = this.weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < this.scale.length; i++) {
      r -= this.weights[i];
      if (r <= 0) return this.scale[i];
    }
    return this.scale[0];
  }
  playNote(time, freq) {
    const ctx = this.ctx;
    const dur = 5.5 + Math.random() * 3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.42, time + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    const o1 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = freq;
    const g1 = ctx.createGain(); g1.gain.value = 1;
    o1.connect(g1); g1.connect(env);

    const o2 = ctx.createOscillator();
    o2.type = 'triangle'; o2.frequency.value = freq * 2; o2.detune.value = 4;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    o2.connect(g2); g2.connect(env);

    const o3 = ctx.createOscillator();
    o3.type = 'sine'; o3.frequency.value = freq * 3;
    const g3 = ctx.createGain(); g3.gain.value = 0.04;
    const e3 = ctx.createGain();
    e3.gain.setValueAtTime(0, time);
    e3.gain.linearRampToValueAtTime(0.35, time + 0.02);
    e3.gain.exponentialRampToValueAtTime(0.0001, time + 1.0);
    o3.connect(g3); g3.connect(e3); e3.connect(env);

    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 0.45;
      env.connect(pan); pan.connect(this.bus);
    } else {
      env.connect(this.bus);
    }
    o1.start(time); o2.start(time); o3.start(time);
    o1.stop(time + dur); o2.stop(time + dur); o3.stop(time + 1.2);
  }
  scheduleLoop() {
    if (!this.playing || !this.ctx) return;
    const now = this.ctx.currentTime;
    const gap = 1.7 + Math.random() * 2.6;
    const next = now + gap;
    if (Math.random() < 0.16) {
      this.playNote(next, this.pickNote());
      this.playNote(next + 0.04, this.pickNote());
      if (Math.random() < 0.35) this.playNote(next + 0.09, this.pickNote());
    } else {
      this.playNote(next, this.pickNote());
    }
    this.timer = setTimeout(() => this.scheduleLoop(), gap * 1000);
  }
  async start() {
    this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.28, now + 4);
    if (!this.playing) {
      this.playing = true;
      this.playNote(now + 0.5, this.pickNote());
      this.timer = setTimeout(() => this.scheduleLoop(), 1800);
    }
  }
  stop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 2.5);
    this.playing = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}

const ambient = new Ambient();

/* ════════════════════════════════════════════════════════════
   Sky — fireflies + distant stars + occasional shooting star
   ════════════════════════════════════════════════════════════ */
(function sky() {
  const canvas = document.getElementById('sky');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w, h;

  function resize() {
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const FIREFLY_COUNT = isMobile ? 22 : 38;
  const STAR_COUNT    = isMobile ? 60 : 110;

  // Pre-render halo sprite for performance — drawImage is much faster
  // than recreating a radialGradient per particle per frame on mobile.
  function makeHaloSprite(rgb, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const cx = c.getContext('2d');
    const grad = cx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0,    `rgba(${rgb}, 0.55)`);
    grad.addColorStop(0.25, `rgba(${rgb}, 0.22)`);
    grad.addColorStop(0.55, `rgba(${rgb}, 0.06)`);
    grad.addColorStop(1,    `rgba(${rgb}, 0)`);
    cx.fillStyle = grad;
    cx.fillRect(0, 0, size, size);
    return c;
  }
  const haloGold = makeHaloSprite('255, 215, 130', 96 * dpr);
  const haloCream = makeHaloSprite('232, 220, 196', 96 * dpr);

  // Fireflies — warm glowing drifters with bobbing motion
  const flies = [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    flies.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12 * dpr,
      vy: (Math.random() - 0.5) * 0.04 * dpr,
      r: (Math.random() * 1.4 + 0.5) * dpr,
      haloSize: (40 + Math.random() * 50) * dpr,
      bob: Math.random() * Math.PI * 2,
      bobSpeed: 0.004 + Math.random() * 0.008,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 0.010 + Math.random() * 0.018,
      base: 0.45 + Math.random() * 0.45,
      gold: Math.random() < 0.7
    });
  }

  // Distant stars — small, static, slow twinkle
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.85,
      r: (Math.random() * 0.7 + 0.3) * dpr,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 0.005 + Math.random() * 0.012,
      base: 0.2 + Math.random() * 0.35
    });
  }

  // Shooting star — occasional
  let shootingStar = null;
  let shootingTimer = 8000 + Math.random() * 12000;

  function spawnShooting() {
    const startX = Math.random() * w * 0.6;
    const startY = Math.random() * h * 0.4;
    const angle = Math.PI * 0.18 + Math.random() * 0.12;
    const speed = (8 + Math.random() * 6) * dpr;
    shootingStar = {
      x: startX, y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.012,
      trail: []
    };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last);
    last = now;

    ctx.clearRect(0, 0, w, h);

    // Stars (drawn first, behind fireflies)
    ctx.save();
    for (const s of stars) {
      s.tw += s.twSpeed;
      const a = s.base * (0.5 + Math.sin(s.tw) * 0.5);
      ctx.fillStyle = `rgba(232, 220, 196, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Shooting star
    shootingTimer -= dt;
    if (shootingTimer <= 0 && !shootingStar) {
      spawnShooting();
      shootingTimer = 9000 + Math.random() * 16000;
    }
    if (shootingStar) {
      const ss = shootingStar;
      ss.x += ss.vx; ss.y += ss.vy;
      ss.life -= ss.decay;
      ss.trail.unshift({ x: ss.x, y: ss.y });
      if (ss.trail.length > 18) ss.trail.pop();

      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < ss.trail.length - 1; i++) {
        const p1 = ss.trail[i], p2 = ss.trail[i + 1];
        const a = (1 - i / ss.trail.length) * ss.life * 0.9;
        ctx.strokeStyle = `rgba(232, 220, 196, ${a})`;
        ctx.lineWidth = (1.4 - i * 0.07) * dpr;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      // Bright head
      ctx.fillStyle = `rgba(255, 245, 220, ${ss.life})`;
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, 1.6 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (ss.life <= 0 || ss.x > w + 60 || ss.y > h + 60) {
        shootingStar = null;
      }
    }

    // Fireflies — additive blend for natural glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flies) {
      f.x += f.vx;
      f.y += f.vy + Math.sin(f.bob) * 0.18 * dpr;
      f.bob += f.bobSpeed;
      f.tw += f.twSpeed;

      if (f.x < -120) f.x = w + 120;
      if (f.x > w + 120) f.x = -120;
      if (f.y < -120) f.y = h + 120;
      if (f.y > h + 120) f.y = -120;

      const a = f.base * (0.35 + Math.sin(f.tw) * 0.65);
      const halo = f.gold ? haloGold : haloCream;
      ctx.globalAlpha = a;
      ctx.drawImage(halo, f.x - f.haloSize/2, f.y - f.haloSize/2, f.haloSize, f.haloSize);

      // Bright core
      ctx.globalAlpha = a * 1.2;
      ctx.fillStyle = f.gold ? `rgba(255, 240, 190, ${a})` : `rgba(255, 250, 230, ${a})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ════════════════════════════════════════════════════════════
   Slide controller — auto-advance + cross-fade + tap-to-skip
   ════════════════════════════════════════════════════════════ */
class SlideShow {
  constructor() {
    this.slides = Array.from(document.querySelectorAll('.slide'));
    this.current = -1;
    this.advanceTimer = null;
    this.revealTimers = [];
    this.paused = false;
    this.activatedAt = 0;
    this.remainingOnPause = 0;

    // Hydrate slide-bg elements with their image url
    this.slides.forEach(slide => {
      const bg = slide.querySelector('.slide-bg');
      if (bg) {
        const url = bg.dataset.image;
        const blur = bg.dataset.blur || '0';
        if (url) bg.style.backgroundImage = `url('${url}')`;
        if (blur && parseFloat(blur) > 0) bg.style.filter = `blur(${blur}px)`;
      }
    });
  }

  start() {
    this.go(0);
    this.showProgress();
  }

  go(index) {
    if (index < 0 || index >= this.slides.length) return;

    // Clear existing timers
    if (this.advanceTimer) { clearTimeout(this.advanceTimer); this.advanceTimer = null; }
    this.revealTimers.forEach(t => clearTimeout(t));
    this.revealTimers = [];

    // Fade out current slide
    if (this.current >= 0) {
      const prev = this.slides[this.current];
      prev.classList.remove('active');
      const prevReveals = prev.querySelectorAll('.reveal-text');
      // Reset reveals AFTER fade-out completes so they're not visible mid-transition
      setTimeout(() => prevReveals.forEach(el => el.classList.remove('is-visible')), 1700);
    }

    this.current = index;
    const slide = this.slides[index];
    slide.classList.add('active');

    // Schedule internal text reveals
    const reveals = slide.querySelectorAll('.reveal-text');
    reveals.forEach(el => {
      const at = parseInt(el.dataset.revealAt || '0', 10);
      this.revealTimers.push(setTimeout(() => el.classList.add('is-visible'), at));
    });

    // Schedule next slide
    this.activatedAt = performance.now();
    const dur = parseInt(slide.dataset.duration || '0', 10);
    if (dur > 0 && index < this.slides.length - 1) {
      this.advanceTimer = setTimeout(() => this.next(), dur);
    }

    this.updateProgress();
  }

  next() { if (this.current < this.slides.length - 1) this.go(this.current + 1); }
  prev() { if (this.current > 0) this.go(this.current - 1); }

  pause() {
    if (this.paused) return;
    this.paused = true;
    if (this.advanceTimer) {
      const slide = this.slides[this.current];
      const dur = parseInt(slide.dataset.duration || '0', 10);
      const elapsed = performance.now() - this.activatedAt;
      this.remainingOnPause = Math.max(0, dur - elapsed);
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.remainingOnPause > 0 && this.current < this.slides.length - 1) {
      this.activatedAt = performance.now() - (parseInt(this.slides[this.current].dataset.duration || '0', 10) - this.remainingOnPause);
      this.advanceTimer = setTimeout(() => this.next(), this.remainingOnPause);
      this.remainingOnPause = 0;
    }
  }

  showProgress() {
    document.getElementById('progress')?.classList.add('is-active');
  }

  updateProgress() {
    const fill = document.getElementById('progress-fill');
    if (!fill) return;
    const pct = ((this.current + 1) / this.slides.length) * 100;
    fill.style.width = pct + '%';
  }
}

const show = new SlideShow();

/* ════════════════════════════════════════════════════════════
   Entry gate — first user interaction, starts everything
   ════════════════════════════════════════════════════════════ */
const entryGate = document.getElementById('entry-gate');
const entryStart = document.getElementById('entry-start');
const entrySilent = document.getElementById('entry-silent');

function beginExperience({ withSound }) {
  entryGate.classList.add('is-leaving');
  setTimeout(() => entryGate.style.display = 'none', 1500);

  // Reveal floating UI
  setTimeout(() => {
    document.getElementById('audio-toggle')?.style.setProperty('opacity', '1');
    document.getElementById('voice-btn')?.classList.add('is-ready');
  }, 800);

  // Tap hint after a moment so users know they can advance
  setTimeout(() => document.getElementById('tap-hint')?.classList.add('is-visible'), 6000);

  // Start music (off by default for the silent path)
  if (withSound) {
    ambient.start();
    setIcons(true);
  } else {
    setIcons(false);
  }

  show.start();
}

entryStart?.addEventListener('click', () => beginExperience({ withSound: true }));
entrySilent?.addEventListener('click', () => beginExperience({ withSound: false }));

/* ════════════════════════════════════════════════════════════
   Audio toggle (mute / unmute mid-experience)
   ════════════════════════════════════════════════════════════ */
const audioBtn = document.getElementById('audio-toggle');
const iconMuted = document.getElementById('icon-muted');
const iconPlaying = document.getElementById('icon-playing');

function setIcons(playing) {
  if (playing) { iconMuted?.classList.add('hidden'); iconPlaying?.classList.remove('hidden'); }
  else         { iconMuted?.classList.remove('hidden'); iconPlaying?.classList.add('hidden'); }
}

audioBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!ambient.playing) { ambient.start(); setIcons(true); }
  else                  { ambient.stop();  setIcons(false); }
});

/* ════════════════════════════════════════════════════════════
   Tap-to-advance — anywhere except buttons/modal
   ════════════════════════════════════════════════════════════ */
const tapZone = document.getElementById('tap-zone');
tapZone?.addEventListener('click', () => {
  if (entryGate && !entryGate.classList.contains('is-leaving')) return;
  if (document.getElementById('voice-modal')?.classList.contains('is-open')) return;
  show.next();
  // Hide tap hint once user has tapped
  document.getElementById('tap-hint')?.classList.remove('is-visible');
});

// Keyboard: arrow keys for desktop control
document.addEventListener('keydown', (e) => {
  if (entryGate && !entryGate.classList.contains('is-leaving')) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show.next(); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); show.prev(); }
});

/* ════════════════════════════════════════════════════════════
   Voice note modal
   ════════════════════════════════════════════════════════════ */
const voiceBtn = document.getElementById('voice-btn');
const voiceModal = document.getElementById('voice-modal');
const voiceClose = document.getElementById('voice-close');
const voiceAudio = document.getElementById('voice-audio');
const voicePlay = document.getElementById('voice-play');
const playIcon = document.getElementById('voice-play-icon');
const pauseIcon = document.getElementById('voice-pause-icon');
const progressBar = document.getElementById('voice-progress');
const progressFill = document.getElementById('voice-progress-fill');
const currentEl = document.getElementById('voice-current');
const durationEl = document.getElementById('voice-duration');

let ambientWasPlayingBeforeModal = false;

function fmtTime(t) {
  if (!isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
function openModal() {
  voiceModal.classList.add('is-open');
  show.pause();
  if (ambient.playing) {
    ambientWasPlayingBeforeModal = true;
    ambient.stop();
    setIcons(false);
  }
}
function closeModal() {
  voiceModal.classList.remove('is-open');
  if (voiceAudio) {
    voiceAudio.pause();
    playIcon?.classList.remove('hidden');
    pauseIcon?.classList.add('hidden');
  }
  if (ambientWasPlayingBeforeModal) {
    ambientWasPlayingBeforeModal = false;
    ambient.start();
    setIcons(true);
  }
  show.resume();
}

voiceBtn?.addEventListener('click', (e) => { e.stopPropagation(); openModal(); });
voiceClose?.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
voiceModal?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && voiceModal?.classList.contains('is-open')) closeModal();
});

voicePlay?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (voiceAudio.paused) {
    voiceAudio.play();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    voiceAudio.pause();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
});
voiceAudio?.addEventListener('loadedmetadata', () => {
  durationEl.textContent = fmtTime(voiceAudio.duration);
});
voiceAudio?.addEventListener('timeupdate', () => {
  const pct = (voiceAudio.currentTime / voiceAudio.duration) * 100;
  progressFill.style.width = `${pct}%`;
  currentEl.textContent = fmtTime(voiceAudio.currentTime);
});
voiceAudio?.addEventListener('ended', () => {
  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');
  progressFill.style.width = '0%';
});
progressBar?.addEventListener('click', (e) => {
  if (!voiceAudio || !isFinite(voiceAudio.duration)) return;
  e.stopPropagation();
  const rect = progressBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  voiceAudio.currentTime = pct * voiceAudio.duration;
});
