"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, X, RotateCcw } from "lucide-react";

/**
 * Painel recolhível com todos os filtros do rebanho.
 *
 * Estado vive na URL — o filtro é aplicado no servidor, o link é
 * compartilhável e sobrevive a refresh. O painel só monta o rascunho
 * e aplica de uma vez, evitando um round-trip por campo.
 */

const STATUS_OPTIONS = [
  { value: "PROTOCOLADA",    label: "Protocolada"           },
  { value: "INSEMINADA",     label: "Inseminada"            },
  { value: "IMPLANTADA",     label: "Implantada c/ Embrião" },
  { value: "PRENHA",         label: "Prenha"                },
  { value: "PRENHA_EMBRIAO", label: "Prenha de Embrião"     },
  { value: "PARIDA",         label: "Parida"                },
  { value: "VAZIA",          label: "Vazia"                 },
  { value: "DESCARTE",       label: "Descarte"              },
];

const CLS_OPTIONS = [
  { value: "RECEPTORA", label: "Receptoras" },
  { value: "RECRIA",    label: "Recria"     },
  { value: "DESCARTE",  label: "Descarte"   },
  { value: "OUTRO",     label: "Outros"     },
];

const SEXAGEM_OPTIONS = [
  { value: "FEMEA",      label: "Fêmea"      },
  { value: "MACHO",      label: "Macho"      },
  { value: "NAO_SEXADO", label: "Não sexado" },
];

/** Parâmetros controlados por este painel — usados para contar e limpar. */
const CAMPOS = ["st", "cls", "doadora", "touro", "local", "sex", "teDe", "teAte", "ppDe", "ppAte"] as const;
type Campo = (typeof CAMPOS)[number];

const selCls =
  "w-full text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand-300";
const labelCls =
  "text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block";

