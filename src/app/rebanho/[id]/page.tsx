import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import { ArrowLeft, Weight, Baby, Heart, CalendarDays, Beef, ChevronRight, CheckCircle, XCircle, AlertTriangle, RefreshCw, Syringe, FlaskConical } from "lucide-react";
import { FichaStatusForm }         from "./FichaStatusForm";
import { FichaPesagemForm }        from "./FichaPesagemForm";
import { NascimentoForm }          from "./NascimentoForm";
import { VincularBezerroReceptora }   from "./VincularBezerroReceptora";
import { VincularCriaManual }         from "./VincularCriaManual";
import { MarcarDesfechoHistorico }    from "./MarcarDesfechoHistorico";

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
  PARIDA:         { label: "Parida",                cls: "bg-blue-100 text-blue-700"     },
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

  // Busca cria vinculada manualmente — query separada para não quebrar se a migration ainda não rodou
  let criaVinculada: { id: string; nome: string; tipo: string; rgn: string | null } | null = null;
  try {
    const { data: animalComCria } = await supabase
      .from("animals")
      .select("cria_id, cria:animals!animals_cria_id_fkey ( id, nome, tipo, rgn )")
      .eq("id", id)
      .eq("farm_id", FARM_ID)
      .single();
    criaVinculada = (animalComCria as any)?.cria ?? null;
  } catch {
    // migration ainda não rodada — ignora silenciosamente
  }

  if (!animal) notFound();

  // ── Pesagens ─────────────────────────────────────────────────────────────────
  const { data: pesagens } = await supabase
    .from("pesagens")
    .select("id, data, peso_kg, observacoes, criado_em")
    .eq("animal_id", id)
    .eq("farm_id", FARM_ID)
    .order("data", { ascending: false });

  // ── Prenhez ativa (para exibir info + botão de nascimento) ──────────────────
  const selectTransferEmbriao = `
    id, receptora_id, data_te,
    embryo:embryos (
      id, numero_cdc_fiv, numero_adt_te,
      aspiration:aspirations (
        doadora_id, doadora_nome, touro_nome,
        doadora:animals!aspirations_doadora_id_fkey ( id, nome )
      )
    )
  `;

  const { data: prenhezes } = await supabase
    .from("pregnancy_diagnoses")
    .select(`
      id, data_previsao_parto, data_dg,
      transfer:transfers ( ${selectTransferEmbriao} )
    `)
    .eq("farm_id", FARM_ID)
    .in("resultado", ["POSITIVO", "AGUARDANDO"])
    .is("tipo_desfecho", null);

  // Filtra pelo animal atual
  let prenhez  = (prenhezes ?? []).find(p => (p.transfer as any)?.receptora_id === id) ?? null;
  let transfer = prenhez ? (prenhez.transfer as any) : null;

  // Fallback: prenha sem DG (ex: prenhez de terceiros sem data de parto registrada)
  if (!transfer && (animal.status_rebanho === "PRENHA_EMBRIAO" || animal.status_rebanho === "PRENHA")) {
    const { data: latestTf } = await supabase
      .from("transfers")
      .select(selectTransferEmbriao)
      .eq("farm_id", FARM_ID)
      .eq("receptora_id", id)
      .order("data_te", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestTf) transfer = latestTf;
  }

  const embriao  = transfer?.embryo ?? null;
  const asp      = embriao?.aspiration ?? null;
  const doadora  = asp?.doadora ?? null;
  const dataTe   = transfer?.data_te ?? null;

  // ── Histórico reprodutivo ────────────────────────────────────────────────────
  // Duas queries separadas para cobrir receptora_id (UUID) e receptora_brinco (texto)
  const selectTransf = `
    id, data_te, sessao_nome, receptora_id, receptora_brinco,
    embryo:embryos (
      id,
      aspiration:aspirations ( doadora_id, doadora_nome, touro_nome,
        doadora:animals!aspirations_doadora_id_fkey ( id, nome )
      )
    ),
    diagnoses:pregnancy_diagnoses ( id, resultado, data_dg, data_previsao_parto, tipo_desfecho, data_desfecho, animal_nascido_id,
      animal_nascido:animals!pregnancy_diagnoses_animal_nascido_id_fkey ( id, nome, tipo, rgn )
    )
  `;

  const { data: hPorId } = await supabase
    .from("transfers")
    .select(selectTransf)
    .eq("farm_id", FARM_ID)
    .eq("receptora_id", id)
    .order("data_te", { ascending: false });

  let hPorBrinco: any[] = [];
  if (animal.brinco) {
    const { data } = await supabase
      .from("transfers")
      .select(selectTransf)
      .eq("farm_id", FARM_ID)
      .eq("receptora_brinco", animal.brinco)
      .is("receptora_id", null)
      .order("data_te", { ascending: false });
    hPorBrinco = data ?? [];
  }

  // Merge sem duplicatas, ordenado por data_te desc
  const idsSeen = new Set<string>();
  const historico: any[] = [];
  for (const t of [...(hPorId ?? []), ...hPorBrinco]) {
    if (!idsSeen.has(t.id)) { idsSeen.add(t.id); historico.push(t); }
  }
  historico.sort((a, b) => (b.data_te ?? "").localeCompare(a.data_te ?? ""));

  // Desfecho mais recente (para o card de cabeçalho)
  // Busca o primeiro transfer que tenha algum DG com tipo_desfecho preenchido
  const ultimoTransferComDesfecho = (historico ?? []).find(
    (t: any) => (t.diagnoses ?? []).some((d: any) => d?.tipo_desfecho)
  ) ?? null;
  // Dentro desse transfer, pega o DG com tipo_desfecho (pode haver múltiplos DGs)
  const ultimoDg = ultimoTransferComDesfecho
    ? ((ultimoTransferComDesfecho as any).diagnoses ?? []).find((d: any) => d?.tipo_desfecho)
      ?? (ultimoTransferComDesfecho as any).diagnoses?.[0]
    : null;
  const ultimoAsp = ultimoTransferComDesfecho
    ? (ultimoTransferComDesfecho as any).embryo?.aspiration
    : null;

  // Busca TODOS os filhotes nascidos nas datas de parição desta receptora (1 query só)
  const datasParicao = (historico ?? [])
    .flatMap((t: any) => t.diagnoses ?? [])
    .filter((d: any) => (d.tipo_desfecho === "PARIDA" || d.resultado === "PARIDA") && d.data_desfecho)
    .map((d: any) => d.data_desfecho as string);

  const { data: todosFilhotes } = datasParicao.length > 0
    ? await supabase
        .from("animals")
        .select("id, nome, tipo, nascimento, mae_id, rgn")
        .eq("farm_id", FARM_ID)
        .eq("nascido_se_agro", true)
        .in("nascimento", datasParicao)
    : { data: [] };

  // ── Animais disponíveis para vincular como bezerro ───────────────────────────
  // Inclui DOADORA, TOURO e NASCIDO (bezerros cadastrados via form de nascimento)
  const { data: animaisVincular } = await supabase
    .from("animals")
    .select("id, nome, tipo")
    .eq("farm_id", FARM_ID)
    .in("tipo", ["DOADORA", "TOURO", "NASCIDO"])
    .order("nome");

  // ── Log de movimentação reprodutiva ─────────────────────────────────────────
  let statusLog: { id: string; status: string; observacoes: string | null; data_evento: string }[] = [];
  try {
    const { data: logData } = await supabase
      .from("animal_status_log")
      .select("id, status, observacoes, data_evento")
      .eq("animal_id", id)
      .eq("farm_id", FARM_ID)
      .order("data_evento", { ascending: false })
      .order("criado_em", { ascending: false });
    statusLog = logData ?? [];
  } catch {
    // migration ainda não rodada — ignora silenciosamente
  }

  // ── Transações da receptora (vendas) ─────────────────────────────────────────
  const { data: transacoes } = await supabase
    .from("transactions")
    .select("id, tipo, contraparte, valor_total, data, observacoes")
    .eq("farm_id", FARM_ID)
    .eq("animal_id", id)
    .order("data", { ascending: false });

  // Helper: acha o bezerro de uma data de parição
  function filhoteDaParicao(dataDesfecho: string, doadoraId: string | null) {
    const candidatos = (todosFilhotes ?? []).filter((f: any) => f.nascimento === dataDesfecho);
    if (!candidatos.length) return null;
    if (doadoraId) {
      return (candidatos.find((f: any) => f.mae_id === doadoraId) ?? candidatos[0]) as any;
    }
    return candidatos[0] as any;
  }

  // Bezerro da parição mais recente (para o card de cabeçalho)
  // Prioridade: FK direta no DG > busca por data de nascimento
  const bezzerraNascida = (ultimoDg?.tipo_desfecho === "PARIDA" || ultimoDg?.resultado === "PARIDA") && ultimoDg?.data_desfecho
    ? ((ultimoDg?.animal_nascido ?? null) || filhoteDaParicao(ultimoDg.data_desfecho, ultimoAsp?.doadora_id ?? null))
    : null;

  // Cria vinculada manualmente (para receptoras sem TE)
  const criaManual = criaVinculada;

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
          {isPrenha && transfer && (
            <div className="shrink-0">
              <NascimentoForm
                receptoraId={id}
                transferId={transfer.id}
                previsaoParto={prenhez?.data_previsao_parto ?? null}
                doadoraNome={asp?.doadora?.nome ?? asp?.doadora_nome ?? null}
                touroNome={asp?.touro_nome ?? null}
              />
            </div>
          )}
        </div>

        {/* ── Bezerro vinculado manualmente (sem TE) ──────────────────────── */}
        {!isPrenha && !ultimoDg?.tipo_desfecho && criaManual && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-700 font-semibold text-sm">🐄 Bezerro(a) registrado</span>
              <span className="text-gray-400 mx-1">—</span>
              <Link
                href={criaManual.tipo === "TOURO" ? `/machos/${criaManual.id}` : `/doadoras/${criaManual.id}`}
                className="font-semibold text-brand-600 hover:underline text-sm"
              >
                {criaManual.tipo === "TOURO" ? "🐂" : "🐄"} {criaManual.nome}
              </Link>
              {criaManual.rgn && (
                <span className="text-xs text-gray-400 font-mono">({criaManual.rgn})</span>
              )}
            </div>
          </div>
        )}

        {/* ── Desfecho do último embrião (se não for mais prenha) ─────────── */}
        {!isPrenha && ultimoDg?.tipo_desfecho && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {(ultimoDg.tipo_desfecho === "PARIDA" || ultimoDg.resultado === "PARIDA") ? (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-700 font-semibold text-sm">🐄 Pariu em {formatDate(ultimoDg.data_desfecho)}</span>
                <span className="text-green-600 text-sm">
                  {bezzerraNascida ? (
                    <>
                      <span className="text-gray-400 mx-1">—</span>
                      <Link
                        href={bezzerraNascida.tipo === "DOADORA" ? `/doadoras/${bezzerraNascida.id}` : `/machos/${bezzerraNascida.id}`}
                        className="font-semibold text-brand-600 hover:underline"
                      >
                        {bezzerraNascida.nome}
                      </Link>
                    </>
                  ) : ultimoAsp?.doadora_nome || ultimoAsp?.touro_nome ? (
                    <span className="text-gray-500">
                      <span className="text-gray-400 mx-1">—</span>
                      {[ultimoAsp.doadora_nome, ultimoAsp.touro_nome].filter(Boolean).join(" × ")}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : ultimoDg.tipo_desfecho === "ABORTOU" ? (
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-orange-700 font-semibold text-sm">⚠️ Abortou em {formatDate(ultimoDg.data_desfecho)}</span>
                {ultimoAsp?.doadora_nome && (
                  <span className="text-gray-400 text-xs">{ultimoAsp.doadora_nome} × {ultimoAsp.touro_nome ?? "—"}</span>
                )}
              </div>
            ) : ultimoDg.tipo_desfecho === "REABSORVEU" ? (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <span className="text-yellow-700 font-semibold text-sm">🔄 Absorção em {formatDate(ultimoDg.data_desfecho)}</span>
              </div>
            ) : ultimoDg.tipo_desfecho === "OBITO" ? (
              <div className="flex items-center gap-2 p-3 bg-gray-100 border border-gray-300 rounded-lg">
                <span className="text-gray-700 font-semibold text-sm">💀 Óbito em {formatDate(ultimoDg.data_desfecho)}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Info prenhez (se prenha — funciona com ou sem DG registrado) */}
        {isPrenha && transfer && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Embrião</p>
              <p className="text-sm font-semibold text-gray-700 font-mono">
                {embriao?.numero_cdc_fiv
                  ? embriao.numero_cdc_fiv
                  : embriao?.numero_adt_te
                  ? embriao.numero_adt_te
                  : embriao?.id
                  ? <span className="text-xs text-gray-400">{embriao.id.slice(0, 8)}…</span>
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Data T.E.</p>
              <p className="text-sm font-semibold text-gray-700">{formatDate(dataTe)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">DG Positivo</p>
              <p className="text-sm font-semibold text-gray-700">{formatDate(prenhez?.data_dg ?? null)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Previsão de Parto</p>
              <p className="text-sm font-bold text-green-700">{formatDate(prenhez?.data_previsao_parto ?? null)}</p>
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

      {/* ── Movimentação Reprodutiva (log de status) ────────────────────── */}
      {statusLog.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-purple-500" />
            <h2 className="font-semibold text-gray-900">Movimentação Reprodutiva</h2>
            <span className="badge bg-purple-100 text-purple-700 ml-auto">{statusLog.length}</span>
          </div>
          <div className="px-5 py-4 space-y-0">
            {statusLog.map((entry, idx) => {
              const isLast = idx === statusLog.length - 1;
              const sm = STATUS_MAP[entry.status] ?? { label: entry.status, cls: "bg-gray-100 text-gray-500" };
              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-100 mt-1.5 shrink-0" />
                    {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
                  </div>
                  <div className={`pb-3 flex-1 flex items-start gap-2 flex-wrap`}>
                    <span className={`badge text-xs ${sm.cls}`}>{sm.label}</span>
                    <span className="text-xs text-gray-400">{formatDate(entry.data_evento)}</span>
                    {entry.observacoes && (
                      <span className="text-xs text-gray-500 italic w-full">{entry.observacoes}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Histórico Reprodutivo (timeline) — sempre visível ─────────────── */}
      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Baby className="w-4 h-4 text-brand-600" />
          <h2 className="font-semibold text-gray-900">Histórico Reprodutivo</h2>
          <span className="badge bg-brand-100 text-brand-700 ml-auto">
            {(historico ?? []).length} implantaç{(historico ?? []).length === 1 ? "ão" : "ões"}
          </span>
        </div>

        {(!historico || historico.length === 0) ? (
          <div className="px-5 py-6 space-y-3">
            {/* Fallback: dados manuais nas observações do animal */}
            {animal.observacoes ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold text-amber-900 mb-1 text-xs uppercase tracking-wide">Dados registrados manualmente</p>
                <p className="text-sm">{animal.observacoes}</p>
                {animal.situacao && (
                  <p className="text-xs text-amber-600 mt-1">Situação: {animal.situacao}</p>
                )}
                {/* Bezerro vinculado manualmente */}
                {(() => {
                  const cria = criaVinculada;
                  return cria ? (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[11px] text-amber-600">Bezerro:</span>
                      <Link
                        href={cria.tipo === "TOURO" ? `/machos/${cria.id}` : `/doadoras/${cria.id}`}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        {cria.tipo === "TOURO" ? "🐂" : "🐄"} {cria.nome}
                      </Link>
                      {cria.rgn && <span className="text-[11px] text-gray-400 font-mono">({cria.rgn})</span>}
                    </div>
                  ) : animal.status_rebanho === "PARIDA" ? (
                    <div className="mt-2">
                      <VincularCriaManual
                        animalId={id}
                        animaisDisponiveis={(animaisVincular ?? []).map((a: any) => ({
                          id:   a.id,
                          nome: a.nome ?? "",
                          tipo: a.tipo ?? "DOADORA",
                        }))}
                      />
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-4">
                Nenhuma implantação registrada para esta receptora.
              </p>
            )}
          </div>
        ) : (
          <div className="px-5 py-5 space-y-0">
            {historico.map((t: any, idx: number) => {
              const asp      = t.embryo?.aspiration;
              const dg       = (t.diagnoses ?? [])[0];
              const isLast   = idx === historico.length - 1;
              const doadoraId = asp?.doadora?.id ?? asp?.doadora_id ?? null;
              const doadoraNome = asp?.doadora?.nome ?? asp?.doadora_nome ?? null;
              // Considera parida: tipo_desfecho, resultado, ou status do animal (no primeiro transfer)
              const isParida = dg?.tipo_desfecho === "PARIDA"
                || dg?.resultado === "PARIDA"
                || (idx === 0 && animal.status_rebanho === "PARIDA");
              // Prioridade: FK direta > match por data de nascimento
              const filhoteVinculado = dg?.animal_nascido ?? null;
              const filhotePorData   = isParida && dg?.data_desfecho && !filhoteVinculado
                ? filhoteDaParicao(dg.data_desfecho, doadoraId ?? null)
                : null;
              const filhote = filhoteVinculado ?? filhotePorData;

              // ── Configuração visual por tipo de desfecho ──────────────────
              type EventConfig = { icon: React.ReactNode; dotCls: string; titulo: string; tituloCls: string };
              let cfg: EventConfig;

              if (isParida) {
                cfg = {
                  icon: <Baby className="w-3.5 h-3.5" />,
                  dotCls: "bg-green-500 ring-green-200",
                  titulo: dg?.data_desfecho ? `Parto em ${formatDate(dg.data_desfecho)}` : "Parida",
                  tituloCls: "text-green-700",
                };
              } else if (dg?.tipo_desfecho === "ABORTOU") {
                cfg = {
                  icon: <AlertTriangle className="w-3.5 h-3.5" />,
                  dotCls: "bg-orange-400 ring-orange-200",
                  titulo: `Aborto em ${formatDate(dg.data_desfecho)}`,
                  tituloCls: "text-orange-700",
                };
              } else if (dg?.tipo_desfecho === "REABSORVEU") {
                cfg = {
                  icon: <RefreshCw className="w-3.5 h-3.5" />,
                  dotCls: "bg-yellow-400 ring-yellow-200",
                  titulo: `Reabsorção em ${formatDate(dg.data_desfecho)}`,
                  tituloCls: "text-yellow-700",
                };
              } else if (dg?.tipo_desfecho === "OBITO") {
                cfg = {
                  icon: <XCircle className="w-3.5 h-3.5" />,
                  dotCls: "bg-gray-500 ring-gray-200",
                  titulo: `Óbito em ${formatDate(dg.data_desfecho)}`,
                  tituloCls: "text-gray-700",
                };
              } else if (dg?.resultado === "POSITIVO") {
                cfg = {
                  icon: <CheckCircle className="w-3.5 h-3.5" />,
                  dotCls: "bg-teal-500 ring-teal-200",
                  titulo: `DG Positivo — Prenha`,
                  tituloCls: "text-teal-700",
                };
              } else if (dg?.resultado === "NEGATIVO") {
                cfg = {
                  icon: <XCircle className="w-3.5 h-3.5" />,
                  dotCls: "bg-red-400 ring-red-200",
                  titulo: `DG Negativo`,
                  tituloCls: "text-red-600",
                };
              } else {
                cfg = {
                  icon: <FlaskConical className="w-3.5 h-3.5" />,
                  dotCls: "bg-brand-400 ring-brand-200",
                  titulo: `Implantação T.E.`,
                  tituloCls: "text-brand-700",
                };
              }

              return (
                <div key={t.id} className="flex gap-4">
                  {/* Coluna da linha + ponto */}
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full ring-4 flex items-center justify-center text-white shrink-0 ${cfg.dotCls}`}>
                      {cfg.icon}
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
                  </div>

                  {/* Conteúdo */}
                  <div className={`pb-6 flex-1 ${isLast ? "" : ""}`}>
                    <p className={`font-semibold text-sm ${cfg.tituloCls}`}>{cfg.titulo}</p>

                    {/* Data T.E. */}
                    <p className="text-xs text-gray-400 mt-0.5">
                      T.E.: {formatDate(t.data_te)}
                      {dg?.data_previsao_parto && (
                        <span className="ml-2 text-gray-400">· Prev. parto: {formatDate(dg.data_previsao_parto)}</span>
                      )}
                    </p>

                    {/* Doadora × Touro */}
                    {(doadoraNome || asp?.touro_nome) && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {doadoraId ? (
                          <Link href={`/doadoras/${doadoraId}`}
                            className="text-xs text-brand-600 font-semibold hover:underline">
                            {doadoraNome}
                          </Link>
                        ) : doadoraNome ? (
                          <span className="text-xs font-semibold text-gray-700">{doadoraNome}</span>
                        ) : null}
                        {asp?.touro_nome && (
                          <>
                            <span className="text-gray-300 text-xs">×</span>
                            <span className="text-xs text-gray-600">{asp.touro_nome}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Bezerro nascido */}
                    {filhote ? (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-400">Bezerro:</span>
                        <Link
                          href={filhote.tipo === "TOURO" ? `/machos/${filhote.id}` : `/doadoras/${filhote.id}`}
                          className="text-xs font-semibold text-brand-600 hover:underline"
                        >
                          {filhote.tipo === "TOURO" ? "🐂" : "🐄"} {filhote.nome}
                        </Link>
                        {filhote.rgn && (
                          <span className="text-[11px] text-gray-400 font-mono">({filhote.rgn})</span>
                        )}
                        {/* Botão para corrigir se bezerro errado */}
                        {dg?.id && (
                          <VincularBezerroReceptora
                            dgId={dg.id}
                            receptoraId={id}
                            modo="trocar"
                            animaisDisponiveis={(animaisVincular ?? []).map((a: any) => ({
                              id:   a.id,
                              nome: a.nome ?? "",
                              tipo: a.tipo ?? "DOADORA",
                            }))}
                          />
                        )}
                      </div>
                    ) : isParida && dg?.id ? (
                      <div className="mt-1.5">
                        <VincularBezerroReceptora
                          dgId={dg.id}
                          receptoraId={id}
                          animaisDisponiveis={(animaisVincular ?? []).map((a: any) => ({
                            id:   a.id,
                            nome: a.nome ?? "",
                            tipo: a.tipo ?? "DOADORA",
                          }))}
                        />
                      </div>
                    ) : null}

                    {/* Botão para registrar desfecho de TEs antigas sem desfecho
                        Aparece quando: sem desfecho, não é DG negativo, não é a prenhez ativa atual */}
                    {!dg?.tipo_desfecho && dg?.resultado !== "NEGATIVO" && !isParida && !(isPrenha && idx === 0) && (
                      <MarcarDesfechoHistorico
                        transferId={t.id}
                        receptoraId={id}
                        animaisDisponiveis={(animaisVincular ?? []).map((a: any) => ({
                          id:   a.id,
                          nome: a.nome ?? "",
                          tipo: a.tipo ?? "DOADORA",
                        }))}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Transações / Venda ──────────────────────────────────────────────── */}
      {transacoes && transacoes.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="text-lg">💰</span>
            <h2 className="font-semibold text-gray-900">Transações</h2>
            <span className="badge bg-gray-100 text-gray-500 ml-auto">{transacoes.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {transacoes.map((tx: any) => (
              <div key={tx.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      tx.tipo === "VENDA" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {tx.tipo === "VENDA" ? "Venda" : "Compra"}
                    </span>
                    {tx.contraparte && (
                      <span className="text-sm text-gray-700 font-medium">{tx.contraparte}</span>
                    )}
                  </div>
                  {tx.observacoes && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">{tx.observacoes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {tx.valor_total && (
                    <p className="text-sm font-bold text-gray-900">
                      {Number(tx.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">{formatDate(tx.data)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
