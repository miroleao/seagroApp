import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { SemenUI } from "./SemenUI";

export const revalidate = 0;

export default async function SemenPage() {
  const supabase = await createClient();

  // Estoque de sêmen
  const { data: estoqueRaw, error } = await supabase
    .from("semen_stock")
    .select("id, touro_id, touro_nome, touro_rgn, doses, tipo, local_armazenamento, valor_por_dose, observacoes, criado_em")
    .eq("farm_id", FARM_ID)
    .order("touro_nome", { ascending: true })
    .order("criado_em", { ascending: false });

  // Touros cadastrados (para o dropdown do formulário)
  const { data: tourosRaw } = await supabase
    .from("animals")
    .select("id, nome, rgn, rgd, brinco")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "TOURO")
    .order("nome", { ascending: true });

  const estoque = (estoqueRaw ?? []) as any[];
  const touros = (tourosRaw ?? []).map((t: any) => ({
    id:     t.id as string,
    nome:   (t.nome ?? "") as string,
    rgn:    (t.rgn ?? t.rgd ?? null) as string | null,
    brinco: (t.brinco ?? null) as string | null,
  }));

  return <SemenUI estoque={estoque} touros={touros} erro={error?.message ?? null} />;
}
