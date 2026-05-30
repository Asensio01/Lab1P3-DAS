import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ShieldCheck, Zap, ServerCrash } from 'lucide-react';

interface StressSummaryProps {
  total: number;
  resumen?: {
    exitosas: number;
    bloqueadas_403?: number;
    fallidas: number;
  };
}

export default function StressResultsSummary({ resumen, total }: StressSummaryProps) {
  const exitosas = resumen?.exitosas || 0;
  const bloqueadas = resumen?.bloqueadas_403 || 0;
  const fallidas = resumen?.fallidas || 0;

  // Formato de datos para la gráfica de barras de Recharts
  const dataGrafica = [
    { name: 'Exitosas (200 OK)', cantidad: exitosas, color: '#3b82f6' },      // Azul: Tráfico procesado
    { name: 'Bloqueadas (403)', cantidad: bloqueadas, color: '#10b981' },    // Verde: Mitigación exitosa
    { name: 'Errores (500/Timeout)', cantidad: fallidas, color: '#ef4444' }, // Rojo: Sistema saturado
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tarjetas Laterales */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-500 font-medium">Volumen Total Enviado</span>
            <div className="text-3xl font-bold mt-1 text-slate-900">{total} <span className="text-xs font-normal text-slate-400">reqs</span></div>
          </div>
          <Zap className="h-8 w-8 text-blue-500/20" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-500 font-medium">Peticiones Mitigadas</span>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{bloqueadas}</div>
          </div>
          <ShieldCheck className="h-8 w-8 text-emerald-500/20" />
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-sm text-slate-500 font-medium">Caídas / Errores 500</span>
            <div className="text-2xl font-bold mt-1 text-red-600">{fallidas}</div>
          </div>
          <ServerCrash className="h-8 w-8 text-red-500/20" />
        </div>
      </div>

      {/* Gráfico de Barras */}
      <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-[270px]">
        <h3 className="text-sm font-semibold text-slate-600 mb-2">Respuesta del Servidor bajo Carga Crítica</h3>
        <div className="w-full h-full min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataGrafica} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} className="text-xs font-medium text-slate-500" />
              <YAxis axisLine={false} tickLine={false} className="text-xs text-slate-400" />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value) => [`${value} Peticiones`, 'Cantidad']} />
              <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} barSize={50}>
                {dataGrafica.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}