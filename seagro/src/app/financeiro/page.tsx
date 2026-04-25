import { createClient } from "@/lib/supabase/server";
import { formatCurrency, FARM_ID } from "@/lib/utils";
import { TrendingUp, TrendingDown, ChevronDown, Plus, Link2 } from "lucide-react";
import { vincularDoadora } from "./actions";
import NovaTransacaoForm from "./NovaTransacaoForm";
import BotaoExcluirTransacao from "./BotaoExcluirTransacao";
import BotaoEditarTransacao from "./BotaoEditarTransacao";
import { Suspense } from "react";
import BuscaFinanceiro from "./BuscaFinanceiro";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Remove prefixo "Prenhez " / "Aspiração " do nome do animal */
function nomeLimpo(animalNome: string | null): string {
  if (!animalNome) return "—";
  return animalNome
    .replace(/^prenhez\s+/i, "")
    .replace(/^aspira[çc][aã]o\s+/i, "")
    .trim() || "—";
}

/** Determina label de tipo detalhado a partir do campo tipo + prefixo no nome */
function tipoLabel(tipo: string, animalNome: string | null): string {
  const nome = (animalNome ?? "").toLowerCase();
  const isCompra = tipo === "COMPRA";
  const base = isCompra ? "Compra de" : "Venda de";
  if (nome.startsWith("prenhez ")) return `${base} Prenhez`;
  if (nome.startsWith("aspiração ") || nome.startsWith("aspiracao ")) return `${base} Aspiração`;
  return `${base} Animal`;
}

