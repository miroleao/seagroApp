import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft, Scale, Plus, Trophy, CheckCircle, XCircle, Clock,
  AlertTriangle, Star, Edit2, Gavel, ShoppingCart,
} from "lucide-react";
import {
  toggleParaPistaMacho,
  toggleNascidoSeAgroMacho,
  toggleParaLeilaoMacho,
  salvarInfoLeilaoMacho,
  atualizarExameAndrologico,
  atualizarCE,
  atualizarRGD,
  atualizarRgn,
  atualizarLocalizacaoMacho,
  atualizarPesoMacho,
  registrarPesagemMacho,
  adicionarPremiacaoMacho,
  atualizarGenealogiaTouro,
  atualizarValorParcelaMacho,
} from "./actions";
import EditarGenealogyForm from "@/components/EditarGenealogyForm";
import AnimalFotoUpload from "@/components/AnimalFotoUpload";
import AnimalDocumentosUpload from "@/components/AnimalDocumentosUpload";

// ── Tabela ABCZ de circunferência escrotal mínima por idade ──────────────────
const CE_TABLE = [
  { label: "Até 15 meses",  mesesMax: 15, minCm: 26 },
  { label: "16–18 meses",   mesesMax: 18, minCm: 28 },
  { label: "19–21 meses",   mesesMax: 21, minCm: 30 },
  { label: "22–24 meses",   mesesMax: 24, minCm: 32 },
  { label: "Acima de 24m",  mesesMax: Infinity, minCm: 34 },
];

function ceMinimoPorMeses(meses: number): number {
  for (const row of CE_TABLE) {
    if (meses <= row.mesesMax) return row.minCm;
  }
  return 34;
}

/** Calcula meses inteiros entre duas datas */
function mesesEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

/** Dias entre duas datas */
function diasEntre(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a), db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// ─── Grupos ABCZ — Regulamento ExpZebu 2025/2026 (Art. 29°) ─────────────────
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

function categoriaPista(nascimento: string | null, sexo: "F" | "M"): string | null {
  const hoje = new Date().toISOString().split("T")[0];
  const meses = mesesEntre(nascimento, hoje);
  if (meses == null) return null;
  return GRUPOS_ABCZ.find(g => g.sexo === sexo && meses >= g.min && meses < g.max)?.nome ?? null;
}

/** Ponderal (g/dia) = peso_kg × 1000 / dias_de_vida */
function calcPonderal(pesoKg: number, nascimento: string | null, dataPesagem: string): number | null {
  const dias = diasEntre(nascimento, dataPesagem);
  if (!dias || dias <= 0) return null;
  return (pesoKg * 1000) / dias;
}

/** Label de classificação de ponderal por faixa etária */
function classificarPonderal(gdia: number, meses: number): { label: string; cls: string } {
  // Referências Nelore ABCZ — GMD acumulado aproximado
  if (meses <= 8) {
    // Período pré-desmame: bom = ≥ 900 g/dia
    if (gdia >= 900) return { label: "Excelente", cls: "text-green-600" };
    if (gdia >= 700) return { label: "Bom",       cls: "text-blue-600"  };
    return              { label: "Abaixo",         cls: "text-orange-500"};
  }
  if (meses <= 18) {
    // Pós-desmame: bom = ≥ 600 g/dia acumulado
    if (gdia >= 700) return { label: "Excelente", cls: "text-green-600" };
    if (gdia >= 550) return { label: "Bom",       cls: "text-blue-600"  };
    return              { label: "Abaixo",         cls: "text-orange-500"};
  }
  // Adulto
  if (gdia >= 600) return { label: "Excelente", cls: "text-green-600" };
  if (gdia >= 450) return { label: "Bom",       cls: "text-blue-600"  };
  return              { label: "Abaixo",         cls: "text-orange-500"};
}

// ── Genealogia ──────────────────────────────────────────────────────────────
function PedCell({
  label, name, sub, highlight, linhagem,
}: {
  label: string; name?: string | null; sub?: string | null; highlight?: boolean; linhagem?: "pai" | "mae";
}) {
  const base = "flex flex-col justify-center px-2.5 py-2 rounded-lg border text-xs h-full overflow-hidden";

  let style: string;
  if (highlight)               style = "bg-indigo-50 border-indigo-300";
  else if (linhagem === "pai") style = name ? "bg-blue-50 border-blue-200"  : "bg-white border-dashed border-blue-100";
  else if (linhagem === "mae") style = name ? "bg-rose-50 border-rose-200"  : "bg-white border-dashed border-rose-100";
  else                         style = name ? "bg-gray-50 border-gray-200"  : "bg-white border-dashed border-gray-200";

  const labelColor = highlight         ? "text-indigo-500"
    : linhagem === "pai"               ? "text-blue-400"
    : linhagem === "mae"               ? "text-rose-400"
    : "text-gray-400";

  const nameColor = highlight          ? "text-indigo-900"
    : linhagem === "pai"               ? "text-blue-900"
    : linhagem === "mae"               ? "text-rose-900"
    : name                             ? "text-gray-800"
    : "text-gray-300";

  return (
    <div className={`${base} ${style}`}>
      <p className={`text-[9px] uppercase tracking-wide mb-0.5 leading-none ${labelColor}`}>{label}</p>
      <p className={`font-semibold leading-tight truncate ${nameColor}`}>
        {name ?? "—"}
      </p>
      {sub && <p className="text-[9px] text-gray-400 leading-none mt-0.5 font-mono truncate">{sub}</p>}
    </div>
  );
}

