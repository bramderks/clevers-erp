import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function fout(bericht: string, status: number) {
  return NextResponse.json({ fout: bericht }, { status });
}

export async function POST(request: NextRequest) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) return fout("Je moet ingelogd zijn.", 401);

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return fout("Ongeldige push subscription.", 400);
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      systeemGebruikerId: gebruiker.id,
      endpoint,
      p256dh,
      auth,
      actief: true,
      laatsteFoutOp: null,
    },
    update: {
      systeemGebruikerId: gebruiker.id,
      p256dh,
      auth,
      actief: true,
      laatsteFoutOp: null,
    },
  });

  return NextResponse.json({ ok: true });
}
