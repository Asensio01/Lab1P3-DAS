import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { AlertContainer } from "@/components/Alert";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiClient, type AccountResponse, type TransactionResponse } from "@/lib/api";

interface UserDashboardProps {
  token: string;
  username?: string;
  onLogout?: () => void;
}

export function UserDashboard({ token, username, onLogout }: UserDashboardProps) {
  const [txAmount, setTxAmount] = useState<string>("");
  const [txCountry, setTxCountry] = useState<string>("SV");
  const [isCreatingTx, setIsCreatingTx] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<
    Array<{ id: string; title: string; message: string; type: "success" | "error" | "warning" | "info" }>
  >([]);

  // WebSocket hook - will trigger refetch when receiving messages
  const { state: wsState, lastEvent } = useWebSocket(token);

  // Fetch account data
  const {
    data: myAccount,
    refetch: refetchAccount,
    isFetching: isLoadingAccount
  } = useQuery({
    queryKey: ["my-account", token],
    queryFn: async (): Promise<AccountResponse> => {
      const response = await fetch("http://localhost:8000/api/v1/me/account", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch account: ${response.status}`);
      }
      return response.json() as Promise<AccountResponse>;
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  // Fetch transactions data
  const {
    data: myTransactions = [],
    refetch: refetchTransactions,
    isFetching: isLoadingTransactions
  } = useQuery({
    queryKey: ["my-transactions", token],
    queryFn: async (): Promise<TransactionResponse[]> => {
      const response = await fetch(
        "http://localhost:8000/api/v1/me/transactions?limit=15",
        {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }
      return response.json() as Promise<TransactionResponse[]>;
    },
    enabled: !!token,
    refetchInterval: 10000
  });

  // Refetch on WebSocket message
  useEffect(() => {
    if (!lastEvent) return;
    void Promise.all([refetchAccount(), refetchTransactions()]);
  }, [lastEvent, refetchAccount, refetchTransactions]);

  const pushAlert = useCallback(
    (title: string, message: string, type: "success" | "error" | "warning" | "info"): void => {
      const id = crypto.randomUUID();
      setAlerts((prev) => [{ id, title, message, type }, ...prev].slice(0, 5));
    },
    []
  );

  async function handleCreateTransaction(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    setIsCreatingTx(true);

    try {
      const amount = parseFloat(txAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Monto inválido");
      }

      const response = await fetch("http://localhost:8000/api/v1/me/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amount,
          country: txCountry
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Check if transaction is flagged
      if (result.flagged && result.flagged.state === "BLOQUEADA") {
        pushAlert(
          "Transacción Bloqueada",
          result.flagged.anomaly || "Tu transacción ha sido bloqueada por el sistema antifraude",
          "error"
        );
      } else {
        pushAlert(
          "Transacción Enviada",
          `Operación de $${amount.toFixed(2)} ${txCountry} registrada`,
          "success"
        );
      }

      setTxAmount("");
      setTxCountry("SV");
      await Promise.all([refetchAccount(), refetchTransactions()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al enviar transacción";
      pushAlert("Error", message, "error");
    } finally {
      setIsCreatingTx(false);
    }
  }

  const availableBalance = myAccount
    ? (parseFloat(String(myAccount.balance || 0)) - parseFloat(String(myAccount.reserved_balance || 0)))
    : 0;

  const wsOpen = wsState === "open";

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-7 md:px-10">
        {/* Header */}
        <header className="rounded-xl border border-cyan-400/20 bg-[#0b1220]/80 p-5 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">
                FINTECH GUARD // CLIENT PORTAL
              </p>
              <h1 className="mt-2 text-2xl font-semibold md:text-3xl">
                Mi Cuenta y Operaciones
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Gestiona tu saldo y transacciones con antifraude activo en tiempo real.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-right">
              <div className="text-xs text-slate-300">
                Usuario: <span className="font-mono text-emerald-300">{username || "usuario"}</span>
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] ${
                  wsOpen
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-400/40 bg-amber-500/10 text-amber-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    wsOpen ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  }`}
                />
                {wsOpen ? "CONECTADO" : "DESCONECTADO"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="rounded border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Account Balance Cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-cyan-500/20 bg-[#0d1627] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Saldo Total
            </p>
            <p className="mt-3 text-3xl font-semibold text-cyan-300">
              ${(parseFloat(String(myAccount?.balance || 0))).toFixed(2)}
            </p>
          </Card>
          <Card className="border-amber-500/20 bg-[#0d1627] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Saldo Retenido
            </p>
            <p className="mt-3 text-3xl font-semibold text-amber-300">
              ${(parseFloat(String(myAccount?.reserved_balance || 0))).toFixed(2)}
            </p>
          </Card>
          <Card className="border-emerald-500/20 bg-[#0d1627] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Disponible
            </p>
            <p className="mt-3 text-3xl font-semibold text-emerald-300">
              ${availableBalance.toFixed(2)}
            </p>
          </Card>
        </section>

        {/* Main Content Grid */}
        <section className="grid gap-5 lg:grid-cols-[1.5fr_2fr]">
          {/* Left Column - Account Status & Transaction Form */}
          <div className="flex flex-col gap-5">
            {/* Account Status Card */}
            <Card className="border-slate-700/40 bg-[#0b1220] p-5">
              <h2 className="text-lg font-semibold">Estado de Cuenta</h2>
              {isLoadingAccount ? (
                <div className="mt-4 text-center text-sm text-slate-400">
                  Cargando información...
                </div>
              ) : myAccount ? (
                <div className="mt-4 grid gap-3 text-sm text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estado</span>
                    <span className="font-mono text-emerald-300">
                      {myAccount.state || "Activa"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cuenta ID</span>
                    <span className="font-mono text-cyan-300">
                      {myAccount.uuid?.substring(0, 8)}...
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Versión</span>
                    <span className="font-mono text-slate-300">
                      {myAccount.version || "-"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-center text-sm text-slate-400">
                  No hay datos disponibles
                </div>
              )}
            </Card>

            {/* New Transaction Form */}
            <Card className="border-slate-700/40 bg-[#0b1220] p-5">
              <h2 className="text-base font-semibold">Nueva Operación</h2>
              <form className="mt-4 space-y-3" onSubmit={(e) => void handleCreateTransaction(e)}>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                    Monto
                  </label>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    min={0.01}
                    step={0.01}
                    required
                    disabled={isCreatingTx}
                    className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:opacity-50"
                    placeholder="100.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                    País
                  </label>
                  <input
                    type="text"
                    value={txCountry}
                    onChange={(e) => setTxCountry(e.target.value.toUpperCase())}
                    maxLength={2}
                    required
                    disabled={isCreatingTx}
                    className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:opacity-50"
                    placeholder="SV"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingTx}
                  className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingTx ? "Procesando..." : "Enviar Operación"}
                </button>
              </form>
            </Card>
          </div>

          {/* Right Column - Transaction History */}
          <Card className="border-slate-700/40 bg-[#0b1220] p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-lg font-semibold">Historial de Transacciones</h2>
                <p className="text-xs text-slate-400">
                  Últimas operaciones registradas (últimas 15).
                </p>
              </div>
              <div className="text-xs text-slate-400">
                {isLoadingTransactions ? "Cargando..." : `${myTransactions.length} registros`}
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {isLoadingAccount || isLoadingTransactions ? (
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-white/50">
                  Cargando transacciones...
                </div>
              ) : myTransactions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">
                  Sin movimientos registrados todavía.
                </div>
              ) : (
                myTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4 transition hover:bg-slate-900/60"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold font-mono">TX #{tx.id}</div>
                        <div className="text-xs text-slate-400">
                          {tx.timestamp
                            ? new Date(tx.timestamp).toLocaleString("es-SV")
                            : "-"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-semibold text-emerald-300">
                          ${(parseFloat(String(tx.amount))).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-400">{tx.country}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/40">
                      <span>
                        Estado:{" "}
                        <span
                          className={
                            tx.state?.toUpperCase() === "APROBADA" ||
                            tx.state?.toUpperCase() === "APROBADO"
                              ? "text-emerald-300"
                              : tx.state?.toUpperCase() === "BLOQUEADA" ||
                                  tx.state?.toUpperCase() === "BLOQUEADO"
                                ? "text-rose-300"
                                : "text-amber-300"
                          }
                        >
                          {tx.state || "-"}
                        </span>
                      </span>
                      <span>IP: {tx.ip || "-"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>

      {/* Alert Container */}
      <AlertContainer
        alerts={alerts.map((a) => ({
          ...a,
          dismissible: true
        }))}
        onRemove={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
      />
    </div>
  );
}
