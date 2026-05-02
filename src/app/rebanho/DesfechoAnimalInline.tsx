"use client";

import { useState } from "react";
import { UserMinus, X } from "lucide-react";
import { registrarDesfechoAnimal } from "./actions";

interface Props {
  animalId: string;
  brinco:   string;
}

export function DesfechoAnimalInline({ animalId, brinco }: Props) {
  const [open, setOpen]   = useState(false);
  const [tipo, setTipo]   = useState<"OBITO" | "VENDA" | "">("");

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Registrar óbito ou venda"
        className={`p-1.5 rounded-md transition-colors ${
          open
            ? "bg-red-100 text-red-600"
            : "text-gray-300 hover:text-red-400 hover:bg-red-50"
        }`}
      >
        <UserMinus className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Painel */}
          <div className="absolute right-0 top-8 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-800">
                Desfecho — <span className="font-mono text-red-600">{brinco}</span>
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form action={registrarDesfechoAnimal} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="animal_id" value={animalId} />

              <div className="space-y-3">
                {/* Tipo */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Tipo de Desfecho
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipo("OBITO")}
                      className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        tipo === "OBITO"
                          ? "bg-gray-800 text-white border-gray-800"
                          : "border-gray-200 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      💀 Óbito
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipo("VENDA")}
                      className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        tipo === "VENDA"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-200 text-gray-500 hover:border-blue-300"
                      }`}
                    >
                      💰 Venda
                    </button>
                  </div>
                  <input type="hidden" name="tipo" value={tipo} />
                </div>

                {/* Data */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Data
                  </label>
                  <input
                    name="data_evento"
                    type="date"
                    required
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                {/* Valor — só para venda */}
                {tipo === "VENDA" && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                      Valor de Venda (R$)
                    </label>
                    <input
                      name="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 4500,00"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                )}

                {/* Observações */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Observações
                  </label>
                  <input
                    name="observacoes"
                    type="text"
                    placeholder={tipo === "VENDA" ? "Comprador, leilão…" : "Causa, circunstâncias…"}
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
                  disabled={!tipo}
                  className={`flex-1 text-xs text-white rounded-lg py-1.5 font-medium transition-colors ${
                    tipo === "VENDA"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : tipo === "OBITO"
                      ? "bg-gray-800 hover:bg-gray-900"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
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
