import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSubscriptionSnapshot,
  createTrialWindow,
  evaluateAndSyncSubscriptionState,
  getEffectivePlanId,
  isDateInFuture,
} from '../src/services/subscription.service.js';
import { TRIAL_DURATION_DAYS, TRIAL_PLAN } from '../src/utils/subscriptionPlans.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const createHospitalMock = (overrides = {}) => {
  const hospital = {
    subscriptionStatus: 'inactive',
    subscriptionPlan: null,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    trialStartDate: null,
    trialEndDate: null,
    trialUsed: false,
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    },
    ...overrides,
  };

  return hospital;
};

test('createTrialWindow creates a trial ending after configured duration', () => {
  const start = new Date('2026-03-01T00:00:00.000Z');
  const { trialStartDate, trialEndDate } = createTrialWindow(start);

  assert.equal(trialStartDate.toISOString(), start.toISOString());

  const diffDays = Math.round((trialEndDate.getTime() - trialStartDate.getTime()) / DAY_MS);
  assert.equal(diffDays, TRIAL_DURATION_DAYS);
});

test('isDateInFuture returns correct boolean values', () => {
  const future = new Date(Date.now() + DAY_MS);
  const past = new Date(Date.now() - DAY_MS);

  assert.equal(isDateInFuture(future), true);
  assert.equal(isDateInFuture(past), false);
  assert.equal(isDateInFuture(null), false);
});

test('getEffectivePlanId resolves active paid plan', () => {
  const hospital = createHospitalMock({
    subscriptionStatus: 'active',
    subscriptionPlan: 'basic',
  });

  assert.equal(getEffectivePlanId(hospital), 'basic');
});

test('getEffectivePlanId resolves trial plan when trial is active', () => {
  const hospital = createHospitalMock({
    subscriptionStatus: 'trial',
    trialEndDate: new Date(Date.now() + DAY_MS),
  });

  assert.equal(getEffectivePlanId(hospital), TRIAL_PLAN);
});

test('evaluateAndSyncSubscriptionState keeps access for active paid subscription', async () => {
  const hospital = createHospitalMock({
    subscriptionStatus: 'active',
    subscriptionPlan: 'professional',
    subscriptionEndDate: new Date(Date.now() + DAY_MS),
    trialUsed: true,
  });

  const result = await evaluateAndSyncSubscriptionState(hospital);

  assert.equal(result.hasAccess, true);
  assert.equal(result.effectivePlanId, 'professional');
  assert.equal(result.reason, null);
  assert.equal(hospital.saveCalls, 0);
});

test('evaluateAndSyncSubscriptionState keeps access for active trial subscription', async () => {
  const hospital = createHospitalMock({
    subscriptionStatus: 'trial',
    trialEndDate: new Date(Date.now() + DAY_MS),
    trialUsed: true,
  });

  const result = await evaluateAndSyncSubscriptionState(hospital);

  assert.equal(result.hasAccess, true);
  assert.equal(result.isTrial, true);
  assert.equal(result.effectivePlanId, TRIAL_PLAN);
  assert.equal(hospital.saveCalls, 0);
});

test('evaluateAndSyncSubscriptionState starts trial once for trial-eligible hospital', async () => {
  const hospital = createHospitalMock({
    subscriptionStatus: 'inactive',
    trialUsed: false,
  });

  const result = await evaluateAndSyncSubscriptionState(hospital);

  assert.equal(result.hasAccess, true);
  assert.equal(result.isTrial, true);
  assert.equal(hospital.subscriptionStatus, 'trial');
  assert.equal(hospital.trialUsed, true);
  assert.ok(hospital.trialStartDate instanceof Date);
  assert.ok(hospital.trialEndDate instanceof Date);
  assert.equal(hospital.saveCalls, 1);
});

test('evaluateAndSyncSubscriptionState expires access when trial has ended and already used', async () => {
  const hospital = createHospitalMock({
    subscriptionStatus: 'trial',
    trialEndDate: new Date(Date.now() - DAY_MS),
    trialUsed: true,
  });

  const result = await evaluateAndSyncSubscriptionState(hospital);

  assert.equal(result.hasAccess, false);
  assert.equal(hospital.subscriptionStatus, 'expired');
  assert.equal(result.reason?.includes('Subscription is required'), true);
  assert.equal(hospital.saveCalls, 1);
});

test('buildSubscriptionSnapshot returns expected revenue and access flags for paid plan', () => {
  const hospital = createHospitalMock({
    subscriptionStatus: 'active',
    subscriptionPlan: 'basic',
    subscriptionEndDate: new Date(Date.now() + DAY_MS),
  });

  const snapshot = buildSubscriptionSnapshot(hospital);

  assert.equal(snapshot.status, 'active');
  assert.equal(snapshot.currentPlan, 'basic');
  assert.equal(snapshot.effectivePlan, 'basic');
  assert.equal(snapshot.hasAccess, true);
  assert.equal(snapshot.estimatedMonthlyRevenue, 29.99);
});
