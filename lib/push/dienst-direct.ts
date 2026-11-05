import { configureerCentralePush, verstuurPushNaarGebruiker } from "@/lib/push/service";
import { prisma } from "@/lib/prisma";
import { formatDienstDatum, formatDienstTijd } from "@/lib/planning/tijd";
import { verstuurMail, webAppUrl } from "@/lib/mail";

export async function verstuurDirecteDienstMelding(dienstBezettingId: string) {
  if (!configureerCentralePush()) return { verstuurd: 0, fouten: 0 };

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
  const pushResult = await verstuurPushNaarGebruiker({
    systeemGebruikerId,
    type: "DIENST_DIRECT",
    sleutel: "dienst-direct:" + bezetting.id,
    titel: "Clevers — je bent ingepland",
    body: datum + ", " + begintijd + "–" + eindtijd + " in " + vestigingNaam + ".",
    href: "/app/planning",
    dienstBezettingId: bezetting.id,
  });
  verstuurd += pushResult.verstuurd;
  fouten += pushResult.fouten;

  return { verstuurd, fouten };
}