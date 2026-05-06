"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

// ─── Cadastrar animal individual ─────────────────────────────────────────────
export async function cadastrarAnimal(formData: FormData) {
  const supabase = await createClient();

  const brinco        = (formData.get("brinco")        as string)?.trim() || null;
  const nome          = (formData.get("nome")           as string)?.trim() || brinco || "Sem nome";
  const classificacao = (formData.get("classificacao")  as string) || "RECEPTORA";
  const data_entrada  = (formData.get("data_entrada")   as string) || null;
  const forma_entrada = (formData.get("forma_entrada")  as string) || null;
  const localizacao   = (formData.get("localizacao")    as string)?.trim() || null;
  const peso_inicial  = formData.get("peso_inicial") as string;
  const observacoes   = (formData.get("observacoes")    as string)?.trim() || null;

  if (!brinco && !nome) return;

  const { data: animal, error } = await supabase
    .from("animals")
    .insert({
      farm_id:        FARM_ID,
      tipo:           classificacao === "DESCARTE" ? "DESCARTE" : "RECEPTORA",
      classificacao,
      nome,
      brinco,
      data_entrada,
      forma_entrada,
      localizacao,
      observacoes,
      status_rebanho: classificacao === "DESCARTE" ? "DESCARTE" : "VAZIA",
      peso_atual:     peso_inicial ? parseFloat(peso_inicial) : null,
    })
    .select("id")
    .single();

  if (!error && animal && peso_inicial) {
    await supabase.from("pesagens").insert({
      farm_id:  FARM_ID,
      animal_id: animal.id,
      data:     data_entrada || new Date().toISOString().split("T")[0],
      peso_kg:  parseFloat(peso_inicial),
      observacoes: "Peso de entrada",
    });
  }

  revalidatePath("/rebanho");
  redirect("/rebanho");
}

// ─── Vincular/atualizar prenhez manual de uma receptora ──────────────────────
/**
 * Cria ou atualiza o vínculo de prenhez de uma receptora:
 * - Se já existe transfer para a receptora: atualiza data_te + aspiration + pregnancy_diagnoses
 * - Se não existe: cria a cadeia completa opu_session → aspiration → embryo → transfer → pregnancy_diagnoses
 */
/** Calcula previsão de parto: data_te + 286 dias (padrão bovino) */
function calcPrevisaoParto(data_te: string): string {
  const d = new Date(data_te + "T12:00:00");
  d.setDate(d.getDate() + 286);
  return d.toISOString().split("T")[0];
}

