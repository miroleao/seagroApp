"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

// ── Helpers de observacoes ────────────────────────────────────────────────────

function buildObs(base: string | null, updates: Record<string, string | null>): string {
  const map: Record<string, string> = {};
  if (base) {
    for (const part of base.split("|")) {
      const [k, ...rest] = part.trim().split(":");
      if (k && rest.length) map[k.trim()] = rest.join(":").trim();
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v) map[k] = v;
    else delete map[k];
  }
  return Object.entries(map).map(([k, v]) => `${k}:${v}`).join(" | ");
}

// ── Helper: garante embrião para a aspiração ──────────────────────────────────

async function garantirEmbriao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  asp_id: string
): Promise<string | null> {
  const { data: existente } = await supabase
    .from("embryos")
    .select("id")
    .eq("aspiration_id", asp_id)
    .limit(1)
    .maybeSingle();

  if (existente?.id) return existente.id;

  const { data: novo } = await supabase
    .from("embryos")
    .insert({ aspiration_id: asp_id, situacao: "TRANSFERIDO" })
    .select("id")
    .single();

  return novo?.id ?? null;
}

// ── Receptora: brinco ─────────────────────────────────────────────────────────

export async function atualizarReceptoraBrinco(formData: FormData) {
  const animal_id   = (formData.get("animal_id")   as string)?.trim() || null;
  const transfer_id = (formData.get("transfer_id") as string)?.trim() || null;
  const brinco      = (formData.get("brinco")      as string)?.trim() || null;

  const supabase = await createClient();

  if (animal_id) {
    await supabase.from("animals").update({ brinco, nome: brinco ?? undefined }).eq("id", animal_id);
  } else if (transfer_id) {
    const { data: novo } = await supabase
      .from("animals")
      .insert({ farm_id: FARM_ID, tipo: "RECEPTORA", nome: brinco ?? "Receptora", brinco })
      .select("id")
      .single();
    if (novo) {
      await supabase.from("transfers").update({ receptora_id: novo.id, receptora_brinco: brinco }).eq("id", transfer_id);
    } else {
      await supabase.from("transfers").update({ receptora_brinco: brinco }).eq("id", transfer_id);
    }
  }

  revalidatePath("/reproducao/prenhezes");
}

// ── Receptora: RGN (usado apenas na ficha) ────────────────────────────────────

export async function atualizarReceptoraRgn(formData: FormData) {
  const animal_id   = (formData.get("animal_id")   as string)?.trim() || null;
  const transfer_id = (formData.get("transfer_id") as string)?.trim() || null;
  const rgn         = (formData.get("rgn")         as string)?.trim() || null;

  const supabase = await createClient();

  if (animal_id) {
    await supabase.from("animals").update({ rgn }).eq("id", animal_id);
  } else if (transfer_id) {
    const { data: tr } = await supabase
      .from("transfers").select("receptora_brinco, receptora_id").eq("id", transfer_id).single();

    if (tr?.receptora_id) {
      await supabase.from("animals").update({ rgn }).eq("id", tr.receptora_id);
    } else {
      const { data: novo } = await supabase
        .from("animals")
        .insert({ farm_id: FARM_ID, tipo: "RECEPTORA", nome: tr?.receptora_brinco ?? "Receptora", brinco: tr?.receptora_brinco ?? null, rgn })
        .select("id").single();
      if (novo) {
        await supabase.from("transfers").update({ receptora_id: novo.id }).eq("id", transfer_id);
      }
    }
  }

  revalidatePath("/reproducao/prenhezes");
}

// ── Embrião: CDC-FIV (usado na ficha) ────────────────────────────────────────

export async function atualizarCdcFiv(formData: FormData) {
  const embryo_id = (formData.get("embryo_id") as string)?.trim() || null;
  const asp_id    = (formData.get("asp_id")    as string)?.trim() || null;
  const numero    = (formData.get("numero_cdc_fiv") as string)?.trim() || null;

  const supabase = await createClient();
  const eid = embryo_id ?? (asp_id ? await garantirEmbriao(supabase, asp_id) : null);
  if (!eid) return;

  await supabase.from("embryos").update({ numero_cdc_fiv: numero }).eq("id", eid);
  revalidatePath("/reproducao/prenhezes");
}

// ── Embrião: Sexagem (usado na ficha) ────────────────────────────────────────

export async function atualizarSexagem(formData: FormData) {
  const embryo_id = (formData.get("embryo_id") as string)?.trim() || null;
  const asp_id    = (formData.get("asp_id")    as string)?.trim() || null;
  const sexagem   = (formData.get("sexagem")   as string)?.trim() || null;

  const supabase = await createClient();
  const eid = embryo_id ?? (asp_id ? await garantirEmbriao(supabase, asp_id) : null);
  if (!eid) return;

  await supabase.from("embryos").update({ sexagem }).eq("id", eid);
  revalidatePath("/reproducao/prenhezes");
}

