// Seeded PRNG for reproducible datasets
function createRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const Datasets = {
  configs: {
    hiring: {
      label: 'HR Hiring Pipeline',
      protectedAttr: 'gender',
      outcomeAttr: 'hired',
      groundTruthAttr: 'qualified',
      scoreAttr: 'interview_score',
      referenceGroup: 'Male',
      columns: ['id','age','gender','race','education','experience_yrs','interview_score','qualified','hired']
    },
    lending: {
      label: 'Bank Loan Approval',
      protectedAttr: 'race',
      outcomeAttr: 'approved',
      groundTruthAttr: 'creditworthy',
      scoreAttr: 'credit_score',
      referenceGroup: 'White',
      columns: ['id','age','gender','race','income','credit_score','loan_amount','creditworthy','approved']
    },
    healthcare: {
      label: 'Healthcare Risk Scoring',
      protectedAttr: 'race',
      outcomeAttr: 'flagged_high_risk',
      groundTruthAttr: 'actually_high_risk',
      scoreAttr: 'health_score',
      referenceGroup: 'White',
      columns: ['id','age','gender','race','income','num_conditions','health_score','actually_high_risk','flagged_high_risk']
    },
    criminal: {
      label: 'Criminal Justice Risk Assessment',
      protectedAttr: 'race',
      outcomeAttr: 'recidivism_flagged',
      groundTruthAttr: 'actually_reoffended',
      scoreAttr: 'risk_score',
      referenceGroup: 'White',
      columns: ['id','age','gender','race','prior_offenses','risk_score','actually_reoffended','recidivism_flagged']
    },
    education: {
      label: 'Education Admission Decisions',
      protectedAttr: 'socioeconomic_status',
      outcomeAttr: 'admitted',
      groundTruthAttr: 'qualified',
      scoreAttr: 'admission_score',
      referenceGroup: 'High',
      columns: ['id','age','gender','race','socioeconomic_status','gpa','admission_score','qualified','admitted']
    },
    insurance: {
      label: 'Insurance Premium Pricing',
      protectedAttr: 'location_type',
      outcomeAttr: 'high_premium',
      groundTruthAttr: 'high_risk',
      scoreAttr: 'risk_factor',
      referenceGroup: 'Suburban',
      columns: ['id','age','gender','location_type','claims_history','risk_factor','high_risk','high_premium']
    }
  },

  generate(key) {
    switch(key) {
      case 'hiring':     return this.generateHiring();
      case 'lending':    return this.generateLending();
      case 'healthcare': return this.generateHealthcare();
      case 'criminal':   return this.generateCriminal();
      case 'education':  return this.generateEducation();
      case 'insurance':  return this.generateInsurance();
      default: return [];
    }
  },

  generateHiring() {
    const rng = createRNG(42);
    const data = [];
    const educations = ['High School', "Bachelor's", "Master's", 'PhD'];
    const eduWeights = [0.2, 0.45, 0.25, 0.1];

    function pickEdu(r) {
      let acc = 0;
      for (let i = 0; i < eduWeights.length; i++) {
        acc += eduWeights[i];
        if (r < acc) return i;
      }
      return 3;
    }

    for (let i = 0; i < 500; i++) {
      const gender = rng() < 0.55 ? 'Male' : (rng() < 0.92 ? 'Female' : 'Non-binary');
      const raceR = rng();
      const race = raceR < 0.48 ? 'White' : raceR < 0.67 ? 'Black' : raceR < 0.85 ? 'Hispanic' : raceR < 0.96 ? 'Asian' : 'Other';
      const age = Math.floor(22 + rng() * 38);
      const eduIdx = pickEdu(rng());
      const experience_yrs = Math.min(20, Math.floor(Math.max(0, (age - 22) * (0.3 + rng() * 0.6))));

      // Ground truth: qualification based on edu + experience
      const qualScore = eduIdx * 22 + experience_yrs * 2.5 + rng() * 18;
      const qualified = qualScore > 54 ? 1 : 0;

      // Interview score — biased against women and minorities
      let baseScore = qualScore + rng() * 28 - 8;
      if (gender === 'Female') baseScore -= 9 + rng() * 6;
      if (gender === 'Non-binary') baseScore -= 14 + rng() * 5;
      if (race === 'Black') baseScore -= 11 + rng() * 5;
      if (race === 'Hispanic') baseScore -= 7 + rng() * 5;
      const interview_score = Math.min(100, Math.max(0, Math.round(baseScore)));

      // Hiring decision — biased: score + group membership affects outcome
      let hireProb = (interview_score / 100) * 0.85;
      if (gender === 'Male') hireProb += 0.12;
      if (race === 'White') hireProb += 0.10;
      if (race === 'Asian') hireProb += 0.05;
      const hired = rng() < hireProb ? 1 : 0;

      data.push({ id: i+1, age, gender, race, education: educations[eduIdx], experience_yrs, interview_score, qualified, hired });
    }
    return data;
  },

  generateLending() {
    const rng = createRNG(99);
    const data = [];

    for (let i = 0; i < 400; i++) {
      const gender = rng() < 0.53 ? 'Male' : 'Female';
      const raceR = rng();
      const race = raceR < 0.5 ? 'White' : raceR < 0.7 ? 'Black' : raceR < 0.87 ? 'Hispanic' : raceR < 0.97 ? 'Asian' : 'Other';
      const age = Math.floor(22 + rng() * 43);

      // Income varies by race (reflecting systemic inequality in training data)
      let baseIncome = 35000 + rng() * 80000;
      if (race === 'White') baseIncome += 12000;
      if (race === 'Asian') baseIncome += 8000;
      if (race === 'Black') baseIncome -= 10000;
      if (race === 'Hispanic') baseIncome -= 7000;
      const income = Math.max(18000, Math.round(baseIncome));

      // Credit score — biased (structural wealth effects)
      let baseCreditScore = 580 + (income / 130000) * 180 + rng() * 80 - 40;
      if (race === 'Black') baseCreditScore -= 30 + rng() * 20;
      if (race === 'Hispanic') baseCreditScore -= 18 + rng() * 15;
      const credit_score = Math.min(850, Math.max(300, Math.round(baseCreditScore)));

      const loan_amount = Math.round(5000 + rng() * 95000);

      // True creditworthiness (ability to repay, unbiased)
      const debtRatio = loan_amount / income;
      const creditworthy = (credit_score > 580 && debtRatio < 0.5) || (credit_score > 650) ? 1 : 0;

      // Approval decision — additional racial bias beyond credit score
      let approveProb = (credit_score - 300) / 550 * 0.9;
      if (race === 'Black') approveProb -= 0.12;
      if (race === 'Hispanic') approveProb -= 0.08;
      if (race === 'White') approveProb += 0.06;
      if (age < 28 || age > 65) approveProb -= 0.07;
      const approved = rng() < Math.max(0.03, Math.min(0.97, approveProb)) ? 1 : 0;

      data.push({ id: i+1, age, gender, race, income, credit_score, loan_amount, creditworthy, approved });
    }
    return data;
  },

  generateHealthcare() {
    const rng = createRNG(77);
    const data = [];

    for (let i = 0; i < 350; i++) {
      const gender = rng() < 0.51 ? 'Male' : 'Female';
      const raceR = rng();
      const race = raceR < 0.52 ? 'White' : raceR < 0.70 ? 'Black' : raceR < 0.86 ? 'Hispanic' : raceR < 0.97 ? 'Asian' : 'Other';
      const age = Math.floor(18 + rng() * 62);

      // Income — correlated with race (systemic)
      let baseIncome = 30000 + rng() * 70000;
      if (race === 'White') baseIncome += 15000;
      if (race === 'Asian') baseIncome += 10000;
      if (race === 'Black') baseIncome -= 12000;
      const income = Math.max(12000, Math.round(baseIncome));

      // Conditions — true health needs (equal distribution)
      const num_conditions = Math.floor(rng() * 6);

      // True risk based on actual health factors
      const actualRisk = num_conditions >= 3 || age > 60;
      const actually_high_risk = actualRisk ? 1 : 0;

      // Health score — biased: algorithm uses cost as proxy for health need
      // Black patients have lower healthcare utilization due to access barriers,
      // so cost-based score underestimates their true risk (real Optum study finding)
      let healthScore = num_conditions * 14 + (age / 80) * 30 + (income / 100000) * 25 + rng() * 20 - 5;
      if (race === 'Black') healthScore -= 18 + rng() * 10; // healthcare access disparity
      if (race === 'Hispanic') healthScore -= 10 + rng() * 8;
      const health_score = Math.min(100, Math.max(0, Math.round(healthScore)));

      // Flagging decision — uses biased health score
      const flagged_high_risk = health_score >= 50 ? 1 : 0;

      data.push({ id: i+1, age, gender, race, income, num_conditions, health_score, actually_high_risk, flagged_high_risk });
    }
    return data;
  },

  generateCriminal() {
    const rng = createRNG(44);
    const data = [];
    const races = ['White', 'Black', 'Hispanic'];
    const raceWeights = [0.4, 0.35, 0.25];

    function weightedChoice(arr, weights, r) {
      let acc = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (r < acc) return arr[i];
      }
      return arr[arr.length - 1];
    }

    for (let i = 0; i < 450; i++) {
      const race = weightedChoice(races, raceWeights, rng());
      const age = Math.floor(rng() * 40) + 18;
      const gender = rng() < 0.85 ? 'Male' : 'Female';
      const priorOffenses = Math.floor(rng() * 6);
      const riskScore = Math.floor(rng() * 40) + 30 + (race === 'Black' ? 10 : 0) + (priorOffenses * 5);
      const actuallyReoffended = priorOffenses > 2 && rng() > 0.4;
      const recidivismFlagged = riskScore > 60 && (race === 'White' || rng() > 0.5);

      data.push({
        id: i + 1,
        age, gender, race,
        prior_offenses: priorOffenses,
        risk_score: riskScore,
        actually_reoffended: actuallyReoffended ? 1 : 0,
        recidivism_flagged: recidivismFlagged ? 1 : 0
      });
    }
    return data;
  },

  generateEducation() {
    const rng = createRNG(45);
    const data = [];
    const ses = ['High', 'Medium', 'Low'];
    const sesWeights = [0.3, 0.5, 0.2];
    const races = ['White', 'Black', 'Hispanic', 'Asian'];
    const raceWeights = [0.4, 0.25, 0.2, 0.15];

    function weightedChoice(arr, weights, r) {
      let acc = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (r < acc) return arr[i];
      }
      return arr[arr.length - 1];
    }

    for (let i = 0; i < 400; i++) {
      const socioeconomic = weightedChoice(ses, sesWeights, rng());
      const race = weightedChoice(races, raceWeights, rng());
      const age = Math.floor(rng() * 8) + 17;
      const gender = rng() < 0.5 ? 'Male' : 'Female';
      const gpa = (rng() * 2.5 + 1.5 + (socioeconomic === 'High' ? 0.3 : socioeconomic === 'Low' ? -0.2 : 0)).toFixed(2);
      const admissionScore = Math.floor(parseFloat(gpa) * 20 + rng() * 20 + (socioeconomic === 'High' ? 10 : socioeconomic === 'Low' ? -5 : 0));
      const qualified = parseFloat(gpa) > 2.5;
      const admitted = qualified && (socioeconomic === 'High' || rng() > 0.6);

      data.push({
        id: i + 1,
        age, gender, race,
        socioeconomic_status: socioeconomic,
        gpa: parseFloat(gpa),
        admission_score: admissionScore,
        qualified: qualified ? 1 : 0,
        admitted: admitted ? 1 : 0
      });
    }
    return data;
  },

  generateInsurance() {
    const rng = createRNG(46);
    const data = [];
    const locations = ['Suburban', 'Urban', 'Rural'];
    const locWeights = [0.4, 0.35, 0.25];

    function weightedChoice(arr, weights, r) {
      let acc = 0;
      for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (r < acc) return arr[i];
      }
      return arr[arr.length - 1];
    }

    for (let i = 0; i < 380; i++) {
      const location = weightedChoice(locations, locWeights, rng());
      const age = Math.floor(rng() * 50) + 25;
      const gender = rng() < 0.5 ? 'Male' : 'Female';
      const claimsHistory = Math.floor(rng() * 4);
      const riskFactor = Math.floor(rng() * 50) + 20 + (location === 'Urban' ? 15 : location === 'Rural' ? 5 : 0) + (claimsHistory * 10);
      const highRisk = riskFactor > 55 || claimsHistory > 2;
      const highPremium = highRisk && (location === 'Suburban' || rng() > 0.5);

      data.push({
        id: i + 1,
        age, gender,
        location_type: location,
        claims_history: claimsHistory,
        risk_factor: riskFactor,
        high_risk: highRisk ? 1 : 0,
        high_premium: highPremium ? 1 : 0
      });
    }
    return data;
  }
};
