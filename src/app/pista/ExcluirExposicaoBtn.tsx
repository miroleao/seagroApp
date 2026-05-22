"use client";

import { Trash2 } from "lucide-react";
import { excluirExposicao } from "./actions";

export function ExcluirExposicaoBtn({ id, nome }: { id: string; nome: string }) {
  return (
    <form
      action={excluirExposicao}
      onSubmit={(e) => {
        if (!confirm(`Excluir "${nome}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
        title="Excluir exposição"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
