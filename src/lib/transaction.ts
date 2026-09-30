import { Prisma } from "@/generated/prisma";
import { prisma } from "./prisma";

/** Solo operazioni DB: il callback può essere rieseguito dopo un conflitto. */
export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000, maxWait: 10_000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * 2 ** attempt + Math.random() * 30));
    }
  }
}
