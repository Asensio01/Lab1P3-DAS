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

export interface MitigationResponse {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

export type TxStatusPayload = "Aprobada" | "Rechazada" | "Bloqueada";

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
      throw new Error(
        errorPayload?.error ||
          errorPayload?.detail ||
          `HTTP ${response.status}`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // Security Mitigation Endpoints

  async banIP(
    ipAddress: string,
    reason: string,
    durationHours: number = 24
  ): Promise<MitigationResponse> {
    return this.request("/api/v1/security/ban-ip", {
      method: "POST",
      body: JSON.stringify({
        ip_address: ipAddress,
        reason,
        duration_hours: durationHours,
      }),
    });
  }

  async unbanIP(ipAddress: string): Promise<MitigationResponse> {
    return this.request(`/api/v1/security/ban-ip/${ipAddress}`, {
      method: "DELETE",
    });
  }

  async blockAccount(
    accountId: number,
    reason: string,
    auditorId?: number
  ): Promise<MitigationResponse> {
    return this.request("/api/v1/security/block-account", {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        reason,
        auditor_id: auditorId,
      }),
    });
  }

  async unblockAccount(
    accountId: number,
    auditorId?: number
  ): Promise<MitigationResponse> {
    return this.request("/api/v1/security/unblock-account", {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        auditor_id: auditorId,
      }),
    });
  }

  // Transaction Audit Endpoints

  async patchTransactionStatus(
    txId: number,
    status: TxStatusPayload
  ): Promise<MitigationResponse> {
    return this.request(`/api/v1/transactions/${txId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
      requiresAuth: true,
    });
  }

  async auditTransaction(

    flaggedTransactionId: number,
    decision: "Aprobado" | "Bloqueado" | "Revision Pendiente",
    auditorNotes?: string,
    auditorId?: number
  ): Promise<MitigationResponse> {
    return this.request("/api/v1/audit/resolve", {
      method: "POST",
      body: JSON.stringify({
        flagged_transaction_id: flaggedTransactionId,
        decision,
        auditor_notes: auditorNotes,
        auditor_id: auditorId,
      }),
    });
  }

  // List endpoints for retrieving data

  async getAccount(accountId: number) {
    return this.request(`/api/v1/accounts/${accountId}`);
  }
}

export const apiClient = new APIClient();
