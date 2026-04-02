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
  const sessionId = searchParams.get("session");

  const trialRemainingDays = useMemo(() => {
    if (!subscription?.trialEndDate) {
      return null;
    }

    const end = new Date(subscription.trialEndDate).getTime();
    const now = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }, [subscription?.trialEndDate]);

  const planById = useMemo(() => {
    return plans.reduce<Record<string, SubscriptionPlan>>((acc, plan) => {
      acc[plan.id] = plan;
      return acc;
    }, {});
  }, [plans]);

  const currentPlanPriceLabel = useMemo(() => {
    if (!subscription?.effectivePlan || subscription.effectivePlan === "none") {
      return "$0/mo";
    }

    const activePlan = planById[subscription.effectivePlan];
    if (!activePlan) {
      return "$0/mo";
    }

    if (subscription.isTrialActive) {
      return "$0/mo (trial)";
    }

    return `$${(activePlan.price / 100).toLocaleString()}/mo`;
  }, [planById, subscription]);

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

      const fetchedPlans =
        (plansResponse.data as { plans?: SubscriptionPlan[]; trial?: { durationDays?: number } })?.plans || [];
      const fetchedTrialDays =
        (plansResponse.data as { trial?: { durationDays?: number } })?.trial?.durationDays;

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

  const refreshSubscriptionDetails = async (
    expected?: {
      statuses?: string[];
      plan?: string;
    }
  ) => {
    if (!hospital) return;

    const hospitalId = hospital.hospitalId || hospital.id;
    if (!hospitalId) return;

    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await subscriptionAPI.getSubscriptionDetails(hospitalId);
        const latest = response.data as SubscriptionDetails;
        setSubscription(latest);

        const statusMatches = expected?.statuses?.length
          ? expected.statuses.includes(latest.status)
          : true;
        const planMatches = expected?.plan ? latest.plan === expected.plan : true;

        if (statusMatches && planMatches) {
          return;
        }
      } catch {
        // retry
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  };

  useEffect(() => {
    if (queryStatus === "success") {
      setMessage("Subscription payment completed. Refreshing your subscription details.");
    }
    if (queryStatus === "required") {
      setMessage("Subscription required. Complete checkout to unlock this feature.");
    }
    if (queryStatus === "cancelled") {
      setMessage("Subscription checkout was cancelled.");
    }
  }, [queryStatus]);

  useEffect(() => {
    if (!hospital) {
      return;
    }

    if (queryStatus !== "success" && queryStatus !== "required") {
      return;
    }

    const pendingSessionId =
      typeof window !== "undefined" ? localStorage.getItem("pendingSubscriptionSessionId") : null;
    const checkoutSessionId = sessionId || pendingSessionId;

    if (!checkoutSessionId) {
      return;
    }

    let isCancelled = false;

    const confirmCheckout = async () => {
      try {
        await subscriptionAPI.confirmCheckoutSession(checkoutSessionId);
        if (!isCancelled) {
          setMessage("Subscription payment completed. Plan updated successfully.");
          await refreshSubscriptionDetails({ statuses: ["active"] });
          if (typeof window !== "undefined") {
            localStorage.removeItem("pendingSubscriptionSessionId");
          }
        }
      } catch (requestError) {
        if (!isCancelled) {
          if (requestError instanceof APIError) {
            setError(requestError.message || "Failed to confirm subscription checkout.");
          } else {
            setError("Failed to confirm subscription checkout.");
          }
        }
      }
    };

    confirmCheckout();

    return () => {
      isCancelled = true;
    };
  }, [queryStatus, sessionId, hospital]);

  useEffect(() => {
    loadBillingData();
  }, []);

  useEffect(() => {
    if (queryStatus !== "success") {
      return;
    }

    let isCancelled = false;
    let attempts = 0;
    const maxAttempts = 12;

    const pollForUpdatedSubscription = async () => {
      if (isCancelled) return;

      attempts += 1;

      if (hospital) {
        try {
          const hospitalId = hospital.hospitalId || hospital.id;
          if (hospitalId) {
            const latest = await subscriptionAPI.getSubscriptionDetails(hospitalId);
            const latestData = latest.data as SubscriptionDetails;
            setSubscription(latestData);

            if (latestData.status === "active" && latestData.plan !== "none") {
              setMessage("Subscription is active. Plan updated successfully.");
              return;
            }
          }
        } catch {
          // continue polling
        }
      }

      if (attempts < maxAttempts && !isCancelled) {
        setTimeout(pollForUpdatedSubscription, 2500);
      }
    };

    pollForUpdatedSubscription();

    return () => {
      isCancelled = true;
    };
  }, [queryStatus, hospital]);

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

      // Check if they have an actual paid plan (not trial, not "none")
      const hasPaidPlan = subscription.plan && subscription.plan !== "none";

      if (hasPaidPlan && subscription.plan !== planId) {
        const updateResponse = await subscriptionAPI.updatePlan(hospitalId, planId);
        const updateData = updateResponse.data as {
          sessionUrl?: string;
          sessionId?: string;
          requiresCheckout?: boolean;
          message?: string;
        };

        if (updateData?.requiresCheckout && updateData?.sessionUrl) {
          setMessage("Redirecting to Stripe Checkout...");
          if (typeof window !== "undefined" && updateData.sessionId) {
            localStorage.setItem("pendingSubscriptionSessionId", updateData.sessionId);
          }
          const sessionUrl = updateData.sessionUrl;
          setTimeout(() => {
            window.location.href = sessionUrl;
          }, 500);
          return;
        }

        setMessage(`Subscription plan switched to ${planId}.`);
        await refreshSubscriptionDetails({ statuses: ["active"], plan: planId });
        await loadBillingData();
        return;
      }

      const checkout = await subscriptionAPI.createCheckoutSession({
        hospitalId,
        planType: planId,
        hospitalEmail: hospital.email,
        hospitalName: hospital.name,
      });

      const checkoutData = checkout.data as { sessionUrl?: string; sessionId?: string };
      if (checkoutData?.sessionUrl) {
        if (typeof window !== "undefined" && checkoutData.sessionId) {
          localStorage.setItem("pendingSubscriptionSessionId", checkoutData.sessionId);
        }
        window.location.href = checkoutData.sessionUrl;
        return;
      }

      setError("Could not start checkout. Please try again.");
    } catch (requestError) {
      if (requestError instanceof APIError) {
        setError(requestError.message || "Failed to update subscription. Please try again.");
      } else {
        setError("Failed to update subscription. Please try again.");
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

      if (subscription.isTrialActive) {
        setMessage("Trial cancelled. You can purchase any plan now.");
        await refreshSubscriptionDetails({ statuses: ["expired", "cancelled", "inactive"] });
      } else {
        setMessage("Subscription cancelled successfully.");
        await refreshSubscriptionDetails({ statuses: ["cancelled", "expired", "inactive"] });
      }

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

  const displayStatus =
    subscription?.status === "expired" || subscription?.status === "cancelled"
      ? "inactive"
      : subscription?.status || "inactive";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your trial, upgrades, and monthly plans.</p>
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
          <CardDescription>Current access status, plan, and billing summary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                displayStatus === "active"
                  ? "bg-emerald-100 text-emerald-800"
                  : displayStatus === "trial"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-red-100 text-red-800"
              }
            >
              {displayStatus.toUpperCase()}
            </Badge>
            <Badge variant="outline">Plan: {subscription?.effectivePlan || "none"}</Badge>
            <Badge variant="outline">Access: {subscription?.hasAccess ? "enabled" : "blocked"}</Badge>
            <Badge variant="outline">Price: {currentPlanPriceLabel}</Badge>
          </div>

          {subscription?.isTrialActive && (
            <div className="text-sm text-blue-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {trialRemainingDays !== null && trialRemainingDays > 0
                ? `${trialRemainingDays} days left in your ${trialDays}-day free trial.`
                : "Your trial has ended."}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {subscription?.isTrialActive && (
              <Button variant="outline" onClick={handleCancelSubscription} disabled={isCancelling}>
                {isCancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling Trial...
                  </>
                ) : (
                  "Cancel Trial"
                )}
              </Button>
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

            {subscription?.status !== "active" && subscription?.plan !== "none" && !subscription?.isTrialActive && (
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrentPaidPlan = subscription?.status === "active" && subscription?.plan === plan.id;
          const isCurrentTrialPlan = Boolean(subscription?.isTrialActive && subscription?.effectivePlan === plan.id);
          const isPaidActive = subscription?.plan && subscription?.plan !== "none";
          const isBusy = actionPlan === plan.id;

          const monthlyPrice = `$${(plan.price / 100).toLocaleString()}`;
          const showTrialPrice = isCurrentTrialPlan;

          let actionLabel = "Choose Plan";
          if (isCurrentPaidPlan) {
            actionLabel = "Current Plan";
          } else if (isCurrentTrialPlan) {
            actionLabel = "On Trial";
          } else if (isPaidActive) {
            actionLabel = `Switch to ${plan.name}`;
          } else if (subscription?.isTrialActive) {
            actionLabel = `Upgrade to ${plan.name}`;
          }

          const disableAction = isCurrentPaidPlan || isCurrentTrialPlan || isBusy || isCancelling;

          return (
            <Card
              key={plan.id}
              className={
                isCurrentPaidPlan || isCurrentTrialPlan
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border/60 bg-card shadow-sm"
              }
            >
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{plan.description}</CardDescription>
                  </div>
                  {isCurrentPaidPlan && <Badge>Current</Badge>}
                  {isCurrentTrialPlan && <Badge variant="outline">Current Trial</Badge>}
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <p className="text-3xl font-bold tracking-tight">
                    {showTrialPrice ? "$0" : monthlyPrice}
                    <span className="text-sm text-muted-foreground font-normal"> / month</span>
                  </p>
                  {showTrialPrice ? (
                    <p className="text-xs text-muted-foreground mt-1">Then {monthlyPrice}/month after trial ends</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Billed monthly</p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="text-sm space-y-2 text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button className="w-full" disabled={disableAction} onClick={() => handleSelectPlan(plan.id)}>
                  {isBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    actionLabel
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
