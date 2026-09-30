"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { allowLogin, verifyPassword } from "@/lib/login-security";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(72).refine((v) => new TextEncoder().encode(v).length <= 72),
});

export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Inserisci email e password." };
  }

  const { email, password } = parsed.data;
  if (!await allowLogin(email)) return { error: "Troppi tentativi di accesso. Riprova tra 15 minuti." };
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !user.attivo || !valid) {
    return { error: "Credenziali non valide." };
  }

  await createSession(user);
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
