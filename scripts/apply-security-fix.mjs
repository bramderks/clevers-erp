import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function patch(relativePath, replacements) {
  const file = path.join(root, relativePath);
  let source = fs.readFileSync(file, "utf8");
  for (const [from, to] of replacements) {
    if (!source.includes(from)) {
      throw new Error(`Security fix pattern not found in ${relativePath}`);
    }
    source = source.replace(from, to);
  }
  fs.writeFileSync(file, source);
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
  [
`  isTeamleider?: boolean;
  isMedewerker?: boolean;
};`,
`  isTeamleider?: boolean;
  isMedewerker?: boolean;
  huidigeMedewerkerId?: string | null;
};`,
  ],
  [
`  isTeamleider = false,
  isMedewerker = false,
}: PlanningPaginaProps)`,
`  isTeamleider = false,
  isMedewerker = false,
  huidigeMedewerkerId = null,
}: PlanningPaginaProps)`,
  ],
  [
`          isTeamleider={isTeamleider}
          isMedewerker={isMedewerker}
          kanVerwijderen={isEigenaar}`,
`          isTeamleider={isTeamleider}
          isMedewerker={isMedewerker}
          huidigeMedewerkerId={huidigeMedewerkerId}
          kanVerwijderen={isEigenaar}`,
  ],
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

console.log("ERP security/planning build fix applied successfully.");
