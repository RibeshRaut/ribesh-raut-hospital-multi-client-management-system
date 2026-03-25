import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
import Stripe from 'stripe';
import Appointment from '../models/appointment.model.js';
import Doctor from '../models/doctor.model.js';
import Hospital from '../models/hospital.model.js';
import {
  sendAppointmentConfirmationToDoctor,
  sendAppointmentConfirmationToPatient,
} from '../services/email.service.js';
import { emitPaymentEvent } from '../socket.js';
import { handleSubscriptionWebhook } from './subscription.controller.js';

// Debug log for Stripe key
console.log('Stripe Key:', process.env.STRIPE_SECRET_KEY);
// Initialize Stripe with test secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_test_key');

/**
 * Create a Stripe Checkout Session for appointment booking
 * Takes 50% of the consultation fee as advance payment
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const {
      doctorId,
      hospitalId,
      appointmentDate,
      appointmentTime,
      patientName,
      patientEmail,
      patientPhone,
      reason,
      duration = 30,
    } = req.body;

    // Validate required fields
    if (!patientName) {
      return res.status(400).json({ error: 'Patient name is required' });
    }
    if (!patientEmail) {
      return res.status(400).json({ error: 'Patient email is required' });
    }
    if (!patientPhone) {
      return res.status(400).json({ error: 'Patient phone is required' });
    }
    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }
    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }
    if (!appointmentDate) {
      return res.status(400).json({ error: 'Appointment date is required' });
    }

    // Get doctor details for consultation fee
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Get hospital details for display
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const consultationFee = doctor.consultationFee || 0;
    
    // If no consultation fee, return error
    if (consultationFee <= 0) {
      return res.status(400).json({ error: 'Doctor consultation fee is not set' });
    }

    // Calculate 50% advance payment (in cents for Stripe)
    const paymentAmount = Math.round(consultationFee / 2);
    const paymentAmountCents = paymentAmount * 100;

    // Combine date and time
    let appointmentDateObj;
    if (appointmentTime) {
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      appointmentDateObj = new Date(appointmentDate);
      appointmentDateObj.setHours(hours, minutes, 0, 0);
    } else {
      appointmentDateObj = new Date(appointmentDate);
    }

    if (appointmentDateObj < new Date()) {
      return res.status(400).json({ error: 'Appointment date cannot be in the past' });
    }

    // Check for conflicts
    const appointmentEndTime = new Date(appointmentDateObj.getTime() + duration * 60000);
    const existingAppointments = await Appointment.find({
      doctorId,
      status: { $in: ['confirmed', 'pending'] },
      appointmentDate: {
        $lt: appointmentEndTime,
      },
    });

    for (const existing of existingAppointments) {
      const existingEndTime = new Date(existing.appointmentDate.getTime() + existing.duration * 60000);
      if (appointmentDateObj < existingEndTime && appointmentEndTime > existing.appointmentDate) {
        return res.status(409).json({ error: 'Doctor is not available at this time slot' });
      }
    }

    // Create appointment with pending payment status
    const appointment = new Appointment({
      doctorId,
      userId: 'guest',
      userName: patientName,
      userEmail: patientEmail,
      userPhone: patientPhone,
      hospitalId,
      appointmentDate: appointmentDateObj,
      duration,
      notes: reason || '',
      status: 'pending',
      consultationFee: consultationFee,
      paymentAmount: paymentAmount,
      paymentStatus: 'pending',
    });

    await appointment.save();

    // Format date for display
    const formattedDate = appointmentDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = appointmentTime
      ? new Date(`2000-01-01T${appointmentTime}`).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : '';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: patientEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Appointment with Dr. ${doctor.name}`,
              description: `${formattedDate}${formattedTime ? ` at ${formattedTime}` : ''} - ${hospital.name}`,
              ...(doctor.photo && typeof doctor.photo === 'string' && doctor.photo.trim() && doctor.photo.startsWith('/')
                ? { images: [`${process.env.BACKEND_URL || 'http://localhost:3002'}${doctor.photo}`] }
                : {})
            },
            unit_amount: paymentAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        appointmentId: appointment._id.toString(),
        doctorId: doctorId,
        hospitalId: hospitalId,
        patientName: patientName,
        patientEmail: patientEmail,
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/hospital/${hospital.slug || hospital._id}?payment=success&appointment=${appointment._id}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/hospital/${hospital.slug || hospital._id}?payment=cancelled&appointment=${appointment._id}`,
    });

    // Update appointment with Stripe session ID
    appointment.stripeSessionId = session.id;
    await appointment.save();

    res.status(200).json({
      message: 'Checkout session created successfully',
      sessionId: session.id,
      sessionUrl: session.url,
      appointmentId: appointment._id,
      paymentAmount: paymentAmount,
      consultationFee: consultationFee,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Stripe Webhook handler for payment events
 */
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const io = req.app.get('io');

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // For testing without webhook signature verification
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handlePaymentSuccess(event.data.object, io);
      break;

    case 'checkout.session.expired':
      await handlePaymentExpired(event.data.object, io);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object, io);
      break;

    // Handle subscription events
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      await handleSubscriptionWebhook(event, io);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
};

