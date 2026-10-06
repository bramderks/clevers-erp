import { execFileSync } from "node:child_process";
import { Client } from "pg";

const OWNER_PROFILE_MIGRATION =
  "20260916203000_create_owner_employee_profiles";


if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production" && process.env.DATABASE_URL) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const q = await client.query(
      `SELECT m."voornaam", m."tussenvoegsel", m."achternaam", u."datum", u."werkelijkeBegintijd", u."werkelijkeEindtijd", u."pauzeMinuten", u."gewerkteUren"
       FROM "UrenRegistratie" u
       JOIN "Medewerker" m ON m."id"=u."medewerkerId"
       WHERE u."datum">=$1 AND u."datum"<$2 AND u."vestigingId"=(SELECT "id" FROM "Vestiging" WHERE "naam"='Nijmegen' ORDER BY "actief" DESC LIMIT 1)
       ORDER BY m."achternaam",m."voornaam",u."datum",u."werkelijkeBegintijd"`,
      ["2026-09-01T00:00:00+02:00","2026-10-01T00:00:00+02:00"]
    );
    console.log("SEPTEMBER_UREN_REGISTRATIES="+JSON.stringify(q.rows));
  } finally { await client.end().catch(()=>undefined); }
}

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
}
