import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
      !Number.isInteger(doelWeeknummer) ||
      doelWeeknummer < 1 ||
      doelWeeknummer > 53
    ) {
      return NextResponse.json(
        { fout: "Jaar en weeknummer zijn ongeldig." },
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
            bezetting: true,
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

    const verschilDagen = (doelWeeknummer - bron.weeknummer) * 7;

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

      for (const dienst of bron.diensten) {
        const datum = new Date(dienst.datum);
        datum.setDate(datum.getDate() + verschilDagen);

        const begintijd = new Date(dienst.begintijd);
        begintijd.setDate(begintijd.getDate() + verschilDagen);

        const eindtijd = new Date(dienst.eindtijd);
        eindtijd.setDate(eindtijd.getDate() + verschilDagen);

        const nieuweDienst = await tx.dienst.create({
          data: {
            weekId: doelWeek.id,
            datum,
            begintijd,
            eindtijd,
            opmerkingen: dienst.opmerkingen,
            tags: {
              create: dienst.tags.map((tag) => ({
                tagId: tag.tagId,
                aantal: tag.aantal,
              })),
            },
          },
        });

        for (const bezetting of dienst.bezetting) {
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
