import test from 'node:test';
import assert from 'node:assert/strict';

import Doctor from '../src/models/doctor.model.js';
import Appointment from '../src/models/appointment.model.js';
import {
  validateDoctorQuota,
  validateMonthlyAppointmentQuota,
} from '../src/services/subscription.service.js';

test('validateDoctorQuota allows when below plan limit', async () => {
  const originalCountDocuments = Doctor.countDocuments;
  Doctor.countDocuments = async () => 3;

  try {
    const result = await validateDoctorQuota('hospital-1', 'basic');
    assert.equal(result.allowed, true);
    assert.equal(result.limit, 5);
    assert.equal(result.current, 3);
  } finally {
    Doctor.countDocuments = originalCountDocuments;
  }
});

test('validateDoctorQuota blocks when at or above plan limit', async () => {
  const originalCountDocuments = Doctor.countDocuments;
  Doctor.countDocuments = async () => 5;

  try {
    const result = await validateDoctorQuota('hospital-1', 'basic');
    assert.equal(result.allowed, false);
    assert.equal(result.limit, 5);
    assert.equal(result.current, 5);
    assert.equal(result.message?.includes('Doctor limit reached'), true);
  } finally {
    Doctor.countDocuments = originalCountDocuments;
  }
});

test('validateDoctorQuota bypasses limits for enterprise plan', async () => {
  const originalCountDocuments = Doctor.countDocuments;
  let called = false;
  Doctor.countDocuments = async () => {
    called = true;
    return 999;
  };

  try {
    const result = await validateDoctorQuota('hospital-1', 'enterprise');
    assert.equal(result.allowed, true);
    assert.equal(result.limit, null);
    assert.equal(result.current, null);
    assert.equal(called, false);
  } finally {
    Doctor.countDocuments = originalCountDocuments;
  }
});

test('validateMonthlyAppointmentQuota allows when below monthly limit', async () => {
  const originalCountDocuments = Appointment.countDocuments;
  Appointment.countDocuments = async () => 200;

  try {
    const result = await validateMonthlyAppointmentQuota('hospital-1', 'basic');
    assert.equal(result.allowed, true);
    assert.equal(result.limit, 500);
    assert.equal(result.current, 200);
  } finally {
    Appointment.countDocuments = originalCountDocuments;
  }
});

test('validateMonthlyAppointmentQuota blocks when at monthly limit', async () => {
  const originalCountDocuments = Appointment.countDocuments;
  Appointment.countDocuments = async () => 500;

  try {
    const result = await validateMonthlyAppointmentQuota('hospital-1', 'basic');
    assert.equal(result.allowed, false);
    assert.equal(result.limit, 500);
    assert.equal(result.current, 500);
    assert.equal(result.message?.includes('Monthly appointment limit reached'), true);
  } finally {
    Appointment.countDocuments = originalCountDocuments;
  }
});

test('validateMonthlyAppointmentQuota bypasses limits for enterprise plan', async () => {
  const originalCountDocuments = Appointment.countDocuments;
  let called = false;
  Appointment.countDocuments = async () => {
    called = true;
    return 9999;
  };

  try {
    const result = await validateMonthlyAppointmentQuota('hospital-1', 'enterprise');
    assert.equal(result.allowed, true);
    assert.equal(result.limit, null);
    assert.equal(result.current, null);
    assert.equal(called, false);
  } finally {
    Appointment.countDocuments = originalCountDocuments;
  }
});
