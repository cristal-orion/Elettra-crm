import { PrismaClient } from "@/generated/prisma";

// Singleton per evitare connessioni multiple in dev con l'HMR di Next.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Le eccezioni Prisma possono includere valori delle query: niente log raw in produzione.
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
