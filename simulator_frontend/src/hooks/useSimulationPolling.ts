// src/hooks/useSimulationPolling.ts
import { useState, useEffect, useRef } from 'react';
import simulatorApi from '../api/simulatorApi';
import type { SimulationResponse } from '../types/simulation';

export const useSimulationPolling = (intervalMs: number = 2000) => {
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [data, setData] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Usamos una referencia para el intervalo para poder limpiarlo en cualquier momento
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = (id: string) => {
    // Limpiar cualquier polling previo activo
    if (timerRef.current) clearInterval(timerRef.current);
    
    setSimulationId(id);
    setLoading(true);
    setError(null);
    setData({ status: 'PROCESSING', message: 'Iniciando conexión con el servidor...' });
  };

  useEffect(() => {
    if (!simulationId) return;

    const checkStatus = async () => {
      try {
        const response = await simulatorApi.get<SimulationResponse>(`/api/v1/simulations/status/${simulationId}`);
        setData(response.data);

        // Si terminó o falló, limpiamos el temporizador y apagamos el loading global
        if (response.data.status === 'COMPLETED' || response.data.status === 'FAILED') {
          setLoading(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Error al consultar el estado de la simulación');
        setLoading(false);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    // Ejecutar la primera consulta de inmediato
    checkStatus();

    // Configurar el bucle recurrente
    timerRef.current = setInterval(checkStatus, intervalMs);

    // Limpieza cuando el componente se desmonte
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [simulationId, intervalMs]);

  const resetSimulation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSimulationId(null);
    setData(null);
    setLoading(false);
    setError(null);
  };

  return { data, loading, error, startPolling, resetSimulation, simulationId };
};