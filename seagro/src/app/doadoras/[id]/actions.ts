"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

export async function toggleParaPista(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("para_pista") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ para_pista: valor })
    .eq("id", id);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/pista");
  redirect(`/doadoras/${id}`);
}

export async function atualizarPeso(formData: FormData) {
  const id   = formData.get("id") as string;
  const peso = parseFloat(formData.get("peso_atual") as string);

  if (!id || isNaN(peso)) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ peso_atual: peso })
    .eq("id", id);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/pista");
  redirect(`/doadoras/${id}`);
}

export async function registrarPesagem(formData: FormData) {
  const animal_id = formData.get("animal_id") as string;
  const data      = formData.get("data") as string;
  const peso_kg   = parseFloat(formData.get("peso_kg") as string);

  if (!animal_id || !data || isNaN(peso_kg)) return;

  const supabase = await createClient();
  await supabase.from("weight_records").insert({ animal_id, data, peso_kg });

  revalidatePath(`/doadoras/${animal_id}`);
  redirect(`/doadoras/${animal_id}`);
}

/** Toggle CDC-FIV do embrião (redireciona de volta para a ficha da doadora) */
export async function toggleEmbrioCdc(formData: FormData) {
  const embryo_id  = formData.get("embryo_id") as string;
  const atual       = formData.get("atual") as string;
  const doadora_id  = formData.get("doadora_id") as string;

  const supabase = await createClient();
  await supabase
    .from("embryos")
    .update({ numero_cdc_fiv: atual === "sim" ? null : "✓" })
    .eq("id", embryo_id);

  revalidatePath(`/doadoras/${doadora_id}`);
  redirect(`/doadoras/${doadora_id}`);
}

/** Toggle ADT-TE do embrião */
export async function toggleEmbrioAdt(formData: FormData) {
  const embryo_id  = formData.get("embryo_id") as string;
  const atual       = formData.get("atual") as string;
  const doadora_id  = formData.get("doadora_id") as string;

  const supabase = await createClient();
  await supabase
    .from("embryos")
    .update({ numero_adt_te: atual === "sim" ? null : "✓" })
    .eq("id", embryo_id);

  revalidatePath(`/doadoras/${doadora_id}`);
  redirect(`/doadoras/${doadora_id}`);
}

/** Toggle DNA do embrião (armazena em observacoes) */
export async function toggleEmbrioDna(formData: FormData) {
  const embryo_id  = formData.get("embryo_id") as string;
  const atual       = formData.get("atual") as string;
  const obs_base    = (formData.get("obs_base") as string) || "";
  const doadora_id  = formData.get("doadora_id") as string;

  const supabase = await createClient();
  let novaObs: string | null;
  if (atual === "sim") {
    novaObs = obs_base.replace(/DNA:1\s*\|?\s*/g, "").trim() || null;
  } else {
    novaObs = obs_base ? `DNA:1 | ${obs_base}` : "DNA:1";
  }

  await supabase
    .from("embryos")
    .update({ observacoes: novaObs })
    .eq("id", embryo_id);

  revalidatePath(`/doadoras/${doadora_id}`);
  redirect(`/doadoras/${doadora_id}`);
}

export async function atualizarLocalizacao(formData: FormData) {
  const id          = formData.get("id") as string;
  const localizacao = (formData.get("localizacao") as string).trim() || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase.from("animals").update({ localizacao }).eq("id", id);

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${id}`);
}

export async function adicionarSocio(formData: FormData) {
  const animal_id   = formData.get("animal_id") as string;
  const partner_id  = formData.get("partner_id") as string;
  const pct         = parseFloat(formData.get("percentual") as string);
  const parcela     = formData.get("valor_parcela") as string;

  if (!animal_id || !partner_id || isNaN(pct) || pct <= 0) return;

  const supabase = await createClient();
  await supabase.from("animal_partners").upsert(
    {
      animal_id,
      partner_id,
      percentual:    pct / 100,          // converte % para decimal (25 → 0.25)
      valor_parcela: parcela ? parseFloat(parcela) : null,
    },
    { onConflict: "animal_id,partner_id" }
  );

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${animal_id}`);
}

