/**
 * Integration Testing & Usage Examples
 * 
 * This file demonstrates how to use the integrated frontend-backend system
 * Run the backend and frontend, then use these examples in your components
 */

import {
  authAPI,
  doctorAPI,
  appointmentAPI,
  contactFormAPI,
  chatbotAPI,
  tokenManager,
  APIError,
} from '@/lib/api';
import { Appointment, Doctor, LoginResponse } from '@/lib/types';

import {
  validateLoginForm,
  validateAppointmentForm,
  formatValidationErrors,
} from '@/lib/validation';

import { useApi, useMutation } from '@/lib/hooks';

// ============================================
// EXAMPLE 1: Login Flow
// ============================================

export async function exampleLogin() {
  try {
    const response = await authAPI.login('admin@hospital.com', 'Password123!');

    if (response.data) {
      const data = response.data as LoginResponse;
      // Store token
      tokenManager.setToken(data.token);

      // Store user info
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...data.user,
          id: data.user.id,
          userType: data.userType,
        })
      );

      console.log('✓ Login successful');
      console.log('Token:', data.token);
      console.log('User:', data.user);
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Login failed');
      console.error('Status:', error.status);
      console.error('Message:', error.message);
      console.error('Errors:', error.errors);
    }
  }
}

// ============================================
// EXAMPLE 2: Registration Flow
// ============================================

export async function exampleRegister() {
  try {
    const response = await authAPI.registerHospitalAdmin({
      name: 'City General Hospital',
      email: 'admin@cityhospital.com',
      password: 'SecurePassword123!',
      phone: '+1-555-0100',
      address: '123 Medical Center Drive, City, State 12345',
    });

    if (response.data) {
      const data = response.data as { token?: string };
      if (data.token) {
        tokenManager.setToken(data.token);
      }
      console.log('✓ Registration successful');
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Registration failed:', error.message);
    }
  }
}

// ============================================
// EXAMPLE 3: Create Doctor (with token)
// ============================================

export async function exampleCreateDoctor() {
  try {
    const response = await doctorAPI.create({
      name: 'Dr. John Smith',
      specialty: 'Cardiology',
      phone: '+1-555-0101',
      email: 'john.smith@hospital.com',
      hospitalId: 'hosp_123',
    });

    if (response.data) {
      const data = response.data as { doctor?: Doctor };
      console.log('✓ Doctor created successfully');
      console.log('Doctor:', data.doctor);
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Failed to create doctor:', error.message);
    }
  }
}

// ============================================
// EXAMPLE 4: Get Doctors by Hospital (public)
// ============================================

export async function exampleGetDoctors(hospitalId: string) {
  try {
    const response = await doctorAPI.getByHospital(hospitalId);

    if (response.data) {
      const doctors = response.data as Doctor[];
      console.log('✓ Doctors retrieved successfully');
      console.log('Count:', doctors.length);
      console.log('Doctors:', doctors);
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Failed to get doctors:', error.message);
    }
  }
}

// ============================================
// EXAMPLE 5: Create Appointment (public)
// ============================================

export async function exampleCreateAppointment() {
  const appointmentData = {
    patientName: 'Jane Doe',
    patientEmail: 'jane.doe@example.com',
    patientPhone: '+1-555-0102',
    doctorId: 'doc_123',
    hospitalId: 'hosp_123',
    appointmentDate: '2026-02-15',
    appointmentTime: '14:30',
    reason: 'Regular checkup and consultation',
  };

  // Validate before sending
  const errors = validateAppointmentForm(appointmentData);
  if (Object.keys(errors).length > 0) {
    console.error('✗ Validation errors:', formatValidationErrors(errors));
    return;
  }

  try {
    const response = await appointmentAPI.create(appointmentData);

    if (response.data) {
      const appointment = response.data as Appointment;
      console.log('✓ Appointment created successfully');
      console.log('Appointment:', appointment);
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Failed to create appointment:', error.message);
    }
  }
}

// ============================================
// EXAMPLE 6: Get Appointments by User (protected)
// ============================================

