import { NextResponse } from "next/server";
import { getCurrentUser, isEigenaarVoorMedewerker } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isDatumSleutel(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const datum = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(datum.getTime()) && datum.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  try {
    const gebruiker = await getCurrentUser();
    if (!gebruiker) return NextResponse.json({ error: "Je moet ingelogd zijn." }, { status: 401 });

    const body = await request.json();
    const medewerkerId = typeof body.medewerkerId === "string" ? body.medewerkerId : "";
    const uren = typeof body.uren === "string" || typeof body.uren === "number" ? Number(body.uren) : NaN;
    const peildatum = body.peildatum;
    const notitie = typeof body.notitie === "string" ? body.notitie.trim() : "";

    if (!medewerkerId || !(await isEigenaarVoorMedewerker(medewerkerId))) {
      return NextResponse.json({ error: "Geen eigenaarstoegang tot deze medewerker." }, { status: 403 });
    }
    if (!Number.isFinite(uren) || uren < 0 || Math.round(uren * 100) !== uren * 100 || uren > 10000) {
      return NextResponse.json({ error: "Vul een geldig saldo in met maximaal twee decimalen." }, { status: 400 });
    }
    if (!isDatumSleutel(peildatum)) {
      return NextResponse.json({ error: "Vul een geldige peildatum in." }, { status: 400 });
    }

    const medewerker = await prisma.medewerker.findUnique({
      where: { id: medewerkerId },
      select: { id: true, voornaam: true, achternaam: true, contractType: true },
    });
    if (!medewerker || medewerker.contractType !== "VAST") {
      return NextResponse.json({ error: "Het startsaldo kan alleen bij een medewerker met een vast contract worden vastgelegd." }, { status: 400 });
    }

    const datum = new Date(`${peildatum}T00:00:00.000Z`);
    await prisma.$transaction([
      prisma.medewerker.update({
        where: { id: medewerkerId },
        data: {
          contractUrenStartSaldo: uren,
          contractUrenStartPeildatum: datum,
          contractUrenStartNotitie: notitie || null,
        },
      }),
      prisma.auditLog.create({
        data: {
          systeemGebruikerId: gebruiker.id,
          module: "CONTRACTUREN",
          actie: "STARTSALDO_AANGEPAST",
          recordId: medewerkerId,
          details: {
            medewerker: [medewerker.voornaam, medewerker.achternaam].filter(Boolean).join(" "),
            saldoUren: uren,
            peildatum,
            notitie: notitie || null,
          },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, message: "Startsaldo opgeslagen." });
  } catch (error) {
    console.error("Startsaldo contracturen opslaan mislukt:", error);
    return NextResponse.json({ error: "Het startsaldo kon niet worden opgeslagen." }, { status: 500 });
  }
}
