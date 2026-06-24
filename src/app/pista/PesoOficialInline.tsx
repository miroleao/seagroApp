"use client";

import { useState, useRef, useTransition } from "react";
import { Scale, Check, X, Pencil } from "lucide-react";
import { salvarPesoPista } from "./actions";

interface Props {
  animalId: string;
  pesoPista: number | null;
}

export function PesoOficialInline({ animalId, pesoPista }: Props) {
  const [editing, setEditing]   = useState(false);
  const [erro, setErro]         = useState<string | null>(null);
  const [current, setCurrent]   = useState<number | null>(pesoPista);
  const inputRef                = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setEditing(true);
    setErro(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  function handleCancel() {
    setEditing(false);
    setErro(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await salvarPesoPista(fd);
      if (res.ok) {
        const raw = fd.get("peso_pista") as string;
        setCurrent(raw ? parseFloat(raw.replace(",", ".")) : null);
        setEditing(false);
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 min-w-[90px]">
        {current != null ? (
          <>
            <span className="text-xs font-semibold text-gray-800">{current} kg</span>
            <button
              type="button"
              onClick={handleOpen}
              className="text-gray-300 hover:text-brand-500 transition-colors cursor-pointer"
              title="Editar peso oficial"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-600
                       border border-dashed border-gray-300 hover:border-brand-400
                       px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            <Scale className="w-3 h-3" /> Inserir peso
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1 min-w-[110px]">
      <input type="hidden" name="animal_id" value={animalId} />
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          name="peso_pista"
          type="number"
          step="0.1"
          min="1"
          max="1200"
          defaultValue={current ?? ""}
          placeholder="kg"
          className="w-20 border border-brand-300 rounded px-2 py-0.5 text-xs
                     focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="text-green-600 hover:text-green-700 disabled:opacity-50 cursor-pointer"
          title="Salvar"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-600 cursor-pointer"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {erro && <p className="text-[10px] text-red-600">{erro}</p>}
    </form>
  );
}
