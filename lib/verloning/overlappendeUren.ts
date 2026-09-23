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
