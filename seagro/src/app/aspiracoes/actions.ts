"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

export async function registrarOPU(formData: FormData) {
  const data        = formData.get("data") as string;
  const local       = (formData.get("local") as string) || null;
  const responsavel = (formData.get("responsavel") as string) || null;
  const laboratorio = (formData.get("laboratorio") as string) || null;
  const doadora_id  = (formData.get("doadora_id") as string) || null;
  const touro_nome  = (formData.get("touro_nome") as string) || null;
  const oocitosRaw  = formData.get("oocitos_viaveis") as string;
  const embrioesRaw = formData.get("embryos_congelados") as string;
  const custoRaw    = formData.get("custo_total") as string;
  const observacoes = (formData.get("observacoes") as string) || null;

  if (!data) return;

  const oocitos_viaveis    = oocitosRaw  !== "" ? parseInt(oocitosRaw)   : null;
  const embryos_congelados = embrioesRaw !== "" ? parseInt(embrioesRaw)  : null;
  const custo_total        = custoRaw    !== "" ? parseFloat(custoRaw)   : null;

  const supabase = await createClient();

  // Busca o nome canônico da doadora para salvar na aspiração
  let doadora_nome: string | null = null;
  if (doadora_id) {
    const { data: animal } = await supabase
      .from("animals")
      .select("nome")
      .eq("id", doadora_id)
      .single();
    doadora_nome = animal?.nome ?? null;
  }

  const { data: session, error: sessErr } = await supabase
    .from("opu_sessions")
    .insert({ farm_id: FARM_ID, data, tipo: "REALIZADA", local, responsavel, laboratorio })
    .select("id")
    .single();

  if (sessErr || !session) {
    console.error("Erro ao criar sessão OPU:", sessErr);
    redirect("/aspiracoes");
  }

  await supabase.from("aspirations").insert({
    farm_id: FARM_ID,
    session_id: session.id,
    doadora_id:  doadora_id  || null,
    doadora_nome,
    touro_nome,
    oocitos_viaveis,
    embryos_congelados,
    custo_total,
    observacoes,
  });

  revalidatePath("/aspiracoes");
  redirect("/aspiracoes");
}

export async function registrarPrenhez(formData: FormData) {
  const data             = (formData.get("data") as string) || new Date().toISOString().split("T")[0];
  const local            = (formData.get("local") as string) || null;
  const doadora_id       = (formData.get("doadora_id") as string) || null;
  const touro_nome       = (formData.get("touro_nome") as string) || null;
  const custoRaw         = formData.get("custo_total") as string;
  const custo_total      = custoRaw !== "" ? parseFloat(custoRaw) : null;
  const previsao_parto   = (formData.get("data_previsao_parto") as string) || null;
  const obs_extra        = (formData.get("observacoes") as string) || null;

  // Compõe observacoes: "PARTO:2026-09-15 | obs extra"
  let observacoes: string | null = null;
  if (previsao_parto) {
    observacoes = `PARTO:${previsao_parto}${obs_extra ? ` | ${obs_extra}` : ""}`;
  } else {
    observacoes = obs_extra;
  }

  const supabase = await createClient();

  const { data: session, error: sessErr } = await supabase
    .from("opu_sessions")
    .insert({ farm_id: FARM_ID, data, tipo: "COMPRADA", local })
    .select("id")
    .single();

  if (sessErr || !session) {
    console.error("Erro ao criar sessão COMPRADA:", sessErr);
    redirect("/aspiracoes");
  }

  await supabase.from("aspirations").insert({
    farm_id: FARM_ID,
    session_id: session.id,
    doadora_id: doadora_id || null,
    touro_nome,
    custo_total,
    observacoes,
  });

  revalidatePath("/aspiracoes");
  redirect("/aspiracoes");
}

/** Alterna o tipo de uma sessão entre REALIZADA (OPU) e COMPRADA (Prenhez) */
export async function alternarTipoSessao(formData: FormData) {
  const session_id = formData.get("session_id") as string;
  const tipo_atual = formData.get("tipo_atual") as string;
  const novo_tipo  = tipo_atual === "REALIZADA" ? "COMPRADA" : "REALIZADA";

  const supabase = await createClient();
  await supabase
    .from("opu_sessions")
    .update({ tipo: novo_tipo })
    .eq("id", session_id);

  revalidatePath("/aspiracoes");
  redirect("/aspiracoes");
}

/** Salva a previsão de parto em aspirations.observacoes no formato "PARTO:YYYY-MM-DD | obs" */
export async function salvarPrevisaoParto(formData: FormData) {
  const aspiration_id    = formData.get("aspiration_id") as string;
  const data_previsao    = (formData.get("data_previsao_parto") as string) || null;
  const obs_extra        = (formData.get("obs_extra") as string) || null;

  let observacoes: string | null = null;
  if (data_previsao) {
    observacoes = `PARTO:${data_previsao}${obs_extra ? ` | ${obs_extra}` : ""}`;
  } else {
    observacoes = obs_extra;
  }

  const supabase = await createClient();
  await supabase
    .from("aspirations")
    .update({ observacoes })
    .eq("id", aspiration_id);

  revalidatePath("/aspiracoes");
  redirect("/aspiracoes");
}