export async function removerSocio(formData: FormData) {
  const animal_id  = formData.get("animal_id") as string;
  const partner_id = formData.get("partner_id") as string;

  if (!animal_id || !partner_id) return;

  const supabase = await createClient();
  await supabase
    .from("animal_partners")
    .delete()
    .eq("animal_id", animal_id)
    .eq("partner_id", partner_id);

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${animal_id}`);
}

/** Cria um novo parceiro na tabela partners E já vincula ao animal */
export async function criarESocio(formData: FormData) {
  const animal_id   = formData.get("animal_id") as string;
  const nome        = ((formData.get("novo_nome") ?? "") as string).trim();
  const telefone    = ((formData.get("novo_telefone") ?? "") as string).trim() || null;
  const email       = ((formData.get("novo_email") ?? "") as string).trim() || null;
  const pct         = parseFloat(formData.get("novo_percentual") as string);
  const parcela     = (formData.get("novo_parcela") ?? "") as string;

  if (!animal_id || !nome || isNaN(pct) || pct <= 0) return;

  const supabase = await createClient();

  // 1. Insere o parceiro na tabela partners
  const { data: partner, error } = await supabase
    .from("partners")
    .insert({ farm_id: FARM_ID, nome, telefone, email })
    .select("id")
    .single();

  if (error || !partner) {
    console.error("Erro ao criar parceiro:", error);
    redirect(`/doadoras/${animal_id}`);
  }

  // 2. Vincula o parceiro ao animal
  await supabase.from("animal_partners").insert({
    animal_id,
    partner_id:   partner!.id,
    percentual:   pct / 100,
    valor_parcela: parcela ? parseFloat(parcela) : null,
  });

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${animal_id}`);
}

export async function atualizarTouroPrenhez(formData: FormData) {
  const id            = formData.get("id") as string;
  const touro_prenhez = (formData.get("touro_prenhez") as string).trim() || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase.from("animals").update({ touro_prenhez }).eq("id", id);

  revalidatePath(`/doadoras/${id}`);
  redirect(`/doadoras/${id}`);
}

export async function atualizarStatusReprodutivo(formData: FormData) {
  const id          = formData.get("id") as string;
  const status      = (formData.get("status_reprodutivo") as string) || null;
  const dataEvento  = (formData.get("data_status") as string) || null;
  const touroNome   = ((formData.get("touro_nome") ?? "") as string).trim() || null;
  const touroRgd    = ((formData.get("touro_rgd")  ?? "") as string).trim() || null;

  if (!id || !status) {
    if (id) redirect(`/doadoras/${id}`);
    return;
  }

  const supabase = await createClient();

  // ── 1. Sempre salva o status (coluna original, sempre existe) ────────────────
  await supabase
    .from("animals")
    .update({ status_reprodutivo: status })
    .eq("id", id);

  // ── 2. Campos extras que requerem a migração SQL (falham silenciosamente) ────

  if (status === "INSEMINADA" || status === "GESTANTE") {
    // Salva touro + data de inseminação
    await supabase.from("animals").update({
      touro_prenhez:    touroNome,
      rgd_touro_prenhez: touroRgd,
      data_inseminacao:  dataEvento,
      data_status:       dataEvento,
    }).eq("id", id);
  }

  else if (status === "PARIDA" && dataEvento) {
    // Lê dados atuais para calcular ordinal
    const { data: animal } = await supabase
      .from("animals")
      .select("numero_partos, data_primeiro_parto, touro_prenhez, rgd_touro_prenhez")
      .eq("id", id)
      .single();

    const numAtual    = ((animal as any)?.numero_partos ?? 0) as number;
    const novoNumero  = numAtual + 1;
    const touroPrenhez = touroNome || (animal as any)?.touro_prenhez || null;
    const rgdPrenhez   = touroRgd  || (animal as any)?.rgd_touro_prenhez  || null;

    const partoPayload: Record<string, unknown> = {
      data_status:           dataEvento,
      data_ultimo_parto:     dataEvento,
      numero_partos:         novoNumero,
      touro_ultimo_parto:    touroPrenhez,
      rgd_touro_ultimo_parto: rgdPrenhez,
      // Limpa os campos de prenhez ativa
      touro_prenhez:         null,
      rgd_touro_prenhez:     null,
      data_inseminacao:      null,
    };
    if (!(animal as any)?.data_primeiro_parto) {
      partoPayload.data_primeiro_parto = dataEvento;
    }
    await supabase.from("animals").update(partoPayload).eq("id", id);
  }

  else if (status === "ABORTOU" && dataEvento) {
    await supabase.from("animals").update({
      data_status:      dataEvento,
      // Limpa prenhez ativa
      touro_prenhez:    null,
      rgd_touro_prenhez: null,
      data_inseminacao: null,
    }).eq("id", id);
  }

  else {
    // Para os demais status, só salva a data
    if (dataEvento) {
      await supabase.from("animals").update({ data_status: dataEvento }).eq("id", id);
    }
  }

  revalidatePath(`/doadoras/${id}`);
  revalidatePath("/doadoras");
  redirect(`/doadoras/${id}`);
}

