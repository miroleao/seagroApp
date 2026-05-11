import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("animals")
    .select(
      "id, nome, tipo, rgn, rgd, pai_nome, mae_nome, " +
      "avo_paterno, avo_paterna, avo_materno, avo_materna, " +
      "bisavo_pat_pat, bisava_pat_pat, bisavo_pat_mat, bisava_pat_mat, " +
      "bisavo_materno, bisava_mat_pat, bisavo_materna, bisavo"
    )
    .eq("farm_id", FARM_ID)
    .ilike("nome", `%${q}%`)
    .order("nome", { ascending: true })
    .limit(12);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