// ── Embrião: ADT-TE (usado na ficha) ─────────────────────────────────────────

export async function toggleAdtTe(formData: FormData) {
  const embryo_id = (formData.get("embryo_id") as string)?.trim() || null;
  const asp_id    = (formData.get("asp_id")    as string)?.trim() || null;
  const checked   = formData.get("adt_te") === "on";

  const supabase = await createClient();
  const eid = embryo_id ?? (asp_id ? await garantirEmbriao(supabase, asp_id) : null);
  if (!eid) return;

  await supabase.from("embryos").update({ numero_adt_te: checked ? "SIM" : null }).eq("id", eid);
  revalidatePath("/reproducao/prenhezes");
}

// ── Situação de reposição ─────────────────────────────────────────────────────

export async function atualizarSituacaoReposicao(formData: FormData) {
  const asp_id   = (formData.get("asp_id")   as string)?.trim();
  const situacao = (formData.get("situacao") as string)?.trim() || null;
  if (!asp_id) return;

  const supabase = await createClient();
  const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
  const novaObs = buildObs(asp?.observacoes ?? null, { SITUACAO_REPOSICAO: situacao });
  await supabase.from("aspirations").update({ observacoes: novaObs || null }).eq("id", asp_id);

  revalidatePath("/reproducao/prenhezes");
}

// ── Data de entrega (nova) ────────────────────────────────────────────────────

export async function atualizarDataEntrega(formData: FormData) {
  const asp_id       = (formData.get("asp_id")        as string)?.trim();
  const data_entrega = (formData.get("data_entrega")  as string)?.trim() || null;
  if (!asp_id) return;

  const supabase = await createClient();
  const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
  const novaObs = buildObs(asp?.observacoes ?? null, { DATA_ENTREGA: data_entrega });
  await supabase.from("aspirations").update({ observacoes: novaObs || null }).eq("id", asp_id);

  revalidatePath("/reproducao/prenhezes");
}

// ── Desfecho: Aborto ou Óbito da Receptora ────────────────────────────────────

export async function registrarDesfecho(formData: FormData) {
  const asp_id         = (formData.get("asp_id")         as string)?.trim();
  const resultado      = (formData.get("resultado")      as string)?.trim(); // ABORTO | OBITO_RECEPTORA
  const data_resultado = (formData.get("data_resultado") as string)?.trim() || null;
  const transfer_id    = (formData.get("transfer_id")    as string)?.trim() || null;
  const receptora_id   = (formData.get("receptora_id")   as string)?.trim() || null;
  if (!asp_id || !resultado) return;

  const supabase = await createClient();

  // 1 — Salva resultado na aspiração
  const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
  const novaObs = buildObs(asp?.observacoes ?? null, { RESULTADO: resultado, DATA_RESULTADO: data_resultado });
  await supabase.from("aspirations").update({ observacoes: novaObs || null }).eq("id", asp_id);

  // 2 — Atualiza status da receptora
  if (receptora_id) {
    const novoStatus = resultado === "OBITO_RECEPTORA" ? "MORTA" : "FALHADA";
    await supabase.from("animals")
      .update({ status_rebanho: novoStatus })
      .eq("id", receptora_id)
      .eq("farm_id", FARM_ID);
  }

  // 3 — Marca DG como NEGATIVO
  if (transfer_id) {
    await supabase.from("pregnancy_diagnoses")
      .update({ resultado: "NEGATIVO" })
      .eq("transfer_id", transfer_id);
  }

  revalidatePath("/reproducao/prenhezes");
  revalidatePath("/rebanho");
  revalidatePath("/dashboard");
}

// ── Nascimento ────────────────────────────────────────────────────────────────

