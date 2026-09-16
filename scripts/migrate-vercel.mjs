import { execFileSync } from "node:child_process";

if (process.env.VERCEL === "1") {
  const migration =
    "20260916120000_normaliseer_rollen_en_planningstags";

  // De eerste uitrol van deze datacorrectie is tijdens de gelijktijdige
  // Vercel-deploys als failed gemarkeerd. Markeer uitsluitend deze bekende
  // eenmalige correctie als rolled back, zodat de definitieve SQL opnieuw
  // transactioneel kan worden uitgevoerd.
  execFileSync(
    "npx",
    ["prisma", "migrate", "resolve", "--rolled-back", migration],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
}
