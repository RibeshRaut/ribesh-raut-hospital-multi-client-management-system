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

const normalizeStripeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.id) return value.id;
  return null;
};

const mapStripeSubscriptionStatus = (stripeStatus, cancelAtPeriodEnd = false) => {
  if (cancelAtPeriodEnd) {
    return 'cancelled';
  }

  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'suspended';
    case 'canceled':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
    default:
      return 'expired';
  }
};

export const __setStripeClientForTests = (mockStripeClient) => {
  stripe = mockStripeClient;
};

const ensureHospitalAccess = (req, hospitalId) => {
  if (req.user?.userType === 'website_admin') {
    return { allowed: true };
  }

  if (req.user?.userType === 'hospital_admin' && String(req.user?.hospitalId) === String(hospitalId)) {
    return { allowed: true };
  }

  return { allowed: false };
};

const createPlanCheckoutSession = async ({ hospital, hospitalId, planType }) => {
  const stripePriceId = getStripePriceId(planType);
  const plan = SUBSCRIPTION_PLANS[planType];

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: hospital.email,
    line_items: stripePriceId
      ? [{ price: stripePriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: plan.currency || 'usd',
              product_data: {
                name: plan.name,
                description: plan.description,
              },
              unit_amount: plan.price,
              recurring: { interval: 'month', interval_count: 1 },
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
      planType,
      hospitalName: hospital.name,
    },
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing?subscription=success&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/billing?subscription=cancelled`,
  });
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

    let metadata = session.metadata || {};
    let hospitalId = metadata.hospitalId;
    let planType = metadata.planType;
    const subscriptionId = normalizeStripeId(session.subscription);
    const customerId = normalizeStripeId(session.customer);

    let stripeSubscription =
      session.subscription && typeof session.subscription === 'object' ? session.subscription : null;

    if (!stripeSubscription && subscriptionId) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      } catch (stripeError) {
        console.error('Failed to retrieve Stripe subscription after checkout:', stripeError.message);
      }
    }

    if (!stripeSubscription && customerId) {
      try {
        const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 });
        stripeSubscription = list?.data?.[0] || null;
      } catch (stripeError) {
        console.error('Failed to list Stripe subscriptions after checkout:', stripeError.message);
      }
    }

    if ((!hospitalId || !planType) && stripeSubscription?.metadata) {
      metadata = { ...stripeSubscription.metadata, ...metadata };
      hospitalId = hospitalId || metadata.hospitalId;
      planType = planType || metadata.planType;
    }

    if (!hospitalId && session.customer_email) {
      const hospitalByEmail = await Hospital.findOne({ email: session.customer_email });
      hospitalId = hospitalByEmail?._id?.toString();
    }

    if (!hospitalId && customerId) {
      const hospitalByCustomer = await Hospital.findOne({ stripeCustomerId: customerId });
      hospitalId = hospitalByCustomer?._id?.toString();
    }

    if (!planType && stripeSubscription?.items?.data?.length) {
      const priceId = stripeSubscription.items.data[0]?.price?.id;
      const planByPriceId = Object.keys(SUBSCRIPTION_PLANS).find(
        (planKey) => getStripePriceId(planKey) && getStripePriceId(planKey) === priceId
      );
      planType = planByPriceId || planType;
    }

    if (!hospitalId || !planType) {
      console.error('Missing hospital or plan metadata in subscription checkout session');
      return;
    }

    const updateData = {
      subscriptionStatus: 'active',
      subscriptionPlan: planType,
      stripeCustomerId: customerId || null,
      stripeSubscriptionId: subscriptionId || normalizeStripeId(stripeSubscription) || null,
      // Important: a completed checkout should never keep an old expired end date.
      // If we cannot fetch current_period_end, clear it so access isn't immediately flipped back.
      subscriptionEndDate: null,
    };

    if (stripeSubscription?.current_period_start) {
      updateData.subscriptionStartDate = new Date(stripeSubscription.current_period_start * 1000);
    } else {
      updateData.subscriptionStartDate = new Date();
    }

    if (stripeSubscription?.current_period_end) {
      updateData.subscriptionEndDate = new Date(stripeSubscription.current_period_end * 1000);
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
        subscriptionStatus: mapStripeSubscriptionStatus(subscription.status, subscription.cancel_at_period_end),
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
        subscriptionStatus: mapStripeSubscriptionStatus(subscription.status, subscription.cancel_at_period_end),
        ...(metadata?.planType ? { subscriptionPlan: metadata.planType } : {}),
        ...(subscription.current_period_start
          ? { subscriptionStartDate: new Date(subscription.current_period_start * 1000) }
          : {}),
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
    // Avoid re-activating a cancelled hospital subscription based only on customer id.
    // For subscription invoices we always expect an explicit subscription id.
    if (!invoice.subscription) {
      console.warn(
        `Skipping invoice.payment_succeeded without subscription id. invoice=${invoice.id}, customer=${invoice.customer}`
      );
      return;
    }

    const hospitalQuery = { stripeSubscriptionId: invoice.subscription };

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
    if (!invoice.subscription) {
      console.warn(
        `Skipping invoice.payment_failed without subscription id. invoice=${invoice.id}, customer=${invoice.customer}`
      );
      return;
    }

    const hospitalQuery = { stripeSubscriptionId: invoice.subscription };

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

    const isActiveTrial =
      hospital.subscriptionStatus === 'trial' &&
      isDateInFuture(hospital.trialEndDate);

    if (isActiveTrial) {
      await Hospital.findByIdAndUpdate(hospitalId, {
        subscriptionStatus: 'expired',
        trialEndDate: new Date(),
      });

      return res.status(200).json({
        message: 'Trial cancelled successfully',
      });
    }

    if (!hospital.stripeSubscriptionId) {
      await Hospital.findByIdAndUpdate(hospitalId, {
        subscriptionStatus: 'cancelled',
        subscriptionPlan: null,
        stripeSubscriptionId: null,
        subscriptionEndDate: new Date(),
      });

      return res.status(200).json({
        message: 'Subscription cancelled locally.',
        cancelledLocally: true,
      });
    }

    // Cancel subscription in Stripe
    let subscription;
    try {
      subscription = await stripe.subscriptions.cancel(hospital.stripeSubscriptionId);
    } catch (stripeError) {
      const message = stripeError?.message || 'Failed to cancel Stripe subscription';
      const normalizedMessage = String(message).toLowerCase();

      if (
        normalizedMessage.includes('no such subscription') ||
        normalizedMessage.includes('a canceled subscription can only update')
      ) {
        await Hospital.findByIdAndUpdate(hospitalId, {
          subscriptionStatus: 'cancelled',
          subscriptionPlan: null,
          stripeSubscriptionId: null,
          subscriptionEndDate: new Date(),
        });

        return res.status(200).json({
          message:
            'Stripe subscription was not found. Subscription marked as cancelled locally. (Check Stripe keys: test vs live mismatch.)',
          cancelledLocally: true,
        });
      }

      throw stripeError;
    }

    // Update hospital document
    await Hospital.findByIdAndUpdate(hospitalId, {
      subscriptionStatus: 'cancelled',
      subscriptionPlan: null,
      stripeSubscriptionId: null,
      subscriptionEndDate: subscription?.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : new Date(),
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
      const session = await createPlanCheckoutSession({ hospital, hospitalId, planType: newPlanType });
      return res.status(200).json({
        message: 'No active Stripe subscription found. Starting a new checkout session.',
        requiresCheckout: true,
        sessionId: session.id,
        sessionUrl: session.url,
      });
    }

    // Get current subscription
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(hospital.stripeSubscriptionId);
    } catch (stripeError) {
      const message = stripeError?.message || 'Failed to retrieve Stripe subscription';

      // If the subscription id stored in DB doesn't exist in Stripe (often due to test/live mismatch),
      // fall back to a fresh checkout flow.
      if (String(message).toLowerCase().includes('no such subscription')) {
        await Hospital.findByIdAndUpdate(hospitalId, {
          stripeSubscriptionId: null,
          subscriptionStatus: 'expired',
        });

        const session = await createPlanCheckoutSession({ hospital, hospitalId, planType: newPlanType });

        return res.status(200).json({
          message: 'Existing Stripe subscription was not found. Starting a new checkout session.',
          requiresCheckout: true,
          sessionId: session.id,
          sessionUrl: session.url,
        });
      }

      throw stripeError;
    }

    // Stripe doesn't allow updating a cancelled subscription's items/price.
    // In that case, start a fresh checkout session for the requested plan.
    if (subscription?.status === 'canceled') {
      await Hospital.findByIdAndUpdate(hospitalId, {
        stripeSubscriptionId: null,
        subscriptionStatus: 'cancelled',
      });

      const session = await createPlanCheckoutSession({ hospital, hospitalId, planType: newPlanType });

      return res.status(200).json({
        message: 'Subscription was cancelled. Starting a new checkout session to subscribe again.',
        requiresCheckout: true,
        sessionId: session.id,
        sessionUrl: session.url,
      });
    }

    // Get the price ID for the new plan
    const newPlan = SUBSCRIPTION_PLANS[newPlanType];
    const stripePriceId = getStripePriceId(newPlanType);

    let resolvedStripePriceId = stripePriceId;
    if (!resolvedStripePriceId) {
      const product = await stripe.products.create({
        name: newPlan.name,
        description: newPlan.description,
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: newPlan.price,
        currency: newPlan.currency || 'usd',
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
      });
      resolvedStripePriceId = price.id;
    }

    if (!subscription.items?.data?.length) {
      return res.status(400).json({ error: 'No subscription items found for update' });
    }

    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(hospital.stripeSubscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: resolvedStripePriceId,
        },
      ],
      // Charge prorations immediately (upgrade/downgrade math handled by Stripe).
      proration_behavior: 'always_invoice',
      // If cancellation was scheduled, switching plans should keep it active.
      cancel_at_period_end: false,
      metadata: {
        hospitalId: hospitalId.toString(),
        planType: newPlanType,
      },
    });

    let amountDue = null;
    let currency = null;
    try {
      const latestInvoiceId = normalizeStripeId(updatedSubscription?.latest_invoice);
      if (latestInvoiceId) {
        const invoice = await stripe.invoices.retrieve(latestInvoiceId);
        amountDue = typeof invoice?.amount_due === 'number' ? invoice.amount_due : null;
        currency = invoice?.currency || null;
      }
    } catch {
      // ignore; proration is still applied even if we can't fetch invoice details
    }

    // Update hospital document
    await Hospital.findByIdAndUpdate(hospitalId, {
      subscriptionPlan: newPlanType,
      subscriptionStatus: 'active',
      subscriptionStartDate: updatedSubscription.current_period_start
        ? new Date(updatedSubscription.current_period_start * 1000)
        : hospital.subscriptionStartDate,
      subscriptionEndDate: updatedSubscription.current_period_end
        ? new Date(updatedSubscription.current_period_end * 1000)
        : hospital.subscriptionEndDate,
    });

    res.status(200).json({
      message: 'Subscription plan updated successfully',
      newPlan: newPlanType,
      ...(amountDue !== null ? { amountDue, currency } : {}),
    });
  } catch (error) {
    console.error('Error updating subscription plan:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Confirm subscription checkout session after redirect.
 * Useful when webhook delivery is delayed.
 */
export const confirmSubscriptionCheckoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Checkout session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (!session) {
      return res.status(404).json({ error: 'Checkout session not found' });
    }

    if (session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Checkout session is not a subscription' });
    }

    const metadata = session.metadata || {};
    const hospitalId = metadata.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ error: 'Checkout session is missing hospital metadata' });
    }

    const access = ensureHospitalAccess(req, hospitalId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (session.status !== 'complete') {
      return res.status(409).json({
        error: 'Checkout is not completed yet',
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
      });
    }

    if (session.payment_status && !['paid', 'no_payment_required'].includes(session.payment_status)) {
      return res.status(409).json({
        error: 'Payment is not completed yet',
        sessionStatus: session.status,
        paymentStatus: session.payment_status,
      });
    }

    await handleSubscriptionCheckoutCompleted(session);

    const hospital = await Hospital.findById(hospitalId).select(
      'subscriptionStatus subscriptionPlan subscriptionStartDate subscriptionEndDate trialStartDate trialEndDate trialUsed'
    );

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const context = await evaluateAndSyncSubscriptionState(hospital);
    const snapshot = buildSubscriptionSnapshot(context.hospital);

    return res.status(200).json({
      message: 'Subscription checkout confirmed',
      subscription: {
        hospitalId: context.hospital._id,
        status: snapshot.status,
        plan: snapshot.currentPlan || 'none',
        effectivePlan: snapshot.effectivePlan || 'none',
        hasAccess: snapshot.hasAccess,
        isTrialActive: snapshot.isTrialActive,
        trialStartDate: snapshot.trialStartDate,
        trialEndDate: snapshot.trialEndDate,
        subscriptionStartDate: snapshot.subscriptionStartDate,
        subscriptionEndDate: snapshot.subscriptionEndDate,
      },
    });
  } catch (error) {
    console.error('Error confirming subscription checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
};