export async function exampleGetUserAppointments(userId: string) {
  try {
    const response = await appointmentAPI.getByUser(userId);

    if (response.data) {
      const appointments = response.data as Appointment[];
      console.log('✓ User appointments retrieved successfully');
      console.log('Count:', appointments.length);
      console.log('Appointments:', appointments);
    }
  } catch (error) {
    if (error instanceof APIError) {
      if (error.status === 401) {
        console.error('✗ Unauthorized - token may have expired');
        tokenManager.removeToken();
      } else {
        console.error('✗ Failed to get appointments:', error.message);
      }
    }
  }
}

// ============================================
// EXAMPLE 7: Update Appointment Status (protected)
// ============================================

export async function exampleUpdateAppointmentStatus(
  appointmentId: string,
  newStatus: 'confirmed' | 'completed' | 'cancelled'
) {
  try {
    const response = await appointmentAPI.updateStatus(appointmentId, newStatus);

    if (response.data) {
      const appointment = response.data as Appointment;
      console.log('✓ Appointment status updated successfully');
      console.log('Updated Appointment:', appointment);
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Failed to update appointment:', error.message);
    }
  }
}

// ============================================
// EXAMPLE 8: Submit Contact Form (public)
// ============================================

export async function exampleSubmitContactForm() {
  try {
    const response = await contactFormAPI.submit({
      name: 'John Visitor',
      email: 'john@example.com',
      phone: '+1-555-0103',
      subject: 'Inquiry about services',
      message: 'I would like to know more about your cardiology services.',
      hospitalId: 'hosp_123',
    });

    if (response.data) {
      console.log('✓ Contact form submitted successfully');
      console.log('Form:', response.data);
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Failed to submit contact form:', error.message);
    }
  }
}

// ============================================
// EXAMPLE 9: Chat with Chatbot (public)
// ============================================

export async function exampleChatbot(message: string) {
  try {
    const response = await chatbotAPI.chat(message);

    if (response.data) {
      console.log('✓ Chatbot response received');
      console.log('Response:', response.data);
    }
  } catch (error) {
    if (error instanceof APIError) {
      console.error('✗ Chatbot error:', error.message);
    }
  }
}

// ============================================
// EXAMPLE 10: Using React Hook - useApi
// ============================================
// Note: This example is a React component. Use it in a .tsx file instead.
/*
export function ExampleComponentWithUseApi({ hospitalId }: { hospitalId: string }) {
  const { data: doctors, isLoading, error, execute } = useApi(() =>
    doctorAPI.getByHospital(hospitalId)
  );

  return (
    <div>
      {isLoading && <p>Loading doctors...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {doctors && doctors.length > 0 && (
        <div>
          <h2>Doctors ({doctors.length})</h2>
          {doctors.map((doctor: any) => (
            <div key={doctor._id}>
              <p>Name: {doctor.name}</p>
              <p>Specialty: {doctor.specialty}</p>
            </div>
          ))}
        </div>
      )}
      <button onClick={execute} disabled={isLoading}>
        Refresh
      </button>
    </div>
  );
}
*/

// ============================================
// EXAMPLE 11: Using React Hook - useMutation
// ============================================
// Note: This example is a React component. Use it in a .tsx file instead.
/*
export function ExampleComponentWithMutation() {
  const { mutate: createDoctor, isLoading, error } = useMutation((data: any) =>
    doctorAPI.create(data)
  );

  const handleSubmit = async (formData: any) => {
    const result = await createDoctor(formData);
    if (result) {
      console.log('Doctor created:', result);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit({
          name: 'Dr. New Doctor',
          specialty: 'Neurology',
          phone: '+1-555-0104',
          email: 'new@hospital.com',
          hospitalId: 'hosp_123',
        });
      }}
    >
      {error && <p className="text-red-500">Error: {error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Doctor'}
      </button>
    </form>
  );
}
*/

// ============================================
// EXAMPLE 12: Token Management
// ============================================

export function exampleTokenManagement() {
  // Set token after login
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  tokenManager.setToken(token);

  // Get token
  const retrievedToken = tokenManager.getToken();
  console.log('Token:', retrievedToken);

  // Check if token is valid
  const isValid = tokenManager.isTokenValid();
  console.log('Token valid:', isValid);

  // Remove token on logout
  tokenManager.removeToken();
  console.log('Token removed');
}

