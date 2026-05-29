"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Check, X, AlertCircle, Syringe } from "lucide-react";

interface ReceptoraOpt {
  id: string;
  brinco: string | null;
  nome: string | null;
  status_rebanho: string | null;
}

interface EmbryoLite {
  id: string;
  status: string | null;
  transfers?: { id: string }[] | null;
}

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
  // novos: para registrar implantações pendentes
  embryos?: EmbryoLite[];
  receptoras?: ReceptoraOpt[];
  dataTeDefault?: string | null;   // data padrão (data_te da sessão ou data OPU)
}

interface ReceptoraRow {
  receptoraId: string;   // "" = não selecionada, "__manual__" = brinco livre, uuid = da lista
  brinco: string;        // usado quando "__manual__"
}

function hojeISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function EditarAspiracao(props: Props) {
  const [editando, setEditando]   = useState(false);
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState<string | null>(null);

  // Quantas implantações já têm embrião IMPLANTADO criado para esta aspiração
  const implantadosCriados = useMemo(
    () => (props.embryos ?? []).filter(e => e.status === "IMPLANTADO").length,
    [props.embryos]
  );

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

  // Estado do painel de implantações pendentes
  const implantadosNum   = parseInt(form.implantados || "0", 10) || 0;
  const pendentes        = Math.max(0, implantadosNum - implantadosCriados);
  const podeImplantar    = pendentes > 0 && (props.receptoras?.length ?? 0) > 0;

  const [dataTE, setDataTE]       = useState<string>(props.dataTeDefault ?? hojeISO());
  const [recRows, setRecRows]     = useState<ReceptoraRow[]>([]);

  // Sincroniza tamanho da lista com `pendentes`
  function ajustarRows(n: number) {
    setRecRows(prev => {
      const novo = [...prev];
      while (novo.length < n) novo.push({ receptoraId: "", brinco: "" });
      while (novo.length > n) novo.pop();
      return novo;
    });
  }

  // Sincroniza automaticamente quando o painel abre ou quando `pendentes` muda
  useEffect(() => {
    if (!editando) return;
    setRecRows(prev => {
      if (prev.length === pendentes) return prev;
      const novo = [...prev];
      while (novo.length < pendentes) novo.push({ receptoraId: "", brinco: "" });
      while (novo.length > pendentes) novo.pop();
      return novo;
    });
  }, [editando, pendentes]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      // 1. Salva os contadores na aspiração
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
      if (!data.ok) {
        setErro(data.erro ?? "Erro ao salvar aspiração");
        setSalvando(false);
        return;
      }

      // 2. Se há implantações pendentes e o usuário informou receptoras, cria embriões+transfers+DG
      if (pendentes > 0 && recRows.length === pendentes) {
        // Valida que cada linha tem identificador
        const payloadReceptoras = recRows.map((r, i) => {
          if (r.receptoraId === "__manual__") {
            return { receptoraId: null, receptoraBrinco: r.brinco.trim() || null };
          }
          if (r.receptoraId) {
            return { receptoraId: r.receptoraId, receptoraBrinco: null };
          }
          return { receptoraId: null, receptoraBrinco: null };
        });

        const faltando = payloadReceptoras.findIndex(p => !p.receptoraId && !p.receptoraBrinco);
        if (faltando >= 0) {
          setErro(`Selecione a receptora #${faltando + 1} ou informe o brinco.`);
          setSalvando(false);
          return;
        }
        if (!dataTE) {
          setErro("Informe a data da T.E. das implantações.");
          setSalvando(false);
          return;
        }

        const res2 = await fetch("/api/registrar-implantacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            aspId:      props.aspId,
            dataTE,
            receptoras: payloadReceptoras,
          }),
        });
        const data2 = await res2.json();
        if (!data2.ok) {
          setErro(data2.erro ?? "Erro ao registrar implantações");
          setSalvando(false);
          return;
        }
      }

      window.location.reload();
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
          onChange={v => {
            setForm(f => ({ ...f, implantados: v }));
            const n = parseInt(v || "0", 10) || 0;
            ajustarRows(Math.max(0, n - implantadosCriados));
          }} />
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

      {/* Painel de implantações pendentes */}
      {pendentes > 0 && (
        <div className="mt-3 mb-2 p-3 rounded-lg border border-green-300 bg-green-50/60">
          <div className="flex items-center gap-1.5 mb-2">
            <Syringe className="w-3.5 h-3.5 text-green-700" />
            <p className="text-[11px] font-semibold text-green-800 uppercase">
              {pendentes} {pendentes === 1 ? "implantação pendente" : "implantações pendentes"} —
              selecione {pendentes === 1 ? "a receptora" : "as receptoras"}
            </p>
          </div>

          <div className="flex items-end gap-2 mb-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Data T.E.</label>
              <input
                type="date"
                value={dataTE}
                onChange={e => setDataTE(e.target.value)}
                className="border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
              />
            </div>
            <p className="text-[10px] text-gray-500 leading-tight pb-1">
              Será criado 1 embrião + T.E. + DG para cada receptora.<br/>
              Previsão de parto = data T.E. + 285 dias.
            </p>
          </div>

          {!podeImplantar && (props.receptoras?.length ?? 0) === 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Nenhuma receptora disponível no rebanho. Cadastre uma receptora antes de implantar.
            </p>
          )}

          <div className="space-y-1.5">
            {recRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-500 w-6">#{i + 1}</span>
                <select
                  value={row.receptoraId}
                  onChange={e => {
                    const val = e.target.value;
                    setRecRows(prev => prev.map((r, j) => j === i ? { ...r, receptoraId: val, brinco: val === "__manual__" ? r.brinco : "" } : r));
                  }}
                  className="border border-green-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500 min-w-[220px]"
                >
                  <option value="">— Selecione a receptora —</option>
                  {(props.receptoras ?? []).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.brinco ?? "?"}{r.nome ? ` · ${r.nome}` : ""}{r.status_rebanho ? ` [${r.status_rebanho}]` : ""}
                    </option>
                  ))}
                  <option value="__manual__">✏ Digitar brinco manualmente</option>
                </select>
                {row.receptoraId === "__manual__" && (
                  <input
                    type="text"
                    value={row.brinco}
                    onChange={e => {
                      const v = e.target.value;
                      setRecRows(prev => prev.map((r, j) => j === i ? { ...r, brinco: v } : r));
                    }}
                    placeholder="Nº brinco"
                    className="border border-green-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {implantadosNum > 0 && implantadosCriados > 0 && implantadosNum <= implantadosCriados && (
        <p className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1 mb-2">
          {implantadosCriados} implantação(ões) já registrada(s) com receptora. Para alterar receptoras existentes, use a tabela de embriões.
        </p>
      )}

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
