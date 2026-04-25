import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID, calcularPrevisaoParto } from "@/lib/utils";
import { resolveReceptora } from "@/lib/db/receptora";

export async function POST(req: NextRequest) {
  try {
    const {
      embryoId, transferId, sexagem,
      receptoraBrinco, receptoraAbcz,
      dgResultado, cdcFiv, adtTe,
      dataFiv, dataDgSessao,
    } = await req.json();

    if (!embryoId) return NextResponse.json({ ok: false, erro: "ID inválido" });

    const supabase = await createClient();
    const hoje = new Date().toISOString().split("T")[0];

    // 1 — Sexagem + CDC-FIV + ADT-TE
    await supabase.from("embryos")
      .update({
        sexagem:        sexagem || "NAO_SEXADO",
        numero_cdc_fiv: cdcFiv?.trim() || null,
        numero_adt_te:  adtTe ? "SIM" : null,
      })
      .eq("id", embryoId);

    // 2 — Receptora (busca por brinco ou cria nova)
    const receptoraResult = await resolveReceptora(supabase, {
      brinco: receptoraBrinco,
      rgn:    receptoraAbcz,
      statusRebanho: dgResultado === "POSITIVO" ? "PRENHA_EMBRIAO" : "ATIVA",
    });
    const receptoraId     = receptoraResult.id;
    const receptoraStatus = receptoraResult.status;

    // 3 — Transfer
    let finalTransferId = transferId ?? null;

    if (receptoraId) {
      if (transferId) {
        await supabase.from("transfers")
          .update({ receptora_id: receptoraId, receptora_brinco: receptoraBrinco?.trim() })
          .eq("id", transferId);
      } else {
        const { data: novoT } = await supabase.from("transfers").insert({
          farm_id:          FARM_ID,
          embryo_id:        embryoId,
          receptora_id:     receptoraId,
          receptora_brinco: receptoraBrinco?.trim(),
        }).select("id").single();
        finalTransferId = novoT?.id ?? null;
        await supabase.from("embryos").update({ status: "IMPLANTADO" }).eq("id", embryoId);
      }

      if (dgResultado === "POSITIVO") {
        await supabase.from("animals")
          .update({ status_rebanho: "PRENHA_EMBRIAO" })
          .eq("id", receptoraId);
      }
    }

    // 4 — DG + Previsão de parto (FIV + DIAS_GESTACAO)
    if (finalTransferId && dgResultado) {
      const dataPrevisaoParto = dataFiv && dgResultado === "POSITIVO"
        ? calcularPrevisaoParto(dataFiv)
        : null;

      const dataDg = dataDgSessao || hoje;

      const { data: dgExistente } = await supabase
        .from("pregnancy_diagnoses").select("id")
        .eq("transfer_id", finalTransferId).maybeSingle();

      if (dgExistente?.id) {
        await supabase.from("pregnancy_diagnoses").update({
          resultado:           dgResultado,
          data_dg:             dataDg,
          data_previsao_parto: dataPrevisaoParto,
        }).eq("id", dgExistente.id);
      } else {
        await supabase.from("pregnancy_diagnoses").insert({
          farm_id:             FARM_ID,
          transfer_id:         finalTransferId,
          resultado:           dgResultado,
          data_dg:             dataDg,
          data_previsao_parto: dataPrevisaoParto,
        });
      }
    }

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true, receptoraStatus, novoTransferId: finalTransferId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
