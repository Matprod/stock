// Fictional squad and data used by every reference page. Names and values are invented.
const { mean, t } = require('./lib');

const DAYS = t(['lun. 2', 'mar. 3', 'mer. 4', 'jeu. 5', 'ven. 6', 'sam. 7', 'dim. 8'], ['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8']);
const DAY_LETTERS = t(['L', 'M', 'M', 'J', 'V', 'S', 'D'], ['M', 'T', 'W', 'T', 'F', 'S', 'S']);

const POSITIONS_PLURAL = t(
  { GK: 'Gardiens', DC: 'Défenseurs centraux', LAT: 'Latéraux', MD: 'Milieux défensifs', MO: 'Milieux offensifs', AIL: 'Ailiers', ATT: 'Attaquants' },
  { GK: 'Goalkeepers', DC: 'Centre-backs', LAT: 'Full-backs', MD: 'Defensive midfielders', MO: 'Attacking midfielders', AIL: 'Wingers', ATT: 'Forwards' });
const POSITIONS = t(
  { GK: 'Gardien', DC: 'Défenseur central', LAT: 'Latéral', MD: 'Milieu défensif', MO: 'Milieu offensif', AIL: 'Ailier', ATT: 'Attaquant' },
  { GK: 'Goalkeeper', DC: 'Centre-back', LAT: 'Full-back', MD: 'Defensive midfielder', MO: 'Attacking midfielder', AIL: 'Winger', ATT: 'Forward' });

// 24 players. risk / perf = daily ML scores (0-100) for the 18 scored players, null otherwise.
const squad = [
  { short: 'M. Ferreira', name: 'Malik Ferreira', pos: 'ATT', risk: [47, 51, 58, 66, 71, 72, 70], perf: [52, 46, 60, 49, 45, 41, 47] },
  { short: 'T. Lindqvist', name: 'Tom Lindqvist', pos: 'AIL', risk: [69, 68, 70, 63, 18, 15, 12], perf: [70, 58, 50, 56, 41, 63, 71] },
  { short: 'A. Moreau', pos: 'AIL', risk: [18, 16, 17, 19, 17, 17, 18], perf: [51, 50, 46, 52, 44, 41, 43] },
  { short: 'K. Osei', pos: 'MO', risk: [49, 2, 0, 0, 1, 0, 2], perf: [53, 47, 61, 67, 68, 66, 70] },
  { short: 'D. Varga', pos: 'DC', risk: [9, 7, 9, 8, 2, 7, 9], perf: [53, 51, 42, 45, 27, 50, 52] },
  { short: 'L. Brandt', pos: 'DC', risk: [8, 7, 7, 6, 6, 6, 5], perf: [60, 42, 54, 56, 36, 40, 47] },
  { short: 'S. Kowalczyk', pos: 'MO', risk: [0, 1, 0, 0, 31, 0, 0], perf: [59, 49, 45, 46, 30, 58, 56] },
  { short: 'E. Haddad', pos: 'LAT', risk: [4, 14, 2, 1, 2, 0, 2], perf: [58, 33, 60, 56, 42, 48, 53] },
  { short: 'J. Okafor', pos: 'ATT', risk: [2, 7, 3, 3, 4, 3, 3], perf: [56, 45, 66, 59, 32, 64, 66] },
  { short: 'R. Silva', pos: 'ATT', risk: [1, 0, 3, 4, 4, 4, 1], perf: [54, 30, 58, 53, 26, 53, 58] },
  { short: 'P. Nieminen', pos: 'MD', risk: [2, 1, 3, 2, 4, 3, 2], perf: [50, 53, 49, 51, 41, 46, 54] },
  { short: 'B. Traoré', pos: 'LAT', risk: [0, 0, 2, 2, 3, 1, 5], perf: [53, 38, 46, 46, 26, 57, 54] },
  { short: 'C. Rossi', pos: 'DC', risk: [2, 0, 1, 0, 6, 0, 0], perf: [52, 38, 51, 47, 31, 46, 53] },
  { short: 'H. Yilmaz', pos: 'MD', risk: [1, 0, 1, 0, 0, 3, 0], perf: [52, 52, 44, 51, 50, 46, 50] },
  { short: 'F. Dumont', pos: 'MO', risk: [3, 0, 0, 0, 0, 0, 3], perf: [61, 40, 59, 54, 33, 56, 67] },
  { short: 'G. Petrov', pos: 'LAT', risk: [0, 2, 1, 0, 0, 0, 3], perf: [57, 47, 45, 53, 59, 52, 50] },
  { short: 'V. Mensah', pos: 'MO', risk: [2, 0, 2, 0, 0, 0, 2], perf: [51, 51, 51, 52, 51, 48, 52] },
  { short: 'I. Berger', pos: 'AIL', risk: [0, 0, 0, 1, 4, 0, 0], perf: [59, 46, 56, 55, 45, 45, 61] },
  { short: 'Q. Laurent', pos: 'ATT', risk: null, perf: null },
  { short: 'A. Keller', pos: 'DC', risk: null, perf: null },
  { short: 'Y. Diallo', pos: 'LAT', risk: null, perf: null },
  { short: 'M. Costa', pos: 'AIL', risk: null, perf: null },
  { short: 'N. Bakker', pos: 'GK', risk: null, perf: null },
  { short: 'T. Novak', pos: 'GK', risk: null, perf: null },
];
const scored = squad.filter((p) => p.risk);
scored.forEach((p) => { p.rm = mean(p.risk); p.pm = mean(p.perf); });

