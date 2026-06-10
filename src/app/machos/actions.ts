"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

/**
 * Atualiza campos editáveis inline na listagem de machos:
 * valor_parcela, percentual_proprio e localizacao.
 * Não faz redirect — retorna vazio para o client component fechar o modal.
 */
export async function atualizarCamposMacho(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const id = formData.get("id") as string;
  if (!id) return { ok: false, erro: "ID inválido" };

  const parcelaRaw  = formData.get("valor_parcela") as string;
  const percRaw     = formData.get("percentual_proprio") as string;
  const localizacao = (formData.get("localizacao") as string)?.trim() || null;
  const nascimento  = (formData.get("nascimento")  as string)?.trim() || null;

  const valor_parcela      = parcelaRaw ? parseFloat(parcelaRaw) : null;
  const percentual_proprio = percRaw    ? parseFloat(percRaw) / 100 : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("animals")
    .update({
      valor_parcela:      valor_parcela != null && !isNaN(valor_parcela) ? valor_parcela : null,
      percentual_proprio: percentual_proprio != null && !isNaN(percentual_proprio) ? percentual_proprio : null,
      localizacao,
      nascimento,
    })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/machos");
  revalidatePath("/pesagens");
  return { ok: true };
}