function Genealogia({ animal }: { animal: any }) {
  const hasAny =
    animal.pai_nome || animal.mae_nome ||
    animal.avo_paterno || animal.avo_paterna ||
    animal.avo_materno || animal.avo_materna ||
    animal.bisavo_pat_pat || animal.bisava_pat_pat ||
    animal.bisavo_pat_mat || animal.bisava_pat_mat ||
    animal.bisavo_materno || animal.bisava_mat_pat ||
    animal.bisavo_materna || animal.bisavo;
  if (!hasAny) return <p className="text-sm text-gray-400 italic">Genealogia não cadastrada.</p>;

  // Layout: 4 colunas × 8 linhas
  const ROW_H = 46, ROWS = 8, GAP = 3;

  return (
    <div className="overflow-x-auto">
      {/* Cabeçalhos das colunas */}
      <div
        className="min-w-[580px] mb-1"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: `${GAP}px` }}
      >
        <div />
        {(["Pais", "Avós", "Bisavós"] as const).map((col) => (
          <div key={col} className="text-center">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">{col}</span>
          </div>
        ))}
      </div>

      <div className="min-w-[580px]" style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows: `repeat(${ROWS}, ${ROW_H}px)`,
        gap: `${GAP}px`,
      }}>
        {/* Col 1 — Animal */}
        <div style={{ gridColumn: "1", gridRow: `1 / span ${ROWS}` }}>
          <PedCell label="Animal" name={animal.nome} sub={animal.rgd ?? animal.rgn} highlight />
        </div>

        {/* Col 2 — Pai / Mãe */}
        <div style={{ gridColumn: "2", gridRow: "1 / span 4" }}>
          <PedCell label="Pai" name={animal.pai_nome} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "2", gridRow: "5 / span 4" }}>
          <PedCell label="Mãe" name={animal.mae_nome} linhagem="mae" />
        </div>

        {/* Col 3 — Avós */}
        <div style={{ gridColumn: "3", gridRow: "1 / span 2" }}>
          <PedCell label="Avô Paterno" name={animal.avo_paterno} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "3", gridRow: "3 / span 2" }}>
          <PedCell label="Avó Paterna" name={animal.avo_paterna} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "3", gridRow: "5 / span 2" }}>
          <PedCell label="Avô Materno" name={animal.avo_materno} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "3", gridRow: "7 / span 2" }}>
          <PedCell label="Avó Materna" name={animal.avo_materna} linhagem="mae" />
        </div>

        {/* Col 4 — Bisavós (1 linha cada) */}
        <div style={{ gridColumn: "4", gridRow: "1" }}>
          <PedCell label="Bisavô" name={animal.bisavo_pat_pat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "2" }}>
          <PedCell label="Bisavó" name={animal.bisava_pat_pat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "3" }}>
          <PedCell label="Bisavô" name={animal.bisavo_pat_mat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "4" }}>
          <PedCell label="Bisavó" name={animal.bisava_pat_mat} linhagem="pai" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "5" }}>
          <PedCell label="Bisavô" name={animal.bisavo_materno} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "6" }}>
          <PedCell label="Bisavó" name={animal.bisava_mat_pat} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "7" }}>
          <PedCell label="Bisavô" name={animal.bisavo_materna} linhagem="mae" />
        </div>
        <div style={{ gridColumn: "4", gridRow: "8" }}>
          <PedCell label="Bisavó" name={animal.bisavo} linhagem="mae" />
        </div>
      </div>
    </div>
  );
}

