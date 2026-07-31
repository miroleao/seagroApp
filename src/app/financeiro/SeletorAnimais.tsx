"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Search, X, Link2 } from "lucide-react";

export type AnimalOpt = {
  id: string;
  nome: string;
  rgn: string | null;
  tipo: string;
  tipoLabel: string;
};

/**
 * Seletor de animais já cadastrados para vincular a um lançamento financeiro.
 * Emite um `<input name="animal_ids" />` por animal selecionado — o Server Action
 * lê com `formData.getAll("animal_ids")`.
 */
export function SeletorAnimais({
  animais,
  name = "animal_ids",
  onChange,
}: {
  animais: AnimalOpt[];
  name?: string;
  onChange?: (ids: string[]) => void;
}) {
  const [busca, setBusca]         = useState("");
  const [aberto, setAberto]       = useState(false);
  const [selecionados, setSel]    = useState<AnimalOpt[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { onChange?.(selecionados.map(s => s.id)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selecionados]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aberto]);

  const jaSelecionado = useMemo(
    () => new Set(selecionados.map(s => s.id)),
    [selecionados]
  );

  const resultados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return animais
      .filter(a => !jaSelecionado.has(a.id))
      .filter(a =>
        !q ||
        a.nome?.toLowerCase().includes(q) ||
        a.rgn?.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [busca, animais, jaSelecionado]);

  function adicionar(a: AnimalOpt) {
    setSel(prev => [...prev, a]);
    setBusca("");
  }

  function remover(id: string) {
    setSel(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Inputs escondidos para o Server Action */}
      {selecionados.map(s => (
        <input key={s.id} type="hidden" name={name} value={s.id} />
      ))}

      {/* Chips selecionados */}
      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {selecionados.map(s => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 bg-brand-50 border border-brand-200 text-brand-700 rounded-md pl-2 pr-1 py-0.5 text-xs"
            >
              {s.nome}
              <span className="text-[9px] text-brand-400">{s.tipoLabel}</span>
              <button
                type="button"
                onClick={() => remover(s.id)}
                className="p-0.5 rounded hover:bg-brand-100"
                aria-label={`Remover ${s.nome}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Campo de busca */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          placeholder={selecionados.length > 0 ? "Vincular mais um…" : "Buscar animal cadastrado…"}
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      {/* Resultados */}
      {aberto && resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {resultados.map(a => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => adicionar(a)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
              >
                <Link2 className="w-3 h-3 text-gray-300 shrink-0" />
                <span className="text-sm text-gray-900 truncate">{a.nome}</span>
                {a.rgn && <span className="text-[10px] font-mono text-gray-400 shrink-0">{a.rgn}</span>}
                <span className="text-[10px] text-gray-400 ml-auto shrink-0">{a.tipoLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && busca.trim() && resultados.length === 0 && (
        <p className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-gray-400 shadow-lg">
          Nenhum animal cadastrado com esse nome. Você ainda pode digitar o nome livre no campo ao lado.
        </p>
      )}
    </div>
  );
}
