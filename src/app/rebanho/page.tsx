import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import { Plus, Search, Filter, X } from "lucide-react";
import { PrenhasAtivasSection, type PrenhaAnimal } from "./PrenhasAtivasSection";
import { StatusReceptorasSection, type StatusItem } from "./StatusReceptorasSection";
import { cadastrarAnimal, cadastrarLote } from "./actions";
import { FiltroStatus } from "./FiltroStatus";
import { FiltroClassificacao } from "./FiltroClassificacao";
import { EditReprodutivoInline } from "./EditReprodutivoInline";
import { EditPesoInline } from "./EditPesoInline";
import { EditPrenheInline } from "./EditPrenheInline";
import { DesfechoUnificadoInline } from "./DesfechoUnificadoInline";
import { EditLocalizacaoRebanho } from "./EditLocalizacaoRebanho";
import { ExportarPDF, type ColunaPDF, type GrupoPDF } from "@/components/ui/ExportarPDF";

// ─── Badges ───────────────────────────────────────────────────────────────────
const CLASS_MAP: Record<string, { label: string; cls: string }> = {
  RECEPTORA: { label: "Receptora",  cls: "bg-pink-100 text-pink-700"   },
  RECRIA:    { label: "Recria",     cls: "bg-orange-100 text-orange-700" },
  DESCARTE:  { label: "Descarte",   cls: "bg-red-100 text-red-600"     },
  OUTRO:     { label: "Outro",      cls: "bg-gray-100 text-gray-600"   },
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PROTOCOLADA:    { label: "Protocolada",          cls: "bg-purple-100 text-purple-700" },
  INSEMINADA:     { label: "Inseminada",           cls: "bg-blue-100 text-blue-700"   },
  IMPLANTADA:     { label: "Implantada c/ Embrião",cls: "bg-amber-100 text-amber-700" },
  PRENHA:         { label: "Prenha",               cls: "bg-green-100 text-green-700" },
  PRENHA_EMBRIAO: { label: "Prenha de Embrião",    cls: "bg-teal-100 text-teal-700"   },
  PARIDA:         { label: "Parida",               cls: "bg-blue-100 text-blue-700"   },
  VAZIA:          { label: "Vazia",                cls: "bg-gray-100 text-gray-500"   },
  DESCARTE:       { label: "Descarte",             cls: "bg-red-100 text-red-600"     },
  MORTA:          { label: "Óbito",                cls: "bg-gray-800 text-white"      },
  VENDIDA:        { label: "Vendida",              cls: "bg-blue-100 text-blue-700"   },
};

function ClassBadge({ cls }: { cls: string | null }) {
  const m = CLASS_MAP[cls ?? ""] ?? { label: cls ?? "—", cls: "bg-gray-100 text-gray-500" };
  return <span className={`badge text-[11px] ${m.cls}`}>{m.label}</span>;
}

function StatusBadge({ st }: { st: string | null }) {
  const m = STATUS_MAP[st ?? ""] ?? { label: "—", cls: "bg-gray-100 text-gray-400" };
  return <span className={`badge text-[11px] ${m.cls}`}>{m.label}</span>;
}

function SexagemBadge({ sexagem }: { sexagem: string | null }) {
  if (!sexagem || sexagem === "NAO_SEXADO") return <span className="text-gray-300 text-[11px]">—</span>;
  if (sexagem === "MACHO")
    return <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">♂ M</span>;
  if (sexagem === "FEMEA")
    return <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-pink-600 bg-pink-50 border border-pink-200 rounded px-1.5 py-0.5">♀ F</span>;
  return <span className="text-gray-300 text-[11px]">—</span>;
}