/** Registra uma venda na tabela transactions, pré-vinculando esta doadora */
export async function registrarVendaDoadora(formData: FormData) {
  const doadora_id     = (formData.get("doadora_id")     as string)?.trim();
  const tipo_detalhado = (formData.get("tipo_detalhado") as string) || "VENDA_ANIMAL";
  const contraparte    = (formData.get("contraparte")    as string) || null;
  const valorRaw       = formData.get("valor_total")     as string;
  const nParcelasRaw   = formData.get("n_parcelas")      as string;
  const dataRaw        = (formData.get("data")           as string) || null;
  const observacoes    = (formData.get("observacoes")    as string) || null;

  if (!doadora_id) redirect("/doadoras");

  const valor_total = parseFloat(valorRaw);
  const n_parcelas  = parseInt(nParcelasRaw) || 30;

  if (isNaN(valor_total) || valor_total <= 0) redirect(`/doadoras/${doadora_id}`);

  const supabase = await createClient();

  const prefixoMap: Record<string, string> = {
    VENDA_ANIMAL:    "",
    VENDA_PRENHEZ:   "Prenhez ",
    VENDA_ASPIRACAO: "Aspiração ",
  };
  const prefixo = prefixoMap[tipo_detalhado] ?? "";

  // Nome canônico da doadora
  const { data: animal } = await supabase
    .from("animals")
    .select("nome")
    .eq("id", doadora_id)
    .single();

  const animal_nome = animal?.nome
    ? `${prefixo}${animal.nome}`.trim()
    : null;

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      farm_id: FARM_ID,
      tipo: "VENDA",
      animal_nome,
      doadora_id,
      contraparte,
      valor_total,
      n_parcelas,
      data: dataRaw || new Date().toISOString().split("T")[0],
      observacoes,
    })
    .select("id")
    .single();

  if (txErr || !tx) {
    console.error("Erro ao registrar venda:", txErr);
    redirect(`/doadoras/${doadora_id}`);
  }

  // Gera parcelas mensais
  const valorParcela = valor_total / n_parcelas;
  const hoje = dataRaw ? new Date(dataRaw + "T12:00:00") : new Date();
  const parcelas = Array.from({ length: n_parcelas }, (_, i) => {
    const venc = new Date(hoje);
    venc.setMonth(venc.getMonth() + i + 1);
    return {
      farm_id: FARM_ID,
      transaction_id: tx.id,
      numero: i + 1,
      vencimento: venc.toISOString().split("T")[0],
      valor: parseFloat(valorParcela.toFixed(2)),
      status: "PENDENTE" as const,
    };
  });

  await supabase.from("installments").insert(parcelas);

  revalidatePath(`/doadoras/${doadora_id}`);
  revalidatePath("/financeiro");
  redirect(`/doadoras/${doadora_id}`);
}

export async function adicionarPremiacao(formData: FormData) {
  const animal_id     = formData.get("animal_id") as string;
  const exhibition_id = formData.get("exhibition_id") as string || null;
  const tipo_premio   = formData.get("tipo_premio") as string;
  const grupo_nelore  = formData.get("grupo_nelore") as string || null;
  const observacoes   = formData.get("observacoes") as string || null;

  if (!animal_id || !tipo_premio) return;

  const supabase = await createClient();
  await supabase.from("awards").insert({
    farm_id: FARM_ID,
    animal_id,
    exhibition_id: exhibition_id || null,
    tipo_premio,
    grupo_nelore,
    observacoes,
  });

  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath("/doadoras");
  revalidatePath("/pista");
  revalidatePath("/machos");
  redirect(`/doadoras/${animal_id}`);
}
