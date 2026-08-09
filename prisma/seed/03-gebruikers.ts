import bcrypt from "bcryptjs";

import type {
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client";

type PrismaTx =
  | Prisma.TransactionClient
  | PrismaClient;

const SYSTEEMGEBRUIKERS = [
  {
    naam: "Bram Derks",
    email: "bram.derks@outlook.com",
    wachtwoord: "Br@m4128",
    rol: "Super Admin",
  },
  {
    naam: "Jessica Derks",
    email: "j.derks@clevers.nl",
    wachtwoord: "Brammetje84!",
    rol: "Eigenaar",
  },
] as const;

const TEST_MEDEWERKER = {
  personeelsnummer: "TEST001",
  aanhef: "DHR" as const,
  voornaam: "Test",
  achternaam: "Medewerker",
  roepnaam: "Test",
  geboortedatum: new Date(
    "1995-01-01T00:00:00.000Z",
  ),
  email: "test.medewerker@clevers.nl",
  telefoon: "0612345678",
  wachtwoord: "Test1234!",
  contractType: "OPROEP" as const,
  contractUren: 0,
  datumInDienst: new Date(
    "2026-01-01T00:00:00.000Z",
  ),
  vestigingCode: "NIJ",
  rol: "Medewerker",
  statusCode: "ACTIEF",
} as const;

export async function seedGebruikers(
  prisma: PrismaTx,
  organisatieId: string,
) {
  console.log("→ Systeemgebruikers");

  for (const gebruikerData of SYSTEEMGEBRUIKERS) {
    const wachtwoordHash =
      await bcrypt.hash(
        gebruikerData.wachtwoord,
        12,
      );

    const gebruiker =
      await prisma.systeemGebruiker.upsert({
        where: {
          email: gebruikerData.email,
        },

        update: {
          naam: gebruikerData.naam,
          wachtwoordHash,
          actief: true,
        },

        create: {
          naam: gebruikerData.naam,
          email: gebruikerData.email,
          wachtwoordHash,
          actief: true,
        },
      });

    const rol =
      await prisma.rol.findUniqueOrThrow({
        where: {
          naam: gebruikerData.rol,
        },
      });

    await prisma.organisatieGebruiker.upsert({
      where: {
        organisatieId_systeemGebruikerId: {
          organisatieId,
          systeemGebruikerId:
            gebruiker.id,
        },
      },

      update: {
        rolId: rol.id,
        actief: true,
      },

      create: {
        organisatieId,
        systeemGebruikerId:
          gebruiker.id,
        rolId: rol.id,
        actief: true,
      },
    });

    console.log(
      `   ✓ ${gebruikerData.rol}: ${gebruikerData.naam}`,
    );
  }

  console.log("→ Testmedewerker");

  const wachtwoordHash =
    await bcrypt.hash(
      TEST_MEDEWERKER.wachtwoord,
      12,
    );

  const status =
    await prisma.status.findUniqueOrThrow({
      where: {
        module_code: {
          module: "MEDEWERKER",
          code: TEST_MEDEWERKER.statusCode,
        },
      },
    });

  const vestiging =
    await prisma.vestiging.findUniqueOrThrow({
      where: {
        organisatieId_code: {
          organisatieId,
          code: TEST_MEDEWERKER.vestigingCode,
        },
      },
    });

  const rol =
    await prisma.rol.findUniqueOrThrow({
      where: {
        naam: TEST_MEDEWERKER.rol,
      },
    });

  const systeemGebruiker =
    await prisma.systeemGebruiker.upsert({
      where: {
        email: TEST_MEDEWERKER.email,
      },

      update: {
        naam: `${TEST_MEDEWERKER.voornaam} ${TEST_MEDEWERKER.achternaam}`,
        wachtwoordHash,
        actief: true,
      },

      create: {
        naam: `${TEST_MEDEWERKER.voornaam} ${TEST_MEDEWERKER.achternaam}`,
        email: TEST_MEDEWERKER.email,
        wachtwoordHash,
        actief: true,
      },
    });

  const medewerker =
    await prisma.medewerker.upsert({
      where: {
        email: TEST_MEDEWERKER.email,
      },

      update: {
        systeemGebruikerId:
          systeemGebruiker.id,
        personeelsnummer:
          TEST_MEDEWERKER.personeelsnummer,
        aanhef: TEST_MEDEWERKER.aanhef,
        voornaam:
          TEST_MEDEWERKER.voornaam,
        achternaam:
          TEST_MEDEWERKER.achternaam,
        roepnaam:
          TEST_MEDEWERKER.roepnaam,
        geboortedatum:
          TEST_MEDEWERKER.geboortedatum,
        telefoon:
          TEST_MEDEWERKER.telefoon,
        statusId: status.id,
        actief: true,
        contractType:
          TEST_MEDEWERKER.contractType,
        contractUren:
          TEST_MEDEWERKER.contractUren,
        datumInDienst:
          TEST_MEDEWERKER.datumInDienst,
      },

      create: {
        systeemGebruiker: {
          connect: {
            id: systeemGebruiker.id,
          },
        },
        personeelsnummer:
          TEST_MEDEWERKER.personeelsnummer,
        aanhef: TEST_MEDEWERKER.aanhef,
        voornaam:
          TEST_MEDEWERKER.voornaam,
        achternaam:
          TEST_MEDEWERKER.achternaam,
        roepnaam:
          TEST_MEDEWERKER.roepnaam,
        geboortedatum:
          TEST_MEDEWERKER.geboortedatum,
        email:
          TEST_MEDEWERKER.email,
        telefoon:
          TEST_MEDEWERKER.telefoon,
        status: {
          connect: {
            id: status.id,
          },
        },
        actief: true,
        contractType:
          TEST_MEDEWERKER.contractType,
        contractUren:
          TEST_MEDEWERKER.contractUren,
        datumInDienst:
          TEST_MEDEWERKER.datumInDienst,
      },
    });

  await prisma.organisatieGebruiker.upsert({
    where: {
      organisatieId_systeemGebruikerId: {
        organisatieId,
        systeemGebruikerId:
          systeemGebruiker.id,
      },
    },

    update: {
      rolId: rol.id,
      actief: true,
    },

    create: {
      organisatieId,
      systeemGebruikerId:
        systeemGebruiker.id,
      rolId: rol.id,
      actief: true,
    },
  });

  await prisma.medewerkerVestiging.upsert({
    where: {
      medewerkerId_vestigingId: {
        medewerkerId: medewerker.id,
        vestigingId: vestiging.id,
      },
    },

    update: {
      hoofdvestiging: true,
    },

    create: {
      medewerkerId: medewerker.id,
      vestigingId: vestiging.id,
      hoofdvestiging: true,
    },
  });

  await prisma.medewerkerRol.upsert({
    where: {
      medewerkerId_rolId: {
        medewerkerId: medewerker.id,
        rolId: rol.id,
      },
    },

    update: {},

    create: {
      medewerkerId: medewerker.id,
      rolId: rol.id,
    },
  });

  console.log(
    `   ✓ Medewerker: ${TEST_MEDEWERKER.voornaam} ${TEST_MEDEWERKER.achternaam}`,
  );
}