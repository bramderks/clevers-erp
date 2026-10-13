import { del } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaarVoorMedewerker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; documentId: string }> };

export async function DELETE(_: Request, context: Context) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  const { id: medewerkerId, documentId } = await context.params;
  if (!(await isEigenaarVoorMedewerker(medewerkerId))) {
    return NextResponse.json({ fout: "Alleen een eigenaar van de organisaties van deze medewerker heeft toegang." }, { status: 403 });
  }
  const bestaand = await prisma.medewerkerDocument.findFirst({
    where: { id: documentId, medewerkerId },
    select: { id: true, naam: true, url: true },
  });
  if (!bestaand) return NextResponse.json({ fout: "Document niet gevonden." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.medewerkerDocument.delete({ where: { id: documentId } });
    await tx.auditLog.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        module: "MEDEWERKERS",
        actie: "DOCUMENT_VERWIJDERD",
        recordId: documentId,
        details: { medewerkerId, naam: bestaand.naam },
      },
    });
  });

  await del(bestaand.url).catch(() => undefined);
  return NextResponse.json({ succes: true });
}
