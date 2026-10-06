import { NextResponse } from "next/server";

import { bepaalPauzeMinuten, berekenGewerkteUren } from "@/lib/verloning/pauze";
import { prisma } from "@/lib/prisma";

const MIGRATION_SECRET = "clevers-september-uren-2026-herberekening-8f4c2a";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("secret") !== MIGRATION_SECRET) {
    return NextResponse.json({ error: "Niet toegestaan." }, { status: 403 });
  }

  const start = new Date("2026-09-01T00:00:00+02:00");
  const end = new Date("2026-10-01T00:00:00+02:00");

  const registraties = await prisma.urenRegistratie.findMany({
    where: {
      datum: { gte: start, lt: end },
      status: "DEFINITIEF",
    },
    select: {
      id: true,
      werkelijkeBegintijd: true,
      werkelijkeEindtijd: true,
      pauzeMinuten: true,
      gewerkteUren: true,
    },
  });

  let gewijzigd = 0;

  await prisma.$transaction(
    registraties.map((registratie) => {
      const begintijd = registratie.werkelijkeBegintijd;
      const eindtijd = registratie.werkelijkeEindtijd;

      const berekening = berekenGewerkteUren(begintijd, eindtijd);
      const pauze = bepaalPauzeMinuten(begintijd, eindtijd);
      const uren = berekening.gewerkteUren;

      if (
        registratie.pauzeMinuten !== pauze ||
        Number(registratie.gewerkteUren) !== uren
      ) {
        gewijzigd += 1;
      }

      return prisma.urenRegistratie.update({
        where: { id: registratie.id },
        data: { pauzeMinuten: pauze, gewerkteUren: uren },
      });
    }),
  );

  return NextResponse.json({
    ok: true,
    maand: "09-2026",
    aantalDefinitief: registraties.length,
    aantalGewijzigd: gewijzigd,
  });
}
