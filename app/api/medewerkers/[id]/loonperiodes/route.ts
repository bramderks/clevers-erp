import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

function datum(waarde: unknown) {
  if (typeof waarde !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(waarde)) return null;
  const d = new Date(`${waarde}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function eigenaarVoorMedewerker(id: string) {
  const gebruiker = await getCurrentUser();
  if (!gebruiker?.actief) return false;
  const medewerker = await prisma.medewerker.findUnique({
    where: { id },
    select: { vestigingen: { select: { vestiging: { select: { organisatieId: true, actief: true } } } } },
  });
  if (!medewerker) return false;
  const organisaties = new Set(
    medewerker.vestigingen.filter((v) => v.vestiging.actief).map((v) => v.vestiging.organisatieId),
  );
  return organisaties.size > 0 && [...organisaties].every((organisatieId) =>
    gebruiker.organisaties.some((r) =>
      r.actief && r.organisatie.actief && r.organisatieId === organisatieId &&
      ["eigenaar", "super admin"].includes(r.rol.naam.trim().toLowerCase()),
    ),
  );
}

async function overlap(id: string, medewerkerId: string, start: Date, einde: Date) {
  return prisma.medewerkerLoonPeriode.findFirst({
    where: {
      medewerkerId,
      id: id ? { not: id } : undefined,
      actief: true,
      periodeStart: { lte: einde },
      periodeEinde: { gte: start },
    },
    select: { id: true },
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!(await eigenaarVoorMedewerker(id))) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
    const body = await request.json();
    const start = datum(body.periodeStart);
    const einde = datum(body.periodeEinde);
    const bedrag = Number(body.uurloon);
    if (!start || !einde || einde < start || !Number.isFinite(bedrag) || bedrag < 0) {
      return NextResponse.json({ error: "Uurloon en een geldige periode zijn verplicht." }, { status: 400 });
    }
    if (await overlap("", id, start, einde)) {
      return NextResponse.json({ error: "Deze periode overlapt met een bestaand actief uurloon." }, { status: 409 });
    }
    const periode = await prisma.medewerkerLoonPeriode.create({
      data: { id: randomUUID(), medewerkerId: id, uurloon: bedrag, periodeStart: start, periodeEinde: einde, actief: true },
    });
    const vandaag = new Date();
    if (start <= vandaag && einde >= vandaag) {
      await prisma.medewerker.update({ where: { id }, data: { uurloon: bedrag } });
    }
    return NextResponse.json({ id: periode.id, melding: "Uurloonperiode opgeslagen." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Opslaan mislukt." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!(await eigenaarVoorMedewerker(id))) return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
    const body = await request.json();
    if (typeof body.id !== "string") return NextResponse.json({ error: "Loonperiode ontbreekt." }, { status: 400 });
    const start = datum(body.periodeStart);
    const einde = datum(body.periodeEinde);
    const bedrag = Number(body.uurloon);
    if (!start || !einde || einde < start || !Number.isFinite(bedrag) || bedrag < 0) {
      return NextResponse.json({ error: "Uurloon en een geldige periode zijn verplicht." }, { status: 400 });
    }
    const bestaand = await prisma.medewerkerLoonPeriode.findFirst({ where: { id: body.id, medewerkerId: id } });
    if (!bestaand) return NextResponse.json({ error: "Loonperiode niet gevonden." }, { status: 404 });
    if (await overlap(body.id, id, start, einde)) {
      return NextResponse.json({ error: "Deze periode overlapt met een bestaand actief uurloon." }, { status: 409 });
    }
    await prisma.medewerkerLoonPeriode.update({
      where: { id: body.id },
      data: { uurloon: bedrag, periodeStart: start, periodeEinde: einde, actief: true },
    });
    const vandaag = new Date();
    const actief = await prisma.medewerkerLoonPeriode.findFirst({
      where: { medewerkerId: id, actief: true, periodeStart: { lte: vandaag }, periodeEinde: { gte: vandaag } },
      orderBy: { periodeStart: "desc" },
    });
    await prisma.medewerker.update({ where: { id }, data: { uurloon: actief ? actief.uurloon : null } });
    return NextResponse.json({ melding: "Uurloonperiode gewijzigd." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Opslaan mislukt." }, { status: 400 });
  }
}
