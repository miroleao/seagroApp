import { createClient } from "@/lib/supabase/server";
import { FARM_ID, formatDate } from "@/lib/utils";
import { Scale, ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";
import { Suspense } from "react";
import BuscaPesagens from "./BuscaPesagens";
import FiltroPesagens from "./FiltroPesagens";

export const revalidate = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

type WeightRecord = { id: string; data: string; peso_kg: number };

function sortedWeights(records: WeightRecord[]): WeightRecord[] {
  return [...records].sort((a, b) => a.data.localeCompare(b.data));
}

/** Ponderal: (peso_atual - peso_base) / dias * 1000 g/dia
 *  Usa as duas pesagens mais distantes no tempo.
 *  Se só há uma pesagem não calcula.
 */
function calcPonderal(
  records: WeightRecord[],
  nascimento?: string | null
): number | null {
  const sorted = sortedWeights(records);
  if (sorted.length < 2) return null;

  const primeiro = sorted[0];
  const ultimo   = sorted[sorted.length - 1];

  // Base: usa nascimento do animal se disponível; senão a primeira pesagem
  const baseDate = nascimento
    ? new Date(nascimento + "T12:00:00")
    : new Date(primeiro.data + "T12:00:00");
  const finalDate = new Date(ultimo.data + "T12:00:00");

  const dias = (finalDate.getTime() - baseDate.getTime()) / 86_400_000;
  if (dias <= 0) return null;

  const ponderal = ((ultimo.peso_kg - primeiro.peso_kg) / dias) * 1000;
  return Math.round(ponderal);
}

function classificacaoBadge(ponderal: number | null) {
  if (ponderal === null) return null;
  if (ponderal >= 800) return { label: "Excelente", cls: "bg-green-100 text-green-700" };
  if (ponderal >= 600) return { label: "Bom",       cls: "bg-blue-100 text-blue-700"  };
  return                      { label: "Abaixo",    cls: "bg-red-100 text-red-600"    };
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    DOADORA:   "Doadora",
    TOURO:     "Touro",
    RECEPTORA: "Receptora",
    NASCIDO:   "Nascido",
    DESCARTE:  "Descarte",
  };
  return map[tipo] ?? tipo;
}

