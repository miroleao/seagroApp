"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

interface Props {
  sessionIds: string[];
  label: string;
}

export function BotaoExcluirSessao({ sessionIds, label }: Props) {
  const [confirmar, setConfirmar] = useState(false);
  const [pending,   setPending]   = useState(false);
  const [erro,      setErro]      = useState<string | null>(null);

  async function handleExcluir() {
    setPending(true);
    setErro(null);
    try {
      const res  = await fetch("/api/excluir-sessao", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionIds }),
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
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        <span className="text-xs text-red-700 font-medium">Apagar sessão de {label}?</span>
        <button
          onClick={handleExcluir}
          disabled={pending}
          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded font-medium disabled:opacity-50"
        >
          {pending ? "Apagando..." : "Apagar tudo"}
        </button>
        <button
          onClick={() => { setConfirmar(false); setErro(null); }}
          disabled={pending}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
        {erro && <span className="text-red-500 text-[10px]">{erro}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmar(true)}
      title="Apagar sessão"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 text-[11px] font-medium transition-colors"
    >
      <Trash2 className="w-3 h-3" />
      Apagar
    </button>
  );
}
