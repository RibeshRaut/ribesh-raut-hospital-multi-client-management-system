"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Separator } from "@/components/ui/separator";
import {
  MoreHorizontal,
  Eye,
  FileDown,
  Download,
  Mail,
  Phone,
  Calendar,
  User,
  MapPin,
  Users,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { patientAPI, APIError } from "@/lib/api";

type Patient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastVisit: string;
  totalVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  status: "Active" | "Inactive";
};

type PatientHistoryRecord = {
  _id: string;
  appointmentDate: string;
  doctorId?: { name?: string; specialty?: string };
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientHistory, setPatientHistory] = useState<PatientHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const hospitalId = user?.hospitalId || user?._id || user?.id;

      if (!hospitalId) {
        setError("Hospital ID not found. Please log in again.");
        return;
      }

      const response = await patientAPI.getByHospital(hospitalId);
      setPatients((response.data as Patient[]) || []);
    } catch (err: unknown) {
      console.error("Error fetching patients:", err);
      setError(getErrorMessage(err, "Failed to load patients"));
    } finally {
      setIsLoading(false);
    }
  };

  const activeCount = patients.filter((p) => p.status === "Active").length;
  const inactiveCount = patients.filter((p) => p.status === "Inactive").length;

  const handleViewPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setIsDialogOpen(true);
    setPatientHistory([]);
    
    // Fetch patient history
    try {
      setIsLoadingHistory(true);
      const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const hospitalId = user?.hospitalId || user?._id || user?.id;
      
      if (hospitalId && patient.email) {
        const response = await patientAPI.getHistory(hospitalId, patient.email);
        const history = Array.isArray(response.data)
          ? (response.data as PatientHistoryRecord[])
          : [];
        setPatientHistory(history);
      }
    } catch (err: unknown) {
      console.error("Error fetching patient history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const downloadPatientPDF = (patient: Patient) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(5, 115, 236);
    doc.text("MediCare Hub", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("Patient Information Report", 105, 28, { align: "center" });

    // Patient Info
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Patient Details", 14, 45);

    doc.setFontSize(10);
    doc.setTextColor(60);

    const patientInfo = [
      ["Full Name", patient.name],
      ["Email", patient.email],
      ["Phone", patient.phone],
      ["Status", patient.status],
      ["Total Visits", patient.totalVisits.toString()],
      ["Completed Visits", patient.completedVisits?.toString() || "0"],
      ["Cancelled Visits", patient.cancelledVisits?.toString() || "0"],
      ["Last Visit", new Date(patient.lastVisit).toLocaleDateString()],
    ];

    autoTable(doc, {
      startY: 50,
      head: [["Field", "Value"]],
      body: patientInfo,
      theme: "striped",
      headStyles: { fillColor: [5, 115, 236] },
      styles: { fontSize: 10 },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Generated on ${new Date().toLocaleString()}`,
      105,
      pageHeight - 10,
      { align: "center" },
    );

    doc.save(`patient-${patient.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const downloadAllPatientsPDF = () => {
    const doc = new jsPDF("l"); // landscape

    // Header
    doc.setFontSize(20);
    doc.setTextColor(5, 115, 236);
    doc.text("MediCare Hub", 148, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("All Patients Report", 148, 28, { align: "center" });

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 148, 35, {
      align: "center",
    });

    // Table data
    const tableData = patients.map((p) => [
      p.name,
      p.email,
      p.phone,
      p.totalVisits.toString(),
      p.completedVisits?.toString() || "0",
      new Date(p.lastVisit).toLocaleDateString(),
      p.status,
    ]);

    autoTable(doc, {
      startY: 45,
      head: [
        [
          "Name",
          "Email",
          "Phone",
          "Total Visits",
          "Completed",
          "Last Visit",
          "Status",
        ],
      ],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [5, 115, 236] },
      styles: { fontSize: 9 },
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Total Patients: ${patients.length}`,
      148,
      pageHeight - 10,
      { align: "center" },
    );

    doc.save("all-patients-report.pdf");
  };

  const getStatusBadge = (status: Patient["status"]) => {
    return (
      <Badge variant={status === "Active" ? "default" : "secondary"}>
        {status}
      </Badge>
    );
  };

  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: "name",
      header: "Patient",
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{patient.name}</p>
              <p className="text-sm text-muted-foreground">{patient.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4" />
          {row.original.phone}
        </div>
      ),
    },
    {
      accessorKey: "totalVisits",
      header: "Total Visits",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.totalVisits}
        </span>
      ),
    },
    {
      accessorKey: "completedVisits",
      header: "Completed",
      cell: ({ row }) => (
        <span className="text-green-600 font-medium">
          {row.original.completedVisits || 0}
        </span>
      ),
    },
    {
      accessorKey: "lastVisit",
      header: "Last Visit",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {new Date(row.original.lastVisit).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const patient = row.original;
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
              <DropdownMenuItem onClick={() => handleViewPatient(patient)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadPatientPDF(patient)}>
                <FileDown className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading patients...</p>
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
            <p className="font-semibold text-destructive">Error Loading Patients</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
          <Button onClick={fetchPatients} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            View and manage patient records
          </p>
        </div>
        <Button onClick={downloadAllPatientsPDF} disabled={patients.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export All to PDF
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{patients.length}</p>
              <p className="text-sm text-muted-foreground">Total Patients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <UserCheck className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gray-500/10">
              <UserX className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inactiveCount}</p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={patients}
        searchKey="name"
        searchPlaceholder="Search patients..."
      />

      {/* Patient Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          title="Patient Details"
          className="sm:max-w-[600px]"
        >
          {selectedPatient && (
            <>
              <DialogHeader></DialogHeader>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        {selectedPatient.name}
                      </h3>
                      {getStatusBadge(selectedPatient.status)}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {selectedPatient.email}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedPatient.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedPatient.phone}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Last Visit:{" "}
                        {new Date(selectedPatient.lastVisit).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-secondary rounded-lg">
                    <p className="text-2xl font-bold">
                      {selectedPatient.totalVisits}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total Visits
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {selectedPatient.completedVisits || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Completed
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {selectedPatient.cancelledVisits || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cancelled
                    </p>
                  </div>
                </div>

                {/* Appointment History */}
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : patientHistory.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium">Recent Appointments</h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {patientHistory.slice(0, 5).map((apt) => (
                        <div
                          key={apt._id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {apt.doctorId?.name ? `Dr. ${apt.doctorId.name}` : "Doctor"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(apt.appointmentDate).toLocaleDateString()} - {apt.doctorId?.specialty || "N/A"}
                            </p>
                          </div>
                          <Badge
                            variant={
                              apt.status === "completed"
                                ? "default"
                                : apt.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {apt.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Close
                  </Button>
                  <Button onClick={() => downloadPatientPDF(selectedPatient)}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
