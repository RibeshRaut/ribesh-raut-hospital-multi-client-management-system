import adminLoginSchema, {
  websiteAdminRegisterSchema,
  hospitalAdminRegisterSchema,
} from '../joi/admin.joi.js';
import Admin from '../models/admin.model.js';
import Hospital from '../models/hospital.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../services/email.service.js';
import PlatformSettings from '../models/platform.model.js';
import { notifySuperAdmins } from '../services/adminNotification.service.js';
import { createTrialWindow } from '../services/subscription.service.js';

export const login = async (req, res) => {
  try {
    console.time('login-total');
    console.time('validation');
    const { error, value } = adminLoginSchema.validate(req.body);
    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({ errors: messages });
    }
    console.timeEnd('validation');

    const { username, password } = value;

    console.time('admin-query');
    let user = await Admin.findOne({ username }).lean();
    console.timeEnd('admin-query');
    
    if (user) {
      console.time('bcrypt-compare-admin');
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.timeEnd('bcrypt-compare-admin');
      
      if (!isPasswordValid) {
        console.timeEnd('login-total');
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign(
        { id: user._id, userType: 'website_admin' },
        process.env.JWT_SECRET || 'your_secret_key',
        { expiresIn: '24h' }
      );

      console.timeEnd('login-total');
      return res.status(200).json({
        message: 'Website Admin login successful',
        userType: 'website_admin',
        token,
        user: { id: user._id, username: user.username },
      });
    }

    console.time('hospital-query');
    user = await Hospital.findOne({ email: username }).lean();
    console.timeEnd('hospital-query');
    
    if (user) {
      console.time('bcrypt-compare-hospital');
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.timeEnd('bcrypt-compare-hospital');
      
      if (!isPasswordValid) {
        console.timeEnd('login-total');
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign(
        { id: user._id, userType: 'hospital_admin', hospitalId: user._id },
        process.env.JWT_SECRET || 'your_secret_key',
        { expiresIn: '24h' }
      );

      console.timeEnd('login-total');
      return res.status(200).json({
        message: 'Hospital Admin login successful',
        userType: 'hospital_admin',
        token,
        user: { id: user._id, email: user.email, name: user.name, hospitalId: user._id },
      });
    }

    console.timeEnd('login-total');
    return res.status(401).json({
      error: 'Invalid username or password',
    });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const registerWebsiteAdmin = async (req, res) => {
  try {
    const { error, value } = websiteAdminRegisterSchema.validate(req.body);
    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({ errors: messages });
    }

    const { username, password } = value;

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const newAdmin = new Admin({ username, password });
    await newAdmin.save();

    const token = jwt.sign(
      { id: newAdmin._id, userType: 'website_admin' },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Website Admin registration successful',
      userType: 'website_admin',
      token,
      user: { id: newAdmin._id, username: newAdmin.username },
    });
  } catch (error) {
    console.error('Error during website admin registration:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const registerHospitalAdmin = async (req, res) => {
  try {
    const escapeHtml = (value) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const { error, value } = hospitalAdminRegisterSchema.validate(req.body);
    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({ errors: messages });
    }

    const { name, email, phone, address, password } = value;
    const { trialStartDate, trialEndDate } = createTrialWindow();

    const platformSettings = await PlatformSettings.findOne();
    if (platformSettings && platformSettings.allowNewRegistrations === false) {
      return res.status(403).json({ error: 'New hospital registrations are currently disabled' });
    }

    const existingHospital = await Hospital.findOne({ email });
    if (existingHospital) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const newHospital = new Hospital({
      name,
      email,
      phone,
      address,
      password,
      subscriptionStatus: 'trial',
      trialStartDate,
      trialEndDate,
      trialUsed: true,
    });
    await newHospital.save();

    const safeName = escapeHtml(newHospital.name);
    const safeEmail = escapeHtml(newHospital.email);
    const safePhone = escapeHtml(newHospital.phone || 'Not provided');
    const safeAddress = escapeHtml(newHospital.address || 'Not provided');

    await notifySuperAdmins({
      requiredSetting: 'newHospitalRegistration',
      subject: `New Hospital Registration: ${newHospital.name}`,
      text: `A new hospital has registered. Name: ${newHospital.name}, Email: ${newHospital.email}, Phone: ${newHospital.phone || 'Not provided'}, Address: ${newHospital.address || 'Not provided'}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 12px;">New Hospital Registration</h2>
          <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeName}</p>
          <p style="margin: 0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
          <p style="margin: 0 0 8px;"><strong>Phone:</strong> ${safePhone}</p>
          <p style="margin: 0 0 8px;"><strong>Address:</strong> ${safeAddress}</p>
          <p style="margin: 0;"><strong>Registered At:</strong> ${new Date(newHospital.createdAt).toLocaleString()}</p>
        </div>
      `,
    });

    const token = jwt.sign(
      {
        id: newHospital._id,
        userType: 'hospital_admin',
        hospitalId: newHospital._id,
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'Hospital Admin registration successful',
      userType: 'hospital_admin',
      token,
      user: {
        id: newHospital._id,
        name: newHospital.name,
        email: newHospital.email,
        hospitalId: newHospital._id,
      },
    });
  } catch (error) {
    console.error('Error during hospital admin registration:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req, res) => {
  try {
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!userType || !['hospital', 'admin'].includes(userType)) {
      return res.status(400).json({ error: 'Valid userType is required (hospital or admin)' });
    }

    let user;
    let Model = userType === 'hospital' ? Hospital : Admin;
    let searchField = userType === 'hospital' ? 'email' : 'username';

    user = await Model.findOne({ [searchField]: email });

    if (!user) {
      // Don't reveal if user exists for security
      return res.status(200).json({
        message: 'If an account exists with this email/username, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token and expiry to user
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // Send reset email
    const emailResult = await sendPasswordResetEmail({
      email: userType === 'hospital' ? user.email : email,
      resetToken,
      userType,
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send reset email' });
    }

    return res.status(200).json({
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    console.error('Error in forgotPassword:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword, userType } = req.body;

    if (!token || !password || !confirmPassword || !userType) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash token for comparison
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    let Model = userType === 'hospital' ? Hospital : Admin;

    const user = await Model.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;
    await user.save();

    return res.status(200).json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
