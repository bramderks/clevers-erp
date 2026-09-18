import webpush from "web-push";
import { prisma } from "@/lib/prisma";

type OpenDienstHerinneringType = "OPEN_DIENST_72U" | "OPEN_DIENST_48U" | "OPEN_DIENST_24U";

const VENSTERS: Array<{ type: OpenDienstHerinneringType; minuten: number }> = [
  { type: "OPEN_DIENST_72U", minuten: 72 * 60 },
  { type: "OPEN_DIENST_48U", minuten: 48 * 60 },
  { type: "OPEN_DIENST_24U", minuten: 24 * 60 },
];

function vapidInstellen() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function binnenVenster(nu: Date, doel: Date) {
  // De cron draait ieder uur. Een melding is verschuldigd
  // vanaf het doelmoment tot 65 minuten daarna, zodat een
  // exacte 72/48/24-uursgrens niet gemist kan worden.
  const verschil = nu.getTime() - doel.getTime();
  return verschil >= 0 && verschil < 65 * 60_000;
}

export async function verstuurOpenDienstMeldingen() {
  if (!vapidInstellen()) {
    throw new Error("VAPID-configuratie ontbreekt.");
  }

  const nu = new Date();
  const zoekVanaf = new Date(nu.getTime() - 5 * 60_000);
  const zoekTot = new Date(nu.getTime() + 72 * 60 * 60 * 1000 + 65 * 60_000);

  const openDiensten = await prisma.dienstBezetting.findMany({
    where: {
      status: "OPEN",
      medewerkerId: null,
      dienst: {
        datum: { gte: zoekVanaf, lte: zoekTot },
      },
    },
    include: {
      dienst: {
        include: {
          tags: {
            include: { tag: true },
          },
          week: {
            include: {
              vestiging: true,
            },
          },
        },
      },
    },
  });

  let gecontroleerd = 0;
  let verstuurd = 0;
  let overgeslagen = 0;
  let fouten = 0;

  for (const bezetting of openDiensten) {
    const dienst = bezetting.dienst;
    const begint = new Date(dienst.begintijd);

    if (dienst.week.vestiging.seizoenEinde && begint > dienst.week.vestiging.seizoenEinde) continue;

    const tagIds = dienst.tags.map((item) => item.tagId);
    if (tagIds.length === 0) continue;

    const medewerkers = await prisma.medewerker.findMany({
      where: {
        actief: true,
        systeemGebruikerId: { not: null },
        vestigingen: {
          some: { vestigingId: dienst.week.vestigingId },
        },
        AND: tagIds.map((tagId) => ({
          tags: { some: { tagId } },
        })),
      },
      select: {
        id: true,
        systeemGebruikerId: true,
        voornaam: true,
      },
    });

    for (const venster of VENSTERS) {
      gecontroleerd += 1;
      const doel = new Date(begint.getTime() - venster.minuten * 60_000);
      if (!binnenVenster(nu, doel)) continue;

      for (const medewerker of medewerkers) {
        if (!medewerker.systeemGebruikerId) continue;

        const subscriptions = await prisma.pushSubscription.findMany({
          where: {
            systeemGebruikerId: medewerker.systeemGebruikerId,
            actief: true,
          },
        });

        for (const subscription of subscriptions) {
          const sleutel = `open-dienst:${bezetting.id}:${venster.type}:${subscription.id}`;
          const bestaand = await prisma.pushMelding.findUnique({
            where: { sleutel },
            select: { id: true },
          });
          if (bestaand) {
            overgeslagen += 1;
            continue;
          }

          const melding = await prisma.pushMelding.create({
            data: {
              type: venster.type,
              sleutel,
              pushSubscriptionId: subscription.id,
              systeemGebruikerId: medewerker.systeemGebruikerId,
              dienstBezettingId: bezetting.id,
              geplandVoor: doel,
            },
          });

          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth },
              },
              JSON.stringify({
                title: "Clevers — open dienst",
                body: `${dienst.week.vestiging.naam}: er staat een open dienst klaar. Je kunt je beschikbaarheid doorgeven.`,
                href: "/dashboard",
              }),
            );

            await prisma.pushMelding.update({
              where: { id: melding.id },
              data: { verstuurdOp: new Date(), foutmelding: null },
            });
            verstuurd += 1;
          } catch (error) {
            const statusCode =
              typeof error === "object" && error !== null && "statusCode" in error
                ? Number((error as { statusCode?: unknown }).statusCode)
                : null;
            await prisma.pushMelding.update({
              where: { id: melding.id },
              data: { foutmelding: error instanceof Error ? error.message : "Onbekende pushfout." },
            });
            if (statusCode === 404 || statusCode === 410) {
              await prisma.pushSubscription.update({
                where: { id: subscription.id },
                data: { actief: false, laatsteFoutOp: new Date() },
              });
            }
            fouten += 1;
          }
        }
      }
    }
  }

  return { gecontroleerd, verstuurd, overgeslagen, fouten };
}


