import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Marquee } from "@/components/ui/marquee";
import { ContactForm } from "@/components/contact-form";
import {
  Calendar,
  Users,
  BarChart3,
  Shield,
  Clock,
  MessageSquare,
  Building2,
  Stethoscope,
  FileText,
  CreditCard,
  HeartPulse,
  CheckCircle2,
  XCircle,
  Star,
  ArrowRight,
  Play,
  Zap,
  Globe,
  Lock,
  Headphones,
  Quote,
  Award,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Smart Appointment Scheduling",
    description:
      "Intelligent booking system with automated reminders, conflict detection, and patient self-scheduling capabilities.",
  },
  {
    icon: Users,
    title: "Doctor Management",
    description:
      "Complete physician profiles with specializations, qualifications, availability, and consultation fees.",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description:
      "Real-time dashboards with insights on patient flow, revenue, and operational efficiency.",
  },
  {
    icon: Shield,
    title: "HIPAA Compliant",
    description:
      "Enterprise-grade security with end-to-end encryption and compliance with healthcare regulations.",
  },
  {
    icon: MessageSquare,
    title: "AI-Powered Chatbot",
    description:
      "24/7 patient support with intelligent chatbot for appointment booking and general inquiries.",
  },
  {
    icon: FileText,
    title: "Digital Records",
    description:
      "Paperless patient records with secure cloud storage and instant access from anywhere.",
  },
];

const stats = [
  { value: "500+", label: "Hospitals", icon: Building2 },
  { value: "10,000+", label: "Doctors", icon: Stethoscope },
  { value: "1M+", label: "Appointments", icon: Calendar },
  { value: "99.9%", label: "Uptime", icon: Zap },
];

const pricingPlans = [
  {
    name: "Basic",
    price: "$29.99",
    period: "/month",
    description: "Perfect for small clinics",
    icon: "🩺",
    color: "border-t-yellow-500",
    features: [
      "Up to 5 doctors",
      "Up to 500 appointments / month",
      "Basic analytics",
      "Email support",
    ],
    limitations: ["No 24/7 dedicated support"],
    cta: "Start Free Trial",
    href: "/register",
    popular: false,
  },
  {
    name: "Professional",
    price: "$79.99",
    period: "/month",
    description: "For growing hospitals",
    icon: "💎",
    color: "border-t-slate-400",
    features: [
      "Up to 25 doctors",
      "Up to 2500 appointments / month",
      "Advanced analytics",
      "Priority support",
    ],
    limitations: ["No 24/7 dedicated support"],
    cta: "Start Free Trial",
    href: "/register",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$199.99",
    period: "/month",
    description: "For large healthcare networks",
    icon: "👑",
    color: "border-t-cyan-400",
    features: [
      "Unlimited doctors",
      "Unlimited appointments",
      "Full analytics",
      "24/7 support",
    ],
    limitations: [],
    cta: "Start Free Trial",
    href: "/register",
    popular: false,
  },
];

const testimonials = [
  {
    name: "Dr. Sarah Johnson",
    role: "Chief Medical Officer",
    hospital: "Metro General Hospital",
    content:
      "MediCare Hub has transformed how we manage our 200+ bed facility. The appointment system alone has reduced no-shows by 40%.",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Michael Chen",
    role: "Hospital Administrator",
    hospital: "Pacific Health Center",
    content:
      "The multi-tenant architecture allows us to manage 5 locations from a single dashboard. Incredible efficiency gains.",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Dr. Emily Rodriguez",
    role: "Practice Manager",
    hospital: "Sunrise Medical Clinic",
    content:
      "Setup was incredibly smooth. Within a week, our entire staff was fully onboarded and productive.",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Dr. James Williams",
    role: "Department Head",
    hospital: "Central City Hospital",
    content:
      "The analytics dashboard gives us insights we never had before. We've optimized our scheduling and increased patient satisfaction.",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Lisa Thompson",
    role: "Operations Director",
    hospital: "Valley Medical Group",
    content:
      "Customer support is exceptional. Any issue we've had was resolved within hours. Highly recommend!",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
  },
  {
    name: "Dr. Robert Kim",
    role: "Chief of Staff",
    hospital: "Northside Healthcare",
    content:
      "We've tried other solutions but MediCare Hub is by far the most intuitive and comprehensive platform we've used.",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=100&h=100&fit=crop&crop=face",
  },
];

