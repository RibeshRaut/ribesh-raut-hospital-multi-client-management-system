"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Search,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Mail,
  Phone,
  Download,
  RotateCcw,
} from "lucide-react";
import { superAdminAPI } from "@/lib/api";

// Patients are derived from appointments, so we'll use getAllAppointments
// and extract unique patients

interface Patient {
  email: string;
  name: string;
  phone: string;
  appointmentCount: number;
  lastAppointment: string;
  firstAppointment: string;
  hospitals: string[];
  hospitalIds: string[];
  locations: string[];
}

const ITEMS_PER_PAGE = 10;

const getLocationFromAddress = (address: string) => {
  if (!address) return "Unknown";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[parts.length - 2].replace(/\d+/g, "").trim() || parts[parts.length - 2];
  }

  return parts[0] || "Unknown";
};

const escapeCSV = (value: string | number) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export default function AllPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hospitalFilter, setHospitalFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [minAppointmentsFilter, setMinAppointmentsFilter] = useState("all");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    filterPatients();
  }, [
    searchQuery,
    hospitalFilter,
    locationFilter,
    minAppointmentsFilter,
    fromDateFilter,
    toDateFilter,
    patients,
  ]);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const hospitalsResponse = await superAdminAPI.getAllHospitals({ page: 1, limit: 1000 });
      const hospitalsData = (hospitalsResponse.data as any)?.hospitals || [];
      const hospitalMap = new Map<string, { name: string; address: string }>();
      hospitalsData.forEach((hospital: any) => {
        hospitalMap.set(String(hospital._id), {
          name: hospital.name || "Unknown Hospital",
          address: hospital.address || "",
        });
      });

      const allAppointments: any[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await superAdminAPI.getAllAppointments({
          page,
          limit: 500,
        });

        const data = response.data as any;
        const pageAppointments = data?.appointments || [];
        allAppointments.push(...pageAppointments);
        totalPages = data?.pagination?.totalPages || 1;
        page += 1;
      } while (page <= totalPages);

      const patientMap = new Map<string, Patient>();

      allAppointments.forEach((apt: any) => {
        const email = apt.patientEmail || "";
        const key = email || `${apt.patientName || "Unknown"}-${apt.patientPhone || ""}`;
        const hospitalId = String(apt.hospitalId || "");
        const hospitalDetails = hospitalMap.get(hospitalId);
        const hospitalName = apt.hospitalName || hospitalDetails?.name || "Unknown Hospital";
        const location = getLocationFromAddress(hospitalDetails?.address || "");

        const existing = patientMap.get(key);
        if (existing) {
          existing.appointmentCount += 1;

          if (new Date(apt.appointmentDate) > new Date(existing.lastAppointment)) {
            existing.lastAppointment = apt.appointmentDate;
          }

          if (new Date(apt.appointmentDate) < new Date(existing.firstAppointment)) {
            existing.firstAppointment = apt.appointmentDate;
          }

          if (!existing.hospitals.includes(hospitalName)) {
            existing.hospitals.push(hospitalName);
          }

          if (hospitalId && !existing.hospitalIds.includes(hospitalId)) {
            existing.hospitalIds.push(hospitalId);
          }

          if (!existing.locations.includes(location)) {
            existing.locations.push(location);
          }
        } else {
          patientMap.set(key, {
            email,
            name: apt.patientName || "N/A",
            phone: apt.patientPhone || "N/A",
            appointmentCount: 1,
            lastAppointment: apt.appointmentDate,
            firstAppointment: apt.appointmentDate,
            hospitals: [hospitalName],
            hospitalIds: hospitalId ? [hospitalId] : [],
            locations: [location],
          });
        }
      });

      setPatients(Array.from(patientMap.values()));
    } catch (err: any) {
      console.error("Error fetching patients:", err);
      setError(err.message || "Failed to load patients");
    } finally {
      setIsLoading(false);
    }
  };

  const filterPatients = () => {
    const query = searchQuery.toLowerCase();
    const filtered = patients.filter(
      (patient) => {
        const searchMatch =
          !query ||
          patient.name?.toLowerCase().includes(query) ||
          patient.email?.toLowerCase().includes(query) ||
          patient.phone?.includes(query) ||
          patient.hospitals.some((hospital) => hospital.toLowerCase().includes(query)) ||
          patient.locations.some((location) => location.toLowerCase().includes(query));

        const hospitalMatch =
          hospitalFilter === "all" || patient.hospitals.includes(hospitalFilter);

        const locationMatch =
          locationFilter === "all" || patient.locations.includes(locationFilter);

        const minAppointmentsMatch =
          minAppointmentsFilter === "all" ||
          patient.appointmentCount >= Number(minAppointmentsFilter);

        const lastAppointmentDate = new Date(patient.lastAppointment);
        const fromDateMatch =
          !fromDateFilter ||
          lastAppointmentDate >= new Date(`${fromDateFilter}T00:00:00`);
        const toDateMatch =
          !toDateFilter ||
          lastAppointmentDate <= new Date(`${toDateFilter}T23:59:59`);

        return (
          searchMatch &&
          hospitalMatch &&
          locationMatch &&
          minAppointmentsMatch &&
          fromDateMatch &&
          toDateMatch
        );
      }
    );

    setFilteredPatients(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setHospitalFilter("all");
    setLocationFilter("all");
    setMinAppointmentsFilter("all");
    setFromDateFilter("");
    setToDateFilter("");
  };

  const downloadPatientsCSV = (patientsToExport: Patient[], fileName: string) => {
    const headers = [
      "Patient Name",
      "Email",
      "Phone",
      "Appointments",
      "First Appointment",
      "Last Appointment",
      "Hospitals",
      "Locations",
    ];

    const rows = patientsToExport.map((patient) => [
      escapeCSV(patient.name || "N/A"),
      escapeCSV(patient.email || "N/A"),
      escapeCSV(patient.phone || "N/A"),
      escapeCSV(patient.appointmentCount),
      escapeCSV(new Date(patient.firstAppointment).toLocaleDateString()),
      escapeCSV(new Date(patient.lastAppointment).toLocaleDateString()),
      escapeCSV(patient.hospitals.join(" | ")),
      escapeCSV(patient.locations.join(" | ")),
    ]);

    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSinglePatientCSV = (patient: Patient) => {
    const safeName = (patient.name || "patient").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadPatientsCSV([patient], `${safeName}-record.csv`);
  };

  const hospitalOptions = Array.from(
    new Set(patients.flatMap((patient) => patient.hospitals).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const locationOptions = Array.from(
    new Set(patients.flatMap((patient) => patient.locations).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading patients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Patients</h1>
          <p className="text-muted-foreground">
            View all patients across all hospitals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-lg px-4 py-2">
            {patients.length} Patients
          </Badge>
          <Button
            variant="outline"
            onClick={() => downloadPatientsCSV(patients, "all-patients.csv")}
            disabled={patients.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Download All CSV
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 w-full">
            <div className="flex-1 min-w-0">
              <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Filter by hospital" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hospitals</SelectItem>
                  {hospitalOptions.map((hospital) => (
                    <SelectItem key={hospital} value={hospital}>
                      {hospital}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-0">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Filter by location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationOptions.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-0">
              <Select value={minAppointmentsFilter} onValueChange={setMinAppointmentsFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Minimum appointments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Visits</SelectItem>
                  <SelectItem value="1">1+ Visits</SelectItem>
                  <SelectItem value="3">3+ Visits</SelectItem>
                  <SelectItem value="5">5+ Visits</SelectItem>
                  <SelectItem value="10">10+ Visits</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patient, hospital, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 w-full"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">From</label>
              <Input
                type="date"
                value={fromDateFilter}
                onChange={(e) => setFromDateFilter(e.target.value)}
                className="h-10 w-full md:w-[220px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">To</label>
              <Input
                type="date"
                value={toDateFilter}
                onChange={(e) => setToDateFilter(e.target.value)}
                className="h-10 w-full md:w-[220px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadPatientsCSV(filteredPatients, "filtered-patients.csv")}
              disabled={filteredPatients.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Filtered CSV
            </Button>

            <Button size="sm" variant="outline" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Error</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
            <Button onClick={fetchPatients} variant="outline" size="sm">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Patients Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Appointments</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Hospitals</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead className="text-right">Export</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPatients.length > 0 ? (
                paginatedPatients.map((patient, index) => (
                  <TableRow key={patient.email || index}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-amber-100 text-amber-800">
                            {patient.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{patient.name || "N/A"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {patient.email}
                        </p>
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {patient.phone || "N/A"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {patient.appointmentCount} appointment
                        {patient.appointmentCount !== 1 ? "s" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(patient.lastAppointment).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {patient.hospitals.slice(0, 2).map((hospital, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {hospital}
                          </Badge>
                        ))}
                        {patient.hospitals.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{patient.hospitals.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {patient.locations.slice(0, 2).map((location, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {location}
                          </Badge>
                        ))}
                        {patient.locations.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{patient.locations.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadSinglePatientCSV(patient)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        CSV
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No patients found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredPatients.length)} of{" "}
            {filteredPatients.length} patients
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => prev - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm px-4">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
