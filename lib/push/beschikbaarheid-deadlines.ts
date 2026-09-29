import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { verstuurMail, webAppUrl } from "@/lib/mail";

type DeadlineHerinneringType =
  | "BESCHIKBAARHEID_7D"
  | "BESCHIKBAARHEID_2D"
  | "BESCHIKBAARHEID_1D"
  | "BESCHIKBAARHEID_6U"
  | "BESCHIKBAARHEID_2U";

const HERINNERINGEN: Array<{
  type: DeadlineHerinneringType;
  minuten: number;
  tekst: string;
}> = [
  { type: "BESCHIKBAARHEID_7D", minuten: 7 * 24 * 60, tekst: "over 7 dagen" },
  { type: "BESCHIKBAARHEID_2D", minuten: 2 * 24 * 60, tekst: "over 2 dagen" },
  { type: "BESCHIKBAARHEID_1D", minuten: 24 * 60, tekst: "over 1 dag" },
  { type: "BESCHIKBAARHEID_6U", minuten: 6 * 60, tekst: "over 6 uur" },
  { type: "BESCHIKBAARHEID_2U", minuten: 2 * 60, tekst: "over 2 uur" },
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

function binnenVenster(nu: Date, doel: Date) {
  const verschil = Math.abs(doel.getTime() - nu.getTime());
  // De cron draait iedere 5 minuten. Een ruimer venster voorkomt dat
  // een kleine vertraging van GitHub Actions een herinnering mist.
  return verschil <= 10 * 60_000;
}

function datumSleutel(datum: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
  }).format(datum);
}

function weekLabel(jaar: number, weeknummer: number) {
  return `week ${weeknummer} (${jaar})`;
}

function deadlineLabel(deadline: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    dateStyle: "full",
    timeStyle: "short",
  }).format(deadline);
}

async function heeftVolledigeBeschikbaarheid(
  medewerkerId: string,
  beschikbaarheden: Array<{ datum: Date }>,
) {
  const dagen = new Set(
    beschikbaarheden.map((item) => datumSleutel(item.datum)),
  );

  return dagen.size >= 7;
}

