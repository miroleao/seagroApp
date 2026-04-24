"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Toggle CDC-FIV: se não tem, seta "✓"; se já tem, limpa */
export async function toggleCdcFiv(formData: FormData) {
  const embryo_id = formData.get("embryo_id") as string;
  const atual      = formData.get("atual") as string; // "sim" | "nao"

  const supabase = await createClient();
  await supabase
    .from("embryos")
    .update({ numero_cdc_fiv: atual === "sim" ? null : "✓" })
    .eq("id", embryo_id);

  revalidatePath("/embrioes");
  redirect("/embrioes");
}

/** Toggle ADT-TE: mesmo padrão do CDC-FIV */
export async function toggleAdtTe(formData: FormData) {
  const embryo_id = formData.get("embryo_id") as string;
  const atual      = formData.get("atual") as string;

  const supabase = await createClient();
  await supabase
    .from("embryos")
    .update({ numero_adt_te: atual === "sim" ? null : "✓" })
    .eq("id", embryo_id);

  revalidatePath("/embrioes");
  redirect("/embrioes");
}

/** Toggle DNA: armazena flag "DNA:1" dentro de observacoes */
export async function toggleDna(formData: FormData) {
  const embryo_id  = formData.get("embryo_id") as string;
  const atual       = formData.get("atual") as string;
  const obs_base    = (formData.get("obs_base") as string) || "";

  const supabase = await createClient();

  let novaObs: string | null;
  if (atual === "sim") {
    // Remove o flag DNA:1
    novaObs = obs_base.replace(/DNA:1\s*\|?\s*/g, "").trim() || null;
  } else {
    // Adiciona o flag
    novaObs = obs_base ? `DNA:1 | ${obs_base}` : "DNA:1";
  }

  await supabase
    .from("embryos")
    .update({ observacoes: novaObs })
    .eq("id", embryo_id);

  revalidatePath("/embrioes");
  redirect("/embrioes");
}
