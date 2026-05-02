import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import Link from "next/link";
import {
  ArrowLeft, Scale, Plus, Trophy, CheckCircle, XCircle, Clock,
  AlertTriangle, Star,
} from "lucide-react";
import {
  toggleParaPistaMacho,
  atualizarExameAndrologico,
  atualizarCE,
  atualizarRGD,
  atualizarLocalizacaoMacho,
  atualizarPesoMacho,
  registrarPesagemMacho,
  adicionarPremiacaoMacho,
} from "./actions";

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
  label, name, sub, highlight,
}: {
  label: string; name?: string | null; sub?: string | null; highlight?: boolean;
}) {
  const base  = "flex flex-col justify-center px-2.5 py-2 rounded-lg border text-xs h-full overflow-hidden";
  const style = highlight
    ? "bg-blue-50 border-blue-200"
    : name ? "bg-gray-50 border-gray-200" : "bg-white border-dashed border-gray-200";
  return (
    <div className={`${base} ${style}`}>
      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-0.5 leading-none">{label}</p>
      <p className={`font-semibold leading-tight truncate ${highlight ? "text-blue-800" : name ? "text-gray-800" : "text-gray-300"}`}>
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
  // Col 1: Animal (linhas 1–8)
  // Col 2: Pai (1–4) / Mãe (5–8)
  // Col 3: Avô Pat. (1–2) / Avó Pat. (3–4) / Avô Mat. (5–6) / Avó Mat. (7–8)
  // Col 4: 8 bisavós (1 linha cada)
  const ROW_H = 40, ROWS = 8, GAP = 3;
  return (
    <div className="overflow-x-auto">
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
          <PedCell label="Pai" name={animal.pai_nome} />
        </div>
        <div style={{ gridColumn: "2", gridRow: "5 / span 4" }}>
          <PedCell label="Mãe" name={animal.mae_nome} />
        </div>

        {/* Col 3 — Avós */}
        <div style={{ gridColumn: "3", gridRow: "1 / span 2" }}>
          <PedCell label="Avô Paterno" name={animal.avo_paterno} />
        </div>
        <div style={{ gridColumn: "3", gridRow: "3 / span 2" }}>
          <PedCell label="Avó Paterna" name={animal.avo_paterna} />
        </div>
        <div style={{ gridColumn: "3", gridRow: "5 / span 2" }}>
          <PedCell label="Avô Materno" name={animal.avo_materno} />
        </div>
        <div style={{ gridColumn: "3", gridRow: "7 / span 2" }}>
          <PedCell label="Avó Materna" name={animal.avo_materna} />
        </div>

        {/* Col 4 — Bisavós (1 linha cada) */}
        <div style={{ gridColumn: "4", gridRow: "1" }}>
          <PedCell label="Pai do Avô Pat." name={animal.bisavo_pat_pat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "2" }}>
          <PedCell label="Mãe do Avô Pat." name={animal.bisava_pat_pat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "3" }}>
          <PedCell label="Pai da Avó Pat." name={animal.bisavo_pat_mat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "4" }}>
          <PedCell label="Mãe da Avó Pat." name={animal.bisava_pat_mat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "5" }}>
          <PedCell label="Pai do Avô Mat." name={animal.bisavo_materno} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "6" }}>
          <PedCell label="Mãe do Avô Mat." name={animal.bisava_mat_pat} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "7" }}>
          <PedCell label="Pai da Avó Mat." name={animal.bisavo_materna} />
        </div>
        <div style={{ gridColumn: "4", gridRow: "8" }}>
          <PedCell label="Mãe da Avó Mat." name={animal.bisavo} />
        </div>
      </div>
    </div>
  );
}

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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{macho.nome}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(macho.rgd || macho.rgn) && (
                <span className="text-sm text-gray-500 font-mono">
                  {registroTipo}: {registroLabel}
                </span>
              )}
            </div>
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
            {/* Toggle Para Pista */}
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
          <div className="md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Peso Atual (kg)</p>
            <form action={atualizarPesoMacho} className="flex items-center gap-2">
              <input type="hidden" name="id" value={macho.id} />
              <input
                name="peso_atual" type="number" step="0.1" min="0"
                defaultValue={(macho as any).peso_atual ?? ""}
                placeholder="Ex: 580.0"
                className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                <Scale className="w-3.5 h-3.5 inline mr-1" />Salvar
              </button>
            </form>
          </div>

          {/* Localização */}
          <div className="md:col-span-2">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Localização</p>
            <form action={atualizarLocalizacaoMacho} className="flex items-center gap-2">
              <input type="hidden" name="id" value={macho.id} />
              <input
                name="localizacao" type="text"
                defaultValue={macho.localizacao ?? ""}
                placeholder="Ex: Pasto 1, Curral B…"
                className="w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button type="submit"
                className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1.5 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
                Salvar
              </button>
            </form>
          </div>

          {/* RGD */}
          <div className="md:col-span-2">
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
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Genealogia</h2>
        <Genealogia animal={macho} />
      </div>

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
                  <option value="CAMPEAO">Campeão</option>
                  <option value="RESERVADO_CAMPEAO">Reservado Campeão</option>
                  <option value="1_LUGAR">1° Lugar</option>
                  <option value="2_LUGAR">2° Lugar</option>
                  <option value="3_LUGAR">3° Lugar</option>
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
                      <span className="badge bg-yellow-100 text-yellow-700 font-semibold text-xs">
                        {pr.tipo_premio?.replace(/_/g, " ")}
                      </span>
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
