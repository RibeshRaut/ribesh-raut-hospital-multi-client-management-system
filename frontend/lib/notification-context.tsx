"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { appointmentAPI, tokenManager } from "@/lib/api";
import { useSocket } from "@/lib/useSocket";

export interface Notification {
  id: string;
  type: "appointment" | "message" | "system" | "chat";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
  data?: unknown;
}

type StoredNotification = Omit<Notification, "timestamp"> & { timestamp: string };

type AppointmentLike = {
  status?: string;
  createdAt?: string;
  userName?: string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
};

type ChatsResponse = {
  success?: boolean;
  chats?: Array<{ status?: string }>;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const getString = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === "string" ? value : "";
};

const loadNotifications = (): Notification[] => {
  if (typeof window === "undefined") {
    return [];
  }

  const saved = localStorage.getItem("notifications");
  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved) as StoredNotification[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((n) => ({
      ...n,
      timestamp: new Date(n.timestamp),
    }));
  } catch {
    return [];
  }
};

const loadLastCheckedAt = (): Date => {
  if (typeof window === "undefined") {
    return new Date();
  }

  const lastChecked = localStorage.getItem("lastNotificationCheck");
  return lastChecked ? new Date(lastChecked) : new Date();
};

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  pendingAppointmentsCount: number;
  waitingChatsCount: number;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(loadLastCheckedAt);
  const [pendingAppointmentsCount, setPendingAppointmentsCount] = useState(0);
  const [waitingChatsCount, setWaitingChatsCount] = useState(0);
  const { socket, on } = useSocket({ autoConnect: true });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50 notifications
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Setup WebSocket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Listen for new appointment requests
    const unsubscribeAppointmentCreated = on('appointment:created', (data) => {
      console.log('🔔 New appointment received:', data);
      const record = toRecord(data);
      const userName = getString(record, "userName") || getString(record, "patientName") || "A patient";
      addNotification({
        type: 'appointment',
        title: 'New Appointment Request',
        message: `${userName} has requested an appointment`,
        link: '/dashboard/appointments',
        data: record,
      });
      // Update pending count
      setPendingAppointmentsCount((prev) => prev + 1);
    });

    // Listen for appointment status updates
    const unsubscribeAppointmentStatusUpdated = on('appointment:statusUpdated', (data) => {
      console.log('🔔 Appointment status updated:', data);
      const record = toRecord(data);
      const status = getString(record, "status") || "updated";
      addNotification({
        type: 'appointment',
        title: 'Appointment Status Updated',
        message: `Appointment status changed to ${status}`,
        link: '/dashboard/appointments',
        data: record,
      });
    });

    // Listen for appointment cancellations
    const unsubscribeAppointmentCancelled = on('appointment:cancelled', (data) => {
      console.log('🔔 Appointment cancelled:', data);
      const record = toRecord(data);
      addNotification({
        type: 'appointment',
        title: 'Appointment Cancelled',
        message: `Appointment has been cancelled`,
        link: '/dashboard/appointments',
        data: record,
      });
    });

    // Listen for new contact form submissions
    const unsubscribeContactFormSubmitted = on('contactForm:submitted', (data) => {
      console.log('🔔 New contact form received:', data);
      const record = toRecord(data);
      const name = getString(record, "name") || "Someone";
      const subject = getString(record, "subject") || "General Inquiry";
      addNotification({
        type: 'message',
        title: 'New Contact Form',
        message: `${name} submitted a contact form: ${subject}`,
        link: '/dashboard/messages',
        data: record,
      });
    });

    // Listen for contact form status updates
    const unsubscribeContactFormStatusUpdated = on('contactForm:statusUpdated', (data) => {
      console.log('🔔 Contact form status updated:', data);
      const record = toRecord(data);
      const status = getString(record, "status") || "updated";
      addNotification({
        type: 'message',
        title: 'Contact Form Updated',
        message: `Contact form status changed to ${status}`,
        link: '/dashboard/messages',
        data: record,
      });
    });

    // Listen for payment success
    const unsubscribePaymentSuccess = on('payment:paymentSuccess', (data) => {
      console.log('💳 Payment successful:', data);
      const record = toRecord(data);
      addNotification({
        type: 'system',
        title: 'Payment Successful',
        message: 'Your appointment payment has been processed',
        link: '/dashboard/appointments',
        data: record,
      });
    });

    // Listen for payment failures
    const unsubscribePaymentFailed = on('payment:paymentFailed', (data) => {
      console.log('❌ Payment failed:', data);
      const record = toRecord(data);
      const reason = getString(record, "reason") || "Please try again";
      addNotification({
        type: 'system',
        title: 'Payment Failed',
        message: `Payment failed: ${reason}`,
        link: '/dashboard/appointments',
        data: record,
      });
    });

    // Listen for payment expiration
    const unsubscribePaymentExpired = on('payment:paymentExpired', (data) => {
      console.log('⏰ Payment expired:', data);
      const record = toRecord(data);
      addNotification({
        type: 'system',
        title: 'Payment Expired',
        message: 'Your payment session has expired. Please try again.',
        link: '/dashboard/appointments',
        data: record,
      });
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribeAppointmentCreated();
      unsubscribeAppointmentStatusUpdated();
      unsubscribeAppointmentCancelled();
      unsubscribeContactFormSubmitted();
      unsubscribeContactFormStatusUpdated();
      unsubscribePaymentSuccess();
      unsubscribePaymentFailed();
      unsubscribePaymentExpired();
    };
  }, [socket, on, addNotification]);

  const refreshNotifications = useCallback(async () => {
    try {
      const userStr = localStorage.getItem("userInfo");
      const token = tokenManager.getToken();
      if (!userStr) return;

      const user = JSON.parse(userStr) as { hospitalId?: string; _id?: string };
      const hospitalId = user.hospitalId || user._id;
      if (!hospitalId) return;

      // Fetch recent appointments
      const response = await appointmentAPI.getByHospital(hospitalId);
      const appointments = Array.isArray(response.data)
        ? (response.data as AppointmentLike[])
        : [];

      // Count pending appointments
      const pendingCount = appointments.filter((apt) => apt.status === "pending").length;
      setPendingAppointmentsCount(pendingCount);

      // Find appointments created after last check
      const newAppointments = appointments.filter((apt) => {
        if (!apt.createdAt) return false;
        const createdAt = new Date(apt.createdAt);
        return createdAt > lastCheckedAt;
      });

      // Add notifications for new appointments
      newAppointments.forEach((apt) => {
        addNotification({
          type: "appointment",
          title: "New Appointment Request",
          message: `${apt.userName || apt.patientName || "A patient"} has requested an appointment`,
          link: "/dashboard/appointments",
          data: apt,
        });
      });

      // Fetch waiting chats
      if (token) {
        try {
          const chatsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/admin/chats`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const chatsData = (await chatsResponse.json()) as ChatsResponse;

          if (chatsData.success) {
            const waitingCount = (chatsData.chats || []).filter(
              (c) => c.status === "waiting"
            ).length;
            setWaitingChatsCount(waitingCount);
          }
        } catch (error) {
          console.error("Error fetching chats:", error);
        }
      }

      setLastCheckedAt(new Date());
    } catch (error) {
      console.error("Error refreshing notifications:", error);
    }
  }, [lastCheckedAt, addNotification]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshNotifications]);

  // Save notifications to localStorage
  useEffect(() => {
    localStorage.setItem("notifications", JSON.stringify(notifications));
    localStorage.setItem("lastNotificationCheck", lastCheckedAt.toISOString());
  }, [notifications, lastCheckedAt]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        pendingAppointmentsCount,
        waitingChatsCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
