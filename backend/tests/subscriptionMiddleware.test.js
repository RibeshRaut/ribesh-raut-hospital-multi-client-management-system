import test from 'node:test';
import assert from 'node:assert/strict';

import Hospital from '../src/models/hospital.model.js';
import {
  requireHospitalSubscription,
  requireSubscriptionByHospitalBody,
  requireSubscriptionByHospitalParam,
} from '../src/middlewares/subscription.middleware.js';

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

const createHospitalDoc = (overrides = {}) => ({
  _id: 'hospital-1',
  subscriptionStatus: 'active',
  subscriptionPlan: 'basic',
  subscriptionEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  trialEndDate: null,
  trialUsed: true,
  async save() {
    return this;
  },
  ...overrides,
});

test('requireHospitalSubscription allows active hospital admin', async () => {
  const originalFindById = Hospital.findById;
  Hospital.findById = async () => createHospitalDoc();

  const req = { user: { userType: 'hospital_admin', hospitalId: 'hospital-1' } };
  const res = createResponseMock();
  let nextCalled = false;

  try {
    await requireHospitalSubscription(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
    assert.ok(req.subscriptionContext);
    assert.equal(req.subscriptionContext.hasAccess, true);
  } finally {
    Hospital.findById = originalFindById;
  }
});

test('requireHospitalSubscription returns 402 when hospital has no active access', async () => {
  const originalFindById = Hospital.findById;
  Hospital.findById = async () =>
    createHospitalDoc({
      subscriptionStatus: 'trial',
      trialEndDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      subscriptionPlan: null,
      subscriptionEndDate: null,
      trialUsed: true,
    });

  const req = { user: { userType: 'hospital_admin', hospitalId: 'hospital-1' } };
  const res = createResponseMock();
  let nextCalled = false;

  try {
    await requireHospitalSubscription(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 402);
    assert.equal(res.body?.code, 'SUBSCRIPTION_REQUIRED');
  } finally {
    Hospital.findById = originalFindById;
  }
});

test('requireSubscriptionByHospitalParam validates hospital id from params', async () => {
  const originalFindById = Hospital.findById;
  Hospital.findById = async (id) => createHospitalDoc({ _id: id });

  const req = { params: { hospitalId: 'hospital-99' } };
  const res = createResponseMock();
  let nextCalled = false;

  try {
    await requireSubscriptionByHospitalParam(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.subscriptionContext?.hospital?._id, 'hospital-99');
  } finally {
    Hospital.findById = originalFindById;
  }
});

test('requireSubscriptionByHospitalBody validates hospital id from body', async () => {
  const originalFindById = Hospital.findById;
  Hospital.findById = async (id) => createHospitalDoc({ _id: id });

  const req = { body: { hospitalId: 'hospital-body-1' } };
  const res = createResponseMock();
  let nextCalled = false;

  try {
    await requireSubscriptionByHospitalBody(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.subscriptionContext?.hospital?._id, 'hospital-body-1');
  } finally {
    Hospital.findById = originalFindById;
  }
});
