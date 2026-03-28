import Hospital from '../models/hospital.model.js';
import { evaluateAndSyncSubscriptionState } from '../services/subscription.service.js';

const subscriptionDeniedResponse = (res, context) => {
  return res.status(402).json({
    error: context.reason,
    code: 'SUBSCRIPTION_REQUIRED',
    data: {
      status: context.hospital?.subscriptionStatus || 'inactive',
      trialEndsAt: context.trialEndsAt || null,
      currentPlan: context.hospital?.subscriptionPlan || null,
    },
  });
};

export const requireHospitalSubscription = async (req, res, next) => {
  try {
    if (req.user?.userType !== 'hospital_admin') {
      return next();
    }

    const hospitalId = req.user?.hospitalId || req.user?.id;
    if (!hospitalId) {
      return res.status(401).json({ error: 'Unauthorized hospital session' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const context = await evaluateAndSyncSubscriptionState(hospital);
    if (!context.hasAccess) {
      return subscriptionDeniedResponse(res, context);
    }

    req.subscriptionContext = context;
    return next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    return res.status(500).json({ error: 'Failed to validate subscription' });
  }
};

export const requireSubscriptionByHospitalParam = async (req, res, next) => {
  try {
    const { hospitalId } = req.params;
    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const context = await evaluateAndSyncSubscriptionState(hospital);
    if (!context.hasAccess) {
      return subscriptionDeniedResponse(res, context);
    }

    req.subscriptionContext = context;
    return next();
  } catch (error) {
    console.error('Subscription by param middleware error:', error);
    return res.status(500).json({ error: 'Failed to validate subscription' });
  }
};

export const requireSubscriptionByHospitalBody = async (req, res, next) => {
  try {
    const hospitalId = req.body?.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const context = await evaluateAndSyncSubscriptionState(hospital);
    if (!context.hasAccess) {
      return subscriptionDeniedResponse(res, context);
    }

    req.subscriptionContext = context;
    return next();
  } catch (error) {
    console.error('Subscription by body middleware error:', error);
    return res.status(500).json({ error: 'Failed to validate subscription' });
  }
};
