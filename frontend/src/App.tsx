import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/StatusPill";
import { useWebSocket } from "@/hooks/useWebSocket";

const kpis = [
  { label: "Transacciones activas", value: "1,248" },
  { label: "Alertas en revision", value: "14" },
  { label: "Latencia promedio", value: "120ms" }
];

export default function App() {
  const { state, url, lastMessage } = useWebSocket();

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
