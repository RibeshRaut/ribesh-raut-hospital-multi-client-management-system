// Auth Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  userType: 'website_admin' | 'hospital_admin';
  token: string;
  user: {
    id: string;
    username?: string;
    email?: string;
    name?: string;
  };
}

export interface RegisterWebsiteAdminRequest {
  username: string;
  password: string;
  confirmPassword?: string;
}

export interface RegisterHospitalAdminRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  phone?: string;
  address?: string;
}

// Doctor Types
export interface Doctor {
  _id: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  hospitalId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDoctorRequest {
  name: string;
  specialty: string;
  phone: string;
  email: string;
  hospitalId: string;
}

// Appointment Types
export interface Appointment {
  _id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorId: string;
  hospitalId: string;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAppointmentRequest {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorId: string;
  hospitalId: string;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
}

// Contact Form Types
export interface ContactFormRequest {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  hospitalId?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  errors?: string[];
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Error Types
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  errors?: string[];
  details?: Record<string, string>;
}
