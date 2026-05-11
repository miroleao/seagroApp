"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Download, Search } from "lucide-react";

// ─── tipos ────────────────────────────────────────────────────────────────────
interface AnimalGenealogia {
  id: string;
  nome: string;
  tipo: string;
  rgn?: string;
  pai_nome?: string;
  mae_nome?: string;
  avo_paterno?: string;
  avo_paterna?: string;
  avo_materno?: string;
  avo_materna?: string;
  bisavo_pat_pat?: string;
  bisava_pat_pat?: string;
  bisavo_pat_mat?: string;
  bisava_pat_mat?: string;
  bisavo_materno?: string;
  bisava_mat_pat?: string;
  bisavo_materna?: string;
  bisavo?: string;
}

export interface GenealogyValues {
  pai_nome: string;
  mae_nome: string;
  avo_paterno: string;
  avo_paterna: string;
  avo_materno: string;
  avo_materna: string;
  bisavo_pat_pat: string;
  bisava_pat_pat: string;
  bisavo_pat_mat: string;
  bisava_pat_mat: string;
  bisavo_materno: string;
  bisava_mat_pat: string;
  bisavo_materna: string;
  bisavo: string;
}

const EMPTY: GenealogyValues = {
  pai_nome: "", mae_nome: "",
  avo_paterno: "", avo_paterna: "",
  avo_materno: "", avo_materna: "",
  bisavo_pat_pat: "", bisava_pat_pat: "",
  bisavo_pat_mat: "", bisava_pat_mat: "",
  bisavo_materno: "", bisava_mat_pat: "",
  bisavo_materna: "", bisavo: "",
};

// ─── hook de busca com debounce ───────────────────────────────────────────────
function useBuscarAnimais(q: string) {
  const [resultados, setResultados] = useState<AnimalGenealogia[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.length < 2) { setResultados([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/animais/buscar?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResultados(Array.isArray(data) ? data : []);
      } catch { setResultados([]); }
      finally { setCarregando(false); }
    }, 280);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  return { resultados, carregando };
}

// ─── badge de tipo ────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora",
  NASCIDO: "Nascido", DESCARTE: "Descarte",
};
const TIPO_COLOR: Record<string, string> = {
  DOADORA: "bg-purple-50 text-purple-600",
  TOURO: "bg-blue-50 text-blue-600",
  RECEPTORA: "bg-pink-50 text-pink-600",
};

