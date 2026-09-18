"use client";

import { useEffect, useState } from "react";

type ChecklistItem = { key: string; label: string; klaar: boolean };
type WorkflowTaak = {
  id: string;
  type: string;
  categorie: string;
  titel: string;
  omschrijving: string;
  actie: string;
  aangemaaktOp: string;
  gegevens?: { href?: string; medewerkerId?: string; checklist?: ChecklistItem[] };
};

const EIGENAAR_ACTIES = new Set([
  "MEDEWERKER_ROL_TOEWIJZEN",
  "MEDEWERKER_DOSSIER_INVULLEN",
]);

function variantKlassen(actie: string) {
  if (actie === "MEDEWERKER_ROL_TOEWIJZEN" || actie === "INACTIEVE_MEDEWERKERS_PLANNING") return "bg-red-500";
  return "bg-blue-500";
}

function uniekeActieveTaken(data: WorkflowTaak[]) {
  const gezien = new Set<string>();
  return data.filter((taak) => {
    if (!EIGENAAR_ACTIES.has(taak.actie)) return false;
    const medewerkerId = taak.gegevens?.medewerkerId;
    const sleutel = medewerkerId ? `${taak.actie}:${medewerkerId}` : taak.id;
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
}

export default function OwnerWorkflowTasks() {
  const [taken, setTaken] = useState<WorkflowTaak[]>([]);

  useEffect(() => {
    let actief = true;
    async function laadTaken() {
      try {
        const response = await fetch("/api/taken/medewerker-workflow", { cache: "no-store", credentials: "include" });
        if (!response.ok || !actief) return;
        const data = (await response.json()) as WorkflowTaak[];
        if (actief) setTaken(uniekeActieveTaken(data));
      } catch {
        // Dashboard blijft bruikbaar als de workflow-feed tijdelijk niet bereikbaar is.
      }
    }
    void laadTaken();
    const interval = window.setInterval(() => void laadTaken(), 15000);
    return () => { actief = false; window.clearInterval(interval); };
  }, []);

  if (taken.length === 0) return null;

  return (
    <section>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Openstaande medewerkerstaken</h2>
          <p className="mt-1 text-sm text-slate-500">Nieuwe medewerkers die nog een actie van de eigenaar nodig hebben.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {taken.map((taak) => {
            const href = taak.gegevens?.href;
            if (!href) return null;
            const checklist = taak.gegevens?.checklist ?? [];
            const afgerond = checklist.filter((item) => item.klaar).length;
            return (
              <a key={taak.id} href={href} className="group block py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${variantKlassen(taak.actie)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 group-hover:text-slate-700">{taak.titel}</p>
                      <p className="mt-1 text-sm text-slate-500">{taak.omschrijving}</p>
                      {checklist.length > 0 && (
                        <>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {checklist.map((item) => (
                              <div key={item.key} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.klaar ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                                  {item.klaar ? "✓" : ""}
                                </span>
                                <span className={`text-xs ${item.klaar ? "text-slate-600" : "font-semibold text-slate-900"}`}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-xs font-medium text-slate-400">{afgerond} van {checklist.length} onderdelen compleet</p>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 pt-1 text-slate-400">→</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
