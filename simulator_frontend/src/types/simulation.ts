// src/types/simulation.ts

export type SimulationStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type SimulationType = 'FRAUDE' | 'ESTRES' | 'TOKEN_EXPIRADO';

export interface TransactionReport {
  status: 'SUCCESS' | 'BLOCKED' | 'REJECTED' | 'FAILED';
  status_code: number;
  intentos: number;
  transaction: {
    account_id: number;
    amount: number;
    ip: string;
    country: string;
  };
  details?: any;
}

export interface SimulationResponse {
  status: SimulationStatus;
  tipo_simulacion?: SimulationType;
  message?: string;
  total_enviadas?: number;
  total_transacciones_enviadas?: number; // Para fraude
  cuentas_atacadas?: number[];
  resumen?: {
    exitosas: number;
    bloqueadas_403?: number;             // Para estrés
    bloqueadas_403_antifraude?: number;  // Para fraude
    fallidas: number;
    fallidas_sistema?: number;           // Para fraude
  };
  cronograma?: TransactionReport[];
  resultado?: {                          // Para token expirado
    status_code: number;
    detail: any;
  };
}