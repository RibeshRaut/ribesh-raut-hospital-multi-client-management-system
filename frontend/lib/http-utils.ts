/**
 * HTTP Status Code Utilities
 */

export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export const isSuccessStatus = (status: number): boolean => {
  return status >= 200 && status < 300;
};

export const isClientError = (status: number): boolean => {
  return status >= 400 && status < 500;
};

export const isServerError = (status: number): boolean => {
  return status >= 500 && status < 600;
};

export const getStatusMessage = (status: number): string => {
  const messages: Record<number, string> = {
    200: 'Success',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return messages[status] || 'Unknown Error';
};

/**
 * Response Handler Utilities
 */

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  status: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  errors?: string[];
  details?: Record<string, string>;
  status: number;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  status: number = HTTP_STATUS.OK
): SuccessResponse<T> => ({
  success: true,
  data,
  message,
  status,
});

export const createErrorResponse = (
  error: string,
  status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  errors?: string[],
  details?: Record<string, string>
): ErrorResponse => ({
  success: false,
  error,
  errors,
  details,
  status,
});

/**
 * Retry Logic for Failed Requests
 */

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

/**
 * Debounce utility for API calls
 */

export const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  delayMs: number = 500
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delayMs);
  };
};

/**
 * Throttle utility for API calls
 */

export const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  limitMs: number = 1000
): ((...args: Parameters<T>) => void) => {
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCallTime >= limitMs) {
      lastCallTime = now;
      func(...args);
    }
  };
};

/**
 * Cache utility for GET requests
 */

export class ApiCache<T = unknown> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map();
  private ttl: number; // Time to live in milliseconds

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(pattern: string): void {
    Array.from(this.cache.keys()).forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }
}

/**
 * Request queue for offline support (ready for future implementation)
 */

export interface QueuedRequest {
  id: string;
  method: string;
  url: string;
  body?: unknown;
  timestamp: number;
}

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;

  add(method: string, url: string, body?: unknown): string {
    const id = `${Date.now()}-${Math.random()}`;
    this.queue.push({
      id,
      method,
      url,
      body,
      timestamp: Date.now(),
    });
    return id;
  }

  getAll(): QueuedRequest[] {
    return [...this.queue];
  }

  remove(id: string): void {
    this.queue = this.queue.filter((req) => req.id !== id);
  }

  clear(): void {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }
}
