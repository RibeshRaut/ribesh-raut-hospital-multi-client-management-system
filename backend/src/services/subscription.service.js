import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';
import {
  TRIAL_DURATION_DAYS,
  TRIAL_PLAN,
  getPlanById,
  getPlanLimits,
  getMonthlyPlanPrice,
} from '../utils/subscriptionPlans.js';

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const createTrialWindow = (startDate = new Date()) => {
  const trialStartDate = new Date(startDate);
  const trialEndDate = addDays(trialStartDate, TRIAL_DURATION_DAYS);
  return { trialStartDate, trialEndDate };
};

const SUBSCRIPTION_GRACE_MS = 5 * 60 * 1000;

export const isDateInFuture = (dateValue) => {
  if (!dateValue) return false;
  return new Date(dateValue).getTime() >= Date.now() - SUBSCRIPTION_GRACE_MS;
};

export const getEffectivePlanId = (hospital) => {
  if (!hospital) return null;

  if (
    (hospital.subscriptionStatus === 'active' || hospital.subscriptionStatus === 'cancelled') &&
    hospital.subscriptionPlan &&
    (hospital.subscriptionEndDate ? isDateInFuture(hospital.subscriptionEndDate) : true)
  ) {
    return hospital.subscriptionPlan;
  }

  if (hospital.subscriptionStatus === 'trial' && isDateInFuture(hospital.trialEndDate)) {
    return TRIAL_PLAN;
  }

  return null;
};

export const evaluateAndSyncSubscriptionState = async (hospital) => {
  if (!hospital) {
    return { hospital: null, hasAccess: false, reason: 'Hospital not found' };
  }

  const now = new Date();
  const updates = {};

  const hasActivePaidSubscription =
    (hospital.subscriptionStatus === 'active' || hospital.subscriptionStatus === 'cancelled') &&
    hospital.subscriptionPlan &&
    (hospital.subscriptionEndDate ? isDateInFuture(hospital.subscriptionEndDate) : true);

  if (!hasActivePaidSubscription) {
    // If cancellation period ended, move to expired.
    if (hospital.subscriptionStatus === 'cancelled') {
      updates.subscriptionStatus = 'expired';
    }

    const hasActiveTrial =
      hospital.subscriptionStatus === 'trial' &&
      isDateInFuture(hospital.trialEndDate);

    if (!hasActiveTrial && !hospital.trialUsed) {
      const { trialStartDate, trialEndDate } = createTrialWindow(now);
      updates.subscriptionStatus = 'trial';
      updates.trialStartDate = trialStartDate;
      updates.trialEndDate = trialEndDate;
      updates.trialUsed = true;
    } else if (!hasActiveTrial) {
      updates.subscriptionStatus = 'expired';
    }
  }

  const updateKeys = Object.keys(updates);
  let hospitalDoc = hospital;

  if (updateKeys.length > 0) {
    updateKeys.forEach((key) => {
      hospitalDoc[key] = updates[key];
    });
    await hospitalDoc.save();
  }

  const effectivePlanId = getEffectivePlanId(hospitalDoc);
  const plan = effectivePlanId ? getPlanById(effectivePlanId) : null;

  const hasAccess = Boolean(plan);
  const isTrial = hospitalDoc.subscriptionStatus === 'trial' && isDateInFuture(hospitalDoc.trialEndDate);

  return {
    hospital: hospitalDoc,
    hasAccess,
    isTrial,
    effectivePlanId,
    plan,
    trialEndsAt: hospitalDoc.trialEndDate || null,
    reason: hasAccess
      ? null
      : 'Subscription is required. Your trial has ended. Please subscribe to continue using hospital features.',
  };
};

export const buildSubscriptionSnapshot = (hospital) => {
  const effectivePlanId = getEffectivePlanId(hospital);
  const effectivePlan = effectivePlanId ? getPlanById(effectivePlanId) : null;
  const isTrialActive = hospital.subscriptionStatus === 'trial' && isDateInFuture(hospital.trialEndDate);
  const isPaidActive =
    (hospital.subscriptionStatus === 'active' || hospital.subscriptionStatus === 'cancelled') &&
    Boolean(hospital.subscriptionPlan) &&
    (hospital.subscriptionEndDate ? isDateInFuture(hospital.subscriptionEndDate) : true);

  return {
    status: hospital.subscriptionStatus || 'inactive',
    currentPlan: hospital.subscriptionPlan || null,
    effectivePlan: effectivePlanId,
    isTrialActive,
    trialStartDate: hospital.trialStartDate || null,
    trialEndDate: hospital.trialEndDate || null,
    subscriptionStartDate: hospital.subscriptionStartDate || null,
    subscriptionEndDate: hospital.subscriptionEndDate || null,
    hasAccess: isTrialActive || isPaidActive,
    estimatedMonthlyRevenue: isPaidActive ? getMonthlyPlanPrice(hospital.subscriptionPlan) / 100 : 0,
    planDetails: effectivePlan,
  };
};

export const validateDoctorQuota = async (hospitalId, planId) => {
  const limits = getPlanLimits(planId);
  if (!limits || limits.doctors === null) {
    return { allowed: true, limit: null, current: null };
  }

  const currentDoctors = await Doctor.countDocuments({ hospitalId });
  if (currentDoctors >= limits.doctors) {
    return {
      allowed: false,
      limit: limits.doctors,
      current: currentDoctors,
      message: `Doctor limit reached for ${planId} plan (${limits.doctors}). Upgrade your subscription to add more doctors.`,
    };
  }

  return { allowed: true, limit: limits.doctors, current: currentDoctors };
};

export const validateMonthlyAppointmentQuota = async (hospitalId, planId) => {
  const limits = getPlanLimits(planId);
  if (!limits || limits.monthlyAppointments === null) {
    return { allowed: true, limit: null, current: null };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const currentMonthAppointments = await Appointment.countDocuments({
    hospitalId,
    createdAt: { $gte: monthStart, $lt: nextMonthStart },
  });

  if (currentMonthAppointments >= limits.monthlyAppointments) {
    return {
      allowed: false,
      limit: limits.monthlyAppointments,
      current: currentMonthAppointments,
      message: `Monthly appointment limit reached for ${planId} plan (${limits.monthlyAppointments}). Upgrade your subscription to continue accepting appointments.`,
    };
  }

  return { allowed: true, limit: limits.monthlyAppointments, current: currentMonthAppointments };
};
