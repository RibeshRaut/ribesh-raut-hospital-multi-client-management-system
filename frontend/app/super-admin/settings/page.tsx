"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  Bell,
  Lock,
  User,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { getPlatformSettings, updatePlatformSettings, adminAPI } from "@/lib/api";

const DEFAULT_NOTIFICATION_SETTINGS = {
  newHospitalRegistration: true,
  dailySummaryReport: true,
  criticalAlerts: true,
  emailNotifications: false,
  recipientEmails: [] as string[],
};

const DEFAULT_PLATFORM_SETTINGS = {
  maintenanceMode: false,
  allowNewRegistrations: true,
  requireEmailVerification: true,
};

type AdminProfileData = {
  username?: string;
  email?: string;
  notificationSettings?: Partial<typeof DEFAULT_NOTIFICATION_SETTINGS>;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export default function SuperAdminSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Profile state
  const [profile, setProfile] = useState({
    username: "",
    email: "",
  });

  // Password state
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Notification settings state
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [notificationEmailsInput, setNotificationEmailsInput] = useState("");

  // Platform settings state
  const [platformSettings, setPlatformSettings] = useState(DEFAULT_PLATFORM_SETTINGS);

  // Load all settings on mount
  useEffect(() => {
    const fetchAllSettings = async () => {
      try {
        // Fetch admin profile
        const profileData = await adminAPI.getProfile();
        const profileDataTyped = (profileData?.data || {}) as AdminProfileData;
        const notifSettingsRaw =
          profileDataTyped?.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
        const notifSettings = {
          newHospitalRegistration:
            notifSettingsRaw?.newHospitalRegistration ?? true,
          dailySummaryReport: notifSettingsRaw?.dailySummaryReport ?? true,
          criticalAlerts: notifSettingsRaw?.criticalAlerts ?? true,
          emailNotifications: notifSettingsRaw?.emailNotifications ?? false,
          recipientEmails: Array.isArray(notifSettingsRaw?.recipientEmails)
            ? notifSettingsRaw.recipientEmails
            : [],
        };
        
        setProfile({
          username: profileDataTyped?.username || "",
          email: profileDataTyped?.email || "",
        });
        setNotifications(notifSettings);
        setNotificationEmailsInput(notifSettings.recipientEmails.join(", "));
      } catch (err) {
        // Silently fail - adminAPI.getProfile handles maintenance mode gracefully
      }

      try {
        // Fetch platform settings
        const platformData = await getPlatformSettings();
        const typedPlatformData = platformData as typeof DEFAULT_PLATFORM_SETTINGS;
        setPlatformSettings(
          typedPlatformData?.maintenanceMode !== undefined
            ? typedPlatformData
            : DEFAULT_PLATFORM_SETTINGS
        );
      } catch (err) {
        // Silently fail - getPlatformSettings handles errors gracefully
        setPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
      }
    };
    fetchAllSettings();
  }, []);

  // Handle profile changes
  const handleProfileChange = (field: string, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  // Handle password changes
  const handlePasswordChange = (field: string, value: string) => {
    setPasswords((prev) => ({ ...prev, [field]: value }));
  };

  // Handle notification changes
  const handleNotificationChange =
    (field: keyof typeof notifications) => (checked: boolean) => {
      setNotifications((prev) => ({ ...prev, [field]: checked }));
    };

  // Handle platform settings changes
  const handlePlatformChange =
    (field: keyof typeof platformSettings) => (checked: boolean) => {
      setPlatformSettings((prev) => ({ ...prev, [field]: checked }));
    };

  // Save profile
  const handleSaveProfile = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await adminAPI.updateProfile(profile);
      setSuccessMessage("Profile updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not save profile. Please try again."));
      console.warn("Could not save profile");
    } finally {
      setIsLoading(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      setError("All password fields are required");
      setIsLoading(false);
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("New passwords do not match");
      setIsLoading(false);
      return;
    }

    if (passwords.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      await adminAPI.changePassword(passwords);
      setSuccessMessage("Password changed successfully");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not change password. Please try again."));
      console.warn("Could not change password");
    } finally {
      setIsLoading(false);
    }
  };

  // Save notifications
  const handleSaveNotifications = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const recipientEmails = notificationEmailsInput
        .split(/[\n,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmail = recipientEmails.find((email) => !emailRegex.test(email));

      if (invalidEmail) {
        setError(`Invalid notification email: ${invalidEmail}`);
        setIsLoading(false);
        return;
      }

      const uniqueRecipientEmails = [...new Set(recipientEmails)];

      await adminAPI.updateNotificationSettings({
        ...notifications,
        recipientEmails: uniqueRecipientEmails,
      });

      setNotifications((prev) => ({ ...prev, recipientEmails: uniqueRecipientEmails }));
      setNotificationEmailsInput(uniqueRecipientEmails.join(", "));
      setSuccessMessage("Notification settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not save notification settings. Please try again."));
      console.warn("Could not save notification settings");
    } finally {
      setIsLoading(false);
    }
  };

  // Send test notification email
  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const recipientEmails = notificationEmailsInput
        .split(/[\n,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmail = recipientEmails.find((email) => !emailRegex.test(email));

      if (invalidEmail) {
        setError(`Invalid notification email: ${invalidEmail}`);
        setIsSendingTestEmail(false);
        return;
      }

      const uniqueRecipientEmails = [...new Set(recipientEmails)];

      await adminAPI.sendTestNotificationEmail({
        recipientEmails: uniqueRecipientEmails,
      });

      setSuccessMessage("Test notification email sent successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not send test notification email. Please try again."));
      console.warn("Could not send test notification email");
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Save platform settings
  const handleSavePlatformSettings = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await updatePlatformSettings(platformSettings);
      setSuccessMessage("Platform settings saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Could not save platform settings. Please try again."));
      console.warn("Could not save platform settings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your super admin account and platform settings
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-800">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-amber-600" />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Update your admin profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={profile.username}
                onChange={(e) => handleProfileChange("username", e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleProfileChange("email", e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSaveProfile}
              disabled={isLoading}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-amber-600" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Manage your password and security preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwords.newPassword}
                onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleChangePassword}
              disabled={isLoading}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-amber-600" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">New Hospital Registration</p>
              <p className="text-sm text-muted-foreground">
                Get notified when a new hospital registers
              </p>
            </div>
            <Switch
              checked={notifications.newHospitalRegistration}
              onCheckedChange={handleNotificationChange("newHospitalRegistration")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Daily Summary Report</p>
              <p className="text-sm text-muted-foreground">
                Receive a daily summary of platform activity
              </p>
            </div>
            <Switch
              checked={notifications.dailySummaryReport}
              onCheckedChange={handleNotificationChange("dailySummaryReport")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Critical Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get immediate alerts for critical issues
              </p>
            </div>
            <Switch
              checked={notifications.criticalAlerts}
              onCheckedChange={handleNotificationChange("criticalAlerts")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={notifications.emailNotifications}
              onCheckedChange={handleNotificationChange("emailNotifications")}
            />
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="notification-recipients">Notification Recipient Emails</Label>
            <Input
              id="notification-recipients"
              value={notificationEmailsInput}
              onChange={(e) => setNotificationEmailsInput(e.target.value)}
              placeholder="admin@example.com, ops@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Enter one or more emails separated by commas. If empty, your admin email is used.
            </p>
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSaveNotifications}
              disabled={isLoading || isSendingTestEmail}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={isLoading || isSendingTestEmail}
            >
              {isSendingTestEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Test...
                </>
              ) : (
                "Send Test Email"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-amber-600" />
            Platform Settings
          </CardTitle>
          <CardDescription>
            Global platform configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Maintenance Mode</p>
              <p className="text-sm text-muted-foreground">
                Put the platform in maintenance mode
              </p>
            </div>
            <Switch
              checked={platformSettings.maintenanceMode}
              onCheckedChange={handlePlatformChange("maintenanceMode")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Allow New Registrations</p>
              <p className="text-sm text-muted-foreground">
                Allow new hospitals to register
              </p>
            </div>
            <Switch
              checked={platformSettings.allowNewRegistrations}
              onCheckedChange={handlePlatformChange("allowNewRegistrations")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Require Email Verification</p>
              <p className="text-sm text-muted-foreground">
                Require hospitals to verify their email
              </p>
            </div>
            <Switch
              checked={platformSettings.requireEmailVerification}
              onCheckedChange={handlePlatformChange("requireEmailVerification")}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSavePlatformSettings}
              disabled={isLoading}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

