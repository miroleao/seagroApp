import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const { sessionIds } = await req.json();
    if (!sessionIds?.length) return NextResponse.json({ ok: false, erro: "IDs inválidos" });

    const supabase = await createClient();

    const { data: asps } = await supabase
      .from("aspirations").select("id").in("session_id", sessionIds);
    const aspIds = (asps ?? []).map((a: any) => a.id);

    if (aspIds.length > 0) {
      const { data: embs } = await supabase
        .from("embryos").select("id").in("aspiration_id", aspIds);
      const embIds = (embs ?? []).map((e: any) => e.id);

      if (embIds.length > 0) {
        const { data: trs } = await supabase
          .from("transfers").select("id").in("embryo_id", embIds);
        const trIds = (trs ?? []).map((t: any) => t.id);

        if (trIds.length > 0) {
          await supabase.from("pregnancy_diagnoses").delete().in("transfer_id", trIds);
          await supabase.from("transfers").delete().in("id", trIds);
        }
        await supabase.from("embryos").delete().in("id", embIds);
      }
      await supabase.from("aspirations").delete().in("id", aspIds);
    }

    const { error } = await supabase.from("opu_sessions").delete().in("id", sessionIds);
    if (error) return NextResponse.json({ ok: false, erro: error.message });

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
