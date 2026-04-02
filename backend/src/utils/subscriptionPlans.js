export const TRIAL_DURATION_DAYS = 30;
export const TRIAL_PLAN = 'professional';

export const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic Plan',
    price: 2999,
    currency: 'usd',
    description: 'Perfect for small clinics',
    features: [
      'Public hospital profile',
      'Service listings',
      'Contact form on public page',
      'Doctor management (up to 5)',
      'Appointment requests (up to 500/month)',
      'Basic analytics',
      'Email support',
    ],
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
    features: [
      'Everything in Basic',
      'Doctor management (up to 25)',
      'Appointment requests (up to 2500/month)',
      'Chat widget',
      'Advanced analytics',
      'Priority support',
    ],
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
    features: [
      'Everything in Professional',
      'Unlimited doctors',
      'Unlimited appointments',
      'Full analytics',
      'Custom branding',
      'Dedicated support',
      '24/7 support',
    ],
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
