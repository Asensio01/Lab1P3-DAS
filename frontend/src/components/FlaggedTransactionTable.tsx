import React, { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { useMutation } from "@/hooks/useMutation";
import { apiClient, type AuditDecision } from "@/lib/api";

export type UiStatus = "Under Review" | "Aprobada" | "Rechazada" | "Bloqueada";

export interface FlaggedTransaction {
  id: string;
  flaggedId: number;
  transactionId: number;
  amount: number;
  country: string;
  anomaly: string;
  status: UiStatus;
  timestamp: string;
  ip: string;
  account: string;
  accountId?: number;
}

export interface FlaggedTransactionTableProps {
  transactions: FlaggedTransaction[];
  isLoading?: boolean;
  onTransactionAction?: (
    transaction: FlaggedTransaction,
    payload: {
      status: AuditDecision;
      optimistic: boolean;
      previousStatus: UiStatus;
      error?: string;
    }
  ) => void;
}

function toStatusBadgeClass(status: UiStatus): string {
  if (status === "Bloqueada") return "bg-red-950/30 border-red-600/30 text-red-300";
  if (status === "Rechazada") return "bg-orange-950/30 border-orange-600/30 text-orange-300";
  if (status === "Aprobada") return "bg-emerald-950/30 border-emerald-600/30 text-emerald-300";
  return "bg-amber-950/30 border-amber-600/30 text-amber-300";
}

function anomalyBadgeColor(anomaly: string): string {
  const a = anomaly.toLowerCase();
  if (a.includes("estrés") || a.includes("stress")) return "bg-orange-500/20 text-orange-300";
  if (a.includes("race") || a.includes("concurr")) return "bg-purple-500/20 text-purple-300";
  if (a.includes("token")) return "bg-rose-500/20 text-rose-300";
  if (a.includes("fraud") || a.includes("fraude")) return "bg-red-500/20 text-red-300";
  return "bg-blue-500/20 text-blue-300";
}

export function FlaggedTransactionTable({
  transactions,
  isLoading,
  onTransactionAction,
}: FlaggedTransactionTableProps): React.ReactElement {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<
    Record<string, { type: "success" | "error" | "loading"; message: string }>
  >({});
  const [localTransactions, setLocalTransactions] = useState<FlaggedTransaction[]>(transactions);

  useEffect(() => {
    setLocalTransactions(transactions);
  }, [transactions]);

  const pendingByTx = useMemo(() => {
    const map = new Map<number, boolean>();
    Object.keys(actionStatus).forEach((key) => {
      const parts = key.split("-");
      const txId = Number(parts[1]);
      if (Number.isFinite(txId) && actionStatus[key]?.type === "loading") {
        map.set(txId, true);
      }
    });
    return map;
  }, [actionStatus]);

  const patchStatusMutation = useMutation(
    async (data: unknown) => {
      const vars = data as {
        flaggedId: number;
        decision: AuditDecision;
        notes?: string;
      };
      return apiClient.resolveFlagged(vars.flaggedId, vars.decision, vars.notes);
    }
  );

  const applyOptimistic = useCallback(
    (txId: number, nextStatus: UiStatus) => {
      setLocalTransactions((prev) =>
        prev.map((row) =>
          row.transactionId === txId ? { ...row, status: nextStatus } : row
        )
      );
    },
    []
  );

  const handleUpdateStatus = useCallback(
    async (tx: FlaggedTransaction, next: AuditDecision): Promise<void> => {
      const ok = confirm(
        next === "Bloqueado"
          ? `Bloquear cuenta de ${tx.account}?`
          : next === "Aprobado"
            ? `Aprobar transacción ${tx.id}?`
            : `Resolver transacción ${tx.id}?`
      );
      if (!ok) return;

      const notes = prompt("Notas del auditor (opcional):") ?? undefined;

      const actionKey = `tx-${tx.transactionId}-${next}`;
      const previousStatus = tx.status;
      const previousRows = localTransactions;

      const nextUiStatus = next === "Aprobado" ? "Aprobada" : "Bloqueada";

      setActionStatus((prev) => ({
        ...prev,
        [actionKey]: { type: "loading", message: "Procesando..." },
      }));

      applyOptimistic(tx.transactionId, nextUiStatus);
      onTransactionAction?.(tx, {
        status: next,
        optimistic: true,
        previousStatus,
      });

      try {
        await patchStatusMutation.mutate({
          flaggedId: tx.flaggedId,
          decision: next,
          notes,
        });

        setActionStatus((prev) => ({
          ...prev,
          [actionKey]: { type: "success", message: `Estado actualizado a ${next}` },
        }));

        onTransactionAction?.(tx, {
          status: next,
          optimistic: false,
          previousStatus,
        });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        setLocalTransactions(previousRows);
        setActionStatus((prev) => ({
          ...prev,
          [actionKey]: { type: "error", message: err },
        }));

        onTransactionAction?.(tx, {
          status: next,
          optimistic: false,
          previousStatus,
          error: err,
        });
      }
    },
    [applyOptimistic, localTransactions, onTransactionAction, patchStatusMutation]
  );

  if (isLoading) {
    return <div className="panel p-6 text-center text-white/50">Loading transactions...</div>;
  }

  if (localTransactions.length === 0) {
    return (
      <div className="panel p-6 text-center text-white/50">
        No flagged transactions at this time.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localTransactions.map((tx) => {
        const statusKeyCandidates = Object.keys(actionStatus).filter((k) =>
          k.startsWith(`tx-${tx.transactionId}-`)
        );
        const latestStatusKey =
          statusKeyCandidates.length > 0
            ? statusKeyCandidates[statusKeyCandidates.length - 1] ?? null
            : null;
        const currentStatusEntry = latestStatusKey ? actionStatus[latestStatusKey] : undefined;

        const txPending = pendingByTx.get(tx.transactionId) ?? false;

        return (
          <div
            key={tx.id}
            className={clsx(
              "panel p-4 border rounded-lg cursor-pointer transition-all",
              "hover:border-white/20",
              selectedRow === tx.id && "border-emerald-500/50 bg-emerald-950/10"
            )}
            onClick={() => setSelectedRow((prev) => (prev === tx.id ? null : tx.id))}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="text-xs font-mono text-white/50">{tx.id}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm font-semibold text-white">
                    {tx.account}
                  </div>
                  <div className="text-xs text-white/60">
                    {new Date(tx.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-emerald-400">
                    ${tx.amount.toFixed(2)}
                  </div>
                  <div className="text-xs text-white/50">{tx.country}</div>
                </div>
                <div
                  className={clsx(
                    "rounded border px-2 py-1 text-xs font-medium",
                    toStatusBadgeClass(tx.status)
                  )}
                >
                  {tx.status}
                </div>
              </div>
            </div>

            {selectedRow === tx.id && (
              <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-white/50">IP Address:</span>
                    <div className="mt-1 font-mono text-white/80">{tx.ip}</div>
                  </div>
                  <div>
                    <span className="text-white/50">Anomaly Type:</span>
                    <div className="mt-1">
                      <span
                        className={clsx(
                          "inline-block rounded px-2 py-1 text-xs",
                          anomalyBadgeColor(tx.anomaly)
                        )}
                      >
                        {tx.anomaly}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-white/50">Transaction ID:</span>
                    <div className="mt-1 font-mono text-white/80">{tx.transactionId}</div>
                  </div>
                  <div>
                    <span className="text-white/50">Account ID:</span>
                    <div className="mt-1 font-mono text-white/80">{tx.accountId ?? "N/A"}</div>
                  </div>
                </div>

                {currentStatusEntry && (
                  <div
                    className={clsx(
                      "rounded p-2 text-xs",
                      currentStatusEntry.type === "success"
                        ? "bg-emerald-950/30 text-emerald-300"
                        : currentStatusEntry.type === "loading"
                          ? "bg-amber-950/30 text-amber-300"
                          : "bg-red-950/30 text-red-300"
                    )}
                  >
                    {currentStatusEntry.message}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-white/5 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleUpdateStatus(tx, "Bloqueado")}
                    disabled={txPending}
                    className={clsx(
                      "rounded px-3 py-1 text-xs font-medium transition-colors",
                      "bg-red-600 text-white hover:bg-red-700",
                      "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                  >
                    {txPending ? "⏳" : "🚫 Bloquear"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleUpdateStatus(tx, "Aprobado")}
                    disabled={txPending}
                    className={clsx(
                      "rounded px-3 py-1 text-xs font-medium transition-colors",
                      "bg-emerald-600 text-white hover:bg-emerald-700",
                      "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                  >
                    {txPending ? "⏳" : "✓ Aprobar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
