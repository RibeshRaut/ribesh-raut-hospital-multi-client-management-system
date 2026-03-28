"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Calendar } from "@/components/ui/calendar";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Stethoscope,
  Loader2,
  AlertCircle,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Globe,
  CheckCircle,
  Users,
  Bed,
  Ambulance,
  Award,
  HeartPulse,
  ChevronRight,
  GraduationCap,
  Banknote,
  X,
  ArrowRight,
  Calendar as CalendarIcon,
  Star,
  Send,
  ImageIcon,
  Play,
  Shield,
  Activity,
  CreditCard,
} from "lucide-react";
import { hospitalAPI, contactFormAPI, scheduleAPI, appointmentAPI, paymentAPI } from "@/lib/api";
import { ChatWidget } from "@/components/chat-widget";

interface Doctor {
  _id: string;
  name: string;
  specialty: string;
  photo?: string;
  photoUrl?: string;
  qualifications?: string;
  experience?: number;
  consultationFee?: number;
  bio?: string;
  email?: string;
  phone?: string;
}

interface Service {
  _id: string;
  name: string;
  description?: string;
  duration?: number;
  price?: number;
}

interface Schedule {
  _id: string;
  doctorId: Doctor;
  hospitalId: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxPatients: number;
  slotDuration: number;
  status: string;
}

interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  website?: string;
}

interface OpeningHour {
  open?: string;
  close?: string;
  isClosed?: boolean;
}

interface HospitalData {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  description?: string;
  profilePicture?: string;
  images?: string[];
  googleMapsUrl?: string;
  socialLinks?: SocialLinks;
  openingHours?: Record<string, OpeningHour>;
  specialties?: string[];
  facilities?: string[];
  totalBeds?: number;
  emergencyDepartment?: boolean;
}

