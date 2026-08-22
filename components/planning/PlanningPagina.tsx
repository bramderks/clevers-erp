"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import PlanningOverzicht from "@/components/planning/PlanningOverzicht";
import PlanningVestigingSelect from "@/components/planning/PlanningVestigingSelect";
import type { PlanningWeek } from "@/types/planning";

type Vestiging = {
  id: string;
  naam: string;
};

type PlanningPaginaProps = {
  vestigingen: Vestiging[];
  isEigenaar?: boolean;
  isTeamleider?: boolean;
  isMedewerker?: boolean;
};

export default function PlanningPagina({
  vestigingen,
  isEigenaar = false,
  isTeamleider = false,
  isMedewerker = false,
}: PlanningPaginaProps) {
  const [vestigingId, setVestigingId] =
    useState<string>(
      vestigingen[0]?.id ?? "",
    );

  const [weken, setWeken] =
    useState<PlanningWeek[]>([]);

  const [laden, setLaden] =
    useState(true);

  const [fout, setFout] =
    useState<string | null>(null);

  const laadPlanning =
    useCallback(async () => {
      if (!vestigingId) {
        setWeken([]);
        setLaden(false);
        return;
      }

      try {
        setLaden(true);
        setFout(null);

        const response =
          await fetch(
            `/api/planning?vestigingId=${encodeURIComponent(
              vestigingId,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.fout ??
              "De planning kon niet worden opgehaald.",
          );
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "De planning heeft een ongeldig formaat.",
          );
        }

        setWeken(data);
      } catch (error) {
        console.error(
          "Fout bij laden planning:",
          error,
        );

        setFout(
          error instanceof Error
            ? error.message
            : "De planning kon niet worden opgehaald.",
        );

        setWeken([]);
      } finally {
        setLaden(false);
      }
    }, [vestigingId]);

  useEffect(() => {
    void laadPlanning();
  }, [laadPlanning]);

  useEffect(() => {
    const toegestaneVestiging =
      vestigingen.some(
        (vestiging) =>
          vestiging.id ===
          vestigingId,
      );

    if (
      vestigingId &&
      toegestaneVestiging
    ) {
      return;
    }

    setVestigingId(
      vestigingen[0]?.id ?? "",
    );
  }, [
    vestigingen,
    vestigingId,
  ]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Planning
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Bekijk en beheer de personeelsplanning
          per vestiging.
        </p>
      </div>

      {vestigingen.length > 1 && (
        <div className="max-w-md">
          <PlanningVestigingSelect
            vestigingen={vestigingen}
            vestigingId={vestigingId}
            onChange={setVestigingId}
          />
        </div>
      )}

      {fout && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {fout}
          </p>
        </div>
      )}

      {!vestigingId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Er is geen toegankelijke vestiging
            beschikbaar.
          </p>
        </div>
      ) : laden ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Planning wordt geladen...
          </p>
        </div>
      ) : (
        <PlanningOverzicht
          weken={weken}
          vestigingId={vestigingId}
          isEigenaar={isEigenaar}
          isTeamleider={isTeamleider}
          isMedewerker={isMedewerker}
          kanVerwijderen={isEigenaar}
          onGewijzigd={() => {
            void laadPlanning();
          }}
        />
      )}
    </main>
  );
}