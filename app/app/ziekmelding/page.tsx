"use client";

import { FormEvent, useEffect, useState } from "react";

type Ziekmelding = {
  id: string;
  ziekVanaf: string;
  verwachtHersteldOp: string | null;
  hersteldOp: string | null;
  opmerking: string | null;
  status: string;
};

export default function ZiekmeldingPage() {
  const [meldingen, setMeldingen] = useState<Ziekmelding[]>([]);
  const [opmerking, setOpmerking] = useState("");
  const [verwachtHersteldOp, setVerwachtHersteldOp] = useState("");
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [bericht, setBericht] = useState("");

  async function ladenMeldingen() {
    setLaden(true);
    const response = await fetch("/api/app/ziekmelding", { cache: "no-store" });
    const data = await response.json();
    setMeldingen(Array.isArray(data) ? data : []);
    setLaden(false);
  }

  useEffect(() => {
    void ladenMeldingen();
  }, []);

  async function versturen(event: FormEvent) {
    event.preventDefault();
    setBezig(true);
    setBericht("");

    const response = await fetch("/api/app/ziekmelding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ziekVanaf: new Date().toISOString(),
        verwachtHersteldOp: verwachtHersteldOp || null,
        opmerking,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setBericht(data.fout ?? "Ziekmelding kon niet worden verstuurd.");
    } else {
      setBericht("Je ziekmelding is doorgegeven aan de organisatie.");
      setOpmerking("");
      setVerwachtHersteldOp("");
      await ladenMeldingen();
    }

    setBezig(false);
  }

  const actief = meldingen.find((melding) => melding.status === "ZIEK");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 pb-28">
      <div className="mx-auto max-w-lg space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Persoonlijk
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Ziekmelding</h1>
          <p className="mt-1 text-sm text-slate-600">
            Geef je ziekmelding direct door. De eigenaar kan de gevolgen voor de planning beoordelen.
          </p>
        </header>

        {actief ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-bold text-slate-900">Actieve ziekmelding</h2>
            <p className="mt-2 text-sm text-slate-600">
              Je hebt momenteel een actieve ziekmelding. Neem contact op met de eigenaar zodra je hersteld bent.
            </p>
          </section>
        ) : (
          <form onSubmit={versturen} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Verwachte hersteldatum
              </label>
              <input
                type="date"
                value={verwachtHersteldOp}
                onChange={(event) => setVerwachtHersteldOp(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Opmerking (optioneel)
              </label>
              <textarea
                value={opmerking}
                onChange={(event) => setOpmerking(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <button
              disabled={bezig}
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {bezig ? "Bezig..." : "Ziek melden"}
            </button>
          </form>
        )}

        {bericht && (
          <p className="rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            {bericht}
          </p>
        )}

        {!laden && meldingen.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-bold text-slate-900">Geschiedenis</h2>
            <div className="mt-4 space-y-3">
              {meldingen.map((melding) => (
                <div key={melding.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{melding.status}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Vanaf {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(melding.ziekVanaf))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
