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
  data?: any;
}

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date>(new Date());
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
      addNotification({
        type: 'appointment',
        title: 'New Appointment Request',
        message: `${data.userName || data.patientName || 'A patient'} has requested an appointment`,
        link: '/dashboard/appointments',
        data,
      });
      // Update pending count
      setPendingAppointmentsCount((prev) => prev + 1);
    });

    // Listen for appointment status updates
    const unsubscribeAppointmentStatusUpdated = on('appointment:statusUpdated', (data) => {
      console.log('🔔 Appointment status updated:', data);
      addNotification({
        type: 'appointment',
        title: 'Appointment Status Updated',
        message: `Appointment status changed to ${data.status}`,
        link: '/dashboard/appointments',
        data,
      });
    });

    // Listen for appointment cancellations
    const unsubscribeAppointmentCancelled = on('appointment:cancelled', (data) => {
      console.log('🔔 Appointment cancelled:', data);
      addNotification({
        type: 'appointment',
        title: 'Appointment Cancelled',
        message: `Appointment has been cancelled`,
        link: '/dashboard/appointments',
        data,
      });
    });

    // Listen for new contact form submissions
    const unsubscribeContactFormSubmitted = on('contactForm:submitted', (data) => {
      console.log('🔔 New contact form received:', data);
      addNotification({
        type: 'message',
        title: 'New Contact Form',
        message: `${data.name} submitted a contact form: ${data.subject}`,
        link: '/dashboard/messages',
        data,
      });
    });

    // Listen for contact form status updates
    const unsubscribeContactFormStatusUpdated = on('contactForm:statusUpdated', (data) => {
      console.log('🔔 Contact form status updated:', data);
      addNotification({
        type: 'message',
        title: 'Contact Form Updated',
        message: `Contact form status changed to ${data.status}`,
        link: '/dashboard/messages',
        data,
      });
    });

    // Listen for payment success
    const unsubscribePaymentSuccess = on('payment:paymentSuccess', (data) => {
      console.log('💳 Payment successful:', data);
      addNotification({
        type: 'system',
        title: 'Payment Successful',
        message: 'Your appointment payment has been processed',
        link: '/dashboard/appointments',
        data,
      });
    });

    // Listen for payment failures
    const unsubscribePaymentFailed = on('payment:paymentFailed', (data) => {
      console.log('❌ Payment failed:', data);
      addNotification({
        type: 'system',
        title: 'Payment Failed',
        message: `Payment failed: ${data.reason || 'Please try again'}`,
        link: '/dashboard/appointments',
        data,
      });
    });

    // Listen for payment expiration
    const unsubscribePaymentExpired = on('payment:paymentExpired', (data) => {
      console.log('⏰ Payment expired:', data);
      addNotification({
        type: 'system',
        title: 'Payment Expired',
        message: 'Your payment session has expired. Please try again.',
        link: '/dashboard/appointments',
        data,
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

      const user = JSON.parse(userStr);
      const hospitalId = user.hospitalId || user._id;
      if (!hospitalId) return;

      // Fetch recent appointments
      const response = await appointmentAPI.getByHospital(hospitalId);
      const appointments = (response.data || []) as any[];

      // Count pending appointments
      const pendingCount = appointments.filter((apt: any) => apt.status === "pending").length;
      setPendingAppointmentsCount(pendingCount);

      // Find appointments created after last check
      const newAppointments = appointments.filter((apt: any) => {
        const createdAt = new Date(apt.createdAt);
        return createdAt > lastCheckedAt;
      });

      // Add notifications for new appointments
      newAppointments.forEach((apt: any) => {
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
          const chatsData = await chatsResponse.json();
          
          if (chatsData.success) {
            const waitingCount = chatsData.chats.filter((c: any) => c.status === "waiting").length;
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

  // Initial load
  useEffect(() => {
    // Load notifications from localStorage if available
    const saved = localStorage.getItem("notifications");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
      } catch (e) {
        console.error("Error loading notifications:", e);
      }
    }

    // Load last checked time
    const lastChecked = localStorage.getItem("lastNotificationCheck");
    if (lastChecked) {
      setLastCheckedAt(new Date(lastChecked));
    }
  }, []);

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