function tipoBadgeCls(tipo: string) {
  const map: Record<string, string> = {
    DOADORA:   "bg-purple-100 text-purple-700",
    TOURO:     "bg-blue-100 text-blue-700",
    RECEPTORA: "bg-green-100 text-green-700",
    NASCIDO:   "bg-amber-100 text-amber-700",
    DESCARTE:  "bg-gray-100 text-gray-500",
  };
  return map[tipo] ?? "bg-gray-100 text-gray-500";
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PesagensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const { q, tipo } = await searchParams;
  const query      = (q ?? "").toLowerCase().trim();
  const tipoFiltro = tipo ?? "todos";

  const supabase = await createClient();

  const { data: animaisRaw } = await supabase
    .from("animals")
    .select(`
      id, nome, tipo, rgn, brinco, nascimento,
      weight_records ( id, data, peso_kg )
    `)
    .eq("farm_id", FARM_ID)
    .in("tipo", ["DOADORA", "TOURO", "RECEPTORA", "NASCIDO", "DESCARTE"])
    .order("nome");

  const animais = (animaisRaw ?? []) as Array<{
    id: string;
    nome: string;
    tipo: string;
    rgn?: string | null;
    brinco?: string | null;
    nascimento?: string | null;
    weight_records: WeightRecord[];
  }>;

  // Aplica filtros
  const animaisFiltrados = animais.filter((a) => {
    if (tipoFiltro !== "todos" && a.tipo !== tipoFiltro) return false;
    if (query) {
      return (
        a.nome?.toLowerCase().includes(query) ||
        a.rgn?.toLowerCase().includes(query) ||
        a.brinco?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Pré-calcula stats de cada animal
  const rows = animaisFiltrados.map((a) => {
    const sorted   = sortedWeights(a.weight_records);
    const ultimo   = sorted[sorted.length - 1] ?? null;
    const ponderal = calcPonderal(a.weight_records, a.nascimento);
    const badge    = classificacaoBadge(ponderal);
    return { ...a, sorted, ultimo, ponderal, badge };
  });

  // Cards resumo (sempre de todos, ignora filtro de tipo)
  const comPesagem     = animais.filter(a => a.weight_records.length > 0);
  const excelentes     = comPesagem.filter(a => { const p = calcPonderal(a.weight_records, a.nascimento); return p !== null && p >= 800; });
  const bons           = comPesagem.filter(a => { const p = calcPonderal(a.weight_records, a.nascimento); return p !== null && p >= 600 && p < 800; });
  const abaixo         = comPesagem.filter(a => { const p = calcPonderal(a.weight_records, a.nascimento); return p !== null && p < 600; });
  const semClassif     = comPesagem.filter(a => calcPonderal(a.weight_records, a.nascimento) === null);

  // Dados para o PDF
  const dadosPDF = rows.map((r) => ({
    nome:        r.nome ?? "—",
    tipo:        tipoLabel(r.tipo),
    rgn:         r.rgn ?? r.brinco ?? "—",
    nascimento:  r.nascimento ? new Date(r.nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "—",
    peso_atual:  r.ultimo ? `${r.ultimo.peso_kg.toFixed(1)} kg` : "—",
    data_pesagem:r.ultimo ? new Date(r.ultimo.data + "T12:00:00").toLocaleDateString("pt-BR") : "—",
    ponderal:    r.ponderal !== null ? `${r.ponderal} g/dia` : "—",
    classificacao: r.badge?.label ?? "—",
    qtd_pesagens:`${r.weight_records.length}`,
  }));

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pesagens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {animais.length} animais · {comPesagem.length} com pesagem registrada
          </p>
        </div>
        <ExportarPDF
          titulo="Relatório de Pesagens"
          subtitulo="SE Agropecuária Nelore de Elite"
          orientacao="landscape"
          nomeArquivo="SE_Pesagens.pdf"
          grupos={[
            { key: "Doadora",   label: "Doadoras",   padrao: true },
            { key: "Touro",     label: "Touros",     padrao: true },
            { key: "Receptora", label: "Receptoras", padrao: true },
            { key: "Nascido",   label: "Nascidos",   padrao: true },
            { key: "Descarte",  label: "Descarte",   padrao: false },
          ]}
          campoGrupo="tipo"
          colunas={[
            { key: "nome",         label: "Nome",           padrao: true,  largura: 2.2 },
            { key: "tipo",         label: "Tipo",           padrao: true,  largura: 0.9 },
            { key: "rgn",          label: "RGN / Brinco",   padrao: true,  largura: 1.2 },
            { key: "nascimento",   label: "Nascimento",     padrao: true,  largura: 1.0 },
            { key: "peso_atual",   label: "Peso Atual",     padrao: true,  largura: 0.9 },
            { key: "data_pesagem", label: "Data Pesagem",   padrao: true,  largura: 1.0 },
            { key: "ponderal",     label: "Ponderal",       padrao: true,  largura: 0.9 },
            { key: "classificacao",label: "Classificação",  padrao: true,  largura: 0.9 },
            { key: "qtd_pesagens", label: "Qtd Pesagens",   padrao: false, largura: 0.8 },
          ] satisfies ColunaPDF[]}
          dados={dadosPDF}
        />
      </div>

      {/* ── Cards resumo ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Excelente</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{excelentes.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">≥ 800 g/dia</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Minus className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Bom</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{bons.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">600–799 g/dia</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Abaixo</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{abaixo.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">&lt; 600 g/dia</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Scale className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Sem dados</p>
          </div>
          <p className="text-2xl font-bold text-gray-400">{animais.length - comPesagem.length + semClassif.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">sem pesagem suficiente</p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Suspense fallback={null}><FiltroPesagens active={tipoFiltro} /></Suspense>
        <div className="ml-auto">
          <Suspense fallback={null}><BuscaPesagens /></Suspense>
        </div>
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-400 text-sm">
          {query || tipoFiltro !== "todos"
            ? "Nenhum animal encontrado para os filtros aplicados."
            : "Nenhum animal cadastrado ainda."}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Barra de totais */}
          {(query || tipoFiltro !== "todos") && (
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
              {rows.length} animal{rows.length !== 1 ? "is" : ""} · filtro ativo
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Animal</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">RGN / Brinco</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Nascimento</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Peso Atual</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Data Pesagem</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Ponderal</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Classificação</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Pesagens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => {
                  const animalHref =
                    r.tipo === "DOADORA"   ? `/doadoras/${r.id}`
                    : r.tipo === "TOURO"   ? `/machos/${r.id}`
                    : r.tipo === "RECEPTORA" || r.tipo === "NASCIDO" || r.tipo === "DESCARTE"
                    ? `/rebanho/${r.id}`
                    : null;

                  return (
                    <details key={r.id} className="group">
                      {/* ── Linha principal (summary) ── */}
                      <summary className="list-none cursor-pointer hover:bg-gray-50 transition-colors">
                        <tr className="contents">
                          {/* Animal */}
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <ChevronDown className="w-3.5 h-3.5 text-gray-300 group-open:rotate-180 transition-transform shrink-0" />
                              {animalHref
                                ? <a href={animalHref} onClick={e => e.stopPropagation()} className="hover:text-brand-600 hover:underline transition-colors">{r.nome}</a>
                                : r.nome}
                            </div>
                          </td>
                          {/* Tipo */}
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${tipoBadgeCls(r.tipo)}`}>
                              {tipoLabel(r.tipo)}
                            </span>
                          </td>
                          {/* RGN / Brinco */}
                          <td className="px-4 py-3 text-gray-500 font-mono">
                            {r.rgn ?? r.brinco ?? <span className="text-gray-300">—</span>}
                          </td>
                          {/* Nascimento */}
                          <td className="px-4 py-3 text-gray-500">
                            {r.nascimento ? formatDate(r.nascimento) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Peso atual */}
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            {r.ultimo
                              ? <span>{r.ultimo.peso_kg.toFixed(1)} <span className="text-gray-400 font-normal">kg</span></span>
                              : <span className="text-gray-300 font-normal">—</span>}
                          </td>
                          {/* Data pesagem */}
                          <td className="px-4 py-3 text-gray-500">
                            {r.ultimo ? formatDate(r.ultimo.data) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Ponderal */}
                          <td className="px-4 py-3 text-right">
                            {r.ponderal !== null
                              ? <span className={`font-bold ${r.ponderal >= 800 ? "text-green-600" : r.ponderal >= 600 ? "text-blue-600" : "text-red-600"}`}>
                                  {r.ponderal} <span className="text-[10px] font-normal text-gray-400">g/dia</span>
                                </span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Classificação */}
                          <td className="px-4 py-3">
                            {r.badge
                              ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${r.badge.cls}`}>{r.badge.label}</span>
                              : <span className="text-gray-300 text-[10px]">Sem dados</span>}
                          </td>
                          {/* Qtd pesagens */}
                          <td className="px-4 py-3 text-right text-gray-500 font-medium">
                            {r.weight_records.length > 0
                              ? `${r.weight_records.length}×`
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      </summary>

                      {/* ── Histórico de pesagens (expande ao clicar) ── */}
                      {r.sorted.length > 0 && (
                        <tr>
                          <td colSpan={9} className="px-0 py-0">
                            <div className="bg-gray-50 border-t border-gray-100 px-8 py-3">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">
                                Histórico de pesagens — {r.nome}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {[...r.sorted].reverse().map((w, idx) => {
                                  // Variação em relação à pesagem anterior
                                  const prevIdx = r.sorted.length - 1 - idx - 1;
                                  const prev = prevIdx >= 0 ? r.sorted[prevIdx] : null;
                                  const diff = prev ? w.peso_kg - prev.peso_kg : null;
                                  return (
                                    <div key={w.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs">
                                      <p className="text-gray-400 text-[10px]">{formatDate(w.data)}</p>
                                      <p className="font-bold text-gray-900 text-sm">{w.peso_kg.toFixed(1)} kg</p>
                                      {diff !== null && (
                                        <p className={`text-[10px] font-medium mt-0.5 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                                          {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </details>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
