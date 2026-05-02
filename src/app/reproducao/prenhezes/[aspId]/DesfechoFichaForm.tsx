"use client";

import { useState } from "react";
import { Baby, AlertTriangle, Skull } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { registrarNascimento, registrarDesfecho } from "../actions";

type Props = {
  aspId:        string;
  doadoraNome:  string | null;
  touroNome:    string | null;
  sexoDefault:  string;          // "F" | "M" | ""
  resultado:    string | null;   // NASCIMENTO | ABORTO | OBITO_RECEPTORA | null
  dataResultado: string | null;
};

const opcoes = [
  {
    value: "NASCIMENTO"       as const,
    label: "Nascimento",
    icon:  <Baby className="w-3.5 h-3.5" />,
    ring:  "ring-green-400",
    active: "border-green-300 text-green-700 bg-green-50",
  },
  {
    value: "ABORTO"           as const,
    label: "Aborto",
    icon:  <AlertTriangle className="w-3.5 h-3.5" />,
    ring:  "ring-orange-400",
    active: "border-orange-300 text-orange-700 bg-orange-50",
  },
  {
    value: "OBITO_RECEPTORA"  as const,
    label: "Óbito da Receptora",
    icon:  <Skull className="w-3.5 h-3.5" />,
    ring:  "ring-red-400",
    active: "border-red-300 text-red-700 bg-red-50",
  },
] as const;

function ResultadoBadge({ resultado, dataResultado }: { resultado: string; dataResultado: string | null }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    NASCIMENTO:      { label: "Nascimento registrado",    cls: "bg-green-100 text-green-700 border-green-200",  icon: <Baby className="w-4 h-4" /> },
    ABORTO:          { label: "Aborto registrado",        cls: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-4 h-4" /> },
    OBITO_RECEPTORA: { label: "Óbito da receptora",      cls: "bg-red-100 text-red-700 border-red-200",        icon: <Skull className="w-4 h-4" /> },
  };
  const info = map[resultado];
  if (!info) return null;
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${info.cls}`}>
      {info.icon}
      {info.label}
      {dataResultado && <span className="ml-1 font-normal opacity-80">— {formatDate(dataResultado)}</span>}
    </div>
  );
}

export default function DesfechoFichaForm({ aspId, doadoraNome, touroNome, sexoDefault, resultado, dataResultado }: Props) {
  const [tipo, setTipo] = useState<"NASCIMENTO" | "ABORTO" | "OBITO_RECEPTORA">("NASCIMENTO");

  // Se já tem resultado registrado, mostra só o badge
  if (resultado) {
    return (
      <section className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Baby className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Desfecho</h2>
        </div>
        <div className="p-5">
          <ResultadoBadge resultado={resultado} dataResultado={dataResultado} />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/60">
        <Baby className="w-4 h-4 text-brand-600" />
        <h2 className="text-sm font-semibold text-gray-700">Registrar Desfecho</h2>
      </div>
      <div className="p-5 space-y-5">

        {/* Linha pai / mãe */}
        {(doadoraNome || touroNome) && (
          <p className="text-xs text-gray-500">
            {touroNome  && <span>Pai: <strong>{touroNome}</strong></span>}
            {touroNome && doadoraNome && <span className="mx-2">·</span>}
            {doadoraNome && <span>Mãe: <strong>{doadoraNome}</strong></span>}
          </p>
        )}

        {/* Seletor de tipo */}
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setTipo(o.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                tipo === o.value
                  ? `${o.active} ring-1 ${o.ring}`
                  : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"
              }`}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>

        {/* Form: Nascimento */}
        {tipo === "NASCIMENTO" && (
          <form action={registrarNascimento} className="space-y-4">
            <input type="hidden" name="asp_id"       value={aspId} />
            <input type="hidden" name="doadora_nome" value={doadoraNome ?? ""} />
            <input type="hidden" name="touro_nome"   value={touroNome   ?? ""} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
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
                <select name="sexo" required defaultValue={sexoDefault || "F"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white">
                  <option value="F">♀ Fêmea</option>
                  <option value="M">♂ Macho</option>
                </select>
              </div>
            </div>

            <button type="submit"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              <Baby className="w-3.5 h-3.5" /> Salvar e abrir ficha do animal
            </button>
          </form>
        )}

        {/* Form: Aborto / Óbito */}
        {(tipo === "ABORTO" || tipo === "OBITO_RECEPTORA") && (
          <form action={registrarDesfecho} className="flex items-end gap-3">
            <input type="hidden" name="asp_id"    value={aspId} />
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
              className={`inline-flex items-center gap-2 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors ${
                tipo === "ABORTO" ? "bg-orange-500 hover:bg-orange-600" : "bg-red-600 hover:bg-red-700"
              }`}>
              Salvar desfecho
            </button>
          </form>
        )}

      </div>
    </section>
  );
}
