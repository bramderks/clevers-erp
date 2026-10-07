import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL ontbreekt");

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  const tags = await pool.query('SELECT id, naam, volgorde, actief FROM "Tag" ORDER BY volgorde, naam');
  const vestigingen = await pool.query('SELECT id, naam, code FROM "Vestiging" ORDER BY naam');
  const employees = await pool.query('SELECT id, voornaam, tussenvoegsel, achternaam, actief FROM "Medewerker" ORDER BY achternaam, voornaam');

  const september = await pool.query(`
    SELECT d.id, d."datum", d."begintijd", d."eindtijd", w.id AS "weekId",
           v.id AS "vestigingId", v.naam AS "vestigingNaam",
           m.id AS "medewerkerId", m.voornaam, m.tussenvoegsel, m.achternaam,
           string_agg(t.naam || ':' || dt.aantal, ',' ORDER BY t.volgorde, t.naam) AS tags
    FROM "Dienst" d
    JOIN "Week" w ON w.id = d."weekId"
    JOIN "Vestiging" v ON v.id = w."vestigingId"
    LEFT JOIN "DienstBezetting" db ON db."dienstId" = d.id
    LEFT JOIN "Medewerker" m ON m.id = db."medewerkerId"
    LEFT JOIN "DienstTag" dt ON dt."dienstId" = d.id
    LEFT JOIN "Tag" t ON t.id = dt."tagId"
    WHERE v.naam ILIKE '%Nijmegen%'
      AND d."datum" >= TIMESTAMP '2026-09-01'
      AND d."datum" < TIMESTAMP '2026-10-01'
    GROUP BY d.id, d."datum", d."begintijd", d."eindtijd", w.id, v.id, v.naam,
             m.id, m.voornaam, m.tussenvoegsel, m.achternaam
    ORDER BY d."datum", d."begintijd", d.id
  `);

  console.log("INSPECT_TAGS="+JSON.stringify(tags.rows));
  console.log("INSPECT_VESTIGINGEN="+JSON.stringify(vestigingen.rows));
  console.log("INSPECT_EMPLOYEES="+JSON.stringify(employees.rows));
  console.log("INSPECT_SEPTEMBER="+JSON.stringify(september.rows));
} finally {
  await pool.end();
}
