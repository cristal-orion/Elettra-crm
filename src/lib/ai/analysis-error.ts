import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError } from "ai";
import { CrmError, publicError } from "../crm/commands";

/** Solo metadati e messaggi controllati: gli errori SDK possono contenere prompt e chiavi. */
export function analysisFailure(error: unknown) {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  const providerStatus = APICallError.isInstance(cause) ? cause.statusCode : undefined;
  if (providerStatus === 429) return {
    code: "AI_RATE_LIMIT", status: 429, retryAfter: 60, retryable: true, providerStatus,
    message: "Gemini ha raggiunto il limite di richieste o la quota disponibile. Attendi un minuto prima di riprovare; se continua, verifica la quota del progetto Google.",
  };
  if (providerStatus !== undefined && providerStatus >= 500) return {
    code: "AI_UNAVAILABLE", status: 503, retryAfter: 15, retryable: true, providerStatus,
    message: "Gemini è temporaneamente sovraccarico o non disponibile. Anche i tentativi automatici non sono riusciti. Attendi qualche secondo e riprova l’analisi.",
  };
  if (providerStatus === 401 || providerStatus === 403 || providerStatus === 400 || providerStatus === 404) return {
    code: "AI_CONFIGURATION", status: 502, retryAfter: 0, retryable: false, providerStatus,
    message: "Gemini ha rifiutato la richiesta. Verifica la chiave API, i permessi e il modello configurato nelle Impostazioni o con l’amministratore.",
  };
  if (cause instanceof Error && ["TimeoutError", "AbortError"].includes(cause.name)) return {
    code: "AI_TIMEOUT", status: 504, retryAfter: 0, retryable: true, providerStatus,
    message: "L’analisi è stata interrotta o ha superato il tempo disponibile. Puoi riprovare tra poco.",
  };
  if (NoObjectGeneratedError.isInstance(cause) || NoOutputGeneratedError.isInstance(cause)) return {
    code: "AI_INVALID_RESPONSE", status: 502, retryAfter: 0, retryable: true, providerStatus,
    message: "Gemini ha restituito un’analisi incompleta o in un formato non valido. Riprova l’analisi.",
  };
  if (cause instanceof CrmError) return {
    code: cause.code, status: cause.code === "NOT_FOUND" ? 404 : cause.code === "FORBIDDEN" ? 403 : cause.code === "UNAUTHORIZED" ? 401 : 400,
    retryAfter: 0, retryable: false, providerStatus, message: publicError(cause),
  };
  return {
    code: "AI_ANALYSIS_FAILED", status: 500, retryAfter: 0, retryable: true, providerStatus,
    message: "Non è stato possibile completare l’analisi della scheda. Riprova; se il problema persiste, contatta l’amministratore.",
  };
}
