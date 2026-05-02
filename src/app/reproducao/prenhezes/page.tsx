import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { Baby, Plus } from "lucide-react";
import Link from "next/link";
import PrenhezeTabela, { PrenheZListRow } from "./PrenhezeTabela";

function parseKey(obs: string | null | undefined, key: string): string | null {
  if (!obs) return null;
  const m = obs.match(new RegExp(`${key}:([^|]+)`));
  return m ? m[1].trim() : null;
}

export default async function PrenhezesList() {
  const supabase = await createClient();

  const { data: doadoras } = await supabase
    .from("animals")
    .select("nome")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA");

  const nomesPropriosSet = new Set(
    (doadoras ?? []).map((d) => d.nome?.toLowerCase().trim()).filter(Boolean)
  );

  const { data: sessoes } = await supabase
    .from("opu_sessions")
    .select(`
      id, data, local, responsavel,
      aspirations (
        id,
        doadora_id,
        doadora_nome,
        touro_nome,
        observacoes,
        embryos:embryos!embryos_aspiration_id_fkey (
          id,
          transfers:transfers!transfers_embryo_id_fkey (
            id,
            receptora_brinco,
            receptora:animals!transfers_receptora_id_fkey ( id, brinco, rgn ),
            pregnancy_diagnoses ( data_previsao_parto )
          )
        )
      )
    `)
    .eq("farm_id", FARM_ID)
    .eq("tipo", "COMPRADA")
    .order("data", { ascending: false });

  const rows: PrenheZListRow[] = [];

  for (const s of (sessoes ?? []) as any[]) {
    for (const a of (s.aspirations ?? [])) {
      const doadoraNome = (a.doadora_nome as string | null) ?? "";
      if (a.doadora_id) continue;
      if (doadoraNome && nomesPropriosSet.has(doadoraNome.toLowerCase().trim())) continue;

      const emb       = (a.embryos ?? [])[0] ?? null;
      const transfer  = emb?.transfers?.[0] ?? null;
      const receptora = transfer?.receptora ?? null;
      const obs       = a.observacoes as string | null;

      rows.push({
        aspId:           a.id,
        embryoId:        emb?.id       ?? null,
        transferId:      transfer?.id  ?? null,
        receptoraId:     receptora?.id ?? null,
        receptoraBrinco: receptora?.brinco ?? transfer?.receptora_brinco ?? null,
        doadoraNome:     doadoraNome || null,
        touroNome:       a.touro_nome ?? null,
        dataParto:
          transfer?.pregnancy_diagnoses?.[0]?.data_previsao_parto ??
          parseKey(obs, "PARTO"),
        vendedor:      parseKey(obs, "VENDEDOR"),
        dataCompra:    parseKey(obs, "DATA_COMPRA") ?? s.data ?? null,
        dataEntrega:   parseKey(obs, "DATA_ENTREGA"),
        resultado:     parseKey(obs, "RESULTADO"),
        dataResultado: parseKey(obs, "DATA_RESULTADO"),
      });
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prenhezes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Prenhezes compradas de doadoras de terceiros</p>
        </div>
        <Link
          href="/reproducao/prenhez/nova"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Registrar prenhezes
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <Baby className="w-4 h-4 text-pink-500" />
          <span className="font-semibold text-gray-700 text-sm">
            {rows.length} prenhe{rows.length !== 1 ? "zes" : "z"} de terceiros
          </span>
          <span className="ml-2 text-xs text-gray-400">· Clique no nome da doadora para abrir a ficha completa</span>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <Baby className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Nenhuma prenhez de terceiros registrada.</p>
            <Link href="/reproducao/prenhez/nova"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Registrar prenhezes
            </Link>
          </div>
        ) : (
          <PrenhezeTabela rows={rows} />
        )}
      </div>
    </div>
  );
}
