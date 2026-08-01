import { createClient } from "@/lib/supabase/server";
import { ponderalGDia } from "@/lib/ponderal";
import { formatDate, formatCurrency, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Baby, Star, Trophy, Scale, Plus, TrendingUp, TrendingDown, ShoppingCart, Edit2, Gavel, Heart, ChevronRight } from "lucide-react";
import { toggleParaPista, toggleNascidoSeAgro, toggleParaLeilao, salvarInfoLeilao, atualizarPeso, adicionarPremiacao, registrarPesagem, toggleEmbrioCdc, toggleEmbrioAdt, toggleEmbrioDna, atualizarLocalizacao, atualizarStatusReprodutivo, atualizarTouroPrenhez, adicionarSocio, removerSocio, criarESocio, atualizarGenealogia, atualizarRgn, atualizarPercentualProprio, atualizarValorParcela, corrigirPartos } from "./actions";
import EditarGenealogyForm from "@/components/EditarGenealogyForm";
import AnimalFotoUpload from "@/components/AnimalFotoUpload";
import AnimalDocumentosUpload from "@/components/AnimalDocumentosUpload";
import VendaLeilaoSection from "@/components/VendaLeilaoSection";
import { VendaSyncProvider } from "@/components/VendaSyncContext";
import { FormPremiacao } from "./FormPremiacao";
import { ReproStatusForm } from "@/components/ui/ReproStatusForm";
import { EditReprodutivoInline } from "@/app/rebanho/EditReprodutivoInline";
import { NascimentoDoadoraForm } from "./NascimentoDoadoraForm";
import { VincularFilhoteParida } from "./VincularFilhoteParida";

// Mapa de cores para cada status reprodutivo
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  COLETANDO:  { label: "Coletando",  cls: "bg-purple-100 text-purple-700" },
  INSEMINADA: { label: "Inseminada", cls: "bg-amber-100  text-amber-700"  },
  GESTANTE:   { label: "Prenha",     cls: "bg-green-100  text-green-700"  },
  PARIDA:     { label: "Parida",     cls: "bg-indigo-100 text-indigo-700" },
  ABORTOU:    { label: "Abortou",    cls: "bg-rose-100   text-rose-700"   },
  VAZIA:      { label: "Vazia",      cls: "bg-gray-100   text-gray-500"   },
  SECA:       { label: "Seca",       cls: "bg-orange-100 text-orange-700" },
  DESCARTADA: { label: "Descartada", cls: "bg-red-100    text-red-600"    },
  VENDIDA:    { label: "Vendida",    cls: "bg-blue-100   text-blue-700"   },
};

/** Retorna "1º", "2º", "3º", etc. */
function ordinal(n: number): string {
  return `${n}º`;
}

/** Calcula meses inteiros entre duas datas ISO (YYYY-MM-DD) */
function mesesEntre(dataInicio: string | null, dataFim: string | null): number | null {
  if (!dataInicio || !dataFim) return null;
  const inicio = new Date(dataInicio);
  const fim    = new Date(dataFim);
  return (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());
}

