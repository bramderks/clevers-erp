import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { formatDienstDatum, formatDienstTijd } from "@/lib/planning/tijd";
import { verstuurMail, webAppUrl } from "@/lib/mail";

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
      medewerker: {
        select: {
          systeemGebruikerId: true,
          systeemGebruiker: {
            select: {
              id: true,
              email: true,
              emailMeldingenAan: true,
            },
          },
        },
      },
    },
  });

  if (!bezetting || bezetting.dienst.week.status !== "GEPUBLICEERD" || !bezetting.medewerker?.systeemGebruikerId || bezetting.status === "AFGEZEGD") {
    return { verstuurd: 0, fouten: 0 };
  }

  const systeemGebruikerId = bezetting.medewerker.systeemGebruikerId;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { systeemGebruikerId, actief: true },
  });

  const datum = formatDienstDatum(bezetting.dienst.datum);
  const begintijd = formatDienstTijd(bezetting.dienst.begintijd);
  const eindtijd = formatDienstTijd(bezetting.dienst.eindtijd);
  const vestigingNaam = bezetting.dienst.week.vestiging.naam;
  const systeemGebruiker = bezetting.medewerker.systeemGebruiker;

  let verstuurd = 0;
  let fouten = 0;

  // E-mail is standaard ingeschakeld en kan door de medewerker zelf
  // worden uitgeschakeld in de meldingsinstellingen.
  if (systeemGebruiker?.emailMeldingenAan) {
    const emailSleutel = `dienst-direct:${bezetting.id}:email`;
    const emailMelding = await prisma.emailMelding.upsert({
      where: { sleutel: emailSleutel },
      create: {
        type: "DIENST_DIRECT",
        sleutel: emailSleutel,
        systeemGebruikerId,
        geplandVoor: new Date(),
      },
      update: {},
    });

    if (!emailMelding.verstuurdOp) {
      try {
        await verstuurMail({
          to: systeemGebruiker.email,
          subject: `Je bent ingepland — ${vestigingNaam} ${datum}`,
          text:
            `Je bent ingepland voor een dienst bij ${vestigingNaam}.\\n\\nDatum: ${datum}\\nTijd: ${begintijd}–${eindtijd}\\n\\nBekijk je planning: ${webAppUrl("/app/planning")}\\n`,
          html:
            `<p>Je bent ingepland voor een dienst bij <strong>${vestigingNaam}</strong>.</p><p><strong>Datum:</strong> ${datum}<br><strong>Tijd:</strong> ${begintijd}–${eindtijd}</p><p><a href="${webAppUrl("/app/planning")}">Bekijk je planning</a></p><p>Met vriendelijke groet,<br>Clevers</p>`,
        });

        await prisma.emailMelding.update({
          where: { id: emailMelding.id },
          data: { verstuurdOp: new Date(), foutmelding: null },
        });
      } catch (error) {
        fouten += 1;
        await prisma.emailMelding.update({
          where: { id: emailMelding.id },
          data: {
            foutmelding:
              error instanceof Error ? error.message : "Onbekende e-mailfout.",
          },
        });
      }
    }
  }
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