import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatCurrency, FARM_ID } from "@/lib/utils";
import { idadeExata, statusPeso } from "@/lib/acnb";
import {
  Baby, FlaskConical, Heart, AlertTriangle,
  TrendingUp, Beef, Scale, CalendarCheck,
  Trophy, CalendarDays, BarChart3, Star,
} from "lucide-react";
import { BuscaGlobal } from "./BuscaGlobal";

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; href?: string;
}) {
  const inner = (
    <div className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── DiasBadge ────────────────────────────────────────────────────────────────
function DiasBadge({ dias }: { dias: number }) {
  if (dias < 0)  return <span className="badge bg-red-100 text-red-700">Atrasado {Math.abs(dias)}d</span>;
  if (dias === 0) return <span className="badge bg-orange-100 text-orange-700">Hoje!</span>;
  if (dias <= 7)  return <span className="badge bg-yellow-100 text-yellow-700">{dias}d</span>;
  if (dias <= 30) return <span className="badge bg-blue-100 text-blue-700">{dias}d</span>;
  return <span className="badge bg-gray-100 text-gray-600">{dias}d</span>;
}

// ─── RankingBar — SVG server-side ─────────────────────────────────────────────
function RankingBar({ data }: {
  data: { label: string; value: number; sub?: string }[];
}) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-36 text-gray-300 text-sm">Sem dados</div>
  );
  const max = Math.max(...data.map(d => d.value), 1);
  const CORES = ["#16a34a","#2563eb","#7c3aed","#d97706","#dc2626","#0891b2","#be185d","#65a30d"];

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex items-center gap-3">
            <div className="w-28 min-w-[7rem] truncate text-right">
              <span className="text-xs font-medium text-gray-700">{d.label}</span>
              {d.sub && <span className="block text-[10px] text-gray-400">{d.sub}</span>}
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: CORES[i % CORES.length] }}
              >
                <span className="text-white text-[10px] font-bold">{d.value}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient();

  const hoje  = new Date().toISOString().split("T")[0];
  const em30  = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  // ── Totais ──────────────────────────────────────────────────────────────────
  const [
    { count: totalDoadoras },
    { count: totalReceptoras },
    { count: totalEmbrioes },
    { count: totalAnimais },
  ] = await Promise.all([
    supabase.from("animals").select("*", { count: "exact", head: true }).eq("farm_id", FARM_ID).eq("tipo", "DOADORA"),
    supabase.from("animals").select("*", { count: "exact", head: true }).eq("farm_id", FARM_ID).eq("tipo", "RECEPTORA"),
    supabase.from("embryos").select("*", { count: "exact", head: true }).eq("farm_id", FARM_ID).eq("status", "DISPONIVEL"),
    supabase.from("animals").select("*", { count: "exact", head: true }).eq("farm_id", FARM_ID).neq("tipo", "DESCARTE"),
  ]);

  // ── Nascimentos próximos 30 dias ────────────────────────────────────────────
  const { data: nascimentos } = await supabase
    .from("pregnancy_diagnoses")
    .select(`
      id, data_previsao_parto, resultado,
      transfer:transfers (
        id, receptora_brinco, sessao_nome,
        receptora:animals ( id, nome, brinco ),
        embryo:embryos (
          aspiration:aspirations ( id, doadora_id, doadora_nome, touro_nome )
        )
      )
    `)
    .eq("farm_id", FARM_ID)
    .eq("resultado", "POSITIVO")
    .gte("data_previsao_parto", hoje)
    .lte("data_previsao_parto", em30)
    .order("data_previsao_parto", { ascending: true })
    .limit(10);

  // ── Ranking: top doadoras por embriões produzidos ──────────────────────────
  const { data: embryosAll } = await supabase
    .from("embryos")
    .select("id, aspiration:aspirations( doadora_id, doadora_nome )")
    .eq("farm_id", FARM_ID);

  const rankingMap: Record<string, { nome: string; doadoraId: string | null; total: number }> = {};
  for (const e of embryosAll ?? []) {
    const asp = (e as any).aspiration;
    const nome = asp?.doadora_nome ?? "Desconhecida";
    const id   = asp?.doadora_id   ?? null;
    if (!rankingMap[nome]) rankingMap[nome] = { nome, doadoraId: id, total: 0 };
    rankingMap[nome].total++;
  }
  const rankingEmbrioes = Object.values(rankingMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map(d => ({ label: d.nome, value: d.total, sub: "embriões" }));

  // ── Alertas de peso (animais para_pista) ────────────────────────────────────
  const { data: doadoras } = await supabase
    .from("animals")
    .select("id, status_reprodutivo, para_pista, peso_atual, nascimento, sexo")
    .eq("farm_id", FARM_ID)
    .eq("tipo", "DOADORA");

  const hoje2 = new Date();
  const pistAnimais = (doadoras ?? []).filter((d: any) => d.para_pista && d.nascimento && d.peso_atual);
  const alertasPeso = pistAnimais.filter((a: any) => {
    const { meses, dias } = idadeExata(a.nascimento, hoje2);
    const sexo = a.sexo === "M" ? "M" : "F";
    const st = statusPeso(a.peso_atual, sexo, meses, dias);
    return st === "ABAIXO" || st === "ACIMA";
  });

  // ── Próximas exposições ─────────────────────────────────────────────────────
  const { data: proxExpos } = await supabase
    .from("exhibitions")
    .select("id, nome, data_base, tipo, local")
    .eq("farm_id", FARM_ID)
    .gte("data_base", hoje)
    .order("data_base", { ascending: true })
    .limit(5);

  // Contagem de animais para pista (fêmeas e machos)
  const { data: pistaCandidatos } = await supabase
    .from("animals")
    .select("id, tipo, sexo")
    .eq("farm_id", FARM_ID)
    .eq("para_pista", true);

  const pistFemeas = (pistaCandidatos ?? []).filter((a: any) => a.tipo !== "TOURO").length;
  const pistMachos = (pistaCandidatos ?? []).filter((a: any) => a.tipo === "TOURO").length;

  function diasRestantes(data: string) {
    const d = new Date(data + "T12:00:00");
    const h = new Date(); h.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - h.getTime()) / 86400000);
  }

  const TIPO_EXPO: Record<string, string> = {
    OFICIAL: "bg-brand-100 text-brand-700",
    OURO:    "bg-yellow-100 text-yellow-700",
    EXPOINEL:"bg-purple-100 text-purple-700",
    REGIONAL:"bg-blue-100 text-blue-700",
    LIVRE:   "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-6 space-y-8">

      {/* Cabeçalho + Busca Global */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500 mt-1">
            SE Agropecuária Nelore de Elite —{" "}
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="w-full md:w-auto md:min-w-[340px]">
          <Suspense>
            <BuscaGlobal />
          </Suspense>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Doadoras ativas"  value={totalDoadoras  ?? 0} icon={Heart}       color="bg-pink-500"    href="/doadoras" />
        <StatCard label="Receptoras"        value={totalReceptoras ?? 0} icon={Beef}        color="bg-amber-500"   href="/rebanho" />
        <StatCard label="Embriões disp."    value={totalEmbrioes  ?? 0} icon={FlaskConical} color="bg-brand-600"   href="/reproducao" />
        <StatCard label="Total de animais"  value={totalAnimais   ?? 0} icon={TrendingUp}   color="bg-indigo-500"  href="/rebanho" />
      </div>

      {/* Alertas de peso */}
      {alertasPeso.length > 0 && (
        <div className="card p-4 flex items-start gap-3 border-red-200 bg-red-50">
          <Scale className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <strong>{alertasPeso.length} animal(is) para pista</strong> com peso fora da tabela ABCZ.{" "}
            <Link href="/pista" className="underline font-medium">Ver alertas na aba Pista →</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Nascimentos próximos 30 dias ────────────────────────────────── */}
        <section className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Baby className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Nascimentos Próximos 30 Dias</h2>
            <span className="badge bg-brand-100 text-brand-700 ml-auto">
              {nascimentos?.length ?? 0} previstos
            </span>
          </div>
          {!nascimentos?.length ? (
            <div className="px-5 py-8 text-center">
              <CalendarCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum nascimento previsto nos próximos 30 dias</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {nascimentos.map((dg) => {
                const t           = dg.transfer as any;
                const receptoraId = t?.receptora?.id;
                const receptoraNome = t?.receptora?.nome || t?.receptora_brinco || "—";
                const doadoraId   = t?.embryo?.aspiration?.doadora_id;
                const doadoraNome = t?.embryo?.aspiration?.doadora_nome || "—";
                const touro       = t?.embryo?.aspiration?.touro_nome   || "—";
                const dias        = diasRestantes(dg.data_previsao_parto!);
                return (
                  <div key={dg.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {/* Receptora */}
                      {receptoraId ? (
                        <Link href={`/rebanho`}
                          className="text-sm font-medium text-brand-700 hover:underline truncate block">
                          {receptoraNome}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">{receptoraNome}</p>
                      )}
                      {/* Doadora × Touro */}
                      <p className="text-xs text-gray-500 truncate">
                        {doadoraId ? (
                          <Link href={`/doadoras/${doadoraId}`} className="text-brand-600 hover:underline font-medium">
                            {doadoraNome}
                          </Link>
                        ) : doadoraNome}
                        {" × "}{touro}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{formatDate(dg.data_previsao_parto)}</p>
                      <DiasBadge dias={dias} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Ranking Doadoras por Embriões ───────────────────────────────── */}
        <section className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Top Doadoras — Embriões Produzidos</h2>
            <span className="badge bg-brand-100 text-brand-700 ml-auto">
              {Object.keys(rankingMap).length} doadoras
            </span>
          </div>
          <div className="px-5 py-5">
            {rankingEmbrioes.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-300 text-sm">Sem dados de embriões</div>
            ) : (
              <RankingBar data={rankingEmbrioes} />
            )}
          </div>
          <div className="px-5 pb-3">
            <Link href="/reproducao" className="text-xs text-brand-600 hover:underline">
              Ver todas as aspirações →
            </Link>
          </div>
        </section>

      </div>

      {/* ── Próximas Exposições ─────────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-gray-900">Próximas Exposições</h2>
          <span className="badge bg-brand-100 text-brand-700 ml-auto">
            {proxExpos?.length ?? 0} agendadas
          </span>
          <Link href="/pista" className="text-xs text-brand-600 hover:underline ml-2">
            Ver todas →
          </Link>
        </div>
        {!proxExpos?.length ? (
          <div className="px-5 py-8 text-center">
            <CalendarDays className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhuma exposição agendada.</p>
            <Link href="/pista" className="text-xs text-brand-600 hover:underline mt-1 inline-block">
              Cadastrar exposição →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(proxExpos ?? []).map((e: any) => {
              const dias = diasRestantes(e.data_base);
              return (
                <div key={e.id} className="px-5 py-3.5 flex items-center gap-4">
                  {/* Data destaque */}
                  <div className="shrink-0 w-12 text-center bg-brand-50 rounded-lg py-1.5">
                    <p className="text-[10px] text-brand-500 font-medium uppercase leading-none">
                      {new Date(e.data_base + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                    </p>
                    <p className="text-lg font-bold text-brand-700 leading-tight">
                      {new Date(e.data_base + "T12:00:00").getDate()}
                    </p>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{e.nome}</p>
                      <span className={`badge text-[10px] ${TIPO_EXPO[e.tipo] ?? TIPO_EXPO.LIVRE}`}>{e.tipo}</span>
                    </div>
                    <p className="text-xs text-gray-400">{e.local ?? "Local não informado"}</p>
                  </div>
                  {/* Animais selecionados */}
                  <div className="shrink-0 text-right">
                    <DiasBadge dias={dias} />
                    <div className="mt-1 flex items-center gap-2 justify-end">
                      {pistFemeas > 0 && (
                        <span className="text-[10px] text-pink-600 font-medium">
                          ♀ {pistFemeas}
                        </span>
                      )}
                      {pistMachos > 0 && (
                        <span className="text-[10px] text-blue-600 font-medium">
                          ♂ {pistMachos}
                        </span>
                      )}
                      {pistFemeas === 0 && pistMachos === 0 && (
                        <span className="text-[10px] text-gray-300">Sem animais sel.</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
