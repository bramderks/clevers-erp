import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leesNieuweMedewerkersBestand } from "@/lib/medewerkers/nieuweMedewerkersImport";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) return NextResponse.json({ error: "Je moet ingelogd zijn." }, { status: 401 });

    const eigenaar = gebruiker.organisaties.find(
      (r) => r.actief && r.organisatie.actief && r.rol.naam.trim().toLowerCase() === "eigenaar",
    );
    if (!eigenaar) return NextResponse.json({ error: "Alleen de Eigenaar kan medewerkers toevoegen." }, { status: 403 });

    const formData = await request.formData();
    const bestand = formData.get("bestand");
    if (!(bestand instanceof File) || bestand.size === 0) {
      return NextResponse.json({ error: "Geen geldig Excel-bestand ontvangen." }, { status: 400 });
    }

    const gelezen = await leesNieuweMedewerkersBestand(bestand);
    if (gelezen.fouten.length) {
      return NextResponse.json({ ok: false, fouten: gelezen.fouten, medewerkers: [] }, { status: 422 });
    }

    const emails = [...new Set(gelezen.rijen.map((r) => r.email))];
    const [medewerkers, gebruikers, uitnodigingen] = await Promise.all([
      prisma.medewerker.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
      prisma.systeemGebruiker.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
      prisma.medewerkerUitnodiging.findMany({
        where: { organisatieId: eigenaar.organisatieId, email: { in: emails }, gebruiktOp: null, verlooptOp: { gt: new Date() } },
        select: { email: true },
      }),
    ]);

    const bestaandeEmails = new Set([
      ...medewerkers.map((m) => m.email.toLowerCase()),
      ...gebruikers.map((g) => g.email.toLowerCase()),
      ...uitnodigingen.map((i) => i.email.toLowerCase()),
    ]);
    const bestandEmails = new Map<string, number>();
    const fouten: Array<{ rij: number; melding: string }> = [];
    const resultaat = gelezen.rijen.map((r) => {
      const eerder = bestandEmails.get(r.email);
      if (eerder !== undefined) {
        fouten.push({ rij: r.rij, melding: `Dit e-mailadres komt ook voor op rij ${eerder} in het importbestand.` });
        return { ...r, status: "DUBBEL", melding: `Dubbel e-mailadres op rij ${eerder}` };
      }
      bestandEmails.set(r.email, r.rij);

      if (bestaandeEmails.has(r.email)) {
        fouten.push({ rij: r.rij, melding: "Dit e-mailadres bestaat al of heeft al een openstaande activatie-uitnodiging." });
        return { ...r, status: "DUBBEL", melding: "Bestaat al in Clevers ERP" };
      }

      return { ...r, status: "TOEVOEGEN", melding: "" };
    });

    return NextResponse.json({ ok: fouten.length === 0, medewerkers: resultaat, fouten });
  } catch (error) {
    console.error("Nieuwe medewerkers import controleren:", error);
    return NextResponse.json({ error: "Het importbestand kon niet worden gecontroleerd." }, { status: 500 });
  }
}
