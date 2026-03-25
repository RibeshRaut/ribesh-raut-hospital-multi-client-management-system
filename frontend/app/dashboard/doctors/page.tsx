"use client";

import { useState, useEffect, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Loader2,
  Upload,
  Camera,
} from "lucide-react";
import { doctorAPI, tokenManager } from "@/lib/api";
import { validateEmail, validatePhone } from "@/lib/validation";
import { Card, CardContent } from "@/components/ui/card";

type Doctor = {
  _id?: string;
  id?: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  experience: number;
  status: "Active" | "On Leave" | "Inactive";
  photo?: string;
  qualifications?: string;
  bio?: string;
  consultationFee?: number;
  workingDays?: string[];
  workingHours?: { start: string; end: string };
  joinDate?: string;
  createdAt?: string;
};

const defaultSpecialties = [
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Dermatology",
  "Psychiatry",
  "Oncology",
  "Ophthalmology",
  "ENT",
  "General Medicine",
];

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<string[]>(defaultSpecialties);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customSpecialty, setCustomSpecialty] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    specialty: "",
    email: "",
    phone: "",
    experience: "",
    status: "Active" as Doctor["status"],
    qualifications: "",
    bio: "",
    consultationFee: "",
  });

  // Get hospitalId from localStorage
  const getHospitalId = () => {
    if (typeof window !== 'undefined') {
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        return parsed.hospitalId || parsed._id;
      }
    }
    return null;
  };

  // Fetch doctors and specialties
  const fetchData = async () => {
    const hospitalId = getHospitalId();
    if (!hospitalId) {
      setError("Hospital ID not found. Please log in again.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch doctors and specialties in parallel
      const [doctorsResponse, specialtiesResponse] = await Promise.all([
        doctorAPI.getByHospital(hospitalId),
        doctorAPI.getSpecialties(hospitalId).catch(() => ({ data: [] })),
      ]);

      setDoctors((doctorsResponse.data as Doctor[]) || []);
      
      // Merge API specialties with default specialties (unique values)
      const apiSpecialties = (specialtiesResponse.data as string[]) || [];
      const mergedSpecialties = [...new Set([...defaultSpecialties, ...apiSpecialties])].sort();
      setSpecialties(mergedSpecialties);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load doctors. Please try again later.");
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch doctors and specialties on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const refreshSpecialties = async () => {
    const hospitalId = getHospitalId();
    if (!hospitalId) return;

    try {
      const response = await doctorAPI.getSpecialties(hospitalId);
      const apiSpecialties = (response.data as string[]) || [];
      const mergedSpecialties = [...new Set([...defaultSpecialties, ...apiSpecialties])].sort();
      setSpecialties(mergedSpecialties);
    } catch (err) {
      console.error("Error refreshing specialties:", err);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.specialty.trim()) {
      errors.specialty = "Specialty is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!validateEmail(formData.email)) {
      errors.email = "Invalid email format";
    }

    if (!formData.phone.trim()) {
      errors.phone = "Phone is required";
    } else if (!validatePhone(formData.phone)) {
      errors.phone = "Invalid phone format";
    }

    if (!formData.experience) {
      errors.experience = "Experience is required";
    } else if (parseInt(formData.experience) < 0) {
      errors.experience = "Experience must be non-negative";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenDialog = (doctor?: Doctor) => {
    setMutationError(null);
    setFormErrors({});
    setSelectedPhoto(null);
    setPhotoPreview(null);

    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        name: doctor.name,
        specialty: doctor.specialty,
        email: doctor.email,
        phone: doctor.phone,
        experience: doctor.experience.toString(),
        status: doctor.status || "Active",
        qualifications: doctor.qualifications || "",
        bio: doctor.bio || "",
        consultationFee: doctor.consultationFee?.toString() || "",
      });
      // Set existing photo preview
      if (doctor.photo) {
        const photoUrl = doctor.photo.startsWith('http') 
          ? doctor.photo 
          : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3002'}${doctor.photo}`;
        setPhotoPreview(photoUrl);
      }
    } else {
      setEditingDoctor(null);
      setFormData({
        name: "",
        specialty: "",
        email: "",
        phone: "",
        experience: "",
        status: "Active",
        qualifications: "",
        bio: "",
        consultationFee: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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

      const doctorData = {
        name: formData.name,
        specialty: formData.specialty,
        email: formData.email,
        phone: formData.phone,
        experience: parseInt(formData.experience),
        status: formData.status,
        qualifications: formData.qualifications,
        bio: formData.bio,
        consultationFee: formData.consultationFee ? parseFloat(formData.consultationFee) : 0,
      };

      let savedDoctor: Doctor;

      if (editingDoctor) {
        // Update doctor
        const docId = editingDoctor._id || editingDoctor.id;
        const response = await doctorAPI.update(docId!, doctorData);
        savedDoctor = response.data as Doctor;

        // Upload photo if selected
        if (selectedPhoto && docId) {
          setIsUploadingPhoto(true);
          try {
            const photoResponse = await doctorAPI.uploadPhoto(docId, selectedPhoto);
            savedDoctor = photoResponse.data as Doctor;
          } catch (photoErr: any) {
            console.error("Photo upload failed:", photoErr);
            // Continue even if photo upload fails
          }
          setIsUploadingPhoto(false);
        }

        // Update local state
        setDoctors(
          doctors.map((d) => {
            if ((d._id || d.id) === docId) {
              return savedDoctor;
            }
            return d;
          })
        );
      } else {
        // Create doctor
        const response = await doctorAPI.create({
          ...doctorData,
          hospitalId,
        });
        savedDoctor = response.data as Doctor;

        // Upload photo if selected
        const newDocId = savedDoctor._id || savedDoctor.id;
        if (selectedPhoto && newDocId) {
          setIsUploadingPhoto(true);
          try {
            const photoResponse = await doctorAPI.uploadPhoto(newDocId, selectedPhoto);
            savedDoctor = photoResponse.data as Doctor;
          } catch (photoErr: any) {
            console.error("Photo upload failed:", photoErr);
          }
          setIsUploadingPhoto(false);
        }

        // Add to local state
        setDoctors([...doctors, savedDoctor]);
      }

      setIsDialogOpen(false);
      setFormData({
        name: "",
        specialty: "",
        email: "",
        phone: "",
        experience: "",
        status: "Active",
        qualifications: "",
        bio: "",
        consultationFee: "",
      });
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setEditingDoctor(null);
      setCustomSpecialty("");
      
      // Refresh specialties list to include newly added specialty
      refreshSpecialties();
    } catch (err: any) {
      console.error("Error saving doctor:", err);
      setMutationError(
        err.message || "Failed to save doctor. Please try again."
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoctor) return;

    try {
      setIsMutating(true);
      setMutationError(null);

      const docId = deletingDoctor._id || deletingDoctor.id;
      await doctorAPI.delete(docId!);

      // Remove from local state
      setDoctors(
        doctors.filter((d) => (d._id || d.id) !== docId)
      );
      setIsDeleteDialogOpen(false);
      setDeletingDoctor(null);
    } catch (err: any) {
      console.error("Error deleting doctor:", err);
      setMutationError(
        err.message || "Failed to delete doctor. Please try again."
      );
    } finally {
      setIsMutating(false);
    }
  };

  const getStatusBadge = (status: Doctor["status"]) => {
    const variants: Record<
      Doctor["status"],
      "default" | "secondary" | "destructive"
    > = {
      Active: "default",
      "On Leave": "secondary",
      Inactive: "destructive",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const columns: ColumnDef<Doctor>[] = [
    {
      accessorKey: "name",
      header: "Doctor",
      cell: ({ row }) => {
        const doctor = row.original;
        const initials = doctor.name
          .split(" ")
          .map((n) => n[0])
          .join("");
        const photoUrl = doctor.photo 
          ? (doctor.photo.startsWith('http') ? doctor.photo : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3002'}${doctor.photo}`)
          : undefined;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={photoUrl} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{doctor.name}</p>
              <p className="text-sm text-muted-foreground">
                {doctor.specialty}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Contact",
      cell: ({ row }) => {
        const doctor = row.original;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3 w-3 text-muted-foreground" />
              {doctor.email}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {doctor.phone}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "experience",
      header: "Experience",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.experience} years
        </span>
      ),
    },
    {
      accessorKey: "joinDate",
      header: "Join Date",
      cell: ({ row }) => {
        const joinDate = row.original.joinDate || row.original.createdAt;
        if (!joinDate) return "-";
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date(joinDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const doctor = row.original;
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
              <DropdownMenuItem onClick={() => handleOpenDialog(doctor)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  setDeletingDoctor(doctor);
                  setIsDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
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
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Manage your hospital&apos;s medical staff
            {!isLoading && doctors.length > 0 && (
              <span className="ml-2 text-muted-foreground">
                ({doctors.length} doctor{doctors.length !== 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} disabled={isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Add Doctor
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading doctors...</span>
          </div>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={doctors}
          searchKey="name"
          searchPlaceholder="Search doctors..."
        />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          title={editingDoctor ? "Edit Doctor" : "Add New Doctor"}
          className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogDescription>
              {editingDoctor
                ? "Update the doctor's information below."
                : "Fill in the details to add a new doctor."}
            </DialogDescription>
          </DialogHeader>

          {mutationError && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive rounded p-3">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{mutationError}</p>
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Full Name {formErrors.name && <span className="text-destructive text-sm">*</span>}
              </Label>
              <Input
                id="name"
                placeholder="Dr. John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={formErrors.name ? "border-destructive" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-destructive">{formErrors.name}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="specialty">
                Specialty {formErrors.specialty && <span className="text-destructive text-sm">*</span>}
              </Label>
              {customSpecialty !== null && customSpecialty !== undefined && customSpecialty !== "" ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter custom specialty"
                    value={customSpecialty}
                    onChange={(e) => {
                      setCustomSpecialty(e.target.value);
                      setFormData({ ...formData, specialty: e.target.value });
                    }}
                    className={formErrors.specialty ? "border-destructive" : ""}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomSpecialty("");
                      setFormData({ ...formData, specialty: "" });
                    }}
                  >
                    ← Back to list
                  </Button>
                </div>
              ) : (
                <Select
                  value={specialties.includes(formData.specialty) ? formData.specialty : ""}
                  onValueChange={(value) => {
                    if (value === "__custom__") {
                      setCustomSpecialty(" ");
                      setFormData({ ...formData, specialty: "" });
                    } else {
                      setFormData({ ...formData, specialty: value });
                      setCustomSpecialty("");
                    }
                  }}
                >
                  <SelectTrigger className={formErrors.specialty ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((specialty) => (
                      <SelectItem key={specialty} value={specialty}>
                        {specialty}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">+ Add Custom Specialty</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {formErrors.specialty && (
                <p className="text-xs text-destructive">{formErrors.specialty}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">
                  Email {formErrors.email && <span className="text-destructive text-sm">*</span>}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@hospital.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={formErrors.email ? "border-destructive" : ""}
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive">{formErrors.email}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">
                  Phone {formErrors.phone && <span className="text-destructive text-sm">*</span>}
                </Label>
                <Input
                  id="phone"
                  placeholder="+1 555-0100"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className={formErrors.phone ? "border-destructive" : ""}
                />
                {formErrors.phone && (
                  <p className="text-xs text-destructive">{formErrors.phone}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="experience">
                  Years of Experience {formErrors.experience && <span className="text-destructive text-sm">*</span>}
                </Label>
                <Input
                  id="experience"
                  type="number"
                  placeholder="10"
                  value={formData.experience}
                  onChange={(e) =>
                    setFormData({ ...formData, experience: e.target.value })
                  }
                  className={formErrors.experience ? "border-destructive" : ""}
                />
                {formErrors.experience && (
                  <p className="text-xs text-destructive">{formErrors.experience}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Doctor["status"]) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="grid gap-2">
              <Label>Photo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {photoPreview ? (
                    <AvatarImage src={photoPreview} />
                  ) : (
                    <AvatarFallback>
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {photoPreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Max 5MB. JPEG, PNG, or WebP.
                  </p>
                </div>
              </div>
            </div>

            {/* Qualifications */}
            <div className="grid gap-2">
              <Label htmlFor="qualifications">Qualifications</Label>
              <Input
                id="qualifications"
                placeholder="MBBS, MD, FRCP"
                value={formData.qualifications}
                onChange={(e) =>
                  setFormData({ ...formData, qualifications: e.target.value })
                }
              />
            </div>

            {/* Consultation Fee */}
            <div className="grid gap-2">
              <Label htmlFor="consultationFee">Consultation Fee ($)</Label>
              <Input
                id="consultationFee"
                type="number"
                placeholder="100"
                value={formData.consultationFee}
                onChange={(e) =>
                  setFormData({ ...formData, consultationFee: e.target.value })
                }
              />
            </div>

            {/* Bio */}
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Brief description about the doctor..."
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              disabled={isMutating || isUploadingPhoto}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isMutating || isUploadingPhoto}
            >
              {isMutating || isUploadingPhoto ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isUploadingPhoto ? "Uploading Photo..." : "Saving..."}
                </>
              ) : editingDoctor ? (
                "Save Changes"
              ) : (
                "Add Doctor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent 
          title="Delete Doctor"
          className="sm:max-w-[400px]"
        >
          <DialogHeader>
            <DialogDescription>
              Are you sure you want to delete {deletingDoctor?.name}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {mutationError && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive rounded p-3">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{mutationError}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isMutating}
            >
              {isMutating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
