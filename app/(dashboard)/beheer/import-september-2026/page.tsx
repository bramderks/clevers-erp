"use client";

import { useState } from "react";

export default function ImportSeptember2026Page() {
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Record<string, unknown> | null>(null);

  async function importeer() {
    if (!window.confirm("September 2026 importeren? Alleen de 14 gekoppelde medewerkers worden toegevoegd. Lisa Bergs, Mauro Markovic en Taylor Weijers worden overgeslagen.")) return;
    setBezig(true);
    setResultaat(null);
    try {
      const response = await fetch("/api/admin/import-september-2026", { method: "POST" });
      const json = await response.json();
      setResultaat(json);
    } catch {
      setResultaat({ fout: "Er ging iets mis bij het uitvoeren van de import." });
    } finally {
      setBezig(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">September 2026 rooster importeren</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Importeert de 79 diensten uit het aangeleverde rooster voor medewerkers die actief in Nijmegen in ERP staan.
          Andrea de Bock wordt gekoppeld aan Andrea de Bock - Berghmans.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Lisa Bergs, Mauro Markovic en Taylor Weijers worden bewust overgeslagen. De geïmporteerde diensten krijgen de planningstag Bediening.
          Bestaande diensten op exact dezelfde datum en tijden worden hergebruikt om dubbele diensten te voorkomen.
        </p>
        <button
          type="button"
          onClick={importeer}
          disabled={bezig}
          className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bezig ? "Importeren..." : "September 2026 importeren"}
        </button>
        {resultaat && (
          <pre className="mt-6 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
            {JSON.stringify(resultaat, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
