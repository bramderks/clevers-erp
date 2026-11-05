import webPushClient from "web-push";
import { prisma } from "@/lib/prisma";

type WebPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
type WebPushOptions = Parameters<typeof webPushClient.sendNotification>[2];

/**
 * Enige server-side toegang tot de Web Push transportlaag.
 * VAPID-configuratie en verzenden lopen bewust via deze module.
 */
let vapidConfigured = false;

export function configureerCentralePush(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) return false;

  webPushClient.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function verstuurCentralePush(
  subscription: WebPushSubscription,
  payload: string,
  options?: WebPushOptions,
) {
  if (!configureerCentralePush()) {
    throw new Error("VAPID-configuratie ontbreekt.");
  }

  const maxPogingen = 3;

  for (let poging = 1; poging <= maxPogingen; poging += 1) {
    try {
      return await webPushClient.sendNotification(subscription, payload, options);
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
      const tijdelijk = statusCode === null || statusCode === 408 || statusCode === 429 || statusCode >= 500;

      if (!tijdelijk || poging === maxPogingen) throw error;

      // Korte exponentiële back-off voorkomt dat tijdelijke push-servicefouten
      // direct als definitief worden behandeld.
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (poging - 1)));
    }
  }

  throw new Error("Pushmelding kon na meerdere pogingen niet worden verstuurd.");
}


export type CentralePushInput = {
  systeemGebruikerId: string;
  type: string;
  sleutel: string;
  titel: string;
  body: string;
  href: string;
  geplandVoor?: Date;
  dienstBezettingId?: string;
};

export async function verstuurPushNaarGebruiker(input: CentralePushInput) {
  if (!configureerCentralePush()) {
    throw new Error("VAPID-configuratie ontbreekt.");
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { systeemGebruikerId: input.systeemGebruikerId, actief: true },
  });

  let verstuurd = 0;
  let fouten = 0;
  let overgeslagen = 0;

  for (const subscription of subscriptions) {
    const sleutel = `${input.sleutel}:${subscription.id}`;
    const melding = await prisma.pushMelding.upsert({
      where: { sleutel },
      create: {
        type: input.type,
        sleutel,
        pushSubscriptionId: subscription.id,
        systeemGebruikerId: input.systeemGebruikerId,
        dienstBezettingId: input.dienstBezettingId,
        geplandVoor: input.geplandVoor ?? new Date(),
      },
      update: {},
    });

    if (melding.verstuurdOp) {
      overgeslagen += 1;
      continue;
    }

    try {
      await verstuurCentralePush(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({ title: input.titel, body: input.body, href: input.href }),
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
      fouten += 1;
    }
  }

  return { verstuurd, fouten, overgeslagen, apparaten: subscriptions.length };
}

 bestaande verzendroutes lopen via deze centrale module. */
export const webpush = {
  setVapidDetails: configureerVapidDetails,
  sendNotification: verstuurCentralePush,
};

function configureerVapidDetails(subject: string, publicKey: string, privateKey: string) {
  webPushClient.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}
