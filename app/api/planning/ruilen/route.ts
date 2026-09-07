import { NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const RUIL_STATUSSEN = [
  "AANGEVRAAGD",
  "AFGEWEZEN_DOOR_MEDEWERKER",
  "WACHT_OP_EIGENAAR",
  "AFGEWEZEN_DOOR_EIGENAAR",
  "GOEDGEKEURD",
  "UITGEVOERD",
] as const;

type RuilActie =
  | "ACCEPTEREN"
  | "AFWIJZEN"
  | "GOEDKEUREN";

function fout(
  tekst: string,
  status: number,
) {
  return NextResponse.json(
    {
      fout: tekst,
    },
    {
      status,
    },
  );
}

const RUIL_SELECT = {
  id: true,
  status: true,
  aangevraagdOp: true,
  medewerkerGeaccepteerdOp: true,
  eigenaarBeoordeeldOp: true,
  uitgevoerdOp: true,

  dienstBezetting: {
    select: {
      id: true,
      medewerkerId: true,
      status: true,

      dienst: {
        select: {
          id: true,
          datum: true,
          begintijd: true,
          eindtijd: true,
          opmerkingen: true,

          week: {
            select: {
              id: true,
              vestigingId: true,
              jaar: true,
              weeknummer: true,

              vestiging: {
                select: {
                  id: true,
                  naam: true,
                  organisatieId: true,
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
      personeelsnummer: true,
      aanhef: true,
      voornaam: true,
      tussenvoegsel: true,
      achternaam: true,
    },
  },

  ruilMedewerker: {
    select: {
      id: true,
      personeelsnummer: true,
      aanhef: true,
      voornaam: true,
      tussenvoegsel: true,
      achternaam: true,
    },
  },
} as const;

async function haalBezettingOp(
  dienstBezettingId: string,
) {
  return prisma.dienstBezetting.findUnique({
    where: {
      id: dienstBezettingId,
    },

    select: {
      id: true,
      medewerkerId: true,
      status: true,

      dienst: {
        select: {
          id: true,
          datum: true,
          begintijd: true,
          eindtijd: true,

          tags: {
            select: {
              tagId: true,
            },
          },

          week: {
            select: {
              id: true,
              vestigingId: true,

              vestiging: {
                select: {
                  id: true,
                  organisatieId: true,
                  actief: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function GET(
  request: Request,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return fout(
        "Je moet ingelogd zijn.",
        401,
      );
    }

    const { searchParams } =
      new URL(request.url);

    const status =
      searchParams.get("status");

    const dienstBezettingId =
      searchParams.get(
        "dienstBezettingId",
      );

    if (
      status &&
      !RUIL_STATUSSEN.includes(
        status as (typeof RUIL_STATUSSEN)[number],
      )
    ) {
      return fout(
        "Ongeldige ruilstatus.",
        400,
      );
    }

    const medewerkerId =
      gebruiker.medewerker?.id ?? null;

    const eigenaarOrganisatieIds =
      gebruiker.organisaties
        .filter(
          (relatie) =>
            relatie.actief &&
            relatie.organisatie.actief &&
            relatie.rol.naam.toLowerCase() ===
              "eigenaar",
        )
        .map(
          (relatie) =>
            relatie.organisatie.id,
        );

    const isOrganisatieEigenaar =
      eigenaarOrganisatieIds.length >
      0;

    if (
      !medewerkerId &&
      !isOrganisatieEigenaar
    ) {
      return NextResponse.json([]);
    }

    const medewerkerWaar =
      medewerkerId
        ? {
            OR: [
              {
                aanvragerId:
                  medewerkerId,
              },
              {
                ruilMedewerkerId:
                  medewerkerId,
              },
            ],
          }
        : null;

    const eigenaarWaar =
      isOrganisatieEigenaar
        ? {
            dienstBezetting: {
              dienst: {
                week: {
                  vestiging: {
                    organisatieId: {
                      in: eigenaarOrganisatieIds,
                    },
                  },
                },
              },
            },
          }
        : null;

    const toegangsVoorwaarden =
      [];

    if (medewerkerWaar) {
      toegangsVoorwaarden.push(
        medewerkerWaar,
      );
    }

    if (eigenaarWaar) {
      toegangsVoorwaarden.push(
        eigenaarWaar,
      );
    }

    const waar = {
      ...(status
        ? {
            status,
          }
        : {}),

      ...(dienstBezettingId
        ? {
            dienstBezettingId,
          }
        : {}),

      OR: toegangsVoorwaarden,
    };

    const ruilverzoeken =
      await prisma.ruilverzoek.findMany({
        where: waar,
        select: RUIL_SELECT,
        orderBy: {
          aangevraagdOp: "desc",
        },
      });

    return NextResponse.json(
      ruilverzoeken,
    );
  } catch (error) {
    console.error(
      "Fout bij ophalen ruilverzoeken:",
      error,
    );

    return fout(
      "De ruilverzoeken konden niet worden opgehaald.",
      500,
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker?.medewerker) {
      return fout(
        "Alleen een medewerker kan een dienst ruilen.",
        403,
      );
    }

    const body =
      await request.json();

    const dienstBezettingId =
      body?.dienstBezettingId;

    const ruilMedewerkerId =
      body?.ruilMedewerkerId;

    const algemeen =
      body?.algemeen === true;

    if (
      typeof dienstBezettingId !==
        "string" ||
      dienstBezettingId.length === 0
    ) {
      return fout(
        "dienstBezettingId is verplicht.",
        400,
      );
    }

    if (
      !algemeen &&
      (typeof ruilMedewerkerId !== "string" ||
        ruilMedewerkerId.length === 0)
    ) {
      return fout(
        "ruilMedewerkerId is verplicht.",
        400,
      );
    }

    const eigenMedewerkerId =
      gebruiker.medewerker.id;

    const bezetting =
      await haalBezettingOp(
        dienstBezettingId,
      );

    if (!bezetting) {
      return fout(
        "Dienstbezetting niet gevonden.",
        404,
      );
    }

    const vestiging =
      bezetting.dienst.week
        .vestiging;

    if (!vestiging.actief) {
      return fout(
        "Deze vestiging is niet actief.",
        400,
      );
    }

    if (
      bezetting.medewerkerId !==
      eigenMedewerkerId
    ) {
      return fout(
        "Je kunt alleen je eigen dienst ruilen.",
        403,
      );
    }

    if (
      bezetting.status !==
        "GEPLAND" &&
      bezetting.status !==
        "BEVESTIGD"
    ) {
      return fout(
        "Deze dienst kan momenteel niet worden geruild.",
        400,
      );
    }

    if (
      !algemeen &&
      ruilMedewerkerId === eigenMedewerkerId
    ) {
      return fout(
        "Je kunt niet met jezelf ruilen.",
        400,
      );
    }

    const bestaandeRuil =
      await prisma.ruilverzoek.findFirst({
        where: {
          dienstBezettingId,
          status: { in: ["AANGEVRAAGD", "WACHT_OP_EIGENAAR"] },
        },
        select: { id: true },
      });

    if (bestaandeRuil) {
      return fout(
        "Voor deze dienst staat al een actief ruilverzoek open.",
        409,
      );
    }

    if (algemeen) {
      const vereisteTagIds = bezetting.dienst.tags.map((tag) => tag.tagId);

      const kandidaten = await prisma.medewerker.findMany({
        where: {
          actief: true,
          id: { not: eigenMedewerkerId },
          vestigingen: { some: { vestigingId: vestiging.id } },
          ...(vereisteTagIds.length > 0
            ? {
                AND: vereisteTagIds.map((tagId) => ({
                  tags: { some: { tagId } },
                })),
              }
            : {}),
        },
        select: { id: true },
      });

      if (kandidaten.length === 0) {
        return fout(
          "Er zijn geen actieve medewerkers met de juiste tags voor deze dienst.",
          400,
        );
      }

      const ruilverzoeken = await prisma.$transaction(
        kandidaten.map((kandidaat) =>
          prisma.ruilverzoek.create({
            data: {
              dienstBezettingId,
              aanvragerId: eigenMedewerkerId,
              ruilMedewerkerId: kandidaat.id,
              status: "AANGEVRAAGD",
            },
            select: RUIL_SELECT,
          }),
        ),
      );

      return NextResponse.json(
        { algemeen: true, aantal: ruilverzoeken.length },
        { status: 201 },
      );
    }

    const ruilMedewerker =
      await prisma.medewerker.findUnique({
        where: {
          id: ruilMedewerkerId,
        },

        select: {
          id: true,
          actief: true,

          vestigingen: {
            where: { vestigingId: vestiging.id },
            select: { id: true },
          },

          tags: {
            select: { tagId: true },
          },

          beschikbaarheden: {
            where: { datum: bezetting.dienst.datum },
            select: {
              begintijd: true,
              eindtijd: true,
              status: true,
            },
          },
        },
      });

    if (!ruilMedewerker) {
      return fout(
        "De gekozen medewerker bestaat niet.",
        404,
      );
    }

    if (!ruilMedewerker.actief) {
      return fout(
        "Een inactieve medewerker kan geen dienst overnemen.",
        400,
      );
    }

    if (
      ruilMedewerker.vestigingen
        .length === 0
    ) {
      return fout(
        "Deze medewerker hoort niet bij deze vestiging.",
        400,
      );
    }

    const vereisteTagIds = bezetting.dienst.tags.map(
      (tag) => tag.tagId,
    );

    const ruilTagIds = new Set(
      ruilMedewerker.tags.map((tag) => tag.tagId),
    );

    if (
      !vereisteTagIds.every((tagId) =>
        ruilTagIds.has(tagId),
      )
    ) {
      return fout(
        "Deze medewerker heeft niet alle vereiste tags voor deze dienst.",
        400,
      );
    }

    const volledigBeschikbaar =
      ruilMedewerker.beschikbaarheden.some(
        (beschikbaarheid) =>
          (beschikbaarheid.status === "BESCHIKBAAR" ||
            beschikbaarheid.status === "VOORKEUR") &&
          beschikbaarheid.begintijd <= bezetting.dienst.begintijd &&
          beschikbaarheid.eindtijd >= bezetting.dienst.eindtijd,
      );

    if (!volledigBeschikbaar) {
      return fout(
        "Deze medewerker is niet beschikbaar gedurende de volledige dienst.",
        400,
      );
    }

    const bestaandeBezetting =
      await prisma.dienstBezetting.findFirst({
        where: {
          dienstId:
            bezetting.dienst.id,

          medewerkerId:
            ruilMedewerkerId,

          status: {
            notIn: [
              "AFGEZEGD",
            ],
          },
        },

        select: {
          id: true,
        },
      });

    if (bestaandeBezetting) {
      return fout(
        "Deze medewerker staat al op deze dienst.",
        409,
      );
    }

    const overlappendeDienst =
      await prisma.dienstBezetting.findFirst({
        where: {
          medewerkerId:
            ruilMedewerkerId,

          status: {
            notIn: [
              "AFGEZEGD",
            ],
          },

          dienst: {
            datum:
              bezetting.dienst.datum,

            begintijd: {
              lt:
                bezetting.dienst
                  .eindtijd,
            },

            eindtijd: {
              gt:
                bezetting.dienst
                  .begintijd,
            },
          },
        },

        select: {
          id: true,
        },
      });

    if (overlappendeDienst) {
      return fout(
        "Deze medewerker heeft al een overlappende dienst.",
        409,
      );
    }

    const ruilverzoek =
      await prisma.ruilverzoek.create({
        data: {
          dienstBezettingId,

          aanvragerId:
            eigenMedewerkerId,

          ruilMedewerkerId,

          status:
            "AANGEVRAAGD",
        },

        select: RUIL_SELECT,
      });

    return NextResponse.json(
      ruilverzoek,
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Fout bij aanvragen ruil:",
      error,
    );

    return fout(
      "Het ruilverzoek kon niet worden aangemaakt.",
      500,
    );
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return fout(
        "Je moet ingelogd zijn.",
        401,
      );
    }

    const body =
      await request.json();

    const ruilverzoekId =
      body?.ruilverzoekId;

    const actie =
      body?.actie as
        | RuilActie
        | undefined;

    if (
      typeof ruilverzoekId !==
        "string" ||
      ruilverzoekId.length === 0
    ) {
      return fout(
        "ruilverzoekId is verplicht.",
        400,
      );
    }

    if (
      actie !== "ACCEPTEREN" &&
      actie !== "AFWIJZEN" &&
      actie !== "GOEDKEUREN"
    ) {
      return fout(
        "Ongeldige ruilactie.",
        400,
      );
    }

    const ruilverzoek =
      await prisma.ruilverzoek.findUnique({
        where: {
          id: ruilverzoekId,
        },

        select: {
          id: true,
          status: true,
          aanvragerId: true,
          ruilMedewerkerId: true,
          dienstBezettingId: true,

          dienstBezetting: {
            select: {
              id: true,
              medewerkerId: true,
              status: true,

              dienst: {
                select: {
                  id: true,
                  datum: true,
                  begintijd: true,
                  eindtijd: true,

                  week: {
                    select: {
                      vestigingId: true,

                      vestiging: {
                        select: {
                          id: true,
                          organisatieId: true,
                          actief: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!ruilverzoek) {
      return fout(
        "Ruilverzoek niet gevonden.",
        404,
      );
    }

    const vestiging =
      ruilverzoek
        .dienstBezetting
        .dienst.week.vestiging;

    if (!vestiging.actief) {
      return fout(
        "Deze vestiging is niet actief.",
        400,
      );
    }

    const medewerkerId =
      gebruiker.medewerker?.id;

    if (
      actie === "ACCEPTEREN"
    ) {
      if (!medewerkerId) {
        return fout(
          "Er is geen medewerker aan je account gekoppeld.",
          403,
        );
      }

      if (
        medewerkerId !==
        ruilverzoek.ruilMedewerkerId
      ) {
        return fout(
          "Alleen de aangewezen medewerker kan deze ruil accepteren.",
          403,
        );
      }

      if (
        ruilverzoek.status !==
        "AANGEVRAAGD"
      ) {
        return fout(
          "Dit ruilverzoek wacht niet meer op acceptatie.",
          409,
        );
      }

      await prisma.ruilverzoek.updateMany({
        where: {
          dienstBezettingId: ruilverzoek.dienstBezettingId,
          id: { not: ruilverzoek.id },
          status: "AANGEVRAAGD",
        },
        data: { status: "AFGEWEZEN_DOOR_MEDEWERKER" },
      });

      const bijgewerkt =
        await prisma.ruilverzoek.update({
          where: {
            id: ruilverzoek.id,
          },

          data: {
            status:
              "WACHT_OP_EIGENAAR",

            medewerkerGeaccepteerdOp:
              new Date(),
          },

          select: RUIL_SELECT,
        });

      return NextResponse.json(
        bijgewerkt,
      );
    }

    if (
      actie === "AFWIJZEN"
    ) {
      if (
        ruilverzoek.status ===
        "AANGEVRAAGD"
      ) {
        if (
          !medewerkerId ||
          medewerkerId !==
            ruilverzoek.ruilMedewerkerId
        ) {
          return fout(
            "Alleen de aangewezen medewerker kan deze ruil afwijzen.",
            403,
          );
        }

        const bijgewerkt =
          await prisma.ruilverzoek.update({
            where: {
              id: ruilverzoek.id,
            },

            data: {
              status:
                "AFGEWEZEN_DOOR_MEDEWERKER",
            },

            select: RUIL_SELECT,
          });

        return NextResponse.json(
          bijgewerkt,
        );
      }

      if (
        ruilverzoek.status ===
        "WACHT_OP_EIGENAAR"
      ) {
        const eigenaar =
          await isEigenaar(
            vestiging.organisatieId,
          );

        if (!eigenaar) {
          return fout(
            "Alleen de eigenaar kan deze ruil afwijzen.",
            403,
          );
        }

        const toegang =
          await hasPermissionForVestiging(
            permissions.planning.update,
            vestiging.id,
          );

        if (!toegang) {
          return fout(
            "Je hebt geen rechten om deze ruil te beoordelen.",
            403,
          );
        }

        const bijgewerkt =
          await prisma.ruilverzoek.update({
            where: {
              id: ruilverzoek.id,
            },

            data: {
              status:
                "AFGEWEZEN_DOOR_EIGENAAR",

              eigenaarBeoordeeldOp:
                new Date(),

              eigenaarBeoordeeldDoorId:
                gebruiker.id,
            },

            select: RUIL_SELECT,
          });

        return NextResponse.json(
          bijgewerkt,
        );
      }

      return fout(
        "Dit ruilverzoek kan niet meer worden afgewezen.",
        409,
      );
    }

    const eigenaar =
      await isEigenaar(
        vestiging.organisatieId,
      );

    if (!eigenaar) {
      return fout(
        "Alleen de eigenaar kan een ruil goedkeuren.",
        403,
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.update,
        vestiging.id,
      );

    if (!toegang) {
      return fout(
        "Je hebt geen rechten om deze ruil goed te keuren.",
        403,
      );
    }

    if (
      ruilverzoek.status !==
      "WACHT_OP_EIGENAAR"
    ) {
      return fout(
        "Dit ruilverzoek wacht niet op goedkeuring van de eigenaar.",
        409,
      );
    }

    const resultaat =
      await prisma.$transaction(
        async (tx) => {
          const actueleBezetting =
            await tx.dienstBezetting.findUnique(
              {
                where: {
                  id:
                    ruilverzoek.dienstBezettingId,
                },

                select: {
                  id: true,
                  medewerkerId: true,
                  status: true,

                  dienst: {
                    select: {
                      id: true,
                      datum: true,
                      begintijd: true,
                      eindtijd: true,
                    },
                  },
                },
              },
            );

          if (!actueleBezetting) {
            throw new Error(
              "DIENSTBEZETTING_NIET_GEVONDEN",
            );
          }

          if (
            actueleBezetting.medewerkerId !==
            ruilverzoek.aanvragerId
          ) {
            throw new Error(
              "BEZETTING_IS_GEWIJZIGD",
            );
          }

          if (
            actueleBezetting.status ===
              "AFGEZEGD" ||
            actueleBezetting.status ===
              "GEWERKT"
          ) {
            throw new Error(
              "DIENST_KAN_NIET_MEER_GERUILD_WORDEN",
            );
          }

          const bestaandeBezetting =
            await tx.dienstBezetting.findFirst(
              {
                where: {
                  dienstId:
                    actueleBezetting.dienst.id,

                  medewerkerId:
                    ruilverzoek.ruilMedewerkerId,

                  id: {
                    not:
                      actueleBezetting.id,
                  },

                  status: {
                    notIn: [
                      "AFGEZEGD",
                    ],
                  },
                },

                select: {
                  id: true,
                },
              },
            );

          if (bestaandeBezetting) {
            throw new Error(
              "MEDEWERKER_STAAT_AL_OP_DIENST",
            );
          }

          const overlappendeDienst =
            await tx.dienstBezetting.findFirst(
              {
                where: {
                  medewerkerId:
                    ruilverzoek.ruilMedewerkerId,

                  id: {
                    not:
                      actueleBezetting.id,
                  },

                  status: {
                    notIn: [
                      "AFGEZEGD",
                    ],
                  },

                  dienst: {
                    datum:
                      actueleBezetting
                        .dienst.datum,

                    begintijd: {
                      lt:
                        actueleBezetting
                          .dienst
                          .eindtijd,
                    },

                    eindtijd: {
                      gt:
                        actueleBezetting
                          .dienst
                          .begintijd,
                    },
                  },
                },

                select: {
                  id: true,
                },
              },
            );

          if (
            overlappendeDienst
          ) {
            throw new Error(
              "MEDEWERKER_HEEFT_OVERLAP",
            );
          }

          await tx.dienstBezetting.update({
            where: {
              id:
                actueleBezetting.id,
            },

            data: {
              medewerkerId:
                ruilverzoek.ruilMedewerkerId,

              status:
                "BEVESTIGD",
            },
          });

          return tx.ruilverzoek.update({
            where: {
              id: ruilverzoek.id,
            },

            data: {
              status:
                "UITGEVOERD",

              eigenaarBeoordeeldOp:
                new Date(),

              eigenaarBeoordeeldDoorId:
                gebruiker.id,

              uitgevoerdOp:
                new Date(),
            },

            select: RUIL_SELECT,
          });
        },
      );

    return NextResponse.json(
      resultaat,
    );
  } catch (error) {
    console.error(
      "Fout bij verwerken ruilverzoek:",
      error,
    );

    if (
      error instanceof Error
    ) {
      switch (error.message) {
        case "DIENSTBEZETTING_NIET_GEVONDEN":
          return fout(
            "De dienstbezetting bestaat niet meer.",
            409,
          );

        case "BEZETTING_IS_GEWIJZIGD":
          return fout(
            "De oorspronkelijke medewerker staat niet meer op deze dienst.",
            409,
          );

        case "DIENST_KAN_NIET_MEER_GERUILD_WORDEN":
          return fout(
            "Deze dienst kan niet meer worden geruild.",
            409,
          );

        case "MEDEWERKER_STAAT_AL_OP_DIENST":
          return fout(
            "De medewerker staat al op deze dienst.",
            409,
          );

        case "MEDEWERKER_HEEFT_OVERLAP":
          return fout(
            "De medewerker heeft een overlappende dienst.",
            409,
          );
      }
    }

    return fout(
      "Het ruilverzoek kon niet worden verwerkt.",
      500,
    );
  }
}