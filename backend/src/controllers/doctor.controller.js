import Doctor from '../models/doctor.model.js';
import Hospital from '../models/hospital.model.js';
import {
  evaluateAndSyncSubscriptionState,
  validateDoctorQuota,
} from '../services/subscription.service.js';

export const createDoctor = async (req, res) => {
  try {
    // Use hospitalId from authenticated user or request body
    const hospitalId = req.body.hospitalId || req.user.hospitalId;
    const { 
      name, 
      specialty, 
      phone, 
      email,
      photo,
      qualifications,
      experience,
      bio,
      consultationFee,
      status,
      workingDays,
      workingHours,
    } = req.body;

    if (!name || !specialty || !phone || !email || !hospitalId) {
      return res.status(400).json({ error: 'Name, specialty, phone, email and hospitalId are required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const subscriptionContext = req.subscriptionContext || (await evaluateAndSyncSubscriptionState(hospital));
    if (!subscriptionContext.hasAccess) {
      return res.status(402).json({ error: subscriptionContext.reason });
    }

    const doctorQuota = await validateDoctorQuota(hospitalId, subscriptionContext.effectivePlanId);
    if (!doctorQuota.allowed) {
      return res.status(403).json({
        error: doctorQuota.message,
        code: 'DOCTOR_LIMIT_REACHED',
        data: {
          current: doctorQuota.current,
          limit: doctorQuota.limit,
          plan: subscriptionContext.effectivePlanId,
        },
      });
    }

    const doctor = new Doctor({
      name,
      specialty,
      phone,
      email,
      hospitalId,
      photo: photo || '',
      qualifications: qualifications || '',
      experience: experience || 0,
      bio: bio || '',
      consultationFee: consultationFee || 0,
      status: status || 'Active',
      workingDays: workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      workingHours: workingHours || { start: '09:00', end: '17:00' },
    });

    await doctor.save();
    res.status(201).json({
      message: 'Doctor added successfully',
      data: doctor,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDoctorsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const doctors = await Doctor.find({ hospitalId });
    res.status(200).json({
      message: 'Doctors retrieved successfully',
      data: doctors,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Verify user has access to this doctor's hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== doctor.hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({
      message: 'Doctor retrieved successfully',
      data: doctor,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { 
      name, 
      specialty, 
      phone, 
      email,
      photo,
      qualifications,
      experience,
      bio,
      consultationFee,
      status,
      workingDays,
      workingHours,
    } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Verify user has access to this doctor's hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== doctor.hospitalId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (specialty !== undefined) updateData.specialty = specialty;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (photo !== undefined) updateData.photo = photo;
    if (qualifications !== undefined) updateData.qualifications = qualifications;
    if (experience !== undefined) updateData.experience = experience;
    if (bio !== undefined) updateData.bio = bio;
    if (consultationFee !== undefined) updateData.consultationFee = consultationFee;
    if (status !== undefined) updateData.status = status;
    if (workingDays !== undefined) updateData.workingDays = workingDays;
    if (workingHours !== undefined) updateData.workingHours = workingHours;

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctorId,
      updateData,
      { new: true }
    );

    res.status(200).json({
      message: 'Doctor updated successfully',
      data: updatedDoctor,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Verify user has access to this doctor's hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== doctor.hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Doctor.findByIdAndDelete(doctorId);

    res.status(200).json({ 
      message: 'Doctor deleted successfully',
      data: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const uploadDoctorPhotoController = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Verify user has access to this doctor's hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== doctor.hospitalId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate the photo URL
    const photoUrl = `/uploads/doctors/${req.file.filename}`;

    // Update doctor with new photo URL
    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { photo: photoUrl },
      { new: true }
    );

    res.status(200).json({
      message: 'Photo uploaded successfully',
      data: updatedDoctor,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSpecialties = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get unique specialties from doctors in this hospital
    const specialties = await Doctor.distinct('specialty', { hospitalId });

    res.status(200).json({
      message: 'Specialties retrieved successfully',
      data: specialties.filter(s => s), // Filter out empty/null values
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
