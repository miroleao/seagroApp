"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  metaParcela: number | null;
  defaultComprador?: string;
  defaultParcela?: number;
  defaultNParcelas?: number;
}

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VendaLeilaoSection({
  metaParcela,
  defaultComprador = "",
  defaultParcela,
  defaultNParcelas,
}: Props) {
  const [comprador, setComprador]   = useState(defaultComprador);
  const [parcela, setParcela]       = useState(defaultParcela?.toString() ?? "");
  const [nParcelas, setNParcelas]   = useState(defaultNParcelas?.toString() ?? "30");

  const parcelaNum  = parseFloat(parcela.replace(",", ".")) || 0;
  const nParcelasNum = parseInt(nParcelas) || 1;

  const vendaTotal  = parcelaNum > 0 ? parcelaNum * nParcelasNum : null;
  const metaTotal   = metaParcela ? metaParcela * 30 : null;

  // Comparativo
  type Status = "acima" | "abaixo" | "meta" | null;
  let status: Status = null;
  let diff = 0;
  if (vendaTotal && metaTotal) {
    diff = vendaTotal - metaTotal;
    if (diff > 0.005)        status = "acima";
    else if (diff < -0.005)  status = "abaixo";
    else                     status = "meta";
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-3">
        Realização da Venda
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Comprador(es) */}
        <div className="md:col-span-3">
          <label className="text-xs text-gray-500 mb-1 block">Comprador(es)</label>
          <input
            name="venda_comprador"
            type="text"
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
            placeholder="Ex: Fazenda Boa Vista; João Silva"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <p className="mt-0.5 text-xs text-gray-400">Para múltiplos compradores, separe com ; (ponto e vírgula)</p>
        </div>

        {/* Parcela de venda */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Parcela de Venda (R$)</label>
          <input
            name="venda_valor_parcela"
            type="number"
            step="0.01"
            min="0"
            value={parcela}
            onChange={(e) => setParcela(e.target.value)}
            placeholder="Ex: 1800.00"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Nº de parcelas */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nº de Parcelas</label>
          <input
            name="venda_n_parcelas"
            type="number"
            min="1"
            max="360"
            step="1"
            value={nParcelas}
            onChange={(e) => setNParcelas(e.target.value)}
            placeholder="Ex: 30"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Total calculado */}
        <div className="flex items-end pb-0.5">
          {vendaTotal ? (
            <p className="text-sm text-gray-700">
              Total:{" "}
              <span className="font-bold text-gray-900">{fmt(vendaTotal)}</span>
              <span className="text-xs text-gray-400 ml-1">(× {nParcelas})</span>
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">Total = parcela × nº parcelas</p>
          )}
        </div>
      </div>

      {/* ── Comparativo com Meta ── */}
      {(vendaTotal || metaTotal) && (
        <div className="mt-4">
          {!metaTotal ? (
            <p className="text-xs text-gray-400 italic">
              Defina uma meta de valor acima para ver o comparativo.
            </p>
          ) : !vendaTotal ? (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500">
              Meta definida em <span className="font-semibold text-gray-700 ml-1">{fmt(metaTotal)}</span>
              <span className="text-xs text-gray-400 ml-1">(× 30 parcelas de {fmt(metaParcela!)})</span>
              — preencha a venda para ver o comparativo.
            </div>
          ) : status === "meta" ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <Minus className="w-4 h-4 shrink-0" />
              <span className="font-semibold">Meta exatamente atingida!</span>
              <span className="text-green-600 text-xs">Venda = {fmt(vendaTotal)} = Meta</span>
            </div>
          ) : status === "acima" ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <TrendingUp className="w-4 h-4 shrink-0 text-green-600" />
              <div>
                <span className="font-semibold">{fmt(diff)} acima da meta</span>
                <span className="text-green-600 text-xs ml-2">
                  Venda {fmt(vendaTotal)} vs Meta {fmt(metaTotal)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
              <TrendingDown className="w-4 h-4 shrink-0 text-red-500" />
              <div>
                <span className="font-semibold">{fmt(Math.abs(diff))} abaixo da meta</span>
                <span className="text-red-500 text-xs ml-2">
                  Venda {fmt(vendaTotal)} vs Meta {fmt(metaTotal)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
