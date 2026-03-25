"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { hospitalAPI, APIError } from "@/lib/api";
import { validatePhone, validateEmail, validateName } from "@/lib/validation";

interface HospitalData {
  name: string;
  email: string;
  phone: string;
  address: string;
  registrationNumber?: string;
  totalBeds?: number;
  emergencyDepartment?: boolean;
  description?: string;
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  fields: string[];
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 1,
    title: "Basic Information",
    description: "Tell us about your hospital",
    fields: ["name", "email", "phone"],
  },
  {
    id: 2,
    title: "Hospital Details",
    description: "Additional hospital information",
    fields: ["address", "registrationNumber", "totalBeds"],
  },
  {
    id: 3,
    title: "Services",
    description: "What services does your hospital provide?",
    fields: ["description", "emergencyDepartment"],
  },
];

export default function HospitalOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  const [formData, setFormData] = useState<HospitalData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    registrationNumber: "",
    totalBeds: undefined,
    emergencyDepartment: false,
    description: "",
  });

  // Load existing hospital data if available
  useEffect(() => {
    const loadHospitalData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
        if (user.userType === "hospital_admin") {
          // Try to fetch existing hospital data
          try {
            const response = await hospitalAPI.getProfile();
            if (response.data) {
              setFormData((prev) => ({
                ...prev,
                ...(response.data as any),
              }));
            }
          } catch (error) {
            // New hospital admin, no existing data
          }
        }
      } catch (error) {
        console.error("Error loading hospital data:", error);
      } finally {
        setIsLoadingInitial(false);
      }
    };

    loadHospitalData();
  }, []);

  const validateStep = (stepId: number): boolean => {
    const step = onboardingSteps.find((s) => s.id === stepId);
    if (!step) return false;

    const stepErrors: Record<string, string> = {};

    if (step.id === 1) {
      if (!formData.name.trim()) {
        stepErrors.name = "Hospital name is required";
      } else if (formData.name.length < 2) {
        stepErrors.name = "Hospital name must be at least 2 characters";
      }

      if (!validateEmail(formData.email)) {
        stepErrors.email = "Valid email is required";
      }

      if (!validatePhone(formData.phone)) {
        stepErrors.phone = "Valid phone number is required (format: +977 98XXXXXXXX)";
      }
    }

    if (step.id === 2) {
      if (!formData.address.trim()) {
        stepErrors.address = "Address is required";
      }

      if (formData.totalBeds !== undefined && formData.totalBeds < 1) {
        stepErrors.totalBeds = "Number of beds must be at least 1";
      }
    }

    if (step.id === 3) {
      if (!formData.description?.trim()) {
        stepErrors.description = "Hospital description is required";
      } else if ((formData.description || "").length < 10) {
        stepErrors.description = "Description must be at least 10 characters";
      }
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const target = e.target as HTMLInputElement;

    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: target.checked,
      }));
    } else if (name === "totalBeds") {
      setFormData((prev) => ({
        ...prev,
        [name]: value ? parseInt(value) : undefined,
      }));
    } else {
      setFormData((prev) => ({
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

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < onboardingSteps.length) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsLoading(true);
    setServerError("");

    try {
      const user = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const response = await hospitalAPI.update(user.id, formData);

      setSuccessMessage("Hospital profile updated successfully!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (error) {
      if (error instanceof APIError) {
        setServerError(
          error.errors?.[0] || error.message || "Failed to save hospital data"
        );
      } else {
        setServerError("An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingInitial) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading hospital information...</p>
        </div>
      </div>
    );
  }

  const step = onboardingSteps.find((s) => s.id === currentStep);
  const isLastStep = currentStep === onboardingSteps.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Complete Your Hospital Profile
          </h1>
          <p className="text-gray-600 mt-2">
            Step {currentStep} of {onboardingSteps.length}
          </p>
        </div>

        {/* Progress Indicators */}
        <div className="flex gap-2 mb-8">
          {onboardingSteps.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  s.id < currentStep
                    ? "bg-green-500 text-white"
                    : s.id === currentStep
                    ? "bg-blue-500 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {s.id < currentStep ? <CheckCircle2 className="h-5 w-5" /> : s.id}
              </div>
              {idx < onboardingSteps.length - 1 && (
                <div
                  className={`w-12 h-1 ${
                    s.id < currentStep ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {step?.title}
            </CardTitle>
            <CardDescription>{step?.description}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-green-700">{successMessage}</p>
              </div>
            )}

            {serverError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-700">{serverError}</p>
              </div>
            )}

            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Hospital Name *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="City General Hospital"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-600">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="contact@hospital.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="+977 9812345678"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-600">{errors.phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Hospital Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address *
                  </Label>
                  <Textarea
                    id="address"
                    name="address"
                    placeholder="123 Medical Center Drive, City, State"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.address ? "border-red-500" : ""}
                  />
                  {errors.address && (
                    <p className="text-xs text-red-600">{errors.address}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">
                    Hospital Registration Number
                  </Label>
                  <Input
                    id="registrationNumber"
                    name="registrationNumber"
                    placeholder="HOS-2024-001"
                    value={formData.registrationNumber || ""}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalBeds">Total Number of Beds</Label>
                  <Input
                    id="totalBeds"
                    name="totalBeds"
                    type="number"
                    placeholder="100"
                    value={formData.totalBeds || ""}
                    onChange={handleChange}
                    disabled={isLoading}
                    min="1"
                    className={errors.totalBeds ? "border-red-500" : ""}
                  />
                  {errors.totalBeds && (
                    <p className="text-xs text-red-600">{errors.totalBeds}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="emergencyDepartment"
                    name="emergencyDepartment"
                    type="checkbox"
                    checked={formData.emergencyDepartment || false}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="emergencyDepartment" className="text-sm">
                    We have an Emergency Department
                  </label>
                </div>
              </div>
            )}

            {/* Step 3: Services */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Hospital Description *</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe your hospital services, specialties, and what makes it special..."
                    value={formData.description || ""}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={`min-h-32 ${
                      errors.description ? "border-red-500" : ""
                    }`}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-600">
                      {errors.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {formData.description?.length || 0}/500 characters
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> Write a compelling description of your
                    hospital. Mention your specialties, facilities, and what
                    patients should know about your services.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1 || isLoading}
              >
                Previous
              </Button>

              <Button
                onClick={handleNext}
                disabled={isLoading}
                className="ml-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {isLastStep ? "Saving..." : "Next..."}
                  </>
                ) : (
                  isLastStep ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete Setup
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress Text */}
        <div className="mt-4 text-center text-sm text-gray-600">
          {currentStep === onboardingSteps.length ? (
            <p>Complete your profile to finish setup</p>
          ) : (
            <p>Step {currentStep} of {onboardingSteps.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}
