"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Snowflake, Droplet, MapPin, DollarSign, Pencil, Check, X, AlertCircle,
  Trash2, Syringe, ChevronDown, ChevronRight, History,
} from "lucide-react";
import {
  criarSemen, atualizarSemen, excluirSemen,
  registrarUsoSemen, excluirUsoSemen,
} from "./actions";

interface TouroOpt {
  id: string;
  nome: string;
  rgn: string | null;
  brinco: string | null;
}

interface DoadoraOpt {
  id: string;
  nome: string;
  rgn: string | null;
  brinco: string | null;
}

interface SemenRow {
  id: string;
  touro_id: string | null;
  touro_nome: string;
  touro_rgn: string | null;
  doses: number;
  tipo: "CONVENCIONAL" | "SEXADO_FEMEA";
  local_armazenamento: string | null;
  valor_por_dose: number | null;
  observacoes: string | null;
  criado_em: string;
}

interface UsoRow {
  id: string;
  semen_stock_id: string;
  data_saida: string;
  doses_usadas: number;
  tipo_uso: "FIV" | "IATF";
  doadora_id: string | null;
  doadora_nome: string | null;
  veterinario: string | null;
  usuario_nome: string | null;
  observacoes: string | null;
}

interface Props {
  estoque: SemenRow[];
  touros: TouroOpt[];
  doadoras: DoadoraOpt[];
  usos: UsoRow[];
  erro: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  CONVENCIONAL: "Convencional",
  SEXADO_FEMEA: "Sexado ♀",
};
const TIPO_CLS: Record<string, string> = {
  CONVENCIONAL: "bg-blue-100 text-blue-700",
  SEXADO_FEMEA: "bg-pink-100 text-pink-700",
};
const USO_CLS: Record<string, string> = {
  FIV:  "bg-violet-100 text-violet-700",
  IATF: "bg-amber-100  text-amber-700",
};

function formatBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function hojeISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function SemenUI({ estoque, touros, doadoras, usos, erro }: Props) {
  const [adicionando, setAdicionando] = useState(false);

  // Stats globais
  const totalDoses        = estoque.reduce((acc, r) => acc + (r.doses ?? 0), 0);
  const totalConvencional = estoque.filter(r => r.tipo === "CONVENCIONAL").reduce((acc, r) => acc + (r.doses ?? 0), 0);
  const totalSexado       = estoque.filter(r => r.tipo === "SEXADO_FEMEA").reduce((acc, r) => acc + (r.doses ?? 0), 0);
  const valorTotal        = estoque.reduce((acc, r) => acc + ((r.valor_por_dose ?? 0) * (r.doses ?? 0)), 0);

  // Mapa loteId → usos
  const usosPorLote = useMemo(() => {
    const map = new Map<string, UsoRow[]>();
    for (const u of usos) {
      if (!map.has(u.semen_stock_id)) map.set(u.semen_stock_id, []);
      map.get(u.semen_stock_id)!.push(u);
    }
    return map;
  }, [usos]);

  // Agrupa por touro
  const grupos = useMemo(() => {
    const map = new Map<string, { touro_nome: string; touro_rgn: string | null; itens: SemenRow[] }>();
    for (const r of estoque) {
      const k = `${r.touro_nome}|${r.touro_rgn ?? ""}`;
      if (!map.has(k)) map.set(k, { touro_nome: r.touro_nome, touro_rgn: r.touro_rgn, itens: [] });
      map.get(k)!.itens.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.touro_nome.localeCompare(b.touro_nome));
  }, [estoque]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estoque de Sêmen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Doses por touro · entradas e saídas</p>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Erro ao carregar dados: {erro}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total de Doses"   value={totalDoses}        Icon={Droplet}    color="text-violet-600" />
        <StatCard label="Convencional"     value={totalConvencional} Icon={Snowflake}  color="text-blue-600"   />
        <StatCard label="Sexado ♀"         value={totalSexado}       Icon={Snowflake}  color="text-pink-600"   />
        <StatCard label="Valor em Estoque" value={formatBRL(valorTotal)} Icon={DollarSign} color="text-green-600" />
      </div>

      {/* Botão adicionar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setAdicionando(true)}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Sêmen
        </button>
        <p className="text-xs text-gray-400">Registre uma nova entrada de doses no estoque.</p>
      </div>

      {adicionando && (
        <NovoSemenForm touros={touros} onClose={() => setAdicionando(false)} />
      )}

      {/* Lista agrupada por touro */}
      {grupos.length === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">Nenhuma dose registrada ainda.</p>
      ) : (
        <div className="space-y-4">
          {grupos.map((g, idx) => (
            <TouroCard
              key={`${g.touro_nome}-${idx}`}
              grupo={g}
              usosPorLote={usosPorLote}
              doadoras={doadoras}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, color }: { label: string; value: number | string; Icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-gray-50 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ── Card do touro com seus lotes ─────────────────────────────────────────────
function TouroCard({
  grupo, usosPorLote, doadoras,
}: {
  grupo: { touro_nome: string; touro_rgn: string | null; itens: SemenRow[] };
  usosPorLote: Map<string, UsoRow[]>;
  doadoras: DoadoraOpt[];
}) {
  const totalDoses = grupo.itens.reduce((acc, r) => acc + (r.doses ?? 0), 0);
  const totalValor = grupo.itens.reduce((acc, r) => acc + ((r.valor_por_dose ?? 0) * (r.doses ?? 0)), 0);
  const totalUsos  = grupo.itens.reduce((acc, r) => acc + ((usosPorLote.get(r.id) ?? []).reduce((s, u) => s + (u.doses_usadas ?? 0), 0)), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{grupo.touro_nome}</p>
          {grupo.touro_rgn && (
            <p className="text-[11px] text-gray-500 font-mono">RGN {grupo.touro_rgn}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-right shrink-0">
          <div className="text-center">
            <p className="text-[10px] text-gray-400 uppercase">Em estoque</p>
            <p className="text-sm font-bold text-violet-600">{totalDoses}</p>
          </div>
          {totalUsos > 0 && (
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase">Já usadas</p>
              <p className="text-sm font-bold text-amber-600">{totalUsos}</p>
            </div>
          )}
          {totalValor > 0 && (
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase">Valor</p>
              <p className="text-sm font-bold text-green-600">{formatBRL(totalValor)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {grupo.itens.map(item => (
          <SemenRowItem
            key={item.id}
            item={item}
            usos={usosPorLote.get(item.id) ?? []}
            doadoras={doadoras}
          />
        ))}
      </div>
    </div>
  );
}

// ── Linha de um lote (com edição, saída e histórico) ─────────────────────────
function SemenRowItem({ item, usos, doadoras }: { item: SemenRow; usos: UsoRow[]; doadoras: DoadoraOpt[] }) {
  const [editando, setEditando]       = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);
  const [usando, setUsando]           = useState(false);
  const [histOpen, setHistOpen]       = useState(false);
  const [pending, startTransition]    = useTransition();
  const [erro, setErro]               = useState<string | null>(null);
  const router = useRouter();

  const [form, setForm] = useState({
    doses:               String(item.doses ?? 0),
    tipo:                item.tipo,
    local_armazenamento: item.local_armazenamento ?? "",
    valor_por_dose:      item.valor_por_dose != null ? String(item.valor_por_dose) : "",
    observacoes:         item.observacoes ?? "",
  });

  function salvar() {
    setErro(null);
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("doses", form.doses);
    fd.set("tipo", form.tipo);
    fd.set("local_armazenamento", form.local_armazenamento);
    fd.set("valor_por_dose", form.valor_por_dose);
    fd.set("observacoes", form.observacoes);
    startTransition(async () => {
      const res = await atualizarSemen(fd);
      if (res.ok) { setEditando(false); router.refresh(); }
      else setErro(res.erro ?? "Erro ao salvar");
    });
  }

  function excluir() {
    setErro(null);
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(async () => {
      const res = await excluirSemen(fd);
      if (res.ok) router.refresh();
      else { setErro(res.erro ?? "Erro ao excluir"); setConfirmDel(false); }
    });
  }

  const valorTotal = (item.valor_por_dose ?? 0) * (item.doses ?? 0);
  const totalUsadas = usos.reduce((s, u) => s + (u.doses_usadas ?? 0), 0);

  if (editando) {
    return (
      <div className="px-5 py-3 bg-violet-50/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <Field label="Doses" type="number" value={form.doses}
            onChange={v => setForm(f => ({ ...f, doses: v }))} />
          <label className="flex flex-col">
            <span className="text-[10px] font-semibold text-gray-500 uppercase">Tipo</span>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}
              className="mt-0.5 border border-violet-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              <option value="CONVENCIONAL">Convencional</option>
              <option value="SEXADO_FEMEA">Sexado ♀</option>
            </select>
          </label>
          <Field label="Local Armazenamento" value={form.local_armazenamento}
            onChange={v => setForm(f => ({ ...f, local_armazenamento: v }))} />
          <Field label="Valor por dose (R$)" type="number" step="0.01" value={form.valor_por_dose}
            onChange={v => setForm(f => ({ ...f, valor_por_dose: v }))} />
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
          <button onClick={salvar} disabled={pending}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium disabled:opacity-50">
            <Check className="w-3.5 h-3.5" />
            {pending ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={() => { setEditando(false); setErro(null); }} disabled={pending}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs disabled:opacity-50">
            <X className="w-3.5 h-3.5" />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* Linha principal */}
      <div className="px-5 py-2.5 flex items-center gap-3 hover:bg-gray-50/60">
        <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold ${TIPO_CLS[item.tipo]}`}>
          {TIPO_LABEL[item.tipo]}
        </span>
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <Droplet className="w-3.5 h-3.5 text-violet-500" />
          <span className="font-bold">{item.doses}</span>
          <span className="text-xs text-gray-400">doses</span>
        </div>
        {item.local_armazenamento && (
          <div className="hidden md:flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{item.local_armazenamento}</span>
          </div>
        )}
        {item.valor_por_dose != null && (
          <div className="hidden md:flex items-center gap-1 text-xs text-gray-500">
            <DollarSign className="w-3 h-3" />
            <span>{formatBRL(item.valor_por_dose)}/dose · total {formatBRL(valorTotal)}</span>
          </div>
        )}
        {usos.length > 0 && (
          <button
            onClick={() => setHistOpen(o => !o)}
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-violet-700"
            title={`${usos.length} ${usos.length === 1 ? "saída" : "saídas"}`}
          >
            <History className="w-3 h-3" />
            <span>{usos.length} {usos.length === 1 ? "saída" : "saídas"} · {totalUsadas} doses</span>
            {histOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {confirmDel ? (
            <>
              <button onClick={excluir} disabled={pending}
                className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[11px] font-medium disabled:opacity-50">
                {pending ? "..." : "Sim, excluir"}
              </button>
              <button onClick={() => setConfirmDel(false)} disabled={pending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] disabled:opacity-50">
                Não
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setUsando(o => !o)}
                disabled={item.doses <= 0}
                title={item.doses <= 0 ? "Sem doses em estoque" : "Registrar saída de doses"}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                <Syringe className="w-3 h-3" />
                Usar
              </button>
              <button onClick={() => setEditando(true)} title="Editar"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 text-[11px] font-medium">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => setConfirmDel(true)} title="Excluir"
                className="inline-flex items-center justify-center p-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {erro && (
        <div className="px-5 pb-2">
          <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded px-2 py-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {erro}
          </div>
        </div>
      )}

      {/* Formulário inline de saída */}
      {usando && (
        <UsoSemenForm
          loteId={item.id}
          dosesDisponiveis={item.doses}
          doadoras={doadoras}
          onClose={() => setUsando(false)}
        />
      )}

      {/* Histórico de saídas */}
      {histOpen && usos.length > 0 && (
        <div className="px-5 pb-3">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  {["Data", "Doses", "Uso", "Doadora", "Veterinário", "Quem retirou", "Obs.", ""].map(h => (
                    <th key={h} className="px-2.5 py-1.5 text-[10px] font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usos.map(u => (
                  <UsoRowItem key={u.id} uso={u} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linha de uma saída (com excluir) ─────────────────────────────────────────
function UsoRowItem({ uso }: { uso: UsoRow }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  function excluir() {
    setErro(null);
    const fd = new FormData();
    fd.set("id", uso.id);
    startTransition(async () => {
      const res = await excluirUsoSemen(fd);
      if (res.ok) router.refresh();
      else { setErro(res.erro ?? "Erro ao excluir"); setConfirm(false); }
    });
  }

  return (
    <tr className="hover:bg-gray-50/60">
      <td className="px-2.5 py-1.5 whitespace-nowrap text-gray-700">{formatDate(uso.data_saida)}</td>
      <td className="px-2.5 py-1.5 font-semibold text-violet-700">{uso.doses_usadas}</td>
      <td className="px-2.5 py-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${USO_CLS[uso.tipo_uso]}`}>
          {uso.tipo_uso}
        </span>
      </td>
      <td className="px-2.5 py-1.5 text-gray-700">{uso.doadora_nome ?? <span className="text-gray-300">—</span>}</td>
      <td className="px-2.5 py-1.5 text-gray-500">{uso.veterinario ?? <span className="text-gray-300">—</span>}</td>
      <td className="px-2.5 py-1.5 text-gray-500">{uso.usuario_nome ?? <span className="text-gray-300">—</span>}</td>
      <td className="px-2.5 py-1.5 text-gray-400 italic truncate max-w-xs">{uso.observacoes ?? ""}</td>
      <td className="px-2.5 py-1.5 text-right">
        {erro && <span className="text-[10px] text-red-600 mr-2">{erro}</span>}
        {confirm ? (
          <span className="inline-flex items-center gap-1">
            <button onClick={excluir} disabled={pending}
              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-medium disabled:opacity-50">
              {pending ? "..." : "Excluir"}
            </button>
            <button onClick={() => setConfirm(false)} disabled={pending}
              className="px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 text-[10px] disabled:opacity-50">
              Não
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirm(true)} title="Excluir saída (devolve doses ao estoque)"
            className="inline-flex items-center justify-center p-0.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Formulário de saída ──────────────────────────────────────────────────────
function UsoSemenForm({
  loteId, dosesDisponiveis, doadoras, onClose,
}: {
  loteId: string;
  dosesDisponiveis: number;
  doadoras: DoadoraOpt[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  const [form, setForm] = useState({
    data_saida:    hojeISO(),
    doses_usadas:  "1",
    tipo_uso:      "FIV" as "FIV" | "IATF",
    doadora_id:    "",
    doadora_nome:  "",
    veterinario:   "",
    usuario_nome:  "",
    observacoes:   "",
  });

  function selectDoadora(id: string) {
    const d = doadoras.find(x => x.id === id);
    setForm(f => ({ ...f, doadora_id: id, doadora_nome: d?.nome ?? f.doadora_nome }));
  }

  function salvar() {
    setErro(null);
    const n = parseInt(form.doses_usadas, 10);
    if (isNaN(n) || n <= 0) { setErro("Quantidade de doses inválida"); return; }
    if (n > dosesDisponiveis) { setErro(`Estoque insuficiente — disponível: ${dosesDisponiveis}`); return; }

    const fd = new FormData();
    fd.set("semen_stock_id", loteId);
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    startTransition(async () => {
      const res = await registrarUsoSemen(fd);
      if (res.ok) { router.refresh(); onClose(); }
      else setErro(res.erro ?? "Erro ao salvar");
    });
  }

  return (
    <div className="px-5 py-3 bg-green-50/60 border-t border-green-100">
      <p className="text-[11px] font-semibold text-green-800 uppercase mb-2 flex items-center gap-1.5">
        <Syringe className="w-3.5 h-3.5" />
        Registrar saída ({dosesDisponiveis} disponíveis)
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        <Field label="Data Saída" type="date" value={form.data_saida}
          onChange={v => setForm(f => ({ ...f, data_saida: v }))} />
        <Field label="Doses" type="number" value={form.doses_usadas}
          onChange={v => setForm(f => ({ ...f, doses_usadas: v }))} />
        <label className="flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase">Tipo de uso</span>
          <select
            value={form.tipo_uso}
            onChange={e => setForm(f => ({ ...f, tipo_uso: e.target.value as any }))}
            className="mt-0.5 border border-green-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="FIV">FIV</option>
            <option value="IATF">IATF</option>
          </select>
        </label>
        <Field label="Veterinário" value={form.veterinario}
          onChange={v => setForm(f => ({ ...f, veterinario: v }))} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <label className="flex flex-col md:col-span-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase">Doadora</span>
          <select
            value={form.doadora_id}
            onChange={e => selectDoadora(e.target.value)}
            className="mt-0.5 border border-green-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">— Digitar manualmente —</option>
            {doadoras.map(d => (
              <option key={d.id} value={d.id}>
                {d.nome}{d.rgn ? ` · ${d.rgn}` : ""}{d.brinco ? ` (${d.brinco})` : ""}
              </option>
            ))}
          </select>
        </label>
        {!form.doadora_id && (
          <Field label="Nome doadora (livre)" value={form.doadora_nome}
            onChange={v => setForm(f => ({ ...f, doadora_nome: v }))} />
        )}
        <Field label="Quem retirou" value={form.usuario_nome}
          onChange={v => setForm(f => ({ ...f, usuario_nome: v }))} />
      </div>

      <div className="mb-2">
        <label className="text-[10px] font-semibold text-gray-500 uppercase">Observações</label>
        <textarea
          value={form.observacoes}
          onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
          rows={2}
          className="w-full mt-0.5 border border-green-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {erro && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mb-2">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {erro}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={salvar} disabled={pending}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-semibold disabled:opacity-50">
          <Check className="w-3.5 h-3.5" />
          {pending ? "Salvando..." : "Confirmar saída"}
        </button>
        <button onClick={onClose} disabled={pending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs disabled:opacity-50">
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Formulário de entrada (criar lote) ───────────────────────────────────────
function NovoSemenForm({ touros, onClose }: { touros: TouroOpt[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  const [form, setForm] = useState({
    touro_id:            "",
    touro_nome:          "",
    touro_rgn:           "",
    doses:               "",
    tipo:                "CONVENCIONAL",
    local_armazenamento: "",
    valor_por_dose:      "",
    observacoes:         "",
  });

  function selectTouro(id: string) {
    const t = touros.find(x => x.id === id);
    setForm(f => ({
      ...f,
      touro_id:   id,
      touro_nome: t?.nome   ?? f.touro_nome,
      touro_rgn:  t?.rgn    ?? f.touro_rgn,
    }));
  }

  function salvar() {
    setErro(null);
    if (!form.touro_nome.trim()) { setErro("Informe o nome do touro"); return; }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    startTransition(async () => {
      const res = await criarSemen(fd);
      if (res.ok) { router.refresh(); onClose(); }
      else setErro(res.erro ?? "Erro ao salvar");
    });
  }

  return (
    <div className="bg-white rounded-xl border border-violet-200 shadow-sm p-4">
      <p className="text-[11px] font-semibold text-violet-700 uppercase mb-3">Nova entrada de sêmen</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <label className="flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase">Touro (do rebanho)</span>
          <select
            value={form.touro_id}
            onChange={e => selectTouro(e.target.value)}
            className="mt-0.5 border border-gray-300 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          >
            <option value="">— Digitar manualmente —</option>
            {touros.map(t => (
              <option key={t.id} value={t.id}>
                {t.nome}{t.rgn ? ` · ${t.rgn}` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nome do touro" value={form.touro_nome}
            onChange={v => setForm(f => ({ ...f, touro_nome: v }))} />
          <Field label="RGN" value={form.touro_rgn}
            onChange={v => setForm(f => ({ ...f, touro_rgn: v }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Field label="Doses" type="number" value={form.doses}
          onChange={v => setForm(f => ({ ...f, doses: v }))} />
        <label className="flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase">Tipo</span>
          <select
            value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
            className="mt-0.5 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          >
            <option value="CONVENCIONAL">Convencional</option>
            <option value="SEXADO_FEMEA">Sexado ♀</option>
          </select>
        </label>
        <Field label="Local Armazenamento" value={form.local_armazenamento}
          onChange={v => setForm(f => ({ ...f, local_armazenamento: v }))} />
        <Field label="Valor por dose (R$)" type="number" step="0.01" value={form.valor_por_dose}
          onChange={v => setForm(f => ({ ...f, valor_por_dose: v }))} />
      </div>

      <div className="mb-3">
        <label className="text-[10px] font-semibold text-gray-500 uppercase">Observações</label>
        <textarea
          value={form.observacoes}
          onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
          rows={2}
          className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
      </div>

      {erro && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {erro}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={salvar} disabled={pending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-semibold disabled:opacity-50">
          <Check className="w-3.5 h-3.5" />
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={onClose} disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs disabled:opacity-50">
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
        className="mt-0.5 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
      />
    </label>
  );
}
