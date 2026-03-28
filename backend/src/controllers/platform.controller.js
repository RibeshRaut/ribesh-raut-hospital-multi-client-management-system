import PlatformSettings from "../models/platform.model.js";
import { notifySuperAdmins } from '../services/adminNotification.service.js';

export const getPlatformSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.findOne();
    if (!settings) {
      // Create default settings if none exist
      const defaultSettings = new PlatformSettings();
      await defaultSettings.save();
      return res.json(defaultSettings);
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching platform settings" });
  }
};

export const updatePlatformSettings = async (req, res) => {
  try {
    const { maintenanceMode, allowNewRegistrations, requireEmailVerification } =
      req.body;

    const previousSettings = await PlatformSettings.findOne();

    const settings = await PlatformSettings.findOneAndUpdate(
      {},
      { maintenanceMode, allowNewRegistrations, requireEmailVerification },
      { new: true, upsert: true }
    );

    const maintenanceEnabledNow = settings?.maintenanceMode === true;
    const maintenanceWasEnabled = previousSettings?.maintenanceMode === true;

    if (maintenanceEnabledNow && !maintenanceWasEnabled) {
      await notifySuperAdmins({
        requiredSetting: 'criticalAlerts',
        subject: 'Critical Alert: Platform Maintenance Mode Enabled',
        text: `Maintenance mode was enabled at ${new Date().toLocaleString()}. New registrations are ${settings.allowNewRegistrations ? 'enabled' : 'disabled'}.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2 style="margin-bottom: 12px; color: #b91c1c;">Critical Alert</h2>
            <p style="margin: 0 0 8px;"><strong>Event:</strong> Platform maintenance mode enabled</p>
            <p style="margin: 0 0 8px;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p style="margin: 0;"><strong>New registrations:</strong> ${settings.allowNewRegistrations ? 'Enabled' : 'Disabled'}</p>
          </div>
        `,
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error updating platform settings" });
  }
};
