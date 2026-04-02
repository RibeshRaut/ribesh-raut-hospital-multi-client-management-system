import nodemailer from 'nodemailer';

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.GMAIL_USER;

const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
};

export const sendSuperAdminNotificationEmail = async ({ to, subject, html, text }) => {
  try {
    const recipients = Array.isArray(to) ? to : [to];
    const validRecipients = recipients.filter(Boolean);

    if (!validRecipients.length) {
      return {
        success: false,
        error: 'No recipients provided',
        message: 'No recipients provided',
      };
    }

    const transporter = createTransporter();

    const result = await transporter.sendMail({
      from: EMAIL_FROM,
      to: validRecipients.join(', '),
      subject,
      text,
      html,
    });

    return {
      success: true,
      messageId: result.messageId,
      message: 'Super admin notification email sent successfully',
    };
  } catch (error) {
    const isAuthError = error?.code === 'EAUTH' || error?.responseCode === 535;
    const actionableMessage = isAuthError
      ? 'Email authentication failed. Verify SMTP/Gmail credentials and regenerate app password if needed.'
      : 'Failed to send super admin notification email';

    console.error('Error sending super admin notification email:', error);
    return {
      success: false,
      error: actionableMessage,
      message: actionableMessage,
    };
  }
};

export const sendWebsiteContactResponseEmail = async ({
  to,
  fullName,
  subject,
  response,
}) => {
  try {
    if (!to) {
      return {
        success: false,
        error: 'Recipient email is required',
        message: 'Recipient email is required',
      };
    }

    const transporter = createTransporter();
    const safeName = fullName || 'there';
    const safeSubject = subject || 'General Inquiry';

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #111827; color: #ffffff; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Response to your inquiry</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 16px; color: #111827;">Hi ${safeName},</p>
          <p style="margin: 0 0 12px; color: #374151;">Thanks for reaching out. Here is our response to your message regarding <strong>${safeSubject}</strong>:</p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; white-space: pre-wrap; color: #111827;">
            ${response}
          </div>
          <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">This email was sent by the super admin team.</p>
        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: `Re: ${safeSubject}`,
      text: `Hi ${safeName},\n\nThanks for reaching out. Here is our response:\n\n${response}\n\nRegards,\nSuper Admin Team`,
      html: htmlTemplate,
    });

    return {
      success: true,
      messageId: result.messageId,
      message: 'Website contact response email sent successfully',
    };
  } catch (error) {
    console.error('Error sending website contact response email:', error);
    return {
      success: false,
      error: error?.message || 'Failed to send website contact response email',
      message: 'Failed to send website contact response email',
    };
  }
};

// Send confirmation email to PATIENT when appointment is confirmed
export const sendAppointmentConfirmationToPatient = async (emailData) => {
  try {
    const {
      patientEmail,
      patientName,
      doctorName,
      doctorSpecialty,
      appointmentDate,
      duration,
      hospitalName,
      hospitalAddress,
      hospitalPhone,
    } = emailData;

    const transporter = createTransporter();

    const formattedDate = new Date(appointmentDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <table width="80" height="80" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 15px; background-color: rgba(255,255,255,0.2); border-radius: 50%;">
            <tr>
              <td align="center" valign="middle" style="font-size: 40px; color: white; line-height: 80px;">✓</td>
            </tr>
          </table>
          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">Appointment Confirmed!</h1>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your appointment has been successfully confirmed</p>
        </div>
        
        <div style="padding: 40px 30px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 18px; color: #374151; margin: 0 0 25px 0;">Dear <strong>${patientName}</strong>,</p>
          
          <p style="color: #6b7280; line-height: 1.7; margin: 0 0 30px 0;">
            Great news! Your appointment request has been confirmed by <strong>${hospitalName}</strong>. 
            Please find your appointment details below.
          </p>
          
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
            <h3 style="margin: 0 0 20px 0; color: #166534; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">📋 Appointment Details</h3>
            
            <table style="width: 100%; color: #374151; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 101, 52, 0.1); font-weight: 600; width: 140px; color: #166534;">Date & Time</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 101, 52, 0.1); font-size: 15px;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 101, 52, 0.1); font-weight: 600; color: #166534;">Duration</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 101, 52, 0.1);">${duration} minutes</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 101, 52, 0.1); font-weight: 600; color: #166534;">Doctor</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(22, 101, 52, 0.1);">
                  <strong>Dr. ${doctorName}</strong><br/>
                  <span style="color: #6b7280; font-size: 14px;">${doctorSpecialty || 'General Practitioner'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 600; color: #166534;">Hospital</td>
                <td style="padding: 12px 0;">
                  <strong>${hospitalName}</strong><br/>
                  ${hospitalAddress ? `<span style="color: #6b7280; font-size: 14px;">${hospitalAddress}</span><br/>` : ''}
                  ${hospitalPhone ? `<span style="color: #6b7280; font-size: 14px;">📞 ${hospitalPhone}</span>` : ''}
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 0 0 30px 0; border-radius: 0 8px 8px 0;">
            <h4 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">⚠️ Important Reminders</h4>
            <ul style="margin: 0; padding: 0 0 0 20px; color: #92400e; line-height: 1.8; font-size: 14px;">
              <li>Please arrive 15 minutes before your appointment time</li>
              <li>Bring any relevant medical records or test results</li>
              <li>Carry a valid ID proof</li>
              <li>Contact the hospital if you need to reschedule</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; margin: 0 0 20px 0; line-height: 1.7;">
            If you have any questions or need to reschedule, please contact the hospital directly.
          </p>
          
          <p style="color: #374151; margin: 0;">
            Best regards,<br/>
            <strong>${hospitalName}</strong>
          </p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 25px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px 0;">
            This is an automated email from the Hospital Management System.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Hospital Management Tenant. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: EMAIL_FROM,
      to: patientEmail,
      subject: `✅ Appointment Confirmed - ${hospitalName}`,
      html: htmlTemplate,
    };

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      message: 'Patient confirmation email sent successfully',
    };
  } catch (error) {
    console.error('Error sending patient confirmation email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send patient confirmation email',
    };
  }
};

