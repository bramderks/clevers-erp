import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";

const TOKEN = "clevers-september-uren-2026";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ fout: "Ongeldige token." }, { status: 403 });
  }

  try {
    const vestiging = await prisma.vestiging.findFirst({
      where: { naam: "Nijmegen", actief: true },
      select: { id: true, organisatieId: true },
    });
    if (!vestiging) throw new Error("Vestiging Nijmegen niet gevonden.");

    const eigenaar = await prisma.systeemGebruiker.findFirst({
      where: {
        actief: true,
        organisaties: {
          some: {
            actief: true,
            organisatieId: vestiging.organisatieId,
            rol: { naam: { equals: "Eigenaar", mode: "insensitive" } },
          },
        },
      },
      select: { id: true, naam: true },
    });
    if (!eigenaar) throw new Error("Geen actieve eigenaar gevonden.");

    const start = new Date("2026-08-31T22:00:00.000Z");
    const einde = new Date("2026-10-01T22:00:00.000Z");

    const bezettingen = await prisma.dienstBezetting.findMany({
      where: {
        medewerkerId: { not: null },
        status: { not: "AFGEZEGD" },
        dienst: {
          week: { vestigingId: vestiging.id },
          datum: { gte: start, lt: einde },
        },
      },
      include: {
        dienst: { select: { datum: true, begintijd: true, eindtijd: true } },
        urenregistratie: { select: { id: true } },
      },
      orderBy: { dienst: { datum: "asc" } },
    });

    const ontbrekend = bezettingen.filter((b) => !b.urenregistratie);
    if (ontbrekend.length === 0) {
      return NextResponse.json({ succes: true, aangemaakt: 0, bestaand: bezettingen.length });
    }

    const data = ontbrekend.map((b) => {
      const berekening = berekenGewerkteUren(b.dienst.begintijd, b.dienst.eindtijd);
      return {
        dienstBezettingId: b.id,
        medewerkerId: b.medewerkerId!,
        vestigingId: vestiging.id,
        datum: b.dienst.datum,
        taak: null,
        werkelijkeBegintijd: b.dienst.begintijd,
        werkelijkeEindtijd: b.dienst.eindtijd,
        pauzeMinuten: berekening.pauzeMinuten,
        gewerkteUren: berekening.gewerkteUren,
        status: "DEFINITIEF",
        gecontroleerdDoorId: eigenaar.id,
        gecontroleerdOp: new Date(),
        opmerking: "September 2026 hersteld vanuit definitieve planning en door eigenaar bevestigde uren.",
      };
    });

    await prisma.urenRegistratie.createMany({ data, skipDuplicates: true });

    return NextResponse.json({
      succes: true,
      aangemaakt: data.length,
      bestaand: bezettingen.length - ontbrekend.length,
      totaalBezettingen: bezettingen.length,
      gecontroleerdDoor: eigenaar.naam,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Herstel mislukt." },
      { status: 500 },
    );
  }
}
