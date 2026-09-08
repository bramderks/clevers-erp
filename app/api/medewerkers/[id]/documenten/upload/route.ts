import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request, context: Context) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  if (!(await isEigenaar())) return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });

  const { id: medewerkerId } = await context.params;
  const medewerker = await prisma.medewerker.findUnique({ where: { id: medewerkerId }, select: { id: true } });
  if (!medewerker) return NextResponse.json({ fout: "Medewerker niet gevonden." }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const categorie = String(formData.get("categorie") ?? "").trim();
  const verloopDatumWaarde = String(formData.get("verloopDatum") ?? "").trim();
  const opmerkingen = String(formData.get("opmerkingen") ?? "").trim();

  if (!(file instanceof File) || !categorie) {
    return NextResponse.json({ fout: "Bestand en categorie zijn verplicht." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ fout: "Alleen PDF, JPG, PNG en WEBP zijn toegestaan." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ fout: "Bestand is groter dan 10 MB." }, { status: 400 });
  }

  const veiligNaam = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const pathname = "medewerkers/" + medewerkerId + "/" + Date.now() + "-" + veiligNaam;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const document = await prisma.$transaction(async (tx) => {
    const nieuw = await tx.medewerkerDocument.create({
      data: {
        medewerkerId,
        categorie,
        naam: file.name,
        url: blob.url,
        verloopDatum: verloopDatumWaarde ? new Date(verloopDatumWaarde) : null,
        opmerkingen: opmerkingen || null,
        aangemaaktDoorId: gebruiker.id,
      },
    });

    await tx.auditLog.create({
      data: {
        systeemGebruikerId: gebruiker.id,
        module: "MEDEWERKERS",
        actie: "DOCUMENT_GEUPLOAD",
        recordId: nieuw.id,
        details: { medewerkerId, categorie, naam: file.name },
      },
    });

    return nieuw;
  });

  return NextResponse.json({ succes: true, document });
}
