// ── TourUI — Immersive Guided Tour with Voice, Ambient Music & Theme Switcher ─────────
const TourUI = {
  step: 0,
  _audioCtx: null,
  _ambientNodes: [],
  _speaking: false,
  _musicStarted: false,

  // ── Tour Step Definitions ────────────────────────────────────────────────────
  steps: [
    {
      icon: '🛡️',
      theme: 'cosmos',
      title: 'Welcome to Unbiased AI Auditor',
      body: 'This platform helps organizations detect and fix hidden bias in AI systems that make life-changing decisions — hiring, lending, healthcare, and more. Built for Google Solution Challenge 2026.',
      voice: 'Welcome to Unbiased AI Auditor. This platform helps organizations detect and eliminate hidden bias in AI systems that make life-changing decisions — from hiring to healthcare. Built for the Google Solution Challenge 2026.',
      action: null,
    },
    {
      icon: '📂',
      theme: 'ocean',
      title: 'Step 1 — Load a Dataset',
      body: 'Choose from 6 realistic demo domains — Hiring, Lending, Healthcare, Criminal Justice, Education, or Insurance. Or upload your own CSV and we will auto-detect every column.',
      voice: 'Step one: Load a dataset. Choose from six real-world domains, or upload your own CSV file. The system automatically detects columns and configures the analysis for you.',
      action: () => AppRouter.go('home'),
    },
    {
      icon: '⚖️',
      theme: 'forest',
      title: 'Step 2 — Measure Bias',
      body: 'Compute 11 industry-standard fairness metrics — Disparate Impact, Equal Opportunity, Equalized Odds, and more — each with a clear pass, warning, or critical verdict.',
      voice: 'Step two: Measure bias. The system computes eleven industry-standard fairness metrics, including Disparate Impact and Equal Opportunity, each with a clear regulatory verdict.',
      action: () => { AppState.loadDemo('hiring'); AppRouter.go('metrics'); },
    },
    {
      icon: '✨',
      theme: 'aurora',
      title: 'Step 3 — Ask the AI Assistant',
      body: 'Click "Explain with AI" on any metric for a plain-English breakdown. Use the chat widget to ask anything about your audit results — powered by an offline AI running entirely on-device.',
      voice: 'Step three: Ask the AI assistant. Click Explain with AI on any metric card for a plain-English explanation. Use the chat widget at the bottom right to ask any question. All AI runs completely offline.',
      action: () => AppRouter.go('metrics'),
    },
    {
      icon: '🧪',
      theme: 'sunset',
      title: 'Step 4 — Fix Bias in the Lab',
      body: 'Apply 6 debiasing strategies — reweighing, threshold tuning, adversarial debiasing, and more. Compare before and after fairness metrics side-by-side in real time.',
      voice: 'Step four: Fix bias in the Mitigation Lab. Apply six debiasing strategies and see before-and-after fairness metrics update in real time. The AI can also generate Python code for your team.',
      action: () => AppRouter.go('lab'),
    },
    {
      icon: '📄',
      theme: 'cosmos',
      title: 'Step 5 — Export an Audit Report',
      body: 'Generate a full compliance report with EEOC, EU AI Act, and ECOA regulatory checklists. Export as PDF, JSON, or CSV. The AI writes your executive summary automatically.',
      voice: 'Step five: Export a professional audit report. Generate a full compliance report with regulatory checklists for the EEOC, EU AI Act, and ECOA. Export as PDF, JSON, or CSV — and let the AI write your executive summary.',
      action: () => AppRouter.go('report'),
    },
  ],

  // ── Theme Palette ────────────────────────────────────────────────────────────
  themes: {
    cosmos: {
      bg: 'linear-gradient(135deg, #0d0621 0%, #1a0f3d 50%, #0a1628 100%)',
      orb1: '#6366f1', orb2: '#8b5cf6', orb3: '#06b6d4',
      accent: '#818cf8', label: '🌌 Cosmos',
    },
    ocean: {
      bg: 'linear-gradient(135deg, #0a1628 0%, #0c2340 50%, #0d3b6e 100%)',
      orb1: '#0ea5e9', orb2: '#06b6d4', orb3: '#3b82f6',
      accent: '#38bdf8', label: '🌊 Ocean',
    },
    forest: {
      bg: 'linear-gradient(135deg, #071a12 0%, #0f2d1e 50%, #0a1628 100%)',
      orb1: '#10b981', orb2: '#059669', orb3: '#6366f1',
      accent: '#34d399', label: '🌿 Forest',
    },
    aurora: {
      bg: 'linear-gradient(135deg, #150929 0%, #1e0a3c 50%, #0d1f3a 100%)',
      orb1: '#a855f7', orb2: '#ec4899', orb3: '#06b6d4',
      accent: '#d946ef', label: '🌈 Aurora',
    },
    sunset: {
      bg: 'linear-gradient(135deg, #1c0a00 0%, #2d1000 50%, #1a1428 100%)',
      orb1: '#f97316', orb2: '#ef4444', orb3: '#8b5cf6',
      accent: '#fb923c', label: '🌅 Sunset',
    },
  },

  // ── Start Tour ───────────────────────────────────────────────────────────────
  start() {
    this.step = 0;
    this._buildOverlay();
    this._render();
    this._startAmbientMusic();
    const overlay = document.getElementById('tour-overlay');
    if (overlay) overlay.style.display = 'flex';
    this._speak(this.steps[0].voice);
  },

  // ── Navigation ───────────────────────────────────────────────────────────────
  next() {
    const currentStep = this.steps[this.step];
    if (currentStep && currentStep.action) currentStep.action();
    this.step++;
    if (this.step >= this.steps.length) {
      this.end();
    } else {
      this._render();
      this._speak(this.steps[this.step].voice);
    }
  },

  prev() {
    if (this.step > 0) {
      this.step--;
      this._render();
      this._speak(this.steps[this.step].voice);
    }
  },

  end() {
    this._stopSpeech();
    this._stopAmbientMusic();
    const overlay = document.getElementById('tour-overlay');
    if (overlay) { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; overlay.style.opacity = ''; }, 400); }
    localStorage.setItem('tour-seen', '1');
  },

  toggleMusic() {
    if (this._musicStarted) {
      this._stopAmbientMusic();
    } else {
      this._startAmbientMusic();
    }
    const btn = document.getElementById('tour-music-btn');
    if (btn) btn.textContent = this._musicStarted ? '🔇' : '🎵';
  },

  toggleVoice() {
    if (this._speaking) {
      this._stopSpeech();
    } else {
      this._speak(this.steps[this.step].voice);
    }
  },

  setTheme(key) {
    this._applyTheme(key);
  },

  // ── Build Overlay DOM ─────────────────────────────────────────────────────────
  _buildOverlay() {
    const overlay = document.getElementById('tour-overlay');
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="tour-backdrop"></div>
      <div class="tour-scene" id="tour-scene">
        <canvas id="tour-particles-canvas"></canvas>
        <div class="tour-orbs">
          <div class="tour-orb tour-orb-1" id="torb1"></div>
          <div class="tour-orb tour-orb-2" id="torb2"></div>
          <div class="tour-orb tour-orb-3" id="torb3"></div>
        </div>
        <div class="tour-card" id="tour-card">
          <div class="tour-top-bar">
            <div class="tour-step-indicator" id="tour-step-indicator"></div>
            <div class="tour-controls">
              <button class="tour-ctrl-btn" id="tour-music-btn" onclick="TourUI.toggleMusic()" title="Toggle ambient music">🎵</button>
              <button class="tour-ctrl-btn" id="tour-voice-btn" onclick="TourUI.toggleVoice()" title="Toggle voice narration">🎙️</button>
            </div>
          </div>
          <div class="tour-theme-bar" id="tour-theme-bar">
            ${Object.entries(this.themes).map(([k, t]) =>
              `<button class="tour-theme-btn" data-theme="${k}" onclick="TourUI.setTheme('${k}')" title="${t.label}">${t.label.split(' ')[0]}</button>`
            ).join('')}
          </div>
          <div class="tour-visual" id="tour-visual">
            <div class="tour-icon-ring" id="tour-icon-ring">
              <span class="tour-icon" id="tour-icon"></span>
            </div>
            <div class="tour-voice-wave" id="tour-voice-wave">
              ${Array.from({length: 9}, (_,i) => `<span class="wave-bar" style="animation-delay:${i*0.08}s"></span>`).join('')}
            </div>
          </div>
          <h3 class="tour-title" id="tour-title"></h3>
          <p class="tour-body" id="tour-body"></p>
          <div class="tour-actions">
            <button class="tour-skip" onclick="TourUI.end()">Skip Tour</button>
            <div style="display:flex;gap:0.5rem;">
              <button class="btn-outline btn-sm" id="tour-prev" onclick="TourUI.prev()" style="display:none;">← Back</button>
              <button class="btn-primary btn-sm" id="tour-next" onclick="TourUI.next()">Next →</button>
            </div>
          </div>
        </div>
      </div>`;

    this._initParticles();
    this._applyTheme(this.steps[0].theme);
  },

  // ── Render Step ───────────────────────────────────────────────────────────────
  _render() {
    const s = this.steps[this.step];
    if (!s) return;

    const set = (id, prop, val) => { const el = document.getElementById(id); if (el) el[prop] = val; };
    set('tour-icon', 'textContent', s.icon);
    set('tour-title', 'textContent', s.title);
    set('tour-body', 'textContent', s.body);

    const indicatorEl = document.getElementById('tour-step-indicator');
    if (indicatorEl) {
      indicatorEl.innerHTML = this.steps.map((_, i) =>
        `<span class="tour-dot ${i === this.step ? 'active' : ''}" onclick="TourUI._jumpTo(${i})"></span>`
      ).join('');
    }

    const prevBtn = document.getElementById('tour-prev');
    const nextBtn = document.getElementById('tour-next');
    if (prevBtn) prevBtn.style.display = this.step > 0 ? 'inline-flex' : 'none';
    if (nextBtn) nextBtn.textContent = this.step === this.steps.length - 1 ? '🚀 Get Started' : 'Next →';

    // Highlight active theme button
    document.querySelectorAll('.tour-theme-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === s.theme);
    });

    // Apply step theme and animate
    this._applyTheme(s.theme);
    this._animateCard();
  },

  _jumpTo(i) {
    if (i < this.step) { this.step = i; this._render(); this._speak(this.steps[i].voice); }
    else if (i > this.step) { for (let j = this.step; j < i; j++) { if (this.steps[j].action) this.steps[j].action(); } this.step = i; this._render(); this._speak(this.steps[i].voice); }
  },

  _animateCard() {
    const card = document.getElementById('tour-card');
    const ring = document.getElementById('tour-icon-ring');
    if (card) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = 'tourSlideIn 0.45s cubic-bezier(0.34,1.56,0.64,1)'; }
    if (ring) { ring.style.animation = 'none'; void ring.offsetWidth; ring.style.animation = 'iconPop 0.5s cubic-bezier(0.34,1.56,0.64,1)'; }
  },

  // ── Theme Application ─────────────────────────────────────────────────────────
  _applyTheme(key) {
    const t = this.themes[key] || this.themes.cosmos;
    const scene = document.getElementById('tour-scene');
    const orb1 = document.getElementById('torb1');
    const orb2 = document.getElementById('torb2');
    const orb3 = document.getElementById('torb3');
    const card = document.getElementById('tour-card');

    if (scene) { scene.style.background = t.bg; scene.style.transition = 'background 1.2s ease'; }
    if (orb1) { orb1.style.background = t.orb1; orb1.style.boxShadow = `0 0 120px 40px ${t.orb1}55`; }
    if (orb2) { orb2.style.background = t.orb2; orb2.style.boxShadow = `0 0 100px 30px ${t.orb2}55`; }
    if (orb3) { orb3.style.background = t.orb3; orb3.style.boxShadow = `0 0 80px 20px ${t.orb3}55`; }
    if (card) { card.style.setProperty('--tour-accent', t.accent); }

    // Update ambient music tonality based on theme
    this._updateMusicTheme(key);
  },

  // ── Voice Narration (Web Speech API) ─────────────────────────────────────────
  _speak(text) {
    if (!('speechSynthesis' in window)) return;
    this._stopSpeech();
    this._speaking = true;
    this._setWaveActive(true);
    const btn = document.getElementById('tour-voice-btn');
    if (btn) btn.textContent = '🔊';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 1.1;
    utterance.volume = 0.9;

    // Pick a female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v =>
      /female|zira|samantha|victoria|karen|moira|fiona|tessa/i.test(v.name) ||
      (v.lang.startsWith('en') && /google.*us.*female|microsoft.*zira|apple.*samantha/i.test(v.name))
    ) || voices.find(v => v.lang.startsWith('en'));
    if (femaleVoice) utterance.voice = femaleVoice;

    utterance.onend = () => { this._speaking = false; this._setWaveActive(false); if (btn) btn.textContent = '🎙️'; };
    utterance.onerror = () => { this._speaking = false; this._setWaveActive(false); if (btn) btn.textContent = '🎙️'; };
    window.speechSynthesis.speak(utterance);
  },

  _stopSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this._speaking = false;
    this._setWaveActive(false);
    const btn = document.getElementById('tour-voice-btn');
    if (btn) btn.textContent = '🎙️';
  },

  _setWaveActive(active) {
    const wave = document.getElementById('tour-voice-wave');
    if (wave) wave.classList.toggle('active', active);
  },

  // ── Ambient Music (Web Audio API — fully offline) ─────────────────────────────
  _startAmbientMusic() {
    try {
      if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
      this._musicStarted = true;
      const btn = document.getElementById('tour-music-btn');
      if (btn) btn.textContent = '🎵';
      this._playAmbientPad();
    } catch(e) { /* AudioContext not available */ }
  },

  _stopAmbientMusic() {
    this._ambientNodes.forEach(n => { try { n.stop(); } catch(e){} });
    this._ambientNodes = [];
    this._musicStarted = false;
    const btn = document.getElementById('tour-music-btn');
    if (btn) btn.textContent = '🔇';
  },

  _playAmbientPad() {
    if (!this._audioCtx || !this._musicStarted) return;
    const ctx = this._audioCtx;
    // Calm ambient chord: C major pentatonic tones (frequencies in Hz)
    const chordSets = {
      cosmos: [130.81, 196.00, 261.63, 329.63, 392.00],
      ocean:  [138.59, 207.65, 261.63, 311.13, 392.00],
      forest: [146.83, 196.00, 246.94, 293.66, 369.99],
      aurora: [123.47, 185.00, 246.94, 311.13, 369.99],
      sunset: [138.59, 174.61, 220.00, 277.18, 329.63],
    };
    const currentTheme = this.steps[this.step]?.theme || 'cosmos';
    const freqs = chordSets[currentTheme] || chordSets.cosmos;

    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const pan  = ctx.createStereoPanner();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      // Gentle frequency drift for alive feel
      osc.frequency.linearRampToValueAtTime(freq * 1.004, ctx.currentTime + 4 + i);
      osc.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 8 + i);

      filter.type = 'lowpass';
      filter.frequency.value = 600 + i * 120;
      filter.Q.value = 0.5;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.018 + i * 0.004, ctx.currentTime + 2 + i * 0.5);

      pan.pan.value = (i - 2) * 0.25;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.3);
      this._ambientNodes.push(osc);

      // Fade out loop after 20s and restart
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 18 + i);
      osc.stop(ctx.currentTime + 20 + i);
    });

    // Loop the ambient pad
    setTimeout(() => {
      if (this._musicStarted) { this._ambientNodes = []; this._playAmbientPad(); }
    }, 18000);
  },

  _updateMusicTheme(themeKey) {
    // Soft chord change: restart ambient with new theme tones
    if (this._musicStarted) {
      this._stopAmbientMusic();
      this._musicStarted = true;
      setTimeout(() => this._playAmbientPad(), 200);
    }
  },

  // ── Particle Canvas ───────────────────────────────────────────────────────────
  _initParticles() {
    const canvas = document.getElementById('tour-particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width  = canvas.offsetWidth  || 800;
    let h = canvas.height = canvas.offsetHeight || 600;
    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3, a: Math.random(),
      dx: (Math.random() - 0.5) * 0.15, dy: (Math.random() - 0.5) * 0.1,
      twinkleSpeed: 0.01 + Math.random() * 0.02,
    }));

    const render = () => {
      if (!document.getElementById('tour-particles-canvas')) return;
      ctx.clearRect(0, 0, w, h);
      stars.forEach(s => {
        s.x += s.dx; s.y += s.dy;
        s.a += s.twinkleSpeed;
        if (s.x < 0) s.x = w; if (s.x > w) s.x = 0;
        if (s.y < 0) s.y = h; if (s.y > h) s.y = 0;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(s.a)})`;
        ctx.fill();
      });
      requestAnimationFrame(render);
    };
    render();

    const onResize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    window.addEventListener('resize', onResize);
  },
};

// Preload voices on page load
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
