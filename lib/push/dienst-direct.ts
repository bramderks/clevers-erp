import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { formatDienstDatum, formatDienstTijd } from "@/lib/planning/tijd";

function vapidInstellen() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function verstuurDirecteDienstMelding(dienstBezettingId: string) {
  if (!vapidInstellen()) return { verstuurd: 0, fouten: 0 };

  const bezetting = await prisma.dienstBezetting.findUnique({
    where: { id: dienstBezettingId },
    include: {
      dienst: { include: { week: { include: { vestiging: { select: { naam: true } } } } } },
      medewerker: { select: { systeemGebruikerId: true } },
    },
  });

  if (!bezetting || !bezetting.medewerker?.systeemGebruikerId || bezetting.status === "AFGEZEGD") {
    return { verstuurd: 0, fouten: 0 };
  }

  const systeemGebruikerId = bezetting.medewerker.systeemGebruikerId;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { systeemGebruikerId, actief: true },
  });

  const datum = formatDienstDatum(bezetting.dienst.datum);
  const begintijd = formatDienstTijd(bezetting.dienst.begintijd);
  const eindtijd = formatDienstTijd(bezetting.dienst.eindtijd);

  let verstuurd = 0;
  let fouten = 0;
  for (const subscription of subscriptions) {
    const sleutel = "dienst-direct:" + bezetting.id + ":" + subscription.id;
    const bestaand = await prisma.pushMelding.findUnique({ where: { sleutel }, select: { id: true } });
    if (bestaand) continue;

    const melding = await prisma.pushMelding.create({
      data: {
        type: "DIENST_DIRECT",
        sleutel,
        pushSubscriptionId: subscription.id,
        systeemGebruikerId,
        dienstBezettingId: bezetting.id,
        geplandVoor: new Date(),
      },
    });

    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({
          title: "Clevers — je bent ingepland",
          body: datum + ", " + begintijd + "–" + eindtijd + " in " + bezetting.dienst.week.vestiging.naam + ".",
          href: "/app/planning",
        }),
      );
      await prisma.pushMelding.update({
        where: { id: melding.id },
        data: { verstuurdOp: new Date(), foutmelding: null },
      });
      verstuurd += 1;
    } catch (error) {
      fouten += 1;
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
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
    }
  }
  return { verstuurd, fouten };
}