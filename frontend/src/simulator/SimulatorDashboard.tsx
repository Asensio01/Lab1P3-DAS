import { useCallback, useEffect, useMemo, useState } from "react";

import { Pagination } from "@/components/Pagination";
import { simulatorClient, type SimulatorStatus } from "@/simulator/api";

export type SimulationType = "fraud" | "stress" | "race" | "expired";

interface SimulationEntry {
  id: string;
  type: SimulationType;
  status: string;
  message?: string;
  startedAt: string;
  payload: Record<string, unknown>;
  details?: SimulatorStatus;
}

interface SimulatorDashboardProps {
  token: string | null;
}

const TYPE_LABEL: Record<SimulationType, string> = {
  fraud: "Fraude 3x9000",
  stress: "Stress IP Burst",
  race: "Race Condition",
  expired: "Token Expirado"
};

const SIM_PAGE_SIZE = 4;

function nowIso(): string {
  return new Date().toISOString();
}

function badgeTone(status: string): string {
  const key = status.toLowerCase();
  if (key.includes("completed") || key.includes("success")) {
    return "text-emerald-300 border-emerald-400/30";
  }
  if (key.includes("processing")) {
    return "text-amber-200 border-amber-400/30";
  }
  if (key.includes("failed") || key.includes("error")) {
    return "text-rose-300 border-rose-400/30";
  }
  return "text-slate-300 border-white/20";
}

