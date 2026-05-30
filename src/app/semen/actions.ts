"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

export async function criarSemen(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const touro_id            = (formData.get("touro_id")            as string)?.trim() || null;
  const touro_nome          = (formData.get("touro_nome")          as string)?.trim() || "";
  const touro_rgn           = (formData.get("touro_rgn")           as string)?.trim() || null;
  const doses_raw           = (formData.get("doses")               as string)?.trim();
  const tipo                = (formData.get("tipo")                as string)?.trim() || "CONVENCIONAL";
  const local_armazenamento = (formData.get("local_armazenamento") as string)?.trim() || null;
  const valor_raw           = (formData.get("valor_por_dose")      as string)?.trim();
  const observacoes         = (formData.get("observacoes")         as string)?.trim() || null;

  if (!touro_nome) return { ok: false, erro: "Nome do touro é obrigatório" };
  if (!["CONVENCIONAL", "SEXADO_FEMEA"].includes(tipo)) {
    return { ok: false, erro: "Tipo inválido" };
  }

  const doses = doses_raw ? parseInt(doses_raw, 10) : 0;
  if (isNaN(doses) || doses < 0) return { ok: false, erro: "Doses inválidas" };

  const valor_por_dose = valor_raw ? parseFloat(valor_raw.replace(",", ".")) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("semen_stock").insert({
    farm_id:             FARM_ID,
    touro_id,
    touro_nome,
    touro_rgn,
    doses,
    tipo,
    local_armazenamento,
    valor_por_dose,
    observacoes,
  });

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/semen");
  return { ok: true };
}

export async function atualizarSemen(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const id = (formData.get("id") as string)?.trim();
  if (!id) return { ok: false, erro: "ID inválido" };

  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  const touro_nome          = formData.get("touro_nome");
  const touro_rgn           = formData.get("touro_rgn");
  const doses               = formData.get("doses");
  const tipo                = formData.get("tipo");
  const local_armazenamento = formData.get("local_armazenamento");
  const valor_por_dose      = formData.get("valor_por_dose");
  const observacoes         = formData.get("observacoes");

  if (touro_nome !== null)          updates.touro_nome          = (touro_nome as string).trim() || null;
  if (touro_rgn !== null)           updates.touro_rgn           = (touro_rgn as string).trim() || null;
  if (doses !== null) {
    const n = parseInt((doses as string), 10);
    if (isNaN(n) || n < 0) return { ok: false, erro: "Doses inválidas" };
    updates.doses = n;
  }
  if (tipo !== null) {
    const t = (tipo as string).trim();
    if (!["CONVENCIONAL", "SEXADO_FEMEA"].includes(t)) return { ok: false, erro: "Tipo inválido" };
    updates.tipo = t;
  }
  if (local_armazenamento !== null) updates.local_armazenamento = (local_armazenamento as string).trim() || null;
  if (valor_por_dose !== null) {
    const v = (valor_por_dose as string).trim();
    updates.valor_por_dose = v ? parseFloat(v.replace(",", ".")) : null;
  }
  if (observacoes !== null) updates.observacoes = (observacoes as string).trim() || null;

  const { error } = await supabase
    .from("semen_stock")
    .update(updates)
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/semen");
  return { ok: true };
}

export async function excluirSemen(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const id = (formData.get("id") as string)?.trim();
  if (!id) return { ok: false, erro: "ID inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("semen_stock")
    .delete()
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/semen");
  return { ok: true };
}
