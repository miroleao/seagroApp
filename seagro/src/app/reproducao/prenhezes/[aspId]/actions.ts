"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FARM_ID } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lê uma chave do campo observacoes estruturado (ex: "PARTO:2026-04-15 | PARCELA:800") */
function parseObsKey(obs: string | null | undefined, key: string): string | null {
  if (!obs) return null;
  const m = obs.match(new RegExp(`${key}:([^|]+)`));
  return m ? m[1].trim() : null;
}

/** Reconstrói a string de observacoes preservando chaves não alteradas */
function buildObs(base: string | null, updates: Record<string, string | null>): string {
  // Parse base
  const map: Record<string, string> = {};
  if (base) {
    for (const part of base.split("|")) {
      const [k, ...rest] = part.split(":");
      if (k && rest.length) map[k.trim()] = rest.join(":").trim();
    }
  }
  // Apply updates
  for (const [k, v] of Object.entries(updates)) {
    if (v) map[k] = v;
    else delete map[k];
  }
  return Object.entries(map)
    .map(([k, v]) => `${k}:${v}`)
    .join(" | ");
}

// ── Action principal: salva toda a ficha ─────────────────────────────────────

export async function salvarFicha(formData: FormData) {
  const asp_id     = (formData.get("asp_id")     as string)?.trim();
  const embryo_id  = (formData.get("embryo_id")  as string)?.trim() || null;
  const transfer_id = (formData.get("transfer_id") as string)?.trim() || null;
  const animal_id  = (formData.get("animal_id")  as string)?.trim() || null;

  if (!asp_id) return;

  const supabase = await createClient();

  // ── Dados da doadora / sessão ─────────────────────────────────────────────
  const doadora_nome = (formData.get("doadora_nome") as string)?.trim() || null;
  const touro_nome   = (formData.get("touro_nome")   as string)?.trim() || null;

  // ── Campos extra via observacoes ──────────────────────────────────────────
  const doadora_rgn  = (formData.get("doadora_rgn")  as string)?.trim() || null;
  const touro_rgn    = (formData.get("touro_rgn")    as string)?.trim() || null;
  const data_parto   = (formData.get("data_parto")   as string)?.trim() || null;
  const parcela      = (formData.get("parcela")      as string)?.trim() || null;
  const vendedor     = (formData.get("vendedor")     as string)?.trim() || null;
  const leilao       = (formData.get("leilao")       as string)?.trim() || null;
  const fazenda_orig = (formData.get("fazenda_orig") as string)?.trim() || null;

  // Busca observacoes atual
  const { data: aspAtual } = await supabase
    .from("aspirations")
    .select("observacoes")
    .eq("id", asp_id)
    .single();

  const data_leilao   = (formData.get("data_leilao")   as string)?.trim() || null;
  const num_parcelas  = (formData.get("num_parcelas")  as string)?.trim() || null;

  const novaObs = buildObs(aspAtual?.observacoes ?? null, {
    DOADORA_RGN:  doadora_rgn,
    TOURO_RGN:    touro_rgn,
    PARTO:        data_parto,
    PARCELA:      parcela,
    NUM_PARCELAS: num_parcelas,
    VENDEDOR:     vendedor,
    LEILAO:       leilao,
    DATA_LEILAO:  data_leilao,
    FAZENDA:      fazenda_orig,
  });

  await supabase
    .from("aspirations")
    .update({ doadora_nome, touro_nome, observacoes: novaObs || null })
    .eq("id", asp_id);

  // ── Dados do embrião ──────────────────────────────────────────────────────
  if (embryo_id) {
    const cdc_fiv  = (formData.get("cdc_fiv")  as string)?.trim() || null;
    const sexagem  = (formData.get("sexagem")   as string)?.trim() || null;
    const adt_te   = formData.get("adt_te") === "on";

    await supabase
      .from("embryos")
      .update({
        numero_cdc_fiv: cdc_fiv,
        sexagem:        sexagem || null,
        numero_adt_te:  adt_te ? "SIM" : null,
      })
      .eq("id", embryo_id);
  }

  // ── Dados da receptora ────────────────────────────────────────────────────
  const brinco = (formData.get("brinco") as string)?.trim() || null;
  const rgn    = (formData.get("rgn")    as string)?.trim() || null;

  if (animal_id) {
    await supabase
      .from("animals")
      .update({ brinco, nome: brinco ?? undefined, rgn })
      .eq("id", animal_id);
  } else if (transfer_id && (brinco || rgn)) {
    // Verifica se já existe receptora vinculada
    const { data: tr } = await supabase
      .from("transfers")
      .select("receptora_id, receptora_brinco")
      .eq("id", transfer_id)
      .single();

    if (tr?.receptora_id) {
      await supabase
        .from("animals")
        .update({ brinco, rgn, nome: brinco ?? undefined })
        .eq("id", tr.receptora_id);
    } else {
      const { data: nova } = await supabase
        .from("animals")
        .insert({ farm_id: FARM_ID, tipo: "RECEPTORA", nome: brinco ?? "Receptora", brinco, rgn })
        .select("id")
        .single();
      if (nova) {
        await supabase
          .from("transfers")
          .update({ receptora_id: nova.id, receptora_brinco: brinco })
          .eq("id", transfer_id);
      }
    }
  }

  revalidatePath(`/reproducao/prenhezes/${asp_id}`);
  revalidatePath("/reproducao/prenhezes");
}
