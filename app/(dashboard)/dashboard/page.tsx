import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

import { permissions } from "@/lib/permissions";
import { vereisPermission } from "@/lib/requirePermission";

type DashboardTaak = {
  id: string;
  titel: string;
  omschrijving: string;
  aantal?: number;
  href: string;
  variant: "urgent" | "warning" | "info";
};

function beginVanVorigeMaand(datum: Date) {
  return new Date(
    datum.getFullYear(),
    datum.getMonth() - 1,
    1,
  );
}

function maandagVanWeek(
  jaar: number,
  weeknummer: number,
) {
  const datum = new Date(
    jaar,
    0,
    4,
  );

  const dag =
    datum.getDay() || 7;

  datum.setDate(
    datum.getDate() -
      dag +
      1 +
      (weeknummer - 1) * 7,
  );

  return datum;
}

function isoWeekVanDatum(
  datum: Date,
) {
  const waarde = new Date(
    datum,
  );

  waarde.setHours(
    0,
    0,
    0,
    0,
  );

  const dag =
    waarde.getDay() || 7;

  waarde.setDate(
    waarde.getDate() +
      4 -
      dag,
  );

  const jaar =
    waarde.getFullYear();

  const eersteDonderdag =
    new Date(
      jaar,
      0,
      4,
    );

  const eersteDag =
    eersteDonderdag.getDay() ||
    7;

  eersteDonderdag.setDate(
    eersteDonderdag.getDate() +
      4 -
      eersteDag,
  );

  const weeknummer =
    1 +
    Math.round(
      (waarde.getTime() -
        eersteDonderdag.getTime()) /
        604800000,
    );

  return {
    jaar,
    weeknummer,
  };
}

function datumVoorApi(
  datum: Date,
) {
  return new Intl.DateTimeFormat(
    "sv-SE",
  ).format(datum);
}

function taakVariantKlassen(
  variant: DashboardTaak["variant"],
) {
  switch (variant) {
    case "urgent":
      return "bg-red-500";

    case "warning":
      return "bg-amber-400";

    case "info":
    default:
      return "bg-blue-500";
  }
}

