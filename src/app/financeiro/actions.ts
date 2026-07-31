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
  // Animais cadastrados vinculados a este lançamento (SeletorAnimais).
  // Fallback: `doadora_id` do formato antigo.
  const animalIds = formData.getAll("animal_ids")
    .map(v => String(v).trim())
    .filter(Boolean);
  const doadora_id_raw  = animalIds[0] ?? ((formData.get("doadora_id") as string) || "");
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

  // Se animais cadastrados foram selecionados, usa os nomes canônicos deles
  const idsVinculo = animalIds.length > 0
    ? animalIds
    : (doadora_id_raw ? [doadora_id_raw] : []);

  const doadora_id: string | null = idsVinculo[0] ?? null;
  let nomeBase = animal_nome_raw;
  let tipoPrincipal: string | null = null;

  if (idsVinculo.length > 0) {
    const { data: animaisSel } = await supabase
      .from("animals")
      .select("id, nome, tipo")
      .in("id", idsVinculo)
      .eq("farm_id", FARM_ID);

    if (animaisSel && animaisSel.length > 0) {
      // Preserva a ordem de seleção do formulário
      const byId = new Map(animaisSel.map((a: any) => [a.id as string, a]));
      const ordenados = idsVinculo.map(id => byId.get(id)).filter(Boolean) as any[];
      if (ordenados.length > 0) {
        nomeBase = ordenados.map(a => a.nome).join(" + ");
        tipoPrincipal = ordenados[0].tipo ?? null;
      }
    }
  }

  const animal_nome = nomeBase
    ? `${prefixo}${nomeBase}`.trim()
    : null;

  // Categoria: derivada do tipo_detalhado; senão, do tipo do animal vinculado
  const CAT_POR_TIPO: Record<string, string> = {
    DOADORA: "DOADORA", TOURO: "TOURO",
    RECEPTORA: "RECEPTORA", NASCIDO: "ANIMAL", DESCARTE: "RECEPTORA",
  };
  const categoria = catBase
    ?? (tipoPrincipal ? (CAT_POR_TIPO[tipoPrincipal] ?? "ANIMAL") : null);

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      farm_id: FARM_ID,
      tipo,
      categoria,
      animal_nome,
      doadora_id,
      animal_id: doadora_id,   // coluna legada — mantida em sincronia
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

  // Vínculo com os animais — é o que faz o lançamento aparecer na ficha
  if (idsVinculo.length > 0) {
    const { error: vinculoErr } = await supabase
      .from("transaction_animals")
      .insert(idsVinculo.map(animal_id => ({ transaction_id: tx.id, animal_id })));
    if (vinculoErr) console.error("Erro ao vincular animais à transação:", vinculoErr);
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
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath("/rebanho");
  for (const animalId of idsVinculo) {
    revalidatePath(`/doadoras/${animalId}`);
    revalidatePath(`/machos/${animalId}`);
    revalidatePath(`/rebanho/${animalId}`);
  }
  redirect("/financeiro");
}

