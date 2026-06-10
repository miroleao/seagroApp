"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

/**
 * Registra óbito ou venda de uma doadora ou touro.
 * Não faz redirect — retorna { ok, erro } para o client component fechar o painel.
 */
export async function registrarDesfecho(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const animal_id   = (formData.get("animal_id")   as string)?.trim();
  const tipo        = (formData.get("tipo")         as string)?.trim(); // OBITO | VENDA
  const tipo_animal = (formData.get("tipo_animal")  as string)?.trim(); // TOURO | DOADORA
  const data_evento = (formData.get("data_evento")  as string)?.trim() || null;
  const valor_str   = (formData.get("valor")        as string)?.trim() || null;
  const observacoes = (formData.get("observacoes")  as string)?.trim() || null;

  if (!animal_id || !tipo) return { ok: false, erro: "Dados incompletos" };

  const supabase = await createClient();
  const valor = valor_str ? parseFloat(valor_str.replace(",", ".")) : null;

  const novoStatus = tipo === "OBITO" ? "MORTA" : "VENDIDA";
  const dataEvento = data_evento ?? new Date().toISOString().split("T")[0];

  // Atualiza o animal
  const { error: errAnimal } = await supabase
    .from("animals")
    .update({ status_rebanho: novoStatus, data_saida: dataEvento })
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID);

  if (errAnimal) return { ok: false, erro: errAnimal.message };

  // Registra transação de venda com categoria correta
  if (tipo === "VENDA") {
    const { data: a } = await supabase
      .from("animals")
      .select("brinco, nome, rgn")
      .eq("id", animal_id)
      .eq("farm_id", FARM_ID)
      .maybeSingle();

    const nomeAnimal = a?.nome ?? a?.brinco ?? a?.rgn ?? null;
    const categoriaMap: Record<string, string> = {
      TOURO:   "TOURO",
      DOADORA: "DOADORA",
    };
    const categoria = categoriaMap[tipo_animal] ?? "DOADORA";

    await supabase.from("transactions").insert({
      farm_id:     FARM_ID,
      tipo:        "VENDA",
      categoria,
      animal_nome: nomeAnimal,
      contraparte: observacoes ?? null,
      observacoes: observacoes ?? `Venda de ${categoria.toLowerCase()}`,
      valor_total: valor ?? null,
      n_parcelas:  1,
      data:        dataEvento,
    });
  }

  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/pesagens");
  return { ok: true };
}
