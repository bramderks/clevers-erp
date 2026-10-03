"use client";

import { useState } from "react";

export default function ImportSeptember2026Page() {
  const [bezig, setBezig] = useState(false);
  const [tagsBezig, setTagsBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Record<string, unknown> | null>(null);

  async function herstelTags() {
    if (!window.confirm("Alle diensten van september 2026 opnieuw taggen? Jessica, Bram, Andrea, Pleun Kamps en Jayro worden Leidinggevende; alle overige diensten worden Handijs.")) return;
    setTagsBezig(true);
    setResultaat(null);
    try {
      const response = await fetch("/api/admin/herstel-tags-september-2026", { method: "POST" });
      const json = await response.json();
      setResultaat(json);
    } catch {
      setResultaat({ fout: "Er ging iets mis bij het herstellen van de tags." });
    } finally {
      setTagsBezig(false);
    }
  }

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
          Importeert de 79 diensten uit het aangeleverde rooster voor medewerkers die actief in Nijmegen in ERP staan. Opnieuw uitvoeren is veilig: bestaande diensten worden niet gedupliceerd en eerder verkeerd opgeslagen kalenderdatums worden automatisch hersteld.
          Andrea de Bock wordt gekoppeld aan Andrea de Bock - Berghmans.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Lisa Bergs, Mauro Markovic en Taylor Weijers worden bewust overgeslagen.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Voor het herstellen van de planningstags geldt: Jessica Derks, Bram Derks, Andrea de Bock, Pleun Kamps en Jayro Peters krijgen <strong>Leidinggevende</strong>. Alle overige septemberdiensten krijgen <strong>Handijs</strong>.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={herstelTags}
            disabled={tagsBezig || bezig}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tagsBezig ? "Tags herstellen..." : "Tags september herstellen"}
          </button>

          <button
            type="button"
            onClick={importeer}
            disabled={bezig || tagsBezig}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bezig ? "Importeren..." : "September 2026 importeren"}
          </button>
        </div>

        {resultaat && (
          <pre className="mt-6 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
            {JSON.stringify(resultaat, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
