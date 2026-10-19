import { NextResponse } from "next/server";

import {
  getCurrentUser,
  hasPermissionForVestiging,
  isEigenaar,
} from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel } from "@/lib/planning/tijd";
import { berekenContractUren } from "@/lib/contracturen/berekening";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";
import {
  datumSleutelVoorUren,
  urenVanSamengevoegdeIntervallen,
} from "@/lib/verloning/overlappendeUren";

function uurloonVoorDag(
  medewerker: {
    uurloon: unknown;
    loonperiodes: Array<{ uurloon: unknown; periodeStart: Date; periodeEinde: Date }>;
  },
  datum: Date,
) {
  const actief = medewerker.loonperiodes.find(
    (periode) => periode.periodeStart <= datum && periode.periodeEinde >= datum,
  );
  if (actief) return Number(actief.uurloon);
  if (medewerker.uurloon !== null) return Number(medewerker.uurloon);
  return null;
}

function datumTekstNaarBeginVanDag(datum: string) { try { return kalenderDatumUTC(datum); } catch { return null; } }

function datumTekstNaarEindeVanDag(datum: string) { try { return new Date(kalenderDatumUTC(datum).getTime() + 86400000 - 1); } catch { return null; } }

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
      select: { organisatieId: true, seizoenStart: true, seizoenEinde: true },
    });
    const magFinancielePlanningInzien = vestiging
      ? await isEigenaar(vestiging.organisatieId)
      : false;

    const beheerders = vestiging
      ? await prisma.organisatieGebruiker.findMany({
          where: {
            organisatieId: vestiging.organisatieId,
            actief: true,
            rol: {
              naam: {
                in: ["Eigenaar", "Super Admin", "eigenaar", "super admin"],
              },
            },
          },
          select: { systeemGebruikerId: true },
        })
      : [];
    const beheerderSysteemGebruikerIds = beheerders.map(
      (item) => item.systeemGebruikerId,
    );

    const organisatieVestigingen =
      vestiging
        ? await prisma.vestiging.findMany({
            where: {
              organisatieId: vestiging.organisatieId,
            },
            select: { id: true },
          })
        : [];

    const organisatieVestigingIds =
      organisatieVestigingen.map((item) => item.id);

    const medewerkers =
      await prisma.medewerker.findMany({
        where: {
          OR: [
            {
              actief: true,
              vestigingen: {
                some: {
                  vestigingId,
                },
              },
            },
            ...(beheerderSysteemGebruikerIds.length > 0
              ? [
                  {
                    systeemGebruikerId: {
                      in: beheerderSysteemGebruikerIds,
                    },
                  },
                ]
              : []),
          ],
        },

        select: {
          id: true,
          systeemGebruikerId: true,
          personeelsnummer: true,
          aanhef: true,
          voornaam: true,
          tussenvoegsel: true,
          achternaam: true,
          uurloon: true,
          contractType: true,
          contractUren: true,
          jaarUrenNorm: true,
          verlofUrenStart: true,
          verlofUrenOpgenomen: true,
          vestigingen: { select: { vestigingId: true } },
          loonperiodes: {
            where: { actief: true },
            select: { uurloon: true, periodeStart: true, periodeEinde: true },
            orderBy: { periodeStart: "desc" },
          },

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
                  vestigingId: {
                    in: organisatieVestigingIds,
                  },
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
                  week: {
                    select: {
                      vestigingId: true,
                      vestiging: {
                        select: {
                          naam: true,
                        },
                      },
                    },
                  },

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
    const vandaag = kalenderDatumUTC(lokaleDatumSleutel(nu));
    const gekozenDatum = kalenderDatumUTC(datum);
    const weekStart = new Date(gekozenDatum);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const volgendeWeek = new Date(weekStart);
    volgendeWeek.setUTCDate(volgendeWeek.getUTCDate() + 7);
    const jaar = vandaag.getUTCFullYear();
    const seizoenStart = vestiging?.seizoenStart ? new Date(Date.UTC(vestiging.seizoenStart.getUTCFullYear(), vestiging.seizoenStart.getUTCMonth(), vestiging.seizoenStart.getUTCDate())) : new Date(Date.UTC(jaar, 0, 1));
    const seizoenEinde = vestiging?.seizoenEinde ? new Date(Date.UTC(vestiging.seizoenEinde.getUTCFullYear(), vestiging.seizoenEinde.getUTCMonth(), vestiging.seizoenEinde.getUTCDate())) : new Date(Date.UTC(jaar, 11, 31));
    const seizoenEindeExclusief = new Date(seizoenEinde);
    seizoenEindeExclusief.setUTCDate(seizoenEindeExclusief.getUTCDate() + 1);
    const medewerkerIds = medewerkers.map((medewerker) => medewerker.id);
    const [seizoenRegistraties, seizoenBezettingen, seizoenWeken] = magFinancielePlanningInzien && medewerkerIds.length > 0
      ? await Promise.all([
          prisma.urenRegistratie.findMany({
            where: { medewerkerId: { in: medewerkerIds }, vestigingId: { in: organisatieVestigingIds }, status: "DEFINITIEF", datum: { gte: seizoenStart, lt: seizoenEindeExclusief } },
            select: { medewerkerId: true, datum: true, gewerkteUren: true, vestigingId: true },
          }),
          prisma.dienstBezetting.findMany({
            where: { medewerkerId: { in: medewerkerIds }, status: { in: ["GEPLAND", "BEVESTIGD", "GEWERKT"] }, dienst: { datum: { gte: weekStart < vandaag ? weekStart : vandaag, lt: seizoenEindeExclusief }, week: { status: "GEPUBLICEERD", vestigingId: { in: organisatieVestigingIds } } } },
            select: { medewerkerId: true, dienst: { select: { datum: true, begintijd: true, eindtijd: true, week: { select: { status: true, jaar: true, weeknummer: true, vestigingId: true } } } } },
          }),
          prisma.week.findMany({
            where: { vestigingId: { in: organisatieVestigingIds }, jaar: { gte: seizoenStart.getUTCFullYear() - 1, lte: seizoenEinde.getUTCFullYear() + 1 } },
            select: { vestigingId: true, jaar: true, weeknummer: true },
          }),
        ])
      : [[], [], []] as const;

    const resterendeOpeningsweken = new Set(seizoenWeken.filter((week) => {
      const vierJanuari = new Date(Date.UTC(week.jaar, 0, 4));
      vierJanuari.setUTCDate(vierJanuari.getUTCDate() - ((vierJanuari.getUTCDay() + 6) % 7) + (week.weeknummer - 1) * 7);
      const weekEinde = new Date(vierJanuari);
      weekEinde.setUTCDate(weekEinde.getUTCDate() + 6);
      return vierJanuari <= seizoenEinde && weekEinde >= seizoenStart && weekEinde >= vandaag;
    }).map((week) => `${week.jaar}-${week.weeknummer}`)).size;

    const contracturenBalansPerMedewerker = new Map<string, { contractUren: number | null; jaarNorm: number; teWerkenNorm: number; gewerkteUren: number; liveIngeplandDezeWeek: number; liveIngeplandRestSeizoen: number; nogNietIngepland: number; resterendeOpeningsweken: number; gemiddeldNogInTePlannenPerWeek: number | null; prognoseOverschot: number; verlofUrenStart: number | null; resterendVerlof: number | null }>();
    for (const medewerker of medewerkers) {
      if (medewerker.contractType !== "VAST") continue;
      const eigenVestigingen = new Set(medewerker.vestigingen.map((item) => item.vestigingId));
      const gewerkteUren = seizoenRegistraties.filter((item) => item.medewerkerId === medewerker.id && eigenVestigingen.has(item.vestigingId) && item.datum >= seizoenStart && item.datum <= seizoenEinde).reduce((som, item) => som + Number(item.gewerkteUren), 0);
      const eigenBezettingen = seizoenBezettingen.filter((item) => item.medewerkerId === medewerker.id && eigenVestigingen.has(item.dienst.week.vestigingId) && item.dienst.week.status === "GEPUBLICEERD" && item.dienst.datum >= seizoenStart && item.dienst.datum <= seizoenEinde);
      const urenDienst = (item: (typeof eigenBezettingen)[number]) => berekenGewerkteUren(item.dienst.begintijd, item.dienst.eindtijd).gewerkteUren;
      const liveDezeWeek = eigenBezettingen.filter((item) => item.dienst.datum >= weekStart && item.dienst.datum < volgendeWeek).reduce((som, item) => som + urenDienst(item), 0);
      const liveRestSeizoen = eigenBezettingen.filter((item) => item.dienst.datum >= vandaag).reduce((som, item) => som + urenDienst(item), 0);
      const contractUren = medewerker.contractUren == null ? null : Number(medewerker.contractUren);
      const jaarUrenNorm = medewerker.jaarUrenNorm == null ? null : Number(medewerker.jaarUrenNorm);
      const verlofUrenStart = medewerker.verlofUrenStart == null ? null : Number(medewerker.verlofUrenStart);
      const verlofUrenOpgenomen = medewerker.verlofUrenOpgenomen == null ? 0 : Number(medewerker.verlofUrenOpgenomen);
      const balans = berekenContractUren({ contractUren, jaarUrenNorm, verlofUrenStart, gewerkteUren, liveIngepland: liveRestSeizoen, resterendeOpeningsweken });
      contracturenBalansPerMedewerker.set(medewerker.id, { contractUren, jaarNorm: balans.jaarNorm, teWerkenNorm: balans.teWerkenNorm, gewerkteUren: balans.gewerkteUren, liveIngeplandDezeWeek: Math.round(liveDezeWeek * 100) / 100, liveIngeplandRestSeizoen: balans.liveIngepland, nogNietIngepland: balans.nogNietIngepland, resterendeOpeningsweken, gemiddeldNogInTePlannenPerWeek: balans.gemiddeldNogInTePlannenPerWeek, prognoseOverschot: balans.prognoseOverschot, verlofUrenStart, resterendVerlof: verlofUrenStart === null ? null : Math.max(0, verlofUrenStart - verlofUrenOpgenomen) });
    }

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
        datum: true,
        werkelijkeBegintijd: true,
        werkelijkeEindtijd: true,
      },
    });

    const registratiesPerDag = new Map<string, typeof urenSindsVorigeVerloning>();
    for (const registratie of urenSindsVorigeVerloning) {
      const sleutel = `${registratie.medewerkerId}:${datumSleutelVoorUren(registratie.datum)}`;
      const lijst = registratiesPerDag.get(sleutel) ?? [];
      lijst.push(registratie);
      registratiesPerDag.set(sleutel, lijst);
    }

    const urenPerMedewerker = new Map<string, number>();
    for (const lijst of registratiesPerDag.values()) {
      const medewerkerId = lijst[0]?.medewerkerId;
      if (!medewerkerId) continue;

      const uren = urenVanSamengevoegdeIntervallen(
        lijst.map((registratie) => ({
          begintijd: registratie.werkelijkeBegintijd,
          eindtijd: registratie.werkelijkeEindtijd,
        })),
      );

      urenPerMedewerker.set(
        medewerkerId,
        (urenPerMedewerker.get(medewerkerId) ?? 0) + uren,
      );
    }

    const resultaat =
      medewerkers.map(
        (medewerker) => ({
          id: medewerker.id,

          isBeheerder: beheerderSysteemGebruikerIds.includes(medewerker.systeemGebruikerId ?? ""),

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
                uurloon: uurloonVoorDag(medewerker, beginVanDag),
                urenSindsVorigeVerloning:
                  Math.round((urenPerMedewerker.get(medewerker.id) ?? 0) * 100) / 100,
                vorigeVerloningEinde:
                  vorigeVerloning?.periodeEinde?.toISOString() ?? null,
              }
            : {}),

          ...(magFinancielePlanningInzien && contracturenBalansPerMedewerker.has(medewerker.id)
            ? { contracturenBalans: contracturenBalansPerMedewerker.get(medewerker.id) }
            : {}),

          loonperiodes: undefined,

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

                dienst: {
                  ...bezetting.dienst,
                  vestigingId:
                    bezetting.dienst.week.vestigingId,
                  vestigingNaam:
                    bezetting.dienst.week.vestiging.naam,
                },
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