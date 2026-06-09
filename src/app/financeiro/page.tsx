import { createClient } from "@/lib/supabase/server";
import { formatCurrency, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, TrendingDown, ChevronDown, Plus, BarChart3 } from "lucide-react";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";
import { VincularDropdown } from "./VincularDropdown";
import { VinculoCell } from "./VinculoCell";
import NovaTransacaoForm from "./NovaTransacaoForm";
import BotaoExcluirTransacao from "./BotaoExcluirTransacao";
import BotaoEditarTransacao from "./BotaoEditarTransacao";
import { Suspense } from "react";
import BuscaFinanceiro from "./BuscaFinanceiro";
import { ViewToggle } from "./ViewToggle";
import FiltroFinanceiro from "./FiltroFinanceiro";

// ── Helpers ────────────────────────────────────────────────────────────────────

function nomeLimpo(animalNome: string | null): string {
  if (!animalNome) return "—";
  return animalNome
    .replace(/^prenhez\s+/i, "")
    .replace(/^aspira[çc][aã]o\s+/i, "")
    .trim() || "—";
}

function tipoLabel(tipo: string, animalNome: string | null, categoria?: string | null): string {
  const isCompra = tipo === "COMPRA";
  const base = isCompra ? "Compra de" : "Venda de";
  if (categoria) {
    const mapCat: Record<string, string> = {
      ANIMAL:    "Animal",
      DOADORA:   "Doadora",
      RECEPTORA: "Receptora",
      TOURO:     "Touro",
      EMBRIAO:   "Embrião",
      ASPIRACAO: "Aspiração",
      PRENHEZ:   "Prenhez",
      SEMEN:     "Sêmen",
      LEILAO:    "Leilão",
      OUTRO:     "Outro",
    };
    return `${base} ${mapCat[categoria] ?? categoria}`;
  }
  const nome = (animalNome ?? "").toLowerCase();
  if (nome.startsWith("prenhez ")) return `${base} Prenhez`;
  if (nome.startsWith("aspiração ") || nome.startsWith("aspiracao ")) return `${base} Aspiração`;
  return `${base} Animal`;
}

function categoriaBadge(categoria: string | null): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    ANIMAL:    { label: "Animal",    cls: "bg-indigo-100 text-indigo-700" },
    DOADORA:   { label: "Doadora",   cls: "bg-purple-100 text-purple-700" },
    RECEPTORA: { label: "Receptora", cls: "bg-green-100 text-green-700"   },
    TOURO:     { label: "Touro",     cls: "bg-blue-100 text-blue-700"     },
    EMBRIAO:   { label: "Embrião",   cls: "bg-yellow-100 text-yellow-700" },
    ASPIRACAO: { label: "Aspiração", cls: "bg-pink-100 text-pink-700"     },
    PRENHEZ:   { label: "Prenhez",   cls: "bg-orange-100 text-orange-700" },
    SEMEN:     { label: "Sêmen",     cls: "bg-teal-100 text-teal-700"     },
    LEILAO:    { label: "Leilão",    cls: "bg-gray-100 text-gray-600"     },
    OUTRO:     { label: "Outro",     cls: "bg-gray-100 text-gray-500"     },
  };
  if (!categoria) return { label: "", cls: "" };
  return map[categoria] ?? { label: categoria, cls: "bg-gray-100 text-gray-500" };
}

function labelMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const idx = parseInt(mes) - 1;
  return `${nomes[idx] ?? mes} / ${ano}`;
}

// ── Classificadores de categoria ──────────────────────────────────────────────

function isAnimal(t: any) {
  const cat = t.categoria;
  if (cat) return ["ANIMAL", "DOADORA", "TOURO"].includes(cat);
  const nome = (t.animal_nome ?? "").toLowerCase();
  return !nome.startsWith("prenhez ") && !nome.startsWith("aspiração ") && !nome.startsWith("aspiracao ");
}
function isPrenhez(t: any) {
  const cat = t.categoria;
  if (cat) return cat === "PRENHEZ";
  return (t.animal_nome ?? "").toLowerCase().startsWith("prenhez ");
}
function isAspiracao(t: any) {
  const cat = t.categoria;
  if (cat) return ["ASPIRACAO", "EMBRIAO", "SEMEN"].includes(cat);
  const nome = (t.animal_nome ?? "").toLowerCase();
  return nome.startsWith("aspiração ") || nome.startsWith("aspiracao ");
}
function isRebanho(t: any) {
  return t.categoria === "RECEPTORA";
}

function parcelaMensalDe(list: any[]): number {
  return list.reduce((s, t) => {
    const parcelas: any[] = t.installments ?? [];
    const n = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
    const val = parcelas[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0);
    return s + val;
  }, 0);
}
function totalDe(list: any[]): number {
  return list.reduce((s, t) => s + (t.valor_total ?? 0), 0);
}

// ── Aplica filtro de categoria à lista ────────────────────────────────────────

function aplicarFiltro(list: any[], filtro: string): any[] {
  if (!filtro || filtro === "tudo") return list;
  if (filtro === "compras")           return list.filter(t => t.tipo === "COMPRA");
  if (filtro === "compras-animal")    return list.filter(t => t.tipo === "COMPRA" && isAnimal(t));
  if (filtro === "compras-prenhez")   return list.filter(t => t.tipo === "COMPRA" && isPrenhez(t));
  if (filtro === "compras-aspiracao") return list.filter(t => t.tipo === "COMPRA" && isAspiracao(t));
  if (filtro === "vendas")            return list.filter(t => t.tipo === "VENDA");
  if (filtro === "vendas-animal")     return list.filter(t => t.tipo === "VENDA" && isAnimal(t));
  if (filtro === "vendas-prenhez")    return list.filter(t => t.tipo === "VENDA" && isPrenhez(t));
  if (filtro === "vendas-aspiracao")  return list.filter(t => t.tipo === "VENDA" && isAspiracao(t));
  if (filtro === "vendas-rebanho")    return list.filter(t => t.tipo === "VENDA" && isRebanho(t));
  return list;
}

