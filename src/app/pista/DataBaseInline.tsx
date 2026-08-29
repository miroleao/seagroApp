"use client";

import { useState, useRef, useTransition } from "react";
import { Check, X, Pencil } from "lucide-react";
import { atualizarDataBaseExposicao } from "./actions";
import { formatDate } from "@/lib/utils";

interface Props {
  exhibitionId: string;
  dataBase: string | null;
}

export function DataBaseInline({ exhibitionId, dataBase }: Props) {
  const [editing, setEditing] = useState(false);
  const [erro, setErro]       = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(dataBase);
  const inputRef               = useRef<HTMLInputElement>(null);
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
      const res = await atualizarDataBaseExposicao(fd);
      if (res.ok) {
        setCurrent((fd.get("data_base") as string) || null);
        setEditing(false);
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span>{formatDate(current)}</span>
        <button
          type="button"
          onClick={handleOpen}
          className="text-gray-300 hover:text-brand-500 transition-colors cursor-pointer"
          title="Corrigir data-base"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={exhibitionId} />
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          name="data_base"
          type="date"
          defaultValue={current ?? ""}
          className="border border-brand-300 rounded px-2 py-0.5 text-xs
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
