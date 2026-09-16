"use client";

import { useEffect, useState } from "react";

type WorkflowTaak = {
  id: string;
  type: string;
  categorie: string;
  titel: string;
  omschrijving: string;
  actie: string;
  aangemaaktOp: string;
  gegevens?: {
    href?: string;
    medewerkerId?: string;
  };
};

const EIGENAAR_ACTIES = new Set([
  "MEDEWERKER_ROL_TOEWIJZEN",
  "MEDEWERKER_DOSSIER_INVULLEN",
]);

function variantKlassen(actie: string) {
  switch (actie) {
    case "MEDEWERKER_ROL_TOEWIJZEN":
      return "bg-red-500";
    case "MEDEWERKER_DOSSIER_INVULLEN":
    default:
      return "bg-blue-500";
  }
}

export default function OwnerWorkflowTasks() {
  const [taken, setTaken] = useState<WorkflowTaak[]>([]);

  useEffect(() => {
    let actief = true;

    async function laadTaken() {
      try {
        const response = await fetch(
          "/api/taken/medewerker-workflow",
          {
            cache: "no-store",
            credentials: "include",
          },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as WorkflowTaak[];

        if (!actief) {
          return;
        }

        setTaken(
          data.filter((taak) => EIGENAAR_ACTIES.has(taak.actie)),
        );
      } catch {
        // Het bestaande dashboard mag nooit breken wanneer de workflow-feed tijdelijk niet beschikbaar is.
      }
    }

    void laadTaken();

    return () => {
      actief = false;
    };
  }, []);

  if (taken.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Openstaande medewerkerstaken
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Nieuwe medewerkers die nog een actie van de eigenaar nodig hebben.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {taken.map((taak) => {
            const href = taak.gegevens?.href;

            return href ? (
              <a
                key={taak.id}
                href={href}
                className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={`h-3 w-3 shrink-0 rounded-full ${variantKlassen(
                      taak.actie,
                    )}`}
                  />

                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 transition-colors group-hover:text-slate-700">
                      {taak.titel}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {taak.omschrijving}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1">
                  →
                </span>
              </a>
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}
