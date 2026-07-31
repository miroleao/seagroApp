import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, FARM_ID } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, ExternalLink } from "lucide-react";

/**
 * Lançamentos financeiros vinculados a um animal.
 *
 * Busca em três frentes, deduplicando por id:
 *   1. `transaction_animals` (junção — vínculo moderno)
 *   2. `transactions.doadora_id` / `transactions.animal_id` (colunas legadas)
 *   3. `transactions.animal_nome` (histórico sem vínculo)
 *
 * Usada nas fichas de touro e de rebanho. A ficha de doadora tem seu próprio
 * bloco de ROI, mais completo.
 */

const CAT_LABEL: Record<string, string> = {
  ANIMAL: "Animal", DOADORA: "Doadora", RECEPTORA: "Receptora", TOURO: "Touro",
  EMBRIAO: "Embrião", ASPIRACAO: "Aspiração", PRENHEZ: "Prenhez", SEMEN: "Sêmen",
  LEILAO: "Leilão", OUTRO: "Outro",
};

const SELECT_TX = `
  id, tipo, categoria, animal_nome, contraparte, valor_total, n_parcelas,
  parcelas_pagas_manual, data, observacoes,
  auction:auctions ( nome, data ),
  installments ( numero, valor, status )
`;

/** Mesma precedência de `calcParcelaStats` na página do financeiro. */
function parcelasPagas(t: any, hoje: Date): { pagas: number; nTotal: number; estimado: boolean } {
  const nTotal = Math.max(t.n_parcelas ?? 1, 1);

  const manual = t.parcelas_pagas_manual;
  if (manual !== null && manual !== undefined && Number.isFinite(Number(manual))) {
    return { pagas: Math.min(Math.max(Number(manual), 0), nTotal), nTotal, estimado: false };
  }

  const pagasInst = ((t.installments ?? []) as any[]).filter(p => p?.status === "PAGO").length;
  if (pagasInst > 0) return { pagas: Math.min(pagasInst, nTotal), nTotal, estimado: false };

  const dataStr: string | null = t.data ?? t.auction?.data ?? null;
  if (!dataStr) return { pagas: 0, nTotal, estimado: true };

  const dias = (hoje.getTime() - new Date(dataStr + "T12:00:00").getTime()) / 86_400_000;
  return { pagas: Math.min(Math.max(Math.floor(dias / 30), 0), nTotal), nTotal, estimado: true };
}

function valorParcelaDe(t: any): number {
  const inst = [...((t.installments ?? []) as any[])].sort((a, b) => a.numero - b.numero);
  const n = Math.max(t.n_parcelas ?? (inst.length || 1), 1);
  return inst[0]?.valor ?? (t.valor_total != null ? t.valor_total / n : 0);
}

