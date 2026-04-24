import { createClient } from "@/lib/supabase/server";
import { FARM_ID } from "@/lib/utils";
import { ReproducaoUI, type MonthGroup, type DayGroup } from "./ReproducaoUI";

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function mesAno(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [year, month] = dateStr.split("-");
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

export default async function ReproducaoPage() {
  const supabase = await createClient();

  // Receptoras do rebanho para o formulário de T.E.
  // Inclui tipo RECEPTORA e DESCARTE (igual ao módulo /rebanho)
  // Exclui apenas VENDIDA e MORTA — status NULL também é incluído
  const { data: receptorasData } = await supabase
    .from("animals")
    .select("id, brinco, nome, status_rebanho")
    .eq("farm_id", FARM_ID)
    .in("tipo", ["RECEPTORA", "DESCARTE"])
    .or("status_rebanho.not.in.(VENDIDA,MORTA),status_rebanho.is.null")
    .order("brinco", { ascending: true });

  const receptoras = (receptorasData ?? []).map((r: any) => ({
    id:             r.id as string,
    brinco:         r.brinco as string | null,
    nome:           r.nome as string | null,
    status_rebanho: r.status_rebanho as string | null,
  }));

  const { data: sessoes, error } = await supabase
    .from("opu_sessions")
    .select(`
      id, data, tipo, laboratorio, responsavel, local, observacoes,
      data_fiv, data_dg, data_sexagem,
      aspirations (
        id, doadora_id, doadora_nome, touro_nome, touro_rgn, observacoes,
        oocitos_viaveis, embryos_congelados, implantados, prenhezes_count, custo_total,
        doadora:animals!aspirations_doadora_id_fkey ( id, nome, rgn ),
        embryos:embryos!embryos_aspiration_id_fkey (
          id, sexagem, status, numero_cdc_fiv, numero_adt_te, tipo_congelamento,
          transfers:transfers!transfers_embryo_id_fkey (
            id, receptora_brinco, data_te,
            receptora:animals!transfers_receptora_id_fkey ( id, nome, brinco, rgn ),
            pregnancy_diagnoses ( resultado, data_previsao_parto, data_dg )
          )
        )
      )
    `)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });

  // Inclui REALIZADA (aspiração própria) e COMPRADA (aspiração adquirida)
  const opuSessoes = ((sessoes ?? []) as any[]).filter((s) => s.tipo === "REALIZADA" || s.tipo === "COMPRADA");

  // ── Stats globais ──────────────────────────────────────────────────
  const allEmbryos = opuSessoes.flatMap((s: any) =>
    (s.aspirations ?? []).flatMap((a: any) => a.embryos ?? [])
  );
  const totalSessoesOPU  = opuSessoes.length;
  const totalEmbrioes    = allEmbryos.length;
  const totalPositivos   = allEmbryos
    .flatMap((e: any) => (e.transfers ?? []).flatMap((t: any) => t.pregnancy_diagnoses ?? []))
    .filter((d: any) => d.resultado === "POSITIVO").length;

  // ── Agrupar sessões: mês → dia ─────────────────────────────────────
  const monthMap = new Map<string, MonthGroup>();

  for (const s of opuSessoes) {
    const data      = (s.data as string) ?? "";
    const monthKey  = data.slice(0, 7);
    const dayKey    = data.slice(0, 10);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        monthKey,
        monthLabel: mesAno(data),
        days: [],
        totalOocitos: 0,
        totalEmbrioes: 0,
        totalPositivos: 0,
        totalSessoes: 0,
      });
    }
    const mg = monthMap.get(monthKey)!;

    let dg = mg.days.find(d => d.dayKey === dayKey);
    if (!dg) { dg = { dayKey, sessions: [], events: [] }; mg.days.push(dg); }
    dg.sessions.push(s);

    mg.totalSessoes++;
    for (const asp of (s.aspirations ?? [])) {
      mg.totalOocitos   += asp.oocitos_viaveis ?? 0;
      mg.totalEmbrioes  += asp.embryos_congelados ?? 0;
      mg.totalPositivos += (asp.embryos ?? [])
        .flatMap((e: any) => (e.transfers ?? []).flatMap((t: any) => t.pregnancy_diagnoses ?? []))
        .filter((d: any) => d.resultado === "POSITIVO").length;
    }
  }

  // Calcular eventos por dia
  for (const mg of monthMap.values()) {
    for (const dayGroup of mg.days) {
      const evSet = new Set<string>(["OPU"]);
      for (const s of dayGroup.sessions) {
        if (s.data_fiv     === dayGroup.dayKey) evSet.add("FIV");
        if (s.data_sexagem === dayGroup.dayKey) evSet.add("SEX");
        if (s.data_dg      === dayGroup.dayKey) evSet.add("DG");
        for (const asp of (s.aspirations ?? [])) {
          for (const emb of (asp.embryos ?? [])) {
            for (const tr of (emb.transfers ?? [])) {
              if (tr.data_te === dayGroup.dayKey) evSet.add("T.E.");
            }
          }
        }
      }
      dayGroup.events = Array.from(evSet);
    }
  }

  const monthGroups = Array.from(monthMap.values());

  return (
    <ReproducaoUI
      monthGroups={monthGroups}
      totalSessoesOPU={totalSessoesOPU}
      totalEmbrioes={totalEmbrioes}
      totalPositivos={totalPositivos}
      erro={error?.message ?? null}
      receptoras={receptoras}
    />
  );
}
