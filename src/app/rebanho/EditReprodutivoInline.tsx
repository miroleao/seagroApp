"use client";

import { useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { atualizarStatusRebanho } from "./[id]/actions";

const STATUS_OPTIONS = [
  { value: "PROTOCOLADA",    label: "Protocolada",           cls: "bg-purple-100 text-purple-700" },
  { value: "INSEMINADA",     label: "Inseminada",            cls: "bg-blue-100 text-blue-700"   },
  { value: "IMPLANTADA",     label: "Implantada c/ Embrião", cls: "bg-amber-100 text-amber-700" },
  { value: "PRENHA",         label: "Prenha",                cls: "bg-green-100 text-green-700" },
  { value: "PRENHA_EMBRIAO", label: "Prenha de Embrião",     cls: "bg-teal-100 text-teal-700"   },
  { value: "VAZIA",          label: "Vazia",                 cls: "bg-gray-100 text-gray-500"   },
  { value: "DESCARTE",       label: "Descarte",              cls: "bg-red-100 text-red-600"     },
];

function getBadge(st: string | null) {
  return STATUS_OPTIONS.find(o => o.value === st) ?? { label: "—", cls: "bg-gray-100 text-gray-400" };
}

interface Props {
  animalId: string;
  statusAtual: string | null;
}

export function EditReprodutivoInline({ animalId, statusAtual }: Props) {
  const [editing, setEditing]   = useState(false);
  const [status, setStatus]     = useState(statusAtual ?? "VAZIA");
  const [erro, setErro]         = useState<string | null>(null);
  const formRef                 = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const router                  = useRouter();

  const badge = getBadge(status);

  function handleSave() {
    setErro(null);
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const res = await atualizarStatusRebanho(fd);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5 group">
        <span className={`badge text-[11px] ${badge.cls}`}>{badge.label}</span>
        <button
          onClick={() => setEditing(true)}
          title="Editar status"
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
      <select
        name="status_rebanho"
        value={status}
        onChange={e => setStatus(e.target.value)}
        className="text-xs border border-gray-200 rounded-md px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white"
        autoFocus
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        title="Salvar"
        className="text-green-600 hover:text-green-800 disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => { setStatus(statusAtual ?? "VAZIA"); setEditing(false); setErro(null); }}
        title="Cancelar"
        className="text-gray-400 hover:text-gray-600"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {erro && <span className="text-red-500 text-[10px]">{erro}</span>}
    </form>
  );
}
