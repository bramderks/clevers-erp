import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verstuurNieuweTaakMeldingen } from "@/lib/push/open-diensten";

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
     * EIGEN VERLONING
     * ======================================================
     *
     * Iedere gebruiker die ook een medewerkerprofiel heeft,
     * ontvangt zijn eigen verloningstaak. Daardoor geldt dit
     * automatisch ook voor teamleiders en eigenaren die zelf
     * als medewerker in de verloning zijn opgenomen.
     */

    if (gebruiker.medewerker?.id) {
      const medewerkerId = gebruiker.medewerker.id;

      const openControles =
        await prisma.verloningsControle.findMany({
          where: {
            medewerkerId,
            status: "OPEN",
            verloningsPeriode: {
              status: "KLAAR",
              controleStart: { lte: new Date() },
              controleDeadline: { gte: new Date() },
            },
          },
          orderBy: {
            verloningsPeriode: {
              periodeStart: "desc",
            },
          },
          select: {
            verloningsPeriode: {
              select: {
                id: true,
                periodeStart: true,
                regels: {
                  where: {
                    medewerkerId,
                  },
                  select: {
                    gewerkteDagen: true,
                    gewerkteUren: true,
                  },
                },
              },
            },
          },
        });

      for (const controle of openControles) {
        const periode = controle.verloningsPeriode;

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
          id: "eigen-verloning-" + periode.id,
          type: "EIGEN_VERLONING_CONTROLEREN",
          categorie: "Verloning",
          titel: "Mijn verloning controleren",
          omschrijving:
            new Intl.DateTimeFormat(
              "nl-NL",
              {
                month: "long",
                year: "numeric",
              },
            ).format(periode.periodeStart) +
            " · " +
            gewerkteDagen +
            " gewerkte dagen · " +
            gewerkteUren
              .toFixed(2)
              .replace(".", ",") +
            " gewerkte uren.",
          aangemaaktOp: periode.periodeStart,
          actie: "EIGEN_VERLONING_CONTROLEREN",
          gegevens: {
            periodeId: periode.id,
            href: "/mijn-verloning",
          },
        });
      }
    }

    /*
     * ======================================================
     * VAKANTIEPLANNING
     * ======================================================
     */

    if (gebruiker.medewerker?.id) {
      const medewerkerId = gebruiker.medewerker.id;
      const vandaag = new Date();
      const vakantieVestigingen = await prisma.medewerkerVestiging.findMany({
        where: { medewerkerId, vestiging: { actief: true, seizoenStart: { not: null, lte: vandaag } } },
        select: { vestiging: { select: { id: true, naam: true, seizoenStart: true } } },
      });

      for (const relatie of vakantieVestigingen) {
        const seizoenStart = relatie.vestiging.seizoenStart;
        if (!seizoenStart) continue;
        const jaar = seizoenStart.getFullYear();
        const deadline = new Date(jaar, 3, 30, 23, 59, 59, 999);
        if (vandaag > deadline) continue;
        const bestaand = await prisma.vakantieAanvraag.count({
          where: {
            medewerkerId,
            vestigingId: relatie.vestiging.id,
            status: { in: ["AANGEVRAAGD", "GOEDGEKEURD"] },
            startDatum: { gte: new Date(jaar, 5, 1), lt: new Date(jaar, 8, 1) },
          },
        });
        if (bestaand === 0) {
          taken.push({
            id: `vakantie-${relatie.vestiging.id}-${jaar}`,
            type: "VAKANTIEPLANNING_INLEVEREN",
            categorie: "Vakantie",
            titel: "Vakantieplanning inleveren",
            omschrijving: `${relatie.vestiging.naam} · Lever je vakantieplanning voor juni, juli en augustus uiterlijk 30 april in.`,
            aangemaaktOp: seizoenStart,
            actie: "VAKANTIEPLANNING_INLEVEREN",
            gegevens: { href: `/medewerkers/${medewerkerId}?tab=vakantie`, medewerkerId, vestigingId: relatie.vestiging.id, jaar, deadline },
          });
        }
      }
    }

    /*
     * ======================================================
     * BESCHIKBAARHEID
     * ======================================================
     *
     * Beschikbaarheid staat los van publicatie van roosters.
     * Open beschikbaarheidstaken horen daarom ook in het
     * centrale takenbel thuis.
     */

    if (gebruiker.medewerker?.id) {
      const medewerkerId = gebruiker.medewerker.id;
      const vandaag = new Date();
      const vandaagBegin = new Date(
        vandaag.getFullYear(),
        vandaag.getMonth(),
        vandaag.getDate(),
      );

      const beschikbaarheidWeken =
        await prisma.week.findMany({
          where: {
            beschikbaarheidDeadline: { gt: vandaag },
            vestiging: {
              actief: true,
              medewerkers: { some: { medewerkerId } },
              OR: [
                { seizoenEinde: null },
                { seizoenEinde: { gte: vandaagBegin } },
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
              where: { medewerkerId },
              select: { datum: true },
            },
          },
          orderBy: [{ jaar: "asc" }, { weeknummer: "asc" }],
        });

      for (const week of beschikbaarheidWeken) {
        const maandag = new Date(week.jaar, 0, 4);
        const dag = maandag.getDay() || 7;
        maandag.setDate(
          maandag.getDate() - dag + 1 + (week.weeknummer - 1) * 7,
        );

        const zondag = new Date(maandag);
        zondag.setDate(zondag.getDate() + 6);

        if (zondag < vandaagBegin) continue;

        if (
          week.vestiging.seizoenEinde &&
          maandag > new Date(week.vestiging.seizoenEinde)
        ) {
          continue;
        }

        const dagen = new Set(
          week.beschikbaarheden.map((item) =>
            new Intl.DateTimeFormat("sv-SE").format(new Date(item.datum)),
          ),
        );

        if (dagen.size >= 7) continue;

        const datumParameter = new Intl.DateTimeFormat("sv-SE").format(maandag);

        taken.push({
          id: `beschikbaarheid-${week.id}`,
          type: "BESCHIKBAARHEID_DOORGEVEN",
          categorie: "Beschikbaarheid",
          titel: `Beschikbaarheid doorgeven week ${week.weeknummer}`,
          omschrijving: `${week.vestiging.naam} · Geef je beschikbaarheid voor deze week door vóór de deadline.`,
          aangemaaktOp: week.beschikbaarheidDeadline,
          actie: "BESCHIKBAARHEID_DOORGEVEN",
          gegevens: {
            href: `/profiel/beschikbaarheid?week=${week.jaar}-${week.weeknummer}&datum=${datumParameter}`,
            weekId: week.id,
            jaar: week.jaar,
            weeknummer: week.weeknummer,
            vestigingId: week.vestiging.id,
            vestigingNaam: week.vestiging.naam,
            deadline: week.beschikbaarheidDeadline,
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
     * Algemene ruilverzoeken worden niet meer als taak/card
     * in het centrale Taken-overzicht getoond. De medewerker
     * ontvangt hiervoor een eenvoudige notificatie en kan
     * het verzoek openen via "Ruilverzoeken".
     */

    if (gebruiker.medewerker?.id) {
      try {
        await prisma.ruilverzoek.findMany({
          where: {
            ruilMedewerkerId: gebruiker.medewerker.id,
            status: "AANGEVRAAGD",
          },
          select: { id: true },
          take: 1,
        });
      } catch (error) {
        if (
          isOntbrekendeRuilverzoekTabel(error)
        ) {
          ruilverzoekenBeschikbaar = false;
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

    // Nieuwe persoonlijke taken krijgen éénmalig een pushmelding.
    // De sleutel in PushMelding voorkomt dubbele meldingen bij iedere dashboard-refresh.
    try {
      await verstuurNieuweTaakMeldingen(
        gebruiker.id,
        taken.map((taak) => ({
          id: taak.id,
          titel: taak.titel,
          actie: taak.actie,
        })),
      );
    } catch (error) {
      console.error("Fout bij pushmelding nieuwe taak:", error);
    }

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