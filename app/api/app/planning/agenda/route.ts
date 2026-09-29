import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const result = new Date(datum);
  result.setHours(
    tijd.getUTCHours(),
    tijd.getUTCMinutes(),
    tijd.getUTCSeconds(),
    0,
  );
  return result;
}

export async function GET() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker?.medewerker?.id) {
    return NextResponse.json(
      { fout: "Je moet ingelogd zijn als medewerker." },
      { status: 401 },
    );
  }

  const vanaf = new Date();
  vanaf.setHours(0, 0, 0, 0);

  const bezettingen = await prisma.dienstBezetting.findMany({
    where: {
      medewerkerId: gebruiker.medewerker.id,
      status: {
        in: ["GEPLAND", "BEVESTIGD"],
      },
      dienst: {
        datum: {
          gte: vanaf,
        },
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
              vestiging: {
                select: {
                  naam: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      dienst: {
        datum: "asc",
      },
    },
  });

  const events = bezettingen
    .map((bezetting) => {
      const start = combineDateAndTime(
        bezetting.dienst.datum,
        bezetting.dienst.begintijd,
      );
      const end = combineDateAndTime(
        bezetting.dienst.datum,
        bezetting.dienst.eindtijd,
      );

      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }

      const vestiging = bezetting.dienst.week.vestiging.naam;
      const omschrijving = [
        "Clevers dienst",
        bezetting.dienst.opmerkingen || "",
      ]
        .filter(Boolean)
        .join("\n");

      return [
        "BEGIN:VEVENT",
        `UID:clevers-${bezetting.id}@clevers-erp`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcsValue("Clevers dienst")}`,
        `LOCATION:${escapeIcsValue(vestiging)}`,
        `DESCRIPTION:${escapeIcsValue(omschrijving)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clevers ERP//Webapp//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clevers-planning.ics"',
      "Cache-Control": "no-store",
    },
  });
}

function escapeIcsValue(value: string) {
  return escapeIcs(value);
}
