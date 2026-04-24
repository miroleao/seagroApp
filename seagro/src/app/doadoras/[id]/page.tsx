import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Baby, Star, Trophy, Scale, Plus, TrendingUp, TrendingDown, ShoppingCart } from "lucide-react";
import { toggleParaPista, atualizarPeso, adicionarPremiacao, registrarPesagem, toggleEmbrioCdc, toggleEmbrioAdt, toggleEmbrioDna, atualizarLocalizacao, atualizarStatusReprodutivo, atualizarTouroPrenhez, adicionarSocio, removerSocio, criarESocio } from "./actions";
import RegistrarVendaForm from "./RegistrarVendaForm";
import { ReproStatusForm } from "@/components/ui/ReproStatusForm";
import { EditReprodutivoInline } from "@/app/rebanho/EditReprodutivoInline";

// Mapa de cores para cada status reprodutivo
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  COLETANDO:  { label: "Coletando",  cls: "bg-purple-100 text-purple-700" },
  INSEMINADA: { label: "Inseminada", cls: "bg-amber-100  text-amber-700"  },
  GESTANTE:   { label: "Gestante",   cls: "bg-green-100  text-green-700"  },
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
function calcPonderal(pesoKg: number, nascimento: string | null, dataPesagem: string): number | null {
  const dias = diasEntre(nascimento, dataPesagem);
  if (!dias || dias <= 0) return null;
  return (pesoKg * 1000) / dias;
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
}: {
  label: string;
  name?: string | null;
  sub?: string | null;
  highlight?: boolean;
}) {
  const base = "flex flex-col justify-center px-2.5 py-2 rounded-lg border text-xs h-full overflow-hidden";
  const style = highlight
    ? "bg-brand-50 border-brand-200"
    : name
    ? "bg-gray-50 border-gray-200"
    : "bg-white border-dashed border-gray-200";

  return (
    <div className={`${base} ${style}`}>
      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-0.5 leading-none">{label}</p>
      <p className={`font-semibold leading-tight truncate ${highlight ? "text-brand-800" : name ? "text-gray-800" : "text-gray-300"}`}>
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
  const ROW_H = 40;
  const ROWS  = 8;
  const GAP   = 3;

  return (
    <div className="overflow-x-auto">
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
          <PedCell label="Pai" name={animal.pai_nome} />
        </div>
        <div style={{ gridColumn: "2", gridRow: "5 / span 4" }}>
          <PedCell label="Mãe" name={animal.mae_nome} />
        </div>

        {/* Col 3 — Avós */}
        <div style={{ gridColumn: "3", gridRow: "1 / span 2" }}>
          <PedCell label="Avô Paterno" name={animal.avo_paterno} />
        </div>
        <div style={{ gridColumn: "3", gridRow: "3 / span 2" }}>
          <PedCell label="Avó Paterna" name={animal.avo_paterna} />
        </div>
        <div style={{ gridColumn: "3", gridRow: "5 / span 2" }}>
          <PedCell label="Avô Materno" name={animal.avo_materno} />
        </div>
        <div style={{ gridColumn: "3", gridRow: "7 / span 2" }}>
          <PedCell label="Avó Materna" name={animal.avo_materna} />
        </div>

        {/* Col 4 — Bisavós (1 linha cada) */}
        <div style={{ gridColumn: "4", gridRow: "1" }}>
          <PedCell label="Pai do Avô Pat." name={animal.bisavo_pat_pat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "2" }}>
          <PedCell label="Mãe do Avô Pat." name={animal.bisava_pat_pat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "3" }}>
          <PedCell label="Pai da Avó Pat." name={animal.bisavo_pat_mat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "4" }}>
          <PedCell label="Mãe da Avó Pat." name={animal.bisava_pat_mat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "5" }}>
          <PedCell label="Pai do Avô Mat." name={animal.bisavo_materno} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "6" }}>
          <PedCell label="Mãe do Avô Mat." name={animal.bisava_mat_pat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "7" }}>
          <PedCell label="Pai da Avó Mat." name={animal.bisavo_materna} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "8" }}>
          <PedCell label="Mãe da Avó Mat." name={animal.bisavo} />
        </div>
      </div>
    </div>
  );
}

