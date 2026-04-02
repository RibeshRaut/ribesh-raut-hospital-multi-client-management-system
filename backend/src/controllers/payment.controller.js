import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
import Stripe from 'stripe';
import Appointment from '../models/appointment.model.js';
import Doctor from '../models/doctor.model.js';
import Hospital from '../models/hospital.model.js';
import {
  sendAppointmentConfirmationToDoctor,
  sendAppointmentConfirmationToPatient,
  sendPaymentReceiptToPatient,
  sendRemainingPaymentLinkToPatient,
} from '../services/email.service.js';
import { emitAppointmentEvent, emitPaymentEvent } from '../socket.js';
import { handleSubscriptionCheckoutCompleted, handleSubscriptionWebhook } from './subscription.controller.js';
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
  const allowInsecureWebhookInDev =
    process.env.NODE_ENV === 'development' && process.env.STRIPE_ALLOW_INSECURE_WEBHOOKS === 'true';
  const io = req.app.get('io');

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else if (allowInsecureWebhookInDev) {
      event = req.body;
    } else {
      console.error('Stripe webhook misconfiguration: STRIPE_WEBHOOK_SECRET is required.');
      return res
        .status(500)
        .json({ error: 'Webhook is not configured securely. Please set STRIPE_WEBHOOK_SECRET.' });
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object, io);
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

