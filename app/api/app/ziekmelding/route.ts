import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const gebruiker = await getCurrentUser();

    if (!gebruiker?.actief || !gebruiker.medewerker?.id) {
      return NextResponse.json({ fout: "Geen actief medewerkeraccount." }, { status: 403 });
    }

    const medewerker = await prisma.medewerker.findUnique({
      where: { id: gebruiker.medewerker.id },
      select: { actief: true },
    });
    if (!medewerker?.actief) {
      return NextResponse.json({ fout: "Je medewerkeraccount is niet actief." }, { status: 403 });
    }

    const meldingen = await prisma.ziekmelding.findMany({
      where: { medewerkerId: gebruiker.medewerker.id },
      orderBy: { ziekVanaf: "desc" },
      take: 20,
    });

    return NextResponse.json(meldingen, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Ziekmeldingen van medewerker ophalen mislukt:", error);
    return NextResponse.json({ fout: "Ziekmeldingen konden niet worden opgehaald." }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { fout: "Ziekmelden kan niet via de app. Neem telefonisch contact op met de eigenaar." },
    { status: 403 },
  );
}