const faqs = [
  {
    question: "How long does it take to set up MediCare Hub?",
    answer:
      "Most hospitals are fully operational within 1-2 weeks. Our dedicated onboarding team handles data migration, staff training, and system configuration.",
  },
  {
    question: "Is MediCare Hub HIPAA compliant?",
    answer:
      "Yes, we are fully HIPAA compliant with enterprise-grade security, end-to-end encryption, and regular third-party security audits.",
  },
  {
    question: "Can I integrate with existing hospital systems?",
    answer:
      "Absolutely! We offer comprehensive API access and pre-built integrations with popular EHR/EMR systems, payment processors, and lab systems.",
  },
  {
    question: "What kind of support do you offer?",
    answer:
      "We provide email support for Basic, priority support for Professional, and 24/7 support for Enterprise hospitals.",
  },
  {
    question: "Can I customize the platform for my hospital?",
    answer:
      "Yes, Professional and Enterprise plans include custom branding, workflows, and the ability to add custom fields and forms.",
  },
  {
    question: "Is there a free trial available?",
    answer:
      "Yes, we offer a 30-day free trial with full access to Professional plan features. No credit card required.",
  },
];

const services = [
  {
    icon: Calendar,
    title: "Appointment Booking",
    description: "Online scheduling with automated reminders",
  },
  {
    icon: Stethoscope,
    title: "Doctor Profiles",
    description: "Comprehensive physician management",
  },
  {
    icon: HeartPulse,
    title: "Patient Care",
    description: "Complete patient record management",
  },
  {
    icon: MessageSquare,
    title: "AI Assistant",
    description: "24/7 chatbot for patient queries",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Real-time insights and reporting",
  },
  {
    icon: CreditCard,
    title: "Billing",
    description: "Integrated payment processing",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Register Your Hospital",
    description:
      "Create your account with basic hospital information and verify your credentials.",
  },
  {
    step: "02",
    title: "Configure Your System",
    description:
      "Set up departments, add doctors, configure appointment slots and pricing.",
  },
  {
    step: "03",
    title: "Onboard Your Team",
    description:
      "Invite staff members and assign roles with appropriate access levels.",
  },
  {
    step: "04",
    title: "Go Live",
    description:
      "Start accepting appointments and managing your hospital efficiently.",
  },
];