// GPS: per-session means per player over the week (outfield players, 22).
// Columns: sessions, total distance (m), HMLD (m), HSR (m), explosive distance (m)
const gps = {
  'M. Ferreira': [4, 2940, 393, 128, 262], 'J. Okafor': [5, 2980, 318, 121, 214], 'R. Silva': [5, 2850, 301, 112, 208], 'Q. Laurent': [5, 2850, 308, 111, 216],
  'T. Lindqvist': [3, 4020, 512, 188, 336], 'A. Moreau': [5, 2610, 372, 126, 251], 'I. Berger': [5, 2550, 368, 124, 248], 'M. Costa': [0, 0, 0, 0, 0],
  'K. Osei': [5, 3420, 625, 151, 468], 'S. Kowalczyk': [5, 3180, 571, 139, 431], 'F. Dumont': [5, 3150, 566, 140, 437], 'V. Mensah': [5, 3090, 558, 138, 424],
  'E. Haddad': [5, 2960, 381, 131, 246], 'B. Traoré': [5, 2900, 370, 125, 238], 'G. Petrov': [5, 2840, 365, 122, 236], 'Y. Diallo': [0, 0, 0, 0, 0],
  'P. Nieminen': [5, 2420, 256, 66, 174], 'H. Yilmaz': [5, 2340, 244, 62, 166],
  'L. Brandt': [5, 2700, 318, 61, 259], 'D. Varga': [5, 2680, 314, 58, 256], 'C. Rossi': [5, 2600, 304, 55, 250], 'A. Keller': [0, 0, 0, 0, 0],
};

// Weekly team load (session-RPE, arbitrary units) for weeks 5 to 10, and chronic (4-week rolling mean).
const weeks = t(['S5', 'S6', 'S7', 'S8', 'S9', 'S10'], ['W5', 'W6', 'W7', 'W8', 'W9', 'W10']);
const teamLoad = [2310, 2480, 2390, 2620, 2150, 2710];
const chronic = [2280, 2340, 2370, 2450, 2410, 2468];

// ACWR per player over weeks 5-10 (shown for the focus players and the team median).
const acwr = {
  'T. Lindqvist': [0.94, 1.02, 0.98, 1.11, 1.18, 1.52],
  'M. Ferreira': [1.01, 0.96, 1.04, 1.12, 0.99, 1.08],
  'Équipe (médiane)': [0.98, 1.03, 0.99, 1.06, 0.89, 1.09],
};
// This week's ACWR for the 18 scored players (x of the scatter).
const acwrNow = {
  'M. Ferreira': 1.08, 'T. Lindqvist': 1.52, 'A. Moreau': 1.21, 'K. Osei': 1.34, 'D. Varga': 0.97, 'L. Brandt': 1.02,
  'S. Kowalczyk': 1.12, 'E. Haddad': 1.05, 'J. Okafor': 0.93, 'R. Silva': 0.88, 'P. Nieminen': 1.0, 'B. Traoré': 1.07,
  'C. Rossi': 0.91, 'H. Yilmaz': 0.95, 'F. Dumont': 1.15, 'G. Petrov': 0.99, 'V. Mensah': 1.03, 'I. Berger': 1.1,
};

