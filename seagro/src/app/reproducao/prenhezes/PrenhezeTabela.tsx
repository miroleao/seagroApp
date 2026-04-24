"use client";

import { Fragment, useRef, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Baby, Pencil, Check, X, AlertTriangle, Skull, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  atualizarReceptoraBrinco,
  registrarDesfecho,
  registrarNascimento,
} from "./actions";
import { excluirPrenhez } from "../actions";

export type PrenheZListRow = {
  aspId:           string;
  embryoId:        string | null;
  transferId:      string | null;
  receptoraId:     string | null;
  receptoraBrinco: string | null;
  doadoraNome:     string | null;
  touroNome:       string | null;
  dataParto:       string | null;
  vendedor:        string | null;
  dataCompra:      string | null;
  dataEntrega:     string | null;
  resultado:       string | null;   // NASCIMENTO | ABORTO | OBITO_RECEPTORA
  dataResultado:   string | null;
};

// ── Célula com lock (texto) ───────────────────────────────────────────────────
function LockCell({
  action, hiddenFields, fieldName, initialValue, placeholder, width = "w-24", inputType = "text",
}: {
  action:        (fd: FormData) => Promise<void>;
  hiddenFields:  [string, string | null][];
  fieldName:     string;
  initialValue:  string | null;
  placeholder?:  string;
  width?:        string;
  inputType?:    string;
}) {
  const [editing, setEditing] = useState(!initialValue);
  const [saved, setSaved]     = useState(initialValue);
  const formRef  = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(value: string) {
    const trimmed = value.trim() || null;
    setSaved(trimmed);
    setEditing(false);
    formRef.current?.requestSubmit();
  }

  const displayValue = saved
    ? inputType === "date"
      ? formatDate(saved)
      : saved
    : null;

  if (!editing) {
    return (
      <div className="group flex items-center gap-1 min-w-0">
        <span className={`text-sm truncate ${saved ? "text-gray-800" : "text-gray-400"}`}>
          {displayValue ?? "—"}
        </span>
        <button
          type="button"
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 10); }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-brand-600 transition-all shrink-0"
          title="Editar"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <form ref={formRef} action={action} className="hidden">
          {hiddenFields.map(([n, v]) => v ? <input key={n} type="hidden" name={n} value={v} /> : null)}
          <input type="hidden" name={fieldName} value={saved ?? ""} />
        </form>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="flex items-center gap-1"
      onSubmit={() => { setSaved(inputRef.current?.value.trim() || null); setEditing(false); }}
    >
      {hiddenFields.map(([n, v]) => v ? <input key={n} type="hidden" name={n} value={v} /> : null)}
      <input
        ref={inputRef}
        name={fieldName}
        type={inputType}
        defaultValue={saved ?? ""}
        placeholder={placeholder}
        autoFocus
        className={`${width} border border-brand-400 bg-white rounded px-2 py-1 text-sm outline-none ring-1 ring-brand-200`}
        onBlur={(e)    => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { e.preventDefault(); commit((e.target as HTMLInputElement).value); }
          if (e.key === "Escape") { setEditing(false); }
        }}
      />
      <button type="button" onClick={() => commit(inputRef.current?.value ?? "")}
        className="text-brand-600 hover:text-brand-800 shrink-0">
        <Check className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

// ── Badge de resultado ────────────────────────────────────────────────────────
function ResultadoBadge({ resultado, dataResultado }: { resultado: string; dataResultado: string | null }) {
  if (resultado === "NASCIMENTO")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <Baby className="w-3 h-3" /> Nascido{dataResultado ? ` ${formatDate(dataResultado)}` : ""}
      </span>
    );
  if (resultado === "ABORTO")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        <AlertTriangle className="w-3 h-3" /> Aborto{dataResultado ? ` ${formatDate(dataResultado)}` : ""}
      </span>
    );
  if (resultado === "OBITO_RECEPTORA")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <Skull className="w-3 h-3" /> Óbito Rec.{dataResultado ? ` ${formatDate(dataResultado)}` : ""}
      </span>
    );
  return null;
}

