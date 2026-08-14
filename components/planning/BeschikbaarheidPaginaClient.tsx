"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import BeschikbaarheidForm from "@/components/planning/BeschikbaarheidForm";
import BeschikbaarheidWeekSelector from "@/components/planning/BeschikbaarheidWeekSelector";

type Vestiging = {
  id: string;
  naam: string;
};

type SelectorWeek = {
  id: string;
  jaar: number;
  weeknummer: number;
  status: string;
  beschikbaarheidDeadline:
    | string
    | null;
};

type Beschikbaarheid = {
  id: string;
  datum: string;
  begintijd: string;
  eindtijd: string;
  status: string;
  opmerking: string | null;
};

type BeschikbaarheidPaginaClientProps = {
  medewerkerId: string;
  medewerkerNaam: string;
  vestigingen: Vestiging[];
  isBeheerder: boolean;
};

function formatteerDatum(
  waarde: string,
) {
  const datum = new Date(waarde);

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  ).format(datum);
}

function formatteerTijd(
  waarde: string,
) {
  const datum = new Date(waarde);

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(datum);
}

function formatteerDeadline(
  waarde: string,
) {
  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      dateStyle: "full",
      timeStyle: "short",
    },
  ).format(new Date(waarde));
}

export default function BeschikbaarheidPaginaClient({
  medewerkerId,
  medewerkerNaam,
  vestigingen,
  isBeheerder,
}: BeschikbaarheidPaginaClientProps) {
  const [week, setWeek] =
    useState<SelectorWeek | null>(
      null,
    );

  const [
    beschikbaarheden,
    setBeschikbaarheden,
  ] = useState<Beschikbaarheid[]>([]);

  const [laden, setLaden] =
    useState(false);

  const [fout, setFout] =
    useState<string | null>(null);

  const laadBeschikbaarheid =
    useCallback(
      async (weekId: string) => {
        if (!weekId) {
          setBeschikbaarheden([]);
          return;
        }

        try {
          setLaden(true);
          setFout(null);

          const response =
            await fetch(
              `/api/medewerkers/${encodeURIComponent(
                medewerkerId,
              )}/beschikbaarheid?weekId=${encodeURIComponent(
                weekId,
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
                data?.error ??
                "De beschikbaarheid kon niet worden opgehaald.",
            );
          }

          setBeschikbaarheden(
            Array.isArray(
              data?.beschikbaarheden,
            )
              ? data.beschikbaarheden
              : Array.isArray(data)
                ? data
                : [],
          );
        } catch (error) {
          console.error(
            "Fout bij laden beschikbaarheid:",
            error,
          );

          setBeschikbaarheden([]);

          setFout(
            error instanceof Error
              ? error.message
              : "De beschikbaarheid kon niet worden opgehaald.",
          );
        } finally {
          setLaden(false);
        }
      },
      [medewerkerId],
    );

  const handleWeekSelected =
    useCallback(
      (
        _vestigingId: string,
        geselecteerdeWeek: SelectorWeek,
      ) => {
        setWeek(
          geselecteerdeWeek,
        );

        void laadBeschikbaarheid(
          geselecteerdeWeek.id,
        );
      },
      [laadBeschikbaarheid],
    );

  const vernieuwBeschikbaarheid =
    useCallback(() => {
      if (!week) {
        return;
      }

      void laadBeschikbaarheid(
        week.id,
      );
    }, [
      week,
      laadBeschikbaarheid,
    ]);

  const deadlineVerstreken =
    useMemo(() => {
      if (!week?.beschikbaarheidDeadline) {
        return false;
      }

      return (
        new Date() >
        new Date(
          week.beschikbaarheidDeadline,
        )
      );
    }, [
      week?.beschikbaarheidDeadline,
    ]);

  const beschikbaarheidGesloten =
    !isBeheerder &&
    deadlineVerstreken;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Beschikbaarheid
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {medewerkerNaam}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Planningweek
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Kies de vestiging en
            planningweek waarvoor je
            beschikbaarheid wilt
            bekijken of doorgeven.
          </p>
        </div>

        <div className="mt-5">
          <BeschikbaarheidWeekSelector
            vestigingen={vestigingen}
            medewerkerId={
              medewerkerId
            }
            isBeheerder={
              isBeheerder
            }
            onSelected={
              handleWeekSelected
            }
          />
        </div>
      </div>

      {fout && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {fout}
          </p>
        </div>
      )}

      {week && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Beschikbaarheid
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Week{" "}
                  {week.weeknummer}{" "}
                  · {week.jaar}
                </p>
              </div>

              {week.beschikbaarheidDeadline && (
                <div className="sm:text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Deadline
                  </p>

                  <p
                    className={`mt-1 text-sm font-medium ${
                      deadlineVerstreken
                        ? "text-red-600"
                        : "text-slate-700"
                    }`}
                  >
                    {formatteerDeadline(
                      week.beschikbaarheidDeadline,
                    )}
                  </p>
                </div>
              )}
            </div>

            {beschikbaarheidGesloten ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  De beschikbaarheid voor
                  deze week is gesloten.
                </p>

                {week.beschikbaarheidDeadline && (
                  <p className="mt-1 text-sm text-red-700">
                    De deadline was{" "}
                    {formatteerDeadline(
                      week.beschikbaarheidDeadline,
                    )}
                    .
                  </p>
                )}

                <p className="mt-2 text-sm text-red-700">
                  Je kunt je beschikbaarheid
                  niet meer wijzigen.
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  Beschikbaarheid kan nog
                  worden opgegeven.
                </p>

                {week.beschikbaarheidDeadline && (
                  <p className="mt-1 text-sm text-emerald-700">
                    Je kunt dit doen tot{" "}
                    {formatteerDeadline(
                      week.beschikbaarheidDeadline,
                    )}
                    .
                  </p>
                )}
              </div>
            )}

            <div className="mt-5">
              {laden ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">
                    Beschikbaarheid wordt
                    geladen...
                  </p>
                </div>
              ) : beschikbaarheden.length ===
                0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-700">
                    Nog geen
                    beschikbaarheid
                    opgegeven.
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Niet ingevulde dagen
                    worden standaard als
                    niet beschikbaar
                    beschouwd.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {beschikbaarheden.map(
                    (
                      beschikbaarheid,
                    ) => (
                      <div
                        key={
                          beschikbaarheid.id
                        }
                        className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                      >
                        <p className="font-semibold capitalize text-slate-900">
                          {formatteerDatum(
                            beschikbaarheid.datum,
                          )}
                        </p>

                        <p className="mt-1 text-sm text-emerald-700">
                          Beschikbaar van{" "}
                          <strong>
                            {formatteerTijd(
                              beschikbaarheid.begintijd,
                            )}
                          </strong>{" "}
                          tot{" "}
                          <strong>
                            {formatteerTijd(
                              beschikbaarheid.eindtijd,
                            )}
                          </strong>
                        </p>

                        {beschikbaarheid.opmerking && (
                          <p className="mt-3 border-t border-emerald-200 pt-3 text-sm text-slate-600">
                            {
                              beschikbaarheid.opmerking
                            }
                          </p>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          {!beschikbaarheidGesloten && (
            <BeschikbaarheidForm
              weekId={week.id}
              medewerkerId={
                medewerkerId
              }
              onAangemaakt={
                vernieuwBeschikbaarheid
              }
            />
          )}
        </>
      )}
    </main>
  );
}