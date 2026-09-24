"use client";

import { useEffect, useState } from "react";
import DashboardCollapsibleCard from "@/components/dashboard/DashboardCollapsibleCard";
import { formatDienstDatum, formatDienstTijd } from "@/lib/planning/tijd";

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
  return formatDienstDatum(datum);
}

function tijd(datum: string) {
  return formatDienstTijd(datum);
}

export default function OwnerUpcomingServices({ gebruikerId }: { gebruikerId: string }) {
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
      <DashboardCollapsibleCard
        storageKey={`owner-aankomende-diensten-${gebruikerId}`}
        title="Mijn aankomende diensten"
        description="Je eigen ingeplande diensten als eigenaar."
        count={diensten.length}
      >
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
      </DashboardCollapsibleCard>
    </section>
  );
}