/** Edita os dados de uma transação existente */
export async function editarTransacao(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const tx_id        = (formData.get("tx_id")       as string)?.trim();
  const animal_nome  = (formData.get("animal_nome") as string)?.trim() || null;
  const contraparte  = (formData.get("contraparte") as string)?.trim() || null;
  const valor_parcela = parseFloat(formData.get("valor_parcela") as string);
  const n_parcelas   = parseInt(formData.get("n_parcelas") as string) || 1;
  const data         = (formData.get("data")        as string)?.trim() || null;
  const observacoes  = (formData.get("observacoes") as string)?.trim() || null;
  const tipoRaw      = (formData.get("tipo")        as string | null)?.trim() ?? "";
  const categoriaRaw = (formData.get("categoria")   as string | null) ?? null;
  const auctionRaw   = (formData.get("auction_id")  as string | null) ?? null;
  const novoLeilao   = (formData.get("novo_leilao_nome") as string | null)?.trim() ?? "";

  // valor_total é sempre parcela × qtd
  const valor_total = parseFloat((valor_parcela * n_parcelas).toFixed(2));

  if (!tx_id || isNaN(valor_parcela) || valor_parcela <= 0 || n_parcelas < 1) {
    return { ok: false, erro: "Dados inválidos" };
  }

  const updates: Record<string, unknown> = {
    animal_nome, contraparte, valor_total, n_parcelas, data, observacoes,
  };

  if (tipoRaw) {
    if (!["COMPRA", "VENDA"].includes(tipoRaw)) return { ok: false, erro: "Tipo inválido" };
    updates.tipo = tipoRaw;
  }
  if (categoriaRaw !== null) {
    const cat = categoriaRaw.trim();
    const validas = ["ANIMAL", "DOADORA", "RECEPTORA", "TOURO", "EMBRIAO", "ASPIRACAO", "PRENHEZ", "SEMEN", "LEILAO", "OUTRO"];
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

  // ── Regenera parcelas PRESERVANDO o que já foi marcado como pago ───────────
  // Antes esta rotina apagava tudo e recriava como PENDENTE, o que zerava
  // qualquer marcação de pagamento a cada edição.
  const { data: antigas } = await supabase
    .from("installments")
    .select("numero, status, data_pagamento")
    .eq("transaction_id", tx_id);

  const statusAnterior = new Map<number, { status: string; data_pagamento: string | null }>(
    (antigas ?? []).map((p: any) => [p.numero as number, { status: p.status, data_pagamento: p.data_pagamento ?? null }])
  );

  // Se há um número manual de parcelas pagas, ele tem precedência
  const { data: txAtual } = await supabase
    .from("transactions")
    .select("parcelas_pagas_manual")
    .eq("id", tx_id)
    .maybeSingle();
  const pagasManual = (txAtual as any)?.parcelas_pagas_manual as number | null | undefined;

  await supabase.from("installments").delete().eq("transaction_id", tx_id);

  const dataBase = data ? new Date(data + "T12:00:00") : new Date();
  const novasParcelas = Array.from({ length: n_parcelas }, (_, i) => {
    const numero = i + 1;
    const venc = new Date(dataBase);
    venc.setMonth(venc.getMonth() + numero);

    const anterior = statusAnterior.get(numero);
    const pagaPorManual = pagasManual != null && numero <= pagasManual;
    const paga = pagaPorManual || anterior?.status === "PAGO";

    return {
      farm_id: FARM_ID,
      transaction_id: tx_id,
      numero,
      vencimento: venc.toISOString().split("T")[0],
      valor: parseFloat(valor_parcela.toFixed(2)),
      status: paga ? ("PAGO" as const) : ("PENDENTE" as const),
      data_pagamento: paga ? (anterior?.data_pagamento ?? venc.toISOString().split("T")[0]) : null,
    };
  });
  if (novasParcelas.length > 0) {
    await supabase.from("installments").insert(novasParcelas);
  }

  // Se o nº de parcelas encolheu abaixo do manual, ajusta o manual
  if (pagasManual != null && pagasManual > n_parcelas) {
    await supabase
      .from("transactions")
      .update({ parcelas_pagas_manual: n_parcelas })
      .eq("id", tx_id)
      .eq("farm_id", FARM_ID);
  }

  revalidatePath("/financeiro");
  return { ok: true };
}

/**
 * Define manualmente quantas parcelas já foram pagas (compra) ou recebidas (venda).
 *
 * - `pagas = null`  → volta ao cálculo automático
 * - `pagas = 0..n`  → trava o número informado
 *
 * Também sincroniza a tabela `installments`: as N primeiras viram PAGO,
 * as demais voltam para PENDENTE. Assim o número manual e as parcelas
 * individuais nunca divergem.
 */
export async function definirParcelasPagas(
  tx_id: string,
  pagas: number | null,
): Promise<{ ok: boolean; erro?: string }> {
  if (!tx_id) return { ok: false, erro: "Transação inválida" };

  const supabase = await createClient();

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, n_parcelas")
    .eq("id", tx_id)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  if (txErr)  return { ok: false, erro: txErr.message };
  if (!tx)    return { ok: false, erro: "Transação não encontrada" };

  const nTotal = Math.max((tx as any).n_parcelas ?? 1, 1);

  let valor: number | null = null;
  if (pagas !== null) {
    if (!Number.isFinite(pagas) || pagas < 0) {
      return { ok: false, erro: "Quantidade inválida" };
    }
    if (pagas > nTotal) {
      return { ok: false, erro: `A transação tem apenas ${nTotal} parcela(s).` };
    }
    valor = Math.floor(pagas);
  }

  const { error } = await supabase
    .from("transactions")
    .update({ parcelas_pagas_manual: valor })
    .eq("id", tx_id)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  // Sincroniza installments com o número informado
  if (valor !== null) {
    const hoje = new Date().toISOString().split("T")[0];
    await supabase
      .from("installments")
      .update({ status: "PAGO", data_pagamento: hoje })
      .eq("transaction_id", tx_id)
      .lte("numero", valor);

    await supabase
      .from("installments")
      .update({ status: "PENDENTE", data_pagamento: null })
      .eq("transaction_id", tx_id)
      .gt("numero", valor);
  }

  revalidatePath("/financeiro");
  revalidatePath("/doadoras");
  revalidatePath("/machos");
  revalidatePath("/rebanho");
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