/**
 * Handle successful payment
 */
const handlePaymentSuccess = async (session, io) => {
  try {
    const appointmentId = session.metadata?.appointmentId;
    
    if (!appointmentId) {
      console.error('No appointment ID in session metadata');
      return;
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId')
      .populate('hospitalId');

    if (!appointment) {
      console.error('Appointment not found:', appointmentId);
      return;
    }

    // Update appointment payment status (50% payment = half_paid)
    appointment.paymentStatus = 'half_paid';
    appointment.stripePaymentIntentId = session.payment_intent;
    appointment.status = 'confirmed'; // Auto-confirm on payment
    await appointment.save();

    // Send confirmation and payment receipt emails
    try {
      await sendAppointmentConfirmationToDoctor(appointment);
      await sendAppointmentConfirmationToPatient(appointment);
      // Send payment receipt email
      const { sendPaymentReceiptToPatient } = await import('../services/email.service.js');
      await sendPaymentReceiptToPatient({
        patientName: appointment.userName,
        patientEmail: appointment.userEmail,
        appointmentDate: appointment.appointmentDate,
        doctorName: appointment.doctorId?.name,
        hospitalName: appointment.hospitalId?.name,
        consultationFee: appointment.consultationFee,
        paymentAmount: appointment.paymentAmount,
        transactionId: session.payment_intent,
      });
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
    }

    // Emit real-time event for payment success
    if (io) {
      emitPaymentEvent(io, 'paymentSuccess', {
        appointmentId,
        status: 'confirmed',
        paymentStatus: 'half_paid',
        hospitalId: appointment.hospitalId,
        doctorId: appointment.doctorId,
        userId: appointment.userId,
      });
    }

    console.log(`Payment successful for appointment: ${appointmentId}`);
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
};

/**
 * Handle expired checkout session
 */
const handlePaymentExpired = async (session, io) => {
  try {
    const appointmentId = session.metadata?.appointmentId;
    
    if (!appointmentId) {
      return;
    }

    const appointment = await Appointment.findById(appointmentId);

    if (appointment && appointment.paymentStatus === 'pending') {
      appointment.status = 'cancelled';
      appointment.paymentStatus = 'failed';
      appointment.adminNotes = 'Payment session expired';
      await appointment.save();

      // Emit real-time event for payment expiration
      if (io) {
        emitPaymentEvent(io, 'paymentExpired', {
          appointmentId,
          status: 'cancelled',
          paymentStatus: 'failed',
          hospitalId: appointment.hospitalId,
          userId: appointment.userId,
        });
      }
    }

    console.log(`Payment expired for appointment: ${appointmentId}`);
  } catch (error) {
    console.error('Error handling payment expiration:', error);
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (paymentIntent, io) => {
  try {
    // Find appointment by payment intent
    const appointment = await Appointment.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (appointment) {
      appointment.paymentStatus = 'failed';
      appointment.adminNotes = `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`;
      await appointment.save();

      // Emit real-time event for payment failure
      if (io) {
        emitPaymentEvent(io, 'paymentFailed', {
          appointmentId: appointment._id,
          paymentStatus: 'failed',
          hospitalId: appointment.hospitalId,
          userId: appointment.userId,
          reason: paymentIntent.last_payment_error?.message || 'Payment failed',
        });
      }
    }

    console.log(`Payment failed for payment intent: ${paymentIntent.id}`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
};

/**
 * Get payment status for an appointment
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId', 'name specialty consultationFee')
      .populate('hospitalId', 'name');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.status(200).json({
      appointmentId: appointment._id,
      status: appointment.status,
      paymentStatus: appointment.paymentStatus,
      consultationFee: appointment.consultationFee,
      paymentAmount: appointment.paymentAmount,
      remainingAmount: appointment.consultationFee - appointment.paymentAmount,
      doctor: appointment.doctorId,
      hospital: appointment.hospitalId,
      appointmentDate: appointment.appointmentDate,
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Verify payment session status (for frontend verification)
 */
export const verifyPaymentSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const appointment = await Appointment.findOne({ stripeSessionId: sessionId })
      .populate('doctorId', 'name specialty')
      .populate('hospitalId', 'name');

    res.status(200).json({
      sessionStatus: session.status,
      paymentStatus: session.payment_status,
      appointment: appointment
        ? {
            id: appointment._id,
            status: appointment.status,
            paymentStatus: appointment.paymentStatus,
            doctorName: appointment.doctorId?.name,
            hospitalName: appointment.hospitalId?.name,
            appointmentDate: appointment.appointmentDate,
          }
        : null,
    });
  } catch (error) {
    console.error('Error verifying payment session:', error);
    res.status(500).json({ error: error.message });
  }
};
