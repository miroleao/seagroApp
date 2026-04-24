import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const { embryoId } = await req.json();
    if (!embryoId) return NextResponse.json({ ok: false, erro: "ID inválido" });

    const supabase = await createClient();

    // Busca transfers vinculados ao embrião
    const { data: transfers } = await supabase
      .from("transfers").select("id").eq("embryo_id", embryoId);
    const transferIds = (transfers ?? []).map((t: any) => t.id);

    if (transferIds.length > 0) {
      await supabase.from("pregnancy_diagnoses").delete().in("transfer_id", transferIds);
      await supabase.from("transfers").delete().in("id", transferIds);
    }

    const { error } = await supabase.from("embryos").delete().eq("id", embryoId);
    if (error) return NextResponse.json({ ok: false, erro: error.message });

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
