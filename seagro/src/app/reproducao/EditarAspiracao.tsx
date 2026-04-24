"use client";

import { useState } from "react";
import { Pencil, Check, X, AlertCircle } from "lucide-react";

interface Props {
  aspId: string;
  touro_nome: string | null;
  touro_rgn: string | null;
  oocitos_viaveis: number | null;
  embryos_congelados: number | null;
  implantados: number | null;
  prenhezes_count: number | null;
  custo_total: number | null;
  observacoes: string | null;
}

export function EditarAspiracao(props: Props) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState<string | null>(null);

  const [form, setForm] = useState({
    touro_nome:         props.touro_nome         ?? "",
    touro_rgn:          props.touro_rgn          ?? "",
    oocitos_viaveis:    props.oocitos_viaveis    != null ? String(props.oocitos_viaveis)    : "",
    embryos_congelados: props.embryos_congelados != null ? String(props.embryos_congelados) : "",
    implantados:        props.implantados        != null ? String(props.implantados)        : "",
    prenhezes_count:    props.prenhezes_count    != null ? String(props.prenhezes_count)    : "",
    custo_total:        props.custo_total        != null ? String(props.custo_total)        : "",
    observacoes:        props.observacoes        ?? "",
  });

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/salvar-aspiracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspId: props.aspId,
          touro_nome:         form.touro_nome.trim() || null,
          touro_rgn:          form.touro_rgn.trim() || null,
          oocitos_viaveis:    form.oocitos_viaveis,
          embryos_congelados: form.embryos_congelados,
          implantados:        form.implantados,
          prenhezes_count:    form.prenhezes_count,
          custo_total:        form.custo_total,
          observacoes:        form.observacoes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      } else {
        setErro(data.erro ?? "Erro ao salvar");
        setSalvando(false);
      }
    } catch (e: any) {
      setErro(e?.message ?? "Erro de rede");
      setSalvando(false);
    }
  }

  if (!editando) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300 text-xs font-medium transition-colors"
        title="Editar dados da aspiração"
      >
        <Pencil className="w-3.5 h-3.5" />
        Editar aspiração
      </button>
    );
  }

  return (
    <div className="w-full mt-2 p-3 bg-violet-50/50 border border-violet-200 rounded-lg">
      <p className="text-[11px] font-semibold text-violet-700 uppercase mb-2">Editar aspiração</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        <Field label="Touro" value={form.touro_nome}
          onChange={v => setForm(f => ({ ...f, touro_nome: v }))} />
        <Field label="RGN Touro" value={form.touro_rgn}
          onChange={v => setForm(f => ({ ...f, touro_rgn: v }))} />
        <Field label="Oócitos viáveis" value={form.oocitos_viaveis} type="number"
          onChange={v => setForm(f => ({ ...f, oocitos_viaveis: v }))} />
        <Field label="Embriões cong." value={form.embryos_congelados} type="number"
          onChange={v => setForm(f => ({ ...f, embryos_congelados: v }))} />
        <Field label="Implantados" value={form.implantados} type="number"
          onChange={v => setForm(f => ({ ...f, implantados: v }))} />
        <Field label="Prenhezes" value={form.prenhezes_count} type="number"
          onChange={v => setForm(f => ({ ...f, prenhezes_count: v }))} />
        <Field label="Custo total (R$)" value={form.custo_total} type="number" step="0.01"
          onChange={v => setForm(f => ({ ...f, custo_total: v }))} />
      </div>

      <div className="mb-2">
        <label className="text-[10px] font-semibold text-gray-500 uppercase">Observações</label>
        <textarea
          value={form.observacoes}
          onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
          rows={2}
          className="w-full mt-0.5 border border-violet-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
      </div>

      {erro && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {erro}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={() => { setEditando(false); setErro(null); }}
          disabled={salvando}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", step,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; step?: string }) {
  return (
    <label className="flex flex-col">
      <span className="text-[10px] font-semibold text-gray-500 uppercase">{label}</span>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 border border-violet-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
      />
    </label>
  );
}
