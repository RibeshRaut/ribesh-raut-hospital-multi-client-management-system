import { useState, useCallback } from 'react';
import { APIError } from './api';

export interface UseApiState<T> {
  data: T | null;
  error: string | null;
  errors: string[] | null;
  isLoading: boolean;
}

export interface UseApiReturn<T> extends UseApiState<T> {
  execute: () => Promise<T | null>;
  reset: () => void;
}

type ApiCallResult<T> = T | { data?: T };

/**
 * Custom hook for handling API calls with loading and error states
 * @param apiCall - The async API call function
 * @param onSuccess - Optional callback on success
 * @param onError - Optional callback on error
 */
export function useApi<T>(
  apiCall: () => Promise<ApiCallResult<T>>,
  onSuccess?: (data: T) => void,
  onError?: (error: APIError) => void
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    errors: null,
    isLoading: false,
  });

  const execute = useCallback(async (): Promise<T | null> => {
    setState({
      data: null,
      error: null,
      errors: null,
      isLoading: true,
    });

    try {
      const response = await apiCall();
      const data = (response as { data?: T }).data ?? (response as T);

      setState({
        data,
        error: null,
        errors: null,
        isLoading: false,
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        const errorMessage = error.errors?.[0] || error.message;
        setState({
          data: null,
          error: errorMessage,
          errors: error.errors || null,
          isLoading: false,
        });

        if (onError) {
          onError(error);
        }
      } else {
        setState({
          data: null,
          error: 'An unexpected error occurred',
          errors: null,
          isLoading: false,
        });
      }

      return null;
    }
  }, [apiCall, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      errors: null,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Custom hook for managing mutation state (POST, PUT, DELETE requests)
 * @param mutationFn - The async mutation function
 */
export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  const [state, setState] = useState<UseApiState<TData>>({
    data: null,
    error: null,
    errors: null,
    isLoading: false,
  });

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      setState({
        data: null,
        error: null,
        errors: null,
        isLoading: true,
      });

      try {
        const response = await mutationFn(variables);
        const data = response;

        setState({
          data,
          error: null,
          errors: null,
          isLoading: false,
        });

        return data;
      } catch (error) {
        if (error instanceof APIError) {
          const errorMessage = error.errors?.[0] || error.message;
          setState({
            data: null,
            error: errorMessage,
            errors: error.errors || null,
            isLoading: false,
          });
        } else {
          setState({
            data: null,
            error: 'An unexpected error occurred',
            errors: null,
            isLoading: false,
          });
        }

        return null;
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      errors: null,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}
