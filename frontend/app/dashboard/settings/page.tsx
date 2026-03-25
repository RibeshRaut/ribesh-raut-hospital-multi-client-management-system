"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Image as ImageIcon,
  Upload,
  X,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Link,
  Map,
} from "lucide-react";
import { hospitalAPI, APIError } from "@/lib/api";
import { validatePhone, validateEmail } from "@/lib/validation";

interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  website?: string;
}

interface HospitalData {
  name: string;
  email: string;
  phone: string;
  address: string;
  registrationNumber?: string;
  totalBeds?: number;
  emergencyDepartment?: boolean;
  description?: string;
  googleMapsUrl?: string;
  socialLinks?: SocialLinks;
  profilePicture?: string;
  images?: string[];
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [hospitalId, setHospitalId] = useState<string>("");

  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const hospitalImagesInputRef = useRef<HTMLInputElement>(null);

  const [hospitalData, setHospitalData] = useState<HospitalData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    registrationNumber: "",
    totalBeds: undefined,
    emergencyDepartment: false,
    description: "",
    googleMapsUrl: "",
    socialLinks: {
      facebook: "",
      twitter: "",
      instagram: "",
      linkedin: "",
      youtube: "",
      website: "",
    },
    profilePicture: "",
    images: [],
  });

  // Load hospital data on component mount
  useEffect(() => {
    const loadHospitalData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
        if (user.id && user.userType === "hospital_admin") {
          setHospitalId(user.id);
          try {
            const response = await hospitalAPI.getById(user.id);
            if (response.data) {
              setHospitalData((prev) => ({
                ...prev,
                ...(response.data as any),
                socialLinks: {
                  ...prev.socialLinks,
                  ...(response.data as any).socialLinks,
                },
              }));
            }
          } catch (error) {
            // Use default values if fetch fails
            console.error("Error loading hospital data:", error);
          }
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHospitalData();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const target = e.target as HTMLInputElement;

    if (type === "checkbox") {
      setHospitalData((prev) => ({
        ...prev,
        [name]: target.checked,
      }));
    } else if (name === "totalBeds") {
      setHospitalData((prev) => ({
        ...prev,
        [name]: value ? parseInt(value) : undefined,
      }));
    } else if (name.startsWith("social_")) {
      const socialKey = name.replace("social_", "") as keyof SocialLinks;
      setHospitalData((prev) => ({
        ...prev,
        socialLinks: {
          ...prev.socialLinks,
          [socialKey]: value,
        },
      }));
    } else {
      setHospitalData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    setServerError("");
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !hospitalId) return;

    setIsUploadingProfile(true);
    try {
      const response = await hospitalAPI.uploadProfilePicture(hospitalId, file);
      if (response.data?.profilePicture) {
        setHospitalData((prev) => ({
          ...prev,
          profilePicture: response.data.profilePicture,
        }));
        setSuccessMessage("Profile picture uploaded successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      if (error instanceof APIError) {
        setServerError(error.message || "Failed to upload profile picture");
      } else {
        setServerError("Failed to upload profile picture");
      }
    } finally {
      setIsUploadingProfile(false);
      if (profilePictureInputRef.current) {
        profilePictureInputRef.current.value = "";
      }
    }
  };

  const handleHospitalImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !hospitalId) return;

    setIsUploadingImages(true);
    try {
      const response = await hospitalAPI.uploadImages(hospitalId, Array.from(files));
      if (response.data?.images) {
        setHospitalData((prev) => ({
          ...prev,
          images: response.data.images,
        }));
        setSuccessMessage("Hospital images uploaded successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      if (error instanceof APIError) {
        setServerError(error.message || "Failed to upload images");
      } else {
        setServerError("Failed to upload images");
      }
    } finally {
      setIsUploadingImages(false);
      if (hospitalImagesInputRef.current) {
        hospitalImagesInputRef.current.value = "";
      }
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    if (!hospitalId) return;

    try {
      const response = await hospitalAPI.deleteImage(hospitalId, imageUrl);
      if ((response.data as any)?.images) {
        setHospitalData((prev) => ({
          ...prev,
          images: (response.data as any).images,
        }));
        setSuccessMessage("Image deleted successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (error) {
      if (error instanceof APIError) {
        setServerError(error.message || "Failed to delete image");
      } else {
        setServerError("Failed to delete image");
      }
    }
  };

  const validateForm = (): boolean => {
    const formErrors: Record<string, string> = {};

    if (!hospitalData.name.trim()) {
      formErrors.name = "Hospital name is required";
    }

    if (!validateEmail(hospitalData.email)) {
      formErrors.email = "Valid email is required";
    }

    if (!validatePhone(hospitalData.phone)) {
      formErrors.phone = "Valid phone number is required";
    }

    if (!hospitalData.address.trim()) {
      formErrors.address = "Address is required";
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setSuccessMessage("");

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
      await hospitalAPI.update(user.id, hospitalData);

      setSuccessMessage("Hospital information updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      if (error instanceof APIError) {
        setServerError(
          error.errors?.[0] || error.message || "Failed to save changes"
        );
      } else {
        setServerError("An error occurred. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Manage your hospital settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hospital Information Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Hospital Information
            </CardTitle>
            <CardDescription>
              Update your hospital details and information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-green-700">{successMessage}</p>
              </div>
            )}

            {serverError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-700">{serverError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Hospital Name *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={hospitalData.name}
                    onChange={handleChange}
                    disabled={isSaving}
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-600">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={hospitalData.email}
                    onChange={handleChange}
                    disabled={isSaving}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone *
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={hospitalData.phone}
                    onChange={handleChange}
                    disabled={isSaving}
                    className={errors.phone ? "border-red-500" : ""}
                    placeholder="+977 98XXXXXXXX"
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-600">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">
                    Registration Number
                  </Label>
                  <Input
                    id="registrationNumber"
                    name="registrationNumber"
                    value={hospitalData.registrationNumber || ""}
                    onChange={handleChange}
                    disabled={isSaving}
                    placeholder="HOS-2024-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalBeds">Total Number of Beds</Label>
                  <Input
                    id="totalBeds"
                    name="totalBeds"
                    type="number"
                    value={hospitalData.totalBeds || ""}
                    onChange={handleChange}
                    disabled={isSaving}
                    min="1"
                  />
                </div>

                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <input
                      id="emergencyDepartment"
                      name="emergencyDepartment"
                      type="checkbox"
                      checked={hospitalData.emergencyDepartment || false}
                      onChange={handleChange}
                      disabled={isSaving}
                      className="w-4 h-4 rounded"
                    />
                    <label
                      htmlFor="emergencyDepartment"
                      className="text-sm font-medium"
                    >
                      Emergency Department Available
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address *
                </Label>
                <Textarea
                  id="address"
                  name="address"
                  value={hospitalData.address}
                  onChange={handleChange}
                  disabled={isSaving}
                  className={errors.address ? "border-red-500" : ""}
                />
                {errors.address && (
                  <p className="text-xs text-red-600">{errors.address}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Hospital Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={hospitalData.description || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="Describe your hospital services, specialties, and facilities..."
                  className="min-h-32"
                />
              </div>

              {/* Google Maps URL */}
              <div className="space-y-2">
                <Label htmlFor="googleMapsUrl" className="flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Google Maps Embed URL
                </Label>
                <Input
                  id="googleMapsUrl"
                  name="googleMapsUrl"
                  value={hospitalData.googleMapsUrl || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                />
                <p className="text-xs text-muted-foreground">
                  Paste the iframe src URL from Google Maps embed code
                </p>
                {hospitalData.googleMapsUrl && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <iframe
                      src={hospitalData.googleMapsUrl}
                      width="100%"
                      height="200"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="ml-auto"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Profile Picture Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Profile Picture
            </CardTitle>
            <CardDescription>
              Upload your hospital&apos;s logo or main image
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                {hospitalData.profilePicture ? (
                  <img
                    src={hospitalData.profilePicture}
                    alt="Hospital profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={profilePictureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                  id="profilePictureInput"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploadingProfile}
                  onClick={() => profilePictureInputRef.current?.click()}
                >
                  {isUploadingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Picture
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Recommended: 400x400px, max 5MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hospital Images Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Hospital Gallery
            </CardTitle>
            <CardDescription>
              Upload images of your hospital (max 10 images)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {hospitalData.images?.map((imageUrl, index) => (
                <div
                  key={index}
                  className="relative aspect-video rounded-lg overflow-hidden border group"
                >
                  <img
                    src={imageUrl}
                    alt={`Hospital image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(imageUrl)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(!hospitalData.images || hospitalData.images.length < 10) && (
                <div
                  className="aspect-video rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-gray-50"
                  onClick={() => hospitalImagesInputRef.current?.click()}
                >
                  {isUploadingImages ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500">Add Images</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input
              ref={hospitalImagesInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleHospitalImagesUpload}
              className="hidden"
              id="hospitalImagesInput"
            />
            <p className="text-xs text-muted-foreground">
              Upload up to 10 images. Each image max 10MB.
            </p>
          </CardContent>
        </Card>

        {/* Social Links Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Social Links
            </CardTitle>
            <CardDescription>
              Add your hospital&apos;s social media profiles and website
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="social_website" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Website
                </Label>
                <Input
                  id="social_website"
                  name="social_website"
                  value={hospitalData.socialLinks?.website || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="https://www.yourhospital.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social_facebook" className="flex items-center gap-2">
                  <Facebook className="h-4 w-4" />
                  Facebook
                </Label>
                <Input
                  id="social_facebook"
                  name="social_facebook"
                  value={hospitalData.socialLinks?.facebook || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="https://facebook.com/yourhospital"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social_twitter" className="flex items-center gap-2">
                  <Twitter className="h-4 w-4" />
                  Twitter / X
                </Label>
                <Input
                  id="social_twitter"
                  name="social_twitter"
                  value={hospitalData.socialLinks?.twitter || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="https://twitter.com/yourhospital"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social_instagram" className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </Label>
                <Input
                  id="social_instagram"
                  name="social_instagram"
                  value={hospitalData.socialLinks?.instagram || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="https://instagram.com/yourhospital"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social_linkedin" className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </Label>
                <Input
                  id="social_linkedin"
                  name="social_linkedin"
                  value={hospitalData.socialLinks?.linkedin || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="https://linkedin.com/company/yourhospital"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="social_youtube" className="flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  YouTube
                </Label>
                <Input
                  id="social_youtube"
                  name="social_youtube"
                  value={hospitalData.socialLinks?.youtube || ""}
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="https://youtube.com/@yourhospital"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4 mt-4 border-t">
              <Button
                type="button"
                disabled={isSaving}
                className="ml-auto"
                onClick={handleSubmit}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Social Links
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account Card */}
        <Card className="lg:col-span-2 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your hospital account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-white">
              <div>
                <h4 className="font-medium text-red-800">
                  Delete Hospital Account
                </h4>
                <p className="text-sm text-red-600">
                  Once deleted, all hospital data will be permanently removed.
                </p>
              </div>
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent title="Are you absolutely sure?">
                  <DialogHeader>
                    <DialogDescription>
                      This action cannot be undone. This will permanently
                      delete your hospital account and all associated data.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                    <strong>Warning:</strong> All doctors, appointments, and
                    patient records will be deleted.
                  </div>
                  <div className="space-y-2">
                    <Label>Type your hospital name to confirm:</Label>
                    <Input
                      placeholder={hospitalData.name}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="flex gap-3">
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button variant="destructive">Delete Everything</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
