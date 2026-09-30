export function passwordError(password: string): string | null {
  if (password.length < 12) return "La password deve avere almeno 12 caratteri.";
  if (new TextEncoder().encode(password).length > 72) return "La password non può superare 72 byte.";
  return null;
}
