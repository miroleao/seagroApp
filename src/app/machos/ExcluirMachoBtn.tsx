"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { excluirMacho } from "./[id]/actions";

interface Props {
  id:   string;
  nome: string;
}

export function ExcluirMachoBtn({ id, nome }: Props) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <form action={excluirMacho} className="flex items-center gap-1">
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="text-[10px] border border-gray-200 text-gray-500 hover:bg-gray-50 px-2 py-0.5 rounded"
        >
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      title={`Excluir ${nome}`}
      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
