import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  if (!(await isEigenaar())) return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });

  const { id: medewerkerId } = await context.params;

  const documenten = await prisma.medewerkerDocument.findMany({
    where: { medewerkerId },
    orderBy: [{ verloopDatum: "asc" }, { aangemaaktOp: "desc" }],
  });

  return NextResponse.json(documenten);
}

export async function POST(request: Request, context: Context) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  if (!(await isEigenaar())) return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });

  const { id: medewerkerId } = await context.params;
  const body = await request.json();

  const naam = typeof body.naam === "string" ? body.naam.trim() : "";
  const categorie = typeof body.categorie === "string" ? body.categorie.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!naam || !categorie || !url) {
    return NextResponse.json(
      { fout: "Naam, categorie en documentlink zijn verplicht." },
      { status: 400 },
    );
  }

  const document = await prisma.$transaction(async (tx) => {
    const nieuw = await tx.medewerkerDocument.create({
      data: {
        medewerkerId,
        naam,
        categorie,
        url,
        verloopDatum: body.verloopDatum ? new Date(body.verloopDatum) : null,
        opmerkingen: typeof body.opmerkingen === "string" ? body.opmerkingen.trim() || null : null,
        aangemaaktDoorId: gebruiker.id,
      },
    });

    await tx.auditLog.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        module: "MEDEWERKERS",
        actie: "DOCUMENT_TOEGEVOEGD",
        recordId: nieuw.id,
        details: { medewerkerId, categorie, naam },
      },
    });

    return nieuw;
  });

  return NextResponse.json({ succes: true, document });
}
