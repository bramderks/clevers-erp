import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: [{ volgorde: "asc" }, { naam: "asc" }] });
  const diensten = await prisma.dienst.findMany({
    where: {
      datum: { gte: new Date("2026-09-01T00:00:00.000Z"), lt: new Date("2026-10-01T00:00:00.000Z") },
      week: { vestiging: { naam: { contains: "Nijmegen", mode: "insensitive" } } },
    },
    orderBy: [{ datum: "asc" }, { begintijd: "asc" }],
    include: {
      week: { include: { vestiging: true } },
      tags: { include: { tag: true }, orderBy: { tag: { volgorde: "asc" } } },
      bezetting: { include: { medewerker: true }, orderBy: { aangemaaktOp: "asc" } },
    },
  });
  return NextResponse.json({
    tags: tags.map(t => ({ id:t.id, naam:t.naam, volgorde:t.volgorde, actief:t.actief })),
    diensten: diensten.map(d => ({
      id:d.id, datum:d.datum, begintijd:d.begintijd, eindtijd:d.eindtijd,
      vestiging:d.week.vestiging.naam,
      tags:d.tags.map(x=>({naam:x.tag.naam,aantal:x.aantal})),
      bezetting:d.bezetting.map(b=>({medewerkerId:b.medewerkerId,naam:b.medewerker?[b.medewerker.voornaam,b.medewerker.tussenvoegsel,b.medewerker.achternaam].filter(Boolean).join(" "):null,status:b.status}))
    }))
  });
}
