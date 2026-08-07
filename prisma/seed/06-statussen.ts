import type { Prisma, PrismaClient } from "../../generated/prisma/client";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

const STATUSSEN = [
  // =====================================================
  // MEDEWERKERS
  // =====================================================

  {
    module: "MEDEWERKER",
    code: "AANGEMELD",
    naam: "Aangemeld",
    omschrijving: "Nieuwe medewerker heeft zich aangemeld.",
    kleur: "blue",
    icoon: "user-plus",
    volgorde: 1,
  },
  {
    module: "MEDEWERKER",
    code: "IN_BEHANDELING",
    naam: "In behandeling",
    omschrijving: "Aanmelding wordt verwerkt.",
    kleur: "amber",
    icoon: "clock",
    volgorde: 2,
  },
  {
    module: "MEDEWERKER",
    code: "ACTIEF",
    naam: "Actief",
    omschrijving: "Medewerker is actief.",
    kleur: "green",
    icoon: "check-circle",
    volgorde: 3,
  },
  {
    module: "MEDEWERKER",
    code: "GEBLOKKEERD",
    naam: "Geblokkeerd",
    omschrijving: "Account is tijdelijk geblokkeerd.",
    kleur: "red",
    icoon: "ban",
    volgorde: 4,
  },
  {
    module: "MEDEWERKER",
    code: "UIT_DIENST",
    naam: "Uit dienst",
    omschrijving: "Medewerker is uit dienst.",
    kleur: "slate",
    icoon: "user-minus",
    volgorde: 5,
  },

  // =====================================================
  // BESTELLINGEN
  // =====================================================

  {
    module: "BESTELLING",
    code: "CONCEPT",
    naam: "Concept",
    omschrijving: "Bestelling is nog niet verzonden.",
    kleur: "slate",
    icoon: "file",
    volgorde: 1,
  },
  {
    module: "BESTELLING",
    code: "VERZONDEN",
    naam: "Verzonden",
    omschrijving: "Bestelling is verzonden.",
    kleur: "blue",
    icoon: "send",
    volgorde: 2,
  },
  {
    module: "BESTELLING",
    code: "GELEVERD",
    naam: "Geleverd",
    omschrijving: "Bestelling is geleverd.",
    kleur: "green",
    icoon: "package-check",
    volgorde: 3,
  },

  // =====================================================
  // VOORRAAD
  // =====================================================

  {
    module: "VOORRAAD",
    code: "OPEN",
    naam: "Open",
    omschrijving: "Voorraadtelling is geopend.",
    kleur: "blue",
    icoon: "box",
    volgorde: 1,
  },
  {
    module: "VOORRAAD",
    code: "AFGEROND",
    naam: "Afgerond",
    omschrijving: "Voorraadtelling is afgerond.",
    kleur: "green",
    icoon: "check-circle",
    volgorde: 2,
  },
] as const;

export async function seedStatussen(prisma: PrismaTx) {
  console.log("→ Statussen");

  for (const status of STATUSSEN) {
    await prisma.status.upsert({
      where: {
        module_code: {
          module: status.module,
          code: status.code,
        },
      },
      update: {
        naam: status.naam,
        omschrijving: status.omschrijving,
        kleur: status.kleur,
        icoon: status.icoon,
        volgorde: status.volgorde,
        actief: true,
      },
      create: {
        module: status.module,
        code: status.code,
        naam: status.naam,
        omschrijving: status.omschrijving,
        kleur: status.kleur,
        icoon: status.icoon,
        volgorde: status.volgorde,
        actief: true,
      },
    });
  }

  console.log(`   ✓ ${STATUSSEN.length} statussen`);
}