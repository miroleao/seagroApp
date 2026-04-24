"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FARM_ID } from "@/lib/utils";

/**
 * Mapeia tipo_detalhado (ex: "COMPRA_PRENHEZ") para:
 * - tipo: "COMPRA" | "VENDA"
 * - prefixo a ser adicionado ao nome do animal ("Prenhez ", "Aspiração " ou "")
 */
function parseTipoDetalhado(tipoDetalhado: string): {
  tipo: "COMPRA" | "VENDA";
  prefixo: string;
} {
  const map: Record<string, { tipo: "COMPRA" | "VENDA"; prefixo: string }> = {
    COMPRA_ANIMAL:    { tipo: "COMPRA", prefixo: "" },
    COMPRA_PRENHEZ:   { tipo: "COMPRA", prefixo: "Prenhez " },
    COMPRA_ASPIRACAO: { tipo: "COMPRA", prefixo: "Aspiração " },
    VENDA_ANIMAL:     { tipo: "VENDA",  prefixo: "" },
    VENDA_PRENHEZ:    { tipo: "VENDA",  prefixo: "Prenhez " },
    VENDA_ASPIRACAO:  { tipo: "VENDA",  prefixo: "Aspiração " },
  };
  return map[tipoDetalhado] ?? { tipo: "COMPRA", prefixo: "" };
}

export async function criarTransacao(formData: FormData) {
  const tipo_detalhado  = formData.get("tipo_detalhado") as string;
  const animal_nome_raw = (formData.get("animal_nome") as string) || "";
  const animal_rgn_raw  = ((formData.get("animal_rgn") as string) || "").trim();
  const doadora_id_raw  = (formData.get("doadora_id") as string) || "";
  const contraparte     = (formData.get("contraparte") as string) || null;
  const valorRaw        = formData.get("valor_total") as string;
  const nParcelasRaw    = formData.get("n_parcelas") as string;
  const dataRaw         = (formData.get("data") as string) || null;
  const obsRaw          = ((formData.get("observacoes") as string) || "").trim();
  // Anexa RGN às observações se fornecido
  const observacoes     = [
    animal_rgn_raw ? `RGN:${animal_rgn_raw}` : "",
    obsRaw,
  ].filter(Boolean).join(" | ") || null;

  const valor_total = parseFloat(valorRaw);
  const n_parcelas  = parseInt(nParcelasRaw) || 30;

  if (isNaN(valor_total) || valor_total <= 0) redirect("/financeiro");

  const supabase = await createClient();
  const { tipo, prefixo } = parseTipoDetalhado(tipo_detalhado);

  // Se doadora foi selecionada no dropdown, busca o nome canônico dela
  let doadora_id: string | null = doadora_id_raw || null;
  let nomeBase = animal_nome_raw;
  if (doadora_id) {
    const { data: animal } = await supabase
      .from("animals")
      .select("nome")
      .eq("id", doadora_id)
      .single();
    if (animal?.nome) nomeBase = animal.nome;
  }

  const animal_nome = nomeBase
    ? `${prefixo}${nomeBase}`.trim()
    : null;

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      farm_id: FARM_ID,
      tipo,
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
    console.error("Erro ao criar transação:", txErr);
    redirect("/financeiro");
  }

  // Gera parcelas mensais automaticamente
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

  revalidatePath("/financeiro");
  redirect("/financeiro");
}

/** Edita os dados de uma transação existente */
export async function editarTransacao(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const tx_id       = (formData.get("tx_id")       as string)?.trim();
  const animal_nome = (formData.get("animal_nome") as string)?.trim() || null;
  const contraparte = (formData.get("contraparte") as string)?.trim() || null;
  const valor_total = parseFloat(formData.get("valor_total") as string);
  const n_parcelas  = parseInt(formData.get("n_parcelas") as string) || 30;
  const data        = (formData.get("data")        as string)?.trim() || null;
  const observacoes = (formData.get("observacoes") as string)?.trim() || null;

  if (!tx_id || isNaN(valor_total) || valor_total <= 0) return { ok: false, erro: "Dados inválidos" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("transactions")
    .update({ animal_nome, contraparte, valor_total, n_parcelas, data, observacoes })
    .eq("id", tx_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/financeiro");
  return { ok: true };
}

/** Exclui uma transação e todas as parcelas vinculadas */
export async function excluirTransacao(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const tx_id = (formData.get("tx_id") as string)?.trim();
  if (!tx_id) return { ok: false, erro: "ID inválido" };

  const supabase = await createClient();

  // 1. Deleta parcelas vinculadas
  await supabase.from("installments").delete().eq("transaction_id", tx_id);

  // 2. Deleta a transação
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", tx_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/financeiro");
  return { ok: true };
}

/** Vincula (ou desvincula) uma doadora a uma transação existente */
export async function vincularDoadora(formData: FormData) {
  const tx_id      = (formData.get("tx_id")      as string)?.trim();
  const doadora_id = (formData.get("doadora_id") as string)?.trim() || null;
  if (!tx_id) return;

  const supabase = await createClient();

  // Se selecionou uma doadora, usa o nome canônico dela
  let animal_nome: string | null = null;
  if (doadora_id) {
    const { data: animal } = await supabase
      .from("animals").select("nome").eq("id", doadora_id).single();
    if (animal?.nome) animal_nome = animal.nome;
  }

  await supabase
    .from("transactions")
    .update({ doadora_id, ...(animal_nome ? { animal_nome } : {}) })
    .eq("id", tx_id);

  revalidatePath("/financeiro");
  revalidatePath("/doadoras");
}