/** "2026-03" → "Março / 2026" */
function labelMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  const nomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const idx = parseInt(mes) - 1;
  return `${nomes[idx] ?? mes} / ${ano}`;
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query  = (q ?? "").toLowerCase().trim();
  const supabase = await createClient();

  const { data: doadoras } = await supabase
    .from("animals")
    .select("id, nome, rgn")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA")
    .order("nome");

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(`
      id, tipo, animal_nome, doadora_id, contraparte, valor_total, n_parcelas, observacoes, data,
      auction:auctions ( id, nome, data, local ),
      installments ( numero, vencimento, valor, status )
    `)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });

  const txsAll = transactions ?? [];

  // Filtra por query (leilão, animal, contraparte, mês)
  const txs = query
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

  const totalCompras = txs.filter(t => t.tipo === "COMPRA").reduce((s, t) => s + (t.valor_total ?? 0), 0);
  const totalVendas  = txs.filter(t => t.tipo === "VENDA").reduce((s, t) => s + (t.valor_total ?? 0), 0);
  const saldo        = totalVendas - totalCompras;

  // ── Agrupar por leilão ────────────────────────────────────────────────────
  type LeilaoGrp = { auction: any; compras: any[]; vendas: any[]; dataRef: string };
  const leiloesMapa: Record<string, LeilaoGrp> = {};

  for (const t of txs) {
    const auc = t.auction as any;
    const key = auc?.id ?? `no-auction-${t.data ?? "x"}`;
    if (!leiloesMapa[key]) {
      leiloesMapa[key] = {
        auction: auc,
        compras: [],
        vendas: [],
        dataRef: auc?.data ?? t.data ?? "0000-00-00",
      };
    }
    if (t.tipo === "COMPRA") leiloesMapa[key].compras.push(t);
    else leiloesMapa[key].vendas.push(t);
  }

  // ── Agrupar leilões por Mês/Ano ───────────────────────────────────────────
  type MesGrp = {
    chave: string;       // "2026-03"
    label: string;       // "Março / 2026"
    leiloes: LeilaoGrp[];
    totalC: number;
    totalV: number;
  };
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

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {txs.length} transações · {txs.filter(t => t.tipo === "COMPRA").length} compras · {txs.filter(t => t.tipo === "VENDA").length} vendas
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          Erro: {error.message}
        </div>
      )}

      {/* ── Cards resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Investido</p>
          </div>
          <p className="text-3xl font-bold text-red-600">{formatCurrency(totalCompras)}</p>
          <p className="text-xs text-gray-400 mt-1">{txs.filter(t => t.tipo === "COMPRA").length} compras</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Recebido</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(totalVendas)}</p>
          <p className="text-xs text-gray-400 mt-1">{txs.filter(t => t.tipo === "VENDA").length} vendas</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Saldo</p>
          <p className={`text-3xl font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(saldo)}
          </p>
          <p className="text-xs text-gray-400 mt-1">recebido − investido</p>
        </div>
      </div>

      {/* ── Nova Transação ─────────────────────────────────────────── */}
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

      {/* ── Histórico por Mês / Ano ──────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">Histórico</h2>
          {query ? (
            <>
              <span className="badge bg-brand-100 text-brand-700">{txs.length} resultado{txs.length !== 1 ? "s" : ""} para "{q}"</span>
              <span className="text-xs text-gray-400">de {txsAll.length} transações</span>
            </>
          ) : (
            <span className="badge bg-gray-100 text-gray-600">{meses.length} meses</span>
          )}
          <div className="ml-auto">
            <Suspense fallback={null}>
              <BuscaFinanceiro />
            </Suspense>
          </div>
        </div>

        {meses.length === 0 && (
          <div className="card p-10 text-center text-gray-400 text-sm">
            {query ? `Nenhum resultado para "${q}".` : "Nenhuma transação registrada ainda."}
          </div>
        )}

        {meses.map((mes) => (
          <details key={mes.chave} className="card overflow-hidden group" open={meses.indexOf(mes) === 0}>
            {/* ── Header do mês ─────────────────────────────────── */}
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

            {/* ── Leilões do mês (cada um expansível) ──────────── */}
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
                    {/* Header do leilão */}
                    <summary className="px-5 py-3 cursor-pointer select-none list-none hover:bg-gray-100 transition-colors">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">
                          {auc?.nome ?? "Transações avulsas"}
                        </span>
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

                    {/* Tabela de transações */}
                    <div className="bg-white overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-y border-gray-100 text-left">
                            <th className="px-4 py-2 font-medium text-gray-500">Animal</th>
                            <th className="px-4 py-2 font-medium text-gray-500">Tipo</th>
                            <th className="px-4 py-2 font-medium text-gray-500">Comprador / Vendedor</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-right">Valor Parcela</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-right">Parcelas</th>
                            <th className="px-4 py-2 font-medium text-gray-500 text-right">Valor Total</th>
                            <th className="px-4 py-2 font-medium text-gray-500"></th>
                            <th className="px-4 py-2 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {allTxs.map((t: any) => {
                            const parcelas: any[] = t.installments ?? [];
                            const nParcelas = t.n_parcelas ?? parcelas.length ?? 30;
                            const valorParcela = parcelas[0]?.valor
                              ?? (t.valor_total != null ? t.valor_total / nParcelas : null);
                            const label = tipoLabel(t._tipo ?? t.tipo, t.animal_nome);
                            const isCompra = (t._tipo ?? t.tipo) === "COMPRA";
                            const vinculada = doadoras?.find((d: any) => d.id === t.doadora_id);

                            return (
                              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-2.5 font-medium text-gray-900">
                                    {nomeLimpo(t.animal_nome)}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`badge ${isCompra ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                                      {label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-500">
                                    {t.contraparte
                                      ? <span><span className="text-gray-400 mr-1">{isCompra ? "Vend.:" : "Comp.:"}</span>{t.contraparte}</span>
                                      : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                    {valorParcela != null ? formatCurrency(valorParcela) : "—"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-600 font-medium">
                                    {nParcelas}×
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-900">
                                    {valorParcela != null ? formatCurrency(valorParcela * nParcelas) : (t.valor_total != null ? formatCurrency(t.valor_total) : "—")}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    {vinculada ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                        <Link2 className="w-3 h-3" /> {vinculada.nome.split(" ")[0]}
                                      </span>
                                    ) : (
                                      <details className="relative">
                                        <summary className="cursor-pointer list-none inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-400 px-2 py-0.5 rounded-full transition-colors">
                                          <Link2 className="w-3 h-3" /> vincular
                                        </summary>
                                        <div className="absolute right-0 z-10 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[260px]">
                                          <p className="text-xs text-gray-500 mb-2">Vincular ao ROI de qual doadora?</p>
                                          <form action={vincularDoadora} className="flex gap-2">
                                            <input type="hidden" name="tx_id" value={t.id} />
                                            <select name="doadora_id" required
                                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white">
                                              <option value="">— selecione —</option>
                                              {(doadoras ?? []).map((d: any) => (
                                                <option key={d.id} value={d.id}>{d.nome}{d.rgn ? ` (${d.rgn})` : ""}</option>
                                              ))}
                                            </select>
                                            <button type="submit"
                                              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                                              OK
                                            </button>
                                          </form>
                                        </div>
                                      </details>
                                    )}
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <div className="inline-flex items-center gap-1">
                                      <BotaoEditarTransacao
                                        txId={t.id}
                                        animalNome={nomeLimpo(t.animal_nome)}
                                        contraparte={t.contraparte ?? ""}
                                        valorTotal={t.valor_total ?? 0}
                                        nParcelas={nParcelas}
                                        data={t.data ?? ""}
                                        observacoes={t.observacoes ?? ""}
                                      />
                                      <BotaoExcluirTransacao
                                        txId={t.id}
                                        label={`${tipoLabel(t._tipo ?? t.tipo, t.animal_nome)} — ${nomeLimpo(t.animal_nome)}`}
                                      />
                                    </div>
                                  </td>
                                </tr>
                            );
                          })}
                        </tbody>
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
