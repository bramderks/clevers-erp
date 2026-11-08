"use client";

import { useState } from "react";
import { CalendarDays, Check, Clock3, History } from "lucide-react";

const OPTIES = [
  {
    waarde: "VANDAAG",
    nummer: "1",
    titel: "Spring naar vandaag",
    omschrijving:
      "Het planbord opent automatisch bij de huidige dag. Ideaal om direct de personeelsbezetting van vandaag te controleren.",
    Icon: CalendarDays,
  },
  {
    waarde: "LAATSTE_POSITIE",
    nummer: "2",
    titel: "Onthoud mijn laatste positie",
    omschrijving:
      "Je keert terug naar de week waar je tijdens je vorige bezoek bent gebleven. Handig als je vaak vooruit of terug plant.",
    Icon: History,
  },
  {
    waarde: "HUIDIGE_WEEK",
    nummer: "3",
    titel: "Spring naar de huidige week",
    omschrijving:
      "Het planbord opent standaard op maandag van de huidige kalenderweek, ongeacht waar je de vorige keer bent gebleven.",
    Icon: Clock3,
  },
] as const;

type PlanningWeergave = (typeof OPTIES)[number]["waarde"];

type Props = {
  initialValue: string;
};

export default function PlanningWeergaveSettings({ initialValue }: Props) {
  const geldigeBeginwaarde = OPTIES.some(
    (optie) => optie.waarde === initialValue,
  )
    ? (initialValue as PlanningWeergave)
    : "HUIDIGE_WEEK";

  const [waarde, setWaarde] = useState<PlanningWeergave>(geldigeBeginwaarde);
  const [opslaan, setOpslaan] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  async function wijzigInstelling(nieuweWaarde: PlanningWeergave) {
    if (nieuweWaarde === waarde || opslaan) return;

    setOpslaan(true);
    setMelding(null);
    setFout(null);

    try {
      const response = await fetch("/api/instellingen/planning-weergave", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planningWeergave: nieuweWaarde }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.fout ?? "De planningweergave kon niet worden opgeslagen.",
        );
      }

      setWaarde(nieuweWaarde);
      setMelding("Je voorkeur is opgeslagen.");
    } catch (error) {
      setFout(
        error instanceof Error
          ? error.message
          : "De planningweergave kon niet worden opgeslagen.",
      );
    } finally {
      setOpslaan(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {OPTIES.map(({ waarde: optieWaarde, nummer, titel, omschrijving, Icon }) => {
          const geselecteerd = waarde === optieWaarde;
          const stijl = geselecteerd
            ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";

          return (
            <label
              key={optieWaarde}
              className={"flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition " + stijl + (opslaan ? " pointer-events-none opacity-70" : "")}
            >
              <input
                type="radio"
                name="planningWeergave"
                value={optieWaarde}
                checked={geselecteerd}
                onChange={() => void wijzigInstelling(optieWaarde)}
                disabled={opslaan}
                className="mt-1 h-4 w-4 shrink-0 border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200">
                <Icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">
                    OPTIE {nummer}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {titel}
                  </span>
                  {geselecteerd && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <Check size={12} />
                      Gekozen
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  {omschrijving}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {opslaan && (
        <p className="text-sm text-slate-500" role="status">
          Je voorkeur wordt opgeslagen...
        </p>
      )}
      {melding && (
        <p className="text-sm font-medium text-emerald-700" role="status">
          {melding}
        </p>
      )}
      {fout && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {fout}
        </p>
      )}
    </div>
  );
}
