"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, RotateCcw } from "lucide-react";
import { definirParcelasPagas } from "./actions";

type Origem = "MANUAL" | "INSTALLMENTS" | "ESTIMADO" | "SEM_DADOS";

export type ParcelasInlineProps = {
  txId: string;
  pagas: number;
  nTotal: number;
  origem: Origem;
  /** "COMPRA" → pagas · "VENDA" → recebidas */
  tipo: "COMPRA" | "VENDA";
};

const TITULO: Record<Origem, string> = {
  MANUAL:       "Informado manualmente — clique para alterar",
  INSTALLMENTS: "Contado das parcelas marcadas como pagas — clique para ajustar",
  ESTIMADO:     "Estimativa por tempo decorrido — clique para informar o número real",
  SEM_DADOS:    "Sem data de referência — clique para informar",
};

export function ParcelasInline({ txId, pagas, nTotal, origem, tipo }: ParcelasInlineProps) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor]       = useState(String(pagas));
  const [erro, setErro]         = useState<string | null>(null);
  const [isPending, start]      = useTransition();
  const router = useRouter();

  const rotulo = tipo === "VENDA" ? "recebidas" : "pagas";

  function salvar(novo: number | null) {
    setErro(null);
    start(async () => {
      const res = await definirParcelasPagas(txId, novo);
      if (!res.ok) { setErro(res.erro ?? "Erro ao salvar"); return; }
      setEditando(false);
      router.refresh();
    });
  }

  function confirmar() {
    const n = parseInt(valor, 10);
    if (!Number.isFinite(n) || n < 0) { setErro("Número inválido"); return; }
    if (n > nTotal)                   { setErro(`Máx. ${nTotal}`);  return; }
    salvar(n);
  }

  function cancelar() {
    setValor(String(pagas));
    setErro(null);
    setEditando(false);
  }

  // ── Modo edição ─────────────────────────────────────────────────────────────
  if (editando) {
    return (
      <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={nTotal}
            value={valor}
            autoFocus
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  confirmar();
              if (e.key === "Escape") cancelar();
            }}
            className="w-12 border border-brand-300 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <span className="text-[10px] text-gray-400">/{nTotal}</span>
          <button
            onClick={confirmar}
            disabled={isPending}
            title="Salvar"
            className="p-0.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-40"
          >
            {isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={cancelar}
            disabled={isPending}
            title="Cancelar"
            className="p-0.5 rounded text-gray-400 hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {origem === "MANUAL" && (
          <button
            onClick={() => salvar(null)}
            disabled={isPending}
            title="Voltar ao cálculo automático"
            className="inline-flex items-center gap-1 text-[9px] text-gray-400 hover:text-gray-600"
          >
            <RotateCcw className="w-2.5 h-2.5" /> automático
          </button>
        )}

        {erro && <p className="text-[9px] text-red-600">{erro}</p>}
      </div>
    );
  }

  // ── Modo leitura ────────────────────────────────────────────────────────────
  const pct = nTotal > 0 ? (pagas / nTotal) * 100 : 0;
  const quitado = nTotal > 0 && pagas >= nTotal;
  const cor    = quitado ? "text-green-600" : "text-amber-600";
  const barCor = quitado ? "bg-green-500"   : "bg-amber-400";
  const estimado = origem === "ESTIMADO" || origem === "SEM_DADOS";

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditando(true); }}
      title={`${pagas} de ${nTotal} ${rotulo}. ${TITULO[origem]}`}
      className="group w-full text-right cursor-pointer"
    >
      <div className={`text-xs font-semibold ${cor} ${estimado ? "opacity-70" : ""} group-hover:underline`}>
        {pagas}/{nTotal}
        {estimado && <span className="ml-0.5 text-[9px] font-normal text-gray-400">~</span>}
        {origem === "MANUAL" && <span className="ml-0.5 text-[9px] font-normal text-brand-500">•</span>}
      </div>
      <div className="mt-0.5 h-1 rounded-full bg-gray-100 w-10 ml-auto">
        <div className={`h-1 rounded-full ${barCor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </button>
  );
}
