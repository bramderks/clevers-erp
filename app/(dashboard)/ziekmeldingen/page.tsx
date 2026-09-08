"use client";

import { useEffect, useState } from "react";

type Ziekmelding = {
  id: string;
  ziekVanaf: string;
  opmerking: string | null;
  medewerker: { voornaam: string; achternaam: string };
};

export default function ZiekmeldingenPage() {
  const [meldingen, setMeldingen] = useState<Ziekmelding[]>([]);
  const [bericht, setBericht] = useState("");

  async function laad() {
    const response = await fetch("/api/ziekmeldingen", { cache: "no-store" });
    const data = await response.json();
    setMeldingen(Array.isArray(data) ? data : []);
  }

  useEffect(() => { void laad(); }, []);

  async function herstel(id: string) {
    const response = await fetch("/api/ziekmeldingen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    setBericht(response.ok ? "Medewerker als hersteld geregistreerd." : data.fout ?? "Actie mislukt.");
    if (response.ok) await laad();
  }

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Eigenaar</p>
        <h1 className="text-2xl font-bold text-slate-900">Ziekmeldingen</h1>
      </div>

      {bericht && <p className="rounded-xl border bg-white p-4 text-sm">{bericht}</p>}

      {meldingen.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Geen actieve ziekmeldingen.</div>
      ) : (
        <div className="space-y-3">
          {meldingen.map((melding) => (
            <article key={melding.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="font-bold text-slate-900">
                {melding.medewerker.voornaam} {melding.medewerker.achternaam}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Ziek sinds {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(melding.ziekVanaf))}
              </p>
              {melding.opmerking && <p className="mt-3 text-sm text-slate-600">{melding.opmerking}</p>}
              <button onClick={() => void herstel(melding.id)} className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                Als hersteld registreren
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
