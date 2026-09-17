"use client";

import { useState } from "react";

export type OpenDienstDashboardItem = {
  id: string;
  datum: string;
  begintijd: string;
  eindtijd: string;
  vestigingNaam: string;
  tags: string[];
  interesseGemeld: boolean;
};

function datum(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(datum));
}

function tijd(datum: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(datum));
}

export default function OpenDienstenMedewerker({
  diensten,
}: {
  diensten: OpenDienstDashboardItem[];
}) {
  const [items, setItems] = useState(diensten);
  const [laden, setLaden] = useState<string | null>(null);
  const [melding, setMelding] = useState("");

  async function beschikbaarDoorgeven(id: string) {
    setLaden(id);
    setMelding("");

    try {
      const response = await fetch("/api/open-diensten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dienstBezettingId: id }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMelding(data.fout ?? "Je beschikbaarheid kon niet worden doorgegeven.");
        return;
      }

      setItems((huidig) =>
        huidig.map((item) =>
          item.id === id ? { ...item, interesseGemeld: true } : item,
        ),
      );
      setMelding("Je beschikbaarheid is doorgegeven. De eigenaar beslist over de definitieve indeling.");
    } catch {
      setMelding("Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setLaden(null);
    }
  }

  return (
    <section>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Open diensten</h2>
          <p className="mt-1 text-sm text-slate-500">
            Diensten die nog niet zijn ingevuld en passen bij jouw planningstags.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="font-medium text-slate-900">Geen open diensten</p>
            <p className="mt-1 text-sm text-slate-500">
              Er zijn momenteel geen open diensten die bij jouw planningstags passen.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <article key={item.id} className="px-5 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium capitalize text-slate-900">{datum(item.datum)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {tijd(item.begintijd)} - {tijd(item.eindtijd)} · {item.vestigingNaam}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={laden === item.id || item.interesseGemeld}
                    onClick={() => void beschikbaarDoorgeven(item.id)}
                    className="shrink-0 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-default disabled:opacity-50"
                  >
                    {item.interesseGemeld
                      ? "Beschikbaarheid doorgegeven"
                      : laden === item.id
                        ? "Bezig..."
                        : "Ik ben beschikbaar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {melding && (
          <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
            {melding}
          </p>
        )}
      </div>
    </section>
  );
}
