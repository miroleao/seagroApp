"use client";

import { useState, useTransition } from "react";
import { LinkIcon, X } from "lucide-react";
import { vincularFilhoteParida } from "./actions";

interface Props {
  doadoraId: string;
  animaisDisponiveis: { id: string; nome: string; tipo: string }[];
}

export function VincularFilhoteParida({ doadoraId, animaisDisponiveis }: Props) {
  const [aberto, setAberto]         = useState(false);
  const [busca, setBusca]           = useState("");
  const [selecionado, setSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [pending, startTransition]  = useTransition();

  const filtrados = busca.length >= 2
    ? animaisDisponiveis
        .filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
        .slice(0, 8)
    : [];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selecionado) return;
    const fd = new FormData();
    fd.append("doadora_id", doadoraId);
    fd.append("animal_id",  selecionado.id);
    startTransition(() => vincularFilhoteParida(fd));
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-2.5 py-1.5 transition-colors font-medium"
      >
        <LinkIcon className="w-3 h-3" />
        Vincular bezerro(a)
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 space-y-2 bg-white border border-brand-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-700">Vincular bezerro(a) nascido</p>
        <button type="button" onClick={() => { setAberto(false); setBusca(""); setSelecionado(null); }}
          className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {selecionado ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded px-2 py-1 font-medium">
            {selecionado.tipo === "TOURO" ? "🐂" : "🐄"} {selecionado.nome}
          </span>
          <button type="button" onClick={() => setSelecionado(null)}
            className="text-gray-400 hover:text-gray-600 shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Digite o nome do animal…"
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            autoComplete="off"
          />
          {filtrados.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
              {filtrados.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setSelecionado({ id: a.id, nome: a.nome }); setBusca(""); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 transition-colors flex items-center gap-2"
                >
                  <span>{a.tipo === "TOURO" ? "🐂" : "🐄"}</span>
                  <span className="font-medium text-gray-800">{a.nome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!selecionado || pending}
        className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Vinculando…" : "Confirmar vínculo"}
      </button>
    </form>
  );
}
