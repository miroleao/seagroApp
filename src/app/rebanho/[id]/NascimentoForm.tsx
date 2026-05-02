"use client";

import { useRef, useState, useTransition } from "react";
import { Baby, X, Loader2 } from "lucide-react";
import { registrarNascimento } from "./actions";

export function NascimentoForm({
  receptoraId,
  transferId,
  previsaoParto,
  doadoraNome,
  touroNome,
}: {
  receptoraId:   string;
  transferId:    string;
  previsaoParto: string | null;
  doadoraNome:   string | null;
  touroNome:     string | null;
}) {
  const [open, setOpen]    = useState(false);
  const [erro, setErro]    = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(formRef.current!);
    start(async () => {
      try {
        await registrarNascimento(fd);
        // redirect é feito na action
      } catch (err: any) {
        // next/navigation redirect throws — ignoramos
        if (!String(err).includes("NEXT_REDIRECT")) setErro(String(err));
      }
    });
  }

  const hoje = new Date().toISOString().split("T")[0];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">
        <Baby className="w-4 h-4" /> Registrar Nascimento
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-green-50">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-gray-900">Registrar Nascimento</h3>
          </div>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info do embrião */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 space-y-0.5">
          {doadoraNome && <p>🐄 Doadora: <strong>{doadoraNome}</strong></p>}
          {touroNome   && <p>🐂 Touro: <strong>{touroNome}</strong></p>}
          {previsaoParto && <p>📅 Previsão: <strong>{previsaoParto}</strong></p>}
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <input type="hidden" name="receptora_id" value={receptoraId} />
          <input type="hidden" name="transfer_id"  value={transferId}  />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Data do Nascimento *</label>
              <input name="data_nascimento" type="date" defaultValue={hoje} required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sexo do Bezerro *</label>
              <select name="sexo_nascido" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-300">
                <option value="F">Fêmea</option>
                <option value="M">Macho</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Peso ao Nascer (kg)</label>
              <input name="peso_nascimento" type="number" step="0.1" placeholder="Ex: 32"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Observações</label>
            <textarea name="obs_nascimento" rows={2} placeholder="Ex: Parto normal, bezerro vigoroso…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300" />
          </div>

          {erro && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 text-sm border border-gray-200 rounded-lg py-2 hover:bg-gray-50 text-gray-600 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Baby className="w-4 h-4" />}
              {isPending ? "Salvando…" : "Confirmar Nascimento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
