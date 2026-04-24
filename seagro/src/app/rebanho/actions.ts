"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

// ─── Cadastrar animal individual ─────────────────────────────────────────────
export async function cadastrarAnimal(formData: FormData) {
  const supabase = await createClient();

  const brinco        = (formData.get("brinco")        as string)?.trim() || null;
  const nome          = (formData.get("nome")           as string)?.trim() || brinco || "Sem nome";
  const classificacao = (formData.get("classificacao")  as string) || "RECEPTORA";
  const data_entrada  = (formData.get("data_entrada")   as string) || null;
  const forma_entrada = (formData.get("forma_entrada")  as string) || null;
  const localizacao   = (formData.get("localizacao")    as string)?.trim() || null;
  const peso_inicial  = formData.get("peso_inicial") as string;
  const observacoes   = (formData.get("observacoes")    as string)?.trim() || null;

  if (!brinco && !nome) return;

  const { data: animal, error } = await supabase
    .from("animals")
    .insert({
      farm_id:        FARM_ID,
      tipo:           classificacao === "DESCARTE" ? "DESCARTE" : "RECEPTORA",
      classificacao,
      nome,
      brinco,
      data_entrada,
      forma_entrada,
      localizacao,
      observacoes,
      status_rebanho: classificacao === "DESCARTE" ? "DESCARTE" : "VAZIA",
      peso_atual:     peso_inicial ? parseFloat(peso_inicial) : null,
    })
    .select("id")
    .single();

  if (!error && animal && peso_inicial) {
    await supabase.from("pesagens").insert({
      farm_id:  FARM_ID,
      animal_id: animal.id,
      data:     data_entrada || new Date().toISOString().split("T")[0],
      peso_kg:  parseFloat(peso_inicial),
      observacoes: "Peso de entrada",
    });
  }

  revalidatePath("/rebanho");
  redirect("/rebanho");
}

// ─── Cadastrar lote de animais ────────────────────────────────────────────────
export async function cadastrarLote(formData: FormData) {
  const supabase = await createClient();

  const classificacao = (formData.get("classificacao") as string) || "RECEPTORA";
  const data_entrada  = (formData.get("data_entrada")  as string) || null;
  const forma_entrada = (formData.get("forma_entrada") as string) || null;
  const localizacao   = (formData.get("localizacao")   as string)?.trim() || null;
  const brinco_inicio = parseInt(formData.get("brinco_inicio") as string) || 0;
  const brinco_fim    = parseInt(formData.get("brinco_fim")    as string) || 0;
  const prefixo       = (formData.get("prefixo") as string)?.trim() || "";
  const observacoes   = (formData.get("observacoes") as string)?.trim() || null;

  if (!brinco_inicio || !brinco_fim || brinco_fim < brinco_inicio) return;

  const animais = [];
  for (let n = brinco_inicio; n <= brinco_fim; n++) {
    const brinco = prefixo ? `${prefixo}${n}` : String(n);
    animais.push({
      farm_id:        FARM_ID,
      tipo:           classificacao === "DESCARTE" ? "DESCARTE" : "RECEPTORA",
      classificacao,
      nome:           brinco,
      brinco,
      data_entrada,
      forma_entrada,
      localizacao,
      observacoes,
      status_rebanho: classificacao === "DESCARTE" ? "DESCARTE" : "VAZIA",
    });
  }

  await supabase.from("animals").insert(animais);

  revalidatePath("/rebanho");
  redirect("/rebanho");
}
