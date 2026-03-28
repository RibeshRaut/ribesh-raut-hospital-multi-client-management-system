import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import SuperAdminDashboard from './page';
import HospitalsPage from './hospitals/page';
import HospitalDetailsPage from './hospitals/[hospitalId]/page';
import { getPlatformSettings, superAdminAPI } from '@/lib/api';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({
    hospitalId: 'hospital-1',
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getPlatformSettings: vi.fn(),
    superAdminAPI: {
      getStats: vi.fn(),
      getAllHospitals: vi.fn(),
      getHospitalDetails: vi.fn(),
      deleteHospital: vi.fn(),
    },
  };
});

describe('Super-admin pages subscription/revenue rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('dashboard renders subscription and revenue cards from API response', async () => {
    vi.mocked(superAdminAPI.getStats).mockResolvedValue({
      data: {
        statistics: {
          subscriptions: { activePaid: 3, trial: 2, expired: 1 },
          revenue: { monthly: 299.99 },
          hospitals: { total: 10, withProfile: 8, growth: 5 },
          doctors: { total: 50, thisMonth: 4, growth: 2 },
          appointments: {
            total: 100,
            pending: 10,
            confirmed: 20,
            completed: 60,
            cancelled: 10,
            today: 5,
            thisWeek: 22,
          },
          patients: { total: 200 },
          contactForms: { total: 12, unread: 3 },
        },
        recentHospitals: [],
        topHospitals: [],
        recentAppointments: [],
      },
    } as never);

    vi.mocked(getPlatformSettings).mockResolvedValue({ maintenanceMode: false } as never);

    render(<SuperAdminDashboard />);

    expect(await screen.findByText('Active Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Trial Hospitals')).toBeInTheDocument();
    expect(screen.getByText('Expired Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('$299.99')).toBeInTheDocument();
  });

  it('hospitals list shows subscription status, plan and revenue values', async () => {
    vi.mocked(superAdminAPI.getAllHospitals).mockResolvedValue({
      data: {
        hospitals: [
          {
            _id: 'hospital-1',
            name: 'City Hospital',
            email: 'city@example.com',
            phone: '123',
            address: 'Main St',
            isProfileComplete: true,
            createdAt: new Date().toISOString(),
            stats: { doctors: 3, appointments: 20, services: 5 },
            subscription: {
              status: 'active',
              currentPlan: 'professional',
              estimatedMonthlyRevenue: 79.99,
            },
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    } as never);

    render(<HospitalsPage />);

    expect(await screen.findByText('Hospital Management')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Plan: professional')).toBeInTheDocument();
    expect(screen.getByText('Revenue: $79.99/mo')).toBeInTheDocument();
  });

  it('hospital detail renders subscription panel including trial end label', async () => {
    vi.mocked(superAdminAPI.getHospitalDetails).mockResolvedValue({
      data: {
        hospital: {
          name: 'City Hospital',
          email: 'city@example.com',
          phone: '123',
          address: 'Main St',
          emergencyDepartment: true,
          subscription: {
            status: 'trial',
            currentPlan: null,
            estimatedMonthlyRevenue: 0,
            isTrialActive: true,
            trialEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
        statistics: {
          doctors: { total: 3, active: 2 },
          appointments: { total: 9, pending: 2 },
          patients: 20,
          contactForms: 1,
          services: 2,
        },
        recentAppointments: [],
        doctors: [],
      },
    } as never);

    render(<HospitalDetailsPage />);

    expect(await screen.findByText('Hospital Details & Statistics')).toBeInTheDocument();
    expect(screen.getAllByText('Subscription').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/trial/i).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByText(/Trial ends/)).toBeInTheDocument();
    });
  });
});
