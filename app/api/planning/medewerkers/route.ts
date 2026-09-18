import { NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function datumTekstNaarBeginVanDag(
  datum: string,
) {
  const waarde = new Date(
    `${datum}T00:00:00`,
  );

  if (Number.isNaN(waarde.getTime())) {
    return null;
  }

  return waarde;
}

function datumTekstNaarEindeVanDag(
  datum: string,
) {
  const waarde = new Date(
    `${datum}T23:59:59.999`,
  );

  if (Number.isNaN(waarde.getTime())) {
    return null;
  }

  return waarde;
}

export async function GET(
  request: Request,
) {
  try {
    const gebruiker =
      await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json(
        {
          fout: "Je moet ingelogd zijn.",
        },
        {
          status: 401,
        },
      );
    }

    const { searchParams } =
      new URL(request.url);

    const vestigingId =
      searchParams.get("vestigingId");

    const datum =
      searchParams.get("datum");

    if (!vestigingId) {
      return NextResponse.json(
        {
          fout:
            "vestigingId is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    if (!datum) {
      return NextResponse.json(
        {
          fout:
            "datum is verplicht.",
        },
        {
          status: 400,
        },
      );
    }

    const beginVanDag =
      datumTekstNaarBeginVanDag(
        datum,
      );

    const eindeVanDag =
      datumTekstNaarEindeVanDag(
        datum,
      );

    if (
      !beginVanDag ||
      !eindeVanDag
    ) {
      return NextResponse.json(
        {
          fout:
            "Datum moet een geldige datum zijn.",
        },
        {
          status: 400,
        },
      );
    }

    const toegang =
      await hasPermissionForVestiging(
        permissions.planning.view,
        vestigingId,
      );

    if (!toegang) {
      return NextResponse.json(
        {
          fout:
            "Geen toegang tot de medewerkers van deze vestiging.",
        },
        {
          status: 403,
        },
      );
    }

    const huidigeMedewerkerId =
      gebruiker.medewerker?.id ?? null;

    const vestiging = await prisma.vestiging.findUnique({
      where: { id: vestigingId },
      select: { organisatieId: true },
    });
    const magFinancielePlanningInzien = vestiging
      ? await isEigenaar(vestiging.organisatieId)
      : false;

    const medewerkers =
      await prisma.medewerker.findMany({
        where: {
          actief: true,

          vestigingen: {
            some: {
              vestigingId,
            },
          },
        },

        select: {
          id: true,
          personeelsnummer: true,
          aanhef: true,
          voornaam: true,
          tussenvoegsel: true,
          achternaam: true,
          uurloon: true,

          tags: {
            where: {
              tag: {
                actief: true,
              },
            },

            select: {
              tag: {
                select: {
                  id: true,
                  naam: true,
                  volgorde: true,
                  actief: true,
                },
              },
            },

            orderBy: {
              tag: {
                volgorde: "asc",
              },
            },
          },

          beschikbaarheden: {
            where: {
              datum: {
                gte: beginVanDag,
                lte: eindeVanDag,
              },
            },

            select: {
              id: true,
              weekId: true,
              medewerkerId: true,
              datum: true,
              begintijd: true,
              eindtijd: true,
              status: true,
              opmerking: true,
            },

            orderBy: {
              begintijd: "asc",
            },
          },

          diensten: {
            where: {
              dienst: {
                datum: {
                  gte: beginVanDag,
                  lte: eindeVanDag,
                },

                week: {
                  vestigingId,
                },
              },
            },

            select: {
              id: true,
              dienstId: true,
              status: true,

              dienst: {
                select: {
                  id: true,
                  datum: true,
                  begintijd: true,
                  eindtijd: true,

                  tags: {
                    select: {
                      tag: {
                        select: {
                          id: true,
                          naam: true,
                        },
                      },
                    },
                  },
                },
              },
            },

            orderBy: {
              dienst: {
                begintijd: "asc",
              },
            },
          },
        },

        orderBy: [
          {
            achternaam: "asc",
          },
          {
            voornaam: "asc",
          },
        ],
      });

    const nu = new Date();
    const vorigeVerloning = await prisma.verloningsPeriode.findFirst({
      where: { periodeEinde: { lte: nu } },
      orderBy: { periodeEinde: "desc" },
      select: { periodeEinde: true },
    });

    const urenSindsVorigeVerloning = await prisma.urenRegistratie.findMany({
      where: {
        medewerkerId: { in: medewerkers.map((medewerker) => medewerker.id) },
        status: "DEFINITIEF",
        datum: vorigeVerloning
          ? { gt: vorigeVerloning.periodeEinde, lte: nu }
          : { lte: nu },
      },
      select: {
        medewerkerId: true,
        gewerkteUren: true,
      },
    });

    const urenPerMedewerker = new Map<string, number>();
    for (const registratie of urenSindsVorigeVerloning) {
      urenPerMedewerker.set(
        registratie.medewerkerId,
        (urenPerMedewerker.get(registratie.medewerkerId) ?? 0) + Number(registratie.gewerkteUren),
      );
    }

    const resultaat =
      medewerkers.map(
        (medewerker) => ({
          id: medewerker.id,

          personeelsnummer:
            medewerker.personeelsnummer,

          aanhef:
            medewerker.aanhef,

          voornaam:
            medewerker.voornaam,

          tussenvoegsel:
            medewerker.tussenvoegsel,

          achternaam:
            medewerker.achternaam,

          ...(magFinancielePlanningInzien
            ? {
                uurloon:
                  medewerker.uurloon !== null
                    ? Number(medewerker.uurloon)
                    : null,
                urenSindsVorigeVerloning:
                  Math.round((urenPerMedewerker.get(medewerker.id) ?? 0) * 100) / 100,
                vorigeVerloningEinde:
                  vorigeVerloning?.periodeEinde?.toISOString() ?? null,
              }
            : {}),

          tags:
            medewerker.tags.map(
              (medewerkerTag) =>
                medewerkerTag.tag,
            ),

          beschikbaarheden:
            medewerker.beschikbaarheden,

          diensten:
            medewerker.diensten.map(
              (bezetting) => ({
                id: bezetting.id,

                dienstId:
                  bezetting.dienstId,

                status:
                  bezetting.status,

                dienst:
                  bezetting.dienst,
              }),
            ),
        }),
      );

    return NextResponse.json({
      huidigeMedewerkerId,
      medewerkers:
        resultaat,
    });
  } catch (error) {
    console.error(
      "Fout bij ophalen medewerkers planning:",
      error,
    );

    return NextResponse.json(
      {
        fout:
          "De medewerkers konden niet worden opgehaald.",
      },
      {
        status: 500,
      },
    );
  }
}