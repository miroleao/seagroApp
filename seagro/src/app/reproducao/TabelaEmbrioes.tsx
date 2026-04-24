"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Pencil, Check, X, AlertCircle, Trash2, Syringe } from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface DG {
  resultado: string;
  data_previsao_parto: string | null;
  data_dg: string | null;
}
interface Receptora {
  id: string;
  nome: string;
  brinco: string | null;
  rgn: string | null;
}
interface Transfer {
  id: string;
  receptora_brinco: string | null;
  receptora: Receptora | null;
  pregnancy_diagnoses: DG[];
}
interface Embriao {
  id: string;
  status: string | null;
  sexagem: string | null;
  numero_cdc_fiv: string | null;
  numero_adt_te: string | null;
  tipo_congelamento: string | null;
  transfers: Transfer[];
}
interface ReceptoraOpt {
  id: string;
  brinco: string | null;
  nome: string | null;
  status_rebanho: string | null;
}
interface Props {
  embryos: Embriao[];
  dataFiv: string | null;      // data_fiv da sessão (para calcular previsão de parto)
  dataDgSessao: string | null; // data_dg da sessão (padrão para DG)
  receptoras: ReceptoraOpt[];  // lista de receptoras do rebanho para T.E.
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function calcPrevisao(dataFiv: string | null): string | null {
  if (!dataFiv) return null;
  const d = new Date(dataFiv + "T12:00:00");
  d.setDate(d.getDate() + 293);
  return d.toISOString().split("T")[0];
}

// Para T.E. de embrião congelado: embrião já tem 7 dias → restam 286 dias
function calcPrevisaoTE(dataTE: string): string {
  const d = new Date(dataTE + "T12:00:00");
  d.setDate(d.getDate() + 286);
  return d.toISOString().split("T")[0];
}

function hojeISO(): string {
  return new Date().toISOString().split("T")[0];
}

const STATUS_CLS: Record<string, string> = {
  DISPONIVEL: "bg-green-50 text-green-700",
  IMPLANTADO: "bg-blue-50 text-blue-700",
  DESCARTADO: "bg-red-50 text-red-600",
};
const DG_CLS: Record<string, string> = {
  POSITIVO:   "bg-green-100 text-green-700",
  NEGATIVO:   "bg-red-100 text-red-600",
  AGUARDANDO: "bg-yellow-50 text-yellow-700",
};
const DG_LABEL: Record<string, string> = {
  POSITIVO:   "P+",
  NEGATIVO:   "Vazia",
  AGUARDANDO: "Aguard.",
};
const SEX_LABEL: Record<string, string> = {
  FEMEA:      "♀ Fêmea",
  MACHO:      "♂ Macho",
  NAO_SEXADO: "—",
};
const SEX_CLS: Record<string, string> = {
  FEMEA: "bg-pink-100 text-pink-700",
  MACHO: "bg-blue-100 text-blue-700",
};

// ── Estado de edição por linha ─────────────────────────────────────────────────
interface RowEdit {
  brinco: string;
  abcz: string;
  dgResultado: string;
  sexagem: string;
  cdcFiv: string;
  adtTe: boolean;
}

// Estado do formulário de T.E.
interface TEForm {
  dataTE: string;
  receptoraId: string;       // "" = nenhuma, "__manual__" = digitar, uuid = selecionada
  receptoraBrinco: string;   // usado quando receptoraId === "__manual__"
}

// ── Componente ─────────────────────────────────────────────────────────────────
export function TabelaEmbrioes({ embryos, dataFiv, dataDgSessao, receptoras }: Props) {
  // Qual linha está em modo edição
  const [editando, setEditando] = useState<Record<string, RowEdit>>({});
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
  const [erros,    setErros]    = useState<Record<string, string>>({});
  const [avisos,   setAvisos]   = useState<Record<string, string>>({});
  const [excluindo, setExcluindo] = useState<Record<string, boolean>>({});
  const [confirmDel, setConfirmDel] = useState<Record<string, boolean>>({});

  // T.E. de embrião congelado
  const [teOpen,   setTeOpen]   = useState<Record<string, boolean>>({});
  const [teForm,   setTeForm]   = useState<Record<string, TEForm>>({});
  const [teSaving, setTeSaving] = useState<Record<string, boolean>>({});

  function abrirTE(embId: string) {
    setTeOpen(prev => ({ ...prev, [embId]: true }));
    setTeForm(prev => ({ ...prev, [embId]: { dataTE: hojeISO(), receptoraId: "", receptoraBrinco: "" } }));
    setErros(prev => { const c = {...prev}; delete c[embId]; return c; });
    setAvisos(prev => { const c = {...prev}; delete c[embId]; return c; });
  }
  function fecharTE(embId: string) {
    setTeOpen(prev => { const c = {...prev}; delete c[embId]; return c; });
  }

  async function implantarEmbriao(emb: Embriao) {
    const form = teForm[emb.id];
    if (!form) return;
    if (!form.dataTE) {
      setErros(prev => ({ ...prev, [emb.id]: "Informe a data da T.E." }));
      return;
    }
    setTeSaving(prev => ({ ...prev, [emb.id]: true }));
    setErros(prev => { const c = {...prev}; delete c[emb.id]; return c; });
    try {
      const isManual    = form.receptoraId === "__manual__";
      const receptoraId = isManual ? null : (form.receptoraId || null);
      // Resolve brinco: se selecionou da lista, busca o brinco do objeto
      let receptoraBrinco = isManual ? form.receptoraBrinco.trim() : null;
      if (!isManual && form.receptoraId) {
        const rec = receptoras.find(r => r.id === form.receptoraId);
        receptoraBrinco = rec?.brinco ?? null;
      }

      const res = await fetch("/api/implantar-embriao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embryoId: emb.id, dataTE: form.dataTE, receptoraId, receptoraBrinco }),
      });
      const data = await res.json();
      if (data.ok) {
        const msg = data.receptoraStatus === "criada"
          ? `✓ Implantado! Receptora "${receptoraBrinco}" criada. Previsão de parto: ${formatDate(data.dataPrevisaoParto)}`
          : `✓ Implantado! Previsão de parto: ${formatDate(data.dataPrevisaoParto)}`;
        setAvisos(prev => ({ ...prev, [emb.id]: msg }));
        setTeOpen(prev => { const c = {...prev}; delete c[emb.id]; return c; });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setErros(prev => ({ ...prev, [emb.id]: data.erro ?? "Erro ao implantar" }));
      }
    } catch (e: any) {
      setErros(prev => ({ ...prev, [emb.id]: e?.message ?? "Erro de rede" }));
    } finally {
      setTeSaving(prev => ({ ...prev, [emb.id]: false }));
    }
  }

