"use client";

import { useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { atualizarRgnReceptora } from "./actions";

interface Props {
  animalId: string;
  rgnAtual: string | null;
}

export function EditRgnInline({ animalId, rgnAtual }: Props) {
  const [editing, setEditing] = useState(false);
  const [rgn, setRgn]         = useState(rgnAtual ?? "");
  const [erro, setErro]       = useState<string | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const router                = useRouter();

  function handleSave() {
    setErro(null);
    const fd = new FormData();
    fd.set("animal_id", animalId);
    fd.set("rgn", rgn.trim());
    startTransition(async () => {
      const res = await atualizarRgnReceptora(fd);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  function handleCancel() {
    setRgn(rgnAtual ?? "");
    setEditing(false);
    setErro(null);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 group">
        {rgn
          ? <span className="font-mono text-[11px] text-gray-600">{rgn}</span>
          : <span className="text-gray-300 text-[11px]">—</span>
        }
        <button
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          title="Editar # ABCZ"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-brand-600"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={rgn}
        onChange={e => setRgn(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
        placeholder="Nº ABCZ…"
        className="w-32 text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-300 font-mono"
        autoFocus
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        title="Salvar"
        className="text-green-600 hover:text-green-800 disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={handleCancel}
        title="Cancelar"
        className="text-gray-400 hover:text-gray-600"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {erro && <span className="text-red-500 text-[10px]">{erro}</span>}
    </div>
  );
}
