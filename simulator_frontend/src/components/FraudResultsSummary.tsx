import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CheckCircle, ShieldX, AlertTriangle } from 'lucide-react';

interface SummaryProps {
  total: number;
  resumen?: {
    exitosas: number;
    bloqueadas_403_antifraude?: number;
    fallidas_sistema?: number;
  };
}

export default function FraudResultsSummary({ resumen, total }: SummaryProps) {
  const exitosas = resumen?.exitosas || 0;
  const bloqueadas = resumen?.bloqueadas_403_antifraude || 0;
  const fallidas = resumen?.fallidas_sistema || 0;

  // Datos estructurados para la gráfica de Recharts
  const dataGrafica = [
    { name: 'Exitosas (Fuga de Dinero)', value: exitosas, color: '#ef4444' }, // Rojo porque en fraude que pase está mal
    { name: 'Bloqueadas por Antifraude', value: bloqueadas, color: '#10b981' }, // Verde porque el sistema se defendió
    { name: 'Fallos de Red/Sistema', value: fallidas, color: '#f59e0b' },
  ].filter(item => item.value > 0); // Evitamos renderizar elementos en cero

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna de Tarjetas de Indicadores */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        {/* Card Total */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-sm text-slate-500 font-medium">Total Solicitudes</span>
          <div className="text-3xl font-bold mt-1 text-slate-900">{total}</div>
        </div>

        {/* Card Bloqueadas (Éxito del Antifraude) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-500 font-medium">Defendidas (403)</span>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{bloqueadas}</div>
          </div>
          <ShieldX className="h-10 w-10 text-emerald-500/20" />
        </div>

        {/* Card Exitosas (Vulnerabilidades/Fuga) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-500 font-medium font-semibold text-red-600">Fugas Permitidas</span>
            <div className="text-2xl font-bold mt-1 text-red-600">{exitosas}</div>
          </div>
          <CheckCircle className="h-10 w-10 text-red-500/20" />
        </div>
      </div>

      {/* Columna del Gráfico Estadístico */}
      <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-[260px]">
        <h3 className="text-sm font-semibold text-slate-600">Distribución del Comportamiento Antifraude</h3>
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataGrafica}
                cx="40%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {dataGrafica.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} txs`, 'Cantidad']} />
              <Legend layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}