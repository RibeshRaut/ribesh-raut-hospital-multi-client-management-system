import Hospital from '../models/hospital.model.js';
import {
  buildSubscriptionSnapshot,
  evaluateAndSyncSubscriptionState,
} from '../services/subscription.service.js';

export const getHospitalById = async (req, res) => {
  try {
    const { id } = req.params;

    const hospital = await Hospital.findById(id).select('-password');
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    return res.status(200).json({
      message: 'Hospital retrieved successfully',
      data: hospital,
    });
  } catch (error) {
    console.error('Error fetching hospital:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getHospitalProfile = async (req, res) => {
  try {
    const hospitalId = req.user?.id || req.user?.hospitalId;

    if (!hospitalId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hospital = await Hospital.findById(hospitalId).select('-password');
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    return res.status(200).json({
      message: 'Hospital profile retrieved successfully',
      data: hospital,
    });
  } catch (error) {
    console.error('Error fetching hospital profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, email, phone, address, registrationNumber, totalBeds, 
      emergencyDepartment, description, googleMapsUrl, socialLinks,
      openingHours, specialties, facilities
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !address) {
      return res.status(400).json({
        errors: ['Name, email, phone, and address are required'],
      });
    }

    // Check if email is unique (if being changed)
    const existingHospital = await Hospital.findById(id);
    if (!existingHospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (email !== existingHospital.email) {
      const emailExists = await Hospital.findOne({ email });
      if (emailExists) {
        return res.status(409).json({
          errors: ['Email already registered'],
        });
      }
    }

    // Generate slug from name if not exists
    let slug = existingHospital.slug;
    if (!slug && name) {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Check if slug exists and make unique
      const slugExists = await Hospital.findOne({ slug, _id: { $ne: id } });
      if (slugExists) {
        slug = `${slug}-${Date.now()}`;
      }
    }

    const updateData = {
      name,
      email,
      phone,
      address,
      registrationNumber,
      totalBeds,
      emergencyDepartment,
      description,
      isProfileComplete: true,
      slug,
    };

    // Add optional fields if provided
    if (googleMapsUrl !== undefined) updateData.googleMapsUrl = googleMapsUrl;
    if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
    if (openingHours !== undefined) updateData.openingHours = openingHours;
    if (specialties !== undefined) updateData.specialties = specialties;
    if (facilities !== undefined) updateData.facilities = facilities;

    const hospital = await Hospital.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    return res.status(200).json({
      message: 'Hospital updated successfully',
      data: hospital,
    });
  } catch (error) {
    console.error('Error updating hospital:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find().select('-password');

    return res.status(200).json({
      message: 'Hospitals retrieved successfully',
      data: hospitals,
    });
  } catch (error) {
    console.error('Error fetching hospitals:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getHospitalStats = async (req, res) => {
  try {
    const hospitalId = req.user?.id || req.user?.hospitalId;

    if (!hospitalId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hospital = await Hospital.findById(hospitalId).select('-password');
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    // Import models dynamically
    const Doctor = (await import('../models/doctor.model.js')).default;
    const Appointment = (await import('../models/appointment.model.js')).default;

    // Get real statistics
    const totalDoctors = await Doctor.countDocuments({ hospitalId });
    const totalAppointments = await Appointment.countDocuments({ hospitalId });
    const confirmedAppointments = await Appointment.countDocuments({ 
      hospitalId, 
      status: 'confirmed' 
    });
    const completedAppointments = await Appointment.countDocuments({ 
      hospitalId, 
      status: 'completed' 
    });
    const cancelledAppointments = await Appointment.countDocuments({ 
      hospitalId, 
      status: 'cancelled' 
    });

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await Appointment.countDocuments({
      hospitalId,
      appointmentDate: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    return res.status(200).json({
      message: 'Hospital stats retrieved successfully',
      data: {
        hospitalId,
        hospitalName: hospital.name,
        stats: {
          totalDoctors,
          totalAppointments,
          confirmedAppointments,
          completedAppointments,
          cancelledAppointments,
          todayAppointments,
          emergencyDepartmentStatus: hospital.emergencyDepartment ? 'Active' : 'Inactive',
          totalBeds: hospital.totalBeds || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching hospital stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadHospitalProfilePicture = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const imageUrl = `/uploads/hospitals/${req.file.filename}`;
    
    const updatedHospital = await Hospital.findByIdAndUpdate(
      id,
      { profilePicture: imageUrl },
      { new: true }
    ).select('-password');

    return res.status(200).json({
      message: 'Profile picture uploaded successfully',
      data: updatedHospital,
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadHospitalImages = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const imageUrls = req.files.map(file => `/uploads/hospitals/${file.filename}`);
    
    // Append new images to existing ones
    const existingImages = hospital.images || [];
    const allImages = [...existingImages, ...imageUrls];

    const updatedHospital = await Hospital.findByIdAndUpdate(
      id,
      { images: allImages },
      { new: true }
    ).select('-password');

    return res.status(200).json({
      message: 'Images uploaded successfully',
      data: updatedHospital,
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteHospitalImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const updatedImages = (hospital.images || []).filter(img => img !== imageUrl);

    const updatedHospital = await Hospital.findByIdAndUpdate(
      id,
      { images: updatedImages },
      { new: true }
    ).select('-password');

    return res.status(200).json({
      message: 'Image deleted successfully',
      data: updatedHospital,
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getHospitalBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const hospital = await Hospital.findOne({ slug }).select('-password');
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const subscriptionContext = await evaluateAndSyncSubscriptionState(hospital);
    const subscriptionSnapshot = buildSubscriptionSnapshot(subscriptionContext.hospital);

    // Get additional data for public display
    const Doctor = (await import('../models/doctor.model.js')).default;
    const Service = (await import('../models/service.model.js')).default;

    const doctors = await Doctor.find({ 
      hospitalId: hospital._id,
      status: 'Active'
    }).select('name specialty photo qualifications experience');

    const services = await Service.find({ 
      hospitalId: hospital._id,
      status: 'Active'
    }).select('name category description duration price icon');

    return res.status(200).json({
      message: 'Hospital retrieved successfully',
      data: {
        hospital,
        doctors,
        services,
        subscription: {
          status: subscriptionSnapshot.status,
          effectivePlan: subscriptionSnapshot.effectivePlan,
          hasAccess: subscriptionSnapshot.hasAccess,
          planDetails: subscriptionSnapshot.planDetails,
          trialEndDate: subscriptionSnapshot.trialEndDate,
          subscriptionEndDate: subscriptionSnapshot.subscriptionEndDate,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching hospital by slug:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
