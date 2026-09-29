import webpush from "web-push";
import { prisma } from "@/lib/prisma";

type HerinneringType = "DIENST_24U" | "DIENST_12U" | "DIENST_2U";

const HERINNERINGEN: Array<{
  type: HerinneringType;
  minuten: number;
}> = [
  { type: "DIENST_24U", minuten: 24 * 60 },
  { type: "DIENST_12U", minuten: 12 * 60 },
  { type: "DIENST_2U", minuten: 2 * 60 },
];

function vapidInstellen() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  return true;
}

function datumMetTijd(datum: Date, tijd: Date) {
  const resultaat = new Date(datum);
  resultaat.setHours(
    tijd.getUTCHours(),
    tijd.getUTCMinutes(),
    tijd.getUTCSeconds(),
    0,
  );
  return resultaat;
}

function binnenVenster(
  nu: Date,
  doel: Date,
  minuten: number,
) {
  const verschil = doel.getTime() - nu.getTime();

  const venster = minuten * 60_000;

  return verschil <= venster && verschil >= -venster;
}

export async function verstuurDienstHerinneringen() {
  if (!vapidInstellen()) {
    throw new Error("VAPID-configuratie ontbreekt.");
  }

  const nu = new Date();
  const zoekTot = new Date(nu.getTime() + 24 * 60 * 60 * 1000 + 5 * 60_000);

  const bezettingen = await prisma.dienstBezetting.findMany({
    where: {
      medewerkerId: { not: null },
      status: {
        in: ["GEPLAND", "BEVESTIGD"],
      },
      dienst: {
        datum: {
          gte: new Date(nu.getTime() - 24 * 60 * 60 * 1000),
          lte: zoekTot,
        },
      },
      medewerker: {
        systeemGebruikerId: { not: null },
      },
    },
    include: {
      dienst: true,
      medewerker: {
        select: {
          id: true,
          voornaam: true,
          achternaam: true,
          systeemGebruikerId: true,
        },
      },
    },
  });

  let gecontroleerd = 0;
  let verstuurd = 0;
  let overgeslagen = 0;
  let fouten = 0;

  for (const bezetting of bezettingen) {
    if (!bezetting.medewerker?.systeemGebruikerId) continue;

    const begint = datumMetTijd(
      bezetting.dienst.datum,
      bezetting.dienst.begintijd,
    );

    for (const herinnering of HERINNERINGEN) {
      gecontroleerd += 1;

      const doel = new Date(
        begint.getTime() - herinnering.minuten * 60_000,
      );

      if (!binnenVenster(nu, doel, 5)) continue;

      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          systeemGebruikerId: bezetting.medewerker.systeemGebruikerId,
          actief: true,
        },
      });

      for (const subscription of subscriptions) {
        const sleutel =
          `dienst:${bezetting.id}:${herinnering.type}:${subscription.id}`;

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
            type: herinnering.type,
            sleutel,
            pushSubscriptionId: subscription.id,
            systeemGebruikerId: bezetting.medewerker.systeemGebruikerId,
            dienstBezettingId: bezetting.id,
            geplandVoor: doel,
          },
        });

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              title: "Clevers — dienstherinnering",
              body:
                herinnering.type === "DIENST_24U"
                  ? "Je dienst begint over ongeveer 24 uur."
                  : herinnering.type === "DIENST_12U"
                    ? "Je dienst begint over ongeveer 12 uur."
                    : "Je dienst begint over ongeveer 2 uur.",
              href: "/app/planning",
            }),
          );

          await prisma.pushMelding.update({
            where: { id: melding.id },
            data: {
              verstuurdOp: new Date(),
              foutmelding: null,
            },
          });

          verstuurd += 1;
        } catch (error) {
          const statusCode =
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error
              ? Number((error as { statusCode?: unknown }).statusCode)
              : null;

          const foutmelding =
            error instanceof Error ? error.message : "Onbekende pushfout.";

          await prisma.pushMelding.update({
            where: { id: melding.id },
            data: { foutmelding },
          });

          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.update({
              where: { id: subscription.id },
              data: {
                actief: false,
                laatsteFoutOp: new Date(),
              },
            });
          }

          fouten += 1;
        }
      }
    }
  }

  return {
    gecontroleerd,
    verstuurd,
    overgeslagen,
    fouten,
  };
}

