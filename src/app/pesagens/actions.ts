"use server";

import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export async function atualizarCampoAnimal(
  animalId: string,
  campo: "nascimento" | "nome" | "rgn" | "brinco",
  valor: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("animals")
    .update({ [campo]: valor || null })
    .eq("id", animalId)
    .eq("farm_id", FARM_ID);

  if (error) throw new Error(error.message);
  revalidatePath("/pesagens");
}
