import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";
import { Suspense } from "react";
import BuscaPesagens from "./BuscaPesagens";
import FiltroPesagens from "./FiltroPesagens";
import TabelaPesagens, { type PesagemRow } from "./TabelaPesagens";
import NovaPesagemModal, { type AnimalOpt } from "./NovaPesagemModal";
import {
  ordenarPesagens, ponderalDoHistorico, classificarPonderalSimples,
} from "@/lib/ponderal";

export const revalidate = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

type WeightRecord = { id: string; data: string; peso_kg: number };

const sortedWeights = ordenarPesagens<WeightRecord>;

// Cálculo canônico em @/lib/ponderal — desconta o peso de nascimento,
// conforme a regra da seção 8 do CLAUDE.md.
const calcPonderal = ponderalDoHistorico;

const classificacaoBadge = classificarPonderalSimples;

function tipoLabelFn(tipo: string) {
  const map: Record<string, string> = {
    DOADORA:   "Doadora",
    TOURO:     "Touro",
    RECEPTORA: "Receptora",
    NASCIDO:   "Nascido",
    DESCARTE:  "Descarte",
  };
  return map[tipo] ?? tipo;
}

function tipoBadgeClsFn(tipo: string) {
  const map: Record<string, string> = {
    DOADORA:   "bg-purple-100 text-purple-700",
    TOURO:     "bg-blue-100 text-blue-700",
    RECEPTORA: "bg-green-100 text-green-700",
    NASCIDO:   "bg-amber-100 text-amber-700",
    DESCARTE:  "bg-gray-100 text-gray-500",
  };
  return map[tipo] ?? "bg-gray-100 text-gray-500";
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PesagensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const { q, tipo } = await searchParams;
  const query       = (q ?? "").toLowerCase().trim();
  const tipoFiltro  = tipo ?? "todos";

  const supabase = await createClient();

  const { data: animaisRaw } = await supabase
    .from("animals")
    .select(`
      id, nome, tipo, rgn, brinco, nascimento, nascido_se_agro, peso_nascimento,
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
    nascido_se_agro?: boolean | null;
    peso_nascimento?: number | null;
    weight_records: WeightRecord[];
  }>;

  // Helper: considera "Nascido SE" se flag = true OU RGN começa com "SMEF"
  function isNascidoSE(a: (typeof animais)[number]): boolean {
    return (
      a.nascido_se_agro === true ||
      (a.rgn?.toUpperCase().startsWith("SMEF") ?? false)
    );
  }

  // Aplica filtros
  const animaisFiltrados = animais.filter((a) => {
    if (tipoFiltro === "NASCIDO") {
      if (!isNascidoSE(a)) return false;
    } else if (tipoFiltro !== "todos") {
      if (a.tipo !== tipoFiltro) return false;
    }
    if (query) {
      return (
        a.nome?.toLowerCase().includes(query) ||
        a.rgn?.toLowerCase().includes(query) ||
        a.brinco?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Pré-calcula dados para o componente client
  const rows: PesagemRow[] = animaisFiltrados.map((a) => {
    const records   = a.weight_records ?? [];
    const sorted    = sortedWeights(records);
    const ultimo    = sorted[sorted.length - 1] ?? null;
    const ponderal  = calcPonderal(records, a.nascimento, a.peso_nascimento);
    const badge     = classificacaoBadge(ponderal);

    const animalHref =
      a.tipo === "DOADORA"    ? `/doadoras/${a.id}`
      : a.tipo === "TOURO"    ? `/machos/${a.id}`
      : (a.tipo === "RECEPTORA" || a.tipo === "NASCIDO" || a.tipo === "DESCARTE")
        ? `/rebanho/${a.id}`
        : null;

    // Badge especial para animais nascidos na SE
    const nascidoSE = isNascidoSE(a);
    const badgeTipoLabel = nascidoSE ? "Nascido SE" : tipoLabelFn(a.tipo);
    const badgeTipoCls   = nascidoSE ? "bg-brand-100 text-brand-700" : tipoBadgeClsFn(a.tipo);

    return {
      id:                  a.id,
      nome:                a.nome,
      tipo:                a.tipo,
      tipoBadgeCls:        badgeTipoCls,
      tipoLabel:           badgeTipoLabel,
      rgn:                 a.rgn ?? null,
      brinco:              a.brinco ?? null,
      nascimento:          a.nascimento ?? null,
      nascimentoFormatado: a.nascimento ? fmtDate(a.nascimento) : null,
      animalHref,
      ultimoPeso:          ultimo?.peso_kg ?? null,
      ultimaDataFormatada: ultimo ? fmtDate(ultimo.data) : null,
      ponderal,
      badgeLabel:          badge?.label ?? null,
      badgeCls:            badge?.cls   ?? null,
      qtdPesagens:         records.length,
      historico:           sorted,
    };
  });

  // Opções para o modal de lançamento — sempre TODOS os animais, sem filtro.
  // "NASCIDO" aqui segue a mesma regra visual da tabela (flag ou RGN SMEF).
  const opcoesAnimais: AnimalOpt[] = animais.map((a) => {
    const sorted = sortedWeights(a.weight_records ?? []);
    const ultimo = sorted[sorted.length - 1] ?? null;
    const nascidoSE = isNascidoSE(a);
    return {
      id:         a.id,
      nome:       a.nome,
      tipo:       nascidoSE ? "NASCIDO" : a.tipo,
      tipoLabel:  nascidoSE ? "Nascido SE" : tipoLabelFn(a.tipo),
      rgn:        a.rgn ?? null,
      brinco:     a.brinco ?? null,
      ultimoPeso: ultimo?.peso_kg ?? null,
      ultimaData: ultimo?.data ?? null,
    };
  });

  // Cards resumo (sempre do total geral, ignora filtros)
  const comPesagem = animais.filter(a => (a.weight_records ?? []).length > 0);
  const excelentes = comPesagem.filter(a => { const p = calcPonderal(a.weight_records ?? [], a.nascimento, a.peso_nascimento); return p !== null && p >= 800; });
  const bons       = comPesagem.filter(a => { const p = calcPonderal(a.weight_records ?? [], a.nascimento, a.peso_nascimento); return p !== null && p >= 600 && p < 800; });
  const abaixo     = comPesagem.filter(a => { const p = calcPonderal(a.weight_records ?? [], a.nascimento, a.peso_nascimento); return p !== null && p < 600; });
  const semDados   = animais.length - comPesagem.length +
                     comPesagem.filter(a => calcPonderal(a.weight_records ?? [], a.nascimento, a.peso_nascimento) === null).length;

  // PDF export data — sempre de TODOS os animais, ignorando o filtro ativo da UI
  // Ordenado: mais novo primeiro (nascimento desc). Sem data vai ao final.
  // Animais nascidos na SE (flag ou SMEF) formam grupo próprio "Nascido SE"
  const dadosPDF = [...animais]
    .sort((a, b) => {
      if (!a.nascimento && !b.nascimento) return 0;
      if (!a.nascimento) return 1;
      if (!b.nascimento) return -1;
      return b.nascimento.localeCompare(a.nascimento); // yyyy-mm-dd → desc
    })
    .map((a) => {
    const records = a.weight_records ?? [];
    const sorted  = sortedWeights(records);
    const ultimo  = sorted[sorted.length - 1] ?? null;
    const pond    = calcPonderal(records, a.nascimento, a.peso_nascimento);
    const badge   = classificacaoBadge(pond);
    const grupoTipo = isNascidoSE(a) ? "Nascido SE" : tipoLabelFn(a.tipo);
    return {
      nome:          a.nome ?? "—",
      tipo:          grupoTipo,
      rgn:           a.rgn ?? a.brinco ?? "—",
      nascimento:    a.nascimento ? fmtDate(a.nascimento) : "—",
      peso_atual:    ultimo?.peso_kg != null ? `${ultimo.peso_kg.toFixed(1)} kg` : "—",
      data_pesagem:  ultimo ? fmtDate(ultimo.data) : "—",
      ponderal:      pond !== null ? `${pond} g/dia` : "—",
      classificacao: badge?.label ?? "—",
      qtd_pesagens:  records.length > 0 ? `${records.length}` : "—",
    };
  });

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
        <div className="flex items-center gap-2">
        <NovaPesagemModal animais={opcoesAnimais} />
        <ExportarPDF
          titulo="Relatório de Pesagens"
          subtitulo="SE Agropecuária Nelore de Elite"
          orientacao="landscape"
          nomeArquivo="SE_Pesagens.pdf"
          grupos={[
            { key: "Nascido SE", label: "Nascidos SE",  padrao: true  },
            { key: "Doadora",    label: "Doadoras",     padrao: true  },
            { key: "Touro",      label: "Touros",       padrao: true  },
            { key: "Receptora",  label: "Receptoras",   padrao: true  },
            { key: "Descarte",   label: "Descarte",     padrao: false },
          ]}
          campoGrupo="tipo"
          colunas={[
            { key: "nome",         label: "Nome",          padrao: true,  largura: 2.2 },
            { key: "tipo",         label: "Tipo",          padrao: true,  largura: 0.9 },
            { key: "rgn",          label: "RGN / Brinco",  padrao: true,  largura: 1.2 },
            { key: "nascimento",   label: "Nascimento",    padrao: true,  largura: 1.0 },
            { key: "peso_atual",   label: "Peso Atual",    padrao: true,  largura: 0.9 },
            { key: "data_pesagem", label: "Data Pesagem",  padrao: true,  largura: 1.0 },
            { key: "ponderal",     label: "Ponderal",      padrao: true,  largura: 0.9 },
            { key: "classificacao",label: "Classificação", padrao: true,  largura: 0.9 },
            { key: "qtd_pesagens", label: "Qtd Pesagens",  padrao: false, largura: 0.8 },
          ] satisfies ColunaPDF[]}
          dados={dadosPDF}
        />
        </div>
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
          <p className="text-2xl font-bold text-gray-400">{semDados}</p>
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

      {/* ── Tabela (client component — expand/collapse via useState) ─── */}
      {(query || tipoFiltro !== "todos") && rows.length > 0 && (
        <p className="text-xs text-gray-400">
          {rows.length} animal{rows.length !== 1 ? "is" : ""} · filtro ativo
        </p>
      )}

      <TabelaPesagens rows={rows} />
    </div>
  );
}
