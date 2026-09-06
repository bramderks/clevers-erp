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

      if (zondag < vandaagBegin) {
        continue;
      }

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
                  (bezetting) => (
                    <a
                      key={bezetting.id}
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

  const vandaag =
    new Date();

  const vorigeMaand =
    beginVanVorigeMaand(vandaag);

  const organisatieIds =
    gebruiker.organisaties
      .filter(
        (relatie) =>
          relatie.actief &&
          relatie.organisatie.actief,
      )
      .map(
        (relatie) =>
          relatie.organisatieId,
      );

  if (organisatieIds.length === 0) {
    redirect("/login");
  }

  const [
    openstaandeTaken,
    medewerkersAantal,
    vestigingenAantal,
    verloningVorigeMaand,
    actueleWeken,
  ] = await Promise.all([
    prisma.taak.count({
      where: {
        organisatieId: {
          in: organisatieIds,
        },
        afgerondOp: null,
      },
    }),

    prisma.medewerker.count({
      where: {
        actief: true,
        vestigingen: {
          some: {
            vestiging: {
              organisatieId: {
                in: organisatieIds,
              },
              actief: true,
            },
          },
        },
      },
    }),

    prisma.vestiging.count({
      where: {
        organisatieId: {
          in: organisatieIds,
        },
        actief: true,
      },
    }),

    prisma.verloningsPeriode.findUnique({
      where: {
        jaar_maand: {
          jaar:
            vorigeMaand.getFullYear(),
          maand:
            vorigeMaand.getMonth() +
            1,
        },
      },
      select: {
        id: true,
        status: true,
        gecontroleerdOp: true,
        controleStart: true,
        controleDeadline: true,
      },
    }),

    prisma.week.findMany({
      where: {
        jaar:
          isoWeekVanDatum(
            vandaag,
          ).jaar,
        weeknummer:
          isoWeekVanDatum(
            vandaag,
          ).weeknummer,
        vestiging: {
          organisatieId: {
            in: organisatieIds,
          },
          actief: true,
        },
      },
      select: {
        id: true,
        status: true,
      },
    }),
  ]);

  const beheerdersTaken: DashboardTaak[] =
    [];

  if (
    isEigenaarOfTeamleider(
      gebruiker.organisaties,
    ) &&
    verloningVorigeMaand?.status ===
      "KLAAR"
  ) {
    beheerdersTaken.push({
      id: "verloning-vorige-maand",
      titel:
        "Verloning staat klaar",
      omschrijving:
        "De verloning van de vorige maand staat klaar voor controle.",
      href: `/verloning/${verloningVorigeMaand.id}`,
      variant: "info",
    });
  }

  if (openstaandeTaken > 0) {
    beheerdersTaken.push({
      id: "openstaande-taken",
      titel:
        "Openstaande taken",
      omschrijving:
        "Er staan nog taken open die aandacht nodig hebben.",
      aantal:
        openstaandeTaken,
      href: "/",
      variant: "warning",
    });
  }

  if (
    actueleWeken.length === 0
  ) {
    beheerdersTaken.push({
      id: "geen-actuele-week",
      titel:
        "Planning controleren",
      omschrijving:
        "Er is geen actieve planningweek voor de huidige week gevonden.",
      href: "/planning",
      variant: "warning",
    });
  }

  return (
    <main className="space-y-8">
      <PageHeader title="Dashboard" />

      <section className="grid gap-4 md:grid-cols-3">
        <Card title="Medewerkers">
          <p className="text-3xl font-bold text-slate-900">
            {medewerkersAantal}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Actieve medewerkers
          </p>
        </Card>

        <Card title="Vestigingen">
          <p className="text-3xl font-bold text-slate-900">
            {vestigingenAantal}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Actieve vestigingen
          </p>
        </Card>

        <Card title="Openstaande taken">
          <p className="text-3xl font-bold text-slate-900">
            {openstaandeTaken}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Taken die nog aandacht vragen
          </p>
        </Card>
      </section>

      <section>
        <Card
          title="Actiepunten"
          description="Belangrijke acties binnen Clevers ERP"
        >
          {beheerdersTaken.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <p className="font-medium text-slate-900">
                  Geen nieuwe actiepunten
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Alles is bijgewerkt.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {beheerdersTaken.map(
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

function isEigenaarOfTeamleider(
  relaties: Array<{
    actief: boolean;
    rol: {
      naam: string;
    };
    organisatie: {
      actief: boolean;
    };
  }>,
) {
  return relaties.some(
    (relatie) => {
      if (
        !relatie.actief ||
        !relatie.organisatie.actief
      ) {
        return false;
      }

      const rol =
        relatie.rol.naam
          .trim()
          .toLowerCase();

      return (
        rol === "eigenaar" ||
        rol === "teamleider"
      );
    },
  );
}
