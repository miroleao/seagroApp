"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays, X } from "lucide-react";

/**
 * Filtro por período da transferência de embrião.
 * Considera a T.E. da prenhez ativa ou, para paridas, a do histórico.
 */
export function FiltroDataTE() {
  const router = useRouter();
  const params = useSearchParams();

  const [de,  setDe]  = useState(params.get("teDe")  ?? "");
  const [ate, setAte] = useState(params.get("teAte") ?? "");

  const ativo = !!(params.get("teDe") || params.get("teAte"));

  function aplicar(novoDe: string, novoAte: string) {
    const p = new URLSearchParams(params.toString());
    novoDe  ? p.set("teDe",  novoDe)  : p.delete("teDe");
    novoAte ? p.set("teAte", novoAte) : p.delete("teAte");
    router.push(`/rebanho?${p.toString()}`, { scroll: false });
  }

  function limpar() {
    setDe(""); setAte("");
    aplicar("", "");
  }

  return (
    <div className="flex items-center gap-1.5">
      <CalendarDays className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span className="text-[10px] text-gray-400 uppercase tracking-wide hidden sm:inline">T.E.</span>
      <input
        type="date"
        value={de}
        onChange={(e) => { setDe(e.target.value); aplicar(e.target.value, ate); }}
        title="T.E. a partir de"
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white"
      />
      <span className="text-gray-300 text-xs">–</span>
      <input
        type="date"
        value={ate}
        onChange={(e) => { setAte(e.target.value); aplicar(de, e.target.value); }}
        title="T.E. até"
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white"
      />
      {ativo && (
        <button onClick={limpar} title="Limpar período" className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