const handleCheckoutSessionCompleted = async (session, io) => {
  if (session.mode === 'subscription') {
    await handleSubscriptionCheckoutCompleted(session);
    return;
  }

  await handlePaymentSuccess(session, io);
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

    if (session.payment_status !== 'paid') {
      console.warn(
        `Skipping appointment confirmation because Stripe session is not paid. appointmentId=${appointmentId}, payment_status=${session.payment_status}`
      );
      return;
    }

    if (
      appointment.status === 'confirmed' &&
      appointment.paymentStatus === 'half_paid' &&
      appointment.stripePaymentIntentId &&
      String(appointment.stripePaymentIntentId) === String(session.payment_intent)
    ) {
      console.log(`Payment success webhook already processed for appointment: ${appointmentId}`);
      return;
    }

    const paymentType = session.metadata?.paymentType || 'advance';

    if (paymentType === 'remaining_balance') {
      const consultationFee = Number(appointment.consultationFee || 0);
      appointment.paymentStatus = 'paid';
      if (consultationFee > 0) {
        appointment.paymentAmount = consultationFee;
      }
    } else {
      appointment.paymentStatus = 'half_paid';
    }

    appointment.stripePaymentIntentId = session.payment_intent;
    appointment.status = 'confirmed'; // Auto-confirm on payment
    await appointment.save();

    const doctor = appointment.doctorId;
    const hospital = appointment.hospitalId;

    // Send confirmation and receipt emails immediately after successful payment
    const emailTasks = [];

    emailTasks.push(
      sendAppointmentConfirmationToPatient({
        patientEmail: appointment.userEmail,
        patientName: appointment.userName,
        doctorName: doctor?.name,
        doctorSpecialty: doctor?.specialty,
        appointmentDate: appointment.appointmentDate,
        duration: appointment.duration || 30,
        hospitalName: hospital?.name,
        hospitalAddress: hospital?.address,
        hospitalPhone: hospital?.phone,
      })
    );

    if (doctor?.email) {
      emailTasks.push(
        sendAppointmentConfirmationToDoctor({
          doctorEmail: doctor.email,
          doctorName: doctor.name,
          patientName: appointment.userName,
          patientEmail: appointment.userEmail,
          patientPhone: appointment.userPhone,
          appointmentDate: appointment.appointmentDate,
          duration: appointment.duration || 30,
          hospitalName: hospital?.name,
          notes: appointment.notes,
        })
      );
    }

    emailTasks.push(
      sendPaymentReceiptToPatient({
        patientName: appointment.userName,
        patientEmail: appointment.userEmail,
        appointmentDate: appointment.appointmentDate,
        doctorName: doctor?.name,
        hospitalName: hospital?.name,
        consultationFee: appointment.consultationFee,
        paymentAmount: appointment.paymentAmount,
        transactionId: session.payment_intent,
      })
    );

    const emailResults = await Promise.allSettled(emailTasks);
    emailResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Email task ${index + 1} failed for appointment ${appointmentId}:`, result.reason);
      }
    });

    // Emit real-time event for payment success
    if (io) {
      emitPaymentEvent(io, 'paymentSuccess', {
        appointmentId,
        status: 'confirmed',
        paymentStatus: appointment.paymentStatus,
        paymentType,
        hospitalId: appointment.hospitalId,
        doctorId: appointment.doctorId,
        userId: appointment.userId,
      });

      emitAppointmentEvent(io, 'statusUpdated', {
        ...appointment.toObject(),
        status: 'confirmed',
      });
    }

    console.log(`Payment successful for appointment: ${appointmentId}`);
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
};

/**
 * Send remaining payment link to patient email
 */
export const sendRemainingPaymentLink = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId')
      .populate('hospitalId');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const requesterHospitalId = req.user?.hospitalId || req.user?.id;
    if (
      req.user?.userType === 'hospital_admin' &&
      String(appointment.hospitalId?._id || appointment.hospitalId) !== String(requesterHospitalId)
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot send payment link for cancelled appointment' });
    }

    const consultationFee = Number(appointment.consultationFee || 0);
    const paidAmount = Number(appointment.paymentAmount || 0);
    const remainingAmount = Math.max(consultationFee - paidAmount, 0);

    if (consultationFee <= 0 || remainingAmount <= 0) {
      return res.status(400).json({ error: 'No remaining payment due for this appointment' });
    }

    const doctor = appointment.doctorId;
    const hospital = appointment.hospitalId;
    const paymentAmountCents = Math.round(remainingAmount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: appointment.userEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Remaining balance - Appointment with Dr. ${doctor?.name || 'Doctor'}`,
              description: `${hospital?.name || 'Hospital'} appointment remaining payment`,
            },
            unit_amount: paymentAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        appointmentId: appointment._id.toString(),
        doctorId: String(doctor?._id || ''),
        hospitalId: String(hospital?._id || ''),
        patientName: appointment.userName,
        patientEmail: appointment.userEmail,
        paymentType: 'remaining_balance',
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/hospital/${hospital?.slug || hospital?._id}?payment=success&appointment=${appointment._id}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/hospital/${hospital?.slug || hospital?._id}?payment=cancelled&appointment=${appointment._id}`,
    });

    const emailResult = await sendRemainingPaymentLinkToPatient({
      patientName: appointment.userName,
      patientEmail: appointment.userEmail,
      doctorName: doctor?.name,
      hospitalName: hospital?.name,
      appointmentDate: appointment.appointmentDate,
      remainingAmount,
      paymentLink: session.url,
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: emailResult.error || 'Failed to send payment link email' });
    }

    const io = req.app.get('io');
    if (io) {
      emitPaymentEvent(io, 'paymentLinkSent', {
        appointmentId: appointment._id,
        hospitalId: appointment.hospitalId,
        userId: appointment.userId,
        remainingAmount,
      });
    }

    return res.status(200).json({
      message: 'Remaining payment link sent successfully',
      data: {
        appointmentId: appointment._id,
        remainingAmount,
      },
    });
  } catch (error) {
    console.error('Error sending remaining payment link:', error);
    return res.status(500).json({ error: error.message || 'Failed to send remaining payment link' });
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

/**
 * Confirm appointment after successful payment redirect.
 * Fallback for environments where webhook delivery may be delayed.
 */
export const confirmPaidAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!appointment.stripeSessionId) {
      return res.status(400).json({ error: 'No Stripe session found for this appointment' });
    }

    const session = await stripe.checkout.sessions.retrieve(appointment.stripeSessionId);
    if (!session || session.payment_status !== 'paid') {
      return res.status(409).json({
        error: 'Payment is not completed yet',
        paymentStatus: session?.payment_status || 'unpaid',
      });
    }

    await handlePaymentSuccess(session, req.app.get('io'));

    const updatedAppointment = await Appointment.findById(appointmentId)
      .populate('doctorId', 'name specialty')
      .populate('hospitalId', 'name');

    return res.status(200).json({
      message: 'Appointment confirmed successfully after payment',
      data: {
        appointmentId: updatedAppointment?._id,
        status: updatedAppointment?.status,
        paymentStatus: updatedAppointment?.paymentStatus,
        appointmentDate: updatedAppointment?.appointmentDate,
        doctorName: updatedAppointment?.doctorId?.name,
        hospitalName: updatedAppointment?.hospitalId?.name,
      },
    });
  } catch (error) {
    console.error('Error confirming paid appointment:', error);
    return res.status(500).json({ error: error.message });
  }
};
