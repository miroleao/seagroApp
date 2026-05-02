"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { registrarDesfecho } from "./actions";

interface Props {
  receptoraId:       string;
  transferId:        string | null;
  tipoDesfechoAtual: string | null;
}

const DESFECHOS = [
  { value: "PARIDA",          label: "🐄 Nascimento" },
  { value: "ABORTOU",         label: "⚠️ Aborto"     },
  { value: "REABSORVEU",      label: "🔄 Absorção"   },
  { value: "OBITO_RECEPTORA", label: "💀 Óbito"      },
];

const LABEL_MAP: Record<string, string> = {
  PARIDA:          "Nascimento",
  ABORTOU:         "Aborto",
  REABSORVEU:      "Absorção",
  OBITO_RECEPTORA: "Óbito",
};

export function DesfechoInline({ receptoraId, transferId, tipoDesfechoAtual }: Props) {
  const [open, setOpen] = useState(false);

  const jaRegistrado = !!tipoDesfechoAtual && tipoDesfechoAtual !== "POSITIVO";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={jaRegistrado ? `Desfecho: ${LABEL_MAP[tipoDesfechoAtual!] ?? tipoDesfechoAtual}` : "Registrar desfecho"}
        className={`p-1.5 rounded-md transition-colors ${
          open
            ? "bg-orange-100 text-orange-600"
            : jaRegistrado
            ? "text-orange-500 bg-orange-50 hover:bg-orange-100"
            : "text-gray-300 hover:text-orange-400 hover:bg-orange-50"
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Painel */}
          <div className="absolute right-0 top-8 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-800">Registrar Desfecho</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form action={registrarDesfecho} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="receptora_id" value={receptoraId} />
              {transferId && <input type="hidden" name="transfer_id" value={transferId} />}

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Desfecho
                  </label>
                  <select
                    name="tipo_desfecho"
                    required
                    defaultValue={tipoDesfechoAtual && tipoDesfechoAtual !== "POSITIVO" ? tipoDesfechoAtual : ""}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                  >
                    <option value="">— Selecione —</option>
                    {DESFECHOS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Data do Evento
                  </label>
                  <input
                    name="data_desfecho"
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-gray-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 text-xs bg-orange-500 text-white rounded-lg py-1.5 hover:bg-orange-600 font-medium transition-colors"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
