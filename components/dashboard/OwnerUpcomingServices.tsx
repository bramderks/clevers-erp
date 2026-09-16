"use client";

import { useEffect, useState } from "react";

type Dienst = {
  id: string;
  datum: string;
  begintijd: string;
  eindtijd: string;
  vestigingNaam: string;
};

type WorkflowTaak = {
  actie: string;
  gegevens?: { diensten?: Dienst[] };
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

export default function OwnerUpcomingServices() {
  const [diensten, setDiensten] = useState<Dienst[]>([]);

  useEffect(() => {
    let actief = true;
    async function laden() {
      try {
        const response = await fetch("/api/taken/medewerker-workflow", { cache: "no-store", credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as WorkflowTaak[];
        const taak = data.find((item) => item.actie === "EIGENAAR_AANKOMENDE_DIENSTEN");
        if (actief) setDiensten(taak?.gegevens?.diensten ?? []);
      } catch {
        // Geen diensten tonen wanneer de workflow-feed tijdelijk niet bereikbaar is.
      }
    }
    void laden();
    const interval = window.setInterval(() => void laden(), 15000);
    return () => { actief = false; window.clearInterval(interval); };
  }, []);

  if (diensten.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Mijn aankomende diensten</h2>
          <p className="mt-1 text-sm text-slate-500">Je eigen ingeplande diensten als eigenaar.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {diensten.map((dienst) => (
            <a key={dienst.id} href={`/planning/dienst/${dienst.id}`} className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div>
                <p className="font-medium capitalize text-slate-900">{datum(dienst.datum)}</p>
                <p className="mt-1 text-sm text-slate-500">{tijd(dienst.begintijd)} - {tijd(dienst.eindtijd)}</p>
                <p className="mt-1 text-sm text-slate-400">{dienst.vestigingNaam}</p>
              </div>
              <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1">→</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
