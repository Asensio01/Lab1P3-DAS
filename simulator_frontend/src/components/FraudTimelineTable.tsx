import React from 'react';
import type { TransactionReport } from '../types/simulation';

interface TableProps {
  cronograma: TransactionReport[];
}

export default function FraudTimelineTable({ cronograma }: TableProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-700">Cronograma de Auditoría de Transacciones</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/70 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <th className="px-6 py-3">Cuenta ID</th>
              <th className="px-6 py-3">Monto</th>
              <th className="px-6 py-3">Origen IP</th>
              <th className="px-6 py-3">País</th>
              <th className="px-6 py-3">Intentos (Backoff)</th>
              <th className="px-6 py-3">Estatus HTTP</th>
              <th className="px-6 py-3 text-right">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
            {cronograma.map((report, idx) => {
              // Definición dinámica de colores por estado
              let badgeStyle = "bg-slate-100 text-slate-700";
              if (report.status === 'BLOCKED') badgeStyle = "bg-emerald-100 text-emerald-800 font-semibold";
              if (report.status === 'SUCCESS') badgeStyle = "bg-red-100 text-red-800 font-semibold";
              if (report.status === 'FAILED') badgeStyle = "bg-amber-100 text-amber-800";

              return (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3.5 font-mono font-medium text-slate-900">
                    #{report.transaction.account_id}
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">
                    ${Number(report.transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-500">
                    {report.transaction.ip}
                  </td>
                  <td className="px-6 py-3.5 text-slate-600">
                    {report.transaction.country}
                  </td>
                  <td className="px-6 py-3.5 text-center font-medium">
                    {report.intentos}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="font-mono bg-slate-100 border border-slate-300/60 px-2 py-0.5 rounded text-xs text-slate-600">
                      {report.status_code}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs ${badgeStyle}`}>
                      {report.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}