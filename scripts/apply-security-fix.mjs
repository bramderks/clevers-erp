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

patch("app/(dashboard)/dashboard/page.tsx", [
  [`import PageHeader from "@/components/ui/PageHeader";
`, `import PageHeader from "@/components/ui/PageHeader";
import OpenDienstenMedewerker from "@/components/dashboard/OpenDienstenMedewerker";
`],
  [`    const aankomendeDiensten =
      toekomstigeDienstenResultaat.filter(
`, `    const openDienstenResultaat = await prisma.dienstBezetting.findMany({
      where: {
        status: "OPEN",
        medewerkerId: null,
        dienst: {
          datum: { gte: vandaagBegin },
          week: { vestiging: { actief: true, medewerkers: { some: { medewerkerId } } } },
          tags: { some: { tag: { medewerkers: { some: { medewerkerId } } } } },
        },
      },
      orderBy: { dienst: { datum: "asc" } },
      take: 50,
      select: {
        id: true,
        dienst: {
          select: {
            datum: true,
            begintijd: true,
            eindtijd: true,
            tags: { select: { tag: { select: { naam: true } } } },
            week: { select: { vestiging: { select: { naam: true, seizoenEinde: true } } } },
          },
        },
      },
    });

    const openDiensten = openDienstenResultaat
      .filter((bezetting) => isDienstBinnenSeizoen(bezetting.dienst.datum, bezetting.dienst.week.vestiging.seizoenEinde))
      .map((bezetting) => ({
        id: bezetting.id,
        datum: bezetting.dienst.datum.toISOString(),
        begintijd: bezetting.dienst.begintijd.toISOString(),
        eindtijd: bezetting.dienst.eindtijd.toISOString(),
        vestigingNaam: bezetting.dienst.week.vestiging.naam,
        tags: bezetting.dienst.tags.map((item) => item.tag.naam),
        interesseGemeld: false,
      }));

    const aankomendeDiensten =
      toekomstigeDienstenResultaat.filter(
`],
  [`        <PageHeader title="Dashboard" />

        {laatsteEigenVerloning && (
`, `        <PageHeader title="Dashboard" />

        <OpenDienstenMedewerker diensten={openDiensten} />

        {laatsteEigenVerloning && (
`],
]);

console.log("ERP security/planning/open-services build fix applied successfully.");