// Wellness (1 = good, 10 = bad), daily, 2 indicators collected this week. Sleep not collected.
const wellness = {
  fatigue: {
    'T. Lindqvist': [4, 5, 6, 7, 8, 7, 6], 'K. Osei': [3, 4, 5, 6, 6, 5, 5], 'M. Ferreira': [3, 3, 4, 5, 6, 6, 5],
    'A. Moreau': [4, 4, 5, 5, 5, 6, 5], 'S. Kowalczyk': [3, 3, 4, 5, 6, 4, 4], 'F. Dumont': [3, 4, 4, 5, 5, 4, 4],
  },
  teamMedianFatigue: [3, 3, 4, 4, 5, 4, 4],
  // weekly means for the 18 scored players
  meanFatigue: { 'T. Lindqvist': 6.1, 'K. Osei': 4.9, 'M. Ferreira': 4.6, 'A. Moreau': 4.9, 'S. Kowalczyk': 4.1, 'F. Dumont': 4.1, 'D. Varga': 3.6, 'L. Brandt': 3.4, 'E. Haddad': 3.9, 'J. Okafor': 3.3, 'R. Silva': 3.1, 'P. Nieminen': 3.0, 'B. Traoré': 3.7, 'C. Rossi': 2.9, 'H. Yilmaz': 2.7, 'G. Petrov': 3.2, 'V. Mensah': 3.5, 'I. Berger': 3.8 },
  meanSoreness: { 'T. Lindqvist': 5.7, 'K. Osei': 4.4, 'M. Ferreira': 5.3, 'A. Moreau': 3.9, 'S. Kowalczyk': 3.6, 'F. Dumont': 3.8, 'D. Varga': 3.1, 'L. Brandt': 3.3, 'E. Haddad': 3.5, 'J. Okafor': 3.0, 'R. Silva': 2.8, 'P. Nieminen': 2.6, 'B. Traoré': 3.2, 'C. Rossi': 2.7, 'H. Yilmaz': 2.5, 'G. Petrov': 2.9, 'V. Mensah': 3.0, 'I. Berger': 3.4 },
};

// Availability of the 24-player squad per day: [available, modified training, unavailable]
const availability = [[19, 2, 3], [19, 2, 3], [20, 1, 3], [20, 1, 3], [21, 0, 3], [20, 1, 3], [21, 0, 3]];

// Injury log (weeks numbered; week 10 = current week). end = expected return week when ongoing.
const injuries = [
  { who: 'A. Keller', what: t('Ischio-jambiers', 'Hamstring'), start: 6.4, end: 11.2, ongoing: true, phase: t('Reprise individuelle', 'Individual return') },
  { who: 'Y. Diallo', what: t('Entorse de cheville', 'Ankle sprain'), start: 8.2, end: 12.3, ongoing: true, phase: t('Réathlétisation', 'Reconditioning') },
  { who: 'M. Costa', what: t('Adducteurs', 'Adductors'), start: 9.1, end: 11.4, ongoing: true, phase: t('Reprise individuelle', 'Individual return') },
  { who: 'Q. Laurent', what: t('Contusion genou', 'Knee contusion'), start: 4.3, end: 6.1, ongoing: false, phase: t('Rétabli', 'Recovered') },
];

// Match, Saturday 7 March, matchday 26. Minutes and physical output.
const match = {
  label: t('Journée 26, samedi 7 mars, victoire 2-1', 'Matchday 26, Saturday 7 March, won 2-1'),
  minutes: { 'L. Brandt': 90, 'D. Varga': 90, 'E. Haddad': 90, 'G. Petrov': 90, 'P. Nieminen': 90, 'K. Osei': 90, 'J. Okafor': 84, 'A. Moreau': 78, 'S. Kowalczyk': 71, 'M. Ferreira': 64, 'F. Dumont': 26, 'R. Silva': 19, 'I. Berger': 12, 'H. Yilmaz': 6 },
  // distance (m), HSR (m), sprints, top speed (km/h) — starters only
  physical: {
    'K. Osei': [11840, 912, 24, 31.2], 'P. Nieminen': [11210, 604, 12, 28.4], 'E. Haddad': [10960, 1018, 29, 33.1], 'G. Petrov': [10720, 944, 26, 32.6],
    'J. Okafor': [9980, 822, 22, 32.9], 'A. Moreau': [9410, 860, 25, 33.4], 'S. Kowalczyk': [8860, 655, 17, 30.1], 'L. Brandt': [9720, 402, 9, 29.8],
    'D. Varga': [9640, 388, 8, 30.2], 'M. Ferreira': [7120, 590, 18, 32.2],
  },
};

// Model drivers (share of explained risk, %) for the method page.
const drivers = t(
  [['Charge aiguë sur 7 jours', 24], ['Rapport aigu/chronique (ACWR)', 19], ['Historique de blessure', 16], ['Distance à haute vitesse', 12], ['Fatigue déclarée', 9]],
  [['Acute load, 7 days', 24], ['Acute:chronic ratio (ACWR)', 19], ['Injury history', 16], ['High-speed distance', 12], ['Reported fatigue', 9]]);

module.exports = { DAYS, DAY_LETTERS, POSITIONS, POSITIONS_PLURAL, squad, scored, gps, weeks, teamLoad, chronic, acwr, acwrNow, wellness, availability, injuries, match, drivers };
