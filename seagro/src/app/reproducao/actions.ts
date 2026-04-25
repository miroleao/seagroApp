"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID, calcularPrevisaoParto } from "@/lib/utils";
import { resolveReceptora } from "@/lib/db/receptora";

// ── helpers ────────────────────────────────────────────────────────────────────
/** Constrói a string de observacoes estruturada para aspirações */
function buildAspObs(parts: Record<string, string | null | undefined>): string | null {
  const entries = Object.entries(parts)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}:${String(v).trim()}`);
  return entries.length ? entries.join(" | ") : null;
}

// ── Prenhez Comprada ──────────────────────────────────────────────────────────
/**
 * Registra uma prenhez comprada de terceiros.
 * Cria: animal (RECEPTORA) → opu_session (COMPRADA) → aspiration → embryo (IMPLANTADO)
 *       → transfer → pregnancy_diagnosis (POSITIVO)
 * A receptora entra automaticamente no Rebanho.
 */
export async function registrarPrenhez(formData: FormData) {
  const brinco       = (formData.get("brinco_receptora") as string)?.trim() || "—";
  const rgn_abcz     = (formData.get("rgn_abcz") as string)?.trim()         || null;
  const doadora_nome = (formData.get("doadora_nome") as string)?.trim()      || null;
  const doadora_rgn  = (formData.get("doadora_rgn") as string)?.trim()       || null;
  const touro_nome   = (formData.get("touro_nome") as string)?.trim()        || null;
  const touro_rgn    = (formData.get("touro_rgn") as string)?.trim()         || null;
  const data_compra  = (formData.get("data_compra") as string)               || null;
  const data_parto   = (formData.get("data_parto") as string)                || null;
  const valorRaw     = formData.get("valor_parcela") as string;
  const nParcelasRaw = formData.get("n_parcelas") as string;
  const fazenda      = (formData.get("fazenda") as string)?.trim()           || null;
  const vendedor     = (formData.get("vendedor") as string)?.trim()          || null;
  const sexagem      = (formData.get("sexagem") as string)                   || null;

  const valor_parcela = valorRaw ? parseFloat(valorRaw) : null;
  const n_parcelas    = parseInt(nParcelasRaw) || 30;

  const supabase = await createClient();

  // 1 ── Receptora no rebanho
  const { data: receptoraAnimal, error: animalErr } = await supabase
    .from("animals")
    .insert({
      farm_id:   FARM_ID,
      tipo:      "RECEPTORA",
      nome:      brinco,
      brinco,
      rgn:       rgn_abcz,
      situacao:  "COMPRADA",
      observacoes: fazenda ? `Origem: ${fazenda}` : null,
    })
    .select("id")
    .single();

  if (animalErr || !receptoraAnimal) {
    console.error("Erro ao criar receptora:", animalErr);
    redirect("/reproducao");
  }

  // 2 ── Sessão OPU tipo COMPRADA
  const { data: session, error: sessErr } = await supabase
    .from("opu_sessions")
    .insert({
      farm_id:     FARM_ID,
      tipo:        "COMPRADA",
      data:        data_compra || new Date().toISOString().split("T")[0],
      local:       fazenda,
      responsavel: vendedor,
    })
    .select("id")
    .single();

  if (sessErr || !session) redirect("/reproducao");

  // 3 ── Aspiração (doadora_id = null → terceiro)
  const aspObs = buildAspObs({
    PARTO:         data_parto,
    DOADORA_RGN:   doadora_rgn,
    TOURO_RGN:     touro_rgn,
    PARCELA:       valor_parcela != null ? String(valor_parcela) : null,
    FAZENDA:       fazenda,
  });

  const { data: aspiration, error: aspErr } = await supabase
    .from("aspirations")
    .insert({
      farm_id:      FARM_ID,
      session_id:   session.id,
      doadora_nome,
      touro_nome,
      custo_total:  valor_parcela != null ? valor_parcela * n_parcelas : null,
      observacoes:  aspObs,
    })
    .select("id")
    .single();

  if (aspErr || !aspiration) redirect("/reproducao");

  // 4 ── Embrião (já implantado na receptora)
  const { data: embryo, error: embErr } = await supabase
    .from("embryos")
    .insert({
      farm_id:      FARM_ID,
      aspiration_id: aspiration.id,
      status:        "IMPLANTADO",
      sexagem:       sexagem || null,
    })
    .select("id")
    .single();

  if (embErr || !embryo) redirect("/reproducao");

  // 5 ── Transfer embryo → receptora
  const { data: transfer, error: transErr } = await supabase
    .from("transfers")
    .insert({
      farm_id:          FARM_ID,
      embryo_id:        embryo.id,
      receptora_id:     receptoraAnimal.id,
      receptora_brinco: brinco,
    })
    .select("id")
    .single();

  if (transErr || !transfer) redirect("/reproducao");

  // 6 ── Diagnóstico de gestação positivo (se tem previsão de parto)
  if (data_parto) {
    await supabase.from("pregnancy_diagnoses").insert({
      farm_id:             FARM_ID,
      transfer_id:         transfer.id,
      data_dg:             data_compra || new Date().toISOString().split("T")[0], // campo NOT NULL
      resultado:           "POSITIVO",
      data_previsao_parto: data_parto,
    });
  }

  revalidatePath("/reproducao");
  revalidatePath("/rebanho");
  redirect("/reproducao");
}

// ── Aspiração OPU própria ─────────────────────────────────────────────────────
export async function registrarOPU(formData: FormData) {
  const doadora_id       = (formData.get("doadora_id") as string)              || null;
  const touro_nome       = (formData.get("touro_nome") as string)?.trim()      || null;
  const data             = formData.get("data") as string;
  const local            = (formData.get("local") as string)?.trim()           || null;
  const responsavel      = (formData.get("responsavel") as string)?.trim()     || null;
  const laboratorio      = (formData.get("laboratorio") as string)?.trim()     || null;
  const oocitos_viaveis  = parseInt(formData.get("oocitos_viaveis") as string) || null;
  const embryos_cong     = parseInt(formData.get("embryos_congelados") as string) || null;
  const custo_total      = parseFloat(formData.get("custo_total") as string)   || null;
  const observacoes      = (formData.get("observacoes") as string)?.trim()     || null;

  // Doadoras de terceiros: sem doadora_id no sistema
  const doadora_nome_raw = (formData.get("doadora_nome_terceiro") as string)?.trim() || null;
  const doadora_rgn_raw  = (formData.get("doadora_rgn_terceiro") as string)?.trim()  || null;
  const is_terceiro      = !doadora_id && !!doadora_nome_raw;

  if (!data) redirect("/reproducao");

  const supabase = await createClient();

  // Busca nome da doadora se for própria
  let doadora_nome: string | null = doadora_nome_raw;
  if (doadora_id) {
    const { data: animal } = await supabase
      .from("animals")
      .select("nome")
      .eq("id", doadora_id)
      .single();
    doadora_nome = animal?.nome ?? null;
  }

  const { data: session, error: sessErr } = await supabase
    .from("opu_sessions")
    .insert({
      farm_id:    FARM_ID,
      tipo:       "REALIZADA",
      data,
      local,
      responsavel,
      laboratorio,
    })
    .select("id")
    .single();

  if (sessErr || !session) redirect("/reproducao");

  // Observacoes da aspiração
  const aspObsPartes: Record<string, string | null> = {};
  if (is_terceiro && doadora_rgn_raw) aspObsPartes["DOADORA_RGN"] = doadora_rgn_raw;
  const finalObs = buildAspObs(aspObsPartes) ?? observacoes;

  await supabase.from("aspirations").insert({
    farm_id:            FARM_ID,
    session_id:         session.id,
    doadora_id:         doadora_id || null,
    doadora_nome,
    touro_nome,
    oocitos_viaveis:    oocitos_viaveis  ?? undefined,
    embryos_congelados: embryos_cong     ?? undefined,
    custo_total:        custo_total      ?? undefined,
    observacoes:        finalObs,
  });

  revalidatePath("/reproducao");
  revalidatePath("/aspiracoes");
  revalidatePath("/dashboard");
  redirect("/reproducao");
}

// ── Vincular aspiração a doadora cadastrada ───────────────────────────────────
/**
 * Recebe um ou mais IDs de aspiração (separados por vírgula) e vincula todos
 * ao animal correto, atualizando doadora_id e doadora_nome de uma vez.
 */
export async function vincularDoadora(formData: FormData) {
  const doadora_id   = (formData.get("doadora_id") as string)?.trim();
  const asp_ids_raw  = (formData.get("asp_ids") as string)?.trim();

  if (!doadora_id || !asp_ids_raw) redirect("/reproducao");

  const asp_ids = asp_ids_raw.split(",").map((s) => s.trim()).filter(Boolean);
  const supabase = await createClient();

  // Busca o nome canônico da doadora
  const { data: animal } = await supabase
    .from("animals")
    .select("nome")
    .eq("id", doadora_id)
    .single();

  if (!animal) redirect("/reproducao");

  // Atualiza todas as aspirações do grupo de uma só vez
  await supabase
    .from("aspirations")
    .update({ doadora_id, doadora_nome: animal.nome })
    .in("id", asp_ids);

  revalidatePath("/reproducao");
  redirect("/reproducao");
}

// ── Excluir sessão OPU ───────────────────────────────────────────────────────
// O banco cuida do cascade: opu_sessions → aspirations → embryos
//                                        → transfers → pregnancy_diagnoses
export async function excluirSessao(formData: FormData) {
  const raw = formData.get("session_ids") as string | null;
  if (!raw?.trim()) return;

  const session_ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const supabase = await createClient();

  await supabase.from("opu_sessions").delete().in("id", session_ids);
  revalidatePath("/reproducao");
  revalidatePath("/rebanho");
  revalidatePath("/aspiracoes");
  revalidatePath("/dashboard");
  redirect("/reproducao");
}

// ── Excluir aspiração ────────────────────────────────────────────────────────
// O banco cuida do cascade: aspirations → embryos → transfers → pregnancy_diagnoses
export async function excluirAspiracao(formData: FormData) {
  const asp_id = formData.get("asp_id") as string | null;
  if (!asp_id?.trim()) return;

  const supabase = await createClient();
  await supabase.from("aspirations").delete().eq("id", asp_id);
  revalidatePath("/reproducao");
  revalidatePath("/rebanho");
  redirect("/reproducao");
}

// ── Excluir prenhez comprada (cascade + receptora + session se vazia) ────────
export async function excluirPrenhez(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const asp_id      = formData.get("asp_id") as string;
  const receptora_id = (formData.get("receptora_id") as string) || null;

  if (!asp_id) return { ok: false, erro: "ID inválido" };

  const supabase = await createClient();

  // Busca session_id antes de deletar
  const { data: asp } = await supabase
    .from("aspirations").select("session_id").eq("id", asp_id).single();

  // Deleta aspiração — cascade cuida de embryos → transfers → pregnancy_diagnoses
  await supabase.from("aspirations").delete().eq("id", asp_id);

  // Deleta a sessão se não tiver mais aspirações
  if (asp?.session_id) {
    const { count } = await supabase
      .from("aspirations")
      .select("id", { count: "exact", head: true })
      .eq("session_id", asp.session_id);

    if ((count ?? 0) === 0) {
      await supabase.from("opu_sessions").delete().eq("id", asp.session_id);
    }
  }

  // Deleta a receptora criada para esta prenhez
  if (receptora_id) {
    await supabase.from("animals").delete().eq("id", receptora_id).eq("farm_id", FARM_ID);
  }

  revalidatePath("/reproducao/prenhezes");
  revalidatePath("/rebanho");
  return { ok: true };
}

// ── Salvar linha de embrião (receptora, DG, sexagem) ─────────────────────────
/**
 * Atualiza os dados editáveis de um embrião:
 *  - sexagem no embryo
 *  - receptora_brinco no transfer (cria ou vincula animal no rebanho)
 *  - resultado do DG + previsão de parto automática (dataFiv + 293 dias)
 *
 * Se a receptora não existir no rebanho, cria automaticamente como RECEPTORA.
 */
export async function salvarLinhaEmbriao({
  embryoId,
  transferId,
  sexagem,
  receptoraBrinco,
  dgResultado,
  dataFiv,
  dataDgSessao,
}: {
  embryoId: string;
  transferId: string | null;
  sexagem: string;
  receptoraBrinco: string;
  dgResultado: string;
  dataFiv: string | null;
  dataDgSessao: string | null;
}): Promise<{ ok: boolean; erro?: string; receptoraStatus?: "existente" | "criada"; novoTransferId?: string }> {
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  // 1 ── Atualizar sexagem do embrião
  await supabase.from("embryos").update({ sexagem: sexagem || "NAO_SEXADO" }).eq("id", embryoId);

  // 2 ── Receptora
  // 2 ── Receptora (busca por brinco ou cria nova)
  const receptoraResult = await resolveReceptora(supabase, {
    brinco: receptoraBrinco,
    statusRebanho: dgResultado === "POSITIVO" ? "PRENHA_EMBRIAO" : "ATIVA",
  });
  const receptoraId     = receptoraResult.id;
  const receptoraStatus = receptoraResult.status === "nenhuma" ? undefined : receptoraResult.status;

  // 3 ── Transfer
  let finalTransferId = transferId;

  if (receptoraId) {
    if (transferId) {
      await supabase
        .from("transfers")
        .update({ receptora_id: receptoraId, receptora_brinco: receptoraBrinco.trim() })
        .eq("id", transferId);
    } else {
      // Cria transfer novo e atualiza status do embrião
      const { data: novoT } = await supabase
        .from("transfers")
        .insert({
          farm_id: FARM_ID,
          embryo_id: embryoId,
          receptora_id: receptoraId,
          receptora_brinco: receptoraBrinco.trim(),
        })
        .select("id")
        .single();
      finalTransferId = novoT?.id ?? null;
      await supabase.from("embryos").update({ status: "IMPLANTADO" }).eq("id", embryoId);
    }

    // Atualiza status da receptora
    if (dgResultado === "POSITIVO") {
      await supabase.from("animals").update({ status_rebanho: "PRENHA_EMBRIAO" }).eq("id", receptoraId);
    }
  }

  // 4 ── DG + Previsão de parto automática
  if (finalTransferId && dgResultado) {
    const dataPrevisaoParto = dataFiv && dgResultado === "POSITIVO"
      ? calcularPrevisaoParto(dataFiv)
      : null;

    const dataDg = dataDgSessao || hoje;

    // Verifica se já existe um DG para este transfer
    const { data: dgExistente } = await supabase
      .from("pregnancy_diagnoses")
      .select("id")
      .eq("transfer_id", finalTransferId)
      .maybeSingle();

    if (dgExistente?.id) {
      await supabase
        .from("pregnancy_diagnoses")
        .update({
          resultado: dgResultado,
          data_dg: dataDg,
          data_previsao_parto: dgResultado === "POSITIVO" ? dataPrevisaoParto : null,
        })
        .eq("id", dgExistente.id);
    } else {
      await supabase.from("pregnancy_diagnoses").insert({
        farm_id: FARM_ID,
        transfer_id: finalTransferId,
        resultado: dgResultado,
        data_dg: dataDg,
        data_previsao_parto: dgResultado === "POSITIVO" ? dataPrevisaoParto : null,
      });
    }
  }

  revalidatePath("/reproducao");
  revalidatePath("/rebanho");
  return { ok: true, receptoraStatus, novoTransferId: finalTransferId ?? undefined };
}

// ── Previsão de parto inline ──────────────────────────────────────────────────
export async function salvarPrevisaoParto(formData: FormData) {
  const aspiration_id     = formData.get("aspiration_id") as string;
  const data_previsao     = formData.get("data_previsao_parto") as string;
  const obs_extra         = (formData.get("obs_extra") as string) || "";

  if (!aspiration_id) redirect("/reproducao");

  const partes = [];
  if (data_previsao) partes.push(`PARTO:${data_previsao}`);
  if (obs_extra) partes.push(obs_extra);

  const novaObs = partes.join(" | ") || null;
  const supabase = await createClient();
  await supabase
    .from("aspirations")
    .update({ observacoes: novaObs })
    .eq("id", aspiration_id);

  revalidatePath("/reproducao");
  redirect("/reproducao");
}
