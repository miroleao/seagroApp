"use server";

import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import type { PesagemInput, ResultadoPesagens } from "./tipos";

export async function atualizarCampoAnimal(
  animalId: string,
  campo: "nascimento" | "nome" | "rgn" | "brinco",
  valor: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("animals")
    .update({ [campo]: valor || null })
    .eq("id", animalId)
    .eq("farm_id", FARM_ID);

  if (error) throw new Error(error.message);
  revalidatePath("/pesagens");
}

// ─── Lançamento de pesagens (individual e em lote) ────────────────────────────

/**
 * Grava uma ou várias pesagens em `weight_records` e atualiza `animals.peso_atual`
 * com a pesagem mais recente de cada animal.
 *
 * Serve tanto o lançamento individual quanto o lote — o individual é só um
 * array de um item.
 */
export async function salvarPesagens(
  entradas: PesagemInput[]
): Promise<ResultadoPesagens> {
  const supabase = await createClient();

  // ── Validação ───────────────────────────────────────────────────────────────
  const validas: PesagemInput[] = [];
  for (const e of entradas) {
    if (!e?.animal_id || !e?.data) continue;
    const peso = Number(e.peso_kg);
    if (!isFinite(peso) || peso <= 0) continue;
    if (peso > 2000) return { ok: false, erro: `Peso implausível: ${peso} kg` };
    validas.push({
      animal_id:   e.animal_id,
      data:        e.data,
      peso_kg:     parseFloat(peso.toFixed(2)),
      observacoes: e.observacoes?.trim() || null,
    });
  }

  if (validas.length === 0) {
    return { ok: false, erro: "Nenhuma pesagem válida — preencha data e peso." };
  }

  // ── Descarta duplicatas exatas já existentes ────────────────────────────────
  const animalIds = [...new Set(validas.map(v => v.animal_id))];
  const datas     = [...new Set(validas.map(v => v.data))];

  const { data: existentes } = await supabase
    .from("weight_records")
    .select("animal_id, data, peso_kg")
    .eq("farm_id", FARM_ID)
    .in("animal_id", animalIds)
    .in("data", datas);

  const jaExiste = new Set(
    (existentes ?? []).map((r: any) => `${r.animal_id}|${r.data}|${Number(r.peso_kg).toFixed(2)}`)
  );

  const novas = validas.filter(
    v => !jaExiste.has(`${v.animal_id}|${v.data}|${v.peso_kg.toFixed(2)}`)
  );
  const ignoradas = validas.length - novas.length;

  if (novas.length === 0) {
    return { ok: true, salvas: 0, ignoradas };
  }

  // ── Insere ──────────────────────────────────────────────────────────────────
  const { error } = await supabase
    .from("weight_records")
    .insert(novas.map(n => ({ farm_id: FARM_ID, ...n })));

  if (error) return { ok: false, erro: error.message };

  // ── Atualiza peso_atual com a pesagem mais recente de cada animal ───────────
  await sincronizarPesoAtual(animalIds);

  revalidatePath("/pesagens");
  revalidatePath("/rebanho");
  revalidatePath("/pista");
  for (const id of animalIds) {
    revalidatePath(`/rebanho/${id}`);
    revalidatePath(`/doadoras/${id}`);
    revalidatePath(`/machos/${id}`);
  }

  return { ok: true, salvas: novas.length, ignoradas };
}

/** Exclui uma pesagem e reajusta o peso_atual do animal. */
export async function excluirPesagem(
  recordId: string,
  animalId: string
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("weight_records")
    .delete()
    .eq("id", recordId)
    .eq("farm_id", FARM_ID);

  if (error) return { ok: false, erro: error.message };

  await sincronizarPesoAtual([animalId]);

  revalidatePath("/pesagens");
  revalidatePath(`/rebanho/${animalId}`);
  return { ok: true };
}

/**
 * Recalcula `animals.peso_atual` a partir da pesagem mais recente
 * registrada em `weight_records`.
 */
async function sincronizarPesoAtual(animalIds: string[]) {
  const supabase = await createClient();

  const { data: registros } = await supabase
    .from("weight_records")
    .select("animal_id, data, peso_kg")
    .eq("farm_id", FARM_ID)
    .in("animal_id", animalIds)
    .order("data", { ascending: false });

  const maisRecente = new Map<string, number>();
  for (const r of (registros ?? []) as any[]) {
    if (!maisRecente.has(r.animal_id)) {
      maisRecente.set(r.animal_id, Number(r.peso_kg));
    }
  }

  await Promise.all(
    [...maisRecente.entries()].map(([animal_id, peso_kg]) =>
      supabase
        .from("animals")
        .update({ peso_atual: peso_kg })
        .eq("id", animal_id)
        .eq("farm_id", FARM_ID)
    )
  );
}
