# Remaining Implementation Items (Subscription, Trial, Billing, Super Admin)

_Last reviewed: 2026-03-28_

## Scope reviewed
- Backend: subscription lifecycle, middleware gating, quota checks, Stripe webhook handlers, super-admin analytics APIs.
- Frontend: landing page pricing/trial messaging, register page messaging, billing page, super-admin dashboards.
- Quality checks: focused lint on subscription/super-admin related pages.

## P0 — Still required to fully match product requirements

- [x] **Align all public trial messaging to 1-month (30-day) trial**
  - `frontend/app/page.tsx` still says **14-day free trial** in FAQ and pricing section text.
  - `frontend/app/register/page.tsx` still says **"14-day free trial included"**.

- [x] **Align public plan names/details with actual backend subscription plans**
  - Backend plans are `basic`, `professional`, `enterprise` (in `backend/src/utils/subscriptionPlans.js`).
  - Landing page still shows `Gold`, `Platinum`, `Diamond` with different limits/pricing (`frontend/app/page.tsx`).

## P1 — Important implementation gaps (functional hardening)

- [x] **Handle subscription failure lifecycle beyond logging**
  - `invoice.payment_failed` currently logs only; no hospital status transition/notification path (`backend/src/controllers/subscription.controller.js`).

- [x] **Replace dynamic Stripe price creation on plan switch with stable plan price IDs**
  - `updateSubscriptionPlan` creates a new Stripe Price on every switch (`backend/src/controllers/subscription.controller.js`), which causes price sprawl and harder reconciliation.

- [x] **Enforce webhook signature in all environments except explicit local dev mode**
  - Current webhook path accepts unsigned events when `STRIPE_WEBHOOK_SECRET` is missing (`backend/src/controllers/payment.controller.js`).

- [x] **Remove sensitive Stripe key logging**
  - `backend/src/controllers/payment.controller.js` logs Stripe key at startup.

- [x] **Expose and consume structured subscription error codes on frontend**
  - Backend returns `402` + `code: SUBSCRIPTION_REQUIRED`, but frontend `fetchAPI` surfaces only message/status (no code-aware global handling) (`frontend/lib/api.ts`).
  - Add shared handling to redirect hospital admins to `/dashboard/billing` when blocked.

## P2 — Quality/maintainability work still pending

- [x] **Fix strict lint/type issues in super-admin and register pages**
  - Current focused lint run reports 20 errors + 15 warnings, mostly `no-explicit-any`, unused imports, and hook dependency warnings in:
    - `frontend/app/super-admin/page.tsx`
    - `frontend/app/super-admin/hospitals/page.tsx`
    - `frontend/app/super-admin/hospitals/[hospitalId]/page.tsx`
    - `frontend/app/register/page.tsx`

- [x] **Add test coverage for subscription-critical paths**
  - Missing automated tests for:
    - trial start/expiry transitions,
    - quota enforcement (doctor + monthly appointment limits),
    - Stripe webhook mapping and subscription status transitions,
    - billing checkout success/cancel flows.

## Optional polish (non-blocking)

- [x] Wire currently static CTAs (e.g., `Watch Demo`, `Schedule Demo`) to real destinations/actions in `frontend/app/page.tsx`.
- [x] Add clearer trial-to-paid transition messaging (banner/toast) across dashboard pages, not only billing page.

## Suggested implementation order
1. P0 messaging/plan consistency updates (fast, visible, requirement-critical).
2. Stripe lifecycle hardening (payment failed handling, price IDs, webhook strictness).
3. Frontend global handling for `SUBSCRIPTION_REQUIRED`.
4. Lint/type cleanup for super-admin/register pages.
5. Add automated tests for trial/subscription flows.

## Unit testing for all implemented features (add at the end)

### Backend unit tests

- [x] **Subscription plan config (`backend/src/utils/subscriptionPlans.js`)**
  - [x] returns expected plan by id (`basic`, `professional`, `enterprise`)
  - [x] returns `null`/fallback for unknown plan ids
  - [x] exposes correct limits and monthly prices per plan

