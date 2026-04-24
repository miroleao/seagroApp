"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Check } from "lucide-react";
import { adicionarPesagem } from "./actions";

export function FichaPesagemForm({ animalId }: { animalId: string }) {
  const [erro, setErro]    = useState<string | null>(null);
  const [salvo, setSalvo]  = useState(false);
  const [isPending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router  = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setSalvo(false);
    const fd = new FormData(formRef.current!);
    start(async () => {
      const res = await adicionarPesagem(fd);
      if (res.ok) {
        formRef.current?.reset();
        setSalvo(true);
        router.refresh();
        setTimeout(() => setSalvo(false), 2000);
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  const hoje = new Date().toISOString().split("T")[0];

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="animal_id" value={animalId} />
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Nova pesagem</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <input name="data" type="date" defaultValue={hoje} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300" />
        </div>
        <div className="w-28">
          <input name="peso_kg" type="number" step="0.1" required placeholder="Peso (kg)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300" />
        </div>
        <button type="submit" disabled={isPending}
          className="shrink-0 flex items-center gap-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs px-3 py-2 rounded-lg transition-colors">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {isPending ? "" : "Add"}
        </button>
      </div>
      <input name="observacoes" placeholder="Observações (opcional)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300" />
      {erro  && <p className="text-[10px] text-red-600">{erro}</p>}
      {salvo && <p className="text-[10px] text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Pesagem salva!</p>}
    </form>
  );
}
