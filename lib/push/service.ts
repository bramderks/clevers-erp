import webPushClient from "web-push";

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

/** Compatibele transportadapter; bestaande verzendroutes lopen via deze centrale module. */
export const webpush = {
  setVapidDetails: configureerVapidDetails,
  sendNotification: verstuurCentralePush,
};

function configureerVapidDetails(subject: string, publicKey: string, privateKey: string) {
  webPushClient.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}
