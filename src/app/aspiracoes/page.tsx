import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import { FlaskConical, Baby, Plus, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { registrarOPU, alternarTipoSessao } from "./actions";
import { DoadoraCardWrapper } from "./DoadoraCardWrapper";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";

// ── Tipos ───────────────────────────────────────────────────────────────────
type AspItem = {
  id: string;
  doadora_id: string | null;
  doadora_nome_raw: string;
  doadora_db_id: string | null;   // UUID do animal
  touro: string;
  oocitos: number | null;
  embryos_congelados: number | null;
  custo_total: number | null;
  observacoes: string | null;
  sessao_id: string;
  sessao_data: string | null;
  sessao_tipo: string;
  sessao_local: string | null;
  sessao_responsavel: string | null;
};

type DoadoraCard = {
  doadoraId: string;           // key para agrupar (pode ser nome se não tem UUID)
  doadoraDbId: string | null;  // UUID real do animal
  doadoraNome: string;
  opuItems: AspItem[];
  totalOocitos: number;
  totalEmbrioes: number;
};

export const revalidate = 0;

export default async function AspiracoesPage() {
  const supabase = await createClient();

  const { data: sessoes, error } = await supabase
    .from("opu_sessions")
    .select(`
      id,
      data,
      tipo,
      laboratorio,
      responsavel,
      local,
      observacoes,
      aspirations (
        id,
        doadora_id,
        doadora_nome,
        touro_nome,
        observacoes,
        oocitos_viaveis,
        embryos_congelados,
        custo_total,
        doadora:animals!aspirations_doadora_id_fkey ( id, nome, rgn ),
        embryos:embryos!embryos_aspiration_id_fkey (
          id, sexagem, status, numero_cdc_fiv, numero_adt_te,
          transfers:transfers!transfers_embryo_id_fkey (
            id,
            receptora:animals!transfers_receptora_id_fkey ( nome, brinco ),
            pregnancy_diagnoses ( resultado, data_previsao_parto )
          )
        )
      )
    `)
    .eq("farm_id", FARM_ID)
    .in("tipo", ["REALIZADA", "ADQUIRIDA"])
    .order("data", { ascending: false });

  const { data: doadoras } = await supabase
    .from("animals")
    .select("id, nome, rgn")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA")
    .order("nome", { ascending: true });

  const all = sessoes ?? [];

  // ── Flatten: sessão × aspiração → AspItem ──────────────────────────────
  const aspItems: AspItem[] = [];
  for (const s of all) {
    for (const a of (s.aspirations as any[])) {
      const doadoraAnimal = a.doadora as any;
      aspItems.push({
        id:              a.id,
        doadora_id:      a.doadora_id,
        doadora_nome_raw: doadoraAnimal?.nome ?? a.doadora_nome ?? "—",
        doadora_db_id:   doadoraAnimal?.id ?? null,
        touro:           a.touro_nome ?? "—",
        oocitos:         a.oocitos_viaveis ?? null,
        embryos_congelados: a.embryos_congelados ?? null,
        custo_total:     a.custo_total ?? null,
        observacoes:     a.observacoes ?? null,
        sessao_id:       s.id,
        sessao_data:     s.data ?? null,
        sessao_tipo:     s.tipo,
        sessao_local:    s.local ?? null,
        sessao_responsavel: s.responsavel ?? null,
      });
    }
  }

  // ── Agrupar por doadora ─────────────────────────────────────────────────
  const mapaDoadora: Record<string, DoadoraCard> = {};
  for (const item of aspItems) {
    const chave = item.doadora_db_id ?? item.doadora_nome_raw;
    if (!mapaDoadora[chave]) {
      mapaDoadora[chave] = {
        doadoraId:    chave,
        doadoraDbId:  item.doadora_db_id,
        doadoraNome:  item.doadora_nome_raw,
        opuItems:     [],
        totalOocitos: 0,
        totalEmbrioes: 0,
      };
    }
    const card = mapaDoadora[chave];
    card.opuItems.push(item);
    card.totalOocitos  += item.oocitos ?? 0;
    card.totalEmbrioes += item.embryos_congelados ?? 0;
  }

  const doadoraCards = Object.values(mapaDoadora)
    .sort((a, b) => {
      // Ordenar pelo nome
      return a.doadoraNome.localeCompare(b.doadoraNome, "pt-BR");
    });

  // ── Stats globais ────────────────────────────────────────────────────────
  const sessoesOPU   = all; // já filtrado na query: apenas REALIZADA e ADQUIRIDA
  const totalOocitos  = aspItems.reduce((s, i) => s + (i.oocitos ?? 0), 0);
  const totalEmbrioes = aspItems.reduce((s, i) => s + (i.embryos_congelados ?? 0), 0);

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white";
  const labelCls = "text-xs text-gray-500 mb-1 block";

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aspirações</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {sessoesOPU.length} eventos OPU · {doadoraCards.length} doadoras
          </p>
        </div>
        <ExportarPDF
          titulo="Aspirações OPU-FIV"
          subtitulo={`${aspItems.length} aspirações · SE Agropecuária Nelore de Elite`}
          orientacao="landscape"
          nomeArquivo="SE_Aspiracoes.pdf"
          colunas={[
            { key: "doadora",     label: "Doadora",       padrao: true,  largura: 2.0 },
            { key: "touro",       label: "Touro",         padrao: true,  largura: 2.0 },
            { key: "data",        label: "Data",          padrao: true,  largura: 1.0 },
            { key: "tipo",        label: "Tipo",          padrao: true,  largura: 0.9 },
            { key: "local",       label: "Local",         padrao: false, largura: 1.5 },
            { key: "responsavel", label: "Responsável",   padrao: false, largura: 1.5 },
            { key: "oocitos",     label: "Oócitos",       padrao: true,  largura: 0.8 },
            { key: "embrioes",    label: "Embriões Cong.",padrao: true,  largura: 0.9 },
            { key: "custo",       label: "Custo",         padrao: false, largura: 1.0 },
            { key: "observacoes", label: "Observações",   padrao: false, largura: 2.0 },
          ] satisfies ColunaPDF[]}
          dados={aspItems.map((a) => ({
            doadora:     a.doadora_nome_raw,
            touro:       a.touro,
            data:        a.sessao_data ? formatDate(a.sessao_data) : "—",
            tipo:        a.sessao_tipo === "REALIZADA" ? "OPU" : "Adquirida",
            local:       a.sessao_local ?? "—",
            responsavel: a.sessao_responsavel ?? "—",
            oocitos:     a.oocitos != null ? String(a.oocitos) : "—",
            embrioes:    a.embryos_congelados != null ? String(a.embryos_congelados) : "—",
            custo:       a.custo_total != null ? `R$ ${a.custo_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—",
            observacoes: a.observacoes ?? "—",
          }))}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          Erro: {error.message}
        </div>
      )}

      {/* ── Formulário OPU (colapsável) ─────────────────────────── */}
      <details className="card overflow-hidden">
        <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
          <FlaskConical className="w-4 h-4 text-brand-600" />
          <span className="font-semibold text-gray-900 text-sm">Registrar OPU-FIV</span>
          <Plus className="w-4 h-4 text-brand-400 ml-auto" />
        </summary>
        <form action={registrarOPU} className="px-5 py-4 space-y-4 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data *</label>
              <input name="data" type="date" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Local</label>
              <input name="local" placeholder="Ex: Fazenda SE Agro" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Responsável</label>
              <input name="responsavel" placeholder="Ex: Dr. João" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Laboratório</label>
              <input name="laboratorio" placeholder="Ex: LabVitro" className={inputCls} />
            </div>
          </div>
          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Doadora × Acasalamento</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Doadora</label>
                <select name="doadora_id" className={inputCls}>
                  <option value="">— selecione —</option>
                  {(doadoras ?? []).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.nome}{d.rgn ? ` (${d.rgn})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Touro</label>
                <input name="touro_nome" placeholder="Nome do touro" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Oócitos Viáveis</label>
                <input name="oocitos_viaveis" type="number" min="0" placeholder="Ex: 12" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Embriões Congelados</label>
                <input name="embryos_congelados" type="number" min="0" placeholder="Ex: 8" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Custo Total (R$)</label>
                <input name="custo_total" type="number" step="0.01" min="0" placeholder="Ex: 2500.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Observações</label>
                <input name="observacoes" placeholder="Opcional" className={inputCls} />
              </div>
            </div>
          </div>
          <button type="submit"
            className="w-full bg-brand-600 text-white text-sm py-2.5 px-4 rounded-lg hover:bg-brand-700 transition-colors font-medium flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Salvar OPU
          </button>
        </form>
      </details>

      {/* ── Contadores globais ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-brand-600">{sessoesOPU.length}</p>
          <p className="text-sm text-gray-500 mt-1">Eventos OPU</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-blue-500">{totalOocitos.toLocaleString("pt-BR")}</p>
          <p className="text-sm text-gray-500 mt-1">Oócitos viáveis</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{totalEmbrioes.toLocaleString("pt-BR")}</p>
          <p className="text-sm text-gray-500 mt-1">Embriões produzidos</p>
        </div>
      </div>

      {/* ── Dashboard por Doadora ────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-700 border-b border-gray-200 pb-2">
          Por Doadora ({doadoraCards.length})
        </h2>

        {doadoraCards.length === 0 && (
          <div className="card p-8 text-center text-gray-400 text-sm">Nenhum evento registrado.</div>
        )}

        {doadoraCards.map((card) => {
          const taxaAprov = card.totalOocitos > 0
            ? ((card.totalEmbrioes / card.totalOocitos) * 100).toFixed(0) + "%"
            : "—";

          const summaryContent = (
            <div className="flex flex-wrap items-center gap-3 w-full">
              {/* Nome da doadora */}
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-brand-400 shrink-0" />
                <span className="font-semibold text-gray-900">{card.doadoraNome}</span>
              </div>
              {/* Mini stats */}
              <div className="flex items-center gap-3 ml-2 flex-wrap">
                {card.opuItems.length > 0 && (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                    {card.opuItems.length} OPU
                  </span>
                )}
                {card.totalOocitos > 0 && (
                  <span className="text-xs text-blue-600">
                    <strong>{card.totalOocitos}</strong> oóc.
                  </span>
                )}
                {card.totalEmbrioes > 0 && (
                  <span className="text-xs text-green-600">
                    <strong>{card.totalEmbrioes}</strong> emb.
                  </span>
                )}
                {card.totalOocitos > 0 && (
                  <span className="text-xs text-gray-400">({taxaAprov} aprov.)</span>
                )}
              </div>
            </div>
          );

          return (
            <DoadoraCardWrapper key={card.doadoraId} doadoraNome={card.doadoraNome} summaryContent={summaryContent}>
              {/* ── Corpo expandido ─────────────────────────────── */}
              <div>
                {/* Link para ficha da doadora — fora do summary para funcionar */}
                {card.doadoraDbId && (
                  <div className="px-5 py-2 bg-gray-50 flex items-center">
                    <Link
                      href={`/doadoras/${card.doadoraDbId}`}
                      className="text-xs text-brand-500 hover:text-brand-700 font-medium"
                    >
                      Ver ficha da doadora →
                    </Link>
                  </div>
                )}

                {/* Sub-seção OPU */}
                {card.opuItems.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-green-50 flex items-center gap-1.5">
                      <FlaskConical className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">OPU-FIV</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="px-4 py-2 font-medium text-gray-500 text-xs">Data</th>
                          <th className="px-4 py-2 font-medium text-gray-500 text-xs">Touro</th>
                          <th className="px-4 py-2 font-medium text-gray-500 text-xs text-right">Oócitos</th>
                          <th className="px-4 py-2 font-medium text-gray-500 text-xs text-right">Embriões</th>
                          <th className="px-4 py-2 font-medium text-gray-500 text-xs text-right">Tx.</th>
                          <th className="px-4 py-2 font-medium text-gray-500 text-xs">Local</th>
                          <th className="px-4 py-2 font-medium text-gray-500 text-xs">
                            <form action={alternarTipoSessao} className="contents">
                              {/* placeholder — type toggle below */}
                            </form>
                            Tipo
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {card.opuItems.map((item) => {
                          const tx = item.oocitos && item.oocitos > 0 && item.embryos_congelados != null
                            ? ((item.embryos_congelados / item.oocitos) * 100).toFixed(0) + "%"
                            : "—";
                          // Receptoras dos embriões desta aspiração
                          const embryosItem: any[] = (item as any).embryos ?? [];
                          const transferidas = embryosItem.filter(
                            (e: any) => (e.transfers ?? []).length > 0
                          );

                          return (
                            <>
                              <tr key={item.id} className="table-row-hover">
                                <td className="px-4 py-2.5 text-gray-700 text-xs">{formatDate(item.sessao_data)}</td>
                                <td className="px-4 py-2.5 text-gray-600 text-xs">{item.touro}</td>
                                <td className="px-4 py-2.5 text-right text-blue-600 font-medium">
                                  {item.oocitos ?? <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right text-green-600 font-medium">
                                  {item.embryos_congelados ?? <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{tx}</td>
                                <td className="px-4 py-2.5 text-gray-500 text-xs">{item.sessao_local ?? "—"}</td>
                                <td className="px-4 py-2.5">
                                  <form action={alternarTipoSessao}>
                                    <input type="hidden" name="session_id" value={item.sessao_id} />
                                    <input type="hidden" name="tipo_atual" value={item.sessao_tipo} />
                                    <button
                                      type="submit"
                                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold border bg-green-100 text-green-700 border-green-200 hover:bg-amber-100 hover:text-amber-700 hover:border-amber-200 transition-colors cursor-pointer"
                                    >
                                      <FlaskConical className="w-2.5 h-2.5" /> OPU
                                      <ArrowLeftRight className="w-2 h-2 opacity-40" />
                                    </button>
                                  </form>
                                </td>
                              </tr>
                              {/* Sub-linha expansível: receptoras com embriões */}
                              {embryosItem.length > 0 && (
                                <tr key={`${item.id}-rec`}>
                                  <td colSpan={7} className="px-0 py-0">
                                    <details className="w-full">
                                      <summary className="px-6 py-1.5 cursor-pointer select-none list-none bg-blue-50 hover:bg-blue-100 transition-colors text-xs text-blue-700 font-medium flex items-center gap-2">
                                        <Baby className="w-3 h-3" />
                                        {embryosItem.length} embrião{embryosItem.length !== 1 ? "ões" : ""} ·{" "}
                                        {transferidas.length} transferido{transferidas.length !== 1 ? "s" : ""}
                                        <span className="ml-auto">▼</span>
                                      </summary>
                                      <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b border-blue-200 text-left">
                                              <th className="pb-1 font-medium text-blue-600">Sexagem</th>
                                              <th className="pb-1 font-medium text-blue-600">Status</th>
                                              <th className="pb-1 font-medium text-blue-600">Receptora</th>
                                              <th className="pb-1 font-medium text-blue-600">Diagnóstico</th>
                                              <th className="pb-1 font-medium text-blue-600">Prev. Parto</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {embryosItem.map((e: any) => {
                                              const transfer = (e.transfers ?? [])[0];
                                              const receptora = transfer
                                                ? (transfer.receptora?.brinco ?? transfer.receptora?.nome ?? "—")
                                                : "—";
                                              const dg = transfer?.pregnancy_diagnoses?.[0];
                                              const resultado = dg?.resultado ?? null;
                                              const parto = dg?.data_previsao_parto ?? null;
                                              return (
                                                <tr key={e.id} className="border-t border-blue-100">
                                                  <td className="py-1.5">
                                                    {e.sexagem === "FEMEA"
                                                      ? <span className="badge bg-pink-100 text-pink-700">♀</span>
                                                      : e.sexagem === "MACHO"
                                                      ? <span className="badge bg-blue-100 text-blue-700">♂</span>
                                                      : <span className="text-gray-400">N/S</span>}
                                                  </td>
                                                  <td className="py-1.5">
                                                    {e.status === "DISPONIVEL"
                                                      ? <span className="badge bg-green-100 text-green-700">Disponível</span>
                                                      : e.status === "IMPLANTADO"
                                                      ? <span className="badge bg-amber-100 text-amber-700">Implantado</span>
                                                      : <span className="badge bg-gray-100 text-gray-500">Descartado</span>}
                                                  </td>
                                                  <td className="py-1.5 font-mono text-gray-700">{receptora}</td>
                                                  <td className="py-1.5">
                                                    {resultado === "POSITIVO"
                                                      ? <span className="badge bg-green-100 text-green-700">P+</span>
                                                      : resultado === "NEGATIVO"
                                                      ? <span className="badge bg-red-100 text-red-600">Neg.</span>
                                                      : <span className="text-gray-300">—</span>}
                                                  </td>
                                                  <td className="py-1.5 text-gray-500">
                                                    {parto ? formatDate(parto) : "—"}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </details>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </DoadoraCardWrapper>
          );
        })}
      </section>
    </div>
  );
}
