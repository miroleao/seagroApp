"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Search, Download } from "lucide-react";

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

interface AnimalSugestao {
  id: string;
  nome: string;
  tipo: string;
  rgn?: string;
}

// ─── hook de busca ────────────────────────────────────────────────────────────
function useBuscarAncestral(q: string) {
  const [animais, setAnimais] = useState<AnimalSugestao[]>([]);
  const [ancestrais, setAncestralNomes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.length < 2) { setAnimais([]); setAncestralNomes([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/ancestrais/buscar?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setAnimais(data.animais ?? []);
        setAncestralNomes(data.ancestrais ?? []);
      } catch { setAnimais([]); setAncestralNomes([]); }
      finally { setCarregando(false); }
    }, 280);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  return { animais, ancestrais, carregando };
}

// ─── input com autocomplete ───────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  DOADORA: "Doadora", TOURO: "Touro", RECEPTORA: "Receptora",
  NASCIDO: "Nascido",
};
const TIPO_COLOR: Record<string, string> = {
  DOADORA: "bg-purple-50 text-purple-600",
  TOURO: "bg-blue-50 text-blue-600",
  RECEPTORA: "bg-pink-50 text-pink-600",
  NASCIDO: "bg-green-50 text-green-600",
};

function AncestralInput({
  name, label, value, placeholder, onChange,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inputQ, setInputQ] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const { animais, ancestrais, carregando } = useBuscarAncestral(inputQ);

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
    onChange(v);
    setAberto(v.length >= 2);
  };

  const handleSelect = (nome: string) => {
    setInputQ(nome);
    onChange(nome);
    setAberto(false);
  };

  const temResultados = animais.length > 0 || ancestrais.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
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
            onClick={() => handleChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {aberto && (carregando || temResultados) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {carregando && <div className="px-3 py-2 text-xs text-gray-400">Buscando…</div>}

          {/* Animais cadastrados */}
          {animais.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Animais cadastrados</span>
              </div>
              {animais.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelect(a.nome)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                >
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

          {/* Nomes encontrados em genealogias */}
          {ancestrais.length > 0 && (
            <>
              <div className={`px-3 pt-2 pb-1 ${animais.length > 0 ? "border-t border-gray-100 mt-1" : ""}`}>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Encontrado em genealogias</span>
              </div>
              {ancestrais.map((nome) => (
                <button
                  key={nome}
                  type="button"
                  onClick={() => handleSelect(nome)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                >
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

// ─── modal de cópia de irmão ──────────────────────────────────────────────────
interface AnimalCompleto extends AnimalSugestao {
  pai_nome?: string; mae_nome?: string;
  avo_paterno?: string; avo_paterna?: string;
  avo_materno?: string; avo_materna?: string;
  bisavo_pat_pat?: string; bisava_pat_pat?: string;
  bisavo_pat_mat?: string; bisava_pat_mat?: string;
  bisavo_materno?: string; bisava_mat_pat?: string;
  bisavo_materna?: string; bisavo?: string;
}

function ModalCopiarIrmao({
  onCopiar,
  onFechar,
}: {
  onCopiar: (a: AnimalCompleto) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [animais, setAnimais] = useState<AnimalCompleto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (busca.length < 2) { setAnimais([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/animais/buscar?q=${encodeURIComponent(busca)}`);
        const data = await res.json();
        setAnimais(Array.isArray(data) ? data : []);
      } catch { setAnimais([]); }
      finally { setCarregando(false); }
    }, 280);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [busca]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Copiar genealogia de irmão</h3>
            <p className="text-xs text-gray-400 mt-0.5">Copia pai, mãe, avós e bisavós de um animal que já tem genealogia completa</p>
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
              placeholder="Digite o nome do animal irmão…"
              autoFocus
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
        </div>
        <div className="px-5 pb-5 max-h-64 overflow-auto space-y-1">
          {busca.length < 2 && <p className="text-xs text-gray-400 py-2">Digite pelo menos 2 caracteres</p>}
          {carregando && <p className="text-xs text-gray-400 py-2">Buscando…</p>}
          {animais.map((a) => {
            const temGenealogia = !!(a.pai_nome || a.mae_nome);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onCopiar(a)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-2 border border-gray-100"
              >
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

  const set = useCallback((key: keyof GenealogyValues, value: string) => {
    setVals((v) => ({ ...v, [key]: value }));
  }, []);

  const handleCopiar = useCallback((a: AnimalCompleto) => {
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

  // Configuração dos campos por seção
  const secoes = [
    {
      titulo: "Pais",
      subtitulo: undefined,
      campos: [
        { key: "pai_nome" as const,  label: "Pai",  placeholder: "Buscar ou digitar nome do pai…"  },
        { key: "mae_nome" as const,  label: "Mãe",  placeholder: "Buscar ou digitar nome da mãe…"  },
      ],
    },
    {
      titulo: "Avós Paternos",
      subtitulo: "pais do Pai",
      campos: [
        { key: "avo_paterno" as const, label: "Avô Paterno", placeholder: "Pai do pai…" },
        { key: "avo_paterna" as const, label: "Avó Paterna",  placeholder: "Mãe do pai…" },
      ],
    },
    {
      titulo: "Avós Maternos",
      subtitulo: "pais da Mãe",
      campos: [
        { key: "avo_materno" as const, label: "Avô Materno", placeholder: "Pai da mãe…" },
        { key: "avo_materna" as const, label: "Avó Materna",  placeholder: "Mãe da mãe…" },
      ],
    },
    {
      titulo: "Bisavós Paternos",
      subtitulo: "avós do Pai",
      campos: [
        { key: "bisavo_pat_pat" as const, label: "Pai do Avô Paterno",  placeholder: "Bisavô — pai do avô paterno…"  },
        { key: "bisava_pat_pat" as const, label: "Mãe do Avô Paterno",  placeholder: "Bisavó — mãe do avô paterno…"  },
        { key: "bisavo_pat_mat" as const, label: "Pai da Avó Paterna",   placeholder: "Bisavô — pai da avó paterna…"   },
        { key: "bisava_pat_mat" as const, label: "Mãe da Avó Paterna",   placeholder: "Bisavó — mãe da avó paterna…"   },
      ],
    },
    {
      titulo: "Bisavós Maternos",
      subtitulo: "avós da Mãe",
      campos: [
        { key: "bisavo_materno" as const, label: "Pai do Avô Materno",  placeholder: "Bisavô — pai do avô materno…"  },
        { key: "bisava_mat_pat" as const, label: "Mãe do Avô Materno",  placeholder: "Bisavó — mãe do avô materno…"  },
        { key: "bisavo_materna" as const, label: "Pai da Avó Materna",   placeholder: "Bisavô — pai da avó materna…"   },
        { key: "bisavo"         as const, label: "Mãe da Avó Materna",   placeholder: "Bisavó — mãe da avó materna…"   },
      ],
    },
  ] as const;

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
          Copiar de irmão
        </button>
      </div>

      <p className="text-xs text-gray-400 -mt-2">
        Digite em qualquer campo para buscar animais cadastrados ou nomes já usados em outras genealogias.
      </p>

      {/* seções */}
      {secoes.map((secao) => (
        <div key={secao.titulo}>
          <p className="text-xs font-medium text-gray-500 mb-2">
            {secao.titulo}
            {secao.subtitulo && (
              <span className="text-gray-300 font-normal"> ({secao.subtitulo})</span>
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {secao.campos.map((campo) => (
              <AncestralInput
                key={campo.key}
                name={campo.key}
                label={campo.label}
                value={vals[campo.key]}
                placeholder={campo.placeholder}
                onChange={(v) => set(campo.key, v)}
              />
            ))}
          </div>
        </div>
      ))}

      {modalAberto && (
        <ModalCopiarIrmao
          onCopiar={handleCopiar}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </section>
  );
}