export default async function DashboardPage() {
  await vereisPermission(
    permissions.dashboard.view,
  );

  const gebruiker =
    await getCurrentUser();

  if (!gebruiker) {
    redirect("/login");
  }

  const isMedewerker =
    gebruiker.medewerker?.id != null;

  /*
   * ============================================================
   * MEDEWERKER DASHBOARD
   * ============================================================
   */

  if (isMedewerker) {
    const medewerkerId =
      gebruiker.medewerker!.id;

    const vandaag = new Date();

    const vandaagBegin =
      new Date(
        vandaag.getFullYear(),
        vandaag.getMonth(),
        vandaag.getDate(),
      );

    const overVeertienDagen =
      new Date(
        vandaagBegin,
      );

    overVeertienDagen.setDate(
      overVeertienDagen.getDate() +
        14,
    );

    const [
      aankomendeDiensten,
      beschikbaarheden,
    ] = await Promise.all([
      prisma.dienstBezetting.findMany({
        where: {
          medewerkerId,
          status: {
            in: [
              "GEPLAND",
              "BEVESTIGD",
            ],
          },
          dienst: {
            datum: {
              gte: vandaagBegin,
              lte: overVeertienDagen,
            },
          },
        },

        select: {
          id: true,
          status: true,

          dienst: {
            select: {
              id: true,
              datum: true,
              begintijd: true,
              eindtijd: true,

              week: {
                select: {
                  jaar: true,
                  weeknummer: true,
                },
              },
            },
          },
        },

        orderBy: {
          dienst: {
            datum: "asc",
          },
        },

        take: 5,
      }),

      prisma.beschikbaarheid.findMany({
        where: {
          medewerkerId,
        },

        select: {
          datum: true,
          weekId: true,
          status: true,

          week: {
            select: {
              id: true,
              jaar: true,
              weeknummer: true,
            },
          },
        },

        orderBy: {
          datum: "asc",
        },
      }),
    ]);

    const taken: DashboardTaak[] =
      [];

    /*
     * ============================================================
     * BESCHIKBAARHEID
     * ============================================================
     *
     * Toon de komende zes weken waarvoor nog niet
     * voor alle zeven dagen een beschikbaarheidsrecord
     * aanwezig is.
     *
     * De medewerker kan vanuit de taak rechtstreeks
     * naar de betreffende week springen.
     */

    const komendeWeken = Array.from(
      { length: 6 },
      (_, index) => {
        const datum = new Date(
          vandaagBegin,
        );

        datum.setDate(
          datum.getDate() +
            index * 7,
        );

        return isoWeekVanDatum(
          datum,
        );
      },
    );

    const uniekeWeken =
      Array.from(
        new Map(
          komendeWeken.map(
            (week) => [
              `${week.jaar}-${week.weeknummer}`,
              week,
            ],
          ),
        ).values(),
      );

    for (const week of uniekeWeken) {
      const weekBeschikbaarheden =
        beschikbaarheden.filter(
          (beschikbaarheid) =>
            beschikbaarheid.week.jaar ===
              week.jaar &&
            beschikbaarheid.week
              .weeknummer ===
              week.weeknummer,
        );

      const dagen =
        new Set(
          weekBeschikbaarheden.map(
            (beschikbaarheid) =>
              datumVoorApi(
                new Date(
                  beschikbaarheid.datum,
                ),
              ),
          ),
        );

      if (dagen.size >= 7) {
        continue;
      }

      const maandag =
        maandagVanWeek(
          week.jaar,
          week.weeknummer,
        );

      const datumParameter =
        datumVoorApi(
          maandag,
        );

      taken.push({
        id: `beschikbaarheid-${week.jaar}-${week.weeknummer}`,
        titel: `Beschikbaarheid doorgeven week ${week.weeknummer}`,
        omschrijving:
          "Geef je beschikbaarheid voor deze week door.",
        href: `/profiel/beschikbaarheid?week=${week.jaar}-${week.weeknummer}&datum=${datumParameter}`,
        variant: "warning",
      });
    }

    /*
     * ============================================================
     * AANKOMENDE DIENSTEN
     * ============================================================
     */

    for (const bezetting of aankomendeDiensten) {
      const datum =
        new Intl.DateTimeFormat(
          "nl-NL",
          {
            weekday: "short",
            day: "numeric",
            month: "short",
          },
        ).format(
          new Date(
            bezetting.dienst.datum,
          ),
        );

      const begintijd =
        new Intl.DateTimeFormat(
          "nl-NL",
          {
            hour: "2-digit",
            minute: "2-digit",
          },
        ).format(
          new Date(
            bezetting.dienst
              .begintijd,
          ),
        );

      const eindtijd =
        new Intl.DateTimeFormat(
          "nl-NL",
          {
            hour: "2-digit",
            minute: "2-digit",
          },
        ).format(
          new Date(
            bezetting.dienst
              .eindtijd,
          ),
        );

      taken.push({
        id: `dienst-${bezetting.id}`,
        titel: `Aankomende dienst · ${datum}`,
        omschrijving: `${begintijd} - ${eindtijd}`,
        href: `/planning/dienst/${bezetting.dienst.id}`,
        variant: "info",
      });
    }

    return (
      <main className="space-y-8">
        <PageHeader title="Dashboard" />

        <section>
          <Card
            title="Mijn openstaande taken"
            description="Acties en informatie die voor jou relevant zijn"
          >
            {taken.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                <div className="text-center">
                  <p className="font-medium text-slate-900">
                    Geen openstaande taken
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Alles is bijgewerkt.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {taken.map(
                  (taak) => (
                    <a
                      key={taak.id}
                      href={
                        taak.href
                      }
                      className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={`h-3 w-3 shrink-0 rounded-full ${taakVariantKlassen(
                            taak.variant,
                          )}`}
                        />

                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 transition-colors group-hover:text-slate-700">
                            {taak.titel}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              taak.omschrijving
                            }
                          </p>
                        </div>
                      </div>

                      {typeof taak.aantal ===
                        "number" && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                          {
                            taak.aantal
                          }
                        </span>
                      )}

                      <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </a>
                  ),
                )}
              </div>
            )}
          </Card>
        </section>

        <section>
          <Card
            title="Mijn aankomende diensten"
            description="Je eerstvolgende ingeplande diensten"
          >
            {aankomendeDiensten.length ===
            0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <p className="font-medium text-slate-900">
                  Geen aankomende diensten
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Er zijn momenteel geen
                  diensten voor jou ingepland.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {aankomendeDiensten.map(
                  (
                    bezetting,
                  ) => (
                    <a
                      key={
                        bezetting.id
                      }
                      href={`/planning/dienst/${bezetting.dienst.id}`}
                      className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {new Intl.DateTimeFormat(
                            "nl-NL",
                            {
                              weekday:
                                "long",
                              day: "numeric",
                              month: "long",
                            },
                          ).format(
                            new Date(
                              bezetting.dienst.datum,
                            ),
                          )}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {new Intl.DateTimeFormat(
                            "nl-NL",
                            {
                              hour: "2-digit",
                              minute:
                                "2-digit",
                            },
                          ).format(
                            new Date(
                              bezetting.dienst
                                .begintijd,
                            ),
                          )}{" "}
                          -{" "}
                          {new Intl.DateTimeFormat(
                            "nl-NL",
                            {
                              hour: "2-digit",
                              minute:
                                "2-digit",
                            },
                          ).format(
                            new Date(
                              bezetting.dienst
                                .eindtijd,
                            ),
                          )}
                        </p>
                      </div>

                      <span className="text-slate-400 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </a>
                  ),
                )}
              </div>
            )}
          </Card>
        </section>
      </main>
    );
  }

  /*
   * ============================================================
   * BEHEERDERS DASHBOARD
   * ============================================================
   */

  const vandaag = new Date();

  const beginVorigeMaand =
    beginVanVorigeMaand(
      vandaag,
    );

  const vorigeMaandJaar =
    beginVorigeMaand.getFullYear();

  const vorigeMaandNummer =
    beginVorigeMaand.getMonth() + 1;

  const [
    openDienstplekken,
    openRuilverzoeken,
    teControlerenUren,
    verloningsPeriode,
  ] = await Promise.all([
    prisma.dienstBezetting.count({
      where: {
        status: "OPEN",
      },
    }),

    prisma.ruilverzoek.count({
      where: {
        status: "WACHT_OP_EIGENAAR",
      },
    }),

    prisma.urenRegistratie.count({
      where: {
        status: "TE_CONTROLEREN",
      },
    }),

    prisma.verloningsPeriode.findUnique({
      where: {
        jaar_maand: {
          jaar: vorigeMaandJaar,
          maand: vorigeMaandNummer,
        },
      },
      select: {
        id: true,
        status: true,
        jaar: true,
        maand: true,
      },
    }),
  ]);

  const taken: DashboardTaak[] =
    [];

  if (openDienstplekken > 0) {
    taken.push({
      id: "diensten-open",
      titel: "Diensten nog te vullen",
      omschrijving:
        "Er zijn nog open dienstplekken in de planning.",
      aantal: openDienstplekken,
      href: "/planning",
      variant: "urgent",
    });
  }

  if (openRuilverzoeken > 0) {
    taken.push({
      id: "ruilverzoeken",
      titel: "Ruilverzoeken beoordelen",
      omschrijving:
        "Ruilverzoeken wachten op goedkeuring van de eigenaar.",
      aantal: openRuilverzoeken,
      href: "/planning",
      variant: "warning",
    });
  }

  if (teControlerenUren > 0) {
    taken.push({
      id: "uren-controleren",
      titel: "Uren goedkeuren",
      omschrijving:
        "Er zijn urenregistraties die nog gecontroleerd moeten worden.",
      aantal: teControlerenUren,
      href: "/planning",
      variant: "warning",
    });
  }

  if (
    verloningsPeriode?.status ===
    "KLAAR"
  ) {
    taken.push({
      id: "verloning",
      titel: "Verloning staat klaar",
      omschrijving:
        "De verloning van de vorige maand is gegenereerd en kan worden gecontroleerd.",
      href: `/verloning/${verloningsPeriode.id}`,
      variant: "info",
    });
  }

  return (
    <main className="space-y-8">
      <PageHeader title="Dashboard" />

      <section>
        <Card
          title="Openstaande taken"
          description="Acties die nog aandacht nodig hebben"
        >
          {taken.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <p className="font-medium text-slate-900">
                  Geen openstaande taken
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Alles is bijgewerkt.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {taken.map(
                (taak) => (
                  <a
                    key={taak.id}
                    href={
                      taak.href
                    }
                    className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`h-3 w-3 shrink-0 rounded-full ${taakVariantKlassen(
                          taak.variant,
                        )}`}
                      />

                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 transition-colors group-hover:text-slate-700">
                          {
                            taak.titel
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {
                            taak.omschrijving
                          }
                        </p>
                      </div>
                    </div>

                    {typeof taak.aantal ===
                      "number" && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {
                          taak.aantal
                        }
                      </span>
                    )}

                    <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </a>
                ),
              )}
            </div>
          )}
        </Card>
      </section>

    </main>
  );
}