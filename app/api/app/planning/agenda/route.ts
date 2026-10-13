import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  kalenderDatumUTC,
  lokaleDatumSleutel,
  formatDienstTijd,
  nederlandseDatumTijd,
} from "@/lib/planning/tijd";

export const dynamic = "force-dynamic";

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function combineDateAndTime(datum: Date, tijd: Date) {
  return nederlandseDatumTijd(
    lokaleDatumSleutel(datum),
    formatDienstTijd(tijd),
  );
}

export async function GET() {
  try {
    const gebruiker = await getCurrentUser();

    if (!gebruiker || !gebruiker.actief) {
      return NextResponse.json(
        { fout: "Je moet ingelogd zijn." },
        { status: 401 },
      );
    }

    const medewerkerId = gebruiker.medewerker?.id;
    if (!medewerkerId) {
      return NextResponse.json(
        { fout: "Er is geen medewerkerprofiel aan dit account gekoppeld." },
        { status: 403 },
      );
    }

    const isEigenaar = gebruiker.organisaties.some(
      (relatie) =>
        relatie.actief &&
        relatie.organisatie.actief &&
        ["eigenaar", "super admin"].includes(
          relatie.rol.naam.trim().toLowerCase(),
        ),
    );

    // Planningdatums zijn kalenderdatums (UTC-middernacht), geen tijdstippen.
    // Vergelijk daarom vanaf de Nederlandse kalenderdatum van vandaag.
    const vandaag = kalenderDatumUTC(lokaleDatumSleutel(new Date()));

    const bezettingen = await prisma.dienstBezetting.findMany({
      where: {
        medewerkerId,
        status: { in: ["GEPLAND", "BEVESTIGD"] },
        dienst: {
          datum: { gte: vandaag },
          ...(isEigenaar ? {} : { week: { status: "GEPUBLICEERD" } }),
        },
      },
      select: {
        id: true,
        dienst: {
          select: {
            id: true,
            datum: true,
            begintijd: true,
            eindtijd: true,
            opmerkingen: true,
            week: {
              select: {
                vestiging: { select: { naam: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { dienst: { datum: "asc" } },
        { dienst: { begintijd: "asc" } },
      ],
    });

    const now = formatIcsDate(new Date());
    const events = bezettingen.map(({ id, dienst }) => {
      const start = combineDateAndTime(dienst.datum, dienst.begintijd);
      const einde = combineDateAndTime(dienst.datum, dienst.eindtijd);
      const summary = `Dienst - ${dienst.week.vestiging.naam}`;
      const description = dienst.opmerkingen
        ? `Opmerking: ${dienst.opmerkingen}`
        : "Mijn ingeplande dienst";

      return [
        "BEGIN:VEVENT",
        `UID:${escapeIcs(id)}@erp.iselto.nl`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(einde)}`,
        `SUMMARY:${escapeIcs(summary)}`,
        `LOCATION:${escapeIcs(dienst.week.vestiging.naam)}`,
        `DESCRIPTION:${escapeIcs(description)}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n");
    });

    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Iselto//Clevers ERP//NL",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Mijn Clevers-diensten",
      ...events,
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    return new NextResponse(calendar, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="clevers-diensten.ics"',
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Fout bij exporteren van agenda:", error);
    return NextResponse.json(
      { fout: "De agenda kon niet worden samengesteld." },
      { status: 500 },
    );
  }
}
