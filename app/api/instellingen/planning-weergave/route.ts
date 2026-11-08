import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TOEGESTANE_WEERGAVES = [
  "VANDAAG",
  "LAATSTE_POSITIE",
  "HUIDIGE_WEEK",
] as const;

export async function GET() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json(
      { fout: "Je moet ingelogd zijn." },
      { status: 401 },
    );
  }

  return NextResponse.json({
    planningWeergave: gebruiker.planningWeergave ?? "HUIDIGE_WEEK",
  });
}

export async function PATCH(request: NextRequest) {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json(
      { fout: "Je moet ingelogd zijn." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const planningWeergave = body?.planningWeergave;

  if (
    typeof planningWeergave !== "string" ||
    !TOEGESTANE_WEERGAVES.includes(
      planningWeergave as (typeof TOEGESTANE_WEERGAVES)[number],
    )
  ) {
    return NextResponse.json(
      { fout: "Kies een geldige planningweergave." },
      { status: 400 },
    );
  }

  const account = await prisma.systeemGebruiker.update({
    where: { id: gebruiker.id },
    data: { planningWeergave },
    select: { planningWeergave: true },
  });

  return NextResponse.json(account);
}
