# 🛡️ Unbiased AI Auditor

**Detect, measure, and fix algorithmic bias in automated decisions.**

> Google Solution Challenge 2026 — AI for Social Good  
> Supporting UN SDG 10 (Reduced Inequalities) · SDG 16 (Peace, Justice & Strong Institutions) · SDG 8 (Decent Work)

🌐 **Live Demo:** [https://unbiased-ai-auditor-694414640481.asia-south1.run.app](https://unbiased-ai-auditor-694414640481.asia-south1.run.app)

---

## The Problem

AI systems now make life-changing decisions — who gets hired, who receives a loan, who is flagged by the criminal justice system. When these systems learn from historically biased data, they encode and amplify discrimination. **67% of hiring algorithms** show measurable gender bias, and minority loan applicants face **2× the denial rate** of equivalent applicants.

Without accessible fairness tooling, these harms remain invisible until someone sues, a regulator fines, or a life is irreversibly affected.

## Our Solution

**Unbiased AI Auditor** is a complete, production-ready platform that empowers organizations to audit their AI systems for fairness — without requiring a data science team.

### Key Features

| Feature | Description |
|---|---|
| 📊 **11 Fairness Metrics** | Disparate Impact, Statistical Parity, Equal Opportunity, Equalized Odds, Predictive Parity, Calibration, Individual Fairness, Intersectionality, Counterfactual Fairness, Treatment Inequality, Consistency |
| 🏢 **6 Real-World Domains** | Hiring, Lending, Healthcare, Criminal Justice, Education, Insurance |
| 🧪 **Mitigation Lab** | Apply 8 debiasing strategies (Reweighing, Threshold Optimization, Adversarial Debiasing, Preprocessing, Postprocessing, Disparate Remover, Calibrated Equalized Odds, Reject Option Classification) and compare before/after |
| 🔮 **What-If Analysis** | Modify individual records and see how predictions change across groups |
| 🏆 **Bias Bounty Board** | Crowdsource bias discovery with a gamified leaderboard |
| 🤖 **Offline AI Assistant** | Built-in chat, narrative generation, metric explanations, and Python remediation code — all running locally via Transformers.js |
| 📋 **Audit Reports** | Export comprehensive PDF/JSON/CSV reports with regulatory compliance checklists (EEOC, EU AI Act, ECOA, FHA) |
| 📈 **Monitoring Dashboard** | Track fairness drift over time with live 12-week simulation and alert system |
| ⚖️ **Policy Engine** | Customize thresholds and map audit findings to regulatory frameworks |
| 🧭 **Guided Tour** | Interactive onboarding tour for first-time users |

---

## Google Technology Stack

| Technology | Usage |
|---|---|
| ☁️ **Google Cloud Run** | Serverless, auto-scaling deployment — zero infrastructure management |
| 🧠 **Transformers.js** | Runs a local Qwen1.5-0.5B-Chat language model entirely offline — zero API keys, zero rate limits |
| 📊 **Google Fonts (Inter)** | Material Design principles for accessible, inclusive UI |
| 🔒 **Cloud Run Security** | IAM, HTTPS-only, non-root container, security headers |
| 📦 **Cloud Build** | Automated container builds from source |

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v20 or higher

### Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/unbiased-ai-auditor.git
cd unbiased-ai-auditor

# 2. Install dependencies
npm install

# 3. Download the offline AI model (~500MB, one-time)
npm run download-model

# 4. Start the server
npm start
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

> **Note:** No API keys or environment variables are required. The AI runs 100% offline using Transformers.js.

### Deploy to Google Cloud Run

```bash
gcloud run deploy unbiased-ai-auditor \
  --source . \
  --region asia-south1 \
  --memory 1024Mi \
  --allow-unauthenticated
```

---

## Architecture

```
unbiased-ai-auditor/
├── server.js              # Express server + offline AI engine + REST API
├── fallbackAi.js          # Heuristic fallback when AI model is loading
├── download_model.js      # Pre-downloads the Transformers.js model
├── Dockerfile             # Production container (model baked in)
├── public/
│   ├── index.html         # Single-page application shell
│   ├── app.js             # Application state & router
│   ├── styles.css         # Complete design system
│   ├── data/
│   │   └── datasets.js    # 6 synthetic bias datasets (seeded, reproducible)
│   ├── engine/
│   │   ├── metrics.js     # 11 fairness metric algorithms
│   │   ├── mitigation.js  # 8 debiasing strategies
│   │   └── parser.js      # CSV parser & column detection
│   └── ui/
│       ├── dashboardUI.js # KPI dashboard with fairness score ring
│       ├── metricsUI.js   # Metric cards with group breakdowns
│       ├── chartsUI.js    # Chart.js visualizations (radar, heatmap, ROC)
│       ├── labUI.js       # Mitigation laboratory
│       ├── whatifUI.js    # Counterfactual What-If analysis
│       ├── bountyUI.js    # Bias bounty board
│       ├── reportUI.js    # PDF/JSON/CSV audit report generator
│       ├── monitorUI.js   # Fairness drift monitoring
│       ├── policyUI.js    # Regulatory policy engine
│       ├── explorer.js    # Data explorer & CSV upload
│       ├── aiUI.js        # AI chat widget & metric explain buttons
│       └── tourUI.js      # Guided onboarding tour
└── package.json
```

### How the Offline AI Works

1. During `npm run download-model` (or Docker build), the **Qwen1.5-0.5B-Chat** model is downloaded and cached locally.
2. When the server starts, the model is loaded into memory on the first AI request.
3. All AI features (narrative generation, metric explanations, chat, Python code generation) run through this local model — no external API calls.
4. If the model is still loading, a **heuristic fallback engine** (`fallbackAi.js`) provides template-based responses using the actual audit metrics, ensuring the app never crashes.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check with model status |
| `GET` | `/api/datasets` | List available demo datasets with metadata |
| `POST` | `/api/metrics/compute` | Compute fairness metrics on uploaded data |
| `POST` | `/api/mitigation/apply` | Apply a debiasing strategy |
| `POST` | `/api/ai/narrative` | Generate an executive summary |
| `POST` | `/api/ai/explain` | Explain a specific metric result |
| `POST` | `/api/ai/recommend` | Get remediation recommendations |
| `POST` | `/api/ai/code` | Generate Python/Fairlearn remediation code |
| `POST` | `/api/ai/chat` | Chat with the AI assistant |

### Dataset Column Reference

| Dataset | Protected Attr | Outcome Attr | Score Attr | Reference Group |
|---|---|---|---|---|
| HR Hiring Pipeline | `gender` | `hired` | `interview_score` | `Male` |
| Bank Loan Approval | `race` | `approved` | `credit_score` | `White` |
| Healthcare Risk | `race` | `flagged_high_risk` | `health_score` | `White` |
| Criminal Justice | `race` | `recidivism_flagged` | `risk_score` | `White` |
| Education Admission | `socioeconomic_status` | `admitted` | `admission_score` | `High` |
| Insurance Pricing | `location_type` | `high_premium` | `risk_factor` | `Suburban` |

---

## Fairness Metrics Reference

| Metric | Threshold | Regulatory Basis |
|---|---|---|
| Disparate Impact Ratio | ≥ 0.8 | EEOC 4/5ths Rule |
| Statistical Parity Difference | ≤ 0.1 | Academic consensus |
| Equal Opportunity Difference | ≤ 0.1 | Hardt et al. 2016 |
| Equalized Odds | ≤ 0.1 | Hardt et al. 2016 |
| Predictive Parity | ≤ 0.1 | Chouldechova 2017 |
| Score Calibration | ≤ 0.1 | Platt 1999 |
| Individual Fairness | ≤ 0.15 | Dwork et al. 2012 |
| Intersectionality | ≤ 0.25 | Kearns et al. 2018 |
| Counterfactual Fairness | ≤ 0.15 | Kusner et al. 2017 |
| Treatment Inequality | ≤ 0.1 | Internal |
| Consistency | ≤ 0.2 | Zemel et al. 2013 |

---

## UN Sustainable Development Goals

- **SDG 10 — Reduced Inequalities**: Directly detects and quantifies discrimination in automated systems.
- **SDG 16 — Peace, Justice & Strong Institutions**: Provides regulatory compliance tools for EEOC, EU AI Act, ECOA, and FHA frameworks.
- **SDG 8 — Decent Work & Economic Growth**: Ensures fair hiring, lending, and economic opportunity algorithms.

---

## Rate Limits

The API enforces a rate limit of **30 requests per minute** per IP address to protect the offline AI model from overload. The UI automatically handles this gracefully.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

Built with ❤️ for the **Google Solution Challenge 2026**.
