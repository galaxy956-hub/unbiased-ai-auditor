// ── TourUI — 5-step guided onboarding tour ────────────────────────────────────
const TourUI = {
  step: 0,
  steps: [
    {
      icon: '🛡️',
      title: 'Welcome to Unbiased AI Auditor',
      body: 'This tool helps organizations detect and fix hidden bias in AI systems that make life-changing decisions — hiring, lending, healthcare, and more. Built for Google Solution Challenge 2026, powered by Gemini AI.',
      action: null,
    },
    {
      icon: '📂',
      title: 'Step 1 — Load a Dataset',
      body: 'Click any domain card on the Home page to instantly load a realistic demo dataset, or upload your own CSV in the Data Explorer tab. We\'ll auto-detect columns and configure the analysis.',
      action: () => AppRouter.go('home'),
    },
    {
      icon: '⚖️',
      title: 'Step 2 — Measure Bias',
      body: 'Go to Bias Metrics to see 11 industry-standard fairness metrics — from Disparate Impact (EEOC 4/5ths Rule) to Equalized Odds and Counterfactual Fairness — each with a pass/warning/critical verdict.',
      action: () => { AppState.loadDemo('hiring'); AppRouter.go('metrics'); },
    },
    {
      icon: '✨',
      title: 'Step 3 — Ask Gemini AI',
      body: 'Click "✨ Explain with AI" on any metric card to get a plain-English explanation of what the bias means for real people. Use the chat widget (bottom-right) to ask any question about your audit.',
      action: () => AppRouter.go('metrics'),
    },
    {
      icon: '📄',
      title: 'Step 4 — Export a Report',
      body: 'Go to Audit Report to generate a full compliance report with a regulatory checklist (EEOC, EU AI Act, ECOA, FHA). Export as PDF, JSON, or CSV for legal review. The AI can write your executive summary.',
      action: () => AppRouter.go('report'),
    },
  ],

  start() {
    this.step = 0;
    this._render();
    const overlay = document.getElementById('tour-overlay');
    if (overlay) overlay.style.display = 'flex';
  },

  next() {
    // Execute the action for the current step before advancing
    const currentStep = this.steps[this.step];
    if (currentStep && currentStep.action) currentStep.action();

    this.step++;
    if (this.step >= this.steps.length) {
      this.end();
    } else {
      this._render();
    }
  },

  prev() {
    if (this.step > 0) {
      this.step--;
      this._render();
    }
  },

  end() {
    const overlay = document.getElementById('tour-overlay');
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('tour-seen', '1');
  },

  _render() {
    const s = this.steps[this.step];
    if (!s) return;

    const iconEl = document.getElementById('tour-icon');
    const titleEl = document.getElementById('tour-title');
    const bodyEl = document.getElementById('tour-body');
    const nextBtn = document.getElementById('tour-next');
    const prevBtn = document.getElementById('tour-prev');
    const indicatorEl = document.getElementById('tour-step-indicator');

    if (iconEl) iconEl.textContent = s.icon;
    if (titleEl) titleEl.textContent = s.title;
    if (bodyEl) bodyEl.textContent = s.body;

    // Step indicators
    if (indicatorEl) {
      indicatorEl.innerHTML = this.steps.map((_, i) =>
        `<span class="tour-dot ${i === this.step ? 'active' : ''}"></span>`
      ).join('');
    }

    // Prev button visibility
    if (prevBtn) prevBtn.style.display = this.step > 0 ? 'inline-flex' : 'none';

    // Next button label
    if (nextBtn) {
      nextBtn.textContent = this.step === this.steps.length - 1 ? '🚀 Get Started' : 'Next →';
    }

    // Animate card
    const card = document.getElementById('tour-card');
    if (card) {
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'tourSlideIn 0.35s ease-out';
    }
  }
};
