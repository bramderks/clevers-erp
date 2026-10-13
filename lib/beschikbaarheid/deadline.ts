export const BESCHIKBAARHEID_TEST_EINDDATUM = new Date(
  "2026-11-30T23:00:00.000Z",
);

export type BeschikbaarheidDeadlineWeek = {
  jaar: number;
  weeknummer: number;
  beschikbaarheidDeadline?: string | Date | null;
};

export function beginVanISOWeek(jaar: number, weeknummer: number): Date {
  const datum = new Date(Date.UTC(jaar, 0, 4));
  const dag = datum.getUTCDay() || 7;
  datum.setUTCDate(datum.getUTCDate() - dag + 1 + (weeknummer - 1) * 7);
  return datum;
}

export function volgendeWeekStart(vandaag = new Date()): Date {
  const start = new Date(
    Date.UTC(vandaag.getUTCFullYear(), vandaag.getUTCMonth(), vandaag.getUTCDate()),
  );
  const dag = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() + (8 - dag));
  return start;
}

export function isTestOpenVoorWeek(
  jaar: number,
  weeknummer: number,
  vandaag = new Date(),
): boolean {
  return (
    vandaag < BESCHIKBAARHEID_TEST_EINDDATUM &&
    beginVanISOWeek(jaar, weeknummer) >= volgendeWeekStart(vandaag)
  );
}

export function berekenBeschikbaarheidDeadline(
  jaar: number,
  weeknummer: number,
): Date {
  const deadline = beginVanISOWeek(jaar, weeknummer);
  deadline.setUTCDate(deadline.getUTCDate() - 28);
  deadline.setUTCHours(23, 59, 59, 999);
  return deadline;
}

export function isBeschikbaarheidDeadlineVerstreken(
  week: BeschikbaarheidDeadlineWeek,
  vandaag = new Date(),
): boolean {
  if (isTestOpenVoorWeek(week.jaar, week.weeknummer, vandaag)) {
    return false;
  }

  const deadline = week.beschikbaarheidDeadline
    ? new Date(week.beschikbaarheidDeadline)
    : berekenBeschikbaarheidDeadline(week.jaar, week.weeknummer);

  return vandaag > deadline;
}