// ─── item de resultado ────────────────────────────────────────────────────────
function ResultItem({
  animal,
  onSelect,
}: {
  animal: AnimalGenealogia;
  onSelect: (a: AnimalGenealogia) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(animal)}
      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-2 border-b border-gray-50 last:border-0"
    >
      <div>
        <p className="text-sm font-medium text-gray-800">{animal.nome}</p>
        {(animal.pai_nome || animal.mae_nome) && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            {animal.pai_nome && `♂ ${animal.pai_nome}`}
            {animal.pai_nome && animal.mae_nome && " · "}
            {animal.mae_nome && `♀ ${animal.mae_nome}`}
          </p>
        )}
      </div>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${TIPO_COLOR[animal.tipo] ?? "bg-gray-50 text-gray-500"}`}>
        {TIPO_LABEL[animal.tipo] ?? animal.tipo}
      </span>
    </button>
  );
}

// ─── input com autocomplete ───────────────────────────────────────────────────
function AutocompleteInput({
  name, label, value, placeholder, onValueChange, onAnimalSelect, autoFilled,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
  onValueChange: (v: string) => void;
  onAnimalSelect: (a: AnimalGenealogia) => void;
  autoFilled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [inputQ, setInputQ] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resultados, carregando } = useBuscarAnimais(inputQ);

  useEffect(() => { setInputQ(value); }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setAberto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleChange = (v: string) => {
    setInputQ(v);
    onValueChange(v);
    setAberto(v.length >= 2);
  };

  const handleSelect = (a: AnimalGenealogia) => {
    setInputQ(a.nome);
    onValueChange(a.nome);
    onAnimalSelect(a);
    setAberto(false);
  };

  const borderClass = autoFilled
    ? "border-green-200 bg-green-50/40 focus:ring-green-300"
    : "border-gray-200 focus:ring-brand-300";

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
        {label}
        {autoFilled && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
            preenchido automaticamente
          </span>
        )}
      </label>
      <div className="relative">
        <input
          name={name}
          type="text"
          value={inputQ}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => inputQ.length >= 2 && setAberto(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 ${borderClass}`}
        />
        {inputQ && (
          <button
            type="button"
            onClick={() => handleChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {aberto && (resultados.length > 0 || carregando) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-auto">
          {carregando && <div className="px-3 py-2 text-xs text-gray-400">Buscando…</div>}
          {resultados.map((a) => (
            <ResultItem key={a.id} animal={a} onSelect={handleSelect} />
          ))}
          {!carregando && resultados.length === 0 && inputQ.length >= 2 && (
            <div className="px-3 py-2 text-xs text-gray-400">Nenhum animal encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── modal de importação completa ────────────────────────────────────────────
function ModalImportar({
  onImportar,
  onFechar,
}: {
  onImportar: (a: AnimalGenealogia) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const { resultados, carregando } = useBuscarAnimais(busca);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Copiar genealogia completa</h3>
            <p className="text-xs text-gray-400 mt-0.5">Útil para irmãos — copia pai, mãe, avós e bisavós de outro animal</p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-300 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o nome do animal…"
              autoFocus
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
        </div>
        <div className="px-5 pb-5 max-h-64 overflow-auto space-y-1">
          {!carregando && busca.length < 2 && (
            <p className="text-xs text-gray-400 py-2">Digite pelo menos 2 caracteres para buscar</p>
          )}
          {carregando && <p className="text-xs text-gray-400 py-2">Buscando…</p>}
          {resultados.map((a) => {
            const temGenealogia = !!(a.pai_nome || a.mae_nome);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onImportar(a)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-2 border border-gray-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.nome}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {TIPO_LABEL[a.tipo] ?? a.tipo}
                    {a.rgn && ` · ${a.rgn}`}
                    {temGenealogia
                      ? <span className="ml-1 text-green-500">· genealogia disponível</span>
                      : <span className="ml-1 text-gray-300">· sem genealogia</span>
                    }
                  </p>
                </div>
                <Download className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              </button>
            );
          })}
          {!carregando && busca.length >= 2 && resultados.length === 0 && (
            <p className="text-xs text-gray-400 py-2">Nenhum animal encontrado</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function GenealogyForm({
  initialValues,
}: {
  initialValues?: Partial<GenealogyValues>;
}) {
  const [vals, setVals] = useState<GenealogyValues>({ ...EMPTY, ...initialValues });
  const [modalAberto, setModalAberto] = useState(false);

  // controla quais campos foram auto-preenchidos (para highlight verde)
  const [autoFilled, setAutoFilled] = useState<Partial<Record<keyof GenealogyValues, boolean>>>({});

  const set = useCallback((patch: Partial<GenealogyValues>, autoFilledKeys?: (keyof GenealogyValues)[]) => {
    setVals((v) => ({ ...v, ...patch }));
    if (autoFilledKeys) {
      setAutoFilled((prev) => {
        const next = { ...prev };
        autoFilledKeys.forEach((k) => { next[k] = true; });
        return next;
      });
    }
  }, []);

  const clearAutoFilled = useCallback((...keys: (keyof GenealogyValues)[]) => {
    setAutoFilled((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { delete next[k]; });
      return next;
    });
  }, []);

  // ── Pai → avós paternos + bisavós paternos ──────────────────────────────────
  const handlePaiSelect = useCallback((a: AnimalGenealogia) => {
    set({
      pai_nome:       a.nome,
      avo_paterno:    a.pai_nome    ?? "",
      avo_paterna:    a.mae_nome    ?? "",
      bisavo_pat_pat: a.avo_paterno ?? "",
      bisava_pat_pat: a.avo_paterna ?? "",
      bisavo_pat_mat: a.avo_materno ?? "",
      bisava_pat_mat: a.avo_materna ?? "",
    }, ["avo_paterno", "avo_paterna", "bisavo_pat_pat", "bisava_pat_pat", "bisavo_pat_mat", "bisava_pat_mat"]);
  }, [set]);

  // ── Mãe → avós maternos + bisavós maternos ─────────────────────────────────
  const handleMaeSelect = useCallback((a: AnimalGenealogia) => {
    set({
      mae_nome:       a.nome,
      avo_materno:    a.pai_nome    ?? "",
      avo_materna:    a.mae_nome    ?? "",
      bisavo_materno: a.avo_paterno ?? "",
      bisava_mat_pat: a.avo_paterna ?? "",
      bisavo_materna: a.avo_materno ?? "",
      bisavo:         a.avo_materna ?? "",
    }, ["avo_materno", "avo_materna", "bisavo_materno", "bisava_mat_pat", "bisavo_materna", "bisavo"]);
  }, [set]);

  // ── Avô Paterno → bisavós do avô paterno ───────────────────────────────────
  const handleAvoPatSelect = useCallback((a: AnimalGenealogia) => {
    set({
      avo_paterno:    a.nome,
      bisavo_pat_pat: a.pai_nome ?? "",
      bisava_pat_pat: a.mae_nome ?? "",
    }, ["bisavo_pat_pat", "bisava_pat_pat"]);
  }, [set]);

  // ── Avó Paterna → bisavós da avó paterna ────────────────────────────────────
  const handleAvoPatMatSelect = useCallback((a: AnimalGenealogia) => {
    set({
      avo_paterna:    a.nome,
      bisavo_pat_mat: a.pai_nome ?? "",
      bisava_pat_mat: a.mae_nome ?? "",
    }, ["bisavo_pat_mat", "bisava_pat_mat"]);
  }, [set]);

  // ── Avô Materno → bisavós do avô materno ───────────────────────────────────
  const handleAvoMatSelect = useCallback((a: AnimalGenealogia) => {
    set({
      avo_materno:    a.nome,
      bisavo_materno: a.pai_nome ?? "",
      bisava_mat_pat: a.mae_nome ?? "",
    }, ["bisavo_materno", "bisava_mat_pat"]);
  }, [set]);

  // ── Avó Materna → bisavós da avó materna ────────────────────────────────────
  const handleAvoMatMatSelect = useCallback((a: AnimalGenealogia) => {
    set({
      avo_materna:    a.nome,
      bisavo_materna: a.pai_nome ?? "",
      bisavo:         a.mae_nome ?? "",
    }, ["bisavo_materna", "bisavo"]);
  }, [set]);

  // ── Importar genealogia completa de outro animal ────────────────────────────
  const handleImportar = useCallback((a: AnimalGenealogia) => {
    set({
      pai_nome:       a.pai_nome       ?? "",
      mae_nome:       a.mae_nome       ?? "",
      avo_paterno:    a.avo_paterno    ?? "",
      avo_paterna:    a.avo_paterna    ?? "",
      avo_materno:    a.avo_materno    ?? "",
      avo_materna:    a.avo_materna    ?? "",
      bisavo_pat_pat: a.bisavo_pat_pat ?? "",
      bisava_pat_pat: a.bisava_pat_pat ?? "",
      bisavo_pat_mat: a.bisavo_pat_mat ?? "",
      bisava_pat_mat: a.bisava_pat_mat ?? "",
      bisavo_materno: a.bisavo_materno ?? "",
      bisava_mat_pat: a.bisava_mat_pat ?? "",
      bisavo_materna: a.bisavo_materna ?? "",
      bisavo:         a.bisavo         ?? "",
    }, Object.keys(EMPTY) as (keyof GenealogyValues)[]);
    setModalAberto(false);
  }, [set]);

  const plain = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300";
  const filled = "w-full border border-green-200 bg-green-50/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300";

  return (
    <section className="space-y-5">
      {/* cabeçalho */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Genealogia</h2>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Copiar genealogia de irmão
        </button>
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        Selecione um animal cadastrado em cada campo para preencher os bisavós automaticamente.
      </p>

      {/* ── Pais ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Pais</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AutocompleteInput
            name="pai_nome" label="Pai"
            value={vals.pai_nome} placeholder="Buscar pai cadastrado…"
            onValueChange={(v) => { set({ pai_nome: v }); if (!v) clearAutoFilled("avo_paterno", "avo_paterna", "bisavo_pat_pat", "bisava_pat_pat", "bisavo_pat_mat", "bisava_pat_mat"); }}
            onAnimalSelect={handlePaiSelect}
          />
          <AutocompleteInput
            name="mae_nome" label="Mãe"
            value={vals.mae_nome} placeholder="Buscar mãe cadastrada…"
            onValueChange={(v) => { set({ mae_nome: v }); if (!v) clearAutoFilled("avo_materno", "avo_materna", "bisavo_materno", "bisava_mat_pat", "bisavo_materna", "bisavo"); }}
            onAnimalSelect={handleMaeSelect}
          />
        </div>
      </div>

      {/* ── Avós Paternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Avós Paternos <span className="text-gray-300 font-normal">(pais do Pai)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AutocompleteInput
            name="avo_paterno" label="Avô Paterno"
            value={vals.avo_paterno} placeholder="Buscar avô paterno…"
            onValueChange={(v) => { set({ avo_paterno: v }); if (!v) clearAutoFilled("bisavo_pat_pat", "bisava_pat_pat"); }}
            onAnimalSelect={handleAvoPatSelect}
            autoFilled={autoFilled.avo_paterno}
          />
          <AutocompleteInput
            name="avo_paterna" label="Avó Paterna"
            value={vals.avo_paterna} placeholder="Buscar avó paterna…"
            onValueChange={(v) => { set({ avo_paterna: v }); if (!v) clearAutoFilled("bisavo_pat_mat", "bisava_pat_mat"); }}
            onAnimalSelect={handleAvoPatMatSelect}
            autoFilled={autoFilled.avo_paterna}
          />
        </div>
      </div>

      {/* ── Avós Maternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Avós Maternos <span className="text-gray-300 font-normal">(pais da Mãe)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AutocompleteInput
            name="avo_materno" label="Avô Materno"
            value={vals.avo_materno} placeholder="Buscar avô materno…"
            onValueChange={(v) => { set({ avo_materno: v }); if (!v) clearAutoFilled("bisavo_materno", "bisava_mat_pat"); }}
            onAnimalSelect={handleAvoMatSelect}
            autoFilled={autoFilled.avo_materno}
          />
          <AutocompleteInput
            name="avo_materna" label="Avó Materna"
            value={vals.avo_materna} placeholder="Buscar avó materna…"
            onValueChange={(v) => { set({ avo_materna: v }); if (!v) clearAutoFilled("bisavo_materna", "bisavo"); }}
            onAnimalSelect={handleAvoMatMatSelect}
            autoFilled={autoFilled.avo_materna}
          />
        </div>
      </div>

      {/* ── Bisavós Paternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Bisavós Paternos <span className="text-gray-300 font-normal">(avós do Pai)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["bisavo_pat_pat", "bisava_pat_pat", "bisavo_pat_mat", "bisava_pat_mat"] as const).map((field) => {
            const labelMap: Record<string, string> = {
              bisavo_pat_pat: "Pai do Avô Paterno",
              bisava_pat_pat: "Mãe do Avô Paterno",
              bisavo_pat_mat: "Pai da Avó Paterna",
              bisava_pat_mat: "Mãe da Avó Paterna",
            };
            const placeholderMap: Record<string, string> = {
              bisavo_pat_pat: "Bisavô — pai do avô paterno",
              bisava_pat_pat: "Bisavó — mãe do avô paterno",
              bisavo_pat_mat: "Bisavô — pai da avó paterna",
              bisava_pat_mat: "Bisavó — mãe da avó paterna",
            };
            return (
              <div key={field}>
                <label className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                  {labelMap[field]}
                  {autoFilled[field] && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
                      automático
                    </span>
                  )}
                </label>
                <input
                  name={field} type="text" value={vals[field]}
                  onChange={(e) => { set({ [field]: e.target.value }); clearAutoFilled(field); }}
                  placeholder={placeholderMap[field]}
                  className={autoFilled[field] ? filled : plain}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bisavós Maternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Bisavós Maternos <span className="text-gray-300 font-normal">(avós da Mãe)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["bisavo_materno", "bisava_mat_pat", "bisavo_materna", "bisavo"] as const).map((field) => {
            const labelMap: Record<string, string> = {
              bisavo_materno: "Pai do Avô Materno",
              bisava_mat_pat: "Mãe do Avô Materno",
              bisavo_materna: "Pai da Avó Materna",
              bisavo:         "Mãe da Avó Materna",
            };
            const placeholderMap: Record<string, string> = {
              bisavo_materno: "Bisavô — pai do avô materno",
              bisava_mat_pat: "Bisavó — mãe do avô materno",
              bisavo_materna: "Bisavô — pai da avó materna",
              bisavo:         "Bisavó — mãe da avó materna",
            };
            return (
              <div key={field}>
                <label className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                  {labelMap[field]}
                  {autoFilled[field] && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
                      automático
                    </span>
                  )}
                </label>
                <input
                  name={field} type="text" value={vals[field]}
                  onChange={(e) => { set({ [field]: e.target.value }); clearAutoFilled(field); }}
                  placeholder={placeholderMap[field]}
                  className={autoFilled[field] ? filled : plain}
                />
              </div>
            );
          })}
        </div>
      </div>

      {modalAberto && (
        <ModalImportar
          onImportar={handleImportar}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </section>
  );
}
