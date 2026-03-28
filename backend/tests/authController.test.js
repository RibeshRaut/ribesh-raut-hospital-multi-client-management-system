import test from 'node:test';
import assert from 'node:assert/strict';

import Admin from '../src/models/admin.model.js';
import PlatformSettings from '../src/models/platform.model.js';
import Hospital from '../src/models/hospital.model.js';
import { registerHospitalAdmin } from '../src/controllers/auth.controller.js';

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

test('registerHospitalAdmin initializes 30-day trial fields on new hospital', async () => {
  const originalAdminFind = Admin.find;
  const originalFindOnePlatform = PlatformSettings.findOne;
  const originalFindOneHospital = Hospital.findOne;
  const originalSaveHospital = Hospital.prototype.save;

  let savedHospital = null;

  Admin.find = () => ({
    select: async () => [],
  });
  PlatformSettings.findOne = async () => ({ allowNewRegistrations: true });
  Hospital.findOne = async () => null;
  Hospital.prototype.save = async function saveMock() {
    savedHospital = this.toObject ? this.toObject() : { ...this };
    return this;
  };

  const req = {
    body: {
      name: 'Trial Hospital',
      email: 'trial@hospital.com',
      phone: '+1-555-000-0000',
      address: '123 Trial Street',
      password: 'StrongPass123!',
    },
  };
  const res = createResponseMock();

  try {
    await registerHospitalAdmin(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body?.userType, 'hospital_admin');
    assert.ok(res.body?.token);

    assert.ok(savedHospital);
    assert.equal(savedHospital.subscriptionStatus, 'trial');
    assert.equal(savedHospital.trialUsed, true);
    assert.ok(savedHospital.trialStartDate);
    assert.ok(savedHospital.trialEndDate);

    const start = new Date(savedHospital.trialStartDate).getTime();
    const end = new Date(savedHospital.trialEndDate).getTime();
    const diffDays = Math.round((end - start) / (24 * 60 * 60 * 1000));

    assert.equal(diffDays, 30);
  } finally {
    Admin.find = originalAdminFind;
    PlatformSettings.findOne = originalFindOnePlatform;
    Hospital.findOne = originalFindOneHospital;
    Hospital.prototype.save = originalSaveHospital;
  }
});
