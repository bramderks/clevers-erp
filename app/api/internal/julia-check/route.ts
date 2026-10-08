import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const medewerkers = await prisma.medewerker.findMany({
    where: { voornaam: "Julia", achternaam: "Leenders" },
    select: { id: true, vestigingen: { select: { vestigingId: true, vestiging: { select: { naam: true } } } } },
  });
  const out = [];
  for (const m of medewerkers) {
    for (const v of m.vestigingen) {
      if (!v.vestiging.naam.toLowerCase().includes("nijmegen")) continue;
      const regs = await prisma.urenRegistratie.findMany({
        where: {
          medewerkerId: m.id,
          vestigingId: v.vestigingId,
          datum: { gte: new Date("2026-08-31T22:00:00.000Z"), lt: new Date("2026-10-01T22:00:00.000Z") },
        },
        select: { status: true, gewerkteUren: true, datum: true, werkelijkeBegintijd: true, werkelijkeEindtijd: true },
        orderBy: { datum: "asc" },
      });
      const diensten = await prisma.dienstBezetting.count({
        where: { medewerkerId: m.id, dienst: { vestigingId: v.vestigingId, begintijd: { gte: new Date("2026-08-31T22:00:00.000Z"), lt: new Date("2026-10-01T22:00:00.000Z") } } },
      });
      out.push({ diensten, registraties: regs });
    }
  }
  return NextResponse.json({ out });
}
