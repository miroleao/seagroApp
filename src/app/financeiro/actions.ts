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
  categoria: string | null;
} {
  const map: Record<string, { tipo: "COMPRA" | "VENDA"; prefixo: string; categoria: string | null }> = {
    COMPRA_ANIMAL:    { tipo: "COMPRA", prefixo: "",            categoria: null       },
    COMPRA_PRENHEZ:   { tipo: "COMPRA", prefixo: "Prenhez ",   categoria: "PRENHEZ"  },
    COMPRA_ASPIRACAO: { tipo: "COMPRA", prefixo: "Aspiração ",  categoria: "EMBRIAO"  },
    VENDA_ANIMAL:     { tipo: "VENDA",  prefixo: "",            categoria: null       },
    VENDA_PRENHEZ:    { tipo: "VENDA",  prefixo: "Prenhez ",   categoria: "PRENHEZ"  },
    VENDA_ASPIRACAO:  { tipo: "VENDA",  prefixo: "Aspiração ",  categoria: "EMBRIAO"  },
  };
  return map[tipoDetalhado] ?? { tipo: "COMPRA", prefixo: "", categoria: null };
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
  const { tipo, prefixo, categoria: catBase } = parseTipoDetalhado(tipo_detalhado);

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

  // Categoria: derivada do tipo_detalhado; se for animal + tem doadora_id → DOADORA
  const categoria = catBase ?? (doadora_id ? "DOADORA" : null);

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      farm_id: FARM_ID,
      tipo,
      categoria,
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
  const tipoRaw     = (formData.get("tipo")        as string | null)?.trim() ?? "";
  const categoriaRaw= (formData.get("categoria")   as string | null) ?? null;
  const auctionRaw  = (formData.get("auction_id")  as string | null) ?? null;
  const novoLeilao  = (formData.get("novo_leilao_nome") as string | null)?.trim() ?? "";

  if (!tx_id || isNaN(valor_total) || valor_total <= 0) return { ok: false, erro: "Dados inválidos" };

  const updates: Record<string, unknown> = {
    animal_nome, contraparte, valor_total, n_parcelas, data, observacoes,
  };

  if (tipoRaw) {
    if (!["COMPRA", "VENDA"].includes(tipoRaw)) return { ok: false, erro: "Tipo inválido" };
    updates.tipo = tipoRaw;
  }
  if (categoriaRaw !== null) {
    const cat = categoriaRaw.trim();
    const validas = ["DOADORA", "RECEPTORA", "TOURO", "EMBRIAO", "PRENHEZ", "LEILAO", "OUTRO"];
    if (cat === "") {
      updates.categoria = null;
    } else if (validas.includes(cat)) {
      updates.categoria = cat;
    } else {
      return { ok: false, erro: "Categoria inválida" };
    }
  }

  const supabase = await createClient();

  // Leilão: se veio um id existente OU um nome novo para criar
  if (auctionRaw !== null) {
    const auctionId = auctionRaw.trim();
    if (auctionId === "__novo__" && novoLeilao) {
      const { data: novo, error: novoErr } = await supabase
        .from("auctions")
        .insert({ farm_id: FARM_ID, nome: novoLeilao, data })
        .select("id")
        .single();
      if (novoErr) return { ok: false, erro: `Erro ao criar leilão: ${novoErr.message}` };
      updates.auction_id = novo?.id ?? null;
    } else if (auctionId === "") {
      updates.auction_id = null;
    } else if (auctionId !== "__novo__") {
      updates.auction_id = auctionId;
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update(updates)
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

/**
 * Vincula uma transação a múltiplos animais (substitui todos os vínculos existentes).
 * - `transactions.doadora_id` recebe o PRIMEIRO animal selecionado (compat).
 * - `transactions.animal_nome` recebe os nomes concatenados.
 * - `transaction_animals` é regravada por completo.
 */
export async function vincularAnimaisMultiplos(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const tx_id     = (formData.get("tx_id") as string)?.trim();
  const idsRaw    = formData.getAll("animal_ids").map(v => String(v).trim()).filter(Boolean);
  if (!tx_id) return { ok: false, erro: "tx_id inválido" };

  const supabase = await createClient();

  // Limpa vínculos atuais
  const { error: delErr } = await supabase
    .from("transaction_animals")
    .delete()
    .eq("transaction_id", tx_id);
  if (delErr) return { ok: false, erro: delErr.message };

  let principalId: string | null = null;
  let nomeAgregado: string | null = null;

  if (idsRaw.length > 0) {
    // Insere os novos vínculos
    const rows = idsRaw.map(id => ({ transaction_id: tx_id, animal_id: id }));
    const { error: insErr } = await supabase.from("transaction_animals").insert(rows);
    if (insErr) return { ok: false, erro: insErr.message };

    // Busca nomes para compor o animal_nome e definir o principal
    const { data: animais } = await supabase
      .from("animals")
      .select("id, nome")
      .in("id", idsRaw)
      .eq("farm_id", FARM_ID);

    if (animais && animais.length > 0) {
      // Preserva a ordem que veio do formulário
      const byId = new Map(animais.map((a: any) => [a.id as string, a.nome as string]));
      const nomesOrdenados = idsRaw.map(id => byId.get(id)).filter(Boolean) as string[];
      principalId  = idsRaw[0];
      nomeAgregado = nomesOrdenados.join(" + ");
    }
  }

  // Atualiza a transação (mantém compatibilidade com doadora_id)
  await supabase
    .from("transactions")
    .update({
      doadora_id:  principalId,
      animal_nome: nomeAgregado,
    })
    .eq("id", tx_id)
    .eq("farm_id", FARM_ID);

  revalidatePath("/financeiro");
  revalidatePath("/doadoras");
  return { ok: true };
}
