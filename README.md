# 🛡️ Unbiased AI Auditor

**Detect, Measure, and Mitigate Algorithmic Bias using Google Gemini AI.**

Unbiased AI Auditor is a professional-grade tool designed for data scientists, compliance officers, and AI developers to audit automated decision systems (Hiring, Lending, Healthcare) for hidden discrimination.

![Unbiased AI Auditor](https://img.shields.io/badge/Status-Cloud--Ready-blueviolet?style=for-the-badge)
![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-blue?style=for-the-badge)

## ✨ Features

*   **📊 8 Comprehensive Metrics**: Disparate Impact, Statistical Parity, Equal Opportunity, Equalized Odds, Predictive Parity, Calibration, Individual Fairness, and Intersectionality.
*   **🤖 Gemini AI Integration**:
    *   **AI Narrative**: Automatically generates an executive summary of audit findings.
    *   **Metric Explainer**: Translates complex fairness metrics into plain-English business impact.
    *   **AI Recommendations**: Prioritized remediation steps powered by Gemini 2.0 Flash.
*   **🧪 Mitigation Lab**: Experiment with Reweighing, Threshold Optimization, and Adversarial Debiasing.
*   **📋 Regulatory Compliance**: Auto-checks against US EEOC 4/5ths Rule and the EU AI Act.
*   **☁️ Cloud Native**: Fully containerized for Google Cloud Run.

## 🚀 Quick Start

### Local Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your Gemini API Key:
   ```bash
   export GEMINI_API_KEY="your_google_ai_key"
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open `http://localhost:8080`.

### Cloud Deployment (Google Cloud Run)
Deploy directly to the cloud with one command:
```bash
gcloud run deploy unbiased-ai --source . --set-env-vars="GEMINI_API_KEY=your_key" --allow-unauthenticated
```

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, @google/genai SDK
- **Frontend**: Vanilla JS, CSS3 (Glassmorphism), Chart.js
- **Model**: Google Gemini 2.0 Flash
- **Deployment**: Docker, Google Cloud Run

## 📜 License
MIT License. Built for ethical AI development.