  function iniciarEdicao(emb: Embriao) {
    try {
      const transfer = emb.transfers?.[0] ?? null;
      const dg       = transfer?.pregnancy_diagnoses?.[0] ?? null;
      const brinco   = transfer?.receptora?.brinco ?? transfer?.receptora_brinco ?? "";
      const abcz     = transfer?.receptora?.rgn ?? "";
      setEditando(prev => ({
        ...prev,
        [emb.id]: {
          brinco:      brinco,
          abcz:        abcz,
          dgResultado: dg?.resultado ?? "",
          sexagem:     emb.sexagem ?? "NAO_SEXADO",
          cdcFiv:      emb.numero_cdc_fiv ?? "",
          adtTe:       !!emb.numero_adt_te,
        },
      }));
      setErros(prev => { const c = {...prev}; delete c[emb.id]; return c; });
      setAvisos(prev => { const c = {...prev}; delete c[emb.id]; return c; });
    } catch (e: any) {
      setErros(prev => ({ ...prev, [emb.id]: `Erro ao abrir edição: ${e?.message}` }));
    }
  }

  function cancelarEdicao(embId: string) {
    setEditando(prev => { const c = {...prev}; delete c[embId]; return c; });
  }

  async function excluirEmbriao(emb: Embriao) {
    setExcluindo(prev => ({ ...prev, [emb.id]: true }));
    setErros(prev => { const c = { ...prev }; delete c[emb.id]; return c; });
    try {
      const res = await fetch("/api/excluir-embriao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embryoId: emb.id }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      } else {
        setErros(prev => ({ ...prev, [emb.id]: data.erro ?? "Erro ao excluir" }));
        setExcluindo(prev => ({ ...prev, [emb.id]: false }));
      }
    } catch (e: any) {
      setErros(prev => ({ ...prev, [emb.id]: e?.message ?? "Erro de rede" }));
      setExcluindo(prev => ({ ...prev, [emb.id]: false }));
    }
  }