/** Dias exatos entre duas datas */
function diasEntre(dataInicio: string | null, dataFim: string | null): number | null {
  if (!dataInicio || !dataFim) return null;
  const a = new Date(dataInicio), b = new Date(dataFim);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Ponderal (g/dia) = peso_kg × 1000 ÷ dias_de_vida */
// Cálculo canônico em @/lib/ponderal (desconta o peso de nascimento).
const calcPonderal = ponderalGDia;

// ─── Grupos ABCZ — Regulamento ExpZebu 2025/2026 (Art. 29°) ─────────────────
const GRUPOS_ABCZ: { nome: string; sexo: "F" | "M"; min: number; max: number }[] = [
  { nome: "Bezerra Menor",  sexo: "F", min:  6, max:  9 },
  { nome: "Bezerra Maior",  sexo: "F", min:  9, max: 12 },
  { nome: "Novilha Menor",  sexo: "F", min: 12, max: 16 },
  { nome: "Novilha",        sexo: "F", min: 16, max: 20 },
  { nome: "Novilha Maior",  sexo: "F", min: 20, max: 24 },
  { nome: "Vaca Jovem",     sexo: "F", min: 24, max: 30 },
  { nome: "Vaca",           sexo: "F", min: 30, max: 36 },
  { nome: "Vaca Adulta",    sexo: "F", min: 36, max: 42 },
  { nome: "Bezerro Menor",  sexo: "M", min:  6, max:  9 },
  { nome: "Bezerro Maior",  sexo: "M", min:  9, max: 12 },
  { nome: "Júnior Menor",   sexo: "M", min: 12, max: 16 },
  { nome: "Júnior",         sexo: "M", min: 16, max: 20 },
  { nome: "Júnior Maior",   sexo: "M", min: 20, max: 24 },
  { nome: "Touro Jovem",    sexo: "M", min: 24, max: 30 },
  { nome: "Touro Sênior",   sexo: "M", min: 30, max: 36 },
];

function categoriaPista(nascimento: string | null, sexo: "F" | "M"): string | null {
  const hoje = new Date().toISOString().split("T")[0];
  const meses = mesesEntre(nascimento, hoje);
  if (meses == null) return null;
  return GRUPOS_ABCZ.find(g => g.sexo === sexo && meses >= g.min && meses < g.max)?.nome ?? null;
}

/** Classificação simplificada do ponderal por faixa etária (Nelore) */
function classificarPonderal(gdia: number, meses: number): { label: string; cls: string } {
  if (meses <= 8) {
    if (gdia >= 900) return { label: "Excelente", cls: "text-green-600" };
    if (gdia >= 700) return { label: "Bom",       cls: "text-blue-600"  };
    return              { label: "Abaixo",         cls: "text-orange-500"};
  }
  if (meses <= 18) {
    if (gdia >= 700) return { label: "Excelente", cls: "text-green-600" };
    if (gdia >= 550) return { label: "Bom",       cls: "text-blue-600"  };
    return              { label: "Abaixo",         cls: "text-orange-500"};
  }
  if (gdia >= 600) return { label: "Excelente", cls: "text-green-600" };
  if (gdia >= 450) return { label: "Bom",       cls: "text-blue-600"  };
  return              { label: "Abaixo",         cls: "text-orange-500"};
}

// ── DocChip toggle para embrião dentro da ficha da doadora ────────────────────
function DocChipDoadora({
  label,
  checked,
  embryoId,
  doadoraId,
  campo,
  obsBaseVal,
}: {
  label: string;
  checked: boolean;
  embryoId: string;
  doadoraId: string;
  campo: "cdc" | "adt" | "dna";
  obsBaseVal?: string;
}) {
  const action =
    campo === "cdc" ? toggleEmbrioCdc :
    campo === "adt" ? toggleEmbrioAdt :
    toggleEmbrioDna;

  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="embryo_id" value={embryoId} />
      <input type="hidden" name="doadora_id" value={doadoraId} />
      <input type="hidden" name="atual" value={checked ? "sim" : "nao"} />
      {campo === "dna" && <input type="hidden" name="obs_base" value={obsBaseVal ?? ""} />}
      <button
        type="submit"
        title={checked ? `Remover ${label}` : `Marcar ${label}`}
        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold border cursor-pointer transition-colors ${
          checked
            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
            : "bg-gray-50 text-gray-400 border-gray-200 hover:border-brand-300 hover:text-brand-600"
        }`}
      >
        {checked ? "✓" : "○"} {label}
      </button>
    </form>
  );
}

// ── Genealogia ────────────────────────────────────────────────────────────────
function PedCell({
  label,
  name,
  sub,
  highlight,
  linhagem,
}: {
  label: string;
  name?: string | null;
  sub?: string | null;
  highlight?: boolean;
  linhagem?: "pai" | "mae";
}) {
  const base = "flex flex-col justify-center px-2.5 py-2 rounded-lg border text-xs h-full overflow-hidden";

  let style: string;
  if (highlight)            style = "bg-brand-50 border-brand-200";
  else if (linhagem === "pai") style = name ? "bg-blue-50 border-blue-200"  : "bg-white border-dashed border-blue-100";
  else if (linhagem === "mae") style = name ? "bg-rose-50 border-rose-200"  : "bg-white border-dashed border-rose-100";
  else                      style = name ? "bg-gray-50 border-gray-200"  : "bg-white border-dashed border-gray-200";

  const labelColor = highlight         ? "text-brand-500"
    : linhagem === "pai"               ? "text-blue-400"
    : linhagem === "mae"               ? "text-rose-400"
    : "text-gray-400";

  const nameColor = highlight          ? "text-brand-800"
    : linhagem === "pai"               ? "text-blue-900"
    : linhagem === "mae"               ? "text-rose-900"
    : name                             ? "text-gray-800"
    : "text-gray-300";

  return (
    <div className={`${base} ${style}`}>
      <p className={`text-[9px] uppercase tracking-wide mb-0.5 leading-none ${labelColor}`}>{label}</p>
      <p className={`font-semibold leading-tight truncate ${nameColor}`}>
        {name ?? "—"}
      </p>
      {sub && <p className="text-[9px] text-gray-400 leading-none mt-0.5 font-mono truncate">{sub}</p>}
    </div>
  );
}

function Genealogia({ animal }: { animal: any }) {
  const hasAny =
    animal.pai_nome || animal.mae_nome ||
    animal.avo_paterno || animal.avo_paterna ||
    animal.avo_materno || animal.avo_materna ||
    animal.bisavo_pat_pat || animal.bisava_pat_pat ||
    animal.bisavo_pat_mat || animal.bisava_pat_mat ||
    animal.bisavo_materno || animal.bisava_mat_pat ||
    animal.bisavo_materna || animal.bisavo;

  if (!hasAny) {
    return (
      <p className="text-sm text-gray-400 italic">Genealogia não cadastrada.</p>
    );
  }

  // Layout: 4 colunas × 8 linhas
  // Col 1: Animal (linhas 1–8)
  // Col 2: Pai (1–4) / Mãe (5–8)
  // Col 3: Avô Pat. (1–2) / Avó Pat. (3–4) / Avô Mat. (5–6) / Avó Mat. (7–8)
  // Col 4: 8 bisavós (1 linha cada)
  const ROW_H = 46;
  const ROWS  = 8;
  const GAP   = 3;

  return (
    <div className="overflow-x-auto">
      {/* Cabeçalhos das colunas */}
      <div
        className="min-w-[580px] mb-1"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: `${GAP}px` }}
      >
        <div />
        {(["Pais", "Avós", "Bisavós"] as const).map((col) => (
          <div key={col} className="text-center">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">{col}</span>
          </div>
        ))}
      </div>

      <div
        className="min-w-[580px]"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: `repeat(${ROWS}, ${ROW_H}px)`,
          gap: `${GAP}px`,
        }}
      >
        {/* Col 1 — Animal */}
        <div style={{ gridColumn: "1", gridRow: `1 / span ${ROWS}` }}>
          <PedCell label="Animal" name={animal.nome} sub={animal.rgn} highlight />
        </div>

        {/* Col 2 — Pai / Mãe */}
        <div style={{ gridColumn: "2", gridRow: "1 / span 4" }}>
          <PedCell label="Pai" name={animal.pai_nome} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "2", gridRow: "5 / span 4" }}>
          <PedCell label="Mãe" name={animal.mae_nome} linhagem="mae" />
        </div>

        {/* Col 3 — Avós */}
        <div style={{ gridColumn: "3", gridRow: "1 / span 2" }}>
          <PedCell label="Avô Paterno" name={animal.avo_paterno} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "3", gridRow: "3 / span 2" }}>
          <PedCell label="Avó Paterna" name={animal.avo_paterna} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "3", gridRow: "5 / span 2" }}>
          <PedCell label="Avô Materno" name={animal.avo_materno} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "3", gridRow: "7 / span 2" }}>
          <PedCell label="Avó Materna" name={animal.avo_materna} linhagem="mae" />
        </div>

        {/* Col 4 — Bisavós (1 linha cada) */}
        <div style={{ gridColumn: "4", gridRow: "1" }}>
          <PedCell label="Bisavô" name={animal.bisavo_pat_pat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "2" }}>
          <PedCell label="Bisavó" name={animal.bisava_pat_pat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "3" }}>
          <PedCell label="Bisavô" name={animal.bisavo_pat_mat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "4" }}>
          <PedCell label="Bisavó" name={animal.bisava_pat_mat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "5" }}>
          <PedCell label="Bisavô" name={animal.bisavo_materno} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "6" }}>
          <PedCell label="Bisavó" name={animal.bisava_mat_pat} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "7" }}>
          <PedCell label="Bisavô" name={animal.bisavo_materna} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "8" }}>
          <PedCell label="Bisavó" name={animal.bisavo} linhagem="mae" />
        </div>
      </div>
    </div>
  );
}

// ── Helper para parsear campos das observações (chave:valor|...) ──────────────
function parseObsKey(obs: string | null | undefined, key: string): string | null {
  if (!obs) return null;
  const m = obs.match(new RegExp(`${key}:([^|]+)`));
  return m ? m[1].trim() : null;
}

// ── ROI Section ───────────────────────────────────────────────────────────────
function ROISection({
  totalVendas,
  totalCompras,
  parcelaMensalVendas,
  parcelaMensalCusto,
  valorParcelaManual,
  parcelaCompra,
  numParcelasCompra,
  leilaoCompra,
  animalId,
}: {
  totalVendas: number;
  totalCompras: number;
  parcelaMensalVendas: number;
  parcelaMensalCusto: number;
  valorParcelaManual: number;
  parcelaCompra?: number;
  numParcelasCompra?: number;
  leilaoCompra?: string | null;
  animalId: string;
}) {
  const totalPrenhez = (parcelaCompra ?? 0) * (numParcelasCompra ?? 0);
  const saldo        = totalVendas - totalCompras - totalPrenhez;
  const positivo     = saldo >= 0;

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm">
        {positivo
          ? <TrendingUp className="w-4 h-4 text-green-600" />
          : <TrendingDown className="w-4 h-4 text-red-500" />}
        Desempenho Financeiro (ROI)
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">

        {/* Receita (vendas) */}
        <div>
          {totalVendas > 0 ? (
            <>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalVendas)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total recebido</p>
              {parcelaMensalVendas > 0 && (
                <p className="text-xs text-green-400 mt-0.5">{formatCurrency(parcelaMensalVendas)}/mês</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-300">—</p>
              <p className="text-xs text-gray-400 mt-0.5">Total recebido</p>
              <p className="text-xs text-gray-300 mt-0.5 italic">sem vendas registradas</p>
            </>
          )}
        </div>

        {/* Custo (compras) — editável inline como fallback */}
        <div>
          {totalCompras > 0 ? (
            <>
              <p className="text-xl font-bold text-red-500">{formatCurrency(totalCompras)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total investido</p>
              {parcelaMensalCusto > 0 && (
                <p className="text-xs text-red-300 mt-0.5">{formatCurrency(parcelaMensalCusto)}/mês</p>
              )}
            </>
          ) : (
            <details className="group">
              <summary className="list-none cursor-pointer">
                {valorParcelaManual > 0 ? (
                  <>
                    <p className="text-xl font-bold text-red-400 group-hover:opacity-80 transition-opacity">
                      {formatCurrency(valorParcelaManual)}/mês
                      <Edit2 className="inline w-3 h-3 text-gray-300 group-hover:text-gray-500 ml-1 transition-colors" />
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Parcela mensal (manual)</p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-gray-300 group-hover:opacity-80 transition-opacity">
                    — <Edit2 className="inline w-3 h-3 text-gray-300 group-hover:text-gray-500 ml-1 transition-colors" />
                  </p>
                )}
              </summary>
              <form action={atualizarValorParcela} className="mt-2 flex items-center justify-center gap-2">
                <input type="hidden" name="id" value={animalId} />
                <input
                  name="valor_parcela"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={valorParcelaManual > 0 ? valorParcelaManual : ""}
                  placeholder="0,00"
                  className="w-28 border border-brand-400 bg-white rounded px-2 py-1 text-sm outline-none ring-1 ring-brand-200 text-center"
                />
                <button type="submit"
                  className="text-xs bg-brand-600 text-white px-2 py-1 rounded hover:bg-brand-700 transition-colors">
                  OK
                </button>
              </form>
              {!valorParcelaManual && <p className="text-xs text-gray-400 mt-0.5">Parcela mensal</p>}
            </details>
          )}
        </div>

        {/* Saldo ROI */}
        <div className={`rounded-lg p-3 ${positivo ? "bg-green-50" : "bg-red-50"}`}>
          <p className={`text-xl font-bold ${positivo ? "text-green-700" : "text-red-600"}`}>
            {positivo ? "+" : ""}{formatCurrency(saldo)}
          </p>
          <p className={`text-xs mt-0.5 ${positivo ? "text-green-500" : "text-red-400"}`}>
            Saldo (ROI)
          </p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            {formatCurrency(totalVendas)} receita<br />
            − {formatCurrency(totalCompras + totalPrenhez)} custo
          </p>
        </div>

      </div>

      {/* Custo de aquisição via prenhez comprada */}
      {(parcelaCompra ?? 0) > 0 && (
        <div className="mt-3 p-3 bg-orange-50 border border-orange-100 rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="text-xs font-semibold text-orange-700">
                Custo de aquisição (prenhez comprada)
                {leilaoCompra ? <span className="font-normal text-orange-500"> — {leilaoCompra}</span> : ""}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-orange-600">{formatCurrency(parcelaCompra!)}/parcela</span>
              {(numParcelasCompra ?? 0) > 0 && (
                <span className="text-orange-400 text-xs">
                  × {numParcelasCompra} = <span className="font-semibold text-orange-600">{formatCurrency(totalPrenhez)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const revalidate = 0;

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DoadoraDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Doadora
  const { data: doadora } = await supabase
    .from("animals")
    .select(`
      *,
      socios:animal_partners (
        id,
        partner_id,
        percentual,
        valor_parcela,
        partner:partners ( id, nome, telefone, email )
      )
    `)
    .eq("id", id)
    .single();

  // Lista de todos os sócios cadastrados (para o select de adição)
  const { data: todosPartners } = await supabase
    .from("partners")
    .select("id, nome")
    .eq("farm_id", FARM_ID)
    .order("nome", { ascending: true });

  // Aspirações
  const { data: aspiracoes } = await supabase
    .from("aspirations")
    .select(`
      *,
      session:opu_sessions ( data, tipo, responsavel, local )
    `)
    .eq("doadora_id", id)
    .order("session(data)", { ascending: true });

  // Histórico de pesagens
  const { data: pesagens } = await supabase
    .from("weight_records")
    .select("id, data, peso_kg")
    .eq("animal_id", id)
    .order("data", { ascending: false });

  // Premiações do animal
  const { data: premiacoes } = await supabase
    .from("awards")
    .select(`
      id, tipo_premio, grupo_nelore, observacoes,
      exhibition:exhibitions ( id, nome, data_base, local )
    `)
    .eq("animal_id", id)
    .order("criado_em", { ascending: false });

  // Exposições para o select de nova premiação
  const { data: exposicoes } = await supabase
    .from("exhibitions")
    .select("id, nome, data_base")
    .eq("farm_id", FARM_ID)
    .order("data_base", { ascending: false });

  // Animais da fazenda (doadoras + touros) para vincular como nascidos
  const { data: animaisVincular } = await supabase
    .from("animals")
    .select("id, nome, tipo")
    .eq("farm_id", FARM_ID)
    .in("tipo", ["DOADORA", "TOURO"])
    .order("nome");

  // Histórico reprodutivo: prenhezes naturais desta doadora
  const { data: prenhezes_historico } = await supabase
    .from("prenhezes_naturais")
    .select(`
      id, data_inseminacao, touro_nome, touro_rgd,
      data_parto, resultado, criado_em,
      animal_nascido:animals!prenhezes_naturais_animal_nascido_id_fkey (
        id, nome, tipo, rgn
      )
    `)
    .eq("doadora_id", id)
    .order("data_parto", { ascending: false, nullsFirst: false })
    .order("data_inseminacao", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false });

  // Info de leilão do animal
  const { data: leilaoInfo } = await supabase
    .from("animal_leilao_info")
    .select("*")
    .eq("animal_id", id)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  // Embriões — guard: só busca se há aspirações
  const aspIds = (aspiracoes ?? []).map((a: any) => a.id);
  let embrioes: any[] = [];
  if (aspIds.length > 0) {
    const { data } = await supabase
      .from("embryos")
      .select(`
        id, aspiration_id, sexagem, status, numero_cdc_fiv, numero_adt_te, observacoes,
        aspiration:aspirations (
          id, touro_nome,
          session:opu_sessions ( data )
        ),
        transfers:transfers!transfers_embryo_id_fkey (
          id, receptora_brinco,
          receptora:animals!transfers_receptora_id_fkey ( id, nome, brinco, status_rebanho ),
          pregnancy_diagnoses ( resultado, data_previsao_parto )
        )
      `)
      .eq("farm_id", FARM_ID)
      .in("aspiration_id", aspIds)
      .order("status", { ascending: true });
    embrioes = data ?? [];
  }

  // Agrupar embriões por aspiração (data OPU)
  type GrupoEmb = {
    aspId: string;
    data: string | null;
    touro: string | null;
    total: number;
    disponiveis: number;  // estoque congelado (status DISPONIVEL)
    implantados: number;  // já transferidos (status IMPLANTADO)
    femeas: number;
    machos: number;
    naoSex: number;
    comPrenhez: number;   // prenhezes confirmadas (DG POSITIVO)
    embryos: any[];
  };
  const embGrupos: Record<string, GrupoEmb> = {};
  for (const e of embrioes) {
    const asp    = e.aspiration as any;
    const aspId  = e.aspiration_id;
    const data   = asp?.session?.data ?? null;
    const touro  = asp?.touro_nome ?? null;
    if (!embGrupos[aspId]) {
      embGrupos[aspId] = { aspId, data, touro, total: 0, disponiveis: 0, implantados: 0, femeas: 0, machos: 0, naoSex: 0, comPrenhez: 0, embryos: [] };
    }
    embGrupos[aspId].total++;
    if (e.status === "DISPONIVEL")  embGrupos[aspId].disponiveis++;
    if (e.status === "IMPLANTADO")  embGrupos[aspId].implantados++;
    if (e.sexagem === "FEMEA")      embGrupos[aspId].femeas++;
    else if (e.sexagem === "MACHO") embGrupos[aspId].machos++;
    else                            embGrupos[aspId].naoSex++;
    // Contar prenhezes positivas
    const transfers: any[] = e.transfers ?? [];
    const temPrenhez = transfers.some((t: any) =>
      (t.pregnancy_diagnoses ?? []).some((dg: any) => dg.resultado === "POSITIVO")
    );
    if (temPrenhez) embGrupos[aspId].comPrenhez++;
    embGrupos[aspId].embryos.push(e);
  }
  const embGruposList = Object.values(embGrupos)
    .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));

  // Transações vinculadas ao ROI (COMPRA + VENDA):
  // Prioridade 1 — transaction_animals (junction moderna)
  // Prioridade 2 — doadora_id (link direto)
  // Prioridade 3 — ilike no animal_nome (legado)
  const nomeDoadora = doadora?.nome ?? "";

  // 1. IDs via junction table
  const { data: taRows } = await supabase
    .from("transaction_animals")
    .select("transaction_id")
    .eq("animal_id", id);
  const junctionIds = (taRows ?? []).map((r: any) => r.transaction_id as string);

  // 2. Transações via junction (com installments)
  const txSelectFields = "id, tipo, valor_total, n_parcelas, categoria, animal_nome, installments(numero, valor)";
  const { data: txsViaJunction } = junctionIds.length > 0
    ? await supabase
        .from("transactions")
        .select(txSelectFields)
        .eq("farm_id", FARM_ID)
        .in("id", junctionIds)
    : { data: [] as any[] };

  // 3. Transações via doadora_id (não presentes na junction)
  const { data: txsViaId } = await supabase
    .from("transactions")
    .select(txSelectFields)
    .eq("farm_id", FARM_ID)
    .eq("doadora_id", id);

  // 4. Legado: via animal_nome sem doadora_id
  const { data: txsViaName } = nomeDoadora
    ? await supabase
        .from("transactions")
        .select(txSelectFields)
        .eq("farm_id", FARM_ID)
        .is("doadora_id", null)
        .ilike("animal_nome", `%${nomeDoadora}%`)
    : { data: [] as any[] };

  // Deduplica por id
  const seenTxIds = new Set<string>();
  const todasTxs: any[] = [];
  for (const tx of [
    ...(txsViaJunction ?? []),
    ...(txsViaId ?? []),
    ...(txsViaName ?? []),
  ]) {
    if (tx?.id && !seenTxIds.has(tx.id)) {
      seenTxIds.add(tx.id);
      todasTxs.push(tx);
    }
  }

  // Transação de compra com dados de leilão (para auto-preencher "Leilão onde Comprou")
  let txCompraLeilao: any = null;
  if (junctionIds.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select(`tipo, valor_total, n_parcelas, data, auction:auctions ( nome, data )`)
      .eq("farm_id", FARM_ID)
      .eq("tipo", "COMPRA")
      .in("id", junctionIds)
      .maybeSingle();
    txCompraLeilao = data ?? null;
  }
  if (!txCompraLeilao) {
    const { data } = await supabase
      .from("transactions")
      .select(`tipo, valor_total, n_parcelas, data, auction:auctions ( nome, data )`)
      .eq("farm_id", FARM_ID)
      .eq("doadora_id", id)
      .eq("tipo", "COMPRA")
      .maybeSingle();
    txCompraLeilao = data ?? null;
  }

  const compraLeilaoNome   = leilaoInfo?.compra_leilao_nome   ?? (txCompraLeilao as any)?.auction?.nome ?? null;
  const compraLeilaoData   = leilaoInfo?.compra_leilao_data   ?? (txCompraLeilao as any)?.auction?.data ?? (txCompraLeilao as any)?.data ?? null;
  const compraValorParcela = leilaoInfo?.compra_valor_parcela ??
    (txCompraLeilao?.valor_total && txCompraLeilao?.n_parcelas
      ? parseFloat((txCompraLeilao.valor_total / txCompraLeilao.n_parcelas).toFixed(2))
      : null);

  // Prenhez de origem — se este animal nasceu de uma prenhez comprada
  const { data: prenhez } = await supabase
    .from("aspirations")
    .select("observacoes")
    .eq("animal_nascido_id", id)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  const parcelaCompra    = prenhez ? parseFloat(parseObsKey(prenhez.observacoes, "PARCELA")     ?? "0") || 0 : 0;
  const numParcelasCompra= prenhez ? parseInt(  parseObsKey(prenhez.observacoes, "NUM_PARCELAS") ?? "0") || 0 : 0;
  const leilaoCompra     = prenhez ? parseObsKey(prenhez.observacoes, "LEILAO") : null;

  if (!doadora) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Doadora não encontrada.</p>
        <Link href="/doadoras" className="text-brand-600 text-sm mt-2 inline-block">← Voltar</Link>
      </div>
    );
  }

  const percentualProprio = doadora.percentual_proprio != null
    ? `${(doadora.percentual_proprio * 100).toFixed(0)}%`
    : "—";

  // Última prenhez parida (para link do filhote no card de status)
  const ultimaParida = (prenhezes_historico ?? []).find((p: any) => p.resultado === "PARIDA");
  const filhoteUltimoParto = ultimaParida ? (ultimaParida.animal_nascido as any) : null;

  // ── Cálculo ROI ──────────────────────────────────────────────────
  function getParcelaMensalTx(tx: any): number {
    const inst: any[] = [...(tx.installments ?? [])].sort((a: any, b: any) => a.numero - b.numero);
    const n = tx.n_parcelas ?? (inst.length > 0 ? inst.length : 1);
    return inst[0]?.valor ?? (tx.valor_total != null ? tx.valor_total / n : 0);
  }

  const vendasTxs  = todasTxs.filter(t => t.tipo === "VENDA");
  const comprasTxs = todasTxs.filter(t => t.tipo === "COMPRA");

  const totalVendas         = vendasTxs.reduce((s, t) => s + (t.valor_total ?? 0), 0);
  const totalCompras        = comprasTxs.reduce((s, t) => s + (t.valor_total ?? 0), 0);
  const parcelaMensalVendas = vendasTxs.reduce((s, t) => s + getParcelaMensalTx(t), 0);
  const parcelaMensalCusto  = comprasTxs.reduce((s, t) => s + getParcelaMensalTx(t), 0);
  const valorParcela        = doadora.valor_parcela ?? 0;

  const totalEmbrioes    = embrioes.length;
  const totalDisponiveis = embrioes.filter(e => e.status === "DISPONIVEL").length;

  return (
    <VendaSyncProvider>
    <div className="p-6 space-y-6">
      {/* Voltar */}
      <Link href="/doadoras" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Voltar para Doadoras
      </Link>

      {/* Cabeçalho */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row items-start gap-5">
          {/* Foto do animal */}
          <div className="shrink-0 self-center md:self-start">
            <AnimalFotoUpload
              animalId={doadora.id}
              fotoAtual={(doadora as any).photo_url ?? null}
              nomeAnimal={doadora.nome}
            />
          </div>

          <div className="flex-1 min-w-0 w-full">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{doadora.nome}</h1>
            {/* RGN com edição inline */}
            <details className="group mt-0.5">
              <summary className="list-none flex items-center gap-1.5 cursor-pointer w-fit">
                <span className="text-sm text-gray-500 font-mono">
                  {doadora.rgn ? `RGN: ${doadora.rgn}` : <span className="text-gray-300 italic text-xs">RGN não informado</span>}
                </span>
                <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
              </summary>
              <form action={atualizarRgn} className="mt-1.5 flex items-center gap-2">
                <input type="hidden" name="id" value={doadora.id} />
                <input name="rgn" type="text" defaultValue={doadora.rgn ?? ""}
                  placeholder="Número do RGN…"
                  className="w-36 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-300" />
                <button type="submit"
                  className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1 rounded-lg transition-colors">
                  Salvar
                </button>
              </form>
            </details>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="badge bg-pink-100 text-pink-700 text-sm px-3 py-1">DOADORA</span>
            {doadora.localizacao && (
              <span className="badge bg-gray-100 text-gray-600 text-sm px-3 py-1">{doadora.localizacao}</span>
            )}
            {/* Toggle Nascido SE Agro */}
            <form action={toggleNascidoSeAgro}>
              <input type="hidden" name="id" value={doadora.id} />
              <input type="hidden" name="nascido_se_agro" value={(doadora as any).nascido_se_agro ? "false" : "true"} />
              <button
                type="submit"
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
                  (doadora as any).nascido_se_agro
                    ? "bg-brand-600 text-white border-brand-600 hover:bg-brand-700"
                    : "bg-white text-gray-500 border-gray-200 hover:border-brand-400 hover:text-brand-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-se.png" alt="" className="h-4 w-auto" style={{ filter: (doadora as any).nascido_se_agro ? "brightness(0) invert(1)" : "brightness(0)" }} />
                {(doadora as any).nascido_se_agro ? "Nascido SE Agro" : "Marcar como SE Agro"}
              </button>
            </form>

            {/* Toggle Para Pista */}
            <div className="flex flex-col gap-0.5">
              <form action={toggleParaPista}>
                <input type="hidden" name="id" value={doadora.id} />
                <input type="hidden" name="para_pista" value={doadora.para_pista ? "false" : "true"} />
                <button
                  type="submit"
                  className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
                    doadora.para_pista
                      ? "bg-yellow-400 text-yellow-900 border-yellow-400 hover:bg-yellow-300"
                      : "bg-white text-gray-500 border-gray-200 hover:border-yellow-400 hover:text-yellow-600"
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${doadora.para_pista ? "fill-yellow-700" : ""}`} />
                  {doadora.para_pista ? "Selecionada para Pista" : "Marcar para Pista"}
                </button>
              </form>
              {doadora.para_pista && (() => {
                const cat = categoriaPista(doadora.nascimento ?? null, "F");
                return cat ? (
                  <p className="text-[10px] text-gray-400 pl-1">
                    Categoria ABCZ: <span className="font-medium text-gray-500">{cat}</span>
                  </p>
                ) : null;
              })()}
            </div>

            {/* Toggle Para Leilão */}
            <form action={toggleParaLeilao}>
              <input type="hidden" name="id" value={doadora.id} />
              <input type="hidden" name="para_leilao" value={(doadora as any).para_leilao ? "false" : "true"} />
              <button
                type="submit"
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
                  (doadora as any).para_leilao
                    ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                    : "bg-white text-gray-500 border-gray-200 hover:border-amber-400 hover:text-amber-600"
                }`}
              >
                <Gavel className="w-3.5 h-3.5" />
                {(doadora as any).para_leilao ? "Para Leilão" : "Preparar para Leilão"}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {/* Nascimento + badge de parto */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Nascimento</p>
            <p className="font-medium text-gray-900">{formatDate(doadora.nascimento)}</p>
            {/* Badges de parto + edição inline */}
            {(doadora as any).numero_partos > 0 && (doadora as any).data_ultimo_parto && (
              <div className="mt-1.5 flex flex-col gap-1">
                {(doadora as any).data_primeiro_parto && (() => {
                  const meses1 = mesesEntre(doadora.nascimento, (doadora as any).data_primeiro_parto);
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">
                      🐄 1º Parto · {meses1 != null ? `${meses1} meses` : formatDate((doadora as any).data_primeiro_parto)}
                    </span>
                  );
                })()}
                {(doadora as any).numero_partos > 1 && (doadora as any).data_ultimo_parto !== (doadora as any).data_primeiro_parto && (() => {
                  const n      = (doadora as any).numero_partos as number;
                  const mesesN = mesesEntre(doadora.nascimento, (doadora as any).data_ultimo_parto);
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">
                      🐄 {ordinal(n)} Parto · {mesesN != null ? `${mesesN} meses` : formatDate((doadora as any).data_ultimo_parto)}
                    </span>
                  );
                })()}
              </div>
            )}
            {/* Corrigir partos — edição inline */}
            <details className="group mt-1.5">
              <summary className="list-none cursor-pointer text-[10px] text-gray-300 hover:text-gray-500 transition-colors select-none">
                ✏ corrigir partos
              </summary>
              <form action={corrigirPartos} className="mt-2 space-y-1.5 bg-orange-50 border border-orange-100 rounded-lg p-2.5">
                <input type="hidden" name="id" value={doadora.id} />
                <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide mb-1">Corrigir contagem de partos</p>
                <div className="flex flex-wrap gap-2">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-gray-500">Nº de partos</label>
                    <input
                      name="numero_partos"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={(doadora as any).numero_partos ?? ""}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-300 text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-gray-500">1º parto</label>
                    <input
                      name="data_primeiro_parto"
                      type="date"
                      defaultValue={(doadora as any).data_primeiro_parto ?? ""}
                      className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-gray-500">Último parto</label>
                    <input
                      name="data_ultimo_parto"
                      type="date"
                      defaultValue={(doadora as any).data_ultimo_parto ?? ""}
                      className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-300"
                    />
                  </div>
                </div>
                <button type="submit"
                  className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded transition-colors font-medium">
                  Salvar correção
                </button>
              </form>
            </details>
          </div>

          {/* % Próprio — editável inline */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">% Próprio</p>
            <form action={atualizarPercentualProprio} className="flex items-center gap-2">
              <input type="hidden" name="id" value={doadora.id} />
              <input
                name="percentual_proprio"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={
                  doadora.percentual_proprio != null
                    ? Math.round(doadora.percentual_proprio * 100)
                    : ""
                }
                placeholder="Ex: 75"
                className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <span className="text-sm text-gray-500">%</span>
              <button type="submit"
                className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                Salvar
              </button>
            </form>
          </div>

          {/* Vl. Parcela */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Vl. Parcela</p>
            <p className="font-medium text-gray-900">
              {doadora.valor_parcela != null ? formatCurrency(doadora.valor_parcela) : "—"}
            </p>
          </div>

          {/* Status Reprodutivo — formulário contextual (client component) */}
          <div className="col-span-2 md:col-span-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Status Reprodutivo</p>

            {/* Resumo visual do status atual */}
            {doadora.status_reprodutivo && STATUS_MAP[doadora.status_reprodutivo] && (
              <div className="mb-3 p-3 bg-gray-50 border border-gray-100 rounded-lg space-y-2">

                {/* Linha 1: badge + data */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge text-xs px-2 py-1 font-semibold ${STATUS_MAP[doadora.status_reprodutivo].cls}`}>
                    {STATUS_MAP[doadora.status_reprodutivo].label}
                  </span>
                  {(doadora as any).data_status && (
                    <span className="text-xs text-gray-500">
                      em {formatDate((doadora as any).data_status)}
                    </span>
                  )}
                </div>

                {/* Touro da prenhez atual (INSEMINADA / GESTANTE) */}
                {(doadora as any).touro_prenhez && doadora.status_reprodutivo !== "PARIDA" && (
                  <p className="text-xs text-gray-700">
                    🐂 <span className="font-medium">{(doadora as any).touro_prenhez}</span>
                    {(doadora as any).rgd_touro_prenhez && (
                      <span className="text-gray-400 font-mono ml-1">({(doadora as any).rgd_touro_prenhez})</span>
                    )}
                  </p>
                )}

                {/* Previsão de parto — 290 dias após inseminação, só quando Prenha */}
                {doadora.status_reprodutivo === "GESTANTE" && (doadora as any).data_inseminacao && (() => {
                  const insem = new Date((doadora as any).data_inseminacao);
                  insem.setDate(insem.getDate() + 290);
                  const previsto = insem.toISOString().split("T")[0];
                  const hoje = new Date().toISOString().split("T")[0];
                  const diasRestantes = Math.round(
                    (new Date(previsto).getTime() - new Date(hoje).getTime()) / 86400000
                  );
                  const passou = diasRestantes < 0;
                  return (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      passou
                        ? "bg-rose-50 text-rose-600 border border-rose-200"
                        : diasRestantes <= 30
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-green-50 text-green-700 border border-green-200"
                    }`}>
                      🗓 Prev. parto: {formatDate(previsto)}
                      <span className="font-normal opacity-75">
                        ({passou ? `${Math.abs(diasRestantes)}d atraso` : `${diasRestantes}d`})
                      </span>
                    </span>
                  );
                })()}

                {/* Card de parto — status PARIDA */}
                {doadora.status_reprodutivo === "PARIDA" && (
                  <div className="mt-1 space-y-1.5">
                    {/* Touro */}
                    {(doadora as any).touro_ultimo_parto && (
                      <p className="text-xs text-gray-700">
                        🐂 <span className="font-medium">{(doadora as any).touro_ultimo_parto}</span>
                        {(doadora as any).rgd_touro_ultimo_parto && (
                          <span className="text-gray-400 font-mono ml-1">({(doadora as any).rgd_touro_ultimo_parto})</span>
                        )}
                      </p>
                    )}
                    {/* Filhote nascido — link se vinculado, botão de vincular se não */}
                    {filhoteUltimoParto ? (
                      <Link
                        href={`/${filhoteUltimoParto.tipo === "TOURO" ? "machos" : "doadoras"}/${filhoteUltimoParto.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        {filhoteUltimoParto.tipo === "TOURO" ? "🐂" : "🐄"}
                        <span>{filhoteUltimoParto.nome}</span>
                        {filhoteUltimoParto.rgn && (
                          <span className="font-normal text-brand-500 font-mono">({filhoteUltimoParto.rgn})</span>
                        )}
                        <ChevronRight className="w-3 h-3 opacity-60" />
                      </Link>
                    ) : (
                      <VincularFilhoteParida
                        doadoraId={doadora.id}
                        animaisDisponiveis={(animaisVincular ?? []).map((a: any) => ({
                          id:   a.id,
                          nome: a.nome ?? "",
                          tipo: a.tipo ?? "DOADORA",
                        }))}
                      />
                    )}
                  </div>
                )}

              </div>
            )}

            {/* Formulário contextual */}
            <ReproStatusForm
              doadoraId={doadora.id}
              statusAtual={doadora.status_reprodutivo ?? null}
              dataStatus={(doadora as any).data_status ?? null}
              touroPrenhez={(doadora as any).touro_prenhez ?? null}
              rgdTouroPrenhez={(doadora as any).rgd_touro_prenhez ?? null}
              touroUltimoParto={(doadora as any).touro_ultimo_parto ?? null}
              rgdTouroUltimoParto={(doadora as any).rgd_touro_ultimo_parto ?? null}
              dataUltimoParto={(doadora as any).data_ultimo_parto ?? null}
              numeroParto={(doadora as any).numero_partos ?? 0}
            />

            {/* Card de nascimento — só aparece quando a doadora está prenha */}
            {doadora.status_reprodutivo === "GESTANTE" && (
              <NascimentoDoadoraForm
                doadoraId={doadora.id}
                animaisParaVincular={(animaisVincular ?? []).map((a: any) => ({ id: a.id, nome: a.nome ?? "" }))}
              />
            )}
          </div>

          {/* Peso atual com atualização inline */}
          <div className="col-span-2 md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Peso Atual (kg)</p>
            <form action={atualizarPeso} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={doadora.id} />
              <input
                name="peso_atual"
                type="number"
                step="0.1"
                min="0"
                defaultValue={doadora.peso_atual ?? ""}
                placeholder="Ex: 420.5"
                className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="shrink-0 text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                <Scale className="w-3.5 h-3.5 inline mr-1" />Salvar
              </button>
            </form>
          </div>

          {/* Localização — texto editável inline */}
          <div className="col-span-2 md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Localização</p>
            <form action={atualizarLocalizacao} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={doadora.id} />
              <input
                name="localizacao"
                type="text"
                defaultValue={doadora.localizacao ?? ""}
                placeholder="Ex: Pasto 3, Curral A…"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="shrink-0 text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                Salvar
              </button>
            </form>
          </div>


          {/* ── Sócios — listar + adicionar + remover ── */}
          <div className="col-span-2 md:col-span-4 pt-3 border-t border-gray-100">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Sociedade</p>

            {/* Lista atual */}
            {doadora.socios && doadora.socios.length > 0 ? (
              <div className="space-y-2 mb-4">
                {doadora.socios.map((s: any) => (
                  <div key={s.id ?? s.partner_id} className="flex items-center justify-between gap-3 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium text-brand-900 text-sm">{s.partner?.nome ?? "—"}</span>
                      <span className="badge bg-brand-100 text-brand-700 font-bold">
                        {s.percentual != null ? `${(s.percentual * 100).toFixed(0)}%` : "—"}
                      </span>
                      {s.valor_parcela != null && (
                        <span className="text-xs text-gray-500">{formatCurrency(s.valor_parcela)}/mês</span>
                      )}
                      {s.partner?.telefone && (
                        <span className="text-xs text-gray-400">{s.partner.telefone}</span>
                      )}
                    </div>
                    {/* Remover sócio */}
                    <form action={removerSocio}>
                      <input type="hidden" name="animal_id"  value={doadora.id} />
                      <input type="hidden" name="partner_id" value={s.partner_id ?? s.partner?.id} />
                      <button
                        type="submit"
                        title="Remover sócio"
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic mb-3">Nenhum sócio vinculado ainda.</p>
            )}

            {/* Formulário — vincular sócio já cadastrado */}
            {todosPartners && todosPartners.filter((p: any) => !doadora.socios?.some((s: any) => (s.partner_id ?? s.partner?.id) === p.id)).length > 0 && (
              <form action={adicionarSocio} className="flex flex-wrap items-end gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3 mb-3">
                <input type="hidden" name="animal_id" value={doadora.id} />

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase text-gray-400 tracking-wide">Sócio cadastrado</label>
                  <select
                    name="partner_id"
                    required
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 min-w-[180px]"
                  >
                    <option value="">— Selecionar —</option>
                    {(todosPartners ?? [])
                      .filter((p: any) => !doadora.socios?.some((s: any) => (s.partner_id ?? s.partner?.id) === p.id))
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase text-gray-400 tracking-wide">% Participação</label>
                  <div className="flex items-center gap-1">
                    <input
                      name="percentual"
                      type="number" min="1" max="100" step="1"
                      placeholder="Ex: 25" required
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase text-gray-400 tracking-wide">Parcela (R$)</label>
                  <input
                    name="valor_parcela"
                    type="number" min="0" step="0.01"
                    placeholder="Opcional"
                    className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                <button type="submit"
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Vincular
                </button>
              </form>
            )}

            {/* Formulário — criar novo sócio e já vincular */}
            <details className="group">
              <summary className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 cursor-pointer select-none list-none font-medium mb-2">
                <Plus className="w-3 h-3" />
                Cadastrar novo sócio
                <span className="text-gray-400 group-open:hidden">▸</span>
                <span className="text-gray-400 hidden group-open:inline">▾</span>
              </summary>

              <form action={criarESocio} className="flex flex-wrap items-end gap-3 bg-blue-50 border border-dashed border-blue-200 rounded-lg px-4 py-3 mt-1">
                <input type="hidden" name="animal_id" value={doadora.id} />

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase text-gray-400 tracking-wide">Nome *</label>
                  <input
                    name="novo_nome"
                    type="text"
                    placeholder="Nome completo"
                    required
                    className="w-44 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase text-gray-400 tracking-wide">Telefone</label>
                  <input
                    name="novo_telefone"
                    type="text"
                    placeholder="(00) 00000-0000"
                    className="w-36 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase text-gray-400 tracking-wide">% Participação *</label>
                  <div className="flex items-center gap-1">
                    <input
                      name="novo_percentual"
                      type="number" min="1" max="100" step="1"
                      placeholder="Ex: 25" required
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase text-gray-400 tracking-wide">Parcela (R$)</label>
                  <input
                    name="novo_parcela"
                    type="number" min="0" step="0.01"
                    placeholder="Opcional"
                    className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                <button type="submit"
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar e vincular
                </button>
              </form>
            </details>
          </div>
        </div>
          </div>{/* fim flex-1 */}
        </div>{/* fim flex gap-6 */}
      </div>

      {/* ── Genealogia ─────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* Genealogia sempre visível */}
        <div className="px-5 pt-5 pb-4">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Genealogia</h2>
          <Genealogia animal={doadora} />
        </div>

        {/* Barra de edição expansível com autocomplete e importação */}
        <EditarGenealogyForm
          animalId={doadora.id}
          action={atualizarGenealogia}
          pai_nome={(doadora as any).pai_nome}
          mae_nome={(doadora as any).mae_nome}
          avo_paterno={(doadora as any).avo_paterno}
          avo_paterna={(doadora as any).avo_paterna}
          avo_materno={(doadora as any).avo_materno}
          avo_materna={(doadora as any).avo_materna}
          bisavo_pat_pat={(doadora as any).bisavo_pat_pat}
          bisava_pat_pat={(doadora as any).bisava_pat_pat}
          bisavo_pat_mat={(doadora as any).bisavo_pat_mat}
          bisava_pat_mat={(doadora as any).bisava_pat_mat}
          bisavo_materno={(doadora as any).bisavo_materno}
          bisava_mat_pat={(doadora as any).bisava_mat_pat}
          bisavo_materna={(doadora as any).bisavo_materna}
          bisavo={(doadora as any).bisavo}
        />
      </div>

      {/* ── ROI ─────────────────────────────────────────────── */}
      <ROISection
        totalVendas={totalVendas}
        totalCompras={totalCompras}
        parcelaMensalVendas={parcelaMensalVendas}
        parcelaMensalCusto={parcelaMensalCusto}
        valorParcelaManual={valorParcela}
        parcelaCompra={parcelaCompra}
        numParcelasCompra={numParcelasCompra}
        leilaoCompra={leilaoCompra}
        animalId={doadora.id}
      />


      {/* ── Documentos ─────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <span className="text-base">📄</span>
            <h2 className="font-semibold text-gray-900">Documentos</h2>
            <span className="badge bg-gray-100 text-gray-600 ml-auto">
              {((doadora as any).documents ?? []).length} arquivo{((doadora as any).documents ?? []).length !== 1 ? "s" : ""}
            </span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>
          <div className="px-5 py-5">
            <p className="text-xs text-gray-400 mb-4">RGN, teste de DNA e outros documentos oficiais do animal.</p>
            <AnimalDocumentosUpload
              animalId={doadora.id}
              documentos={(doadora as any).documents ?? []}
            />
          </div>
        </details>
      </div>

      {/* ── Histórico Reprodutivo (prenhezes naturais) ──────────── */}
      {(prenhezes_historico ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Histórico Reprodutivo</h2>
            <span className="badge bg-rose-50 text-rose-600 ml-auto">
              {(prenhezes_historico ?? []).length} prenhe{(prenhezes_historico ?? []).length !== 1 ? "zes" : "z"}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {(prenhezes_historico ?? []).map((pn: any, idx: number) => {
              const numPrenhez = (prenhezes_historico ?? []).length - idx;
              const statusCls =
                pn.resultado === "PARIDA"  ? "bg-indigo-100 text-indigo-700" :
                pn.resultado === "ABORTOU" ? "bg-rose-100 text-rose-700"     :
                                             "bg-green-100 text-green-700";
              const statusLabel =
                pn.resultado === "PARIDA"  ? "Parida"  :
                pn.resultado === "ABORTOU" ? "Abortou" :
                                             "Prenha";
              const animalNascido = pn.animal_nascido as any;
              const rota = animalNascido?.tipo === "TOURO"
                ? `/machos/${animalNascido.id}`
                : `/doadoras/${animalNascido?.id}`;

              return (
                <div key={pn.id} className="px-5 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                  {/* Número da prenhez */}
                  <span className="text-xs font-bold text-gray-400 w-6 shrink-0">{numPrenhez}ª</span>

                  {/* Status */}
                  <span className={`badge text-xs px-2 py-0.5 font-semibold shrink-0 ${statusCls}`}>
                    {statusLabel}
                  </span>

                  {/* Touro */}
                  {pn.touro_nome ? (
                    <span className="text-xs text-gray-700">
                      🐂 <span className="font-medium">{pn.touro_nome}</span>
                      {pn.touro_rgd && (
                        <span className="text-gray-400 font-mono ml-1">({pn.touro_rgd})</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 italic">Touro não informado</span>
                  )}

                  {/* Data de inseminação */}
                  {pn.data_inseminacao && (
                    <span className="text-xs text-gray-500">
                      Insem.: <span className="font-medium">{formatDate(pn.data_inseminacao)}</span>
                    </span>
                  )}

                  {/* Data do parto */}
                  {pn.data_parto && (
                    <span className="text-xs text-gray-500">
                      Parto: <span className="font-medium">{formatDate(pn.data_parto)}</span>
                    </span>
                  )}

                  {/* Animal nascido */}
                  {animalNascido ? (
                    <Link
                      href={rota}
                      className="ml-auto text-xs text-brand-600 hover:underline font-medium flex items-center gap-1"
                    >
                      <Baby className="w-3 h-3" />
                      {animalNascido.nome}
                      {animalNascido.rgn && (
                        <span className="text-gray-400 font-mono">({animalNascido.rgn})</span>
                      )}
                    </Link>
                  ) : pn.resultado === "PARIDA" ? (
                    <div className="ml-auto">
                      <VincularFilhoteParida
                        doadoraId={doadora.id}
                        prenhezId={pn.id}
                        animaisDisponiveis={(animaisVincular ?? []).map((a: any) => ({
                          id:   a.id,
                          nome: a.nome ?? "",
                          tipo: a.tipo ?? "DOADORA",
                        }))}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aspirações */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-gray-900">Histórico de Aspirações</h2>
          <span className="badge bg-brand-100 text-brand-700 ml-auto">{aspiracoes?.length ?? 0} sessões</span>
        </div>
        {!aspiracoes?.length ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma aspiração registrada</div>
        ) : (
          <>
            {/* ── View mobile: cards ── */}
            <div className="md:hidden divide-y divide-gray-100">
              {aspiracoes.map((a: any) => {
                const g = embGrupos[a.id];
                const congelados  = g ? g.disponiveis : (a.embryos_congelados ?? null);
                const implantados = g ? g.implantados : null;
                const prenhezes   = g ? g.comPrenhez  : null;
                return (
                  <div key={a.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">{formatDate(a.session?.data)}</span>
                      <span className={`badge text-xs ${a.session?.tipo === "COMPRADA" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                        {a.session?.tipo ?? "—"}
                      </span>
                    </div>
                    {a.touro_nome && <p className="text-xs text-gray-500 mb-2">× {a.touro_nome}</p>}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg py-2 px-1">
                        <p className="text-sm font-semibold text-gray-900">{a.oocitos_viaveis ?? "—"}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Oócitos</p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg py-2 px-1">
                        <p className="text-sm font-semibold text-indigo-700">{congelados ?? "—"}</p>
                        <p className="text-[10px] text-indigo-400 mt-0.5">Disponíveis</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg py-2 px-1">
                        <p className="text-sm font-semibold text-amber-700">{implantados ?? "—"}</p>
                        <p className="text-[10px] text-amber-400 mt-0.5">Implantados</p>
                      </div>
                      <div className="bg-green-50 rounded-lg py-2 px-1">
                        <p className="text-sm font-semibold text-green-700">{prenhezes ?? "—"}</p>
                        <p className="text-[10px] text-green-400 mt-0.5">Prenhezes</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── View desktop: tabela ── */}
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Responsável</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Oócitos</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Congelados</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Implantados</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">Prenhezes</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Custo</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Touro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {aspiracoes.map((a: any) => {
                  const g = embGrupos[a.id];
                  const congelados   = g ? g.disponiveis  : (a.embryos_congelados ?? null);
                  const implantados  = g ? g.implantados  : null;
                  const prenhezes    = g ? g.comPrenhez   : null;
                  return (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-4 py-3 text-gray-900">{formatDate(a.session?.data)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${a.session?.tipo === "COMPRADA" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                        {a.session?.tipo ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.session?.responsavel ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{a.oocitos_viaveis ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {congelados != null
                        ? <span className="badge bg-indigo-100 text-indigo-700 font-semibold">{congelados}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {implantados != null
                        ? <span className={`badge font-semibold ${implantados > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"}`}>{implantados}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prenhezes != null
                        ? <span className={`badge font-semibold ${prenhezes > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>{prenhezes}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {a.custo_total != null ? formatCurrency(a.custo_total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.touro_nome ?? "—"}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── Embriões agrupados por data OPU ────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Baby className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Embriões</h2>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge bg-indigo-100 text-indigo-700">{totalEmbrioes} total</span>
            {totalDisponiveis > 0 && (
              <span className="badge bg-green-100 text-green-700">{totalDisponiveis} disponíveis</span>
            )}
          </div>
        </div>

        {embGruposList.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhum embrião registrado</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {embGruposList.map((g) => (
              <details key={g.aspId} className="group">
                {/* Linha sumário clicável */}
                <summary className="px-4 py-3 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">
                      {g.data ? formatDate(g.data) : "Data desconhecida"}
                    </span>
                    {g.touro && (
                      <span className="text-xs text-gray-500">× {g.touro}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2 text-xs shrink-0">
                      <span className="badge bg-indigo-100 text-indigo-700 font-bold">{g.total}</span>
                      {g.disponiveis > 0 && (
                        <span className="badge bg-green-100 text-green-700">{g.disponiveis} disp.</span>
                      )}
                      {g.femeas > 0 && <span className="badge bg-pink-100 text-pink-700">♀ {g.femeas}</span>}
                      {g.machos > 0 && <span className="badge bg-blue-100 text-blue-700">♂ {g.machos}</span>}
                      {g.naoSex > 0 && <span className="badge bg-gray-100 text-gray-500">{g.naoSex} N/S</span>}
                      {g.comPrenhez > 0 && (
                        <span className="badge bg-purple-100 text-purple-700">{g.comPrenhez} prenhe</span>
                      )}
                      <span className="text-gray-400 group-open:rotate-180 transition-transform inline-block">▼</span>
                    </div>
                  </div>
                </summary>

                {/* Linhas expandidas */}
                <div className="bg-gray-50 border-t border-gray-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-2 font-medium text-gray-500">Sexagem</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Status</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Receptora</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Status Rec.</th>
                        <th className="px-4 py-2 font-medium text-gray-500">DG</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Prev. Parto</th>
                        <th className="px-4 py-2 font-medium text-gray-500 text-center">CDC-FIV</th>
                        <th className="px-4 py-2 font-medium text-gray-500 text-center">ADT-TE</th>
                        <th className="px-4 py-2 font-medium text-gray-500 text-center">DNA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {g.embryos.map((e: any) => {
                        const transfers: any[] = e.transfers ?? [];
                        const transfer = transfers[0];
                        // Receptora: tenta FK join primeiro, fallback para receptora_brinco
                        const receptoraAnimal = transfer?.receptora;
                        const receptoraBrinco = receptoraAnimal?.brinco ?? receptoraAnimal?.nome ?? transfer?.receptora_brinco ?? null;
                        const receptoraId     = receptoraAnimal?.id ?? null;
                        const receptoraStatus = receptoraAnimal?.status_rebanho ?? null;
                        const dg = transfer?.pregnancy_diagnoses?.[0];
                        const previsaoParto = dg?.data_previsao_parto ?? null;
                        const resultado = dg?.resultado ?? null;
                        const hasCdc = !!e.numero_cdc_fiv;
                        const hasAdt = !!e.numero_adt_te;
                        const hasDna = !!(e.observacoes && (e.observacoes as string).includes("DNA:1"));
                        const obsBaseVal = (e.observacoes ?? "").replace(/DNA:1\s*\|?\s*/g, "").trim();

                        return (
                          <tr key={e.id} className="hover:bg-white transition-colors">
                            <td className="px-4 py-2">
                              {e.sexagem === "FEMEA"
                                ? <span className="badge bg-pink-100 text-pink-700">♀</span>
                                : e.sexagem === "MACHO"
                                ? <span className="badge bg-blue-100 text-blue-700">♂</span>
                                : <span className="badge bg-gray-100 text-gray-500">N/S</span>}
                            </td>
                            <td className="px-4 py-2">
                              {e.status === "DISPONIVEL"
                                ? <span className="badge bg-green-100 text-green-700">Disponível</span>
                                : e.status === "IMPLANTADO"
                                ? <span className="badge bg-amber-100 text-amber-700">Implantado</span>
                                : <span className="badge bg-gray-100 text-gray-500">Descartado</span>}
                            </td>
                            {/* Receptora — link para ficha se tiver id */}
                            <td className="px-4 py-2">
                              {receptoraBrinco ? (
                                receptoraId ? (
                                  <Link href={`/rebanho/${receptoraId}`}
                                    className="font-mono font-semibold text-brand-700 hover:underline text-xs">
                                    {receptoraBrinco}
                                  </Link>
                                ) : (
                                  <span className="font-mono text-gray-700 text-xs">{receptoraBrinco}</span>
                                )
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            {/* Status reprodutivo da receptora — editável inline */}
                            <td className="px-4 py-2">
                              {receptoraId ? (
                                <EditReprodutivoInline animalId={receptoraId} statusAtual={receptoraStatus} />
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {resultado === "POSITIVO"
                                ? <span className="badge bg-green-100 text-green-700">P+</span>
                                : resultado === "NEGATIVO"
                                ? <span className="badge bg-red-100 text-red-600">Negativo</span>
                                : resultado
                                ? <span className="badge bg-gray-100 text-gray-500">{resultado}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2 text-gray-500 text-xs">
                              {previsaoParto ? formatDate(previsaoParto) : "—"}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <DocChipDoadora label="CDC-FIV" checked={hasCdc} embryoId={e.id} doadoraId={id} campo="cdc" />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <DocChipDoadora label="ADT-TE" checked={hasAdt} embryoId={e.id} doadoraId={id} campo="adt" />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <DocChipDoadora label="DNA" checked={hasDna} embryoId={e.id} doadoraId={id} campo="dna" obsBaseVal={obsBaseVal} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* ── Card Leilão ─────────────────────────────────────────────────────── */}
      {(doadora as any).para_leilao && (
        <section className="card overflow-hidden border-amber-200">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-amber-900">Animal Para Leilão</h2>
          </div>

          <form action={salvarInfoLeilao} className="px-5 py-5 space-y-6">
            <input type="hidden" name="animal_id" value={doadora.id} />

            {/* Convite */}
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">Convite</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nome do Leilão</label>
                  <input name="convite_nome" type="text"
                    defaultValue={leilaoInfo?.convite_nome ?? ""}
                    placeholder="Ex: ExpoPecuária Elite 2026"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data</label>
                  <input name="convite_data" type="date"
                    defaultValue={leilaoInfo?.convite_data ?? ""}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs text-gray-500 mb-1 block">Promotor(es)</label>
                  <input name="convite_promotores" type="text"
                    defaultValue={leilaoInfo?.convite_promotores ?? ""}
                    placeholder="Ex: SE Agropecuária, Gran Nelore"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
            </div>

            {/* Leilão de compra */}
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">Leilão onde Comprou</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nome do Leilão</label>
                  <input name="compra_leilao_nome" type="text"
                    defaultValue={compraLeilaoNome ?? ""}
                    placeholder="Ex: Leilão Gran Nelore 2025"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data</label>
                  <input name="compra_leilao_data" type="date"
                    defaultValue={compraLeilaoData ?? ""}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Parcela (R$)</label>
                  <input name="compra_valor_parcela" type="number" step="0.01" min="0"
                    defaultValue={compraValorParcela ?? ""}
                    placeholder="Ex: 600.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div className="flex items-end pb-2">
                  {compraValorParcela != null ? (
                    <p className="text-sm text-gray-700">
                      Total: <span className="font-bold text-gray-900">
                        {formatCurrency(compraValorParcela * 30)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">(× 30)</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Total = parcela × 30</p>
                  )}
                </div>
              </div>
            </div>

            {/* Meta de valor */}
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">Meta de Valor</p>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Parcela Alvo (R$)</label>
                  <input name="meta_valor_parcela" type="number" step="0.01" min="0"
                    defaultValue={leilaoInfo?.meta_valor_parcela ?? ""}
                    placeholder="Ex: 1500.00"
                    className="w-44 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                {leilaoInfo?.meta_valor_parcela != null ? (
                  <div className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-lg px-4 py-2.5">
                    <span className="text-xs font-medium opacity-80">Meta Total</span>
                    <span className="font-bold text-lg leading-none">
                      {formatCurrency(leilaoInfo.meta_valor_parcela * 30)}
                    </span>
                    <span className="text-xs opacity-60">× 30</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic self-end pb-2">Total = parcela × 30</p>
                )}
              </div>
            </div>

            {/* Venda + Comparativo */}
            <VendaLeilaoSection
              metaParcela={(leilaoInfo as any)?.meta_valor_parcela ?? null}
              defaultComprador={(leilaoInfo as any)?.venda_comprador ?? ""}
              defaultParcela={(leilaoInfo as any)?.venda_valor_parcela ?? undefined}
              defaultNParcelas={(leilaoInfo as any)?.venda_n_parcelas ?? undefined}
              defaultPercentual={(leilaoInfo as any)?.venda_percentual ?? undefined}
              animalId={doadora.id}
              percentualProprioAtual={
                (doadora as any).percentual_proprio != null
                  ? Math.round(((doadora as any).percentual_proprio as number) * 100)
                  : 100
              }
            />

            <button type="submit"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              <Gavel className="w-4 h-4" /> Salvar Informações de Leilão
            </button>
          </form>
        </section>
      )}

      {/* Histórico de Pesagens */}
      <div className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <Scale className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Histórico de Pesagens</h2>
            <span className="badge bg-brand-100 text-brand-700 ml-auto">{pesagens?.length ?? 0} registros</span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>

          {/* Form nova pesagem */}
          <form action={registrarPesagem} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <input type="hidden" name="animal_id" value={doadora.id} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar pesagem</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Data *</label>
                <input name="data" type="date" required
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Peso (kg) *</label>
                <input name="peso_kg" type="number" step="0.1" min="0" required placeholder="Ex: 425.0"
                  className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <button type="submit"
                className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
                <Plus className="w-4 h-4" /> Registrar
              </button>
            </div>
          </form>

          {/* Nota ponderal */}
          <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
            <strong>Ponderal (g/dia)</strong> = peso total (g) ÷ dias de vida na data da pesagem —
            mede o crescimento acumulado desde o nascimento.
          </div>

          {!pesagens?.length ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma pesagem registrada ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Data</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Peso (kg)</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Idade</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Ponderal (g/dia)</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pesagens.map((p: any, i: number) => {
                  const prox     = pesagens[i + 1];
                  const variacao = prox ? p.peso_kg - prox.peso_kg : null;
                  const mesesP   = mesesEntre(doadora.nascimento ?? null, p.data);
                  const ponderal = calcPonderal(p.peso_kg, doadora.nascimento ?? null, p.data, (doadora as any).peso_nascimento);
                  const classPond = ponderal != null && mesesP != null
                    ? classificarPonderal(ponderal, mesesP)
                    : null;

                  // Label de idade
                  const idadeLabel = mesesP != null ? `${mesesP}m` : "—";

                  return (
                    <tr key={p.id} className="table-row-hover">
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{formatDate(p.data)}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{p.peso_kg.toLocaleString("pt-BR")} kg</td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">
                          {idadeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {ponderal != null ? (
                          <span className={`font-semibold ${classPond?.cls ?? "text-gray-700"}`}>
                            {ponderal.toFixed(0)} g/dia
                            {classPond && (
                              <span className="ml-1.5 font-normal text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                                {classPond.label}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {variacao == null ? (
                          <span className="text-gray-300">—</span>
                        ) : variacao > 0 ? (
                          <span className="text-green-600 font-medium">+{variacao.toFixed(1)} kg ↑</span>
                        ) : variacao < 0 ? (
                          <span className="text-red-500 font-medium">{variacao.toFixed(1)} kg ↓</span>
                        ) : (
                          <span className="text-gray-400">= sem variação</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </details>
      </div>

      {/* Premiações */}
      <div className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Premiações</h2>
            <span className="badge bg-yellow-100 text-yellow-700 ml-auto">{premiacoes?.length ?? 0} prêmios</span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>

          {/* Form nova premiação */}
          <FormPremiacao
            animalId={doadora.id}
            exposicoes={(exposicoes ?? []).map((e: any) => ({ id: e.id, nome: e.nome, data_base: e.data_base ?? null }))}
          />

          {!premiacoes?.length ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma premiação registrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Prêmio</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Grupo</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Exposição</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Data</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {premiacoes.map((p: any) => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      {(() => {
                        const LABELS: Record<string, string> = {
                          GRANDE_CAMPEAO:            "Grande Campeão",
                          GRANDE_CAMPEA:             "Grande Campeã",
                          RESERVADO_GRANDE_CAMPEAO:  "Reservado Grande Campeão",
                          RESERVADA_GRANDE_CAMPEA:   "Reservada Grande Campeã",
                          CAMPEAO:                   "Campeão",
                          CAMPEA:                    "Campeã",
                          RESERVADO_CAMPEAO:         "Reservado Campeão",
                          RESERVADA_CAMPEA:          "Reservada Campeã",
                          "3_LUGAR_CAMPEONATO":      "3° Lugar no Campeonato",
                          "1_LUGAR":                 "1° Lugar na Categoria",
                          "2_LUGAR":                 "2° Lugar na Categoria",
                          "3_LUGAR":                 "3° Lugar na Categoria",
                          MELHOR_DO_EVENTO:          "Melhor do Evento",
                        };
                        const label = LABELS[p.tipo_premio] ?? p.tipo_premio.replace(/_/g, " ");
                        const isDestaque = p.tipo_premio.includes("CAMPEAO") || p.tipo_premio.includes("CAMPEA") || p.tipo_premio.includes("GRAND");
                        return isDestaque
                          ? <span className="badge bg-yellow-100 text-yellow-700">🏆 {label}</span>
                          : <span className="badge bg-gray-100 text-gray-600">{label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.grupo_nelore ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.exhibition?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.exhibition?.data_base ? p.exhibition.data_base : "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.observacoes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      </div>

      {doadora.observacoes && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-2">Observações</h2>
          <p className="text-sm text-gray-600">{doadora.observacoes}</p>
        </div>
      )}
    </div>
    </VendaSyncProvider>
  );
}