export function SimulatorDashboard({ token }: SimulatorDashboardProps) {
  const [fraudAccounts, setFraudAccounts] = useState("2");
  const [stressCount, setStressCount] = useState("80");
  const [raceAccounts, setRaceAccounts] = useState("1");
  const [expiredAccount, setExpiredAccount] = useState("1");
  const [simulations, setSimulations] = useState<SimulationEntry[]>([]);
  const [simPage, setSimPage] = useState(1);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    simulatorClient.setTokenProvider(() => token ?? null);
  }, [token]);

  const simTotalPages = useMemo(
    () => Math.max(1, Math.ceil(simulations.length / SIM_PAGE_SIZE)),
    [simulations.length]
  );

  useEffect(() => {
    setSimPage(1);
  }, [simulations.length]);

  useEffect(() => {
    setSimPage((prev) => Math.min(prev, simTotalPages));
  }, [simTotalPages]);

  const runningSimulations = useMemo(
    () => simulations.filter((sim) => sim.status === "PROCESSING"),
    [simulations]
  );

  const simPageSafe = Math.min(simPage, simTotalPages);

  const pagedSimulations = useMemo(
    () =>
      simulations.slice(
        (simPageSafe - 1) * SIM_PAGE_SIZE,
        simPageSafe * SIM_PAGE_SIZE
      ),
    [simPageSafe, simulations]
  );

  const addSimulation = useCallback((entry: SimulationEntry) => {
    setSimulations((prev) => [entry, ...prev].slice(0, 12));
  }, []);

  const updateSimulation = useCallback(
    (id: string, update: Partial<SimulationEntry>) => {
      setSimulations((prev) =>
        prev.map((sim) => (sim.id === id ? { ...sim, ...update } : sim))
      );
    },
    []
  );

  const handleFraud = useCallback(async () => {
    setError(null);
    const cantidad = Number(fraudAccounts);
    try {
      const response = await simulatorClient.startFraud(cantidad);
      if (!response.simulation_id) throw new Error("Missing simulation_id");
      addSimulation({
        id: response.simulation_id,
        type: "fraud",
        status: response.status,
        message: response.message,
        startedAt: nowIso(),
        payload: { cantidad_cuentas: cantidad }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(message);
    }
  }, [addSimulation, fraudAccounts]);

  const handleStress = useCallback(async () => {
    setError(null);
    const cantidad = Number(stressCount);
    try {
      const response = await simulatorClient.startStress(cantidad);
      if (!response.simulation_id) throw new Error("Missing simulation_id");
      addSimulation({
        id: response.simulation_id,
        type: "stress",
        status: response.status,
        message: response.message,
        startedAt: nowIso(),
        payload: { cantidad_transacciones: cantidad }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(message);
    }
  }, [addSimulation, stressCount]);

  const handleRace = useCallback(async () => {
    setError(null);
    const cantidad = Number(raceAccounts);
    try {
      const response = await simulatorClient.startRaceCondition(cantidad);
      addSimulation({
        id: `race-${Date.now()}`,
        type: "race",
        status: response.status ?? "COMPLETED",
        message: response.resumen as string | undefined,
        startedAt: nowIso(),
        payload: { cantidad_cuentas: cantidad },
        details: response
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(message);
    }
  }, [addSimulation, raceAccounts]);

  const handleExpired = useCallback(async () => {
    setError(null);
    const accountId = Number(expiredAccount);
    try {
      const response = await simulatorClient.startExpiredToken(accountId);
      if (!response.simulation_id) throw new Error("Missing simulation_id");
      addSimulation({
        id: response.simulation_id,
        type: "expired",
        status: response.status,
        message: response.message,
        startedAt: nowIso(),
        payload: { account_id: accountId }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(message);
    }
  }, [addSimulation, expiredAccount]);

  useEffect(() => {
    if (runningSimulations.length === 0) return;
    if (isPolling) return;

    setIsPolling(true);
    const interval = setInterval(async () => {
      for (const sim of runningSimulations) {
        try {
          const data = await simulatorClient.getStatus(sim.id);
          updateSimulation(sim.id, {
            status: data.status ?? sim.status,
            message: data.message ?? sim.message,
            details: data
          });
        } catch {
          updateSimulation(sim.id, { status: "FAILED" });
        }
      }
    }, 2500);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [isPolling, runningSimulations, updateSimulation]);

  return (
    <div className="space-y-6">
      <section className="sim-hero rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">
              Simulator Control Room
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Orquesta ataques y estres en tiempo real
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Dispara escenarios y observa como el backend reacciona sin recargar.
            </p>
          </div>
          <div className="sim-chip">Live API</div>
        </div>
      </section>

      {error && (
        <div className="sim-error rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="flex flex-col gap-5">
          <div className="sim-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Fraude 3x9000</h3>
                <p className="text-xs text-slate-400">
                  Dispara rafagas sospechosas en cuentas activas.
                </p>
              </div>
              <span className="sim-pill">Autoflag</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                value={fraudAccounts}
                onChange={(e) => setFraudAccounts(e.target.value)}
                type="number"
                min={1}
                className="sim-input w-24"
              />
              <span className="text-xs text-slate-400">cuentas</span>
            </div>
            <button className="sim-action mt-4" onClick={handleFraud}>
              Lanzar fraude
            </button>
          </div>

          <div className="sim-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Stress IP Burst</h3>
                <p className="text-xs text-slate-400">
                  Ráfaga masiva con misma IP para probar rate limits.
                </p>
              </div>
              <span className="sim-pill">Burst</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                value={stressCount}
                onChange={(e) => setStressCount(e.target.value)}
                type="number"
                min={1}
                max={500}
                className="sim-input w-28"
              />
              <span className="text-xs text-slate-400">transacciones</span>
            </div>
            <button className="sim-action mt-4" onClick={handleStress}>
              Lanzar estres
            </button>
          </div>

          <div className="sim-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Race Condition</h3>
                <p className="text-xs text-slate-400">
                  Intenta doble gasto simultaneo sobre cuentas.
                </p>
              </div>
              <span className="sim-pill">Sync</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                value={raceAccounts}
                onChange={(e) => setRaceAccounts(e.target.value)}
                type="number"
                min={1}
                className="sim-input w-24"
              />
              <span className="text-xs text-slate-400">cuentas</span>
            </div>
            <button className="sim-action mt-4" onClick={handleRace}>
              Ejecutar race
            </button>
          </div>

          <div className="sim-card rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Token Expirado</h3>
                <p className="text-xs text-slate-400">
                  Programa expiracion y prueba el acceso.
                </p>
              </div>
              <span className="sim-pill">JWT</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                value={expiredAccount}
                onChange={(e) => setExpiredAccount(e.target.value)}
                type="number"
                min={1}
                className="sim-input w-24"
              />
              <span className="text-xs text-slate-400">account_id</span>
            </div>
            <button className="sim-action mt-4" onClick={handleExpired}>
              Iniciar expiracion
            </button>
          </div>
        </div>

        <div className="sim-telemetry rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Live feed</h3>
              <p className="text-xs text-slate-400">
                Estado de simulaciones activas.
              </p>
            </div>
            <span className="sim-chip">{isPolling ? "Sync" : "Idle"}</span>
          </div>

          <div className="mt-4 space-y-3">
            {simulations.length === 0 ? (
              <div className="sim-empty rounded-xl p-4 text-sm text-slate-400">
                Sin simulaciones activas.
              </div>
            ) : (
              pagedSimulations.map((sim) => (
                <div key={sim.id} className="sim-row rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {TYPE_LABEL[sim.type]}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(sim.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`sim-status rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${badgeTone(
                        sim.status
                      )}`}
                    >
                      {sim.status}
                    </span>
                  </div>
                  {sim.message && (
                    <p className="mt-2 text-xs text-slate-300">{sim.message}</p>
                  )}
                  {sim.details?.resumen && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                      {Object.entries(sim.details.resumen).map(([key, value]) => (
                        <div key={key} className="sim-mini rounded-lg px-2 py-1">
                          <span className="block text-[10px] uppercase text-slate-400">
                            {key}
                          </span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              Pagina {simPageSafe} de {simTotalPages}
            </span>
            <Pagination
              page={simPageSafe}
              totalPages={simTotalPages}
              onPageChange={setSimPage}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
