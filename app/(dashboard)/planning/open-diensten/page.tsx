"use client";

import { useEffect, useState } from "react";

type Interesse = {
  interesseId: string;
  dienstBezettingId: string;
  medewerkerId: string | null;
  medewerkerNaam: string;
  aangemeldOp: string;
  dienst: {
    datum: string;
    begintijd: string;
    eindtijd: string;
    week: { vestiging: { naam: string } };
  };
};

export default function OpenDienstenPage() {
  const [items, setItems] = useState<Interesse[]>([]);
  const [laden, setLaden] = useState(true);
  const [bericht, setBericht] = useState("");

  async function laadOpenDiensten() {
    setLaden(true);
    const response = await fetch("/api/open-diensten/beoordelen", { cache: "no-store" });
    const data = await response.json();
    setItems(Array.isArray(data) ? data : []);
    setLaden(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void laadOpenDiensten();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function toewijzen(item: Interesse) {
    if (!item.medewerkerId) return;

    const response = await fetch("/api/open-diensten/beoordelen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dienstBezettingId: item.dienstBezettingId,
        medewerkerId: item.medewerkerId,
      }),
    });

    const data = await response.json();
    setBericht(response.ok ? "Medewerker definitief toegewezen." : data.fout ?? "Toewijzen mislukt.");
    if (response.ok) await laadOpenDiensten();
  }

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Eigenaar</p>
        <h1 className="text-2xl font-bold text-slate-900">Open diensten</h1>
        <p className="mt-1 text-sm text-slate-600">
          Beoordeel medewerkers die interesse hebben getoond en wijs de dienst definitief toe.
        </p>
      </div>

      {bericht && <p className="rounded-xl border bg-white p-4 text-sm">{bericht}</p>}

      {laden ? (
        <p className="text-sm text-slate-500">Laden...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          Er zijn momenteel geen openstaande interesseverzoeken.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.interesseId} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="font-bold text-slate-900">{item.medewerkerNaam}</p>
              <p className="mt-1 text-sm text-slate-600">
                {item.dienst.week.vestiging.naam} · {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(new Date(item.dienst.datum))}
              </p>
              <button
                onClick={() => void toewijzen(item)}
                disabled={!item.medewerkerId}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                Definitief toewijzen
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
