import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getCurrentUser, isEigenaar } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_: Request, context: Context) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  if (!(await isEigenaar())) return NextResponse.json({ fout: "Alleen eigenaar." }, { status: 403 });

  const { id: medewerkerId, documentId } = await context.params;
  const document = await prisma.medewerkerDocument.findFirst({
    where: { id: documentId, medewerkerId },
    select: { naam: true, url: true },
  });
  if (!document) return NextResponse.json({ fout: "Document niet gevonden." }, { status: 404 });

  const { stream, blob } = await get(document.url, { access: "private" });
  const dispositionName = document.naam.replace(/[\r\n"\\]/g, "_");

  return new Response(stream, {
    headers: {
      "Content-Type": blob.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${dispositionName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
