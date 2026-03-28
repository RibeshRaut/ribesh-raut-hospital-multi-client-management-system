"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Building2,
  Stethoscope,
  Calendar,
  Users,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Trash2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { superAdminAPI } from "@/lib/api";

interface HospitalSubscription {
  status?: string;
  currentPlan?: string | null;
  isTrialActive?: boolean;
  trialEndDate?: string | null;
  estimatedMonthlyRevenue?: number;
}

interface HospitalDetails {
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  registrationNumber?: string;
  totalBeds?: number;
  emergencyDepartment?: boolean;
  description?: string;
  subscription?: HospitalSubscription;
}

interface HospitalStatistics {
  doctors?: { total?: number; active?: number };
  appointments?: { total?: number; pending?: number };
  patients?: number;
  contactForms?: number;
  services?: number;
}

interface HospitalDoctor {
  _id: string;
  name: string;
  specialty?: string;
  status?: string;
}

interface HospitalRecentAppointment {
  _id: string;
  patientName?: string;
  doctorName?: string;
  appointmentDate: string;
  status: string;
}

interface HospitalDetailsResponse {
  hospital: HospitalDetails;
  statistics: HospitalStatistics;
  recentAppointments: HospitalRecentAppointment[];
  doctors: HospitalDoctor[];
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export default function HospitalDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const hospitalId = (params.hospitalId as string) || "";

  const [data, setData] = useState<HospitalDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchHospitalDetails = useCallback(async () => {
    if (!hospitalId) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await superAdminAPI.getHospitalDetails(hospitalId);
      if (response.data) {
        setData(response.data as HospitalDetailsResponse);
      }
    } catch (err: unknown) {
      console.error("Error fetching hospital details:", err);
      setError(getErrorMessage(err, "Failed to load hospital details"));
    } finally {
      setIsLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    fetchHospitalDetails();
  }, [fetchHospitalDetails]);

  const handleDeleteHospital = async () => {
    try {
      setIsDeleting(true);
      await superAdminAPI.deleteHospital(hospitalId);
      router.push("/super-admin/hospitals");
    } catch (err: unknown) {
      console.error("Error deleting hospital:", err);
      setError(getErrorMessage(err, "Failed to delete hospital"));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

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
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading hospital details...</p>
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
            <p className="font-semibold text-destructive">Error Loading Hospital</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
          <Button onClick={fetchHospitalDetails} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { hospital, statistics, recentAppointments, doctors } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{hospital.name}</h1>
          <p className="text-muted-foreground">Hospital Details & Statistics</p>
        </div>
        <div className="flex items-center gap-2">
          {hospital.slug && (
            <Link href={`/hospital/${hospital.slug}`} target="_blank">
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View Public Page
              </Button>
            </Link>
          )}
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Hospital
          </Button>
        </div>
      </div>

      {/* Hospital Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Hospital Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {hospital.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {hospital.phone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {hospital.address}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Registration Number
                  </p>
                  <p className="font-medium">
                    {hospital.registrationNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Beds</p>
                  <p className="font-medium">{hospital.totalBeds || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Emergency Department
                  </p>
                  <Badge
                    variant={hospital.emergencyDepartment ? "default" : "secondary"}
                    className={
                      hospital.emergencyDepartment
                        ? "bg-green-100 text-green-800"
                        : ""
                    }
                  >
                    {hospital.emergencyDepartment ? "Available" : "Not Available"}
                  </Badge>
                </div>
              </div>
            </div>
            {hospital.description && (
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p className="text-sm">{hospital.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-xl">
                  <Stethoscope className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics.doctors?.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Doctors</p>
                  <p className="text-xs text-green-600">
                    {statistics.doctors?.active || 0} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-purple-100 p-3 rounded-xl">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {statistics.appointments?.total || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Appointments
                  </p>
                  <p className="text-xs text-amber-600">
                    {statistics.appointments?.pending || 0} pending
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-xl">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics.patients || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-xl">
                  <MessageSquare className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics.contactForms || 0}</p>
                  <p className="text-sm text-muted-foreground">Contact Forms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-100 p-3 rounded-xl">
                  <CreditCard className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription</p>
                  <p className="text-lg font-bold uppercase">
                    {hospital.subscription?.status || "inactive"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Plan: {hospital.subscription?.currentPlan || "none"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Revenue: ${Number(hospital.subscription?.estimatedMonthlyRevenue || 0).toLocaleString()}/mo
                  </p>
                  {hospital.subscription?.isTrialActive && hospital.subscription?.trialEndDate && (
                    <p className="text-xs text-blue-600">
                      Trial ends {new Date(hospital.subscription.trialEndDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctors List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Doctors</CardTitle>
            <CardDescription>
              All doctors registered under this hospital
            </CardDescription>
          </CardHeader>
          <CardContent>
            {doctors && doctors.length > 0 ? (
              <div className="space-y-3">
                {doctors.map((doctor) => (
                  <div
                    key={doctor._id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-green-100 text-green-800">
                        {doctor.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{doctor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {doctor.specialty}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        doctor.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }
                    >
                      {doctor.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Stethoscope className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No doctors registered</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Appointments</CardTitle>
            <CardDescription>Latest appointments at this hospital</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAppointments && recentAppointments.length > 0 ? (
              <div className="space-y-3">
                {recentAppointments.map((apt) => (
                  <div
                    key={apt._id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-purple-100 text-purple-800">
                        {apt.patientName
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{apt.patientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.doctorName} •{" "}
                        {new Date(apt.appointmentDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={getAppointmentStatusColor(apt.status)}
                    >
                      {apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No appointments yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent title="Delete Hospital">
          <DialogHeader>
            <DialogDescription>
              Are you sure you want to delete <strong>{hospital.name}</strong>?
              This action cannot be undone and will remove:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>{statistics.doctors?.total || 0} doctors</li>
                <li>{statistics.appointments?.total || 0} appointments</li>
                <li>{statistics.services || 0} services</li>
                <li>{statistics.contactForms || 0} contact forms</li>
                <li>All patient records</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteHospital}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Hospital
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
