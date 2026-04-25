import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// O banco cuida do cascade: aspirations → embryos → transfers → pregnancy_diagnoses
export async function POST(req: NextRequest) {
  try {
    const { aspId } = await req.json();
    if (!aspId) return NextResponse.json({ ok: false, erro: "ID inválido" });

    const supabase = await createClient();
    const { error } = await supabase.from("aspirations").delete().eq("id", aspId);
    if (error) return NextResponse.json({ ok: false, erro: error.message });

    revalidatePath("/reproducao");
    revalidatePath("/rebanho");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
