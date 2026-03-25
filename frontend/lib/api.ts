import { ApiError, ApiResponse } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

// Custom Error class for API errors
export class APIError extends Error implements ApiError {
  status: number;
  errors?: string[];
  details?: Record<string, string>;

  constructor(status: number, message: string, errors?: string[], details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.details = details;
    this.name = 'APIError';
  }
}

// Fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { skipAuth = false, ...fetchOptions } = options;
  
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(typeof fetchOptions.headers === 'object' && fetchOptions.headers !== null
      ? (fetchOptions.headers as Record<string, string>)
      : {}),
  };

  // Add authorization token if available
  if (!skipAuth) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Handle different error response formats
      const errorMessage = data.error || data.message || 'An error occurred';
      const errorList = data.errors || (data.error ? [data.error] : []);
      
      throw new APIError(response.status, errorMessage, errorList, data.details);
    }

    return {
      data: data.data || data,
      message: data.message,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new APIError(0, 'Network error: Unable to connect to server');
    }

    throw new APIError(500, 'An unexpected error occurred');
  }
}

// Auth API calls
export const authAPI = {
  login: async (email: string, password: string) => {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: email, password }),
      skipAuth: true,
    });
  },

  logout: async () => {
    return fetchAPI('/auth/logout', {
      method: 'POST',
    });
  },

  registerWebsiteAdmin: async (username: string, password: string) => {
    return fetchAPI('/auth/register/website-admin', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    });
  },

  registerHospitalAdmin: async (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }) => {
    return fetchAPI('/auth/register/hospital-admin', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  forgotPassword: async (email: string, userType: 'hospital' | 'admin') => {
    return fetchAPI('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, userType }),
      skipAuth: true,
    });
  },

  resetPassword: async (token: string, password: string, confirmPassword: string, userType: 'hospital' | 'admin') => {
    return fetchAPI('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password, confirmPassword, userType }),
      skipAuth: true,
    });
  },
};

// Doctor API calls
export const doctorAPI = {
  create: async (doctorData: any) => {
    return fetchAPI('/doctors', {
      method: 'POST',
      body: JSON.stringify(doctorData),
    });
  },

  getByHospital: async (hospitalId: string) => {
    return fetchAPI(`/doctors/hospital/${hospitalId}`, {
      method: 'GET',
    });
  },

  getById: async (doctorId: string) => {
    return fetchAPI(`/doctors/${doctorId}`, {
      method: 'GET',
    });
  },

  update: async (doctorId: string, doctorData: any) => {
    return fetchAPI(`/doctors/${doctorId}`, {
      method: 'PUT',
      body: JSON.stringify(doctorData),
    });
  },

  delete: async (doctorId: string) => {
    return fetchAPI(`/doctors/${doctorId}`, {
      method: 'DELETE',
    });
  },

  uploadPhoto: async (doctorId: string, photoFile: File) => {
    const formData = new FormData();
    formData.append('photo', photoFile);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    const response = await fetch(`${API_BASE_URL}/doctors/${doctorId}/photo`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new APIError(response.status, data.error || 'Failed to upload photo');
    }

    return {
      data: data.data || data,
      message: data.message,
      status: response.status,
    };
  },

  getSpecialties: async (hospitalId: string) => {
    return fetchAPI<string[]>(`/doctors/specialties/${hospitalId}`, {
      method: 'GET',
    });
  },
};

