import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import Hospital from '../src/models/hospital.model.js';
import {
  __setStripeClientForTests,
  cancelSubscription,
  createSubscriptionCheckout,
  getSubscriptionDetails,
  handleSubscriptionWebhook,
  updateSubscriptionPlan,
} from '../src/controllers/subscription.controller.js';

const createResponseMock = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return res;
};

let originalConsoleLog;

beforeEach(() => {
  originalConsoleLog = console.log;
  console.log = () => {};
});

afterEach(() => {
  console.log = originalConsoleLog;
});

test('createSubscriptionCheckout rejects invalid plan type', async () => {
  const req = {
    body: {
      hospitalId: 'hospital-1',
      planType: 'invalid-plan',
      hospitalEmail: 'test@hospital.com',
      hospitalName: 'Test Hospital',
    },
  };
  const res = createResponseMock();

  await createSubscriptionCheckout(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(String(res.body?.error).includes('Invalid plan type'), true);
});

test('updateSubscriptionPlan rejects invalid plan type', async () => {
  const req = {
    params: { hospitalId: 'hospital-1' },
    body: { newPlanType: 'not-valid' },
    user: { userType: 'hospital_admin', hospitalId: 'hospital-1' },
  };
  const res = createResponseMock();

  await updateSubscriptionPlan(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error, 'Invalid plan type');
});

test('getSubscriptionDetails denies access for wrong hospital admin', async () => {
  const req = {
    params: { hospitalId: 'hospital-1' },
    user: { userType: 'hospital_admin', hospitalId: 'hospital-2' },
  };
  const res = createResponseMock();

  await getSubscriptionDetails(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error, 'Access denied');
});

test('getSubscriptionDetails returns trial-aware subscription details', async () => {
  const originalFindById = Hospital.findById;

  const hospitalDoc = {
    _id: 'hospital-1',
    subscriptionStatus: 'trial',
    subscriptionPlan: null,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    trialStartDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    trialEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    trialUsed: true,
    async save() {
      return this;
    },
  };

  Hospital.findById = () => ({
    select: async () => hospitalDoc,
  });

  const req = {
    params: { hospitalId: 'hospital-1' },
    user: { userType: 'hospital_admin', hospitalId: 'hospital-1' },
  };
  const res = createResponseMock();

  try {
    await getSubscriptionDetails(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.hospitalId, 'hospital-1');
    assert.equal(res.body?.status, 'trial');
    assert.equal(res.body?.effectivePlan, 'professional');
    assert.equal(res.body?.hasAccess, true);
    assert.equal(res.body?.isTrialActive, true);
  } finally {
    Hospital.findById = originalFindById;
  }
});

test('handleSubscriptionWebhook processes checkout.session.completed for subscriptions', async () => {
  const originalFindByIdAndUpdate = Hospital.findByIdAndUpdate;
  const updates = [];

  Hospital.findByIdAndUpdate = async (id, updateData) => {
    updates.push({ id, updateData });
    return { _id: id, ...updateData };
  };

  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        metadata: { hospitalId: 'hospital-1', planType: 'basic' },
        customer: 'cus_123',
      },
    },
  };

  try {
    await handleSubscriptionWebhook(event);

    assert.equal(updates.length, 1);
    assert.equal(updates[0].id, 'hospital-1');
    assert.equal(updates[0].updateData.subscriptionStatus, 'active');
    assert.equal(updates[0].updateData.subscriptionPlan, 'basic');
    assert.equal(updates[0].updateData.stripeCustomerId, 'cus_123');
  } finally {
    Hospital.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('handleSubscriptionWebhook ignores non-subscription checkout sessions', async () => {
  const originalFindByIdAndUpdate = Hospital.findByIdAndUpdate;
  let called = false;

  Hospital.findByIdAndUpdate = async () => {
    called = true;
    return null;
  };

  const event = {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'payment',
        metadata: { hospitalId: 'hospital-1', planType: 'basic' },
      },
    },
  };

  try {
    await handleSubscriptionWebhook(event);
    assert.equal(called, false);
  } finally {
    Hospital.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('handleSubscriptionWebhook handles subscription updated event', async () => {
  const originalFindOneAndUpdate = Hospital.findOneAndUpdate;
  const calls = [];

  Hospital.findOneAndUpdate = async (query, updateData) => {
    calls.push({ query, updateData });
    return { query, ...updateData };
  };

  const event = {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_456',
        status: 'active',
        current_period_end: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
        metadata: { planType: 'professional' },
      },
    },
  };

  try {
    await handleSubscriptionWebhook(event);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].query, { stripeCustomerId: 'cus_456' });
    assert.equal(calls[0].updateData.subscriptionStatus, 'active');
    assert.equal(calls[0].updateData.subscriptionPlan, 'professional');
  } finally {
    Hospital.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('handleSubscriptionWebhook handles subscription created event', async () => {
  const originalFindOneAndUpdate = Hospital.findOneAndUpdate;
  const calls = [];

  Hospital.findOneAndUpdate = async (query, updateData) => {
    calls.push({ query, updateData });
    return { query, ...updateData };
  };

  const event = {
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_created_1',
        customer: 'cus_created_1',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
        metadata: { planType: 'basic' },
      },
    },
  };

  try {
    await handleSubscriptionWebhook(event);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].query, { stripeCustomerId: 'cus_created_1' });
    assert.equal(calls[0].updateData.subscriptionStatus, 'active');
    assert.equal(calls[0].updateData.subscriptionPlan, 'basic');
    assert.equal(calls[0].updateData.stripeSubscriptionId, 'sub_created_1');
  } finally {
    Hospital.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('handleSubscriptionWebhook handles subscription deleted event', async () => {
  const originalFindOneAndUpdate = Hospital.findOneAndUpdate;
  const calls = [];

  Hospital.findOneAndUpdate = async (query, updateData) => {
    calls.push({ query, updateData });
    return { query, ...updateData };
  };

  const event = {
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_789',
        customer: 'cus_789',
        canceled_at: Math.floor(Date.now() / 1000),
        metadata: {},
      },
    },
  };

  try {
    await handleSubscriptionWebhook(event);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].query, { stripeCustomerId: 'cus_789' });
    assert.equal(calls[0].updateData.subscriptionStatus, 'cancelled');
    assert.ok(calls[0].updateData.subscriptionEndDate instanceof Date);
  } finally {
    Hospital.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('handleSubscriptionWebhook handles invoice payment failed and suspends subscription', async () => {
  const originalFindOneAndUpdate = Hospital.findOneAndUpdate;
  const calls = [];

  Hospital.findOneAndUpdate = async (query, updateData) => {
    calls.push({ query, updateData });
    return { query, ...updateData };
  };

  const event = {
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'inv_001',
        customer: 'cus_failed',
      },
    },
  };

  try {
    await handleSubscriptionWebhook(event);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].query, { stripeCustomerId: 'cus_failed' });
    assert.equal(calls[0].updateData.subscriptionStatus, 'suspended');
  } finally {
    Hospital.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('handleSubscriptionWebhook handles invoice payment succeeded and reactivates subscription', async () => {
  const originalFindOneAndUpdate = Hospital.findOneAndUpdate;
  const calls = [];

  Hospital.findOneAndUpdate = async (query, updateData) => {
    calls.push({ query, updateData });
    return { query, ...updateData };
  };

  const event = {
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: 'inv_002',
        customer: 'cus_success',
        lines: {
          data: [
            {
              period: {
                end: Math.floor((Date.now() + 48 * 60 * 60 * 1000) / 1000),
              },
            },
          ],
        },
      },
    },
  };

  try {
    await handleSubscriptionWebhook(event);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].query, { stripeCustomerId: 'cus_success' });
    assert.equal(calls[0].updateData.subscriptionStatus, 'active');
    assert.ok(calls[0].updateData.subscriptionEndDate instanceof Date);
  } finally {
    Hospital.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('updateSubscriptionPlan updates active stripe subscription with stable plan price id', async () => {
  process.env.STRIPE_PRICE_PROFESSIONAL = 'price_professional_test';

  const originalFindById = Hospital.findById;
  const originalFindByIdAndUpdate = Hospital.findByIdAndUpdate;

  const stripeUpdateCalls = [];

  __setStripeClientForTests({
    subscriptions: {
      retrieve: async () => ({ items: { data: [{ id: 'si_test_1' }] } }),
      update: async (subscriptionId, payload) => {
        stripeUpdateCalls.push({ subscriptionId, payload });
        return { id: subscriptionId, ...payload };
      },
    },
  });

  Hospital.findById = async () => ({
    _id: 'hospital-1',
    stripeSubscriptionId: 'sub_test_1',
  });

  const persistedUpdates = [];
  Hospital.findByIdAndUpdate = async (id, payload) => {
    persistedUpdates.push({ id, payload });
    return { _id: id, ...payload };
  };

  const req = {
    params: { hospitalId: 'hospital-1' },
    body: { newPlanType: 'professional' },
    user: { userType: 'hospital_admin', hospitalId: 'hospital-1' },
  };
  const res = createResponseMock();

  try {
    await updateSubscriptionPlan(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(stripeUpdateCalls.length, 1);
    assert.equal(stripeUpdateCalls[0].subscriptionId, 'sub_test_1');
    assert.equal(
      stripeUpdateCalls[0].payload.items[0].price,
      'price_professional_test'
    );

    assert.equal(persistedUpdates.length, 1);
    assert.equal(persistedUpdates[0].id, 'hospital-1');
    assert.equal(persistedUpdates[0].payload.subscriptionPlan, 'professional');
    assert.equal(persistedUpdates[0].payload.subscriptionStatus, 'active');
  } finally {
    Hospital.findById = originalFindById;
    Hospital.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('cancelSubscription cancels stripe subscription and updates hospital status', async () => {
  const originalFindById = Hospital.findById;
  const originalFindByIdAndUpdate = Hospital.findByIdAndUpdate;

  const cancelledAt = Math.floor(Date.now() / 1000);
  const cancelCalls = [];

  __setStripeClientForTests({
    subscriptions: {
      cancel: async (subscriptionId) => {
        cancelCalls.push(subscriptionId);
        return { canceled_at: cancelledAt };
      },
    },
  });

  Hospital.findById = async () => ({
    _id: 'hospital-9',
    stripeSubscriptionId: 'sub_cancel_9',
  });

  const persistedUpdates = [];
  Hospital.findByIdAndUpdate = async (id, payload) => {
    persistedUpdates.push({ id, payload });
    return { _id: id, ...payload };
  };

  const req = {
    params: { hospitalId: 'hospital-9' },
    user: { userType: 'hospital_admin', hospitalId: 'hospital-9' },
  };
  const res = createResponseMock();

  try {
    await cancelSubscription(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(cancelCalls.length, 1);
    assert.equal(cancelCalls[0], 'sub_cancel_9');

    assert.equal(persistedUpdates.length, 1);
    assert.equal(persistedUpdates[0].id, 'hospital-9');
    assert.equal(persistedUpdates[0].payload.subscriptionStatus, 'cancelled');
    assert.ok(persistedUpdates[0].payload.subscriptionEndDate instanceof Date);
  } finally {
    Hospital.findById = originalFindById;
    Hospital.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});
