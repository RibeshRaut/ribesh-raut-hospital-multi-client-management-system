import Admin from '../models/admin.model.js';
import { sendSuperAdminNotificationEmail } from './email.service.js';

const dedupeEmails = (emails = []) => {
  const normalized = emails
    .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
    .filter(Boolean);

  return [...new Set(normalized)];
};

const getRecipientsFromAdmin = (admin) => {
  const configuredRecipients = Array.isArray(admin?.notificationSettings?.recipientEmails)
    ? admin.notificationSettings.recipientEmails
    : [];

  const recipients = dedupeEmails(configuredRecipients);

  if (recipients.length > 0) {
    return recipients;
  }

  return admin?.email ? [admin.email.trim().toLowerCase()] : [];
};

export const notifySuperAdmins = async ({
  requiredSetting,
  subject,
  html,
  text,
}) => {
  try {
    const admins = await Admin.find({
      'notificationSettings.emailNotifications': true,
      ...(requiredSetting ? { [`notificationSettings.${requiredSetting}`]: true } : {}),
    }).select('email notificationSettings');

    if (!admins.length) {
      return { success: true, sent: 0, skipped: true };
    }

    const recipients = dedupeEmails(admins.flatMap((admin) => getRecipientsFromAdmin(admin)));

    if (!recipients.length) {
      return { success: true, sent: 0, skipped: true };
    }

    const result = await sendSuperAdminNotificationEmail({
      to: recipients,
      subject,
      html,
      text,
    });

    return {
      success: result.success,
      sent: result.success ? recipients.length : 0,
      error: result.error,
    };
  } catch (error) {
    console.error('Error notifying super admins:', error);
    return {
      success: false,
      sent: 0,
      error: error.message,
    };
  }
};
