/** URL condivisibili: cambiare un filtro riparte dalla prima pagina. */
export function listHref(path: string, current: string, changes: Record<string, string>, resetPage = true) {
  const params = new URLSearchParams(current);
  params.delete("esito");
  if (resetPage) params.delete("pagina");
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `${path}${params.size ? `?${params}` : ""}`;
}

export function listPage(value: string | undefined, total: number, size = 30) {
  const pages = Math.max(1, Math.ceil(total / size));
  const requested = Number(value);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
  return { page, pages, skip: (page - 1) * size, take: size };
}

export function searchTerms(value: string) {
  return [...new Set(value.slice(0, 200).normalize("NFD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("it").trim().split(/\s+/).filter(Boolean))];
}

export function queryText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

/** Un solo refuso su parole, mai su numeri/codici/email. Pattern limitato e senza input regex libero. */
export function typoPattern(term: string): string | null {
  if (!/^[a-z]{4,32}$/.test(term)) return null;
  const variants = new Set([term]);
  for (let i = 0; i < term.length; i++) {
    variants.add(term.slice(0, i) + term.slice(i + 1)); // lettera mancante nella scheda rispetto alla query
    variants.add(term.slice(0, i) + "[a-z]" + term.slice(i + 1));
    if (i + 1 < term.length) variants.add(term.slice(0, i) + term[i + 1] + term[i] + term.slice(i + 2));
  }
  for (let i = 0; i <= term.length; i++) variants.add(term.slice(0, i) + "[a-z]" + term.slice(i));
  return `\\m(${[...variants].join("|")})\\M`;
}

/** I percorsi ripristinati sono solo interni e appartengono alla lista richiesta. */
export function safeListHref(value: unknown, path: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return path;
  try {
    const url = new URL(value, "https://crm.invalid");
    return url.origin === "https://crm.invalid" && url.pathname === path ? `${url.pathname}${url.search}` : path;
  } catch { return path; }
}
