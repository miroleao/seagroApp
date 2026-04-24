"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

/**
 * Registra múltiplas prenhezes compradas de uma vez.
 * Campos do lote: data_compra, fazenda, vendedor, n_parcelas
 * Campos por linha (índice i): brinco_i, rgn_i, doadora_i, doadora_rgn_i,
 *   touro_i, touro_rgn_i, parto_i, parcela_i, sexagem_i
 */
export async function registrarPrenhezesBatch(formData: FormData) {
  const data_compra  = (formData.get("data_compra") as string)  || new Date().toISOString().split("T")[0];
  const fazenda      = (formData.get("fazenda") as string)?.trim()     || null;
  const vendedor     = (formData.get("vendedor") as string)?.trim()    || null;
  const nParcelasRaw = formData.get("n_parcelas") as string;
  const n_parcelas   = parseInt(nParcelasRaw) || 30;

  const supabase = await createClient();

  let i = 0;
  while (true) {
    const brinco       = (formData.get(`brinco_${i}`) as string)?.trim()      || null;
    const rgn          = (formData.get(`rgn_${i}`) as string)?.trim()         || null;
    const doadora_nome = (formData.get(`doadora_${i}`) as string)?.trim()     || null;
    const doadora_rgn  = (formData.get(`doadora_rgn_${i}`) as string)?.trim() || null;
    const touro_nome   = (formData.get(`touro_${i}`) as string)?.trim()       || null;
    const touro_rgn    = (formData.get(`touro_rgn_${i}`) as string)?.trim()   || null;
    const data_parto   = (formData.get(`parto_${i}`) as string)               || null;
    const parcelaRaw   = formData.get(`parcela_${i}`) as string;
    const sexagem      = (formData.get(`sexagem_${i}`) as string)             || null;

    // Parar quando não houver mais linhas
    if (formData.get(`brinco_${i}`) === null) break;

    // Pular linhas completamente vazias
    if (!brinco && !doadora_nome) { i++; continue; }

    const valor_parcela = parcelaRaw ? parseFloat(parcelaRaw) : null;

    // 1 — Receptora (upsert por brinco para não duplicar)
    let receptoraId: string | null = null;
    if (brinco) {
      const { data: existente } = await supabase
        .from("animals")
        .select("id")
        .eq("farm_id", FARM_ID)
        .eq("brinco", brinco)
        .in("tipo", ["RECEPTORA"])
        .maybeSingle();
      if (existente?.id) {
        receptoraId = existente.id;
        // Atualiza status para PRENHA_EMBRIAO
        await supabase.from("animals")
          .update({ status_rebanho: "PRENHA_EMBRIAO" })
          .eq("id", existente.id);
      }
    }

    if (!receptoraId) {
      const { data: novaReceptora } = await supabase
        .from("animals")
        .insert({
          farm_id:        FARM_ID,
          tipo:           "RECEPTORA",
          classificacao:  "RECEPTORA",
          nome:           brinco || `Receptora ${i + 1}`,
          brinco,
          rgn,
          situacao:       "COMPRADA",
          status_rebanho: "PRENHA_EMBRIAO",
          data_entrada:   data_compra,
          forma_entrada:  "COMPRA",
          observacoes:    fazenda ? `Origem: ${fazenda}` : null,
        })
        .select("id")
        .single();
      receptoraId = novaReceptora?.id ?? null;
    }

    const receptora = receptoraId ? { id: receptoraId } : null;

    if (!receptora) { i++; continue; }

    // 2 — Sessão OPU (COMPRADA) — uma por linha para manter isolamento
    const { data: session } = await supabase
      .from("opu_sessions")
      .insert({
        farm_id:     FARM_ID,
        tipo:        "COMPRADA",
        data:        data_compra,
        local:       fazenda,
        responsavel: vendedor,
      })
      .select("id")
      .single();

    if (!session) { i++; continue; }

    // 3 — Obs estruturada
    const obsParts: string[] = [];
    if (doadora_rgn)  obsParts.push(`DOADORA_RGN:${doadora_rgn}`);
    if (touro_rgn)    obsParts.push(`TOURO_RGN:${touro_rgn}`);
    if (data_parto)   obsParts.push(`PARTO:${data_parto}`);
    if (valor_parcela) obsParts.push(`PARCELA:${valor_parcela}`);
    if (fazenda)      obsParts.push(`FAZENDA:${fazenda}`);

    // 4 — Aspiração
    const { data: asp } = await supabase
      .from("aspirations")
      .insert({
        farm_id:      FARM_ID,
        session_id:   session.id,
        doadora_nome: doadora_nome,
        touro_nome:   touro_nome,
        observacoes:  obsParts.length ? obsParts.join(" | ") : null,
      })
      .select("id")
      .single();

    if (!asp) { i++; continue; }

    // 5 — Embrião (IMPLANTADO)
    const { data: embriao } = await supabase
      .from("embryos")
      .insert({
        farm_id:        FARM_ID,
        aspiration_id:  asp.id,
        sexagem:        sexagem || "NAO_SEXADO",
        status:         "IMPLANTADO",
      })
      .select("id")
      .single();

    if (!embriao) { i++; continue; }

    // 6 — Transfer
    const { data: transfer } = await supabase
      .from("transfers")
      .insert({
        farm_id:          FARM_ID,
        embryo_id:        embriao.id,
        receptora_id:     receptora.id,
        receptora_brinco: brinco,
        data_te:          data_compra,
        responsavel:      vendedor,
      })
      .select("id")
      .single();

    if (!transfer) { i++; continue; }

    // 7 — DG positivo
    if (data_parto) {
      await supabase.from("pregnancy_diagnoses").insert({
        farm_id:              FARM_ID,
        transfer_id:          transfer.id,
        data_dg:              data_compra,
        resultado:            "POSITIVO",
        data_previsao_parto:  data_parto,
      });
    }

    // 8 — Parcelas (se informadas)
    if (valor_parcela && n_parcelas > 0) {
      const { data: transaction } = await supabase
        .from("transactions")
        .insert({
          farm_id:      FARM_ID,
          tipo:         "COMPRA",
          animal_nome:  doadora_nome ?? brinco ?? "Prenhez",
          contraparte:  vendedor,
          valor_total:  valor_parcela * n_parcelas,
          n_parcelas,
        })
        .select("id")
        .single();

      if (transaction) {
        const hoje = new Date();
        const parcelas = Array.from({ length: n_parcelas }, (_, k) => {
          const venc = new Date(hoje);
          venc.setMonth(venc.getMonth() + k + 1);
          return {
            farm_id:        FARM_ID,
            transaction_id: transaction.id,
            numero:         k + 1,
            vencimento:     venc.toISOString().split("T")[0],
            valor:          valor_parcela,
            status:         "PENDENTE",
          };
        });
        await supabase.from("installments").insert(parcelas);
      }
    }

    i++;
  }

  redirect("/reproducao/prenhezes");
}
