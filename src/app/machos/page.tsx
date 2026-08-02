import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, CheckCircle, XCircle, Clock, Star, Trophy, Gavel, ChevronRight } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { ColumnFilter } from "@/components/ui/ColumnFilter";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";
import { ExcluirMachoBtn } from "./ExcluirMachoBtn";
import { EditarMachoInlineBtn } from "./EditarMachoInlineBtn";
import { DesfechoBtn } from "@/components/ui/DesfechoBtn";
import { FiltrosRapidos, type GrupoFiltro } from "@/components/ui/FiltrosRapidos";

/** Calcula meses inteiros entre uma data ISO e hoje */
function idadeEmMeses(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const inicio = new Date(nascimento);
  const hoje   = new Date();
  return (
    (hoje.getFullYear() - inicio.getFullYear()) * 12 +
    (hoje.getMonth() - inicio.getMonth())
  );
}

/** Mínimo de CE (cm) por faixa etária segundo tabela ABCZ */
function ceMinimo(meses: number | null): number | null {
  if (meses == null) return null;
  if (meses <= 15) return 26;
  if (meses <= 18) return 28;
  if (meses <= 21) return 30;
  if (meses <= 24) return 32;
  return 34;
}

function AndroChip({ status }: { status: string | null }) {
  if (status === "APTO")
    return (
      <span className="inline-flex items-center gap-1 badge bg-green-100 text-green-700 font-semibold">
        <CheckCircle className="w-3 h-3" /> Apto
      </span>
    );
  if (status === "INAPTO")
    return (
      <span className="inline-flex items-center gap-1 badge bg-red-100 text-red-600 font-semibold">
        <XCircle className="w-3 h-3" /> Inapto
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 badge bg-gray-100 text-gray-400">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
}

export const revalidate = 0;

export default async function MachosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; andro?: string; ord?: string; pista?: string; se?: string; leilao?: string; idade?: string }>;
}) {
  const { q, andro, ord, pista, se, leilao, idade } = await searchParams;
  const supabase = await createClient();

  const { data: machos } = await supabase
    .from("animals")
    .select("id, nome, rgn, rgd, nascimento, pai_nome, mae_nome, avo_materna, localizacao, percentual_proprio, valor_parcela, exame_andrologico, circunferencia_escrotal, data_ce, para_pista, para_leilao, nascido_se_agro, status_rebanho")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "TOURO")
    .order("nome", { ascending: true });

  // Exclui animais com desfecho registrado (óbito ou venda)
  const all = (machos ?? []).filter(
    (m) => m.status_rebanho !== "MORTA" && m.status_rebanho !== "VENDIDA"
  );

  // Busca IDs de animais que têm premiações
  const { data: awardsData } = await supabase
    .from("awards")
    .select("animal_id")
    .eq("farm_id", FARM_ID);
  const animaisComPremio = new Set((awardsData ?? []).map((a: any) => a.animal_id));

  // Filtro geral (nome, RGN/RGD, pai)
  let filtrado = q
    ? all.filter((m: any) => {
        const term = q.toLowerCase();
        return (
          (m.nome ?? "").toLowerCase().includes(term) ||
          (m.rgn  ?? "").toLowerCase().includes(term) ||
          (m.rgd  ?? "").toLowerCase().includes(term) ||
          (m.pai_nome ?? "").toLowerCase().includes(term)
        );
      })
    : all;

  // Filtro por status andrológico
  if (andro === "APTO")    filtrado = filtrado.filter((m: any) => m.exame_andrologico === "APTO");
  if (andro === "INAPTO")  filtrado = filtrado.filter((m: any) => m.exame_andrologico === "INAPTO");
  if (andro === "PEND")    filtrado = filtrado.filter((m: any) => !m.exame_andrologico);

  // Filtros rápidos
  if (pista  === "1") filtrado = filtrado.filter((m: any) => m.para_pista);
  if (se     === "1") filtrado = filtrado.filter((m: any) => m.nascido_se_agro);
  if (leilao === "1") filtrado = filtrado.filter((m: any) => (m as any).para_leilao);

  // Filtro por faixa etária
  if (idade) {
    filtrado = filtrado.filter((m: any) => {
      const mes = idadeEmMeses(m.nascimento);
      if (mes == null) return false;
      if (idade === "30+") return mes >= 30;
      const [min, max] = idade.split("-").map(Number);
      return mes >= min && mes < max;
    });
  }

  // Ordenação por idade
  if (ord === "idade_asc")  filtrado = [...filtrado].sort((a: any, b: any) => ((b.nascimento ?? "") as string).localeCompare((a.nascimento ?? "") as string));
  if (ord === "idade_desc") filtrado = [...filtrado].sort((a: any, b: any) => ((a.nascimento ?? "") as string).localeCompare((b.nascimento ?? "") as string));

  // Contagens para os cards
  const totalAptos    = all.filter((m: any) => m.exame_andrologico === "APTO").length;
  const totalInaptos  = all.filter((m: any) => m.exame_andrologico === "INAPTO").length;
  const totalPendente = all.filter((m: any) => !m.exame_andrologico).length;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtrado.length} de {all.length} reprodutores
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Suspense>
            <SearchInput placeholder="Buscar por nome, RGN, RGD ou pai…" />
          </Suspense>
          <ExportarPDF
            titulo="Machos Reprodutores"
            subtitulo={`${filtrado.length} reprodutores · SE Agropecuária Nelore de Elite`}
            orientacao="landscape"
            nomeArquivo="SE_Machos.pdf"
            colunas={[
              { key: "nome",                  label: "Nome",            padrao: true,  largura: 2.0 },
              { key: "rgn",                   label: "RGN",             padrao: true,  largura: 1.4 },
              { key: "rgd",                   label: "RGD",             padrao: true,  largura: 1.2 },
              { key: "nascimento",            label: "Nascimento",      padrao: true,  largura: 1.2 },
              { key: "idade_meses",           label: "Idade (m)",       padrao: true,  largura: 0.8 },
              { key: "pai_nome",              label: "Pai",             padrao: true,  largura: 1.8 },
              { key: "mae_nome",              label: "Mãe",             padrao: false, largura: 1.8 },
              { key: "avo_nome",              label: "Avó (mãe da mãe)", padrao: false, largura: 1.8 },
              { key: "exame_andrologico",     label: "Andrológico",     padrao: true,  largura: 1.0 },
              { key: "circunferencia_escrotal", label: "CE (cm)",       padrao: true,  largura: 0.7 },
              { key: "data_ce",               label: "Data CE",         padrao: false, largura: 1.0 },
              { key: "percentual_proprio",    label: "% Próprio",       padrao: false, largura: 0.8 },
              { key: "valor_parcela",         label: "Vl. Parcela",     padrao: false, largura: 1.0 },
              { key: "para_pista",            label: "Para Pista",      padrao: false, largura: 0.8 },
              { key: "localizacao",           label: "Localização",     padrao: false, largura: 1.0 },
            ] satisfies ColunaPDF[]}
            dados={filtrado.map((m: any) => {
              const andro = m.exame_andrologico;
              const androLabel = andro === "APTO" ? "Apto" : andro === "INAPTO" ? "Inapto" : "Pendente";
              return {
                nome:                   m.nome ?? "—",
                rgn:                    m.rgn ?? "—",
                rgd:                    m.rgd ?? "—",
                nascimento:             m.nascimento ? formatDate(m.nascimento) : "—",
                idade_meses:            (() => { const mm = idadeEmMeses(m.nascimento); return mm != null ? `${mm}m` : "—"; })(),
                pai_nome:               m.pai_nome ?? "—",
                mae_nome:               m.mae_nome ?? "—",
                avo_nome:               (m as any).avo_materna ?? "—",
                exame_andrologico:      androLabel,
                circunferencia_escrotal: m.circunferencia_escrotal != null ? `${m.circunferencia_escrotal} cm` : "—",
                data_ce:                m.data_ce ? formatDate(m.data_ce) : "—",
                percentual_proprio:     m.percentual_proprio != null ? `${(m.percentual_proprio * 100).toFixed(0)}%` : "—",
                valor_parcela:          m.valor_parcela != null ? formatCurrency(m.valor_parcela) : "—",
                para_pista:             m.para_pista ? "Sim" : "Não",
                localizacao:            m.localizacao ?? "—",
              };
            })}
          />
          <Link
            href="/machos/novo"
            className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Novo Macho
          </Link>
        </div>
      </div>

      {/* ── Filtros rápidos ───────────────────────────────────────── */}
      <Suspense>
        <FiltrosRapidos
          totalFiltrado={filtrado.length}
          totalGeral={all.length}
          grupos={[
            {
              rotulo: "Seleção",
              chips: [
                { param: "pista",  value: "1", label: "Para Pista",     cor: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> },
                { param: "se",     value: "1", label: "Nascido na SE",  cor: "bg-gray-100 text-gray-800 border-gray-400" },
                { param: "leilao", value: "1", label: "Para Leilão",    cor: "bg-amber-100 text-amber-800 border-amber-300", icon: <Gavel className="w-3 h-3 text-amber-500" /> },
              ],
            },
            {
              rotulo: "Andrológico",
              unico: true,
              chips: [
                { param: "andro", value: "APTO",   label: "Apto",     cor: "bg-green-100 text-green-800 border-green-300", icon: <CheckCircle className="w-3 h-3 text-green-600" /> },
                { param: "andro", value: "INAPTO",  label: "Inapto",   cor: "bg-red-100 text-red-700 border-red-300",       icon: <XCircle className="w-3 h-3 text-red-500" />     },
                { param: "andro", value: "PEND",    label: "Pendente", cor: "bg-gray-100 text-gray-700 border-gray-300",    icon: <Clock className="w-3 h-3 text-gray-400" />      },
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
          ] satisfies GrupoFiltro[]}
        />
      </Suspense>

      {/* Cards de status andrológico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "",       label: "Total",           count: all.length,    color: "brand"  },
          { key: "APTO",   label: "Aptos (RGD)",      count: totalAptos,    color: "green"  },
          { key: "INAPTO", label: "Inaptos",           count: totalInaptos,  color: "red"    },
          { key: "PEND",   label: "Pendente",          count: totalPendente, color: "gray"   },
        ].map(({ key, label, count, color }) => {
          const isActive = (andro ?? "") === key;
          return (
            <a
              key={key}
              href={key ? `?andro=${key}${q ? `&q=${q}` : ""}` : `?${q ? `q=${q}` : ""}`}
              className={`card p-4 text-center transition-colors hover:shadow-md ${isActive ? "ring-2 ring-brand-400" : ""}`}
            >
              <p className={`text-3xl font-bold text-${color}-600`}>{count}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </a>
          );
        })}
      </div>

      {/* ── Cards (mobile) ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {filtrado.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">
            Nenhum macho encontrado{q ? ` para "${q}"` : ""}.
          </div>
        ) : filtrado.map((m: any) => {
          const meses = idadeEmMeses(m.nascimento);
          const ceMin = ceMinimo(meses);
          const ceOk  = m.circunferencia_escrotal != null && ceMin != null
            ? m.circunferencia_escrotal >= ceMin
            : null;

          return (
            <Link
              key={m.id}
              href={`/machos/${m.id}`}
              className="block bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 active:bg-gray-50 transition-colors"
            >
              {/* Nome + idade + andrológico */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-brand-700 text-sm leading-tight">{m.nome}</span>
                    {m.nascido_se_agro && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src="/logo-se.png" alt="SE Agro" title="Nascido na SE Agropecuária"
                        className="h-4 w-auto shrink-0" style={{ filter: "brightness(0)" }} />
                    )}
                    {m.para_pista && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />}
                    {m.para_leilao && <span title="Preparado para Leilão"><Gavel className="w-3 h-3 text-amber-500 shrink-0" /></span>}
                    {animaisComPremio.has(m.id) && <Trophy className="w-3 h-3 text-yellow-500 shrink-0" />}
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {m.rgd ?? m.rgn ?? "—"}
                    {m.rgd && <span className="ml-1 text-gray-300">RGD</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {meses != null && (
                    <span className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                      {meses}m
                    </span>
                  )}
                  <span className={`badge text-[11px] font-semibold ${
                    m.exame_andrologico === "APTO"   ? "bg-green-100 text-green-700"
                    : m.exame_andrologico === "INAPTO" ? "bg-red-100 text-red-600"
                    : "bg-gray-100 text-gray-500"
                  }`}>
                    {m.exame_andrologico === "APTO" ? "Apto"
                      : m.exame_andrologico === "INAPTO" ? "Inapto" : "Pendente"}
                  </span>
                </div>
              </div>

              {/* Genealogia: Pai × Mãe, com a avó materna alinhada sob a mãe */}
              <div className="flex items-start gap-1.5 text-xs mb-3">
                <span className="font-medium text-gray-700 truncate flex-1 min-w-0"
                      title={m.pai_nome ?? ""}>
                  {m.pai_nome ?? "—"}
                </span>
                <span className="text-gray-300 shrink-0 leading-5">×</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate" title={m.mae_nome ?? ""}>
                    {m.mae_nome ?? "—"}
                  </p>
                  {m.avo_materna && (
                    <p className="text-[10px] text-gray-400 truncate leading-tight"
                       title={`Avó materna: ${m.avo_materna}`}>
                      ({m.avo_materna})
                    </p>
                  )}
                </div>
              </div>

              {/* CE + localização */}
              <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
                <div className="flex items-center gap-4">
                  <div>
                    <p className={`text-base font-semibold leading-none ${
                      ceOk === true ? "text-green-600" : ceOk === false ? "text-red-500" : "text-gray-900"
                    }`}>
                      {m.circunferencia_escrotal != null ? `${m.circunferencia_escrotal}` : "—"}
                      <span className="text-[10px] font-normal text-gray-400 ml-0.5">cm</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      CE{ceMin != null ? ` · mín ${ceMin}` : ""}
                    </p>
                  </div>
                  {m.localizacao && (
                    <>
                      <div className="w-px h-6 bg-gray-100" />
                      <p className="text-[11px] text-gray-500 truncate max-w-[110px]">{m.localizacao}</p>
                    </>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="card overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left align-top">
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Animal</th>
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">RGN / RGD</th>

              {/* Nascimento */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Nascimento</span>
                  <Suspense>
                    <ColumnFilter
                      param="ord"
                      placeholder="Ordenar"
                      options={[
                        { value: "idade_asc",  label: "↑ Mais novo" },
                        { value: "idade_desc", label: "↓ Mais velho" },
                      ]}
                    />
                  </Suspense>
                </div>
              </th>

              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">Pai</th>
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">Mãe</th>
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">Avó</th>

              {/* Andrológico */}
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  <span>Andrológico</span>
                  <Suspense>
                    <ColumnFilter
                      param="andro"
                      placeholder="Todos"
                      options={[
                        { value: "APTO",   label: "✓ Apto"    },
                        { value: "INAPTO", label: "✗ Inapto"  },
                        { value: "PEND",   label: "⏳ Pendente" },
                      ]}
                    />
                  </Suspense>
                </div>
              </th>

              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">CE (cm)</th>
              <th className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">Localização</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrado.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Nenhum macho encontrado{q ? ` para "${q}"` : ""}.
                </td>
              </tr>
            ) : (
              filtrado.map((m: any) => {
                const meses    = idadeEmMeses(m.nascimento);
                const ceMin    = ceMinimo(meses);
                const ceOk     = m.circunferencia_escrotal != null && ceMin != null
                  ? m.circunferencia_escrotal >= ceMin
                  : null;

                return (
                  <tr key={m.id} className="table-row-hover">
                    {/* Nome */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/machos/${m.id}`}
                          className="font-semibold text-brand-700 hover:text-brand-900 hover:underline underline-offset-2 transition-colors"
                        >
                          {m.nome}
                        </Link>
                        {m.nascido_se_agro && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src="/logo-se.png"
                            alt="Nascido SE Agro"
                            title="Nascido na SE Agropecuária"
                            className="h-5 w-auto opacity-80"
                            style={{ filter: "brightness(0)" }}
                          />
                        )}
                        {m.para_pista && (
                          <span title="Selecionado para Pista">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          </span>
                        )}
                        {(m as any).para_leilao && (
                          <span title="Preparado para Leilão">
                            <Gavel className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                        )}
                        {animaisComPremio.has(m.id) && (
                          <span title="Animal premiado">
                            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                          </span>
                        )}
                      </div>

                      {/* Mobile: genealogia vem para cá — em Nelore de elite ela
                          é o dado principal, não pode sumir na tela pequena. */}
                      <div className="lg:hidden mt-1 space-y-0.5 text-[10px] leading-tight max-w-[210px]">
                        {m.pai_nome && (
                          <p className="text-gray-500 truncate" title={m.pai_nome}>
                            <span className="text-blue-500 font-semibold">♂</span> {m.pai_nome}
                          </p>
                        )}
                        {m.mae_nome && (
                          <p className="text-gray-500 truncate" title={m.mae_nome}>
                            <span className="text-pink-500 font-semibold">♀</span> {m.mae_nome}
                          </p>
                        )}
                        {(m as any).avo_materna && (
                          <p className="text-gray-400 truncate" title={(m as any).avo_materna}>
                            <span className="text-gray-300">avó</span> {(m as any).avo_materna}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* RGN / RGD */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.rgd ? (
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-brand-700 font-semibold">{m.rgd}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">RGD</span>
                        </div>
                      ) : m.rgn ? (
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-gray-500">{m.rgn}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">RGN</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Nascimento + idade */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-500">{formatDate(m.nascimento)}</span>
                      {meses != null && (
                        <span className="ml-1.5 text-[11px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">
                          {meses}m
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate hidden lg:table-cell">{m.pai_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate hidden lg:table-cell">{m.mae_nome ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate hidden lg:table-cell" title={(m as any).avo_materna ?? "—"}>
                      {(m as any).avo_materna ?? "—"}
                    </td>

                    {/* Exame Andrológico */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <AndroChip status={m.exame_andrologico ?? null} />
                    </td>

                    {/* CE */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.circunferencia_escrotal != null ? (
                        <span className={`font-semibold ${ceOk === true ? "text-green-600" : ceOk === false ? "text-red-500" : "text-gray-700"}`}>
                          {m.circunferencia_escrotal} cm
                          {ceMin != null && (
                            <span className="ml-1 text-[10px] font-normal text-gray-400">(mín. {ceMin})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap hidden lg:table-cell">{m.localizacao ?? "—"}</td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <EditarMachoInlineBtn
                          id={m.id}
                          nome={m.nome}
                          valorParcela={m.valor_parcela ?? null}
                          percentualProprio={m.percentual_proprio ?? null}
                          localizacao={m.localizacao ?? null}
                          nascimento={m.nascimento ?? null}
                        />
                        <DesfechoBtn
                          animalId={m.id}
                          nome={m.nome ?? m.rgn ?? "—"}
                          tipoAnimal="TOURO"
                        />
                        <ExcluirMachoBtn id={m.id} nome={m.nome} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