export const revalidate = 0;

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function MachoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Animal
  const { data: macho } = await supabase
    .from("animals")
    .select("*")
    .eq("id", id)
    .single();

  // Info de leilão do animal
  const { data: leilaoInfo } = await supabase
    .from("animal_leilao_info")
    .select("*")
    .eq("animal_id", id)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  // Prenhez de origem — se este macho nasceu de prenhez comprada
  const { data: prenhez } = await supabase
    .from("aspirations")
    .select("observacoes")
    .eq("animal_nascido_id", id)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  function parseObsKey(obs: string | null | undefined, key: string): string | null {
    if (!obs) return null;
    const m = obs.match(new RegExp(`${key}:([^|]+)`));
    return m ? m[1].trim() : null;
  }
  const parcelaCompra     = prenhez ? parseFloat(parseObsKey(prenhez.observacoes, "PARCELA")     ?? "0") || 0 : 0;
  const numParcelasCompra = prenhez ? parseInt(  parseObsKey(prenhez.observacoes, "NUM_PARCELAS") ?? "0") || 0 : 0;
  const leilaoCompra      = prenhez ? parseObsKey(prenhez.observacoes, "LEILAO") : null;

  // Histórico de pesagens (mais recente primeiro)
  const { data: pesagens } = await supabase
    .from("weight_records")
    .select("id, data, peso_kg")
    .eq("animal_id", id)
    .order("data", { ascending: false });

  // Premiações
  const { data: premiacoes } = await supabase
    .from("awards")
    .select(`
      id, tipo_premio, grupo_nelore, observacoes,
      exhibition:exhibitions ( id, nome, data_base, local )
    `)
    .eq("animal_id", id)
    .order("criado_em", { ascending: false });

  // Exposições para o select de nova premiação
  const { data: exposicoes } = await supabase
    .from("exhibitions")
    .select("id, nome, data_base")
    .eq("farm_id", FARM_ID)
    .order("data_base", { ascending: false });

  if (!macho) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Animal não encontrado.</p>
        <Link href="/machos" className="text-brand-600 text-sm mt-2 inline-block">← Voltar</Link>
      </div>
    );
  }

  const mesesHoje = mesesEntre(macho.nascimento, new Date().toISOString().split("T")[0]);
  const ceMin     = mesesHoje != null ? ceMinimoPorMeses(mesesHoje) : null;
  const ceAtual   = macho.circunferencia_escrotal ?? null;
  const ceOk      = ceAtual != null && ceMin != null ? ceAtual >= ceMin : null;

  // Status do RGD
  const temRGD         = !!macho.rgd;
  const examApto       = macho.exame_andrologico === "APTO";
  const registroLabel  = temRGD ? macho.rgd : (macho.rgn ?? "—");
  const registroTipo   = temRGD ? "RGD" : "RGN";

  return (
    <div className="p-6 space-y-6">
      {/* Voltar */}
      <Link href="/machos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Voltar para Machos
      </Link>

      {/* ── Cabeçalho ──────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-start gap-6 flex-wrap">
          {/* Foto do animal */}
          <div className="shrink-0">
            <AnimalFotoUpload
              animalId={macho.id}
              fotoAtual={(macho as any).photo_url ?? null}
              nomeAnimal={macho.nome}
            />
          </div>

          <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{macho.nome}</h1>
            {/* RGN com edição inline (só quando ainda não tem RGD) */}
            {!temRGD && (
              <details className="group mt-0.5">
                <summary className="list-none flex items-center gap-1.5 cursor-pointer w-fit">
                  <span className="text-sm text-gray-500 font-mono">
                    {macho.rgn ? `RGN: ${macho.rgn}` : <span className="text-gray-300 italic text-xs">RGN não informado</span>}
                  </span>
                  <Edit2 className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                </summary>
                <form action={atualizarRgn} className="mt-1.5 flex items-center gap-2">
                  <input type="hidden" name="id" value={macho.id} />
                  <input name="rgn" type="text" defaultValue={macho.rgn ?? ""}
                    placeholder="Número do RGN…"
                    className="w-36 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  <button type="submit"
                    className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1 rounded-lg transition-colors">
                    Salvar
                  </button>
                </form>
              </details>
            )}
            {temRGD && (
              <span className="text-sm text-gray-500 font-mono mt-0.5 block">RGD: {macho.rgd}</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="badge bg-blue-100 text-blue-700 text-sm px-3 py-1 font-semibold">TOURO</span>
            {/* RGD/RGN badge */}
            <span className={`badge text-sm px-3 py-1 font-semibold ${
              temRGD
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {temRGD ? "✓ RGD" : "RGN (provisório)"}
            </span>
            {/* Exame badge */}
            {macho.exame_andrologico === "APTO"   && <span className="badge bg-green-100 text-green-700 text-sm px-3 py-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Apto</span>}
            {macho.exame_andrologico === "INAPTO" && <span className="badge bg-red-100 text-red-600 text-sm px-3 py-1 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Inapto</span>}
            {!macho.exame_andrologico             && <span className="badge bg-gray-100 text-gray-400 text-sm px-3 py-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Sem exame</span>}
            {macho.localizacao && (
              <span className="badge bg-gray-100 text-gray-600 text-sm px-3 py-1">{macho.localizacao}</span>
            )}
            {/* Toggle Nascido SE Agro */}
            <form action={toggleNascidoSeAgroMacho}>
              <input type="hidden" name="id" value={macho.id} />
              <input type="hidden" name="nascido_se_agro" value={(macho as any).nascido_se_agro ? "false" : "true"} />
              <button type="submit"
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
                  (macho as any).nascido_se_agro
                    ? "bg-brand-600 text-white border-brand-600 hover:bg-brand-700"
                    : "bg-white text-gray-500 border-gray-200 hover:border-brand-400 hover:text-brand-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-se.png" alt="" className="h-4 w-auto" style={{ filter: (macho as any).nascido_se_agro ? "brightness(0) invert(1)" : "brightness(0)" }} />
                {(macho as any).nascido_se_agro ? "Nascido SE Agro" : "Marcar como SE Agro"}
              </button>
            </form>

            {/* Toggle Para Pista */}
            <div className="flex flex-col gap-0.5">
              <form action={toggleParaPistaMacho}>
                <input type="hidden" name="id" value={macho.id} />
                <input type="hidden" name="para_pista" value={(macho as any).para_pista ? "false" : "true"} />
                <button type="submit"
                  className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
                    (macho as any).para_pista
                      ? "bg-yellow-400 text-yellow-900 border-yellow-400 hover:bg-yellow-300"
                      : "bg-white text-gray-500 border-gray-200 hover:border-yellow-400 hover:text-yellow-600"
                  }`}
                  title={(macho as any).para_pista ? "Remover da Pista" : "Marcar para Pista"}
                >
                  <Star className={`w-3.5 h-3.5 ${(macho as any).para_pista ? "fill-yellow-700" : ""}`} />
                  {(macho as any).para_pista ? "Selecionado para Pista" : "Marcar para Pista"}
                </button>
              </form>
              {(macho as any).para_pista && (() => {
                const cat = categoriaPista(macho.nascimento ?? null, "M");
                return cat ? (
                  <p className="text-[10px] text-gray-400 pl-1">
                    Categoria ABCZ: <span className="font-medium text-gray-500">{cat}</span>
                  </p>
                ) : null;
              })()}
            </div>

            {/* Toggle Para Leilão */}
            <form action={toggleParaLeilaoMacho}>
              <input type="hidden" name="id" value={macho.id} />
              <input type="hidden" name="para_leilao" value={(macho as any).para_leilao ? "false" : "true"} />
              <button type="submit"
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
                  (macho as any).para_leilao
                    ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                    : "bg-white text-gray-500 border-gray-200 hover:border-amber-400 hover:text-amber-600"
                }`}
              >
                <Gavel className="w-3.5 h-3.5" />
                {(macho as any).para_leilao ? "Para Leilão" : "Preparar para Leilão"}
              </button>
            </form>
          </div>
        </div>

        {/* Info básica */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Nascimento</p>
            <p className="font-medium text-gray-900">{formatDate(macho.nascimento)}</p>
            {mesesHoje != null && (
              <p className="text-xs text-gray-400 mt-0.5">{mesesHoje} meses</p>
            )}
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Pai</p>
            <p className="font-medium text-gray-900">{macho.pai_nome ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Mãe</p>
            <p className="font-medium text-gray-900">{macho.mae_nome ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">% Próprio</p>
            <p className="font-medium text-gray-900">
              {macho.percentual_proprio != null
                ? `${(macho.percentual_proprio * 100).toFixed(0)}%`
                : "—"}
            </p>
          </div>

          {/* Peso atual */}
          <div className="col-span-2 md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Peso Atual (kg)</p>
            <form action={atualizarPesoMacho} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={macho.id} />
              <input
                name="peso_atual" type="number" step="0.1" min="0"
                defaultValue={(macho as any).peso_atual ?? ""}
                placeholder="Ex: 580.0"
                className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="shrink-0 text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                <Scale className="w-3.5 h-3.5 inline mr-1" />Salvar
              </button>
            </form>
          </div>

          {/* Localização */}
          <div className="col-span-2 md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Localização</p>
            <form action={atualizarLocalizacaoMacho} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={macho.id} />
              <input
                name="localizacao" type="text"
                defaultValue={macho.localizacao ?? ""}
                placeholder="Ex: Pasto 1, Curral B…"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="shrink-0 text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                Salvar
              </button>
            </form>
          </div>

          {/* RGD */}
          <div className="col-span-2 md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">RGD (Definitivo)</p>
            <form action={atualizarRGD} className="flex items-center gap-2">
              <input type="hidden" name="id" value={macho.id} />
              <input
                name="rgd" type="text"
                defaultValue={macho.rgd ?? ""}
                placeholder="Número do RGD ABCZ…"
                className="w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                Salvar
              </button>
            </form>
          </div>
        </div>
          </div>{/* fim flex-1 */}
        </div>{/* fim flex gap-6 */}
      </div>

      {/* ── Reprodução: Exame Andrológico + CE ─────────────── */}
      <div className="card p-6 space-y-6">
        <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2">
          🧪 Aspectos Reprodutivos (RGN → RGD)
        </h2>

        {/* ── Painel de elegibilidade para Pista ── */}
        {(macho as any).para_pista && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-900">
            <p className="font-semibold flex items-center gap-1.5 mb-2">
              <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" /> Selecionado para Pista — critérios Nelore (ABCZ)
            </p>
            <ul className="space-y-1 text-xs text-yellow-800">
              <li className={`flex items-center gap-1.5 ${temRGD ? "text-green-700" : "text-red-600"}`}>
                {temRGD ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                RGD emitido {temRGD ? `(${macho.rgd})` : "— obrigatório para exposição"}
              </li>
              <li className={`flex items-center gap-1.5 ${examApto ? "text-green-700" : "text-red-600"}`}>
                {examApto ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                Exame andrológico APTO {!examApto && "— pendente ou inapto"}
              </li>
              <li className={`flex items-center gap-1.5 ${ceOk === true ? "text-green-700" : ceOk === false ? "text-red-600" : "text-gray-500"}`}>
                {ceOk === true
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : ceOk === false ? <XCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                CE {ceAtual != null ? `${ceAtual} cm` : "não informada"}
                {ceMin != null && ` (mín. ${ceMin} cm para ${mesesHoje}m)`}
              </li>
              <li className="flex items-center gap-1.5 text-yellow-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                Categorias de idade: Jovem (até 36m) · Adulto (acima de 36m) — verifique o regulamento do evento
              </li>
            </ul>
          </div>
        )}

        {/* Alert se não tem exame ou está inapto */}
        {!macho.exame_andrologico && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <span>Exame andrológico ainda não realizado. Necessário para emissão do RGD.</span>
          </div>
        )}
        {macho.exame_andrologico === "INAPTO" && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
            <span>Touro <strong>INAPTO</strong> — não apto para emissão de RGD. Verificar com veterinário.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Painel esquerdo: Exame Andrológico */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">
              Exame Andrológico
            </h3>

            {/* Status atual */}
            {macho.exame_andrologico && (
              <div className={`rounded-lg p-3 flex items-center gap-3 ${
                examApto ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"
              }`}>
                {examApto
                  ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  : <XCircle    className="w-5 h-5 text-red-500 shrink-0" />}
                <div className="text-sm">
                  <p className={`font-semibold ${examApto ? "text-green-700" : "text-red-600"}`}>
                    {macho.exame_andrologico}
                  </p>
                  {macho.data_exame_andrologico && (
                    <p className="text-xs text-gray-500">Em {formatDate(macho.data_exame_andrologico)}</p>
                  )}
                  {macho.veterinario_andrologico && (
                    <p className="text-xs text-gray-500">MV: {macho.veterinario_andrologico}</p>
                  )}
                  {macho.laudo_andrologico && (
                    <p className="text-xs text-gray-400 font-mono">Laudo: {macho.laudo_andrologico}</p>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            <form action={atualizarExameAndrologico} className="space-y-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {macho.exame_andrologico ? "Atualizar exame" : "Registrar exame"}
              </p>
              <input type="hidden" name="id" value={macho.id} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Resultado *</label>
                  <select name="exame_andrologico" required
                    defaultValue={macho.exame_andrologico ?? ""}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
                    <option value="">Selecione…</option>
                    <option value="APTO">APTO</option>
                    <option value="INAPTO">INAPTO</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data do Exame</label>
                  <input name="data_exame_andrologico" type="date"
                    defaultValue={macho.data_exame_andrologico ?? ""}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Médico Veterinário</label>
                  <input name="veterinario_andrologico" type="text"
                    defaultValue={macho.veterinario_andrologico ?? ""}
                    placeholder="Dr. Nome CRMV…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nº do Laudo</label>
                  <input name="laudo_andrologico" type="text"
                    defaultValue={macho.laudo_andrologico ?? ""}
                    placeholder="Código do laudo…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
              </div>

              <button type="submit"
                className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Salvar Exame
              </button>
            </form>
          </div>

          {/* Painel direito: Circunferência Escrotal */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">
              Circunferência Escrotal (CE)
            </h3>

            {/* CE atual */}
            {ceAtual != null && (
              <div className={`rounded-lg p-3 ${ceOk ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
                <div className="flex items-center gap-3">
                  <p className={`text-2xl font-bold ${ceOk ? "text-green-700" : "text-red-600"}`}>
                    {ceAtual} cm
                  </p>
                  <div className="text-xs">
                    {ceMin != null && (
                      <p className={`font-medium ${ceOk ? "text-green-600" : "text-red-500"}`}>
                        {ceOk ? `✓ Acima do mínimo (${ceMin} cm)` : `✗ Abaixo do mínimo (${ceMin} cm)`}
                      </p>
                    )}
                    {macho.data_ce && (
                      <p className="text-gray-500 mt-0.5">Medido em {formatDate(macho.data_ce)}</p>
                    )}
                    {mesesHoje != null && (
                      <p className="text-gray-400">Idade na última medição: {mesesHoje} meses</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Form CE */}
            <form action={atualizarCE} className="flex flex-wrap items-end gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4">
              <input type="hidden" name="id" value={macho.id} />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CE (cm) *</label>
                <input name="circunferencia_escrotal" type="number" step="0.1" min="0"
                  defaultValue={ceAtual ?? ""}
                  placeholder="Ex: 30.5"
                  required
                  className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Data da Medição</label>
                <input name="data_ce" type="date"
                  defaultValue={macho.data_ce ?? ""}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <button type="submit"
                className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
                <Scale className="w-3.5 h-3.5" /> Salvar CE
              </button>
            </form>

            {/* Tabela de referência ABCZ */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Tabela ABCZ — Mínimos de CE por Idade
              </p>
              <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Faixa etária</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">CE mínimo</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-500">Status atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {CE_TABLE.map((row, i) => {
                    const isCurrentAge = mesesHoje != null && (
                      i === 0
                        ? mesesHoje <= 15
                        : mesesHoje > CE_TABLE[i - 1].mesesMax && mesesHoje <= row.mesesMax
                    );
                    const rowOk = ceAtual != null ? ceAtual >= row.minCm : null;
                    return (
                      <tr key={i} className={`${isCurrentAge ? "bg-blue-50" : "bg-white"}`}>
                        <td className={`px-3 py-1.5 ${isCurrentAge ? "font-semibold text-blue-700" : "text-gray-600"}`}>
                          {row.label} {isCurrentAge && "← atual"}
                        </td>
                        <td className="px-3 py-1.5 text-center font-semibold text-gray-700">{row.minCm} cm</td>
                        <td className="px-3 py-1.5 text-center">
                          {isCurrentAge && ceAtual != null ? (
                            rowOk
                              ? <span className="text-green-600 font-semibold">✓</span>
                              : <span className="text-red-500 font-semibold">✗</span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Genealogia ────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Genealogia</h2>
          <Genealogia animal={macho} />
        </div>
        <EditarGenealogyForm
          animalId={macho.id}
          action={atualizarGenealogiaTouro}
          pai_nome={macho.pai_nome}
          mae_nome={macho.mae_nome}
          avo_paterno={macho.avo_paterno}
          avo_paterna={macho.avo_paterna}
          avo_materno={macho.avo_materno}
          avo_materna={macho.avo_materna}
          bisavo_pat_pat={macho.bisavo_pat_pat}
          bisava_pat_pat={macho.bisava_pat_pat}
          bisavo_pat_mat={macho.bisavo_pat_mat}
          bisava_pat_mat={macho.bisava_pat_mat}
          bisavo_materno={macho.bisavo_materno}
          bisava_mat_pat={macho.bisava_mat_pat}
          bisavo_materna={macho.bisavo_materna}
          bisavo={macho.bisavo}
        />
      </div>

      {/* ── Card Leilão ─────────────────────────────────────────────────── */}
      {(macho as any).para_leilao && (
        <section className="card overflow-hidden border-amber-200">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <Gavel className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-amber-900">Animal Para Leilão</h2>
          </div>

          <form action={salvarInfoLeilaoMacho} className="px-5 py-5 space-y-6">
            <input type="hidden" name="animal_id" value={macho.id} />

            {/* Convite */}
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">Convite</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nome do Leilão</label>
                  <input name="convite_nome" type="text"
                    defaultValue={leilaoInfo?.convite_nome ?? ""}
                    placeholder="Ex: ExpoPecuária Elite 2026"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data</label>
                  <input name="convite_data" type="date"
                    defaultValue={leilaoInfo?.convite_data ?? ""}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs text-gray-500 mb-1 block">Promotor(es)</label>
                  <input name="convite_promotores" type="text"
                    defaultValue={leilaoInfo?.convite_promotores ?? ""}
                    placeholder="Ex: SE Agropecuária, Gran Nelore"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
            </div>

            {/* Leilão de compra */}
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">Leilão onde Comprou</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nome do Leilão</label>
                  <input name="compra_leilao_nome" type="text"
                    defaultValue={leilaoInfo?.compra_leilao_nome ?? ""}
                    placeholder="Ex: Leilão Gran Nelore 2025"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data</label>
                  <input name="compra_leilao_data" type="date"
                    defaultValue={leilaoInfo?.compra_leilao_data ?? ""}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Parcela (R$)</label>
                  <input name="compra_valor_parcela" type="number" step="0.01" min="0"
                    defaultValue={leilaoInfo?.compra_valor_parcela ?? ""}
                    placeholder="Ex: 600.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div className="flex items-end pb-2">
                  {leilaoInfo?.compra_valor_parcela != null ? (
                    <p className="text-sm text-gray-700">
                      Total: <span className="font-bold text-gray-900">
                        {formatCurrency(leilaoInfo.compra_valor_parcela * 30)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">(× 30)</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Total = parcela × 30</p>
                  )}
                </div>
              </div>
            </div>

            {/* Meta de valor */}
            <div>
              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">Meta de Valor</p>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Parcela Alvo (R$)</label>
                  <input name="meta_valor_parcela" type="number" step="0.01" min="0"
                    defaultValue={leilaoInfo?.meta_valor_parcela ?? ""}
                    placeholder="Ex: 1500.00"
                    className="w-44 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div className="pb-2">
                  {leilaoInfo?.meta_valor_parcela != null ? (
                    <p className="text-sm text-gray-700">
                      Meta Total: <span className="font-bold text-green-700 text-base">
                        {formatCurrency(leilaoInfo.meta_valor_parcela * 30)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">(× 30)</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Total = parcela × 30</p>
                  )}
                </div>
              </div>
            </div>

            <button type="submit"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              <Gavel className="w-4 h-4" /> Salvar Informações de Leilão
            </button>
          </form>
        </section>
      )}

      {/* ── Parcela mensal do macho ──────────────────────────── */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
          <ShoppingCart className="w-4 h-4 text-gray-500" />
          Desempenho Financeiro
        </h2>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <details className="group">
              <summary className="list-none cursor-pointer flex items-center gap-1.5">
                <span className={`text-2xl font-bold ${(macho.valor_parcela ?? 0) > 0 ? "text-red-500" : "text-gray-300"}`}>
                  {(macho.valor_parcela ?? 0) > 0 ? formatCurrency(macho.valor_parcela!) : "—"}
                </span>
                <Edit2 className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </summary>
              <form action={atualizarValorParcelaMacho} className="mt-2 flex items-center gap-2">
                <input type="hidden" name="id" value={macho.id} />
                <input
                  name="valor_parcela"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={(macho.valor_parcela ?? 0) > 0 ? macho.valor_parcela! : ""}
                  placeholder="0,00"
                  className="w-28 border border-brand-400 bg-white rounded px-2 py-1 text-sm outline-none ring-1 ring-brand-200"
                />
                <button type="submit"
                  className="text-xs bg-brand-600 text-white px-2 py-1 rounded hover:bg-brand-700 transition-colors">
                  OK
                </button>
              </form>
            </details>
            <p className="text-xs text-gray-400 mt-0.5">Parcela mensal</p>
            {(macho.valor_parcela ?? 0) > 0 && (
              <p className="text-xs text-red-300">×30 = {formatCurrency((macho.valor_parcela ?? 0) * 30)}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Custo de aquisição (nascido de prenhez comprada) ── */}
      {parcelaCompra > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <ShoppingCart className="w-4 h-4 text-orange-500" />
            Custo de Aquisição
          </h2>
          <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-orange-700">
                Prenhez comprada{leilaoCompra ? <span className="font-normal text-orange-500"> — {leilaoCompra}</span> : ""}
              </span>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-bold text-orange-600">{formatCurrency(parcelaCompra)}/parcela</span>
                {numParcelasCompra > 0 && (
                  <span className="text-orange-400 text-xs">
                    × {numParcelasCompra} = <span className="font-semibold text-orange-600">{formatCurrency(parcelaCompra * numParcelasCompra)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Histórico de Pesagens com Ponderal ──────────────── */}
      <div className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <Scale className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Histórico de Pesagens & Ponderal</h2>
            <span className="badge bg-brand-100 text-brand-700 ml-auto">{pesagens?.length ?? 0} registros</span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>

          {/* Form nova pesagem */}
          <form action={registrarPesagemMacho} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <input type="hidden" name="animal_id" value={macho.id} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar pesagem</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Data *</label>
                <input name="data" type="date" required
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Peso (kg) *</label>
                <input name="peso_kg" type="number" step="0.1" min="0" required placeholder="Ex: 580.0"
                  className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <button type="submit"
                className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
                <Plus className="w-4 h-4" /> Registrar
              </button>
            </div>
          </form>

          {/* Nota explicativa */}
          <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
            <strong>Ponderal (g/dia)</strong> = peso total (g) ÷ dias de vida na data da pesagem —
            mede o crescimento acumulado desde o nascimento.
          </div>

          {!pesagens?.length ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma pesagem registrada ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Data</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Peso (kg)</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Idade</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Ponderal (g/dia)</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pesagens.map((p: any, i: number) => {
                  const prox      = pesagens[i + 1];
                  const variacao  = prox ? p.peso_kg - prox.peso_kg : null;
                  const mesesP    = mesesEntre(macho.nascimento, p.data);
                  const ponderal  = calcPonderal(p.peso_kg, macho.nascimento, p.data);
                  const classPond = ponderal != null && mesesP != null
                    ? classificarPonderal(ponderal, mesesP)
                    : null;

                  // Label de idade na pesagem
                  const idadeLabel = mesesP != null ? `${mesesP}m` : "—";

                  return (
                    <tr key={p.id} className="table-row-hover">
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{formatDate(p.data)}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{p.peso_kg.toLocaleString("pt-BR")} kg</td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">
                          {idadeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {ponderal != null ? (
                          <span className={`font-semibold ${classPond?.cls ?? "text-gray-700"}`}>
                            {ponderal.toFixed(0)} g/dia
                            {classPond && (
                              <span className="ml-1.5 font-normal text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">
                                {classPond.label}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {variacao == null ? (
                          <span className="text-gray-300">—</span>
                        ) : variacao > 0 ? (
                          <span className="text-green-600 font-medium">+{variacao.toFixed(1)} kg ↑</span>
                        ) : variacao < 0 ? (
                          <span className="text-red-500 font-medium">{variacao.toFixed(1)} kg ↓</span>
                        ) : (
                          <span className="text-gray-400">= sem variação</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </details>
      </div>

      {/* ── Documentos ──────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <span className="text-base">📄</span>
            <h2 className="font-semibold text-gray-900">Documentos</h2>
            <span className="badge bg-gray-100 text-gray-600 ml-auto">
              {((macho as any).documents ?? []).length} arquivo{((macho as any).documents ?? []).length !== 1 ? "s" : ""}
            </span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>
          <div className="px-5 py-5">
            <p className="text-xs text-gray-400 mb-4">RGN, teste de DNA e outros documentos oficiais do animal.</p>
            <AnimalDocumentosUpload
              animalId={macho.id}
              documentos={(macho as any).documents ?? []}
            />
          </div>
        </details>
      </div>

      {/* ── Premiações ──────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <details>
          <summary className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 cursor-pointer list-none">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Premiações</h2>
            <span className="badge bg-yellow-100 text-yellow-700 ml-auto">{premiacoes?.length ?? 0} prêmios</span>
            <span className="text-gray-400 text-xs ml-2">▼</span>
          </summary>

          <form action={adicionarPremiacaoMacho} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
            <input type="hidden" name="animal_id" value={macho.id} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar prêmio</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo de Prêmio *</label>
                <select name="tipo_premio" required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  <option value="">Selecione…</option>
                  <option value="GRANDE_CAMPEAO">Grande Campeão</option>
                  <option value="RESERVADO_GRANDE_CAMPEAO">Reservado Grande Campeão</option>
                  <option value="CAMPEAO">Campeão</option>
                  <option value="RESERVADO_CAMPEAO">Reservado Campeão</option>
                  <option value="3_LUGAR_CAMPEONATO">3° Lugar no Campeonato</option>
                  <option value="1_LUGAR">1° Lugar na Categoria</option>
                  <option value="2_LUGAR">2° Lugar na Categoria</option>
                  <option value="3_LUGAR">3° Lugar na Categoria</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Grupo Nelore</label>
                <input name="grupo_nelore" type="text" placeholder="Ex: Grupo A"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Exposição</label>
                <select name="exhibition_id"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  <option value="">Selecione…</option>
                  {(exposicoes ?? []).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.nome}{e.data_base ? ` (${formatDate(e.data_base)})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Obs.</label>
                <input name="observacoes" type="text" placeholder="Observações…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
            <button type="submit"
              className="mt-3 inline-flex items-center gap-1.5 bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Registrar Prêmio
            </button>
          </form>

          {!premiacoes?.length ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhum prêmio registrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Prêmio</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Grupo</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Exposição</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-xs">Obs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {premiacoes.map((pr: any) => (
                  <tr key={pr.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      {(() => {
                        const LABELS: Record<string, string> = {
                          GRANDE_CAMPEAO:           "Grande Campeão",
                          RESERVADO_GRANDE_CAMPEAO: "Reservado Grande Campeão",
                          CAMPEAO:                  "Campeão",
                          RESERVADO_CAMPEAO:        "Reservado Campeão",
                          "3_LUGAR_CAMPEONATO":     "3° Lugar no Campeonato",
                          "1_LUGAR":                "1° Lugar na Categoria",
                          "2_LUGAR":                "2° Lugar na Categoria",
                          "3_LUGAR":                "3° Lugar na Categoria",
                          MELHOR_DO_EVENTO:         "Melhor do Evento",
                        };
                        const label = LABELS[pr.tipo_premio] ?? pr.tipo_premio?.replace(/_/g, " ");
                        const isDestaque = pr.tipo_premio?.includes("CAMPEAO") || pr.tipo_premio?.includes("GRAND");
                        return isDestaque
                          ? <span className="badge bg-yellow-100 text-yellow-700 font-semibold text-xs">🏆 {label}</span>
                          : <span className="badge bg-gray-100 text-gray-600 font-semibold text-xs">{label}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{pr.grupo_nelore ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {pr.exhibition ? `${pr.exhibition.nome} ${pr.exhibition.data_base ? `(${formatDate(pr.exhibition.data_base)})` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{pr.observacoes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      </div>
    </div>
  );
}