export function PainelFiltros({
  doadoras, touros, localizacoes,
}: {
  doadoras: string[];
  touros: string[];
  localizacoes: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);

  // O card do rebanho tem `overflow-hidden`, que recortava o painel absoluto.
  // Posicionamento fixo calculado a partir do botão resolve — mesmo padrão
  // já usado no VincularDropdown do financeiro.
  function abrir() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setAberto(o => !o);
  }

  const valorAtual = (c: Campo) => params.get(c) ?? "";
  const [rascunho, setRascunho] = useState<Record<Campo, string>>(
    () => Object.fromEntries(CAMPOS.map(c => [c, ""])) as Record<Campo, string>
  );

  // Ressincroniza ao abrir — a URL pode ter mudado por outro controle
  useEffect(() => {
    if (aberto) {
      setRascunho(
        Object.fromEntries(CAMPOS.map(c => [c, params.get(c) ?? ""])) as Record<Campo, string>
      );
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [aberto]);

  // Fecha ao clicar fora ou com Esc
  useEffect(() => {
    if (!aberto) return;
    function clique(e: MouseEvent) {
      const alvo = e.target as Node;
      if (wrapRef.current?.contains(alvo)) return;
      if (painelRef.current?.contains(alvo)) return;   // painel vive fora do wrapper
      setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  // Painel é `fixed`: reposiciona junto com scroll e resize
  useEffect(() => {
    if (!aberto) return;
    function reposicionar() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    window.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      window.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [aberto]);

  const ativos = CAMPOS.filter(c => !!valorAtual(c)).length;

  function set(c: Campo, v: string) {
    setRascunho(prev => ({ ...prev, [c]: v }));
  }

  function aplicar() {
    const p = new URLSearchParams(params.toString());
    for (const c of CAMPOS) {
      rascunho[c] ? p.set(c, rascunho[c]) : p.delete(c);
    }
    router.push(`/rebanho?${p.toString()}`, { scroll: false });
    setAberto(false);
  }

  function limparTudo() {
    const p = new URLSearchParams(params.toString());
    for (const c of CAMPOS) p.delete(c);
    setRascunho(Object.fromEntries(CAMPOS.map(c => [c, ""])) as Record<Campo, string>);
    router.push(`/rebanho?${p.toString()}`, { scroll: false });
    setAberto(false);
  }

  return (
    <div ref={wrapRef} className="flex items-center gap-1.5">
      <button
        ref={btnRef}
        onClick={abrir}
        className={`inline-flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors ${
          ativos > 0
            ? "border-brand-300 bg-brand-50 text-brand-700 font-medium"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        <Filter className="w-3.5 h-3.5 shrink-0" />
        Filtros
        {ativos > 0 && (
          <span className="text-[10px] font-bold bg-brand-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
            {ativos}
          </span>
        )}
      </button>

      {/* Limpar sem precisar abrir o painel */}
      {ativos > 0 && (
        <button
          onClick={limparTudo}
          title="Limpar todos os filtros"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 border border-transparent hover:border-red-200 rounded-lg px-2 py-1.5 transition-colors"
        >
          <X className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Limpar</span>
        </button>
      )}

      {aberto && (
        <div
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-[min(92vw,34rem)] max-h-[80vh] flex flex-col bg-white border border-gray-200 rounded-xl shadow-xl"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
            <Filter className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="text-sm font-semibold text-gray-900">Filtrar rebanho</span>
            <button onClick={() => setAberto(false)}
              className="ml-auto p-1 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto flex-1 min-h-0">
            <div>
              <label className={labelCls}>Situação reprodutiva</label>
              <select value={rascunho.st} onChange={e => set("st", e.target.value)} className={selCls}>
                <option value="">Todas</option>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Classificação</label>
              <select value={rascunho.cls} onChange={e => set("cls", e.target.value)} className={selCls}>
                <option value="">Todas</option>
                {CLS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Doadora</label>
              <select value={rascunho.doadora} onChange={e => set("doadora", e.target.value)} className={selCls}>
                <option value="">Todas</option>
                {doadoras.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Touro</label>
              <select value={rascunho.touro} onChange={e => set("touro", e.target.value)} className={selCls}>
                <option value="">Todos</option>
                {touros.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Localização</label>
              <select value={rascunho.local} onChange={e => set("local", e.target.value)} className={selCls}>
                <option value="">Todas</option>
                {localizacoes.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Sexagem do embrião</label>
              <select value={rascunho.sex} onChange={e => set("sex", e.target.value)} className={selCls}>
                <option value="">Todas</option>
                {SEXAGEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>T.E. — de</label>
                <input type="date" value={rascunho.teDe} onChange={e => set("teDe", e.target.value)} className={selCls} />
              </div>
              <div>
                <label className={labelCls}>T.E. — até</label>
                <input type="date" value={rascunho.teAte} onChange={e => set("teAte", e.target.value)} className={selCls} />
              </div>
            </div>

            <div className="sm:col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Prev. parto — de</label>
                <input type="date" value={rascunho.ppDe} onChange={e => set("ppDe", e.target.value)} className={selCls} />
              </div>
              <div>
                <label className={labelCls}>Prev. parto — até</label>
                <input type="date" value={rascunho.ppAte} onChange={e => set("ppAte", e.target.value)} className={selCls} />
              </div>
            </div>

            <p className="sm:col-span-2 text-[10px] text-gray-400">
              Filtros de doadora, touro, sexagem e datas consideram a prenhez ativa ou,
              para paridas, o histórico. Animal sem esse dado sai da lista quando o
              filtro correspondente está ativo.
            </p>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 shrink-0 bg-white rounded-b-xl">
            <button
              onClick={limparTudo}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <RotateCcw className="w-3 h-3" /> Limpar tudo
            </button>
            <button
              onClick={aplicar}
              className="ml-auto bg-brand-600 hover:bg-brand-700 text-white text-sm px-5 py-2 rounded-lg transition-colors font-medium"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