export const revalidate = 0;

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; filtro?: string }>;
}) {
  const { q, view, filtro } = await searchParams;
  // "tabela" é o padrão — "cards" precisa de ?view=cards
  const modoView: "cards" | "tabela" = view === "cards" ? "cards" : "tabela";
  const filtroAtivo = filtro ?? "";
  const query = (q ?? "").toLowerCase().trim();
  const supabase = await createClient();

  const { data: doadoras } = await supabase
    .from("animals")
    .select("id, nome, rgn, percentual_proprio")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA")
    .order("nome");

  const { data: touros } = await supabase
    .from("animals")
    .select("id, nome, rgn")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "TOURO")
    .order("nome");

  const animaisVincularLista = [
    ...(doadoras ?? []),
    ...(touros ?? []),
  ]
    .map((a: any) => ({ id: a.id as string, nome: a.nome as string, rgn: (a.rgn ?? null) as string | null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const doadoraIds = new Set((doadoras ?? []).map((d: any) => d.id as string));
  const touroIds   = new Set((touros   ?? []).map((t: any) => t.id as string));

  const { data: leiloesRaw } = await supabase
    .from("auctions")
    .select("id, nome, data")
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });
  const leiloesOpt = (leiloesRaw ?? []).map((l: any) => ({ id: l.id as string, nome: l.nome as string }));

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(`
      id, tipo, categoria, animal_nome, doadora_id, contraparte, valor_total, n_parcelas, observacoes, data,
      auction:auctions ( id, nome, data, local ),
      installments ( numero, vencimento, valor, status ),
      transaction_animals ( animal_id, animal:animals ( id, nome, rgn ) )
    `)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });

  function animaisDaTx(t: any): { id: string; nome: string; rgn: string | null }[] {
    const arr = (t.transaction_animals ?? []) as any[];
    const fromLink = arr
      .map((l: any) => l.animal)
      .filter(Boolean)
      .map((a: any) => ({ id: a.id, nome: a.nome ?? "—", rgn: a.rgn ?? null }));
    if (fromLink.length === 0 && t.doadora_id) {
      const d = (doadoras ?? []).find((x: any) => x.id === t.doadora_id);
      if (d) return [{ id: d.id, nome: d.nome ?? "—", rgn: d.rgn ?? null }];
    }
    return fromLink;
  }

  const txsAll = transactions ?? [];

  // Filtra por busca textual
  const txsQ = query
    ? txsAll.filter((t) => {
        const auc = (t.auction as any);
        return (
          auc?.nome?.toLowerCase().includes(query) ||
          auc?.local?.toLowerCase().includes(query) ||
          t.animal_nome?.toLowerCase().includes(query) ||
          t.contraparte?.toLowerCase().includes(query) ||
          labelMes((t.data ?? "").substring(0, 7)).toLowerCase().includes(query)
        );
      })
    : txsAll;

  // Aplica filtro de categoria
  const txs = aplicarFiltro(txsQ, filtroAtivo);

  // ── Totais gerais (sempre do txsAll — cards de resumo não respeitam filtro) ──
  const comprasAll = txsAll.filter(t => t.tipo === "COMPRA");
  const vendasAll  = txsAll.filter(t => t.tipo === "VENDA");

  // Subcategorias de compra
  const comprasAnimal    = comprasAll.filter(isAnimal);
  const comprasPrenhez   = comprasAll.filter(isPrenhez);
  const comprasAspiracao = comprasAll.filter(isAspiracao);

  // Subcategorias de venda
  const vendasAnimal    = vendasAll.filter(isAnimal);
  const vendasPrenhez   = vendasAll.filter(isPrenhez);
  const vendasAspiracao = vendasAll.filter(isAspiracao);
  const vendasRebanho   = vendasAll.filter(isRebanho);

  // Totais agregados para os cards principais
  const parcelaMensalCompras = parcelaMensalDe(comprasAll);
  // Vendas de parcelas: exclui rebanho (receptoras) — valores pontuais, não recorrentes
  const vendasSemRebanho        = vendasAll.filter(t => !isRebanho(t));
  const parcelaMensalVendas     = parcelaMensalDe(vendasSemRebanho);
  const saldoMensal             = parcelaMensalVendas - parcelaMensalCompras;
  const totalCompras            = totalDe(comprasAll);
  const totalVendas             = totalDe(vendasAll);
  const saldo                   = totalVendas - totalCompras;

  // Valorização do plantel a 100%
  const doadorasPercMap = new Map(
    (doadoras ?? []).map((d: any) => [d.id as string, (d.percentual_proprio as number | null)])
  );
  const valorizacaoPlantel = txsAll
    .filter((t: any) => t.tipo === "COMPRA" && (t.categoria === "DOADORA" || t.categoria === "ANIMAL"))
    .reduce((s, t: any) => {
      const txAnimals = (t.transaction_animals ?? []) as any[];
      const linkedId  = txAnimals.find((ta: any) => ta.animal)?.animal?.id ?? t.doadora_id ?? null;
      const perc      = (linkedId ? doadorasPercMap.get(linkedId) : null) ?? 1;
      const safePerc  = (perc > 0) ? perc : 1;
      return s + (t.valor_total ?? 0) / safePerc;
    }, 0);
  const qtdDoadoras = txsAll.filter((t: any) =>
    t.tipo === "COMPRA" && (t.categoria === "DOADORA" || t.categoria === "ANIMAL")
  ).length;

  // ── Agrupar por leilão (para modo cards) ────────────────────────────────────
  type LeilaoGrp = { auction: any; compras: any[]; vendas: any[]; dataRef: string };
  const leiloesMapa: Record<string, LeilaoGrp> = {};
  for (const t of txs) {
    const auc = t.auction as any;
    const key = auc?.id ?? `no-auction-${t.data ?? "x"}`;
    if (!leiloesMapa[key]) {
      leiloesMapa[key] = { auction: auc, compras: [], vendas: [], dataRef: auc?.data ?? t.data ?? "0000-00-00" };
    }
    if (t.tipo === "COMPRA") leiloesMapa[key].compras.push(t);
    else leiloesMapa[key].vendas.push(t);
  }

  type MesGrp = { chave: string; label: string; leiloes: LeilaoGrp[]; totalC: number; totalV: number };
  const mesMapa: Record<string, MesGrp> = {};
  for (const leilao of Object.values(leiloesMapa)) {
    const chave = (leilao.dataRef ?? "0000-00").substring(0, 7);
    if (!mesMapa[chave]) {
      mesMapa[chave] = { chave, label: labelMes(chave), leiloes: [], totalC: 0, totalV: 0 };
    }
    mesMapa[chave].leiloes.push(leilao);
    mesMapa[chave].totalC += leilao.compras.reduce((s, t: any) => s + (t.valor_total ?? 0), 0);
    mesMapa[chave].totalV += leilao.vendas.reduce((s, t: any) => s + (t.valor_total ?? 0), 0);
  }
  const meses = Object.values(mesMapa).sort((a, b) => b.chave.localeCompare(a.chave));

  // ── Label do filtro ativo (para subtítulo do PDF) ─────────────────────────
  const filtroLabels: Record<string, string> = {
    "":                  "Todas as transações",
    "compras":           "Compras",
    "compras-animal":    "Compras de Animal",
    "compras-prenhez":   "Compras de Prenhez",
    "compras-aspiracao": "Compras de Aspiração",
    "vendas":            "Vendas",
    "vendas-animal":     "Vendas de Animal",
    "vendas-prenhez":    "Vendas de Prenhez",
    "vendas-aspiracao":  "Vendas de Aspiração",
    "vendas-rebanho":    "Vendas de Rebanho",
  };

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {txsAll.length} transações · {comprasAll.length} compras · {vendasAll.length} vendas
          </p>
        </div>
        <ExportarPDF
          titulo="Financeiro"
          subtitulo="SE Agropecuária Nelore de Elite"
          orientacao="landscape"
          nomeArquivo="SE_Financeiro.pdf"
          grupos={[
            { key: "COMPRA_ANIMAL",    label: "Compra — Animal",    padrao: true },
            { key: "COMPRA_PRENHEZ",   label: "Compra — Prenhez",   padrao: true },
            { key: "COMPRA_ASPIRACAO", label: "Compra — Aspiração", padrao: true },
            { key: "VENDA_ANIMAL",     label: "Venda — Animal",     padrao: true },
            { key: "VENDA_PRENHEZ",    label: "Venda — Prenhez",    padrao: true },
            { key: "VENDA_ASPIRACAO",  label: "Venda — Aspiração",  padrao: true },
            { key: "VENDA_REBANHO",    label: "Venda — Rebanho",    padrao: true },
            { key: "OUTRO",            label: "Outros",             padrao: true },
          ]}
          campoGrupo="grupo"
          colunas={[
            { key: "data",          label: "Data",               padrao: true,  largura: 1.0 },
            { key: "leilao",        label: "Leilão",             padrao: true,  largura: 1.8 },
            { key: "animal",        label: "Animal",             padrao: true,  largura: 2.0 },
            { key: "categoria",     label: "Categoria",          padrao: true,  largura: 1.0 },
            { key: "tipo",          label: "Tipo",               padrao: true,  largura: 1.0 },
            { key: "contraparte",   label: "Comprador/Vendedor", padrao: true,  largura: 1.8 },
            { key: "valor_parcela", label: "Valor Parcela",      padrao: true,  largura: 1.0 },
            { key: "n_parcelas",    label: "Parcelas",           padrao: true,  largura: 0.7 },
            { key: "valor_total",   label: "Valor Total",        padrao: true,  largura: 1.1 },
            { key: "observacoes",   label: "Observações",        padrao: false, largura: 2.0 },
          ] satisfies ColunaPDF[]}
          dados={[...txsAll].sort((a: any, b: any) => {
            const da = a.data ?? (a.auction as any)?.data ?? "";
            const db = b.data ?? (b.auction as any)?.data ?? "";
            return db.localeCompare(da);
          }).map((t: any) => {
            const parcelas: any[] = t.installments ?? [];
            const nParcelas = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
            const valorParcela = parcelas[0]?.valor ?? (t.valor_total != null ? t.valor_total / nParcelas : null);
            const auc = t.auction as any;
            const dataRef = t.data ?? auc?.data ?? null;
            const catMap: Record<string, string> = {
              ANIMAL: "Animal", DOADORA: "Doadora", RECEPTORA: "Receptora", TOURO: "Touro",
              EMBRIAO: "Embrião", ASPIRACAO: "Aspiração", PRENHEZ: "Prenhez", SEMEN: "Sêmen",
              LEILAO: "Leilão", OUTRO: "Outro",
            };
            // Determina grupo para filtro do PDF
            let grupo = "OUTRO";
            if (t.tipo === "COMPRA") {
              if (isAnimal(t))    grupo = "COMPRA_ANIMAL";
              else if (isPrenhez(t))   grupo = "COMPRA_PRENHEZ";
              else if (isAspiracao(t)) grupo = "COMPRA_ASPIRACAO";
            } else {
              if (isRebanho(t))        grupo = "VENDA_REBANHO";
              else if (isAnimal(t))    grupo = "VENDA_ANIMAL";
              else if (isPrenhez(t))   grupo = "VENDA_PRENHEZ";
              else if (isAspiracao(t)) grupo = "VENDA_ASPIRACAO";
            }
            return {
              grupo,
              data:          dataRef ? new Date(dataRef + "T12:00:00").toLocaleDateString("pt-BR") : "—",
              leilao:        auc?.nome ?? "Avulsa",
              animal:        nomeLimpo(t.animal_nome),
              categoria:     catMap[t.categoria] ?? t.categoria ?? "—",
              tipo:          t.tipo === "COMPRA" ? "Compra" : "Venda",
              contraparte:   t.contraparte ?? "—",
              valor_parcela: valorParcela != null ? formatCurrency(valorParcela) : "—",
              n_parcelas:    `${nParcelas}×`,
              valor_total:   t.valor_total != null ? formatCurrency(t.valor_total) : "—",
              observacoes:   t.observacoes ?? "—",
            };
          })}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          Erro: {error.message}
        </div>
      )}

      {/* ── Cards principais ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

        {/* Saída / Mês */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingDown className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-gray-500 uppercase tracking-wide">Saída / Mês</p>
          </div>
          <p className="text-2xl font-bold text-red-600 truncate">{formatCurrency(parcelaMensalCompras)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {comprasAll.length} compras
            <span className="mx-1.5 text-gray-200">·</span>
            <span className="text-gray-300">total {formatCurrency(totalCompras)}</span>
          </p>
        </div>

        {/* Entrada / Mês (sem rebanho) */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-gray-500 uppercase tracking-wide">Entrada / Mês</p>
          </div>
          <p className="text-2xl font-bold text-green-600 truncate">{formatCurrency(parcelaMensalVendas)}</p>
          <p className="text-xs text-gray-400 mt-1">
            animal · prenhez · aspiração
            <span className="mx-1.5 text-gray-200">·</span>
            <span className="text-gray-300">total {formatCurrency(totalDe(vendasSemRebanho))}</span>
          </p>
        </div>

        {/* Saldo / Mês */}
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Saldo / Mês</p>
          <p className={`text-2xl font-bold truncate ${saldoMensal >= 0 ? "text-green-600" : "text-red-600"}`}>
            {saldoMensal >= 0 ? "+" : ""}{formatCurrency(saldoMensal)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            entrada − saída
            <span className="mx-1.5 text-gray-200">·</span>
            <span className="text-gray-300">total {saldo >= 0 ? "+" : ""}{formatCurrency(saldo)}</span>
          </p>
        </div>

        {/* Valorização do plantel */}
        <div className="card p-4 border-l-4 border-l-brand-500">
          <div className="flex items-center gap-2 mb-1.5">
            <BarChart3 className="w-4 h-4 text-brand-500 shrink-0" />
            <p className="text-xs text-gray-500 uppercase tracking-wide">Valorização do Plantel</p>
          </div>
          <p className="text-2xl font-bold text-brand-700 truncate">{formatCurrency(valorizacaoPlantel)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {qtdDoadoras} doadoras compradas
            <span className="mx-1.5 text-gray-200">·</span>
            <span className="text-gray-300">valor extrapolado a 100%</span>
          </p>
        </div>

      </div>

      {/* ── Inventário por categoria ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Compras por categoria */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Compras por Categoria</h3>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-50">
            {[
              { label: "Animal",    list: comprasAnimal,    cls: "bg-indigo-100 text-indigo-700" },
              { label: "Prenhez",   list: comprasPrenhez,   cls: "bg-orange-100 text-orange-700" },
              { label: "Aspiração", list: comprasAspiracao, cls: "bg-pink-100 text-pink-700"     },
            ].map(({ label, list, cls }) => list.length > 0 && (
              <div key={label} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${cls}`}>{label}</span>
                  <span className="text-xs text-gray-400">{list.length}×</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-red-600">{formatCurrency(parcelaMensalDe(list))}<span className="text-[10px] font-normal text-gray-400">/mês</span></div>
                  <div className="text-[10px] text-gray-400">total {formatCurrency(totalDe(list))}</div>
                </div>
              </div>
            ))}
            <div className="px-4 py-3 flex items-center justify-between bg-red-50">
              <span className="text-xs font-bold text-gray-700">Total Compras · {comprasAll.length}</span>
              <div className="text-right">
                <div className="text-sm font-bold text-red-600">{formatCurrency(parcelaMensalCompras)}<span className="text-[10px] font-normal text-red-400">/mês</span></div>
                <div className="text-[10px] text-red-400">total {formatCurrency(totalCompras)}</div>
              </div>
            </div>
          </div>

          {/* Desktop */}
          <table className="w-full text-xs hidden md:table">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Categoria</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase text-right">Qtd</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase text-right">Parcela/Mês</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: "Animal",    list: comprasAnimal,    cls: "bg-indigo-100 text-indigo-700" },
                { label: "Prenhez",   list: comprasPrenhez,   cls: "bg-orange-100 text-orange-700" },
                { label: "Aspiração", list: comprasAspiracao, cls: "bg-pink-100 text-pink-700"     },
              ].map(({ label, list, cls }) => list.length > 0 && (
                <tr key={label} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{label}</span></td>
                  <td className="px-4 py-2.5 text-right text-gray-500 font-medium">{list.length}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatCurrency(parcelaMensalDe(list))}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-red-700">{formatCurrency(totalDe(list))}</td>
                </tr>
              ))}
              <tr className="bg-red-50">
                <td className="px-4 py-2.5 font-bold text-gray-700 text-[11px]">Total Compras</td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-600">{comprasAll.length}</td>
                <td className="px-4 py-2.5 text-right font-bold text-red-600">{formatCurrency(parcelaMensalCompras)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-red-700">{formatCurrency(totalCompras)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Vendas por categoria */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Vendas por Categoria</h3>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-50">
            {[
              { label: "Animal",    list: vendasAnimal,    cls: "bg-indigo-100 text-indigo-700", naoRecorrente: false },
              { label: "Prenhez",   list: vendasPrenhez,   cls: "bg-orange-100 text-orange-700", naoRecorrente: false },
              { label: "Aspiração", list: vendasAspiracao, cls: "bg-pink-100 text-pink-700",     naoRecorrente: false },
              { label: "Rebanho",   list: vendasRebanho,   cls: "bg-green-100 text-green-700",   naoRecorrente: true  },
            ].map(({ label, list, cls, naoRecorrente }) => list.length > 0 && (
              <div key={label} className={`px-4 py-3 flex items-center justify-between gap-3 ${naoRecorrente ? "bg-amber-50/50" : ""}`}>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${cls}`}>{label}</span>
                  <span className="text-xs text-gray-400">{list.length}×</span>
                  {naoRecorrente && <span className="text-[9px] text-amber-600 font-medium italic">não recorrente</span>}
                </div>
                <div className="text-right shrink-0">
                  {naoRecorrente
                    ? <div className="text-sm font-bold text-green-600">—<span className="text-[10px] font-normal text-gray-400">/mês</span></div>
                    : <div className="text-sm font-bold text-green-600">{formatCurrency(parcelaMensalDe(list))}<span className="text-[10px] font-normal text-gray-400">/mês</span></div>
                  }
                  <div className="text-[10px] text-gray-400">total {formatCurrency(totalDe(list))}</div>
                </div>
              </div>
            ))}
            {vendasRebanho.length > 0 && (
              <div className="px-4 py-2.5 flex items-center justify-between bg-green-50/70 border-t border-green-100">
                <span className="text-[10px] text-gray-500">Recorrentes (sem Rebanho) · {vendasSemRebanho.length}</span>
                <div className="text-right">
                  <div className="text-xs font-semibold text-green-600">{formatCurrency(parcelaMensalDe(vendasSemRebanho))}<span className="text-[9px] font-normal text-gray-400">/mês</span></div>
                  <div className="text-[9px] text-gray-400">total {formatCurrency(totalDe(vendasSemRebanho))}</div>
                </div>
              </div>
            )}
            <div className="px-4 py-3 flex items-center justify-between bg-green-50">
              <span className="text-xs font-bold text-gray-700">Total Geral · {vendasAll.length}</span>
              <div className="text-right">
                <div className="text-sm font-bold text-green-600">{formatCurrency(parcelaMensalVendas)}<span className="text-[10px] font-normal text-green-400">/mês</span></div>
                <div className="text-[10px] text-green-400">total {formatCurrency(totalVendas)}</div>
              </div>
            </div>
          </div>

          {/* Desktop */}
          <table className="w-full text-xs hidden md:table">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Categoria</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase text-right">Qtd</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase text-right">Parcela/Mês</th>
                <th className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: "Animal",    list: vendasAnimal,    cls: "bg-indigo-100 text-indigo-700", naoRecorrente: false },
                { label: "Prenhez",   list: vendasPrenhez,   cls: "bg-orange-100 text-orange-700", naoRecorrente: false },
                { label: "Aspiração", list: vendasAspiracao, cls: "bg-pink-100 text-pink-700",     naoRecorrente: false },
                { label: "Rebanho",   list: vendasRebanho,   cls: "bg-green-100 text-green-700",   naoRecorrente: true  },
              ].map(({ label, list, cls, naoRecorrente }) => list.length > 0 && (
                <tr key={label} className={`hover:bg-gray-50 ${naoRecorrente ? "bg-amber-50/40" : ""}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{label}</span>
                      {naoRecorrente && <span className="text-[9px] text-amber-600 font-medium italic">não recorrente (venda pontual)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 font-medium">{list.length}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-400">
                    {naoRecorrente ? "—" : formatCurrency(parcelaMensalDe(list))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(totalDe(list))}</td>
                </tr>
              ))}
              {vendasRebanho.length > 0 && (
                <tr className="bg-green-50/60 border-t border-green-100">
                  <td className="px-4 py-2 text-[10px] text-gray-500 font-semibold">Recorrentes (sem Rebanho)</td>
                  <td className="px-4 py-2 text-right text-gray-400 text-[10px]">{vendasSemRebanho.length}</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-600 text-[10px]">{formatCurrency(parcelaMensalDe(vendasSemRebanho))}</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-700 text-[10px]">{formatCurrency(totalDe(vendasSemRebanho))}</td>
                </tr>
              )}
              <tr className="bg-green-50">
                <td className="px-4 py-2.5 font-bold text-gray-700 text-[11px]">Total Geral</td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-600">{vendasAll.length}</td>
                <td className="px-4 py-2.5 text-right font-bold text-green-600">{formatCurrency(parcelaMensalVendas)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(totalVendas)}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* ── Nova Transação ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Registrar Nova Transação</h2>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
          </summary>
          <NovaTransacaoForm doadoras={doadoras ?? []} />
        </details>
      </div>

      {/* ── Histórico ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">Histórico</h2>
          {(query || filtroAtivo) && (
            <span className="badge bg-brand-100 text-brand-700">
              {txs.length} resultado{txs.length !== 1 ? "s" : ""}
              {filtroAtivo ? ` · ${filtroLabels[filtroAtivo] ?? filtroAtivo}` : ""}
              {query ? ` · "${q}"` : ""}
            </span>
          )}
          {!query && !filtroAtivo && (
            <span className="badge bg-gray-100 text-gray-600">{modoView === "tabela" ? `${txs.length} transações` : `${meses.length} meses`}</span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 shrink-0">
            <Suspense fallback={null}>
              <ViewToggle active={modoView} />
            </Suspense>
            <Suspense fallback={null}>
              <BuscaFinanceiro />
            </Suspense>
          </div>
        </div>

        {/* ── Filtros de categoria ───────────────────────────────────── */}
        <Suspense fallback={null}>
          <FiltroFinanceiro active={filtroAtivo} />
        </Suspense>

        {txs.length === 0 && (
          <div className="card p-10 text-center text-gray-400 text-sm">
            {query || filtroAtivo ? "Nenhum resultado para os filtros aplicados." : "Nenhuma transação registrada ainda."}
          </div>
        )}

        {/* ── Modo Tabela ────────────────────────────────────────────── */}
        {modoView === "tabela" && txs.length > 0 && (() => {
          const txsOrdenadas = [...txs].sort((a: any, b: any) => {
            const da = a.data ?? (a.auction as any)?.data ?? "";
            const db = b.data ?? (b.auction as any)?.data ?? "";
            return db.localeCompare(da);
          });

          // Totais da seleção filtrada
          const totalParcelaSel = txsOrdenadas.reduce((s, t: any) => {
            const parcelas: any[] = t.installments ?? [];
            const n = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
            return s + (parcelas[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0));
          }, 0);
          const totalValorSel = txsOrdenadas.reduce((s, t: any) => s + (t.valor_total ?? 0), 0);
          const totalParcelaComprasSel = txsOrdenadas.filter(t => t.tipo === "COMPRA").reduce((s, t: any) => {
            const parcelas: any[] = t.installments ?? [];
            const n = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
            return s + (parcelas[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0));
          }, 0);
          const totalParcelaVendasSel = txsOrdenadas.filter(t => t.tipo === "VENDA").reduce((s, t: any) => {
            const parcelas: any[] = t.installments ?? [];
            const n = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
            return s + (parcelas[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0));
          }, 0);
          const totalComprasSel = txsOrdenadas.filter(t => t.tipo === "COMPRA").reduce((s, t: any) => s + (t.valor_total ?? 0), 0);
          const totalVendasSel  = txsOrdenadas.filter(t => t.tipo === "VENDA").reduce((s, t: any) => s + (t.valor_total ?? 0), 0);

          return (
            <div className="card overflow-hidden">
              {/* Barra de totais da seleção */}
              {(filtroAtivo || query) && (
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 text-xs">
                  <span className="text-gray-500 font-medium">{txsOrdenadas.length} registros selecionados</span>
                  {totalComprasSel > 0 && (
                    <span className="text-red-600 font-semibold">
                      Compras: <span className="font-bold">{formatCurrency(totalParcelaComprasSel)}/mês</span>
                      <span className="text-red-400 ml-1 font-normal">· total {formatCurrency(totalComprasSel)}</span>
                    </span>
                  )}
                  {totalVendasSel > 0 && (
                    <span className="text-green-600 font-semibold">
                      Vendas: <span className="font-bold">{formatCurrency(totalParcelaVendasSel)}/mês</span>
                      <span className="text-green-400 ml-1 font-normal">· total {formatCurrency(totalVendasSel)}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Data</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Leilão</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Animal</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Categoria</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Tipo</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Comprador / Vendedor</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Parcela/Mês</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Nº Parcelas</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Valor Total</th>
                      <th className="px-3 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Vínculo</th>
                      <th className="px-3 py-2.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {txsOrdenadas.map((t: any) => {
                      const parcelas: any[] = t.installments ?? [];
                      const nParcelas = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
                      const valorParcela = parcelas[0]?.valor
                        ?? (t.valor_total != null ? t.valor_total / nParcelas : null);
                      const label = tipoLabel(t.tipo, t.animal_nome, t.categoria);
                      const isCompra = t.tipo === "COMPRA";
                      const catBadge = categoriaBadge(t.categoria);
                      const auc = t.auction as any;
                      const dataRef = t.data ?? auc?.data ?? null;
                      const dataFormatada = dataRef
                        ? new Date(dataRef + "T12:00:00").toLocaleDateString("pt-BR")
                        : "—";

                      // Determina link para a ficha do animal
                      const linkedAnimais = animaisDaTx(t);
                      const linkedId = linkedAnimais[0]?.id ?? t.doadora_id ?? null;
                      const animalHref = linkedId
                        ? doadoraIds.has(linkedId) ? `/doadoras/${linkedId}`
                        : touroIds.has(linkedId)   ? `/machos/${linkedId}`
                        : null
                        : null;

                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap font-mono">{dataFormatada}</td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {auc?.nome
                              ? <span title={auc.local ?? ""}>{auc.nome}</span>
                              : <span className="text-gray-400 italic">Avulsa</span>}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            {animalHref
                              ? <Link href={animalHref} className="hover:text-brand-600 hover:underline transition-colors">{nomeLimpo(t.animal_nome)}</Link>
                              : nomeLimpo(t.animal_nome)}
                          </td>
                          <td className="px-3 py-2.5">
                            {catBadge.label
                              ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${catBadge.cls}`}>{catBadge.label}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`badge ${isCompra ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                              {label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500">
                            {t.contraparte
                              ? <span><span className="text-gray-400 mr-1">{isCompra ? "Vend.:" : "Comp.:"}</span>{t.contraparte}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <span className={`font-bold ${isCompra ? "text-red-600" : "text-green-700"}`}>
                              {valorParcela != null ? formatCurrency(valorParcela) : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600 font-medium whitespace-nowrap">
                            {nParcelas}×
                          </td>
                          <td className={`px-3 py-2.5 text-right whitespace-nowrap`}>
                            <div>
                              <div className={`font-bold text-sm ${isCompra ? "text-red-700" : "text-green-800"}`}>
                                {t.valor_total != null
                                  ? formatCurrency(t.valor_total)
                                  : (valorParcela != null ? formatCurrency(valorParcela * nParcelas) : "—")}
                              </div>
                              {valorParcela != null && nParcelas > 1 && (
                                <div className="text-[10px] text-gray-400 font-normal">
                                  {formatCurrency(valorParcela)} × {nParcelas}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <VinculoCell
                              txId={t.id}
                              animais={animaisDaTx(t)}
                              doadoras={animaisVincularLista}
                            />
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <BotaoEditarTransacao
                                txId={t.id}
                                animalNome={nomeLimpo(t.animal_nome)}
                                contraparte={t.contraparte ?? ""}
                                valorParcela={valorParcela ?? (t.valor_total != null ? t.valor_total / nParcelas : 0)}
                                nParcelas={nParcelas}
                                data={t.data ?? ""}
                                observacoes={t.observacoes ?? ""}
                                tipo={t.tipo}
                                categoria={t.categoria ?? null}
                                auctionId={(t.auction as any)?.id ?? null}
                                leiloes={leiloesOpt}
                              />
                              <BotaoExcluirTransacao
                                txId={t.id}
                                label={`${tipoLabel(t.tipo, t.animal_nome, t.categoria)} — ${nomeLimpo(t.animal_nome)}`}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Rodapé com totais por tipo + saldo */}
                  <tfoot>
                    {totalComprasSel > 0 && (
                      <tr className="bg-red-50 border-t border-red-100">
                        <td colSpan={6} className="px-3 py-2 text-xs font-bold text-red-700">
                          ↓ Compras · {txsOrdenadas.filter(t => t.tipo === "COMPRA").length}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-red-600">
                          {formatCurrency(totalParcelaComprasSel)}
                        </td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-red-700">
                          {formatCurrency(totalComprasSel)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                    {totalVendasSel > 0 && (
                      <tr className="bg-green-50 border-t border-green-100">
                        <td colSpan={6} className="px-3 py-2 text-xs font-bold text-green-700">
                          ↑ Vendas · {txsOrdenadas.filter(t => t.tipo === "VENDA").length}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-green-600">
                          {formatCurrency(totalParcelaVendasSel)}
                        </td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-green-700">
                          {formatCurrency(totalVendasSel)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                    {(() => {
                      const saldoParcela = totalParcelaVendasSel - totalParcelaComprasSel;
                      const saldoTotal   = totalVendasSel - totalComprasSel;
                      const pos = saldoTotal >= 0;
                      return (
                        <tr className={`border-t-2 ${pos ? "bg-green-100 border-green-300" : "bg-red-100 border-red-300"}`}>
                          <td colSpan={6} className={`px-3 py-2.5 text-xs font-bold ${pos ? "text-green-800" : "text-red-800"}`}>
                            ⚖ Saldo · {txsOrdenadas.length} transações
                          </td>
                          <td className={`px-3 py-2.5 text-right text-sm font-bold ${pos ? "text-green-700" : "text-red-700"}`}>
                            {saldoParcela >= 0 ? "+" : ""}{formatCurrency(saldoParcela)}
                          </td>
                          <td className="px-3 py-2.5"></td>
                          <td className={`px-3 py-2.5 text-right text-sm font-bold ${pos ? "text-green-800" : "text-red-800"}`}>
                            {saldoTotal >= 0 ? "+" : ""}{formatCurrency(saldoTotal)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ── Modo Cards (agrupado por mês/leilão) ───────────────────── */}
        {modoView === "cards" && meses.map((mes) => (
          <details key={mes.chave} className="card overflow-hidden group" open={meses.indexOf(mes) === 0}>
            <summary className="px-5 py-4 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-gray-900">{mes.label}</span>
                <div className="ml-auto flex items-center gap-4 text-sm shrink-0">
                  {mes.totalC > 0 && (
                    <span className="text-red-500">
                      <span className="font-semibold">{formatCurrency(mes.totalC)}</span>
                      <span className="text-xs ml-1 text-red-400">comprado</span>
                    </span>
                  )}
                  {mes.totalV > 0 && (
                    <span className="text-green-600">
                      <span className="font-semibold">{formatCurrency(mes.totalV)}</span>
                      <span className="text-xs ml-1 text-green-500">vendido</span>
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </summary>

            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {mes.leiloes.map((l, idx) => {
                const auc = l.auction;
                const totalLC = l.compras.reduce((s: number, t: any) => s + (t.valor_total ?? 0), 0);
                const totalLV = l.vendas.reduce((s: number, t: any) => s + (t.valor_total ?? 0), 0);
                const allTxs = [
                  ...l.compras.map((t: any) => ({ ...t, _tipo: "COMPRA" })),
                  ...l.vendas.map((t: any) => ({ ...t, _tipo: "VENDA" })),
                ];

                return (
                  <details key={auc?.id ?? idx} className="group/leilao bg-gray-50" open>
                    <summary className="px-5 py-3 cursor-pointer select-none list-none hover:bg-gray-100 transition-colors">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">{auc?.nome ?? "Transações avulsas"}</span>
                        {auc?.local && (
                          <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded border">{auc.local}</span>
                        )}
                        <div className="ml-auto flex items-center gap-3 text-xs shrink-0">
                          {totalLC > 0 && <span className="text-red-500 font-medium">{formatCurrency(totalLC)}</span>}
                          {totalLV > 0 && <span className="text-green-600 font-medium">{formatCurrency(totalLV)}</span>}
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                      </div>
                    </summary>

                    <div className="bg-white">
                      {/* Cards mobile */}
                      <div className="md:hidden divide-y divide-gray-100">
                        {allTxs.map((t: any) => {
                          const parcelas: any[] = t.installments ?? [];
                          const nParcelas = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
                          const valorParcela = parcelas[0]?.valor
                            ?? (t.valor_total != null ? t.valor_total / nParcelas : null);
                          const isCompra = (t._tipo ?? t.tipo) === "COMPRA";
                          const catBadge = categoriaBadge(t.categoria);
                          const totalTx = t.valor_total != null ? t.valor_total : (valorParcela != null ? valorParcela * nParcelas : null);
                          const mLkAnimais = animaisDaTx(t);
                          const mLkId = mLkAnimais[0]?.id ?? t.doadora_id ?? null;
                          const mLkHref = mLkId
                            ? doadoraIds.has(mLkId) ? `/doadoras/${mLkId}`
                            : touroIds.has(mLkId)   ? `/machos/${mLkId}`
                            : null : null;
                          return (
                            <div key={t.id} className="px-4 py-3">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="min-w-0">
                                  {mLkHref
                                    ? <Link href={mLkHref} className="font-medium text-gray-900 text-sm truncate block hover:text-brand-600 hover:underline">{nomeLimpo(t.animal_nome)}</Link>
                                    : <span className="font-medium text-gray-900 text-sm truncate block">{nomeLimpo(t.animal_nome)}</span>}

                                  {catBadge.label && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${catBadge.cls}`}>{catBadge.label}</span>
                                  )}
                                </div>
                                <span className={`shrink-0 badge text-xs font-semibold ${isCompra ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                                  {isCompra ? "Compra" : "Venda"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">{t.contraparte ?? "—"}</span>
                                <div className="text-right">
                                  {valorParcela != null && (
                                    <span className="text-xs text-gray-400">{formatCurrency(valorParcela)} × {nParcelas} = </span>
                                  )}
                                  <span className={`text-sm font-bold ${isCompra ? "text-red-600" : "text-green-700"}`}>
                                    {totalTx != null ? formatCurrency(totalTx) : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Tabela desktop */}
                      <table className="w-full text-xs hidden md:table">
                        <thead>
                          <tr className="bg-gray-50 border-y border-gray-100 text-left">
                            <th className="px-4 py-2 font-medium text-gray-500">Animal</th>
                            <th className="px-4 py-2 font-medium text-gray-500">Tipo</th>
                            <th className="px-4 py-2 font-medium text-gray-500">Comprador / Vendedor</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-right">Parcela/Mês</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-right">Parcelas</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-right">Valor Total</th>
                            <th className="px-4 py-2 font-medium text-gray-500"></th>
                            <th className="px-4 py-2 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {allTxs.map((t: any) => {
                            const parcelas: any[] = t.installments ?? [];
                            const nParcelas = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
                            const valorParcela = parcelas[0]?.valor
                              ?? (t.valor_total != null ? t.valor_total / nParcelas : null);
                            const label = tipoLabel(t._tipo ?? t.tipo, t.animal_nome, t.categoria);
                            const isCompra = (t._tipo ?? t.tipo) === "COMPRA";
                            const catBadge = categoriaBadge(t.categoria);
                            const lkAnimais = animaisDaTx(t);
                            const lkId = lkAnimais[0]?.id ?? t.doadora_id ?? null;
                            const lkHref = lkId
                              ? doadoraIds.has(lkId) ? `/doadoras/${lkId}`
                              : touroIds.has(lkId)   ? `/machos/${lkId}`
                              : null : null;
                            return (
                              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-gray-900">
                                  <div className="flex items-center gap-2">
                                    {lkHref
                                      ? <Link href={lkHref} className="hover:text-brand-600 hover:underline transition-colors">{nomeLimpo(t.animal_nome)}</Link>
                                      : nomeLimpo(t.animal_nome)}
                                    {catBadge.label && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${catBadge.cls}`}>{catBadge.label}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`badge ${isCompra ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>{label}</span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-500">
                                  {t.contraparte
                                    ? <span><span className="text-gray-400 mr-1">{isCompra ? "Vend.:" : "Comp.:"}</span>{t.contraparte}</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <span className={`font-bold ${isCompra ? "text-red-600" : "text-green-700"}`}>
                                    {valorParcela != null ? formatCurrency(valorParcela) : "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-600 font-medium">{nParcelas}×</td>
                                <td className="px-4 py-2.5 text-right">
                                  <div>
                                    <div className={`font-bold ${isCompra ? "text-red-700" : "text-green-800"}`}>
                                      {t.valor_total != null ? formatCurrency(t.valor_total) : (valorParcela != null ? formatCurrency(valorParcela * nParcelas) : "—")}
                                    </div>
                                    {valorParcela != null && nParcelas > 1 && (
                                      <div className="text-[10px] text-gray-400">{formatCurrency(valorParcela)} × {nParcelas}</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <VinculoCell txId={t.id} animais={animaisDaTx(t)} doadoras={animaisVincularLista} />
                                </td>
                                <td className="px-2 py-2.5 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <BotaoEditarTransacao
                                      txId={t.id}
                                      animalNome={nomeLimpo(t.animal_nome)}
                                      contraparte={t.contraparte ?? ""}
                                      valorParcela={valorParcela ?? (t.valor_total != null ? t.valor_total / nParcelas : 0)}
                                      nParcelas={nParcelas}
                                      data={t.data ?? ""}
                                      observacoes={t.observacoes ?? ""}
                                      tipo={t._tipo ?? t.tipo}
                                      categoria={t.categoria ?? null}
                                      auctionId={(t.auction as any)?.id ?? null}
                                      leiloes={leiloesOpt}
                                    />
                                    <BotaoExcluirTransacao
                                      txId={t.id}
                                      label={`${tipoLabel(t._tipo ?? t.tipo, t.animal_nome, t.categoria)} — ${nomeLimpo(t.animal_nome)}`}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          {(() => {
                            const parcC = l.compras.reduce((s: number, t: any) => {
                              const p = (t.installments ?? []) as any[];
                              const n = t.n_parcelas ?? (p.length > 0 ? p.length : 1);
                              return s + (p[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0));
                            }, 0);
                            const parcV = l.vendas.reduce((s: number, t: any) => {
                              const p = (t.installments ?? []) as any[];
                              const n = t.n_parcelas ?? (p.length > 0 ? p.length : 1);
                              return s + (p[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0));
                            }, 0);
                            const saldoParcela = parcV - parcC;
                            const saldoTotal   = totalLV - totalLC;
                            const pos = saldoTotal >= 0;
                            return (<>
                              {totalLC > 0 && (
                                <tr className="bg-red-50 border-t border-red-100">
                                  <td colSpan={3} className="px-4 py-1.5 text-[11px] font-bold text-red-700">↓ Compras · {l.compras.length}</td>
                                  <td className="px-4 py-1.5 text-right text-[11px] font-bold text-red-600">{formatCurrency(parcC)}</td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5 text-right text-[11px] font-bold text-red-700">{formatCurrency(totalLC)}</td>
                                  <td colSpan={2}></td>
                                </tr>
                              )}
                              {totalLV > 0 && (
                                <tr className="bg-green-50 border-t border-green-100">
                                  <td colSpan={3} className="px-4 py-1.5 text-[11px] font-bold text-green-700">↑ Vendas · {l.vendas.length}</td>
                                  <td className="px-4 py-1.5 text-right text-[11px] font-bold text-green-600">{formatCurrency(parcV)}</td>
                                  <td className="px-4 py-1.5"></td>
                                  <td className="px-4 py-1.5 text-right text-[11px] font-bold text-green-700">{formatCurrency(totalLV)}</td>
                                  <td colSpan={2}></td>
                                </tr>
                              )}
                              {totalLC > 0 && totalLV > 0 && (
                                <tr className={`border-t-2 ${pos ? "bg-green-100 border-green-300" : "bg-red-100 border-red-300"}`}>
                                  <td colSpan={3} className={`px-4 py-2 text-[11px] font-bold ${pos ? "text-green-800" : "text-red-800"}`}>⚖ Saldo</td>
                                  <td className={`px-4 py-2 text-right text-xs font-bold ${pos ? "text-green-700" : "text-red-700"}`}>
                                    {saldoParcela >= 0 ? "+" : ""}{formatCurrency(saldoParcela)}
                                  </td>
                                  <td className="px-4 py-2"></td>
                                  <td className={`px-4 py-2 text-right text-sm font-bold ${pos ? "text-green-800" : "text-red-800"}`}>
                                    {saldoTotal >= 0 ? "+" : ""}{formatCurrency(saldoTotal)}
                                  </td>
                                  <td colSpan={2}></td>
                                </tr>
                              )}
                            </>);
                          })()}
                        </tfoot>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
