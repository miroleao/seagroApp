import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID, calcularPrevisaoParto } from "@/lib/utils";
import { resolveReceptora } from "@/lib/db/receptora";

/**
 * POST /api/implantar-embriao
 *
 * Implanta um embrião congelado (DT ou Vitrificado) em uma receptora via T.E.
 * - Atualiza embryo.status → IMPLANTADO
 * - Cria transfers (data_te, receptora_id / receptora_brinco)
 * - Cria pregnancy_diagnoses com data_previsao_parto = data_te + 293 dias (DIAS_GESTACAO)
 * - Atualiza receptora.status_rebanho → PRENHA_EMBRIAO
 */
export async function POST(req: NextRequest) {
  try {
    const { embryoId, dataTE, receptoraId, receptoraBrinco } =
      await req.json();

    if (!embryoId) return NextResponse.json({ ok: false, erro: "embryoId obrigatório" });
    if (!dataTE)   return NextResponse.json({ ok: false, erro: "Data da T.E. obrigatória" });

    const supabase = await createClient();

    // ── 1. Previsão de parto = T.E. + DIAS_GESTACAO (293 dias) ─────────
    const dataPrevisaoParto = calcularPrevisaoParto(dataTE);

    // ── 2. Resolve receptora (id existente ou brinco → busca/cria) ──────
    const receptoraResult = await resolveReceptora(supabase, {
      receptoraId:   receptoraId ?? null,
      brinco:        receptoraBrinco,
      statusRebanho: "PRENHA_EMBRIAO",
    });
    const finalReceptoraId = receptoraResult.id;
    const receptoraStatus  = receptoraResult.status;

    // ── 3. Atualiza status do embrião → IMPLANTADO ──────────────────────
    const { error: embErr } = await supabase
      .from("embryos")
      .update({ status: "IMPLANTADO" })
      .eq("id", embryoId);
    if (embErr) throw new Error(`Erro ao atualizar embrião: ${embErr.message}`);

    // ── 4. Cria o registro de T.E. (transfers) ──────────────────────────
    const { data: transfer, error: trErr } = await supabase
      .from("transfers")
      .insert({
        farm_id:          FARM_ID,
        embryo_id:        embryoId,
        receptora_id:     finalReceptoraId,
        receptora_brinco: receptoraBrinco?.trim() ?? null,
        data_te:          dataTE,
      })
      .select("id")
      .single();
    if (trErr) throw new Error(`Erro ao criar T.E.: ${trErr.message}`);

    // ── 5. Cria DG inicial (sem resultado) com previsão de parto ────────
    if (transfer?.id) {
      await supabase.from("pregnancy_diagnoses").insert({
        farm_id:             FARM_ID,
        transfer_id:         transfer.id,
        resultado:           "AGUARDANDO",
        data_previsao_parto: dataPrevisaoParto,
      });
    }

    // ── 6. Atualiza status da receptora → PRENHA_EMBRIAO ────────────────
    if (finalReceptoraId) {
      await supabase
        .from("animals")
        .update({ status_rebanho: "PRENHA_EMBRIAO" })
        .eq("id", finalReceptoraId);
    }

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true, receptoraStatus, dataPrevisaoParto });
  } catch (e: any) {
    console.error("❌ implantar-embriao:", e);
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
