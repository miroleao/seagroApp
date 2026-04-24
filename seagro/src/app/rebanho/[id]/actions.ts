"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

// ─── Atualizar status reprodutivo ─────────────────────────────────────────────
export async function atualizarStatusRebanho(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase     = await createClient();
  const animal_id    = formData.get("animal_id") as string;
  const status       = formData.get("status_rebanho") as string;
  const observacoes  = (formData.get("observacoes") as string)?.trim() || null;

  if (!animal_id || !status) return { ok: false, erro: "Dados incompletos" };

  const { error } = await supabase
    .from("animals")
    .update({ status_rebanho: status, situacao: observacoes })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/rebanho/${animal_id}`);
  revalidatePath("/rebanho");
  return { ok: true };
}

// ─── Adicionar pesagem ────────────────────────────────────────────────────────
export async function adicionarPesagem(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase    = await createClient();
  const animal_id   = formData.get("animal_id") as string;
  const data        = formData.get("data") as string;
  const peso_kg_raw = formData.get("peso_kg") as string;
  const observacoes = (formData.get("observacoes") as string)?.trim() || null;

  if (!animal_id || !data || !peso_kg_raw) return { ok: false, erro: "Preencha data e peso" };

  const peso_kg = parseFloat(peso_kg_raw);
  if (isNaN(peso_kg) || peso_kg <= 0) return { ok: false, erro: "Peso inválido" };

  const { error } = await supabase.from("pesagens").insert({
    farm_id: FARM_ID, animal_id, data, peso_kg, observacoes,
  });

  if (error) return { ok: false, erro: error.message };

  // Atualiza peso_atual para o mais recente
  await supabase
    .from("animals")
    .update({ peso_atual: peso_kg })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/rebanho/${animal_id}`);
  revalidatePath("/rebanho");
  return { ok: true };
}

// ─── Registrar nascimento ─────────────────────────────────────────────────────
export async function registrarNascimento(formData: FormData) {
  const supabase       = await createClient();
  const receptora_id   = formData.get("receptora_id") as string;
  const transfer_id    = formData.get("transfer_id")  as string;
  const data_nascimento = formData.get("data_nascimento") as string;
  const sexo_nascido   = (formData.get("sexo_nascido") as string) || "F";
  const peso_nascimento = formData.get("peso_nascimento") as string;
  const obs_nascimento  = (formData.get("obs_nascimento") as string)?.trim() || null;

  // Busca o transfer para obter dados do embrião (doadora/touro)
  const { data: transfer } = await supabase
    .from("transfers")
    .select(`
      id, receptora_brinco,
      embryo:embryos (
        aspiration:aspirations ( doadora_id, doadora_nome, touro_nome )
      )
    `)
    .eq("id", transfer_id)
    .single();

  const asp       = (transfer?.embryo as any)?.aspiration;
  const doadora_id = asp?.doadora_id   ?? null;
  const doadora_nome = asp?.doadora_nome ?? null;
  const touro_nome   = asp?.touro_nome   ?? null;

  // 1. Cria o animal NASCIDO
  const { data: nascido } = await supabase
    .from("animals")
    .insert({
      farm_id:      FARM_ID,
      tipo:         "NASCIDO",
      sexo:         sexo_nascido,
      nome:         `Nascido ${data_nascimento}`,
      nascimento:   data_nascimento,
      mae_id:       doadora_id,
      mae_nome:     doadora_nome,
      pai_nome:     touro_nome,
      peso_atual:   peso_nascimento ? parseFloat(peso_nascimento) : null,
      observacoes:  obs_nascimento,
    })
    .select("id")
    .single();

  // 2. Atualiza o diagnóstico de prenhez para PARIDA
  await supabase
    .from("pregnancy_diagnoses")
    .update({ resultado: "PARIDA" })
    .eq("transfer_id", transfer_id)
    .eq("farm_id", FARM_ID);

  // 3. Zera a receptora: status VAZIA
  if (receptora_id) {
    await supabase
      .from("animals")
      .update({ status_rebanho: "VAZIA" })
      .eq("id", receptora_id)
      .eq("farm_id", FARM_ID);
  }

  revalidatePath(`/rebanho/${receptora_id}`);
  revalidatePath("/rebanho");
  revalidatePath("/reproducao/prenhezes");

  if (nascido?.id && sexo_nascido === "F") redirect(`/doadoras`);
  else redirect(`/rebanho/${receptora_id}`);
}

// ─── Atualizar dados gerais do animal ─────────────────────────────────────────
export async function atualizarDadosAnimal(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase      = await createClient();
  const animal_id     = formData.get("animal_id") as string;
  const classificacao = formData.get("classificacao") as string;
  const localizacao   = (formData.get("localizacao") as string)?.trim() || null;
  const data_entrada  = (formData.get("data_entrada") as string) || null;
  const forma_entrada = (formData.get("forma_entrada") as string) || null;
  const observacoes   = (formData.get("observacoes") as string)?.trim() || null;

  const { error } = await supabase
    .from("animals")
    .update({ classificacao, localizacao, data_entrada, forma_entrada, observacoes })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/rebanho/${animal_id}`);
  return { ok: true };
}
