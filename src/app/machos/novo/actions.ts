"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

export async function criarMacho(formData: FormData) {
  const nome                    = formData.get("nome") as string;
  const rgn                     = formData.get("rgn") as string || null;
  const rgd                     = formData.get("rgd") as string || null;
  const nascimento              = formData.get("nascimento") as string || null;
  const pai_nome                = formData.get("pai_nome") as string || null;
  const mae_nome                = formData.get("mae_nome") as string || null;
  const avo_paterno             = formData.get("avo_paterno") as string || null;
  const avo_paterna             = formData.get("avo_paterna") as string || null;
  const avo_materno             = formData.get("avo_materno") as string || null;
  const avo_materna             = formData.get("avo_materna") as string || null;
  const bisavo_pat_pat          = formData.get("bisavo_pat_pat") as string || null;
  const bisava_pat_pat          = formData.get("bisava_pat_pat") as string || null;
  const bisavo_pat_mat          = formData.get("bisavo_pat_mat") as string || null;
  const bisava_pat_mat          = formData.get("bisava_pat_mat") as string || null;
  const bisavo_materno          = formData.get("bisavo_materno") as string || null;
  const bisava_mat_pat          = formData.get("bisava_mat_pat") as string || null;
  const bisavo_materna          = formData.get("bisavo_materna") as string || null;
  const bisavo                  = formData.get("bisavo") as string || null;
  const localizacao             = formData.get("localizacao") as string || null;
  const percentual_proprio_raw  = formData.get("percentual_proprio") as string || null;
  const valor_parcela_raw       = formData.get("valor_parcela") as string || null;
  const observacoes             = formData.get("observacoes") as string || null;

  const exame_andrologico       = formData.get("exame_andrologico") as string || null;
  const data_exame              = formData.get("data_exame_andrologico") as string || null;
  const veterinario             = formData.get("veterinario_andrologico") as string || null;
  const ce_raw                  = formData.get("circunferencia_escrotal") as string || null;
  const data_ce                 = formData.get("data_ce") as string || null;

  if (!nome) return;

  const percentual_proprio = percentual_proprio_raw ? parseFloat(percentual_proprio_raw) / 100 : null;
  const valor_parcela = valor_parcela_raw ? parseFloat(valor_parcela_raw) : null;
  const ce = ce_raw ? parseFloat(ce_raw) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("animals")
    .insert({
      farm_id: FARM_ID,
      nome: nome.trim(),
      rgn: rgn || null,
      rgd: rgd || null,
      tipo: "TOURO",
      sexo: "M",
      nascimento: nascimento || null,
      pai_nome: pai_nome || null,
      mae_nome: mae_nome || null,
      avo_paterno: avo_paterno || null,
      avo_paterna: avo_paterna || null,
      avo_materno: avo_materno || null,
      avo_materna: avo_materna || null,
      bisavo_pat_pat: bisavo_pat_pat || null,
      bisava_pat_pat: bisava_pat_pat || null,
      bisavo_pat_mat: bisavo_pat_mat || null,
      bisava_pat_mat: bisava_pat_mat || null,
      bisavo_materno: bisavo_materno || null,
      bisava_mat_pat: bisava_mat_pat || null,
      bisavo_materna: bisavo_materna || null,
      bisavo: bisavo || null,
      localizacao: localizacao || null,
      percentual_proprio: percentual_proprio,
      valor_parcela: isNaN(valor_parcela as any) ? null : valor_parcela,
      observacoes: observacoes || null,
      exame_andrologico: exame_andrologico || null,
      data_exame_andrologico: data_exame || null,
      veterinario_andrologico: veterinario || null,
      circunferencia_escrotal: isNaN(ce as any) ? null : ce,
      data_ce: data_ce || null,
    })
    .select("id")
    .single();

  if (error || !data) redirect("/machos");

  // Vincular sócios (slots 1–3)
  for (const n of [1, 2, 3]) {
    const pid   = formData.get(`partner_id_${n}`) as string || null;
    const perc  = formData.get(`percentual_${n}`) as string || null;
    const parc  = formData.get(`parcela_${n}`) as string || null;
    if (!pid || !perc) continue;
    const percVal = parseFloat(perc) / 100;
    const parcVal = parc ? parseFloat(parc) : null;
    if (isNaN(percVal) || percVal <= 0) continue;
    await supabase.from("animal_partners").insert({
      animal_id: data.id,
      partner_id: pid,
      percentual: percVal,
      valor_parcela: isNaN(parcVal as any) ? null : parcVal,
    }).select();
  }

  redirect(`/machos/${data.id}`);
}
