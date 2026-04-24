import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const { aspId } = await req.json();
    if (!aspId) return NextResponse.json({ ok: false, erro: "ID inválido" });

    const supabase = await createClient();

    const { data: embryos } = await supabase
      .from("embryos").select("id").eq("aspiration_id", aspId);
    const embryoIds = (embryos ?? []).map((e: any) => e.id);

    if (embryoIds.length > 0) {
      const { data: transfers } = await supabase
        .from("transfers").select("id").in("embryo_id", embryoIds);
      const transferIds = (transfers ?? []).map((t: any) => t.id);

      if (transferIds.length > 0) {
        await supabase.from("pregnancy_diagnoses").delete().in("transfer_id", transferIds);
        await supabase.from("transfers").delete().in("id", transferIds);
      }
      await supabase.from("embryos").delete().in("id", embryoIds);
    }

    const { error } = await supabase.from("aspirations").delete().eq("id", aspId);
    if (error) return NextResponse.json({ ok: false, erro: error.message });

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
