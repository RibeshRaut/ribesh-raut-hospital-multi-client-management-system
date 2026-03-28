import test from 'node:test';
import assert from 'node:assert/strict';

import Doctor from '../src/models/doctor.model.js';
import Appointment from '../src/models/appointment.model.js';
import Hospital from '../src/models/hospital.model.js';
import ContactForm from '../src/models/contactForm.model.js';
import Service from '../src/models/service.model.js';
import { getSuperAdminStats } from '../src/controllers/superAdmin.controller.js';

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

test('getSuperAdminStats enforces website_admin access', async () => {
  const req = { user: { userType: 'hospital_admin' } };
  const res = createResponseMock();

  await getSuperAdminStats(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error, 'Access denied. Super admin only.');
});

test('getSuperAdminStats returns subscription counts and revenue metrics', async () => {
  const originalDoctorCount = Doctor.countDocuments;
  const originalAppointmentCount = Appointment.countDocuments;
  const originalHospitalCount = Hospital.countDocuments;
  const originalContactCount = ContactForm.countDocuments;
  const originalServiceCount = Service.countDocuments;
  const originalAppointmentDistinct = Appointment.distinct;
  const originalHospitalFind = Hospital.find;
  const originalAppointmentFind = Appointment.find;
  const originalAppointmentAggregate = Appointment.aggregate;
  const originalHospitalAggregate = Hospital.aggregate;

  try {
    Doctor.countDocuments = async (query = {}) => {
      if (query.createdAt) return 0;
      return 12;
    };

    Appointment.countDocuments = async (query = {}) => {
      if (query.status === 'pending') return 4;
      if (query.status === 'confirmed') return 5;
      if (query.status === 'completed') return 6;
      if (query.status === 'cancelled') return 1;
      return 16;
    };

    Hospital.countDocuments = async (query = {}) => {
      if (query.subscriptionStatus === 'active') return 1;
      if (query.subscriptionStatus === 'trial') return 1;
      if (query.subscriptionStatus === 'expired') return 1;
      if (query.isProfileComplete === true) return 2;
      if (query.createdAt) return 0;
      return 3;
    };

    ContactForm.countDocuments = async (query = {}) => {
      if (query.status === 'unread') return 2;
      return 9;
    };

    Service.countDocuments = async () => 7;
    Appointment.distinct = async () => ['a@x.com', 'b@x.com'];

    let hospitalFindCall = 0;
    Hospital.find = () => {
      hospitalFindCall += 1;

      if (hospitalFindCall === 1) {
        return {
          select: () => ({
            sort: () => ({
              limit: async () => [
                {
                  _id: 'h1',
                  name: 'Hospital One',
                  email: 'h1@example.com',
                  phone: '111',
                  address: 'Addr 1',
                  isProfileComplete: true,
                  createdAt: new Date(),
                  slug: 'hospital-one',
                  subscriptionStatus: 'active',
                  subscriptionPlan: 'basic',
                  subscriptionStartDate: new Date(),
                  subscriptionEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  trialStartDate: null,
                  trialEndDate: null,
                },
              ],
            }),
          }),
        };
      }

      return {
        select: () => ({
          lean: async () => [
            {
              _id: 'h1',
              name: 'Hospital One',
              email: 'h1@example.com',
              subscriptionStatus: 'active',
              subscriptionPlan: 'basic',
              subscriptionEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              trialEndDate: null,
            },
            {
              _id: 'h2',
              name: 'Hospital Two',
              email: 'h2@example.com',
              subscriptionStatus: 'trial',
              subscriptionPlan: null,
              subscriptionEndDate: null,
              trialEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
            {
              _id: 'h3',
              name: 'Hospital Three',
              email: 'h3@example.com',
              subscriptionStatus: 'expired',
              subscriptionPlan: null,
              subscriptionEndDate: null,
              trialEndDate: null,
            },
          ],
        }),
      };
    };

    Appointment.find = () => {
      const chain = {
        populate() {
          return chain;
        },
        sort() {
          return chain;
        },
        limit: async () => [],
      };

      return chain;
    };

    Appointment.aggregate = async () => [];
    Hospital.aggregate = async () => [];

    const req = { user: { userType: 'website_admin' } };
    const res = createResponseMock();

    await getSuperAdminStats(req, res);

    assert.equal(res.statusCode, 200);
    const data = res.body?.data;
    assert.ok(data);

    assert.equal(data.statistics.subscriptions.activePaid, 1);
    assert.equal(data.statistics.subscriptions.trial, 1);
    assert.equal(data.statistics.subscriptions.expired, 1);

    assert.equal(data.statistics.revenue.monthly, 29.99);
    assert.equal(data.statistics.revenue.annualRunRate, 359.88);

    assert.equal(data.statistics.revenue.byPlan.basic.hospitals, 1);
    assert.equal(data.statistics.revenue.byPlan.basic.monthlyRevenue, 29.99);
  } finally {
    Doctor.countDocuments = originalDoctorCount;
    Appointment.countDocuments = originalAppointmentCount;
    Hospital.countDocuments = originalHospitalCount;
    ContactForm.countDocuments = originalContactCount;
    Service.countDocuments = originalServiceCount;
    Appointment.distinct = originalAppointmentDistinct;
    Hospital.find = originalHospitalFind;
    Appointment.find = originalAppointmentFind;
    Appointment.aggregate = originalAppointmentAggregate;
    Hospital.aggregate = originalHospitalAggregate;
  }
});
