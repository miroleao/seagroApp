"use client";

import { useMemo, useState } from "react";
import { Baby, Snowflake, FlaskConical, Search, X } from "lucide-react";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";

/**
 * Relatórios da aba Aspirações.
 *
 * Cada linha já vem formatada para o PDF. Campos auxiliares de filtro usam
 * prefixo `_` — o ExportarPDF só imprime as colunas selecionadas, então eles
 * viajam junto sem aparecer no documento.
 */

export type LinhaRelatorio = Record<string, string> & {
  _doadora?: string;
  _touro?: string;
  _data?: string;      // ISO, para comparação de período
  _resultado?: string;
  _sexagem?: string;
  _status?: string;
  _tipo?: string;
};

export type DadosRelatorios = {
  prenhezes:   LinhaRelatorio[];
  embrioes:    LinhaRelatorio[];
  producao:    LinhaRelatorio[];
};

type RelKey = "prenhezes" | "embrioes" | "producao";

const ABAS: { key: RelKey; label: string; Icon: typeof Baby; desc: string }[] = [
  { key: "prenhezes", label: "Prenhezes",    Icon: Baby,         desc: "transferências e resultado de DG" },
  { key: "embrioes",  label: "Congelamento", Icon: Snowflake,    desc: "estoque de embriões produzidos"    },
  { key: "producao",  label: "Produção OPU", Icon: FlaskConical, desc: "oócitos, embriões e conversão"     },
];

const COLUNAS: Record<RelKey, ColunaPDF[]> = {
  prenhezes: [
    { key: "doadora",   label: "Doadora",      padrao: true,  largura: 2.0 },
    { key: "touro",     label: "Touro",        padrao: true,  largura: 2.0 },
    { key: "receptora", label: "Receptora",    padrao: true,  largura: 1.4 },
    { key: "data_te",   label: "Data T.E.",    padrao: true,  largura: 1.0 },
    { key: "resultado", label: "Resultado",    padrao: true,  largura: 1.1 },
    { key: "previsao",  label: "Prev. Parto",  padrao: true,  largura: 1.1 },
    { key: "sexagem",   label: "Sexagem",      padrao: false, largura: 0.9 },
    { key: "cdc_fiv",   label: "CDC-FIV",      padrao: false, largura: 1.0 },
    { key: "adt_te",    label: "ADT-TE",       padrao: false, largura: 1.0 },
    { key: "data_opu",  label: "Data OPU",     padrao: false, largura: 1.0 },
  ],
  embrioes: [
    { key: "doadora",  label: "Doadora",   padrao: true,  largura: 2.0 },
    { key: "touro",    label: "Touro",     padrao: true,  largura: 2.0 },
    { key: "sexagem",  label: "Sexagem",   padrao: true,  largura: 0.9 },
    { key: "status",   label: "Status",    padrao: true,  largura: 1.1 },
    { key: "cdc_fiv",  label: "CDC-FIV",   padrao: true,  largura: 1.0 },
    { key: "adt_te",   label: "ADT-TE",    padrao: true,  largura: 1.0 },
    { key: "data_opu", label: "Data OPU",  padrao: true,  largura: 1.0 },
    { key: "tipo",     label: "Origem",    padrao: false, largura: 1.0 },
    { key: "lab",      label: "Lab",       padrao: false, largura: 1.3 },
  ],
  producao: [
    { key: "data_opu",     label: "Data OPU",       padrao: true,  largura: 1.0 },
    { key: "tipo",         label: "Origem",         padrao: true,  largura: 0.9 },
    { key: "doadora",      label: "Doadora",        padrao: true,  largura: 2.0 },
    { key: "touro",        label: "Touro",          padrao: true,  largura: 2.0 },
    { key: "oocitos",      label: "Oócitos",        padrao: true,  largura: 0.8 },
    { key: "embrioes",     label: "Embriões",       padrao: true,  largura: 0.8 },
    { key: "conversao",    label: "Conversão",      padrao: true,  largura: 0.9 },
    { key: "implantados",  label: "Implantados",    padrao: false, largura: 0.9 },
    { key: "lab",          label: "Lab",            padrao: false, largura: 1.3 },
    { key: "local",        label: "Local",          padrao: false, largura: 1.3 },
    { key: "responsavel",  label: "Responsável",    padrao: false, largura: 1.3 },
  ],
};

const TITULOS: Record<RelKey, string> = {
  prenhezes: "Relatório de Prenhezes",
  embrioes:  "Estoque de Embriões",
  producao:  "Produção OPU-FIV",
};

const ARQUIVOS: Record<RelKey, string> = {
  prenhezes: "SE_Prenhezes.pdf",
  embrioes:  "SE_Embrioes.pdf",
  producao:  "SE_Producao_OPU.pdf",
};

const selCls =
  "text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white max-w-[180px]";

