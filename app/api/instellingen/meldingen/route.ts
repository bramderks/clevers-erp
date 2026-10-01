import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Je moet ingelogd zijn." }, { status: 401 });

  const account = await prisma.systeemGebruiker.findUnique({
    where: { id: gebruiker.id },
    select: { emailMeldingenAan: true },
  });

  return NextResponse.json({
    emailMeldingenAan: account?.emailMeldingenAan ?? true,
  });
}

export async function PATCH(request: NextRequest) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker) return NextResponse.json({ fout: "Je moet ingelogd zijn." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.emailMeldingenAan !== "boolean") {
    return NextResponse.json({ fout: "Ongeldige instelling." }, { status: 400 });
  }

  const account = await prisma.systeemGebruiker.update({
    where: { id: gebruiker.id },
    data: { emailMeldingenAan: body.emailMeldingenAan },
    select: { emailMeldingenAan: true },
  });

  return NextResponse.json(account);
}
