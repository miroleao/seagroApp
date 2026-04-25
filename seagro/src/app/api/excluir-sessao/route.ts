import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// O banco cuida do cascade: opu_sessions → aspirations → embryos
//                                        → transfers → pregnancy_diagnoses
export async function POST(req: NextRequest) {
  try {
    const { sessionIds } = await req.json();
    if (!sessionIds?.length) return NextResponse.json({ ok: false, erro: "IDs inválidos" });

    const supabase = await createClient();
    const { error } = await supabase.from("opu_sessions").delete().in("id", sessionIds);
    if (error) return NextResponse.json({ ok: false, erro: error.message });

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
