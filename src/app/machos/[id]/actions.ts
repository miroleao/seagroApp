"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

export async function excluirMacho(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("animals").delete().eq("id", id).eq("farm_id", FARM_ID);

  revalidatePath("/machos");
  redirect("/machos");
}

export async function toggleParaPistaMacho(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("para_pista") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ para_pista: valor })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}

export async function toggleParaLeilaoMacho(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("para_leilao") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ para_leilao: valor })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}

export async function salvarInfoLeilaoMacho(formData: FormData) {
  const animal_id           = formData.get("animal_id") as string;
  const convite_nome        = (formData.get("convite_nome") as string)?.trim() || null;
  const convite_data        = (formData.get("convite_data") as string) || null;
  const convite_promotores  = (formData.get("convite_promotores") as string)?.trim() || null;
  const compra_leilao_nome  = (formData.get("compra_leilao_nome") as string)?.trim() || null;
  const compra_leilao_data  = (formData.get("compra_leilao_data") as string) || null;
  const compra_parcela_raw    = formData.get("compra_valor_parcela") as string;
  const meta_parcela_raw      = formData.get("meta_valor_parcela") as string;
  const venda_comprador       = (formData.get("venda_comprador") as string)?.trim() || null;
  const venda_parcela_raw     = formData.get("venda_valor_parcela") as string;
  const venda_n_parcelas_raw  = formData.get("venda_n_parcelas") as string;
  const venda_percentual_raw  = formData.get("venda_percentual") as string;

  const compra_valor_parcela  = compra_parcela_raw   ? parseFloat(compra_parcela_raw)   : null;
  const meta_valor_parcela    = meta_parcela_raw     ? parseFloat(meta_parcela_raw)     : null;
  const venda_valor_parcela   = venda_parcela_raw    ? parseFloat(venda_parcela_raw)    : null;
  const venda_n_parcelas      = venda_n_parcelas_raw ? parseInt(venda_n_parcelas_raw)   : null;
  const venda_percentual      = venda_percentual_raw ? parseFloat(venda_percentual_raw) : null;

  if (!animal_id) return;

  const supabase = await createClient();

  const payload = {
    convite_nome,
    convite_data:        convite_data        || null,
    convite_promotores,
    compra_leilao_nome,
    compra_leilao_data:  compra_leilao_data  || null,
    compra_valor_parcela: (compra_valor_parcela != null && !isNaN(compra_valor_parcela)) ? compra_valor_parcela : null,
    meta_valor_parcela:   (meta_valor_parcela   != null && !isNaN(meta_valor_parcela))   ? meta_valor_parcela   : null,
    venda_comprador,
    venda_valor_parcela:  (venda_valor_parcela  != null && !isNaN(venda_valor_parcela))  ? venda_valor_parcela  : null,
    venda_n_parcelas:     (venda_n_parcelas     != null && !isNaN(venda_n_parcelas))     ? venda_n_parcelas     : null,
    venda_percentual:     (venda_percentual     != null && !isNaN(venda_percentual))     ? venda_percentual     : null,
    atualizado_em: new Date().toISOString(),
  };

  // Verifica se já existe linha para este animal
  const { data: existing, error: selectErr } = await supabase
    .from("animal_leilao_info")
    .select("id")
    .eq("animal_id", animal_id)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  if (selectErr) {
    console.error("[salvarInfoLeilaoMacho] SELECT error:", selectErr);
    throw new Error(`Erro ao buscar info de leilão: ${selectErr.message}`);
  }

  if (existing?.id) {
    const { error: updateErr } = await supabase
      .from("animal_leilao_info")
      .update(payload)
      .eq("id", existing.id);
    if (updateErr) {
      console.error("[salvarInfoLeilaoMacho] UPDATE error:", updateErr);
      throw new Error(`Erro ao atualizar info de leilão: ${updateErr.message}`);
    }
  } else {
    const { error: insertErr } = await supabase
      .from("animal_leilao_info")
      .insert({ ...payload, animal_id, farm_id: FARM_ID });
    if (insertErr) {
      console.error("[salvarInfoLeilaoMacho] INSERT error:", insertErr);
      throw new Error(`Erro ao inserir info de leilão: ${insertErr.message}`);
    }
  }

  revalidatePath(`/machos/${animal_id}`);
  revalidatePath("/leiloes");
  redirect(`/machos/${animal_id}`);
}

export async function toggleNascidoSeAgroMacho(formData: FormData) {
  const id    = formData.get("id") as string;
  const valor = formData.get("nascido_se_agro") === "true";

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ nascido_se_agro: valor })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}

