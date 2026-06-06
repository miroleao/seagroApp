import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import { Gavel, Star, TrendingUp, Target, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export const revalidate = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function mesesEntre(nasc: string, ref: Date): number {
  const d = new Date(nasc + "T12:00:00");
  return (ref.getFullYear() - d.getFullYear()) * 12 + (ref.getMonth() - d.getMonth());
}

function grupoAbcz(nasc: string | null, tipo: string): string | null {
  if (!nasc) return null;
  const hoje = new Date();
  const meses = mesesEntre(nasc, hoje);
  const sexo: "M" | "F" = tipo === "TOURO" ? "M" : "F";
  return GRUPOS_ABCZ.find(g => g.sexo === sexo && meses >= g.min && meses < g.max)?.nome ?? null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LeioesPage() {
  const supabase = await createClient();

  // 1. Todos os animais Para Leilão
  const { data: animaisRaw } = await supabase
    .from("animals")
    .select("id, nome, rgn, rgd, nascimento, sexo, tipo, localizacao, peso_atual")
    .eq("farm_id", FARM_ID)
    .eq("para_leilao", true)
    .in("tipo", ["DOADORA", "TOURO"])
    .order("nome");

  const animais = animaisRaw ?? [];
  const animalIds = animais.map((a: any) => a.id as string);

  // 2. Infos de leilão salvas
  const leilaoInfoMap: Record<string, any> = {};
  if (animalIds.length > 0) {
    const { data } = await supabase
      .from("animal_leilao_info")
      .select("*")
      .eq("farm_id", FARM_ID)
      .in("animal_id", animalIds);
    for (const l of data ?? []) leilaoInfoMap[l.animal_id] = l;
  }

  // 3. junction → IDs de transação por animal
  const txIdsByAnimal: Record<string, string[]> = {};
  if (animalIds.length > 0) {
    const { data: taRows } = await supabase
      .from("transaction_animals")
      .select("animal_id, transaction_id")
      .in("animal_id", animalIds);
    for (const r of taRows ?? []) {
      if (!txIdsByAnimal[r.animal_id]) txIdsByAnimal[r.animal_id] = [];
      txIdsByAnimal[r.animal_id].push(r.transaction_id);
    }
  }

  // 4. Transações de COMPRA via junction
  const allTxIds = [...new Set(Object.values(txIdsByAnimal).flat())];
  const compraTxMapById: Record<string, any> = {};
  if (allTxIds.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select("id, tipo, valor_total, n_parcelas, data, auction:auctions(nome, data)")
      .eq("farm_id", FARM_ID)
      .eq("tipo", "COMPRA")
      .in("id", allTxIds);
    for (const t of data ?? []) compraTxMapById[t.id] = t;
  }

  // 5. Transações de COMPRA via doadora_id (fallback)
  const compraTxPorDoadora: Record<string, any> = {};
  if (animalIds.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select("id, doadora_id, tipo, valor_total, n_parcelas, data, auction:auctions(nome, data)")
      .eq("farm_id", FARM_ID)
      .eq("tipo", "COMPRA")
      .in("doadora_id", animalIds);
    for (const t of data ?? []) compraTxPorDoadora[t.doadora_id] = t;
  }

  // 6. Montar dados por animal
  const hoje = new Date();

  const dados = animais.map((a: any) => {
    const info = leilaoInfoMap[a.id] ?? null;

    // Resolve transação de compra
    const txIds = txIdsByAnimal[a.id] ?? [];
    const txCompra =
      txIds.map((id: string) => compraTxMapById[id]).find((t: any) => t) ??
      compraTxPorDoadora[a.id] ?? null;

    const compraLeilaoNome   = info?.compra_leilao_nome   ?? txCompra?.auction?.nome ?? null;
    const compraLeilaoData   = info?.compra_leilao_data   ?? txCompra?.auction?.data ?? txCompra?.data ?? null;
    const compraValorParcela = info?.compra_valor_parcela ??
      (txCompra?.valor_total && txCompra?.n_parcelas
        ? parseFloat((txCompra.valor_total / txCompra.n_parcelas).toFixed(2))
        : null);

    const meses = a.nascimento ? mesesEntre(a.nascimento, hoje) : null;
    const grupo = grupoAbcz(a.nascimento, a.tipo);
    const href  = a.tipo === "TOURO" ? `/machos/${a.id}` : `/doadoras/${a.id}`;

    return {
      ...a,
      meses,
      grupo,
      href,
      convite_nome:        info?.convite_nome       ?? null,
      convite_data:        info?.convite_data       ?? null,
      convite_promotores:  info?.convite_promotores ?? null,
      compra_leilao_nome:  compraLeilaoNome,
      compra_leilao_data:  compraLeilaoData,
      compra_valor_parcela: compraValorParcela,
      compra_total:        compraValorParcela != null ? compraValorParcela * 30 : null,
      meta_valor_parcela:  info?.meta_valor_parcela ?? null,
      meta_total:          info?.meta_valor_parcela != null ? info.meta_valor_parcela * 30 : null,
      lucro_parcela: (info?.meta_valor_parcela != null && compraValorParcela != null)
        ? info.meta_valor_parcela - compraValorParcela
        : null,
    };
  });

  // 7. Agrupar por convite
  type Grupo = { convite_nome: string | null; convite_data: string | null; convite_promotores: string | null; animais: typeof dados };
  const gruposMap: Record<string, Grupo> = {};
  for (const d of dados) {
    const key = d.convite_nome ?? "__sem_convite__";
    if (!gruposMap[key]) {
      gruposMap[key] = {
        convite_nome: d.convite_nome,
        convite_data: d.convite_data,
        convite_promotores: d.convite_promotores,
        animais: [],
      };
    }
    gruposMap[key].animais.push(d);
  }
  // Ordenar: com convite primeiro (por data), sem convite por último
  const grupos: Grupo[] = Object.values(gruposMap).sort((a, b) => {
    if (!a.convite_nome && b.convite_nome) return 1;
    if (a.convite_nome && !b.convite_nome) return -1;
    return (a.convite_data ?? "").localeCompare(b.convite_data ?? "");
  });

  // 8. Totais gerais
  const totalAnimais        = dados.length;
  const totalParcCompra     = dados.reduce((s, d) => s + (d.compra_valor_parcela ?? 0), 0);
  const totalParcMeta       = dados.reduce((s, d) => s + (d.meta_valor_parcela ?? 0), 0);
  const totalLucroMensal    = totalParcMeta - totalParcCompra;
  const totalCompra         = dados.reduce((s, d) => s + (d.compra_total ?? 0), 0);
  const totalMeta           = dados.reduce((s, d) => s + (d.meta_total ?? 0), 0);

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Animais Para Leilão</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {totalAnimais} animal{totalAnimais !== 1 ? "is" : ""} selecionado{totalAnimais !== 1 ? "s" : ""} ·{" "}
          {grupos.filter(g => g.convite_nome).length} leilão{grupos.filter(g => g.convite_nome).length !== 1 ? "ões" : ""} agendado{grupos.filter(g => g.convite_nome).length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Cards de resumo ─────────────────────────────────────────────── */}
      {totalAnimais > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Animais</p>
            <p className="text-2xl font-bold text-amber-600">{totalAnimais}</p>
            <p className="text-xs text-gray-400 mt-0.5">para leilão</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Custo / Mês</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalParcCompra)}</p>
            <p className="text-xs text-gray-400 mt-0.5">total compra {formatCurrency(totalCompra)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Meta / Mês</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalParcMeta)}</p>
            <p className="text-xs text-gray-400 mt-0.5">total meta {formatCurrency(totalMeta)}</p>
          </div>
          <div className={`card p-4 border-l-4 ${totalLucroMensal >= 0 ? "border-l-green-500" : "border-l-red-400"}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resultado / Mês</p>
            <p className={`text-2xl font-bold ${totalLucroMensal >= 0 ? "text-green-700" : "text-red-600"}`}>
              {totalLucroMensal >= 0 ? "+" : ""}{formatCurrency(totalLucroMensal)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">meta − custo por parcela</p>
          </div>
        </div>
      )}

      {/* ── Sem animais ─────────────────────────────────────────────────── */}
      {totalAnimais === 0 && (
        <div className="card p-12 text-center">
          <Gavel className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">Nenhum animal marcado para leilão.</p>
          <p className="text-xs text-gray-300 mt-1">
            Acesse a ficha de cada doadora ou macho e clique em "Preparar para Leilão".
          </p>
        </div>
      )}

      {/* ── Grupos por convite ──────────────────────────────────────────── */}
      {grupos.map((grupo, gi) => {
        const isComConvite = !!grupo.convite_nome;
        const parcCompraGrupo = grupo.animais.reduce((s, d) => s + (d.compra_valor_parcela ?? 0), 0);
        const parcMetaGrupo   = grupo.animais.reduce((s, d) => s + (d.meta_valor_parcela ?? 0), 0);
        const lucroGrupo      = parcMetaGrupo - parcCompraGrupo;

        return (
          <section key={gi} className={`card overflow-hidden ${isComConvite ? "border-amber-200" : "border-gray-100"}`}>

            {/* Cabeçalho do grupo */}
            <div className={`px-5 py-4 border-b flex flex-wrap items-start gap-3 ${isComConvite ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Gavel className={`w-4 h-4 shrink-0 ${isComConvite ? "text-amber-600" : "text-gray-400"}`} />
                <div className="min-w-0">
                  <h2 className={`font-semibold ${isComConvite ? "text-amber-900" : "text-gray-500"}`}>
                    {grupo.convite_nome ?? "Sem convite definido"}
                  </h2>
                  {isComConvite && (
                    <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-amber-700">
                      {grupo.convite_data && <span>📅 {formatDate(grupo.convite_data)}</span>}
                      {grupo.convite_promotores && <span>🤝 {grupo.convite_promotores}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4 text-xs shrink-0">
                <span className={`badge ${isComConvite ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                  {grupo.animais.length} animal{grupo.animais.length !== 1 ? "is" : ""}
                </span>
                {parcCompraGrupo > 0 && (
                  <span className="text-red-600 font-semibold">{formatCurrency(parcCompraGrupo)}<span className="font-normal text-gray-400">/mês custo</span></span>
                )}
                {parcMetaGrupo > 0 && (
                  <span className="text-green-700 font-semibold">{formatCurrency(parcMetaGrupo)}<span className="font-normal text-gray-400">/mês meta</span></span>
                )}
                {parcCompraGrupo > 0 && parcMetaGrupo > 0 && (
                  <span className={`font-bold ${lucroGrupo >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {lucroGrupo >= 0 ? "+" : ""}{formatCurrency(lucroGrupo)}<span className="font-normal text-gray-400">/mês</span>
                  </span>
                )}
              </div>
            </div>

            {/* Tabela desktop */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase">Animal</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase">Idade / Grupo</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase">Leilão onde Comprou</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase text-right">Parcela Compra</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase text-right">Total Compra</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase text-right">Parcela Meta</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase text-right">Total Meta</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {grupo.animais.map((d: any) => {
                    const isMacho = d.tipo === "TOURO";
                    const reg = isMacho ? (d.rgd ?? d.rgn) : d.rgn;
                    const lucroPos = d.lucro_parcela != null && d.lucro_parcela > 0;
                    const lucroNeg = d.lucro_parcela != null && d.lucro_parcela < 0;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                        {/* Animal */}
                        <td className="px-4 py-3">
                          <Link href={d.href} className="font-semibold text-gray-900 hover:text-brand-600 hover:underline transition-colors block">
                            {d.nome}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-semibold ${isMacho ? "text-blue-500" : "text-pink-500"}`}>
                              {isMacho ? "♂ Macho" : "♀ Fêmea"}
                            </span>
                            {reg && <span className="text-[9px] text-gray-400 font-mono">{reg}</span>}
                          </div>
                        </td>

                        {/* Idade / Grupo */}
                        <td className="px-4 py-3">
                          {d.meses != null && <p className="font-semibold text-gray-800">{d.meses}m</p>}
                          {d.grupo
                            ? <span className={`badge text-[9px] font-semibold mt-0.5 ${isMacho ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>{d.grupo}</span>
                            : <span className="text-gray-300 text-[9px]">Fora de faixa</span>}
                        </td>

                        {/* Leilão onde comprou */}
                        <td className="px-4 py-3">
                          {d.compra_leilao_nome
                            ? <>
                                <p className="text-gray-800 font-medium">{d.compra_leilao_nome}</p>
                                {d.compra_leilao_data && <p className="text-gray-400">{formatDate(d.compra_leilao_data)}</p>}
                              </>
                            : <span className="text-gray-300 italic">Não informado</span>}
                        </td>

                        {/* Parcela compra */}
                        <td className="px-4 py-3 text-right">
                          {d.compra_valor_parcela != null
                            ? <span className="font-semibold text-red-600">{formatCurrency(d.compra_valor_parcela)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>

                        {/* Total compra */}
                        <td className="px-4 py-3 text-right">
                          {d.compra_total != null
                            ? <span className="font-bold text-red-700">{formatCurrency(d.compra_total)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>

                        {/* Parcela meta */}
                        <td className="px-4 py-3 text-right">
                          {d.meta_valor_parcela != null
                            ? <span className="font-semibold text-green-600">{formatCurrency(d.meta_valor_parcela)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>

                        {/* Total meta */}
                        <td className="px-4 py-3 text-right">
                          {d.meta_total != null
                            ? <span className="font-bold text-green-700">{formatCurrency(d.meta_total)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>

                        {/* Resultado esperado */}
                        <td className="px-4 py-3 text-right">
                          {d.lucro_parcela != null
                            ? <div className={`flex items-center justify-end gap-1 font-bold ${lucroPos ? "text-green-600" : lucroNeg ? "text-red-500" : "text-gray-500"}`}>
                                {lucroPos ? <ArrowUpRight className="w-3.5 h-3.5" />
                                  : lucroNeg ? <ArrowDownRight className="w-3.5 h-3.5" />
                                  : <Minus className="w-3.5 h-3.5" />}
                                {lucroPos ? "+" : ""}{formatCurrency(d.lucro_parcela)}<span className="text-[9px] font-normal text-gray-400">/mês</span>
                              </div>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Subtotal do grupo */}
                  {grupo.animais.length > 1 && (
                    <tr className="bg-amber-50/60 font-semibold">
                      <td className="px-4 py-2 text-[10px] text-gray-600 font-bold" colSpan={3}>
                        Subtotal — {grupo.animais.length} animais
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">{formatCurrency(parcCompraGrupo)}</td>
                      <td className="px-4 py-2 text-right text-red-700">{formatCurrency(grupo.animais.reduce((s, d) => s + (d.compra_total ?? 0), 0))}</td>
                      <td className="px-4 py-2 text-right text-green-600">{formatCurrency(parcMetaGrupo)}</td>
                      <td className="px-4 py-2 text-right text-green-700">{formatCurrency(grupo.animais.reduce((s, d) => s + (d.meta_total ?? 0), 0))}</td>
                      <td className={`px-4 py-2 text-right font-bold ${lucroGrupo >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {lucroGrupo >= 0 ? "+" : ""}{formatCurrency(lucroGrupo)}/mês
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cards mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {grupo.animais.map((d: any) => {
                const isMacho = d.tipo === "TOURO";
                return (
                  <div key={d.id} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={d.href} className="font-semibold text-gray-900 hover:text-brand-600 hover:underline text-sm">
                          {d.nome}
                        </Link>
                        <p className={`text-[10px] font-medium ${isMacho ? "text-blue-500" : "text-pink-500"}`}>
                          {isMacho ? "♂ Macho" : "♀ Fêmea"} {d.meses != null ? `· ${d.meses}m` : ""}
                          {d.grupo ? ` · ${d.grupo}` : ""}
                        </p>
                      </div>
                      {d.lucro_parcela != null && (
                        <span className={`text-sm font-bold ${d.lucro_parcela >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {d.lucro_parcela >= 0 ? "+" : ""}{formatCurrency(d.lucro_parcela)}/mês
                        </span>
                      )}
                    </div>

                    {d.compra_leilao_nome && (
                      <div className="bg-red-50 rounded-lg px-3 py-2 text-xs">
                        <p className="text-red-400 font-semibold uppercase text-[9px] mb-0.5">Comprado em</p>
                        <p className="text-gray-800 font-medium">{d.compra_leilao_nome}</p>
                        <div className="flex justify-between mt-0.5">
                          {d.compra_leilao_data && <span className="text-gray-400">{formatDate(d.compra_leilao_data)}</span>}
                          {d.compra_valor_parcela != null && (
                            <span className="font-semibold text-red-600">{formatCurrency(d.compra_valor_parcela)}/mês · total {formatCurrency(d.compra_total!)}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {d.meta_valor_parcela != null && (
                      <div className="bg-green-50 rounded-lg px-3 py-2 text-xs">
                        <p className="text-green-500 font-semibold uppercase text-[9px] mb-0.5">Meta</p>
                        <div className="flex justify-between">
                          <span className="font-semibold text-green-600">{formatCurrency(d.meta_valor_parcela)}/mês</span>
                          <span className="text-gray-500">total {formatCurrency(d.meta_total!)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