export const sendAppointmentConfirmationToDoctor = async (emailData) => {
  try {
    const {
      doctorEmail,
      doctorName,
      patientName,
      patientEmail,
      patientPhone,
      appointmentDate,
      duration,
      hospitalName,
      notes,
    } = emailData;

    const transporter = createTransporter();

    const formattedDate = new Date(appointmentDate).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0;">Appointment Confirmed</h2>
          <p style="margin: 5px 0 0 0;">Hospital Management System</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
          <p style="font-size: 16px; color: #333;">Dear <strong>${doctorName}</strong>,</p>
          
          <p style="color: #666; line-height: 1.6;">
            An appointment has been confirmed by the hospital administrator. Please find the details below:
          </p>
          
          <div style="background-color: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #667eea;">Appointment Details</h3>
            
            <table style="width: 100%; color: #333;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 150px;">Hospital:</td>
                <td style="padding: 8px 0;">${hospitalName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Patient Name:</td>
                <td style="padding: 8px 0;">${patientName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Patient Email:</td>
                <td style="padding: 8px 0;">
                  <a href="mailto:${patientEmail}" style="color: #667eea; text-decoration: none;">${patientEmail}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Patient Phone:</td>
                <td style="padding: 8px 0;">
                  <a href="tel:${patientPhone}" style="color: #667eea; text-decoration: none;">${patientPhone}</a>
                </td>
              </tr>
              <tr style="background-color: #f0f0f0;">
                <td style="padding: 8px 0; font-weight: bold;">Appointment Date & Time:</td>
                <td style="padding: 8px 0; color: #667eea; font-weight: bold;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
                <td style="padding: 8px 0;">${duration} minutes</td>
              </tr>
              ${notes ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Notes:</td>
                <td style="padding: 8px 0;">${notes}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="background-color: #fffbea; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Important:</strong> Please ensure you are available at the scheduled time. 
              If you need to reschedule or cancel, please contact the hospital administrator immediately.
            </p>
          </div>
          
          <p style="color: #666; margin: 20px 0; line-height: 1.6;">
            Thank you for your service. If you have any questions, please contact the hospital administrator.
          </p>
          
          <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 20px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated email from the Hospital Management System. 
              Please do not reply to this email.
            </p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
              © ${new Date().getFullYear()} Hospital Management Tenant. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: EMAIL_FROM,
      to: doctorEmail,
      subject: `Appointment Confirmed - ${patientName}`,
      html: htmlTemplate,
    };

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully',
    };
  } catch (error) {
    console.error('Error sending appointment confirmation email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send email',
    };
  }
};

export const sendAppointmentCancellationToDoctor = async (emailData) => {
  try {
    const { doctorEmail, doctorName, patientName, appointmentDate, hospitalName, cancellationReason } = emailData;

    const transporter = createTransporter();

    const formattedDate = new Date(appointmentDate).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white; text-align: center; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0;">Appointment Cancelled</h2>
          <p style="margin: 5px 0 0 0;">Hospital Management System</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 0 0 5px 5px;">
          <p style="font-size: 16px; color: #333;">Dear <strong>${doctorName}</strong>,</p>
          
          <p style="color: #666; line-height: 1.6;">
            An appointment has been cancelled. Please find the details below:
          </p>
          
          <div style="background-color: white; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #dc3545;">Cancelled Appointment Details</h3>
            
            <table style="width: 100%; color: #333;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 150px;">Hospital:</td>
                <td style="padding: 8px 0;">${hospitalName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Patient Name:</td>
                <td style="padding: 8px 0;">${patientName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Appointment Date & Time:</td>
                <td style="padding: 8px 0;">${formattedDate}</td>
              </tr>
              ${cancellationReason ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Reason:</td>
                <td style="padding: 8px 0;">${cancellationReason}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <p style="color: #666; margin: 20px 0; line-height: 1.6;">
            The appointment slot is now available for other patients. 
            If you have any questions, please contact the hospital administrator.
          </p>
          
          <div style="border-top: 1px solid #ddd; padding-top: 20px; margin-top: 20px;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This is an automated email from the Hospital Management System. 
              Please do not reply to this email.
            </p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
              © ${new Date().getFullYear()} Hospital Management Tenant. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: EMAIL_FROM,
      to: doctorEmail,
      subject: `Appointment Cancelled - ${patientName}`,
      html: htmlTemplate,
    };

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      message: 'Cancellation email sent successfully',
    };
  } catch (error) {
    console.error('Error sending appointment cancellation email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send cancellation email',
    };
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (emailData) => {
  try {
    const {
      email,
      resetToken,
      userType = 'hospital', // 'hospital' or 'admin'
    } = emailData;

    const transporter = createTransporter();

    // Construct reset URL based on user type
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&type=${userType}`;

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">Password Reset Request</h1>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">We received a request to reset your password</p>
        </div>
        
        <div style="padding: 40px 30px; color: #333;">
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">Hello,</p>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.6;">
            You have requested to reset your password. Please click the button below to reset your password. This link will expire in 1 hour.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">Reset Password</a>
          </div>
          
          <p style="margin: 20px 0; font-size: 13px; color: #999;">Or copy and paste this link in your browser:</p>
          <p style="margin: 10px 0; word-break: break-all; font-size: 12px; color: #3b82f6; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; background-color: #f9fafb; font-family: monospace;">${resetUrl}</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="margin: 10px 0; font-size: 13px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
          <p style="margin: 10px 0; font-size: 13px; color: #999;">This link will expire in 1 hour for security reasons.</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #666;">© 2026 Healthcare Management System. All rights reserved.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: EMAIL_FROM,
      to: email,
      subject: 'Password Reset Request - Healthcare Management System',
      html: htmlTemplate,
    };

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      message: 'Password reset email sent successfully',
    };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send password reset email',
    };
  }
};

// Send payment receipt email to patient
export const sendPaymentReceiptToPatient = async (emailData) => {
  try {
    const {
      patientName,
      patientEmail,
      appointmentDate,
      doctorName,
      hospitalName,
      consultationFee,
      paymentAmount,
      transactionId,
    } = emailData;

    const transporter = createTransporter();

    const formattedDate = new Date(appointmentDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const remainingAmount = consultationFee - paymentAmount;

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <table width="80" height="80" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 15px; background-color: rgba(255,255,255,0.2); border-radius: 50%;">
            <tr>
              <td align="center" valign="middle" style="font-size: 40px; color: white; line-height: 80px;">💳</td>
            </tr>
          </table>
          <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">Payment Receipt</h1>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Your appointment payment has been processed</p>
        </div>
        
        <div style="padding: 40px 30px; background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 18px; color: #374151; margin: 0 0 25px 0;">Dear <strong>${patientName}</strong>,</p>
          
          <p style="color: #6b7280; line-height: 1.7; margin: 0 0 30px 0;">
            Thank you for your payment! We have received your advance payment for your appointment. 
            Please find your payment receipt and details below.
          </p>
          
          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%); border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
            <h3 style="margin: 0 0 20px 0; color: #0c4a6e; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">📋 Payment Details</h3>
            
            <table style="width: 100%; color: #374151; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1); font-weight: 600; width: 140px; color: #0c4a6e;">Transaction ID</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1); font-size: 15px; font-family: monospace; word-break: break-all;">${transactionId}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1); font-weight: 600; color: #0c4a6e;">Doctor</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1);">Dr. ${doctorName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1); font-weight: 600; color: #0c4a6e;">Appointment Date</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1);">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1); font-weight: 600; color: #0c4a6e;">Hospital</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(12, 74, 110, 0.1);">${hospitalName || 'N/A'}</td>
              </tr>
            </table>
          </div>

          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 25px; margin: 0 0 30px 0;">
            <h3 style="margin: 0 0 20px 0; color: #92400e; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">💰 Amount Details</h3>
            
            <table style="width: 100%; color: #374151; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(146, 64, 14, 0.1); font-weight: 600; width: 140px; color: #92400e;">Total Consultation Fee</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(146, 64, 14, 0.1); font-size: 15px; text-align: right;">$${consultationFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(146, 64, 14, 0.1); font-weight: 600; color: #92400e;">Amount Paid Today (50%)</td>
                <td style="padding: 12px 0; border-bottom: 1px solid rgba(146, 64, 14, 0.1); font-size: 15px; text-align: right; color: #059669; font-weight: 600;">$${paymentAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 600; color: #92400e;">Remaining Balance (50%)</td>
                <td style="padding: 12px 0; font-size: 15px; text-align: right; color: #dc2626; font-weight: 600;">$${remainingAmount.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 0 0 30px 0; border-radius: 0 8px 8px 0;">
            <h4 style="margin: 0 0 10px 0; color: #166534; font-size: 14px;">✅ Payment Status</h4>
            <p style="margin: 0; color: #166534; line-height: 1.8;">Your half payment of <strong>$${paymentAmount.toFixed(2)}</strong> has been successfully processed. The remaining <strong>$${remainingAmount.toFixed(2)}</strong> will be due on or before your appointment date.</p>
          </div>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 0 0 30px 0; border-radius: 0 8px 8px 0;">
            <h4 style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px;">⚠️ Important</h4>
            <ul style="margin: 0; padding: 0 0 0 20px; color: #991b1b; line-height: 1.8; font-size: 14px;">
              <li>Please save this receipt for your records</li>
              <li>Remaining balance must be paid before or at the time of appointment</li>
              <li>Visit the hospital 15 minutes before your scheduled time</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; margin: 0 0 20px 0; line-height: 1.7;">
            If you have any questions regarding your payment or appointment, please contact the hospital directly.
          </p>
          
          <p style="color: #374151; margin: 0;">
            Best regards,<br/>
            <strong>${hospitalName}</strong>
          </p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 25px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0 0 5px 0;">
            This is an automated email from the Hospital Management System.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Hospital Management Tenant. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: EMAIL_FROM,
      to: patientEmail,
      subject: `💳 Payment Receipt - Appointment with Dr. ${doctorName}`,
      html: htmlTemplate,
    };

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      message: 'Payment receipt email sent successfully',
    };
  } catch (error) {
    console.error('Error sending payment receipt email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send payment receipt email',
    };
  }
};

export const sendRemainingPaymentLinkToPatient = async (emailData) => {
  try {
    const {
      patientName,
      patientEmail,
      appointmentDate,
      doctorName,
      hospitalName,
      remainingAmount,
      paymentLink,
    } = emailData;

    const transporter = createTransporter();

    const formattedDate = new Date(appointmentDate).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlTemplate = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: white; font-size: 26px; font-weight: 600;">Remaining Payment Due</h1>
          <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">Please complete your appointment payment</p>
        </div>

        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; color: #374151; margin: 0 0 18px 0;">Dear <strong>${patientName}</strong>,</p>
          <p style="color: #6b7280; line-height: 1.7; margin: 0 0 20px 0;">
            Your appointment with <strong>Dr. ${doctorName || 'Doctor'}</strong> at <strong>${hospitalName || 'Hospital'}</strong> has a remaining balance.
          </p>

          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; color: #9a3412;"><strong>Appointment:</strong> ${formattedDate}</p>
            <p style="margin: 0; color: #9a3412;"><strong>Amount Due:</strong> $${Number(remainingAmount || 0).toFixed(2)}</p>
          </div>

          <div style="text-align: center; margin: 22px 0 26px;">
            <a href="${paymentLink}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600;">Pay Remaining Amount</a>
          </div>

          <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">
            If the button does not work, copy and paste this link in your browser:<br/>
            <span style="word-break: break-all; color: #2563eb;">${paymentLink}</span>
          </p>
        </div>
      </div>
    `;

    const result = await transporter.sendMail({
      from: EMAIL_FROM,
      to: patientEmail,
      subject: `Payment Reminder - ${hospitalName || 'Hospital'} Appointment`,
      html: htmlTemplate,
    });

    return {
      success: true,
      messageId: result.messageId,
      message: 'Remaining payment link email sent successfully',
    };
  } catch (error) {
    console.error('Error sending remaining payment link email:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send remaining payment link email',
    };
  }
};