// ============================================
// EXAMPLE 13: Error Handling Patterns
// ============================================

export async function exampleErrorHandling() {
  try {
    const response = await authAPI.login('invalid@example.com', 'wrong');
  } catch (error) {
    if (error instanceof APIError) {
      // Handle specific error status
      if (error.status === 401) {
        console.error('Authentication failed');
      } else if (error.status === 400) {
        console.error('Validation error:', error.errors);
      } else if (error.status >= 500) {
        console.error('Server error, please try again later');
      } else {
        console.error('Error:', error.message);
      }
    } else if (error instanceof TypeError) {
      console.error('Network error - check your internet connection');
    } else {
      console.error('Unexpected error');
    }
  }
}

// ============================================
// EXAMPLE 14: Validation Patterns
// ============================================

export function exampleValidation() {
  const formData = {
    patientName: 'J', // Too short
    patientEmail: 'invalid-email', // Invalid format
    patientPhone: '123', // Invalid format
    appointmentDate: '2020-01-01', // Past date
    appointmentTime: '25:00', // Invalid time
    reason: '', // Empty
  };

  const errors = validateAppointmentForm(formData);

  if (Object.keys(errors).length > 0) {
    const formatted = formatValidationErrors(errors);
    console.error('Validation failed:');
    Object.entries(formatted).forEach(([field, error]) => {
      console.error(`  ${field}: ${error}`);
    });
  }
}

// ============================================
// TESTING CHECKLIST
// ============================================

/*
 * Run these in order to test the complete integration:
 *
 * 1. Backend Setup
 *    - Start backend: cd backend && npm run dev
 *    - Verify API running: http://localhost:3000
 *    - Create test data in MongoDB
 *
 * 2. Frontend Setup
 *    - Start frontend: cd frontend && npm run dev
 *    - Update .env.local with backend URL
 *
 * 3. Test Public Endpoints
 *    ✓ exampleGetDoctors() - GET /api/doctors/hospital/:hospitalId
 *    ✓ exampleCreateAppointment() - POST /api/appointments/request
 *    ✓ exampleSubmitContactForm() - POST /api/contact-forms
 *    ✓ exampleChatbot() - POST /api/chatbot
 *
 * 4. Test Authentication
 *    ✓ exampleLogin() - POST /api/auth/login
 *    ✓ exampleRegister() - POST /api/auth/register/hospital-admin
 *    ✓ Check token in localStorage
 *
 * 5. Test Protected Endpoints (after login)
 *    ✓ exampleGetUserAppointments() - GET /api/appointments/by-user/:userId
 *    ✓ exampleCreateDoctor() - POST /api/doctors
 *    ✓ exampleUpdateAppointmentStatus() - PUT /api/appointments/:appointmentId/status
 *
 * 6. Test Error Handling
 *    ✓ Invalid credentials
 *    ✓ Missing required fields
 *    ✓ Invalid data format
 *    ✓ Network errors (turn off backend)
 *
 * 7. Test Validation
 *    ✓ Email validation
 *    ✓ Phone validation
 *    ✓ Password validation
 *    ✓ Date/time validation
 *
 * 8. Browser DevTools
 *    - Check Network tab for API calls
 *    - Check Console for errors
 *    - Check Application > Storage for token
 */

export const TESTING_ENDPOINTS = {
  PUBLIC: {
    getDoctors: 'GET /api/doctors/hospital/:hospitalId',
    createAppointment: 'POST /api/appointments/request',
    submitContactForm: 'POST /api/contact-forms',
    chatbot: 'POST /api/chatbot',
  },
  AUTH: {
    login: 'POST /api/auth/login',
    logout: 'POST /api/auth/logout',
    registerWebsiteAdmin: 'POST /api/auth/register/website-admin',
    registerHospitalAdmin: 'POST /api/auth/register/hospital-admin',
  },
  PROTECTED: {
    createDoctor: 'POST /api/doctors',
    getUserAppointments: 'GET /api/appointments/by-user/:userId',
    updateAppointmentStatus: 'PUT /api/appointments/:appointmentId/status',
    getAllContactForms: 'GET /api/contact-forms',
  },
};
