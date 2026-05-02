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
  const asp_id        = (formData.get("asp_id")        as string)?.trim();
  const resultado     = (formData.get("resultado")     as string)?.trim(); // ABORTO | OBITO_RECEPTORA
  const data_resultado = (formData.get("data_resultado") as string)?.trim() || null;
  if (!asp_id || !resultado) return;

  const supabase = await createClient();
  const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
  const novaObs = buildObs(asp?.observacoes ?? null, { RESULTADO: resultado, DATA_RESULTADO: data_resultado });
  await supabase.from("aspirations").update({ observacoes: novaObs || null }).eq("id", asp_id);

  revalidatePath("/reproducao/prenhezes");
}

// ── Nascimento ────────────────────────────────────────────────────────────────

export async function registrarNascimento(formData: FormData) {
  const nome         = (formData.get("nome")         as string)?.trim();
  const nascimento   = (formData.get("nascimento")   as string);
  const sexo         = (formData.get("sexo")         as string);
  const asp_id       = (formData.get("asp_id")       as string)?.trim() || null;
  const doadora_nome = (formData.get("doadora_nome") as string)?.trim() || null;
  const touro_nome   = (formData.get("touro_nome")   as string)?.trim() || null;

  if (!nome || !nascimento || !sexo) return;

  const tipo = sexo === "F" ? "DOADORA" : "TOURO";
  const supabase = await createClient();

  const { data: animal, error } = await supabase
    .from("animals")
    .insert({ farm_id: FARM_ID, tipo, nome, nascimento, sexo, mae_nome: doadora_nome, pai_nome: touro_nome, situacao: "ATIVA" })
    .select("id")
    .single();

  if (error || !animal) {
    console.error("Erro ao registrar nascimento:", error);
    revalidatePath("/reproducao/prenhezes");
    return;
  }

  // Marca resultado na aspiração
  if (asp_id) {
    const { data: asp } = await supabase.from("aspirations").select("observacoes").eq("id", asp_id).single();
    const novaObs = buildObs(asp?.observacoes ?? null, { RESULTADO: "NASCIMENTO", DATA_RESULTADO: nascimento });
    await supabase.from("aspirations").update({ observacoes: novaObs || null }).eq("id", asp_id);
  }

  revalidatePath("/reproducao/prenhezes");
  revalidatePath("/doadoras");
  revalidatePath("/machos");

  redirect(sexo === "F" ? `/doadoras/${animal.id}` : `/machos/${animal.id}`);
}
