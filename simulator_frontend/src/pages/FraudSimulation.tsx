import React, { useState } from 'react';
import simulatorApi from '../api/simulatorApi';
import { useSimulationPolling } from '../hooks/useSimulationPolling';
import FraudResultsSummary from '../components/FraudResultsSummary.tsx';
import FraudTimelineTable from '../components/FraudTimelineTable.tsx';
import { ShieldAlert, Play, RefreshCw, Loader2 } from 'lucide-react';

export default function FraudSimulation() {
  const [cantidadCuentas, setCantidadCuentas] = useState<number>(1);
  const [lanzando, setLanzando] = useState<boolean>(false);
  const { data, error, loading, startPolling, resetSimulation, simulationId } = useSimulationPolling(2000);

  const handleIniciarAtaque = async (e: React.FormEvent) => {
    e.preventDefault();
    setLanzando(true);
    try {
      const response = await simulatorApi.post<{ simulation_id: string }>(
        '/api/v1/simulations/fraud',
        { cantidad_cuentas: cantidadCuentas }
      );
      // Activamos el polling asíncrono con el ID que nos dio Redis
      startPolling(response.data.simulation_id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al iniciar el patrón de fraude');
    } finally {
      setLanzando(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Encabezado */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <ShieldAlert className="h-8 w-8 text-red-600 animate-pulse" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulador de Patrones de Fraude</h1>
          <p className="text-sm text-slate-500">
            Dispara ráfagas concurrentes de transacciones de \$9,000 para auditar las reglas del sistema Antifraude.
          </p>
        </div>
      </div>

      {/* Panel de Configuración / Estado de Carga */}
      {!data && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Configurar Simulación</h2>
          <form onSubmit={handleIniciarAtaque} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cantidad de cuentas bajo ataque simultáneo
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={cantidadCuentas}
                onChange={(e) => setCantidadCuentas(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                Cada cuenta recibirá una ráfaga secuencial de 4 transacciones de \$9,000 (total \$36,000).
              </p>
            </div>
            <button
              type="submit"
              disabled={lanzando}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:bg-slate-400"
            >
              {lanzando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              Lanzar Ataque de Lavado
            </button>
          </form>
        </div>
      )}

      {/* Estado: PROCESSING (Pantalla de Espera Interactiva) */}
      {data?.status === 'PROCESSING' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center max-w-2xl mx-auto space-y-4">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mx-auto" />
          <div>
            <h3 className="text-xl font-bold">Ejecutando Simulación de Fraude...</h3>
            <p className="text-slate-500 text-sm mt-1">{data.message}</p>
            <p className="text-xs text-slate-400 mt-2 font-mono bg-slate-200/60 inline-block px-2 py-1 rounded">
              ID: {simulationId}
            </p>
          </div>
          <div className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-lg p-3">
            Las transacciones se envían con retrasos controlados de 1.5s para emular el umbral de acumulación de volumen.
          </div>
        </div>
      )}

      {/* Manejo de Errores del Polling */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
          <strong>Error en el proceso:</strong> {error}
        </div>
      )}

      {/* Estado: COMPLETED (Dashboard de Resultados) */}
      {data?.status === 'COMPLETED' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
            <span className="text-sm text-emerald-800 font-medium">
              ✓ Simulación completada con éxito. Datos extraídos de la memoria caché de Redis.
            </span>
            <button
              onClick={resetSimulation}
              className="flex items-center gap-1 text-xs bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Nueva Prueba
            </button>
          </div>

          {/* Sección de Paneles y Gráficos */}
          <FraudResultsSummary resumen={data.resumen} total={data.total_transacciones_enviadas || 0} />

          {/* Tabla de Cronograma de Transacciones */}
          <FraudTimelineTable cronograma={data.cronograma || []} />
        </div>
      )}
    </div>
  );
}