- [x] **Subscription lifecycle service (`backend/src/services/subscription.service.js`)**
  - [x] creates 30-day trial window from provided start date
  - [x] marks access `true` for active paid subscriptions within end date
  - [x] marks access `true` for active trial within trial end date
  - [x] marks access `false` and reason when trial/paid both expired
  - [x] transitions to `trial` once for never-used trial hospitals
  - [x] transitions to `expired` when trial already used and no active paid plan
  - [x] builds subscription snapshot with expected revenue and flags

- [x] **Quota validators**
  - [x] `validateDoctorQuota` blocks at doctor limit and allows below limit
  - [x] `validateMonthlyAppointmentQuota` blocks at monthly limit and allows below limit
  - [x] unlimited plans (`enterprise`) bypass doctor/appointment limits

- [x] **Subscription middleware (`backend/src/middlewares/subscription.middleware.js`)**
  - [x] allows through for hospital admins with active access
  - [x] returns `402` + `SUBSCRIPTION_REQUIRED` when access is blocked
  - [x] validates by param/body hospital id paths correctly

- [x] **Subscription controller (`backend/src/controllers/subscription.controller.js`)**
  - [x] rejects invalid plan types in checkout creation
  - [x] enforces access control for non-owner hospital users
  - [x] returns subscription details with trial and effective plan data
  - [x] updates plan only when valid active Stripe subscription exists
  - [x] cancel endpoint updates status and end date as expected

- [x] **Stripe webhook handlers (`backend/src/controllers/subscription.controller.js`, `backend/src/controllers/payment.controller.js`)**
  - [x] `checkout.session.completed` (subscription mode) activates hospital plan
  - [x] `customer.subscription.created/updated/deleted` map to correct hospital updates
  - [x] `invoice.payment_succeeded` and `invoice.payment_failed` behavior verified
  - [x] payment-mode checkout completion keeps appointment flow unchanged

- [x] **Auth trial bootstrapping (`backend/src/controllers/auth.controller.js`)**
  - [x] hospital registration initializes `trial`, `trialStartDate`, `trialEndDate`, `trialUsed`

- [x] **Super-admin analytics (`backend/src/controllers/superAdmin.controller.js`)**
  - [x] returns subscription counts (`activePaid`, `trial`, `expired`) accurately
  - [x] computes monthly revenue and annual run rate from paid active plans only
  - [x] includes subscription snapshots in hospitals/recent hospital payloads

### Frontend unit tests

- [x] **API client behavior (`frontend/lib/api.ts`)**
  - [x] propagates backend `status`, `message`, and error payloads correctly
  - [x] subscription API methods call expected endpoints and HTTP methods
  - [x] handles `402` subscription-required responses consistently

- [x] **Billing page (`frontend/app/dashboard/billing/page.tsx`)**
  - [x] loads plans + subscription details on mount
  - [x] shows trial remaining days correctly (including expired edge case)
  - [x] starts checkout for non-active paid flows
  - [x] switches plan for already-active paid subscription
  - [x] handles cancellation action and success/error state rendering
  - [x] parses query params (`subscription=success|cancelled`) and shows message

- [x] **Landing/register subscription messaging**
  - [x] pricing and FAQ display correct trial duration text (30 days)
  - [x] displayed plan labels/limits are consistent with backend plans

- [x] **Super-admin pages**
  - [x] dashboard renders subscription/revenue cards from API response
  - [x] hospitals list shows subscription badge, plan, and revenue values
  - [x] hospital detail page renders subscription panel values and trial end label

### Integration-focused unit test stubs (minimum)

- [x] Create reusable fixtures for hospital states: `trial-active`, `trial-expired`, `paid-active`, `paid-expired`, `cancelled`.
- [x] Mock Stripe client and event payloads for subscription lifecycle tests.
- [x] Add request-level tests for protected endpoints to verify `402` behavior after trial expiry.

### Done criteria for this section

- [x] All tests pass in CI-ready local suites (`backend npm test`, `frontend npm test`).
- [x] Critical subscription paths have failure-path tests (invalid plan, expired trial, failed webhook mapping).
- [x] Regression test added for every bug fixed in this subscription/trial/billing scope.
