import { useState, useEffect } from "react";
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

const normalizeStatus = (rawStatus: unknown, amount: number): Transaction["status"] => {
  const status = String(rawStatus ?? "").toLowerCase();
  if (status.includes("aprob") || status.includes("approved")) {
    return "Approved";
  }
  if (status.includes("bloque") || status.includes("rechaz")) {
    return "Blocked";
  }
  if (status.includes("revision") || status.includes("under review") || status.includes("pending")) {
    return "Under Review";
  }
  return amount >= 9000 ? "Under Review" : "Approved";
};

export default function App() {
  const { state, url, lastMessage } = useWebSocket();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Efecto para escuchar el WebSocket e inyectar datos en tiempo real
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage);
        const payload: Record<string, unknown> = data.transaction ?? data;
        const flagged: Record<string, unknown> | undefined = data.flagged;
        const amount = Number(payload.amount ?? data.amount ?? 0);
        const rawAccountId = payload.account_id ?? data.account_id;
        const account =
          String(
            payload.account ??
              data.account ??
              (typeof rawAccountId === "number" || typeof rawAccountId === "string"
                ? `ACC-${rawAccountId}`
                : "")
          ) || "ACC-UNKNOWN";

        const newTx: Transaction = {
          id:
            String(payload.transaction_id ?? payload.id ?? data.transaction_id ?? data.id ?? "") ||
            `T-${Math.floor(1000 + Math.random() * 9000)}`,
          amount,
          country: String(payload.country ?? data.country ?? data.country_origin ?? "Global Network"),
          anomaly:
            String(flagged?.anomaly ?? data.anomaly ?? data.anomaly_type ?? "") ||
            (amount >= 9000 ? "Monto Inusual" : "Normal"),
          status: normalizeStatus(payload.state ?? payload.status ?? data.status, amount),
          timestamp:
            String(payload.timestamp ?? flagged?.timestamp ?? data.timestamp ?? new Date().toISOString()),
          ip: String(payload.ip ?? data.ip ?? "127.0.0.1"),
          account,
        };

        setTransactions((prev) => [newTx, ...prev].slice(0, 50));
      } catch (e) {
        console.error("Error parseando el stream transaccional:", e);
      }
    }
  }, [lastMessage]);

  // Manejadores de acciones de auditoría (Simulados hacia el Backend / Estado Local)
  const handleUpdateStatus = (id: string, newStatus: "Blocked" | "Approved") => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, status: newStatus } : tx))
    );
    if (selectedTx && selectedTx.id === id) {
      setSelectedTx((prev) => prev ? { ...prev, status: newStatus } : null);
    }
    // NOTA: Aquí iría tu mutación de TanStack Query hacia la API REST del backend:
    // mutation.mutate({ id, status: newStatus, justified_by: "Analista SOC" });
  };

  // KPIs dinámicos calculados directamente del estado reactivo
  const activeTxs = transactions.length + 1248; // Base estática + flujos en tiempo real
  const underReviewCount = transactions.filter(t => t.status === "Under Review").length + 14;
  const blockedCount = transactions.filter(t => t.status === "Blocked").length;

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

        {/* Métricas Dinámicas (Sensado en Tiempo Real) */}
        <section className="grid gap-4 md:grid-cols-4">
          <Card className="panel p-4 flex flex-col justify-between">
            <span className="text-xs text-white/50 font-medium">Transacciones Totales</span>
            <span className="text-3xl font-bold tracking-tight mt-2 text-white font-mono">{activeTxs}</span>
          </Card>
          <Card className="panel p-4 border-l-2 border-l-amber-500 flex flex-col justify-between">
            <span className="text-xs text-amber-400/80 font-medium">En Revisión Manual</span>
            <span className="text-3xl font-bold tracking-tight mt-2 text-amber-400 font-mono">{underReviewCount}</span>
          </Card>
          <Card className="panel p-4 border-l-2 border-l-rose-500 flex flex-col justify-between">
            <span className="text-xs text-rose-400/80 font-medium">Operaciones Bloqueadas</span>
            <span className="text-3xl font-bold tracking-tight mt-2 text-rose-400 font-mono">{blockedCount}</span>
          </Card>
          <Card className="panel p-4 flex flex-col justify-between">
            <span className="text-xs text-white/50 font-medium">Latencia del Motor</span>
            <span className="text-3xl font-bold tracking-tight mt-2 text-emerald-400 font-mono">1.2 ms</span>
          </Card>
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