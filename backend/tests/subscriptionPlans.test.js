import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUBSCRIPTION_PLANS,
  getMonthlyPlanPrice,
  getPlanById,
  getPlanLimits,
  getStripePriceId,
} from '../src/utils/subscriptionPlans.js';

test('returns expected plan by id', () => {
  const basic = getPlanById('basic');
  const professional = getPlanById('professional');
  const enterprise = getPlanById('enterprise');

  assert.equal(basic?.id, 'basic');
  assert.equal(professional?.id, 'professional');
  assert.equal(enterprise?.id, 'enterprise');
});

test('returns null or fallback values for unknown plans', () => {
  assert.equal(getPlanById('unknown'), null);
  assert.equal(getMonthlyPlanPrice('unknown'), 0);
  assert.equal(getPlanLimits('unknown'), null);
  assert.equal(getStripePriceId('unknown'), null);
});

test('exposes correct monthly prices and limits', () => {
  assert.equal(getMonthlyPlanPrice('basic'), 2999);
  assert.equal(getMonthlyPlanPrice('professional'), 7999);
  assert.equal(getMonthlyPlanPrice('enterprise'), 19999);

  assert.deepEqual(getPlanLimits('basic'), { doctors: 5, monthlyAppointments: 500 });
  assert.deepEqual(getPlanLimits('professional'), { doctors: 25, monthlyAppointments: 2500 });
  assert.deepEqual(getPlanLimits('enterprise'), { doctors: null, monthlyAppointments: null });
});

test('plan catalog includes expected ids', () => {
  const planIds = Object.keys(SUBSCRIPTION_PLANS).sort();
  assert.deepEqual(planIds, ['basic', 'enterprise', 'professional']);
});