/**
 * Stuur direct na het publiceren van een nieuwe open dienst
 * een pushmelding naar alle actieve medewerkers die minimaal
 * alle planningstags van de dienst hebben.
 */
export async function verstuurDirecteOpenDienstMelding(
  dienstBezettingId: string,
) {
  if (!vapidInstellen()) return { verstuurd: 0, fouten: 0 };

  const bezetting = await prisma.dienstBezetting.findUnique({
    where: { id: dienstBezettingId },
    include: {
      dienst: {
        include: {
          tags: { select: { tagId: true } },
          week: {
            include: {
              vestiging: { select: { id: true, naam: true, seizoenEinde: true } },
            },
          },
        },
      },
    },
  });

  if (!bezetting || bezetting.status !== "OPEN" || bezetting.medewerkerId !== null) {
    return { verstuurd: 0, fouten: 0 };
  }

  const tagIds = bezetting.dienst.tags.map((tag) => tag.tagId);
  if (tagIds.length === 0) return { verstuurd: 0, fouten: 0 };

  const medewerkers = await prisma.medewerker.findMany({
    where: {
      actief: true,
      systeemGebruikerId: { not: null },
      vestigingen: { some: { vestigingId: bezetting.dienst.week.vestigingId } },
      AND: tagIds.map((tagId) => ({
        tags: { some: { tagId } },
      })),
    },
    select: { systeemGebruikerId: true },
  });

  let verstuurd = 0;
  let fouten = 0;

  for (const medewerker of medewerkers) {
    if (!medewerker.systeemGebruikerId) continue;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        systeemGebruikerId: medewerker.systeemGebruikerId,
        actief: true,
      },
    });

    for (const subscription of subscriptions) {
      const sleutel = `open-dienst-direct:${bezetting.id}:${subscription.id}`;
      const bestaand = await prisma.pushMelding.findUnique({
        where: { sleutel },
        select: { id: true },
      });
      if (bestaand) continue;

      const melding = await prisma.pushMelding.create({
        data: {
          type: "OPEN_DIENST_DIRECT",
          sleutel,
          pushSubscriptionId: subscription.id,
          systeemGebruikerId: medewerker.systeemGebruikerId,
          dienstBezettingId: bezetting.id,
          geplandVoor: new Date(),
        },
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: "Clevers — open dienst",
            body: `${bezetting.dienst.week.vestiging.naam}: er is een open dienst voor jouw functie.`,
            href: "/dashboard",
          }),
        );

        await prisma.pushMelding.update({
          where: { id: melding.id },
          data: { verstuurdOp: new Date(), foutmelding: null },
        });
        verstuurd += 1;
      } catch (error) {
        fouten += 1;
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : null;
        await prisma.pushMelding.update({
          where: { id: melding.id },
          data: {
            foutmelding: error instanceof Error ? error.message : "Onbekende pushfout.",
          },
        });
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: { actief: false, laatsteFoutOp: new Date() },
          });
        }
      }
    }
  }

  return { verstuurd, fouten };
}
