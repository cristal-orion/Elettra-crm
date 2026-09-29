"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Segna la guida come vista (conclusa o saltata): non si riapre da sola. */
export async function completaGuida() {
  const user = await requireUser();
  if (user.guidaCompletataAt) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { guidaCompletataAt: new Date() },
  });
  revalidatePath("/", "layout");
}
