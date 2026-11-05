import { configureerCentralePush, verstuurPushNaarGebruiker } from "@/lib/push/service";
import { prisma } from "@/lib/prisma";
import { lokaleDatumSleutel, lokaleTijdMinuten } from "@/lib/planning/tijd";

/**
 * Herinner de eigenaar dagelijks rond 22:30 uur aan nog niet
 * gecontroleerde urenregistraties. De unieke meldingssleutel per
 * organisatie en lokale datum voorkomt dubbele meldingen door de cron.
 */
export async function verstuurDagelijkseUrenControleHerinnering() {
  if (!configureerCentralePush()) {
    throw new Error("VAPID-configuratie ontbreekt.");
  }

  const nu = new Date();
  const minuten = lokaleTijdMinuten(nu);

  // De cron draait iedere vijf minuten; dit venster vangt 22:30 en
  // een eventuele vertraagde run op 22:35.
  if (minuten < 22 * 60 + 30 || minuten >= 22 * 60 + 40) {
    return { gecontroleerd: 0, verstuurd: 0, fouten: 0, overgeslagen: 0 };
  }

  const dag = lokaleDatumSleutel(nu);
  const organisaties = await prisma.organisatie.findMany({
    where: {
      actief: true,
      vestigingen: { some: { actief: true } },
    },
    select: {
      id: true,
      naam: true,
      vestigingen: {
        where: { actief: true },
        select: {
          urenregistraties: {
            where: { status: "TE_CONTROLEREN" },
            select: { id: true },
          },
        },
      },
      gebruikers: {
        where: {
          actief: true,
          rol: { naam: { equals: "eigenaar", mode: "insensitive" } },
          systeemGebruiker: {
            actief: true,
            pushSubscriptions: { some: { actief: true } },
          },
        },
        select: { systeemGebruikerId: true },
      },
    },
  });

  let gecontroleerd = 0;
  let verstuurd = 0;
  let fouten = 0;
  let overgeslagen = 0;

  for (const organisatie of organisaties) {
    const aantal = organisatie.vestigingen.reduce(
      (totaal, vestiging) => totaal + vestiging.urenregistraties.length,
      0,
    );
    if (aantal === 0) continue;
    gecontroleerd += 1;

    const ontvangers = [...new Set(organisatie.gebruikers.map((item) => item.systeemGebruikerId))];
    for (const systeemGebruikerId of ontvangers) {
      const resultaat = await verstuurPushNaarGebruiker({
        systeemGebruikerId,
        type: "EIGENAAR_UREN_CONTROLEREN",
        sleutel: `eigenaar-uren-controleren:${organisatie.id}:${dag}`,
        titel: "Uren controleren",
        body: `${organisatie.naam}: er staan nog ${aantal} urenregistratie${aantal === 1 ? "" : "s"} open om te controleren.`,
        href: "/uren",
      });
      verstuurd += resultaat.verstuurd;
      fouten += resultaat.fouten;
      overgeslagen += resultaat.overgeslagen;
    }
  }

  return { gecontroleerd, verstuurd, fouten, overgeslagen };
}
