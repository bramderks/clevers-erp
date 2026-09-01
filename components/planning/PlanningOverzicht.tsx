"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

import type {
  Dienst,
  PlanningWeek,
} from "@/types/planning";

type PlanningOverzichtProps = {
  weken: PlanningWeek[];
  vestigingId: string;
  isEigenaar?: boolean;
  isTeamleider?: boolean;
  isMedewerker?: boolean;
  kanVerwijderen?: boolean;
  onGewijzigd?: () => void;
};

type DagGroep = {
  datum: string;
  diensten: Dienst[];
};

function formatDatum(datum: string) {
  return format(
    parseISO(datum),
    "EEEE d MMMM",
    {
      locale: nl,
    },
  );
}

function formatTijd(tijd: string) {
  if (!tijd) {
    return "";
  }

  if (/^\d{2}:\d{2}$/.test(tijd)) {
    return tijd;
  }

  const parsed = new Date(tijd);

  if (Number.isNaN(parsed.getTime())) {
    return tijd;
  }

  return format(parsed, "HH:mm");
}

function formatMedewerkerNaam(
  medewerker: Dienst["bezetting"][number]["medewerker"],
) {
  if (!medewerker) {
    return "Open positie";
  }

  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function statusLabel(status: PlanningWeek["status"]) {
  switch (status) {
    case "OPEN":
      return "Open";

    case "IN_PLANNING":
      return "In planning";

    case "GEPUBLICEERD":
      return "Gepubliceerd";

    case "AFGESLOTEN":
      return "Afgesloten";

    default:
      return status;
  }
}

function statusKlassen(status: PlanningWeek["status"]) {
  switch (status) {
    case "OPEN":
      return "bg-slate-100 text-slate-700";

    case "IN_PLANNING":
      return "bg-amber-100 text-amber-800";

    case "GEPUBLICEERD":
      return "bg-emerald-100 text-emerald-800";

    case "AFGESLOTEN":
      return "bg-slate-200 text-slate-600";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function groepeerDienstenPerDag(
  diensten: Dienst[],
): DagGroep[] {
  const groepen = new Map<string, Dienst[]>();

  [...diensten]
    .sort((a, b) => {
      const datumVergelijking =
        a.datum.localeCompare(b.datum);

      if (datumVergelijking !== 0) {
        return datumVergelijking;
      }

      return a.begintijd.localeCompare(
        b.begintijd,
      );
    })
    .forEach((dienst) => {
      const bestaandeDiensten =
        groepen.get(dienst.datum) ?? [];

      bestaandeDiensten.push(dienst);

      groepen.set(
        dienst.datum,
        bestaandeDiensten,
      );
    });

  return Array.from(
    groepen.entries(),
  ).map(([datum, dienstenPerDag]) => ({
    datum,
    diensten: dienstenPerDag,
  }));
}

export default function PlanningOverzicht({
  weken,
  vestigingId,
  isEigenaar = false,
  isTeamleider = false,
  isMedewerker = false,
}: PlanningOverzichtProps) {
  const [openWeekId, setOpenWeekId] =
    useState<string | null>(
      weken[0]?.id ?? null,
    );

  const gesorteerdeWeken = useMemo(() => {
    return [...weken].sort((a, b) => {
      if (a.jaar !== b.jaar) {
        return a.jaar - b.jaar;
      }

      return a.weeknummer - b.weeknummer;
    });
  }, [weken]);

  const magBewerken = isEigenaar;

  if (!vestigingId) {
    return null;
  }

  if (gesorteerdeWeken.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Geen planning beschikbaar
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Er zijn nog geen planningweken
          aangemaakt voor deze vestiging.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {gesorteerdeWeken.map((week) => {
        const isOpen =
          openWeekId === week.id;

        const dagen =
          groepeerDienstenPerDag(
            week.diensten,
          );

        return (
          <section
            key={week.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            {/* ==================================================
                WEEK HEADER
                ================================================== */}

            <button
              type="button"
              onClick={() =>
                setOpenWeekId((huidigeWeekId) =>
                  huidigeWeekId === week.id
                    ? null
                    : week.id,
                )
              }
              className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Planningweek
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Week {week.weeknummer} · {week.jaar}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {week.diensten.length}{" "}
                  {week.diensten.length === 1
                    ? "dienst"
                    : "diensten"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusKlassen(
                    week.status,
                  )}`}
                >
                  {statusLabel(week.status)}
                </span>

                <span className="text-lg text-slate-400">
                  {isOpen ? "−" : "+"}
                </span>
              </div>
            </button>

            {/* ==================================================
                WEEK CONTENT
                ================================================== */}

            {isOpen && (
              <div className="border-t border-slate-200 p-5">
                {dagen.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
                    <p className="text-sm text-slate-600">
                      Er zijn nog geen diensten
                      toegevoegd aan deze week.
                    </p>

                    {magBewerken && (
                      <p className="mt-2 text-sm text-slate-500">
                        Als eigenaar kun je hier
                        binnenkort diensten aan de
                        planning toevoegen.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {dagen.map((dag) => (
                      <div
                        key={dag.datum}
                        className="space-y-3"
                      >
                        {/* ==============================
                            DAG HEADER
                            ============================== */}

                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h3 className="text-sm font-semibold capitalize text-slate-900">
                            {formatDatum(
                              dag.datum,
                            )}
                          </h3>

                          <span className="text-xs text-slate-500">
                            {
                              dag.diensten
                                .length
                            }{" "}
                            {dag.diensten
                              .length === 1
                              ? "dienst"
                              : "diensten"}
                          </span>
                        </div>

                        {/* ==============================
                            DIENSTEN
                            ============================== */}

                        <div className="grid gap-3">
                          {dag.diensten.map(
                            (dienst) => (
                              <article
                                key={dienst.id}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-base font-semibold text-slate-900">
                                        {formatTijd(
                                          dienst.begintijd,
                                        )}{" "}
                                        –{" "}
                                        {formatTijd(
                                          dienst.eindtijd,
                                        )}
                                      </p>

                                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                                        {
                                          dienst
                                            .bezetting
                                            .length
                                        }{" "}
                                        {
                                          dienst
                                            .bezetting
                                            .length ===
                                          1
                                            ? "persoon"
                                            : "personen"
                                        }
                                      </span>
                                    </div>

                                    {dienst.tags
                                      .length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {dienst.tags.map(
                                          (
                                            dienstTag,
                                          ) => (
                                            <span
                                              key={
                                                dienstTag.id
                                              }
                                              className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"
                                            >
                                              {
                                                dienstTag
                                                  .tag
                                                  .naam
                                              }{" "}
                                              ×{" "}
                                              {
                                                dienstTag
                                                  .aantal
                                              }
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}

                                    {dienst
                                      .opmerkingen && (
                                      <p className="mt-3 text-sm text-slate-600">
                                        {
                                          dienst.opmerkingen
                                        }
                                      </p>
                                    )}
                                  </div>

                                  {magBewerken && (
                                    <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                      Bewerkbaar
                                    </span>
                                  )}

                                  {!magBewerken &&
                                    (isTeamleider ||
                                      isMedewerker) && (
                                      <span className="w-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                                        Leesmodus
                                      </span>
                                    )}
                                </div>

                                {/* ==========================
                                    BEZETTING
                                    ========================== */}

                                {dienst.bezetting
                                  .length > 0 && (
                                  <div className="mt-4 border-t border-slate-200 pt-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Bezetting
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {dienst.bezetting.map(
                                        (
                                          bezetting,
                                        ) => (
                                          <span
                                            key={
                                              bezetting.id
                                            }
                                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                                          >
                                            {formatMedewerkerNaam(
                                              bezetting.medewerker,
                                            )}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </article>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}