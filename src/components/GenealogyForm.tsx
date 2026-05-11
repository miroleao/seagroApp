"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Search, Download, ChevronRight } from "lucide-react";

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

// ─── hook de busca com debounce ───────────────────────────────────────────────
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
      } catch { setAnimais([]); setNomesGenealogia([]); }
      finally { setCarregando(false); }
    }, 280);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return { animais, nomesGenealogia, carregando };
}

// ─── busca animais completos (para importação) ────────────────────────────────
function useBuscaCompleta(q: string) {
  const [animais, setAnimais] = useState<AnimalDB[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.length < 2) { setAnimais([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/animais/buscar?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setAnimais(Array.isArray(data) ? data : []);
      } catch { setAnimais([]); }
      finally { setCarregando(false); }
    }, 280);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return { animais, carregando };
}

// ─── badges ───────────────────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora", NASCIDO: "Nascido",
};
const TIPO_COLOR: Record<string, string> = {
  DOADORA: "bg-purple-50 text-purple-600",
  TOURO:   "bg-blue-50   text-blue-600",
  NASCIDO: "bg-green-50  text-green-600",
};

// ─── input simples com autocomplete de nomes ──────────────────────────────────
function AncestralInput({ name, label, value, placeholder, onChange }: {
  name: string; label: string; value: string;
  placeholder: string; onChange: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inputQ, setInputQ] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const { animais, nomesGenealogia, carregando } = useBusca(inputQ);

  useEffect(() => { setInputQ(value); }, [value]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleChange = (v: string) => { setInputQ(v); onChange(v); setAberto(v.length >= 2); };
  const pick = (nome: string) => { setInputQ(nome); onChange(nome); setAberto(false); };
  const temResultados = animais.length > 0 || nomesGenealogia.length > 0;

  return (
    <div className="relative" ref={ref}>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <div className="relative">
        <input name={name} type="text" value={inputQ}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => inputQ.length >= 2 && setAberto(true)}
          placeholder={placeholder} autoComplete="off"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-brand-300" />
        {inputQ && (
          <button type="button" onClick={() => handleChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {aberto && (carregando || temResultados) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {carregando && <div className="px-3 py-2 text-xs text-gray-400">Buscando…</div>}
          {animais.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Animais cadastrados</span>
              </div>
              {animais.map((a) => (
                <button key={a.id} type="button" onClick={() => pick(a.nome)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.nome}</p>
                    {a.rgn && <p className="text-[11px] text-gray-400 font-mono">{a.rgn}</p>}
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${TIPO_COLOR[a.tipo] ?? "bg-gray-50 text-gray-500"}`}>
                    {TIPO_LABEL[a.tipo] ?? a.tipo}
                  </span>
                </button>
              ))}
            </>
          )}
          {nomesGenealogia.length > 0 && (
            <>
              <div className={`px-3 pt-2 pb-1 ${animais.length > 0 ? "border-t border-gray-100 mt-1" : ""}`}>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Nomes em genealogias</span>
              </div>
              {nomesGenealogia.map((nome) => (
                <button key={nome} type="button" onClick={() => pick(nome)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700">
                  <Search className="w-3 h-3 text-gray-300 shrink-0" />{nome}
                </button>
              ))}
            </>
          )}
          {!carregando && !temResultados && <div className="px-3 py-2 text-xs text-gray-400">Nenhum resultado</div>}
        </div>
      )}
    </div>
  );
}

// ─── preview da genealogia de um animal ───────────────────────────────────────
function GenealogyPreview({ animal, modo }: { animal: AnimalDB; modo: "pai" | "mae" | "tudo" }) {
  const linhas: { label: string; valor: string | undefined }[] = [];

  if (modo === "pai" || modo === "tudo") {
    if (animal.pai_nome)    linhas.push({ label: "Avô Paterno",    valor: animal.pai_nome });
    if (animal.mae_nome)    linhas.push({ label: "Avó Paterna",    valor: animal.mae_nome });
    if (animal.avo_paterno) linhas.push({ label: "Bisavô Pat-Pat", valor: animal.avo_paterno });
    if (animal.avo_paterna) linhas.push({ label: "Bisavó Pat-Pat", valor: animal.avo_paterna });
    if (animal.avo_materno) linhas.push({ label: "Bisavô Pat-Mat", valor: animal.avo_materno });
    if (animal.avo_materna) linhas.push({ label: "Bisavó Pat-Mat", valor: animal.avo_materna });
  }
  if (modo === "mae" || modo === "tudo") {
    if (animal.pai_nome && modo === "mae")    linhas.push({ label: "Avô Materno",    valor: animal.pai_nome });
    if (animal.mae_nome && modo === "mae")    linhas.push({ label: "Avó Materna",    valor: animal.mae_nome });
    if (animal.avo_paterno && modo === "mae") linhas.push({ label: "Bisavô Mat-Pat", valor: animal.avo_paterno });
    if (animal.avo_paterna && modo === "mae") linhas.push({ label: "Bisavó Mat-Pat", valor: animal.avo_paterna });
    if (animal.avo_materno && modo === "mae") linhas.push({ label: "Bisavô Mat-Mat", valor: animal.avo_materno });
    if (animal.avo_materna && modo === "mae") linhas.push({ label: "Bisavó Mat-Mat", valor: animal.avo_materna });
  }
  if (modo === "tudo") {
    if (animal.pai_nome)       linhas.push({ label: "Pai",           valor: animal.pai_nome });
    if (animal.mae_nome)       linhas.push({ label: "Mãe",           valor: animal.mae_nome });
    if (animal.avo_paterno)    linhas.push({ label: "Avô Paterno",   valor: animal.avo_paterno });
    if (animal.avo_paterna)    linhas.push({ label: "Avó Paterna",   valor: animal.avo_paterna });
    if (animal.avo_materno)    linhas.push({ label: "Avô Materno",   valor: animal.avo_materno });
    if (animal.avo_materna)    linhas.push({ label: "Avó Materna",   valor: animal.avo_materna });
  }

  if (linhas.length === 0) return <p className="text-xs text-gray-400 italic">Genealogia não preenchida neste cadastro.</p>;

  return (
    <div className="space-y-1">
      {linhas.map((l) => (
        <div key={l.label} className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 w-32 shrink-0">{l.label}</span>
          <span className="font-medium text-gray-700 truncate">{l.valor}</span>
        </div>
      ))}
    </div>
  );
}

// ─── modal de importação ───────────────────────────────────────────────────────
type ModoImport = "pai" | "mae" | "tudo";

function ModalImportar({
  modoInicial,
  onImportar,
  onFechar,
}: {
  modoInicial: ModoImport;
  onImportar: (animal: AnimalDB, modo: ModoImport) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<ModoImport>(modoInicial);
  const [selecionado, setSelecionado] = useState<AnimalDB | null>(null);
  const { animais, carregando } = useBuscaCompleta(busca);

  const modos: { key: ModoImport; label: string; desc: string; cor: string }[] = [
    { key: "pai",  label: "Lado Paterno",  desc: "Preenche pai + avós paternos + bisavós paternos", cor: "border-blue-300 bg-blue-50 text-blue-700" },
    { key: "mae",  label: "Lado Materno",  desc: "Preenche mãe + avós maternos + bisavós maternos", cor: "border-pink-300 bg-pink-50 text-pink-700" },
    { key: "tudo", label: "Genealogia Completa", desc: "Copia tudo (ideal para irmãos)",            cor: "border-brand-300 bg-brand-50 text-brand-700" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Importar genealogia</h3>
            <p className="text-xs text-gray-400 mt-0.5">Selecione um animal cadastrado para importar a genealogia</p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-300 hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">

          {/* Modo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">O que importar</p>
            <div className="grid grid-cols-3 gap-2">
              {modos.map((m) => (
                <button key={m.key} type="button"
                  onClick={() => setModo(m.key)}
                  className={`text-left p-2.5 rounded-lg border-2 transition-colors ${modo === m.key ? m.cor : "border-gray-100 bg-white text-gray-500 hover:border-gray-200"}`}
                >
                  <p className="text-xs font-semibold">{m.label}</p>
                  <p className="text-[10px] mt-0.5 leading-tight opacity-75">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Busca */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {modo === "pai" ? "Buscar o animal pai" : modo === "mae" ? "Buscar o animal mãe" : "Buscar animal irmão"}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" value={busca} onChange={(e) => { setBusca(e.target.value); setSelecionado(null); }}
                placeholder={modo === "tudo" ? "Nome do irmão…" : modo === "pai" ? "Nome do pai…" : "Nome da mãe…"}
                autoFocus
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
          </div>

          {/* Lista de resultados */}
          {busca.length >= 2 && (
            <div className="space-y-1 max-h-48 overflow-auto">
              {carregando && <p className="text-xs text-gray-400">Buscando…</p>}
              {animais.map((a) => {
                const temGen = !!(a.pai_nome || a.mae_nome);
                const isSel = selecionado?.id === a.id;
                return (
                  <button key={a.id} type="button"
                    onClick={() => setSelecionado(isSel ? null : a)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 border transition-colors ${isSel ? "border-brand-300 bg-brand-50" : "border-gray-100 hover:bg-gray-50"}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.nome}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {TIPO_LABEL[a.tipo] ?? a.tipo}
                        {a.rgn && ` · ${a.rgn}`}
                        <span className={`ml-1 ${temGen ? "text-green-500" : "text-orange-400"}`}>
                          · {temGen ? "tem genealogia" : "sem genealogia"}
                        </span>
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSel ? "text-brand-500" : "text-gray-300"}`} />
                  </button>
                );
              })}
              {!carregando && animais.length === 0 && <p className="text-xs text-gray-400">Nenhum animal encontrado</p>}
            </div>
          )}

          {/* Preview do que será importado */}
          {selecionado && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Prévia — o que será preenchido
              </p>
              <GenealogyPreview animal={selecionado} modo={modo} />
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button type="button" onClick={onFechar} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          <button type="button"
            disabled={!selecionado}
            onClick={() => selecionado && onImportar(selecionado, modo)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Importar
          </button>
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
  const [modal, setModal] = useState<{ aberto: boolean; modo: ModoImport }>({ aberto: false, modo: "pai" });

  const set = useCallback((patch: Partial<GenealogyValues>) => {
    setVals((v) => ({ ...v, ...patch }));
  }, []);

  const handleImportar = useCallback((a: AnimalDB, modo: ModoImport) => {
    if (modo === "pai") {
      // A genealogia do animal selecionado = genealogia do PAI do novo animal
      // pai_nome do selecionado → avô paterno do novo animal
      set({
        pai_nome:       a.nome,
        ...(a.pai_nome    && { avo_paterno:    a.pai_nome }),
        ...(a.mae_nome    && { avo_paterna:    a.mae_nome }),
        ...(a.avo_paterno && { bisavo_pat_pat: a.avo_paterno }),
        ...(a.avo_paterna && { bisava_pat_pat: a.avo_paterna }),
        ...(a.avo_materno && { bisavo_pat_mat: a.avo_materno }),
        ...(a.avo_materna && { bisava_pat_mat: a.avo_materna }),
      });
    } else if (modo === "mae") {
      set({
        mae_nome:       a.nome,
        ...(a.pai_nome    && { avo_materno:    a.pai_nome }),
        ...(a.mae_nome    && { avo_materna:    a.mae_nome }),
        ...(a.avo_paterno && { bisavo_materno: a.avo_paterno }),
        ...(a.avo_paterna && { bisava_mat_pat: a.avo_paterna }),
        ...(a.avo_materno && { bisavo_materna: a.avo_materno }),
        ...(a.avo_materna && { bisavo:         a.avo_materna }),
      });
    } else {
      // tudo: copia genealogia completa (irmão)
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
    }
    setModal({ aberto: false, modo: "pai" });
  }, [set]);

  return (
    <section className="space-y-5">
      {/* cabeçalho com botões de importação */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Genealogia</h2>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setModal({ aberto: true, modo: "pai" })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
            <Download className="w-3 h-3" /> Importar Pai
          </button>
          <button type="button"
            onClick={() => setModal({ aberto: true, modo: "mae" })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 px-2.5 py-1.5 rounded-lg transition-colors">
            <Download className="w-3 h-3" /> Importar Mãe
          </button>
          <button type="button"
            onClick={() => setModal({ aberto: true, modo: "tudo" })}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors">
            <Download className="w-3 h-3" /> Irmão
          </button>
        </div>
      </div>

      {/* campos editáveis com autocomplete */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Pais</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AncestralInput name="pai_nome" label="Pai" value={vals.pai_nome} placeholder="Nome do pai…" onChange={(v) => set({ pai_nome: v })} />
          <AncestralInput name="mae_nome" label="Mãe" value={vals.mae_nome} placeholder="Nome da mãe…" onChange={(v) => set({ mae_nome: v })} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Avós Paternos <span className="text-gray-300 font-normal">(pais do Pai)</span></p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AncestralInput name="avo_paterno" label="Avô Paterno" value={vals.avo_paterno} placeholder="Pai do pai…" onChange={(v) => set({ avo_paterno: v })} />
          <AncestralInput name="avo_paterna" label="Avó Paterna" value={vals.avo_paterna} placeholder="Mãe do pai…" onChange={(v) => set({ avo_paterna: v })} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Avós Maternos <span className="text-gray-300 font-normal">(pais da Mãe)</span></p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AncestralInput name="avo_materno" label="Avô Materno" value={vals.avo_materno} placeholder="Pai da mãe…" onChange={(v) => set({ avo_materno: v })} />
          <AncestralInput name="avo_materna" label="Avó Materna" value={vals.avo_materna} placeholder="Mãe da mãe…" onChange={(v) => set({ avo_materna: v })} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Bisavós Paternos <span className="text-gray-300 font-normal">(avós do Pai)</span></p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ["bisavo_pat_pat", "Pai do Avô Paterno",  "Bisavô — pai do avô paterno…"],
            ["bisava_pat_pat", "Mãe do Avô Paterno",  "Bisavó — mãe do avô paterno…"],
            ["bisavo_pat_mat", "Pai da Avó Paterna",  "Bisavô — pai da avó paterna…"],
            ["bisava_pat_mat", "Mãe da Avó Paterna",  "Bisavó — mãe da avó paterna…"],
          ] as const).map(([k, l, p]) => (
            <AncestralInput key={k} name={k} label={l} value={vals[k]} placeholder={p} onChange={(v) => set({ [k]: v })} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Bisavós Maternos <span className="text-gray-300 font-normal">(avós da Mãe)</span></p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ["bisavo_materno", "Pai do Avô Materno", "Bisavô — pai do avô materno…"],
            ["bisava_mat_pat", "Mãe do Avô Materno", "Bisavó — mãe do avô materno…"],
            ["bisavo_materna", "Pai da Avó Materna", "Bisavô — pai da avó materna…"],
            ["bisavo",         "Mãe da Avó Materna", "Bisavó — mãe da avó materna…"],
          ] as const).map(([k, l, p]) => (
            <AncestralInput key={k} name={k} label={l} value={vals[k]} placeholder={p} onChange={(v) => set({ [k]: v })} />
          ))}
        </div>
      </div>

      {modal.aberto && (
        <ModalImportar
          modoInicial={modal.modo}
          onImportar={handleImportar}
          onFechar={() => setModal({ aberto: false, modo: "pai" })}
        />
      )}
    </section>
  );
}
