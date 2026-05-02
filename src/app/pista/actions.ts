"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

// ─── Criar Exposição ─────────────────────────────────────────────────────────
export async function criarExposicao(formData: FormData) {
  const supabase = await createClient();

  const nome        = formData.get("nome") as string;
  const tipo        = formData.get("tipo") as string;
  const data_base   = formData.get("data_base") as string || null;
  const local       = formData.get("local") as string || null;
  const organizador = formData.get("organizador") as string || null;

  if (!nome) return;

  await supabase.from("exhibitions").insert({
    farm_id: FARM_ID,
    nome,
    tipo,
    data_base,
    local,
    organizador,
  });

  revalidatePath("/pista");
  redirect("/pista");
}

// ─── Criar Premiação ──────────────────────────────────────────────────────────
export async function criarPremiacao(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  const animal_id      = formData.get("animal_id") as string;
  const exhibition_id  = formData.get("exhibition_id") as string || null;
  const tipo_premio    = formData.get("tipo_premio") as string;
  // grupo_nelore aceita somente NELORE | NELORE_MOCHO | NELORE_PELAGENS
  const grupo_nelore   = (formData.get("grupo_nelore") as string) || "NELORE";
  const descricao_premio = formData.get("descricao_premio") as string || null;
  const observacoes    = formData.get("observacoes") as string || null;

  console.log("[criarPremiacao] animal_id=", animal_id, "tipo_premio=", tipo_premio, "grupo=", grupo_nelore, "descricao=", descricao_premio);

  if (!animal_id || !tipo_premio) {
    console.error("[criarPremiacao] ABORTADO — campos obrigatórios faltando", { animal_id, tipo_premio });
    return { ok: false, erro: "Campos obrigatórios faltando" };
  }

  const { error } = await supabase.from("awards").insert({
    farm_id: FARM_ID,
    animal_id,
    exhibition_id: exhibition_id || null,
    tipo_premio,
    grupo_nelore,
    descricao_premio,
    observacoes,
  });

  if (error) {
    console.error("[criarPremiacao] Supabase insert error:", JSON.stringify(error));
    return { ok: false, erro: error.message };
  }

  console.log("[criarPremiacao] Prêmio salvo com sucesso para animal_id=", animal_id);

  revalidatePath("/pista");
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath(`/doadoras/${animal_id}`);
  return { ok: true };
}
