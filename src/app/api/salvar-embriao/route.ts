import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { embryoId, transferId, sexagem, receptoraId: receptoraIdEnviado, receptoraBrinco, receptoraAbcz, dgResultado, cdcFiv, adtTe, dataFiv, dataDgSessao } = await req.json();
    if (!embryoId) return NextResponse.json({ ok: false, erro: "ID inválido" });

    const supabase = await createClient();
    const hoje = new Date().toISOString().split("T")[0];

    // DG → status_rebanho da receptora (fonte única para todo o fluxo abaixo).
    // POSITIVO  → PRENHA_EMBRIAO   (prenhez confirmada, entra em Prenhas Ativas)
    // NEGATIVO  → VAZIA            (falhou, libera a receptora para novo ciclo)
    // AGUARDANDO/sem DG → IMPLANTADA (recebeu embrião, DG ainda não feito)
    const statusPorDg: Record<string, string> = {
      POSITIVO:   "PRENHA_EMBRIAO",
      NEGATIVO:   "VAZIA",
      AGUARDANDO: "IMPLANTADA",
    };
    const statusReceptora = statusPorDg[dgResultado as string] ?? "IMPLANTADA";

    // 1 — Sexagem + CDC-FIV + ADT-TE
    await supabase.from("embryos")
      .update({
        sexagem:        sexagem || "NAO_SEXADO",
        numero_cdc_fiv: cdcFiv?.trim() || null,
        numero_adt_te:  adtTe ? "SIM" : null,
      })
      .eq("id", embryoId);

    // 2 — Receptora: prioriza receptoraId (uuid direto), depois lookup por brinco, senão cria nova
    let receptoraId: string | null = null;
    let receptoraStatus: string | undefined;

    if (receptoraIdEnviado) {
      // Selecionada da lista — verifica se existe no banco
      const { data: rec } = await supabase
        .from("animals").select("id, brinco")
        .eq("farm_id", FARM_ID).eq("id", receptoraIdEnviado).maybeSingle();
      if (rec?.id) {
        receptoraId = rec.id;
        receptoraStatus = "existente";
        if (receptoraAbcz?.trim()) {
          await supabase.from("animals").update({ rgn: receptoraAbcz.trim() }).eq("id", rec.id);
        }
      }
    } else if (receptoraBrinco?.trim()) {
      // Modo manual: busca pelo brinco, cria se não encontrar
      const { data: existente } = await supabase
        .from("animals").select("id")
        .eq("farm_id", FARM_ID).eq("brinco", receptoraBrinco.trim())
        .maybeSingle();

      if (existente?.id) {
        receptoraId = existente.id;
        receptoraStatus = "existente";
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
          is_external: false,
          status_rebanho: statusReceptora,
        }).select("id").single();
        receptoraId = nova?.id ?? null;
        receptoraStatus = "criada";
      }
    }

    // 3 — Transfer
    let finalTransferId = transferId ?? null;
    const brincoFinal = receptoraBrinco?.trim() || null;

    if (receptoraId) {
      if (transferId) {
        await supabase.from("transfers")
          .update({ receptora_id: receptoraId, receptora_brinco: brincoFinal })
          .eq("id", transferId);
      } else {
        const { data: novoT } = await supabase.from("transfers").insert({
          farm_id: FARM_ID,
          embryo_id: embryoId,
          receptora_id: receptoraId,
          receptora_brinco: brincoFinal,
        }).select("id").single();
        finalTransferId = novoT?.id ?? null;
        await supabase.from("embryos").update({ status: "IMPLANTADO" }).eq("id", embryoId);
      }

      // Reflete o DG no Rebanho: prenha (P+), vazia (Neg.) ou implantada (aguardando).
      // Não sobrescreve estados terminais — animal vendido/morto/descartado não volta ao ciclo.
      const { data: recAtual } = await supabase
        .from("animals").select("status_rebanho").eq("id", receptoraId).maybeSingle();

      const TERMINAIS = ["VENDIDA", "MORTA", "DESCARTE"];
      if (!TERMINAIS.includes(recAtual?.status_rebanho ?? "")) {
        await supabase.from("animals")
          .update({ status_rebanho: statusReceptora })
          .eq("id", receptoraId);
      }
    }

    // 4 — DG + Previsão de parto (dataFiv + 293 dias)
    // Sempre cria pregnancy_diagnoses quando há transfer — sem DG usa "AGUARDANDO"
    // Isso garante a cadeia doadora → touro → embrião no Rebanho
    if (finalTransferId) {
      // Sem DG informado → AGUARDANDO (não presume prenhez)
      const resultadoFinal = dgResultado || "AGUARDANDO";
      // Previsão de parto só faz sentido com prenhez confirmada — em NEGATIVO fica null
      let dataPrevisaoParto: string | null = null;
      if (dataFiv && resultadoFinal === "POSITIVO") {
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
          resultado: resultadoFinal,
          data_dg: dataDg,
          data_previsao_parto: dataPrevisaoParto,
        }).eq("id", dgExistente.id);
      } else {
        await supabase.from("pregnancy_diagnoses").insert({
          farm_id: FARM_ID,
          transfer_id: finalTransferId,
          resultado: resultadoFinal,
          data_dg: dataDg,
          data_previsao_parto: dataPrevisaoParto,
        });
      }
    }

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    revalidatePath("/aspiracoes");
    revalidatePath("/dashboard");
    return NextResponse.json({
      ok: true,
      receptoraStatus,
      novoTransferId: finalTransferId,
      statusRebanho: receptoraId ? statusReceptora : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
