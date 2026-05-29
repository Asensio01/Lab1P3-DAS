import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/StatusPill";
import { useWebSocket } from "@/hooks/useWebSocket";
//Holi prueba Brenda Donis
// Estructura de la transacción para la visualización de auditoría
interface Transaction {
  id: string;
  amount: number;
  country: string;
  anomaly: string;
  status: "Blocked" | "Under Review" | "Approved";
  timestamp: string;
  ip: string;
  account: string;
}

type FlaggedItem = {
  id: number;
  transaction_id: number | null;
  anomaly: string;
  state: string | null;
  timestamp: string | null;
};

export default function App() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("authToken") ?? "");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const apiBase = useMemo(() => {
    return (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
      "http://localhost:8000";
  }, []);

  const { state, url, lastMessage, lastEvent } = useWebSocket(token);

  const {
    data: flaggedQueue,
    refetch: refetchFlagged,
    isFetching
  } = useQuery({
    queryKey: ["flagged", token],
    queryFn: async (): Promise<FlaggedItem[]> => {
      const response = await fetch(`${apiBase}/api/v1/flagged/pending`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to load flagged queue");
      }
      return response.json();
    },
    enabled: Boolean(token),
    refetchInterval: 5000
  });

  useEffect(() => {
    if (lastEvent?.type === "flagged") {
      refetchFlagged();
    }
  }, [lastEvent, refetchFlagged]);

  const kpis = [
    { label: "Transacciones activas", value: "1,248" },
    { label: "Alertas en revision", value: String(flaggedQueue?.length ?? 0) },
    { label: "Latencia promedio", value: "120ms" }
  ];

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        throw new Error("Invalid credentials");
      }
      const payload = await response.json();
      setToken(payload.access_token);
      localStorage.setItem("authToken", payload.access_token);
    } catch (error) {
      setLoginError((error as Error).message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("authToken");
  };

  return (
    <div className="page-shell px-4 py-8 md:px-12 md:py-10 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        
        {/* Encabezado Principal */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-400 font-mono font-bold">
               FINTECH GUARD // CONSOLA DE AUDITORÍA
            </p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Real-time Fraud Posture & Operations
            </h1>
          </div>
          <div className="panel px-4 py-2 rounded-lg flex items-center gap-3 text-xs font-mono">
            <StatusPill status={state} />
            <span className="text-white/60">Node: {url.replace("ws://", "")}</span>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Card className="stagger">
            <h2 className="text-xl font-semibold">Acceso administrativo</h2>
            <p className="mt-2 text-sm text-white/60">
              Inicia sesion para monitorear alertas y recibir notificaciones.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Usuario"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <input
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-mint px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-black"
                onClick={handleLogin}
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "Validando..." : "Iniciar sesion"}
              </button>
              {token && (
                <button
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70"
                  onClick={handleLogout}
                >
                  Cerrar sesion
                </button>
              )}
              {loginError && (
                <span className="text-sm text-ember">{loginError}</span>
              )}
            </div>
          </Card>
          <Card className="stagger">
            <h2 className="text-xl font-semibold">Cola de revision manual</h2>
            <p className="mt-2 text-sm text-white/60">
              {token
                ? "Alertas pendientes de evaluacion."
                : "Inicia sesion para visualizar la cola."}
            </p>
            <div className="mt-4 space-y-3 text-sm text-white/70">
              {(flaggedQueue ?? []).slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 px-3 py-2">
                  <div className="text-xs text-white/60">#{item.id} - {item.anomaly}</div>
                  <div className="text-[11px] text-white/40">
                    Estado: {item.state ?? "Revision Pendiente"}
                  </div>
                </div>
              ))}
              {token && (flaggedQueue?.length ?? 0) === 0 && !isFetching && (
                <div className="text-white/50">No hay alertas activas.</div>
              )}
              {isFetching && <div className="text-white/50">Cargando cola...</div>}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="stagger">
              <div className="text-sm text-white/60">{kpi.label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {kpi.value}
              </div>
            </Card>
          ))}
        </section>

        {/* Cuerpo Principal del Dashboard */}
        <section className="grid gap-6 lg:grid-cols-[3fr_1fr]">
          
          {/* Panel Izquierdo: Tabla de Flagged Transacciones */}
          <Card className="panel p-6 flex flex-col gap-4 overflow-hidden">
            <div>
              <h2 className="text-lg font-medium tracking-tight">Flagged Transacciones</h2>
              <p className="text-xs text-white/50">Responsividad web e interceptación instantánea de anomalías bancarias.</p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-white/40 uppercase tracking-wider text-[10px]">
                    <th className="p-3">ID Transacción</th>
                    <th className="p-3">Monto</th>
                    <th className="p-3">País de Origen</th>
                    <th className="p-3">Tipo de Anomalía</th>
                    <th className="p-3 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-white/30 italic">
                        Esperando tráfico sintético o ataques del simulador...
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedTx(tx)}
                        className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${selectedTx?.id === tx.id ? 'bg-white/[0.04]' : ''}`}
                      >
                        <td className="p-3 font-bold text-white/90">{tx.id}</td>
                        <td className="p-3 text-emerald-400 font-semibold">${tx.amount.toLocaleString()}</td>
                        <td className="p-3 text-white/70">{tx.country}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            tx.anomaly.includes("Lavado") || tx.anomaly.includes("Race")
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {tx.anomaly}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            tx.status === "Blocked" ? "bg-rose-950/80 text-rose-400 border border-rose-800" :
                            tx.status === "Under Review" ? "bg-amber-950/80 text-amber-400 border border-amber-800 animate-pulse" :
                            "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Panel Derecho: Consola de Inspección Forense / Acciones Rápidas */}
          <div className="flex flex-col gap-4">
            <Card className="panel p-6 flex flex-col gap-4">
              <h2 className="text-base font-semibold tracking-tight">Inspector de Riesgo</h2>
              
              {selectedTx ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3 bg-white/[0.02] rounded border border-white/5 space-y-2 text-xs font-mono">
                    <div className="flex justify-between"><span className="text-white/40">ID:</span> <span className="text-white font-bold">{selectedTx.id}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Monto:</span> <span className="text-emerald-400 font-bold">${selectedTx.amount}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">IP Origen:</span> <span>{selectedTx.ip}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Cuenta:</span> <span>{selectedTx.account}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Ubicación:</span> <span>{selectedTx.country}</span></div>
                  </div>

                  <div className="p-2.5 bg-rose-500/5 rounded border border-rose-500/10 text-[11px] text-rose-300">
                    <span className="font-bold block mb-0.5">Veredicto del Motor:</span>
                    {selectedTx.anomaly}
                  </div>

                  {selectedTx.status === "Under Review" && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button 
                        onClick={() => handleUpdateStatus(selectedTx.id, "Blocked")}
                        className="w-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-medium text-xs py-2 px-3 rounded transition-all shadow-md shadow-rose-900/20"
                      >
                        ❌ Bloquear
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(selectedTx.id, "Approved")}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-xs py-2 px-3 rounded transition-all shadow-md shadow-emerald-900/20"
                      >
                        ✅ Aprobar
                      </button>
                    </div>
                  )}
                  
                  {selectedTx.status !== "Under Review" && (
                    <div className="text-center p-3 border border-white/5 bg-white/[0.01] rounded text-xs text-white/40 italic">
                      Operación dictaminada como: <span className="text-white font-mono not-italic uppercase font-bold text-[10px] ml-1">{selectedTx.status}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-white/40 italic text-center py-12 border border-dashed border-white/10 rounded">
                  Selecciona una transacción de la cola de alertas para auditar su payload.
                </div>
              )}
            </Card>

            <Card className="panel p-6">
              <h2 className="text-base font-semibold tracking-tight mb-3">Logs de Seguridad</h2>
              <div className="space-y-2 text-[11px] font-mono text-white/60">
                <div className="flex gap-2 text-rose-400"><span className="text-white/30">[IDS]</span> IP 10.0.1.30 bloqueada por ráfaga DDoS.</div>
                <div className="flex gap-2 text-amber-400"><span className="text-white/30">[WARN]</span> Intento fallido de lectura en DB.</div>
                <div className="flex gap-2 text-emerald-400"><span className="text-white/30">[INFO]</span> Optimistic Locking activo en balance.</div>
              </div>
            </Card>
          </div>

        </section>
      </div>
    </div>
  );
}