export const DAY_MS = 24 * 60 * 60 * 1000;

const now = Date.now();

export const subscriptionFixtures = {
  trialActive: {
    subscriptionStatus: 'trial',
    subscriptionPlan: null,
    trialUsed: true,
    trialStartDate: new Date(now - 5 * DAY_MS),
    trialEndDate: new Date(now + 25 * DAY_MS),
    subscriptionStartDate: null,
    subscriptionEndDate: null,
  },
  trialExpired: {
    subscriptionStatus: 'trial',
    subscriptionPlan: null,
    trialUsed: true,
    trialStartDate: new Date(now - 40 * DAY_MS),
    trialEndDate: new Date(now - 10 * DAY_MS),
    subscriptionStartDate: null,
    subscriptionEndDate: null,
  },
  paidActive: {
    subscriptionStatus: 'active',
    subscriptionPlan: 'professional',
    trialUsed: true,
    trialStartDate: null,
    trialEndDate: null,
    subscriptionStartDate: new Date(now - 10 * DAY_MS),
    subscriptionEndDate: new Date(now + 20 * DAY_MS),
  },
  paidExpired: {
    subscriptionStatus: 'active',
    subscriptionPlan: 'basic',
    trialUsed: true,
    trialStartDate: null,
    trialEndDate: null,
    subscriptionStartDate: new Date(now - 60 * DAY_MS),
    subscriptionEndDate: new Date(now - 5 * DAY_MS),
  },
  cancelled: {
    subscriptionStatus: 'cancelled',
    subscriptionPlan: null,
    trialUsed: true,
    trialStartDate: null,
    trialEndDate: null,
    subscriptionStartDate: null,
    subscriptionEndDate: new Date(now - DAY_MS),
  },
};