export async function registrarNascimento(formData: FormData) {
  const nome               = (formData.get("nome")               as string)?.trim();
  const nascimento         = (formData.get("nascimento")         as string);
  const sexo               = (formData.get("sexo")               as string);
  const rgn                = (formData.get("rgn")                as string)?.trim() || null;
  const asp_id             = (formData.get("asp_id")             as string)?.trim() || null;
  const transfer_id        = (formData.get("transfer_id")        as string)?.trim() || null;
  const receptora_id       = (formData.get("receptora_id")       as string)?.trim() || null;
  const doadora_nome       = (formData.get("doadora_nome")       as string)?.trim() || null;
  const touro_nome         = (formData.get("touro_nome")         as string)?.trim() || null;
  const percentual_raw     = (formData.get("percentual_proprio") as string)?.trim();
  const percentual_proprio = percentual_raw ? parseFloat(percentual_raw) / 100 : 1.0;
  const nascido_se_agro    = formData.get("nascido_se_agro") === "on";

  if (!nome || !nascimento || !sexo) return;

  const tipo = sexo === "F" ? "DOADORA" : "TOURO";
  const supabase = await createClient();

  const { data: animal, error } = await supabase
    .from("animals")
    .insert({
      farm_id: FARM_ID,
      tipo,
      nome,
      nascimento,
      sexo,
      rgn,
      mae_nome: doadora_nome,
      pai_nome: touro_nome,
      situacao: "ATIVA",
      percentual_proprio: isNaN(percentual_proprio) ? 1.0 : percentual_proprio,
      nascido_se_agro,
    })
    .select("id")
    .single();

  if (error || !animal) {
    console.error("Erro ao registrar nascimento:", error);
    revalidatePath("/reproducao/prenhezes");
    return;
  }

  // Marca resultado na aspiração e linka o animal nascido
  if (asp_id) {
    const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
    const novaObs = buildObs(asp?.observacoes ?? null, { RESULTADO: "NASCIMENTO", DATA_RESULTADO: nascimento });
    await supabase.from("aspirations").update({
      observacoes:         novaObs || null,
      animal_nascido_id:   animal.id,
      animal_nascido_tipo: tipo,          // "DOADORA" | "TOURO"
    }).eq("id", asp_id);
  }

  // Libera a receptora após parto
  // Se receptora_id vier direto, usa; senão resolve via transfer_id
  let idReceptora = receptora_id;
  if (!idReceptora && transfer_id) {
    const { data: tr } = await supabase
      .from("transfers")
      .select("receptora_id, receptora_brinco")
      .eq("id", transfer_id)
      .single();
    idReceptora = tr?.receptora_id ?? null;

    // Se ainda não tem id mas tem brinco, tenta resolver pelo brinco
    if (!idReceptora && tr?.receptora_brinco) {
      const { data: animalPorBrinco } = await supabase
        .from("animals")
        .select("id")
        .eq("farm_id", FARM_ID)
        .eq("brinco", tr.receptora_brinco)
        .maybeSingle();
      idReceptora = animalPorBrinco?.id ?? null;
    }
  }

  if (idReceptora) {
    await supabase.from("animals")
      .update({ status_rebanho: "PARIDA" })
      .eq("id", idReceptora)
      .eq("farm_id", FARM_ID);
  }

  // Marca DG com resultado do nascimento
  if (transfer_id) {
    await supabase.from("pregnancy_diagnoses")
      .update({ resultado: "POSITIVO" })
      .eq("transfer_id", transfer_id);
  }

  revalidatePath("/reproducao/prenhezes");
  revalidatePath("/rebanho");
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath("/dashboard");

  redirect(sexo === "F" ? `/doadoras/${animal.id}` : `/machos/${animal.id}`);
}

// ── Marcar prenhez como Nascido (sem criar novo animal) ───────────────────────
// Útil quando o animal já foi cadastrado diretamente em outra aba
export async function marcarComoNascido(formData: FormData) {
  const asp_id          = (formData.get("asp_id") as string)?.trim();
  const data_resultado  = (formData.get("data_resultado") as string) || new Date().toISOString().split("T")[0];

  if (!asp_id) return;

  const supabase = await createClient();
  const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
  const novaObs = buildObs(asp?.observacoes ?? null, { RESULTADO: "NASCIMENTO", DATA_RESULTADO: data_resultado });
  await supabase.from("aspirations").update({ observacoes: novaObs || null }).eq("id", asp_id);

  revalidatePath("/reproducao/prenhezes");
  redirect("/reproducao/prenhezes");
}

// ── Vincular animal já existente à prenhez ────────────────────────────────────
// Linka um animal já cadastrado (não cria duplicata) e marca como nascido
export async function vincularAnimalExistente(formData: FormData) {
  const asp_id         = (formData.get("asp_id") as string)?.trim();
  const animal_id      = (formData.get("animal_id") as string)?.trim();
  const data_resultado = (formData.get("data_resultado") as string) || new Date().toISOString().split("T")[0];

  if (!asp_id || !animal_id) return;

  const supabase = await createClient();

  // Busca tipo do animal para saber a rota
  const { data: animal } = await supabase
    .from("animals")
    .select("tipo")
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID)
    .single();

  // Marca aspiration como nascido e linka o animal
  const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
  const novaObs = buildObs(asp?.observacoes ?? null, { RESULTADO: "NASCIMENTO", DATA_RESULTADO: data_resultado });
  await supabase.from("aspirations").update({
    observacoes:         novaObs || null,
    animal_nascido_id:   animal_id,
    animal_nascido_tipo: animal?.tipo ?? null,
  }).eq("id", asp_id);

  revalidatePath("/reproducao/prenhezes");
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  redirect("/reproducao/prenhezes");
}
