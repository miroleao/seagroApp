"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

export async function excluirMacho(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("animals").delete().eq("id", id).eq("farm_id", FARM_ID);

  revalidatePath("/machos");
  redirect("/machos");
}

export async function toggleParaPistaMacho(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("para_pista") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ para_pista: valor })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}

export async function toggleNascidoSeAgroMacho(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("nascido_se_agro") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ nascido_se_agro: valor })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}

export async function atualizarExameAndrologico(formData: FormData) {
  const id                   = formData.get("id") as string;
  const exame_andrologico    = formData.get("exame_andrologico") as string || null;
  const data_exame           = formData.get("data_exame_andrologico") as string || null;
  const veterinario          = formData.get("veterinario_andrologico") as string || null;
  const laudo                = formData.get("laudo_andrologico") as string || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({
      exame_andrologico:       exame_andrologico || null,
      data_exame_andrologico:  data_exame || null,
      veterinario_andrologico: veterinario || null,
      laudo_andrologico:       laudo || null,
    })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarCE(formData: FormData) {
  const id   = formData.get("id") as string;
  const ce   = parseFloat(formData.get("circunferencia_escrotal") as string);
  const data = formData.get("data_ce") as string || null;

  if (!id || isNaN(ce)) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({
      circunferencia_escrotal: ce,
      data_ce: data || null,
    })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarRgn(formData: FormData) {
  const id  = formData.get("id") as string;
  const rgn = (formData.get("rgn") as string)?.trim() || null;
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("animals").update({ rgn }).eq("id", id);
  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarRGD(formData: FormData) {
  const id  = formData.get("id") as string;
  const rgd = formData.get("rgd") as string || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ rgd: rgd || null })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarLocalizacaoMacho(formData: FormData) {
  const id         = formData.get("id") as string;
  const localizacao = formData.get("localizacao") as string || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ localizacao: localizacao || null })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarPesoMacho(formData: FormData) {
  const id   = formData.get("id") as string;
  const peso = parseFloat(formData.get("peso_atual") as string);

  if (!id || isNaN(peso)) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ peso_atual: peso })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function registrarPesagemMacho(formData: FormData) {
  const animal_id = formData.get("animal_id") as string;
  const data      = formData.get("data") as string;
  const peso_kg   = parseFloat(formData.get("peso_kg") as string);

  if (!animal_id || !data || isNaN(peso_kg)) return;

  const supabase = await createClient();
  await supabase
    .from("weight_records")
    .insert({ animal_id, farm_id: FARM_ID, data, peso_kg });

  revalidatePath(`/machos/${animal_id}`);
  revalidatePath("/machos");
  revalidatePath("/doadoras");
  revalidatePath("/pista");
  redirect(`/machos/${animal_id}`);
}

export async function adicionarPremiacaoMacho(formData: FormData) {
  const animal_id     = formData.get("animal_id") as string;
  const tipo_premio   = formData.get("tipo_premio") as string;
  const grupo_nelore  = formData.get("grupo_nelore") as string || null;
  const exhibition_id = formData.get("exhibition_id") as string || null;
  const observacoes   = formData.get("observacoes") as string || null;

  if (!animal_id || !tipo_premio) return;

  const supabase = await createClient();
  await supabase
    .from("awards")
    .insert({
      animal_id,
      farm_id: FARM_ID,
      tipo_premio,
      grupo_nelore: grupo_nelore || null,
      exhibition_id: exhibition_id || null,
      observacoes: observacoes || null,
    });

  revalidatePath(`/machos/${animal_id}`);
  redirect(`/machos/${animal_id}`);
}

// ─── Atualizar genealogia do touro ───────────────────────────────────────────
export async function atualizarGenealogiaTouro(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const get = (nome: string) =>
    (formData.get(nome) as string | null)?.trim() || null;

  const supabase = await createClient();

  // Campos base (pai, mãe, avós maternos, bisavó)
  await supabase.from("animals").update({
    pai_nome:    get("pai_nome"),
    mae_nome:    get("mae_nome"),
    avo_materno: get("avo_materno"),
    avo_materna: get("avo_materna"),
    bisavo:      get("bisavo"),
  }).eq("id", id).eq("farm_id", FARM_ID);

  // Campos estendidos (avós paternos + bisavós completos)
  const camposExtras: Record<string, string | null> = {
    avo_paterno:    get("avo_paterno"),
    avo_paterna:    get("avo_paterna"),
    bisavo_pat_pat: get("bisavo_pat_pat"),
    bisava_pat_pat: get("bisava_pat_pat"),
    bisavo_pat_mat: get("bisavo_pat_mat"),
    bisava_pat_mat: get("bisava_pat_mat"),
    bisavo_materno: get("bisavo_materno"),
    bisava_mat_pat: get("bisava_mat_pat"),
    bisavo_materna: get("bisavo_materna"),
  };

  const { error: extErr } = await supabase
    .from("animals")
    .update(camposExtras)
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  // Fallback: atualiza campo por campo se der erro (coluna ausente na migração)
  if (extErr) {
    for (const [campo, valor] of Object.entries(camposExtras)) {
      await supabase.from("animals")
        .update({ [campo]: valor })
        .eq("id", id)
        .eq("farm_id", FARM_ID);
    }
  }

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}
