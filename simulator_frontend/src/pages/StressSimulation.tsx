import React, { useState } from 'react';
import simulatorApi from '../api/simulatorApi.ts';
import { useSimulationPolling } from '../hooks/useSimulationPolling.ts';
import StressResultsSummary from '../components/StressResultsSummary.tsx';
import StressTimelineTable from '../components/StressTimelineTable.tsx';
import { Flame, Play, RefreshCw, Loader2 } from 'lucide-react';

export default function StressSimulation() {
  const [cantidadTransacciones, setCantidadTransacciones] = useState<number>(50);
  const [lanzando, setLanzando] = useState<boolean>(false);
  const { data, error, loading, startPolling, resetSimulation, simulationId } = useSimulationPolling(2000);

  const handleIniciarEstres = async (e: React.FormEvent) => {
    e.preventDefault();
    setLanzando(true);
    try {
      const response = await simulatorApi.post<{ simulation_id: string }>(
        '/api/v1/simulations/stress',
        { cantidad_transacciones: cantidadTransacciones }
      );
      startPolling(response.data.simulation_id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al iniciar la prueba de estrés');
    } finally {
      setLanzando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Encabezado */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <Flame className="h-8 w-8 text-amber-500 animate-bounce" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pruebas de Estrés y Carga Masiva</h1>
          <p className="text-sm text-slate-500">
            Inunda el backend con peticiones simultáneas desde una única IP para evaluar la tasa de mitigación y bloqueos por DDoS/Rate Limit.
          </p>
        </div>
      </div>

      {/* Panel de Configuración */}
      {!data && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Configurar Ráfaga Masiva</h2>
          <form onSubmit={handleIniciarEstres} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cantidad total de transacciones concurrentes
              </label>
              <input
                type="number"
                min={10}
                max={5000}
                step={10}
                value={cantidadTransacciones}
                onChange={(e) => setCantidadTransacciones(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                Las peticiones serán distribuidas aleatoriamente entre las cuentas activas del sistema usando la IP fija atacante.
              </p>
            </div>
            <button
              type="submit"
              disabled={lanzando}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:bg-slate-400"
            >
              {lanzando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Disparar Inundación de Tráfico
            </button>
          </form>
        </div>
      )}

      {/* Estado: PROCESSING */}
      {data?.status === 'PROCESSING' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center max-w-2xl mx-auto space-y-4">
          <Loader2 className="h-12 w-12 text-amber-500 animate-spin mx-auto" />
          <div>
            <h3 className="text-xl font-bold">Bombeando Peticiones Concurrentes...</h3>
            <p className="text-slate-500 text-sm mt-1">{data.message}</p>
            <p className="text-xs text-slate-400 mt-2 font-mono bg-slate-200/60 inline-block px-2 py-1 rounded">
              Task Token: {simulationId}
            </p>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full w-2/3 animate-pulse rounded-full"></div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
          <strong>Error de Carga:</strong> {error}
        </div>
      )}

      {/* Estado: COMPLETED */}
      {data?.status === 'COMPLETED' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <span className="text-sm text-amber-900 font-medium">
              ✓ Análisis de estrés finalizado. Respuestas consolidadas y descargadas de Redis.
            </span>
            <button
              onClick={resetSimulation}
              className="flex items-center gap-1 text-xs bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-evaluar Sistema
            </button>
          </div>

          {/* Gráficos de barra y contadores */}
          <StressResultsSummary resumen={data.resumen} total={data.total_enviadas || 0} />

          {/* Tabla de Cronograma de Impacto */}
          <StressTimelineTable cronograma={data.cronograma || []} />
        </div>
      )}
    </div>
  );
}