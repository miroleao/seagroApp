import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency, FARM_ID, idadeEmMeses } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { Star, Plus, Trophy } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { ColumnFilter } from "@/components/ui/ColumnFilter";

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


export default async function DoadorasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pai?: string; mae?: string; loc?: string; status?: string; ord?: string; parc?: string }>;
}) {
  const { q, pai, mae, loc, status, ord, parc } = await searchParams;
  const supabase = await createClient();

  const { data: doadoras } = await supabase
    .from("animals")
    .select("id, nome, rgn, nascimento, pai_nome, mae_nome, localizacao, percentual_proprio, valor_parcela, status_reprodutivo, touro_prenhez, touro_ultimo_parto, para_pista")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA")
    .order("nome", { ascending: true });

  const all = doadoras ?? [];

  // Busca IDs de animais que têm premiações
  const { data: awardsData } = await supabase
    .from("awards")
    .select("animal_id")
    .eq("farm_id", FARM_ID);
  const animaisComPremio = new Set((awardsData ?? []).map((a: any) => a.animal_id));

  // Filtro por busca geral (nome, pai, mãe, RGN)
  let filtrado = q
    ? all.filter((d: any) => {
        const term = q.toLowerCase();
        return (
          (d.nome ?? "").toLowerCase().includes(term) ||
          (d.pai_nome ?? "").toLowerCase().includes(term) ||
          (d.mae_nome ?? "").toLowerCase().includes(term) ||
          (d.rgn ?? "").toLowerCase().includes(term)
        );
      })
    : all;

  // Filtro por pai
  if (pai) filtrado = filtrado.filter((d: any) => (d.pai_nome ?? "") === pai);

  // Filtro por mãe
  if (mae) filtrado = filtrado.filter((d: any) => (d.mae_nome ?? "") === mae);

  // Filtro por localização
  if (loc) filtrado = filtrado.filter((d: any) => (d.localizacao ?? "") === loc);

  // Filtro por status reprodutivo
  if (status) filtrado = filtrado.filter((d: any) => (d.status_reprodutivo ?? "") === status);

  // Ordenação por idade
  if (ord === "idade_asc") {
    filtrado = [...filtrado].sort((a, b) => (b.nascimento ?? "").localeCompare(a.nascimento ?? ""));
  } else if (ord === "idade_desc") {
    filtrado = [...filtrado].sort((a, b) => (a.nascimento ?? "").localeCompare(b.nascimento ?? ""));
  }

  // Ordenação por parcela
  if (parc === "parc_asc") {
    filtrado = [...filtrado].sort((a, b) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0));
  } else if (parc === "parc_desc") {
    filtrado = [...filtrado].sort((a, b) => (b.valor_parcela ?? 0) - (a.valor_parcela ?? 0));
  }

  // Opções dinâmicas para os filtros
  const pais       = [...new Set(all.map((d: any) => d.pai_nome).filter(Boolean))].sort() as string[];
  const maes       = [...new Set(all.map((d: any) => d.mae_nome).filter(Boolean))].sort() as string[];
  const localizacoes = [...new Set(all.map((d: any) => d.localizacao).filter(Boolean))].sort() as string[];
  const statuses   = [...new Set(all.map((d: any) => d.status_reprodutivo).filter(Boolean))].sort() as string[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doadoras</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtrado.length} de {all.length} doadoras
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <SearchInput placeholder="Buscar por nome, pai, mãe ou RGN…" />
          </Suspense>
          <Link
            href="/doadoras/novo"
            className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Nova Doadora
          </Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left align-top">
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Animal</th>
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">RGN</th>

              {/* Nascimento / Idade — com ordenação */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Nascimento</span>
                  <Suspense>
                    <ColumnFilter
                      param="ord"
                      placeholder="Ordenar"
                      options={[
                        { value: "idade_asc",  label: "↑ Mais nova" },
                        { value: "idade_desc", label: "↓ Mais velha" },
                      ]}
                    />
                  </Suspense>
                </div>
              </th>

              {/* Pai */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Pai</span>
                  <Suspense>
                    <ColumnFilter
                      param="pai"
                      placeholder="Todos"
                      options={pais.map((p) => ({ value: p, label: p }))}
                    />
                  </Suspense>
                </div>
              </th>

              {/* Mãe */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Mãe</span>
                  <Suspense>
                    <ColumnFilter
                      param="mae"
                      placeholder="Todas"
                      options={maes.map((m) => ({ value: m, label: m }))}
                    />
                  </Suspense>
                </div>
              </th>

              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">% Próprio</th>

              {/* Vl. Parcela — com ordenação */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Vl. Parcela</span>
                  <Suspense>
                    <ColumnFilter
                      param="parc"
                      placeholder="Ordenar"
                      options={[
                        { value: "parc_asc",  label: "↑ Menor valor" },
                        { value: "parc_desc", label: "↓ Maior valor" },
                      ]}
                    />
                  </Suspense>
                </div>
              </th>

              {/* Reprodutivo */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Reprodutivo</span>
                  <Suspense>
                    <ColumnFilter
                      param="status"
                      placeholder="Todos"
                      options={[
                        { value: "VAZIA",      label: "Vazia"      },
                        { value: "COLETANDO",  label: "Coletando"  },
                        { value: "INSEMINADA", label: "Inseminada" },
                        { value: "GESTANTE",   label: "Gestante"   },
                        { value: "PARIDA",     label: "Parida"     },
                        { value: "ABORTOU",    label: "Abortou"    },
                        { value: "SECA",       label: "Seca"       },
                        { value: "DESCARTADA", label: "Descartada" },
                        { value: "VENDIDA",    label: "Vendida"    },
                      ]}
                    />
                  </Suspense>
                </div>
              </th>

              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Pai da Prenhez</th>

              {/* Localização */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Localização</span>
                  <Suspense>
                    <ColumnFilter
                      param="loc"
                      placeholder="Todas"
                      options={localizacoes.map((l) => ({ value: l, label: l }))}
                    />
                  </Suspense>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrado.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Nenhuma doadora encontrada{q ? ` para "${q}"` : ""}.
                </td>
              </tr>
            ) : filtrado.map((d: any) => {
              const percentualProprio = d.percentual_proprio != null
                ? `${(d.percentual_proprio * 100).toFixed(0)}%`
                : "—";

              return (
                <tr key={d.id} className="table-row-hover">
                  {/* Nome clicável + indicador de pista */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/doadoras/${d.id}`}
                        className="font-semibold text-brand-700 hover:text-brand-900 hover:underline underline-offset-2 transition-colors"
                      >
                        {d.nome}
                      </Link>
                      {d.para_pista && (
                        <span title="Selecionada para Pista">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        </span>
                      )}
                      {animaisComPremio.has(d.id) && (
                        <span title="Animal premiado">
                          <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{d.rgn ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-gray-500">{formatDate(d.nascimento)}</span>
                    {(() => {
                      const m = idadeEmMeses(d.nascimento);
                      if (m == null) return null;
                      return (
                        <span className="ml-1.5 text-[11px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">
                          {m}m
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={d.pai_nome ?? ""}>{d.pai_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={d.mae_nome ?? ""}>{d.mae_nome ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="badge bg-brand-100 text-brand-700">{percentualProprio}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-medium">
                    {d.valor_parcela != null ? formatCurrency(d.valor_parcela) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {d.status_reprodutivo && STATUS_MAP[d.status_reprodutivo] ? (
                      <span className={`badge text-xs font-semibold ${STATUS_MAP[d.status_reprodutivo].cls}`}>
                        {STATUS_MAP[d.status_reprodutivo].label}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap max-w-[160px] truncate"
                      title={d.touro_prenhez ?? d.touro_ultimo_parto ?? ""}>
                    {d.touro_prenhez
                      ? <span className="text-gray-600">{d.touro_prenhez}</span>
                      : d.touro_ultimo_parto
                        ? <span className="text-gray-400 italic">{d.touro_ultimo_parto}</span>
                        : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {d.localizacao ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