export async function vincularPrenhez(formData: FormData) {
  const receptora_id = (formData.get("receptora_id") as string)?.trim();
  const brinco       = (formData.get("brinco")       as string)?.trim() || "";
  const doadora_nome = (formData.get("doadora_nome") as string)?.trim() || null;
  const touro_nome   = (formData.get("touro_nome")   as string)?.trim() || null;
  const data_te      = (formData.get("data_te")      as string)?.trim() || null;
  // Previsão de parto calculada automaticamente: data_te + 286 dias
  const previsao_parto = data_te ? calcPrevisaoParto(data_te) : null;

  if (!receptora_id) return;

  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  // Tenta encontrar doadora pelo nome para usar doadora_id (opcional)
  let doadora_id: string | null = null;
  if (doadora_nome) {
    const { data: doadoraAnimal } = await supabase
      .from("animals")
      .select("id")
      .eq("farm_id", FARM_ID)
      .eq("tipo", "DOADORA")
      .ilike("nome", doadora_nome)
      .limit(1)
      .maybeSingle();
    doadora_id = doadoraAnimal?.id ?? null;
  }

  // Verifica se já existe transfer para esta receptora
  const { data: existingTransfer } = await supabase
    .from("transfers")
    .select("id, data_te, embryo_id")
    .eq("receptora_id", receptora_id)
    .eq("farm_id", FARM_ID)
    .order("data_te", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTransfer) {
    // ── Atualiza transfer existente ────────────────────────────────────────────
    if (data_te) {
      await supabase.from("transfers")
        .update({ data_te })
        .eq("id", existingTransfer.id);
    }

    // Atualiza aspiration (doadora/touro)
    if (existingTransfer.embryo_id && (doadora_nome !== null || touro_nome !== null)) {
      const { data: emb } = await supabase
        .from("embryos")
        .select("aspiration_id")
        .eq("id", existingTransfer.embryo_id)
        .maybeSingle();
      if (emb?.aspiration_id) {
        await supabase.from("aspirations")
          .update({ doadora_nome, touro_nome, ...(doadora_id ? { doadora_id } : {}) })
          .eq("id", emb.aspiration_id);
      }
    }

    // Atualiza ou cria pregnancy_diagnoses
    const { data: existingDg } = await supabase
      .from("pregnancy_diagnoses")
      .select("id")
      .eq("transfer_id", existingTransfer.id)
      .eq("farm_id", FARM_ID)
      .maybeSingle();

    if (existingDg) {
      await supabase.from("pregnancy_diagnoses")
        .update({ resultado: "POSITIVO", data_previsao_parto: previsao_parto })
        .eq("id", existingDg.id);
    } else {
      await supabase.from("pregnancy_diagnoses").insert({
        farm_id: FARM_ID,
        transfer_id: existingTransfer.id,
        resultado: "POSITIVO",
        data_previsao_parto: previsao_parto ?? null,
      });
    }
  } else {
    // ── Cria cadeia completa ───────────────────────────────────────────────────
    const dataSession = data_te || hoje;

    const { data: session } = await supabase
      .from("opu_sessions")
      .insert({ farm_id: FARM_ID, tipo: "COMPRADA", data: dataSession })
      .select("id")
      .single();
    if (!session) { revalidatePath("/rebanho"); redirect("/rebanho"); return; }

    const { data: aspiration } = await supabase
      .from("aspirations")
      .insert({
        farm_id: FARM_ID,
        session_id: session.id,
        doadora_nome,
        touro_nome,
        ...(doadora_id ? { doadora_id } : {}),
      })
      .select("id")
      .single();
    if (!aspiration) { revalidatePath("/rebanho"); redirect("/rebanho"); return; }

    const { data: embryo } = await supabase
      .from("embryos")
      .insert({ farm_id: FARM_ID, aspiration_id: aspiration.id, status: "IMPLANTADO" })
      .select("id")
      .single();
    if (!embryo) { revalidatePath("/rebanho"); redirect("/rebanho"); return; }

    const { data: transfer } = await supabase
      .from("transfers")
      .insert({
        farm_id: FARM_ID,
        embryo_id: embryo.id,
        receptora_id,
        receptora_brinco: brinco,
        data_te: data_te ?? dataSession,
      })
      .select("id")
      .single();
    if (!transfer) { revalidatePath("/rebanho"); redirect("/rebanho"); return; }

    await supabase.from("pregnancy_diagnoses").insert({
      farm_id: FARM_ID,
      transfer_id: transfer.id,
      resultado: "POSITIVO",
      data_previsao_parto: previsao_parto ?? null,
    });
  }

  // Garante status PRENHA_EMBRIAO no animal
  await supabase
    .from("animals")
    .update({ status_rebanho: "PRENHA_EMBRIAO" })
    .eq("id", receptora_id)
    .eq("farm_id", FARM_ID);

  revalidatePath("/rebanho");
  redirect("/rebanho");
}

// ─── Registrar desfecho de prenhez ───────────────────────────────────────────
/**
 * Registra o desfecho de uma prenhez:
 * PARIDA, ABORTOU, REABSORVEU, OBITO_RECEPTORA
 * Atualiza pregnancy_diagnoses.resultado e status_rebanho do animal.
 */
