"use client";

import { useState, useTransition } from "react";
import { UserMinus, X, Loader2 } from "lucide-react";
import { registrarDesfecho } from "@/lib/actions/desfecho";

interface Props {
  animalId:   string;
  nome:       string;
  tipoAnimal: "TOURO" | "DOADORA";
}

export function DesfechoBtn({ animalId, nome, tipoAnimal }: Props) {
  const [open, setOpen]             = useState(false);
  const [tipo, setTipo]             = useState<"OBITO" | "VENDA" | "">("");
  const [data, setData]             = useState("");
  const [valor, setValor]           = useState("");
  const [obs, setObs]               = useState("");
  const [erro, setErro]             = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function fechar() {
    setOpen(false);
    setTipo("");
    setData("");
    setValor("");
    setObs("");
    setErro(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo || !data) {
      setErro("Selecione o tipo e informe a data.");
      return;
    }
    setErro(null);
    const fd = new FormData();
    fd.append("animal_id",   animalId);
    fd.append("tipo",        tipo);
    fd.append("tipo_animal", tipoAnimal);
    fd.append("data_evento", data);
    fd.append("valor",       valor);
    fd.append("observacoes", obs);

    startTransition(async () => {
      const res = await registrarDesfecho(fd);
      if (res.ok) {
        fechar();
      } else {
        setErro(res.erro ?? "Erro ao registrar desfecho");
      }
    });
  }

  const tipoLabel = tipoAnimal === "TOURO" ? "Touro" : "Doadora";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Registrar óbito ou venda"
        className={`p-1 rounded transition-colors ${
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
          <div className="fixed inset-0 z-40" onClick={fechar} />

          {/* Painel */}
          <div className="absolute right-0 top-8 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-800 truncate max-w-[200px]">
                Desfecho — <span className="text-red-600">{nome}</span>
              </p>
              <button
                type="button"
                onClick={fechar}
                className="text-gray-400 hover:text-gray-600 p-0.5 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
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
                </div>

                {/* Data */}
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>

                {/* Valor — só venda */}
                {tipo === "VENDA" && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                      Valor de Venda (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      placeholder={`Ex: 4500,00`}
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
                    type="text"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder={
                      tipo === "VENDA"
                        ? "Comprador, leilão…"
                        : "Causa, circunstâncias…"
                    }
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              </div>

              {erro && <p className="text-[11px] text-red-600 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={isPending}
                  className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!tipo || !data || isPending}
                  className={`flex-1 inline-flex items-center justify-center gap-1 text-xs text-white rounded-lg py-1.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    tipo === "VENDA"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : tipo === "OBITO"
                      ? "bg-gray-800 hover:bg-gray-900"
                      : "bg-gray-300"
                  }`}
                >
                  {isPending
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>
                    : `Registrar`}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
