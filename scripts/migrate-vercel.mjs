import { execFileSync } from "node:child_process";

if (process.env.VERCEL === "1") {
  const migration =
    "20260916120000_normaliseer_rollen_en_planningstags";

  // Herstel alleen de bekende eerste mislukte uitrol. Op volgende deploys
  // geeft Prisma aan dat de migratie al is opgelost; dat mag de build niet
  // blokkeren.
  try {
    execFileSync(
      "npx",
      ["prisma", "migrate", "resolve", "--rolled-back", migration],
      {
        stdio: "inherit",
        env: process.env,
      },
    );
  } catch {
    // Alleen relevant wanneer de migratie al resolved/toegepast is.
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
}