// Appointment API calls
export const appointmentAPI = {
  create: async (appointmentData: any) => {
    return fetchAPI('/appointments/request', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
      skipAuth: true,
    });
  },

  getByUser: async (userId: string) => {
    return fetchAPI(`/appointments/by-user/${userId}`, {
      method: 'GET',
    });
  },

  getByDoctor: async (doctorId: string) => {
    return fetchAPI(`/appointments/by-doctor/${doctorId}`, {
      method: 'GET',
    });
  },

  getByHospital: async (hospitalId: string) => {
    return fetchAPI(`/appointments/by-hospital/${hospitalId}`, {
      method: 'GET',
    });
  },

  getById: async (appointmentId: string) => {
    return fetchAPI(`/appointments/${appointmentId}`, {
      method: 'GET',
    });
  },

  updateStatus: async (appointmentId: string, status: string) => {
    return fetchAPI(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  cancel: async (appointmentId: string) => {
    return fetchAPI(`/appointments/${appointmentId}/cancel`, {
      method: 'PUT',
    });
  },

  getAvailableSlots: async (doctorId: string, date: string) => {
    return fetchAPI(`/appointments/available-slots?doctorId=${doctorId}&date=${date}`, {
      method: 'GET',
      skipAuth: true,
    });
  },
};

// Patient API calls (derived from appointments)
export const patientAPI = {
  getByHospital: async (hospitalId: string) => {
    return fetchAPI(`/appointments/patients/${hospitalId}`, {
      method: 'GET',
    });
  },

  getHistory: async (hospitalId: string, patientEmail: string) => {
    return fetchAPI(`/appointments/patients/${hospitalId}/${encodeURIComponent(patientEmail)}`, {
      method: 'GET',
    });
  },
};

// Contact Form API calls
export const contactFormAPI = {
  submit: async (formData: any) => {
    return fetchAPI('/contact-forms', {
      method: 'POST',
      body: JSON.stringify(formData),
      skipAuth: true,
    });
  },

  getByHospital: async (hospitalId: string) => {
    return fetchAPI(`/contact-forms/hospital/${hospitalId}`, {
      method: 'GET',
    });
  },

  getById: async (formId: string) => {
    return fetchAPI(`/contact-forms/${formId}`, {
      method: 'GET',
    });
  },

  updateStatus: async (formId: string, data: { status?: string; isStarred?: boolean }) => {
    return fetchAPI(`/contact-forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (formId: string) => {
    return fetchAPI(`/contact-forms/${formId}`, {
      method: 'DELETE',
    });
  },
};

// Chatbot API calls
export const chatbotAPI = {
  chat: async (message: string) => {
    return fetchAPI('/chatbot', {
      method: 'POST',
      body: JSON.stringify({ message }),
      skipAuth: true,
    });
  },
};

// Hospital API calls
export const hospitalAPI = {
  getAll: async () => {
    return fetchAPI('/hospitals', {
      method: 'GET',
      skipAuth: true,
    });
  },

  getById: async (hospitalId: string) => {
    return fetchAPI(`/hospitals/${hospitalId}`, {
      method: 'GET',
    });
  },

  getBySlug: async (slug: string) => {
    return fetchAPI(`/hospitals/public/${slug}`, {
      method: 'GET',
      skipAuth: true,
    });
  },

  update: async (hospitalId: string, data: any) => {
    return fetchAPI(`/hospitals/${hospitalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getProfile: async () => {
    return fetchAPI('/hospitals/profile/view', {
      method: 'GET',
    });
  },

  getStats: async () => {
    return fetchAPI('/hospitals/stats/view', {
      method: 'GET',
    });
  },

  uploadProfilePicture: async (hospitalId: string, file: File) => {
    const formData = new FormData();
    formData.append('profilePicture', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    const response = await fetch(`${API_BASE_URL}/hospitals/${hospitalId}/profile-picture`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new APIError(response.status, data.error || 'Failed to upload profile picture');
    }

    return {
      data: data.data || data,
      message: data.message,
      status: response.status,
    };
  },

  uploadImages: async (hospitalId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    const response = await fetch(`${API_BASE_URL}/hospitals/${hospitalId}/images`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new APIError(response.status, data.error || 'Failed to upload images');
    }

    return {
      data: data.data || data,
      message: data.message,
      status: response.status,
    };
  },

  deleteImage: async (hospitalId: string, imageUrl: string) => {
    return fetchAPI(`/hospitals/${hospitalId}/images`, {
      method: 'DELETE',
      body: JSON.stringify({ imageUrl }),
    });
  },
};

// Dashboard API calls
export const dashboardAPI = {
  getStats: async (hospitalId: string) => {
    return fetchAPI(`/dashboard/stats/${hospitalId}`, {
      method: 'GET',
    });
  },

  getOverview: async (hospitalId: string) => {
    return fetchAPI(`/dashboard/overview/${hospitalId}`, {
      method: 'GET',
    });
  },
};

// Service API calls
export const serviceAPI = {
  create: async (serviceData: any) => {
    return fetchAPI('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  },

  getByHospital: async (hospitalId: string) => {
    return fetchAPI(`/services/hospital/${hospitalId}`, {
      method: 'GET',
    });
  },

  getById: async (serviceId: string) => {
    return fetchAPI(`/services/${serviceId}`, {
      method: 'GET',
    });
  },

  update: async (serviceId: string, serviceData: any) => {
    return fetchAPI(`/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    });
  },

  delete: async (serviceId: string) => {
    return fetchAPI(`/services/${serviceId}`, {
      method: 'DELETE',
    });
  },

  getCategories: async (hospitalId: string) => {
    return fetchAPI<string[]>(`/services/categories/${hospitalId}`, {
      method: 'GET',
    });
  },
};

// Schedule API calls
export const scheduleAPI = {
  create: async (scheduleData: any) => {
    return fetchAPI('/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  },

  getByHospital: async (hospitalId: string) => {
    return fetchAPI(`/schedules/hospital/${hospitalId}`, {
      method: 'GET',
    });
  },

  getPublicByHospital: async (hospitalId: string) => {
    return fetchAPI(`/schedules/public/hospital/${hospitalId}`, {
      method: 'GET',
      skipAuth: true,
    });
  },

  getById: async (scheduleId: string) => {
    return fetchAPI(`/schedules/${scheduleId}`, {
      method: 'GET',
    });
  },

  getByDoctor: async (doctorId: string) => {
    return fetchAPI(`/schedules/doctor/${doctorId}`, {
      method: 'GET',
    });
  },

  update: async (scheduleId: string, scheduleData: any) => {
    return fetchAPI(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(scheduleData),
    });
  },

  delete: async (scheduleId: string) => {
    return fetchAPI(`/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },
};

// Super Admin API calls
export const superAdminAPI = {
  // Dashboard statistics
  getStats: async () => {
    return fetchAPI('/super-admin/stats', {
      method: 'GET',
    });
  },

  // Platform summary
  getSummary: async () => {
    return fetchAPI('/super-admin/summary', {
      method: 'GET',
    });
  },

  // Hospital management
  getAllHospitals: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    return fetchAPI(`/super-admin/hospitals${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
  },

  getHospitalDetails: async (hospitalId: string) => {
    return fetchAPI(`/super-admin/hospitals/${hospitalId}`, {
      method: 'GET',
    });
  },

  deleteHospital: async (hospitalId: string) => {
    return fetchAPI(`/super-admin/hospitals/${hospitalId}`, {
      method: 'DELETE',
    });
  },

  // All appointments
  getAllAppointments: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    hospitalId?: string;
    search?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.hospitalId) queryParams.append('hospitalId', params.hospitalId);
    if (params?.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    return fetchAPI(`/super-admin/appointments${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
  },

  // All doctors
  getAllDoctors: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    hospitalId?: string;
    search?: string;
    specialty?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.hospitalId) queryParams.append('hospitalId', params.hospitalId);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.specialty) queryParams.append('specialty', params.specialty);

    const queryString = queryParams.toString();
    return fetchAPI(`/super-admin/doctors${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
  },

  // All contact forms (hospital contact forms)
  getAllContactForms: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    hospitalId?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.hospitalId) queryParams.append('hospitalId', params.hospitalId);

    const queryString = queryParams.toString();
    return fetchAPI(`/super-admin/contact-forms${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
  },

  // Website contact forms (landing page)
  submitWebsiteContactForm: async (data: {
    firstName: string;
    lastName: string;
    email: string;
    hospitalId?: string;
    message: string;
  }) => {
    return fetchAPI('/super-admin/website-contact-forms', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true,
    });
  },

  getWebsiteContactForms: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    return fetchAPI(`/super-admin/website-contact-forms${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
    });
  },

  updateWebsiteContactFormStatus: async (formId: string, data: { 
    status?: string; 
    isStarred?: boolean;
    response?: string;
  }) => {
    return fetchAPI(`/super-admin/website-contact-forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteWebsiteContactForm: async (formId: string) => {
    return fetchAPI(`/super-admin/website-contact-forms/${formId}`, {
      method: 'DELETE',
    });
  },
};

// Payment API calls (Stripe integration)
export const paymentAPI = {
  // Create a Stripe checkout session for appointment booking
  createCheckoutSession: async (appointmentData: {
    doctorId: string;
    hospitalId: string;
    appointmentDate: string;
    appointmentTime: string;
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    reason?: string;
    duration?: number;
  }) => {
    return fetchAPI('/payments/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
      skipAuth: true,
    });
  },

  // Get payment status for an appointment
  getPaymentStatus: async (appointmentId: string) => {
    return fetchAPI(`/payments/status/${appointmentId}`, {
      method: 'GET',
      skipAuth: true,
    });
  },

  // Verify a Stripe session
  verifySession: async (sessionId: string) => {
    return fetchAPI(`/payments/verify/${sessionId}`, {
      method: 'GET',
      skipAuth: true,
    });
  },
};

// Subscription API calls (Stripe subscriptions)
export const subscriptionAPI = {
  // Get available subscription plans
  getAvailablePlans: async () => {
    return fetchAPI('/subscriptions/plans', {
      method: 'GET',
      skipAuth: true,
    });
  },

  // Create subscription checkout session
  createCheckoutSession: async (subscriptionData: {
    hospitalId: string;
    planType: 'basic' | 'professional' | 'enterprise';
    hospitalEmail: string;
    hospitalName: string;
  }) => {
    return fetchAPI('/subscriptions/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(subscriptionData),
    });
  },

  // Get subscription details for a hospital
  getSubscriptionDetails: async (hospitalId: string) => {
    return fetchAPI(`/subscriptions/details/${hospitalId}`, {
      method: 'GET',
    });
  },

  // Cancel subscription
  cancelSubscription: async (hospitalId: string) => {
    return fetchAPI(`/subscriptions/cancel/${hospitalId}`, {
      method: 'POST',
    });
  },

  // Update subscription plan
  updatePlan: async (hospitalId: string, newPlanType: 'basic' | 'professional' | 'enterprise') => {
    return fetchAPI(`/subscriptions/update-plan/${hospitalId}`, {
      method: 'PUT',
      body: JSON.stringify({ newPlanType }),
    });
  },
};

// Utility functions for token management
export const tokenManager = {
  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
  },

  getToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  },

  removeToken: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
  },


  isTokenValid: () => {
    const token = tokenManager.getToken();
    if (!token) return false;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },
};
