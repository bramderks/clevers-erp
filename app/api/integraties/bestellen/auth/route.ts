import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toegestaan(request: Request) {
  const expected = process.env.CLEVERS_BESTELLEN_INTEGRATION_SECRET;
  const supplied = request.headers.get("x-clevers-integration-secret");
  return Boolean(expected && supplied && expected.length === supplied.length && expected === supplied);
}

function publiek(gebruiker: any) {
  const relaties = (gebruiker.organisaties ?? []).filter((r: any) => r.actief && r.organisatie?.actief);
  const rollen = [...new Set(relaties.map((r: any) => r.rol?.naam).filter(Boolean))] as string[];
  return {
    id: gebruiker.id,
    naam: gebruiker.naam,
    email: gebruiker.email,
    actief: gebruiker.actief,
    rollen,
    eigenaar: rollen.some((naam) => ["eigenaar", "super admin"].includes(naam.trim().toLowerCase())),
    organisaties: relaties.map((r: any) => ({ id: r.organisatieId, naam: r.organisatie?.naam, rol: r.rol?.naam })),
    vestigingen: (gebruiker.vestigingToegang ?? [])
      .filter((v: any) => v.actief && v.vestiging?.actief)
      .map((v: any) => ({ id: v.vestigingId, naam: v.vestiging?.naam, organisatieId: v.vestiging?.organisatieId })),
  };
}

export async function POST(request: Request) {
  if (!toegestaan(request)) return NextResponse.json({ message: "Niet geautoriseerd." }, { status: 401 });

  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const wachtwoord = typeof body?.wachtwoord === "string" ? body.wachtwoord : "";
    if (!email || !wachtwoord) return NextResponse.json({ message: "Vul e-mailadres en wachtwoord in." }, { status: 400 });

    const gebruiker = await prisma.systeemGebruiker.findUnique({
      where: { email },
      include: {
        organisaties: { include: { organisatie: true, rol: true } },
        vestigingToegang: { include: { vestiging: true } },
        medewerker: { include: { status: true, rollen: { select: { rolId: true } } } },
      },
    });

    if (!gebruiker || !gebruiker.actief) return NextResponse.json({ message: "Ongeldige inloggegevens." }, { status: 401 });
    const wachtOpEigenaar = gebruiker.medewerker?.status?.module === "MEDEWERKER" && gebruiker.medewerker.status.code === "AANGEMELD" && gebruiker.medewerker.actief === false;
    if (wachtOpEigenaar || (gebruiker.medewerker && (!gebruiker.medewerker.actief || gebruiker.medewerker.rollen.length === 0))) {
      return NextResponse.json({ message: "Je account is nog niet geactiveerd door de eigenaar." }, { status: 403 });
    }
    if (!(await bcrypt.compare(wachtwoord, gebruiker.wachtwoordHash))) return NextResponse.json({ message: "Ongeldige inloggegevens." }, { status: 401 });

    await prisma.systeemGebruiker.update({ where: { id: gebruiker.id }, data: { laatsteLoginOp: new Date() } });
    return NextResponse.json({ success: true, gebruiker: publiek(gebruiker) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bestellen SSO login failed", error);
    return NextResponse.json({ message: "Inloggen is tijdelijk niet mogelijk." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!toegestaan(request)) return NextResponse.json({ message: "Niet geautoriseerd." }, { status: 401 });
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ message: "Gebruiker ontbreekt." }, { status: 400 });

  const gebruiker = await prisma.systeemGebruiker.findUnique({
    where: { id: userId },
    include: {
      organisaties: { include: { organisatie: true, rol: true } },
      vestigingToegang: { include: { vestiging: true } },
    },
  });
  if (!gebruiker || !gebruiker.actief) return NextResponse.json({ message: "Account niet actief." }, { status: 401 });
  return NextResponse.json({ gebruiker: publiek(gebruiker) }, { headers: { "Cache-Control": "no-store" } });
}
