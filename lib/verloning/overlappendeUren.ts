export type TijdInterval = {
  id: string;
  begintijd: Date;
  eindtijd: Date;
};

export function mergeTijdIntervallen(
  intervallen: Array<{ begintijd: Date; eindtijd: Date }>,
) {
  const geldig = intervallen
    .filter(
      (interval) =>
        !Number.isNaN(interval.begintijd.getTime()) &&
        !Number.isNaN(interval.eindtijd.getTime()) &&
        interval.eindtijd > interval.begintijd,
    )
    .map((interval) => ({
      begintijd: new Date(interval.begintijd),
      eindtijd: new Date(interval.eindtijd),
    }))
    .sort((a, b) => a.begintijd.getTime() - b.begintijd.getTime());

  const samengevoegd: Array<{ begintijd: Date; eindtijd: Date }> = [];

  for (const interval of geldig) {
    const laatste = samengevoegd[samengevoegd.length - 1];

    if (!laatste || interval.begintijd > laatste.eindtijd) {
      samengevoegd.push(interval);
    } else if (interval.eindtijd > laatste.eindtijd) {
      laatste.eindtijd = interval.eindtijd;
    }
  }

  return samengevoegd;
}

export function urenVanSamengevoegdeIntervallen(
  intervallen: Array<{ begintijd: Date; eindtijd: Date }>,
) {
  return (
    mergeTijdIntervallen(intervallen).reduce(
      (totaal, interval) =>
        totaal +
        (interval.eindtijd.getTime() - interval.begintijd.getTime()) / 3_600_000,
      0,
    )
  );
}

export function datumSleutelVoorUren(datum: Date) {
  return [
    datum.getFullYear(),
    String(datum.getMonth() + 1).padStart(2, "0"),
    String(datum.getDate()).padStart(2, "0"),
  ].join("-");
}

export function uniekeUrenPerRegistratie(
  registraties: TijdInterval[],
) {
  const resultaat = new Map<string, number>();
  const gedekteIntervallen: Array<{ begintijd: Date; eindtijd: Date }> = [];

  const gesorteerd = [...registraties]
    .filter(
      (registratie) =>
        !Number.isNaN(registratie.begintijd.getTime()) &&
        !Number.isNaN(registratie.eindtijd.getTime()) &&
        registratie.eindtijd > registratie.begintijd,
    )
    .sort(
      (a, b) =>
        a.begintijd.getTime() - b.begintijd.getTime() ||
        a.eindtijd.getTime() - b.eindtijd.getTime() ||
        a.id.localeCompare(b.id),
    );

  for (const registratie of gesorteerd) {
    let resterend: Array<{ begintijd: Date; eindtijd: Date }> = [
      {
        begintijd: new Date(registratie.begintijd),
        eindtijd: new Date(registratie.eindtijd),
      },
    ];

    for (const gedekt of gedekteIntervallen) {
      const nieuw: Array<{ begintijd: Date; eindtijd: Date }> = [];

      for (const deel of resterend) {
        if (
          deel.eindtijd <= gedekt.begintijd ||
          deel.begintijd >= gedekt.eindtijd
        ) {
          nieuw.push(deel);
          continue;
        }

        if (deel.begintijd < gedekt.begintijd) {
          nieuw.push({
            begintijd: deel.begintijd,
            eindtijd: new Date(gedekt.begintijd),
          });
        }

        if (deel.eindtijd > gedekt.eindtijd) {
          nieuw.push({
            begintijd: new Date(gedekt.eindtijd),
            eindtijd: deel.eindtijd,
          });
        }
      }

      resterend = nieuw;
    }

    const uniekeUren = resterend.reduce(
      (totaal, deel) =>
        totaal +
        (deel.eindtijd.getTime() - deel.begintijd.getTime()) / 3_600_000,
      0,
    );

    resultaat.set(registratie.id, uniekeUren);
    gedekteIntervallen.push({
      begintijd: registratie.begintijd,
      eindtijd: registratie.eindtijd,
    });
  }

  return resultaat;
}