export const revalidate = 0;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function RebanhoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cls?: string; st?: string; modal?: string; erro?: string }>;
}) {
  const { q, cls, st, modal, erro } = await searchParams;
  const supabase = await createClient();

  // Animais do rebanho (RECEPTORA + DESCARTE, inclui RECRIA via classificacao)
  // Exclui receptoras externas (is_external = true) — essas ficam apenas nas aspirações/prenhezes
  const { data: animaisRaw } = await supabase
    .from("animals")
    .select("id, nome, brinco, rgn, classificacao, tipo, status_rebanho, situacao, localizacao, data_entrada, peso_atual, observacoes")
    .eq("farm_id", FARM_ID)
    .in("tipo", ["RECEPTORA", "DESCARTE"])
    .eq("is_external", false)
    .order("brinco", { ascending: true });

  // Prenhezes ativas para exibir previsão de parto + doadora/touro/embrião
  const selectPrenhez = `
    id, data_previsao_parto, tipo_desfecho, data_desfecho,
    transfer:transfers (
      id, receptora_id, receptora_brinco, data_te,
      embryo:embryos (
        id, aspiration_id, numero_cdc_fiv, numero_adt_te, sexagem,
        aspiration:aspirations ( doadora_id, doadora_nome, touro_nome,
          doadora:animals!aspirations_doadora_id_fkey ( id, nome )
        )
      )
    )
  `;

  const { data: prenhezes } = await supabase
    .from("pregnancy_diagnoses")
    .select(selectPrenhez)
    .eq("farm_id", FARM_ID)
    .in("resultado", ["POSITIVO", "AGUARDANDO"])
    .is("tipo_desfecho", null);

  // Histórico de parições (status PARIDA) — para mostrar doadora/touro na tabela principal
  const { data: paridas } = await supabase
    .from("pregnancy_diagnoses")
    .select(selectPrenhez)
    .eq("farm_id", FARM_ID)
    .eq("tipo_desfecho", "PARIDA");

  // Índice brinco → animal.id para resolver transfers sem receptora_id (prenhezes de terceiros)
  const brincoToId = new Map<string, string>();
  for (const a of animaisRaw ?? []) {
    if (a.brinco) brincoToId.set(a.brinco, a.id);
  }

  // Mapa receptora_id → prenhez info
  const prenhezesMapa = new Map<string, {
    transferId:    string;
    previsao:      string | null;
    dataTe:        string | null;
    doadoraNome:   string | null;
    doadoraId:     string | null;
    touroNome:     string | null;
    embryoId:      string | null;
    embryoCdc:     string | null;
    embryoAdt:     string | null;
    aspId:         string | null;
    sexagem:       string | null;
    tipoDesfecho:  string | null;
  }>();
  for (const p of prenhezes ?? []) {
    const t = p.transfer as any;
    // Resolve receptora_id diretamente ou via brinco (prenhezes de terceiros)
    const receptoraId: string | undefined =
      t?.receptora_id ?? (t?.receptora_brinco ? brincoToId.get(t.receptora_brinco) : undefined);
    if (!receptoraId) continue;
    if (prenhezesMapa.has(receptoraId)) continue;
    const emb = t?.embryo;
    const asp = emb?.aspiration;
    prenhezesMapa.set(receptoraId, {
      transferId:    t.id,
      previsao:      p.data_previsao_parto,
      dataTe:        t.data_te ?? null,
      doadoraNome:   asp?.doadora?.nome ?? asp?.doadora_nome ?? null,
      doadoraId:     asp?.doadora?.id   ?? asp?.doadora_id   ?? null,
      touroNome:     asp?.touro_nome ?? null,
      embryoId:      emb?.id ?? null,
      embryoCdc:     emb?.numero_cdc_fiv ?? null,
      embryoAdt:     emb?.numero_adt_te ?? null,
      aspId:         emb?.aspiration_id ?? null,
      sexagem:       emb?.sexagem ?? null,
      tipoDesfecho:  (p as any).tipo_desfecho ?? null,
    });
  }

  // Mapa de parições (receptora_id → dados do embrião/doadora/touro para animais PARIDA)
  const paridasMapa = new Map<string, {
    doadoraNome:  string | null;
    doadoraId:    string | null;
    touroNome:    string | null;
    sexagem:      string | null;
    dataTe:       string | null;
    dataDesfecho: string | null;
  }>();
  for (const p of paridas ?? []) {
    const t = (p as any).transfer;
    const receptoraId: string | undefined =
      t?.receptora_id ?? (t?.receptora_brinco ? brincoToId.get(t.receptora_brinco) : undefined);
    if (!receptoraId) continue;
    if (paridasMapa.has(receptoraId)) continue;
    const emb = t?.embryo;
    const asp = emb?.aspiration;
    paridasMapa.set(receptoraId, {
      doadoraNome:  asp?.doadora?.nome ?? asp?.doadora_nome ?? null,
      doadoraId:    asp?.doadora?.id   ?? asp?.doadora_id   ?? null,
      touroNome:    asp?.touro_nome ?? null,
      sexagem:      emb?.sexagem ?? null,
      dataTe:       t.data_te ?? null,
      dataDesfecho: (p as any).data_desfecho ?? null,
    });
  }

  // ── Fallback: IMPLANTADA/PRENHA_EMBRIAO/PRENHA sem DG — busca direto em transfers ────
  // Acontece quando a prenhez/implante foi registrada sem pregnancy_diagnoses associado
  const idsSemdg = (animaisRaw ?? [])
    .filter(a =>
      (a.status_rebanho === "IMPLANTADA" ||
       a.status_rebanho === "PRENHA_EMBRIAO" ||
       a.status_rebanho === "PRENHA") &&
      !prenhezesMapa.has(a.id)
    )
    .map(a => a.id);

  if (idsSemdg.length > 0) {
    // Brincos das receptoras que ainda não foram resolvidas (fallback por brinco)
    const brincosSemdg = (animaisRaw ?? [])
      .filter(a => idsSemdg.includes(a.id) && a.brinco)
      .map(a => a.brinco as string);

    const { data: tfSemDg } = await supabase
      .from("transfers")
      .select(`
        id, receptora_id, receptora_brinco, data_te,
        embryo:embryos (
          id, aspiration_id, numero_cdc_fiv, numero_adt_te, sexagem,
          aspiration:aspirations ( doadora_id, doadora_nome, touro_nome,
            doadora:animals!aspirations_doadora_id_fkey ( id, nome )
          )
        )
      `)
      .eq("farm_id", FARM_ID)
      .or(
        `receptora_id.in.(${idsSemdg.join(",")})` +
        (brincosSemdg.length > 0 ? `,receptora_brinco.in.(${brincosSemdg.map(b => `"${b}"`).join(",")})` : "")
      )
      .order("data_te", { ascending: false });

    for (const t of tfSemDg ?? []) {
      // Resolve receptora_id direto ou via brinco
      const tt: any = t;
      const receptoraId: string | undefined =
        tt.receptora_id ?? (tt.receptora_brinco ? brincoToId.get(tt.receptora_brinco) : undefined);
      if (!receptoraId || prenhezesMapa.has(receptoraId)) continue;
      const emb = tt.embryo;
      const asp = emb?.aspiration;
      prenhezesMapa.set(receptoraId, {
        transferId:   t.id,
        previsao:     null,
        dataTe:       t.data_te ?? null,
        doadoraNome:  asp?.doadora?.nome ?? asp?.doadora_nome ?? null,
        doadoraId:    asp?.doadora?.id   ?? asp?.doadora_id   ?? null,
        touroNome:    asp?.touro_nome ?? null,
        embryoId:     emb?.id ?? null,
        embryoCdc:    emb?.numero_cdc_fiv ?? null,
        embryoAdt:    emb?.numero_adt_te ?? null,
        aspId:        emb?.aspiration_id ?? null,
        sexagem:      emb?.sexagem ?? null,
        tipoDesfecho: null,
      });
    }
  }

  const animais = animaisRaw ?? [];

  // Contagens por classificação (mantido para filtros)
  const counts = animais.reduce((acc, a) => {
    const k = a.classificacao ?? (a.tipo === "DESCARTE" ? "DESCARTE" : "OUTRO");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Contagens por status reprodutivo (para os novos cards)
  const countStatus = animais.reduce((acc, a) => {
    const k = a.status_rebanho ?? "VAZIA";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const countPrenhas      = (countStatus["PRENHA"] ?? 0) + (countStatus["PRENHA_EMBRIAO"] ?? 0);
  const countProtocoladas = countStatus["PROTOCOLADA"] ?? 0;
  const countInseminadas  = countStatus["INSEMINADA"] ?? 0;
  const countParidas      = countStatus["PARIDA"] ?? 0;

  // Filtro
  const filtered = animais.filter(a => {
    const term = (q ?? "").toLowerCase();
    const passaTermo = !term || [a.brinco, a.nome, a.localizacao].some(v => v?.toLowerCase().includes(term));
    const passaCls  = !cls || (a.classificacao ?? (a.tipo === "DESCARTE" ? "DESCARTE" : "OUTRO")) === cls;
    // Sem filtro ativo: oculta MORTA e VENDIDA por padrão
    const passaSt = st
      ? a.status_rebanho === st
      : a.status_rebanho !== "MORTA" && a.status_rebanho !== "VENDIDA";
    return passaTermo && passaCls && passaSt;
  });

  const prenhas = animais
    .filter(a => a.status_rebanho === "PRENHA" || a.status_rebanho === "PRENHA_EMBRIAO")
    .sort((a, b) => {
      const pa = prenhezesMapa.get(a.id)?.previsao ?? null;
      const pb = prenhezesMapa.get(b.id)?.previsao ?? null;
      if (!pa && !pb) return 0;
      if (!pa) return 1;
      if (!pb) return -1;
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });

  // ── Contagem total de partos por receptora ────────────────────────────────────
  // Busca TODOS os desfechos PARIDA para contar (não só o mais recente)
  const { data: todasPartosRaw } = await supabase
    .from("pregnancy_diagnoses")
    .select("transfer:transfers(receptora_id, receptora_brinco)")
    .eq("farm_id", FARM_ID)
    .eq("tipo_desfecho", "PARIDA");

  const partosMap = new Map<string, number>();
  for (const dg of todasPartosRaw ?? []) {
    const t = (dg as any).transfer;
    if (!t) continue;
    const receptoraId = t.receptora_id
      ?? (t.receptora_brinco ? brincoToId.get(t.receptora_brinco) : undefined);
    if (!receptoraId) continue;
    partosMap.set(receptoraId, (partosMap.get(receptoraId) ?? 0) + 1);
  }

  // Serializar dados para o componente cliente da seção de prenhes
  const prenhasComInfo: PrenhaAnimal[] = prenhas.map(a => {
    const p = prenhezesMapa.get(a.id);
    return {
      id:             a.id,
      brinco:         a.brinco ?? null,
      nome:           a.nome ?? null,
      status_rebanho: a.status_rebanho ?? null,
      localizacao:    a.localizacao ?? null,
      prenheInfo: p ? {
        transferId:  p.transferId,
        previsao:    p.previsao,
        dataTe:      p.dataTe,
        doadoraNome: p.doadoraNome,
        doadoraId:   p.doadoraId,
        touroNome:   p.touroNome,
        sexagem:     p.sexagem,
        tipoDesfecho: p.tipoDesfecho,
      } : null,
    };
  });

  // ── Arrays para as seções colapsíveis ────────────────────────────────────────
  function toStatusItem(a: (typeof animais)[number]): StatusItem {
    return {
      id:           a.id,
      brinco:       a.brinco ?? null,
      nome:         a.nome   ?? null,
      localizacao:  a.localizacao ?? null,
      peso_atual:   a.peso_atual  ?? null,
      numeroPartos: partosMap.get(a.id) ?? 0,
    };
  }

  const protocoladasSection: StatusItem[] = animais
    .filter(a => a.status_rebanho === "PROTOCOLADA")
    .map(toStatusItem);

  const inseminadasSection: StatusItem[] = animais
    .filter(a => a.status_rebanho === "INSEMINADA")
    .map(toStatusItem);

  const paridasSection: StatusItem[] = animais
    .filter(a => a.status_rebanho === "PARIDA")
    .sort((a, b) => {
      const da = paridasMapa.get(a.id)?.dataDesfecho ?? "";
      const db = paridasMapa.get(b.id)?.dataDesfecho ?? "";
      return db.localeCompare(da); // mais recente primeiro
    })
    .map(a => {
      const h = paridasMapa.get(a.id);
      return {
        ...toStatusItem(a),
        doadoraNome:  h?.doadoraNome  ?? null,
        doadoraId:    h?.doadoraId    ?? null,
        touroNome:    h?.touroNome    ?? null,
        dataDesfecho: h?.dataDesfecho ?? null,
      };
    });

  return (
    <div className="p-6 space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rebanho</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {animais.length} animais · {prenhas.length} prenhes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportarPDF
            titulo="Rebanho de Receptoras"
            subtitulo={`${animais.length} animais · ${prenhas.length} prenhes ativas`}
            orientacao="landscape"
            nomeArquivo="SE_Rebanho.pdf"
            grupos={[
              { key: "PRENHAS",      label: "Prenhas",      padrao: true },
              { key: "PROTOCOLADAS", label: "Protocoladas", padrao: true },
              { key: "INSEMINADAS",  label: "Inseminadas",  padrao: true },
              { key: "PARIDAS",      label: "Paridas",      padrao: true },
              { key: "VAZIAS",       label: "Vazias",       padrao: false },
              { key: "DESCARTE",     label: "Descarte",     padrao: false },
              { key: "OUTROS",       label: "Outros",       padrao: false },
            ] satisfies GrupoPDF[]}
            colunas={[
              { key: "brinco",         label: "Brinco",         padrao: true,  largura: 1.0 },
              { key: "classificacao",  label: "Classificação",  padrao: false, largura: 1.1 },
              { key: "status_rebanho", label: "Situação",       padrao: true,  largura: 1.5 },
              { key: "doadora_nome",   label: "Doadora",        padrao: true,  largura: 2.0 },
              { key: "touro_nome",     label: "Touro",          padrao: true,  largura: 2.0 },
              { key: "sexagem",        label: "Sexagem",        padrao: false, largura: 0.8 },
              { key: "data_te",        label: "Data T.E.",      padrao: true,  largura: 1.1 },
              { key: "previsao_parto", label: "Prev. Parto",    padrao: true,  largura: 1.1 },
              { key: "peso_atual",     label: "Peso (kg)",      padrao: false, largura: 0.9 },
              { key: "localizacao",    label: "Localização",    padrao: false, largura: 1.0 },
            ] satisfies ColunaPDF[]}
            dados={animais.map((a: any) => {
              const p = prenhezesMapa.get(a.id);
              const STATUS_LABELS_LOCAL: Record<string, string> = {
                PROTOCOLADA: "Protocolada", INSEMINADA: "Inseminada",
                IMPLANTADA: "Implantada c/ Embrião", PRENHA: "Prenha",
                PRENHA_EMBRIAO: "Prenha de Embrião", PARIDA: "Parida",
                VAZIA: "Vazia", DESCARTE: "Descarte", MORTA: "Óbito", VENDIDA: "Vendida",
              };
              const CLASS_LABELS_LOCAL: Record<string, string> = {
                RECEPTORA: "Receptora", RECRIA: "Recria", DESCARTE: "Descarte", OUTRO: "Outro",
              };
              const SEX_LABELS: Record<string, string> = {
                NAO_SEXADO: "—", MACHO: "Macho", FEMEA: "Fêmea",
              };
              // Define o grupo do registro a partir do status / classificação
              const status = a.status_rebanho ?? "";
              const cls = a.classificacao ?? "";
              let grupo: string;
              if (status === "PRENHA" || status === "PRENHA_EMBRIAO" || status === "IMPLANTADA") grupo = "PRENHAS";
              else if (status === "PROTOCOLADA") grupo = "PROTOCOLADAS";
              else if (status === "INSEMINADA") grupo = "INSEMINADAS";
              else if (status === "PARIDA") grupo = "PARIDAS";
              else if (status === "VAZIA") grupo = "VAZIAS";
              else if (status === "DESCARTE" || cls === "DESCARTE" || a.tipo === "DESCARTE") grupo = "DESCARTE";
              else grupo = "OUTROS";

              return {
                grupo,
                brinco:         a.brinco ?? a.nome ?? "—",
                classificacao:  CLASS_LABELS_LOCAL[a.classificacao ?? ""] ?? (a.classificacao ?? "—"),
                status_rebanho: STATUS_LABELS_LOCAL[a.status_rebanho ?? ""] ?? (a.status_rebanho ?? "—"),
                doadora_nome:   p?.doadoraNome ?? "—",
                touro_nome:     p?.touroNome ?? "—",
                sexagem:        SEX_LABELS[p?.sexagem ?? ""] ?? (p?.sexagem ?? "—"),
                data_te:        p?.dataTe ? formatDate(p.dataTe) : "—",
                previsao_parto: p?.previsao ? formatDate(p.previsao) : "—",
                peso_atual:     a.peso_atual != null ? `${a.peso_atual} kg` : "—",
                localizacao:    a.localizacao ?? "—",
              };
            })}
          />
          <Link href="?modal=lote"
            className="inline-flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
            <Plus className="w-3.5 h-3.5" /> Lote
          </Link>
          <Link href="?modal=animal"
            className="inline-flex items-center gap-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors font-medium">
            <Plus className="w-4 h-4" /> Cadastrar Animal
          </Link>
        </div>
      </div>

      {/* Cards rápidos por status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Rebanho Total */}
        <Link
          href={`?${q ? `q=${q}` : ""}${st ? `&st=${st}` : ""}`}
          className={`card p-4 text-center transition-colors hover:shadow-md ${!cls && !st ? "ring-2 ring-brand-400" : ""}`}
        >
          <p className="text-3xl font-bold text-brand-600">{animais.length}</p>
          <p className="text-xs text-gray-600 mt-1 font-medium">Rebanho Total</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Gado PO e Receptoras</p>
        </Link>

        {/* Receptoras Prenhas */}
        <Link
          href={`?st=PRENHA${q ? `&q=${q}` : ""}`}
          className={`card p-4 text-center transition-colors hover:shadow-md ${st === "PRENHA" ? "ring-2 ring-green-400" : ""}`}
        >
          <p className="text-3xl font-bold text-green-600">{countPrenhas}</p>
          <p className="text-xs text-gray-500 mt-1">Prenhas</p>
        </Link>

        {/* Receptoras Protocoladas */}
        <Link
          href={`?st=PROTOCOLADA${q ? `&q=${q}` : ""}`}
          className={`card p-4 text-center transition-colors hover:shadow-md ${st === "PROTOCOLADA" ? "ring-2 ring-purple-400" : ""}`}
        >
          <p className="text-3xl font-bold text-purple-600">{countProtocoladas}</p>
          <p className="text-xs text-gray-500 mt-1">Protocoladas</p>
        </Link>

        {/* Receptoras Inseminadas */}
        <Link
          href={`?st=INSEMINADA${q ? `&q=${q}` : ""}`}
          className={`card p-4 text-center transition-colors hover:shadow-md ${st === "INSEMINADA" ? "ring-2 ring-blue-400" : ""}`}
        >
          <p className="text-3xl font-bold text-blue-600">{countInseminadas}</p>
          <p className="text-xs text-gray-500 mt-1">Inseminadas</p>
        </Link>

        {/* Receptoras Paridas */}
        <Link
          href={`?st=PARIDA${q ? `&q=${q}` : ""}`}
          className={`card p-4 text-center transition-colors hover:shadow-md ${st === "PARIDA" ? "ring-2 ring-teal-400" : ""}`}
        >
          <p className="text-3xl font-bold text-teal-600">{countParidas}</p>
          <p className="text-xs text-gray-500 mt-1">Paridas</p>
        </Link>
      </div>

      {/* Prenhes Ativas — colapsível */}
      <PrenhasAtivasSection prenhas={prenhasComInfo} />

      {/* Protocoladas — colapsível */}
      <StatusReceptorasSection
        titulo="Protocoladas"
        animais={protocoladasSection}
        tipo="simples"
        headerBg="bg-purple-50 border-purple-100"
        tituloCls="text-purple-800"
        badgeCls="bg-purple-100 text-purple-700"
        dotCls="text-purple-600"
        icono={<span className="text-base">💉</span>}
      />

      {/* Inseminadas — colapsível */}
      <StatusReceptorasSection
        titulo="Inseminadas"
        animais={inseminadasSection}
        tipo="simples"
        headerBg="bg-blue-50 border-blue-100"
        tituloCls="text-blue-800"
        badgeCls="bg-blue-100 text-blue-700"
        dotCls="text-blue-600"
        icono={<span className="text-base">🔬</span>}
      />

      {/* Paridas — colapsível */}
      <StatusReceptorasSection
        titulo="Paridas"
        animais={paridasSection}
        tipo="paridas"
        headerBg="bg-teal-50 border-teal-100"
        tituloCls="text-teal-800"
        badgeCls="bg-teal-100 text-teal-700"
        dotCls="text-teal-600"
        icono={<span className="text-base">🐄</span>}
      />

      {/* Filtros + Tabela principal */}
      <section className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-gray-900 flex-1">Todos os Animais</h2>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <form method="get">
              {cls && <input type="hidden" name="cls" value={cls} />}
              {st  && <input type="hidden" name="st"  value={st}  />}
              <input name="q" defaultValue={q} placeholder="Buscar brinco, nome…"
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-brand-300" />
            </form>
          </div>

          {/* Filtro status */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <FiltroStatus q={q} cls={cls} st={st} />
            {st && (
              <Link href={`?${cls ? `cls=${cls}` : ""}${q ? `&q=${q}` : ""}`}
                className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></Link>
            )}
          </div>

          <span className="badge bg-gray-100 text-gray-600 ml-auto">{filtered.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-24">Brinco</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-28"># ABCZ</th>
                <th className="px-2 py-3 text-xs font-medium text-gray-500 w-28">
                  <span>Classificação</span>
                  <FiltroClassificacao q={q} cls={cls} st={st} />
                </th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-40">Reprodutivo</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-16 text-center">Partos</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-24">Peso</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Embrião</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-20">Sexagem</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-24">Data T.E.</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-28">Prev. Parto</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-24">Localização</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-20">Desfecho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum animal encontrado{q ? ` para "${q}"` : ""}.
                  </td>
                </tr>
              ) : filtered.map((a: any) => {
                const p = prenhezesMapa.get(a.id);
                // Para animais PARIDA: busca dados históricos do embrião/doadora
                const h = a.status_rebanho === "PARIDA" ? paridasMapa.get(a.id) : null;
                // Fonte de exibição: prenhez ativa ou histórico de parição
                const embriao = p ?? null;
                const doadoraNomeExib = embriao?.doadoraNome ?? h?.doadoraNome ?? null;
                const doadoraIdExib   = embriao?.doadoraId   ?? h?.doadoraId   ?? null;
                const touroNomeExib   = embriao?.touroNome   ?? h?.touroNome   ?? null;
                const sexagemExib     = embriao?.sexagem     ?? h?.sexagem     ?? null;
                const dataTEExib      = embriao?.dataTe      ?? h?.dataTe      ?? null;

                return (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-3 py-3">
                      <Link href={`/rebanho/${a.id}`}
                        className="font-mono font-semibold text-brand-700 hover:underline text-xs">
                        {a.brinco ?? a.nome}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {(a as any).rgn
                        ? <span className="font-mono text-[11px] text-gray-600">{(a as any).rgn}</span>
                        : <span className="text-gray-300 text-[11px]">—</span>
                      }
                    </td>
                    <td className="px-2 py-3"><ClassBadge cls={a.classificacao} /></td>
                    <td className="px-3 py-3">
                      <EditReprodutivoInline animalId={a.id} statusAtual={a.status_rebanho} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {(partosMap.get(a.id) ?? 0) > 0 ? (
                        <span className="text-xs font-bold text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
                          {partosMap.get(a.id)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <EditPesoInline animalId={a.id} pesoAtual={a.peso_atual} />
                    </td>
                    {/* Embrião — doadora + touro (ativa ou histórico de parição) */}
                    <td className="px-4 py-3 text-xs">
                      {doadoraIdExib ? (
                        <div>
                          <Link href={`/doadoras/${doadoraIdExib}`}
                            className="text-brand-600 hover:underline font-semibold leading-tight">
                            {doadoraNomeExib}
                          </Link>
                          {touroNomeExib && (
                            <span className="block text-gray-400 text-[11px] leading-tight">
                              ♂ {touroNomeExib}
                            </span>
                          )}
                          {h && (
                            <span className="block text-[10px] text-green-600 font-medium mt-0.5">
                              Pariu {h.dataDesfecho ? formatDate(h.dataDesfecho) : ""}
                            </span>
                          )}
                        </div>
                      ) : doadoraNomeExib ? (
                        <div>
                          <span className="text-gray-700 font-medium">{doadoraNomeExib}</span>
                          {touroNomeExib && (
                            <span className="block text-gray-400 text-[11px]">♂ {touroNomeExib}</span>
                          )}
                          {h && (
                            <span className="block text-[10px] text-green-600 font-medium mt-0.5">
                              Pariu {h.dataDesfecho ? formatDate(h.dataDesfecho) : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3"><SexagemBadge sexagem={sexagemExib} /></td>
                    <td className="px-3 py-3 text-xs text-gray-500">{formatDate(dataTEExib)}</td>
                    <td className="px-3 py-3 text-xs text-green-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{formatDate(p?.previsao ?? null)}</span>
                        {(a.status_rebanho === "PRENHA_EMBRIAO" || a.status_rebanho === "PRENHA" || a.status_rebanho === "IMPLANTADA") && (
                          <EditPrenheInline
                            receptoraId={a.id}
                            brinco={a.brinco ?? a.nome ?? ""}
                            doadoraNome={p?.doadoraNome ?? null}
                            touroNome={p?.touroNome ?? null}
                            dataTe={p?.dataTe ?? null}
                            previsao={p?.previsao ?? null}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <EditLocalizacaoRebanho animalId={a.id} localizacao={a.localizacao ?? null} />
                    </td>
                    <td className="px-3 py-3">
                      {a.status_rebanho !== "MORTA" && a.status_rebanho !== "VENDIDA" && (
                        <DesfechoUnificadoInline
                          animalId={a.id}
                          brinco={a.brinco ?? a.nome ?? ""}
                          isPrenha={
                            a.status_rebanho === "PRENHA_EMBRIAO" ||
                            a.status_rebanho === "PRENHA" ||
                            a.status_rebanho === "IMPLANTADA"
                          }
                          transferId={p?.transferId ?? null}
                          tipoDesfechoAtual={p?.tipoDesfecho ?? null}
                          statusRebanho={a.status_rebanho ?? null}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Modal: Cadastrar Animal ─────────────────────────────────────────── */}
      {modal === "animal" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Cadastrar Animal</h3>
              <Link href="/rebanho" className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></Link>
            </div>
            <form action={cadastrarAnimal} className="px-6 py-5 space-y-4">
              {erro && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
                  <span className="font-semibold shrink-0">⚠ Duplicata:</span>
                  <span>{erro}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Brinco / Nº *</label>
                  <input name="brinco" required placeholder="Ex: R001"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Classificação</label>
                  <select name="classificacao"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white">
                    <option value="RECEPTORA">Receptora</option>
                    <option value="RECRIA">Recria</option>
                    <option value="DESCARTE">Descarte</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data de Entrada</label>
                  <input name="data_entrada" type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Forma de Entrada</label>
                  <select name="forma_entrada"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white">
                    <option value="">— Selecione —</option>
                    <option value="COMPRA">Compra</option>
                    <option value="EMPRESTIMO">Empréstimo</option>
                    <option value="PROPRIO">Próprio (nascido)</option>
                    <option value="DOACAO">Doação</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Peso de Entrada (kg)</label>
                  <input name="peso_inicial" type="number" step="0.1" placeholder="Ex: 380"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Localização / Lote</label>
                  <input name="localizacao" placeholder="Ex: Curral 3"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Observações</label>
                <textarea name="observacoes" rows={2} placeholder="Informações adicionais, origem, características…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <Link href="/rebanho"
                  className="flex-1 text-center text-sm border border-gray-200 rounded-lg py-2 hover:bg-gray-50 text-gray-600">
                  Cancelar
                </Link>
                <button type="submit"
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                  Cadastrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Cadastrar Lote ───────────────────────────────────────────── */}
      {modal === "lote" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Cadastrar Lote de Animais</h3>
              <Link href="/rebanho" className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></Link>
            </div>
            <form action={cadastrarLote} className="px-6 py-5 space-y-4">
              <p className="text-xs text-gray-500">Cadastra animais em sequência. Ex: prefixo "R" + 001 a 050 → R001, R002, …, R050</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Prefixo</label>
                  <input name="prefixo" placeholder="Ex: R"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nº Início *</label>
                  <input name="brinco_inicio" type="number" required placeholder="1"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nº Fim *</label>
                  <input name="brinco_fim" type="number" required placeholder="50"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Classificação</label>
                  <select name="classificacao"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white">
                    <option value="RECEPTORA">Receptora</option>
                    <option value="RECRIA">Recria</option>
                    <option value="DESCARTE">Descarte</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Forma de Entrada</label>
                  <select name="forma_entrada"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white">
                    <option value="">— Selecione —</option>
                    <option value="COMPRA">Compra</option>
                    <option value="EMPRESTIMO">Empréstimo</option>
                    <option value="PROPRIO">Próprio</option>
                    <option value="DOACAO">Doação</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data de Entrada</label>
                  <input name="data_entrada" type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Localização / Lote</label>
                  <input name="localizacao" placeholder="Ex: Curral 3"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Observações</label>
                <textarea name="observacoes" rows={2} placeholder="Informações adicionais, origem do lote…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <Link href="/rebanho"
                  className="flex-1 text-center text-sm border border-gray-200 rounded-lg py-2 hover:bg-gray-50 text-gray-600">
                  Cancelar
                </Link>
                <button type="submit"
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                  Cadastrar Lote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
