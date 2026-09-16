import { execFileSync } from "node:child_process";

if (process.env.VERCEL === "1") {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
}
