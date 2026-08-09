"use client";

import { useCallback, useState } from "react";

import Card from "@/components/ui/Card";

import BeschikbaarheidForm from "./BeschikbaarheidForm";
import BeschikbaarheidOverzicht from "./BeschikbaarheidOverzicht";
import BeschikbaarheidWeekSelector from "./BeschikbaarheidWeekSelector";

type Vestiging = {
  id: string;
  naam: string;
};

type Beschikbaarheid = {
  id: string;
  datum: string;
  begintijd: string;
  eindtijd: string;
  status: string;
  opmerking: string | null;
};

type SelectorWeek = {
  id: string;
  jaar: number;
  weeknummer: number;
  status: string;
  beschikbaarheidDeadline: string | null;
};

type Week = SelectorWeek & {
  beschikbaarheden: Beschikbaarheid[];
};

type BeschikbaarheidPanelProps = {
  medewerkerId: string;
  vestigingen: Vestiging[];
  isEigenaar: boolean;
};

export default function BeschikbaarheidPanel({
  medewerkerId,
  vestigingen,
  isEigenaar,
}: BeschikbaarheidPanelProps) {
  const [week, setWeek] =
    useState<Week | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const laadBeschikbaarheden =
    useCallback(
      async (
        geselecteerdeWeek: SelectorWeek,
      ) => {
        setLoading(true);
        setError("");

        try {
          const response = await fetch(
            `/api/medewerkers/${medewerkerId}/beschikbaarheid?weekId=${geselecteerdeWeek.id}`,
            {
              cache: "no-store",
            },
          );

          const resultaat =
            await response.json();

          if (!response.ok) {
            throw new Error(
              resultaat.error ??
                "Beschikbaarheden ophalen is mislukt.",
            );
          }

          const beschikbaarheden =
            Array.isArray(
              resultaat.beschikbaarheden,
            )
              ? resultaat.beschikbaarheden
              : [];

          setWeek({
            ...geselecteerdeWeek,
            beschikbaarheden,
          });
        } catch (error) {
          setWeek({
            ...geselecteerdeWeek,
            beschikbaarheden: [],
          });

          setError(
            error instanceof Error
              ? error.message
              : "Beschikbaarheden ophalen is mislukt.",
          );
        } finally {
          setLoading(false);
        }
      },
      [medewerkerId],
    );

  const handleSelected = useCallback(
    (
      _vestigingId: string,
      geselecteerdeWeek: SelectorWeek,
    ) => {
      void laadBeschikbaarheden(
        geselecteerdeWeek,
      );
    },
    [laadBeschikbaarheden],
  );

  if (vestigingen.length === 0) {
    return (
      <Card
        title="Beschikbaarheid"
        description="Beschikbaarheid kan pas worden opgegeven wanneer de medewerker aan een vestiging is gekoppeld."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Geen vestiging gekoppeld
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Koppel eerst een vestiging aan
            deze medewerker.
          </p>
        </div>
      </Card>
    );
  }

  const deadline =
    week?.beschikbaarheidDeadline
      ? new Date(
          week.beschikbaarheidDeadline,
        )
      : null;

  const deadlineVerstreken =
    deadline !== null &&
    !Number.isNaN(
      deadline.getTime(),
    ) &&
    new Date() > deadline;

  const magWijzigen =
    isEigenaar ||
    !deadlineVerstreken;

  const magVerwijderen =
    isEigenaar ||
    !deadlineVerstreken;

  return (
    <Card
      title="Beschikbaarheid"
      description="Geef per vestiging en week aan wanneer de medewerker beschikbaar is."
    >
      <div className="space-y-8">
        <BeschikbaarheidWeekSelector
          vestigingen={vestigingen}
          medewerkerId={medewerkerId}
          isEigenaar={isEigenaar}
          onSelected={handleSelected}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm text-slate-500">
              Beschikbaarheid laden...
            </p>
          </div>
        ) : !week ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm text-slate-500">
              Selecteer een week om de
              beschikbaarheid te bekijken.
            </p>
          </div>
        ) : (
          <>
            <div className="border-t border-slate-200 pt-8">
              <h3 className="text-base font-semibold text-slate-900">
                Beschikbaarheid toevoegen
              </h3>

              <p className="mb-6 mt-1 text-sm text-slate-500">
                Voeg een beschikbaarheid toe
                aan de geselecteerde week.
              </p>

              {magWijzigen ? (
                <BeschikbaarheidForm
                  medewerkerId={
                    medewerkerId
                  }
                  weekId={week.id}
                />
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">
                    Beschikbaarheid is gesloten
                  </p>

                  <p className="mt-1">
                    De deadline voor deze week
                    is verstreken. Alleen een
                    eigenaar kan nog wijzigingen
                    uitvoeren.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-8">
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Ingevoerde beschikbaarheden
              </h3>

              <BeschikbaarheidOverzicht
                medewerkerId={
                  medewerkerId
                }
                beschikbaarheden={
                  week.beschikbaarheden
                }
                beschikbaarheidDeadline={
                  week.beschikbaarheidDeadline
                }
                magWijzigen={
                  magWijzigen
                }
                magVerwijderen={
                  magVerwijderen
                }
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}