"use client";

import { useState, useTransition } from "react";
import { ClipboardList, X, Check, Loader2 } from "lucide-react";
import { registrarDesfechoTransfer } from "./actions";
import { useRouter } from "next/navigation";

interface Props {
  transferId: string;
  receptoraId: string;
  animaisDisponiveis: { id: string; nome: string; tipo: string }[];
}

const DESFECHOS = [
  { value: "PARIDA",     label: "Parida"    },
  { value: "FALHADA",    label: "Falhada"   },
  { value: "ABORTOU",    label: "Abortou"   },
  { value: "REABSORVEU", label: "Reabsorveu"},
];

export function MarcarDesfechoHistorico({ transferId, receptoraId, animaisDisponiveis }: Props) {
  const [aberto, setAberto]         = useState(false);
  const [desfecho, setDesfecho]     = useState("PARIDA");
  const [data, setData]             = useState("");
  const [busca, setBusca]           = useState("");
  const [selecionado, setSelecionado] = useState<{ id: string; nome: string; tipo: string } | null>(null);
  const [pending, startTransition]  = useTransition();
  const [erro, setErro]             = useState<string | null>(null);
  const router = useRouter();

  const isParida = desfecho === "PARIDA";

  const filtrados = busca.length >= 2
    ? animaisDisponiveis
        .filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
        .slice(0, 8)
    : [];

  function fechar() {
    setAberto(false); setErro(null);
    setBusca(""); setSelecionado(null); setData("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("transfer_id",   transferId);
    fd.append("receptora_id",  receptoraId);
    fd.append("tipo_desfecho", desfecho);
    if (data)        fd.append("data_desfecho",     data);
    if (selecionado) fd.append("animal_nascido_id", selecionado.id);

    startTransition(async () => {
      const res = await registrarDesfechoTransfer(fd);
      if (res.ok) { router.refresh(); fechar(); }
      else setErro(res.erro ?? "Erro ao registrar desfecho");
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1.5 transition-colors font-medium mt-1.5"
      >
        <ClipboardList className="w-3 h-3" />
        Registrar desfecho
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2.5 bg-white border border-amber-200 rounded-lg p-3 max-w-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">Registrar desfecho desta TE</p>
        <button type="button" onClick={fechar} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tipo de desfecho */}
      <div className="grid grid-cols-2 gap-1">
        {DESFECHOS.map(d => (
          <button
            key={d.value}
            type="button"
            onClick={() => { setDesfecho(d.value); setSelecionado(null); setBusca(""); }}
            className={`text-xs px-2 py-1.5 rounded-lg border font-medium transition-colors ${
              desfecho === d.value
                ? d.value === "PARIDA"
                  ? "bg-green-50 border-green-300 text-green-800"
                  : "bg-red-50 border-red-200 text-red-700"
                : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Data */}
      <div>
        <label className="text-[11px] text-gray-500 block mb-1">
          {isParida ? "Data do parto" : "Data"}
        </label>
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      {/* Bezerro (apenas se PARIDA) */}
      {isParida && (
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Bezerro(a) nascido</label>
          {selecionado ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 rounded px-2 py-1 font-medium">
                {selecionado.tipo === "TOURO" ? "🐂" : "🐄"} {selecionado.nome}
              </span>
              <button type="button" onClick={() => setSelecionado(null)} className="text-gray-400 hover:text-gray-600">
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
                autoComplete="off"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              />
              {filtrados.length > 0 && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {filtrados.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setSelecionado(a); setBusca(""); }}
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
          <p className="text-[11px] text-gray-400 mt-1">Opcional — pode vincular depois</p>
        </div>
      )}

      {erro && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{erro}</p>}

      <button
        type="submit"
        disabled={pending || !desfecho}
        className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        {pending ? "Salvando…" : "Confirmar desfecho"}
      </button>
    </form>
  );
}
