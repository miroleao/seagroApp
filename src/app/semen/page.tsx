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

  // Touros cadastrados (para o dropdown do formulário de entrada)
  const { data: tourosRaw } = await supabase
    .from("animals")
    .select("id, nome, rgn, rgd, brinco")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "TOURO")
    .order("nome", { ascending: true });

  // Doadoras (para o dropdown do formulário de saída)
  const { data: doadorasRaw } = await supabase
    .from("animals")
    .select("id, nome, rgn, brinco")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA")
    .order("nome", { ascending: true });

  // Histórico de usos
  const { data: usosRaw } = await supabase
    .from("semen_uses")
    .select("id, semen_stock_id, data_saida, doses_usadas, tipo_uso, doadora_id, doadora_nome, veterinario, usuario_nome, observacoes")
    .eq("farm_id", FARM_ID)
    .order("data_saida", { ascending: false });

  const estoque = (estoqueRaw ?? []) as any[];
  const usos    = (usosRaw ?? []) as any[];
  const touros = (tourosRaw ?? []).map((t: any) => ({
    id:     t.id as string,
    nome:   (t.nome ?? "") as string,
    rgn:    (t.rgn ?? t.rgd ?? null) as string | null,
    brinco: (t.brinco ?? null) as string | null,
  }));
  const doadoras = (doadorasRaw ?? []).map((d: any) => ({
    id:     d.id as string,
    nome:   (d.nome ?? "") as string,
    rgn:    (d.rgn ?? null) as string | null,
    brinco: (d.brinco ?? null) as string | null,
  }));

  return (
    <SemenUI
      estoque={estoque}
      touros={touros}
      doadoras={doadoras}
      usos={usos}
      erro={error?.message ?? null}
    />
  );
}
