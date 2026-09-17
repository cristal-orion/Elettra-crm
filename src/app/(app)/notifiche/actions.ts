"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
export async function markRead(id: string) {
  const user = await requireUser();
  await prisma.notifica.updateMany({ where: { id, userId: user.id }, data: { letta: true } });
  revalidatePath("/", "layout");
}
