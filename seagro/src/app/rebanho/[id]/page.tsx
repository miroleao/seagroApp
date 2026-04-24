import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import { ArrowLeft, Weight, Baby, Heart, Edit2, CalendarDays, Beef, ChevronRight } from "lucide-react";
import { FichaStatusForm }  from "./FichaStatusForm";
import { FichaPesagemForm } from "./FichaPesagemForm";
import { NascimentoForm }   from "./NascimentoForm";

const CLASS_MAP: Record<string, { label: string; cls: string }> = {
  RECEPTORA: { label: "Receptora",  cls: "bg-pink-100 text-pink-700"    },
  RECRIA:    { label: "Recria",     cls: "bg-orange-100 text-orange-700" },
  DESCARTE:  { label: "Descarte",   cls: "bg-red-100 text-red-600"      },
  OUTRO:     { label: "Outro",      cls: "bg-gray-100 text-gray-600"    },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PROTOCOLADA:    { label: "Protocolada",           cls: "bg-purple-100 text-purple-700" },
  INSEMINADA:     { label: "Inseminada",            cls: "bg-blue-100 text-blue-700"     },
  IMPLANTADA:     { label: "Implantada c/ Embrião", cls: "bg-amber-100 text-amber-700"   },
  PRENHA:         { label: "Prenha",                cls: "bg-green-100 text-green-700"   },
  PRENHA_EMBRIAO: { label: "Prenha de Embrião",     cls: "bg-teal-100 text-teal-700"     },
  VAZIA:          { label: "Vazia",                 cls: "bg-gray-100 text-gray-500"     },
  DESCARTE:       { label: "Descarte",              cls: "bg-red-100 text-red-600"       },
};

