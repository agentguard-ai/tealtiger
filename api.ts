import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiConfig {
  baseURL?: string;
  timeout?: number;
  authToken?: string | (() => string | null);
}

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const DEFAULT_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createApiClient(config: ApiConfig = {}): AxiosInstance {
  const {
    baseURL = DEFAULT_BASE_URL,
    timeout = DEFAULT_TIMEOUT,
    authToken,
  } = config;

  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // -----------------------------------------------------------------------
  // Request interceptor – attach auth token & optional request logging
  // -----------------------------------------------------------------------
  client.interceptors.request.use(
    (reqConfig) => {
      if (authToken) {
        const token = typeof authToken === 'function' ? authToken() : authToken;
        if (token) {
          reqConfig.headers.Authorization = `Bearer ${token}`;
        }
      }
      // Optional: add request tracing, correlation IDs, etc.
      return reqConfig;
    },
    (error) => Promise.reject(error),
  );

  // -----------------------------------------------------------------------
  // Response interceptor – normalize errors, handle 401, etc.
  // -----------------------------------------------------------------------
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      if (error.response) {
        const { status, data } = error.response;

        // Token expired or invalid – could redirect to login
        if (status === 401) {
          // Optionally emit an event or clear stored credentials
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
        }

        // Extract meaningful error message
        const message =
          data?.message ?? data?.error ?? error.response.statusText;

        return Promise.reject(new ApiError(message, status, data));
      }

      // Network or timeout errors
      if (error.code === 'ECONNABORTED') {
        return Promise.reject(
          new ApiError('Request timed out', 0, undefined, true),
        );
      }

      return Promise.reject(new ApiError(error.message ?? 'Unknown error'));
    },
  );

  return client;
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

class ApiError extends Error {
  public readonly status: number;
  public readonly data: unknown;
  public readonly isTimeout: boolean;

  constructor(
    message: string,
    status = 0,
    data?: unknown,
    isTimeout = false,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isTimeout = isTimeout;
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

const apiClient: AxiosInstance = createApiClient({
  authToken: () => {
    // Example: read token from localStorage – customise per project
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  },
});

// ---------------------------------------------------------------------------
// Convenience helpers with typed responses
// ---------------------------------------------------------------------------

async function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await apiClient.get<T>(url, config);
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers as Record<string, string>,
  };
}

async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await apiClient.post<T>(url, data, config);
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers as Record<string, string>,
  };
}

async function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await apiClient.put<T>(url, data, config);
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers as Record<string, string>,
  };
}

async function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const response = await apiClient.delete<T>(url, config);
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers as Record<string, string>,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export {
  apiClient,
  createApiClient,
  get,
  post,
  put,
  del,
  ApiError,
  ApiConfig,
  ApiResponse,
};