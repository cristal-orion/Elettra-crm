"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireUtenti, RUOLI } from "@/lib/enums";
import { Prisma } from "@/generated/prisma";

export type UtenteState = { error?: string } | undefined;

const RUOLI_VALIDI = Object.keys(RUOLI) as [string, ...string[]];

// Password obbligatoria alla creazione, opzionale in modifica (vuota = invariata).
const BaseSchema = z.object({
  nome: z.string().trim().min(1, "Il nome è obbligatorio."),
  cognome: z.string().trim().min(1, "Il cognome è obbligatorio."),
  email: z.string().trim().toLowerCase().email("Email non valida."),
  ruolo: z.enum(RUOLI_VALIDI, { message: "Ruolo non valido." }),
  attivo: z.boolean(),
});

function estrai(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? ""),
    cognome: String(formData.get("cognome") ?? ""),
    email: String(formData.get("email") ?? ""),
    ruolo: String(formData.get("ruolo") ?? ""),
    attivo: formData.get("attivo") === "on",
    password: String(formData.get("password") ?? ""),
  };
}

export async function createUtente(
  _prev: UtenteState,
  formData: FormData,
): Promise<UtenteState> {
  const me = await requireUser();
  if (!puoGestireUtenti(me.ruolo)) {
    return { error: "Non hai i permessi per gestire gli utenti." };
  }

  const raw = estrai(formData);
  const parsed = BaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }
  if (raw.password.length < 8) {
    return { error: "La password deve avere almeno 8 caratteri." };
  }

  const { nome, cognome, email, ruolo, attivo } = parsed.data;

  try {
    await prisma.user.create({
      data: {
        nome,
        cognome,
        email,
        ruolo,
        attivo,
        passwordHash: await bcrypt.hash(raw.password, 10),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Esiste già un utente con questa email." };
    }
    return { error: "Errore nel salvataggio. Riprova." };
  }

  revalidatePath("/utenti");
  redirect("/utenti");
}

export async function updateUtente(
  userId: string,
  _prev: UtenteState,
  formData: FormData,
): Promise<UtenteState> {
  const me = await requireUser();
  if (!puoGestireUtenti(me.ruolo)) {
    return { error: "Non hai i permessi per gestire gli utenti." };
  }

  const raw = estrai(formData);
  const parsed = BaseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }
  const { nome, cognome, email, ruolo, attivo } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Utente non trovato." };

  // Sicurezza: non puoi bloccarti fuori dal tuo stesso account.
  if (userId === me.id && (!attivo || ruolo !== "SUPER_ADMIN")) {
    return {
      error: "Non puoi disattivare o declassare il tuo stesso account.",
    };
  }

  // Non lasciare il CRM senza Super Admin attivi.
  const rimuoveSuperAdmin =
    target.ruolo === "SUPER_ADMIN" &&
    target.attivo &&
    (ruolo !== "SUPER_ADMIN" || !attivo);
  if (rimuoveSuperAdmin) {
    const altriSA = await prisma.user.count({
      where: { ruolo: "SUPER_ADMIN", attivo: true, id: { not: userId } },
    });
    if (altriSA === 0) {
      return {
        error: "Deve restare almeno un Super Admin attivo.",
      };
    }
  }

  if (raw.password.length > 0 && raw.password.length < 8) {
    return { error: "La password deve avere almeno 8 caratteri." };
  }

  const data: Prisma.UserUpdateInput = { nome, cognome, email, ruolo, attivo };
  if (raw.password.length >= 8) {
    data.passwordHash = await bcrypt.hash(raw.password, 10);
  }

  try {
    await prisma.user.update({ where: { id: userId }, data });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { error: "Esiste già un utente con questa email." };
    }
    return { error: "Errore nel salvataggio. Riprova." };
  }

  revalidatePath("/utenti");
  redirect("/utenti");
}
