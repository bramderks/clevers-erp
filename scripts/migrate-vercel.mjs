import { execFileSync } from "node:child_process";
import { Client } from "pg";

const OWNER_PROFILE_MIGRATION =
  "20260916203000_create_owner_employee_profiles";

if (process.env.VERCEL === "1") {
  // The first production rollout of the owner-profile migration failed after
  // partially entering Prisma's migration table. Recover only that known
  // failed migration so the corrected migration can be retried normally.
  if (process.env.DATABASE_URL) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      await client.connect();

      const result = await client.query(
        `SELECT 1
         FROM "_prisma_migrations"
         WHERE "migration_name" = $1
           AND "finished_at" IS NULL
           AND "rolled_back_at" IS NULL
         LIMIT 1`,
        [OWNER_PROFILE_MIGRATION],
      );

      if (result.rowCount > 0) {
        execFileSync(
          "npx",
          ["prisma", "migrate", "resolve", "--rolled-back", OWNER_PROFILE_MIGRATION],
          {
            stdio: "inherit",
            env: process.env,
          },
        );
      }
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });

  // Eenmalige herberekening van definitieve septemberuren 2026 volgens de
  // actuele pauzeregels. Dit blok wordt direct na uitvoering weer verwijderd.
  const start = new Date("2026-09-01T00:00:00+02:00");
  const end = new Date("2026-10-01T00:00:00+02:00");

  const { rows } = await client.query(
    `SELECT "id", "werkelijkeBegintijd", "werkelijkeEindtijd",
            "pauzeMinuten", "gewerkteUren"
     FROM "UrenRegistratie"
     WHERE "status" = 'DEFINITIEF'
       AND "datum" >= $1
       AND "datum" < $2`,
    [start, end],
  );

  const minutenAmsterdam = (value) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(value));
    const uur = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minuut = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return uur * 60 + minuut;
  };

  const bereken = (begin, einde) => {
    const bruto = Math.round(
      (new Date(einde).getTime() - new Date(begin).getTime()) / 60000,
    );
    const startMin = minutenAmsterdam(begin);
    const eindMin = minutenAmsterdam(einde);

    let pauze = 0;
    if (startMin >= 17 * 60) {
      pauze = 0;
    } else if (startMin >= 12 * 60) {
      pauze = eindMin > 18 * 60 ? 30 : 0;
    } else if (eindMin > 14 * 60) {
      pauze = bruto > 6 * 60 ? 30 : 0;
    } else {
      pauze = bruto < 4 * 60 ? 0 : 15;
    }

    const netto = bruto - pauze;
    const afgerond = Math.round(netto / 15) * 15;

    return {
      pauze,
      uren: Number((afgerond / 60).toFixed(2)),
    };
  };

  let gewijzigd = 0;

  for (const row of rows) {
    const berekening = bereken(row.werkelijkeBegintijd, row.werkelijkeEindtijd);

    if (
      Number(row.pauzeMinuten) !== berekening.pauze ||
      Number(row.gewerkteUren) !== berekening.uren
    ) {
      await client.query(
        `UPDATE "UrenRegistratie"
         SET "pauzeMinuten" = $1, "gewerkteUren" = $2
         WHERE "id" = $3`,
        [berekening.pauze, berekening.uren, row.id],
      );
      gewijzigd += 1;
    }
  }

  console.log(
    `September 2026 uren herberekend: ${rows.length} definitieve registraties, ${gewijzigd} gewijzigd.`,
  );
}
