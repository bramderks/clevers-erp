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

  if (process.env.DATABASE_URL) {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      await client.connect();

      const repair = await client.query(`
        WITH nijmegen AS (
          SELECT "id"
          FROM "Vestiging"
          WHERE lower("naam") = 'nijmegen'
          ORDER BY "id"
          LIMIT 1
        ),
        doel AS (
          SELECT *
          FROM (VALUES
            ('Andrea de Bock - Berghmans', '2026-09-01'),
            ('Andrea de Bock - Berghmans', '2026-09-04'),
            ('Andrea de Bock - Berghmans', '2026-09-07'),
            ('Andrea de Bock - Berghmans', '2026-09-11'),
            ('Andrea de Bock - Berghmans', '2026-09-14'),
            ('Andrea de Bock - Berghmans', '2026-09-18'),
            ('Andrea de Bock - Berghmans', '2026-09-21'),
            ('Andrea de Bock - Berghmans', '2026-09-22'),
            ('Andrea de Bock - Berghmans', '2026-09-25'),
            ('Andrea de Bock - Berghmans', '2026-09-28'),
            ('Coosje Helsen', '2026-09-07'),
            ('Coosje Helsen', '2026-09-12'),
            ('Coosje Helsen', '2026-09-14'),
            ('Coosje Helsen', '2026-09-21'),
            ('Coosje Helsen', '2026-09-28'),
            ('Jayro Peters', '2026-09-02'),
            ('Jayro Peters', '2026-09-03'),
            ('Jayro Peters', '2026-09-07'),
            ('Jayro Peters', '2026-09-08'),
            ('Jayro Peters', '2026-09-10'),
            ('Jayro Peters', '2026-09-14'),
            ('Jayro Peters', '2026-09-21'),
            ('Jayro Peters', '2026-09-28'),
            ('Julia Leenders', '2026-09-01'),
            ('Julia Leenders', '2026-09-03'),
            ('Julia Leenders', '2026-09-08'),
            ('Julia Leenders', '2026-09-25'),
            ('Julia Leenders', '2026-09-29')
          ) AS t("naam", "datum")
        ),
        teVerwijderen AS (
          SELECT u."id"
          FROM "UrenRegistratie" u
          JOIN "Medewerker" m ON m."id" = u."medewerkerId"
          WHERE u."vestigingId" = (SELECT "id" FROM nijmegen)
            AND u."datum" >= TIMESTAMPTZ '2026-08-31 22:00:00+00'
            AND u."datum" < TIMESTAMPTZ '2026-09-30 22:00:00+00'
            AND concat_ws(' ', m."voornaam", m."tussenvoegsel", m."achternaam") IN (
              'Jayro Peters',
              'Andrea de Bock - Berghmans',
              'Coosje Helsen',
              'Julia Leenders'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM doel
              WHERE doel."naam" = concat_ws(' ', m."voornaam", m."tussenvoegsel", m."achternaam")
                AND doel."datum" = to_char(u."datum" + interval '2 hours', 'YYYY-MM-DD')
            )
        )
        DELETE FROM "UrenRegistratie" u
        WHERE u."id" IN (SELECT "id" FROM teVerwijderen)
        RETURNING u."id"
      `);

      await client.query(`
        WITH doel AS (
          SELECT *
          FROM (VALUES
            ('Andrea de Bock - Berghmans', '2026-09-01'),
            ('Andrea de Bock - Berghmans', '2026-09-04'),
            ('Andrea de Bock - Berghmans', '2026-09-07'),
            ('Andrea de Bock - Berghmans', '2026-09-11'),
            ('Andrea de Bock - Berghmans', '2026-09-14'),
            ('Andrea de Bock - Berghmans', '2026-09-18'),
            ('Andrea de Bock - Berghmans', '2026-09-21'),
            ('Andrea de Bock - Berghmans', '2026-09-22'),
            ('Andrea de Bock - Berghmans', '2026-09-25'),
            ('Andrea de Bock - Berghmans', '2026-09-28'),
            ('Coosje Helsen', '2026-09-07'),
            ('Coosje Helsen', '2026-09-12'),
            ('Coosje Helsen', '2026-09-14'),
            ('Coosje Helsen', '2026-09-21'),
            ('Coosje Helsen', '2026-09-28'),
            ('Jayro Peters', '2026-09-02'),
            ('Jayro Peters', '2026-09-03'),
            ('Jayro Peters', '2026-09-07'),
            ('Jayro Peters', '2026-09-08'),
            ('Jayro Peters', '2026-09-10'),
            ('Jayro Peters', '2026-09-14'),
            ('Jayro Peters', '2026-09-21'),
            ('Jayro Peters', '2026-09-28'),
            ('Julia Leenders', '2026-09-01'),
            ('Julia Leenders', '2026-09-03'),
            ('Julia Leenders', '2026-09-08'),
            ('Julia Leenders', '2026-09-25'),
            ('Julia Leenders', '2026-09-29')
          ) AS t("naam", "datum")
        )
        UPDATE "UrenRegistratie" u
        SET
          "status" = 'TE_CONTROLEREN',
          "gecontroleerdDoorId" = NULL,
          "gecontroleerdOp" = NULL
        FROM "Medewerker" m
        WHERE m."id" = u."medewerkerId"
          AND u."vestigingId" = (
            SELECT "id" FROM "Vestiging"
            WHERE lower("naam") = 'nijmegen'
            ORDER BY "id"
            LIMIT 1
          )
          AND u."datum" >= TIMESTAMPTZ '2026-08-31 22:00:00+00'
          AND u."datum" < TIMESTAMPTZ '2026-09-30 22:00:00+00'
          AND EXISTS (
            SELECT 1
            FROM doel
            WHERE doel."naam" = concat_ws(' ', m."voornaam", m."tussenvoegsel", m."achternaam")
              AND doel."datum" = to_char(u."datum" + interval '2 hours', 'YYYY-MM-DD')
          )
      `);

      const period = await client.query(`
        SELECT "id"
        FROM "VerloningsPeriode"
        WHERE "jaar" = 2026 AND "maand" = 9
        LIMIT 1
      `);

      let deletedRules = 0;
      if (period.rowCount > 0) {
        const result = await client.query(`
          DELETE FROM "VerloningsRegel" vr
          USING "Medewerker" m
          WHERE vr."verloningsPeriodeId" = $1
            AND vr."medewerkerId" = m."id"
            AND concat_ws(' ', m."voornaam", m."tussenvoegsel", m."achternaam") IN (
              'Jayro Peters',
              'Andrea de Bock - Berghmans',
              'Coosje Helsen',
              'Julia Leenders'
            )
        `, [period.rows[0].id]);
        deletedRules = result.rowCount ?? 0;

        await client.query(`
          UPDATE "VerloningsControle" vc
          SET
            "status" = 'OPEN',
            "gecontroleerdOp" = NULL,
            "automatischAkkoordOp" = NULL
          WHERE vc."verloningsPeriodeId" = $1
            AND vc."medewerkerId" IN (
              SELECT "id"
              FROM "Medewerker"
              WHERE
                concat_ws(' ', "voornaam", "tussenvoegsel", "achternaam") IN (
                  'Jayro Peters',
                  'Andrea de Bock - Berghmans',
                  'Coosje Helsen',
                  'Julia Leenders'
                )
            )
        `, [period.rows[0].id]);
      }

      const diagnostiek = await client.query(`
        SELECT
          concat_ws(' ', m."voornaam", m."tussenvoegsel", m."achternaam") AS "naam",
          u."status" AS "status",
          count(*)::int AS "aantal"
        FROM "UrenRegistratie" u
        JOIN "Medewerker" m ON m."id" = u."medewerkerId"
        WHERE u."vestigingId" = (SELECT "id" FROM "Vestiging" WHERE lower("naam") = 'nijmegen' ORDER BY "id" LIMIT 1)
          AND u."datum" >= TIMESTAMPTZ '2026-08-31 22:00:00+00'
          AND u."datum" < TIMESTAMPTZ '2026-09-30 22:00:00+00'
          AND concat_ws(' ', m."voornaam", m."tussenvoegsel", m."achternaam") IN (
            'Jayro Peters',
            'Andrea de Bock - Berghmans',
            'Coosje Helsen',
            'Julia Leenders'
          )
        GROUP BY 1, 2
        ORDER BY 1, 2
      `);

      console.log(
        `UREN_HERSTEL_CONTROLE_STATUS={"opengezet":${repair.rowCount ?? 0},"verloningsregelsVerwijderd":${deletedRules},"diagnostiek":${JSON.stringify(diagnostiek.rows)}}`,
      );
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
}
