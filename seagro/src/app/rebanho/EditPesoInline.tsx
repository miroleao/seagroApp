"use client";

import { useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Weight } from "lucide-react";
import { adicionarPesagem } from "./[id]/actions";

interface Props {
  animalId: string;
  pesoAtual: number | null;
}

export function EditPesoInline({ animalId, pesoAtual }: Props) {
  const [editing, setEditing]   = useState(false);
  const [peso, setPeso]         = useState<string>("");
  const [erro, setErro]         = useState<string | null>(null);
  const formRef                 = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const router                  = useRouter();

  // Data de hoje no formato YYYY-MM-DD
  const hoje = new Date().toISOString().split("T")[0];

  function handleSave() {
    setErro(null);
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const res = await adicionarPesagem(fd);
      if (res.ok) {
        setEditing(false);
        setPeso("");
        router.refresh();
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 group">
        <span className="text-xs text-gray-600">
          {pesoAtual ? `${pesoAtual} kg` : <span className="text-gray-300">—</span>}
        </span>
        <button
          onClick={() => setEditing(true)}
          title="Registrar pesagem"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-brand-600"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={e => { e.preventDefault(); handleSave(); }} className="flex items-center gap-1">
      <input type="hidden" name="animal_id" value={animalId} />
      <input type="hidden" name="data"      value={hoje} />
      <input
        name="peso_kg"
        type="number"
        step="0.1"
        min="0"
        placeholder="kg"
        value={peso}
        onChange={e => setPeso(e.target.value)}
        autoFocus
        className="text-xs border border-gray-200 rounded-md px-2 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-brand-300"
      />
      <button
        type="submit"
        disabled={pending || !peso}
        title="Salvar pesagem"
        className="text-green-600 hover:text-green-800 disabled:opacity-40"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => { setPeso(""); setEditing(false); setErro(null); }}
        title="Cancelar"
        className="text-gray-400 hover:text-gray-600"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {erro && <span className="text-red-500 text-[10px]">{erro}</span>}
    </form>
  );
}
