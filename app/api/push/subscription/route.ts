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

  if (!endpoint || !p256dh || !auth) return fout("Ongeldige push subscription.", 400);

  // Per account is één actief pushapparaat leidend. Bij activering op een
  // nieuwe telefoon verhuist de registratie dus van het oude apparaat mee.
  await prisma.$transaction(async (tx) => {
    await tx.pushSubscription.updateMany({
      where: {
        systeemGebruikerId: gebruiker.id,
        endpoint: { not: endpoint },
        actief: true,
      },
      data: { actief: false },
    });

    await tx.pushSubscription.upsert({
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
  });

  return NextResponse.json({ ok: true, apparaatVerplaatst: true });
}

export async function DELETE(request: NextRequest) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return fout("Je moet ingelogd zijn.", 401);

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";

  if (!endpoint) return fout("Push subscription ontbreekt.", 400);

  await prisma.pushSubscription.updateMany({
    where: { systeemGebruikerId: gebruiker.id, endpoint },
    data: { actief: false },
  });

  return NextResponse.json({ ok: true });
}
