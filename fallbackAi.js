/**
 * Heuristic AI Fallback Module
 * Provides rule-based text generation when the offline AI model (Transformers.js) fails or is still loading.
 */

function generateNarrativeFallback(metrics, config, datasetLabel, rowCount) {
    const { protectedAttr, outcomeAttr } = config;
    const grade = metrics.overallRisk?.grade ?? 'C';
    
    let criticalFindings = [];
    if (metrics.disparateImpact?.status === 'critical') criticalFindings.push(`a critical Disparate Impact violation (${metrics.disparateImpact.value.toFixed(2)})`);
    if (metrics.statisticalParity?.status === 'critical') criticalFindings.push(`severe Statistical Parity differences (${metrics.statisticalParity.value.toFixed(2)})`);
    
    const findingsText = criticalFindings.length > 0 
        ? `The most critical findings include ${criticalFindings.join(' and ')}, indicating systemic barriers for certain demographic groups.`
        : `While some disparities exist, no single metric reached a critical violation threshold.`;

    return `This audit evaluated the ${datasetLabel} dataset (${rowCount} records) for bias in predicting the "${outcomeAttr}" outcome, focusing on the protected attribute "${protectedAttr}". The system achieved an overall fairness grade of ${grade}.

${findingsText} These disparities suggest that the automated decision-making process may disproportionately disadvantage specific groups, which could lead to regulatory risks and reputational damage.

It is highly recommended to investigate the data collection process for historical bias and apply algorithmic mitigation techniques, such as reweighing or threshold adjustments, before deploying this model into production.`;
}

function generateExplanationFallback(metricName, value, status, threshold, groups, context) {
    const isPass = status === 'pass';
    const severity = isPass ? 'meets' : 'fails to meet';
    
    const explanations = {
        'Disparate Impact': `Disparate Impact measures the ratio of favorable outcomes between different groups. A value of ${value} ${severity} the regulatory threshold of ${threshold}, meaning the system selects groups at significantly different rates.`,
        'Statistical Parity': `Statistical Parity measures the absolute difference in selection rates. A difference of ${value} ${severity} the accepted threshold of ${threshold}.`,
        'Equal Opportunity': `Equal Opportunity looks at true positive rates. A value of ${value} ${severity} the threshold, indicating the model is better at correctly identifying positive outcomes for one group over another.`
    };

    const baseExp = explanations[metricName] || `${metricName} evaluates algorithmic fairness. A result of ${value} ${severity} the threshold of ${threshold}.`;
    return `${baseExp} In the context of ${context || 'this system'}, failing this metric means real individuals from affected groups may be systematically denied opportunities or flagged incorrectly.`;
}

function generateRecommendationsFallback(metrics, config, datasetLabel) {
    return `1. Data Reweighing (Preprocessing): Apply sample weights to the training data to neutralize the historical bias against the "${config.protectedAttr}" attribute before training. This is highly effective but requires retraining the model.
2. Threshold Optimization (Postprocessing): Adjust the decision thresholds for different demographic groups to ensure equal selection rates. This is quick to implement but may lower overall accuracy.
3. Feature Auditing: Review the input features for proxies of "${config.protectedAttr}" (e.g., zip codes mapping to race). Removing these proxy variables can organically reduce bias.
4. Human-in-the-Loop Review: Implement manual oversight for decisions falling near the margin, especially for groups flagged by the Disparate Impact metric.`;
}

function generateCodeFallback(metrics, config, method, datasetLabel) {
    const explanation = `This code demonstrates how to apply ${method} using the Fairlearn library to mitigate bias related to the "${config.protectedAttr}" attribute when predicting "${config.outcomeAttr}". It wraps a standard scikit-learn model to enforce fairness constraints.`;
    
    const code = `import pandas as pd
from sklearn.linear_model import LogisticRegression
from fairlearn.reductions import ExponentiatedGradient, DemographicParity

# Assuming 'df' is your loaded DataFrame for ${datasetLabel}
X = df.drop(columns=['${config.outcomeAttr}', '${config.protectedAttr}'])
y = df['${config.outcomeAttr}']
A = df['${config.protectedAttr}']

# Base estimator
estimator = LogisticRegression(solver='liblinear')

# Apply mitigation: ${method}
mitigator = ExponentiatedGradient(estimator, constraints=DemographicParity())
mitigator.fit(X, y, sensitive_features=A)

# Predictions are now constrained for fairness
preds = mitigator.predict(X)
print("Mitigation applied successfully.")`;

    return { explanation, code };
}

