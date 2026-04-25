import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import { Baby, FlaskConical } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { toggleCdcFiv, toggleAdtTe, toggleDna } from "./actions";

function temDna(obs: string | null | undefined): boolean {
  return !!(obs && obs.includes("DNA:1"));
}

function obsBase(obs: string | null | undefined): string {
  return (obs ?? "").replace(/DNA:1\s*\|?\s*/g, "").trim();
}

function DocChip({
  label, checked, embryoId, campo, obsBaseVal,
}: {
  label: string; checked: boolean; embryoId: string;
  campo: "cdc" | "adt" | "dna"; obsBaseVal?: string;
}) {
  const action = campo === "cdc" ? toggleCdcFiv : campo === "adt" ? toggleAdtTe : toggleDna;
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="embryo_id" value={embryoId} />
      <input type="hidden" name="atual" value={checked ? "sim" : "nao"} />
      {campo === "dna" && <input type="hidden" name="obs_base" value={obsBaseVal ?? ""} />}
      <button
        type="submit"
        title={checked ? `Remover ${label}` : `Marcar ${label} como OK`}
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

export default async function EmbrioesPag({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sex?: string; stts?: string }>;
}) {
  const { q, sex, stts } = await searchParams;
  const supabase = await createClient();

  const { data: embrioes, error } = await supabase
    .from("embryos")
    .select(`
      id, aspiration_id, numero_cdc_fiv, numero_adt_te, sexagem, status, observacoes,
      aspiration:aspirations (
        id, doadora_id, doadora_nome, touro_nome, observacoes,
        doadora:animals!aspirations_doadora_id_fkey ( id, nome, rgn ),
        session:opu_sessions ( data, tipo, local )
      ),
      transfers:transfers!transfers_embryo_id_fkey (
        id, receptora_brinco,
        receptora:animals!transfers_receptora_id_fkey ( nome, brinco ),
        pregnancy_diagnoses ( data_previsao_parto, resultado )
      )
    `)
    .eq("farm_id", FARM_ID)
    .order("status", { ascending: true });

  const { count: prenhezes } = await supabase
    .from("pregnancy_diagnoses")
    .select("*", { count: "exact", head: true })
    .eq("farm_id", FARM_ID)
    .eq("resultado", "POSITIVO");

  const all = embrioes ?? [];

  // Filtro por nome da doadora
  let filtrado = q
    ? all.filter(e => {
        const asp = e.aspiration as any;
        const nome = asp?.doadora?.nome ?? asp?.doadora_nome ?? "";
        return nome.toLowerCase().includes(q.toLowerCase());
      })
    : all;

  // Filtro por sexagem
  if (sex) filtrado = filtrado.filter((e: any) => (e.sexagem ?? "NAO_SEX") === sex);

  // Filtro por status
  if (stts) filtrado = filtrado.filter((e: any) => (e.status ?? "") === stts);

  const disponiveis = filtrado.filter(e => e.status === "DISPONIVEL");
  const femeas      = filtrado.filter(e => e.sexagem === "FEMEA").length;
  const machos      = filtrado.filter(e => e.sexagem === "MACHO").length;

  // Agrupa por doadora × touro, mantendo lista de embriões
  type Grupo = {
    doadora: string; doadoraId: string | null; touro: string;
    total: number; femeas: number; machos: number; naoSex: number;
    embryos: any[];
  };
  const porDoadora: Record<string, Grupo> = {};

  for (const e of filtrado) {
    const asp     = e.aspiration as any;
    const doadora = asp?.doadora?.nome ?? asp?.doadora_nome ?? "—";
    const dId     = asp?.doadora?.id ?? null;
    const touro   = asp?.touro_nome ?? "—";
    const key     = `${doadora}__${touro}`;
    if (!porDoadora[key]) {
      porDoadora[key] = { doadora, doadoraId: dId, touro, total: 0, femeas: 0, machos: 0, naoSex: 0, embryos: [] };
    }
    porDoadora[key].total++;
    if (e.sexagem === "FEMEA")      porDoadora[key].femeas++;
    else if (e.sexagem === "MACHO") porDoadora[key].machos++;
    else                            porDoadora[key].naoSex++;
    porDoadora[key].embryos.push(e);
  }
  const resumo = Object.values(porDoadora).sort((a, b) => b.total - a.total);

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Embriões</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtrado.length} total · {disponiveis.length} disponíveis
          </p>
        </div>
        <Suspense>
          <SearchInput placeholder="Buscar por doadora…" />
        </Suspense>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          Erro: {error.message}
        </div>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-brand-600">{filtrado.length}</p>
          <p className="text-sm text-gray-500 mt-1">Total</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-pink-500">{femeas}</p>
          <p className="text-sm text-gray-500 mt-1">♀ Fêmeas</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-blue-500">{machos}</p>
          <p className="text-sm text-gray-500 mt-1">♂ Machos</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-purple-500">{prenhezes ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">Prenhezes conf.</p>
        </div>
      </div>

      {/* Tabela agrupada por Doadora — expandível */}
      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-gray-900">Estoque por Doadora × Touro</h2>
          <span className="badge bg-gray-100 text-gray-600 ml-auto">{resumo.length} combos</span>
        </div>

        <div className="divide-y divide-gray-100">
          {resumo.length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">
              Nenhum embrião cadastrado.
            </div>
          )}
          {resumo.map((r, idx) => (
            <details key={idx} className="group">
              {/* ── Linha sumário (clicável) ──────────────────── */}
              <summary className="px-4 py-3 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Doadora — link NÃO dentro do summary para evitar conflito com expand */}
                  <span className="font-medium text-gray-900 text-sm">
                    {r.doadora}
                  </span>
                  {r.doadoraId && (
                    <Baby className="w-3.5 h-3.5 text-brand-300" />
                  )}
                  <span className="text-gray-400 text-xs">×</span>
                  <span className="text-gray-600 text-xs">{r.touro}</span>

                  <div className="ml-auto flex items-center gap-3 text-xs shrink-0">
                    <span className="badge bg-brand-100 text-brand-700 font-bold">{r.total}</span>
                    {r.femeas > 0 && <span className="badge bg-pink-100 text-pink-700">♀ {r.femeas}</span>}
                    {r.machos > 0 && <span className="badge bg-blue-100 text-blue-700">♂ {r.machos}</span>}
                    {r.naoSex > 0 && <span className="badge bg-gray-100 text-gray-500">{r.naoSex} N/S</span>}
                    <span className="text-gray-400">▼</span>
                  </div>
                </div>
              </summary>

              {/* ── Linhas expandidas ────────────────────────── */}
              <div className="bg-gray-50 border-t border-gray-100 overflow-x-auto">
                {/* Link para a doadora quando expandido */}
                {r.doadoraId && (
                  <div className="px-4 pt-2 pb-1">
                    <Link
                      href={`/doadoras/${r.doadoraId}`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      → Ver ficha da doadora
                    </Link>
                  </div>
                )}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">
                        Sexagem
                        <Suspense>
                          <ColumnFilter
                            param="sex"
                            placeholder="Todas"
                            options={[
                              { value: "FEMEA", label: "♀ Fêmea" },
                              { value: "MACHO", label: "♂ Macho" },
                              { value: "NAO_SEX", label: "N/S" },
                            ]}
                          />
                        </Suspense>
                      </th>
                      <th className="px-4 py-2 font-medium text-gray-500 whitespace-nowrap">
                        Status
                        <Suspense>
                          <ColumnFilter
                            param="stts"
                            placeholder="Todos"
                            options={[
                              { value: "DISPONIVEL", label: "Disponível" },
                              { value: "IMPLANTADO", label: "Implantado" },
                              { value: "DESCARTADO", label: "Descartado" },
                            ]}
                          />
                        </Suspense>
                      </th>
                      <th className="px-4 py-2 font-medium text-gray-500">Receptora</th>
                      <th className="px-4 py-2 font-medium text-gray-500">Prev. Parto</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-center">CDC-FIV</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-center">ADT-TE</th>
                      <th className="px-4 py-2 font-medium text-gray-500 text-center">DNA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {r.embryos.map((e: any) => {
                      const hasCdc = !!e.numero_cdc_fiv;
                      const hasAdt = !!e.numero_adt_te;
                      const hasDna = temDna(e.observacoes);
                      const transfers: any[] = e.transfers ?? [];

                      const transfer = transfers[0];
                      const receptora = transfer
                        ? (transfer.receptora?.brinco ?? transfer.receptora?.nome ?? transfer.receptora_brinco ?? "—")
                        : "—";
                      const dg = transfer?.pregnancy_diagnoses?.[0];
                      const previsaoParto = dg?.data_previsao_parto ?? null;

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
                          <td className="px-4 py-2 text-gray-600 font-mono">{receptora}</td>
                          <td className="px-4 py-2 text-gray-500">
                            {previsaoParto ? formatDate(previsaoParto) : "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <DocChip label="CDC-FIV" checked={hasCdc} embryoId={e.id} campo="cdc" />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <DocChip label="ADT-TE" checked={hasAdt} embryoId={e.id} campo="adt" />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <DocChip label="DNA" checked={hasDna} embryoId={e.id} campo="dna" obsBaseVal={obsBase(e.observacoes)} />
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
      </section>
    </div>
  );
}
