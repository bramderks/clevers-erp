import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  if (!(await isEigenaar())) return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });

  const meldingen = await prisma.ziekmelding.findMany({
    where: { status: "ZIEK" },
    orderBy: { ziekVanaf: "desc" },
    include: {
      medewerker: {
        select: { id: true, voornaam: true, achternaam: true },
      },
    },
  });

  return NextResponse.json(meldingen);
}

export async function PATCH(request: Request) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  if (!(await isEigenaar())) return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });

  const body = await request.json();
  const id = String(body.id ?? "");

  if (!id) return NextResponse.json({ fout: "Ziekmelding ontbreekt." }, { status: 400 });

  const melding = await prisma.ziekmelding.update({
    where: { id },
    data: {
      status: "HERSTELD",
      hersteldOp: body.hersteldOp ? new Date(body.hersteldOp) : new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      systeemGebruikerId: gebruiker.id,
      module: "MEDEWERKERS",
      actie: "ZIEKMELDING_HERSTELD",
      recordId: melding.id,
      details: { medewerkerId: melding.medewerkerId },
    },
  });

  return NextResponse.json({ succes: true, melding });
}
