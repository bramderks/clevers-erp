import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function replaceIfPresent(relativePath, from, to) {
  const file = path.join(root, relativePath);
  let source = fs.readFileSync(file, "utf8");
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    throw new Error(`Expected access pattern not found in ${relativePath}`);
  }
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
}

replaceIfPresent(
  "app/api/medewerkers/[id]/beschikbaarheid/route.ts",
`  if (
    organisatieRelaties.length ===
    0
  ) {
    throw new RouteFout(
      "Je hebt geen toegang tot deze organisatie.",
      403,
    );
  }
`,
`  const isEigenMedewerker =
    gebruiker.medewerker?.id === medewerkerId;

  if (
    organisatieRelaties.length === 0 &&
    !isEigenMedewerker
  ) {
    throw new RouteFout(
      "Je hebt geen toegang tot deze organisatie.",
      403,
    );
  }
`,
);

replaceIfPresent(
  "app/api/medewerkers/[id]/beschikbaarheid/route.ts",
`  const isEigenMedewerker =
    gebruiker.medewerker?.id ===
    medewerkerId;

  if (
    !isBeheerder &&
    !isTeamleider &&
    !isEigenMedewerker
  ) {
`,
`  if (
    !isBeheerder &&
    !isTeamleider &&
    !isEigenMedewerker
  ) {
`,
);

console.log("Employee availability access fix applied successfully.");
