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

const maxConnections = Number.parseInt(
  process.env.DATABASE_POOL_MAX ?? "2",
  10,
);

const prismaPool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: databaseUrl,
    max: Number.isFinite(maxConnections)
      ? Math.max(1, maxConnections)
      : 2,
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
