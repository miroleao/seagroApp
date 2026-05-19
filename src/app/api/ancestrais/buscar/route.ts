import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

// Retorna dois tipos de sugestão:
// 1. Animais cadastrados na tabela (com id e tipo)
// 2. Nomes que já aparecem como ancestrais em outros animais (só texto)

export async function GET(request: NextRequest) {
  const q    = request.nextUrl.searchParams.get("q")    ?? "";
  const tipo = request.nextUrl.searchParams.get("tipo") ?? ""; // "TOURO" | "DOADORA" | ""
  if (q.length < 2) return NextResponse.json({ animais: [], ancestrais: [] });

  const supabase = await createClient();
  const like = `%${q}%`;

  // ── 1. Animais cadastrados ────────────────────────────────────────────────
  let query = supabase
    .from("animals")
    .select("id, nome, tipo, rgn")
    .eq("farm_id", FARM_ID)
    .ilike("nome", like)
    .order("nome", { ascending: true })
    .limit(8);

  // Filtra por tipo quando informado (ex: só touros para campo Pai)
  if (tipo) query = query.eq("tipo", tipo);

  const { data: animais } = await query;

  // ── 2. Nomes ancestrais que aparecem em genealogias de outros animais ─────
  const camposGenealogia = [
    "pai_nome", "mae_nome",
    "avo_paterno", "avo_paterna", "avo_materno", "avo_materna",
    "bisavo_pat_pat", "bisava_pat_pat", "bisavo_pat_mat", "bisava_pat_mat",
    "bisavo_materno", "bisava_mat_pat", "bisavo_materna", "bisavo",
  ];

  const { data: rows } = await supabase
    .from("animals")
    .select(camposGenealogia.join(", "))
    .eq("farm_id", FARM_ID)
    .or(camposGenealogia.map((c) => `${c}.ilike.${like}`).join(","))
    .limit(30);

  // Extrair e deduplicar nomes que batem com a busca
  const nomeAnimais = new Set((animais ?? []).map((a) => a.nome.toUpperCase()));
  const ancestraisSet = new Set<string>();

  for (const row of rows ?? []) {
    for (const campo of camposGenealogia) {
      const val = (row as unknown as Record<string, string | null>)[campo];
      if (val && val.toUpperCase().includes(q.toUpperCase())) {
        const normalized = val.trim().toUpperCase();
        if (!nomeAnimais.has(normalized)) {
          ancestraisSet.add(val.trim());
        }
      }
    }
  }

  const ancestrais = Array.from(ancestraisSet).sort().slice(0, 8);

  return NextResponse.json({
    animais: animais ?? [],
    ancestrais,
  });
}