  async function salvar(emb: Embriao) {
    const form = editando[emb.id];
    if (!form) return;

    setSalvando(prev => ({ ...prev, [emb.id]: true }));
    setErros(prev => { const c = {...prev}; delete c[emb.id]; return c; });

    try {
      const transfer = emb.transfers?.[0] ?? null;
      const res = await fetch("/api/salvar-embriao", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embryoId:        emb.id,
          transferId:      transfer?.id ?? null,
          sexagem:         form.sexagem,
          receptoraBrinco: form.brinco,
          receptoraAbcz:   form.abcz,
          dgResultado:     form.dgResultado,
          cdcFiv:          form.cdcFiv,
          adtTe:           form.adtTe,
          dataFiv,
          dataDgSessao,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        if (data.receptoraStatus === "criada") {
          setAvisos(prev => ({ ...prev, [emb.id]: `✓ Receptora "${form.brinco}" criada no rebanho.` }));
        }
        setEditando(prev => { const c = {...prev}; delete c[emb.id]; return c; });
        window.location.reload();
      } else {
        setErros(prev => ({ ...prev, [emb.id]: data.erro ?? "Erro ao salvar" }));
      }
    } catch (e: any) {
      setErros(prev => ({ ...prev, [emb.id]: e?.message ?? "Erro inesperado" }));
    } finally {
      setSalvando(prev => ({ ...prev, [emb.id]: false }));
    }
  }

  if (embryos.length === 0) return null;

  const previsaoAuto = dataFiv ? calcPrevisao(dataFiv) : null;

