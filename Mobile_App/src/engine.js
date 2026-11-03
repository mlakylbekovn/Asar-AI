/** ASAR AI: deterministic, explainable prototype logic. No external service calls. */
export const AREAS = ['Есіл', 'Нұра', 'Алматы', 'Сарыарқа', 'Байқоңыр'];
export const CATEGORIES = [
  { id: 'food', label: 'Азық-түлік', emoji: '🥬', soft: '#E5F6ED', color: '#237C57' },
  { id: 'delivery', label: 'Жеткізу', emoji: '📦', soft: '#E9F2FF', color: '#356DBA' },
  { id: 'study', label: 'Оқуға көмек', emoji: '📚', soft: '#F1EAFE', color: '#7857BB' },
  { id: 'support', label: 'Қолдау', emoji: '💛', soft: '#FFF3DF', color: '#C58B2D' },
  { id: 'community', label: 'Қоғамдық іс', emoji: '🌿', soft: '#E6F7F3', color: '#278B82' },
];
export const TIMES = ['Бүгін', 'Ертең', 'Апта ішінде'];
const coords = {
  'Есіл': [0, 0], 'Нұра': [1, 2], 'Алматы': [4, -1],
  'Сарыарқа': [3, 3], 'Байқоңыр': [5, 2],
};
export const ROAD_GRAPH = {
  'Есіл': { 'Нұра': 2.7, 'Алматы': 4.9, 'Сарыарқа': 4.8 },
  'Нұра': { 'Есіл': 2.7, 'Сарыарқа': 2.6, 'Байқоңыр': 4.8 },
  'Алматы': { 'Есіл': 4.9, 'Байқоңыр': 3.5, 'Сарыарқа': 4.2 },
  'Сарыарқа': { 'Нұра': 2.6, 'Есіл': 4.8, 'Алматы': 4.2, 'Байқоңыр': 2.7 },
  'Байқоңыр': { 'Алматы': 3.5, 'Сарыарқа': 2.7, 'Нұра': 4.8 },
};
const heuristic = (a, b) => Math.hypot(coords[a][0] - coords[b][0], coords[a][1] - coords[b][1]);

/** A* on a symbolic graph. Edge costs are abstract demo units, NOT real street distances. */
export function aStar(start, goal) {
  if (!ROAD_GRAPH[start] || !ROAD_GRAPH[goal]) return null;
  if (start === goal) return { path: [start], cost: 0, explored: 1 };
  const open = new Set([start]);
  const from = {};
  const g = { [start]: 0 };
  const f = { [start]: heuristic(start, goal) };
  let explored = 0;
  while (open.size > 0) {
    let curr = null;
    for (const node of open) if (curr === null || f[node] < f[curr]) curr = node;
    explored++;
    if (curr === goal) {
      const path = [curr];
      while (from[curr]) { curr = from[curr]; path.unshift(curr); }
      return { path, cost: Math.round(g[goal] * 10) / 10, explored };
    }
    open.delete(curr);
    for (const [next, weight] of Object.entries(ROAD_GRAPH[curr])) {
      const candidate = g[curr] + weight;
      if (candidate < (g[next] ?? Infinity)) {
        from[next] = curr;
        g[next] = candidate;
        f[next] = candidate + heuristic(next, goal);
        open.add(next);
      }
    }
  }
  return null;
}

export function validPublicText(value) {
  if (typeof value !== 'string') return false;
  const patterns = [
    /(?:\+?7|8)[\s()\-]*(?:\d[\s()\-]*){10}\b/u,
    /\b\d{12}\b/u,                    // Kazakh IIN/BIN
    /\b(?:\d[ -]*?){16}\b/u,          // potential bank card number
    /(?:пароль|құпиясөз|sms\s*код|бір реттік код)\s*[:=]\s*\S+/iu,
  ];
  return !patterns.some(re => re.test(value));
}

