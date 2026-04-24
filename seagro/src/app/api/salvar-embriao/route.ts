import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { embryoId, transferId, sexagem, receptoraBrinco, receptoraAbcz, dgResultado, cdcFiv, adtTe, dataFiv, dataDgSessao } = await req.json();
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

    // 2 — Receptora
    let receptoraId: string | null = null;
    let receptoraStatus: string | undefined;

    if (receptoraBrinco?.trim()) {
      const { data: existente } = await supabase
        .from("animals").select("id")
        .eq("farm_id", FARM_ID).eq("brinco", receptoraBrinco.trim())
        .maybeSingle();

      if (existente?.id) {
        receptoraId = existente.id;
        receptoraStatus = "existente";
        // Atualiza rgn se fornecido
        if (receptoraAbcz?.trim()) {
          await supabase.from("animals").update({ rgn: receptoraAbcz.trim() }).eq("id", existente.id);
        }
      } else {
        const { data: nova } = await supabase.from("animals").insert({
          farm_id: FARM_ID,
          tipo: "RECEPTORA",
          classificacao: "RECEPTORA",
          nome: `Receptora ${receptoraBrinco.trim()}`,
          brinco: receptoraBrinco.trim(),
          rgn: receptoraAbcz?.trim() || null,
          status_rebanho: dgResultado === "POSITIVO" ? "PRENHA_EMBRIAO" : "ATIVA",
        }).select("id").single();
        receptoraId = nova?.id ?? null;
        receptoraStatus = "criada";
      }
    }

    // 3 — Transfer
    let finalTransferId = transferId ?? null;

    if (receptoraId) {
      if (transferId) {
        await supabase.from("transfers")
          .update({ receptora_id: receptoraId, receptora_brinco: receptoraBrinco?.trim() })
          .eq("id", transferId);
      } else {
        const { data: novoT } = await supabase.from("transfers").insert({
          farm_id: FARM_ID,
          embryo_id: embryoId,
          receptora_id: receptoraId,
          receptora_brinco: receptoraBrinco.trim(),
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

    // 4 — DG + Previsão de parto (dataFiv + 293 dias)
    if (finalTransferId && dgResultado) {
      let dataPrevisaoParto: string | null = null;
      if (dataFiv && dgResultado === "POSITIVO") {
        const d = new Date(dataFiv + "T12:00:00");
        d.setDate(d.getDate() + 293);
        dataPrevisaoParto = d.toISOString().split("T")[0];
      }

      const dataDg = dataDgSessao || hoje;

      const { data: dgExistente } = await supabase
        .from("pregnancy_diagnoses").select("id")
        .eq("transfer_id", finalTransferId).maybeSingle();

      if (dgExistente?.id) {
        await supabase.from("pregnancy_diagnoses").update({
          resultado: dgResultado,
          data_dg: dataDg,
          data_previsao_parto: dataPrevisaoParto,
        }).eq("id", dgExistente.id);
      } else {
        await supabase.from("pregnancy_diagnoses").insert({
          farm_id: FARM_ID,
          transfer_id: finalTransferId,
          resultado: dgResultado,
          data_dg: dataDg,
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
