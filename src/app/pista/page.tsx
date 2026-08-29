import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import { Trophy, CalendarDays, Star, Plus, Scale, Users2 } from "lucide-react";
import { criarExposicao } from "./actions";
import { ExcluirExposicaoBtn } from "./ExcluirExposicaoBtn";
import { ResultadoCell } from "./ResultadoCell";
import { PesoOficialInline } from "./PesoOficialInline";
import {
  idadeExata, pesoMinimo, pesoMaximo, statusPeso, StatusPeso, grupoNaData,
} from "@/lib/acnb";
import { SimuladorCategoria } from "./SimuladorCategoria";
import { DataBaseInline } from "./DataBaseInline";
import { ExportarPDF, type ColunaPDF } from "@/components/ui/ExportarPDF";
import {
  montarProgeniesDeMae, montarProgeniesDePai,
  idadeReprodutorEmMeses, ehPaiNovaGeracao,
  type AnimalGenealogico,
} from "@/lib/progenie";

// Grupos ABCZ e `grupoNaData` vivem em @/lib/acnb — compartilhados entre
// esta página (server) e o simulador (client).

// ─── Status rebanho → label + cor ─────────────────────────────────────────────
const STATUS_REPRO: Record<string, { label: string; cls: string }> = {
  ATIVA:           { label: "Ativa",            cls: "bg-green-100 text-green-700" },
  PRENHA_EMBRIAO:  { label: "Prenha (Embrião)", cls: "bg-blue-100 text-blue-700" },
  PRENHA_NATURAL:  { label: "Prenha (Natural)", cls: "bg-cyan-100 text-cyan-700" },
  PARIDA:          { label: "Parida",            cls: "bg-purple-100 text-purple-700" },
  FALHADA:         { label: "Falhada",           cls: "bg-orange-100 text-orange-700" },
  VENDIDA:         { label: "Vendida",           cls: "bg-gray-100 text-gray-500" },
  MORTA:           { label: "Morta",             cls: "bg-gray-200 text-gray-600" },
};

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusPesoBadge({ status, peso, min, max }: {
  status: StatusPeso; peso: number | null; min: number | null; max: number | null;
}) {
  if (status === "SEM_DADOS" || peso == null) {
    return <span className="text-gray-300 text-xs">Sem peso</span>;
  }
  const cores = {
    ABAIXO: "bg-red-100 text-red-700 border-red-200",
    IDEAL:  "bg-green-100 text-green-700 border-green-200",
    ACIMA:  "bg-orange-100 text-orange-700 border-orange-200",
  };
  const labels = { ABAIXO: "↓ Abaixo", IDEAL: "✓ Ideal", ACIMA: "↑ Acima" };
  return (
    <div className="space-y-0.5">
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cores[status]}`}>
        <Scale className="w-3 h-3" />{peso} kg — {labels[status]}
      </span>
      <p className="text-xs text-gray-400">
        Mín. {min ?? "—"} / Máx. {max ?? "—"} kg
      </p>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, string> = {
    OFICIAL:  "bg-brand-100 text-brand-700",
    OURO:     "bg-yellow-100 text-yellow-700",
    EXPOINEL: "bg-purple-100 text-purple-700",
    REGIONAL: "bg-blue-100 text-blue-700",
    LIVRE:    "bg-gray-100 text-gray-600",
  };
  return <span className={`badge ${map[tipo] ?? map.LIVRE}`}>{tipo}</span>;
}

function PrêmioBadge({ tipo }: { tipo: string }) {
  const isTop = tipo.includes("CAMPEAO") || tipo.includes("CAMPEA") || tipo.includes("GRAND");
  return (
    <span className={`badge ${isTop ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
      {isTop ? "🏆 " : ""}{tipo.replace(/_/g, " ")}
    </span>
  );
}

