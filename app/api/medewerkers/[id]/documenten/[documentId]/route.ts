import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; documentId: string }> };

export async function DELETE(_: Request, context: Context) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  if (!(await isEigenaar())) return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });

  const { id: medewerkerId, documentId } = await context.params;

  const bestaand = await prisma.medewerkerDocument.findFirst({
    where: { id: documentId, medewerkerId },
    select: { id: true, naam: true },
  });

  if (!bestaand) {
    return NextResponse.json({ fout: "Document niet gevonden." }, { status: 404 });
  }

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

  return NextResponse.json({ succes: true });
}
