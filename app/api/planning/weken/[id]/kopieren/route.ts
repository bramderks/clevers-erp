import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kalenderDatumUTC, lokaleDatumSleutel, nederlandseDatumTijd, formatDienstTijd } from "@/lib/planning/tijd";
import { lokaleDagGrenzen } from "@/lib/planning/tijd";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function beginVanISOWeek(jaar: number, weeknummer: number) {
  const datum = new Date(Date.UTC(jaar, 0, 4));
  const dag = datum.getUTCDay() || 7;
  datum.setUTCDate(datum.getUTCDate() - dag + 1 + (weeknummer - 1) * 7);
  datum.setUTCHours(0, 0, 0, 0);
  return datum;
}

function isoWeekVanDatum(datum: Date) {
  const utc = new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
  const dag = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dag);
  const jaar = utc.getUTCFullYear();
  const jaarStart = new Date(Date.UTC(jaar, 0, 1));
  const weeknummer = Math.ceil((((utc.getTime() - jaarStart.getTime()) / 86400000) + 1) / 7);
  return { jaar, weeknummer };
}

function verschuifKalenderdatum(datum: Date, verschilDagen: number) {
  const sleutel = lokaleDatumSleutel(datum);
  const [jaar, maand, dag] = sleutel.split("-").map(Number);
  const verschoven = new Date(Date.UTC(jaar, maand - 1, dag + verschilDagen));
  return lokaleDatumSleutel(verschoven);
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const gebruiker = await getCurrentUser();

    if (!gebruiker) {
      return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const doelJaar = Number(body.jaar);
    const doelWeeknummer = Number(body.weeknummer);

    if (
      !Number.isInteger(doelJaar) ||
      doelJaar < 2000 ||
      !Number.isInteger(doelWeeknummer) ||
      doelWeeknummer < 1 ||
      doelWeeknummer > 53
    ) {
      return NextResponse.json(
        { fout: "Jaar en weeknummer zijn ongeldig." },
        { status: 400 },
      );
    }

    const doelWeekStart = beginVanISOWeek(doelJaar, doelWeeknummer);
    const isoDoelWeek = isoWeekVanDatum(doelWeekStart);
    if (isoDoelWeek.jaar !== doelJaar || isoDoelWeek.weeknummer !== doelWeeknummer) {
      return NextResponse.json(
        { fout: "Deze ISO-week bestaat niet in het gekozen jaar." },
        { status: 400 },
      );
    }

    const bron = await prisma.week.findUnique({
      where: { id },
      include: {
        vestiging: { select: { organisatieId: true } },
        diensten: {
          include: {
            tags: true,
            bezetting: {
            where: { status: { not: "AFGEZEGD" } },
          },
          },
          orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
        },
      },
    });

    if (!bron) {
      return NextResponse.json({ fout: "Bronweek niet gevonden." }, { status: 404 });
    }

    if (!(await isEigenaar(bron.vestiging.organisatieId))) {
      return NextResponse.json(
        { fout: "Alleen de eigenaar kan een planning kopiëren." },
        { status: 403 },
      );
    }

    const bestaand = await prisma.week.findUnique({
      where: {
        vestigingId_jaar_weeknummer: {
          vestigingId: bron.vestigingId,
          jaar: doelJaar,
          weeknummer: doelWeeknummer,
        },
      },
      select: { id: true },
    });

    if (bestaand) {
      return NextResponse.json(
        { fout: "De doelweek bestaat al." },
        { status: 409 },
      );
    }

    const verschilDagen = Math.round((doelWeekStart.getTime() - beginVanISOWeek(bron.jaar, bron.weeknummer).getTime()) / 86400000);

    const kopieerbareDiensten = bron.diensten.map((dienst) => {
      const datumSleutel = verschuifKalenderdatum(dienst.datum, verschilDagen);
      return {
        bron: dienst,
        datumSleutel,
        datum: kalenderDatumUTC(datumSleutel),
        begintijd: nederlandseDatumTijd(datumSleutel, formatDienstTijd(dienst.begintijd)),
        eindtijd: nederlandseDatumTijd(datumSleutel, formatDienstTijd(dienst.eindtijd)),
      };
    });

    const medewerkerIds = [...new Set(
      kopieerbareDiensten.flatMap((dienst) =>
        dienst.bron.bezetting
          .map((bezetting) => bezetting.medewerkerId)
          .filter((medewerkerId): medewerkerId is string => Boolean(medewerkerId)),
      ),
    )];
    if (medewerkerIds.length > 0 && kopieerbareDiensten.length > 0) {
      const eersteDag = lokaleDagGrenzen(kopieerbareDiensten[0].datumSleutel);
      const laatsteDag = lokaleDagGrenzen(kopieerbareDiensten[kopieerbareDiensten.length - 1].datumSleutel);
      const bestaandeBezettingen = await prisma.dienstBezetting.findMany({
        where: {
          medewerkerId: { in: medewerkerIds },
          status: { not: "AFGEZEGD" },
          dienst: {
            begintijd: { gte: eersteDag.start, lt: laatsteDag.einde },
            week: {
              vestiging: { organisatieId: bron.vestiging.organisatieId },
            },
          },
        },
        select: {
          medewerkerId: true,
          dienst: {
            select: {
              begintijd: true,
              eindtijd: true,
              week: {
                select: {
                  vestiging: { select: { id: true, naam: true } },
                },
              },
            },
          },
        },
      });

      const buffer = 60 * 60 * 1000;
      for (const dienst of kopieerbareDiensten) {
        for (const bezetting of dienst.bron.bezetting) {
          if (!bezetting.medewerkerId) continue;
          const conflict = bestaandeBezettingen.find((bestaand) =>
            bestaand.medewerkerId === bezetting.medewerkerId &&
            lokaleDatumSleutel(bestaand.dienst.begintijd) === dienst.datumSleutel &&
            bestaand.dienst.week.vestiging.id !== bron.vestigingId &&
            dienst.begintijd.getTime() < bestaand.dienst.eindtijd.getTime() + buffer &&
            dienst.eindtijd.getTime() > bestaand.dienst.begintijd.getTime() - buffer,
          );
          if (conflict) {
            return NextResponse.json(
              {
                fout: `De planning kan niet worden gekopieerd: een medewerker heeft rond deze dienst al een dienst in ${conflict.dienst.week.vestiging.naam}. Tussen vestigingen is 1 uur reistijd gereserveerd.`,
                code: "ANDERE_VESTIGING_ZELFDE_DAG",
              },
              { status: 409 },
            );
          }
        }
      }
    }

    const resultaat = await prisma.$transaction(async (tx) => {
      const doelWeek = await tx.week.create({
        data: {
          vestigingId: bron.vestigingId,
          jaar: doelJaar,
          weeknummer: doelWeeknummer,
          status: "IN_PLANNING",
          beschikbaarheidDeadline: null,
        },
      });

      for (const dienst of kopieerbareDiensten) {
        const nieuweDienst = await tx.dienst.create({
          data: {
            weekId: doelWeek.id,
            datum: dienst.datum,
            begintijd: dienst.begintijd,
            eindtijd: dienst.eindtijd,
            opmerkingen: dienst.bron.opmerkingen,
            tags: {
              create: dienst.bron.tags.map((tag) => ({
                tagId: tag.tagId,
                aantal: tag.aantal,
              })),
            },
          },
        });

        for (const bezetting of dienst.bron.bezetting) {
          await tx.dienstBezetting.create({
            data: {
              dienstId: nieuweDienst.id,
              medewerkerId: bezetting.medewerkerId,
              status: bezetting.medewerkerId ? "GEPLAND" : "OPEN",
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          systeemGebruikerId: gebruiker.id,
          module: "PLANNING",
          actie: "WEEK_GEKOOPIEERD",
          recordId: doelWeek.id,
          details: {
            bronWeekId: bron.id,
            bronJaar: bron.jaar,
            bronWeeknummer: bron.weeknummer,
            doelJaar,
            doelWeeknummer,
            diensten: bron.diensten.length,
          },
        },
      });

      return doelWeek;
    });

    return NextResponse.json({
      succes: true,
      week: resultaat,
    });
  } catch (error) {
    console.error("Planning kopiëren mislukt:", error);

    return NextResponse.json(
      { fout: "De planning kon niet worden gekopieerd." },
      { status: 500 },
    );
  }
}
