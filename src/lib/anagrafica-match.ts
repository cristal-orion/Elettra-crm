/** Segnali consultivi: non modificano dati né sostituiscono il controllo fiscale al salvataggio. */
export type AnagraficaMatchInput = {
  ragioneSociale: string; partitaIva: string; codiceFiscale: string; email: string; telefono: string;
};
export const MATCH_REASONS = {
  partitaIva: "Stessa partita IVA",
  codiceFiscale: "Stesso codice fiscale",
  nome: "Ragione sociale simile",
  email: "Stessa email aziendale o di un referente",
  telefono: "Stesso telefono aziendale o di un referente",
} as const;
export type AnagraficaMatch = {
  id: string; ragioneSociale: string; codiceCliente: string | null; codiceFornitore: string | null;
  localita: string | null; partitaIva: string | null; codiceFiscale: string | null;
  motivi: (keyof typeof MATCH_REASONS)[];
};
export type AnagraficaMatches = { candidati: AnagraficaMatch[]; altri: boolean };

export function duplicateSignals(input: AnagraficaMatchInput) {
  const name = input.ragioneSociale.slice(0, 300).normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    .replace(/\b(?:s\s*r\s*l\s*s?|s\s*p\s*a|s\s*n\s*c|s\s*a\s*s)$/, "").trim();
  const terms = [...new Set(name.split(/\s+/).filter(Boolean))];
  const fiscal = (value: string) => value.trim().length >= 5 ? value.trim().toUpperCase() : "";
  const email = input.email.trim().toLowerCase();
  const phone = input.telefono.replace(/\D/g, "").replace(/^00/, "");
  return {
    terms: name.replace(/\s/g, "").length >= 4 ? terms : [],
    partitaIva: fiscal(input.partitaIva), codiceFiscale: fiscal(input.codiceFiscale),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
    telefono: phone.length >= 7 ? phone : "",
  };
}
export function hasDuplicateSignals(input: AnagraficaMatchInput) {
  const s = duplicateSignals(input);
  return Boolean(s.terms.length || s.partitaIva || s.codiceFiscale || s.email || s.telefono);
}
