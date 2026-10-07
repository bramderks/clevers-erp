import { execFileSync } from "node:child_process";
import { Client } from "pg";

const OWNER_PROFILE_MIGRATION =
  "20260916203000_create_owner_employee_profiles";



if (process.env.VERCEL === "1") {
  // The first production rollout of the owner-profile migration failed after
  // partially entering Prisma's migration table. Recover only that known
  // failed migration so the corrected migration can be retried normally.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
}
