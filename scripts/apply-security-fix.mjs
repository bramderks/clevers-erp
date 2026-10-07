import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(relativePath, replacements) {
  const file = path.join(root, relativePath);
  let source = fs.readFileSync(file, "utf8");
  let gewijzigd = false;
  for (const [from, to] of replacements) {
    if (!source.includes(from)) continue;
    source = source.replace(from, to);
    gewijzigd = true;
  }
  if (gewijzigd) fs.writeFileSync(file, source);
}

patch("app/(dashboard)/medewerkers/[id]/page.tsx", [
  ["const magAlgemeenBewerken = isEigenaar || isEigenProfiel;", "const magAlgemeenBewerken = isEigenaar;"],
  ["const magContractBewerken = isEigenaar || isEigenProfiel;", "const magContractBewerken = isEigenaar;"],
  ["const magVestigingenBewerken = isEigenaar || isEigenProfiel;", "const magVestigingenBewerken = isEigenaar;"],
  ["const magBeschikbaarheidBewerken = isEigenaar || isEigenProfiel;", "const magBeschikbaarheidBewerken = isEigenaar;"],
  ["const magVerloningBewerken = isEigenaar || isEigenProfiel;", "const magVerloningBewerken = isEigenaar;"],
  ["const beschikbareTags = isEigenaar || isEigenProfiel", "const beschikbareTags = isEigenaar"],
  ["const beschikbareVestigingen = isEigenaar || isEigenProfiel", "const beschikbareVestigingen = isEigenaar"],
]);

patch("app/api/medewerkers/[id]/route.ts", [[
`    if (!isEigenaar && !isEigenProfiel) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om deze medewerker te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }
`,
`    if (!isEigenaar) {
      return NextResponse.json(
        {
          error:
            "Je hebt geen toestemming om deze medewerker te wijzigen.",
        },
        {
          status: 403,
        },
      );
    }
`,
]]);

patch("app/(dashboard)/planning/page.tsx", [[
`      isEigenaar={isEigenaar}
      isTeamleider={isTeamleider}
      isMedewerker={isMedewerker}
    />`,
`      isEigenaar={isEigenaar}
      isTeamleider={isTeamleider}
      isMedewerker={isMedewerker}
      huidigeMedewerkerId={gebruiker.medewerker?.id ?? null}
    />`,
]]);

patch("components/planning/PlanningPagina.tsx", [
  [`  isTeamleider?: boolean;
  isMedewerker?: boolean;
};`, `  isTeamleider?: boolean;
  isMedewerker?: boolean;
  huidigeMedewerkerId?: string | null;
};`],
  [`  isTeamleider = false,
  isMedewerker = false,
}: PlanningPaginaProps)`, `  isTeamleider = false,
  isMedewerker = false,
  huidigeMedewerkerId = null,
}: PlanningPaginaProps)`],
  [`          isTeamleider={isTeamleider}
          isMedewerker={isMedewerker}
          kanVerwijderen={isEigenaar}`, `          isTeamleider={isTeamleider}
          isMedewerker={isMedewerker}
          huidigeMedewerkerId={huidigeMedewerkerId}
          kanVerwijderen={isEigenaar}`],
]);

patch("components/layout/Navigation.tsx", [[
`    if (!item.permission) {
      return true;
    }
`,
`    if (item.href === "/planning" && isMedewerker) {
      return true;
    }

    if (!item.permission) {
      return true;
    }
`,
]]);

console.log("ERP security/planning/open-services build fix applied successfully.");


import pg from "pg";
const { Pool } = pg;
const inspectPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const tags = await inspectPool.query('SELECT id, naam, volgorde, actief FROM "Tag" ORDER BY volgorde, naam');
  const september = await inspectPool.query(
    'SELECT d.id, d."datum", d."begintijd", d."eindtijd", v.naam AS "vestigingNaam", ' +
    'm.id AS "medewerkerId", m.voornaam, m.tussenvoegsel, m.achternaam, ' +
    't.naam AS "tagNaam", dt.aantal AS "tagAantal" ' +
    'FROM "Dienst" d ' +
    'JOIN "Week" w ON w.id = d."weekId" ' +
    'JOIN "Vestiging" v ON v.id = w."vestigingId" ' +
    'LEFT JOIN "DienstBezetting" db ON db."dienstId" = d.id ' +
    'LEFT JOIN "Medewerker" m ON m.id = db."medewerkerId" ' +
    'LEFT JOIN "DienstTag" dt ON dt."dienstId" = d.id ' +
    'LEFT JOIN "Tag" t ON t.id = dt."tagId" ' +
    'WHERE v.naam ILIKE \'%Nijmegen%\' ' +
    'AND d."datum" >= TIMESTAMP \'2026-09-01\' ' +
    'AND d."datum" < TIMESTAMP \'2026-10-01\' ' +
    'ORDER BY d."datum", d."begintijd", d.id, m.achternaam, t.volgorde'
  );
  console.log("INSPECT_TAGS="+JSON.stringify(tags.rows));
  console.log("INSPECT_SEPTEMBER="+JSON.stringify(september.rows));
} finally {
  await inspectPool.end();
}
