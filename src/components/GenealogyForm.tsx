"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Download, ChevronDown } from "lucide-react";

// ─── tipos locais ─────────────────────────────────────────────────────────────
interface AnimalGenealogia {
  id: string;
  nome: string;
  tipo: string;
  rgn?: string;
  rgd?: string;
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

interface GenealogyValues {
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

// ─── sub-componente: input com autocomplete ───────────────────────────────────
function AutocompleteInput({
  name, label, value, placeholder, onValueChange, onAnimalSelect, badgeLabel,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
  onValueChange: (v: string) => void;
  onAnimalSelect: (a: AnimalGenealogia) => void;
  badgeLabel?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [inputQ, setInputQ] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resultados, carregando } = useBuscarAnimais(inputQ);

  // sincronizar quando valor externo muda (ex: ao importar)
  useEffect(() => { setInputQ(value); }, [value]);

  // fechar ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleChange = (v: string) => {
    setInputQ(v);
    onValueChange(v);
    setAberto(v.length >= 2);
  };

  const handleSelect = (animal: AnimalGenealogia) => {
    setInputQ(animal.nome);
    onValueChange(animal.nome);
    onAnimalSelect(animal);
    setAberto(false);
  };

  const tipoLabel: Record<string, string> = {
    DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora",
    NASCIDO: "Nascido", DESCARTE: "Descarte",
  };

