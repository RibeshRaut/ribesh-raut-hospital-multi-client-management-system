"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoFull } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Lock,
  ArrowRight,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { authAPI, tokenManager, APIError } from "@/lib/api";
import { 
  validateName, 
  validateEmail, 
  validatePhone, 
  validatePassword,
  formatValidationErrors 
} from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    setServerError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError("");

    // Validate form
    const fieldErrors: Record<string, string[]> = {};

    const nameErrors = validateName(formData.name);
    if (nameErrors.length > 0) fieldErrors.name = nameErrors;

    if (!validateEmail(formData.email)) {
      fieldErrors.email = ["Invalid email address"];
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      fieldErrors.phone = ["Invalid phone number format (e.g., +977 9824558987 or 9824558987)"];
    }

    if (!formData.address || formData.address.trim().length === 0) {
      fieldErrors.address = ["Address is required"];
    }

    const passwordErrors = validatePassword(formData.password);
    if (passwordErrors.length > 0) {
      fieldErrors.password = passwordErrors;
    }

    if (formData.password !== formData.confirmPassword) {
      fieldErrors.confirmPassword = ["Passwords do not match"];
    }

    if (!agreed) {
      fieldErrors.terms = ["You must agree to the terms and conditions"];
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(formatValidationErrors(fieldErrors));
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.registerHospitalAdmin({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
      });

      if (response.data) {
        // Store token and user info
        tokenManager.setToken((response.data as any).token);
        localStorage.setItem(
          "userInfo",
          JSON.stringify({
            id: (response.data as any).user.id,
            hospitalId: (response.data as any).user.id,
            userType: (response.data as any).userType,
            ...(response.data as any).user,
          })
        );

        // Redirect to dashboard
        router.push("/dashboard");
      }
    } catch (error) {
      if (error instanceof APIError) {
        if (error.errors && error.errors.length > 0) {
          setServerError(error.errors[0]);
        } else {
          setServerError(error.message || "Registration failed. Please try again.");
        }
      } else {
        setServerError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    "14-day free trial included",
    "No credit card required",
    "Full access to all features",
    "24/7 customer support",
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Info */}
      <div className="hidden lg:flex flex-1 bg-primary p-12 flex-col justify-between text-white">
        <div>
          <Link href="/">
            <LogoFull variant="white" />
          </Link>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-4xl font-bold mb-4">
              Start managing your
              <br />
              hospital today
            </h3>
            <p className="text-white/80 text-lg max-w-md">
              Create your account in minutes and transform how you manage
              appointments, doctors, and patients.
            </p>
          </div>

          <div className="space-y-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-white/90">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/50 text-sm">
          © 2026 MediCare Hub. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-white overflow-y-auto">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden mb-8">
            <Link href="/">
              <LogoFull />
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-2">Create your account</h1>
          <p className="text-muted-foreground mb-8">
            Register your hospital to get started
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {serverError && (
              <div className="p-3 flex gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Hospital Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="City General Hospital"
                  className={`pl-10 ${errors.name ? "border-red-500" : ""}`}
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@hospital.com"
                    className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+977 9xxxxxxxxx"
                    className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-600">{errors.phone}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address"
                  name="address"
                  type="text"
                  placeholder="123 Medical Center Drive, City"
                  className={`pl-10 ${errors.address ? "border-red-500" : ""}`}
                  value={formData.address}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              {errors.address && (
                <p className="text-xs text-red-600">{errors.address}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    className={`pl-10 ${errors.password ? "border-red-500" : ""}`}
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm password"
                    className={`pl-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-600">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={(checked: boolean) => setAgreed(checked)}
                disabled={isLoading}
              />
              <label
                htmlFor="terms"
                className={`text-sm leading-tight ${
                  errors.terms ? "text-red-600" : "text-muted-foreground"
                }`}
              >
                I agree to the{" "}
                <Link href="#" className="text-primary font-medium">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="text-primary font-medium">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {errors.terms && (
              <p className="text-xs text-red-600">{errors.terms}</p>
            )}

            <Button type="submit" className="w-full gap-2" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
