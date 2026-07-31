"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Check, Scale, Search, Layers, User } from "lucide-react";
import { salvarPesagens } from "./actions";
import type { PesagemInput } from "./tipos";

export type AnimalOpt = {
  id: string;
  nome: string;
  tipo: string;
  tipoLabel: string;
  rgn: string | null;
  brinco: string | null;
  ultimoPeso: number | null;
  ultimaData: string | null;   // ISO
};

const TIPOS = [
  { key: "todos",     label: "Todos"      },
  { key: "NASCIDO",   label: "Nascidos SE"},
  { key: "DOADORA",   label: "Doadoras"   },
  { key: "TOURO",     label: "Touros"     },
  { key: "RECEPTORA", label: "Receptoras" },
];

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300";
const labelCls =
  "text-[10px] font-semibold text-gray-500 mb-1 block uppercase tracking-wide";

function hojeISO() {
  return new Date().toISOString().split("T")[0];
}

function fmtBR(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

function ident(a: AnimalOpt) {
  return a.rgn ?? a.brinco ?? "—";
}

export default function NovaPesagemModal({ animais }: { animais: AnimalOpt[] }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba]       = useState<"individual" | "lote">("individual");

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Nova Pesagem
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 sm:my-8">
            {/* ── Cabeçalho ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <Scale className="w-4 h-4 text-brand-600 shrink-0" />
              <h2 className="font-semibold text-gray-900">Registrar Pesagem</h2>
              <button
                onClick={() => setAberto(false)}
                className="ml-auto p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Abas ──────────────────────────────────────────────── */}
            <div className="flex gap-1 px-5 pt-4">
              {([
                { k: "individual" as const, label: "Individual", Icon: User   },
                { k: "lote"       as const, label: "Em lote",    Icon: Layers },
              ]).map(({ k, label, Icon }) => (
                <button
                  key={k}
                  onClick={() => setAba(k)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    aba === k
                      ? "bg-brand-50 text-brand-700 border border-brand-200"
                      : "text-gray-500 hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {aba === "individual"
                ? <FormIndividual animais={animais} onFechar={() => setAberto(false)} />
                : <FormLote       animais={animais} onFechar={() => setAberto(false)} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Individual
// ═══════════════════════════════════════════════════════════════════════════

function FormIndividual({
  animais, onFechar,
}: { animais: AnimalOpt[]; onFechar: () => void }) {
  const [busca, setBusca]           = useState("");
  const [selecionado, setSelec]     = useState<AnimalOpt | null>(null);
  const [data, setData]             = useState(hojeISO());
  const [peso, setPeso]             = useState("");
  const [obs, setObs]               = useState("");
  const [msg, setMsg]               = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [isPending, start]          = useTransition();
  const router = useRouter();

  const resultados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return [];
    return animais
      .filter(a =>
        a.nome?.toLowerCase().includes(q) ||
        a.rgn?.toLowerCase().includes(q) ||
        a.brinco?.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [busca, animais]);

  function salvar() {
    setMsg(null);
    if (!selecionado) { setMsg({ tipo: "erro", texto: "Selecione um animal." }); return; }
    const p = parseFloat(peso.replace(",", "."));
    if (!isFinite(p) || p <= 0) { setMsg({ tipo: "erro", texto: "Peso inválido." }); return; }

    start(async () => {
      const res = await salvarPesagens([
        { animal_id: selecionado.id, data, peso_kg: p, observacoes: obs || null },
      ]);
      if (!res.ok) { setMsg({ tipo: "erro", texto: res.erro ?? "Erro ao salvar" }); return; }
      if (res.salvas === 0) {
        setMsg({ tipo: "erro", texto: "Essa pesagem já estava registrada." });
        return;
      }
      setMsg({ tipo: "ok", texto: `Pesagem de ${selecionado.nome} registrada.` });
      setPeso(""); setObs(""); setSelec(null); setBusca("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Animal */}
      <div>
        <label className={labelCls}>Animal *</label>
        {selecionado ? (
          <div className="flex items-center gap-2 border border-brand-200 bg-brand-50 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-gray-900">{selecionado.nome}</span>
            <span className="text-[10px] font-mono text-gray-500">{ident(selecionado)}</span>
            <span className="text-[10px] text-gray-400">{selecionado.tipoLabel}</span>
            {selecionado.ultimoPeso != null && (
              <span className="text-[10px] text-gray-400 ml-auto">
                último: {selecionado.ultimoPeso.toFixed(1)} kg
                {selecionado.ultimaData ? ` · ${fmtBR(selecionado.ultimaData)}` : ""}
              </span>
            )}
            <button
              onClick={() => setSelec(null)}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 shrink-0"
              aria-label="Trocar animal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, RGN ou brinco…"
              autoFocus
              className={`${inputCls} pl-9`}
            />
            {resultados.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {resultados.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => { setSelec(a); setBusca(""); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span className="text-sm text-gray-900">{a.nome}</span>
                      <span className="text-[10px] font-mono text-gray-400">{ident(a)}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{a.tipoLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {busca.trim().length > 0 && resultados.length === 0 && (
              <p className="mt-1 text-[11px] text-gray-400">Nenhum animal encontrado.</p>
            )}
          </div>
        )}
      </div>

      {/* Data + Peso */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Data da pesagem *</label>
          <input type="date" value={data} max={hojeISO()}
            onChange={(e) => setData(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Peso (kg) *</label>
          <input type="number" step="0.1" min="0" value={peso} placeholder="Ex: 415.5"
            onChange={(e) => setPeso(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") salvar(); }}
            className={inputCls} />
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className={labelCls}>Observações</label>
        <input value={obs} onChange={(e) => setObs(e.target.value)}
          placeholder="Opcional" className={inputCls} />
      </div>

      <Rodape
        msg={msg}
        isPending={isPending}
        onCancelar={onFechar}
        onSalvar={salvar}
        textoBotao="Salvar pesagem"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Lote
// ═══════════════════════════════════════════════════════════════════════════

function FormLote({
  animais, onFechar,
}: { animais: AnimalOpt[]; onFechar: () => void }) {
  const [data, setData]   = useState(hojeISO());
  const [tipo, setTipo]   = useState("todos");
  const [busca, setBusca] = useState("");
  const [pesos, setPesos] = useState<Record<string, string>>({});
  const [msg, setMsg]     = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [isPending, start] = useTransition();
  const router = useRouter();
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const lista = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return animais.filter((a) => {
      if (tipo !== "todos" && a.tipo !== tipo) return false;
      if (!q) return true;
      return (
        a.nome?.toLowerCase().includes(q) ||
        a.rgn?.toLowerCase().includes(q) ||
        a.brinco?.toLowerCase().includes(q)
      );
    });
  }, [animais, tipo, busca]);

  const preenchidos = useMemo(
    () => Object.entries(pesos).filter(([, v]) => parseFloat(v.replace(",", ".")) > 0),
    [pesos]
  );

  function salvar() {
    setMsg(null);
    if (preenchidos.length === 0) {
      setMsg({ tipo: "erro", texto: "Preencha o peso de pelo menos um animal." });
      return;
    }

    const entradas: PesagemInput[] = preenchidos.map(([animal_id, v]) => ({
      animal_id,
      data,
      peso_kg: parseFloat(v.replace(",", ".")),
    }));

    start(async () => {
      const res = await salvarPesagens(entradas);
      if (!res.ok) { setMsg({ tipo: "erro", texto: res.erro ?? "Erro ao salvar" }); return; }
      const partes = [`${res.salvas} pesagem${res.salvas === 1 ? "" : "ns"} registrada${res.salvas === 1 ? "" : "s"}`];
      if (res.ignoradas) partes.push(`${res.ignoradas} duplicada${res.ignoradas === 1 ? "" : "s"} ignorada${res.ignoradas === 1 ? "" : "s"}`);
      setMsg({ tipo: "ok", texto: partes.join(" · ") + "." });
      setPesos({});
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Data comum */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Data da pesagem *</label>
          <input type="date" value={data} max={hojeISO()}
            onChange={(e) => setData(e.target.value)} className={inputCls} />
          <p className="mt-1 text-[10px] text-gray-400">Vale para todos os animais do lote.</p>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Buscar</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, RGN ou brinco…" className={`${inputCls} pl-9`} />
          </div>
        </div>
      </div>

      {/* Filtro de tipo */}
      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTipo(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              tipo === t.key
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-gray-400">
          {lista.length} animais · {preenchidos.length} preenchido{preenchidos.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grade */}
      <div className="border border-gray-100 rounded-lg overflow-hidden">
        <div className="max-h-[45vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs min-w-[460px]">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
              <tr className="text-left">
                <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-[10px]">Animal</th>
                <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-[10px] hidden sm:table-cell">RGN / Brinco</th>
                <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-[10px] text-right">Último peso</th>
                <th className="px-3 py-2 font-semibold text-gray-500 uppercase text-[10px] w-28 sm:w-32">Novo peso (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lista.map((a, i) => {
                const val = pesos[a.id] ?? "";
                const num = parseFloat(val.replace(",", "."));
                const preenchido = isFinite(num) && num > 0;
                const diff = preenchido && a.ultimoPeso != null ? num - a.ultimoPeso : null;
                return (
                  <tr key={a.id} className={preenchido ? "bg-brand-50/40" : "hover:bg-gray-50"}>
                    <td className="px-3 py-1.5 font-medium text-gray-900">
                      {a.nome}
                      <span className="block sm:hidden text-[10px] text-gray-400 font-mono font-normal">{ident(a)}</span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-400 font-mono text-[11px] hidden sm:table-cell">{ident(a)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-500 whitespace-nowrap">
                      {a.ultimoPeso != null
                        ? <>
                            {a.ultimoPeso.toFixed(1)} kg
                            {diff != null && (
                              <span className={`ml-1.5 font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                              </span>
                            )}
                          </>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        ref={(el) => { inputsRef.current[i] = el; }}
                        type="number"
                        step="0.1"
                        min="0"
                        inputMode="decimal"
                        value={val}
                        onChange={(e) => setPesos(p => ({ ...p, [a.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            inputsRef.current[i + 1]?.focus();
                          }
                        }}
                        placeholder="—"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-300"
                      />
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                    Nenhum animal para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-400">
        Enter pula para o próximo animal. Linhas em branco são ignoradas.
      </p>

      <Rodape
        msg={msg}
        isPending={isPending}
        onCancelar={onFechar}
        onSalvar={salvar}
        textoBotao={`Salvar ${preenchidos.length || ""} pesagem${preenchidos.length === 1 ? "" : "ns"}`.replace("  ", " ")}
        desabilitado={preenchidos.length === 0}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

function Rodape({
  msg, isPending, onCancelar, onSalvar, textoBotao, desabilitado,
}: {
  msg: { tipo: "ok" | "erro"; texto: string } | null;
  isPending: boolean;
  onCancelar: () => void;
  onSalvar: () => void;
  textoBotao: string;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      {msg && (
        <p className={`text-xs flex items-center gap-1 ${msg.tipo === "ok" ? "text-green-600" : "text-red-600"}`}>
          {msg.tipo === "ok" && <Check className="w-3.5 h-3.5 shrink-0" />}
          {msg.texto}
        </p>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onCancelar}
          className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Fechar
        </button>
        <button
          onClick={onSalvar}
          disabled={isPending || desabilitado}
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {textoBotao}
        </button>
      </div>
    </div>
  );
}
