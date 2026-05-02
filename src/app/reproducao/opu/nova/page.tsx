import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import OPUForm from "./OPUForm";

export default async function NovaOPUPage() {
  const supabase = await createClient();

  const [{ data: doadoras }, { data: receptoras }] = await Promise.all([
    supabase
      .from("animals")
      .select("id, nome, rgn")
      .eq("farm_id", FARM_ID)
      .eq("tipo", "DOADORA")
      .order("nome", { ascending: true }),
    supabase
      .from("animals")
      .select("id, brinco, nome")
      .eq("farm_id", FARM_ID)
      .eq("tipo", "RECEPTORA")
      .order("brinco", { ascending: true }),
  ]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <Link href="/reproducao" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Voltar para Reprodução
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nova Sessão OPU</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registre uma coleta com múltiplas doadoras na mesma sessão.
        </p>
      </div>

      <OPUForm doadoras={doadoras ?? []} receptoras={receptoras ?? []} />
    </div>
  );
}
