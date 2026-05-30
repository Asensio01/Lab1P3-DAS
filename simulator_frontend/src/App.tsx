// src/App.tsx (Actualizado para dos pestañas)
import React, { useState } from 'react';
import FraudSimulation from './pages/FraudSimulation.tsx';
import StressSimulation from './pages/StressSimulation.tsx';

function App() {
  const [currentTab, setCurrentTab] = useState<'fraud' | 'stress'>('fraud');

  return (
    <div className="min-h-screen bg-slate-100 font-sans antialiased">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            🛡️ Panel de Auditoría de Seguridad FinTech
          </span>
          {/* Botones de Navegación */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentTab('fraud')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'fraud' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Auditoría de Fraude
            </button>
            <button
              onClick={() => setCurrentTab('stress')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'stress' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pruebas de Estrés (DDoS)
            </button>
          </div>
        </div>
      </nav>

      <main className="py-6">
        {currentTab === 'fraud' ? <FraudSimulation /> : <StressSimulation />}
      </main>
    </div>
  );
}

export default App;