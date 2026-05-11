import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

// Dado o nome de um pai ou mãe, retorna a genealogia inferida:
//
// Estratégia 1 — Animal cadastrado com genealogia própria:
//   Busca o animal pelo nome exato e retorna seus campos pai_nome/mae_nome/avós.
//
// Estratégia 2 — Animal que só aparece como ancestral:
//   Busca outros animais que tenham ESTE nome como pai_nome ou mae_nome.
//   Os avós desses animais (avo_paterno, avo_paterna etc.) são os pais deste ancestral.

export async function GET(request: NextRequest) {
  const nome = request.nextUrl.searchParams.get("nome") ?? "";
  const linhagem = request.nextUrl.searchParams.get("linhagem") ?? "pai"; // "pai" | "mae"

  if (!nome || nome.length < 2) return NextResponse.json(null);

  const supabase = await createClient();
  const nomeNorm = nome.trim();

  // ── Estratégia 1: animal cadastrado com genealogia ────────────────────────
  const { data: animais } = await supabase
    .from("animals")
    .select("nome, pai_nome, mae_nome, avo_paterno, avo_paterna, avo_materno, avo_materna")
    .eq("farm_id", FARM_ID)
    .ilike("nome", nomeNorm)
    .limit(5);

  const match = animais?.find(
    (a) => a.nome.trim().toLowerCase() === nomeNorm.toLowerCase()
  );

  if (match && (match.pai_nome || match.mae_nome || match.avo_paterno)) {
    return NextResponse.json({
      fonte: "cadastro",
      pai_nome:    match.pai_nome    ?? null,
      mae_nome:    match.mae_nome    ?? null,
      avo_paterno: match.avo_paterno ?? null,
      avo_paterna: match.avo_paterna ?? null,
      avo_materno: match.avo_materno ?? null,
      avo_materna: match.avo_materna ?? null,
    });
  }

  // ── Estratégia 2: inferir pelos filhos que têm este nome como pai/mãe ─────
  // Se é usado como pai → buscar animais com pai_nome = nomeNorm
  // Se é usado como mãe → buscar animais com mae_nome = nomeNorm
  const campoFiltro = linhagem === "mae" ? "mae_nome" : "pai_nome";

  const { data: filhos } = await supabase
    .from("animals")
    .select("pai_nome, mae_nome, avo_paterno, avo_paterna, avo_materno, avo_materna")
    .eq("farm_id", FARM_ID)
    .ilike(campoFiltro, nomeNorm)
    .limit(10);

  if (!filhos || filhos.length === 0) return NextResponse.json(null);

  // Pega o primeiro filho que tenha avós preenchidos
  const filho = filhos.find(
    (f) => f.avo_paterno || f.avo_paterna || f.avo_materno || f.avo_materna
  ) ?? filhos[0];

  // Os avós paternos do filho = pais do PAI
  // Os avós maternos do filho = pais da MÃE
  if (linhagem === "mae") {
    return NextResponse.json({
      fonte: "inferido",
      pai_nome:    filho.avo_materno ?? null,  // avô materno do filho = pai da mãe
      mae_nome:    filho.avo_materna ?? null,  // avó materna do filho = mãe da mãe
      avo_paterno: null,
      avo_paterna: null,
      avo_materno: null,
      avo_materna: null,
    });
  } else {
    return NextResponse.json({
      fonte: "inferido",
      pai_nome:    filho.avo_paterno ?? null,  // avô paterno do filho = pai do pai
      mae_nome:    filho.avo_paterna ?? null,  // avó paterna do filho = mãe do pai
      avo_paterno: null,
      avo_paterna: null,
      avo_materno: null,
      avo_materna: null,
    });
  }
}