export async function atualizarExameAndrologico(formData: FormData) {
  const id                   = formData.get("id") as string;
  const exame_andrologico    = formData.get("exame_andrologico") as string || null;
  const data_exame           = formData.get("data_exame_andrologico") as string || null;
  const veterinario          = formData.get("veterinario_andrologico") as string || null;
  const laudo                = formData.get("laudo_andrologico") as string || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({
      exame_andrologico:       exame_andrologico || null,
      data_exame_andrologico:  data_exame || null,
      veterinario_andrologico: veterinario || null,
      laudo_andrologico:       laudo || null,
    })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarCE(formData: FormData) {
  const id   = formData.get("id") as string;
  const ce   = parseFloat(formData.get("circunferencia_escrotal") as string);
  const data = formData.get("data_ce") as string || null;

  if (!id || isNaN(ce)) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({
      circunferencia_escrotal: ce,
      data_ce: data || null,
    })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarRgn(formData: FormData) {
  const id  = formData.get("id") as string;
  const rgn = (formData.get("rgn") as string)?.trim() || null;
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("animals").update({ rgn }).eq("id", id);
  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarValorParcelaMacho(formData: FormData) {
  const id      = formData.get("id") as string;
  const parcela = parseFloat(formData.get("valor_parcela") as string);
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ valor_parcela: isNaN(parcela) ? null : parcela })
    .eq("id", id)
    .eq("farm_id", FARM_ID);
  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarRGD(formData: FormData) {
  const id  = formData.get("id") as string;
  const rgd = formData.get("rgd") as string || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ rgd: rgd || null })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarLocalizacaoMacho(formData: FormData) {
  const id         = formData.get("id") as string;
  const localizacao = formData.get("localizacao") as string || null;

  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("animals")
    .update({ localizacao: localizacao || null })
    .eq("id", id);

  revalidatePath(`/machos/${id}`);
  redirect(`/machos/${id}`);
}

export async function atualizarPesoMacho(formData: FormData) {
  const id   = formData.get("id") as string;
  const peso = parseFloat(formData.get("peso_atual") as string);

  if (!id || isNaN(peso)) return;

  const supabase = await createClient();

  // Atualiza peso_atual no animal
  await supabase
    .from("animals")
    .update({ peso_atual: peso })
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  // Registra no histórico de pesagens (weight_records)
  const hoje = new Date().toISOString().split("T")[0];
  await supabase
    .from("weight_records")
    .insert({ animal_id: id, farm_id: FARM_ID, data: hoje, peso_kg: peso });

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}

export async function registrarPesagemMacho(formData: FormData) {
  const animal_id = formData.get("animal_id") as string;
  const data      = formData.get("data") as string;
  const peso_kg   = parseFloat(formData.get("peso_kg") as string);

  if (!animal_id || !data || isNaN(peso_kg)) return;

  const supabase = await createClient();

  const { error } = await supabase
    .from("weight_records")
    .insert({ animal_id, farm_id: FARM_ID, data, peso_kg });

  if (error) throw new Error(`Erro ao registrar pesagem: ${error.message}`);

  // Atualiza peso_atual se a data registrada for a mais recente
  const { data: ultima } = await supabase
    .from("weight_records")
    .select("data")
    .eq("animal_id", animal_id)
    .order("data", { ascending: false })
    .limit(1)
    .single();

  if (!ultima || data >= ultima.data) {
    await supabase
      .from("animals")
      .update({ peso_atual: peso_kg })
      .eq("id", animal_id)
      .eq("farm_id", FARM_ID);
  }

  revalidatePath(`/machos/${animal_id}`);
  revalidatePath("/machos");
  revalidatePath("/doadoras");
  revalidatePath("/pista");
  redirect(`/machos/${animal_id}`);
}

export async function adicionarPremiacaoMacho(formData: FormData) {
  const animal_id     = formData.get("animal_id") as string;
  const tipo_premio   = formData.get("tipo_premio") as string;
  const grupo_nelore  = formData.get("grupo_nelore") as string || null;
  const exhibition_id = formData.get("exhibition_id") as string || null;
  const observacoes   = formData.get("observacoes") as string || null;

  if (!animal_id || !tipo_premio) return;

  const supabase = await createClient();
  await supabase
    .from("awards")
    .insert({
      animal_id,
      farm_id: FARM_ID,
      tipo_premio,
      grupo_nelore: grupo_nelore || null,
      exhibition_id: exhibition_id || null,
      observacoes: observacoes || null,
    });

  revalidatePath(`/machos/${animal_id}`);
  redirect(`/machos/${animal_id}`);
}

// ─── Atualizar genealogia do touro ───────────────────────────────────────────
export async function atualizarGenealogiaTouro(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const get = (nome: string) =>
    (formData.get(nome) as string | null)?.trim() || null;

  const supabase = await createClient();

  // Campos base (pai, mãe, avós maternos, bisavó)
  await supabase.from("animals").update({
    pai_nome:    get("pai_nome"),
    mae_nome:    get("mae_nome"),
    avo_materno: get("avo_materno"),
    avo_materna: get("avo_materna"),
    bisavo:      get("bisavo"),
  }).eq("id", id).eq("farm_id", FARM_ID);

  // Campos estendidos (avós paternos + bisavós completos)
  const camposExtras: Record<string, string | null> = {
    avo_paterno:    get("avo_paterno"),
    avo_paterna:    get("avo_paterna"),
    bisavo_pat_pat: get("bisavo_pat_pat"),
    bisava_pat_pat: get("bisava_pat_pat"),
    bisavo_pat_mat: get("bisavo_pat_mat"),
    bisava_pat_mat: get("bisava_pat_mat"),
    bisavo_materno: get("bisavo_materno"),
    bisava_mat_pat: get("bisava_mat_pat"),
    bisavo_materna: get("bisavo_materna"),
  };

  const { error: extErr } = await supabase
    .from("animals")
    .update(camposExtras)
    .eq("id", id)
    .eq("farm_id", FARM_ID);

  // Fallback: atualiza campo por campo se der erro (coluna ausente na migração)
  if (extErr) {
    for (const [campo, valor] of Object.entries(camposExtras)) {
      await supabase.from("animals")
        .update({ [campo]: valor })
        .eq("id", id)
        .eq("farm_id", FARM_ID);
    }
  }

  revalidatePath(`/machos/${id}`);
  revalidatePath("/machos");
  redirect(`/machos/${id}`);
}

/** Registra uma venda na tabela transactions, pré-vinculando este touro */
export async function registrarVendaMacho(formData: FormData) {
  const touro_id       = (formData.get("touro_id")       as string)?.trim();
  const tipo_detalhado = (formData.get("tipo_detalhado") as string) || "VENDA_ANIMAL";
  const contraparte    = (formData.get("contraparte")    as string) || null;
  const valorRaw       = formData.get("valor_total")     as string;
  const nParcelasRaw   = formData.get("n_parcelas")      as string;
  const dataRaw        = (formData.get("data")           as string) || null;
  const observacoes    = (formData.get("observacoes")    as string) || null;
  const percentualRaw  = formData.get("percentual_vendido") as string;

  if (!touro_id) redirect("/machos");

  const valor_total = parseFloat(valorRaw);
  const n_parcelas  = parseInt(nParcelasRaw) || 30;
  const percentual_vendido_num = parseFloat(percentualRaw);
  const percentual_vendido = (!isNaN(percentual_vendido_num) && percentual_vendido_num > 0)
    ? percentual_vendido_num
    : 100;

  if (isNaN(valor_total) || valor_total <= 0) redirect(`/machos/${touro_id}`);

  const supabase = await createClient();

  const prefixoMap: Record<string, string> = {
    VENDA_ANIMAL: "",
    VENDA_SEMEN:  "Sêmen ",
  };
  const prefixo = prefixoMap[tipo_detalhado] ?? "";

  // Nome canônico do touro
  const { data: animal } = await supabase
    .from("animals")
    .select("nome")
    .eq("id", touro_id)
    .single();

  const animal_nome = animal?.nome
    ? `${prefixo}${animal.nome}`.trim()
    : null;

  const txPayloadBase = {
    farm_id: FARM_ID,
    tipo: "VENDA",
    categoria: "TOURO",
    animal_nome,
    doadora_id: touro_id, // coluna genérica de vínculo (usada também para touros)
    contraparte,
    valor_total,
    n_parcelas,
    data: dataRaw || new Date().toISOString().split("T")[0],
    observacoes,
  };

  let { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({ ...txPayloadBase, percentual_vendido })
    .select("id")
    .single();

  // Fallback: coluna percentual_vendido ainda não existe (migração não rodada)
  if (txErr) {
    const retry = await supabase
      .from("transactions")
      .insert(txPayloadBase)
      .select("id")
      .single();
    tx = retry.data;
    txErr = retry.error;
  }

  if (txErr || !tx) {
    console.error("Erro ao registrar venda:", txErr);
    redirect(`/machos/${touro_id}`);
    return;
  }

  // Gera parcelas mensais
  const valorParcela = valor_total / n_parcelas;
  const hoje = dataRaw ? new Date(dataRaw + "T12:00:00") : new Date();
  const parcelas = Array.from({ length: n_parcelas }, (_, i) => {
    const venc = new Date(hoje);
    venc.setMonth(venc.getMonth() + i + 1);
    return {
      farm_id: FARM_ID,
      transaction_id: tx!.id,
      numero: i + 1,
      vencimento: venc.toISOString().split("T")[0],
      valor: parseFloat(valorParcela.toFixed(2)),
      status: "PENDENTE" as const,
    };
  });

  await supabase.from("installments").insert(parcelas);

  revalidatePath(`/machos/${touro_id}`);
  revalidatePath("/financeiro");
  redirect(`/machos/${touro_id}`);
}
