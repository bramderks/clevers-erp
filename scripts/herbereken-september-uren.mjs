import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function minutesSinceAmsterdamMidnight(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function calculate(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const brutoMinuten = Math.round((end.getTime() - start.getTime()) / 60000);

  if (brutoMinuten <= 0) {
    throw new Error("Ongeldige diensttijd.");
  }

  const startMinutes = minutesSinceAmsterdamMidnight(start);
  const endMinutes = minutesSinceAmsterdamMidnight(end);

  let pauzeMinuten = 0;

  if (startMinutes >= 17 * 60) {
    pauzeMinuten = 0;
  } else if (startMinutes >= 12 * 60) {
    pauzeMinuten = endMinutes > 18 * 60 ? 30 : 0;
  } else if (endMinutes > 14 * 60) {
    pauzeMinuten = brutoMinuten > 6 * 60 ? 30 : 0;
  } else {
    pauzeMinuten = brutoMinuten < 4 * 60 ? 0 : 15;
  }

  const nettoMinuten = brutoMinuten - pauzeMinuten;
  const afgerondeNettoMinuten = Math.round(nettoMinuten / 15) * 15;
  const gewerkteUren = Number((afgerondeNettoMinuten / 60).toFixed(2));

  return { pauzeMinuten, gewerkteUren };
}

const client = await pool.connect();

try {
  await client.query("BEGIN");

  const { rows } = await client.query(`
    SELECT
      "id",
      "werkelijkeBegintijd",
      "werkelijkeEindtijd",
      "pauzeMinuten",
      "gewerkteUren"
    FROM "UrenRegistratie"
    WHERE "status" = 'DEFINITIEF'
      AND "datum" >= DATE '2026-09-01'
      AND "datum" < DATE '2026-10-01'
  `);

  let gewijzigd = 0;

  for (const row of rows) {
    const berekening = calculate(
      row.werkelijkeBegintijd,
      row.werkelijkeEindtijd,
    );

    if (
      Number(row.pauzeMinuten) !== berekening.pauzeMinuten ||
      Number(row.gewerkteUren) !== berekening.gewerkteUren
    ) {
      await client.query(
        `UPDATE "UrenRegistratie"
         SET "pauzeMinuten" = $1,
             "gewerkteUren" = $2
         WHERE "id" = $3`,
        [
          berekening.pauzeMinuten,
          berekening.gewerkteUren,
          row.id,
        ],
      );
      gewijzigd += 1;
    }
  }

  await client.query("COMMIT");

  console.log(
    `September 2026 uren herberekend: ${rows.length} definitieve registraties, ${gewijzigd} gewijzigd.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