// ── ROI Section ───────────────────────────────────────────────────────────────
function ROISection({
  valorParcela,
  somaParcelasVenda,
}: {
  valorParcela: number;
  somaParcelasVenda: number;
}) {
  const totalReceita = somaParcelasVenda * 30;
  const totalCusto   = valorParcela * 30;
  const saldo        = totalReceita - totalCusto;
  const positivo     = saldo >= 0;

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm">
        {positivo
          ? <TrendingUp className="w-4 h-4 text-green-600" />
          : <TrendingDown className="w-4 h-4 text-red-500" />}
        Desempenho Financeiro (ROI)
      </h2>
      <div className="grid grid-cols-3 gap-4 text-center">

        {/* Parcela de vendas */}
        <div>
          {somaParcelasVenda > 0 ? (
            <>
              <p className="text-xl font-bold text-green-600">{formatCurrency(somaParcelasVenda)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Parcela de vendas</p>
              <p className="text-xs text-green-400 mt-0.5">×30 = {formatCurrency(totalReceita)}</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-300">—</p>
              <p className="text-xs text-gray-400 mt-0.5">Parcela de vendas</p>
              <p className="text-xs text-gray-300 mt-0.5 italic">sem vendas registradas</p>
            </>
          )}
        </div>

        {/* Parcela mensal (custo) */}
        <div>
          {valorParcela > 0 ? (
            <>
              <p className="text-xl font-bold text-red-500">{formatCurrency(valorParcela)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Parcela mensal</p>
              <p className="text-xs text-red-300 mt-0.5">×30 = {formatCurrency(totalCusto)}</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-300">—</p>
              <p className="text-xs text-gray-400 mt-0.5">Parcela mensal</p>
              <p className="text-xs text-gray-300 mt-0.5">×30 = {formatCurrency(0)}</p>
            </>
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
          <p className="text-xs text-gray-400 mt-0.5">
            {formatCurrency(totalReceita)} − {formatCurrency(totalCusto)}
          </p>
        </div>

      </div>
    </div>
  );
}

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
    .order("id", { ascending: false });

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
    disponiveis: number;
    femeas: number;
    machos: number;
    naoSex: number;
    comPrenhez: number;
    embryos: any[];
  };
  const embGrupos: Record<string, GrupoEmb> = {};
  for (const e of embrioes) {
    const asp    = e.aspiration as any;
    const aspId  = e.aspiration_id;
    const data   = asp?.session?.data ?? null;
    const touro  = asp?.touro_nome ?? null;
    if (!embGrupos[aspId]) {
      embGrupos[aspId] = { aspId, data, touro, total: 0, disponiveis: 0, femeas: 0, machos: 0, naoSex: 0, comPrenhez: 0, embryos: [] };
    }
    embGrupos[aspId].total++;
    if (e.status === "DISPONIVEL")  embGrupos[aspId].disponiveis++;
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

  // Transações de venda vinculadas ao ROI:
  // Prioridade 1 — doadora_id (link por UUID, robusto)
  // Prioridade 2 — ilike no animal_nome (fallback para registros legados sem doadora_id)
  const nomeDoadora = doadora?.nome ?? "";
  const { data: txPorId } = await supabase
    .from("transactions")
    .select("tipo, valor_total, n_parcelas, animal_nome")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "VENDA")
    .eq("doadora_id", id)
    .order("valor_total", { ascending: false });

  const { data: txPorNome } = await supabase
    .from("transactions")
    .select("tipo, valor_total, n_parcelas, animal_nome")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "VENDA")
    .is("doadora_id", null)
    .ilike("animal_nome", `%${nomeDoadora}%`)
    .order("valor_total", { ascending: false });

  // Une as duas listas (por ID + legados por nome)
  const transacoes = [...(txPorId ?? []), ...(txPorNome ?? [])];

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

  // ── Cálculo ROI ──────────────────────────────────────────────────
  // valor_total = parcela mensal de cada venda; somaParcelasVenda × 30 = receita total
  const somaParcelasVenda = (transacoes ?? [])
    .reduce((s, t) => s + (t.valor_total ?? 0), 0);
  const valorParcela = doadora.valor_parcela ?? 0;

  const totalEmbrioes    = embrioes.length;
  const totalDisponiveis = embrioes.filter(e => e.status === "DISPONIVEL").length;

  return (
    <div className="p-6 space-y-6">
      {/* Voltar */}
      <Link href="/doadoras" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Voltar para Doadoras
      </Link>

      {/* Cabeçalho */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{doadora.nome}</h1>
            {doadora.rgn && (
              <p className="text-sm text-gray-500 font-mono mt-0.5">RGN: {doadora.rgn}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="badge bg-pink-100 text-pink-700 text-sm px-3 py-1">DOADORA</span>
            {doadora.localizacao && (
              <span className="badge bg-gray-100 text-gray-600 text-sm px-3 py-1">{doadora.localizacao}</span>
            )}
            {/* Toggle Para Pista */}
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
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {/* Nascimento + badge de parto */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Nascimento</p>
            <p className="font-medium text-gray-900">{formatDate(doadora.nascimento)}</p>
            {/* Badge mostrando o último parto e a idade que tinha */}
            {(doadora as any).numero_partos > 0 && (doadora as any).data_ultimo_parto && (
              <div className="mt-1.5 flex flex-col gap-1">
                {/* Mostrar cada parto: 1º parto e os seguintes */}
                {(doadora as any).data_primeiro_parto && (() => {
                  const meses1 = mesesEntre(doadora.nascimento, (doadora as any).data_primeiro_parto);
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5 font-medium">
                      🐄 1º Parto · {meses1 != null ? `${meses1} meses` : formatDate((doadora as any).data_primeiro_parto)}
                    </span>
                  );
                })()}
                {/* Último parto se for diferente do primeiro */}
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
          </div>

          {/* % Próprio */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">% Próprio</p>
            <p className="font-medium text-gray-900">{percentualProprio}</p>
          </div>

          {/* Vl. Parcela */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Vl. Parcela</p>
            <p className="font-medium text-gray-900">
              {doadora.valor_parcela != null ? formatCurrency(doadora.valor_parcela) : "—"}
            </p>
          </div>

          {/* Status Reprodutivo — formulário contextual (client component) */}
          <div className="md:col-span-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-2">Status Reprodutivo</p>

            {/* Resumo visual do status atual */}
            {doadora.status_reprodutivo && STATUS_MAP[doadora.status_reprodutivo] && (
              <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <span className={`badge text-xs px-2 py-1 font-semibold ${STATUS_MAP[doadora.status_reprodutivo].cls}`}>
                  {STATUS_MAP[doadora.status_reprodutivo].label}
                </span>
                {(doadora as any).data_status && (
                  <span className="text-xs text-gray-500">
                    em {formatDate((doadora as any).data_status)}
                  </span>
                )}
                {/* Touro da prenhez atual */}
                {(doadora as any).touro_prenhez && (
                  <span className="text-xs text-gray-600">
                    · 🐂 <span className="font-medium">{(doadora as any).touro_prenhez}</span>
                    {(doadora as any).rgd_touro_prenhez && (
                      <span className="text-gray-400 font-mono ml-1">({(doadora as any).rgd_touro_prenhez})</span>
                    )}
                  </span>
                )}
                {/* Touro do último parto */}
                {doadora.status_reprodutivo === "PARIDA" && (doadora as any).touro_ultimo_parto && (
                  <span className="text-xs text-gray-600">
                    · 🐄 Touro: <span className="font-medium">{(doadora as any).touro_ultimo_parto}</span>
                    {(doadora as any).rgd_touro_ultimo_parto && (
                      <span className="text-gray-400 font-mono ml-1">({(doadora as any).rgd_touro_ultimo_parto})</span>
                    )}
                  </span>
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
          </div>

          {/* Peso atual com atualização inline */}
          <div className="md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Peso Atual (kg)</p>
            <form action={atualizarPeso} className="flex items-center gap-2">
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
                className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                <Scale className="w-3.5 h-3.5 inline mr-1" />Salvar
              </button>
            </form>
          </div>

          {/* Localização — texto editável inline */}
          <div className="md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Localização</p>
            <form action={atualizarLocalizacao} className="flex items-center gap-2">
              <input type="hidden" name="id" value={doadora.id} />
              <input
                name="localizacao"
                type="text"
                defaultValue={doadora.localizacao ?? ""}
                placeholder="Ex: Pasto 3, Curral A…"
                className="w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                <Scale className="w-3.5 h-3.5 inline mr-1" />Salvar
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
      </div>

      {/* ── Genealogia ─────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Genealogia</h2>
        <Genealogia animal={doadora} />
      </div>

      {/* ── ROI ─────────────────────────────────────────────── */}
      <ROISection
        valorParcela={valorParcela}
        somaParcelasVenda={somaParcelasVenda}
      />

      {/* ── Registrar Venda ─────────────────────────────────── */}
      <details className="card group">
        <summary className="px-5 py-4 cursor-pointer select-none list-none flex items-center gap-2 hover:bg-gray-50 rounded-xl transition-colors">
          <ShoppingCart className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Registrar Venda</h2>
          <span className="ml-auto text-xs text-gray-400 group-open:hidden">▸ Expandir</span>
          <span className="ml-auto text-xs text-gray-400 hidden group-open:inline">▾ Fechar</span>
        </summary>
        <div className="px-5 pb-5 pt-1 border-t border-gray-100">
          <RegistrarVendaForm doadoraId={id} />
        </div>
      </details>

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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Data</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Responsável</th>
                <th className="px-4 py-3 font-medium text-gray-600">Oócitos</th>
                <th className="px-4 py-3 font-medium text-gray-600">Embriões</th>
                <th className="px-4 py-3 font-medium text-gray-600">Custo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Touro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {aspiracoes.map((a: any) => (
                <tr key={a.id} className="table-row-hover">
                  <td className="px-4 py-3 text-gray-900">{formatDate(a.session?.data)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${a.session?.tipo === "COMPRADA" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                      {a.session?.tipo ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{a.session?.responsavel ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{a.oocitos_viaveis ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{a.embryos_congelados ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {a.custo_total != null ? formatCurrency(a.custo_total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{a.touro_nome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  const ponderal = calcPonderal(p.peso_kg, doadora.nascimento ?? null, p.data);
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
          <form action={adicionarPremiacao} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <input type="hidden" name="animal_id" value={doadora.id} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar prêmio</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo de Prêmio *</label>
                <select name="tipo_premio" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  <option value="">Selecione…</option>
                  <option value="GRANDE_CAMPEAO">Grande Campeão</option>
                  <option value="GRANDE_CAMPEA">Grande Campeã</option>
                  <option value="CAMPEAO">Campeão</option>
                  <option value="CAMPEA">Campeã</option>
                  <option value="RESERVADO_CAMPEAO">Reservado Campeão</option>
                  <option value="RESERVADA_CAMPEA">Reservada Campeã</option>
                  <option value="1_LUGAR">1° Lugar</option>
                  <option value="2_LUGAR">2° Lugar</option>
                  <option value="3_LUGAR">3° Lugar</option>
                  <option value="MELHOR_DO_EVENTO">Melhor do Evento</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Grupo ACNB</label>
                <input name="grupo_nelore" placeholder="Ex: Vaca Jovem"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Exposição</label>
                <select name="exhibition_id"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  <option value="">— sem vínculo —</option>
                  {(exposicoes ?? []).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.nome}{e.data_base ? ` (${e.data_base})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Observações</label>
                <input name="observacoes" placeholder="Opcional"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
            <button type="submit"
              className="mt-3 inline-flex items-center gap-1.5 bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
              <Plus className="w-4 h-4" /> Registrar Premiação
            </button>
          </form>

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
                      {(p.tipo_premio.includes("CAMPEAO") || p.tipo_premio.includes("CAMPEA") || p.tipo_premio.includes("GRAND"))
                        ? <span className="badge bg-yellow-100 text-yellow-700">🏆 {p.tipo_premio.replace(/_/g, " ")}</span>
                        : <span className="badge bg-gray-100 text-gray-600">{p.tipo_premio.replace(/_/g, " ")}</span>}
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
  );
}
