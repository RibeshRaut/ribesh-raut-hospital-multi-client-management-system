"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Stethoscope,
  Search,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  GraduationCap,
  Clock,
} from "lucide-react";
import { superAdminAPI } from "@/lib/api";

interface Doctor {
  _id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  qualification: string;
  experience: number;
  status: string;
  hospitalId: string;
  hospitalName: string;
  photo?: string;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type DoctorsResponse = {
  doctors?: Doctor[];
  pagination?: Pagination;
};

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function AllDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  useEffect(() => {
    fetchDoctors();
  }, [pagination.page, statusFilter]);

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await superAdminAPI.getAllDoctors({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        status: statusFilter === "all" ? "" : statusFilter,
        specialty: specialtyFilter,
      });

      if (response.data) {
        const data = response.data as DoctorsResponse;
        setDoctors(data.doctors || []);
        setPagination(data.pagination || pagination);
      }
    } catch (err: unknown) {
      console.error("Error fetching doctors:", err);
      setError(getErrorMessage(err, "Failed to load doctors"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchDoctors();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  if (isLoading && doctors.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading doctors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Doctors</h1>
          <p className="text-muted-foreground">
            View all doctors across all hospitals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg px-4 py-2">
            {pagination.total} Doctors
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search doctors by name, email, or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter by specialty"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="w-full md:w-48"
            />
            <Button onClick={handleSearch} className="bg-amber-500 hover:bg-amber-600">
              <Search className="h-4 w-4 mr-2" />
              Search
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
            <Button onClick={fetchDoctors} variant="outline" size="sm">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Doctors Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.length > 0 ? (
                doctors.map((doctor) => (
                  <TableRow key={doctor._id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {doctor.photo ? (
                            <AvatarImage src={doctor.photo} alt={doctor.name} />
                          ) : null}
                          <AvatarFallback className="bg-green-100 text-green-800">
                            {doctor.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{doctor.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {doctor.qualification || "N/A"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {doctor.email}
                        </p>
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {doctor.phone}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {doctor.specialty}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{doctor.hospitalName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{doctor.experience || 0} years</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          doctor.status === "Active"
                            ? "bg-green-100 text-green-800"
                            : doctor.status === "On Leave"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {doctor.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Stethoscope className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No doctors found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} doctors
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm px-4">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={pagination.page === pagination.totalPages}
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
