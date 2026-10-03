import { NextResponse } from "next/server";
import { getCurrentUser, hasPermissionForVestiging, isEigenaar } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const LEIDINGGEVENDEN = [
  "Jessica Derks",
  "Bram Derks",
  "Andrea de Bock",
  "Pleun Kamps",
  "Jayro Peters",
];

function norm(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function medewerkerNaam(m: {
  voornaam: string;
  tussenvoegsel: string | null;
  achternaam: string;
}) {
  return [m.voornaam, m.tussenvoegsel, m.achternaam].filter(Boolean).join(" ");
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ fout: "Je moet ingelogd zijn." }, { status: 401 });
    }

    const vestiging = await prisma.vestiging.findFirst({
      where: { naam: "Nijmegen", actief: true },
      select: { id: true, organisatieId: true },
    });

    if (!vestiging) {
      return NextResponse.json({ fout: "Vestiging Nijmegen niet gevonden." }, { status: 404 });
    }

    if (
      !(await isEigenaar(vestiging.organisatieId)) ||
      !(await hasPermissionForVestiging(permissions.planning.create, vestiging.id))
    ) {
      return NextResponse.json({ fout: "Alleen de eigenaar kan de tags herstellen." }, { status: 403 });
    }

    const [leidinggevendeTag, handijsTag] = await Promise.all([
      prisma.tag.findFirst({
        where: { naam: "Leidinggevende", actief: true },
        select: { id: true },
      }),
      prisma.tag.findFirst({
        where: { naam: "Handijs", actief: true },
        select: { id: true },
      }),
    ]);

    if (!leidinggevendeTag || !handijsTag) {
      return NextResponse.json(
        { fout: "De tags Leidinggevende en/of Handijs ontbreken." },
        { status: 400 },
      );
    }

    const medewerkers = await prisma.medewerker.findMany({
      where: {
        actief: true,
        vestigingen: { some: { vestigingId: vestiging.id } },
      },
      select: {
        id: true,
        voornaam: true,
        tussenvoegsel: true,
        achternaam: true,
        roepnaam: true,
      },
    });

    const leidinggevendeIds = new Set<string>();
    const namen = new Map<string, string>();

    for (const medewerker of medewerkers) {
      const volledigeNaam = medewerkerNaam(medewerker);
      namen.set(norm(volledigeNaam), medewerker.id);
      if (medewerker.roepnaam) {
        namen.set(
          norm(
            [medewerker.roepnaam, medewerker.tussenvoegsel, medewerker.achternaam]
              .filter(Boolean)
              .join(" "),
          ),
          medewerker.id,
        );
      }
    }

    for (const naam of LEIDINGGEVENDEN) {
      const id =
        namen.get(norm(naam)) ??
        (norm(naam) === norm("Andrea de Bock")
          ? namen.get(norm("Andrea de Bock Berghmans"))
          : undefined);

      if (id) leidinggevendeIds.add(id);
    }

    const start = new Date("2026-09-01T00:00:00.000Z");
    const einde = new Date("2026-09-30T23:59:59.999Z");

    const diensten = await prisma.dienst.findMany({
      where: {
        week: { vestigingId: vestiging.id },
        datum: { gte: start, lte: einde },
        bezetting: {
          some: {
            medewerkerId: { not: null },
          },
        },
      },
      select: {
        id: true,
        bezetting: {
          where: { medewerkerId: { not: null } },
          select: { medewerkerId: true },
        },
      },
    });

    let leidinggevend = 0;
    let handijs = 0;

    for (const dienst of diensten) {
      const isLeidinggevende = dienst.bezetting.some(
        (bezetting) =>
          bezetting.medewerkerId !== null &&
          leidinggevendeIds.has(bezetting.medewerkerId),
      );

      const tagId = isLeidinggevende ? leidinggevendeTag.id : handijsTag.id;

      await prisma.$transaction([
        prisma.dienstTag.deleteMany({
          where: { dienstId: dienst.id },
        }),
        prisma.dienstTag.create({
          data: {
            dienstId: dienst.id,
            tagId,
            aantal: 1,
          },
        }),
      ]);

      if (isLeidinggevende) leidinggevend++;
      else handijs++;
    }

    return NextResponse.json({
      succes: true,
      periode: "1 t/m 30 september 2026",
      totaal: diensten.length,
      leidinggevende: leidinggevend,
      handijs,
      leidinggevenden: LEIDINGGEVENDEN,
      overigeDiensten: "Handijs",
    });
  } catch (error) {
    console.error("Tags september 2026 herstellen mislukt:", error);
    return NextResponse.json(
      { fout: "De diensttags konden niet worden hersteld." },
      { status: 500 },
    );
  }
}
