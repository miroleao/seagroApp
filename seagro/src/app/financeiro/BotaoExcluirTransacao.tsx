"use client";

import { useTransition, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { excluirTransacao } from "./actions";

interface Props {
  txId: string;
  label: string;
}

export default function BotaoExcluirTransacao({ txId, label }: Props) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleExcluir() {
    setErro(null);
    const fd = new FormData();
    fd.append("tx_id", txId);
    startTransition(async () => {
      const res = await excluirTransacao(fd);
      if (res.ok) {
        setOpen(false);
      } else {
        setErro(res.erro ?? "Erro ao excluir");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 text-xs font-medium transition-colors"
        title="Excluir transação"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Excluir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Excluir transação?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium text-gray-700">{label}</span>
                  <br />
                  Todas as parcelas vinculadas também serão excluídas. Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>

            {erro && <p className="text-xs text-red-600 mb-3">{erro}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {pending ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
