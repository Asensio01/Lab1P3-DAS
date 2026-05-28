import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/StatusPill";
import { useWebSocket } from "@/hooks/useWebSocket";

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
    <div className="page-shell px-6 py-12 md:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.4em] text-white/60">
            Fintech Guard
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Real-time fraud posture and transaction integrity
          </h1>
          <p className="max-w-2xl text-white/70">
            Supervisa riesgo, colas de revision manual y volumen de fraude con un
            tablero reactivo listo para streaming seguro.
          </p>
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

        <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Card className="stagger">
            <h2 className="text-xl font-semibold">Stream de vigilancia</h2>
            <p className="mt-2 text-sm text-white/60">
              WebSocket: <span className="text-white/80">{url}</span>
            </p>
            <div className="mt-4 flex items-center gap-3">
              <StatusPill status={state} />
              <span className="text-sm text-white/60">
                {lastMessage ?? "Esperando eventos del motor"}
              </span>
            </div>
          </Card>
          <Card className="stagger">
            <h2 className="text-xl font-semibold">Acciones rapidas</h2>
            <div className="mt-4 space-y-3 text-sm text-white/70">
              <div>• Revisar alertas criticas en cola</div>
              <div>• Validar limites de burst por IP</div>
              <div>• Analizar transacciones bloqueadas</div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
