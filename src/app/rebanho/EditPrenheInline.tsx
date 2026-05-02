"use client";

import { useState } from "react";
import { Edit2, X } from "lucide-react";
import { vincularPrenhez } from "./actions";

interface Props {
  receptoraId:   string;
  brinco:        string;
  doadoraNome:   string | null;
  touroNome:     string | null;
  dataTe:        string | null;
  previsao:      string | null; // não usado no form — exibido como preview calculado
}

/** Preview da previsão de parto: data_te + 286 dias */
function previewParto(dataTe: string): string {
  const d = new Date(dataTe + "T12:00:00");
  d.setDate(d.getDate() + 286);
  return d.toLocaleDateString("pt-BR");
}

export function EditPrenheInline({
  receptoraId,
  brinco,
  doadoraNome,
  touroNome,
  dataTe,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dataTEValue, setDateTEValue] = useState(dataTe ?? "");

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Editar vínculo de prenhez"
        className={`p-1.5 rounded-md transition-colors ${
          open
            ? "bg-brand-100 text-brand-600"
            : "text-gray-300 hover:text-brand-500 hover:bg-brand-50"
        }`}
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          {/* Overlay transparente para fechar ao clicar fora */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Painel de edição */}
          <div className="absolute right-0 top-8 z-50 w-76 min-w-[288px] bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-800">
                Editar Prenhez — <span className="font-mono text-brand-700">{brinco}</span>
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form action={vincularPrenhez} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="receptora_id" value={receptoraId} />
              <input type="hidden" name="brinco" value={brinco} />

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Doadora
                  </label>
                  <input
                    name="doadora_nome"
                    defaultValue={doadoraNome ?? ""}
                    placeholder="Nome da doadora…"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Touro
                  </label>
                  <input
                    name="touro_nome"
                    defaultValue={touroNome ?? ""}
                    placeholder="Nome do touro…"
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                      Data T.E.
                    </label>
                    <input
                      name="data_te"
                      type="date"
                      value={dataTEValue}
                      onChange={e => setDateTEValue(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                      Prev. Parto
                    </label>
                    <p className="mt-1.5 text-xs font-mono text-green-700 font-semibold">
                      {dataTEValue
                        ? previewParto(dataTEValue)
                        : <span className="text-gray-300 font-normal">calculado auto</span>}
                    </p>
                    <p className="text-[9px] text-gray-400 leading-tight mt-0.5">data T.E. + 286 dias</p>
                  </div>
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
                  className="flex-1 text-xs bg-brand-600 text-white rounded-lg py-1.5 hover:bg-brand-700 font-medium transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
