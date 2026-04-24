"use client";

import React, { useState, useActionState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { registrarOPUBatch } from "./actions";

type ReceptoraSlot = { uid: string; receptora_id: string; brinco: string };

type DoadoraRow = {
  uid: string;
  doadora_id: string;
  nome: string;
  rgn: string;
  touro: string;
  touro_rgn: string;
  oocitos: string;
  dt: string;           // embriões DT
  vitrificados: string; // embriões vitrificados
  implantados: string;
  prenhezes: string;
  custo: string;
  receptoras: ReceptoraSlot[];
  showReceptoras: boolean;
};

function emptyRow(uid: string): DoadoraRow {
  return {
    uid, doadora_id: "", nome: "", rgn: "", touro: "", touro_rgn: "",
    oocitos: "", dt: "", vitrificados: "", implantados: "",
    prenhezes: "", custo: "", receptoras: [], showReceptoras: false,
  };
}
function emptySlot(uid: string): ReceptoraSlot {
  return { uid, receptora_id: "", brinco: "" };
}

const inputCls   = "w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white";
const inputXsCls = "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white";

async function registrarOPUAction(
  _prev: { erro: string | null },
  formData: FormData
): Promise<{ erro: string | null }> {
  try {
    await registrarOPUBatch(formData);
    return { erro: null };
  } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    return { erro: e?.message ?? "Erro desconhecido ao salvar" };
  }
}

