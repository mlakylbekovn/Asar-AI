import test from 'node:test';
import assert from 'node:assert/strict';
import { aStar, eligible, rankVolunteers, assignBatch, validPublicText, suggestCategory, agentNextStep } from '../src/engine.js';
import { initialVolunteers } from '../src/data.js';
const req = { id:'t1', category:'food', area:'Есіл', when:'Бүгін', status:'open' };
test('A* same area is zero', () => assert.deepEqual(aStar('Есіл','Есіл').path,['Есіл']));
test('A* finds a connected route', () => assert.ok(aStar('Нұра','Алматы').path.length > 1));
test('A* computes nonnegative cost', () => assert.ok(aStar('Есіл','Байқоңыр').cost > 0));
test('A* rejects invalid area', () => assert.equal(aStar('Жоқ','Есіл'), null));
test('CSP excludes unavailable volunteer', () => assert.equal(eligible(req, initialVolunteers[5]), false));
test('CSP excludes skill mismatch', () => assert.equal(eligible(req, initialVolunteers[2]), false));
test('CSP excludes time mismatch', () => assert.equal(eligible({...req,when:'Апта ішінде'}, initialVolunteers[3]), false));
test('Ranking is sorted descending', () => { const r = rankVolunteers(req,initialVolunteers); assert.ok(r.every((v,i)=>i===0||r[i-1].score>=v.score)); });
test('Batch CSP does not assign same-timeslot volunteer twice', () => {
  const v = [initialVolunteers[0]];
  const requests = [ {...req,id:'t1'}, {...req,id:'t2'} ];
  assert.equal(assignBatch(requests,v).length,1);
});
test('Agent proposes when volunteers exist', () => assert.equal(agentNextStep(req,initialVolunteers).action,'PROPOSE'));
test('Agent queues when no volunteers exist', () => assert.equal(agentNextStep(req,[]).action,'QUEUE'));
test('Agent waits for requester confirmation', () => assert.equal(agentNextStep({...req,status:'awaiting_confirmation'}, initialVolunteers).action,'CONFIRM'));
test('Sensitive phone is rejected', () => assert.equal(validPublicText('Менің телефоным +77011234567'),false));
test('Sensitive IIN rejected', () => assert.equal(validPublicText('ЖСН 123456789012'),false));
test('Safe help request accepted', () => assert.equal(validPublicText('Азық-түлік әкелуге көмек керек'),true));
test('Simple category suggestion works', () => assert.equal(suggestCategory('Математика сабағына көмек'), 'study'));

// 6-апта — Bayesian inference
import { bayesianAcceptance, estimateAcceptance, inferDemandHMM, demandForecastFromRequests, demandObservation, DEMAND_HMM } from '../src/engine.js';
test('Bayesian prior with no observations remains prior', () => {
  const b = bayesianAcceptance({});
  assert.ok(Math.abs(b.probability - b.prior) < 1e-12);
});
test('Bayesian exact posterior matches manual Bayes numerator and denominator', () => {
  const p = 0.45 * 0.75 * 0.8 * 0.6;
  const n = 0.55 * 0.35 * 0.5 * 0.45;
  const b = bayesianAcceptance({ nearby:true,lowLoad:true,today:true });
  assert.ok(Math.abs(b.probability - p / (p+n)) < 1e-12);
});
test('Bayesian favorable evidence raises acceptance probability', () => {
  const better = bayesianAcceptance({nearby:true,lowLoad:true,today:true}).probability;
  const worse = bayesianAcceptance({nearby:false,lowLoad:false,today:false}).probability;
  assert.ok(better > worse);
});
test('Bayesian partially observed evidence is supported', () => {
  const b = bayesianAcceptance({nearby:true});
  assert.equal(b.evidence.length, 1);
  assert.ok(b.probability > 0 && b.probability < 1);
});
test('Bayesian rejects invalid evidence type', () => assert.throws(() => bayesianAcceptance({nearby:1}), TypeError));
test('Bayesian volunteer estimate is numeric and linked to route', () => {
  const e = estimateAcceptance(req, initialVolunteers[0]);
  assert.ok(e.probability > 0 && e.probability < 1);
  assert.equal(e.routeCost,0);
});

// 7-апта — HMM: normalized Forward + Viterbi path.
test('HMM observation count bins are correct', () => {
  assert.deepEqual([0,1,2,3,4,7].map(demandObservation), [0,0,1,1,2,2]);
});
test('HMM rejects negative counts', () => assert.throws(() => inferDemandHMM([1,-1]), RangeError));
test('HMM normalizes each posterior and next-state distribution', () => {
  const f = inferDemandHMM([1,2,5,5,3,0,4]);
  for (const row of [...f.trace,f.nextProbabilities]) {
    assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-10);
    assert.ok(row.every(x=>x>=0&&x<=1));
  }
});
test('HMM Viterbi path length equals observation series length', () => {
  assert.equal(inferDemandHMM([0,3,5,2,1,6]).viterbiPath.length,6);
});
test('HMM repeated busy observations imply high load more than repeated quiet', () => {
  const busy = inferDemandHMM([7,7,7,7,7]).posterior[2];
  const quiet = inferDemandHMM([0,0,0,0,0]).posterior[2];
  assert.ok(busy > quiet);
});
test('HMM empty observation series has valid initial distribution', () => {
  const f = inferDemandHMM([]);
  assert.equal(f.viterbiPath.length,0);
  assert.ok(Math.abs(f.posterior.reduce((a,b)=>a+b,0)-1)<1e-10);
});
test('HMM demo forecast reflects local currently open requests', () => {
  const demo = [{status:'open'}, {status:'open'}, {status:'completed'}];
  const f = demandForecastFromRequests(demo,'normal');
  assert.equal(f.counts[f.counts.length-1],2);
  assert.equal(f.counts.length,7);
});
test('HMM transition and emission rows each sum to one', () => {
  for (const row of [...DEMAND_HMM.transition,...DEMAND_HMM.emission])
    assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-12);
});

test('HMM first Forward update uses initial rather than transition', () => {
  const f = inferDemandHMM([0]);
  const raw = DEMAND_HMM.initial.map((p,s)=>p*DEMAND_HMM.emission[s][0]);
  const total = raw.reduce((a,b)=>a+b,0);
  f.posterior.forEach((p,i)=>assert.ok(Math.abs(p-raw[i]/total)<1e-12));
});
