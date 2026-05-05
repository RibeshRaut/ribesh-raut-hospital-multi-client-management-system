"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Phone,
  Search,
  Loader2,
  AlertCircle,
  Stethoscope,
  Bed,
  Ambulance,
  ArrowRight,
  Star,
} from "lucide-react";
import { hospitalAPI } from "@/lib/api";

interface Hospital {
  _id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  email: string;
  description?: string;
  profilePicture?: string;
  specialties?: string[];
  totalBeds?: number;
  emergencyDepartment?: boolean;
}

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<Hospital[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchHospitals();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredHospitals(hospitals);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredHospitals(
        hospitals.filter(
          (h) =>
            h.name.toLowerCase().includes(query) ||
            h.address.toLowerCase().includes(query) ||
            h.specialties?.some((s) => s.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, hospitals]);

  const fetchHospitals = async () => {
    try {
      setIsLoading(true);
      const response = await hospitalAPI.getAll();
      const data = (response.data as Hospital[]) || [];
      setHospitals(data);
      setFilteredHospitals(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load hospitals"));
    } finally {
      setIsLoading(false);
    }
  };

  const getImageUrl = (image?: string) => {
    if (!image) return null;
    if (image.startsWith("http")) return image;
    return `${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3002"}${image}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-white/20 text-white border-white/30 hover:bg-white/30">
              <Building2 className="h-3 w-3 mr-1" />
              Healthcare Network
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 md:mb-6">
              Find Your
              <span className="block mt-2 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                Trusted Hospital
              </span>
            </h1>
            <p className="text-base md:text-lg text-white/80 mb-6 md:mb-8 max-w-2xl mx-auto px-4">
              Discover top-rated hospitals in our network. Compare facilities, 
              view specialties, and book appointments with ease.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto px-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search hospitals..."
                  className="pl-12 pr-4 py-5 md:py-6 text-base md:text-lg bg-white border-0 shadow-xl rounded-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-6 md:py-8 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 lg:gap-16 text-center">
            <div>
              <p className="text-2xl md:text-3xl font-bold text-primary">{hospitals.length}+</p>
              <p className="text-xs md:text-sm text-muted-foreground">Partner Hospitals</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-primary">500+</p>
              <p className="text-xs md:text-sm text-muted-foreground">Expert Doctors</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-primary">50k+</p>
              <p className="text-xs md:text-sm text-muted-foreground">Happy Patients</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-bold text-primary">24/7</p>
              <p className="text-xs md:text-sm text-muted-foreground">Emergency Care</p>
            </div>
          </div>
        </div>
      </section>

      {/* Hospitals Grid */}
      <section className="flex-1 py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading hospitals...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive font-medium">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchHospitals}>
                Try Again
              </Button>
            </div>
          ) : filteredHospitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No hospitals found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "No hospitals are available at the moment"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">
                    {searchQuery ? "Search Results" : "All Hospitals"}
                  </h2>
                  <p className="text-muted-foreground">
                    {filteredHospitals.length} hospital{filteredHospitals.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHospitals.map((hospital) => (
                  <Card
                    key={hospital._id}
                    className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white"
                  >
                    {/* Hospital Image */}
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                      {hospital.profilePicture ? (
                        <img
                          src={getImageUrl(hospital.profilePicture) || ""}
                          alt={hospital.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="h-20 w-20 text-primary/30" />
                        </div>
                      )}
                      {hospital.emergencyDepartment && (
                        <Badge className="absolute top-3 right-3 bg-red-500 text-white border-0">
                          <Ambulance className="h-3 w-3 mr-1" />
                          24/7 Emergency
                        </Badge>
                      )}
                    </div>

                    <CardContent className="p-6">
                      {/* Hospital Name & Rating */}
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {hospital.name}
                        </h3>
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="text-sm font-medium">4.8</span>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="flex items-start gap-2 text-muted-foreground mb-4">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="text-sm line-clamp-2">{hospital.address}</span>
                      </div>

                      {/* Quick Stats */}
                      <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                        {hospital.totalBeds && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Bed className="h-4 w-4" />
                            <span>{hospital.totalBeds} Beds</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Stethoscope className="h-4 w-4" />
                          <span>{hospital.specialties?.length || 0} Specialties</span>
                        </div>
                      </div>

                      {/* Specialties */}
                      {hospital.specialties && hospital.specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {hospital.specialties.slice(0, 3).map((specialty) => (
                            <Badge
                              key={specialty}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {specialty}
                            </Badge>
                          ))}
                          {hospital.specialties.length > 3 && (
                            <Badge variant="secondary" className="text-xs font-normal">
                              +{hospital.specialties.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Contact & CTA */}
                      <div className="flex items-center justify-between pt-2">
                        <a
                          href={`tel:${hospital.phone}`}
                          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                          {hospital.phone}
                        </a>
                        <Link href={`/hospital/${hospital.slug}`}>
                          <Button size="sm" className="gap-1">
                            View Details
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
