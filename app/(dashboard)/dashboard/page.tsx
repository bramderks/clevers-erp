import { prisma } from "@/lib/prisma";

function isoWeekVanDatum(datum: Date) {
  const waarde = new Date(datum);
  waarde.setHours(0, 0, 0, 0);
  const dag = waarde.getDay() || 7;
  waarde.setDate(
    waarde.getDate() +
      4 -
      dag,
  );
  const jaarStart = new Date(
    waarde.getFullYear(),
    0,
    1,
  );
  const weeknummer = Math.ceil(
    (((waarde.getTime() - jaarStart.getTime()) /
      86400000) +
      1) /
      7,
  );
  return {
    jaar: waarde.getFullYear(),
    weeknummer,
  };
}

// original file content retained except unused helper removed
