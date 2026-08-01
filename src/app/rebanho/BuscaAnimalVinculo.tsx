"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Check } from "lucide-react";

type AnimalHit = {
  id: string;
  nome: string;
  tipo: string;
  rgn: string | null;
  rgd: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora",
  NASCIDO: "Nascido", DESCARTE: "Descarte",
};

/**
 * Autocomplete de animais já cadastrados, para vincular como cria de um parto.
 * Emite `bezerro_existente_id` e `bezerro_sexo` (derivado do tipo do animal),
 * lidos pelo Server Action `registrarDesfechoUnificado`.
 */
export function BuscaAnimalVinculo() {
  const [busca, setBusca]           = useState("");
  const [hits, setHits]             = useState<AnimalHit[]>([]);
  const [selecionado, setSelec]     = useState<AnimalHit | null>(null);
  const [carregando, setCarregando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const termo = busca.trim();
    if (selecionado || termo.length < 2) { setHits([]); return; }

    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setCarregando(true);
      try {
        const r = await fetch(`/api/animais/buscar?q=${encodeURIComponent(termo)}`, { signal: ctrl.signal });
        setHits(r.ok ? await r.json() : []);
      } catch {
        /* abortado ou offline — silencioso */
      } finally {
        setCarregando(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [busca, selecionado]);

  // Sexo derivado do tipo: TOURO é macho, o resto é fêmea.
  const sexoDerivado = selecionado
    ? (selecionado.tipo === "TOURO" ? "M" : "F")
    : "";

  if (selecionado) {
    return (
      <div className="space-y-1">
        <input type="hidden" name="bezerro_existente_id" value={selecionado.id} />
        <input type="hidden" name="bezerro_sexo"         value={sexoDerivado} />
        <div className="flex items-center gap-1.5 border border-brand-200 bg-brand-50 rounded-lg px-2 py-1.5">
          <Check className="w-3 h-3 text-brand-600 shrink-0" />
          <span className="text-xs font-medium text-gray-900 truncate">{selecionado.nome}</span>
          <span className="text-[9px] text-gray-400 shrink-0">
            {TIPO_LABEL[selecionado.tipo] ?? selecionado.tipo}
          </span>
          <button
            type="button"
            onClick={() => { setSelec(null); setBusca(""); }}
            className="ml-auto p-0.5 rounded text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Trocar animal"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[9px] text-gray-400">
          Sexo: {sexoDerivado === "M" ? "Macho" : "Fêmea"} · vem do cadastro do animal
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="w-3 h-3 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar animal cadastrado…"
        autoComplete="off"
        className="w-full border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
      />

      {carregando && (
        <p className="text-[9px] text-gray-400 mt-1">buscando…</p>
      )}

      {hits.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
          {hits.map(a => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setSelec(a)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 flex items-center gap-1.5"
              >
                <span className="text-xs text-gray-900 truncate">{a.nome}</span>
                {(a.rgn || a.rgd) && (
                  <span className="text-[9px] font-mono text-gray-400 shrink-0">{a.rgn ?? a.rgd}</span>
                )}
                <span className="text-[9px] text-gray-400 ml-auto shrink-0">
                  {TIPO_LABEL[a.tipo] ?? a.tipo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {busca.trim().length >= 2 && !carregando && hits.length === 0 && (
        <p className="text-[9px] text-gray-400 mt-1">Nenhum animal encontrado.</p>
      )}
    </div>
  );
}
