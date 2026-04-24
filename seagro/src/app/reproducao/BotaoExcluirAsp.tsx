"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

interface Props {
  aspId: string;
  nomeDoadora: string;
}

export function BotaoExcluirAsp({ aspId, nomeDoadora }: Props) {
  const [confirmar, setConfirmar] = useState(false);
  const [pending,   setPending]   = useState(false);
  const [erro,      setErro]      = useState<string | null>(null);

  async function handleExcluir() {
    setPending(true);
    setErro(null);
    try {
      const res  = await fetch("/api/excluir-asp", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ aspId }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      } else {
        setErro(data.erro ?? "Erro ao excluir");
        setPending(false);
      }
    } catch (e: any) {
      setErro(e?.message ?? "Erro de rede");
      setPending(false);
    }
  }

  if (confirmar) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        <span className="text-xs text-red-700 font-medium">Excluir {nomeDoadora}?</span>
        <button
          onClick={handleExcluir}
          disabled={pending}
          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium disabled:opacity-50"
        >
          {pending ? "Apagando..." : "Sim"}
        </button>
        <button
          onClick={() => { setConfirmar(false); setErro(null); }}
          disabled={pending}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Não
        </button>
        {erro && <span className="text-red-500 text-[10px]">{erro}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmar(true)}
      title="Excluir aspiração"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 text-xs font-medium transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Excluir
    </button>
  );
}
