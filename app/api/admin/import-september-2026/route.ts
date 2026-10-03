import { NextResponse } from "next/server";
import { getCurrentUser, hasPermissionForVestiging, isEigenaar } from "@/lib/auth";
import { permissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const DIENSTEN = [
  {
    "date": "2026-09-02",
    "name": "Jessica Derks",
    "start": "09:00",
    "end": "18:00"
  },
  {
    "date": "2026-09-03",
    "name": "Jessica Derks",
    "start": "09:00",
    "end": "17:00"
  },
  {
    "date": "2026-09-05",
    "name": "Jessica Derks",
    "start": "09:00",
    "end": "14:00"
  },
  {
    "date": "2026-09-06",
    "name": "Jessica Derks",
    "start": "09:00",
    "end": "14:00"
  },
  {
    "date": "2026-09-01",
    "name": "Bram Derks",
    "start": "14:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-04",
    "name": "Bram Derks",
    "start": "09:00",
    "end": "14:00"
  },
  {
    "date": "2026-09-06",
    "name": "Bram Derks",
    "start": "14:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-01",
    "name": "Andrea de Bock",
    "start": "09:00",
    "end": "14:00"
  },
  {
    "date": "2026-09-04",
    "name": "Andrea de Bock",
    "start": "14:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-05",
    "name": "Pleun Kamps",
    "start": "14:00",
    "end": "22:00"
  },
  {
    "date": "2026-09-05",
    "name": "Maureen Houkes",
    "start": "14:00",
    "end": "22:00"
  },
  {
    "date": "2026-09-04",
    "name": "Pleun Schenk",
    "start": "18:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-06",
    "name": "Pleun Schenk",
    "start": "18:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-01",
    "name": "Julia Leenders",
    "start": "18:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-03",
    "name": "Julia Leenders",
    "start": "18:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-06",
    "name": "Lotte Trilsbeek",
    "start": "14:00",
    "end": "18:00"
  },
  {
    "date": "2026-09-06",
    "name": "Maud Broeren",
    "start": "18:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-04",
    "name": "Isa Derks",
    "start": "18:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-02",
    "name": "Jayro Peters",
    "start": "18:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-03",
    "name": "Jayro Peters",
    "start": "17:00",
    "end": "22:15"
  },
  {
    "date": "2026-09-05",
    "name": "Millie Kempenaar",
    "start": "18:00",
    "end": "22:00"
  },
  {
    "date": "2026-09-09",
    "name": "Jessica Derks",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-10",
    "name": "Jessica Derks",
    "start": "11:30",
    "end": "17:00"
  },
  {
    "date": "2026-09-08",
    "name": "Bram Derks",
    "start": "11:30",
    "end": "17:00"
  },
  {
    "date": "2026-09-13",
    "name": "Bram Derks",
    "start": "11:30",
    "end": "20:45"
  },
  {
    "date": "2026-09-07",
    "name": "Andrea de Bock",
    "start": "11:30",
    "end": "17:00"
  },
  {
    "date": "2026-09-11",
    "name": "Andrea de Bock",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-12",
    "name": "Pleun Kamps",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-11",
    "name": "Pleun Schenk",
    "start": "17:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-13",
    "name": "Pleun Schenk",
    "start": "17:00",
    "end": "20:45"
  },
  {
    "date": "2026-09-10",
    "name": "Sayanora Amadmoesri",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-07",
    "name": "Coosje Helsen",
    "start": "17:00",
    "end": "21:30"
  },
  {
    "date": "2026-09-12",
    "name": "Coosje Helsen",
    "start": "14:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-08",
    "name": "Julia Leenders",
    "start": "17:00",
    "end": "20:45"
  },
  {
    "date": "2026-09-13",
    "name": "Maud Broeren",
    "start": "18:00",
    "end": "20:45"
  },
  {
    "date": "2026-09-11",
    "name": "Isa Derks",
    "start": "18:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-07",
    "name": "Jayro Peters",
    "start": "17:00",
    "end": "21:30"
  },
  {
    "date": "2026-09-08",
    "name": "Jayro Peters",
    "start": "17:00",
    "end": "20:45"
  },
  {
    "date": "2026-09-10",
    "name": "Jayro Peters",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-16",
    "name": "Jessica Derks",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-20",
    "name": "Jessica Derks",
    "start": "11:30",
    "end": "21:15"
  },
  {
    "date": "2026-09-15",
    "name": "Bram Derks",
    "start": "11:30",
    "end": "21:30"
  },
  {
    "date": "2026-09-17",
    "name": "Bram Derks",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-14",
    "name": "Andrea de Bock",
    "start": "11:30",
    "end": "17:00"
  },
  {
    "date": "2026-09-18",
    "name": "Andrea de Bock",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-19",
    "name": "Pleun Kamps",
    "start": "11:30",
    "end": "20:45"
  },
  {
    "date": "2026-09-19",
    "name": "Maureen Houkes",
    "start": "14:00",
    "end": "17:00"
  },
  {
    "date": "2026-09-19",
    "name": "Sayanora Amadmoesri",
    "start": "17:00",
    "end": "20:45"
  },
  {
    "date": "2026-09-14",
    "name": "Coosje Helsen",
    "start": "17:00",
    "end": "21:15"
  },
  {
    "date": "2026-09-15",
    "name": "Lotte Trilsbeek",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-20",
    "name": "Lotte Trilsbeek",
    "start": "14:00",
    "end": "18:00"
  },
  {
    "date": "2026-09-17",
    "name": "Maud Broeren",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-20",
    "name": "Maud Broeren",
    "start": "17:00",
    "end": "21:15"
  },
  {
    "date": "2026-09-18",
    "name": "Isa Derks",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-14",
    "name": "Jayro Peters",
    "start": "17:00",
    "end": "21:15"
  },
  {
    "date": "2026-09-23",
    "name": "Jessica Derks",
    "start": "11:30",
    "end": "21:30"
  },
  {
    "date": "2026-09-27",
    "name": "Jessica Derks",
    "start": "11:30",
    "end": "21:30"
  },
  {
    "date": "2026-09-22",
    "name": "Bram Derks",
    "start": "11:30",
    "end": "17:00"
  },
  {
    "date": "2026-09-24",
    "name": "Bram Derks",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-21",
    "name": "Andrea de Bock",
    "start": "11:30",
    "end": "17:00"
  },
  {
    "date": "2026-09-22",
    "name": "Andrea de Bock",
    "start": "17:00",
    "end": "20:45"
  },
  {
    "date": "2026-09-25",
    "name": "Andrea de Bock",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-26",
    "name": "Pleun Kamps",
    "start": "11:30",
    "end": "21:30"
  },
  {
    "date": "2026-09-24",
    "name": "Sayanora Amadmoesri",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-21",
    "name": "Coosje Helsen",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-25",
    "name": "Julia Leenders",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-27",
    "name": "Lotte Trilsbeek",
    "start": "14:00",
    "end": "18:00"
  },
  {
    "date": "2026-09-22",
    "name": "Maud Broeren",
    "start": "17:00",
    "end": "20:45"
  },
  {
    "date": "2026-09-27",
    "name": "Maud Broeren",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-21",
    "name": "Jayro Peters",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-26",
    "name": "Millie Kempenaar",
    "start": "17:00",
    "end": "21:30"
  },
  {
    "date": "2026-09-30",
    "name": "Jessica Derks",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-29",
    "name": "Bram Derks",
    "start": "11:30",
    "end": "21:00"
  },
  {
    "date": "2026-09-28",
    "name": "Andrea de Bock",
    "start": "11:00",
    "end": "17:00"
  },
  {
    "date": "2026-09-28",
    "name": "Coosje Helsen",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-29",
    "name": "Julia Leenders",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-30",
    "name": "Isa Derks",
    "start": "18:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-28",
    "name": "Jayro Peters",
    "start": "17:00",
    "end": "21:00"
  },
  {
    "date": "2026-09-30",
    "name": "Millie Kempenaar",
    "start": "17:00",
    "end": "21:00"
  }
] as const;

function norm(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
function lokaleTijd(date: string, time: string) {
  return new Date(date + "T" + time + ":00+02:00");
}

function kalenderDatum(date: string) {
  return new Date(date + "T00:00:00.000Z");
}
function dagStart(date: Date) {
  const d = new Date(date); d.setHours(0,0,0,0); return d;
}
function dagEinde(date: Date) {
  const d = new Date(date); d.setHours(23,59,59,999); return d;
}
function isoWeek(datum: Date) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4));
  const firstDay = first.getUTCDay() || 7;
  return { year, week: Math.ceil((((d.getTime()-first.getTime())/86400000)+firstDay-1)/7) };
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ fout: "Je moet ingelogd zijn." }, { status: 401 });

    const vestiging = await prisma.vestiging.findFirst({
      where: { naam: "Nijmegen", actief: true },
      select: { id: true, organisatieId: true, seizoenStart: true, seizoenEinde: true },
    });
    if (!vestiging) return NextResponse.json({ fout: "Vestiging Nijmegen niet gevonden." }, { status: 404 });

    if (!(await isEigenaar(vestiging.organisatieId)) ||
        !(await hasPermissionForVestiging(permissions.planning.create, vestiging.id))) {
      return NextResponse.json({ fout: "Alleen de eigenaar kan deze import uitvoeren." }, { status: 403 });
    }

    const tag = await prisma.tag.findFirst({
      where: { naam: "Bediening", actief: true },
      select: { id: true },
    });
    if (!tag) return NextResponse.json({ fout: "Planningstag Bediening ontbreekt." }, { status: 400 });

    const medewerkers = await prisma.medewerker.findMany({
      where: { actief: true, vestigingen: { some: { vestigingId: vestiging.id } } },
      select: { id: true, voornaam: true, tussenvoegsel: true, achternaam: true, roepnaam: true },
    });

    const alias: Record<string,string> = { [norm("Andrea de Bock")]: norm("Andrea de Bock Berghmans") };
    const medewerkerByName = new Map<string, { id: string }>();
    for (const m of medewerkers) {
      const full = norm([m.voornaam, m.tussenvoegsel, m.achternaam].filter(Boolean).join(" "));
      medewerkerByName.set(full, { id: m.id });
      if (m.roepnaam) medewerkerByName.set(norm([m.roepnaam, m.tussenvoegsel, m.achternaam].filter(Boolean).join(" ")), { id: m.id });
    }

    const unmatched: string[] = [];
    const created: string[] = [];
    const assigned: string[] = [];
    const skipped: string[] = [];

    for (const item of DIENSTEN) {
      const lookup = alias[norm(item.name)] ?? norm(item.name);
      const medewerker = medewerkerByName.get(lookup);
      if (!medewerker) {
        if (!unmatched.includes(item.name)) unmatched.push(item.name);
        continue;
      }

      // Een dienst-datum is een kalenderdatum, geen tijdstip in Amsterdam.
      // Daarom slaan we deze op als UTC-middernacht. Zo blijft 1 september
      // altijd 1 september en wordt hij niet 31 augustus door een timezoneverschuiving.
      const datum = kalenderDatum(item.date);
      const begintijd = lokaleTijd(item.date, item.start);
      const eindtijd = lokaleTijd(item.date, item.end);

      const iso = isoWeek(datum);
      const week = await prisma.week.findFirst({
        where: { vestigingId: vestiging.id, jaar: iso.year, weeknummer: iso.week },
        select: { id: true },
      });
      if (!week) {
        skipped.push(item.date + " " + item.name + ": planningweek ontbreekt");
        continue;
      }

      let dienst = await prisma.dienst.findFirst({
        where: { weekId: week.id, datum: { gte: dagStart(datum), lte: dagEinde(datum) }, begintijd, eindtijd },
        select: { id: true },
      });

      // Herstel eerder geïmporteerde diensten waarbij de kalenderdatum
      // als Amsterdamse middernacht was opgeslagen (dus 1 dag terug in UTC).
      if (!dienst) {
        const verkeerdeDatum = new Date(datum);
        verkeerdeDatum.setUTCDate(verkeerdeDatum.getUTCDate() - 1);

        const bestaandVerkeerd = await prisma.dienst.findFirst({
          where: {
            weekId: week.id,
            datum: { gte: verkeerdeDatum, lt: datum },
            begintijd,
            eindtijd,
            bezetting: { some: { medewerkerId: medewerker.id } },
          },
          select: { id: true },
        });

        if (bestaandVerkeerd) {
          dienst = await prisma.dienst.update({
            where: { id: bestaandVerkeerd.id },
            data: { datum },
            select: { id: true },
          });
        }
      }

      if (!dienst) {
        dienst = await prisma.dienst.create({
          data: { weekId: week.id, datum, begintijd, eindtijd, tags: { create: [{ tagId: tag.id, aantal: 1 }] } },
          select: { id: true },
        });
        created.push(dienst.id);
      }

      const existing = await prisma.dienstBezetting.findFirst({
        where: { dienstId: dienst.id, medewerkerId: medewerker.id },
        select: { id: true },
      });
      if (existing) {
        skipped.push(item.date + " " + item.name + " " + item.start + "-" + item.end + ": al gekoppeld");
        continue;
      }

      await prisma.dienstBezetting.create({
        data: { dienstId: dienst.id, medewerkerId: medewerker.id, status: "GEPLAND" },
      });
      assigned.push(item.date + " " + item.name + " " + item.start + "-" + item.end);
    }

    return NextResponse.json({
      succes: true, bron: "Roosters 2026 (Nijmegen)(3).xlsx", verwerkt: DIENSTEN.length,
      nieuweDiensten: created.length, koppelingen: assigned.length,
      alAanwezig: skipped.filter((x) => x.includes("al gekoppeld")).length,
      nietGekoppeld: unmatched, overgeslagen: skipped.filter((x) => !x.includes("al gekoppeld")),
    });
  } catch (error) {
    console.error("September 2026 roosterimport mislukt:", error);
    return NextResponse.json({ fout: "De import is mislukt." }, { status: 500 });
  }
}
