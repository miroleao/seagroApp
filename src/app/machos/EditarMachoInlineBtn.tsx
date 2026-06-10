"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { atualizarCamposMacho } from "./actions";

interface Props {
  id: string;
  nome: string;
  valorParcela: number | null;
  percentualProprio: number | null;
  localizacao: string | null;
  nascimento: string | null;
}

export function EditarMachoInlineBtn({
  id,
  nome,
  valorParcela,
  percentualProprio,
  localizacao,
  nascimento,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [isPending, start]    = useTransition();
  const [erro, setErro]       = useState<string | null>(null);

  const [parcela, setParcela] = useState(valorParcela?.toString() ?? "");
  const [perc, setPerc]       = useState(
    percentualProprio != null ? (percentualProprio * 100).toFixed(0) : ""
  );
  const [local, setLocal]     = useState(localizacao ?? "");
  const [nasc, setNasc]       = useState(nascimento ?? "");

  function handleSubmit() {
    setErro(null);
    const fd = new FormData();
    fd.append("id", id);
    fd.append("valor_parcela", parcela);
    fd.append("percentual_proprio", perc);
    fd.append("localizacao", local);
    fd.append("nascimento", nasc);

    start(async () => {
      const res = await atualizarCamposMacho(fd);
      if (res.ok) {
        setOpen(false);
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  return (
    <>
      {/* Botão lápis */}
      <button
        onClick={() => setOpen(true)}
        title={`Editar ${nome}`}
        className="text-gray-300 hover:text-brand-600 transition-colors p-1 rounded hover:bg-brand-50"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl p-5 w-80 space-y-4 mx-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-gray-900">Editar dados</p>
                <p className="text-xs text-gray-400 truncate max-w-[200px]">{nome}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Campos */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
                  Vl. Parcela (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={parcela}
                  onChange={(e) => setParcela(e.target.value)}
                  placeholder="Ex: 600.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
                  % Próprio
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={perc}
                    onChange={(e) => setPerc(e.target.value)}
                    placeholder="Ex: 100"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={nasc}
                  onChange={(e) => setNasc(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-500 uppercase tracking-wide mb-1 block">
                  Localização
                </label>
                <input
                  type="text"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Ex: Pasto 1, Curral A"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>

            {erro && <p className="text-xs text-red-600">{erro}</p>}

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Check className="w-4 h-4" />
                }
                Salvar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
