import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const doelDatums = {
  "Andrea de Bock - Berghmans": [
    "2026-09-01","2026-09-04","2026-09-07","2026-09-11","2026-09-14",
    "2026-09-18","2026-09-21","2026-09-22","2026-09-25","2026-09-28",
  ],
  "Coosje Helsen": [
    "2026-09-07","2026-09-12","2026-09-14","2026-09-21","2026-09-28",
  ],
  "Jayro Peters": [
    "2026-09-02","2026-09-03","2026-09-07","2026-09-08",
    "2026-09-10","2026-09-14","2026-09-21","2026-09-28",
  ],
  "Julia Leenders": [
    "2026-09-01","2026-09-03","2026-09-08","2026-09-25","2026-09-29",
  ],
};

function lokaleDatumSleutel(datum) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(datum);
}

try {
  const vestiging = await prisma.vestiging.findFirst({
    where: { naam: "Nijmegen", actief: true },
    select: { id: true },
  });

  if (!vestiging) throw new Error("Vestiging Nijmegen niet gevonden.");

  const medewerkers = await prisma.medewerker.findMany({
    where: {
      actief: true,
      vestigingen: {
        some: {
          vestigingId: vestiging.id,
        },
      },
    },
    select: {
      id: true,
      voornaam: true,
      tussenvoegsel: true,
      achternaam: true,
    },
  });

  const naamVanMedewerker = (medewerker) =>
    [medewerker.voornaam, medewerker.tussenvoegsel, medewerker.achternaam]
      .filter(Boolean)
      .join(" ");

  const doelMedewerkers = medewerkers.filter((medewerker) =>
    Object.prototype.hasOwnProperty.call(
      doelDatums,
      naamVanMedewerker(medewerker),
    ),
  );

  const medewerkerIds = doelMedewerkers.map((medewerker) => medewerker.id);

  const registraties = await prisma.urenRegistratie.findMany({
    where: {
      vestigingId: vestiging.id,
      medewerkerId: { in: medewerkerIds },
      datum: {
        gte: new Date("2026-08-31T22:00:00.000Z"),
        lt: new Date("2026-09-30T22:00:00.000Z"),
      },
    },
    select: {
      id: true,
      medewerkerId: true,
      datum: true,
    },
  });

  let verwijderd = 0;
  let opengezet = 0;

  for (const registratie of registraties) {
    const medewerker = doelMedewerkers.find(
      (item) => item.id === registratie.medewerkerId,
    );
    if (!medewerker) continue;

    const naam = naamVanMedewerker(medewerker);
    const datum = lokaleDatumSleutel(registratie.datum);
    const doel = doelDatums[naam] ?? [];

    if (!doel.includes(datum)) {
      await prisma.urenRegistratie.delete({
        where: { id: registratie.id },
      });
      verwijderd += 1;
      continue;
    }

    await prisma.urenRegistratie.update({
      where: { id: registratie.id },
      data: {
        status: "TE_CONTROLEREN",
        gecontroleerdDoorId: null,
        gecontroleerdOp: null,
      },
    });
    opengezet += 1;
  }

  const periode = await prisma.verloningsPeriode.findUnique({
    where: {
      jaar_maand: {
        jaar: 2026,
        maand: 9,
      },
    },
    select: { id: true },
  });

  let regelsVerwijderd = 0;

  if (periode) {
    const resultaat = await prisma.verloningsRegel.deleteMany({
      where: {
        verloningsPeriodeId: periode.id,
        medewerkerId: { in: medewerkerIds },
      },
    });

    regelsVerwijderd = resultaat.count;

    await prisma.verloningsControle.updateMany({
      where: {
        verloningsPeriodeId: periode.id,
        medewerkerId: { in: medewerkerIds },
      },
      data: {
        status: "OPEN",
        gecontroleerdOp: null,
        automatischAkkoordOp: null,
      },
    });
  }

  const controle = await prisma.urenRegistratie.groupBy({
    by: ["medewerkerId", "status"],
    where: {
      vestigingId: vestiging.id,
      medewerkerId: { in: medewerkerIds },
      datum: {
        gte: new Date("2026-08-31T22:00:00.000Z"),
        lt: new Date("2026-09-30T22:00:00.000Z"),
      },
    },
    _count: { _all: true },
  });

  console.log(
    "UREN_HERSTEL_DEFINITIEF=" +
      JSON.stringify({
        verwijderd,
        opengezet,
        regelsVerwijderd,
        controle,
      }),
  );
} finally {
  await prisma.$disconnect();
}
