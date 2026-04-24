"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

/**
 * Registra uma sessão OPU com múltiplas doadoras.
 *
 * Campos do lote: data, data_fiv, data_dg, data_sexagem,
 *   tipo_sessao, local, responsavel, laboratorio
 *
 * Campos por linha (índice i):
 *   doadora_id_i, nome_i, rgn_i, touro_i, touro_rgn_i,
 *   dt_i, vitrificados_i, implantados_i, prenhezes_i, custo_i
 *
 * Receptoras por linha (índice i, slot j):
 *   receptora_id_i_j, receptora_brinco_i_j
 */
export async function registrarOPUBatch(formData: FormData) {
  const data         = (formData.get("data")         as string) || new Date().toISOString().split("T")[0];
  const data_fiv     = (formData.get("data_fiv")     as string)?.trim() || null;
  const data_dg      = (formData.get("data_dg")      as string)?.trim() || null;
  const data_sexagem = (formData.get("data_sexagem") as string)?.trim() || null;
  const tipo_sessao  = (formData.get("tipo_sessao")  as string)?.trim() || "PROPRIA";
  const local        = (formData.get("local")        as string)?.trim() || null;
  const responsavel  = (formData.get("responsavel")  as string)?.trim() || null;
  const laboratorio  = (formData.get("laboratorio")  as string)?.trim() || null;

  const supabase = await createClient();

  // Tipo interno: PROPRIA → "REALIZADA", ADQUIRIDA → "COMPRADA"
  const tipoInterno = tipo_sessao === "ADQUIRIDA" ? "COMPRADA" : "REALIZADA";

  const { data: session, error: sessErr } = await supabase
    .from("opu_sessions")
    .insert({
      farm_id:      FARM_ID,
      tipo:         tipoInterno,
      data,
      local,
      responsavel,
      laboratorio,
      data_fiv,
      data_dg,
      data_sexagem,
    })
    .select("id")
    .single();

  if (sessErr || !session) {
    console.error("❌ ERRO ao criar sessão OPU:", JSON.stringify(sessErr));
    throw new Error(sessErr?.message ?? "Erro ao criar sessão OPU no banco de dados");
  }

  let i = 0;
  while (true) {
    // Condição de parada
    if (
      formData.get(`dt_${i}`) === null &&
      formData.get(`vitrificados_${i}`) === null &&
      formData.get(`doadora_id_${i}`) === null
    ) break;

    const doadora_id  = (formData.get(`doadora_id_${i}`)  as string)?.trim() || null;
    const nome_livre  = (formData.get(`nome_${i}`)        as string)?.trim() || null;
    const rgn_livre   = (formData.get(`rgn_${i}`)         as string)?.trim() || null;
    const touro_nome  = (formData.get(`touro_${i}`)       as string)?.trim() || null;
    const touro_rgn   = (formData.get(`touro_rgn_${i}`)   as string)?.trim() || null;

    const oocitos_raw    = formData.get(`oocitos_${i}`)       as string;
    const dt_raw         = formData.get(`dt_${i}`)            as string;
    const vitri_raw      = formData.get(`vitrificados_${i}`)  as string;
    const implant_raw    = formData.get(`implantados_${i}`)   as string;
    const prenhez_raw    = formData.get(`prenhezes_${i}`)     as string;
    const custo_raw      = formData.get(`custo_${i}`)         as string;

    const oocitos_viaveis       = oocitos_raw ? parseInt(oocitos_raw)  : null;
    const embrioes_dt           = dt_raw      ? parseInt(dt_raw)       : 0;
    const embrioes_vitrificados = vitri_raw   ? parseInt(vitri_raw)    : 0;
    const implantados           = implant_raw ? parseInt(implant_raw)  : 0;
    const prenhezes_count       = prenhez_raw ? parseInt(prenhez_raw)  : 0;
    const custo_total           = custo_raw   ? parseFloat(custo_raw)  : null;

    // embryos_congelados = DT + Vitrificados (total não implantados)
    const embryos_congelados = embrioes_dt + embrioes_vitrificados;

    // Resolve nome da doadora
    let doadora_nome = nome_livre || null;
    if (doadora_id && !doadora_nome) {
      const { data: animal } = await supabase
        .from("animals").select("nome").eq("id", doadora_id).single();
      doadora_nome = animal?.nome ?? null;
    }

    const { data: asp, error: aspErr } = await supabase
      .from("aspirations")
      .insert({
        farm_id:              FARM_ID,
        session_id:           session.id,
        doadora_id:           doadora_id || null,
        doadora_nome,
        doadora_rgn:          rgn_livre  || null,
        touro_nome,
        touro_rgn:            touro_rgn  || null,
        oocitos_viaveis,
        embryos_congelados,
        embrioes_dt,
        embrioes_vitrificados,
        implantados,
        prenhezes_count,
        custo_total: (custo_total !== null && !isNaN(custo_total)) ? custo_total : null,
      })
      .select("id")
      .single();

    if (aspErr) {
      console.error("❌ ERRO ao inserir aspiração:", JSON.stringify(aspErr));
      throw new Error(`Erro ao salvar aspiração ${i + 1}: ${aspErr.message}`);
    }

    if (!asp) { i++; continue; }

    // ── Criar embriões DT (congelados, disponíveis) ─────────────────
    for (let d = 0; d < embrioes_dt; d++) {
      await supabase.from("embryos").insert({
        farm_id:           FARM_ID,
        aspiration_id:     asp.id,
        sexagem:           "NAO_SEXADO",
        status:            "DISPONIVEL",
        tipo_congelamento: "DT",
      });
    }

    // ── Criar embriões Vitrificados (congelados, disponíveis) ────────
    for (let v = 0; v < embrioes_vitrificados; v++) {
      await supabase.from("embryos").insert({
        farm_id:           FARM_ID,
        aspiration_id:     asp.id,
        sexagem:           "NAO_SEXADO",
        status:            "DISPONIVEL",
        tipo_congelamento: "VITRIFICADO",
      });
    }

    // ── Criar embriões implantados + transfers ──────────────────────
    for (let j = 0; j < implantados; j++) {
      const receptora_id     = (formData.get(`receptora_id_${i}_${j}`)     as string)?.trim() || null;
      const receptora_brinco = (formData.get(`receptora_brinco_${i}_${j}`) as string)?.trim() || null;

      let finalReceptoraId = receptora_id;
      if (!finalReceptoraId && receptora_brinco) {
        const { data: existente } = await supabase
          .from("animals")
          .select("id")
          .eq("farm_id", FARM_ID)
          .eq("brinco", receptora_brinco)
          .eq("tipo", "RECEPTORA")
          .maybeSingle();

        if (existente?.id) {
          finalReceptoraId = existente.id;
        } else {
          const { data: nova } = await supabase
            .from("animals")
            .insert({
              farm_id:        FARM_ID,
              tipo:           "RECEPTORA",
              classificacao:  "RECEPTORA",
              nome:           `Receptora ${receptora_brinco}`,
              brinco:         receptora_brinco,
              status_rebanho: "PRENHA_EMBRIAO",
            })
            .select("id")
            .single();
          finalReceptoraId = nova?.id ?? null;
        }
      }

      const { data: embriao } = await supabase
        .from("embryos")
        .insert({
          farm_id:       FARM_ID,
          aspiration_id: asp.id,
          sexagem:       "NAO_SEXADO",
          status:        "IMPLANTADO",
        })
        .select("id")
        .single();

      if (embriao && finalReceptoraId) {
        await supabase.from("transfers").insert({
          farm_id:          FARM_ID,
          embryo_id:        embriao.id,
          receptora_id:     finalReceptoraId,
          receptora_brinco: receptora_brinco,
          data_te:          data,
          responsavel,
        });
        await supabase
          .from("animals")
          .update({ status_rebanho: "PRENHA_EMBRIAO" })
          .eq("id", finalReceptoraId);
      }
    }

    i++;
  }

  redirect("/reproducao");
}
