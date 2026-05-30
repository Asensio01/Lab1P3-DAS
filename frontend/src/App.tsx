import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jwtDecode } from "jwt-decode";

import { AlertContainer } from "@/components/Alert";
import {
  FlaggedTransactionTable,
  type FlaggedTransaction,
  type UiStatus
} from "@/components/FlaggedTransactionTable";
import { Card } from "@/components/ui/card";
import { SetupAccountForm } from "@/components/SetupAccountForm";
import { UserDashboard } from "@/components/UserDashboard";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiClient, type FlaggedResponse, type TransactionResponse } from "@/lib/api";

type Role = "admin" | "user";

interface TransactionRow {
  flaggedId: number;
  transactionId: number;
  amount: number;
  country: string;
  anomaly: string;
  status: UiStatus;
  timestamp: string;
  ip: string;
  account: string;
  accountId?: number | null;
}

interface DecodedToken {
  sub?: string;
  role?: Role;
  [key: string]: unknown;
}

type LogLevel = "BAN" | "WARN" | "INFO";

interface SecurityLogEntry {
  id: string;
  level: LogLevel;
  message: string;
  time: string;
}

interface KpiState {
  totalTransactions: number;
  manualReview: number;
  blockedOperations: number;
}

const WS_OPEN_STATES = new Set(["open"]);
const STATUS_MAP: Record<string, UiStatus> = {
  BAJO_REVISION: "Under Review",
  BLOQUEADA: "Bloqueada",
  BLOQUEADO: "Bloqueada",
  BLOCKED: "Bloqueada",
  APROBADA: "Aprobada",
  APROBADO: "Aprobada",
  APPROVED: "Aprobada",
  RECHAZADA: "Rechazada",
  REJECTED: "Rechazada",
  EN_REVISION: "Under Review",
  EN_REVISIÓN: "Under Review",
  UNDER_REVIEW: "Under Review",
  REVISION_PENDIENTE: "Under Review",
  PENDIENTE: "Under Review",
  PENDING: "Under Review"
};

type DynamicWsEvent = Record<string, unknown>;

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString("es-SV", { hour12: false });
}

function levelClass(level: LogLevel): string {
  if (level === "BAN") return "text-rose-400";
  if (level === "WARN") return "text-amber-400";
  return "text-emerald-400";
}

function normalizeStatus(raw: string | null | undefined): UiStatus {
  if (!raw) return "Under Review";
  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return STATUS_MAP[key] ?? "Under Review";
}

function mapFlaggedToRow(
  item: FlaggedResponse,
  transaction?: TransactionResponse | null
): TransactionRow {
  const txId = transaction?.id ?? item.transaction_id ?? item.id;
  return {
    flaggedId: item.id,
    transactionId: txId,
    amount: transaction ? toNumber(transaction.amount) : 0,
    country: transaction?.country ?? "",
    anomaly: item.anomaly,
    status: normalizeStatus(item.state),
    timestamp:
      transaction?.timestamp ?? item.timestamp ?? new Date().toISOString(),
    ip: transaction?.ip ?? "",
    accountId: transaction?.account_id ?? null,
    account: transaction?.account_id
      ? `ACCT-${String(transaction.account_id).padStart(5, "0")}`
      : "ACCT-UNKNOWN"
  };
}

function mapDynamicWsEventToRow(event: DynamicWsEvent): TransactionRow {
  const transactionId = readNumber(
    event.transaction_id,
    event.tx_id,
    event.id
  ) ?? Date.now();

  const flaggedId = readNumber(
    event.flagged_id,
    event.audit_id,
    event.id,
    transactionId
  ) ?? transactionId;

  const amountValue = readNumber(event.amount, event.total_amount, event.value);
  const amount = amountValue ?? 0;

  const country =
    readString(event.country, event.country_code, event.region) ?? "";

  const ip =
    readString(event.ip, event.source_ip, event.client_ip, event.origin_ip) ??
    "";

  const anomaly =
    readString(event.anomaly, event.reason, event.message, event.description) ??
    "Evento recibido desde simulador";

  const accountIdValue = readNumber(event.account_id, event.account);
  const account = accountIdValue
    ? `ACCT-${String(accountIdValue).padStart(5, "0")}`
    : readString(event.account, event.account_code) ?? "ACCT-UNKNOWN";

  const statusRaw =
    readString(event.state, event.status, event.transaction_state) ?? "Under Review";

  const timestamp =
    readString(event.timestamp, event.created_at, event.event_time) ??
    new Date().toISOString();

  return {
    flaggedId,
    transactionId,
    amount,
    country,
    anomaly,
    status: normalizeStatus(statusRaw),
    timestamp,
    ip,
    account,
    accountId: accountIdValue ?? null
  };
}

