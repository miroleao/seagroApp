"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { atualizarStatusRebanho } from "./actions";

const STATUS_OPCOES = [
  { value: "VAZIA",          label: "Vazia"                },
  { value: "PROTOCOLADA",    label: "Protocolada"          },
  { value: "INSEMINADA",     label: "Inseminada"           },
  { value: "IMPLANTADA",     label: "Implantada c/ Embrião"},
  { value: "PRENHA",         label: "Prenha"               },
  { value: "PRENHA_EMBRIAO", label: "Prenha de Embrião"    },
  { value: "DESCARTE",       label: "Descarte"             },
];

export function FichaStatusForm({
  animalId, statusAtual, situacaoAtual,
}: {
  animalId: string;
  statusAtual: string | null;
  situacaoAtual: string | null;
}) {
  const [status, setStatus] = useState(statusAtual ?? "VAZIA");
  const [salvo, setSalvo]   = useState(false);
  const [erro, setErro]     = useState<string | null>(null);
  const [isPending, start]  = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setSalvo(false);
    const fd = new FormData(formRef.current!);
    start(async () => {
      const res = await atualizarStatusRebanho(fd);
      if (res.ok) { setSalvo(true); router.refresh(); setTimeout(() => setSalvo(false), 2000); }
      else setErro(res.erro ?? "Erro ao salvar");
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="animal_id" value={animalId} />

      <div>
        <label className="text-xs text-gray-500 block mb-1">Status Reprodutivo</label>
        <select name="status_rebanho" value={status} onChange={e => setStatus(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
          {STATUS_OPCOES.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Observações</label>
        <textarea name="observacoes" rows={2} defaultValue={situacaoAtual ?? ""}
          placeholder="Ex: Protocolo iniciado em 10/04, TE previsto para 18/04…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
      </div>

      {erro && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{erro}</p>}
      {salvo && (
        <p className="text-xs text-green-600 bg-green-50 rounded px-2 py-1 flex items-center gap-1">
          <Check className="w-3 h-3" /> Salvo!
        </p>
      )}

      <button type="submit" disabled={isPending}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {isPending ? "Salvando…" : "Atualizar Status"}
      </button>
    </form>
  );
}
