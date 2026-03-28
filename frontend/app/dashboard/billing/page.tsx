"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle, CreditCard, Clock } from "lucide-react";
import { APIError, subscriptionAPI } from "@/lib/api";

type PlanType = "basic" | "professional" | "enterprise";

interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number;
  description: string;
  features: string[];
}

interface SubscriptionDetails {
  hospitalId: string;
  status: string;
  plan: string;
  effectivePlan: string;
  trialEndDate: string | null;
  trialStartDate: string | null;
  isTrialActive: boolean;
  hasAccess: boolean;
}

interface UserInfo {
  hospitalId?: string;
  id?: string;
  email?: string;
  name?: string;
}

export default function DashboardBillingPage() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [hospital, setHospital] = useState<UserInfo | null>(null);
  const [trialDays, setTrialDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);
  const [actionPlan, setActionPlan] = useState<PlanType | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const queryStatus = searchParams.get("subscription");

  useEffect(() => {
    if (queryStatus === "success") {
      setMessage("Subscription payment completed. Refreshing your subscription details.");
    }
    if (queryStatus === "cancelled") {
      setMessage("Subscription checkout was cancelled.");
    }
  }, [queryStatus]);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (typeof window === "undefined") {
        return;
      }

      const userRaw = localStorage.getItem("userInfo");
      if (!userRaw) {
        setError("User information not found. Please login again.");
        return;
      }

      const user = JSON.parse(userRaw) as UserInfo;
      const hospitalId = user.hospitalId || user.id;

      if (!hospitalId) {
        setError("Hospital information not found. Please login again.");
        return;
      }

      setHospital(user);

      const [plansResponse, detailsResponse] = await Promise.all([
        subscriptionAPI.getAvailablePlans(),
        subscriptionAPI.getSubscriptionDetails(hospitalId),
      ]);

      const fetchedPlans = (plansResponse.data as { plans?: SubscriptionPlan[]; trial?: { durationDays?: number } })?.plans || [];
      const fetchedTrialDays = (plansResponse.data as { trial?: { durationDays?: number } })?.trial?.durationDays;

      setPlans(fetchedPlans);
      if (typeof fetchedTrialDays === "number") {
        setTrialDays(fetchedTrialDays);
      }

      setSubscription(detailsResponse.data as SubscriptionDetails);
    } catch (requestError) {
      if (requestError instanceof APIError) {
        setError(requestError.message || "Failed to load billing data.");
      } else {
        setError("Failed to load billing data.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = async (planId: PlanType) => {
    if (!subscription || !hospital) {
      return;
    }

    const hospitalId = hospital.hospitalId || hospital.id;
    if (!hospitalId || !hospital.email || !hospital.name) {
      setError("Hospital profile data is incomplete for checkout. Please update settings first.");
      return;
    }

    try {
      setActionPlan(planId);
      setError(null);
      setMessage(null);

      const isPaidActive = subscription.status === "active" && subscription.plan !== "none";

      if (isPaidActive && subscription.plan !== planId) {
        await subscriptionAPI.updatePlan(hospitalId, planId);
        setMessage(`Subscription plan updated to ${planId}.`);
        await loadBillingData();
        return;
      }

      const checkout = await subscriptionAPI.createCheckoutSession({
        hospitalId,
        planType: planId,
        hospitalEmail: hospital.email,
        hospitalName: hospital.name,
      });

      const checkoutData = checkout.data as { sessionUrl?: string };
      if (checkoutData?.sessionUrl) {
        window.location.href = checkoutData.sessionUrl;
        return;
      }

      setError("Could not start checkout. Please try again.");
    } catch (requestError) {
      if (requestError instanceof APIError) {
        setError(requestError.message || "Failed to start subscription flow.");
      } else {
        setError("Failed to start subscription flow.");
      }
    } finally {
      setActionPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !hospital) {
      return;
    }

    const hospitalId = hospital.hospitalId || hospital.id;
    if (!hospitalId) {
      setError("Hospital information not found.");
      return;
    }

    try {
      setIsCancelling(true);
      setError(null);
      setMessage(null);
      await subscriptionAPI.cancelSubscription(hospitalId);
      setMessage("Subscription cancelled successfully.");
      await loadBillingData();
    } catch (requestError) {
      if (requestError instanceof APIError) {
        setError(requestError.message || "Failed to cancel subscription.");
      } else {
        setError("Failed to cancel subscription.");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const trialRemainingDays = useMemo(() => {
    if (!subscription?.trialEndDate) {
      return null;
    }

    const end = new Date(subscription.trialEndDate).getTime();
    const now = Date.now();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff;
  }, [subscription?.trialEndDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading billing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your trial and subscription plan.</p>
      </div>

      {error && (
        <Alert className="border-destructive bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Subscription
          </CardTitle>
          <CardDescription>Current access status and active plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                subscription?.status === "active"
                  ? "bg-emerald-100 text-emerald-800"
                  : subscription?.status === "trial"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-red-100 text-red-800"
              }
            >
              {(subscription?.status || "inactive").toUpperCase()}
            </Badge>
            <Badge variant="outline">Plan: {subscription?.effectivePlan || "none"}</Badge>
            <Badge variant="outline">Access: {subscription?.hasAccess ? "enabled" : "blocked"}</Badge>
          </div>

          {subscription?.isTrialActive && (
            <div className="text-sm text-blue-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {trialRemainingDays !== null && trialRemainingDays > 0
                ? `${trialRemainingDays} days left in your ${trialDays}-day free trial.`
                : "Your trial has ended."}
            </div>
          )}

          {subscription?.status === "active" && subscription?.plan !== "none" && (
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={isCancelling}>
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Subscription"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrentPaidPlan = subscription?.status === "active" && subscription?.plan === plan.id;
          const isEffectivePlan = subscription?.effectivePlan === plan.id;
          const isBusy = actionPlan === plan.id;

          return (
            <Card key={plan.id} className={isEffectivePlan ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrentPaidPlan && <Badge>Current</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
                <p className="text-2xl font-bold">
                  ${(plan.price / 100).toLocaleString()}
                  <span className="text-sm text-muted-foreground font-normal"> / month</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  disabled={isCurrentPaidPlan || isBusy}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPaidPlan ? (
                    "Current Plan"
                  ) : subscription?.status === "active" ? (
                    "Switch Plan"
                  ) : (
                    "Choose Plan"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
