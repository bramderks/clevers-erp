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

function beginVanVorigeMaand(
  datum: Date,
) {
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

function isDienstBinnenSeizoen(
  dienstDatum: Date,
  seizoenEinde: Date | null,
) {
  if (!seizoenEinde) {
    return true;
  }

  const datum =
    new Date(dienstDatum);

  datum.setHours(
    0,
    0,
    0,
    0,
  );

  const einde =
    new Date(seizoenEinde);

  einde.setHours(
    23,
    59,
    59,
    999,
  );

  return datum <= einde;
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

    const vandaag =
      new Date();

    const vandaagBegin =
      new Date(
        vandaag.getFullYear(),
        vandaag.getMonth(),
        vandaag.getDate(),
      );

    const [
      toekomstigeDienstenResultaat,
      beschikbaarheidWeken,
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

                  vestiging: {
                    select: {
                      id: true,
                      naam: true,
                      seizoenEinde: true,
                    },
                  },
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
      }),

      prisma.week.findMany({
        where: {
          beschikbaarheidDeadline: {
            gt: vandaag,
          },

          vestiging: {
            medewerkers: {
              some: {
                medewerkerId,
              },
            },

            OR: [
              {
                seizoenEinde: null,
              },
              {
                seizoenEinde: {
                  gte: vandaagBegin,
                },
              },
            ],
          },
        },

        select: {
          id: true,
          jaar: true,
          weeknummer: true,
          beschikbaarheidDeadline: true,

          vestiging: {
            select: {
              id: true,
              naam: true,
              seizoenEinde: true,
            },
          },

          beschikbaarheden: {
            where: {
              medewerkerId,
            },

            select: {
              datum: true,
            },
          },
        },

        orderBy: [
          {
            jaar: "asc",
          },
          {
            weeknummer: "asc",
          },
        ],
      }),
    ]);

    /*
     * ============================================================
     * TOEKOMSTIGE DIENSTEN
     * ============================================================
     *
     * Toon alle toekomstige diensten van de medewerker
     * tot en met het einde van het seizoen van de
     * betreffende vestiging.
     *
     * Een medewerker kan aan meerdere vestigingen
     * gekoppeld zijn. Daarom wordt het seizoen per
     * dienst/vestiging gecontroleerd.
     * ============================================================
     */

    const aankomendeDiensten =
      toekomstigeDienstenResultaat.filter(
        (bezetting) =>
          isDienstBinnenSeizoen(
            bezetting.dienst.datum,
            bezetting.dienst.week
              .vestiging.seizoenEinde,
          ),
      );

    const taken: DashboardTaak[] =
      [];

    /*
     * ============================================================
     * BESCHIKBAARHEID
     * ============================================================
     *
     * Toon alle relevante planningweken van de
     * vestigingen waaraan de medewerker gekoppeld is.
     *
     * Een week verschijnt alleen als:
     *
     * - de beschikbaarheidsdeadline nog open is;
     * - de week binnen het seizoen valt;
     * - de medewerker nog niet voor alle zeven dagen
     *   beschikbaarheid heeft doorgegeven.
     *
     * Hierdoor loopt de takenlijst automatisch door
     * tot het einde van het seizoen.
     * ============================================================
     */

    for (
      const week of beschikbaarheidWeken
    ) {
      const maandag =
        maandagVanWeek(
          week.jaar,
          week.weeknummer,
        );

      const zondag =
        new Date(maandag);

      zondag.setDate(
        zondag.getDate() + 6,
      );

      /*
       * Een week die volledig vóór vandaag ligt,
       * hoeft niet meer als toekomstige taak te
       * verschijnen.
       */

      if (zondag < vandaagBegin) {
        continue;
      }

      /*
       * Controleer per vestiging of de planningweek
       * daadwerkelijk binnen het seizoen valt.
       */

      if (
        week.vestiging.seizoenEinde &&
        maandag >
          new Date(
            week.vestiging.seizoenEinde,
          )
      ) {
        continue;
      }

      const dagen =
        new Set(
          week.beschikbaarheden.map(
            (beschikbaarheid) =>
              datumVoorApi(
                new Date(
                  beschikbaarheid.datum,
                ),
              ),
          ),
        );

      /*
       * Volledig doorgegeven:
       * geen openstaande taak meer.
       */

      if (dagen.size >= 7) {
        continue;
      }

      const datumParameter =
        datumVoorApi(
          maandag,
        );

      taken.push({
        id: `beschikbaarheid-${week.id}`,
        titel: `Beschikbaarheid doorgeven week ${week.weeknummer}`,
        omschrijving: `${week.vestiging.naam} · Geef je beschikbaarheid voor deze week door.`,
        href: `/profiel/beschikbaarheid?week=${week.jaar}-${week.weeknummer}&datum=${datumParameter}`,
        variant: "warning",
      });
    }

    const openVerloningsControles =
      await prisma.verloningsControle.count({
        where: {
          medewerkerId,
          status: "OPEN",
          verloningsPeriode: {
            status: "KLAAR",
            controleStart: { lte: vandaag },
            controleDeadline: { gte: vandaag },
          },
        },
      });

    if (openVerloningsControles > 0) {
      taken.unshift({
        id: "verloning-controleren",
        titel: "Mijn verloning controleren",
        omschrijving: "Je verloning staat klaar om te controleren.",
        aantal: openVerloningsControles,
        href: "/mijn-verloning",
        variant: "warning",
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
                      href={taak.href}
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
                            {taak.omschrijving}
                          </p>
                        </div>
                      </div>

                      {typeof taak.aantal ===
                        "number" && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                          {taak.aantal}
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
            description="Al je toekomstige ingeplande diensten tot het einde van het seizoen"
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

                        <p className="mt-1 text-sm text-slate-400">
                          {
                            bezetting.dienst.week
                              .vestiging.naam
                          }
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
                    href={taak.href}
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
                          {taak.omschrijving}
                        </p>
                      </div>
                    </div>

                    {typeof taak.aantal ===
                      "number" && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {taak.aantal}
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