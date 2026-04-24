"use client";

import { useTransition, useState } from "react";
import { Pencil } from "lucide-react";
import { editarTransacao } from "./actions";

interface Props {
  txId: string;
  animalNome: string;
  contraparte: string;
  valorTotal: number;
  nParcelas: number;
  data: string;
  observacoes: string;
}

export default function BotaoEditarTransacao({
  txId,
  animalNome,
  contraparte,
  valorTotal,
  nParcelas,
  data,
  observacoes,
}: Props) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await editarTransacao(fd);
      if (res.ok) {
        setOpen(false);
      } else {
        setErro(res.erro ?? "Erro ao salvar");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300 text-xs font-medium transition-colors"
        title="Editar transação"
      >
        <Pencil className="w-3.5 h-3.5" />
        Editar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Editar Transação</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="hidden" name="tx_id" value={txId} />

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Animal</label>
                <input
                  name="animal_nome"
                  defaultValue={animalNome}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Comprador / Vendedor</label>
                <input
                  name="contraparte"
                  defaultValue={contraparte}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor Total (R$)</label>
                  <input
                    name="valor_total"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={valorTotal}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nº de Parcelas</label>
                  <input
                    name="n_parcelas"
                    type="number"
                    min="1"
                    required
                    defaultValue={nParcelas}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input
                  name="data"
                  type="date"
                  defaultValue={data}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <textarea
                  name="observacoes"
                  defaultValue={observacoes}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
                />
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-60"
                >
                  {pending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
