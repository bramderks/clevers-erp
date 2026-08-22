"use client";

import {
  useCallback,
  useState,
} from "react";

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
  weekId: string;
  medewerkerId: string;
  datum: string;

  /*
   * Bij BESCHIKBAAR zijn begin- en eindtijd gevuld.
   * Bij NIET_BESCHIKBAAR zijn beide null.
   */
  begintijd: string | null;
  eindtijd: string | null;

  status:
    | "BESCHIKBAAR"
    | "NIET_BESCHIKBAAR"
    | "VOORKEUR";

  opmerking: string | null;
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

type Week = SelectorWeek & {
  beschikbaarheden: Beschikbaarheid[];
};

type BeschikbaarheidPanelProps = {
  medewerkerId: string;
  vestigingen: Vestiging[];
  isBeheerder: boolean;
  bewerkmodus?: boolean;
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

  return new Intl.DateTimeFormat(
    "nl-NL",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(datum);
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

function formatAantalDagen(
  aantal: number,
) {
  if (aantal === 1) {
    return "1 dag ingevuld";
  }

  return `${aantal} dagen ingevuld`;
}

export default function BeschikbaarheidPanel({
  medewerkerId,
  vestigingen,
  isBeheerder,
  bewerkmodus = false,
}: BeschikbaarheidPanelProps) {
  const [week, setWeek] =
    useState<Week | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const laadBeschikbaarheden =
    useCallback(
      async (
        geselecteerdeWeek: SelectorWeek,
      ) => {
        setLoading(true);
        setError(null);

        try {
          const response =
            await fetch(
              `/api/medewerkers/${encodeURIComponent(
                medewerkerId,
              )}/beschikbaarheid?weekId=${encodeURIComponent(
                geselecteerdeWeek.id,
              )}`,
              {
                method: "GET",
                cache: "no-store",
              },
            );

          const tekst =
            await response.text();

          let resultaat: {
            error?: string;
            fout?: string;
            week?: Partial<Week>;
            beschikbaarheden?: Beschikbaarheid[];
          } = {};

          try {
            resultaat = tekst
              ? JSON.parse(tekst)
              : {};
          } catch {
            throw new Error(
              response.ok
                ? "De server gaf een ongeldig antwoord terug."
                : `De beschikbaarheid kon niet worden opgehaald. Serverstatus: ${response.status}.`,
            );
          }

          if (!response.ok) {
            throw new Error(
              resultaat.error ??
                resultaat.fout ??
                "De beschikbaarheid kon niet worden opgehaald.",
            );
          }

          const beschikbaarheden =
            Array.isArray(
              resultaat.beschikbaarheden,
            )
              ? resultaat.beschikbaarheden
              : [];

          const weekUitResponse =
            resultaat.week;

          setWeek({
            id:
              weekUitResponse?.id ??
              geselecteerdeWeek.id,

            jaar:
              weekUitResponse?.jaar ??
              geselecteerdeWeek.jaar,

            weeknummer:
              weekUitResponse?.weeknummer ??
              geselecteerdeWeek.weeknummer,

            status:
              weekUitResponse?.status ??
              geselecteerdeWeek.status,

            beschikbaarheidDeadline:
              weekUitResponse?.beschikbaarheidDeadline ??
              geselecteerdeWeek.beschikbaarheidDeadline,

            beschikbaarheden:
              beschikbaarheden.map(
                (beschikbaarheid) => ({
                  id:
                    beschikbaarheid.id,

                  weekId:
                    beschikbaarheid.weekId ??
                    geselecteerdeWeek.id,

                  medewerkerId:
                    beschikbaarheid.medewerkerId ??
                    medewerkerId,

                  datum:
                    beschikbaarheid.datum,

                  begintijd:
                    beschikbaarheid.begintijd ??
                    null,

                  eindtijd:
                    beschikbaarheid.eindtijd ??
                    null,

                  status:
                    beschikbaarheid.status as Beschikbaarheid["status"],

                  opmerking:
                    beschikbaarheid.opmerking ??
                    null,
                }),
              ),
          });
        } catch (error) {
          console.error(
            "Fout bij laden beschikbaarheid:",
            error,
          );

          setWeek({
            ...geselecteerdeWeek,
            beschikbaarheden: [],
          });

          setError(
            error instanceof Error
              ? error.message
              : "De beschikbaarheid kon niet worden opgehaald.",
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

  const vernieuwBeschikbaarheid =
    useCallback(() => {
      if (!week) {
        return;
      }

      void laadBeschikbaarheden(
        week,
      );
    }, [
      week,
      laadBeschikbaarheden,
    ]);

  if (vestigingen.length === 0) {
    return (
      <Card
        title="Beschikbaarheid"
        description="Bekijk en beheer de beschikbaarheid van deze medewerker."
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="font-semibold text-amber-900">
            Geen vestiging gekoppeld
          </p>

          <p className="mt-1 text-sm text-amber-800">
            Koppel eerst een vestiging
            aan deze medewerker.
          </p>
        </div>
      </Card>
    );
  }

  const deadline =
    week?.beschikbaarheidDeadline ??
    null;

  const deadlineVerstreken =
    deadlineIsVerstreken(
      deadline,
    );

  /*
   * Alleen in bewerkmodus mag er
   * daadwerkelijk gewijzigd worden.
   *
   * Eigenaar/beheerder mag ook na
   * de deadline wijzigen.
   */
  const magWijzigen =
    bewerkmodus &&
    (isBeheerder ||
      !deadlineVerstreken);

  const magVerwijderen =
    bewerkmodus &&
    (isBeheerder ||
      !deadlineVerstreken);

  const aantalDagen =
    week?.beschikbaarheden.length ??
    0;

  const isDoorgegeven =
    aantalDagen > 0;

  return (
    <Card
      title="Beschikbaarheid"
      description="Bekijk wanneer deze medewerker beschikbaar is en beheer de opgegeven beschikbaarheid."
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
          onSelected={
            handleSelected
          }
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

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Geselecteerde week
                  </p>

                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    Week {week.weeknummer} ·{" "}
                    {week.jaar}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {isDoorgegeven
                      ? formatAantalDagen(
                          aantalDagen,
                        )
                      : "Nog geen dagen ingevuld"}
                  </p>
                </div>

                <div
                  className={[
                    "rounded-lg border px-4 py-3",
                    deadlineVerstreken
                      ? isBeheerder
                        ? "border-blue-200 bg-blue-50"
                        : "border-red-200 bg-red-50"
                      : "border-green-200 bg-green-50",
                  ].join(" ")}
                >
                  <p
                    className={[
                      "text-xs font-semibold uppercase tracking-wide",
                      deadlineVerstreken
                        ? isBeheerder
                          ? "text-blue-700"
                          : "text-red-700"
                        : "text-green-700",
                    ].join(" ")}
                  >
                    Deadline beschikbaarheid
                  </p>

                  <p
                    className={[
                      "mt-1 text-sm font-semibold",
                      deadlineVerstreken
                        ? isBeheerder
                          ? "text-blue-900"
                          : "text-red-900"
                        : "text-green-900",
                    ].join(" ")}
                  >
                    {formatDeadline(
                      deadline,
                    )}
                  </p>
                </div>

              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">

                <div
                  className={[
                    "rounded-lg border px-4 py-3",
                    isDoorgegeven
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50",
                  ].join(" ")}
                >
                  <p
                    className={[
                      "text-xs font-semibold uppercase tracking-wide",
                      isDoorgegeven
                        ? "text-green-700"
                        : "text-red-700",
                    ].join(" ")}
                  >
                    Status
                  </p>

                  <p
                    className={[
                      "mt-1 text-sm font-semibold",
                      isDoorgegeven
                        ? "text-green-900"
                        : "text-red-900",
                    ].join(" ")}
                  >
                    {isDoorgegeven
                      ? "Doorgegeven"
                      : "Nog niet doorgegeven"}
                  </p>
                </div>

                <div
                  className={[
                    "rounded-lg border px-4 py-3",
                    magWijzigen
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-slate-50",
                  ].join(" ")}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Wijzigen
                  </p>

                  <p
                    className={[
                      "mt-1 text-sm font-semibold",
                      magWijzigen
                        ? "text-blue-900"
                        : "text-slate-700",
                    ].join(" ")}
                  >
                    {magWijzigen
                      ? "Wijzigen toegestaan"
                      : "Alleen bekijken"}
                  </p>
                </div>

                <div
                  className={[
                    "rounded-lg border px-4 py-3",
                    deadlineVerstreken
                      ? isBeheerder
                        ? "border-blue-200 bg-blue-50"
                        : "border-red-200 bg-red-50"
                      : "border-green-200 bg-green-50",
                  ].join(" ")}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Deadline
                  </p>

                  <p
                    className={[
                      "mt-1 text-sm font-semibold",
                      deadlineVerstreken
                        ? isBeheerder
                          ? "text-blue-900"
                          : "text-red-900"
                        : "text-green-900",
                    ].join(" ")}
                  >
                    {deadlineVerstreken
                      ? isBeheerder
                        ? "Eigenaar kan nog wijzigen"
                        : "Deadline verstreken"
                      : "Deadline nog niet verstreken"}
                  </p>
                </div>

              </div>

              {deadlineVerstreken ? (
                <div
                  className={[
                    "mt-4 rounded-lg border px-4 py-3",
                    isBeheerder
                      ? "border-blue-200 bg-blue-50"
                      : "border-red-200 bg-red-50",
                  ].join(" ")}
                >
                  <p
                    className={[
                      "text-sm font-semibold",
                      isBeheerder
                        ? "text-blue-800"
                        : "text-red-800",
                    ].join(" ")}
                  >
                    De deadline voor deze
                    week is verstreken.
                  </p>

                  <p
                    className={[
                      "mt-1 text-sm",
                      isBeheerder
                        ? "text-blue-700"
                        : "text-red-700",
                    ].join(" ")}
                  >
                    {isBeheerder
                      ? bewerkmodus
                        ? "Je bent ingelogd als eigenaar/beheerder. Je kunt de beschikbaarheid van deze medewerker nog wijzigen."
                        : "Klik op Wijzigen om de beschikbaarheid van deze medewerker aan te passen."
                      : "De medewerker kan deze beschikbaarheid niet meer zelf wijzigen."}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-sm font-semibold text-green-800">
                    De deadline is nog niet
                    verstreken.
                  </p>

                  <p className="mt-1 text-sm text-green-700">
                    {bewerkmodus
                      ? "Je kunt de beschikbaarheid van deze medewerker nu toevoegen en wijzigen."
                      : "Klik op Wijzigen om de beschikbaarheid van deze medewerker aan te passen."}
                  </p>
                </div>
              )}
            </div>

            {magWijzigen ? (
              <>
                <div className="border-t border-slate-200 pt-6">

                  <h3 className="text-base font-semibold text-slate-900">
                    Beschikbaarheid invullen
                  </h3>

                  <p className="mb-6 mt-1 text-sm text-slate-500">
                    Selecteer per dag of de
                    medewerker beschikbaar of
                    niet beschikbaar is. Bij
                    beschikbaarheid kan een
                    begin- en eindtijd worden
                    opgegeven.
                  </p>

                  <BeschikbaarheidForm
                    medewerkerId={
                      medewerkerId
                    }
                    weekId={week.id}
                    beschikbaarheidDeadline={
                      week.beschikbaarheidDeadline
                    }
                    isBeheerder={
                      isBeheerder
                    }
                    onAangemaakt={
                      vernieuwBeschikbaarheid
                    }
                  />
                </div>

                <div className="border-t border-slate-200 pt-6">

                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Ingevoerde dagen
                      </h3>

                      <p className="text-sm text-slate-500">
                        {isDoorgegeven
                          ? `${aantalDagen} ${
                              aantalDagen ===
                              1
                                ? "dag"
                                : "dagen"
                            } ingevuld.`
                          : "Er zijn nog geen dagen ingevuld."}
                      </p>
                    </div>

                    {isDoorgegeven && (
                      <span className="inline-flex w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        Doorgegeven
                      </span>
                    )}

                  </div>

                  {isDoorgegeven ? (
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
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5">
                      <p className="text-sm font-semibold text-red-800">
                        Nog geen
                        beschikbaarheid
                        doorgegeven
                      </p>

                      <p className="mt-1 text-sm text-red-700">
                        Voor deze week zijn
                        nog geen dagen
                        ingevuld.
                      </p>
                    </div>
                  )}

                </div>
              </>
            ) : (
              <div className="border-t border-slate-200 pt-6">

                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Ingevoerde dagen
                    </h3>

                    <p className="text-sm text-slate-500">
                      Overzicht van de voor
                      deze week doorgegeven
                      beschikbaarheid.
                    </p>
                  </div>

                  {isDoorgegeven && (
                    <span className="inline-flex w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                      Doorgegeven
                    </span>
                  )}

                </div>

                {isDoorgegeven ? (
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
                    magWijzigen={false}
                    magVerwijderen={false}
                  />
                ) : (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5">
                    <p className="text-sm font-semibold text-red-800">
                      Nog geen
                      beschikbaarheid
                      doorgegeven
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      Voor deze week is nog
                      geen beschikbaarheid
                      geregistreerd.
                    </p>
                  </div>
                )}

              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}