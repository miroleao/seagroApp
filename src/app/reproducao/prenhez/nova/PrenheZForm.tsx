"use client";

import { useState, useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { registrarPrenhezesBatch } from "./actions";

type PrenheZRow = {
  uid: string;
  brinco: string;
  rgn: string;
  doadora: string;
  doadora_rgn: string;
  touro: string;
  touro_rgn: string;
  parto: string;
  sexagem: string;
};

function emptyRow(uid: string): PrenheZRow {
  return { uid, brinco: "", rgn: "", doadora: "", doadora_rgn: "", touro: "", touro_rgn: "", parto: "", sexagem: "" };
}

const inputCls = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PrenheZForm() {
  const baseId = useId();
  const [rows, setRows] = useState<PrenheZRow[]>([emptyRow(`${baseId}-0`)]);
  const [valorParcela, setValorParcela] = useState("");
  const [nParcelas, setNParcelas] = useState(30);

  const total = valorParcela && nParcelas
    ? parseFloat(valorParcela.replace(",", ".")) * nParcelas
    : 0;

  function addRow() {
    setRows(r => [...r, emptyRow(`${baseId}-${r.length}`)]);
  }
  function addMany(n: number) {
    setRows(r => {
      const news = Array.from({ length: n }, (_, k) => emptyRow(`${baseId}-${r.length + k}`));
      return [...r, ...news];
    });
  }
  function removeRow(uid: string) {
    setRows(r => r.filter(x => x.uid !== uid));
  }
  function update(uid: string, field: keyof PrenheZRow, value: string) {
    setRows(r => r.map(x => x.uid === uid ? { ...x, [field]: value } : x));
  }

  return (
    <form action={registrarPrenhezesBatch} className="space-y-6">

      {/* ── Dados do Lote ── */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
          Dados do Lote
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data da Compra</label>
            <input name="data_compra" type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Fazenda de Origem</label>
            <input name="fazenda" type="text" placeholder="Ex: Fazenda São João" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Vendedor</label>
            <input name="vendedor" type="text" placeholder="Nome" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data de Entrega</label>
            <input name="data_entrega" type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
        </div>
      </div>

      {/* ── Financeiro ── */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
          Financeiro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Valor da Parcela (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={valorParcela}
              onChange={e => setValorParcela(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nº de Parcelas</label>
            <input
              name="n_parcelas"
              type="number"
              min={1}
              value={nParcelas}
              onChange={e => setNParcelas(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Total</label>
            <div className={`w-full border rounded-lg px-3 py-2 text-sm font-bold ${total > 0 ? "border-brand-200 bg-brand-50 text-brand-700" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
              {total > 0 ? formatBRL(total) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabela de Prenhezes ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Prenhezes <span className="text-brand-600 font-bold ml-1">{rows.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => addMany(5)}
              className="text-xs text-gray-500 hover:text-brand-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              + 5 linhas
            </button>
            <button type="button" onClick={() => addMany(10)}
              className="text-xs text-gray-500 hover:text-brand-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              + 10 linhas
            </button>
            <button type="button" onClick={addRow}
              className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium">
              <Plus className="w-4 h-4" /> Linha
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-2 py-2 text-gray-500 font-medium w-6">#</th>
                <th className="px-2 py-2 text-gray-500 font-medium w-24">Nº Receptora</th>
                <th className="px-2 py-2 text-gray-500 font-medium w-24">ABCZ#</th>
                <th className="px-2 py-2 text-gray-500 font-medium">Doadora</th>
                <th className="px-2 py-2 text-gray-500 font-medium w-24">RGN Doad.</th>
                <th className="px-2 py-2 text-gray-500 font-medium">Touro</th>
                <th className="px-2 py-2 text-gray-500 font-medium w-24">RGN Touro</th>
                <th className="px-2 py-2 text-gray-500 font-medium w-28">Prev. Parto</th>
                <th className="px-2 py-2 text-gray-500 font-medium w-24">Sexagem</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={row.uid} className="hover:bg-gray-50/50">
                  {/* Hidden input para parcela (usa valor global do card financeiro) */}
                  <input type="hidden" name={`parcela_${i}`} value={valorParcela || ""} />

                  <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>

                  <td className="px-2 py-1.5">
                    <input name={`brinco_${i}`} type="text" placeholder="1234" value={row.brinco}
                      onChange={e => update(row.uid, "brinco", e.target.value)} className={inputCls} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`rgn_${i}`} type="text" placeholder="RGN" value={row.rgn}
                      onChange={e => update(row.uid, "rgn", e.target.value)} className={inputCls} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`doadora_${i}`} type="text" placeholder="Nome da doadora" value={row.doadora}
                      onChange={e => update(row.uid, "doadora", e.target.value)} className={inputCls} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`doadora_rgn_${i}`} type="text" placeholder="RGN" value={row.doadora_rgn}
                      onChange={e => update(row.uid, "doadora_rgn", e.target.value)} className={inputCls} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`touro_${i}`} type="text" placeholder="Nome do touro" value={row.touro}
                      onChange={e => update(row.uid, "touro", e.target.value)} className={inputCls} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`touro_rgn_${i}`} type="text" placeholder="RGN" value={row.touro_rgn}
                      onChange={e => update(row.uid, "touro_rgn", e.target.value)} className={inputCls} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input name={`parto_${i}`} type="date" value={row.parto}
                      onChange={e => update(row.uid, "parto", e.target.value)} className={inputCls} />
                  </td>
                  <td className="px-2 py-1.5">
                    <select name={`sexagem_${i}`} value={row.sexagem}
                      onChange={e => update(row.uid, "sexagem", e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      <option value="FEMEA">♀ Fêmea</option>
                      <option value="MACHO">♂ Macho</option>
                      <option value="NAO_SEXADO">Não sex.</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(row.uid)}
                        className="inline-flex items-center justify-center p-1 rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 hover:border-red-300 transition-colors" title="Remover linha">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
          {rows.length} prenhe{rows.length !== 1 ? "zes" : "z"} para registrar
        </div>
      </div>

      {/* ── Botões ── */}
      <div className="flex items-center gap-3">
        <button type="submit"
          className="bg-brand-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-brand-700 transition-colors">
          Salvar {rows.length} Prenhe{rows.length !== 1 ? "zes" : "z"}
        </button>
        <a href="/reproducao/prenhezes" className="text-sm text-gray-500 hover:text-gray-700">Cancelar</a>
      </div>
    </form>
  );
}
