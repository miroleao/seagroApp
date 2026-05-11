"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Search, Download, Zap } from "lucide-react";

// ─── tipos ────────────────────────────────────────────────────────────────────
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

interface AnimalDB {
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

// ─── hook de busca ────────────────────────────────────────────────────────────
function useBusca(q: string) {
  const [animais, setAnimais] = useState<AnimalDB[]>([]);
  const [nomesGenealogia, setNomesGenealogia] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.length < 2) { setAnimais([]); setNomesGenealogia([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/ancestrais/buscar?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setAnimais(data.animais ?? []);
        setNomesGenealogia(data.ancestrais ?? []);
      } catch {
        setAnimais([]); setNomesGenealogia([]);
      } finally {
        setCarregando(false);
      }
    }, 280);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return { animais, nomesGenealogia, carregando };
}

// ─── badge tipo ───────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora", NASCIDO: "Nascido",
};
const TIPO_COLOR: Record<string, string> = {
  DOADORA: "bg-purple-50 text-purple-600",
  TOURO:   "bg-blue-50   text-blue-600",
  NASCIDO: "bg-green-50  text-green-600",
};

// ─── input genérico com autocomplete ─────────────────────────────────────────
// onAnimalSelect: chamado APENAS quando o usuário clica em um animal com registro completo
function AncestralInput({
  name, label, value, placeholder, onChange, onAnimalSelect,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onAnimalSelect?: (a: AnimalDB) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inputQ, setInputQ] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const { animais, nomesGenealogia, carregando } = useBusca(inputQ);

  useEffect(() => { setInputQ(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (v: string) => {
    setInputQ(v);
    onChange(v);
    setAberto(v.length >= 2);
  };

  const selectAnimal = (a: AnimalDB) => {
    setInputQ(a.nome);
    onChange(a.nome);
    onAnimalSelect?.(a);
    setAberto(false);
  };

  const selectNome = (nome: string) => {
    setInputQ(nome);
    onChange(nome);
    setAberto(false);
  };

  const temResultados = animais.length > 0 || nomesGenealogia.length > 0;

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <div className="relative">
        <input
          name={name} type="text" value={inputQ}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => inputQ.length >= 2 && setAberto(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        {inputQ && (
          <button type="button" onClick={() => handleChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {aberto && (carregando || temResultados) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {carregando && <div className="px-3 py-2 text-xs text-gray-400">Buscando…</div>}

          {animais.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Animais cadastrados
                </span>
              </div>
              {animais.map((a) => {
                const temGenealogia = !!(a.pai_nome || a.mae_nome);
                return (
                  <button key={a.id} type="button" onClick={() => selectAnimal(a)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-800">{a.nome}</p>
                        {temGenealogia && onAnimalSelect && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                            <Zap className="w-2.5 h-2.5" /> preenche ascendência
                          </span>
                        )}
                      </div>
                      {a.rgn && <p className="text-[11px] text-gray-400 font-mono">{a.rgn}</p>}
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${TIPO_COLOR[a.tipo] ?? "bg-gray-50 text-gray-500"}`}>
                      {TIPO_LABEL[a.tipo] ?? a.tipo}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {nomesGenealogia.length > 0 && (
            <>
              <div className={`px-3 pt-2 pb-1 ${animais.length > 0 ? "border-t border-gray-100 mt-1" : ""}`}>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Encontrado em genealogias
                </span>
              </div>
              {nomesGenealogia.map((nome) => (
                <button key={nome} type="button" onClick={() => selectNome(nome)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700">
                  <Search className="w-3 h-3 text-gray-300 shrink-0" />
                  {nome}
                </button>
              ))}
            </>
          )}

          {!carregando && !temResultados && inputQ.length >= 2 && (
            <div className="px-3 py-2 text-xs text-gray-400">Nenhum resultado encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── modal copiar de irmão ────────────────────────────────────────────────────
function ModalCopiarIrmao({ onCopiar, onFechar }: {
  onCopiar: (a: AnimalDB) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [animais, setAnimais] = useState<AnimalDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (busca.length < 2) { setAnimais([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/animais/buscar?q=${encodeURIComponent(busca)}`);
        const data = await res.json();
        setAnimais(Array.isArray(data) ? data : []);
      } catch { setAnimais([]); }
      finally { setCarregando(false); }
    }, 280);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [busca]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Copiar genealogia de irmão</h3>
            <p className="text-xs text-gray-400 mt-0.5">Copia toda a genealogia de um animal com o mesmo pai e mãe</p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-300 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o nome do animal irmão…" autoFocus
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
        </div>
        <div className="px-5 pb-5 max-h-64 overflow-auto space-y-1">
          {busca.length < 2 && <p className="text-xs text-gray-400 py-2">Digite pelo menos 2 caracteres</p>}
          {carregando && <p className="text-xs text-gray-400 py-2">Buscando…</p>}
          {animais.map((a) => {
            const temGenealogia = !!(a.pai_nome || a.mae_nome);
            return (
              <button key={a.id} type="button" onClick={() => onCopiar(a)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-2 border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{a.nome}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {TIPO_LABEL[a.tipo] ?? a.tipo}
                    {a.rgn && ` · ${a.rgn}`}
                    <span className={`ml-1 ${temGenealogia ? "text-green-500" : "text-gray-300"}`}>
                      · {temGenealogia ? "genealogia disponível" : "sem genealogia"}
                    </span>
                  </p>
                </div>
                <Download className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              </button>
            );
          })}
          {!carregando && busca.length >= 2 && animais.length === 0 && (
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

  const set = useCallback((patch: Partial<GenealogyValues>) => {
    setVals((v) => ({ ...v, ...patch }));
  }, []);

  // ── Seleção do PAI: cascateia apenas o lado paterno ──────────────────────
  const handlePaiSelect = useCallback((a: AnimalDB) => {
    set({
      pai_nome:       a.nome,
      // avós paternos (pais do pai)
      avo_paterno:    a.pai_nome    ?? "",
      avo_paterna:    a.mae_nome    ?? "",
      // bisavós paternos (avós do pai)
      bisavo_pat_pat: a.avo_paterno ?? "",
      bisava_pat_pat: a.avo_paterna ?? "",
      bisavo_pat_mat: a.avo_materno ?? "",
      bisava_pat_mat: a.avo_materna ?? "",
    });
  }, [set]);

  // ── Seleção da MÃE: cascateia apenas o lado materno ─────────────────────
  const handleMaeSelect = useCallback((a: AnimalDB) => {
    set({
      mae_nome:       a.nome,
      // avós maternos (pais da mãe)
      avo_materno:    a.pai_nome    ?? "",
      avo_materna:    a.mae_nome    ?? "",
      // bisavós maternos (avós da mãe)
      bisavo_materno: a.avo_paterno ?? "",
      bisava_mat_pat: a.avo_paterna ?? "",
      bisavo_materna: a.avo_materno ?? "",
      bisavo:         a.avo_materna ?? "",
    });
  }, [set]);

  // ── Copiar genealogia de irmão ───────────────────────────────────────────
  const handleCopiar = useCallback((a: AnimalDB) => {
    setVals({
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
    setModalAberto(false);
  }, []);

  return (
    <section className="space-y-5">
      {/* cabeçalho */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Genealogia</h2>
        <button type="button" onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" />
          Copiar de irmão
        </button>
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        Ao selecionar o <strong>Pai</strong> ou a <strong>Mãe</strong> de um animal cadastrado, os avós e bisavós correspondentes são preenchidos automaticamente.
        Os demais campos também têm busca independente.
      </p>

      {/* ── Pais ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Pais</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AncestralInput
            name="pai_nome" label="Pai"
            value={vals.pai_nome} placeholder="Buscar pai…"
            onChange={(v) => set({ pai_nome: v })}
            onAnimalSelect={handlePaiSelect}
          />
          <AncestralInput
            name="mae_nome" label="Mãe"
            value={vals.mae_nome} placeholder="Buscar mãe…"
            onChange={(v) => set({ mae_nome: v })}
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
          <AncestralInput name="avo_paterno" label="Avô Paterno"
            value={vals.avo_paterno} placeholder="Pai do pai…"
            onChange={(v) => set({ avo_paterno: v })} />
          <AncestralInput name="avo_paterna" label="Avó Paterna"
            value={vals.avo_paterna} placeholder="Mãe do pai…"
            onChange={(v) => set({ avo_paterna: v })} />
        </div>
      </div>

      {/* ── Avós Maternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Avós Maternos <span className="text-gray-300 font-normal">(pais da Mãe)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AncestralInput name="avo_materno" label="Avô Materno"
            value={vals.avo_materno} placeholder="Pai da mãe…"
            onChange={(v) => set({ avo_materno: v })} />
          <AncestralInput name="avo_materna" label="Avó Materna"
            value={vals.avo_materna} placeholder="Mãe da mãe…"
            onChange={(v) => set({ avo_materna: v })} />
        </div>
      </div>

      {/* ── Bisavós Paternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Bisavós Paternos <span className="text-gray-300 font-normal">(avós do Pai)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ["bisavo_pat_pat", "Pai do Avô Paterno",  "Bisavô — pai do avô paterno…"],
            ["bisava_pat_pat", "Mãe do Avô Paterno",  "Bisavó — mãe do avô paterno…"],
            ["bisavo_pat_mat", "Pai da Avó Paterna",  "Bisavô — pai da avó paterna…"],
            ["bisava_pat_mat", "Mãe da Avó Paterna",  "Bisavó — mãe da avó paterna…"],
          ] as const).map(([key, label, placeholder]) => (
            <AncestralInput key={key} name={key} label={label}
              value={vals[key]} placeholder={placeholder}
              onChange={(v) => set({ [key]: v })} />
          ))}
        </div>
      </div>

      {/* ── Bisavós Maternos ── */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">
          Bisavós Maternos <span className="text-gray-300 font-normal">(avós da Mãe)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ["bisavo_materno", "Pai do Avô Materno", "Bisavô — pai do avô materno…"],
            ["bisava_mat_pat", "Mãe do Avô Materno", "Bisavó — mãe do avô materno…"],
            ["bisavo_materna", "Pai da Avó Materna", "Bisavô — pai da avó materna…"],
            ["bisavo",         "Mãe da Avó Materna", "Bisavó — mãe da avó materna…"],
          ] as const).map(([key, label, placeholder]) => (
            <AncestralInput key={key} name={key} label={label}
              value={vals[key]} placeholder={placeholder}
              onChange={(v) => set({ [key]: v })} />
          ))}
        </div>
      </div>

      {modalAberto && (
        <ModalCopiarIrmao onCopiar={handleCopiar} onFechar={() => setModalAberto(false)} />
      )}
    </section>
  );
}
