import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { Star, Plus, Trophy, ChevronRight, Gavel } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { ExcluirDoadoraBtn } from "./ExcluirDoadoraBtn";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";
import { FiltrosRapidos, type GrupoFiltro } from "@/components/ui/FiltrosRapidos";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  COLETANDO:  { label: "Coletando",  cls: "bg-purple-100 text-purple-700" },
  INSEMINADA: { label: "Inseminada", cls: "bg-amber-100  text-amber-700"  },
  GESTANTE:   { label: "Prenha",      cls: "bg-green-100  text-green-700"  },
  PARIDA:     { label: "Parida",     cls: "bg-indigo-100 text-indigo-700" },
  ABORTOU:    { label: "Abortou",    cls: "bg-rose-100   text-rose-700"   },
  VAZIA:      { label: "Vazia",      cls: "bg-gray-100   text-gray-500"   },
  SECA:       { label: "Seca",       cls: "bg-orange-100 text-orange-700" },
  DESCARTADA: { label: "Descartada", cls: "bg-red-100    text-red-600"    },
  VENDIDA:    { label: "Vendida",    cls: "bg-blue-100   text-blue-700"   },
};

/** Calcula meses inteiros entre uma data ISO e hoje */
function idadeEmMeses(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const inicio = new Date(nascimento);
  const hoje   = new Date();
  return (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
}

/** Previsão de parto: inseminação + 290 dias */
function previsaoParto(dataInseminacao: string | null): { iso: string; diasRestantes: number } | null {
  if (!dataInseminacao) return null;
  const d = new Date(dataInseminacao);
  d.setDate(d.getDate() + 290);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
  return { iso: d.toISOString().split("T")[0], diasRestantes: dias };
}

export const revalidate = 0;

export default async function DoadorasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pai?: string; mae?: string; loc?: string; status?: string; ord?: string; parc?: string; pista?: string; se?: string; leilao?: string; idade?: string }>;
}) {
  const { q, pai, mae, loc, status, ord, parc, pista, se, leilao, idade } = await searchParams;
  const supabase = await createClient();

  const { data: doadoras } = await supabase
    .from("animals")
    .select("id, nome, rgn, nascimento, pai_nome, mae_nome, mae_id, localizacao, percentual_proprio, valor_parcela, status_reprodutivo, touro_prenhez, touro_ultimo_parto, data_inseminacao, para_pista, para_leilao, nascido_se_agro")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA")
    .order("nome", { ascending: true });

  const all = doadoras ?? [];

  // Mapa id → { mae_nome } para resolver avó (mãe da mãe)
  const idParaMaeNome: Record<string, string | null> = {};
  for (const d of all) {
    idParaMaeNome[(d as any).id] = (d as any).mae_nome ?? null;
  }

  // Busca IDs de animais que têm premiações
  const { data: awardsData } = await supabase
    .from("awards")
    .select("animal_id")
    .eq("farm_id", FARM_ID);
  const animaisComPremio = new Set((awardsData ?? []).map((a: any) => a.animal_id));

  // ── Contadores para os cards mobile ──────────────────────────────────────────
  // Embriões por doadora (soma de embryos_congelados nas aspirações)
  const { data: aspTotais } = await supabase
    .from("aspirations")
    .select("doadora_id, embryos_congelados")
    .eq("farm_id", FARM_ID)
    .not("doadora_id", "is", null);

  const embryosPorDoadora: Record<string, number> = {};
  for (const asp of (aspTotais ?? [])) {
    if (!asp.doadora_id) continue;
    embryosPorDoadora[asp.doadora_id] = (embryosPorDoadora[asp.doadora_id] ?? 0) + (asp.embryos_congelados ?? 0);
  }

  // Prenhezes positivas por doadora (via aspirations → embryos → transfers → pregnancy_diagnoses)
  const { data: prenhezesDados } = await supabase
    .from("aspirations")
    .select(`
      doadora_id,
      embryos:embryos!embryos_aspiration_id_fkey (
        transfers:transfers!transfers_embryo_id_fkey (
          pregnancy_diagnoses ( resultado )
        )
      )
    `)
    .eq("farm_id", FARM_ID)
    .not("doadora_id", "is", null);

  const prenhezesPorDoadora: Record<string, number> = {};
  for (const asp of (prenhezesDados ?? [])) {
    if (!asp.doadora_id) continue;
    for (const emb of (asp.embryos as any[] ?? [])) {
      for (const tr of (emb.transfers as any[] ?? [])) {
        for (const dg of (tr.pregnancy_diagnoses as any[] ?? [])) {
          if (dg.resultado === "POSITIVO") {
            prenhezesPorDoadora[asp.doadora_id] = (prenhezesPorDoadora[asp.doadora_id] ?? 0) + 1;
          }
        }
      }
    }
  }

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

  // Filtros rápidos
  if (pista  === "1") filtrado = filtrado.filter((d: any) => d.para_pista);
  if (se     === "1") filtrado = filtrado.filter((d: any) => d.nascido_se_agro);
  if (leilao === "1") filtrado = filtrado.filter((d: any) => (d as any).para_leilao);

  // Filtro por faixa etária (param: "6-9", "9-12", "12-16", "16-20", "20-24", "24-30", "30+")
  if (idade) {
    filtrado = filtrado.filter((d: any) => {
      const m = idadeEmMeses(d.nascimento);
      if (m == null) return false;
      if (idade === "30+") return m >= 30;
      const [min, max] = idade.split("-").map(Number);
      return m >= min && m < max;
    });
  }

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
        <div className="flex items-center gap-3 flex-wrap">
          <Suspense>
            <SearchInput placeholder="Buscar por nome, pai, mãe ou RGN…" />
          </Suspense>
          <ExportarPDF
            titulo="Doadoras"
            subtitulo={`${filtrado.length} doadoras · SE Agropecuária Nelore de Elite`}
            orientacao="landscape"
            nomeArquivo="SE_Doadoras.pdf"
            colunas={[
              { key: "nome",               label: "Nome",             padrao: true,  largura: 2.2 },
              { key: "rgn",                label: "RGN",              padrao: true,  largura: 1.4 },
              { key: "nascimento",         label: "Nascimento",       padrao: true,  largura: 1.2 },
              { key: "idade_meses",        label: "Idade (m)",        padrao: true,  largura: 0.8 },
              { key: "pai_nome",           label: "Pai",              padrao: true,  largura: 2.0 },
              { key: "mae_nome",           label: "Mãe",              padrao: true,  largura: 2.0 },
              { key: "avo_nome",           label: "Avó (mãe da mãe)", padrao: false, largura: 2.0 },
              { key: "status_reprodutivo", label: "Status Reprodutivo", padrao: false, largura: 1.3 },
              { key: "touro_prenhez",      label: "Touro da Prenhez", padrao: false, largura: 1.8 },
              { key: "percentual_proprio", label: "% Próprio",        padrao: false, largura: 0.8 },
              { key: "valor_parcela",      label: "Vl. Parcela",      padrao: false, largura: 1.0 },
              { key: "localizacao",        label: "Localização",      padrao: false, largura: 1.0 },
              { key: "para_pista",         label: "Para Pista",       padrao: false, largura: 0.8 },
              { key: "nascido_se_agro",    label: "Nascida SE Agro",  padrao: false, largura: 0.9 },
            ] satisfies ColunaPDF[]}
            dados={filtrado.map((d: any) => ({
              nome:               d.nome ?? "—",
              rgn:                d.rgn ?? "—",
              nascimento:         d.nascimento ? formatDate(d.nascimento) : "—",
              idade_meses:        (() => { const m = idadeEmMeses(d.nascimento); return m != null ? `${m}m` : "—"; })(),
              pai_nome:           d.pai_nome ?? "—",
              mae_nome:           d.mae_nome ?? "—",
              // Avó: mae_nome da mãe (lookup pelo mae_id, ou "—" se não cadastrada)
              avo_nome:           d.mae_id ? (idParaMaeNome[d.mae_id] ?? "—") : "—",
              status_reprodutivo: d.status_reprodutivo ?? "—",
              touro_prenhez:      d.touro_prenhez ?? d.touro_ultimo_parto ?? "—",
              percentual_proprio: d.percentual_proprio != null ? `${(d.percentual_proprio * 100).toFixed(0)}%` : "—",
              valor_parcela:      d.valor_parcela != null ? formatCurrency(d.valor_parcela) : "—",
              localizacao:        d.localizacao ?? "—",
              para_pista:         d.para_pista ? "Sim" : "Não",
              nascido_se_agro:    d.nascido_se_agro ? "Sim" : "Não",
            }))}
          />
          <Link
            href="/doadoras/novo"
            className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Nova Doadora
          </Link>
        </div>
      </div>

      {/* ── Filtros rápidos ─────────────────────────────────────────────────── */}
      <Suspense>
        <FiltrosRapidos
          totalFiltrado={filtrado.length}
          totalGeral={all.length}
          grupos={[
            {
              rotulo: "Seleção",
              chips: [
                { param: "pista",  value: "1", label: "Para Pista",     cor: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> },
                { param: "se",     value: "1", label: "Nascida na SE",  cor: "bg-gray-100 text-gray-800 border-gray-400" },
                { param: "leilao", value: "1", label: "Para Leilão",    cor: "bg-amber-100 text-amber-800 border-amber-300", icon: <Gavel className="w-3 h-3 text-amber-500" /> },
              ],
            },
            {
              rotulo: "Idade",
              unico: true,
              chips: [
                { param: "idade", value: "6-9",  label: "6–9m",   cor: "bg-blue-50 text-blue-700 border-blue-300" },
                { param: "idade", value: "9-12",  label: "9–12m",  cor: "bg-blue-50 text-blue-700 border-blue-300" },
                { param: "idade", value: "12-16", label: "12–16m", cor: "bg-blue-50 text-blue-700 border-blue-300" },
                { param: "idade", value: "16-20", label: "16–20m", cor: "bg-blue-50 text-blue-700 border-blue-300" },
                { param: "idade", value: "20-24", label: "20–24m", cor: "bg-blue-50 text-blue-700 border-blue-300" },
                { param: "idade", value: "24-30", label: "24–30m", cor: "bg-blue-50 text-blue-700 border-blue-300" },
                { param: "idade", value: "30+",   label: "30m+",   cor: "bg-blue-50 text-blue-700 border-blue-300" },
              ],
            },
            {
              rotulo: "Status",
              unico: true,
              chips: statuses.map(s => ({
                param: "status",
                value: s,
                label: STATUS_MAP[s]?.label ?? s,
                cor: "bg-purple-50 text-purple-700 border-purple-300",
              })),
            },
          ] satisfies GrupoFiltro[]}
        />
      </Suspense>

      {/* ── VIEW MOBILE — cards (visível apenas abaixo de md) ─────────────────── */}
      <div className="md:hidden space-y-3">
        {filtrado.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            Nenhuma doadora encontrada{q ? ` para "${q}"` : ""}.
          </p>
        ) : filtrado.map((d: any) => {
          const meses = idadeEmMeses(d.nascimento);
          const statusInfo = d.status_reprodutivo && STATUS_MAP[d.status_reprodutivo]
            ? STATUS_MAP[d.status_reprodutivo]
            : null;
          const embrioes = embryosPorDoadora[d.id] ?? 0;
          const prenhezes = prenhezesPorDoadora[d.id] ?? 0;

          return (
            <Link
              key={d.id}
              href={`/doadoras/${d.id}`}
              className="block bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 active:bg-gray-50 transition-colors"
            >
              {/* Linha superior: nome + status */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-brand-700 text-sm leading-tight">{d.nome}</span>
                    {(d as any).nascido_se_agro && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/logo-se.png" alt="SE Agro" title="Nascida na SE Agropecuária"
                        className="h-4 w-auto shrink-0" style={{ filter: "brightness(0)" }} />
                    )}
                    {d.para_pista && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />}
                    {(d as any).para_leilao && <span title="Preparada para Leilão"><Gavel className="w-3 h-3 text-amber-500 shrink-0" /></span>}
                    {animaisComPremio.has(d.id) && <Trophy className="w-3 h-3 text-yellow-500 shrink-0" />}
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">{d.rgn ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {meses != null && (
                    <span className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                      {meses}m
                    </span>
                  )}
                  {statusInfo && (
                    <span className={`badge text-[11px] font-semibold ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Genealogia: Pai × Mãe */}
              <p className="text-xs text-gray-500 mb-3 truncate">
                <span className="font-medium text-gray-700">{d.pai_nome ?? "—"}</span>
                <span className="mx-1.5 text-gray-300">×</span>
                <span className="font-medium text-gray-700">{d.mae_nome ?? "—"}</span>
              </p>

              {/* Linha inferior: embriões + prenhezes + seta */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-900 leading-none">{embrioes}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Embriões</p>
                  </div>
                  <div className="w-px bg-gray-100" />
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-900 leading-none">{prenhezes}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Prenhezes</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── VIEW DESKTOP — tabela (visível apenas acima de md) ───────────────── */}
      <div className="card overflow-x-auto hidden md:block">
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

              {/* Avó */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Avó</th>

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
                        { value: "GESTANTE",   label: "Prenha"     },
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
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Prev. Parto</th>

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
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Nenhuma doadora encontrada{q ? ` para "${q}"` : ""}.
                </td>
              </tr>
            ) : filtrado.map((d: any) => {
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
                      {d.nascido_se_agro && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/logo-se.png"
                          alt="Nascido SE Agro"
                          title="Nascido na SE Agropecuária"
                          className="h-5 w-auto opacity-80"
                          style={{ filter: "brightness(0)" }}
                        />
                      )}
                      {d.para_pista && (
                        <span title="Selecionada para Pista">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        </span>
                      )}
                      {(d as any).para_leilao && (
                        <span title="Preparada para Leilão">
                          <Gavel className="w-3.5 h-3.5 text-amber-500" />
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
                  <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={d.mae_id ? (idParaMaeNome[d.mae_id] ?? "") : ""}>
                    {d.mae_id ? (idParaMaeNome[d.mae_id] ?? "—") : "—"}
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      if (d.status_reprodutivo !== "GESTANTE") return <span className="text-gray-300">—</span>;
                      const prev = previsaoParto(d.data_inseminacao ?? null);
                      if (!prev) return <span className="text-gray-300">—</span>;
                      const cls = prev.diasRestantes < 0
                        ? "bg-rose-100 text-rose-700"
                        : prev.diasRestantes <= 30
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700";
                      return (
                        <span className={`badge text-xs font-medium ${cls}`}>
                          {formatDate(prev.iso)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {d.localizacao ?? "—"}
                  </td>
                  <td className="px-2 py-3">
                    <ExcluirDoadoraBtn id={d.id} nome={d.nome} />
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
