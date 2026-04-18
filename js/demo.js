// Seeded PRNG (mulberry32) for reproducible demo data
function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var DEMO_DATA = (function () {
  var rand = mulberry32(42);
  var records = [];
  var educations = ['High School', "Bachelor's", "Master's", 'PhD'];

  function pickRace(r) {
    if (r < 0.45) return 'White';
    if (r < 0.65) return 'Black';
    if (r < 0.85) return 'Hispanic';
    return 'Asian';
  }

  for (var i = 0; i < 500; i++) {
    var gender = rand() < 0.55 ? 'Male' : 'Female';
    var race = pickRace(rand());
    var age = Math.floor(22 + rand() * 40);
    var education = educations[Math.floor(rand() * 4)];
    var years_experience = Math.min(age - 22, Math.floor(rand() * (age - 20)));
    var interview_score = Math.round(55 + rand() * 45);

    // Biased hiring probability — gender and race systematically shift outcome
    var p = ((interview_score - 55) / 45) * 0.5;
    if (gender === 'Male') p += 0.20;
    if (race === 'White') p += 0.12;
    if (race === 'Asian') p += 0.05;
    p = Math.max(0.05, Math.min(0.95, p));

    records.push({
      id: i + 1,
      age: age,
      gender: gender,
      race: race,
      education: education,
      years_experience: years_experience,
      interview_score: interview_score,
      hired: rand() < p ? 1 : 0
    });
  }
  return records;
})();

var DEMO_SCENARIOS = {
  hiring: {
    label: '🏢 Hiring Decisions',
    data: DEMO_DATA,
    protectedAttr: 'gender',
    targetAttr: 'hired',
    positiveValue: '1',
    description: '500 synthetic job applicants — gender & race bias baked in'
  }
};
