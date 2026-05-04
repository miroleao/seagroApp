"use client";

import { useState, useId } from "react";
import { Plus, Trash2, X } from "lucide-react";
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

type VendorEntry = { uid: string; nome: string; pct: string };

function emptyRow(uid: string): PrenheZRow {
  return { uid, brinco: "", rgn: "", doadora: "", doadora_rgn: "", touro: "", touro_rgn: "", parto: "", sexagem: "" };
}

function emptyVendor(uid: string): VendorEntry {
  return { uid, nome: "", pct: "" };
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
  const [vendors, setVendors] = useState<VendorEntry[]>([emptyVendor(`${baseId}-v0`)]);

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

  function addVendor() {
    setVendors(v => [...v, emptyVendor(`${baseId}-v${v.length}`)]);
  }
  function removeVendor(uid: string) {
    setVendors(v => v.filter(x => x.uid !== uid));
  }
  function updateVendor(uid: string, field: keyof VendorEntry, value: string) {
    setVendors(v => v.map(x => x.uid === uid ? { ...x, [field]: value } : x));
  }

  return (
    <form action={registrarPrenhezesBatch} className="space-y-6">

      {/* ── Dados do Lote ── */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
          Dados do Lote
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data da Compra</label>
            <input name="data_compra" type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Fazenda de Origem</label>
            <input name="fazenda" type="text" placeholder="Ex: Fazenda São João" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data de Entrega</label>
            <input name="data_entrega" type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
        </div>

        {/* Vendedores com % */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">
              Vendedor(es)
              <span className="ml-1 font-normal text-gray-400">— informe o % de cada um quando houver mais de um</span>
            </label>
            <button
              type="button"
              onClick={addVendor}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
            >
              <Plus className="w-3 h-3" /> Adicionar vendedor
            </button>
          </div>
          {vendors.map((v, idx) => (
            <div key={v.uid} className="flex items-center gap-2">
              <input
                name={`vendedor_nome_${idx}`}
                type="text"
                placeholder="Nome do vendedor"
                value={v.nome}
                onChange={e => updateVendor(v.uid, "nome", e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              />
              <div className="relative w-28 shrink-0">
                <input
                  name={`vendedor_pct_${idx}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="100"
                  value={v.pct}
                  onChange={e => updateVendor(v.uid, "pct", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
              </div>
              {vendors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVendor(v.uid)}
                  className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                  title="Remover vendedor"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {/* Validação visual: percentuais somam 100 quando há múltiplos */}
          {vendors.length > 1 && (() => {
            const soma = vendors.reduce((acc, v) => acc + (parseFloat(v.pct) || 0), 0);
            if (soma > 0 && Math.abs(soma - 100) > 0.01) {
              return (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  ⚠ Percentuais somam {soma.toFixed(0)}% (devem somar 100%)
                </p>
              );
            }
            return null;
          })()}
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
