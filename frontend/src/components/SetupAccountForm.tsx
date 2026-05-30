import { useState } from "react";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

interface SetupAccountFormProps {
  token: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function SetupAccountForm({ token, onSuccess, onError }: SetupAccountFormProps) {
  const [fullName, setFullName] = useState<string>("");
  const [dui, setDui] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [initialBalance, setInitialBalance] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // Prepare the payload according to backend API
      const payload = {
        user_info: {
          name: fullName.trim(),
          dui: dui.trim(),
          house_location: location.trim()
        },
        initial_balance: initialBalance ? parseFloat(initialBalance) : 0
      };

      // Make the POST request with Bearer token
      const response = await fetch("http://localhost:8000/api/v1/me/account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Error: ${response.status} ${response.statusText}`
        );
      }

      // Clear form and notify success
      setFullName("");
      setDui("");
      setLocation("");
      setInitialBalance("");
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al crear cuenta";
      setErrorMsg(message);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <Card className="w-full border-cyan-400/20 bg-[#0b1220]/90 p-6 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">
            FINTECH GUARD // ACCOUNT SETUP
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Configurar Cuenta</h1>
          <p className="mt-2 text-sm text-slate-300">
            Completa los datos para crear tu cuenta financiera y comenzar a operar.
          </p>

          <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                Nombre Completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:opacity-50"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                DUI
              </label>
              <input
                type="text"
                value={dui}
                onChange={(e) => setDui(e.target.value)}
                required
                disabled={isLoading}
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:opacity-50"
                placeholder="01234567-8"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                Dirección Corta
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                disabled={isLoading}
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:opacity-50"
                placeholder="Calle Principal 123"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">
                Saldo Inicial
              </label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min={0}
                step={0.01}
                disabled={isLoading}
                className="w-full rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/70 disabled:opacity-50"
                placeholder="1000.00"
              />
            </div>

            {errorMsg && (
              <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