export async function FinanceiroAnimalSection({
  animalId,
  animalNome,
}: {
  animalId: string;
  animalNome?: string | null;
}) {
  const supabase = await createClient();

  // 1. IDs via junção
  const { data: taRows } = await supabase
    .from("transaction_animals")
    .select("transaction_id")
    .eq("animal_id", animalId);
  const junctionIds = (taRows ?? []).map((r: any) => r.transaction_id as string);

  const { data: viaJunction } = junctionIds.length > 0
    ? await supabase.from("transactions").select(SELECT_TX).eq("farm_id", FARM_ID).in("id", junctionIds)
    : { data: [] as any[] };

  // 2. Colunas legadas
  const { data: viaDoadoraId } = await supabase
    .from("transactions").select(SELECT_TX).eq("farm_id", FARM_ID).eq("doadora_id", animalId);

  const { data: viaAnimalId } = await supabase
    .from("transactions").select(SELECT_TX).eq("farm_id", FARM_ID).eq("animal_id", animalId);

  // 3. Histórico por nome — apenas transações sem vínculo nenhum.
  //    O ILIKE é só um pré-filtro do banco; o match definitivo é exato,
  //    feito abaixo em JS. Sem isso, uma doadora "Diva" puxaria as
  //    transações de "Diva FIV do Kalunga" e o ROI da ficha ficaria errado.
  const nome = (animalNome ?? "").trim();
  const { data: viaNomeBruto } = nome.length >= 3
    ? await supabase
        .from("transactions").select(SELECT_TX).eq("farm_id", FARM_ID)
        .is("doadora_id", null).ilike("animal_nome", `%${nome}%`)
    : { data: [] as any[] };

  const normaliza = (s: string) =>
    s.toLowerCase()
     .replace(/^(prenhez|aspiração|aspiracao)\s+/i, "")
     .replace(/\s*\([^)]*\)\s*$/, "")
     .trim();

  const alvo = normaliza(nome);
  const viaNome = (viaNomeBruto ?? []).filter(
    (t: any) => normaliza(String(t.animal_nome ?? "")) === alvo
  );

  // Deduplica
  const vistos = new Set<string>();
  const txs: any[] = [];
  for (const t of [
    ...(viaJunction ?? []), ...(viaDoadoraId ?? []),
    ...(viaAnimalId ?? []), ...(viaNome ?? []),
  ]) {
    if (t?.id && !vistos.has(t.id)) { vistos.add(t.id); txs.push(t); }
  }

  if (txs.length === 0) {
    return (
      <section className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-400 shrink-0" />
          <h2 className="font-semibold text-gray-900">Financeiro</h2>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-400">Nenhum lançamento vinculado a este animal.</p>
          <Link href="/financeiro" className="text-xs text-brand-600 hover:underline mt-1 inline-block">
            Registrar no Financeiro →
          </Link>
        </div>
      </section>
    );
  }

  txs.sort((a, b) => (b.data ?? b.auction?.data ?? "").localeCompare(a.data ?? a.auction?.data ?? ""));

  const hoje = new Date();
  const compras = txs.filter(t => t.tipo === "COMPRA");
  const vendas  = txs.filter(t => t.tipo === "VENDA");

  const totalCompras = compras.reduce((s, t) => s + (t.valor_total ?? 0), 0);
  const totalVendas  = vendas.reduce((s, t)  => s + (t.valor_total ?? 0), 0);

  const saldoAberto = txs.reduce((s, t) => {
    const { pagas, nTotal } = parcelasPagas(t, hoje);
    const pendente = (nTotal - pagas) * valorParcelaDe(t);
    return s + (t.tipo === "COMPRA" ? pendente : -pendente);
  }, 0);

  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-brand-600 shrink-0" />
        <h2 className="font-semibold text-gray-900">Financeiro</h2>
        <span className="text-[10px] text-gray-400">
          {txs.length} lançamento{txs.length === 1 ? "" : "s"}
        </span>
        <Link
          href="/financeiro"
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600"
        >
          Abrir financeiro <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Resumo — empilha no mobile, valores em R$ não cabem em 3 colunas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 border-b border-gray-100">
        <div className="px-4 py-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400" /> Comprado
          </p>
          <p className="text-sm font-bold text-red-600 mt-0.5">
            {totalCompras > 0 ? formatCurrency(totalCompras) : "—"}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-green-500" /> Vendido
          </p>
          <p className="text-sm font-bold text-green-700 mt-0.5">
            {totalVendas > 0 ? formatCurrency(totalVendas) : "—"}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">
            {saldoAberto >= 0 ? "A pagar" : "A receber"}
          </p>
          <p className={`text-sm font-bold mt-0.5 ${saldoAberto >= 0 ? "text-red-600" : "text-green-700"}`}>
            {Math.abs(saldoAberto) > 0.005 ? formatCurrency(Math.abs(saldoAberto)) : "Quitado"}
          </p>
        </div>
      </div>

      {/* Lançamentos */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-[10px]">Data</th>
              <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-[10px]">Tipo</th>
              <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-[10px]">Leilão</th>
              <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-[10px]">Contraparte</th>
              <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-[10px] text-right">Parcela</th>
              <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-[10px] text-right">Pagas</th>
              <th className="px-4 py-2 font-semibold text-gray-500 uppercase text-[10px] text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {txs.map((t) => {
              const isCompra = t.tipo === "COMPRA";
              const { pagas, nTotal, estimado } = parcelasPagas(t, hoje);
              const dataRef = t.data ?? t.auction?.data ?? null;
              const quitado = pagas >= nTotal;
              return (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-600 font-mono whitespace-nowrap">
                    {dataRef ? new Date(dataRef + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      isCompra ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                    }`}>
                      {isCompra ? "Compra" : "Venda"}
                    </span>
                    {t.categoria && (
                      <span className="ml-1 text-[10px] text-gray-400">
                        {CAT_LABEL[t.categoria] ?? t.categoria}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {t.auction?.nome ?? <span className="text-gray-300 italic">Avulsa</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {t.contraparte ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-700">
                    {formatCurrency(valorParcelaDe(t))}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <span className={`font-semibold ${quitado ? "text-green-600" : "text-amber-600"} ${estimado ? "opacity-70" : ""}`}>
                      {pagas}/{nTotal}
                      {estimado && <span className="ml-0.5 text-[9px] font-normal text-gray-400">~</span>}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right whitespace-nowrap font-bold ${isCompra ? "text-red-700" : "text-green-800"}`}>
                    {t.valor_total != null ? formatCurrency(t.valor_total) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-50">
        <span className="font-mono">~</span> = parcelas estimadas por tempo decorrido. Informe o número
        real na coluna Parcelas do Financeiro.
      </p>
    </section>
  );
}
