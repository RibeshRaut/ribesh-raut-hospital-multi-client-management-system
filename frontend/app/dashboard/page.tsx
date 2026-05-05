"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Calendar,
  Users,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { dashboardAPI } from "@/lib/api";

type DashboardAppointment = {
  _id: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty?: string;
  appointmentDate: string;
  status: string;
};

type DashboardStats = {
  hospitalInfo?: {
    name?: string;
  };
  statistics?: {
    doctors?: {
      total?: number;
      active?: number;
      growth?: number;
    };
    appointments?: {
      today?: number;
      pending?: number;
      total?: number;
      completed?: number;
      cancelled?: number;
      thisWeek?: number;
    };
    patients?: {
      total?: number;
    };
    avgAppointmentDuration?: number;
  };
  recentAppointments?: DashboardAppointment[];
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentAppointments, setRecentAppointments] = useState<DashboardAppointment[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchDashboardData();
    }
  }, [isMounted]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get user info from localStorage (only on client)
      if (typeof window === "undefined") {
        setError("Not running in browser context");
        return;
      }

      const userStr = localStorage.getItem("userInfo");
      if (!userStr) {
        setError("User information not found. Please log in again.");
        setIsLoading(false);
        return;
      }

      let user;
      try {
        user = JSON.parse(userStr);
      } catch {
        setError("Invalid user information format");
        setIsLoading(false);
        return;
      }

      const hospitalId = user?.hospitalId || user?._id;

      if (!hospitalId) {
        setError("Hospital ID not found. Please log in again.");
        setIsLoading(false);
        return;
      }

      // Fetch dashboard statistics
      const response = await dashboardAPI.getStats(hospitalId);
      if (response.data) {
        const data = response.data as DashboardStats;
        setStats(data);
        setRecentAppointments(data.recentAppointments || []);
      }
    } catch (err: unknown) {
      console.error("Error fetching dashboard data:", err);
      setError(getErrorMessage(err, "Failed to load dashboard data"));
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
    trend,
  }: {
    title: string;
    value: number | string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    color: string;
    trend?: { value: number; direction: "up" | "down" };
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <p
                className={`text-xs mt-2 ${
                  trend.direction === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
              </p>
            )}
          </div>
          <div className={`${color} p-3 rounded-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const getAppointmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive">
        <CardContent className="flex items-center gap-4 pt-6">
          <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">Error Loading Dashboard</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
          <Button onClick={fetchDashboardData} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome, {stats?.hospitalInfo?.name}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening at your hospital today.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Doctors"
          value={stats?.statistics?.doctors?.total || 0}
          icon={Stethoscope}
          color="bg-blue-500"
          trend={
            stats?.statistics?.doctors?.growth !== undefined
              ? {
                  value: Math.abs(stats.statistics.doctors.growth),
                  direction: stats.statistics.doctors.growth >= 0 ? "up" : "down",
                }
              : undefined
          }
        />
        <StatCard
          title="Today's Appointments"
          value={stats?.statistics?.appointments?.today || 0}
          icon={Calendar}
          color="bg-green-500"
        />
        <StatCard
          title="Total Patients"
          value={stats?.statistics?.patients?.total || 0}
          icon={Users}
          color="bg-purple-500"
        />
        <StatCard
          title="Pending Appointments"
          value={stats?.statistics?.appointments?.pending || 0}
          icon={Clock}
          color="bg-orange-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointment Statistics */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Appointment Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total</p>
                <p className="text-2xl font-bold">
                  {stats?.statistics?.appointments?.total || 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.statistics?.appointments?.completed || 0}
                </p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats?.statistics?.appointments?.pending || 0}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Cancelled</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats?.statistics?.appointments?.cancelled || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quick Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Active Doctors</p>
              <p className="text-2xl font-bold">
                {stats?.statistics?.doctors?.active || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-2xl font-bold">
                {stats?.statistics?.appointments?.thisWeek || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Appointments scheduled
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg. Duration</p>
              <p className="text-2xl font-bold">
                {stats?.statistics?.avgAppointmentDuration || 30}
              </p>
              <p className="text-xs text-muted-foreground mt-1">minutes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Appointments */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recent Appointments</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/appointments">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentAppointments.length > 0 ? (
            <div className="space-y-4">
              {recentAppointments.map((apt) => (
                <div
                  key={apt._id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition"
                >
                  <div className="flex-1">
                    <p className="font-medium">{apt.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      Dr. {apt.doctorName} • {apt.doctorSpecialty}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(apt.appointmentDate).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={getAppointmentStatusColor(apt.status)}>
                    {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">No recent appointments</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button asChild size="lg" variant="outline" className="h-20">
          <Link href="/dashboard/doctors" className="flex flex-col items-center justify-center gap-2">
            <Stethoscope className="h-6 w-6" />
            <span>Manage Doctors</span>
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-20">
          <Link href="/dashboard/appointments" className="flex flex-col items-center justify-center gap-2">
            <Calendar className="h-6 w-6" />
            <span>View Appointments</span>
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-20">
          <Link href="/dashboard/patients" className="flex flex-col items-center justify-center gap-2">
            <Users className="h-6 w-6" />
            <span>Manage Patients</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
