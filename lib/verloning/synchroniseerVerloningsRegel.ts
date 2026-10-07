import { prisma } from "@/lib/prisma";
import { berekenGewerkteUren } from "@/lib/verloning/pauze";
import { mergeTijdIntervallen } from "@/lib/verloning/overlappendeUren";

function lokaleDatumSleutel(datum: Date) {
  const delen = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(datum);

  const jaar = delen.find((deel) => deel.type === "year")?.value;
  const maand = delen.find((deel) => deel.type === "month")?.value;
  const dag = delen.find((deel) => deel.type === "day")?.value;

  return jaar && maand && dag ? `${jaar}-${maand}-${dag}` : null;
}

function hoortBijMaand(datum: Date, jaar: number, maand: number) {
  const sleutel = lokaleDatumSleutel(datum);
  return sleutel?.startsWith(`${jaar}-${String(maand).padStart(2, "0")}-`) ?? false;
}

export async function synchroniseerVerloningsRegelVoorMedewerker(
  medewerkerId: string,
  vestigingId: string,
  jaar: number,
  maand: number,
) {
  const periode = await prisma.verloningsPeriode.findUnique({
    where: {
      jaar_maand: {
        jaar,
        maand,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!periode || periode.status === "VERWERKT") {
    return null;
  }

  const start = new Date(Date.UTC(jaar, maand - 1, 1));
  start.setUTCHours(start.getUTCHours() - 24);
  const einde = new Date(Date.UTC(jaar, maand, 1));
  einde.setUTCHours(einde.getUTCHours() + 24);

  const registraties = await prisma.urenRegistratie.findMany({
    where: {
      medewerkerId,
      vestigingId,
      status: "DEFINITIEF",
      datum: {
        gte: start,
        lt: einde,
      },
    },
    select: {
      datum: true,
      werkelijkeBegintijd: true,
      werkelijkeEindtijd: true,
    },
    orderBy: {
      datum: "asc",
    },
  });

  const maandRegistraties = registraties.filter((registratie) =>
    hoortBijMaand(registratie.datum, jaar, maand),
  );

  const perDag = new Map<
    string,
    Array<{ begintijd: Date; eindtijd: Date }>
  >();

  for (const registratie of maandRegistraties) {
    const sleutel = lokaleDatumSleutel(registratie.datum);
    if (!sleutel) continue;

    const lijst = perDag.get(sleutel) ?? [];
    lijst.push({
      begintijd: registratie.werkelijkeBegintijd,
      eindtijd: registratie.werkelijkeEindtijd,
    });
    perDag.set(sleutel, lijst);
  }

  let gewerkteDagen = 0;
  let gewerkteUren = 0;

  for (const intervallen of perDag.values()) {
    const samengevoegd = mergeTijdIntervallen(intervallen);
    if (samengevoegd.length === 0) continue;

    gewerkteDagen += 1;

    for (const interval of samengevoegd) {
      gewerkteUren += berekenGewerkteUren(
        interval.begintijd,
        interval.eindtijd,
      ).gewerkteUren;
    }
  }

  const medewerker = await prisma.medewerker.findUnique({
    where: { id: medewerkerId },
    select: {
      voornaam: true,
      tussenvoegsel: true,
      achternaam: true,
    },
  });

  if (!medewerker) {
    return null;
  }

  const medewerkerNaam = [
    medewerker.voornaam,
    medewerker.tussenvoegsel,
    medewerker.achternaam,
  ]
    .filter(Boolean)
    .join(" ");

  if (gewerkteDagen === 0) {
    await prisma.verloningsRegel.deleteMany({
      where: {
        verloningsPeriodeId: periode.id,
        medewerkerId,
        vestigingId,
      },
    });
  } else {
    await prisma.verloningsRegel.upsert({
      where: {
        verloningsPeriodeId_medewerkerId_vestigingId: {
          verloningsPeriodeId: periode.id,
          medewerkerId,
          vestigingId,
        },
      },
      create: {
        verloningsPeriodeId: periode.id,
        medewerkerId,
        vestigingId,
        medewerkerNaam,
        gewerkteDagen,
        gewerkteUren: Number(gewerkteUren.toFixed(2)),
      },
      update: {
        medewerkerNaam,
        gewerkteDagen,
        gewerkteUren: Number(gewerkteUren.toFixed(2)),
      },
    });
  }

  return periode.id;
}
