"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Heart, Dna, Beef, Trophy, DollarSign, Baby } from "lucide-react";
import { buscaGlobal, type ResultadoBusca } from "./actions";

const ICONES: Record<string, React.ElementType> = {
  animal:    Beef,
  exposicao: Trophy,
  transacao: DollarSign,
  prenhez:   Baby,
};

const TIPO_LABELS: Record<string, string> = {
  animal:    "Animal",
  exposicao: "Exposição",
  transacao: "Transação",
  prenhez:   "Prenhez",
};

export function BuscaGlobal() {
  const [q, setQ]             = useState("");
  const [aberta, setAberta]   = useState(false);
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [isPending, start]    = useTransition();
  const inputRef              = useRef<HTMLInputElement>(null);
  const containerRef          = useRef<HTMLDivElement>(null);
  const router                = useRouter();
  const debounce              = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberta(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(v: string) {
    setQ(v);
    clearTimeout(debounce.current);
    if (v.trim().length < 2) { setResultados([]); setAberta(false); return; }
    debounce.current = setTimeout(() => {
      start(async () => {
        const res = await buscaGlobal(v);
        setResultados(res);
        setAberta(true);
      });
    }, 300);
  }

  function handleSelect(r: ResultadoBusca) {
    setAberta(false);
    setQ("");
    router.push(r.href);
  }

  function handleClear() {
    setQ("");
    setResultados([]);
    setAberta(false);
    inputRef.current?.focus();
  }

  // Teclado: Esc fecha, Enter navega para o primeiro resultado
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setAberta(false); setQ(""); }
    if (e.key === "Enter" && resultados.length > 0) handleSelect(resultados[0]);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => resultados.length > 0 && setAberta(true)}
          placeholder="Buscar animal, leilão, prenhez…"
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-all"
        />
        {isPending
          ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          : q && <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
        }
      </div>

      {/* Dropdown de resultados */}
      {aberta && resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
              {resultados.length} resultado(s) para "{q}"
            </p>
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {resultados.map((r) => {
              const Icon = ICONES[r.tipo] ?? Search;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-50 transition-colors cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-gray-100 shrink-0">
                      <Icon className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                      <p className="text-xs text-gray-400 truncate">{r.sub}</p>
                    </div>
                    <span className="text-[10px] text-gray-300 shrink-0">{TIPO_LABELS[r.tipo]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {aberta && q.trim().length >= 2 && resultados.length === 0 && !isPending && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 px-4 py-6 text-center">
          <Search className="w-6 h-6 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhum resultado para "{q}"</p>
        </div>
      )}
    </div>
  );
}