export async function verstuurBeschikbaarheidDeadlineHerinneringen() {
  const nu = new Date();
  const vensterEinde = new Date(nu.getTime() + 10 * 60_000);
  const minimaleDeadline = new Date(nu.getTime() - 10 * 60_000);

  const weken = await prisma.week.findMany({
    where: {
      beschikbaarheidDeadline: {
        gt: minimaleDeadline,
        lte: new Date(
          Math.max(
            vensterEinde.getTime(),
            ...HERINNERINGEN.map(
              (herinnering) =>
                nu.getTime() + herinnering.minuten * 60_000 + 10 * 60_000,
            ),
          ),
        ),
      },
      vestiging: {
        actief: true,
      },
    },
    select: {
      id: true,
      jaar: true,
      weeknummer: true,
      beschikbaarheidDeadline: true,
      vestiging: {
        select: {
          id: true,
          naam: true,
          medewerkers: {
            where: {
              medewerker: {
                actief: true,
              },
            },
            select: {
              medewerker: {
                select: {
                  id: true,
                  voornaam: true,
                  email: true,
                  systeemGebruikerId: true,
                  systeemGebruiker: {
                    select: {
                      id: true,
                      email: true,
                      actief: true,
                      pushSubscriptions: {
                        where: {
                          actief: true,
                        },
                        select: {
                          id: true,
                          endpoint: true,
                          p256dh: true,
                          auth: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let pushVerstuurd = 0;
  let mailVerstuurd = 0;
  let overgeslagen = 0;
  let fouten = 0;
  const pushBeschikbaar = vapidInstellen();

  for (const week of weken) {
    const deadline = week.beschikbaarheidDeadline;
    if (!deadline) continue;

    for (const herinnering of HERINNERINGEN) {
      const doel = new Date(
        deadline.getTime() - herinnering.minuten * 60_000,
      );

      if (!binnenVenster(nu, doel)) continue;

      // Laad alleen de beschikbaarheid van deze specifieke week.
      // Dit gebeurt per actieve vestiging/week, niet per medewerker.
      const beschikbaarheden = await prisma.beschikbaarheid.findMany({
        where: {
          weekId: week.id,
          medewerkerId: {
            in: week.vestiging.medewerkers.map(
              (relatie) => relatie.medewerker.id,
            ),
          },
        },
        select: {
          medewerkerId: true,
          datum: true,
        },
      });

      const perMedewerker = new Map<
        string,
        Array<{ datum: Date }>
      >();

      for (const item of beschikbaarheden) {
        const lijst = perMedewerker.get(item.medewerkerId) ?? [];
        lijst.push({ datum: item.datum });
        perMedewerker.set(item.medewerkerId, lijst);
      }

      for (const relatie of week.vestiging.medewerkers) {
        const medewerker = relatie.medewerker;
        const gebruiker = medewerker.systeemGebruiker;

        if (!gebruiker?.actief) continue;

        const eigenBeschikbaarheden =
          perMedewerker.get(medewerker.id) ?? [];

        if (
          await heeftVolledigeBeschikbaarheid(
            medewerker.id,
            eigenBeschikbaarheden,
          )
        ) {
          overgeslagen += 1;
          continue;
        }

        const weeknaam = weekLabel(week.jaar, week.weeknummer);
        const sleutelBasis =
          `beschikbaarheid-deadline:${week.id}:${medewerker.id}:${herinnering.type}`;

        const href =
          `/profiel/beschikbaarheid?week=${week.jaar}-${week.weeknummer}`;

        const subject =
          `Herinnering beschikbaarheid — deadline ${herinnering.tekst}`;

        const text =
          `Beste ${medewerker.voornaam},

De deadline voor het doorgeven van je beschikbaarheid voor ${weeknaam} is ${herinnering.tekst}.

Deadline: ${deadlineLabel(deadline)}

Geef je beschikbaarheid door via:
${webAppUrl(href)}

Met vriendelijke groet,
Clevers`;

        const html =
          `<p>Beste ${medewerker.voornaam},</p>
<p>De deadline voor het doorgeven van je beschikbaarheid voor <strong>${weeknaam}</strong> is <strong>${herinnering.tekst}</strong>.</p>
<p><strong>Deadline:</strong> ${deadlineLabel(deadline)}</p>
<p><a href="${webAppUrl(href)}"><strong>Beschikbaarheid doorgeven</strong></a></p>
<p>Met vriendelijke groet,<br>Clevers</p>`;

        // E-mail: maximaal één keer per medewerker/week/herinnering.
        const emailSleutel = `${sleutelBasis}:email`;
        const emailMelding = await prisma.emailMelding.upsert({
          where: { sleutel: emailSleutel },
          create: {
            type: herinnering.type,
            sleutel: emailSleutel,
            systeemGebruikerId: gebruiker.id,
            geplandVoor: doel,
          },
          update: {},
        });

        if (!emailMelding.verstuurdOp) {
          try {
            await verstuurMail({
              to: medewerker.email || gebruiker.email,
              subject,
              text,
              html,
            });

            await prisma.emailMelding.update({
              where: { id: emailMelding.id },
              data: {
                verstuurdOp: new Date(),
                foutmelding: null,
              },
            });

            mailVerstuurd += 1;
          } catch (error) {
            await prisma.emailMelding.update({
              where: { id: emailMelding.id },
              data: {
                foutmelding:
                  error instanceof Error
                    ? error.message
                    : "Onbekende e-mailfout.",
              },
            });
            fouten += 1;
          }
        }

        if (!pushBeschikbaar) continue;

        for (const subscription of gebruiker.pushSubscriptions) {
          const pushSleutel =
            `${sleutelBasis}:push:${subscription.id}`;

          const pushMelding = await prisma.pushMelding.upsert({
            where: { sleutel: pushSleutel },
            create: {
              type: herinnering.type,
              sleutel: pushSleutel,
              pushSubscriptionId: subscription.id,
              systeemGebruikerId: gebruiker.id,
              geplandVoor: doel,
            },
            update: {},
          });

          if (pushMelding.verstuurdOp) {
            overgeslagen += 1;
            continue;
          }

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
                title: "Clevers — beschikbaarheid",
                body:
                  `De deadline voor ${weeknaam} is ${herinnering.tekst}. Geef je beschikbaarheid door.`,
                href,
              }),
            );

            await prisma.pushMelding.update({
              where: { id: pushMelding.id },
              data: {
                verstuurdOp: new Date(),
                foutmelding: null,
              },
            });

            pushVerstuurd += 1;
          } catch (error) {
            const statusCode =
              typeof error === "object" &&
              error !== null &&
              "statusCode" in error
                ? Number(
                    (error as { statusCode?: unknown }).statusCode,
                  )
                : null;

            await prisma.pushMelding.update({
              where: { id: pushMelding.id },
              data: {
                foutmelding:
                  error instanceof Error
                    ? error.message
                    : "Onbekende pushfout.",
              },
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
  }

  return {
    weken: weken.length,
    pushVerstuurd,
    mailVerstuurd,
    overgeslagen,
    fouten,
  };
}
