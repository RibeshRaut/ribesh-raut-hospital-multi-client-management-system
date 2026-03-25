import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import contactFormRoutes from './routes/contactForm.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import chatbotRoutes from './routes/chatbot.routes.js';
import hospitalRoutes from './routes/hospital.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import serviceRoutes from './routes/service.routes.js';
import scheduleRoutes from './routes/schedule.routes.js';
import superAdminRoutes from './routes/superAdmin.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import { handleStripeWebhook } from './controllers/payment.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: '*',
  })
);

// Stripe webhook endpoint - must be before express.json() middleware
// because Stripe needs the raw body for signature verification
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({ message: 'HMT Backend API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/contact-forms', contactFormRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
