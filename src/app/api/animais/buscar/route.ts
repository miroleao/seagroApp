import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  // modo: "nome" (padrão) | "pai" (busca tb por pai_nome) | "mae" (busca tb por mae_nome)
  const modo = request.nextUrl.searchParams.get("modo") ?? "nome";
  if (q.length < 2) return NextResponse.json([]);

  const supabase = await createClient();
  const like = `%${q}%`;

  const campos =
    "id, nome, tipo, rgn, rgd, nascimento, sexo, pai_nome, mae_nome, " +
    "avo_paterno, avo_paterna, avo_materno, avo_materna, " +
    "bisavo_pat_pat, bisava_pat_pat, bisavo_pat_mat, bisava_pat_mat, " +
    "bisavo_materno, bisava_mat_pat, bisavo_materna, bisavo";

  let query = supabase
    .from("animals")
    .select(campos)
    .eq("farm_id", FARM_ID)
    .order("nome", { ascending: true })
    .limit(15);

  if (modo === "pai") {
    // animais cujo nome bate OU cujo pai_nome bate (filhos do pai buscado = irmãos)
    query = query.or(`nome.ilike.${like},pai_nome.ilike.${like}`);
  } else if (modo === "mae") {
    query = query.or(`nome.ilike.${like},mae_nome.ilike.${like}`);
  } else {
    query = query.ilike("nome", like);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
