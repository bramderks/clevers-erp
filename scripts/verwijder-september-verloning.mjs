import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

try {
  const result = await client.query(
    `DELETE FROM "VerloningsPeriode"
     WHERE "jaar" = $1 AND "maand" = $2
     RETURNING "id"`,
    [2026, 9],
  );

  console.log(`VERLONING_SEPTEMBER_VERWIJDERD=${result.rowCount}`);
} finally {
  await client.end();
}
