import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  }

  if (!(await isEigenaar())) {
    return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });
  }

  const interesse = await prisma.auditLog.findMany({
    where: {
      module: "PLANNING",
      actie: "INTERESSE_OPEN_DIENST",
    },
    orderBy: { aangemaaktOp: "desc" },
    take: 200,
    include: {
      systeemGebruiker: {
        select: {
          id: true,
          naam: true,
          medewerker: {
            select: { id: true },
          },
        },
      },
    },
  });

  const resultaat = [];

  for (const item of interesse) {
    const bezetting = await prisma.dienstBezetting.findUnique({
      where: { id: item.recordId ?? "__geen_record__" },
      select: {
        id: true,
        status: true,
        medewerkerId: true,
        dienst: {
          select: {
            datum: true,
            begintijd: true,
            eindtijd: true,
            week: { select: { vestiging: { select: { naam: true } } } },
          },
        },
      },
    });

    if (bezetting?.status === "OPEN" && !bezetting.medewerkerId && item.systeemGebruiker) {
      resultaat.push({
        interesseId: item.id,
        dienstBezettingId: bezetting.id,
        medewerkerId: item.systeemGebruiker.medewerker?.id ?? null,
        medewerkerNaam: item.systeemGebruiker.naam,
        aangemeldOp: item.aangemaaktOp,
        dienst: bezetting.dienst!,
      });
    }
  }

  return NextResponse.json(resultaat);
}

export async function POST(request: Request) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  }

  if (!(await isEigenaar())) {
    return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });
  }

  const body = await request.json();
  const dienstBezettingId = String(body.dienstBezettingId ?? "");
  const medewerkerId = String(body.medewerkerId ?? "");

  if (!dienstBezettingId || !medewerkerId) {
    return NextResponse.json({ fout: "Dienst of medewerker ontbreekt." }, { status: 400 });
  }

  const resultaat = await prisma.$transaction(async (tx) => {
    const openDienst = await tx.dienstBezetting.findFirst({
      where: { id: dienstBezettingId, status: "OPEN", medewerkerId: null },
      select: { id: true, dienstId: true },
    });

    if (!openDienst) return null;

    const medewerker = await tx.medewerker.findUnique({
      where: { id: medewerkerId },
      select: { id: true },
    });

    if (!medewerker) throw new Error("Medewerker niet gevonden.");

    const bezetting = await tx.dienstBezetting.update({
      where: { id: openDienst.id },
      data: { medewerkerId, status: "GEPLAND" },
    });

    await tx.auditLog.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        module: "PLANNING",
        actie: "OPEN_DIENST_TOEGEWEZEN",
        recordId: bezetting.id,
        details: { medewerkerId },
      },
    });

    return bezetting;
  });

  if (!resultaat) {
    return NextResponse.json({ fout: "Dienst is niet meer open." }, { status: 409 });
  }

  return NextResponse.json({ succes: true, bezetting: resultaat });
}