function generateChatFallback(message, context) {
    const q = (message || '').toLowerCase();
    const grade = context?.metricSummary?.grade || 'N/A';
    const score = context?.metricSummary?.score || 'N/A';
    const di    = context?.metricSummary?.disparateImpact;
    const sp    = context?.metricSummary?.statisticalParity;
    const dataset = context?.datasetLabel || 'your dataset';
    const attr    = context?.config?.protectedAttr || 'the protected attribute';
    const ref     = context?.config?.referenceGroup || 'the reference group';

    if (q.includes('disparate impact') || q.includes('4/5') || q.includes('80%') || q.includes('di ratio')) {
        const diVal = di != null ? `Your current Disparate Impact Ratio is ${di.toFixed(3)}.` : '';
        return `Disparate Impact (DI) measures whether one group is selected at a significantly lower rate than another. ${diVal} The US EEOC "4/5ths rule" sets the threshold at 0.8: anything below that signals potential discrimination. A score below 0.6 is critical and indicates systemic bias that must be fixed before deployment. Navigate to the Bias Metrics tab to see a full group-by-group breakdown.`;
    }

    if (q.includes('statistical parity') || q.includes('parity difference') || q.includes('selection rate')) {
        const spVal = sp != null ? `Your dataset shows a Statistical Parity Difference of ${sp.toFixed(3)}.` : '';
        return `Statistical Parity measures the absolute difference in outcome rates between demographic groups. ${spVal} A gap above 0.1 (10%) is a warning; above 0.15 is critical. For ${dataset}, this means ${attr} groups receive different outcome rates even when other factors are comparable. You can apply threshold optimization or reweighing in the Mitigation Lab tab to reduce this gap.`;
    }

    if (q.includes('grade') || q.includes('score') || q.includes('overall') || q.includes('how bad') || q.includes('result')) {
        const descs = { A:'excellent — meets most fairness standards', B:'good — minor issues to monitor', C:'moderate — meaningful bias present', D:'poor — significant violations needing urgent action', F:'failing — critical violations with serious legal risk' };
        return `Your audit of ${dataset} received Grade ${grade} (${score}/100) — ${descs[grade] || 'review recommended'}. This is computed across multiple fairness metrics. A grade of D or F means the system should not be deployed without applying mitigation steps first. Use the Mitigation Lab tab to simulate debiasing strategies.`;
    }

    if (q.includes('equal opportunity') || q.includes('true positive') || q.includes('tpr')) {
        return `Equal Opportunity checks that qualified individuals from all groups are correctly identified at similar rates (equal True Positive Rates). If this metric fails for ${dataset}, it means genuinely qualified people in disadvantaged ${attr} groups are being rejected at higher rates than equally qualified peers — a direct form of algorithmic discrimination. The threshold is a difference below 0.1.`;
    }

    if (q.includes('fix') || q.includes('mitigat') || q.includes('reduc') || q.includes('improve') || q.includes('debias')) {
        return `For ${dataset} with bias in "${attr}", top mitigation strategies are: (1) Reweighing — increase weights for under-represented groups in training; (2) Threshold Optimization — set different decision thresholds per group to equalize rates; (3) Adversarial Debiasing — penalize the model for using group membership as a predictor; (4) Feature Auditing — remove proxy variables like zip code that encode protected attributes indirectly. Try these in the Mitigation Lab tab.`;
    }

    if (q.includes('what is bias') || q.includes('algorithmic bias') || q.includes('ai bias') || q.includes('definition') || q.includes('explain')) {
        return `Algorithmic bias occurs when an AI system produces outcomes that systematically disadvantage certain groups based on protected characteristics like race, gender, or age. It usually happens because the model learned from historically biased data, uses proxy variables that correlate with protected attributes, or optimized only for accuracy without fairness constraints. It affects high-stakes areas like hiring, lending, healthcare, and criminal justice.`;
    }

    if (q.includes('legal') || q.includes('regulat') || q.includes('eeoc') || q.includes('eu ai act') || q.includes('law') || q.includes('complian')) {
        return `Key regulatory frameworks: EEOC "4/5ths rule" (US) requires Disparate Impact > 0.8 for employment decisions. EU AI Act (2024) classifies hiring and credit AI as "high-risk" requiring mandatory bias audits. The Fair Housing Act and Equal Credit Opportunity Act prohibit discriminatory lending algorithms. Your current Grade ${grade} should be reviewed against these requirements — a grade of D or F may indicate compliance risk.`;
    }

    if (q.includes('protect') || q.includes('group') || q.includes('attribute') || q.includes(attr.toLowerCase())) {
        return `In your ${dataset} audit, "${attr}" is the protected attribute monitored for bias, with "${ref}" as the reference group. Fairness metrics measure whether other ${attr} groups receive outcomes at comparable rates to ${ref}. You can change the protected attribute in the Config Bar at the top of the page to explore bias across different demographic dimensions.`;
    }

    // Default rich contextual answer
    const diNote = di != null && di < 0.8 ? ` The Disparate Impact Ratio of ${di.toFixed(3)} is below the 0.8 regulatory threshold — this is a legal concern.` : '';
    return `Based on your ${dataset} audit (Grade: ${grade}, Score: ${score}/100), fairness issues were detected in "${attr}".${diNote} I can answer questions about: Disparate Impact, Statistical Parity, Equal Opportunity, mitigation strategies, regulatory compliance (EEOC, EU AI Act), or how the audit works. What would you like to know?`;
}

module.exports = {
    generateNarrativeFallback,
    generateExplanationFallback,
    generateRecommendationsFallback,
    generateCodeFallback,
    generateChatFallback
};