export async function registrarDesfecho(formData: FormData) {
  const receptora_id  = (formData.get("receptora_id")  as string)?.trim();
  const transfer_id   = (formData.get("transfer_id")   as string)?.trim() || null;
  const tipo_desfecho = (formData.get("tipo_desfecho") as string)?.trim();
  const data_desfecho = (formData.get("data_desfecho") as string)?.trim() || null;

  if (!receptora_id || !tipo_desfecho) return;

  const supabase = await createClient();

  // Mapeia desfecho para status do animal
  const novoStatus: Record<string, string> = {
    PARIDA:           "VAZIA",    // parida → libera para novo ciclo
    ABORTOU:          "FALHADA",  // aborto → descarte do programa
    REABSORVEU:       "FALHADA",  // absorção → descarte do programa
    OBITO_RECEPTORA:  "MORTA",    // óbito → sai do rebanho
  };

  // resultado no DG: PARIDA = POSITIVO (nasceu), todo resto = NEGATIVO
  const resultadoDG = tipo_desfecho === "PARIDA" ? "POSITIVO" : "NEGATIVO";

  // Atualiza pregnancy_diagnoses
  async function updateDG(tid: string) {
    await supabase
      .from("pregnancy_diagnoses")
      .update({ resultado: resultadoDG, data_desfecho: data_desfecho ?? null })
      .eq("transfer_id", tid)
      .eq("farm_id", FARM_ID);
  }

  if (transfer_id) {
    await updateDG(transfer_id);
  } else {
    const { data: transfers } = await supabase
      .from("transfers")
      .select("id")
      .eq("receptora_id", receptora_id)
      .eq("farm_id", FARM_ID)
      .order("data_te", { ascending: false })
      .limit(1);
    if (transfers?.[0]?.id) await updateDG(transfers[0].id);
  }

  // Atualiza status do animal
  const st = novoStatus[tipo_desfecho] ?? "VAZIA";
  await supabase
    .from("animals")
    .update({ status_rebanho: st })
    .eq("id", receptora_id)
    .eq("farm_id", FARM_ID);

  revalidatePath("/rebanho");
  revalidatePath("/dashboard");
  redirect("/rebanho");
}

