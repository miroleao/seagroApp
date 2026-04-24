"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { registrarVendaDoadora } from "./actions";

type Props = { doadoraId: string };

export default function RegistrarVendaForm({ doadoraId }: Props) {
  const [parcela,     setParcela]     = useState("");
  const [numParcelas, setNumParcelas] = useState("30");

  const total =
    parseFloat(parcela) > 0 && parseInt(numParcelas) > 0
      ? parseFloat(parcela) * parseInt(numParcelas)
      : null;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <form action={registrarVendaDoadora} className="space-y-4">
      <input type="hidden" name="doadora_id" value={doadoraId} />
      {/* Hidden total calculado */}
      <input type="hidden" name="valor_total" value={total?.toFixed(2) ?? ""} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo de venda */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tipo de venda</label>
          <select
            name="tipo_detalhado"
            defaultValue="VENDA_ANIMAL"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value="VENDA_ANIMAL">Animal</option>
            <option value="VENDA_PRENHEZ">Prenhez</option>
            <option value="VENDA_ASPIRACAO">Aspiração</option>
          </select>
        </div>

        {/* Comprador / Leilão */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Comprador / Leilão</label>
          <input
            name="contraparte"
            type="text"
            placeholder="Ex: Leilão Nelore de Elite"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Data da venda */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Data da venda</label>
          <input
            name="data"
            type="date"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Nº de parcelas */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nº de parcelas</label>
          <input
            name="n_parcelas"
            type="number"
            min="1"
            step="1"
            value={numParcelas}
            onChange={(e) => setNumParcelas(e.target.value)}
            placeholder="30"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Valor da parcela */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Valor da parcela (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={parcela}
            onChange={(e) => setParcela(e.target.value)}
            placeholder="0,00"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {/* Total calculado */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Valor total estimado</p>
          <div className={`rounded-lg px-3 py-2 text-sm font-semibold border ${
            total
              ? "bg-brand-50 border-brand-200 text-brand-700"
              : "bg-gray-50 border-gray-200 text-gray-400"
          }`}>
            {total ? fmt(total) : "—"}
          </div>
        </div>
      </div>

      {/* Observações */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Observações</label>
        <textarea
          name="observacoes"
          rows={2}
          placeholder="Observações opcionais..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="flex items-center gap-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" />
          Registrar Venda
        </button>
      </div>
    </form>
  );
}
