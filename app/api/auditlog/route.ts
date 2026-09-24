import { NextResponse } from "next/server";
import { getCurrentUser, hasPermissionForVestiging } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) return NextResponse.json({ fout: "Je moet ingelogd zijn." }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const recordId = params.get("recordId")?.trim();
    const vestigingId = params.get("vestigingId")?.trim();
    if (!recordId || !vestigingId) {
      return NextResponse.json({ fout: "recordId en vestigingId zijn verplicht." }, { status: 400 });
    }

    if (!(await hasPermissionForVestiging(permissions.planning.view, vestigingId))) {
      return NextResponse.json({ fout: "Geen toegang." }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      where: { recordId },
      orderBy: { aangemaaktOp: "desc" },
      take: 30,
      select: {
        id: true,
        module: true,
        actie: true,
        details: true,
        aangemaaktOp: true,
        systeemGebruiker: { select: { naam: true } },
      },
    });

    return NextResponse.json(logs, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch (error) {
    console.error("Fout bij auditlog:", { requestId, error });
    return NextResponse.json({ fout: "De historie kon niet worden opgehaald." }, { status: 500 });
  }
}
