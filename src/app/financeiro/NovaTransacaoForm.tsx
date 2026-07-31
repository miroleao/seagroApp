"use client";

import { useState } from "react";
import { Plus, Info } from "lucide-react";
import { criarTransacao } from "./actions";
import { SeletorAnimais, type AnimalOpt } from "./SeletorAnimais";

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300";
const labelCls =
  "text-xs font-medium text-gray-600 mb-1 block uppercase tracking-wide";

const ITEM_LABEL: Record<string, string> = {
  COMPRA_ANIMAL:    "Novo animal",
  COMPRA_PRENHEZ:   "Nova Prenhez",
  COMPRA_ASPIRACAO: "Nova Aspiração",
};

export default function NovaTransacaoForm({ animais }: { animais: AnimalOpt[] }) {
  const [tipo,       setTipo]       = useState("");
  const [parcela,    setParcela]    = useState("");
  const [nParcelas,  setNParcelas]  = useState("30");
  const [vinculados, setVinculados] = useState<string[]>([]);

  const isVenda  = tipo.startsWith("VENDA");
  const isCompra = tipo.startsWith("COMPRA");

  const total =
    parseFloat(parcela) > 0 && parseInt(nParcelas) > 0
      ? parseFloat(parcela) * parseInt(nParcelas)
      : null;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <form action={criarTransacao} className="px-5 py-5 bg-gray-50 space-y-4">
      {/* Valor total calculado (hidden → server action) */}
      <input type="hidden" name="valor_total" value={total?.toFixed(2) ?? ""} />

      {/* ── Linha 1: Tipo | Animal vinculado | Nome | RGN ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Tipo */}
        <div>
          <label className={labelCls}>Tipo *</label>
          <select
            name="tipo_detalhado"
            required
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecione…</option>
            <optgroup label="Compras">
              <option value="COMPRA_ANIMAL">Compra de Animal</option>
              <option value="COMPRA_PRENHEZ">Compra de Prenhez</option>
              <option value="COMPRA_ASPIRACAO">Compra de Aspiração</option>
            </optgroup>
            <optgroup label="Vendas">
              <option value="VENDA_ANIMAL">Venda de Animal</option>
              <option value="VENDA_PRENHEZ">Venda de Prenhez</option>
              <option value="VENDA_ASPIRACAO">Venda de Aspiração</option>
            </optgroup>
          </select>
        </div>

        {/* Animal vinculado — vale para compra E venda, qualquer tipo de animal */}
        <div>
          <label className={labelCls}>Animal cadastrado</label>
          <SeletorAnimais animais={animais} onChange={setVinculados} />
        </div>

        {/* Nome livre — só quando o animal ainda não está cadastrado */}
        <div>
          <label className={labelCls}>
            Nome {vinculados.length > 0 && <span className="text-gray-300 normal-case">(opcional)</span>}
          </label>
          <input
            name="animal_nome"
            disabled={vinculados.length > 0}
            placeholder={
              vinculados.length > 0
                ? "usa o nome do animal vinculado"
                : isCompra ? (ITEM_LABEL[tipo] ?? "Nome") : "Nome do animal"
            }
            className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}
          />
        </div>

        {/* RGN */}
        <div>
          <label className={labelCls}>RGN / ABCZ</label>
          <input
            name="animal_rgn"
            placeholder="Ex: 1234567"
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Linha 2: Vendedor/Comprador | Data | Valor Parcela | Nº Parcelas | Total ── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        {/* Vendedor / Comprador */}
        <div className="md:col-span-1">
          <label className={labelCls}>
            {isVenda ? "Comprador" : "Vendedor"}
          </label>
          <input
            name="contraparte"
            placeholder="Ex: Fazenda Boa Vista"
            className={inputCls}
          />
        </div>

        {/* Data */}
        <div className="md:col-span-1">
          <label className={labelCls}>Data</label>
          <input name="data" type="date" className={inputCls} />
        </div>

        {/* Valor da Parcela */}
        <div className="md:col-span-1">
          <label className={labelCls}>Valor da Parcela (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={parcela}
            onChange={(e) => setParcela(e.target.value)}
            placeholder="Ex: 5000.00"
            className={inputCls}
          />
        </div>

        {/* Nº Parcelas — campo menor */}
        <div className="md:col-span-1">
          <label className={labelCls}>Parcelas</label>
          <input
            name="n_parcelas"
            type="number"
            min="1"
            max="360"
            value={nParcelas}
            onChange={(e) => setNParcelas(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Total automático */}
        <div className="md:col-span-1">
          <label className={labelCls}>Total</label>
          <div
            className={`rounded-lg px-3 py-2 text-sm font-semibold border ${
              total
                ? "bg-brand-50 border-brand-200 text-brand-700"
                : "bg-gray-50 border-gray-200 text-gray-400"
            }`}
          >
            {total ? fmt(total) : "—"}
          </div>
        </div>
      </div>

      {/* ── Linha 3: Observações ────────────────────────────────────── */}
      <div>
        <label className={labelCls}>Observações</label>
        <input
          name="observacoes"
          placeholder="Ex: Leilão Nelore de Elite 2025"
          className={inputCls}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-brand-700 transition-colors font-medium cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Registrar Transação
        </button>
        {vinculados.length > 0 && (
          <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <Info className="w-3 h-3 text-brand-500 shrink-0" />
            Este lançamento vai aparecer na ficha
            {vinculados.length > 1 ? ` dos ${vinculados.length} animais vinculados` : " do animal vinculado"}.
          </p>
        )}
      </div>
    </form>
  );
}
