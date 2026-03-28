import Appointment from '../models/appointment.model.js';
import ContactForm from '../models/contactForm.model.js';
import Hospital from '../models/hospital.model.js';
import WebsiteContactForm from '../models/websiteContactForm.model.js';
import { notifySuperAdmins } from './adminNotification.service.js';

const getLast24HoursWindow = () => {
  const end = new Date();
  const start = new Date(end);
  start.setHours(start.getHours() - 24);
  return { start, end };
};

const getSummaryMetrics = async () => {
  const { start, end } = getLast24HoursWindow();

  const [
    hospitalsCreated,
    appointmentsCreated,
    appointmentsPending,
    appointmentsCompleted,
    contactFormsSubmitted,
    websiteContactFormsSubmitted,
  ] = await Promise.all([
    Hospital.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Appointment.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Appointment.countDocuments({ status: 'pending' }),
    Appointment.countDocuments({ status: 'completed' }),
    ContactForm.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    WebsiteContactForm.countDocuments({ createdAt: { $gte: start, $lte: end } }),
  ]);

  return {
    start,
    end,
    hospitalsCreated,
    appointmentsCreated,
    appointmentsPending,
    appointmentsCompleted,
    contactFormsSubmitted,
    websiteContactFormsSubmitted,
  };
};

export const sendDailySummary = async () => {
  try {
    const metrics = await getSummaryMetrics();

    const dateRange = `${metrics.start.toLocaleString()} - ${metrics.end.toLocaleString()}`;

    return await notifySuperAdmins({
      requiredSetting: 'dailySummaryReport',
      subject: 'Daily Platform Summary Report',
      text: [
        'Daily platform summary (last 24 hours):',
        `Time window: ${dateRange}`,
        `New hospitals: ${metrics.hospitalsCreated}`,
        `Appointments created: ${metrics.appointmentsCreated}`,
        `Pending appointments (current): ${metrics.appointmentsPending}`,
        `Completed appointments (current): ${metrics.appointmentsCompleted}`,
        `Hospital contact forms: ${metrics.contactFormsSubmitted}`,
        `Website contact forms: ${metrics.websiteContactFormsSubmitted}`,
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 12px;">Daily Platform Summary</h2>
          <p style="margin: 0 0 12px;"><strong>Time window:</strong> ${dateRange}</p>
          <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
            <tbody>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>New hospitals</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${metrics.hospitalsCreated}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Appointments created</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${metrics.appointmentsCreated}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Pending appointments (current)</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${metrics.appointmentsPending}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Completed appointments (current)</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${metrics.appointmentsCompleted}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Hospital contact forms</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${metrics.contactFormsSubmitted}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Website contact forms</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${metrics.websiteContactFormsSubmitted}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending daily summary:', error);
    return {
      success: false,
      sent: 0,
      error: error.message,
    };
  }
};
