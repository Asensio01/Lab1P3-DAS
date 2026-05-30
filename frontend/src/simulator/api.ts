const SIM_BASE_URL =
  (import.meta.env.VITE_SIMULATOR_URL as string | undefined) ??
  "http://localhost:8001";

export interface SimulatorStatus {
  status: string;
  message?: string;
  resumen?: Record<string, unknown>;
  cronograma?: unknown[];
  reporte?: unknown[];
  [key: string]: unknown;
}

export interface StartSimulationResponse {
  simulation_id?: string;
  status: string;
  message?: string;
  [key: string]: unknown;
}

class SimulatorClient {
  private baseURL: string;
  private tokenProvider: (() => string | null) | null = null;

  constructor(baseURL: string = SIM_BASE_URL) {
    this.baseURL = baseURL;
  }

  setTokenProvider(provider: (() => string | null) | null): void {
    this.tokenProvider = provider;
  }

  private resolveToken(): string | null {
    return this.tokenProvider?.() ?? null;
  }

  private async request<T>(
    path: string,
    options: RequestInit & { requiresAuth?: boolean } = {}
  ): Promise<T> {
    const { requiresAuth = true, ...rest } = options;
    const token = this.resolveToken();

    const url = `${this.baseURL}${path}`;
    const response = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(requiresAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers ?? {})
      }
    });

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(detail || `HTTP ${response.status}`);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  async startFraud(cantidadCuentas: number): Promise<StartSimulationResponse> {
    return this.request("/api/v1/simulations/fraud", {
      method: "POST",
      body: JSON.stringify({ cantidad_cuentas: cantidadCuentas })
    });
  }

  async startStress(
    cantidadTransacciones: number
  ): Promise<StartSimulationResponse> {
    return this.request("/api/v1/simulations/stress", {
      method: "POST",
      body: JSON.stringify({ cantidad_transacciones: cantidadTransacciones })
    });
  }

  async startRaceCondition(
    cantidadCuentas: number
  ): Promise<SimulatorStatus> {
    return this.request("/api/v1/simulations/race-condition", {
      method: "POST",
      body: JSON.stringify({ cantidad_cuentas: cantidadCuentas })
    });
  }

  async startExpiredToken(accountId: number): Promise<StartSimulationResponse> {
    return this.request("/api/v1/simulations/expired-token", {
      method: "POST",
      body: JSON.stringify({ account_id: accountId })
    });
  }

  async getStatus(simulationId: string): Promise<SimulatorStatus> {
    return this.request(`/api/v1/simulations/status/${simulationId}`, {
      method: "GET"
    });
  }
}

export const simulatorClient = new SimulatorClient();
