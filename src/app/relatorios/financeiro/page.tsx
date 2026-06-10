import { createClient } from "@/lib/supabase/server";
import { formatCurrency, FARM_ID } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nomeLimpo(animalNome: string | null): string {
  if (!animalNome) return "—";
  return animalNome
    .replace(/^prenhez\s+/i, "")
    .replace(/^aspira[çc][aã]o\s+/i, "")
    .trim() || "—";
}

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

function totalDe(list: any[]): number {
  return list.reduce((s, t) => s + (t.valor_total ?? 0), 0);
}
function parcelaMensalDe(list: any[]): number {
  return list.reduce((s, t) => {
    const parcelas: any[] = t.installments ?? [];
    const n = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
    const val = parcelas[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0);
    return s + val;
  }, 0);
}

export const revalidate = 0;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RelatorioFinanceiroPage() {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      id, tipo, categoria, animal_nome, contraparte, valor_total, n_parcelas, observacoes, data,
      auction:auctions ( id, nome, data ),
      installments ( numero, vencimento, valor, status )
    `)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });

  const txsAll = transactions ?? [];

  const comprasAll    = txsAll.filter((t) => t.tipo === "COMPRA");
  const vendasAll     = txsAll.filter((t) => t.tipo === "VENDA");

  const comprasAnimal    = comprasAll.filter(isAnimal);
  const comprasPrenhez   = comprasAll.filter(isPrenhez);
  const comprasAspiracao = comprasAll.filter(isAspiracao);

  const vendasAnimal    = vendasAll.filter(isAnimal);
  const vendasPrenhez   = vendasAll.filter(isPrenhez);
  const vendasAspiracao = vendasAll.filter(isAspiracao);
  const vendasRebanho   = vendasAll.filter(isRebanho);
  const vendasSemRebanho = vendasAll.filter((t) => !isRebanho(t));

  const totalCompras = totalDe(comprasAll);
  const totalVendas  = totalDe(vendasAll);
  const saldo        = totalVendas - totalCompras;
  const parcelaMensalCompras = parcelaMensalDe(comprasAll);
  const parcelaMensalVendas  = parcelaMensalDe(vendasSemRebanho);
  const saldoMensal          = parcelaMensalVendas - parcelaMensalCompras;

  // ── Dados para PDF (mesmos grupos/colunas da aba Financeiro) ──────────────
  const catMap: Record<string, string> = {
    ANIMAL: "Animal", DOADORA: "Doadora", RECEPTORA: "Receptora", TOURO: "Touro",
    EMBRIAO: "Embrião", ASPIRACAO: "Aspiração", PRENHEZ: "Prenhez", SEMEN: "Sêmen",
    LEILAO: "Leilão", OUTRO: "Outro",
  };

  const dadosPDF = [...txsAll].sort((a: any, b: any) => {
    const da = a.data ?? (a.auction as any)?.data ?? "";
    const db = b.data ?? (b.auction as any)?.data ?? "";
    return db.localeCompare(da);
  }).map((t: any) => {
    const parcelas: any[] = t.installments ?? [];
    const nParcelas = t.n_parcelas ?? (parcelas.length > 0 ? parcelas.length : 1);
    const valorParcela = parcelas[0]?.valor ?? (t.valor_total != null ? t.valor_total / nParcelas : null);
    const auc = t.auction as any;
    const dataRef = t.data ?? auc?.data ?? null;

    let grupo = "OUTRO";
    if (t.tipo === "COMPRA") {
      if (isAnimal(t))         grupo = "COMPRA_ANIMAL";
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
      observacoes:   t.observacoes ?? "",
    };
  });

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-brand-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Relatório Financeiro</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {txsAll.length} transações · selecione grupos e gere o PDF.
            </p>
          </div>
        </div>

        <ExportarPDF
          titulo="Relatório Financeiro"
          subtitulo="SE Agropecuária Nelore de Elite"
          orientacao="landscape"
          nomeArquivo="SE_Relatorio_Financeiro.pdf"
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
          dados={dadosPDF}
        />
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
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

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-gray-500 uppercase tracking-wide">Entrada / Mês</p>
          </div>
          <p className="text-2xl font-bold text-green-600 truncate">{formatCurrency(parcelaMensalVendas)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {vendasAll.length} vendas
            <span className="mx-1.5 text-gray-200">·</span>
            <span className="text-gray-300">total {formatCurrency(totalVendas)}</span>
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Saldo / Mês</p>
          <p className={`text-2xl font-bold truncate ${saldoMensal >= 0 ? "text-green-600" : "text-red-600"}`}>
            {saldoMensal >= 0 ? "+" : ""}{formatCurrency(saldoMensal)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            entrada − saída
            <span className="mx-1.5 text-gray-200">·</span>
            <span className={`${saldo >= 0 ? "text-gray-300" : "text-red-300"}`}>
              total {saldo >= 0 ? "+" : ""}{formatCurrency(saldo)}
            </span>
          </p>
        </div>
      </div>

      {/* ── Detalhamento por categoria ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

        {/* Compras */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Compras por Categoria</h3>
          </div>
          <table className="w-full text-xs">
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
              ].filter(({ list }) => list.length > 0).map(({ label, list, cls }) => (
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

        {/* Vendas */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Vendas por Categoria</h3>
          </div>
          <table className="w-full text-xs">
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
              ].filter(({ list }) => list.length > 0).map(({ label, list, cls, naoRecorrente }) => (
                <tr key={label} className={`hover:bg-gray-50 ${naoRecorrente ? "bg-amber-50/40" : ""}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>{label}</span>
                      {naoRecorrente && <span className="text-[9px] text-amber-600 font-medium italic">pontual</span>}
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
                <td className="px-4 py-2.5 font-bold text-gray-700 text-[11px]">Total Vendas</td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-600">{vendasAll.length}</td>
                <td className="px-4 py-2.5 text-right font-bold text-green-600">{formatCurrency(parcelaMensalVendas)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(totalVendas)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Nota de grupos ── */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Grupos disponíveis no PDF</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Compra — Animal",    cls: "bg-indigo-100 text-indigo-700" },
            { label: "Compra — Prenhez",   cls: "bg-orange-100 text-orange-700" },
            { label: "Compra — Aspiração", cls: "bg-pink-100 text-pink-700" },
            { label: "Venda — Animal",     cls: "bg-indigo-100 text-indigo-700" },
            { label: "Venda — Prenhez",    cls: "bg-orange-100 text-orange-700" },
            { label: "Venda — Aspiração",  cls: "bg-pink-100 text-pink-700" },
            { label: "Venda — Rebanho",    cls: "bg-green-100 text-green-700" },
            { label: "Outros",             cls: "bg-gray-100 text-gray-600" },
          ].map(({ label, cls }) => (
            <span key={label} className={`text-[10px] font-semibold px-2 py-1 rounded-md ${cls}`}>{label}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Total de {txsAll.length} transações ·{" "}
          Clique em <strong className="text-gray-600">Exportar PDF</strong> para selecionar grupos e gerar o relatório.
        </p>
      </div>
    </div>
  );
}