// ─── Situação Reprodutiva (server component helper) ───────────────────────────
function SituacaoReprodutivaCell({ animal }: { animal: any }) {
  // Doadoras: campo status_reprodutivo = "GESTANTE"
  // Receptoras/outros: campo status_rebanho = "PRENHA" | "PRENHA_EMBRIAO" | "PRENHA_NATURAL"
  const prenha =
    animal.status_reprodutivo === "GESTANTE" ||
    animal.status_rebanho === "PRENHA" ||
    animal.status_rebanho === "PRENHA_EMBRIAO" ||
    animal.status_rebanho === "PRENHA_NATURAL";

  if (!prenha) return <span className="text-gray-300 text-xs">—</span>;

  return (
    <span className="badge bg-blue-100 text-blue-700 font-semibold text-xs">P+</span>
  );
}

// ─── Linha discreta com Pai / Mãe, exibida abaixo do nome do animal ───────────
function GenealogiaLine({ pai, mae }: { pai?: string | null; mae?: string | null }) {
  const partes: string[] = [];
  if (pai) partes.push(`Pai: ${pai}`);
  if (mae) partes.push(`Mãe: ${mae}`);
  if (partes.length === 0) return null;
  return (
    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
      ({partes.join(" / ")})
    </p>
  );
}

export const revalidate = 0;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PistaPage() {
  const supabase = await createClient();

  const { data: exhibitions } = await supabase
    .from("exhibitions")
    .select("*")
    .eq("farm_id", FARM_ID)
    .order("data_base", { ascending: true });

  const { data: awards } = await supabase
    .from("awards")
    .select(`
      id, animal_id, tipo_premio, grupo_nelore, descricao_premio, observacoes,
      animal:animals ( id, nome, rgn, nascimento, sexo, para_pista, pai_nome, mae_nome ),
      exhibition:exhibitions ( nome, data_base, local )
    `)
    .eq("farm_id", FARM_ID)
    .order("criado_em", { ascending: false });

  const { data: candidatos } = await supabase
    .from("animals")
    .select("id, nome, rgn, rgd, nascimento, sexo, tipo, localizacao, para_pista, peso_atual, peso_pista, status_rebanho, status_reprodutivo, pai_id, pai_nome, mae_id, mae_nome")
    .eq("farm_id", FARM_ID)
    .in("tipo", ["DOADORA", "NASCIDO", "TOURO"])
    .eq("para_pista", true)
    .order("nascimento", { ascending: false });

  const expos   = exhibitions ?? [];
  const premios = awards ?? [];
  const animais = candidatos ?? [];

  const hoje = new Date();

  // ── Filtro de exposições: 5 dias de graça após a data-base ────────────────
  const GRACE_DAYS = 5;
  const graceLimit = new Date(hoje);
  graceLimit.setDate(graceLimit.getDate() - GRACE_DAYS);

  const proxExpos = expos.filter(e =>
    !e.data_base || new Date(e.data_base + "T12:00:00") >= graceLimit
  );
  const pastExpos = expos.filter(e =>
    e.data_base && new Date(e.data_base + "T12:00:00") < graceLimit
  );

  // ── Queries de prenhezes e crias ao pé ───────────────────────────────────
  const candidatoIds = animais.map((a: any) => a.id);

  // Prenhezes via FIV: aspirations → embryos → transfers → pregnancy_diagnoses
  const { data: aspData } = candidatoIds.length > 0
    ? await supabase
        .from("aspirations")
        .select(`
          id, doadora_id,
          embryos(
            id,
            transfers(
              id,
              pregnancy_diagnoses( id, resultado, data_previsao_parto )
            )
          )
        `)
        .in("doadora_id", candidatoIds)
        .eq("farm_id", FARM_ID)
    : { data: [] as any[] };

  // Mapa doadora_id → prenhezes ativas (POSITIVO) com previsão de parto
  const prenhezesPorDoadora: Record<string, { data_previsao_parto: string | null }[]> = {};
  for (const asp of aspData ?? []) {
    for (const emb of (asp as any).embryos ?? []) {
      for (const t of (emb as any).transfers ?? []) {
        for (const dg of (t as any).pregnancy_diagnoses ?? []) {
          if (dg.resultado === "POSITIVO") {
            if (!prenhezesPorDoadora[asp.doadora_id]) prenhezesPorDoadora[asp.doadora_id] = [];
            prenhezesPorDoadora[asp.doadora_id].push(dg);
          }
        }
      }
    }
  }

  // Crias: animais cujo mae_id é um dos candidatos
  const { data: crias } = candidatoIds.length > 0
    ? await supabase
        .from("animals")
        .select("id, nome, nascimento, sexo, mae_id")
        .in("mae_id", candidatoIds)
        .eq("farm_id", FARM_ID)
    : { data: [] as any[] };

  const criasPorMae: Record<string, any[]> = {};
  for (const c of crias ?? []) {
    if (c.mae_id) {
      if (!criasPorMae[c.mae_id]) criasPorMae[c.mae_id] = [];
      criasPorMae[c.mae_id].push(c);
    }
  }

  // ── Enriquecer animais com dados de peso e idade ─────────────────────────
  const animaisEnriquecidos = animais.map((a: any) => {
    const sexoEfetivo: "M" | "F" = (a.sexo === "M" || a.tipo === "TOURO") ? "M" : "F";
    if (!a.nascimento) return { ...a, meses: null, dias: null, grupo: null, stPeso: "SEM_DADOS" as StatusPeso, sexoEfetivo };
    const { meses, dias } = idadeExata(a.nascimento, hoje);
    const grupo = grupoNaData(a.nascimento, sexoEfetivo, hoje);
    const stPeso = statusPeso(a.peso_atual, sexoEfetivo, meses, dias);
    const min  = pesoMinimo(sexoEfetivo, meses);
    const max  = pesoMaximo(sexoEfetivo, meses, dias);
    return { ...a, meses, dias, grupo, stPeso, min, max, sexoEfetivo };
  });

  // Mapa animal_id → premiações
  const premiosPorAnimal: Record<string, any[]> = {};
  for (const p of (awards ?? [])) {
    const aid = (p as any).animal_id ?? (p.animal as any)?.id;
    if (aid) {
      if (!premiosPorAnimal[aid]) premiosPorAnimal[aid] = [];
      premiosPorAnimal[aid].push(p);
    }
  }

  const aptosHoje   = animaisEnriquecidos.filter(a => a.grupo !== null);
  const alertasPeso = animaisEnriquecidos.filter(a =>
    a.grupo !== null && (a.stPeso === "ABAIXO" || a.stPeso === "ACIMA")
  );

  // Contadores reprodutivos para o card de resumo
  const isPrenha = (a: any) =>
    a.status_reprodutivo === "GESTANTE" ||
    a.status_rebanho === "PRENHA" ||
    a.status_rebanho === "PRENHA_EMBRIAO" ||
    a.status_rebanho === "PRENHA_NATURAL";

  const totalPrenhas = animaisEnriquecidos.filter(isPrenha).length;
  const totalCriasAoPe = Object.values(criasPorMae).flat().filter((c: any) => {
    if (!c.nascimento) return true;
    const { meses } = idadeExata(c.nascimento, hoje);
    return meses < 9;
  }).length;

  // ── Conjuntos Progênie — possibilidades a partir dos candidatos p/ pista ──
  const genealogicos: AnimalGenealogico[] = animaisEnriquecidos.map((a: any) => ({
    id: a.id,
    nome: a.nome,
    sexo: a.sexoEfetivo,
    pai_id: a.pai_id ?? null,
    pai_nome: a.pai_nome ?? null,
    mae_id: a.mae_id ?? null,
    mae_nome: a.mae_nome ?? null,
  }));

  const progeniesMae = montarProgeniesDeMae(genealogicos);
  const progeniesPai = montarProgeniesDePai(genealogicos);

  // Data de referência p/ status "Pai Nova Geração" (<84m0d): data-base da
  // próxima exposição com data definida; sem nenhuma agendada, usa hoje.
  const proximaComData = proxExpos.find((e: any) => e.data_base);
  const dataRefPaiNG = proximaComData ? new Date(proximaComData.data_base + "T12:00:00") : hoje;

  const paiIdsParaIdade = Array.from(
    new Set(progeniesPai.map(g => g.paiId).filter((id): id is string => !!id))
  );

  const { data: reprodutoresData } = paiIdsParaIdade.length > 0
    ? await supabase
        .from("animals")
        .select("id, nascimento")
        .in("id", paiIdsParaIdade)
        .eq("farm_id", FARM_ID)
    : { data: [] as any[] };

  const nascimentoPorPaiId: Record<string, string> = {};
  for (const r of reprodutoresData ?? []) {
    if (r.nascimento) nascimentoPorPaiId[r.id] = r.nascimento;
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pista / Exposições</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {expos.length} exposições · {premios.length} premiações · {animais.length} selecionados para pista
          </p>
        </div>
        <ExportarPDF
          titulo="Pista / Exposições"
          subtitulo={`${animaisEnriquecidos.length} animais selecionados · SE Agropecuária Nelore de Elite`}
          orientacao="landscape"
          nomeArquivo="SE_Pista.pdf"
          colunas={[
            { key: "nome",        label: "Nome",          padrao: true,  largura: 2.0 },
            { key: "rgn",         label: "RGN",           padrao: true,  largura: 1.2 },
            { key: "rgd",         label: "RGD",           padrao: false, largura: 1.2 },
            { key: "nascimento",  label: "Nascimento",    padrao: true,  largura: 1.0 },
            { key: "idade",       label: "Idade",         padrao: true,  largura: 0.7 },
            { key: "sexo",        label: "Sexo",          padrao: true,  largura: 0.6 },
            { key: "grupo",       label: "Grupo ABCZ",    padrao: true,  largura: 1.4 },
            { key: "peso",        label: "Peso (kg)",     padrao: true,  largura: 0.8 },
            { key: "peso_pista",  label: "Peso Oficial",  padrao: true,  largura: 0.9 },
            { key: "sit_repro",   label: "Sit. Reprod.",  padrao: true,  largura: 1.3 },
            { key: "st_peso",     label: "Status Peso",   padrao: false, largura: 1.0 },
            { key: "localizacao", label: "Localização",   padrao: false, largura: 1.0 },
            { key: "premios",     label: "Premiações",    padrao: false, largura: 2.0 },
          ] satisfies ColunaPDF[]}
          dados={animaisEnriquecidos.map((a: any) => ({
            nome:        a.nome ?? "—",
            rgn:         a.rgn ?? "—",
            rgd:         a.rgd ?? "—",
            nascimento:  a.nascimento ? formatDate(a.nascimento) : "—",
            idade:       a.meses != null ? `${a.meses}m` : "—",
            sexo:        a.sexo === "M" ? "Macho" : "Fêmea",
            grupo:       a.grupo?.nome ?? "Fora de faixa",
            peso:        a.peso_atual != null ? String(a.peso_atual) : "—",
            peso_pista:  a.peso_pista != null ? `${a.peso_pista} kg` : "—",
            sit_repro:   isPrenha(a) ? "P+" : "—",
            st_peso:     ({ IDEAL: "Ideal", ABAIXO: "Abaixo", ACIMA: "Acima", SEM_DADOS: "—" })[a.stPeso as string] ?? "—",
            localizacao: a.localizacao ?? "—",
            premios:     (premiosPorAnimal[a.id] ?? []).map((p: any) => p.tipo_premio?.replace(/_/g, " ")).join(", ") || "—",
          }))}
        />
      </div>

      {/* ── Cards de resumo ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-brand-600">{proxExpos.length}</p>
          <p className="text-sm text-gray-500 mt-1">Próximas exposições</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-yellow-500">{premios.length}</p>
          <p className="text-sm text-gray-500 mt-1">Premiações</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-3xl font-bold ${alertasPeso.length > 0 ? "text-red-500" : "text-green-600"}`}>
            {aptosHoje.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Em faixa hoje
            {alertasPeso.length > 0 && (
              <span className="ml-1 text-red-500 font-semibold">· {alertasPeso.length} alerta(s)</span>
            )}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{totalPrenhas}</p>
          <p className="text-sm text-gray-500 mt-1">
            Prenhas
            {totalCriasAoPe > 0 && (
              <span className="ml-1 text-purple-600 font-semibold">· {totalCriasAoPe} ao pé</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Simulador de categoria ───────────────────────── */}
      <SimuladorCategoria
        exposicoes={expos.map((e: any) => ({
          id: e.id,
          nome: e.nome,
          data_base: e.data_base ?? null,
        }))}
      />

      {/* ── Alertas de peso ──────────────────────────────── */}
      {alertasPeso.length > 0 && (
        <section className="card overflow-hidden border-red-200">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <Scale className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-red-700">Alertas de Peso</h2>
            <span className="badge bg-red-100 text-red-700 ml-auto">{alertasPeso.length} fora do padrão</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 text-gray-500 text-xs font-medium">Animal</th>
                <th className="px-4 py-2 text-gray-500 text-xs font-medium">Idade</th>
                <th className="px-4 py-2 text-gray-500 text-xs font-medium">Categoria ABCZ</th>
                <th className="px-4 py-2 text-gray-500 text-xs font-medium">Peso Atual vs Tabela ABCZ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {alertasPeso.map((a: any) => (
                <tr key={a.id} className="table-row-hover">
                  <td className="px-4 py-2.5 font-medium text-gray-900 text-xs">
                    {a.nome}
                    <GenealogiaLine pai={a.pai_nome} mae={a.mae_nome} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{a.meses}m {a.dias}d</td>
                  <td className="px-4 py-2.5 text-xs">
                    {a.grupo ? <span className="badge bg-brand-100 text-brand-700">{a.grupo.nome}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <StatusPesoBadge status={a.stPeso} peso={a.peso_atual} min={a.min} max={a.max} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Próximas / Ativas Exposições ─────────────────── */}
      <section className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <CalendarDays className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Próximas / Exposições Ativas</h2>
            <span className="badge bg-brand-100 text-brand-700 ml-auto">{proxExpos.length} agendadas</span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>

          {/* Form nova exposição */}
          <form action={criarExposicao} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Nova exposição</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Nome da Exposição *</label>
                <input name="nome" required placeholder="Ex: ExpoPecuária 2026"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                <select name="tipo" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  <option value="OFICIAL">Oficial</option>
                  <option value="OURO">Ouro</option>
                  <option value="EXPOINEL">Expoinel</option>
                  <option value="REGIONAL">Regional</option>
                  <option value="LIVRE">Livre</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Data-base <span className="text-brand-600 font-medium">(define a categoria)</span>
                </label>
                <input name="data_base" type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Local / Cidade</label>
                <input name="local" placeholder="Ex: Goiânia – GO"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Organizador</label>
                <input name="organizador" placeholder="Ex: ABCZ"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
            <button type="submit"
              className="mt-3 inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
              <Plus className="w-4 h-4" /> Adicionar Exposição
            </button>
          </form>

          {proxExpos.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              Nenhuma exposição agendada. Cadastre uma acima.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Exposição</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Tipo</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Data-base</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Local</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Organizador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {proxExpos.map((e: any) => {
                  const dataExpo = e.data_base ? new Date(e.data_base + "T12:00:00") : null;
                  const isHoje = dataExpo
                    ? dataExpo.toDateString() === hoje.toDateString()
                    : false;
                  const isPassada = dataExpo && dataExpo < hoje && !isHoje;
                  return (
                    <tr key={e.id} className="table-row-hover">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {e.nome}
                        {isHoje && (
                          <span className="ml-2 badge bg-green-100 text-green-700 text-[10px]">Hoje</span>
                        )}
                        {isPassada && (
                          <span className="ml-2 badge bg-orange-100 text-orange-600 text-[10px]">Em andamento</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><TipoBadge tipo={e.tipo} /></td>
                      <td className="px-4 py-3 text-gray-600">
                        <DataBaseInline exhibitionId={e.id} dataBase={e.data_base} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.local ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{e.organizador ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </details>
      </section>

      {/* ── Animais Selecionados ─────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          <h2 className="font-semibold text-gray-900">Animais Selecionados para Pista</h2>
          <span className="badge bg-yellow-100 text-yellow-700 ml-auto">{animais.length} selecionados</span>
        </div>

        {animais.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhum animal marcado para pista ainda.</p>
            <p className="text-xs text-gray-300 mt-1">Acesse a ficha de cada doadora ou macho e clique em "Marcar para Pista".</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1200px]">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Animal</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Registro</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Nascimento</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Idade</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">CATEGORIA ABCZ</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Peso vs ABCZ</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Peso Oficial</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Sit. Reprodutiva</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Local</th>
                    <th className="px-4 py-3 text-gray-500 text-xs font-medium">Resultado / Pista</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {animaisEnriquecidos.map((a: any) => {
                    const apto = a.grupo !== null;
                    const isMacho = a.tipo === "TOURO";
                    const reg = isMacho ? (a.rgd ?? a.rgn) : a.rgn;
                    const premiosAnimal = premiosPorAnimal[a.id] ?? [];
                    const temPremio = premiosAnimal.length > 0;
                    return (
                      <tr key={a.id} className={`table-row-hover ${!apto ? "opacity-50" : ""}`}>
                        {/* Animal */}
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900">{a.nome}</p>
                            {temPremio && (
                              <span title={`${premiosAnimal.length} premiação(ões)`} className="shrink-0 inline-flex">
                                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-medium ${isMacho ? "text-blue-500" : "text-pink-500"}`}>
                            {isMacho ? "♂ Macho" : "♀ Fêmea"}
                          </span>
                          <GenealogiaLine pai={a.pai_nome} mae={a.mae_nome} />
                        </td>
                        {/* Registro */}
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                          {reg ?? "—"}
                          {isMacho && a.rgd && <span className="ml-1 text-[9px] text-green-600 font-semibold">RGD</span>}
                          {isMacho && !a.rgd && a.rgn && <span className="ml-1 text-[9px] text-orange-500 font-semibold">RGN</span>}
                        </td>
                        {/* Nascimento */}
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(a.nascimento)}</td>
                        {/* Idade */}
                        <td className="px-4 py-3 text-xs font-semibold text-gray-800">
                          {a.meses != null ? `${a.meses}m` : "—"}
                        </td>
                        {/* Categoria ABCZ */}
                        <td className="px-4 py-3 text-xs">
                          {a.grupo
                            ? <span className={`badge font-semibold ${
                                isMacho
                                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                                  : "bg-pink-100 text-pink-700 border border-pink-200"
                              }`}>{a.grupo.nome}</span>
                            : <span className="badge bg-gray-100 text-gray-400">Fora de faixa</span>}
                        </td>
                        {/* Peso vs ABCZ */}
                        <td className="px-4 py-3 text-xs">
                          <StatusPesoBadge status={a.stPeso} peso={a.peso_atual} min={a.min} max={a.max} />
                        </td>
                        {/* Peso Oficial (pesagem de pista) */}
                        <td className="px-4 py-3">
                          <PesoOficialInline animalId={a.id} pesoPista={a.peso_pista ?? null} />
                        </td>
                        {/* Situação Reprodutiva */}
                        <td className="px-4 py-3">
                          <SituacaoReprodutivaCell animal={a} />
                        </td>
                        {/* Local */}
                        <td className="px-4 py-3 text-gray-400 text-xs">{a.localizacao ?? "—"}</td>
                        {/* Resultado / Pista */}
                        <td className="px-4 py-3">
                          <ResultadoCell
                            animalId={a.id}
                            grupoAtual={a.grupo?.nome ?? null}
                            exposicoes={expos.map((e: any) => ({ id: e.id, nome: e.nome, data_base: e.data_base }))}
                            premios={premiosAnimal.map((p: any) => ({
                              id: p.id,
                              tipo_premio: p.tipo_premio,
                              grupo_nelore: p.descricao_premio ?? p.grupo_nelore,
                              observacoes: p.observacoes,
                            }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Projeção por exposição */}
            {proxExpos.length > 0 && (
              <div className="border-t border-gray-100">
                <div className="px-5 py-3 bg-blue-50">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                    Projeção por Exposição — categoria + peso mínimo exigido na data-base
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-2 text-gray-500 font-medium">Animal</th>
                        {proxExpos.map((e: any) => (
                          <th key={e.id} className="px-4 py-2 text-gray-500 font-medium whitespace-nowrap">
                            {e.nome}<br />
                            <span className="text-gray-400 font-normal">{formatDate(e.data_base)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {animaisEnriquecidos.map((a: any) => (
                        <tr key={a.id} className="table-row-hover">
                          <td className="px-4 py-2 font-medium text-gray-900">
                          {a.nome}
                          <GenealogiaLine pai={a.pai_nome} mae={a.mae_nome} />
                        </td>
                          {proxExpos.map((e: any) => {
                            if (!a.nascimento || !e.data_base) {
                              return <td key={e.id} className="px-4 py-2 text-gray-300">—</td>;
                            }
                            const dataExpo = new Date(e.data_base + "T12:00:00");
                            const { meses: m, dias: d } = idadeExata(a.nascimento, dataExpo);
                            const sexo: "M" | "F" = (a.sexo === "M" || a.tipo === "TOURO") ? "M" : "F";
                            const grupo = grupoNaData(a.nascimento, sexo, dataExpo);
                            const min   = pesoMinimo(sexo, m);
                            const max   = pesoMaximo(sexo, m, d);
                            const apto  = grupo !== null;
                            return (
                              <td key={e.id} className="px-4 py-2">
                                {apto && grupo ? (
                                  <div>
                                    <span className="badge bg-brand-100 text-brand-700">{grupo.nome}</span>
                                    <p className="text-gray-400 mt-0.5">
                                      {m}m {d}d
                                      {a.peso_pista != null ? (
                                        <span className="ml-1.5 font-semibold text-brand-700">· {a.peso_pista} kg ✓</span>
                                      ) : a.peso_atual != null ? (
                                        <span className="ml-1.5 font-semibold text-gray-700">· {a.peso_atual} kg</span>
                                      ) : null}
                                    </p>
                                    <p className="text-gray-400">
                                      <span className="text-red-500 font-medium">{min ?? "—"}</span>
                                      <span className="mx-0.5">–</span>
                                      <span className="text-green-600 font-medium">{max ?? "—"}</span>
                                      {" "}kg
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-gray-300">Fora de faixa</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Conjuntos Progênie — Possibilidades ──────────── */}
      <section className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <Users2 className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Conjuntos Progênie — Possibilidades</h2>
            <span className="badge bg-brand-100 text-brand-700 ml-auto">
              {progeniesMae.length + progeniesPai.length} possíve{(progeniesMae.length + progeniesPai.length) === 1 ? "l" : "is"}
            </span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>

          <div className="px-5 py-4 space-y-6">
            <p className="text-xs text-gray-500">
              Montado a partir dos animais marcados para pista, conforme o Manual de Pista (ACNB 2025/2026).
              Verificado aqui: composição do conjunto (mãe/pai, nº de matrizes, sexo). <strong>Não verificado</strong> —
              depende do dia da exposição: cada animal precisa já ter sido julgado individualmente na mesma
              exposição, e fêmea parida com cria própria viva &lt; 7m0d se apresenta com a cria ao pé.
            </p>

            {progeniesMae.length === 0 && progeniesPai.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Nenhum conjunto possível ainda — são necessários 2+ irmãos da mesma mãe, ou 4+ filhos do
                mesmo reprodutor em 2+ matrizes, entre os animais marcados para pista.
              </p>
            ) : (
              <>
                {/* Progênie de Mãe */}
                {progeniesMae.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Progênie de Mãe <span className="font-normal normal-case text-gray-400">— 60 / 40 / 32 pts</span>
                    </p>
                    <div className="space-y-2">
                      {progeniesMae.map((g) => (
                        <div key={g.chave} className={`rounded-lg border p-3 ${g.elegivel ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40"}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{g.maeNome}</span>
                            <span className="badge bg-gray-100 text-gray-600 text-[10px]">{g.filhos.length} filhos</span>
                            {g.mesmoPai && (
                              <span className="badge bg-blue-100 text-blue-700 text-[10px]">mesmo pai: {g.paiComum}</span>
                            )}
                            <span className={`badge text-[10px] ml-auto ${g.elegivel ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                              {g.elegivel ? "✓ Elegível" : "Pendente"}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">{g.motivo}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                            {g.filhos.map((f) => (
                              <span key={f.id} className="text-xs text-gray-700">
                                {f.sexo === "M" ? "♂" : "♀"} {f.nome}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progênie de Pai */}
                {progeniesPai.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Progênie de Pai <span className="font-normal normal-case text-gray-400">— 60/40/32 pts (72/48/38 se Pai Nova Geração)</span>
                    </p>
                    <div className="space-y-2">
                      {progeniesPai.map((g) => {
                        const nasc = g.paiId ? nascimentoPorPaiId[g.paiId] : null;
                        const mesesPai = nasc ? idadeReprodutorEmMeses(nasc, dataRefPaiNG) : null;
                        const isNG = mesesPai != null ? ehPaiNovaGeracao(mesesPai) : null;
                        return (
                          <div key={g.chave} className={`rounded-lg border p-3 ${g.elegivel ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40"}`}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-sm text-gray-900">{g.paiNome}</span>
                              <span className="badge bg-gray-100 text-gray-600 text-[10px]">{g.filhos.length} filhos</span>
                              <span className="badge bg-gray-100 text-gray-600 text-[10px]">{g.matrizesDistintas} matrizes</span>
                              {isNG != null && (
                                <span className={`badge text-[10px] ${isNG ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                                  {isNG ? `Pai Nova Geração (${mesesPai}m)` : `${mesesPai}m — não é Nova Geração`}
                                </span>
                              )}
                              <span className={`badge text-[10px] ml-auto ${g.elegivel ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                {g.elegivel ? "✓ Elegível" : "Pendente"}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">{g.motivo}</p>
                            {nasc == null && (
                              <p className="text-[10px] text-gray-300 mt-0.5">
                                Idade do reprodutor não cadastrada — cadastre-o com data de nascimento para apurar Pai Nova Geração.
                              </p>
                            )}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                              {g.filhos.map((f) => (
                                <span key={f.id} className="text-xs text-gray-700">
                                  {f.sexo === "M" ? "♂" : "♀"} {f.nome}
                                  {f.mae_nome && <span className="text-gray-400"> ({f.mae_nome})</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </details>
      </section>

      {/* ── Histórico de Premiações ──────────────────────── */}
      <section className="card overflow-hidden">
        <details open>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Histórico de Premiações</h2>
            <span className="badge bg-yellow-100 text-yellow-700 ml-auto">{premios.length} prêmios</span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>
          {premios.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Trophy className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhuma premiação registrada.</p>
              <p className="text-xs text-gray-300 mt-1">Registre premiações na ficha individual de cada animal.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Animal</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Prêmio</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Grupo</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Exposição</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Data</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Obs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {premios.map((p: any) => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="px-4 py-3 font-medium text-gray-900 text-xs">
                      {p.animal?.nome ?? "—"}
                      <GenealogiaLine pai={(p.animal as any)?.pai_nome} mae={(p.animal as any)?.mae_nome} />
                    </td>
                    <td className="px-4 py-3"><PrêmioBadge tipo={p.tipo_premio} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{(p as any).descricao_premio ?? p.grupo_nelore ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.exhibition?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(p.exhibition?.data_base)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.observacoes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      </section>

      {/* ── Exposições Passadas ──────────────────────────── */}
      {pastExpos.length > 0 && (
        <section className="card overflow-hidden">
          <details>
            <summary className="px-5 py-4 border-b border-gray-100 cursor-pointer list-none flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-500">Exposições Passadas</h2>
              <span className="badge bg-gray-100 text-gray-500 ml-auto">{pastExpos.length}</span>
              <span className="text-gray-400 text-xs ml-1">▼</span>
            </summary>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Exposição</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Tipo</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Data-base</th>
                  <th className="px-4 py-3 text-gray-500 text-xs font-medium">Local</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pastExpos.map((e: any) => (
                  <tr key={e.id} className="table-row-hover">
                    <td className="px-4 py-3 font-medium text-gray-900 text-xs">{e.nome}</td>
                    <td className="px-4 py-3"><TipoBadge tipo={e.tipo} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <DataBaseInline exhibitionId={e.id} dataBase={e.data_base} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{e.local ?? "—"}</td>
                    <td className="px-2 py-3">
                      <ExcluirExposicaoBtn id={e.id} nome={e.nome} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}
    </div>
  );
}