/** Transparent keyword recommendation, not trained ML. */
export function suggestCategory(text = '') {
  const t = text.toLowerCase();
  const rules = [
    ['food', /азық|дүкен|тағам|тамақ|нан|дәріхана емес/u],
    ['delivery', /апарып|әкеліп|жеткіз|тасымал|сәлемдем|пакет/u],
    ['study', /сабақ|үйрет|математ|оқу|емтихан|кітап/u],
    ['support', /жалғыз|сөйлес|қолдау|әңгіме|ақыл/u],
    ['community', /сенбілік|тазала|аула|ағаш|қоғам/u],
  ];
  return rules.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** Hard constraints: skills, availability, time and capacity. */
export function eligible(request, volunteer, activeAssignments = []) {
  if (!volunteer.available || !volunteer.skills.includes(request.category)) return false;
  if (!volunteer.times.includes(request.when)) return false;
  const active = activeAssignments.filter(x => x.volunteerId === volunteer.id);
  if ((volunteer.load || 0) + active.length >= (volunteer.capacity || 1)) return false;
  if (active.some(x => x.when === request.when)) return false;
  return true;
}

/** Rank only feasible volunteers by route, load, declared skills. */
export function rankVolunteers(request, volunteers, assignments = []) {
  return volunteers.filter(v => eligible(request, v, assignments)).map(v => {
    const route = aStar(v.area, request.area);
    const score = Math.max(1, Math.min(99,
      Math.round(94 - (route?.cost || 0) * 5.5 - (v.load || 0) * 8 + (v.area === request.area ? 5 : 0))));
    return { ...v, score, route, bayes: estimateAcceptance(request, v), reason: [
      'Көмек түрі сәйкес', 'Уақыты қолайлы', v.area === request.area ? 'Бір ауданда' : 'Маршрут есептелді'
    ] };
  }).sort((a, b) => b.score - a.score);
}

/** Backtracking CSP: a volunteer can take at most one same-timeslot task. */
export function assignBatch(requests, volunteers) {
  const open = requests.filter(r => r.status === 'open').slice(0, 8);
  let best = { value: -1, assignments: [] };
  function search(i, chosen, value) {
    if (i === open.length) {
      if (value > best.value) best = { value, assignments: chosen.slice() };
      return;
    }
    const req = open[i];
    // Leaving a request unassigned is valid when capacity is insufficient.
    search(i + 1, chosen, value);
    for (const v of rankVolunteers(req, volunteers, chosen)) {
      const entry = { requestId: req.id, volunteerId: v.id, when: req.when, score: v.score };
      chosen.push(entry);
      search(i + 1, chosen, value + 100 + v.score);
      chosen.pop();
    }
  }
  search(0, [], 0);
  return best.assignments;
}

/** Minimal goal-oriented intelligent agent with explainable next action. */
export function agentNextStep(request, volunteers) {
  if (!request) return { action: 'WAIT', reason: 'Өтініш таңдалмаған' };
  if (request.status === 'completed') return { action: 'CLOSE', reason: 'Көмек расталды' };
  if (request.status === 'awaiting_confirmation') return { action: 'CONFIRM', reason: 'Өтініш иесінің растауы қажет' };
  if (request.status === 'in_progress') return { action: 'FOLLOW_UP', reason: 'Ерікті көмек көрсетіп жатыр' };
  const matches = rankVolunteers(request, volunteers);
  if (!matches.length) return { action: 'QUEUE', reason: 'Қазір қолайлы ерікті жоқ' };
  return { action: 'PROPOSE', reason: `${matches.length} сәйкес ерікті табылды`, candidate: matches[0].id };
}

/**
 * 6-АПТА — Bayesian Network (Naive Bayes үлгісіндегі нақты шартты есеп).
 * The hidden node A=offer accepted is the parent of three observed binary nodes.
 * P(A | E) = P(A) prod P(E_i | A) /
 *              [P(A) prod P(E_i | A) + P(not A) prod P(E_i | not A)].
 * ALL CPT probabilities are synthetic demo assumptions, NOT learned from users.
 * A probability is not a guarantee or a verified volunteer reliability rating.
 */
export const BAYES_MODEL = Object.freeze({
  priorAccepted: 0.45,
  features: Object.freeze({
    nearby:   { acceptedTrue: 0.75, declinedTrue: 0.35, label: 'Маршрут жақын (≤3 шартты бірлік)' },
    lowLoad:  { acceptedTrue: 0.80, declinedTrue: 0.50, label: 'Еріктінің жүктемесі төмен' },
    today:    { acceptedTrue: 0.60, declinedTrue: 0.45, label: 'Тапсырма бүгін' },
  }),
});
export function bayesianAcceptance(evidence = {}, model = BAYES_MODEL) {
  const prior = model.priorAccepted;
  if (!(prior > 0 && prior < 1)) throw new RangeError('Invalid Bayesian prior');
  let likelihoodAccepted = 1, likelihoodDeclined = 1;
  const usedEvidence = [];
  for (const [key, cpt] of Object.entries(model.features)) {
    const observed = evidence[key];
    if (observed === undefined || observed === null) continue; // missing evidence is marginalized
    if (typeof observed !== 'boolean') throw new TypeError(`${key} must be boolean`);
    const pYes = observed ? cpt.acceptedTrue : 1 - cpt.acceptedTrue;
    const pNo = observed ? cpt.declinedTrue : 1 - cpt.declinedTrue;
    if (!(pYes >= 0 && pYes <= 1 && pNo >= 0 && pNo <= 1)) throw new RangeError('Invalid CPT');
    likelihoodAccepted *= pYes;
    likelihoodDeclined *= pNo;
    usedEvidence.push({ key, label: cpt.label, value: observed, pIfAccepted: pYes, pIfDeclined: pNo });
  }
  const acceptedJoint = prior * likelihoodAccepted;
  const declinedJoint = (1 - prior) * likelihoodDeclined;
  const normalizer = acceptedJoint + declinedJoint;
  if (!(normalizer > 0)) throw new RangeError('Impossible Bayesian evidence');
  return {
    prior, probability: acceptedJoint / normalizer,
    likelihoodAccepted, likelihoodDeclined, evidence: usedEvidence,
  };
}
export function estimateAcceptance(request, volunteer) {
  const route = aStar(volunteer.area, request.area);
  if (!route) return null;
  const observed = {
    nearby: route.cost <= 3,
    lowLoad: (volunteer.load || 0) === 0,
    today: request.when === 'Бүгін',
  };
  return { ...bayesianAcceptance(observed), observed, routeCost: route.cost };
}

/**
 * 7-АПТА — discrete Hidden Markov Model for aggregate help-demand backlog.
 * Hidden states: low, medium, high community load.
 * Observable categories: open requests count <=1, 2..3, >=4.
 * Forward: alpha_t(j) proportional to emission(j,o_t)*sum_i alpha_(t-1)(i)*T(i,j).
 * Viterbi: max-product (log-domain) estimates a most likely hidden state path.
 * Transition and emission matrices are SYNTHETIC demo assumptions.
 */
export const DEMAND_HMM = Object.freeze({
  states: ['Төмен', 'Орташа', 'Жоғары'],
  observations: ['Аз', 'Қалыпты', 'Көп'],
  initial: [0.55, 0.32, 0.13],
  transition: [
    [0.74, 0.23, 0.03],
    [0.18, 0.65, 0.17],
    [0.05, 0.25, 0.70],
  ],
  emission: [
    [0.78, 0.20, 0.02],
    [0.15, 0.68, 0.17],
    [0.04, 0.24, 0.72],
  ],
});
const normalize = a => {
  const z = a.reduce((sum, x) => sum + x, 0);
  if (!(z > 0)) throw new RangeError('Impossible HMM observation');
  return a.map(x => x / z);
};
export function demandObservation(count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Request count must be a nonnegative integer');
  return count <= 1 ? 0 : count <= 3 ? 1 : 2;
}
export function inferDemandHMM(counts, model = DEMAND_HMM) {
  if (!Array.isArray(counts) || counts.length > 365) throw new RangeError('Invalid HMM series');
  const obs = counts.map(demandObservation);
  const n = model.states.length;
  const trace = [];
  let belief = normalize(model.initial.slice());
  for (let t = 0; t < obs.length; t++) {
    // t=0 uses the initial state distribution; subsequent steps predict via T.
    const predicted = t === 0 ? belief : belief.map((_, j) =>
      belief.reduce((acc, p, i) => acc + p * model.transition[i][j], 0));
    belief = normalize(predicted.map((p, j) => p * model.emission[j][obs[t]]));
    trace.push(belief.slice());
  }
  const nextProbabilities = normalize(belief.map((_, j) =>
    belief.reduce((acc, p, i) => acc + p * model.transition[i][j], 0)));
  let path = [];
  if (obs.length) {
    let prev = model.initial.map((p, s) => Math.log(p) + Math.log(model.emission[s][obs[0]]));
    const back = [];
    for (let t = 1; t < obs.length; t++) {
      const ptr = [];
      const next = [];
      for (let j = 0; j < n; j++) {
        let arg = 0, best = -Infinity;
        for (let i = 0; i < n; i++) {
          const v = prev[i] + Math.log(model.transition[i][j]);
          if (v > best) { best = v; arg = i; }
        }
        next[j] = best + Math.log(model.emission[j][obs[t]]);
        ptr[j] = arg;
      }
      back.push(ptr);
      prev = next;
    }
    let state = prev.indexOf(Math.max(...prev));
    path = [state];
    for (let t = back.length - 1; t >= 0; t--) {
      state = back[t][state];
      path.unshift(state);
    }
  }
  const current = belief.indexOf(Math.max(...belief));
  const next = nextProbabilities.indexOf(Math.max(...nextProbabilities));
  return {
    counts: counts.slice(), observationIndices: obs,
    observationLabels: obs.map(i => model.observations[i]),
    trace, posterior: belief,
    currentState: model.states[current], currentStateIndex: current,
    nextProbabilities, nextState: model.states[next], nextStateIndex: next,
    viterbiPath: path.map(i => model.states[i]),
  };
}
/** Synthetic backlog snapshots for six past periods + the live local current backlog. */
export const DEMO_DEMAND_HISTORY = Object.freeze({
  quiet: [0, 1, 1, 0, 2, 1],
  normal: [1, 2, 1, 3, 2, 3],
  busy: [2, 4, 5, 6, 4, 7],
});
export function demandForecastFromRequests(requests, scenario = 'normal') {
  const history = DEMO_DEMAND_HISTORY[scenario];
  if (!history) throw new RangeError('Unknown demand scenario');
  const currentOpen = requests.filter(r => r.status === 'open').length;
  return inferDemandHMM([...history, currentOpen]);
}
