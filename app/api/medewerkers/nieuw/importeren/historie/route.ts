import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) {
      return NextResponse.json({ error: "Je moet ingelogd zijn." }, { status: 401 });
    }

    const eigenaar = gebruiker.organisaties.find(
      (r) =>
        r.actief &&
        r.organisatie.actief &&
        r.rol.naam.trim().toLowerCase() === "eigenaar",
    );

    if (!eigenaar) {
      return NextResponse.json({ error: "Alleen de Eigenaar kan activatiehistorie bekijken." }, { status: 403 });
    }

    const activaties = await prisma.medewerkerUitnodiging.findMany({
      where: { organisatieId: eigenaar.organisatieId },
      select: {
        id: true,
        voornaam: true,
        achternaam: true,
        email: true,
        verstuurdOp: true,
        verlooptOp: true,
        gebruiktOp: true,
      },
      orderBy: { verstuurdOp: "desc" },
      take: 50,
    });

    return NextResponse.json({ activaties });
  } catch (error) {
    console.error("Activatiehistorie ophalen:", error);
    return NextResponse.json({ error: "De activatiehistorie kon niet worden opgehaald." }, { status: 500 });
  }
}
