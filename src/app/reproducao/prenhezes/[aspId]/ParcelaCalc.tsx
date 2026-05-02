"use client";

import { useState } from "react";

type Props = {
  parcelaInicial:     string | null;
  numParcelasInicial: string | null;
};

export default function ParcelaCalc({ parcelaInicial, numParcelasInicial }: Props) {
  const [parcela,     setParcela]     = useState(parcelaInicial     ?? "");
  const [numParcelas, setNumParcelas] = useState(numParcelasInicial ?? "30");

  const total =
    parseFloat(parcela)     > 0 &&
    parseInt(numParcelas)   > 0
      ? parseFloat(parcela) * parseInt(numParcelas)
      : null;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
      {/* Valor da parcela */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Valor da parcela (R$)</label>
        <input
          name="parcela"
          type="number"
          step="0.01"
          min="0"
          value={parcela}
          onChange={(e) => setParcela(e.target.value)}
          placeholder="0,00"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
        />
      </div>

      {/* Nº de parcelas */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Nº de parcelas</label>
        <input
          name="num_parcelas"
          type="number"
          min="1"
          step="1"
          value={numParcelas}
          onChange={(e) => setNumParcelas(e.target.value)}
          placeholder="30"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
        />
      </div>

      {/* Total calculado */}
      <div>
        <p className="text-xs text-gray-400 mb-1">Total estimado</p>
        <div className={`rounded-lg px-3 py-2 text-sm font-semibold border ${
          total
            ? "bg-brand-50 border-brand-200 text-brand-700"
            : "bg-gray-50 border-gray-200 text-gray-400"
        }`}>
          {total ? fmt(total) : "—"}
        </div>
      </div>
    </div>
  );
}
