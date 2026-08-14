"use client";

import { useCallback, useState } from "react";

import Card from "@/components/ui/Card";

import BeschikbaarheidForm from "@/components/planning/BeschikbaarheidForm";
import BeschikbaarheidOverzicht from "@/components/planning/BeschikbaarheidOverzicht";
import BeschikbaarheidWeekSelector from "@/components/planning/BeschikbaarheidWeekSelector";

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
  isBeheerder: boolean;
};

function formatDeadline(
  deadline: string | null,
) {
  if (!deadline) {
    return "Geen deadline ingesteld";
  }

  const datum = new Date(deadline);

  if (Number.isNaN(datum.getTime())) {
    return "Deadline onbekend";
  }

  return datum.toLocaleString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deadlineIsVerstreken(
  deadline: string | null,
) {
  if (!deadline) {
    return false;
  }

  const datum = new Date(deadline);

  if (Number.isNaN(datum.getTime())) {
    return false;
  }

  return new Date() > datum;
}

export default function BeschikbaarheidPanel({
  medewerkerId,
  vestigingen,
  isBeheerder,
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
            `/api/medewerkers/${medewerkerId}/beschikbaarheid?weekId=${encodeURIComponent(
              geselecteerdeWeek.id,
            )}`,
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

  const handleSelected =
    useCallback(
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
        description="Geef per week aan wanneer de medewerker beschikbaar is."
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="font-semibold text-amber-900">
            Geen vestiging gekoppeld
          </p>

          <p className="mt-1 text-sm text-amber-800">
            Koppel eerst een vestiging aan deze
            medewerker.
          </p>
        </div>
      </Card>
    );
  }

  const deadline =
    week?.beschikbaarheidDeadline ?? null;

  const deadlineVerstreken =
    deadlineIsVerstreken(deadline);

  const magWijzigen =
    isBeheerder ||
    !deadlineVerstreken;

  const magVerwijderen =
    isBeheerder ||
    !deadlineVerstreken;

  return (
    <Card
      title="Beschikbaarheid"
      description="Geef per week aan op welke dagen en tijden de medewerker beschikbaar is."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <BeschikbaarheidWeekSelector
          vestigingen={vestigingen}
          medewerkerId={medewerkerId}
          isBeheerder={isBeheerder}
          onSelected={handleSelected}
        />

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
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Geselecteerde week
                  </p>

                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    Week {week.weeknummer} ·{" "}
                    {week.jaar}
                  </h3>
                </div>

                <div
                  className={[
                    "rounded-lg px-4 py-3",
                    deadlineVerstreken
                      ? "border border-red-200 bg-red-50"
                      : "border border-amber-200 bg-amber-50",
                  ].join(" ")}
                >
                  <p
                    className={[
                      "text-xs font-semibold uppercase tracking-wide",
                      deadlineVerstreken
                        ? "text-red-700"
                        : "text-amber-700",
                    ].join(" ")}
                  >
                    Deadline beschikbaarheid
                  </p>

                  <p
                    className={[
                      "mt-1 text-sm font-semibold",
                      deadlineVerstreken
                        ? "text-red-900"
                        : "text-amber-900",
                    ].join(" ")}
                  >
                    {formatDeadline(
                      week.beschikbaarheidDeadline,
                    )}
                  </p>
                </div>
              </div>

              {deadlineVerstreken ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-800">
                    De deadline voor deze week
                    is verstreken.
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    {isBeheerder
                      ? "Als beheerder kun je de beschikbaarheid nog aanpassen."
                      : "Deze beschikbaarheid kan niet meer door de medewerker worden gewijzigd."}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-sm font-semibold text-green-800">
                    Beschikbaarheid kan nog
                    worden gewijzigd.
                  </p>

                  <p className="mt-1 text-sm text-green-700">
                    Wijzigingen zijn mogelijk tot
                    de bovenstaande deadline.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-base font-semibold text-slate-900">
                Beschikbaarheid toevoegen
              </h3>

              <p className="mb-6 mt-1 text-sm text-slate-500">
                Geef per dag de beschikbare tijden
                op tussen 09:00 en 23:00.
              </p>

              {magWijzigen ? (
                <BeschikbaarheidForm
                  medewerkerId={medewerkerId}
                  weekId={week.id}
                />
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4">
                  <p className="font-semibold text-red-900">
                    Beschikbaarheid is gesloten
                  </p>

                  <p className="mt-1 text-sm text-red-800">
                    De deadline voor deze week is
                    verstreken. Je kunt geen
                    wijzigingen meer uitvoeren.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Ingevoerde beschikbaarheden
              </h3>

              <BeschikbaarheidOverzicht
                medewerkerId={medewerkerId}
                beschikbaarheden={
                  week.beschikbaarheden
                }
                beschikbaarheidDeadline={
                  week.beschikbaarheidDeadline
                }
                magWijzigen={magWijzigen}
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