export default function OPUForm({
  doadoras,
  receptoras,
}: {
  doadoras: { id: string; nome: string; rgn?: string | null }[];
  receptoras: { id: string; brinco: string | null; nome: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(registrarOPUAction, { erro: null });
  const [tipoSessao, setTipoSessao] = useState<"PROPRIA" | "ADQUIRIDA">("PROPRIA");
  const [rows, setRows] = useState<DoadoraRow[]>([emptyRow("row-0")]);

  function addRow() {
    setRows(r => [...r, emptyRow(`row-${Date.now()}`)]);
  }
  function removeRow(uid: string) {
    setRows(r => r.filter(x => x.uid !== uid));
  }
  function updateRow(uid: string, field: keyof DoadoraRow, value: any) {
    setRows(r => r.map(x => {
      if (x.uid !== uid) return x;
      const updated = { ...x, [field]: value };
      if (field === "implantados") {
        const n = parseInt(value) || 0;
        const cur = x.receptoras.length;
        if (n > cur) {
          updated.receptoras = [
            ...x.receptoras,
            ...Array.from({ length: n - cur }, (_, k) =>
              emptySlot(`${uid}-r${cur + k}-${Date.now() + k}`)
            ),
          ];
          if (n > 0) updated.showReceptoras = true;
        } else {
          updated.receptoras = x.receptoras.slice(0, n);
          if (n === 0) updated.showReceptoras = false;
        }
      }
      return updated;
    }));
  }
  function updateReceptora(rowUid: string, slotUid: string, field: keyof ReceptoraSlot, value: string) {
    setRows(r => r.map(x => {
      if (x.uid !== rowUid) return x;
      return { ...x, receptoras: x.receptoras.map(s => s.uid === slotUid ? { ...s, [field]: value } : s) };
    }));
  }

  const totalDt          = rows.reduce((s, r) => s + (parseInt(r.dt)           || 0), 0);
  const totalVitri       = rows.reduce((s, r) => s + (parseInt(r.vitrificados) || 0), 0);
  const totalImplantados = rows.reduce((s, r) => s + (parseInt(r.implantados)  || 0), 0);
  const totalPrenhezes   = rows.reduce((s, r) => s + (parseInt(r.prenhezes)    || 0), 0);
  const totalCusto       = rows.reduce((s, r) => s + (parseFloat(r.custo)      || 0), 0);
  const totalEmbrioes    = totalDt + totalVitri + totalImplantados;

  const colsDoadoras = tipoSessao === "PROPRIA" ? 1 : 2;

  return (
    <form action={formAction} className="space-y-6">

      {/* Erro */}
      {state.erro && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erro ao salvar a sessão OPU:</p>
            <p className="mt-0.5">{state.erro}</p>
          </div>
        </div>
      )}

      {/* ── Dados da Sessão ───────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
          Dados da Sessão
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data da OPU *</label>
            <input name="data" type="date" required className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data da FIV</label>
            <input name="data_fiv" type="date" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data DG</label>
            <input name="data_dg" type="date" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data Sexagem</label>
            <input name="data_sexagem" type="date" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tipo de Aspiração</label>
            <select name="tipo_sessao" value={tipoSessao} onChange={e => setTipoSessao(e.target.value as "PROPRIA" | "ADQUIRIDA")} className={inputCls}>
              <option value="PROPRIA">Aspiração Própria</option>
              <option value="ADQUIRIDA">Aspiração Adquirida</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Local / Fazenda</label>
            <input name="local" type="text" placeholder="Ex: Fazenda SE" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Responsável / Veterinário</label>
            <input name="responsavel" type="text" placeholder="Nome" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Laboratório</label>
            <input name="laboratorio" type="text" placeholder="Nome do lab" className={inputCls} />
          </div>
        </div>
      </div>

      {/* ── Doadoras ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Doadoras <span className="text-brand-600 font-bold ml-1">{rows.length}</span>
          </h2>
          <button type="button" onClick={addRow}
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium">
            <Plus className="w-4 h-4" /> Adicionar Doadora
          </button>
        </div>

        {/* Legenda dos tipos de congelamento */}
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-4 text-xs text-blue-700">
          <span className="font-semibold">Embriões:</span>
          <span><span className="font-bold">DT</span> = Direto (resfriado)</span>
          <span><span className="font-bold">Vitri.</span> = Vitrificado (congelado)</span>
          <span><span className="font-bold">Impl.</span> = Implantado na receptora</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 text-xs text-gray-500 font-medium w-6">#</th>
                {tipoSessao === "PROPRIA" ? (
                  <th className="px-3 py-2 text-xs text-gray-500 font-medium min-w-[200px]">Doadora (cadastro)</th>
                ) : (
                  <>
                    <th className="px-3 py-2 text-xs text-gray-500 font-medium min-w-[160px]">Nome Doadora</th>
                    <th className="px-3 py-2 text-xs text-gray-500 font-medium w-28">RGN Doadora</th>
                  </>
                )}
                <th className="px-3 py-2 text-xs text-gray-500 font-medium min-w-[140px]">Touro</th>
                <th className="px-3 py-2 text-xs text-gray-500 font-medium w-24">RGN Touro</th>
                <th className="px-3 py-2 text-xs text-gray-500 font-medium w-24">Oócitos</th>
                <th className="px-3 py-2 text-xs text-blue-600 font-semibold w-20 bg-blue-50/50">DT</th>
                <th className="px-3 py-2 text-xs text-indigo-600 font-semibold w-20 bg-indigo-50/50">Vitri.</th>
                <th className="px-3 py-2 text-xs text-amber-600 font-semibold w-20 bg-amber-50/50">Impl.</th>
                <th className="px-3 py-2 text-xs text-gray-500 font-medium w-20">Prenhez.</th>
                <th className="px-3 py-2 text-xs text-gray-500 font-medium w-28">Custo (R$)</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const totalRow = (parseInt(row.dt) || 0) + (parseInt(row.vitrificados) || 0) + (parseInt(row.implantados) || 0);
                return (
                  <React.Fragment key={row.uid}>
                    <tr className="hover:bg-gray-50/50 border-t border-gray-100">
                      <td className="px-3 py-2 text-xs text-gray-400 font-medium">{i + 1}</td>

                      {tipoSessao === "PROPRIA" ? (
                        <td className="px-3 py-2">
                          <select name={`doadora_id_${i}`} value={row.doadora_id}
                            onChange={e => updateRow(row.uid, "doadora_id", e.target.value)} className={inputCls}>
                            <option value="">— Selecionar —</option>
                            {doadoras.map(d => (
                              <option key={d.id} value={d.id}>{d.nome}{d.rgn ? ` (${d.rgn})` : ""}</option>
                            ))}
                          </select>
                          <input type="hidden" name={`nome_${i}`} value="" />
                          <input type="hidden" name={`rgn_${i}`} value="" />
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2">
                            <input name={`nome_${i}`} type="text" placeholder="Nome da doadora"
                              value={row.nome} onChange={e => updateRow(row.uid, "nome", e.target.value)} className={inputCls} />
                            <input type="hidden" name={`doadora_id_${i}`} value="" />
                          </td>
                          <td className="px-3 py-2">
                            <input name={`rgn_${i}`} type="text" placeholder="RGN"
                              value={row.rgn} onChange={e => updateRow(row.uid, "rgn", e.target.value)} className={inputCls} />
                          </td>
                        </>
                      )}

                      <td className="px-3 py-2">
                        <input name={`touro_${i}`} type="text" placeholder="Nome do touro"
                          value={row.touro} onChange={e => updateRow(row.uid, "touro", e.target.value)} className={inputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input name={`touro_rgn_${i}`} type="text" placeholder="RGN"
                          value={row.touro_rgn} onChange={e => updateRow(row.uid, "touro_rgn", e.target.value)} className={inputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input name={`oocitos_${i}`} type="number" min="0" placeholder="0"
                          value={row.oocitos} onChange={e => updateRow(row.uid, "oocitos", e.target.value)} className={inputCls} />
                      </td>

                      {/* DT */}
                      <td className="px-3 py-2 bg-blue-50/30">
                        <input name={`dt_${i}`} type="number" min="0" placeholder="0"
                          value={row.dt} onChange={e => updateRow(row.uid, "dt", e.target.value)}
                          className="w-full border border-blue-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white" />
                      </td>

                      {/* Vitrificados */}
                      <td className="px-3 py-2 bg-indigo-50/30">
                        <input name={`vitrificados_${i}`} type="number" min="0" placeholder="0"
                          value={row.vitrificados} onChange={e => updateRow(row.uid, "vitrificados", e.target.value)}
                          className="w-full border border-indigo-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                      </td>

                      {/* Implantados */}
                      <td className="px-3 py-2 bg-amber-50/30">
                        <div className="flex items-center gap-1">
                          <input name={`implantados_${i}`} type="number" min="0" placeholder="0"
                            value={row.implantados}
                            onChange={e => updateRow(row.uid, "implantados", e.target.value)}
                            className="w-full border border-amber-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
                          {(parseInt(row.implantados) || 0) > 0 && (
                            <button type="button"
                              onClick={() => updateRow(row.uid, "showReceptoras", !row.showReceptoras)}
                              className="shrink-0 text-amber-500 hover:text-amber-700"
                              title="Vincular receptoras">
                              {row.showReceptoras ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        <input name={`prenhezes_${i}`} type="number" min="0" placeholder="0"
                          value={row.prenhezes} onChange={e => updateRow(row.uid, "prenhezes", e.target.value)} className={inputCls} />
                      </td>
                      <td className="px-3 py-2">
                        <input name={`custo_${i}`} type="number" min="0" step="0.01" placeholder="0,00"
                          value={row.custo} onChange={e => updateRow(row.uid, "custo", e.target.value)} className={inputCls} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        {rows.length > 1 && (
                          <button type="button" onClick={() => removeRow(row.uid)}
                            className="inline-flex items-center justify-center p-1 rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                            title="Remover linha">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Mini-resumo por linha */}
                    {totalRow > 0 && (
                      <tr className="border-t border-gray-50">
                        <td colSpan={colsDoadoras + 9} className="px-3 py-1 text-right">
                          <span className="text-[11px] text-gray-400">
                            Total embriões:{" "}
                            <span className="font-semibold text-gray-600">{totalRow}</span>
                            {parseInt(row.dt) > 0 && <span className="ml-2 text-blue-600">{row.dt} DT</span>}
                            {parseInt(row.vitrificados) > 0 && <span className="ml-2 text-indigo-600">{row.vitrificados} Vitri.</span>}
                            {parseInt(row.implantados) > 0 && <span className="ml-2 text-amber-600">{row.implantados} Impl.</span>}
                          </span>
                        </td>
                      </tr>
                    )}

                    {/* Sub-linhas de receptoras */}
                    {row.showReceptoras && row.receptoras.map((slot, j) => (
                      <tr key={slot.uid} className="bg-amber-50/30 border-t border-amber-100/40">
                        <td className="px-3 py-1.5 text-xs text-amber-400 text-center">↳</td>
                        <td colSpan={colsDoadoras + 3} className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 shrink-0 w-20">Receptora {j + 1}</span>
                            <select
                              name={`receptora_id_${i}_${j}`}
                              value={slot.receptora_id}
                              onChange={e => {
                                const id = e.target.value;
                                updateReceptora(row.uid, slot.uid, "receptora_id", id);
                                const found = receptoras.find(r => r.id === id);
                                if (found?.brinco) updateReceptora(row.uid, slot.uid, "brinco", found.brinco);
                              }}
                              className={`${inputXsCls} flex-1 max-w-xs`}
                            >
                              <option value="">— Vincular do rebanho —</option>
                              {receptoras.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.brinco ? `#${r.brinco}` : "s/ brinco"}{r.nome ? ` — ${r.nome}` : ""}
                                </option>
                              ))}
                            </select>
                            <span className="text-xs text-gray-400 shrink-0">ou</span>
                            <input
                              name={`receptora_brinco_${i}_${j}`}
                              type="text"
                              placeholder="Nº brinco"
                              value={slot.brinco}
                              onChange={e => updateReceptora(row.uid, slot.uid, "brinco", e.target.value)}
                              className={`${inputXsCls} w-28`}
                            />
                          </div>
                        </td>
                        <td colSpan={6} />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center gap-5 text-xs text-gray-500">
          <span><strong className="text-blue-700">{totalDt}</strong> DT</span>
          <span><strong className="text-indigo-700">{totalVitri}</strong> Vitrif.</span>
          <span><strong className="text-amber-700">{totalImplantados}</strong> Impl.</span>
          <span className="border-l border-gray-200 pl-4">
            <strong className="text-gray-800">{totalEmbrioes}</strong> embriões totais
          </span>
          <span><strong className="text-gray-800">{totalPrenhezes}</strong> prenhezes</span>
          <span className="ml-auto">
            <strong className="text-gray-800">
              {totalCusto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </strong> custo total
          </span>
        </div>
      </div>

      {/* ── Botões ── */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="bg-brand-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60">
          {pending ? "Salvando..." : `Salvar Sessão OPU (${rows.length} doadora${rows.length !== 1 ? "s" : ""})`}
        </button>
        <a href="/reproducao" className="text-sm text-gray-500 hover:text-gray-700">Cancelar</a>
      </div>
    </form>
  );
}
