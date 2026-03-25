import ContactForm from '../models/contactForm.model.js';
import { emitContactFormEvent } from '../socket.js';

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message, hospitalId } = req.body;

    if (!name || !email || !phone || !message || !hospitalId) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const contactForm = new ContactForm({
      name,
      email,
      phone,
      subject: subject || 'General Inquiry',
      message,
      hospitalId,
    });

    await contactForm.save();
    
    // Emit real-time event for new contact form
    const io = req.app.get('io');
    if (io) {
      emitContactFormEvent(io, 'submitted', {
        ...contactForm.toObject(),
        status: 'unread',
      });
    }
    
    res.status(201).json({
      message: 'Contact form submitted successfully',
      data: contactForm,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getContactFormsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    // Verify user has access to this hospital
    if (req.user.userType === 'hospital_admin' && req.user.hospitalId !== hospitalId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const contactForms = await ContactForm.find({ hospitalId }).sort({ createdAt: -1 });
    res.status(200).json({
      message: 'Contact forms retrieved successfully',
      data: contactForms,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getContactFormById = async (req, res) => {
  try {
    const { formId } = req.params;

    const contactForm = await ContactForm.findById(formId);
    if (!contactForm) {
      return res.status(404).json({ error: 'Contact form not found' });
    }

    // Mark as read when viewing
    if (contactForm.status === 'unread') {
      contactForm.status = 'read';
      await contactForm.save();
    }

    res.status(200).json({
      message: 'Contact form retrieved successfully',
      data: contactForm,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateContactFormStatus = async (req, res) => {
  try {
    const { formId } = req.params;
    const { status, isStarred } = req.body;

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

    const contactForm = await ContactForm.findByIdAndUpdate(
      formId,
      updateData,
      { new: true }
    );

    if (!contactForm) {
      return res.status(404).json({ error: 'Contact form not found' });
    }

    // Emit real-time event for contact form status update
    const io = req.app.get('io');
    if (io) {
      emitContactFormEvent(io, 'statusUpdated', {
        ...contactForm.toObject(),
      });
    }

    res.status(200).json({
      message: 'Contact form updated successfully',
      data: contactForm,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteContactForm = async (req, res) => {
  try {
    const { formId } = req.params;

    const contactForm = await ContactForm.findByIdAndDelete(formId);
    if (!contactForm) {
      return res.status(404).json({ error: 'Contact form not found' });
    }

    res.status(200).json({ 
      message: 'Contact form deleted successfully',
      data: null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
