import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardBillingPage from './page';
import { subscriptionAPI } from '@/lib/api';

const searchParamsMock = new URLSearchParams('subscription=success');

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    subscriptionAPI: {
      getAvailablePlans: vi.fn(),
      getSubscriptionDetails: vi.fn(),
      createCheckoutSession: vi.fn(),
      updatePlan: vi.fn(),
      cancelSubscription: vi.fn(),
    },
  };
});

const mockPlansResponse = {
  data: {
    plans: [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 2999,
        description: 'Basic',
        features: ['Feature A'],
      },
      {
        id: 'professional',
        name: 'Professional Plan',
        price: 7999,
        description: 'Pro',
        features: ['Feature B'],
      },
    ],
    trial: {
      durationDays: 30,
    },
  },
};

describe('Dashboard billing page', () => {
  const localStorageMock = {
    store: {} as Record<string, string>,
    getItem(key: string) {
      return this.store[key] ?? null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    clear() {
      this.store = {};
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();

    localStorage.setItem(
      'userInfo',
      JSON.stringify({
        id: 'hospital-1',
        hospitalId: 'hospital-1',
        email: 'hospital@example.com',
        name: 'Hospital One',
      })
    );

    vi.mocked(subscriptionAPI.getAvailablePlans).mockResolvedValue(mockPlansResponse as never);
  });

  it('loads plans/details and displays trial remaining message with success query feedback', async () => {
    vi.mocked(subscriptionAPI.getSubscriptionDetails).mockResolvedValue({
      data: {
        hospitalId: 'hospital-1',
        status: 'trial',
        plan: 'none',
        effectivePlan: 'professional',
        trialStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        trialEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        isTrialActive: true,
        hasAccess: true,
      },
    } as never);

    render(<DashboardBillingPage />);

    await waitFor(() => {
      expect(subscriptionAPI.getAvailablePlans).toHaveBeenCalledTimes(1);
      expect(subscriptionAPI.getSubscriptionDetails).toHaveBeenCalledWith('hospital-1');
    });

    expect(await screen.findByText('Billing & Subscription')).toBeInTheDocument();
    expect(screen.getByText(/Subscription payment completed/)).toBeInTheDocument();
    expect(screen.getByText(/days left in your 30-day free trial/)).toBeInTheDocument();
  });

  it('starts checkout for non-active paid subscription', async () => {
    vi.mocked(subscriptionAPI.getSubscriptionDetails).mockResolvedValue({
      data: {
        hospitalId: 'hospital-1',
        status: 'trial',
        plan: 'none',
        effectivePlan: 'professional',
        trialStartDate: null,
        trialEndDate: null,
        isTrialActive: false,
        hasAccess: true,
      },
    } as never);

    vi.mocked(subscriptionAPI.createCheckoutSession).mockResolvedValue({
      data: {},
    } as never);

    render(<DashboardBillingPage />);

    const chooseButtons = await screen.findAllByRole('button', { name: /Choose Plan/i });
    fireEvent.click(chooseButtons[0]);

    await waitFor(() => {
      expect(subscriptionAPI.createCheckoutSession).toHaveBeenCalledTimes(1);
    });
  });

  it('switches plan and supports cancellation for active paid subscription', async () => {
    vi.mocked(subscriptionAPI.getSubscriptionDetails).mockResolvedValue({
      data: {
        hospitalId: 'hospital-1',
        status: 'active',
        plan: 'basic',
        effectivePlan: 'basic',
        trialStartDate: null,
        trialEndDate: null,
        isTrialActive: false,
        hasAccess: true,
      },
    } as never);

    vi.mocked(subscriptionAPI.updatePlan).mockResolvedValue({ data: { message: 'ok' } } as never);
    vi.mocked(subscriptionAPI.cancelSubscription).mockResolvedValue({
      data: { message: 'cancelled' },
    } as never);

    render(<DashboardBillingPage />);

    const switchButton = await screen.findByRole('button', { name: 'Switch Plan' });
    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(subscriptionAPI.updatePlan).toHaveBeenCalledTimes(1);
      expect(subscriptionAPI.updatePlan).toHaveBeenCalledWith('hospital-1', 'professional');
    });

    const cancelButton = await screen.findByRole('button', { name: 'Cancel Subscription' });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(subscriptionAPI.cancelSubscription).toHaveBeenCalledTimes(1);
      expect(subscriptionAPI.cancelSubscription).toHaveBeenCalledWith('hospital-1');
    });
  });
});
