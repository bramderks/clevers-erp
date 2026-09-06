import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function fout(
  bericht: string,
  status: number,
) {
  return NextResponse.json(
    { fout: bericht },
    { status },
  );
}

function naamVanMedewerker(
  medewerker: {
    voornaam: string;
    tussenvoegsel: string | null;
    achternaam: string;
  },
) {
  return [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");
}

function isOntbrekendeRuilverzoekTabel(
  error: unknown,
) {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const prismaError =
    error as {
      code?: string;
      meta?: {
        modelName?: string;
      };
      message?: string;
    };

  return (
    prismaError.code === "P2021" &&
    prismaError.meta?.modelName ===
      "Ruilverzoek"
  );
}

export async function GET() {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return fout(
        "Je moet ingelogd zijn.",
        401,
      );
    }

    const taken: Array<{
      id: string;
      type: string;
      categorie: string;
      titel: string;
      omschrijving: string;
      aangemaaktOp: Date;
      actie: string;
      gegevens: Record<
        string,
        unknown
      >;
    }> = [];

    /*
     * ======================================================
     * VERLONING
     * ======================================================
     */

    const eigenaarRelatiesVoorVerloning =
      gebruiker.organisaties.filter(
        (relatie) =>
          relatie.actief &&
          relatie.organisatie.actief &&
          relatie.rol.naam
            .trim()
            .toLowerCase() === "eigenaar",
      );

    if (eigenaarRelatiesVoorVerloning.length > 0) {
      const organisatieIds =
        eigenaarRelatiesVoorVerloning.map(
          (relatie) => relatie.organisatieId,
        );

      const periode =
        await prisma.verloningsPeriode.findFirst({
          where: {
            status: "KLAAR",
            regels: {
              some: {
                vestiging: {
                  organisatieId: {
                    in: organisatieIds,
                  },
                },
              },
            },
          },
          orderBy: [
            { jaar: "desc" },
            { maand: "desc" },
          ],
          select: {
            id: true,
            jaar: true,
            maand: true,
            periodeStart: true,
            regels: {
              where: {
                vestiging: {
                  organisatieId: {
                    in: organisatieIds,
                  },
                },
              },
              select: {
                gewerkteDagen: true,
                gewerkteUren: true,
              },
            },
          },
        });

      if (periode) {
        const gewerkteDagen =
          periode.regels.reduce(
            (totaal, regel) =>
              totaal + regel.gewerkteDagen,
            0,
          );

        const gewerkteUren =
          periode.regels.reduce(
            (totaal, regel) =>
              totaal + Number(regel.gewerkteUren),
            0,
          );

        taken.push({
          id: `verloning-${periode.id}`,
          type: "VERLONING_CONTROLEREN",
          categorie: "Verloning",
          titel: "Verloning staat klaar",
          omschrijving:
            `${new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(periode.periodeStart)} · ${gewerkteDagen} gewerkte dagen · ${gewerkteUren.toFixed(2).replace(".", ",")} gewerkte uren.`,
          aangemaaktOp: periode.periodeStart,
          actie: "VERLONING_CONTROLEREN",
          gegevens: {
            periodeId: periode.id,
          },
        });
      }
    }

    /*
     * ======================================================
     * RUILVERZOEKEN
     * ======================================================
     *
     * Het ruilverzoekmodel hoort bij het nieuwe
     * gemergde Prisma-schema.
     *
     * De huidige database bevat deze tabel mogelijk
     * nog niet. In dat geval slaan we deze taken over
     * totdat het schema/database gemerged is.
     */

    let ruilverzoekenBeschikbaar =
      true;

    /*
     * ======================================================
     * RUILVERZOEKEN VOOR DE MEDEWERKER
     * ======================================================
     *
     * Een medewerker ziet uitsluitend ruilverzoeken
     * die daadwerkelijk aan hem/haar zijn gericht.
     */

    if (gebruiker.medewerker?.id) {
      try {
        const ruilverzoeken =
          await prisma.ruilverzoek.findMany(
            {
              where: {
                ruilMedewerkerId:
                  gebruiker.medewerker.id,
                status: "AANGEVRAAGD",
              },
              include: {
                dienstBezetting: {
                  include: {
                    dienst: {
                      include: {
                        week: {
                          select: {
                            vestigingId: true,
                            jaar: true,
                            weeknummer: true,
                          },
                        },
                      },
                    },
                  },
                },
                aanvrager: {
                  select: {
                    id: true,
                    voornaam: true,
                    tussenvoegsel: true,
                    achternaam: true,
                  },
                },
                ruilMedewerker: {
                  select: {
                    id: true,
                    voornaam: true,
                    tussenvoegsel: true,
                    achternaam: true,
                  },
                },
              },
              orderBy: {
                aangevraagdOp: "asc",
              },
            },
          );

        for (const ruil of ruilverzoeken) {
          const dienst =
            ruil.dienstBezetting
              .dienst;

          const aanvrager =
            naamVanMedewerker(
              ruil.aanvrager,
            );

          taken.push({
            id: ruil.id,
            type: "RUIL_ACCEPTEREN",
            categorie: "Planning",
            titel:
              "Dienst ruilen accepteren",
            omschrijving:
              `${aanvrager} wil een dienst met jou ruilen.`,
            aangemaaktOp:
              ruil.aangevraagdOp,
            actie:
              "RUIL_ACCEPTEREN",
            gegevens: {
              ruilverzoekId:
                ruil.id,
              dienstBezettingId:
                ruil.dienstBezettingId,
              dienstId:
                dienst.id,
              datum:
                dienst.datum,
              begintijd:
                dienst.begintijd,
              eindtijd:
                dienst.eindtijd,
              vestigingId:
                dienst.week
                  .vestigingId,
              jaar:
                dienst.week.jaar,
              weeknummer:
                dienst.week
                  .weeknummer,
              aanvragerId:
                ruil.aanvrager.id,
              aanvragerNaam:
                aanvrager,
            },
          });
        }
      } catch (error) {
        if (
          isOntbrekendeRuilverzoekTabel(
            error,
          )
        ) {
          ruilverzoekenBeschikbaar =
            false;

          console.warn(
            "Ruilverzoek-tabel bestaat nog niet in de huidige database. Ruilverzoeken worden tijdelijk overgeslagen.",
          );
        } else {
          throw error;
        }
      }
    }

    /*
     * ======================================================
     * RUILVERZOEKEN VOOR DE EIGENAAR
     * ======================================================
     *
     * Een eigenaar ziet uitsluitend ruilverzoeken
     * die door de ontvangende medewerker zijn
     * geaccepteerd.
     *
     * De daadwerkelijke planning wordt pas aangepast
     * nadat de eigenaar deze taak heeft goedgekeurd.
     */

    const eigenaarRelaties =
      gebruiker.organisaties.filter(
        (relatie) =>
          relatie.actief &&
          relatie.organisatie.actief &&
          relatie.rol.naam
            .toLowerCase() ===
            "eigenaar",
      );

    if (
      eigenaarRelaties.length > 0 &&
      ruilverzoekenBeschikbaar
    ) {
      const organisatieIds =
        eigenaarRelaties.map(
          (relatie) =>
            relatie.organisatieId,
        );

      try {
        const ruilverzoeken =
          await prisma.ruilverzoek.findMany(
            {
              where: {
                status:
                  "WACHT_OP_EIGENAAR",
                dienstBezetting: {
                  dienst: {
                    week: {
                      vestiging: {
                        organisatieId: {
                          in: organisatieIds,
                        },
                      },
                    },
                  },
                },
              },
              include: {
                dienstBezetting: {
                  include: {
                    dienst: {
                      include: {
                        week: {
                          select: {
                            vestigingId:
                              true,
                            jaar: true,
                            weeknummer:
                              true,
                            vestiging: {
                              select: {
                                id: true,
                                naam: true,
                                organisatieId:
                                  true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                aanvrager: {
                  select: {
                    id: true,
                    voornaam: true,
                    tussenvoegsel:
                      true,
                    achternaam:
                      true,
                  },
                },
                ruilMedewerker: {
                  select: {
                    id: true,
                    voornaam: true,
                    tussenvoegsel:
                      true,
                    achternaam:
                      true,
                  },
                },
              },
              orderBy: {
                aangevraagdOp: "asc",
              },
            },
          );

        for (const ruil of ruilverzoeken) {
          const dienst =
            ruil.dienstBezetting
              .dienst;

          const aanvrager =
            naamVanMedewerker(
              ruil.aanvrager,
            );

          const ruilMedewerker =
            naamVanMedewerker(
              ruil.ruilMedewerker,
            );

          taken.push({
            id: ruil.id,
            type: "RUIL_GOEDKEUREN",
            categorie: "Planning",
            titel:
              "Dienst ruil goedkeuren",
            omschrijving:
              `${aanvrager} wil de dienst overdragen aan ${ruilMedewerker}.`,
            aangemaaktOp:
              ruil.aangevraagdOp,
            actie:
              "RUIL_GOEDKEUREN",
            gegevens: {
              ruilverzoekId:
                ruil.id,
              dienstBezettingId:
                ruil.dienstBezettingId,
              dienstId:
                dienst.id,
              datum:
                dienst.datum,
              begintijd:
                dienst.begintijd,
              eindtijd:
                dienst.eindtijd,
              vestigingId:
                dienst.week
                  .vestigingId,
              vestigingNaam:
                dienst.week
                  .vestiging.naam,
              jaar:
                dienst.week.jaar,
              weeknummer:
                dienst.week
                  .weeknummer,
              aanvragerId:
                ruil.aanvrager.id,
              aanvragerNaam:
                aanvrager,
              ruilMedewerkerId:
                ruil
                  .ruilMedewerker
                  .id,
              ruilMedewerkerNaam:
                ruilMedewerker,
            },
          });
        }
      } catch (error) {
        if (
          isOntbrekendeRuilverzoekTabel(
            error,
          )
        ) {
          console.warn(
            "Ruilverzoek-tabel bestaat nog niet in de huidige database. Eigenaarstaken voor ruilverzoeken worden tijdelijk overgeslagen.",
          );
        } else {
          throw error;
        }
      }
    }

    /*
     * ======================================================
     * SORTERING
     * ======================================================
     */

    taken.sort(
      (a, b) =>
        new Date(
          a.aangemaaktOp,
        ).getTime() -
        new Date(
          b.aangemaaktOp,
        ).getTime(),
    );

    return NextResponse.json(
      taken,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen taken:",
      error,
    );

    return fout(
      "De taken konden niet worden opgehaald.",
      500,
    );
  }
}