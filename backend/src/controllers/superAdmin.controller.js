import Doctor from '../models/doctor.model.js';
import Appointment from '../models/appointment.model.js';
import Hospital from '../models/hospital.model.js';
import ContactForm from '../models/contactForm.model.js';
import WebsiteContactForm from '../models/websiteContactForm.model.js';
import Service from '../models/service.model.js';
import Admin from '../models/admin.model.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { notifySuperAdmins } from '../services/adminNotification.service.js';
import { sendSuperAdminNotificationEmail, sendWebsiteContactResponseEmail } from '../services/email.service.js';
import { buildSubscriptionSnapshot } from '../services/subscription.service.js';
import { getMonthlyPlanPrice } from '../utils/subscriptionPlans.js';

const formatAppointmentTime = (appointmentDate) => {
  if (!appointmentDate) return '';

  const date = new Date(appointmentDate);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Get super admin dashboard statistics
export const getSuperAdminStats = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    // Get all statistics
    const totalHospitals = await Hospital.countDocuments();
    const totalDoctors = await Doctor.countDocuments();
    const totalAppointments = await Appointment.countDocuments();
    const totalContactForms = await ContactForm.countDocuments();
    const totalServices = await Service.countDocuments();

    const now = new Date();

    const activePaidHospitals = await Hospital.countDocuments({
      subscriptionStatus: 'active',
      subscriptionPlan: { $in: ['basic', 'professional', 'enterprise'] },
      subscriptionEndDate: { $gt: now },
    });
    const trialHospitals = await Hospital.countDocuments({
      subscriptionStatus: 'trial',
      trialEndDate: { $gt: now },
    });
    const expiredHospitals = await Hospital.countDocuments({
      subscriptionStatus: 'expired',
    });

    // Get hospitals with profile complete
    const hospitalsWithProfile = await Hospital.countDocuments({ isProfileComplete: true });

    // Calculate growth metrics
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Hospital growth
    const hospitalsThisMonth = await Hospital.countDocuments({
      createdAt: { $gte: thisMonthStart }
    });
    const hospitalsLastMonth = await Hospital.countDocuments({
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    let hospitalGrowth = 0;
    if (hospitalsLastMonth > 0) {
      hospitalGrowth = Math.round(((hospitalsThisMonth - hospitalsLastMonth) / hospitalsLastMonth) * 100);
    } else if (hospitalsThisMonth > 0) {
      hospitalGrowth = 100;
    }

    // Doctor growth
    const doctorsThisMonth = await Doctor.countDocuments({
      createdAt: { $gte: thisMonthStart }
    });
    const doctorsLastMonth = await Doctor.countDocuments({
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    let doctorGrowth = 0;
    if (doctorsLastMonth > 0) {
      doctorGrowth = Math.round(((doctorsThisMonth - doctorsLastMonth) / doctorsLastMonth) * 100);
    } else if (doctorsThisMonth > 0) {
      doctorGrowth = 100;
    }

    // Appointment statistics by status
    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });
    const confirmedAppointments = await Appointment.countDocuments({ status: 'confirmed' });
    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ status: 'cancelled' });

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await Appointment.countDocuments({
      appointmentDate: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // Get this week's appointments
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const thisWeekAppointments = await Appointment.countDocuments({
      appointmentDate: {
        $gte: weekStart,
        $lt: weekEnd,
      },
    });

    // Get unique patients
    const uniquePatients = await Appointment.distinct('userEmail');
    const totalPatients = uniquePatients.length;

    // Get unread contact forms
    const unreadContactForms = await ContactForm.countDocuments({ status: 'unread' });

    // Get recent hospitals
    const recentHospitals = await Hospital.find()
      .select('name email phone address isProfileComplete createdAt slug subscriptionStatus subscriptionPlan subscriptionStartDate subscriptionEndDate trialStartDate trialEndDate')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent appointments across all hospitals
    const recentAppointments = await Appointment.find()
      .populate('doctorId', 'name specialty')
      .populate('hospitalId', 'name')
      .sort({ appointmentDate: -1 })
      .limit(10);

    // Get hospitals with most appointments
    const topHospitals = await Appointment.aggregate([
      {
        $group: {
          _id: '$hospitalId',
          appointmentCount: { $sum: 1 },
        },
      },
      { $sort: { appointmentCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'hospitals',
          localField: '_id',
          foreignField: '_id',
          as: 'hospital',
        },
      },
      { $unwind: '$hospital' },
      {
        $project: {
          hospitalId: '$_id',
          hospitalName: '$hospital.name',
          hospitalEmail: '$hospital.email',
          appointmentCount: 1,
        },
      },
    ]);

    // Get appointments by month for charts (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const appointmentsByMonth = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Get hospitals by month for charts (last 6 months)
    const hospitalsByMonth = await Hospital.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const hospitalsWithSubscription = await Hospital.find()
      .select('name email subscriptionStatus subscriptionPlan trialEndDate subscriptionEndDate')
      .lean();

    const monthlyRevenueCents = hospitalsWithSubscription.reduce((total, hospital) => {
      const snapshot = buildSubscriptionSnapshot(hospital);
      return total + Math.round(snapshot.estimatedMonthlyRevenue * 100);
    }, 0);

    const revenueByPlan = ['basic', 'professional', 'enterprise'].reduce((acc, planId) => {
      const activeCount = hospitalsWithSubscription.filter(
        (hospital) => hospital.subscriptionStatus === 'active' && hospital.subscriptionPlan === planId
      ).length;

      acc[planId] = {
        hospitals: activeCount,
        monthlyRevenue: (activeCount * getMonthlyPlanPrice(planId)) / 100,
      };

      return acc;
    }, {});

    const topRevenueHospitals = hospitalsWithSubscription
      .map((hospital) => {
        const snapshot = buildSubscriptionSnapshot(hospital);
        return {
          hospitalId: hospital._id,
          hospitalName: hospital.name,
          hospitalEmail: hospital.email,
          monthlyRevenue: snapshot.estimatedMonthlyRevenue,
          subscriptionStatus: snapshot.status,
          plan: snapshot.currentPlan,
          isTrialActive: snapshot.isTrialActive,
        };
      })
      .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
      .slice(0, 10);

    return res.status(200).json({
      message: 'Super admin statistics retrieved successfully',
      data: {
        statistics: {
          hospitals: {
            total: totalHospitals,
            withProfile: hospitalsWithProfile,
            growth: hospitalGrowth,
            thisMonth: hospitalsThisMonth,
          },
          doctors: {
            total: totalDoctors,
            growth: doctorGrowth,
            thisMonth: doctorsThisMonth,
          },
          appointments: {
            total: totalAppointments,
            pending: pendingAppointments,
            confirmed: confirmedAppointments,
            completed: completedAppointments,
            cancelled: cancelledAppointments,
            today: todayAppointments,
            thisWeek: thisWeekAppointments,
          },
          patients: {
            total: totalPatients,
          },
          contactForms: {
            total: totalContactForms,
            unread: unreadContactForms,
          },
          services: {
            total: totalServices,
          },
          subscriptions: {
            activePaid: activePaidHospitals,
            trial: trialHospitals,
            expired: expiredHospitals,
            totalSubscribed: activePaidHospitals + trialHospitals,
          },
          revenue: {
            monthly: monthlyRevenueCents / 100,
            annualRunRate: (monthlyRevenueCents / 100) * 12,
            byPlan: revenueByPlan,
          },
        },
        recentHospitals: recentHospitals.map((hospital) => ({
          _id: hospital._id,
          name: hospital.name,
          email: hospital.email,
          phone: hospital.phone,
          address: hospital.address,
          isProfileComplete: hospital.isProfileComplete,
          createdAt: hospital.createdAt,
          slug: hospital.slug,
          subscription: buildSubscriptionSnapshot(hospital),
        })),
        recentAppointments: recentAppointments.map((apt) => ({
          _id: apt._id,
          patientName: apt.userName,
          patientEmail: apt.userEmail,
          doctorName: apt.doctorId?.name,
          doctorSpecialty: apt.doctorId?.specialty,
          hospitalName: apt.hospitalId?.name,
          appointmentDate: apt.appointmentDate,
          status: apt.status,
        })),
        topHospitals,
        topRevenueHospitals,
        chartData: {
          appointmentsByMonth,
          hospitalsByMonth,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching super admin stats:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get all hospitals
export const getAllHospitals = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    // Profile status filter
    if (status === 'complete') {
      query.isProfileComplete = true;
    } else if (status === 'incomplete') {
      query.isProfileComplete = false;
    }

    const [hospitals, total] = await Promise.all([
      Hospital.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Hospital.countDocuments(query),
    ]);

    // Get stats for each hospital
    const hospitalsWithStats = await Promise.all(
      hospitals.map(async (hospital) => {
        const [doctorCount, appointmentCount, serviceCount] = await Promise.all([
          Doctor.countDocuments({ hospitalId: hospital._id }),
          Appointment.countDocuments({ hospitalId: hospital._id }),
          Service.countDocuments({ hospitalId: hospital._id }),
        ]);

        return {
          ...hospital.toObject(),
          subscription: buildSubscriptionSnapshot(hospital),
          stats: {
            doctors: doctorCount,
            appointments: appointmentCount,
            services: serviceCount,
          },
        };
      })
    );

    return res.status(200).json({
      message: 'Hospitals retrieved successfully',
      data: {
        hospitals: hospitalsWithStats,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get hospital details with full stats
export const getHospitalDetails = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { hospitalId } = req.params;

    const hospital = await Hospital.findById(hospitalId).select('-password');
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    // Get detailed statistics
    const [
      totalDoctors,
      activeDoctors,
      totalAppointments,
      pendingAppointments,
      completedAppointments,
      totalServices,
      totalContactForms,
      recentAppointments,
      doctors,
    ] = await Promise.all([
      Doctor.countDocuments({ hospitalId }),
      Doctor.countDocuments({ hospitalId, status: 'Active' }),
      Appointment.countDocuments({ hospitalId }),
      Appointment.countDocuments({ hospitalId, status: 'pending' }),
      Appointment.countDocuments({ hospitalId, status: 'completed' }),
      Service.countDocuments({ hospitalId }),
      ContactForm.countDocuments({ hospitalId }),
      Appointment.find({ hospitalId })
        .populate('doctorId', 'name specialty')
        .sort({ appointmentDate: -1 })
        .limit(5),
      Doctor.find({ hospitalId }).select('name specialty status email'),
    ]);

    // Get unique patients
    const uniquePatients = await Appointment.distinct('userEmail', { hospitalId });

    return res.status(200).json({
      message: 'Hospital details retrieved successfully',
      data: {
        hospital: {
          ...hospital.toObject(),
          subscription: buildSubscriptionSnapshot(hospital),
        },
        statistics: {
          doctors: {
            total: totalDoctors,
            active: activeDoctors,
          },
          appointments: {
            total: totalAppointments,
            pending: pendingAppointments,
            completed: completedAppointments,
          },
          services: totalServices,
          contactForms: totalContactForms,
          patients: uniquePatients.length,
        },
        recentAppointments: recentAppointments.map((apt) => ({
          _id: apt._id,
          patientName: apt.userName,
          patientEmail: apt.userEmail,
          doctorName: apt.doctorId?.name,
          doctorSpecialty: apt.doctorId?.specialty,
          appointmentDate: apt.appointmentDate,
          status: apt.status,
        })),
        doctors,
      },
    });
  } catch (error) {
    console.error('Error fetching hospital details:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get all appointments across hospitals
export const getAllAppointments = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { page = 1, limit = 10, status = '', hospitalId = '', search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Hospital filter
    if (hospitalId) {
      query.hospitalId = hospitalId;
    }

    // Search filter
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { userPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate('doctorId', 'name specialty')
        .populate('hospitalId', 'name email')
        .sort({ appointmentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Appointment.countDocuments(query),
    ]);

    return res.status(200).json({
      message: 'Appointments retrieved successfully',
      data: {
        appointments: appointments.map((apt) => ({
          _id: apt._id,
          patientName: apt.userName,
          patientEmail: apt.userEmail,
          patientPhone: apt.userPhone,
          doctorName: apt.doctorId?.name,
          doctorSpecialty: apt.doctorId?.specialty,
          hospitalId: apt.hospitalId?._id,
          hospitalName: apt.hospitalId?.name,
          hospitalEmail: apt.hospitalId?.email,
          appointmentDate: apt.appointmentDate,
          timeSlot: formatAppointmentTime(apt.appointmentDate),
          appointmentTime: formatAppointmentTime(apt.appointmentDate),
          status: apt.status,
          notes: apt.notes,
          createdAt: apt.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get all doctors across hospitals
export const getAllDoctors = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { page = 1, limit = 10, status = '', hospitalId = '', search = '', specialty = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Hospital filter
    if (hospitalId) {
      query.hospitalId = hospitalId;
    }

    // Specialty filter
    if (specialty) {
      query.specialty = { $regex: specialty, $options: 'i' };
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
      ];
    }

    const [doctors, total] = await Promise.all([
      Doctor.find(query)
        .populate('hospitalId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Doctor.countDocuments(query),
    ]);

    return res.status(200).json({
      message: 'Doctors retrieved successfully',
      data: {
        doctors: doctors.map((doc) => ({
          _id: doc._id,
          name: doc.name,
          email: doc.email,
          phone: doc.phone,
          specialty: doc.specialty,
          qualification: doc.qualifications,
          experience: doc.experience,
          status: doc.status,
          hospitalId: doc.hospitalId?._id,
          hospitalName: doc.hospitalId?.name,
          photo: doc.photo,
          createdAt: doc.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get all contact forms across hospitals
export const getAllContactForms = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { page = 1, limit = 10, status = '', hospitalId = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Hospital filter
    if (hospitalId) {
      query.hospitalId = hospitalId;
    }

    const [contactForms, total] = await Promise.all([
      ContactForm.find(query)
        .populate('hospitalId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ContactForm.countDocuments(query),
    ]);

    return res.status(200).json({
      message: 'Contact forms retrieved successfully',
      data: {
        contactForms: contactForms.map((form) => ({
          _id: form._id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          subject: form.subject,
          message: form.message,
          status: form.status,
          isStarred: form.isStarred,
          hospitalId: form.hospitalId?._id,
          hospitalName: form.hospitalId?.name,
          createdAt: form.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching contact forms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Delete hospital (super admin only)
export const deleteHospital = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { hospitalId } = req.params;

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    // Delete all related data
    await Promise.all([
      Doctor.deleteMany({ hospitalId }),
      Appointment.deleteMany({ hospitalId }),
      Service.deleteMany({ hospitalId }),
      ContactForm.deleteMany({ hospitalId }),
      Hospital.findByIdAndDelete(hospitalId),
    ]);

    return res.status(200).json({
      message: 'Hospital and all related data deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hospital:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Get platform statistics summary
export const getPlatformSummary = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const [
      totalHospitals,
      totalDoctors,
      totalAppointments,
      totalPatients,
    ] = await Promise.all([
      Hospital.countDocuments(),
      Doctor.countDocuments(),
      Appointment.countDocuments(),
      Appointment.distinct('userEmail').then(emails => emails.length),
    ]);

    // Get status breakdown
    const appointmentsByStatus = await Appointment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusBreakdown = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    appointmentsByStatus.forEach((item) => {
      statusBreakdown[item._id] = item.count;
    });

    return res.status(200).json({
      message: 'Platform summary retrieved successfully',
      data: {
        totalHospitals,
        totalDoctors,
        totalAppointments,
        totalPatients,
        appointmentsByStatus: statusBreakdown,
      },
    });
  } catch (error) {
    console.error('Error fetching platform summary:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Submit website contact form (public endpoint)
export const submitWebsiteContactForm = async (req, res) => {
  try {
    const { firstName, lastName, email, hospitalId, subject, message } = req.body;

    const escapeHtml = (value) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({ error: 'First name, last name, email, and message are required' });
    }

    // Get hospital name if hospitalId is provided
    let hospitalName = '';
    if (hospitalId) {
      const hospital = await Hospital.findById(hospitalId);
      if (hospital) {
        hospitalName = hospital.name;
      }
    }

    const contactForm = new WebsiteContactForm({
      firstName,
      lastName,
      email,
      hospitalName,
      subject: subject?.trim() || 'General Inquiry',
      message,
    });

    await contactForm.save();

    const fullName = `${firstName} ${lastName}`.trim();
    const safeHospitalName = hospitalName || 'Not provided';
    const safeSubject = escapeHtml(subject?.trim() || 'General Inquiry');
    const safeFullName = escapeHtml(fullName);
    const safeEmail = escapeHtml(email);
    const safeHospital = escapeHtml(safeHospitalName);
    const safeMessage = escapeHtml(message);

    await notifySuperAdmins({
      requiredSetting: 'criticalAlerts',
      subject: `New Website Contact Form from ${fullName}`,
      text: `A new website contact form has been submitted by ${fullName} (${email}). Hospital: ${safeHospitalName}. Message: ${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 12px;">New Website Contact Form</h2>
          <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeFullName}</p>
          <p style="margin: 0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
          <p style="margin: 0 0 8px;"><strong>Hospital:</strong> ${safeHospital}</p>
          <p style="margin: 0 0 8px;"><strong>Subject:</strong> ${safeSubject}</p>
          <p style="margin: 0 0 8px;"><strong>Submitted At:</strong> ${new Date(contactForm.createdAt).toLocaleString()}</p>
          <p style="margin: 12px 0 4px;"><strong>Message:</strong></p>
          <p style="margin: 0; white-space: pre-wrap;">${safeMessage}</p>
        </div>
      `,
    });

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to('super-admin').emit('websiteContactForm:new', {
        contactForm: {
          _id: contactForm._id,
          firstName: contactForm.firstName,
          lastName: contactForm.lastName,
          email: contactForm.email,
          hospitalName: contactForm.hospitalName,
          subject: contactForm.subject,
          message: contactForm.message,
          status: contactForm.status,
          isStarred: contactForm.isStarred,
          createdAt: contactForm.createdAt,
        },
      });
    }

    res.status(201).json({
      message: 'Contact form submitted successfully',
      data: contactForm,
    });
  } catch (error) {
    console.error('Error submitting website contact form:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all website contact forms (super admin only)
export const getWebsiteContactForms = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { page = 1, limit = 50, status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const [contactForms, total] = await Promise.all([
      WebsiteContactForm.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      WebsiteContactForm.countDocuments(query),
    ]);

    return res.status(200).json({
      message: 'Website contact forms retrieved successfully',
      data: {
        contactForms: contactForms.map((form) => ({
          _id: form._id,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          hospitalName: form.hospitalName,
          subject: form.subject,
          message: form.message,
          status: form.status,
          isStarred: form.isStarred,
          response: form.response,
          respondedAt: form.respondedAt,
          createdAt: form.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching website contact forms:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Update website contact form status (super admin only)
export const updateWebsiteContactFormStatus = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { formId } = req.params;
    const { status, isStarred, response } = req.body;

    const existingContactForm = await WebsiteContactForm.findById(formId);
    if (!existingContactForm) {
      return res.status(404).json({ error: 'Contact form not found' });
    }

    const updateData = {};

    if (status !== undefined) {
      if (!['unread', 'read', 'starred', 'responded'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateData.status = status;
    }

    if (isStarred !== undefined) {
      updateData.isStarred = isStarred;
    }

    if (response !== undefined) {
      const trimmedResponse = String(response).trim();
      if (!trimmedResponse) {
        return res.status(400).json({ error: 'Response message cannot be empty' });
      }

      const emailResult = await sendWebsiteContactResponseEmail({
        to: existingContactForm.email,
        fullName: `${existingContactForm.firstName} ${existingContactForm.lastName}`.trim(),
        subject: existingContactForm.subject || 'General Inquiry',
        response: trimmedResponse,
      });

      if (!emailResult.success) {
        return res.status(500).json({
          error: emailResult.error || 'Failed to send reply email',
        });
      }

      updateData.response = trimmedResponse;
      updateData.respondedAt = new Date();
      updateData.respondedBy = req.user._id;
      updateData.status = 'responded';
    }

    const contactForm = await WebsiteContactForm.findByIdAndUpdate(
      formId,
      updateData,
      { new: true }
    );

    res.status(200).json({
      message: 'Contact form updated successfully',
      data: contactForm,
    });
  } catch (error) {
    console.error('Error updating website contact form:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete website contact form (super admin only)
export const deleteWebsiteContactForm = async (req, res) => {
  try {
    // Verify user is a website admin
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const { formId } = req.params;

    const contactForm = await WebsiteContactForm.findByIdAndDelete(formId);
    if (!contactForm) {
      return res.status(404).json({ error: 'Contact form not found' });
    }

    res.status(200).json({
      message: 'Contact form deleted successfully',
      data: null,
    });
  } catch (error) {
    console.error('Error deleting website contact form:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get admin profile
export const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const admin = await Admin.findById(adminId).select('-password');
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.status(200).json({
      message: 'Admin profile retrieved successfully',
      data: admin,
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update admin profile (username and email)
export const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { username, email } = req.body;

    // Validate input
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    const currentAdmin = await Admin.findById(adminId).select('username email');
    if (!currentAdmin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Check if username is already taken by another admin
    if (username !== currentAdmin.username) {
      const existingAdmin = await Admin.findOne({ username, _id: { $ne: adminId } });
      if (existingAdmin) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }

    // Check if email is already taken by another admin
    if (email !== currentAdmin.email) {
      const existingEmail = await Admin.findOne({ email, _id: { $ne: adminId } });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { username, email },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      message: 'Admin profile updated successfully',
      data: updatedAdmin,
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ error: error.message });
  }
};

// Change admin password
export const changeAdminPassword = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update notification settings
export const updateNotificationSettings = async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      newHospitalRegistration,
      dailySummaryReport,
      criticalAlerts,
      emailNotifications,
      recipientEmails,
    } = req.body;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const current = admin.notificationSettings || {};

    const nextSettings = {
      newHospitalRegistration:
        typeof newHospitalRegistration === 'boolean'
          ? newHospitalRegistration
          : Boolean(current.newHospitalRegistration),
      dailySummaryReport:
        typeof dailySummaryReport === 'boolean'
          ? dailySummaryReport
          : Boolean(current.dailySummaryReport),
      criticalAlerts:
        typeof criticalAlerts === 'boolean'
          ? criticalAlerts
          : Boolean(current.criticalAlerts),
      emailNotifications:
        typeof emailNotifications === 'boolean'
          ? emailNotifications
          : Boolean(current.emailNotifications),
      recipientEmails: Array.isArray(current.recipientEmails)
        ? current.recipientEmails
        : [],
    };

    if (recipientEmails !== undefined) {
      if (!Array.isArray(recipientEmails)) {
        return res.status(400).json({ error: 'recipientEmails must be an array of valid email addresses' });
      }

      const normalizedEmails = recipientEmails
        .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
        .filter(Boolean);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmail = normalizedEmails.find((email) => !emailRegex.test(email));

      if (invalidEmail) {
        return res.status(400).json({ error: `Invalid email address: ${invalidEmail}` });
      }

      nextSettings.recipientEmails = [...new Set(normalizedEmails)];
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      {
        notificationSettings: nextSettings,
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      message: 'Notification settings updated successfully',
      data: updatedAdmin,
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: error.message });
  }
};

// Send test notification email
export const sendTestNotificationEmail = async (req, res) => {
  try {
    if (req.user.userType !== 'website_admin') {
      return res.status(403).json({ error: 'Access denied. Super admin only.' });
    }

    const adminId = req.user.id;
    const { recipientEmails } = req.body || {};

    const admin = await Admin.findById(adminId).select('email notificationSettings');
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (!admin.notificationSettings?.emailNotifications) {
      return res.status(400).json({ error: 'Enable email notifications before sending a test email' });
    }

    const fromPayload = Array.isArray(recipientEmails) ? recipientEmails : [];
    const fromSettings = Array.isArray(admin.notificationSettings?.recipientEmails)
      ? admin.notificationSettings.recipientEmails
      : [];

    const sourceRecipients = fromPayload.length > 0 ? fromPayload : fromSettings;
    const normalizedRecipients = [...new Set(
      sourceRecipients
        .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
        .filter(Boolean)
    )];

    const finalRecipients = normalizedRecipients.length > 0
      ? normalizedRecipients
      : (admin.email ? [admin.email.trim().toLowerCase()] : []);

    if (!finalRecipients.length) {
      return res.status(400).json({ error: 'No valid recipient email found for test notification' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmail = finalRecipients.find((email) => !emailRegex.test(email));
    if (invalidEmail) {
      return res.status(400).json({ error: `Invalid email address: ${invalidEmail}` });
    }

    const sentAt = new Date().toLocaleString();

    const emailResult = await sendSuperAdminNotificationEmail({
      to: finalRecipients,
      subject: 'Test Notification: Super Admin Settings',
      text: `This is a test notification email sent from Super Admin settings at ${sentAt}. If you received this, your notification email setup is working correctly.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 12px;">Test Notification Email</h2>
          <p style="margin: 0 0 8px;">This is a test notification email sent from Super Admin settings.</p>
          <p style="margin: 0 0 8px;"><strong>Sent at:</strong> ${sentAt}</p>
          <p style="margin: 0;">If you received this, your notification email setup is working correctly.</p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: emailResult.error || 'Failed to send test notification email' });
    }

    return res.status(200).json({
      message: 'Test notification email sent successfully',
      data: {
        recipients: finalRecipients,
      },
    });
  } catch (error) {
    console.error('Error sending test notification email:', error);
    return res.status(500).json({ error: error.message });
  }
};