function opcoes(linhas: LinhaRelatorio[], campo: string): string[] {
  return [...new Set(linhas.map(l => l[campo]).filter((v): v is string => !!v && v !== "—"))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function RelatoriosAspiracoes({ dados }: { dados: DadosRelatorios }) {
  const [aba, setAba] = useState<RelKey>("prenhezes");

  const [doadora,   setDoadora]   = useState("");
  const [touro,     setTouro]     = useState("");
  const [de,        setDe]        = useState("");
  const [ate,       setAte]       = useState("");
  const [especifico, setEspecifico] = useState("");   // resultado / status / origem
  const [busca,     setBusca]     = useState("");

  const linhas = dados[aba];

  // Campo do filtro específico varia por relatório
  const campoEspecifico =
    aba === "prenhezes" ? "_resultado"
    : aba === "embrioes" ? "_status"
    : "_tipo";
  const rotuloEspecifico =
    aba === "prenhezes" ? "Todos os resultados"
    : aba === "embrioes" ? "Todos os status"
    : "Todas as origens";

  function limpar() {
    setDoadora(""); setTouro(""); setDe(""); setAte(""); setEspecifico(""); setBusca("");
  }

  function trocarAba(k: RelKey) { setAba(k); limpar(); }

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return linhas.filter(l => {
      if (doadora && l._doadora !== doadora) return false;
      if (touro   && l._touro   !== touro)   return false;
      if (especifico && l[campoEspecifico] !== especifico) return false;
      if (de  && (!l._data || l._data < de))  return false;
      if (ate && (!l._data || l._data > ate)) return false;
      if (q) {
        const alvo = Object.entries(l)
          .filter(([k]) => !k.startsWith("_"))
          .map(([, v]) => v).join(" ").toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
  }, [linhas, doadora, touro, especifico, de, ate, busca, campoEspecifico]);

  const temFiltro = !!(doadora || touro || especifico || de || ate || busca);
  const descricaoFiltro = [
    doadora    ? `doadora ${doadora}` : null,
    touro      ? `touro ${touro}`     : null,
    especifico || null,
    (de || ate) ? `período ${de || "…"} a ${ate || "…"}` : null,
    busca      ? `busca "${busca}"`   : null,
  ].filter(Boolean).join(" · ") || "sem filtro";

  const colunas = COLUNAS[aba];
  const colunasPreview = colunas.filter(c => c.padrao !== false).slice(0, 6);

  return (
    <section className="card overflow-hidden">
      {/* ── Abas ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-3">Relatórios</h2>
        <div className="flex flex-wrap gap-1.5">
          {ABAS.map(({ key, label, Icon, desc }) => (
            <button
              key={key}
              onClick={() => trocarAba(key)}
              title={desc}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                aba === key
                  ? "bg-brand-50 border-brand-300 text-brand-700"
                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                aba === key ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-400"
              }`}>
                {dados[key].length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtros ──────────────────────────────────────────────────── */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <select value={doadora} onChange={e => setDoadora(e.target.value)} className={selCls}>
          <option value="">Todas as doadoras</option>
          {opcoes(linhas, "_doadora").map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <select value={touro} onChange={e => setTouro(e.target.value)} className={selCls}>
          <option value="">Todos os touros</option>
          {opcoes(linhas, "_touro").map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <select value={especifico} onChange={e => setEspecifico(e.target.value)} className={selCls}>
          <option value="">{rotuloEspecifico}</option>
          {opcoes(linhas, campoEspecifico).map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">
            {aba === "prenhezes" ? "T.E." : "OPU"}
          </span>
          <input type="date" value={de}  onChange={e => setDe(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-300" />
          <span className="text-gray-300 text-xs">–</span>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-300" />
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…"
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-36 bg-white focus:outline-none focus:ring-1 focus:ring-brand-300" />
        </div>

        {temFiltro && (
          <button onClick={limpar}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600">
            <X className="w-3 h-3" /> limpar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-gray-500">
            {filtradas.length}
            {filtradas.length !== linhas.length && (
              <span className="text-gray-300"> de {linhas.length}</span>
            )}
          </span>
          <ExportarPDF
            titulo={TITULOS[aba]}
            subtitulo={`${filtradas.length} registros · SE Agropecuária Nelore de Elite`}
            orientacao="landscape"
            nomeArquivo={ARQUIVOS[aba]}
            colunas={colunas}
            dados={filtradas}
            dadosCompletos={linhas}
            descricaoFiltro={descricaoFiltro}
          />
        </div>
      </div>

      {/* ── Prévia ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white border-b border-gray-100 text-left">
              {colunasPreview.map(c => (
                <th key={c.key} className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px] whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtradas.slice(0, 50).map((l, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                {colunasPreview.map(c => (
                  <td key={c.key} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                    {l[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={colunasPreview.length} className="px-4 py-10 text-center text-gray-400">
                  Nenhum registro para os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtradas.length > 50 && (
        <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-50">
          Mostrando 50 de {filtradas.length} na prévia. O PDF sai completo.
        </p>
      )}
    </section>
  );
}
