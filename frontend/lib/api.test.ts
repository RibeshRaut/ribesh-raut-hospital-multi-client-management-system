import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APIError, __setRedirectHandlerForTests, authAPI, doctorAPI } from './api';

describe('frontend api client', () => {
  const fetchMock = vi.fn();
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
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
    fetchMock.mockReset();
    __setRedirectHandlerForTests(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns payload for successful responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { token: 'abc' }, message: 'ok' }),
    });

    const response = await authAPI.login('user@example.com', 'password123');

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ token: 'abc' });
    expect(response.message).toBe('ok');
  });

  it('throws APIError and redirects hospital admins on SUBSCRIPTION_REQUIRED', async () => {
    const redirectSpy = vi.fn();
    __setRedirectHandlerForTests(redirectSpy);

    localStorage.setItem(
      'userInfo',
      JSON.stringify({
        userType: 'hospital_admin',
      })
    );

    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: 'Subscription is required',
        code: 'SUBSCRIPTION_REQUIRED',
      }),
    });

    await expect(doctorAPI.getById('doc-1')).rejects.toBeInstanceOf(APIError);

    expect(redirectSpy).toHaveBeenCalledTimes(1);
    expect(redirectSpy.mock.calls[0][0]).toContain('/dashboard/billing?subscription=required');
  });

  it('preserves backend error code in APIError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({
        error: 'Subscription is required',
        code: 'SUBSCRIPTION_REQUIRED',
      }),
    });

    let thrown = null;
    try {
      await doctorAPI.getById('doc-2');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(APIError);
    expect((thrown as APIError).status).toBe(402);
    expect((thrown as APIError).code).toBe('SUBSCRIPTION_REQUIRED');
  });
});
