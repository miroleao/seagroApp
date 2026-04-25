/**
 * lib/db/receptora.ts
 *
 * Helper centralizado para buscar ou criar uma receptora no rebanho.
 * Substitui lógica duplicada que existia em:
 *   - app/reproducao/actions.ts  (salvarLinhaEmbriao)
 *   - app/api/salvar-embriao/route.ts
 *   - app/api/implantar-embriao/route.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { FARM_ID } from "@/lib/utils";

export type ReceptoraStatus = "existente" | "criada" | "nenhuma";

export interface ResolveReceptoraOpts {
  /** UUID direto — quando já temos o ID (bypassa lookup por brinco). */
  receptoraId?: string | null;
  /** Brinco ABCZ — usado para buscar ou criar. */
  brinco?: string | null;
  /** RGN ABCZ — atualiza se existente, insere na criação se nova. */
  rgn?: string | null;
  /** Status do rebanho aplicado ao criar a receptora (default: "ATIVA"). */
  statusRebanho?: string;
}

export interface ResolveReceptoraResult {
  id: string | null;
  status: ReceptoraStatus;
}

/**
 * Resolve uma receptora: retorna o ID existente ou cria um novo registro.
 *
 * Prioridade de resolução:
 *  1. `receptoraId` fornecido → usa diretamente (atualiza rgn se necessário).
 *  2. `brinco` fornecido → busca no rebanho pelo brinco + farm_id.
 *       Encontrou → retorna ID existente (atualiza rgn se necessário).
 *       Não encontrou → cria nova RECEPTORA com os dados fornecidos.
 *  3. Nenhum dos dois → retorna `{ id: null, status: "nenhuma" }`.
 */
export async function resolveReceptora(
  supabase: SupabaseClient,
  opts: ResolveReceptoraOpts,
): Promise<ResolveReceptoraResult> {
  const brinco = opts.brinco?.trim() || null;
  const rgn    = opts.rgn?.trim()    || null;

  // ── 1. UUID direto ────────────────────────────────────────────────────────
  if (opts.receptoraId) {
    if (rgn) {
      await supabase.from("animals").update({ rgn }).eq("id", opts.receptoraId);
    }
    return { id: opts.receptoraId, status: "existente" };
  }

  // ── 2. Nenhum identificador fornecido ─────────────────────────────────────
  if (!brinco) return { id: null, status: "nenhuma" };

  // ── 3. Busca receptora existente pelo brinco ──────────────────────────────
  const { data: existente } = await supabase
    .from("animals")
    .select("id")
    .eq("farm_id", FARM_ID)
    .eq("brinco", brinco)
    .maybeSingle();

  if (existente?.id) {
    if (rgn) {
      await supabase.from("animals").update({ rgn }).eq("id", existente.id);
    }
    return { id: existente.id, status: "existente" };
  }

  // ── 4. Cria nova receptora no rebanho ─────────────────────────────────────
  const { data: nova } = await supabase
    .from("animals")
    .insert({
      farm_id:        FARM_ID,
      tipo:           "RECEPTORA",
      classificacao:  "RECEPTORA",
      nome:           `Receptora ${brinco}`,
      brinco,
      ...(rgn ? { rgn } : {}),
      status_rebanho: opts.statusRebanho ?? "ATIVA",
    })
    .select("id")
    .single();

  return { id: nova?.id ?? null, status: nova?.id ? "criada" : "nenhuma" };
}
