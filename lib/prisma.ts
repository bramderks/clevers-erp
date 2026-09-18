import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is niet ingesteld.");
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

const configuredMax = Number.parseInt(
  process.env.DATABASE_POOL_MAX ?? "",
  10,
);

/*
 * Vercel draait meerdere serverless instances naast elkaar.
 * Een pool van 2 per instance kan bij gelijktijdige requests
 * onnodig snel tegen de database connection limit aanlopen.
 *
 * Daarom standaard 1 verbinding op Vercel en 2 lokaal.
 * DATABASE_POOL_MAX kan dit expliciet overschrijven.
 */
const maxConnections = Number.isFinite(configuredMax)
  ? Math.max(1, configuredMax)
  : process.env.VERCEL
    ? 1
    : 2;

const prismaPool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: databaseUrl,
    max: maxConnections,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(prismaPool),
  });

globalForPrisma.prismaPool = prismaPool;
globalForPrisma.prisma = prisma;

export { prisma };
