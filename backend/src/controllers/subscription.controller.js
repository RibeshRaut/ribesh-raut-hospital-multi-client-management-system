import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
import Stripe from 'stripe';
import Hospital from '../models/hospital.model.js';
import { SUBSCRIPTION_PLANS, TRIAL_DURATION_DAYS, getStripePriceId } from '../utils/subscriptionPlans.js';
import {
  buildSubscriptionSnapshot,
  evaluateAndSyncSubscriptionState,
  isDateInFuture,
} from '../services/subscription.service.js';

let stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_test_key');

export const __setStripeClientForTests = (mockStripeClient) => {
  stripe = mockStripeClient;
};

const ensureHospitalAccess = (req, hospitalId) => {
  if (req.user?.userType === 'website_admin') {
    return { allowed: true };
  }

  if (req.user?.userType === 'hospital_admin' && req.user?.hospitalId === hospitalId) {
    return { allowed: true };
  }

  return { allowed: false };
};

/**
 * Create a Stripe subscription checkout session
 */
export const createSubscriptionCheckout = async (req, res) => {
  try {
    const { hospitalId, planType, hospitalEmail, hospitalName } = req.body;

    // Validate required fields
    if (!hospitalId || !planType || !hospitalEmail) {
      return res.status(400).json({ error: 'Hospital ID, Plan Type, and Email are required' });
    }

    // Validate plan type
    if (!SUBSCRIPTION_PLANS[planType]) {
      return res.status(400).json({ 
        error: 'Invalid plan type. Valid options are: ' + Object.keys(SUBSCRIPTION_PLANS).join(', ')
      });
    }

    // Get hospital details
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const access = ensureHospitalAccess(req, hospitalId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plan = SUBSCRIPTION_PLANS[planType];
    const stripePriceId = getStripePriceId(planType);

    // Create Stripe Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: hospitalEmail,
      line_items: stripePriceId
        ? [
            {
              price: stripePriceId,
              quantity: 1,
            },
          ]
        : [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: plan.name,
                  description: plan.description,
                },
                unit_amount: plan.price,
                recurring: {
                  interval: 'month',
                  interval_count: 1,
                },
              },
              quantity: 1,
            },
          ],
      subscription_data: {
        metadata: {
          hospitalId: hospitalId.toString(),
          planType,
        },
      },
      metadata: {
        hospitalId: hospitalId.toString(),
        planType: planType,
        hospitalName: hospitalName || hospital.name,
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing?subscription=success&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing?subscription=cancelled`,
    });

    res.status(200).json({
      message: 'Subscription checkout session created successfully',
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error) {
    console.error('Error creating subscription checkout:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Handle subscription webhook events
 */
export const handleSubscriptionWebhook = async (event, io) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleSubscriptionCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled subscription event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling subscription webhook:', error);
  }
};

export const handleSubscriptionCheckoutCompleted = async (session) => {
  try {
    if (session.mode !== 'subscription') {
      return;
    }

    const metadata = session.metadata || {};
    const hospitalId = metadata.hospitalId;
    const planType = metadata.planType;

    if (!hospitalId || !planType) {
      console.error('Missing hospital or plan metadata in subscription checkout session');
      return;
    }

    const updateData = {
      subscriptionStatus: 'active',
      subscriptionPlan: planType,
      stripeCustomerId: session.customer || null,
    };

    if (session.subscription) {
      updateData.stripeSubscriptionId = session.subscription;

      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
        updateData.subscriptionStartDate = new Date(stripeSubscription.current_period_start * 1000);
        updateData.subscriptionEndDate = new Date(stripeSubscription.current_period_end * 1000);
      } catch (stripeError) {
        console.error('Failed to retrieve Stripe subscription after checkout:', stripeError.message);
      }
    }

    await Hospital.findByIdAndUpdate(hospitalId, updateData);
    console.log(`Subscription checkout completed for hospital: ${hospitalId}`);
  } catch (error) {
    console.error('Error handling subscription checkout completion:', error);
  }
};

/**
 * Handle subscription created
 */
const handleSubscriptionCreated = async (subscription) => {
  try {
    const metadata = subscription.metadata;
    const hospitalId = metadata?.hospitalId;

    let hospitalQuery;
    if (hospitalId) {
      hospitalQuery = { _id: hospitalId };
    } else if (subscription.customer) {
      hospitalQuery = { stripeCustomerId: subscription.customer };
    }

    if (!hospitalQuery) {
      console.error('No hospital mapping in subscription creation event');
      return;
    }

    await Hospital.findOneAndUpdate(
      hospitalQuery,
      {
        subscriptionStatus: 'active',
        ...(metadata?.planType ? { subscriptionPlan: metadata.planType } : {}),
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer,
        subscriptionStartDate: new Date(subscription.current_period_start * 1000),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      },
      { new: true }
    );

    console.log(`Subscription created for hospital mapping`, subscription.id);
  } catch (error) {
    console.error('Error handling subscription creation:', error);
  }
};

/**
 * Handle subscription updated
 */
const handleSubscriptionUpdated = async (subscription) => {
  try {
    const metadata = subscription.metadata;
    const hospitalId = metadata?.hospitalId;

    let hospitalQuery;
    if (hospitalId) {
      hospitalQuery = { _id: hospitalId };
    } else if (subscription.customer) {
      hospitalQuery = { stripeCustomerId: subscription.customer };
    } else if (subscription.id) {
      hospitalQuery = { stripeSubscriptionId: subscription.id };
    }

    if (!hospitalQuery) {
      console.error('No hospital mapping in subscription update event');
      return;
    }

    await Hospital.findOneAndUpdate(
      hospitalQuery,
      {
        subscriptionStatus: subscription.status === 'active' ? 'active' : 'expired',
        ...(metadata?.planType ? { subscriptionPlan: metadata.planType } : {}),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      },
      { new: true }
    );

    console.log(`Subscription updated for customer: ${subscription.customer}`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
};

/**
 * Handle subscription cancelled
 */
const handleSubscriptionCancelled = async (subscription) => {
  try {
    const metadata = subscription.metadata;
    const hospitalId = metadata?.hospitalId;

    let hospitalQuery;
    if (hospitalId) {
      hospitalQuery = { _id: hospitalId };
    } else if (subscription.customer) {
      hospitalQuery = { stripeCustomerId: subscription.customer };
    } else if (subscription.id) {
      hospitalQuery = { stripeSubscriptionId: subscription.id };
    }

    if (!hospitalQuery) {
      console.error('No hospital mapping in subscription cancellation event');
      return;
    }

    await Hospital.findOneAndUpdate(
      hospitalQuery,
      {
        subscriptionStatus: 'cancelled',
        subscriptionEndDate: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : new Date(),
      },
      { new: true }
    );

    console.log(`Subscription cancelled for customer: ${subscription.customer}`);
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
};

/**
 * Handle invoice payment succeeded
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
    let hospitalQuery = null;

    if (invoice.subscription) {
      hospitalQuery = { stripeSubscriptionId: invoice.subscription };
    } else if (invoice.customer) {
      hospitalQuery = { stripeCustomerId: invoice.customer };
    }

    if (!hospitalQuery) {
      console.error('No hospital mapping in invoice payment success event');
      return;
    }

    const periodEnd = invoice.lines?.data?.[0]?.period?.end
      ? new Date(invoice.lines.data[0].period.end * 1000)
      : undefined;

    await Hospital.findOneAndUpdate(
      hospitalQuery,
      {
        subscriptionStatus: 'active',
        ...(periodEnd ? { subscriptionEndDate: periodEnd } : {}),
      },
      { new: true }
    );

    console.log(`Invoice payment succeeded: ${invoice.id} for customer: ${invoice.customer}`);
  } catch (error) {
    console.error('Error handling invoice payment success:', error);
  }
};

/**
 * Handle invoice payment failed
 */
const handleInvoicePaymentFailed = async (invoice) => {
  try {
    let hospitalQuery = null;

    if (invoice.subscription) {
      hospitalQuery = { stripeSubscriptionId: invoice.subscription };
    } else if (invoice.customer) {
      hospitalQuery = { stripeCustomerId: invoice.customer };
    }

    if (!hospitalQuery) {
      console.error('No hospital mapping in invoice payment failed event');
      return;
    }

    await Hospital.findOneAndUpdate(
      hospitalQuery,
      {
        subscriptionStatus: 'suspended',
      },
      { new: true }
    );

    console.log(`Invoice payment failed: ${invoice.id} for customer: ${invoice.customer}`);
  } catch (error) {
    console.error('Error handling invoice payment failure:', error);
  }
};

/**
 * Get subscription details
 */
export const getSubscriptionDetails = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const access = ensureHospitalAccess(req, hospitalId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const hospital = await Hospital.findById(hospitalId).select(
      'subscriptionStatus subscriptionPlan subscriptionStartDate subscriptionEndDate trialStartDate trialEndDate trialUsed'
    );

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const context = await evaluateAndSyncSubscriptionState(hospital);
    const snapshot = buildSubscriptionSnapshot(context.hospital);

    const subscriptionDetails = {
      hospitalId: context.hospital._id,
      status: snapshot.status,
      plan: snapshot.currentPlan || 'none',
      effectivePlan: snapshot.effectivePlan || 'none',
      planDetails: snapshot.planDetails,
      startDate: snapshot.subscriptionStartDate,
      endDate: snapshot.subscriptionEndDate,
      isTrialActive: snapshot.isTrialActive,
      trialStartDate: snapshot.trialStartDate,
      trialEndDate: snapshot.trialEndDate,
      trialUsed: context.hospital.trialUsed || false,
      hasAccess: snapshot.hasAccess,
      isActive: snapshot.hasAccess,
    };

    res.status(200).json(subscriptionDetails);
  } catch (error) {
    console.error('Error getting subscription details:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get available subscription plans
 */
export const getAvailablePlans = async (req, res) => {
  try {
    const plans = Object.entries(SUBSCRIPTION_PLANS).map(([key, value]) => ({
      id: key,
      ...value,
    }));

    res.status(200).json({
      plans: plans,
      trial: {
        durationDays: TRIAL_DURATION_DAYS,
        description: `${TRIAL_DURATION_DAYS}-day free trial with full platform access`,
      },
      message: 'Available subscription plans',
    });
  } catch (error) {
    console.error('Error getting available plans:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const access = ensureHospitalAccess(req, hospitalId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (!hospital.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel subscription in Stripe
    const subscription = await stripe.subscriptions.cancel(hospital.stripeSubscriptionId);

    // Update hospital document
    await Hospital.findByIdAndUpdate(hospitalId, {
      subscriptionStatus: 'cancelled',
      subscriptionEndDate: new Date(subscription.canceled_at * 1000),
    });

    res.status(200).json({
      message: 'Subscription cancelled successfully',
      subscriptionId: hospital.stripeSubscriptionId,
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update subscription plan
 */
export const updateSubscriptionPlan = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { newPlanType } = req.body;

    const access = ensureHospitalAccess(req, hospitalId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!newPlanType || !SUBSCRIPTION_PLANS[newPlanType]) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (!hospital.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(hospital.stripeSubscriptionId);

    // Get the price ID for the new plan
    const newPlan = SUBSCRIPTION_PLANS[newPlanType];
    const stripePriceId = getStripePriceId(newPlanType);

    if (!stripePriceId) {
      return res.status(500).json({
        error: `Stripe price is not configured for ${newPlanType} plan. Please set STRIPE_PRICE_${newPlanType.toUpperCase()} in environment.`,
      });
    }

    if (!subscription.items?.data?.length) {
      return res.status(400).json({ error: 'No subscription items found for update' });
    }

    // Update subscription
    await stripe.subscriptions.update(hospital.stripeSubscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: stripePriceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        hospitalId: hospitalId.toString(),
        planType: newPlanType,
      },
    });

    // Update hospital document
    await Hospital.findByIdAndUpdate(hospitalId, {
      subscriptionPlan: newPlanType,
      subscriptionStatus: 'active',
    });

    res.status(200).json({
      message: 'Subscription plan updated successfully',
      newPlan: newPlanType,
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    res.status(500).json({ error: error.message });
  }
};