export default function HospitalPublicPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;

  const [hospital, setHospital] = useState<HospitalData | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");

  // Payment status from URL
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);
  const [paymentAppointmentId, setPaymentAppointmentId] = useState<string | null>(null);

  // Booking state
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const [bookingSchedule, setBookingSchedule] = useState<Schedule | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    reason: "",
  });
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (slug) fetchHospitalData();
  }, [slug]);

  // Handle scroll to active tab sections
  useEffect(() => {
    if (activeTab === "contact") {
      setTimeout(() => {
        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    } else if (activeTab === "doctors") {
      setTimeout(() => {
        document.getElementById("doctors")?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    }
  }, [activeTab]);

  // Handle payment return from Stripe
  useEffect(() => {
    const payment = searchParams.get('payment');
    const appointmentId = searchParams.get('appointment');
    
    if (payment === 'success') {
      setPaymentStatus('success');
      setPaymentAppointmentId(appointmentId);
    } else if (payment === 'cancelled') {
      setPaymentStatus('cancelled');
      setPaymentAppointmentId(appointmentId);
    }
  }, [searchParams]);

  useEffect(() => {
    const confirmPaidAppointment = async () => {
      if (paymentStatus !== 'success' || !paymentAppointmentId) {
        return;
      }

      try {
        await paymentAPI.confirmPaidAppointment(paymentAppointmentId);
      } catch (error) {
        console.error('Failed to confirm paid appointment after redirect:', error);
      }
    };

    confirmPaidAppointment();
  }, [paymentStatus, paymentAppointmentId]);

  // Background carousel effect
  useEffect(() => {
    if (!hospital?.images || hospital.images.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % hospital.images!.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [hospital?.images]);

  const fetchHospitalData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await hospitalAPI.getBySlug(slug);
      const data = response.data as { hospital: HospitalData; doctors: Doctor[]; services: Service[] };
      if (data) {
        setHospital(data.hospital);
        setDoctors(data.doctors || []);
        setServices(data.services || []);
        if (data.hospital._id) {
          try {
            const schedulesResponse = await scheduleAPI.getPublicByHospital(data.hospital._id);
            setSchedules((schedulesResponse.data as Schedule[]) || []);
          } catch (err) {
            console.error("Error fetching schedules:", err);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load hospital");
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = (image?: string) => {
    if (!image) return null;
    if (image.startsWith("http")) return image;
    return `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3002"}${image}`;
  };

  const getDoctorPhotoUrl = (doctor: Doctor) => {
    const photo = doctor.photoUrl || doctor.photo;
    return getImageUrl(photo);
  };

  const getDoctorSchedule = (doctorId: string) => {
    return schedules.find((s) => s.doctorId._id === doctorId);
  };

  const formatTime = (time24: string) => {
    if (!time24 || !time24.includes(":")) return time24;
    const parts = time24.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return time24;
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const generateTimeSlots = (schedule: Schedule) => {
    const slots: string[] = [];
    const [startHour, startMin] = schedule.startTime.split(":").map(Number);
    const [endHour, endMin] = schedule.endTime.split(":").map(Number);
    let currentHour = startHour;
    let currentMin = startMin;
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      slots.push(`${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`);
      currentMin += schedule.slotDuration;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }
    return slots;
  };

  const isDateAvailable = (date: Date, schedule: Schedule) => {
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    return schedule.days.includes(dayName);
  };

  const handleOpenBooking = (doctor: Doctor) => {
    const schedule = getDoctorSchedule(doctor._id);
    if (schedule) {
      setBookingDoctor(doctor);
      setBookingSchedule(schedule);
      setSelectedDate(undefined);
      setSelectedTime("");
      setAvailableSlots([]);
      setBookingForm({ patientName: "", patientEmail: "", patientPhone: "", reason: "" });
      setBookingSuccess(false);
      setBookingError("");
    }
  };

  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime("");
    if (date && bookingDoctor && bookingSchedule) {
      setIsLoadingSlots(true);
      try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const response = await appointmentAPI.getAvailableSlots(bookingDoctor._id, dateStr);
        const rawSlots = response.data as any[];
        const slots =
          rawSlots && rawSlots.length > 0
            ? rawSlots.map((slot: any) => {
                if (typeof slot === "string") return slot;
                const timeValue = slot.label || slot.time;
                if (timeValue && timeValue.includes("T")) {
                  const d = new Date(timeValue);
                  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                }
                return timeValue || String(slot);
              })
            : generateTimeSlots(bookingSchedule);
        setAvailableSlots(slots);
      } catch (err) {
        setAvailableSlots(generateTimeSlots(bookingSchedule));
      } finally {
        setIsLoadingSlots(false);
      }
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor || !hospital || !selectedDate || !selectedTime) return;
    setIsBooking(true);
    setBookingError("");
    setBookingSuccess(false);
    setRedirectingToPayment(false);

    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const formattedDate = `${year}-${month}-${day}`;

      let consultationFee = bookingDoctor.consultationFee;
      if (!consultationFee || consultationFee <= 0) {
        consultationFee = 500; // Default to 500 NRS if not set
      }

      setRedirectingToPayment(true);
      const response = await paymentAPI.createCheckoutSession({
        doctorId: bookingDoctor._id,
        hospitalId: hospital._id,
        appointmentDate: formattedDate,
        appointmentTime: selectedTime,
        patientName: bookingForm.patientName,
        patientEmail: bookingForm.patientEmail,
        patientPhone: bookingForm.patientPhone,
        reason: bookingForm.reason,
        duration: bookingSchedule?.slotDuration || 30,
        // Pass the fee to backend if needed (optional, backend should always use doctor.consultationFee or default)
      });

      const data = response.data as { sessionUrl: string; sessionId: string };
      // Redirect to Stripe Checkout
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        throw new Error('Failed to create payment session');
      }
    } catch (err: any) {
      setRedirectingToPayment(false);
      setBookingError(err.message || "Failed to book appointment");
    } finally {
      setIsBooking(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospital) return;
    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess(false);
    try {
      await contactFormAPI.submit({
        ...contactForm,
        hospitalId: hospital._id,
      });
      setSubmitSuccess(true);
      setContactForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const socialIcons: Record<string, any> = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
    website: Globe,
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground text-lg">Loading hospital...</p>
        </div>
      </div>
    );
  }

  if (error || !hospital) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-10 pb-8 text-center">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Hospital Not Found</h2>
            <p className="text-muted-foreground mb-6">{error || "The hospital you're looking for doesn't exist."}</p>
            <Button asChild size="lg">
              <Link href="/hospitals">Browse Hospitals</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOpen = () => {
    if (!hospital.openingHours) return null;
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const today = days[new Date().getDay()];
    const todayHours = hospital.openingHours[today];
    if (!todayHours || todayHours.isClosed) return false;
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = (todayHours.open || "00:00").split(":").map(Number);
    const [closeH, closeM] = (todayHours.close || "00:00").split(":").map(Number);
    return currentTime >= openH * 60 + openM && currentTime <= closeH * 60 + closeM;
  };

  const openStatus = isOpen();

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[70vh] md:min-h-[85vh] flex items-center overflow-hidden">
        {/* Background Carousel */}
        <div className="absolute inset-0">
          {hospital.images && hospital.images.length > 0 ? (
            <>
              {hospital.images.map((image, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    index === currentBgIndex ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <img
                    src={getImageUrl(image) || ""}
                    alt={`${hospital.name} - ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </>
          ) : hospital.profilePicture ? (
            <img
              src={getImageUrl(hospital.profilePicture) || ""}
              alt={hospital.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          )}
          {/* Dark overlay for text visibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        </div>

        {/* Carousel Indicators */}
        {hospital.images && hospital.images.length > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {hospital.images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBgIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentBgIndex
                    ? "bg-white w-8"
                    : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}

        <div className="container mx-auto px-4 py-12 md:py-16 lg:py-24 relative z-10">
          <div className="max-w-3xl">
            {/* Content */}
            <div className="text-white">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 md:mb-6">
                {hospital.emergencyDepartment && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30 backdrop-blur-sm text-xs md:text-sm">
                    <Ambulance className="h-3 w-3 mr-1" />
                    24/7 Emergency
                  </Badge>
                )}
                {openStatus !== null && (
                  <Badge className={`backdrop-blur-sm text-xs md:text-sm ${openStatus ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${openStatus ? "bg-emerald-400" : "bg-amber-400"}`} />
                    {openStatus ? "Open Now" : "Closed"}
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 md:mb-4 leading-tight">
                {hospital.name}
              </h1>

              <p className="text-base md:text-lg text-white/70 mb-4 md:mb-6 max-w-xl">
                {hospital.description || "Your trusted healthcare partner providing quality medical services with compassion and expertise."}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-6 md:mb-8">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white w-full sm:w-auto" onClick={() => setActiveTab("doctors")}>
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Book Appointment
                </Button>
                <Button size="lg" variant="outline" className="border-white/30 text-black hover:bg-white/10 w-full sm:w-auto" onClick={() => setActiveTab("contact")}>
                  <Phone className="h-5 w-5 mr-2" />
                  Contact Us
                </Button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-4 border border-white/20">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-white mb-1 md:mb-2" />
                  <p className="text-xl md:text-2xl font-bold text-white">{doctors.length}</p>
                  <p className="text-xs md:text-sm text-white/70">Doctors</p>
                </div>
                {hospital.totalBeds && (
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-4 border border-white/20">
                    <Bed className="h-5 w-5 md:h-6 md:w-6 text-white mb-1 md:mb-2" />
                    <p className="text-xl md:text-2xl font-bold text-white">{hospital.totalBeds}</p>
                    <p className="text-xs md:text-sm text-white/70">Beds</p>
                  </div>
                )}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-4 border border-white/20">
                  <Activity className="h-5 w-5 md:h-6 md:w-6 text-white mb-1 md:mb-2" />
                  <p className="text-xl md:text-2xl font-bold text-white">{services.length}</p>
                  <p className="text-xs md:text-sm text-white/70">Services</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 md:p-4 border border-white/20">
                  <Award className="h-5 w-5 md:h-6 md:w-6 text-white mb-1 md:mb-2" />
                  <p className="text-xl md:text-2xl font-bold text-white">{hospital.specialties?.length || 0}</p>
                  <p className="text-xs md:text-sm text-white/70">Specialties</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Contact Info Bar */}
      <section className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 md:gap-6 w-full sm:w-auto">
              <a href={`tel:${hospital.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                <Phone className="h-4 w-4 text-primary" />
                {hospital.phone}
              </a>
              <a href={`mailto:${hospital.email}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                <Mail className="h-4 w-4 text-primary" />
                <span className="truncate max-w-[200px]">{hospital.email}</span>
              </a>
              <span className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate max-w-[300px]">{hospital.address}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hospital.socialLinks &&
                Object.entries(hospital.socialLinks).map(([key, url]) => {
                  if (!url) return null;
                  const Icon = socialIcons[key];
                  return (
                    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content with Tabs */}
      <section className="py-8 md:py-12 bg-secondary/30">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 md:space-y-8">
            <TabsList className="bg-white border shadow-sm p-1 h-auto flex flex-wrap justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="doctors" className="data-[state=active]:bg-primary data-[state=active]:text-white px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm whitespace-nowrap">Doctors</TabsTrigger>
              <TabsTrigger value="services" className="data-[state=active]:bg-primary data-[state=active]:text-white px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm whitespace-nowrap">Services</TabsTrigger>
              <TabsTrigger value="gallery" className="data-[state=active]:bg-primary data-[state=active]:text-white px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm whitespace-nowrap">Gallery</TabsTrigger>
              <TabsTrigger value="contact" className="data-[state=active]:bg-primary data-[state=active]:text-white px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm whitespace-nowrap">Contact</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-8">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* About */}
                <Card className="lg:col-span-2 border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      About Us
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed mb-6">
                      {hospital.description || "Welcome to our hospital. We are committed to providing exceptional healthcare services with compassion, expertise, and cutting-edge technology. Our team of dedicated professionals works tirelessly to ensure the best possible outcomes for our patients."}
                    </p>

                    {/* Specialties */}
                    {hospital.specialties && hospital.specialties.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary" />
                          Our Specialties
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {hospital.specialties.map((specialty) => (
                            <Badge key={specialty} variant="secondary" className="px-3 py-1.5">{specialty}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Facilities */}
                    {hospital.facilities && hospital.facilities.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          Facilities & Amenities
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {hospital.facilities.map((facility) => (
                            <div key={facility} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                              {facility}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Opening Hours */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Opening Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hospital.openingHours ? (
                      <div className="space-y-2">
                        {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => {
                          const hours = hospital.openingHours?.[day];
                          const isToday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date().getDay()] === day;
                          return (
                            <div key={day} className={`flex justify-between items-center py-2 px-3 rounded-lg ${isToday ? "bg-primary/10" : ""}`}>
                              <span className={`capitalize ${isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}>{day}</span>
                              <span className={`${hours?.isClosed ? "text-red-500" : ""} ${isToday ? "font-semibold" : ""}`}>
                                {hours?.isClosed ? "Closed" : hours?.open && hours?.close ? `${formatTime(hours.open)} - ${formatTime(hours.close)}` : "Not Set"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Hours not available</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Featured Doctors Preview */}
              {doctors.length > 0 && (
                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Our Doctors
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => document.querySelector('[data-value="doctors"]')?.dispatchEvent(new Event("click", { bubbles: true }))}>
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {doctors.slice(0, 4).map((doctor) => (
                        <div key={doctor._id} className="group text-center p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                          <Avatar className="h-20 w-20 mx-auto mb-3 ring-4 ring-white shadow-lg">
                            <AvatarImage src={getDoctorPhotoUrl(doctor) || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xl">{doctor.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                          </Avatar>
                          <h4 className="font-semibold">{doctor.name}</h4>
                          <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                          <Button size="sm" className="mt-3" onClick={() => handleOpenBooking(doctor)} disabled={!getDoctorSchedule(doctor._id)}>
                            Book Now
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Doctors Tab */}
            <TabsContent value="doctors" id="doctors" className="space-y-6">
              {doctors.length === 0 ? (
                <Card className="border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Doctors Available</h3>
                    <p className="text-muted-foreground">Doctor information will be available soon.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {doctors.map((doctor) => {
                    const schedule = getDoctorSchedule(doctor._id);
                    return (
                      <Card key={doctor._id} className="border-0 shadow-lg hover:shadow-xl transition-shadow overflow-hidden group">
                        <div className="h-2 bg-gradient-to-r from-primary to-cyan-500" />
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-16 w-16 ring-4 ring-primary/10">
                              <AvatarImage src={getDoctorPhotoUrl(doctor) || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-lg">{doctor.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg truncate">{doctor.name}</h3>
                              <p className="text-primary font-medium">{doctor.specialty}</p>
                              {doctor.experience && <p className="text-sm text-muted-foreground">{doctor.experience} years experience</p>}
                            </div>
                          </div>

                          {doctor.qualifications && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                              <GraduationCap className="h-4 w-4 flex-shrink-0" />
                              <span className="truncate">{doctor.qualifications}</span>
                            </div>
                          )}

                          {schedule && (
                            <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                              <div className="flex items-center gap-2 text-sm mb-1">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="font-medium">Available</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{schedule.days.join(", ")}</p>
                              <p className="text-xs text-muted-foreground">{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</p>
                            </div>
                          )}

                          <div className="mt-4 flex gap-2">
                            <Button className="flex-1" onClick={() => handleOpenBooking(doctor)} disabled={!schedule}>
                              <CalendarIcon className="h-4 w-4 mr-2" />
                              {schedule ? "Book Appointment" : "Not Available"}
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setSelectedDoctor(doctor)}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>

                          {doctor.consultationFee && (
                            <p className="mt-3 text-center text-sm">
                              <span className="text-muted-foreground">Consultation Fee: </span>
                              <span className="font-semibold text-primary">Rs. {doctor.consultationFee}</span>
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-6">
              {services.length === 0 ? (
                <Card className="border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <Activity className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Services Listed</h3>
                    <p className="text-muted-foreground">Service information will be available soon.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.map((service) => (
                    <Card key={service._id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                      <CardContent className="pt-6">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                          <HeartPulse className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-bold text-lg mb-2">{service.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{service.description || "Quality healthcare service provided by our expert team."}</p>
                        <div className="flex items-center justify-between pt-4 border-t">
                          {service.duration && (
                            <span className="text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 inline mr-1" />
                              {service.duration} min
                            </span>
                          )}
                          {service.price && (
                            <span className="font-semibold text-primary">Rs. {service.price}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Gallery Tab */}
            <TabsContent value="gallery" className="space-y-6">
              {!hospital.images || hospital.images.length === 0 ? (
                <Card className="border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <ImageIcon className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Images Available</h3>
                    <p className="text-muted-foreground">Gallery images will be added soon.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {hospital.images.map((image, index) => (
                    <button key={index} onClick={() => setSelectedImage(getImageUrl(image))} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={getImageUrl(image) || ""} alt={`Gallery ${index + 1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Contact Tab */}
            <TabsContent value="contact" id="contact" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-8 items-stretch">
                {/* Contact Form */}
                <Card className="border-0 shadow-lg flex flex-col">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5 text-primary" />
                      Send us a Message
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <form onSubmit={handleContactSubmit} className="flex flex-col flex-1 gap-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input id="name" placeholder="John Doe" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" placeholder="john@example.com" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} required className="h-11" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input id="phone" placeholder="+977 98XXXXXXXX" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject</Label>
                          <Input id="subject" placeholder="Inquiry about..." value={contactForm.subject} onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })} required className="h-11" />
                        </div>
                      </div>
                      <div className="space-y-2 flex-1 flex flex-col">
                        <Label htmlFor="message">Message</Label>
                        <Textarea id="message" placeholder="Your message..." value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} required className="flex-1 min-h-[120px] resize-none" />
                      </div>
                      {submitSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Message sent successfully!
                        </div>
                      )}
                      {submitError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          {submitError}
                        </div>
                      )}
                      <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Send Message
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Map & Info */}
                <div className="flex flex-col gap-6">
                  <Card className="border-0 shadow-lg flex-1">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Location
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {hospital.googleMapsUrl ? (
                        <div className="h-[200px] rounded-xl overflow-hidden">
                          <iframe src={hospital.googleMapsUrl.replace("/maps?q=", "/maps/embed?pb=").replace("maps.google.com", "www.google.com/maps/embed")} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                        </div>
                      ) : (
                        <div className="h-[200px] rounded-xl bg-secondary flex items-center justify-center">
                          <div className="text-center">
                            <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-muted-foreground">{hospital.address}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <a href={`tel:${hospital.phone}`} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Phone className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">Call Us</p>
                            <p className="font-semibold truncate">{hospital.phone}</p>
                          </div>
                        </a>
                        <a href={`mailto:${hospital.email}`} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
                          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Mail className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">Email Us</p>
                            <p className="font-semibold truncate">{hospital.email}</p>
                          </div>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Doctor Profile Dialog */}
      <Dialog open={!!selectedDoctor} onOpenChange={() => setSelectedDoctor(null)}>
        <DialogContent 
          title="Doctor Profile"
          className="sm:max-w-lg"
        >
          {selectedDoctor && (
            <>
              <DialogHeader></DialogHeader>
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 ring-4 ring-primary/10 mb-4">
                  <AvatarImage src={getDoctorPhotoUrl(selectedDoctor) || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">{selectedDoctor.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-bold">{selectedDoctor.name}</h3>
                <p className="text-primary font-medium">{selectedDoctor.specialty}</p>
                {selectedDoctor.qualifications && <p className="text-sm text-muted-foreground mt-1">{selectedDoctor.qualifications}</p>}
              </div>
              {selectedDoctor.bio && <p className="text-muted-foreground text-sm mt-4">{selectedDoctor.bio}</p>}
              <div className="grid grid-cols-2 gap-4 mt-4">
                {selectedDoctor.experience && (
                  <div className="p-3 bg-secondary rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">{selectedDoctor.experience}</p>
                    <p className="text-xs text-muted-foreground">Years Exp.</p>
                  </div>
                )}
                {selectedDoctor.consultationFee && (
                  <div className="p-3 bg-secondary rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary">Rs. {selectedDoctor.consultationFee}</p>
                    <p className="text-xs text-muted-foreground">Consultation</p>
                  </div>
                )}
              </div>
              <Button className="w-full mt-4" onClick={() => { setSelectedDoctor(null); handleOpenBooking(selectedDoctor); }} disabled={!getDoctorSchedule(selectedDoctor._id)}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Book Appointment
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent 
          title="Image Preview"
          hideTitle={true}
          showCloseButton={false}
          className="sm:max-w-4xl p-0 bg-black/95 border-none"
        >
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-6 w-6 text-white" />
          </button>
          {selectedImage && <img src={selectedImage} alt="Gallery" className="w-full h-full object-contain max-h-[80vh]" />}
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={!!bookingDoctor} onOpenChange={() => setBookingDoctor(null)}>
        <DialogContent 
          title="Book Appointment"
          className="sm:max-w-xl max-h-[90vh] overflow-y-auto"
        >
          {bookingDoctor && bookingSchedule && (
            <>
              <DialogHeader>
                <DialogDescription>Schedule your visit with {bookingDoctor.name}</DialogDescription>
              </DialogHeader>

              {bookingSuccess ? (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Booking Confirmed!</h3>
                  <p className="text-muted-foreground">We'll send you a confirmation email shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleBookingSubmit} className="space-y-6">
                  {/* Date Selection */}
                  <div className="space-y-2">
                    <Label>Select Date</Label>
                    <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} disabled={(date) => date < new Date() || !isDateAvailable(date, bookingSchedule)} className="rounded-lg border mx-auto" />
                  </div>

                  {/* Time Selection */}
                  {selectedDate && (
                    <div className="space-y-2">
                      <Label>Select Time</Label>
                      {isLoadingSlots ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                      ) : availableSlots.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                          {availableSlots.map((slot, i) => (
                            <Button key={i} type="button" variant={selectedTime === slot ? "default" : "outline"} size="sm" onClick={() => setSelectedTime(slot)} className="text-sm">
                              {formatTime(slot)}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No slots available</p>
                      )}
                    </div>
                  )}

                  {/* Patient Info */}
                  {selectedDate && selectedTime && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="font-medium">Your Information</h4>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input value={bookingForm.patientName} onChange={(e) => setBookingForm({ ...bookingForm, patientName: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input type="email" value={bookingForm.patientEmail} onChange={(e) => setBookingForm({ ...bookingForm, patientEmail: e.target.value })} required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Phone *</Label>
                          <Input value={bookingForm.patientPhone} onChange={(e) => setBookingForm({ ...bookingForm, patientPhone: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Reason for Visit</Label>
                          <Textarea value={bookingForm.reason} onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })} rows={2} />
                        </div>
                      </div>

                      {/* Payment Summary */}
                      {bookingDoctor.consultationFee && bookingDoctor.consultationFee > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Payment Summary
                            </h4>
                            <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Consultation Fee</span>
                                <span>Rs. {bookingDoctor.consultationFee}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Advance Payment (50%)</span>
                                <span className="font-semibold text-primary">Rs. {Math.round(bookingDoctor.consultationFee / 2)}</span>
                              </div>
                              <div className="flex justify-between text-sm pt-2 border-t">
                                <span className="text-muted-foreground">Remaining (Pay at Clinic)</span>
                                <span>Rs. {bookingDoctor.consultationFee - Math.round(bookingDoctor.consultationFee / 2)}</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              You'll be redirected to a secure payment page to complete the advance payment.
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {bookingError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {bookingError}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={!selectedDate || !selectedTime || !bookingForm.patientName || !bookingForm.patientEmail || !bookingForm.patientPhone || isBooking || redirectingToPayment}>
                    {isBooking || redirectingToPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {redirectingToPayment ? "Redirecting to Payment..." : "Processing..."}
                      </>
                    ) : (
                      <>
                        {bookingDoctor.consultationFee && bookingDoctor.consultationFee > 0 ? (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pay Rs. {Math.round(bookingDoctor.consultationFee / 2)} & Book
                          </>
                        ) : (
                          <>
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Confirm Booking
                          </>
                        )}
                      </>
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Status Dialog */}
      <Dialog open={!!paymentStatus} onOpenChange={() => setPaymentStatus(null)}>
        <DialogContent 
          title={paymentStatus === 'success' ? 'Payment Successful!' : 'Payment Cancelled'}
          className="sm:max-w-md"
        >
          {paymentStatus === 'success' ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-muted-foreground mb-4">
                Your appointment has been confirmed. You will receive a confirmation email shortly.
              </p>
              <Button onClick={() => setPaymentStatus(null)} className="w-full">
                Continue
              </Button>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
              <p className="text-muted-foreground mb-4">
                Your payment was cancelled. You can try booking again.
              </p>
              <Button onClick={() => setPaymentStatus(null)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Chat Widget */}
      {hospital && (
        <ChatWidget
          hospitalId={hospital._id}
          hospitalName={hospital.name}
        />
      )}
    </>
  );
}