  return (
    <div className="px-5 pb-3 overflow-x-auto border-t border-gray-50">
      <table className="w-full text-xs text-left mt-2">
        <thead>
          <tr className="border-b border-gray-100">
            {["#", "Status", "Tipo", "No Brinco", "#ABCZ", "DG", "Sexagem", "Prev. Parto", "CDC-FIV", "ADT-TE", ""].map((h) => (
              <th key={h} className="py-1.5 px-2 text-gray-400 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {embryos.map((emb, idx) => {
            const transfer  = emb.transfers?.[0] ?? null;
            const receptora = transfer?.receptora ?? null;
            const brinco    = receptora?.brinco ?? transfer?.receptora_brinco ?? null;
            const dg        = transfer?.pregnancy_diagnoses?.[0] ?? null;
            const isEdit    = !!editando[emb.id];
            const form      = editando[emb.id];
            const isSaving  = salvando[emb.id];

            // T.E. de embrião congelado
            const isCongelado = emb.status === "DISPONIVEL" && (emb.tipo_congelamento === "DT" || emb.tipo_congelamento === "VITRIFICADO");
            const isTeOpen    = !!teOpen[emb.id];
            const teFormData  = teForm[emb.id];
            const isTeManual  = teFormData?.receptoraId === "__manual__";

            // Previsão de parto: usa o valor salvo se existir, senão sempre calcula (data_fiv + 293)
            const previsao = dg?.data_previsao_parto ?? previsaoAuto;

            return (
              <React.Fragment key={emb.id}>
                <tr className={`hover:bg-gray-50/50 ${isEdit ? "bg-violet-50/30" : ""}`}>
                  {/* # */}
                  <td className="py-1.5 px-2 text-gray-400">{idx + 1}</td>

                  {/* Status */}
                  <td className="py-1.5 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_CLS[emb.status ?? ""] ?? "bg-gray-50 text-gray-600"}`}>
                      {emb.status ?? "—"}
                    </span>
                  </td>

                  {/* Tipo de congelamento */}
                  <td className="py-1.5 px-2">
                    {emb.tipo_congelamento === "DT"
                      ? <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700">DT</span>
                      : emb.tipo_congelamento === "VITRIFICADO"
                      ? <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-700">Vitri.</span>
                      : emb.status === "IMPLANTADO"
                      ? <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700">Impl.</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>

                  {/* No Brinco (tag number) */}
                  <td className="py-1.5 px-2">
                    {isEdit ? (
                      <input
                        type="text"
                        value={form.brinco}
                        onChange={e => setEditando(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], brinco: e.target.value }}))}
                        placeholder="Nº brinco"
                        className="border border-violet-300 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    ) : receptora?.id ? (
                      <Link href={`/rebanho/${receptora.id}`}
                        className="font-mono text-brand-700 hover:underline font-semibold">
                        {brinco ?? "—"}
                      </Link>
                    ) : (
                      <span className="font-mono text-gray-500">{brinco ?? "—"}</span>
                    )}
                  </td>

                  {/* #ABCZ (rgn) */}
                  <td className="py-1.5 px-2">
                    {isEdit ? (
                      <input
                        type="text"
                        value={form.abcz}
                        onChange={e => setEditando(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], abcz: e.target.value }}))}
                        placeholder="Nº ABCZ"
                        className="border border-violet-300 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    ) : (
                      <span className="font-mono text-gray-500">{receptora?.rgn ?? "—"}</span>
                    )}
                  </td>

                  {/* DG */}
                  <td className="py-1.5 px-2">
                    {isEdit ? (
                      <select
                        value={form.dgResultado}
                        onChange={e => setEditando(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], dgResultado: e.target.value }}))}
                        className="border border-violet-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                      >
                        <option value="">— Sem DG —</option>
                        <option value="POSITIVO">P+</option>
                        <option value="NEGATIVO">Vazia</option>
                        <option value="AGUARDANDO">Aguardando</option>
                      </select>
                    ) : dg?.resultado ? (
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${DG_CLS[dg.resultado] ?? "bg-gray-50 text-gray-600"}`}>
                        {DG_LABEL[dg.resultado] ?? dg.resultado}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Sexagem */}
                  <td className="py-1.5 px-2">
                    {isEdit ? (
                      <select
                        value={form.sexagem}
                        onChange={e => setEditando(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], sexagem: e.target.value }}))}
                        className="border border-violet-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                      >
                        <option value="NAO_SEXADO">— Não sexado —</option>
                        <option value="FEMEA">♀ Fêmea</option>
                        <option value="MACHO">♂ Macho</option>
                      </select>
                    ) : emb.sexagem && emb.sexagem !== "NAO_SEXADO" ? (
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${SEX_CLS[emb.sexagem] ?? ""}`}>
                        {SEX_LABEL[emb.sexagem] ?? emb.sexagem}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Prev. Parto — sempre data_fiv + 293 */}
                  <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">
                    {previsaoAuto ? (
                      <span className={isEdit ? "text-violet-600 font-medium" : ""}>
                        {formatDate(previsaoAuto)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* CDC-FIV */}
                  <td className="py-1.5 px-2">
                    {isEdit ? (
                      <input
                        type="text"
                        value={form.cdcFiv}
                        onChange={e => setEditando(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], cdcFiv: e.target.value }}))}
                        placeholder="Nº CDC"
                        className="border border-violet-300 rounded px-1.5 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    ) : (
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${emb.numero_cdc_fiv ? "bg-green-100 text-green-700 font-medium" : "bg-gray-50 text-gray-400"}`}>
                        {emb.numero_cdc_fiv ?? "—"}
                      </span>
                    )}
                  </td>

                  {/* ADT-TE */}
                  <td className="py-1.5 px-2">
                    {isEdit ? (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.adtTe}
                          onChange={e => setEditando(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], adtTe: e.target.checked }}))}
                          className="w-3.5 h-3.5 accent-violet-600"
                        />
                        <span className="text-[11px] text-gray-600">ADT-TE</span>
                      </label>
                    ) : (
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${emb.numero_adt_te ? "bg-green-100 text-green-700 font-medium" : "bg-gray-50 text-gray-400"}`}>
                        {emb.numero_adt_te ? "✓ SIM" : "—"}
                      </span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="py-1.5 px-2">
                    {isEdit ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => salvar(emb)}
                          disabled={isSaving}
                          title="Salvar"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-[11px] font-medium disabled:opacity-50"
                        >
                          {isSaving ? (
                            <span className="text-[10px] px-0.5">...</span>
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              Salvar
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => cancelarEdicao(emb.id)}
                          disabled={isSaving}
                          title="Cancelar"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          Cancelar
                        </button>
                      </div>
                    ) : confirmDel[emb.id] ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => excluirEmbriao(emb)}
                          disabled={excluindo[emb.id]}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[11px] font-medium disabled:opacity-50"
                          title="Confirmar exclusão"
                        >
                          {excluindo[emb.id] ? "..." : "Sim, excluir"}
                        </button>
                        <button
                          onClick={() => setConfirmDel(prev => { const c = { ...prev }; delete c[emb.id]; return c; })}
                          disabled={excluindo[emb.id]}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] disabled:opacity-50"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 flex-wrap">
                        {isCongelado && (
                          <button
                            onClick={() => abrirTE(emb.id)}
                            title="Registrar T.E. (implantação)"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 text-[11px] font-semibold transition-colors"
                          >
                            <Syringe className="w-3 h-3" />
                            T.E.
                          </button>
                        )}
                        <button
                          onClick={() => iniciarEdicao(emb)}
                          title="Editar linha"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300 text-[11px] font-medium transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDel(prev => ({ ...prev, [emb.id]: true }))}
                          title="Excluir embrião"
                          className="inline-flex items-center justify-center p-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* Formulário inline de T.E. */}
                {isTeOpen && teFormData && (
                  <tr className="bg-green-50/60">
                    <td colSpan={11} className="px-4 py-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Data T.E.</label>
                          <input
                            type="date"
                            value={teFormData.dataTE}
                            onChange={e => setTeForm(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], dataTE: e.target.value } }))}
                            className="border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                          />
                          {teFormData.dataTE && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Prev. parto: {formatDate(calcPrevisaoTE(teFormData.dataTE))}
                            </p>
                          )}
                        </div>
                        <div className="min-w-[200px]">
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Receptora</label>
                          <select
                            value={teFormData.receptoraId}
                            onChange={e => setTeForm(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], receptoraId: e.target.value, receptoraBrinco: "" } }))}
                            className="w-full border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                          >
                            <option value="">— Sem receptora —</option>
                            {receptoras.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.brinco ?? "?"} {r.nome ? `· ${r.nome}` : ""} {r.status_rebanho ? `[${r.status_rebanho}]` : ""}
                              </option>
                            ))}
                            <option value="__manual__">✏ Digitar brinco manualmente</option>
                          </select>
                        </div>
                        {isTeManual && (
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">Nº Brinco</label>
                            <input
                              type="text"
                              value={teFormData.receptoraBrinco}
                              onChange={e => setTeForm(prev => ({ ...prev, [emb.id]: { ...prev[emb.id], receptoraBrinco: e.target.value } }))}
                              placeholder="Ex: 1234"
                              className="border border-green-300 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => implantarEmbriao(emb)}
                            disabled={teSaving[emb.id]}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-[11px] font-semibold disabled:opacity-50 transition-colors"
                          >
                            {teSaving[emb.id] ? "Salvando..." : (
                              <><Syringe className="w-3 h-3" /> Confirmar T.E.</>
                            )}
                          </button>
                          <button
                            onClick={() => fecharTE(emb.id)}
                            disabled={teSaving[emb.id]}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 text-[11px] disabled:opacity-50"
                          >
                            <X className="w-3 h-3" /> Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Avisos / erros inline abaixo da linha */}
                {(erros[emb.id] || avisos[emb.id]) && (
                  <tr>
                    <td colSpan={11} className="px-2 pb-1.5">
                      {erros[emb.id] && (
                        <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded px-2 py-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {erros[emb.id]}
                        </div>
                      )}
                      {avisos[emb.id] && (
                        <div className="flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 rounded px-2 py-1">
                          <Check className="w-3 h-3 shrink-0" />
                          {avisos[emb.id]}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Legenda previsão de parto */}
      <div className="mt-2 flex flex-col gap-0.5">
        {dataFiv && (
          <p className="text-[10px] text-gray-400">
            Parto (FIV direto) = data FIV ({formatDate(dataFiv)}) + 293 dias
          </p>
        )}
        <p className="text-[10px] text-gray-400">
          Parto (T.E. de congelado) = data T.E. + 286 dias (embrião já tem 7 dias de desenvolvimento)
        </p>
      </div>
    </div>
  );
}
