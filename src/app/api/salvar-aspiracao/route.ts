import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      aspId,
      touro_nome,
      touro_rgn,
      oocitos_viaveis,
      embryos_congelados,
      implantados,
      prenhezes_count,
      custo_total,
      observacoes,
    } = body;

    if (!aspId) return NextResponse.json({ ok: false, erro: "ID inválido" });

    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (touro_nome !== undefined)         updates.touro_nome         = touro_nome || null;
    if (touro_rgn !== undefined)          updates.touro_rgn          = touro_rgn || null;
    if (oocitos_viaveis !== undefined)    updates.oocitos_viaveis    = oocitos_viaveis === "" || oocitos_viaveis === null ? null : Number(oocitos_viaveis);
    if (embryos_congelados !== undefined) updates.embryos_congelados = embryos_congelados === "" || embryos_congelados === null ? null : Number(embryos_congelados);
    if (implantados !== undefined)        updates.implantados        = implantados === "" || implantados === null ? 0 : Number(implantados);
    if (prenhezes_count !== undefined)    updates.prenhezes_count    = prenhezes_count === "" || prenhezes_count === null ? 0 : Number(prenhezes_count);
    if (custo_total !== undefined)        updates.custo_total        = custo_total === "" || custo_total === null ? null : Number(custo_total);
    if (observacoes !== undefined)        updates.observacoes        = observacoes || null;

    const { error } = await supabase.from("aspirations").update(updates).eq("id", aspId);
    if (error) return NextResponse.json({ ok: false, erro: error.message });

    revalidatePath("/reproducao");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
