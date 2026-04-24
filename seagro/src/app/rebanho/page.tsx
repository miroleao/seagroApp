import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate, FARM_ID } from "@/lib/utils";
import { Beef, Plus, Search, Filter, Baby, ChevronRight, X } from "lucide-react";
import { cadastrarAnimal, cadastrarLote } from "./actions";
import { FiltroStatus } from "./FiltroStatus";
import { FiltroClassificacao } from "./FiltroClassificacao";
import { EditReprodutivoInline } from "./EditReprodutivoInline";
import { EditPesoInline } from "./EditPesoInline";

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
  VAZIA:          { label: "Vazia",                cls: "bg-gray-100 text-gray-500"   },
  DESCARTE:       { label: "Descarte",             cls: "bg-red-100 text-red-600"     },
};

function ClassBadge({ cls }: { cls: string | null }) {
  const m = CLASS_MAP[cls ?? ""] ?? { label: cls ?? "—", cls: "bg-gray-100 text-gray-500" };
  return <span className={`badge text-[11px] ${m.cls}`}>{m.label}</span>;
}

function StatusBadge({ st }: { st: string | null }) {
  const m = STATUS_MAP[st ?? ""] ?? { label: "—", cls: "bg-gray-100 text-gray-400" };
  return <span className={`badge text-[11px] ${m.cls}`}>{m.label}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function RebanhoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cls?: string; st?: string; modal?: string }>;
}) {
  const { q, cls, st, modal } = await searchParams;
  const supabase = await createClient();

  // Animais do rebanho (RECEPTORA + DESCARTE, inclui RECRIA via classificacao)
  const { data: animaisRaw } = await supabase
    .from("animals")
    .select("id, nome, brinco, classificacao, tipo, status_rebanho, situacao, localizacao, data_entrada, peso_atual, observacoes")
    .eq("farm_id", FARM_ID)
    .in("tipo", ["RECEPTORA", "DESCARTE"])
    .order("brinco", { ascending: true });

  // Prenhezes ativas para exibir previsão de parto + doadora/touro/embrião
  const { data: prenhezes } = await supabase
    .from("pregnancy_diagnoses")
    .select(`
      id, data_previsao_parto,
      transfer:transfers (
        id, receptora_id,
        embryo:embryos (
          id, aspiration_id,
          aspiration:aspirations ( doadora_id, doadora_nome, touro_nome,
            doadora:animals!aspirations_doadora_id_fkey ( id, nome )
          )
        )
      )
    `)
    .eq("farm_id", FARM_ID)
    .in("resultado", ["POSITIVO", "AGUARDANDO"]);

  // Mapa receptora_id → prenhez info
  const prenhezesMapa = new Map<string, {
    transferId:  string;
    previsao:    string | null;
    doadoraNome: string | null;
    doadoraId:   string | null;
    touroNome:   string | null;
    embryoId:    string | null;
    aspId:       string | null;
  }>();
  for (const p of prenhezes ?? []) {
    const t = p.transfer as any;
    if (!t?.receptora_id) continue;
    if (prenhezesMapa.has(t.receptora_id)) continue;
    const emb = t?.embryo;
    const asp = emb?.aspiration;
    prenhezesMapa.set(t.receptora_id, {
      transferId:  t.id,
      previsao:    p.data_previsao_parto,
      doadoraNome: asp?.doadora?.nome ?? asp?.doadora_nome ?? null,
      doadoraId:   asp?.doadora?.id   ?? asp?.doadora_id   ?? null,
      touroNome:   asp?.touro_nome ?? null,
      embryoId:    emb?.id ?? null,
      aspId:       emb?.aspiration_id ?? null,
    });
  }

  const animais = animaisRaw ?? [];

  // Contagens por classificação
  const counts = animais.reduce((acc, a) => {
    const k = a.classificacao ?? (a.tipo === "DESCARTE" ? "DESCARTE" : "OUTRO");
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filtro
  const filtered = animais.filter(a => {
    const term = (q ?? "").toLowerCase();
    const passaTermo = !term || [a.brinco, a.nome, a.localizacao].some(v => v?.toLowerCase().includes(term));
    const passaCls  = !cls || (a.classificacao ?? (a.tipo === "DESCARTE" ? "DESCARTE" : "OUTRO")) === cls;
    const passaSt   = !st  || a.status_rebanho === st;
    return passaTermo && passaCls && passaSt;
  });

  const prenhas = animais.filter(a => a.status_rebanho === "PRENHA" || a.status_rebanho === "PRENHA_EMBRIAO");

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
        <div className="flex items-center gap-2">
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

      {/* Cards rápidos por classificação */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: "",          label: "Todos",      count: animais.length,           color: "brand" },
          { key: "RECEPTORA", label: "Receptoras", count: counts["RECEPTORA"] ?? 0, color: "pink"  },
          { key: "RECRIA",    label: "Recria",     count: counts["RECRIA"] ?? 0,    color: "orange"},
          { key: "DESCARTE",  label: "Descarte",   count: counts["DESCARTE"] ?? 0,  color: "red"   },
          { key: "OUTRO",     label: "Outros",     count: counts["OUTRO"] ?? 0,     color: "gray"  },
        ].map(({ key, label, count, color }) => (
          <Link key={key} href={`?${key ? `cls=${key}` : ""}${q ? `&q=${q}` : ""}${st ? `&st=${st}` : ""}`}
            className={`card p-4 text-center transition-colors hover:shadow-md ${(cls ?? "") === key ? "ring-2 ring-brand-400" : ""}`}>
            <p className={`text-3xl font-bold text-${color}-600`}>{count}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Prenhas em destaque */}
      {prenhas.length > 0 && (
        <section className="card overflow-hidden border-green-200">
          <div className="px-5 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2">
            <Baby className="w-4 h-4 text-green-600" />
            <h2 className="font-semibold text-green-800 text-sm">Prenhes Ativas</h2>
            <span className="badge bg-green-100 text-green-700 ml-auto">{prenhas.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Brinco</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Doadora</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Touro</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Prev. Parto</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {prenhas.map((a: any) => {
                const p = prenhezesMapa.get(a.id);
                return (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-4 py-2.5 font-mono font-semibold text-gray-900">{a.brinco ?? a.nome}</td>
                    <td className="px-4 py-2.5"><StatusBadge st={a.status_rebanho} /></td>
                    <td className="px-4 py-2.5 text-xs">
                      {p?.doadoraId ? (
                        <Link href={`/doadoras/${p.doadoraId}`} className="text-brand-600 hover:underline font-medium">
                          {p.doadoraNome}
                        </Link>
                      ) : p?.doadoraNome ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{p?.touroNome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-green-700">{formatDate(p?.previsao ?? null)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/rebanho/${a.id}`}
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                        Ficha <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

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
                <th className="px-2 py-3 text-xs font-medium text-gray-500 w-28">
                  <span>Classificação</span>
                  <FiltroClassificacao q={q} cls={cls} st={st} />
                </th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-40">Reprodutivo</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-24">Peso</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Embrião</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 w-28">Prev. Parto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum animal encontrado{q ? ` para "${q}"` : ""}.
                  </td>
                </tr>
              ) : filtered.map((a: any) => {
                const p = prenhezesMapa.get(a.id);
                return (
                  <tr key={a.id} className="table-row-hover">
                    <td className="px-3 py-3">
                      <Link href={`/rebanho/${a.id}`}
                        className="font-mono font-semibold text-brand-700 hover:underline text-xs">
                        {a.brinco ?? a.nome}
                      </Link>
                    </td>
                    <td className="px-2 py-3"><ClassBadge cls={a.classificacao} /></td>
                    <td className="px-3 py-3">
                      <EditReprodutivoInline animalId={a.id} statusAtual={a.status_rebanho} />
                    </td>
                    <td className="px-3 py-3">
                      <EditPesoInline animalId={a.id} pesoAtual={a.peso_atual} />
                    </td>
                    {/* Embrião — doadora + touro, vinculado à ficha da doadora */}
                    <td className="px-4 py-3 text-xs">
                      {p?.doadoraId ? (
                        <div>
                          <Link href={`/doadoras/${p.doadoraId}`}
                            className="text-brand-600 hover:underline font-semibold leading-tight">
                            {p.doadoraNome}
                          </Link>
                          {p.touroNome && (
                            <span className="block text-gray-400 text-[11px] leading-tight">
                              ♂ {p.touroNome}
                            </span>
                          )}
                        </div>
                      ) : p?.doadoraNome ? (
                        <div>
                          <span className="text-gray-700 font-medium">{p.doadoraNome}</span>
                          {p.touroNome && (
                            <span className="block text-gray-400 text-[11px]">♂ {p.touroNome}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-green-700 font-medium">{formatDate(p?.previsao ?? null)}</td>
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
