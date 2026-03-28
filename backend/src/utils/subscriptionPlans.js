export const TRIAL_DURATION_DAYS = 30;
export const TRIAL_PLAN = 'professional';

export const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic Plan',
    price: 2999,
    currency: 'usd',
    description: 'Perfect for small clinics',
    features: ['Up to 5 doctors', 'Up to 500 appointments / month', 'Basic analytics', 'Email support'],
    limits: {
      doctors: 5,
      monthlyAppointments: 500,
    },
  },
  professional: {
    id: 'professional',
    name: 'Professional Plan',
    price: 7999,
    currency: 'usd',
    description: 'For growing hospitals',
    features: ['Up to 25 doctors', 'Up to 2500 appointments / month', 'Advanced analytics', 'Priority support'],
    limits: {
      doctors: 25,
      monthlyAppointments: 2500,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price: 19999,
    currency: 'usd',
    description: 'For large healthcare networks',
    features: ['Unlimited doctors', 'Unlimited appointments', 'Full analytics', '24/7 support'],
    limits: {
      doctors: null,
      monthlyAppointments: null,
    },
  },
};

export const getPlanById = (planId) => SUBSCRIPTION_PLANS[planId] || null;

export const getMonthlyPlanPrice = (planId) => SUBSCRIPTION_PLANS[planId]?.price || 0;

export const getPlanLimits = (planId) => SUBSCRIPTION_PLANS[planId]?.limits || null;

export const getStripePriceId = (planId) => {
  const stripePriceIdByPlan = {
    basic: process.env.STRIPE_PRICE_BASIC || null,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL || null,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE || null,
  };

  return stripePriceIdByPlan[planId] || null;
};
