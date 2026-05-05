// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone validation (Nepali format: +977 98XXXXXXXX or 98XXXXXXXX - optional)
export const validatePhone = (phone: string): boolean => {
  // Phone is optional, empty string is valid
  if (!phone || phone.trim() === '') {
    return true;
  }
  // Accepts: +977 9824558987, +9779824558987, 9824558987, 98 24558987, etc.
  // Must start with 98, 97, 96, or 99 (Nepali mobile prefixes)
  const phoneRegex = /^(\+?977[-\s]?)?9[6789][-\s]?\d{8}$/;
  return phoneRegex.test(phone.trim());
};

// Password validation
export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return errors;
};

// Username validation
export const validateUsername = (username: string): string[] => {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 20) {
    errors.push('Username must be at most 20 characters long');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return errors;
};

// Name validation
export const validateName = (name: string): string[] => {
  const errors: string[] = [];

  if (name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (name.trim().length > 50) {
    errors.push('Name must be at most 50 characters long');
  }

  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    errors.push('Name can only contain letters, spaces, hyphens, and apostrophes');
  }

  return errors;
};

// Date validation (must be future date)
export const validateFutureDate = (date: string): string[] => {
  const errors: string[] = [];
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    errors.push('Appointment date must be in the future');
  }

  return errors;
};

// Time validation (HH:mm format)
export const validateTime = (time: string): string[] => {
  const errors: string[] = [];
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!timeRegex.test(time)) {
    errors.push('Invalid time format. Use HH:mm');
  }

  return errors;
};

// Validate appointment form
type AppointmentFormInput = Partial<{
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
}>;

export const validateAppointmentForm = (data: AppointmentFormInput): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};

  // Patient name validation
  const nameErrors = validateName(data.patientName || '');
  if (nameErrors.length > 0) errors.patientName = nameErrors;

  // Email validation
  if (!validateEmail(data.patientEmail || '')) {
    errors.patientEmail = ['Invalid email address'];
  }

  // Phone validation
  if (!validatePhone(data.patientPhone || '')) {
    errors.patientPhone = ['Invalid phone number'];
  }

  // Date validation
  const dateErrors = validateFutureDate(data.appointmentDate || '');
  if (dateErrors.length > 0) errors.appointmentDate = dateErrors;

  // Time validation
  const timeErrors = validateTime(data.appointmentTime || '');
  if (timeErrors.length > 0) errors.appointmentTime = timeErrors;

  // Reason validation
  if (!data.reason || data.reason.trim().length === 0) {
    errors.reason = ['Reason is required'];
  }

  if (data.reason && data.reason.length > 500) {
    errors.reason = ['Reason must be at most 500 characters'];
  }

  return errors;
};

// Validate login form
type LoginFormInput = Partial<{
  email: string;
  password: string;
}>;

export const validateLoginForm = (data: LoginFormInput): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};

  if (!data.email || !validateEmail(data.email)) {
    errors.email = ['Valid email is required'];
  }

  if (!data.password || data.password.length < 1) {
    errors.password = ['Password is required'];
  }

  return errors;
};

// Validate contact form
type ContactFormInput = Partial<{
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}>;

export const validateContactForm = (data: ContactFormInput): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};

  const nameErrors = validateName(data.name || '');
  if (nameErrors.length > 0) errors.name = nameErrors;

  if (!validateEmail(data.email || '')) {
    errors.email = ['Invalid email address'];
  }

  if (!validatePhone(data.phone || '')) {
    errors.phone = ['Invalid phone number'];
  }

  if (!data.subject || data.subject.trim().length === 0) {
    errors.subject = ['Subject is required'];
  }

  if (!data.message || data.message.trim().length === 0) {
    errors.message = ['Message is required'];
  }

  if (data.message && data.message.length > 1000) {
    errors.message = ['Message must be at most 1000 characters'];
  }

  return errors;
};

// Format errors for display
export const formatValidationErrors = (errors: Record<string, string[]>): Record<string, string> => {
  const formatted: Record<string, string> = {};
  for (const [key, messages] of Object.entries(errors)) {
    formatted[key] = messages[0]; // Show first error for each field
  }
  return formatted;
};

// Check if there are any validation errors
export const hasValidationErrors = (errors: Record<string, string[]>): boolean => {
  return Object.keys(errors).length > 0;
};
