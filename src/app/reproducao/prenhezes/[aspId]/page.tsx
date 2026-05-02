import { createClient } from "@/lib/supabase/server";
import { FARM_ID, formatDate, formatCurrency, diasParaParto } from "@/lib/utils";
import {
  ArrowLeft, Beef, CalendarDays, DollarSign,
  FlaskConical, Pencil, Tag, User,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { salvarFicha } from "./actions";
import DesfechoFichaForm from "./DesfechoFichaForm";
import ParcelaCalc from "./ParcelaCalc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseKey(obs: string | null | undefined, key: string): string | null {
  if (!obs) return null;
  const m = obs.match(new RegExp(`${key}:([^|]+)`));
  return m ? m[1].trim() : null;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default async function FichaPrenhez({ params }: { params: Promise<{ aspId: string }> }) {
  const { aspId } = await params;
  const supabase  = await createClient();

  // Busca aspiração com toda a cadeia de dados
  const { data: asp } = await supabase
    .from("aspirations")
    .select(`
      id,
      doadora_nome,
      touro_nome,
      observacoes,
      opu_session:opu_sessions!aspirations_session_id_fkey ( id, data, local, responsavel ),
      embryos:embryos!embryos_aspiration_id_fkey (
        id,
        sexagem,
        numero_cdc_fiv,
        numero_adt_te,
        transfers:transfers!transfers_embryo_id_fkey (
          id,
          receptora_brinco,
          receptora:animals!transfers_receptora_id_fkey ( id, nome, brinco, rgn ),
          pregnancy_diagnoses ( resultado, data_previsao_parto )
        )
      )
    `)
    .eq("id", aspId)
    .single();

  if (!asp) notFound();

  const obs       = asp.observacoes as string | null;
  const emb       = (asp.embryos as any[])?.[0] ?? null;
  const transfer  = emb?.transfers?.[0]    ?? null;
  const receptora = transfer?.receptora    ?? null;
  const session   = asp.opu_session as any;

  // Campos estruturados
  const doadoraRgn  = parseKey(obs, "DOADORA_RGN");
  const dataParto   = transfer?.pregnancy_diagnoses?.[0]?.data_previsao_parto ?? parseKey(obs, "PARTO");
  const parcela     = parseKey(obs, "PARCELA");
  const vendedor    = parseKey(obs, "VENDEDOR");
  const leilao      = parseKey(obs, "LEILAO");
  const touroRgn     = parseKey(obs, "TOURO_RGN");
  const dataLeilao   = parseKey(obs, "DATA_LEILAO") ?? session?.data ?? null;
  const numParcelas  = parseKey(obs, "NUM_PARCELAS");
  const fazendaOrig  = parseKey(obs, "FAZENDA") ?? session?.local;
  const adtTe        = !!emb?.numero_adt_te;
  const resultado    = parseKey(obs, "RESULTADO");
  const dataResultado = parseKey(obs, "DATA_RESULTADO");

  // Status do parto
  const diasRestantes = diasParaParto(dataParto);
  let partoStatus: { label: string; cls: string } = { label: "—", cls: "text-gray-400" };
  if (diasRestantes !== null) {
    if (diasRestantes < 0)
      partoStatus = { label: `${Math.abs(diasRestantes)}d atrás`, cls: "text-red-600 font-semibold" };
    else if (diasRestantes === 0)
      partoStatus = { label: "Hoje!", cls: "text-orange-600 font-bold" };
    else if (diasRestantes <= 30)
      partoStatus = { label: `em ${diasRestantes}d`, cls: "text-orange-500 font-medium" };
    else
      partoStatus = { label: `em ${diasRestantes}d`, cls: "text-gray-500" };
  }

  const sexoDefault = emb?.sexagem === "FEMEA" ? "F" : emb?.sexagem === "MACHO" ? "M" : "";

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link
          href="/reproducao/prenhezes"
          className="mt-1 p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          title="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{asp.doadora_nome ?? "Prenhez"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ficha de prenhez adquirida · Aspiração <span className="font-mono text-xs">{aspId.slice(0, 8)}</span>
          </p>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex flex-wrap gap-3">
        {dataParto && (
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm shadow-sm">
            <CalendarDays className="w-4 h-4 text-brand-500" />
            <span className="text-gray-600">Parto prev.:</span>
            <span className="font-semibold text-gray-800">{formatDate(dataParto)}</span>
            <span className={`text-xs ${partoStatus.cls}`}>({partoStatus.label})</span>
          </div>
        )}
        {emb?.sexagem && (
          <div className={`inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-sm shadow-sm ${
            emb.sexagem === "FEMEA"
              ? "bg-pink-50 border-pink-200 text-pink-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}>
            {emb.sexagem === "FEMEA" ? "♀ Fêmea" : "♂ Macho"}
          </div>
        )}
        {adtTe && (
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm shadow-sm">
            <Tag className="w-3.5 h-3.5" /> ADT-TE confirmado
          </div>
        )}
      </div>

      {/* ── Formulário de edição ── */}
      <form action={salvarFicha} className="space-y-5">
        {/* IDs ocultos */}
        <input type="hidden" name="asp_id"      value={asp.id} />
        <input type="hidden" name="embryo_id"   value={emb?.id ?? ""} />
        <input type="hidden" name="transfer_id" value={transfer?.id ?? ""} />
        <input type="hidden" name="animal_id"   value={receptora?.id ?? ""} />

        {/* ── Card: Doadora & Touro ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Doadora */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
            <User className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-700">Doadora</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nome</label>
              <input name="doadora_nome" type="text" defaultValue={asp.doadora_nome ?? ""}
                placeholder="Nome completo"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ABCZ# / RGN</label>
              <input name="doadora_rgn" type="text" defaultValue={doadoraRgn ?? ""}
                placeholder="Nº ABCZ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
            </div>
          </div>

          {/* Touro */}
          <div className="px-5 py-3 border-t border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
            <User className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-700">Touro</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nome</label>
              <input name="touro_nome" type="text" defaultValue={asp.touro_nome ?? ""}
                placeholder="Nome do touro"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ABCZ# / RGN</label>
              <input name="touro_rgn" type="text" defaultValue={touroRgn ?? ""}
                placeholder="Nº ABCZ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
            </div>
          </div>
        </section>

        {/* ── Card: Receptora ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
            <Beef className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-700">Receptora</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nº Brinco</label>
              <input
                name="brinco"
                type="text"
                defaultValue={receptora?.brinco ?? transfer?.receptora_brinco ?? ""}
                placeholder="Nº brinco"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ABCZ# (RGN)</label>
              <input
                name="rgn"
                type="text"
                defaultValue={receptora?.rgn ?? ""}
                placeholder="Nº ABCZ"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              />
            </div>
          </div>
        </section>

        {/* ── Card: Reprodução ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
            <FlaskConical className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-700">Reprodução</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data parto previsto</label>
              <input
                name="data_parto"
                type="date"
                defaultValue={dataParto ?? ""}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nº CDC-FIV</label>
              <input
                name="cdc_fiv"
                type="text"
                defaultValue={emb?.numero_cdc_fiv ?? ""}
                placeholder="Nº CDC"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sexagem</label>
              <select
                name="sexagem"
                defaultValue={emb?.sexagem ?? ""}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              >
                <option value="">— Não informado —</option>
                <option value="FEMEA">♀ Fêmea</option>
                <option value="MACHO">♂ Macho</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                name="adt_te"
                id="adt_te"
                defaultChecked={adtTe}
                className="w-4 h-4 accent-brand-600"
              />
              <label htmlFor="adt_te" className="text-sm text-gray-700 cursor-pointer">ADT-TE</label>
            </div>
          </div>
        </section>

        {/* ── Card: Compra / Financeiro ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
            <DollarSign className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-gray-700">Compra / Financeiro</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* Linha 1: Vendedor · Leilão · Data do leilão */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Vendedor</label>
                <input name="vendedor" type="text" defaultValue={vendedor ?? ""}
                  placeholder="Nome do vendedor"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Leilão</label>
                <input name="leilao" type="text" defaultValue={leilao ?? ""}
                  placeholder="Ex: Leilão SE 2025"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Data do leilão</label>
                <input name="data_leilao" type="date" defaultValue={dataLeilao ?? ""}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
              </div>
            </div>

            {/* Linha 2: Fazenda */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fazenda / Origem</label>
                <input name="fazenda_orig" type="text" defaultValue={fazendaOrig ?? ""}
                  placeholder="Fazenda de origem"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
              </div>
            </div>

            {/* Linha 3: Parcela · Nº parcelas · Total */}
            <div className="pt-1 border-t border-gray-100">
              <ParcelaCalc parcelaInicial={parcela} numParcelasInicial={numParcelas} />
            </div>
          </div>
        </section>

        {/* ── Botão salvar ── */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Salvar ficha
          </button>
          <Link href="/reproducao/prenhezes" className="text-sm text-gray-500 hover:text-gray-700">
            Voltar sem salvar
          </Link>
        </div>
      </form>

      <DesfechoFichaForm
        aspId={asp.id}
        doadoraNome={asp.doadora_nome ?? null}
        touroNome={asp.touro_nome ?? null}
        sexoDefault={sexoDefault}
        resultado={resultado}
        dataResultado={dataResultado}
      />
    </div>
  );
}
