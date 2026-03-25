import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
import Stripe from 'stripe';
import Hospital from '../models/hospital.model.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_test_key');

const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic Plan',
    price: 2999, // $29.99 per month in cents
    features: ['Up to 5 doctors', 'Basic analytics', 'Email support'],
    description: 'Perfect for small clinics',
  },
  professional: {
    name: 'Professional Plan',
    price: 7999, // $79.99 per month in cents
    features: ['Up to 25 doctors', 'Advanced analytics', 'Priority support', 'Custom branding'],
    description: 'For growing hospitals',
  },
  enterprise: {
    name: 'Enterprise Plan',
    price: 19999, // $199.99 per month in cents
    features: ['Unlimited doctors', 'Full analytics', '24/7 support', 'Custom integration', 'Dedicated account manager'],
    description: 'For large healthcare networks',
  },
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

    const plan = SUBSCRIPTION_PLANS[planType];

    // Create Stripe Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: hospitalEmail,
      line_items: [
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
      metadata: {
        hospitalId: hospitalId.toString(),
        planType: planType,
        hospitalName: hospitalName,
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

/**
 * Handle subscription created
 */
const handleSubscriptionCreated = async (subscription) => {
  try {
    const metadata = subscription.metadata;
    const hospitalId = metadata?.hospitalId;

    if (!hospitalId) {
      console.error('No hospital ID in subscription metadata');
      return;
    }

    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        subscriptionStatus: 'active',
        subscriptionPlan: metadata.planType,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer,
        subscriptionStartDate: new Date(subscription.current_period_start * 1000),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      },
      { new: true }
    );

    console.log(`Subscription created for hospital: ${hospitalId}`, subscription.id);
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

    if (!hospitalId) {
      console.error('No hospital ID in subscription metadata');
      return;
    }

    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        subscriptionStatus: subscription.status === 'active' ? 'active' : 'inactive',
        subscriptionPlan: metadata.planType,
        subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      },
      { new: true }
    );

    console.log(`Subscription updated for hospital: ${hospitalId}`);
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

    if (!hospitalId) {
      console.error('No hospital ID in subscription metadata');
      return;
    }

    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        subscriptionStatus: 'cancelled',
        subscriptionEndDate: new Date(subscription.canceled_at * 1000),
      },
      { new: true }
    );

    console.log(`Subscription cancelled for hospital: ${hospitalId}`);
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
};

/**
 * Handle invoice payment succeeded
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
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

    const hospital = await Hospital.findById(hospitalId)
      .select('subscriptionStatus subscriptionPlan subscriptionStartDate subscriptionEndDate');

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const subscriptionDetails = {
      hospitalId: hospital._id,
      status: hospital.subscriptionStatus || 'inactive',
      plan: hospital.subscriptionPlan || 'none',
      planDetails: hospital.subscriptionPlan ? SUBSCRIPTION_PLANS[hospital.subscriptionPlan] : null,
      startDate: hospital.subscriptionStartDate,
      endDate: hospital.subscriptionEndDate,
      isActive: hospital.subscriptionStatus === 'active',
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

    // Create a new price for the new plan
    const priceResponse = await stripe.prices.create({
      currency: 'usd',
      unit_amount: newPlan.price,
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: newPlan.name,
      },
    });

    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(
      hospital.stripeSubscriptionId,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceResponse.id,
          },
        ],
      }
    );

    // Update hospital document
    await Hospital.findByIdAndUpdate(hospitalId, {
      subscriptionPlan: newPlanType,
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