function deriveKpis(rows: TransactionRow[]): KpiState {
  return {
    totalTransactions: rows.length,
    manualReview: rows.filter((row) => row.status === "Under Review").length,
    blockedOperations: rows.filter((row) => row.status === "Bloqueada").length
  };
}

function safeDecodeJwt(token: string): DecodedToken | null {
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
}

export default function App() {
  const apiBase = useMemo(
    () =>
      (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
      "http://localhost:8000",
    []
  );

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [token, setToken] = useState<string>(
    () => apiClient.getStoredToken() ?? ""
  );
  const [authRole, setAuthRole] = useState<Role | null>(null);
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null);
  const [accountName, setAccountName] = useState<string>("");
  const [accountDui, setAccountDui] = useState<string>("");
  const [initialBalance, setInitialBalance] = useState<string>("");
  const [txAmount, setTxAmount] = useState<string>("");
  const [txCountry, setTxCountry] = useState<string>("SV");
  const [alerts, setAlerts] = useState<
    Array<{ id: string; title: string; message: string; type: "success" | "error" | "warning" | "info" }>
  >([]);
  const [logs, setLogs] = useState<SecurityLogEntry[]>([
    {
      id: crypto.randomUUID(),
      level: "INFO",
      message: "Consola FinTech Guard inicializada.",
      time: nowTimeLabel()
    }
  ]);

  const isAdmin = authRole === "admin";
  const isUser = authRole === "user";

  const wsUrlDirect = "ws://localhost:8000/ws";
  const { state: wsState, url: wsUrl, lastEvent } = useWebSocket(
    isAdmin ? token : undefined
  );

  const kpis = useMemo(() => deriveKpis(transactions), [transactions]);

  const {
    data: pendingFlagged,
    refetch: refetchPendingFlagged,
    isFetching: isLoadingFlagged
  } = useQuery({
    queryKey: ["pending-flagged", token, apiBase],
    queryFn: async (): Promise<TransactionRow[]> => {
      const flagged = await apiClient.listPendingFlagged();
      const transactionsById = await Promise.all(
        flagged.map(async (item) => {
          if (!item.transaction_id) return null;
          try {
            return await apiClient.getTransaction(item.transaction_id);
          } catch {
            return null;
          }
        })
      );

      return flagged.map((item, index) =>
        mapFlaggedToRow(item, transactionsById[index])
      );
    },
    enabled: Boolean(token) && isAdmin,
    refetchInterval: 8000
  });

  const {
    data: myAccount,
    error: myAccountError,
    refetch: refetchMyAccount,
    isFetching: isLoadingAccount
  } = useQuery({
    queryKey: ["my-account", token],
    queryFn: () => apiClient.getMyAccount(),
    enabled: Boolean(token) && isUser,
    retry: false
  });

  const {
    data: myTransactions,
    refetch: refetchMyTransactions,
    isFetching: isLoadingTransactions
  } = useQuery({
    queryKey: ["my-transactions", token],
    queryFn: () => apiClient.listMyTransactions(25),
    enabled: Boolean(token) && isUser
  });

  const pushAlert = useCallback(
    (title: string, message: string, type: "success" | "error" | "warning" | "info"): void => {
      const id = crypto.randomUUID();
      setAlerts((prev) => [{ id, title, message, type }, ...prev].slice(0, 5));
    },
    []
  );

  const pushLog = useCallback((level: LogLevel, message: string): void => {
    setLogs((prev) => [
      {
        id: crypto.randomUUID(),
        level,
        message,
        time: nowTimeLabel()
      },
      ...prev
    ]);
  }, []);

  async function handleLoginSubmit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const payload = isRegisterMode
        ? await apiClient.register(username, password)
        : await apiClient.login(username, password);
      if (!payload.access_token) {
        throw new Error("Respuesta de autenticación inválida.");
      }

      setToken(payload.access_token);
      apiClient.setToken(payload.access_token);
      apiClient.setTokenProvider(() => payload.access_token);
      
      // Decode JWT to extract role and username
      const decoded = safeDecodeJwt(payload.access_token);
      setAuthRole(decoded?.role ?? "user");
      setAuthUser(decoded?.sub ?? username);
      pushLog("INFO", `Token Bearer emitido para usuario ${username}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error de autenticación.";
      setAuthError(message);
      pushLog("WARN", `Fallo en autenticación manual: ${message}`);
    } finally {
      setIsAuthenticating(false);
    }
  }

  useEffect(() => {
    apiClient.setTokenProvider(() => token || null);
    apiClient.setToken(token || null);
    if (!token) {
      setAuthRole(null);
      setAuthUser(null);
      setHasAccount(null);
      return;
    }
    const decoded = safeDecodeJwt(token);
    setAuthRole(decoded?.role ?? "user");
    setAuthUser(decoded?.sub ?? null);
  }, [token]);

  // Check if user has account (for "user" role)
  useEffect(() => {
    if (authRole !== "user" || !token) {
      setHasAccount(null);
      return;
    }

    const checkAccount = async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBase}/api/v1/me/account`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (response.status === 404) {
          setHasAccount(false);
        } else if (response.ok) {
          setHasAccount(true);
        } else {
          // Other error - clear session
          setToken("");
          apiClient.setToken(null);
          setTransactions([]);
          setSelectedTx(null);
        }
      } catch {
        // Network error - clear session
        setToken("");
        apiClient.setToken(null);
        setTransactions([]);
        setSelectedTx(null);
      }
    };

    void checkAccount();
  }, [authRole, token, apiBase]);

  useEffect(() => {
    if (!isAdmin) {
      setTransactions([]);
      setSelectedTx(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!pendingFlagged) return;

    setTransactions(pendingFlagged);
    setSelectedTx((prev) => {
      if (!prev && pendingFlagged.length > 0) return pendingFlagged[0] ?? null;
      if (!prev) return null;
      const found = pendingFlagged.find(
        (item) => item.flaggedId === prev.flaggedId
      );
      return found ?? prev;
    });
  }, [pendingFlagged]);

  useEffect(() => {
    if (!lastEvent) return;

    const event = lastEvent as DynamicWsEvent;
    const eventType = String(event.type ?? "").toLowerCase();

    if (eventType === "transaction_status_updated") {
      const txId = readNumber(event.tx_id, event.transaction_id, event.id);
      const incomingStatusRaw = readString(event.status, event.state);
      const incomingStatus = incomingStatusRaw ? normalizeStatus(incomingStatusRaw) : null;

      if (!txId || !incomingStatus) return;

      setTransactions((prev) =>
        prev.map((row) =>
          row.transactionId === txId || row.flaggedId === txId
            ? { ...row, status: incomingStatus }
            : row
        )
      );

      setSelectedTx((prev) => {
        if (!prev) return prev;
        if (prev.transactionId === txId || prev.flaggedId === txId) {
          return { ...prev, status: incomingStatus };
        }
        return prev;
      });

      pushLog(
        incomingStatus === "Bloqueada" ? "BAN" : "INFO",
        `Actualización WS: tx #${txId} -> ${incomingStatus}`
      );
      return;
    }

    const dynamicRow = mapDynamicWsEventToRow(event);

    setTransactions((prev) => [
      dynamicRow,
      ...prev.filter(
        (item) =>
          item.flaggedId !== dynamicRow.flaggedId &&
          item.transactionId !== dynamicRow.transactionId
      )
    ]);

    setSelectedTx((prev) => prev ?? dynamicRow);

    pushLog(
      dynamicRow.status === "Bloqueada" ? "BAN" : "WARN",
      `Evento WS ingestado (${eventType || "sin_tipo"}): tx #${dynamicRow.transactionId} ${dynamicRow.anomaly}`
    );

    if (eventType.includes("flag") || eventType.includes("alert")) {
      void refetchPendingFlagged();
    }
  }, [lastEvent, pushLog, refetchPendingFlagged]);

  const handleTransactionAction = useCallback(
    (
      tx: FlaggedTransaction,
      payload: { status: "Aprobado" | "Bloqueado"; optimistic: boolean }
    ) => {
      const nextUiStatus =
        payload.status === "Aprobado" ? "Aprobada" : "Bloqueada";

      if (payload.optimistic) {
        setTransactions((prev) =>
          prev.map((row) =>
            row.flaggedId === Number(tx.id) || row.transactionId === tx.transactionId
              ? { ...row, status: nextUiStatus }
              : row
          )
        );
        setSelectedTx((prev) => {
          if (!prev) return prev;
          if (prev.flaggedId === Number(tx.id) || prev.transactionId === tx.transactionId) {
            return { ...prev, status: nextUiStatus };
          }
          return prev;
        });
        pushLog(
          nextUiStatus === "Bloqueada" ? "BAN" : "INFO",
          `Actualización optimista aplicada a tx #${tx.transactionId}: ${nextUiStatus}`
        );
        return;
      }

      pushLog(
        nextUiStatus === "Bloqueada" ? "BAN" : "INFO",
        `Estado confirmado por backend en tx #${tx.transactionId}: ${nextUiStatus}`
      );
      pushAlert(
        "Acción aplicada",
        `Tx #${tx.transactionId} => ${nextUiStatus}`,
        "success"
      );
      void refetchPendingFlagged();
    },
    [pushAlert, pushLog, refetchPendingFlagged]
  );

  const accountMissing =
    (myAccountError as Error & { status?: number } | null)?.status === 404;
  const availableBalance = myAccount
    ? toNumber(myAccount.balance) - toNumber(myAccount.reserved_balance)
    : 0;

  async function handleCreateAccount(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    setAuthError(null);
    try {
      const userInfo = { name: accountName.trim(), dui: accountDui.trim() };
      const balanceValue = initialBalance ? Number(initialBalance) : undefined;
      await apiClient.createMyAccount(userInfo, balanceValue);
      setAccountName("");
      setAccountDui("");
      setInitialBalance("");
      await refetchMyAccount();
      pushAlert("Cuenta creada", "Tu cuenta fue creada con éxito.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear.";
      pushAlert("Error", message, "error");
    }
  }

  async function handleCreateTransaction(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    setAuthError(null);
    try {
      const amountValue = Number(txAmount);
      await apiClient.createMyTransaction(amountValue, txCountry);
      setTxAmount("");
      await Promise.all([refetchMyAccount(), refetchMyTransactions()]);
      pushAlert("Transacción enviada", "Operacion registrada.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al enviar.";
      pushAlert("Error", message, "error");
    }
  }

  const handleLogout = useCallback(() => {
    setToken("");
    apiClient.setToken(null);
    setTransactions([]);
    setSelectedTx(null);
    setHasAccount(null);
  }, []);

  const wsOpen = WS_OPEN_STATES.has(wsState);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
          <Card className="w-full border-cyan-400/20 bg-[#0b1220]/90 p-6 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">
              FINTECH GUARD // ACCESS
            </p>
            <h1 className="mt-3 text-2xl font-semibold">
              {isRegisterMode ? "Crear cuenta" : "Iniciar sesión"}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {isRegisterMode
                ? "Registra tu usuario para operar la cuenta."
                : "Ingresa tus credenciales para conectar el dashboard."}
            </p>

            <form className="mt-6 space-y-4" onSubmit={(e) => void handleLoginSubmit(e)}>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                  Usuario
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70"
                  placeholder="••••••••"
                />
              </div>

              {authError && <p className="text-sm text-rose-300">{authError}</p>}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAuthenticating
                  ? "Conectando..."
                  : isRegisterMode
                    ? "Registrarse"
                    : "Iniciar sesión"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setIsRegisterMode((prev) => !prev)}
              className="mt-4 w-full text-xs text-cyan-200/80 hover:text-cyan-100"
            >
              {isRegisterMode
                ? "Ya tienes cuenta? Inicia sesión"
                : "No tienes cuenta? Regístrate"}
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-7 md:px-10">
        {/* Loading state for user role - checking account status */}
        {authRole === "user" && hasAccount === null && (
          <div className="flex min-h-screen items-center justify-center">
            <Card className="border-cyan-400/20 bg-[#0b1220]/90 p-8 shadow-[0_0_30px_rgba(34,211,238,0.08)] text-center">
              <div className="animate-pulse">
                <div className="h-8 w-8 rounded-full border-4 border-cyan-400/30 border-t-cyan-400 mx-auto mb-4"></div>
              </div>
              <p className="text-lg text-cyan-300">Verificando expediente financiero...</p>
              <p className="mt-2 text-sm text-slate-400">
                Por favor espera mientras verificamos el estado de tu cuenta.
              </p>
            </Card>
          </div>
        )}

        {/* Setup account form for users without an account */}
        {authRole === "user" && hasAccount === false && (
          <SetupAccountForm
            token={token}
            onSuccess={() => setHasAccount(true)}
            onError={() => {
              // Optionally handle error
            }}
          />
        )}

        {/* User dashboard for authenticated users with account */}
        {authRole === "user" && hasAccount === true && (
          <UserDashboard
            token={token}
            username={authUser ?? undefined}
            onLogout={handleLogout}
          />
        )}

        {/* Admin SOC console */}
        {isAdmin && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card className="border-cyan-500/20 bg-[#0d1627] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Transacciones Totales
                </p>
                <p className="mt-3 text-3xl font-semibold text-cyan-300">
                  {kpis.totalTransactions}
                </p>
              </Card>
              <Card className="border-amber-500/20 bg-[#0d1627] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  En Revisión Manual
                </p>
                <p className="mt-3 text-3xl font-semibold text-amber-300">
                  {kpis.manualReview}
                </p>
              </Card>
              <Card className="border-rose-500/20 bg-[#0d1627] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Operaciones Bloqueadas
                </p>
                <p className="mt-3 text-3xl font-semibold text-rose-300">
                  {kpis.blockedOperations}
                </p>
              </Card>
            </section>

            <section className="grid gap-5 lg:grid-cols-[3fr_1.25fr]">
              <Card className="border-slate-700/40 bg-[#0b1220] p-5">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Transacciones Flagged</h2>
                    <p className="text-xs text-slate-400">
                      Cola forense en vivo. Nuevas alertas entran al inicio.
                    </p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {isLoadingFlagged
                      ? "Sincronizando..."
                      : `${transactions.length} registros`}
                  </div>
                </div>

                <FlaggedTransactionTable
                  transactions={transactions.map((tx) => ({
                    id: String(tx.flaggedId),
                    flaggedId: tx.flaggedId,
                    transactionId: tx.transactionId,
                    amount: tx.amount,
                    country: tx.country,
                    anomaly: tx.anomaly,
                    status: tx.status,
                    timestamp: tx.timestamp,
                    ip: tx.ip,
                    account: tx.account,
                    accountId: tx.accountId ?? undefined
                  }))}
                  isLoading={isLoadingFlagged}
                  onTransactionAction={handleTransactionAction}
                />
              </Card>

              <div className="flex flex-col gap-5">
                <Card className="border-slate-700/40 bg-[#0b1220] p-5">
                  <h2 className="text-base font-semibold">Inspector de Riesgo</h2>
                  {!selectedTx ? (
                    <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">
                      Selecciona una transacción para inspección forense.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4 text-xs font-mono">
                      <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                        <div className="flex justify-between"><span className="text-slate-400">Flagged ID</span><span>{selectedTx.flaggedId}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Tx ID</span><span>{selectedTx.transactionId}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Monto</span><span className="text-emerald-300">${selectedTx.amount.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">País</span><span>{selectedTx.country || "-"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">IP</span><span>{selectedTx.ip || "-"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Cuenta</span><span>{selectedTx.account}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Timestamp</span><span>{new Date(selectedTx.timestamp).toLocaleString()}</span></div>
                      </div>

                      <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">
                        <span className="block text-[10px] uppercase tracking-wider text-rose-300/80">
                          Veredicto del Motor
                        </span>
                        <span>{selectedTx.anomaly}</span>
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="border-slate-700/40 bg-[#0b1220] p-5">
                  <h2 className="mb-3 text-base font-semibold">Logs de Seguridad</h2>
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded border border-slate-700 bg-black/30 p-3 text-[11px] font-mono">
                    {logs.map((entry) => (
                      <div key={entry.id} className={`flex gap-2 ${levelClass(entry.level)}`}>
                        <span className="text-slate-500">[{entry.time}]</span>
                        <span className="text-slate-300">[{entry.level}]</span>
                        <span>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
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