const clients = [
  "Mayo Clinic",
  "Cleveland Clinic",
  "Johns Hopkins",
  "Mass General",
  "Stanford Health",
  "UCSF Medical",
  "Mount Sinai",
  "NYU Langone",
  "Duke Health",
  "Northwestern",
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Section 1: Hero */}
        <section className="py-16 md:py-24 bg-white relative overflow-hidden">
          <div className="absolute inset-0 pattern-grid opacity-50" />
          <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="mb-4 gap-1.5">
                  <Award className="h-3.5 w-3.5" />
                  #1 Hospital Management Platform
                </Badge>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  Modern Hospital
                  <br />
                  Management
                  <br />
                  <span className="text-primary">Made Simple</span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                  Streamline your healthcare operations with our comprehensive
                  multi-tenant management system. Manage appointments, doctors,
                  patients, and billing from a single powerful dashboard.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/register">
                    <Button size="lg" className="gap-2">
                      Start Free Trial
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="#features">
                    <Button variant="outline" size="lg" className="gap-2">
                      <Play className="h-4 w-4" />
                      Watch Demo
                    </Button>
                  </Link>
                </div>
                <div className="mt-8 flex items-center gap-6">
                  <div className="flex -space-x-2">
                    {[
                      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=40&h=40&fit=crop&crop=face",
                      "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=40&h=40&fit=crop&crop=face",
                      "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=40&h=40&fit=crop&crop=face",
                      "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=40&h=40&fit=crop&crop=face",
                    ].map((src, i) => (
                      <Avatar key={i} className="border-2 border-white w-9 h-9">
                        <AvatarImage src={src} alt="Customer" />
                        <AvatarFallback className="bg-primary text-white text-sm">
                          U
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Trusted by 500+ hospitals
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="bg-secondary rounded-2xl p-6 md:p-8">
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold">Today&apos;s Overview</h3>
                      <Badge variant="secondary">Live</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-secondary rounded-lg p-4">
                        <p className="text-2xl font-bold text-primary">48</p>
                        <p className="text-sm text-muted-foreground">
                          Appointments
                        </p>
                      </div>
                      <div className="bg-secondary rounded-lg p-4">
                        <p className="text-2xl font-bold text-primary">12</p>
                        <p className="text-sm text-muted-foreground">
                          Doctors Active
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        "Dr. Sarah - Cardiology",
                        "Dr. Chen - Neurology",
                        "Dr. Brown - Orthopedics",
                      ].map((doc, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        >
                          <span className="text-sm">{doc}</span>
                          <Badge variant="outline" className="text-xs">
                            Available
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Clients Marquee */}
        <section className="py-10 bg-secondary border-y border-border">
          <div className="container mx-auto px-4 md:px-8 max-w-7xl">
            <p className="text-center text-sm text-muted-foreground mb-6">
              Trusted by leading healthcare institutions worldwide
            </p>
            <Marquee pauseOnHover speed="slow">
              {clients.map((client) => (
                <div
                  key={client}
                  className="mx-8 text-xl font-semibold text-muted-foreground/60"
                >
                  {client}
                </div>
              ))}
            </Marquee>
          </div>
        </section>

        {/* Section 3: Stats */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-8 max-w-7xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <stat.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                  <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Services Grid */}
        <section className="py-16 md:py-20 bg-secondary relative overflow-hidden">
          <div className="absolute inset-0 pattern-cross" />
          <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
            <div className="text-center mb-12">
              <Badge className="mb-4">Our Services</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything You Need to Run Your Hospital
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A complete suite of tools designed specifically for healthcare
                facilities of all sizes.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
              {services.map((service) => (
                <Card key={service.title} className="text-center bg-white">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <service.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{service.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Features */}
        <section
          id="features"
          className="py-16 md:py-20 bg-white relative overflow-hidden"
        >
          <div className="absolute inset-0 pattern-dots opacity-30" />
          <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
            <div className="text-center mb-12">
              <Badge className="mb-4">Features</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Powerful Features for Modern Healthcare
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Built with the latest technology to help you deliver better
                patient care.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-white">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Section 6: How It Works */}
        <section className="py-16 md:py-20 bg-secondary">
          <div className="container mx-auto px-4 md:px-8 max-w-7xl">
            <div className="text-center mb-12">
              <Badge className="mb-4">How It Works</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Get Started in 4 Simple Steps
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From signup to going live in less than a week.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {workflowSteps.map((step) => (
                <Card
                  key={step.step}
                  className="bg-white border-t-4 border-t-primary"
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <span className="text-xl font-bold text-primary">
                        {step.step}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Section 7: Feature Tabs */}
        <section className="py-16 md:py-20 bg-white relative overflow-hidden">
          <div className="absolute inset-0 pattern-grid opacity-30" />
          <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
            <div className="text-center mb-12">
              <Badge className="mb-4">Platform Overview</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Explore Our Platform
              </h2>
            </div>
            <Tabs defaultValue="appointments" className="max-w-4xl mx-auto">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="appointments" className="text-xs md:text-sm">Appointments</TabsTrigger>
                <TabsTrigger value="doctors" className="text-xs md:text-sm">Doctors</TabsTrigger>
                <TabsTrigger value="patients" className="text-xs md:text-sm">Patients</TabsTrigger>
                <TabsTrigger value="analytics" className="text-xs md:text-sm">Analytics</TabsTrigger>
              </TabsList>
              <TabsContent value="appointments" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Smart Appointment Management</CardTitle>
                    <CardDescription>
                      Streamline your scheduling with intelligent booking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        "Online patient self-scheduling",
                        "Automated SMS & email reminders",
                        "Doctor availability management",
                        "Conflict detection & resolution",
                        "Waitlist management",
                        "Recurring appointment support",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="doctors" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Complete Doctor Management</CardTitle>
                    <CardDescription>
                      Manage your entire medical staff from one place
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        "Detailed physician profiles",
                        "Specialty & qualification tracking",
                        "Schedule & availability management",
                        "Performance analytics",
                        "Consultation fee management",
                        "Patient assignment",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="patients" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Patient Care Excellence</CardTitle>
                    <CardDescription>
                      Comprehensive patient record management
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        "Complete medical history",
                        "Digital health records",
                        "Appointment history tracking",
                        "Patient portal access",
                        "Secure messaging",
                        "Prescription management",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="analytics" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Powerful Analytics Dashboard</CardTitle>
                    <CardDescription>
                      Data-driven insights for better decisions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        "Real-time dashboard",
                        "Revenue & billing reports",
                        "Patient flow analytics",
                        "Doctor performance metrics",
                        "Custom report builder",
                        "Export to PDF/Excel",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Section 8: Why Choose Us */}
        <section className="py-16 md:py-20 bg-secondary">
          <div className="container mx-auto px-4 md:px-8 max-w-7xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="mb-4">Why MediCare</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Built for Healthcare, Trusted by Hospitals
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">
                        Multi-Tenant Architecture
                      </h3>
                      <p className="text-muted-foreground">
                        Manage multiple hospital locations from a single
                        dashboard with isolated data.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">
                        Enterprise Security
                      </h3>
                      <p className="text-muted-foreground">
                        HIPAA compliant with end-to-end encryption and regular
                        security audits.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">99.9% Uptime SLA</h3>
                      <p className="text-muted-foreground">
                        Reliable infrastructure ensuring your hospital is always
                        operational.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Headphones className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Dedicated Support</h3>
                      <p className="text-muted-foreground">
                        24/7 support team ready to help you succeed with our
                        platform.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card className="text-center p-4 md:p-6 bg-white">
                  <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">
                    40%
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Reduction in no-shows
                  </p>
                </Card>
                <Card className="text-center p-4 md:p-6 bg-white">
                  <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">
                    60%
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Faster check-in times
                  </p>
                </Card>
                <Card className="text-center p-4 md:p-6 bg-white">
                  <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">
                    3x
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Staff productivity increase
                  </p>
                </Card>
                <Card className="text-center p-4 md:p-6 bg-white">
                  <div className="text-3xl md:text-4xl font-bold text-green-600 mb-2">
                    50%
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Less administrative work
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Section 9: Testimonials Slider */}
        <section
          id="testimonials"
          className="py-16 md:py-20 bg-white relative overflow-hidden"
        >
          <div className="absolute inset-0 pattern-dots opacity-20" />
          <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
            <div className="text-center mb-12">
              <Badge className="mb-4">Testimonials</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                What Our Customers Say
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Hear from healthcare professionals who transformed their
                operations with MediCare.
              </p>
            </div>
          </div>

          {/* Testimonials Infinite Slider */}
          <Marquee pauseOnHover speed="slow" className="py-4">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="w-[350px] mx-4 shrink-0 bg-white">
                <CardContent className="pt-6">
                  <Quote className="h-8 w-8 text-primary/20 mb-4" />
                  <p className="text-muted-foreground mb-6">
                    &quot;{testimonial.content}&quot;
                  </p>
                  <Separator className="mb-4" />
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={testimonial.image}
                        alt={testimonial.name}
                      />
                      <AvatarFallback className="bg-primary text-white">
                        {testimonial.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </Marquee>

          <Marquee pauseOnHover speed="slow" direction="right" className="py-4">
            {[...testimonials].reverse().map((testimonial, index) => (
              <Card key={index} className="w-[350px] mx-4 shrink-0 bg-white">
                <CardContent className="pt-6">
                  <Quote className="h-8 w-8 text-primary/20 mb-4" />
                  <p className="text-muted-foreground mb-6">
                    &quot;{testimonial.content}&quot;
                  </p>
                  <Separator className="mb-4" />
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={testimonial.image}
                        alt={testimonial.name}
                      />
                      <AvatarFallback className="bg-primary text-white">
                        {testimonial.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </Marquee>
        </section>

        {/* Section 10: Pricing */}
        <section
          id="pricing"
          className="py-16 md:py-20 bg-secondary relative overflow-hidden"
        >
          <div className="absolute inset-0 pattern-cross" />
          <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
            <div className="text-center mb-12">
              <Badge className="mb-4 font-fredoka">Pricing</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 font-fredoka">
                Simple, Transparent Pricing
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Choose the plan that fits your hospital. All plans include a
                30-day free trial.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto items-stretch">
              {pricingPlans.map((plan) => (
                <Card
                  key={plan.name}
                  className={`bg-white flex flex-col ${plan.popular ? "border-primary border-2 relative" : ""}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 font-fredoka">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="font-fredoka text-xl">
                      {plan.name}
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold font-fredoka">
                        {plan.price}
                      </span>
                      <span className="text-muted-foreground">
                        {plan.period}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        What&apos;s included
                      </p>
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {plan.limitations.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            Limitations
                          </p>
                          <ul className="space-y-2 mb-6">
                            {plan.limitations.map((limitation) => (
                              <li
                                key={limitation}
                                className="flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                <span className="text-sm text-muted-foreground">
                                  {limitation}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    <Link href={plan.href} className="mt-auto">
                      <Button
                        className="w-full font-fredoka"
                        variant={plan.popular ? "default" : "outline"}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Section 11: FAQ */}
        <section id="faq" className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4 md:px-8 max-w-7xl">
            <div className="text-center mb-12">
              <Badge className="mb-4">FAQ</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Find answers to common questions about MediCare.
              </p>
            </div>
            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Section 12: Contact Form */}
        <section
          id="contact"
          className="py-16 md:py-20 bg-secondary relative overflow-hidden"
        >
          <div className="absolute inset-0 pattern-grid opacity-50" />
          <div className="container mx-auto px-4 md:px-8 max-w-7xl relative">
            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <Badge className="mb-4">Contact Us</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Get in Touch
                </h2>
                <p className="text-muted-foreground mb-8">
                  Have questions? Our team is here to help. Fill out the form
                  and we&apos;ll get back to you within 24 hours.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Headphones className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">24/7 Support</p>
                      <p className="text-muted-foreground">+1 (555) 000-0000</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Email Us</p>
                      <p className="text-muted-foreground">
                        support@medicarehub.com
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA moved here */}
                <div className="mt-12 p-6 bg-primary rounded-xl text-white">
                  <h3 className="text-xl font-bold mb-2">
                    Ready to Transform Your Hospital?
                  </h3>
                  <p className="text-white/80 mb-4 text-sm">
                    Join 500+ hospitals already using MediCare to streamline
                    their operations.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/register">
                      <Button variant="secondary" size="sm" className="gap-2">
                        Start Free Trial
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="#contact">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-transparent border-white text-white"
                      >
                        Schedule Demo
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