  const tipoColor: Record<string, string> = {
    DOADORA: "bg-purple-50 text-purple-600",
    TOURO: "bg-blue-50 text-blue-600",
    RECEPTORA: "bg-pink-50 text-pink-600",
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs text-gray-400 mb-1 block">
        {label}
        {badgeLabel && (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
            {badgeLabel}
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
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        {inputQ && (
          <button
            type="button"
            onClick={() => { handleChange(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {aberto && (resultados.length > 0 || carregando) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-auto">
          {carregando && (
            <div className="px-3 py-2 text-xs text-gray-400">Buscando…</div>
          )}
          {resultados.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleSelect(a)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-2 border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{a.nome}</p>
                {(a.pai_nome || a.mae_nome) && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {a.pai_nome && `♂ ${a.pai_nome}`}
                    {a.pai_nome && a.mae_nome && " · "}
                    {a.mae_nome && `♀ ${a.mae_nome}`}
                  </p>
                )}
              </div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${tipoColor[a.tipo] ?? "bg-gray-50 text-gray-500"}`}>
                {tipoLabel[a.tipo] ?? a.tipo}
              </span>
            </button>
          ))}
          {!carregando && resultados.length === 0 && inputQ.length >= 2 && (
            <div className="px-3 py-2 text-xs text-gray-400">Nenhum animal encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── modal de importação ──────────────────────────────────────────────────────
function ModalImportar({
  onImportar,
  onFechar,
}: {
  onImportar: (a: AnimalGenealogia) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const { resultados, carregando } = useBuscarAnimais(busca);

  const tipoLabel: Record<string, string> = {
    DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora",
    NASCIDO: "Nascido", DESCARTE: "Descarte",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Importar genealogia</h3>
            <p className="text-xs text-gray-400 mt-0.5">Busque um animal cadastrado para copiar toda a genealogia</p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-300 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* busca */}
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

        {/* lista */}
        <div className="px-5 pb-5 max-h-64 overflow-auto space-y-1">
          {carregando && <p className="text-xs text-gray-400 py-2">Buscando…</p>}
          {!carregando && busca.length < 2 && (
            <p className="text-xs text-gray-400 py-2">Digite pelo menos 2 caracteres para buscar</p>
          )}
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
                    {tipoLabel[a.tipo] ?? a.tipo}
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
  const [paiAutoFilled, setPaiAutoFilled] = useState(false);
  const [maeAutoFilled, setMaeAutoFilled] = useState(false);

  const set = useCallback((patch: Partial<GenealogyValues>) => {
    setVals((v) => ({ ...v, ...patch }));
  }, []);

  // pai selecionado → cascatear avós paternos e bisavós paternos
  const handlePaiSelect = useCallback((a: AnimalGenealogia) => {
    set({
      pai_nome:       a.nome,
      avo_paterno:    a.pai_nome    ?? "",
      avo_paterna:    a.mae_nome    ?? "",
      bisavo_pat_pat: a.avo_paterno ?? "",
      bisava_pat_pat: a.avo_paterna ?? "",
      bisavo_pat_mat: a.avo_materno ?? "",
      bisava_pat_mat: a.avo_materna ?? "",
    });
    setPaiAutoFilled(true);
  }, [set]);

  // mãe selecionada → cascatear avós maternos e bisavós maternos
  const handleMaeSelect = useCallback((a: AnimalGenealogia) => {
    set({
      mae_nome:       a.nome,
      avo_materno:    a.pai_nome    ?? "",
      avo_materna:    a.mae_nome    ?? "",
      bisavo_materno: a.avo_paterno ?? "",
      bisava_mat_pat: a.avo_paterna ?? "",
      bisavo_materna: a.avo_materno ?? "",
      bisavo:         a.avo_materna ?? "",
    });
    setMaeAutoFilled(true);
  }, [set]);

  // importar toda a genealogia de outro animal
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
    });
    setPaiAutoFilled(false);
    setMaeAutoFilled(false);
    setModalAberto(false);
  }, [set]);

  const inputClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300";

  const filledInputClass =
    "w-full border border-green-200 bg-green-50/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300";

  return (
    <section className="space-y-5">
      {/* cabeçalho da seção */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Genealogia</h2>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Importar de outro animal
        </button>
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        Digite o nome do pai ou da mãe para buscar na base e preencher avós e bisavós automaticamente.
      </p>

      {/* ── Pais ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Pais</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AutocompleteInput
            name="pai_nome"
            label="Pai"
            value={vals.pai_nome}
            placeholder="Buscar pai cadastrado…"
            onValueChange={(v) => { set({ pai_nome: v }); if (!v) setPaiAutoFilled(false); }}
            onAnimalSelect={handlePaiSelect}
            badgeLabel={paiAutoFilled ? "cascata ativa" : undefined}
          />
          <AutocompleteInput
            name="mae_nome"
            label="Mãe"
            value={vals.mae_nome}
            placeholder="Buscar mãe cadastrada…"
            onValueChange={(v) => { set({ mae_nome: v }); if (!v) setMaeAutoFilled(false); }}
            onAnimalSelect={handleMaeSelect}
            badgeLabel={maeAutoFilled ? "cascata ativa" : undefined}
          />
        </div>
      </div>

      {/* ── Avós Paternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Avós Paternos <span className="text-gray-300 font-normal">(pais do Pai)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Avô Paterno</label>
            <input name="avo_paterno" type="text" value={vals.avo_paterno}
              onChange={(e) => set({ avo_paterno: e.target.value })}
              placeholder="Pai do pai"
              className={vals.avo_paterno && paiAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Avó Paterna</label>
            <input name="avo_paterna" type="text" value={vals.avo_paterna}
              onChange={(e) => set({ avo_paterna: e.target.value })}
              placeholder="Mãe do pai"
              className={vals.avo_paterna && paiAutoFilled ? filledInputClass : inputClass} />
          </div>
        </div>
      </div>

      {/* ── Avós Maternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Avós Maternos <span className="text-gray-300 font-normal">(pais da Mãe)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Avô Materno</label>
            <input name="avo_materno" type="text" value={vals.avo_materno}
              onChange={(e) => set({ avo_materno: e.target.value })}
              placeholder="Pai da mãe"
              className={vals.avo_materno && maeAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Avó Materna</label>
            <input name="avo_materna" type="text" value={vals.avo_materna}
              onChange={(e) => set({ avo_materna: e.target.value })}
              placeholder="Mãe da mãe"
              className={vals.avo_materna && maeAutoFilled ? filledInputClass : inputClass} />
          </div>
        </div>
      </div>

      {/* ── Bisavós Paternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Bisavós Paternos <span className="text-gray-300 font-normal">(avós do Pai)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pai do Avô Paterno</label>
            <input name="bisavo_pat_pat" type="text" value={vals.bisavo_pat_pat}
              onChange={(e) => set({ bisavo_pat_pat: e.target.value })}
              placeholder="Bisavô — pai do avô paterno"
              className={vals.bisavo_pat_pat && paiAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Mãe do Avô Paterno</label>
            <input name="bisava_pat_pat" type="text" value={vals.bisava_pat_pat}
              onChange={(e) => set({ bisava_pat_pat: e.target.value })}
              placeholder="Bisavó — mãe do avô paterno"
              className={vals.bisava_pat_pat && paiAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pai da Avó Paterna</label>
            <input name="bisavo_pat_mat" type="text" value={vals.bisavo_pat_mat}
              onChange={(e) => set({ bisavo_pat_mat: e.target.value })}
              placeholder="Bisavô — pai da avó paterna"
              className={vals.bisavo_pat_mat && paiAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Mãe da Avó Paterna</label>
            <input name="bisava_pat_mat" type="text" value={vals.bisava_pat_mat}
              onChange={(e) => set({ bisava_pat_mat: e.target.value })}
              placeholder="Bisavó — mãe da avó paterna"
              className={vals.bisava_pat_mat && paiAutoFilled ? filledInputClass : inputClass} />
          </div>
        </div>
      </div>

      {/* ── Bisavós Maternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Bisavós Maternos <span className="text-gray-300 font-normal">(avós da Mãe)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pai do Avô Materno</label>
            <input name="bisavo_materno" type="text" value={vals.bisavo_materno}
              onChange={(e) => set({ bisavo_materno: e.target.value })}
              placeholder="Bisavô — pai do avô materno"
              className={vals.bisavo_materno && maeAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Mãe do Avô Materno</label>
            <input name="bisava_mat_pat" type="text" value={vals.bisava_mat_pat}
              onChange={(e) => set({ bisava_mat_pat: e.target.value })}
              placeholder="Bisavó — mãe do avô materno"
              className={vals.bisava_mat_pat && maeAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pai da Avó Materna</label>
            <input name="bisavo_materna" type="text" value={vals.bisavo_materna}
              onChange={(e) => set({ bisavo_materna: e.target.value })}
              placeholder="Bisavô — pai da avó materna"
              className={vals.bisavo_materna && maeAutoFilled ? filledInputClass : inputClass} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Mãe da Avó Materna</label>
            <input name="bisavo" type="text" value={vals.bisavo}
              onChange={(e) => set({ bisavo: e.target.value })}
              placeholder="Bisavó — mãe da avó materna"
              className={vals.bisavo && maeAutoFilled ? filledInputClass : inputClass} />
          </div>
        </div>
      </div>

      {/* modal */}
      {modalAberto && (
        <ModalImportar
          onImportar={handleImportar}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </section>
  );
}
