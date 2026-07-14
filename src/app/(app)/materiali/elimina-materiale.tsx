"use client";

import { deleteProdotto } from "./actions";

export default function EliminaMateriale({ id }: { id: string }) {
  return (
    <form
      action={deleteProdotto.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm("Eliminare questo materiale dal catalogo? Lo storico degli acquisti resta.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-line px-4 py-2.5 text-sm text-danger transition hover:bg-danger-soft"
      >
        Elimina
      </button>
    </form>
  );
}
