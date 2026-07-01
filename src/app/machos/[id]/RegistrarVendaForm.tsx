"use client";

import { useState, useEffect, useRef } from "react";
import { ShoppingCart, RefreshCw } from "lucide-react";
import { registrarVendaMacho } from "./actions";
import { useVendaSync } from "@/components/VendaSyncContext";

type Props = { touroId: string };

export default function RegistrarVendaForm({ touroId }: Props) {
  const [comprador,   setComprador]   = useState("");
  const [parcela,     setParcela]     = useState("");
  const [numParcelas, setNumParcelas] = useState("30");
  const [percentual,  setPercentual]  = useState(100);
  const [sincronizado, setSincronizado] = useState(false);

  const vendaSync = useVendaSync();
  const ultimoAplicado = useRef<number | null>(null);

  // ── Auto-preenche a partir da "Realização da Venda" (card Leilão) ──
  // Sempre que o valor de venda definitivo (parcela × nº parcelas) mudar lá,
  // este form é atualizado automaticamente. O usuário ainda pode editar
  // os campos manualmente depois — a nova edição prevalece até o valor
  // do leilão mudar de novo.
  useEffect(() => {
    const d = vendaSync?.data;
    if (!d || d.valorTotal == null) return;
    if (ultimoAplicado.current === d.valorTotal && comprador === d.comprador) return;

    ultimoAplicado.current = d.valorTotal;
    setComprador(d.comprador);
    if (d.valorParcela != null) setParcela(d.valorParcela.toString());
    setNumParcelas(d.nParcelas.toString());
    setPercentual(d.percentual);
    setSincronizado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendaSync?.data]);

  const total =
    parseFloat(parcela) > 0 && parseInt(numParcelas) > 0
      ? parseFloat(parcela) * parseInt(numParcelas)
      : null;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <form action={registrarVendaMacho} className="space-y-4">
      <input type="hidden" name="touro_id" value={touroId} />
      {/* Hidden total calculado */}
      <input type="hidden" name="valor_total" value={total?.toFixed(2) ?? ""} />
      {/* % do animal vendido nesta transação (vem da Realização da Venda / Leilão) */}
      <input type="hidden" name="percentual_vendido" value={percentual} />

      {sincronizado && (
        <div className="flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded-lg px-3 py-1.5">
          <RefreshCw className="w-3 h-3" />
          Preenchido automaticamente a partir de &quot;Realização da Venda&quot; (Leilão) — {percentual}% vendido. Edite se necessário.
        </div>
      )}

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
            <option value="VENDA_SEMEN">Sêmen</option>
          </select>
        </div>

        {/* Comprador / Leilão */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Comprador / Leilão</label>
          <input
            name="contraparte"
            type="text"
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
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

        {/* % Vendido */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">% Vendido</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={percentual}
              onChange={(e) => setPercentual(parseFloat(e.target.value) || 100)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">% do animal vendido (100, 50, 33...)</p>
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
