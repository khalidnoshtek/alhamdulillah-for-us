/* ────────────────────────────────────────────────────────────
   Loader
   ──────────────────────────────────────────────────────────── */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.body.classList.add('loaded');
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    }, 1100);
    document.getElementById('audio-toggle')?.style.setProperty('opacity', '1');
    setTimeout(() => {
      document.getElementById('voice-btn')?.classList.add('is-ready');
    }, 2200);
  }, 900);
});

/* ────────────────────────────────────────────────────────────
   Reveal on scroll (IntersectionObserver)
   ──────────────────────────────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal, .reveal-image');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = parseInt(entry.target.dataset.delay || '0', 10);
      setTimeout(() => entry.target.classList.add('is-visible'), delay);
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

revealEls.forEach(el => io.observe(el));

/* ────────────────────────────────────────────────────────────
   Subtle parallax (desktop only — keeps S23 scroll buttery)
   ──────────────────────────────────────────────────────────── */
const parallaxEls = document.querySelectorAll('.parallax-image');
let ticking = false;
function applyParallax() {
  const vh = window.innerHeight;
  parallaxEls.forEach(el => {
    const rect = el.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const offset = (center - vh / 2) / vh;
    const translate = Math.max(-30, Math.min(30, offset * -16));
    el.style.transform = `translateY(${translate}px)`;
  });
  ticking = false;
}
if (window.matchMedia('(min-width: 768px)').matches) {
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(applyParallax);
      ticking = true;
    }
  }, { passive: true });
}

/* ────────────────────────────────────────────────────────────
   Procedural ambient — calm solo piano (Web Audio API)

   Sparse, slow, never-repeating pattern in an Fmaj7add9 palette.
   Each note layers: sine fundamental + soft octave + faint fifth
   overtone, routed through a synthesized hall reverb. Lightweight
   on CPU, designed for mobile playback.
   ──────────────────────────────────────────────────────────── */
class Ambient {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bus = null;
    this.timer = null;
    this.playing = false;
    // Fmaj7add9 — warm, hopeful, emotionally grounded
    this.scale = [
      174.61, // F3
      220.00, // A3
      261.63, // C4
      329.63, // E4
      349.23, // F4
      392.00, // G4
      440.00, // A4
      523.25  // C5
    ];
    this.weights = [3, 2, 3, 2, 1, 2, 1, 1];
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    // Synthesized hall reverb
    const reverb = this.ctx.createConvolver();
    reverb.buffer = this.makeIR(3.6, 2.2);
    const dry = this.ctx.createGain(); dry.gain.value = 0.55;
    const wet = this.ctx.createGain(); wet.gain.value = 0.7;

    dry.connect(this.master);
    wet.connect(reverb);
    reverb.connect(this.master);

    // Soft low-pass — removes any harshness, gives "warm room" feel
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    lp.Q.value = 0.4;
    lp.connect(dry);
    lp.connect(wet);

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

    // Fundamental — sine
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    const g1 = ctx.createGain(); g1.gain.value = 1;
    o1.connect(g1); g1.connect(env);

    // Octave — triangle, faint detune for warmth
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2;
    o2.detune.value = 4;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    o2.connect(g2); g2.connect(env);

    // Fifth overtone — adds piano-like attack clarity
    const o3 = ctx.createOscillator();
    o3.type = 'sine';
    o3.frequency.value = freq * 3;
    const g3 = ctx.createGain(); g3.gain.value = 0.04;
    const e3 = ctx.createGain();
    e3.gain.setValueAtTime(0, time);
    e3.gain.linearRampToValueAtTime(0.35, time + 0.02);
    e3.gain.exponentialRampToValueAtTime(0.0001, time + 1.0);
    o3.connect(g3); g3.connect(e3); e3.connect(env);

    // Subtle stereo placement
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
      // Sparse chord — 2 or 3 notes within 80ms
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
      // First note arrives soon so user knows toggle worked
      this.playNote(now + 0.4, this.pickNote());
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

/* ────────────────────────────────────────────────────────────
   Audio toggle — off by default (no autoplay, ever)
   ──────────────────────────────────────────────────────────── */
const audioBtn = document.getElementById('audio-toggle');
const iconMuted = document.getElementById('icon-muted');
const iconPlaying = document.getElementById('icon-playing');

audioBtn?.addEventListener('click', () => {
  if (!ambient.playing) {
    ambient.start();
    iconMuted?.classList.add('hidden');
    iconPlaying?.classList.remove('hidden');
  } else {
    ambient.stop();
    iconMuted?.classList.remove('hidden');
    iconPlaying?.classList.add('hidden');
  }
});

/* ────────────────────────────────────────────────────────────
   Voice note modal
   ──────────────────────────────────────────────────────────── */
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
  if (ambient.playing) {
    ambientWasPlayingBeforeModal = true;
    ambient.stop();
    iconMuted?.classList.remove('hidden');
    iconPlaying?.classList.add('hidden');
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
    iconMuted?.classList.add('hidden');
    iconPlaying?.classList.remove('hidden');
  }
}

voiceBtn?.addEventListener('click', openModal);
voiceClose?.addEventListener('click', closeModal);
voiceModal?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && voiceModal?.classList.contains('is-open')) closeModal();
});

voicePlay?.addEventListener('click', () => {
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
  const rect = progressBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  voiceAudio.currentTime = pct * voiceAudio.duration;
});

/* ────────────────────────────────────────────────────────────
   Particle field — warm, slow drifting
   ──────────────────────────────────────────────────────────── */
(function particles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w, h;
  const parts = [];

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const COUNT = isMobile ? 26 : 48;

  function resize() {
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < COUNT; i++) {
    parts.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 1.6 + 0.4) * dpr,
      vx: (Math.random() - 0.5) * 0.12 * dpr,
      vy: (Math.random() * -0.08 - 0.02) * dpr,
      a: Math.random() * 0.4 + 0.15,
      tw: Math.random() * Math.PI * 2
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    parts.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.tw += 0.012;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      const alpha = p.a * (0.6 + Math.sin(p.tw) * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 169, 97, ${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
})();
