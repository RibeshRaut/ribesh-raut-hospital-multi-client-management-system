import Appointment from '../models/appointment.model.js';
import Doctor from '../models/doctor.model.js';
import Hospital from '../models/hospital.model.js';
import Schedule from '../models/schedule.model.js';
import {
  createAppointmentSchema,
  updateAppointmentStatusSchema,
  cancelAppointmentSchema,
} from '../joi/appointment.joi.js';
import {
  sendAppointmentConfirmationToDoctor,
  sendAppointmentCancellationToDoctor,
  sendAppointmentConfirmationToPatient,
} from '../services/email.service.js';
import { emitAppointmentEvent } from '../socket.js';
import {
  evaluateAndSyncSubscriptionState,
  validateMonthlyAppointmentQuota,
} from '../services/subscription.service.js';

export const createAppointmentRequest = async (req, res) => {
  try {
    // Handle both old format (with Joi validation) and new format (direct from frontend)
    const {
      doctorId,
      hospitalId,
      appointmentDate,
      appointmentTime,
      patientName,
      patientEmail,
      patientPhone,
      reason,
      notes,
      userName,
      userEmail,
      userPhone,
      duration = 30,
    } = req.body;

    // Validate required fields
    if (!patientName && !userName) {
      return res.status(400).json({ error: 'Patient name is required' });
    }
    if (!patientEmail && !userEmail) {
      return res.status(400).json({ error: 'Patient email is required' });
    }
    if (!patientPhone && !userPhone) {
      return res.status(400).json({ error: 'Patient phone is required' });
    }
    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }
    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const subscriptionContext = req.subscriptionContext || (await evaluateAndSyncSubscriptionState(hospital));
    if (!subscriptionContext.hasAccess) {
      return res.status(402).json({ error: subscriptionContext.reason });
    }

    const monthlyQuota = await validateMonthlyAppointmentQuota(hospitalId, subscriptionContext.effectivePlanId);
    if (!monthlyQuota.allowed) {
      return res.status(403).json({
        error: monthlyQuota.message,
        code: 'APPOINTMENT_LIMIT_REACHED',
        data: {
          current: monthlyQuota.current,
          limit: monthlyQuota.limit,
          plan: subscriptionContext.effectivePlanId,
        },
      });
    }
    if (!appointmentDate) {
      return res.status(400).json({ error: 'Appointment date is required' });
    }

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

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
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

    const appointment = new Appointment({
      doctorId,
      userId: 'guest',
      userName: patientName || userName,
      userEmail: patientEmail || userEmail,
      userPhone: patientPhone || userPhone,
      hospitalId,
      appointmentDate: appointmentDateObj,
      duration,
      notes: reason || notes || '',
      status: 'pending',
    });

    await appointment.save();

    // Populate doctor details
    await appointment.populate('doctorId');

    // Emit real-time event to notify admins and doctors
    const io = req.app.get('io');
    if (io) {
      emitAppointmentEvent(io, 'created', {
        ...appointment.toObject(),
        hospitalId,
        doctorId,
        status: 'pending',
      });
    }

    res.status(201).json({
      message: 'Appointment request created successfully',
      data: appointment,
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { status } = req.query;

    let filter = { doctorId };
    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('doctorId')
      .populate('hospitalId')
      .sort({ appointmentDate: 1 });

    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAppointmentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    let filter = { userId };
    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('doctorId')
      .populate('hospitalId')
      .sort({ appointmentDate: 1 });

    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAppointmentsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { status, doctorId } = req.query;

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let filter = { hospitalId };
    if (status) {
      filter.status = status;
    }
    if (doctorId) {
      filter.doctorId = doctorId;
    }

    const appointments = await Appointment.find(filter)
      .populate('doctorId')
      .populate('hospitalId')
      .sort({ appointmentDate: -1 });

    res.status(200).json({
      message: 'Appointments retrieved successfully',
      data: appointments,
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Find appointment first to check hospital access
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== appointment.hospitalId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Normalize status to match database values
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
    const normalizedStatus = status.toLowerCase();
    
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updateData = { status: normalizedStatus };

    if (normalizedStatus === 'completed' && ['pending', 'half_paid'].includes(appointment.paymentStatus)) {
      const consultationFee = Number(appointment.consultationFee || 0);
      if (consultationFee > 0) {
        updateData.paymentStatus = 'paid';
        updateData.paymentAmount = consultationFee;
      }
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      updateData,
      { new: true }
    )
      .populate('doctorId')
      .populate('hospitalId');

    // Send confirmation emails when appointment is confirmed
    if (normalizedStatus === 'confirmed' && updatedAppointment.doctorId && updatedAppointment.hospitalId) {
      const doctor = updatedAppointment.doctorId;
      const hospital = updatedAppointment.hospitalId;
      
      // Send email to patient
      try {
        await sendAppointmentConfirmationToPatient({
          patientEmail: updatedAppointment.userEmail,
          patientName: updatedAppointment.userName,
          doctorName: doctor.name,
          doctorSpecialty: doctor.specialty,
          appointmentDate: updatedAppointment.appointmentDate,
          duration: updatedAppointment.duration || 30,
          hospitalName: hospital.name,
          hospitalAddress: hospital.address,
          hospitalPhone: hospital.phone,
        });
        console.log('Patient confirmation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send patient confirmation email:', emailError);
      }

      // Send email to doctor
      try {
        await sendAppointmentConfirmationToDoctor({
          doctorEmail: doctor.email,
          doctorName: doctor.name,
          patientName: updatedAppointment.userName,
          patientEmail: updatedAppointment.userEmail,
          patientPhone: updatedAppointment.userPhone,
          appointmentDate: updatedAppointment.appointmentDate,
          duration: updatedAppointment.duration || 30,
          hospitalName: hospital.name,
          notes: updatedAppointment.notes,
        });
        console.log('Doctor confirmation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send doctor confirmation email:', emailError);
      }
    }

    // Emit real-time event for appointment status update
    const io = req.app.get('io');
    if (io) {
      emitAppointmentEvent(io, 'statusUpdated', {
        ...updatedAppointment.toObject(),
        status: normalizedStatus,
      });
    }

    res.status(200).json({
      message: 'Appointment status updated successfully',
      data: updatedAppointment,
    });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ error: error.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== appointment.hospitalId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { 
        status: 'cancelled',
        adminNotes: reason || 'Cancelled by user'
      },
      { new: true }
    )
      .populate('doctorId')
      .populate('hospitalId');

    if (updatedAppointment.doctorId && updatedAppointment.doctorId.email) {
      const hospital = await Hospital.findById(updatedAppointment.hospitalId);
      const emailData = {
        doctorEmail: updatedAppointment.doctorId.email,
        doctorName: updatedAppointment.doctorId.name,
        patientName: updatedAppointment.userName,
        appointmentDate: updatedAppointment.appointmentDate,
        hospitalName: hospital?.name || 'Hospital',
        cancellationReason: reason || 'Cancelled',
      };

      sendAppointmentCancellationToDoctor(emailData).catch((err) => {
        console.error('Failed to send cancellation email:', err);
      });
    }

    // Emit real-time event for appointment cancellation
    const io = req.app.get('io');
    if (io) {
      emitAppointmentEvent(io, 'cancelled', {
        ...updatedAppointment.toObject(),
        status: 'cancelled',
      });
    }

    res.status(200).json({
      message: 'Appointment cancelled successfully',
      data: updatedAppointment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markAppointmentFullyPaid = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== appointment.hospitalId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const consultationFee = Number(appointment.consultationFee || 0);
    const nextPaymentAmount = consultationFee > 0 ? consultationFee : Number(appointment.paymentAmount || 0);

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        paymentStatus: 'paid',
        paymentAmount: nextPaymentAmount,
      },
      { new: true }
    )
      .populate('doctorId')
      .populate('hospitalId');

    res.status(200).json({
      message: 'Appointment marked as fully paid successfully',
      data: updatedAppointment,
    });
  } catch (error) {
    console.error('Error marking appointment as fully paid:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({ error: 'Doctor ID and date are required' });
    }

    const schedule = await Schedule.findOne({ doctorId, status: 'Active' });
    if (!schedule) {
      return res.status(200).json([]);
    }

    const requestedDate = new Date(date);
    const requestedDayName = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const normalizedRequestedDay = requestedDayName.toLowerCase();
    const isDoctorWorkingOnDay = (schedule.days || []).some((day) => {
      const normalizedDay = String(day).toLowerCase();
      return normalizedDay === normalizedRequestedDay || normalizedDay.slice(0, 3) === normalizedRequestedDay.slice(0, 3);
    });

    if (!isDoctorWorkingOnDay) {
      return res.status(200).json([]);
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      doctorId,
      appointmentDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      status: { $in: ['confirmed', 'pending'] },
    });

    // Generate available slots from doctor's configured schedule
    const availableSlots = [];
    const slotDuration = Number(schedule.slotDuration) || 30;
    const [startHour, startMinute] = String(schedule.startTime || '09:00').split(':').map(Number);
    const [endHour, endMinute] = String(schedule.endTime || '17:00').split(':').map(Number);

    let slotTime = new Date(date);
    slotTime.setHours(startHour, startMinute, 0, 0);

    const scheduleEndTime = new Date(date);
    scheduleEndTime.setHours(endHour, endMinute, 0, 0);

    while (slotTime < scheduleEndTime) {
      let isAvailable = true;
      for (const appointment of appointments) {
        const appointmentEnd = new Date(appointment.appointmentDate.getTime() + appointment.duration * 60000);
        if (slotTime >= appointment.appointmentDate && slotTime < appointmentEnd) {
          isAvailable = false;
          break;
        }
      }

      if (isAvailable) {
        const hour = slotTime.getHours();
        const minute = slotTime.getMinutes();
        const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        availableSlots.push({
          time: formattedTime,
          label: formattedTime,
          isoTime: slotTime.toISOString(),
        });
      }

      slotTime = new Date(slotTime.getTime() + slotDuration * 60000);
    }

    res.status(200).json(availableSlots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAppointmentById = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId')
      .populate('hospitalId');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify user has access to this appointment's hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== appointment.hospitalId._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({
      message: 'Appointment retrieved successfully',
      data: appointment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get unique patients from appointments for a hospital
export const getPatients = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Aggregate unique patients from appointments
    const patients = await Appointment.aggregate([
      { $match: { hospitalId: new (await import('mongoose')).default.Types.ObjectId(hospitalId) } },
      {
        $group: {
          _id: '$userEmail',
          name: { $first: '$userName' },
          email: { $first: '$userEmail' },
          phone: { $first: '$userPhone' },
          lastVisit: { $max: '$appointmentDate' },
          totalVisits: { $sum: 1 },
          completedVisits: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledVisits: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
        },
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          email: 1,
          phone: 1,
          lastVisit: 1,
          totalVisits: 1,
          completedVisits: 1,
          cancelledVisits: 1,
          status: {
            $cond: {
              if: { $gte: ['$lastVisit', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)] },
              then: 'Active',
              else: 'Inactive'
            }
          }
        },
      },
      { $sort: { lastVisit: -1 } },
    ]);

    res.status(200).json({
      message: 'Patients retrieved successfully',
      data: patients,
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get patient history (appointments for a specific patient)
export const getPatientHistory = async (req, res) => {
  try {
    const { hospitalId, patientEmail } = req.params;

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const appointments = await Appointment.find({
      hospitalId,
      userEmail: decodeURIComponent(patientEmail),
    })
      .populate('doctorId', 'name specialty')
      .sort({ appointmentDate: -1 });

    res.status(200).json({
      message: 'Patient history retrieved successfully',
      data: appointments,
    });
  } catch (error) {
    console.error('Error fetching patient history:', error);
    res.status(500).json({ error: error.message });
  }
};
