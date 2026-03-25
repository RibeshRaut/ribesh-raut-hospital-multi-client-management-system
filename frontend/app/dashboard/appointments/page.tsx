"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  MoreHorizontal,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Check,
  X,
  Mail,
  Phone,
  Loader2,
} from "lucide-react";
import { appointmentAPI, doctorAPI } from "@/lib/api";
import { validateEmail, validatePhone, validateFutureDate, validateTime } from "@/lib/validation";
import { useSocket } from "@/lib/useSocket";

type AppointmentStatus = "Pending" | "Confirmed" | "Completed" | "Cancelled";

type Appointment = {
  _id?: string;
  id?: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorId?: string;
  doctorName?: string;
  specialt: string;
  appointmentDate: string;
  appointmentTime: string;
  reason?: string;
  status: AppointmentStatus;
  notes?: string;
  hospitalId?: string;
  createdAt?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  consultationFee?: number;
};

type Doctor = {
  _id: string;
  name: string;
  specialty: string;
};

const appointmentTypes = ["Consultation", "Follow-up", "Check-up", "Emergency"];

// Helper to normalize status from backend (lowercase) to frontend (capitalized)
const normalizeStatus = (status: string): AppointmentStatus => {
  const statusMap: Record<string, AppointmentStatus> = {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    // Also handle already capitalized values
    Pending: "Pending",
    Confirmed: "Confirmed",
    Completed: "Completed",
    Cancelled: "Cancelled",
  };
  return statusMap[status] || "Pending";
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeTab, setActiveTab] = useState("appointments");
  const { socket, on } = useSocket({ autoConnect: true });

  // Dialog states
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form data
  const [formData, setFormData] = useState({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    doctorId: "",
    appointmentDate: "",
    appointmentTime: "",
    reason: "",
    notes: "",
  });

  // Fetch appointments and doctors on mount
  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, []);

  // Setup real-time listeners for appointment updates
  useEffect(() => {
    if (!socket) return;

    const userStr = localStorage.getItem("userInfo");
    if (!userStr) return;

    const user = JSON.parse(userStr);
    const hospitalId = user.hospitalId || user._id;

    if (!hospitalId) return;

    // Join hospital room for appointment updates
    socket.emit('appointment:join', { hospitalId });

    // Listen for new appointment requests
    const unsubscribeCreated = on('appointment:created', (data) => {
      console.log('🔔 New appointment event received:', data);
      // Refetch appointments to get the latest data
      fetchAppointments();
    });

    // Listen for appointment status updates
    const unsubscribeStatusUpdated = on('appointment:statusUpdated', (data) => {
      console.log('🔔 Appointment status updated event:', data);
      // Refetch appointments to get the latest data
      fetchAppointments();
    });

    // Listen for appointment cancellations
    const unsubscribeCancelled = on('appointment:cancelled', (data) => {
      console.log('🔔 Appointment cancelled event:', data);
      // Refetch appointments to get the latest data
      fetchAppointments();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeStatusUpdated();
      unsubscribeCancelled();
    };
  }, [socket, on]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const userStr = localStorage.getItem("userInfo");
      if (!userStr) {
        setError("User information not found. Please log in again.");
        return;
      }

      const user = JSON.parse(userStr);
      const userId = user._id || user.id;
      const hospitalId = user.hospitalId || user._id;

      if (!hospitalId) {
        setError("Hospital ID not found. Please log in again.");
        return;
      }

      // Fetch by hospital
      const response = await appointmentAPI.getByHospital(hospitalId);
      // Map backend field names to frontend field names
      const mappedAppointments = ((response.data as any[]) || []).map((apt: any) => ({
        ...apt,
        patientName: apt.patientName || apt.userName || 'Unknown Patient',
        patientEmail: apt.patientEmail || apt.userEmail || '',
        patientPhone: apt.patientPhone || apt.userPhone || '',
        appointmentTime: apt.appointmentTime || (apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''),
        // Extract doctor name from populated doctorId object
        doctorName: apt.doctorName || (apt.doctorId?.name) || 'Unknown Doctor',
        doctorId: apt.doctorId?._id || apt.doctorId,
        // Normalize status from backend lowercase to frontend capitalized
        status: normalizeStatus(apt.status),
        paymentStatus: apt.paymentStatus || 'pending',
        paymentAmount: apt.paymentAmount,
        consultationFee: apt.consultationFee,
      }));
      // Sort by createdAt (newest first)
      mappedAppointments.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setAppointments(mappedAppointments);
    } catch (err: any) {
      console.error("Error fetching appointments:", err);
      setError(
        err.message || "Failed to load appointments. Please try again later."
      );
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const userStr = localStorage.getItem("userInfo");
      if (!userStr) return;

      const user = JSON.parse(userStr);
      const hospitalId = user.hospitalId || user._id;

      if (!hospitalId) return;

      const response = await doctorAPI.getByHospital(hospitalId);
      setDoctors((response.data as Doctor[]) || []);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.patientName.trim()) {
      errors.patientName = "Patient name is required";
    }

    if (!formData.patientEmail.trim()) {
      errors.patientEmail = "Email is required";
    } else if (!validateEmail(formData.patientEmail)) {
      errors.patientEmail = "Invalid email format";
    }

    if (!formData.patientPhone.trim()) {
      errors.patientPhone = "Phone is required";
    } else if (!validatePhone(formData.patientPhone)) {
      errors.patientPhone = "Invalid phone format";
    }

    if (!formData.doctorId) {
      errors.doctorId = "Please select a doctor";
    }

    if (!formData.appointmentDate) {
      errors.appointmentDate = "Date is required";
    } else if (!validateFutureDate(formData.appointmentDate)) {
      errors.appointmentDate = "Date must be in the future";
    }

    if (!formData.appointmentTime) {
      errors.appointmentTime = "Time is required";
    } else if (!validateTime(formData.appointmentTime)) {
      errors.appointmentTime = "Invalid time format (HH:mm)";
    }

    if (!formData.reason.trim()) {
      errors.reason = "Reason is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenNewDialog = () => {
    setMutationError(null);
    setFormErrors({});
    setFormData({
      patientName: "",
      patientEmail: "",
      patientPhone: "",
      doctorId: "",
      appointmentDate: "",
      appointmentTime: "",
      reason: "",
      notes: "",
    });
    setIsNewDialogOpen(true);
  };

  const handleViewAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsViewDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsMutating(true);
      setMutationError(null);

      const userStr = localStorage.getItem("userInfo");
      const user = userStr ? JSON.parse(userStr) : null;
      const hospitalId = user?.hospitalId || user?._id;

      if (!hospitalId) {
        setMutationError("Hospital ID not found. Please log in again.");
        return;
      }

      const response = await appointmentAPI.create({
        ...formData,
        hospitalId,
      });

      setAppointments([...appointments, response.data as Appointment]);
      setIsNewDialogOpen(false);
      setFormData({
        patientName: "",
        patientEmail: "",
        patientPhone: "",
        doctorId: "",
        appointmentDate: "",
        appointmentTime: "",
        reason: "",
        notes: "",
      });
    } catch (err: any) {
      console.error("Error creating appointment:", err);
      setMutationError(
        err.message || "Failed to create appointment. Please try again."
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      setIsMutating(true);
      setMutationError(null);

      const appointmentIdToUse = appointmentId;
      await appointmentAPI.updateStatus(appointmentIdToUse, newStatus);

      // Update local state
      setAppointments(
        appointments.map((a) => {
          if ((a._id || a.id) === appointmentIdToUse) {
            return { ...a, status: newStatus };
          }
          return a;
        })
      );

      // Update selected appointment if viewing
      if (selectedAppointment && (selectedAppointment._id || selectedAppointment.id) === appointmentIdToUse) {
        setSelectedAppointment({ ...selectedAppointment, status: newStatus });
      }
    } catch (err: any) {
      console.error("Error updating status:", err);
      setMutationError(
        err.message || "Failed to update status. Please try again."
      );
    } finally {
      setIsMutating(false);
    }
  };

  // Stats
  const stats = {
    total: appointments.length,
    confirmed: appointments.filter((a) => a.status === "Confirmed").length,
    completed: appointments.filter((a) => a.status === "Completed").length,
    cancelled: appointments.filter((a) => a.status === "Cancelled").length,
  };

  const getStatusColor = (status: AppointmentStatus) => {
    const colors: Record<AppointmentStatus, string> = {
      Pending: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
      Confirmed: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
      Completed: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
      Cancelled: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
    };
    return colors[status] || "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-50";
  };

  const getStatusIcon = (status: AppointmentStatus) => {
    switch (status) {
      case "Confirmed":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "Completed":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "Cancelled":
        return <XCircle className="h-3.5 w-3.5" />;
      case "Pending":
        return <Clock className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "patientName",
      header: "Patient",
      cell: ({ row }) => {
        const appointment = row.original;
        
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {(appointment.patientName || 'UP')
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm">{appointment.patientName || 'Unknown Patient'}</p>
              <p className="text-xs text-muted-foreground">{appointment.patientEmail || '-'}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "paymentStatus",
      header: "Payment Status",
      cell: ({ row }) => {
        const status = row.original.paymentStatus || 'pending';
        let color = "bg-amber-50 text-amber-700 border-amber-200";
        if (status === 'half_paid') color = "bg-blue-50 text-blue-700 border-blue-200";
        if (status === 'paid') color = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (status === 'failed') color = "bg-red-50 text-red-700 border-red-200";
        if (status === 'refunded') color = "bg-purple-50 text-purple-700 border-purple-200";
        const displayStatus = status === 'half_paid' ? 'Half Paid' : status.charAt(0).toUpperCase() + status.slice(1);
        return (
          <Badge variant="outline" className={`${color} border rounded-full px-3 py-1 text-xs font-semibold`}>
            {displayStatus}
          </Badge>
        );
      },
    },
    {
      accessorKey: "paymentAmount",
      header: "Paid ($)",
      cell: ({ row }) => {
        const amt = row.original.paymentAmount;
        return <span>{amt != null ? `$${amt}` : '-'}</span>;
      },
    },
    {
      accessorKey: "consultationFee",
      header: "Total Fee ($)",
      cell: ({ row }) => {
        const fee = row.original.consultationFee;
        return <span>{fee != null ? `$${fee}` : '-'}</span>;
      },
    },
    {
      accessorKey: "appointmentDate",
      header: "Date & Time",
      cell: ({ row }) => {
        const appointment = row.original;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {new Date(appointment.appointmentDate).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {appointment.appointmentTime}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "doctorName",
      header: "Doctor",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.doctorName || "-"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge 
            variant="outline" 
            className={`${getStatusColor(status)} border rounded-full px-3 py-1 text-xs font-semibold`}
          >
            <span className="flex items-center gap-1.5">
              {getStatusIcon(status)}
              {status}
            </span>
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const appointment = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleViewAppointment(appointment)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {appointment.status !== "Cancelled" && appointment.status !== "Completed" && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusChange((appointment._id || appointment.id)!, "Confirmed")}>
                    <Check className="h-4 w-4 mr-2" />
                    Confirm
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange((appointment._id || appointment.id)!, "Completed")}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Completed
                  </DropdownMenuItem>
                </>
              )}
              {appointment.status !== "Cancelled" && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleStatusChange((appointment._id || appointment.id)!, "Cancelled")}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAppointments}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cancelled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground">
                Manage all scheduled appointments
              </p>
            </div>
            <Button onClick={handleOpenNewDialog} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              New Appointment
            </Button>
          </div>

          {isLoading ? (
            <Card className="p-8">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading appointments...</span>
              </div>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              data={appointments}
              searchKey="patientName"
              searchPlaceholder="Search appointments..."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* New Appointment Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]" title="Create New Appointment">
          <DialogHeader>
            <DialogTitle>Create New Appointment</DialogTitle>
            <DialogDescription>
              Schedule a new appointment for a patient.
            </DialogDescription>
          </DialogHeader>

          {mutationError && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive rounded p-3">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{mutationError}</p>
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="patientName">
                  Patient Name {formErrors.patientName && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="patientName"
                  placeholder="John Doe"
                  value={formData.patientName}
                  onChange={(e) =>
                    setFormData({ ...formData, patientName: e.target.value })
                  }
                  className={formErrors.patientName ? "border-destructive" : ""}
                />
                {formErrors.patientName && (
                  <p className="text-xs text-destructive">{formErrors.patientName}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="patientEmail">
                  Email {formErrors.patientEmail && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="patientEmail"
                  type="email"
                  placeholder="patient@example.com"
                  value={formData.patientEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, patientEmail: e.target.value })
                  }
                  className={formErrors.patientEmail ? "border-destructive" : ""}
                />
                {formErrors.patientEmail && (
                  <p className="text-xs text-destructive">{formErrors.patientEmail}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="patientPhone">
                Phone {formErrors.patientPhone && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="patientPhone"
                placeholder="+1 555-0000"
                value={formData.patientPhone}
                onChange={(e) =>
                  setFormData({ ...formData, patientPhone: e.target.value })
                }
                className={formErrors.patientPhone ? "border-destructive" : ""}
              />
              {formErrors.patientPhone && (
                <p className="text-xs text-destructive">{formErrors.patientPhone}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="doctorId">
                  Doctor {formErrors.doctorId && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={formData.doctorId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, doctorId: value })
                  }
                >
                  <SelectTrigger className={formErrors.doctorId ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor._id} value={doctor._id}>
                        {doctor.name} - {doctor.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.doctorId && (
                  <p className="text-xs text-destructive">{formErrors.doctorId}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reason">
                  Reason {formErrors.reason && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="reason"
                  placeholder="Checkup, consultation, etc."
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  className={formErrors.reason ? "border-destructive" : ""}
                />
                {formErrors.reason && (
                  <p className="text-xs text-destructive">{formErrors.reason}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="appointmentDate">
                  Date {formErrors.appointmentDate && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="appointmentDate"
                  type="date"
                  value={formData.appointmentDate}
                  onChange={(e) =>
                    setFormData({ ...formData, appointmentDate: e.target.value })
                  }
                  className={formErrors.appointmentDate ? "border-destructive" : ""}
                />
                {formErrors.appointmentDate && (
                  <p className="text-xs text-destructive">{formErrors.appointmentDate}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="appointmentTime">
                  Time {formErrors.appointmentTime && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="appointmentTime"
                  type="time"
                  value={formData.appointmentTime}
                  onChange={(e) =>
                    setFormData({ ...formData, appointmentTime: e.target.value })
                  }
                  className={formErrors.appointmentTime ? "border-destructive" : ""}
                />
                {formErrors.appointmentTime && (
                  <p className="text-xs text-destructive">{formErrors.appointmentTime}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewDialogOpen(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Appointment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Appointment Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" title="Appointment Details">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Patient Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{selectedAppointment.patientName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.patientEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.patientPhone}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Appointment Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(selectedAppointment.appointmentDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAppointment.appointmentTime}</span>
                  </div>
                  {selectedAppointment.doctorName && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Doctor:</span>
                      <span className="ml-2">{selectedAppointment.doctorName}</span>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${getStatusColor(selectedAppointment.status)} border rounded-full px-3 py-1 text-xs font-semibold`}
                    >
                      <span className="flex items-center gap-1.5">
                        {getStatusIcon(selectedAppointment.status)}
                        {selectedAppointment.status}
                      </span>
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Payment Status:</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${
                        selectedAppointment.paymentStatus === 'half_paid' 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : selectedAppointment.paymentStatus === 'paid' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : selectedAppointment.paymentStatus === 'failed' 
                          ? 'bg-red-50 text-red-700 border-red-200' 
                          : selectedAppointment.paymentStatus === 'refunded'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      } border rounded-full px-3 py-1 text-xs font-semibold`}
                    >
                      {selectedAppointment.paymentStatus === 'half_paid' 
                        ? 'Half Paid' 
                        : selectedAppointment.paymentStatus 
                        ? selectedAppointment.paymentStatus.charAt(0).toUpperCase() + selectedAppointment.paymentStatus.slice(1) 
                        : 'Pending'}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Paid:</span>
                    <span className="ml-2">{selectedAppointment.paymentAmount != null ? `$${selectedAppointment.paymentAmount}` : '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Total Fee:</span>
                    <span className="ml-2">{selectedAppointment.consultationFee != null ? `$${selectedAppointment.consultationFee}` : '-'}</span>
                  </div>
                </div>
              </div>

              {selectedAppointment.reason && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Reason</h3>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.reason}</p>
                </div>
              )}

              {selectedAppointment.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Notes</h3>
                  <p className="text-sm text-muted-foreground">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedAppointment && selectedAppointment.status !== "Cancelled" && (
              <Select
                value={selectedAppointment.status}
                onValueChange={(value) =>
                  handleStatusChange(
                    selectedAppointment._id || selectedAppointment.id || "",
                    value as AppointmentStatus
                  )
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
