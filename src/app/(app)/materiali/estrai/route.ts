import { getCurrentUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { isAiConfigured } from "@/lib/ai";
import { estraiDaScheda, schedaToFormValues } from "@/lib/ai-scheda";

const MAX_BYTES = 20 * 1024 * 1024;

/** Estrazione dati da scheda tecnica PDF per il form "Nuovo materiale".
 *  Ritorna i campi precompilati come JSON; il PDF NON viene salvato qui —
 *  resta nel form e sarà allegato al submit di creazione. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autenticato", { status: 401 });
  if (!puoGestireCatalogo(user.ruolo)) {
    return new Response("Permessi insufficienti", { status: 403 });
  }
  if (!(await isAiConfigured())) {
    return new Response("Assistente AI non configurato.", { status: 503 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("scheda");
  } catch {
    return new Response("Richiesta non valida", { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return new Response("Carica un PDF.", { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return new Response("Il file deve essere un PDF.", { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response("Il PDF supera i 20 MB.", { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dati = schedaToFormValues(await estraiDaScheda(bytes));
    if (!dati.descrizione) {
      return new Response(
        "Non sono riuscito a leggere una descrizione dalla scheda. Compila i campi a mano.",
        { status: 422 },
      );
    }
    return Response.json(dati);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Estrazione fallita: ${msg.slice(0, 200)}`, { status: 500 });
  }
}
