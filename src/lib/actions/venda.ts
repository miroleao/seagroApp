"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

/**
 * Registro unificado de venda de animal — fonte única da verdade.
 *
 * Antes, uma venda era gravada em três lugares que não se conversavam:
 *   · `animal_leilao_info.venda_*`  — card Leilão da ficha (só informativo)
 *   · `transactions` + `installments` — form "Registrar Venda" (só financeiro)
 *   · `animals.status_rebanho`      — desfecho do rebanho (só receptoras)
 *
 * Esta ação executa os três de uma vez, a partir do card Leilão.
 *
 * REGRA DE SAÍDA (definida com o Chefe):
 *   Venda parcial NÃO dá saída. O animal continua ativo e apenas o
 *   `percentual_proprio` diminui. A saída (status VENDIDA + `data_saida`)
 *   só acontece quando a participação própria chega a zero.
 */

export type ResultadoVenda = {
  ok: boolean;
  erro?: string;
  /** Participação restante da fazenda, em % (0–100). */
  percentualRestante?: number;
  /** true quando a venda zerou a participação e o animal recebeu saída. */
  deuSaida?: boolean;
};

const CATEGORIA_POR_TIPO: Record<string, string> = {
  DOADORA: "DOADORA", TOURO: "TOURO",
  RECEPTORA: "RECEPTORA", NASCIDO: "ANIMAL", DESCARTE: "RECEPTORA",
};

export async function registrarVendaAnimal(formData: FormData): Promise<ResultadoVenda> {
  const animal_id   = (formData.get("animal_id") as string)?.trim();
  const comprador   = (formData.get("venda_comprador") as string)?.trim() || null;
  const parcelaRaw  = (formData.get("venda_valor_parcela") as string)?.trim() || "";
  const nParcRaw    = (formData.get("venda_n_parcelas") as string)?.trim() || "";
  const percRaw     = (formData.get("venda_percentual") as string)?.trim() || "100";
  const dataRaw     = (formData.get("venda_data") as string)?.trim() || null;
  const observacoes = (formData.get("venda_observacoes") as string)?.trim() || null;

  if (!animal_id) return { ok: false, erro: "Animal não identificado" };

  const valor_parcela = parseFloat(parcelaRaw.replace(",", "."));
  const n_parcelas    = parseInt(nParcRaw) || 1;
  const percentual    = parseFloat(percRaw.replace(",", "."));

  if (!isFinite(valor_parcela) || valor_parcela <= 0) {
    return { ok: false, erro: "Informe o valor da parcela" };
  }
  if (!isFinite(percentual) || percentual <= 0 || percentual > 100) {
    return { ok: false, erro: "Percentual vendido deve estar entre 1 e 100" };
  }

  const valor_total = parseFloat((valor_parcela * n_parcelas).toFixed(2));
  const data_venda  = dataRaw || new Date().toISOString().split("T")[0];

  const supabase = await createClient();

  // ── Animal ────────────────────────────────────────────────────────────────
  const { data: animal, error: animalErr } = await supabase
    .from("animals")
    .select("id, nome, tipo, percentual_proprio, status_rebanho")
    .eq("id", animal_id)
    .eq("farm_id", FARM_ID)
    .maybeSingle();

  if (animalErr) return { ok: false, erro: animalErr.message };
  if (!animal)   return { ok: false, erro: "Animal não encontrado" };

  // `percentual_proprio` é fração (0–1). Sem valor, assume-se 100% próprio.
  const proprioAtual = (animal as any).percentual_proprio ?? 1;
  const fracaoVendida = percentual / 100;
  const proprioNovo = Math.max(0, parseFloat((proprioAtual - fracaoVendida).toFixed(4)));
  const deuSaida = proprioNovo <= 0.0001;

  // ── 1. Financeiro ─────────────────────────────────────────────────────────
  const categoria = CATEGORIA_POR_TIPO[(animal as any).tipo] ?? "ANIMAL";

  const txPayload: Record<string, unknown> = {
    farm_id:     FARM_ID,
    tipo:        "VENDA",
    categoria,
    animal_nome: (animal as any).nome ?? null,
    doadora_id:  animal_id,
    animal_id,
    contraparte: comprador,
    valor_total,
    n_parcelas,
    data:        data_venda,
    observacoes,
  };

  let { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({ ...txPayload, percentual_vendido: percentual })
    .select("id")
    .single();

  // Fallback: coluna `percentual_vendido` ainda não migrada
  if (txErr) {
    const retry = await supabase
      .from("transactions").insert(txPayload).select("id").single();
    tx = retry.data; txErr = retry.error;
  }
  if (txErr || !tx) return { ok: false, erro: txErr?.message ?? "Falha ao criar transação" };

  // Vínculo com a ficha do animal
  await supabase.from("transaction_animals")
    .insert({ transaction_id: tx.id, animal_id });

  // Parcelas mensais
  const base = new Date(data_venda + "T12:00:00");
  await supabase.from("installments").insert(
    Array.from({ length: n_parcelas }, (_, i) => {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + i + 1);
      return {
        farm_id: FARM_ID,
        transaction_id: tx!.id,
        numero: i + 1,
        vencimento: venc.toISOString().split("T")[0],
        valor: valor_parcela,
        status: "PENDENTE" as const,
      };
    })
  );

  // ── 2. Card Leilão ────────────────────────────────────────────────────────
  const infoPayload = {
    venda_comprador:     comprador,
    venda_valor_parcela: valor_parcela,
    venda_n_parcelas:    n_parcelas,
  };
  const { data: infoExistente } = await supabase
    .from("animal_leilao_info")
    .select("id")
    .eq("animal_id", animal_id)
    .maybeSingle();

  if (infoExistente) {
    await supabase.from("animal_leilao_info")
      .update(infoPayload).eq("id", (infoExistente as any).id);
  } else {
    await supabase.from("animal_leilao_info")
      .insert({ farm_id: FARM_ID, animal_id, ...infoPayload });
  }

  // ── 3. Participação e saída ───────────────────────────────────────────────
  const updAnimal: Record<string, unknown> = { percentual_proprio: proprioNovo };
  if (deuSaida) {
    updAnimal.status_rebanho = "VENDIDA";
    updAnimal.data_saida     = data_venda;
  }

  const { error: updErr } = await supabase
    .from("animals").update(updAnimal)
    .eq("id", animal_id).eq("farm_id", FARM_ID);

  // `data_saida` pode não existir se a migração não rodou — tenta sem ela
  if (updErr && deuSaida) {
    await supabase.from("animals")
      .update({ percentual_proprio: proprioNovo, status_rebanho: "VENDIDA" })
      .eq("id", animal_id).eq("farm_id", FARM_ID);
  }

  // Registra no log de movimentação, se a tabela existir
  if (deuSaida) {
    try {
      await supabase.from("animal_status_log").insert({
        farm_id: FARM_ID,
        animal_id,
        status: "VENDIDA",
        observacoes: [comprador ? `Comprador: ${comprador}` : null, observacoes]
          .filter(Boolean).join(" | ") || null,
        data_evento: data_venda,
      });
    } catch {
      /* migração do log não rodada — ignora */
    }
  }

  for (const rota of ["/financeiro", "/rebanho", "/doadoras", "/machos", "/dashboard", "/leiloes"]) {
    revalidatePath(rota);
  }
  revalidatePath(`/doadoras/${animal_id}`);
  revalidatePath(`/machos/${animal_id}`);
  revalidatePath(`/rebanho/${animal_id}`);

  return {
    ok: true,
    percentualRestante: parseFloat((proprioNovo * 100).toFixed(2)),
    deuSaida,
  };
}
