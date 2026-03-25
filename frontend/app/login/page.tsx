"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoFull } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Lock,
  ArrowRight,
  Building2,
  Users,
  Calendar,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";
import { authAPI, tokenManager, APIError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
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
    setServerError("");
    setErrors({});

    // Simple validation - just check fields are not empty
    const validationErrors: Record<string, string> = {};
    if (!formData.identifier.trim()) {
      validationErrors.identifier = "Email or username is required";
    }
    if (!formData.password) {
      validationErrors.password = "Password is required";
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await authAPI.login(formData.identifier, formData.password);
      console.log("Login response:", response);

      if (response.data && (response.data as any).token) {
        // Store token and user info
        tokenManager.setToken((response.data as any).token);
        
        const userInfo = {
          id: (response.data as any).user?.id,
          hospitalId: (response.data as any).user?.hospitalId || (response.data as any).user?.id,
          userType: (response.data as any).userType,
          ...(response.data as any).user,
        };
        console.log("Storing userInfo:", userInfo);
        localStorage.setItem("userInfo", JSON.stringify(userInfo));

        // Redirect based on user type
        console.log("Redirecting based on user type:", (response.data as any).userType);
        if ((response.data as any).userType === "website_admin") {
          router.push("/super-admin");
        } else {
          router.push("/dashboard");
        }
      } else {
        console.error("No token in response:", response);
        setServerError("Login successful but no token received. Please try again.");
      }
    } catch (error) {
      if (error instanceof APIError) {
        if (error.errors && error.errors.length > 0) {
          setServerError(error.errors[0]);
        } else {
          setServerError(error.message || "Login failed. Please try again.");
        }
      } else {
        setServerError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 bg-white">
        <div className="w-full max-w-md mx-auto">
          <Link href="/" className="inline-block mb-8">
            <LogoFull />
          </Link>

          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-8">
            Sign in to access your dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {serverError && (
              <div className="p-3 flex gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="identifier">Email or Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder="Email or username"
                  className={`pl-10 ${errors.identifier ? "border-red-500" : ""}`}
                  value={formData.identifier}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              {errors.identifier && (
                <p className="text-xs text-red-600">{errors.identifier}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-primary font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
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

            <Button type="submit" className="w-full gap-2" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <Separator className="my-8" />

          <p className="text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary font-semibold">
              Register your hospital
            </Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Info */}
      <div className="hidden lg:flex flex-1 bg-primary p-12 flex-col justify-between text-white">
        <div>
          <h2 className="text-2xl font-bold mb-2">MediCare Hub</h2>
          <p className="text-white/70">Hospital Management System</p>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-4xl font-bold mb-4">
              Manage your hospital
              <br />
              with confidence
            </h3>
            <p className="text-white/80 text-lg max-w-md">
              Join 500+ healthcare facilities using MediCare Hub to streamline
              operations and improve patient care.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white/10 rounded-xl p-4">
              <Building2 className="h-8 w-8 mb-3" />
              <p className="text-2xl font-bold">500+</p>
              <p className="text-white/70 text-sm">Hospitals</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <Users className="h-8 w-8 mb-3" />
              <p className="text-2xl font-bold">10K+</p>
              <p className="text-white/70 text-sm">Doctors</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <Calendar className="h-8 w-8 mb-3" />
              <p className="text-2xl font-bold">1M+</p>
              <p className="text-white/70 text-sm">Appointments</p>
            </div>
          </div>
        </div>

        <p className="text-white/50 text-sm">
          © 2026 MediCare Hub. All rights reserved.
        </p>
      </div>
    </div>
  );
}
