"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Check, X, Plus, Loader2 } from "lucide-react";
import { atualizarCampoAnimal, salvarPesagens } from "./actions";

type WeightRecord = { id: string; data: string; peso_kg: number };

export type PesagemRow = {
  id: string;
  nome: string;
  tipo: string;
  tipoBadgeCls: string;
  tipoLabel: string;
  rgn: string | null;
  brinco: string | null;
  nascimento: string | null;        // ISO yyyy-mm-dd (raw)
  nascimentoFormatado: string | null;
  animalHref: string | null;
  ultimoPeso: number | null;
  ultimaDataFormatada: string | null;
  ponderal: number | null;
  badgeLabel: string | null;
  badgeCls: string | null;
  qtdPesagens: number;
  historico: WeightRecord[];
};

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

// ── Célula de data com edição inline ──────────────────────────────────────────

function CelulaDataNascimento({ row }: { row: PesagemRow }) {
  const [editando, setEditando]      = useState(false);
  const [valor, setValor]            = useState(row.nascimento ?? "");
  const [isPending, startTransition] = useTransition();

  function salvar() {
    if (!valor) { setEditando(false); return; }
    startTransition(async () => {
      await atualizarCampoAnimal(row.id, "nascimento", valor);
      setEditando(false);
    });
  }

  function cancelar() {
    setValor(row.nascimento ?? "");
    setEditando(false);
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="border border-brand-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter")  salvar();
            if (e.key === "Escape") cancelar();
          }}
        />
        <button
          onClick={salvar}
          disabled={isPending}
          className="p-0.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-40"
          title="Salvar"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={cancelar}
          disabled={isPending}
          className="p-0.5 rounded text-gray-400 hover:bg-gray-100"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center gap-1 cursor-pointer"
      onClick={(e) => { e.stopPropagation(); setEditando(true); }}
      title="Clique para corrigir a data"
    >
      <span className={row.nascimentoFormatado ? "text-gray-500" : "text-gray-300"}>
        {row.nascimentoFormatado ?? "—"}
      </span>
      <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

// ── Lançamento rápido dentro do histórico ─────────────────────────────────────

function NovaPesagemInline({ row }: { row: PesagemRow }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [data, setData]      = useState(hoje);
  const [peso, setPeso]      = useState("");
  const [erro, setErro]      = useState<string | null>(null);
  const [isPending, start]   = useTransition();
  const router = useRouter();

  const num  = parseFloat(peso.replace(",", "."));
  const diff = isFinite(num) && num > 0 && row.ultimoPeso != null
    ? num - row.ultimoPeso
    : null;

  function salvar() {
    setErro(null);
    if (!isFinite(num) || num <= 0) { setErro("Peso inválido"); return; }
    start(async () => {
      const res = await salvarPesagens([
        { animal_id: row.id, data, peso_kg: num },
      ]);
      if (!res.ok)          { setErro(res.erro ?? "Erro ao salvar"); return; }
      if (res.salvas === 0) { setErro("Essa pesagem já estava registrada"); return; }
      setPeso("");
      setData(hoje);
      router.refresh();
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
        Nova pesagem
      </span>
      <input
        type="date"
        value={data}
        max={hoje}
        onChange={(e) => setData(e.target.value)}
        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300"
      />
      <input
        type="number"
        step="0.1"
        min="0"
        inputMode="decimal"
        value={peso}
        placeholder="kg"
        onChange={(e) => setPeso(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") salvar();
          if (e.key === "Escape") { setPeso(""); setErro(null); }
        }}
        className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-300"
      />
      {diff != null && (
        <span className={`text-[10px] font-semibold ${
          diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"
        }`}>
          {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
        </span>
      )}
      <button
        onClick={salvar}
        disabled={isPending || !(isFinite(num) && num > 0)}
        className="inline-flex items-center gap-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs px-3 py-1 rounded transition-colors"
      >
        {isPending
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <Plus className="w-3 h-3" />}
        Add
      </button>
      {erro && <span className="text-[10px] text-red-600">{erro}</span>}
    </div>
  );
}

// ── Tabela principal ──────────────────────────────────────────────────────────

export default function TabelaPesagens({ rows }: { rows: PesagemRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <div className="card p-10 text-center text-gray-400 text-sm">
        Nenhum animal encontrado para os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Animal</th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Tipo</th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">RGN / Brinco</th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">
                Nascimento
                <span className="ml-1 text-[9px] text-gray-300 normal-case font-normal">✏ clique p/ editar</span>
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Peso Atual</th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Data Pesagem</th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Ponderal</th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px]">Classificação</th>
              <th className="px-4 py-2.5 font-semibold text-gray-500 uppercase text-[10px] text-right">Pesagens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <Fragment key={r.id}>
                  {/* ── Linha principal ── */}
                  <tr
                    onClick={() => toggle(r.id)}
                    title="Clique para ver o histórico e lançar uma pesagem"
                    className={`transition-colors cursor-pointer hover:bg-gray-50 ${isOpen ? "bg-brand-50/30" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                        {r.animalHref
                          ? <a href={r.animalHref} onClick={(e) => e.stopPropagation()} className="hover:text-brand-600 hover:underline transition-colors">{r.nome}</a>
                          : <span>{r.nome}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${r.tipoBadgeCls}`}>
                        {r.tipoLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-[11px]">
                      {r.rgn ?? r.brinco ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <CelulaDataNascimento row={r} />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {r.ultimoPeso != null
                        ? <span>{r.ultimoPeso.toFixed(1)} <span className="text-gray-400 font-normal text-[10px]">kg</span></span>
                        : <span className="text-gray-300 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.ultimaDataFormatada ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.ponderal != null
                        ? <span className={`font-bold ${r.ponderal >= 800 ? "text-green-600" : r.ponderal >= 600 ? "text-blue-600" : "text-red-600"}`}>
                            {r.ponderal} <span className="text-[10px] font-normal text-gray-400">g/dia</span>
                          </span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.badgeLabel
                        ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${r.badgeCls}`}>{r.badgeLabel}</span>
                        : <span className="text-gray-300 text-[10px]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 font-medium">
                      {r.qtdPesagens > 0 ? `${r.qtdPesagens}×` : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>

                  {/* ── Histórico (expande ao clicar) ── */}
                  {isOpen && (
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={9} className="px-8 py-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">
                          Histórico — {r.nome}
                        </p>
                        {r.historico.length === 0 && (
                          <p className="text-xs text-gray-400">
                            Nenhuma pesagem registrada ainda.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {r.historico.map((w, idx) => {
                            const prev = idx > 0 ? r.historico[idx - 1] : null;
                            const diff = prev != null ? w.peso_kg - prev.peso_kg : null;
                            return (
                              <div key={w.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs min-w-[90px]">
                                <p className="text-gray-400 text-[10px]">{formatDate(w.data)}</p>
                                <p className="font-bold text-gray-900 text-sm">{w.peso_kg.toFixed(1)} kg</p>
                                {diff != null && (
                                  <p className={`text-[10px] font-medium mt-0.5 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                                    {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <NovaPesagemInline row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