// ─── Desfecho unificado (prenhez + óbito + venda) ────────────────────────────
export async function registrarDesfechoUnificado(formData: FormData) {
  const animal_id   = (formData.get("animal_id")   as string)?.trim();
  const transfer_id = (formData.get("transfer_id") as string)?.trim() || null;
  const tipo        = (formData.get("tipo")         as string)?.trim();
  const data_evento = (formData.get("data_evento")  as string)?.trim() || null;
  const valor_str   = (formData.get("valor")        as string)?.trim() || null;
  const obs         = (formData.get("observacoes")  as string)?.trim() || null;
  const redirect_to = (formData.get("redirect_to")  as string)?.trim() || "/rebanho";

  // Campos do bezerro (apenas para tipo PARIDA)
  const bezerro_nome = (formData.get("bezerro_nome") as string)?.trim() || null;
  const bezerro_rgn  = (formData.get("bezerro_rgn")  as string)?.trim() || null;
  const bezerro_sexo = (formData.get("bezerro_sexo") as string)?.trim() || null; // "M" | "F"

  if (!animal_id || !tipo) return;

  const supabase = await createClient();
  const valor = valor_str ? parseFloat(valor_str.replace(",", ".")) : null;

  if (["PARIDA", "ABORTOU", "REABSORVEU"].includes(tipo)) {
    // ── Desfecho de prenhez ───────────────────────────────────────────────────
    const novoStatus: Record<string, string> = {
      PARIDA:     "PARIDA",   // acabou de parir → status PARIDA
      ABORTOU:    "FALHADA",  // aborto → descarte
      REABSORVEU: "FALHADA",  // absorção → descarte
    };
    // resultado DG: PARIDA = POSITIVO (nasceu), aborto/absorção = NEGATIVO
    const resultadoDG = tipo === "PARIDA" ? "POSITIVO" : "NEGATIVO";

    let tid = transfer_id;
    if (!tid) {
      const { data: ts } = await supabase.from("transfers")
        .select("id")
        .eq("receptora_id", animal_id)
        .eq("farm_id", FARM_ID)
        .order("data_te", { ascending: false })
        .limit(1);
      tid = ts?.[0]?.id ?? null;
    }

    // Busca genealogia: dois selects simples (join aninhado falha silenciosamente)
    let doadora_nome:  string | null = null;
    let doadora_id_asp: string | null = null;
    let touro_nome:    string | null = null;
    if (tid) {
      const { data: tr } = await supabase
        .from("transfers")
        .select("aspiration_id")
        .eq("id", tid)
        .maybeSingle();
      if (tr?.aspiration_id) {
        const { data: asp } = await supabase
          .from("aspirations")
          .select("doadora_id, doadora_nome, touro_nome")
          .eq("id", tr.aspiration_id)
          .maybeSingle();
        doadora_nome   = asp?.doadora_nome ?? null;
        doadora_id_asp = asp?.doadora_id   ?? null;
        touro_nome     = asp?.touro_nome   ?? null;
      }
    }

    if (tid) {
      await supabase.from("pregnancy_diagnoses")
        .update({
          resultado:      resultadoDG,
          data_desfecho:  data_evento ?? null,
          tipo_desfecho:  tipo,           // grava PARIDA / ABORTOU / REABSORVEU
        })
        .eq("transfer_id", tid)
        .eq("farm_id", FARM_ID);
    }
    await supabase.from("animals")
      .update({ status_rebanho: novoStatus[tipo] ?? "VAZIA" })
      .eq("id", animal_id).eq("farm_id", FARM_ID);

    // ── Criar bezerro quando há nascimento ───────────────────────────────────
    if (tipo === "PARIDA" && bezerro_sexo) {
      const tipoAnimal = bezerro_sexo === "F" ? "DOADORA" : "TOURO";
      const nomeAnimal = bezerro_nome || (bezerro_sexo === "F" ? "Bezerra SE" : "Bezerro SE");
      const peso_nascimento_raw = (formData.get("peso_nascimento") as string)?.trim() || null;
      const peso_nascimento = peso_nascimento_raw ? parseFloat(peso_nascimento_raw) : null;

      const { data: novoAnimal } = await supabase.from("animals").insert({
        farm_id:    FARM_ID,
        tipo:       tipoAnimal,
        nome:       nomeAnimal,
        rgn:        bezerro_rgn ?? null,
        nascimento: data_evento ?? null,
        sexo:       bezerro_sexo,
        mae_nome:   doadora_nome,
        mae_id:     doadora_id_asp ?? null,  // link para a doadora cadastrada
        pai_nome:   touro_nome,
        nascido_se_agro: true,
        peso_atual:  (!isNaN(peso_nascimento!) && peso_nascimento! > 0) ? peso_nascimento : null,
      }).select("id").single();

      // Redireciona para a ficha do bezerro recém-criado
      if (novoAnimal?.id) {
        revalidatePath("/rebanho");
        revalidatePath("/reproducao");
        revalidatePath("/doadoras");
        revalidatePath("/machos");
        revalidatePath("/dashboard");
        redirect(bezerro_sexo === "F" ? `/doadoras/${novoAnimal.id}` : `/machos/${novoAnimal.id}`);
      }
    }

  } else if (tipo === "OBITO") {
    // ── Óbito ─────────────────────────────────────────────────────────────────
    const obsUpd = [obs, data_evento ? `Data: ${data_evento}` : null].filter(Boolean).join(" | ");
    await supabase.from("animals")
      .update({ status_rebanho: "MORTA", observacoes: obsUpd || null })
      .eq("id", animal_id).eq("farm_id", FARM_ID);
    // Marca DG como NEGATIVO para sair do dashboard
    let tid = transfer_id;
    if (!tid) {
      const { data: ts } = await supabase.from("transfers")
        .select("id").eq("receptora_id", animal_id).eq("farm_id", FARM_ID)
        .order("data_te", { ascending: false }).limit(1);
      tid = ts?.[0]?.id ?? null;
    }
    if (tid) {
      await supabase.from("pregnancy_diagnoses")
        .update({ resultado: "NEGATIVO", data_desfecho: data_evento ?? null, tipo_desfecho: "OBITO" })
        .eq("transfer_id", tid).eq("farm_id", FARM_ID);
    }

  } else if (tipo === "VENDA") {
    // ── Venda ─────────────────────────────────────────────────────────────────
    const brinco     = (formData.get("brinco") as string)?.trim() || null;
    const obsUpd = [obs, data_evento ? `Data: ${data_evento}` : null].filter(Boolean).join(" | ");
    await supabase.from("animals")
      .update({ status_rebanho: "VENDIDA", observacoes: obsUpd || null })
      .eq("id", animal_id).eq("farm_id", FARM_ID);

    // Busca brinco do animal caso não tenha vindo no form
    let nomeAnimal = brinco;
    if (!nomeAnimal) {
      const { data: a } = await supabase.from("animals")
        .select("brinco, nome").eq("id", animal_id).eq("farm_id", FARM_ID).maybeSingle();
      nomeAnimal = a?.brinco ?? a?.nome ?? null;
    }

    await supabase.from("transactions").insert({
      farm_id:     FARM_ID,
      tipo:        "VENDA",
      categoria:   "RECEPTORA",
      animal_nome: nomeAnimal,
      contraparte: obs ?? null,
      observacoes: obs ?? "Venda de receptora",
      valor_total: valor ?? null,
      n_parcelas:  1,
      data:        data_evento ?? new Date().toISOString().split("T")[0],
    });
  }

  revalidatePath("/rebanho");
  revalidatePath("/reproducao");
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath("/dashboard");
  redirect(redirect_to);
}

