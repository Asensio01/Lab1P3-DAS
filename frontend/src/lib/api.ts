/**
 * API Service for FinTech Guard backend integration
 * Handles REST API calls for security mitigation and auditing
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const AUTH_STORAGE_KEY = "fintech_guard_token";

export interface APIError {
  error: string;
  correlation_id?: string;
  detail?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AccountResponse {
  id: number;
  uuid: string;
  user_name: string;
  user_info: Record<string, unknown>;
  state: string | null;
  balance: string | number | null;
  reserved_balance: string | number | null;
  version: number | null;
}

export interface TransactionResponse {
  id: number;
  account_id: number | null;
  ip: string;
  amount: string | number;
  country: string;
  state: string;
  timestamp: string | null;
}

export interface FlaggedResponse {
  id: number;
  transaction_id: number | null;
  anomaly: string;
  state: string | null;
  auditor_notes: string | null;
  resolved_at: string | null;
  timestamp: string | null;
}

export interface MitigationResponse {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

export type TxStatusPayload = "Aprobada" | "Rechazada" | "Bloqueada";
export type AuditDecision = "Aprobado" | "Bloqueado";

class APIClient {
  private baseURL: string;
  private tokenProvider: (() => string | null) | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  setTokenProvider(provider: (() => string | null) | null): void {
    this.tokenProvider = provider;
  }

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(AUTH_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  getStoredToken(): string | null {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  }

  private resolveToken(): string | null {
    const providerToken = this.tokenProvider?.() ?? null;
    if (providerToken) return providerToken;
    return localStorage.getItem(AUTH_STORAGE_KEY);
  }

  private async request<T>(
    path: string,
    options: RequestInit & { requiresAuth?: boolean } = {}
  ): Promise<T> {
    const { requiresAuth = true, ...rest } = options;
    const token = this.resolveToken();

    if (requiresAuth && !token) {
      throw new Error("missing token");
    }

    const url = `${this.baseURL}${path}`;
    const response = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(requiresAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers ?? {}),
      },
    });

    if (!response.ok) {
      let errorPayload: APIError | null = null;
      try {
        errorPayload = (await response.json()) as APIError;
      } catch {
        errorPayload = null;
      }
      const error = new Error(
        errorPayload?.error ||
          errorPayload?.detail ||
          `HTTP ${response.status}`
      );
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // Auth endpoints

  async login(username: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      requiresAuth: false,
    });
  }

  async register(username: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, role: "user" }),
      requiresAuth: false,
    });
  }

  // Admin audit endpoints

  async listPendingFlagged(): Promise<FlaggedResponse[]> {
    return this.request<FlaggedResponse[]>("/api/v1/flagged/pending");
  }

  async resolveFlagged(
    flaggedId: number,
    decision: AuditDecision,
    auditorNotes?: string
  ): Promise<FlaggedResponse> {
    return this.request<FlaggedResponse>(
      `/api/v1/flagged/${flaggedId}/resolve`,
      {
        method: "POST",
        body: JSON.stringify({
          state: decision,
          auditor_notes: auditorNotes ?? null,
        }),
      }
    );
  }

  async getTransaction(transactionId: number): Promise<TransactionResponse> {
    return this.request<TransactionResponse>(
      `/api/v1/transactions/${transactionId}`
    );
  }

  // User endpoints

  async getMyAccount(): Promise<AccountResponse> {
    return this.request<AccountResponse>("/api/v1/me/account");
  }

  async createMyAccount(
    userInfo: Record<string, unknown>,
    initialBalance?: number
  ): Promise<AccountResponse> {
    return this.request<AccountResponse>("/api/v1/me/account", {
      method: "POST",
      body: JSON.stringify({
        user_info: userInfo,
        initial_balance: initialBalance ?? null,
      }),
    });
  }

  async listMyTransactions(limit: number = 25): Promise<TransactionResponse[]> {
    return this.request<TransactionResponse[]>(
      `/api/v1/me/transactions?limit=${limit}`
    );
  }

  async createMyTransaction(amount: number, country: string) {
    return this.request("/api/v1/me/transactions", {
      method: "POST",
      body: JSON.stringify({ amount, country }),
    });
  }
}

export const apiClient = new APIClient();