// ── Form de Desfecho (inline) ─────────────────────────────────────────────────
function DesfechoForm({ row, onClose }: { row: PrenheZListRow; onClose: () => void }) {
  const [tipo, setTipo] = useState<"NASCIMENTO" | "ABORTO" | "OBITO_RECEPTORA">("NASCIMENTO");

  const opcoes = [
    { value: "NASCIMENTO"      as const, label: "Nascimento",          icon: <Baby className="w-3.5 h-3.5" />,          cls: "border-green-300 text-green-700 bg-green-50 ring-green-400"  },
    { value: "ABORTO"          as const, label: "Aborto",              icon: <AlertTriangle className="w-3.5 h-3.5" />,  cls: "border-orange-300 text-orange-700 bg-orange-50 ring-orange-400" },
    { value: "OBITO_RECEPTORA" as const, label: "Óbito da Receptora",  icon: <Skull className="w-3.5 h-3.5" />,          cls: "border-red-300 text-red-700 bg-red-50 ring-red-400"           },
  ];

  const sexoDefault = "F";

  return (
    <tr className="bg-gray-50/80 border-t border-gray-200">
      <td colSpan={6} className="px-4 py-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-700">
              Registrar desfecho{row.doadoraNome ? ` — ${row.doadoraNome}` : ""}
            </p>
            <button type="button" onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tipo selector */}
          <div className="flex flex-wrap gap-2">
            {opcoes.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setTipo(o.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  tipo === o.value ? `${o.cls} ring-1` : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"
                }`}
              >
                {o.icon} {o.label}
              </button>
            ))}
          </div>

          {/* Formulário de nascimento */}
          {tipo === "NASCIMENTO" && (
            <form action={registrarNascimento} className="space-y-3">
              <input type="hidden" name="asp_id"       value={row.aspId} />
              <input type="hidden" name="doadora_nome" value={row.doadoraNome ?? ""} />
              <input type="hidden" name="touro_nome"   value={row.touroNome   ?? ""} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Nome do animal <span className="text-red-500">*</span></label>
                  <input name="nome" type="text" required placeholder="Ex: SE FILHA DA KARINA"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data de nascimento <span className="text-red-500">*</span></label>
                  <input name="nascimento" type="date" required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Sexo <span className="text-red-500">*</span></label>
                  <select name="sexo" required defaultValue={sexoDefault}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white">
                    <option value="F">♀ Fêmea</option>
                    <option value="M">♂ Macho</option>
                  </select>
                </div>
              </div>
              <button type="submit"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                <Baby className="w-3.5 h-3.5" /> Salvar e abrir ficha do animal
              </button>
            </form>
          )}

          {/* Formulário de aborto / óbito */}
          {(tipo === "ABORTO" || tipo === "OBITO_RECEPTORA") && (
            <form action={registrarDesfecho} className="flex items-end gap-3">
              <input type="hidden" name="asp_id"    value={row.aspId} />
              <input type="hidden" name="resultado" value={tipo} />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {tipo === "ABORTO" ? "Data do aborto" : "Data do óbito"} <span className="text-red-500">*</span>
                </label>
                <input name="data_resultado" type="date" required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
              </div>
              <button type="submit"
                className={`inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                  tipo === "ABORTO"
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}>
                Salvar
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Botão excluir prenhez ─────────────────────────────────────────────────────
function BotaoExcluirPrenhez({ row }: { row: PrenheZListRow }) {
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro]           = useState<string | null>(null);
  const formRef                   = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const router                    = useRouter();

  function handleExcluir() {
    setErro(null);
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const res = await excluirPrenhez(fd);
      if (res.ok) { setConfirmar(false); router.refresh(); }
      else setErro(res.erro ?? "Erro ao excluir");
    });
  }

  if (confirmar) {
    return (
      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
        <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
        <span className="text-xs text-red-700 font-medium">Excluir?</span>
        <form ref={formRef} className="hidden">
          <input type="hidden" name="asp_id"       value={row.aspId} />
          <input type="hidden" name="receptora_id" value={row.receptoraId ?? ""} />
        </form>
        <button onClick={handleExcluir} disabled={pending}
          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium disabled:opacity-50">
          {pending ? "..." : "Sim"}
        </button>
        <button onClick={() => { setConfirmar(false); setErro(null); }} disabled={pending}
          className="text-xs text-gray-500 hover:text-gray-700">Não</button>
        {erro && <span className="text-red-500 text-[10px]">{erro}</span>}
      </div>
    );
  }

  return (
    <button onClick={() => setConfirmar(true)} title="Excluir prenhez"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 text-xs font-medium transition-colors">
      <Trash2 className="w-3.5 h-3.5" />
      Excluir
    </button>
  );
}

// ── Tabela principal ──────────────────────────────────────────────────────────
export default function PrenhezeTabela({ rows }: { rows: PrenheZListRow[] }) {
  const [desfechoRowId, setDesfechoRowId] = useState<string | null>(null);

  const colunas = ["Doadora", "Touro", "No Brinco", "Prev. Parto", "Vendedor", "Desfecho", ""];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left min-w-[900px]">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {colunas.map((h) => (
              <th key={h} className="py-2.5 px-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.aspId}>
              <tr className={`border-b border-gray-50 transition-colors ${desfechoRowId === r.aspId ? "bg-gray-50/60" : "hover:bg-gray-50/50"}`}>

                {/* Doadora */}
                <td className="py-2.5 px-3">
                  <Link href={`/reproducao/prenhezes/${r.aspId}`}
                    className="font-medium text-brand-700 hover:text-brand-900 hover:underline whitespace-nowrap">
                    {r.doadoraNome ?? "—"}
                  </Link>
                </td>

                {/* Touro */}
                <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{r.touroNome ?? "—"}</td>

                {/* Nº Receptora */}
                <td className="py-2.5 px-3">
                  <LockCell
                    action={atualizarReceptoraBrinco}
                    hiddenFields={[["animal_id", r.receptoraId], ["transfer_id", r.transferId]]}
                    fieldName="brinco"
                    initialValue={r.receptoraBrinco}
                    placeholder="Nº brinco"
                    width="w-24"
                  />
                </td>

                {/* Prev. Parto */}
                <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                  {r.dataParto ? formatDate(r.dataParto) : "—"}
                </td>

                {/* Vendedor */}
                <td className="py-2.5 px-3 text-gray-600">{r.vendedor ?? "—"}</td>

                {/* Desfecho */}
                <td className="py-2.5 px-3">
                  {r.resultado ? (
                    <ResultadoBadge resultado={r.resultado} dataResultado={r.dataResultado} />
                  ) : desfechoRowId === r.aspId ? (
                    <button onClick={() => setDesfechoRowId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600">Fechar</button>
                  ) : (
                    <button
                      onClick={() => setDesfechoRowId(r.aspId)}
                      className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded px-2 py-1 whitespace-nowrap transition-colors"
                    >
                      <Baby className="w-3 h-3" /> Registrar
                    </button>
                  )}
                </td>

                {/* Excluir */}
                <td className="py-2.5 px-3">
                  <BotaoExcluirPrenhez row={r} />
                </td>
              </tr>

              {desfechoRowId === r.aspId && !r.resultado && (
                <DesfechoForm row={r} onClose={() => setDesfechoRowId(null)} />
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
