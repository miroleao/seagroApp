"use server";

import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";

export type ResultadoBusca = {
  id: string;
  label: string;
  sub: string;
  href: string;
  tipo: "animal" | "exposicao" | "transacao" | "prenhez";
};

export async function buscaGlobal(q: string): Promise<ResultadoBusca[]> {
  if (!q || q.trim().length < 2) return [];
  const supabase = await createClient();
  const termo = q.trim().toLowerCase();
  const results: ResultadoBusca[] = [];

  // ── Animais ────────────────────────────────────────────────────────────────
  const { data: animais } = await supabase
    .from("animals")
    .select("id, nome, rgn, rgd, tipo, brinco")
    .eq("farm_id", FARM_ID)
    .or(`nome.ilike.%${termo}%,rgn.ilike.%${termo}%,rgd.ilike.%${termo}%,brinco.ilike.%${termo}%`)
    .limit(8);

  for (const a of animais ?? []) {
    const href =
      a.tipo === "DOADORA"   ? `/doadoras/${a.id}` :
      a.tipo === "TOURO"     ? `/machos/${a.id}`   :
      a.tipo === "NASCIDO"   ? `/machos/${a.id}`   :
                               `/rebanho`;
    const regLabel = a.rgd ?? a.rgn ?? a.brinco ?? "";
    const tipoLabel =
      a.tipo === "DOADORA"   ? "Doadora" :
      a.tipo === "TOURO"     ? "Touro"   :
      a.tipo === "RECEPTORA" ? "Receptora" :
      a.tipo === "NASCIDO"   ? "Nascido" : a.tipo;
    results.push({
      id: a.id,
      label: a.nome,
      sub: `${tipoLabel}${regLabel ? ` · ${regLabel}` : ""}`,
      href,
      tipo: "animal",
    });
  }

  // ── Exposições ─────────────────────────────────────────────────────────────
  const { data: expos } = await supabase
    .from("exhibitions")
    .select("id, nome, data_base, local")
    .eq("farm_id", FARM_ID)
    .or(`nome.ilike.%${termo}%,local.ilike.%${termo}%`)
    .limit(4);

  for (const e of expos ?? []) {
    results.push({
      id: e.id,
      label: e.nome,
      sub: `Exposição${e.data_base ? ` · ${e.data_base.substring(0, 7)}` : ""}${e.local ? ` · ${e.local}` : ""}`,
      href: "/pista",
      tipo: "exposicao",
    });
  }

  // ── Transações / Leilões ───────────────────────────────────────────────────
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, tipo, animal_nome, leilao_nome, contraparte, data_transacao")
    .eq("farm_id", FARM_ID)
    .or(`animal_nome.ilike.%${termo}%,leilao_nome.ilike.%${termo}%,contraparte.ilike.%${termo}%`)
    .limit(4);

  for (const t of txs ?? []) {
    const tipoLabel = t.tipo === "VENDA" ? "Venda" : "Compra";
    results.push({
      id: t.id,
      label: t.animal_nome ?? t.leilao_nome ?? "Transação",
      sub: `${tipoLabel}${t.leilao_nome ? ` · ${t.leilao_nome}` : ""}${t.contraparte ? ` · ${t.contraparte}` : ""}`,
      href: `/financeiro?q=${encodeURIComponent(t.leilao_nome ?? t.animal_nome ?? "")}`,
      tipo: "transacao",
    });
  }

  return results.slice(0, 12);
}
