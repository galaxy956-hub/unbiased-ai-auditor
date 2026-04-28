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
    return `[Fallback Mode]: The local AI model is still loading into memory (this is a one-time process). I can provide general guidance based on your audit results. Your overall grade is ${context?.metricSummary?.grade || 'unknown'}. Please refer to the specific metric cards for detailed breakdowns, or try again in a moment.`;
}

module.exports = {
    generateNarrativeFallback,
    generateExplanationFallback,
    generateRecommendationsFallback,
    generateCodeFallback,
    generateChatFallback
};