export default async function FichaRebanhoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Animal ──────────────────────────────────────────────────────────────────
  const { data: animal } = await supabase
    .from("animals")
    .select("id, nome, brinco, tipo, classificacao, status_rebanho, situacao, localizacao, data_entrada, forma_entrada, peso_atual, observacoes, nascimento")
    .eq("id", id)
    .eq("farm_id", FARM_ID)
    .single();

  if (!animal) notFound();

  // ── Pesagens ─────────────────────────────────────────────────────────────────
  const { data: pesagens } = await supabase
    .from("pesagens")
    .select("id, data, peso_kg, observacoes, criado_em")
    .eq("animal_id", id)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });

  // ── Prenhez ativa (para exibir info + botão de nascimento) ──────────────────
  const { data: prenhezes } = await supabase
    .from("pregnancy_diagnoses")
    .select(`
      id, data_previsao_parto, data_dg,
      transfer:transfers (
        id, receptora_id,
        embryo:embryos (
          aspiration:aspirations (
            doadora_id, doadora_nome, touro_nome,
            doadora:animals!aspirations_doadora_id_fkey ( id, nome )
          )
        )
      )
    `)
    .eq("farm_id", FARM_ID)
    .eq("resultado", "POSITIVO");

  // Filtra pelo animal atual
  const prenhez = (prenhezes ?? []).find(p => (p.transfer as any)?.receptora_id === id) ?? null;
  const transfer = prenhez ? (prenhez.transfer as any) : null;
  const asp      = transfer?.embryo?.aspiration;
  const doadora  = asp?.doadora ?? null;

  // ── Histórico reprodutivo (todos os transfers desta receptora) ──────────────
  const { data: historico } = await supabase
    .from("transfers")
    .select(`
      id, data_te, resultado_te, sessao_nome,
      embryo:embryos (
        aspiration:aspirations ( doadora_nome, touro_nome )
      ),
      diagnoses:pregnancy_diagnoses ( resultado, data_dg, data_previsao_parto )
    `)
    .eq("farm_id", FARM_ID)
    .eq("receptora_id", id)
    .order("data_te", { ascending: false });

  const isPrenha = animal.status_rebanho === "PRENHA" || animal.status_rebanho === "PRENHA_EMBRIAO";

  const classBadge  = CLASS_MAP[animal.classificacao ?? ""] ?? { label: animal.classificacao ?? "—", cls: "bg-gray-100 text-gray-500" };
  const statusBadge = STATUS_MAP[animal.status_rebanho ?? ""] ?? { label: "—", cls: "bg-gray-100 text-gray-400" };

  const FORMA_LABEL: Record<string, string> = {
    COMPRA: "Compra", EMPRESTIMO: "Empréstimo", PROPRIO: "Próprio", DOACAO: "Doação", OUTRO: "Outro",
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Navegação */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/rebanho" className="flex items-center gap-1 hover:text-brand-600">
          <ArrowLeft className="w-4 h-4" /> Rebanho
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{animal.brinco ?? animal.nome}</span>
      </div>

      {/* Cabeçalho do animal */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{animal.brinco ?? animal.nome}</h1>
              <span className={`badge ${classBadge.cls}`}>{classBadge.label}</span>
              <span className={`badge ${statusBadge.cls}`}>{statusBadge.label}</span>
            </div>
            {animal.nome !== animal.brinco && (
              <p className="text-sm text-gray-400 mt-0.5">{animal.nome}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              {animal.data_entrada && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Entrada: {formatDate(animal.data_entrada)}
                  {animal.forma_entrada && ` (${FORMA_LABEL[animal.forma_entrada] ?? animal.forma_entrada})`}
                </span>
              )}
              {animal.localizacao && (
                <span className="flex items-center gap-1">
                  <Beef className="w-3.5 h-3.5" />
                  {animal.localizacao}
                </span>
              )}
              {animal.peso_atual && (
                <span className="flex items-center gap-1 font-semibold text-gray-700">
                  <Weight className="w-3.5 h-3.5" />
                  {animal.peso_atual} kg
                </span>
              )}
            </div>
            {animal.observacoes && (
              <p className="text-xs text-gray-400 mt-2 italic">{animal.observacoes}</p>
            )}
          </div>

          {/* Botão nascimento (destaque) */}
          {isPrenha && prenhez && transfer && (
            <div className="shrink-0">
              <NascimentoForm
                receptoraId={id}
                transferId={transfer.id}
                previsaoParto={prenhez.data_previsao_parto}
                doadoraNome={asp?.doadora?.nome ?? asp?.doadora_nome ?? null}
                touroNome={asp?.touro_nome ?? null}
              />
            </div>
          )}
        </div>

        {/* Info prenhez (se prenha) */}
        {isPrenha && prenhez && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Doadora</p>
              {doadora?.id ? (
                <Link href={`/doadoras/${doadora.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                  {doadora.nome ?? asp?.doadora_nome}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-gray-700">{asp?.doadora_nome ?? "—"}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Touro</p>
              <p className="text-sm font-semibold text-gray-700">{asp?.touro_nome ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">DG Positivo</p>
              <p className="text-sm font-semibold text-gray-700">{formatDate(prenhez.data_dg)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Previsão de Parto</p>
              <p className="text-sm font-bold text-green-700">{formatDate(prenhez.data_previsao_parto)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Status Reprodutivo ───────────────────────────────────────────── */}
        <section className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" />
            <h2 className="font-semibold text-gray-900">Status Reprodutivo</h2>
          </div>
          <div className="px-5 py-4">
            <FichaStatusForm animalId={id} statusAtual={animal.status_rebanho} situacaoAtual={animal.situacao} />
          </div>
        </section>

        {/* ── Controle de Peso ─────────────────────────────────────────────── */}
        <section className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Weight className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-900">Controle de Peso</h2>
            <span className="badge bg-gray-100 text-gray-500 ml-auto text-[10px]">
              {pesagens?.length ?? 0} registros
            </span>
          </div>

          {/* Form nova pesagem */}
          <div className="px-5 py-4 border-b border-gray-50 bg-gray-50">
            <FichaPesagemForm animalId={id} />
          </div>

          {/* Histórico */}
          {pesagens && pesagens.length > 0 ? (
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {pesagens.map((p) => (
                <div key={p.id} className="px-5 py-2.5 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{p.peso_kg} kg</p>
                    {p.observacoes && <p className="text-xs text-gray-400">{p.observacoes}</p>}
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(p.data)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-gray-400 text-sm">Nenhuma pesagem registrada.</div>
          )}
        </section>
      </div>

      {/* ── Histórico Reprodutivo ───────────────────────────────────────────── */}
      {historico && historico.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Baby className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Histórico Reprodutivo</h2>
            <span className="badge bg-brand-100 text-brand-700 ml-auto">{historico.length} implantações</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Data TE</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Doadora</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Touro</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Resultado DG</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Prev. Parto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {historico.map((t: any) => {
                const asp = t.embryo?.aspiration;
                const dg  = (t.diagnoses ?? [])[0];
                const DG_CLS: Record<string, string> = {
                  POSITIVO: "bg-green-100 text-green-700",
                  NEGATIVO: "bg-red-100 text-red-600",
                  PARIDA:   "bg-purple-100 text-purple-700",
                };
                return (
                  <tr key={t.id} className="table-row-hover">
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(t.data_te)}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{asp?.doadora_nome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{asp?.touro_nome ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {dg ? (
                        <span className={`badge text-[10px] ${DG_CLS[dg.resultado] ?? "bg-gray-100 text-gray-500"}`}>
                          {dg.resultado}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(dg?.data_previsao_parto ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