// ─── Editar localização de receptora ─────────────────────────────────────────
export async function editarLocalizacaoRebanho(formData: FormData) {
  const animal_id   = (formData.get("animal_id")   as string)?.trim();
  const localizacao = (formData.get("localizacao")  as string)?.trim() || null;
  if (!animal_id) return;
  const supabase = await createClient();
  await supabase.from("animals")
    .update({ localizacao })
    .eq("id", animal_id).eq("farm_id", FARM_ID);
  revalidatePath("/rebanho");
}

// ─── Registrar desfecho do animal (óbito ou venda) ───────────────────────────
export async function registrarDesfechoAnimal(formData: FormData) {
  const animal_id   = (formData.get("animal_id")   as string)?.trim();
  const tipo        = (formData.get("tipo")         as string)?.trim(); // OBITO | VENDA
  const data_evento = (formData.get("data_evento")  as string)?.trim() || null;
  const valor_str   = (formData.get("valor")        as string)?.trim() || null;
  const observacoes = (formData.get("observacoes")  as string)?.trim() || null;

  if (!animal_id || !tipo) return;

  const supabase = await createClient();
  const valor = valor_str ? parseFloat(valor_str.replace(",", ".")) : null;

  // Status resultante
  const novoStatus = tipo === "OBITO" ? "MORTA" : "VENDIDA";

  // Atualiza o animal
  await supabase
    .from("animals")
    .update({ status_rebanho: novoStatus })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  // Registra transação de venda (se for venda)
  if (tipo === "VENDA") {
    const { data: a } = await supabase.from("animals")
      .select("brinco, nome").eq("id", animal_id).eq("farm_id", FARM_ID).maybeSingle();
    const nomeAnimal = a?.brinco ?? a?.nome ?? null;

    await supabase.from("transactions").insert({
      farm_id:     FARM_ID,
      tipo:        "VENDA",
      categoria:   "RECEPTORA",
      animal_nome: nomeAnimal,
      contraparte: observacoes ?? null,
      observacoes: observacoes ?? "Venda de receptora",
      valor_total: valor ?? null,
      n_parcelas:  1,
      data:        data_evento ?? new Date().toISOString().split("T")[0],
    });
  }

  revalidatePath("/rebanho");
  redirect("/rebanho");
}

// ─── Cadastrar lote de animais ────────────────────────────────────────────────
export async function cadastrarLote(formData: FormData) {
  const supabase = await createClient();

  const classificacao = (formData.get("classificacao") as string) || "RECEPTORA";
  const data_entrada  = (formData.get("data_entrada")  as string) || null;
  const forma_entrada = (formData.get("forma_entrada") as string) || null;
  const localizacao   = (formData.get("localizacao")   as string)?.trim() || null;
  const brinco_inicio = parseInt(formData.get("brinco_inicio") as string) || 0;
  const brinco_fim    = parseInt(formData.get("brinco_fim")    as string) || 0;
  const prefixo       = (formData.get("prefixo") as string)?.trim() || "";
  const observacoes   = (formData.get("observacoes") as string)?.trim() || null;

  if (!brinco_inicio || !brinco_fim || brinco_fim < brinco_inicio) return;

  const animais = [];
  for (let n = brinco_inicio; n <= brinco_fim; n++) {
    const brinco = prefixo ? `${prefixo}${n}` : String(n);
    animais.push({
      farm_id:        FARM_ID,
      tipo:           classificacao === "DESCARTE" ? "DESCARTE" : "RECEPTORA",
      classificacao,
      nome:           brinco,
      brinco,
      data_entrada,
      forma_entrada,
      localizacao,
      observacoes,
      status_rebanho: classificacao === "DESCARTE" ? "DESCARTE" : "VAZIA",
    });
  }

  await supabase.from("animals").insert(animais);

  revalidatePath("/rebanho");
  redirect("/rebanho");
}
