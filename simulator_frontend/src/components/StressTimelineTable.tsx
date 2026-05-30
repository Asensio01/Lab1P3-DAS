import React from 'react';
import type { TransactionReport } from '../types/simulation.ts';

interface StressTableProps {
  cronograma: TransactionReport[];
}

export default function StressTimelineTable({ cronograma }: StressTableProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <h3 className="font-semibold text-slate-700">Muestra del Logs de Ráfaga Masiva</h3>
        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-mono">
          IP Origen Única: 192.168.100.50
        </span>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 shadow-sm">
            <tr className="text-slate-600 text-xs font-semibold uppercase tracking-wider">
              <th className="px-6 py-3">ID Cuenta Target</th>
              <th className="px-6 py-3">Monto Inyectado</th>
              <th className="px-6 py-3">País Sim.</th>
              <th className="px-6 py-3">Código HTTP</th>
              <th className="px-6 py-3 text-right">Estatus Interno</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            {cronograma.map((report, idx) => {
              let badgeStyle = "bg-slate-100 text-slate-700";
              if (report.status === 'SUCCESS') badgeStyle = "bg-blue-100 text-blue-800";
              if (report.status === 'BLOCKED') badgeStyle = "bg-emerald-100 text-emerald-800 font-semibold";
              if (report.status === 'FAILED') badgeStyle = "bg-red-100 text-red-800";

              return (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-2.5 font-mono text-slate-900">
                    acc_{report.transaction.account_id}
                  </td>
                  <td className="px-6 py-2.5 font-medium text-slate-900">
                    ${Number(report.transaction.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-2.5 text-slate-500">
                    {report.transaction.country}
                  </td>
                  <td className="px-6 py-2.5">
                    <span className={`font-mono px-2 py-0.5 rounded text-xs ${
                      report.status_code === 200 ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}>
                      {report.status_code}
                    </span>
                  </td>
                  <td className="px-6 py-2.5 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeStyle}`}>
                      {report.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-right font-medium">
        Mostrando las últimas {cronograma.length} transacciones de la ráfaga.
      </div>
    </div>
  );
}