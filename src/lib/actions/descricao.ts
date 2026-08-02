"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

/**
 * Texto livre da ficha do animal.
 *
 * Grava em `animals.descricao` — coluna separada de `observacoes` de
 * propósito: aquela é sobrescrita pelos desfechos de óbito e venda, esta
 * é só do usuário e nunca é tocada pelo sistema.
 */
export async function salvarDescricaoAnimal(
  animalId: string,
  texto: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!animalId) return { ok: false, erro: "Animal não identificado" };

  const limpo = texto.trim();
  if (limpo.length > 20000) {
    return { ok: false, erro: "Texto muito longo (máx. 20 mil caracteres)" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("animals")
    .update({ descricao: limpo || null })
    .eq("id", animalId)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/doadoras/${animalId}`);
  revalidatePath(`/machos/${animalId}`);
  revalidatePath(`/rebanho/${animalId}`);
  return { ok: true };
}
