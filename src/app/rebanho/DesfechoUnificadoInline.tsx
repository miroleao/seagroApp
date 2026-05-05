"use client";

import { useState, useRef } from "react";
import { ClipboardList, X } from "lucide-react";
import { registrarDesfechoUnificado } from "./actions";

interface Props {
  animalId:           string;
  brinco:             string;
  isPrenha:           boolean;   // se tem prenhez ativa → mostra opções de parto/aborto
  transferId?:        string | null;
  tipoDesfechoAtual?: string | null;
  redirectTo?:        string;    // rota de redirect após salvar (default: /rebanho)
}

const OPCOES_PRENHA = [
  { value: "PARIDA",     label: "🐄 Nascimento", cor: "bg-green-600 hover:bg-green-700"   },
  { value: "ABORTOU",    label: "⚠️ Aborto",      cor: "bg-orange-500 hover:bg-orange-600" },
  { value: "REABSORVEU", label: "🔄 Absorção",    cor: "bg-yellow-500 hover:bg-yellow-600" },
];

const OPCOES_SEMPRE = [
  { value: "OBITO", label: "💀 Óbito",  cor: "bg-gray-800 hover:bg-gray-900" },
  { value: "VENDA", label: "💰 Venda",  cor: "bg-blue-600 hover:bg-blue-700" },
];

const LABEL_MAP: Record<string, string> = {
  PARIDA: "Nascimento", ABORTOU: "Aborto", REABSORVEU: "Absorção",
  OBITO: "Óbito", VENDA: "Vendida",
};

export function DesfechoUnificadoInline({
  animalId, brinco, isPrenha, transferId, tipoDesfechoAtual, redirectTo = "/rebanho",
}: Props) {
  const [open, setOpen]  = useState(false);
  const [tipo, setTipo]  = useState("");
  const [pos,  setPos]   = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const jaRegistrado = !!tipoDesfechoAtual && tipoDesfechoAtual !== "POSITIVO";
  const opcoes = isPrenha ? [...OPCOES_PRENHA, ...OPCOES_SEMPRE] : OPCOES_SEMPRE;

  function handleOpen() {
    if (!open && btnRef.current) {
      const r   = btnRef.current.getBoundingClientRect();
      const wh  = window.innerHeight;
      const popH = 340; // altura estimada do popover
      const top = r.bottom + popH > wh
        ? Math.max(4, r.top - popH - 4)  // abre para cima
        : r.bottom + 6;
      setPos({ top, right: window.innerWidth - r.right });
    }
    setTipo("");
    setOpen(o => !o);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title={jaRegistrado ? `Desfecho: ${LABEL_MAP[tipoDesfechoAtual!] ?? tipoDesfechoAtual}` : "Registrar desfecho"}
        className={`p-1.5 rounded-md transition-colors ${
          open
            ? "bg-brand-100 text-brand-600"
            : jaRegistrado
            ? "text-orange-500 bg-orange-50 hover:bg-orange-100"
            : "text-gray-300 hover:text-brand-500 hover:bg-brand-50"
        }`}
      >
        <ClipboardList className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Painel — fixed para não cortar na tabela */}
          <div
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-800">
                Desfecho — <span className="font-mono text-brand-700">{brinco}</span>
              </p>
              <button type="button" onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Seleção de tipo */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {opcoes.map(op => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setTipo(op.value)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                    tipo === op.value
                      ? `${op.cor} text-white border-transparent`
                      : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>

            {tipo && (
              <form action={registrarDesfechoUnificado} onSubmit={() => setOpen(false)}>
                <input type="hidden" name="animal_id"    value={animalId} />
                <input type="hidden" name="brinco"       value={brinco} />
                <input type="hidden" name="tipo"         value={tipo} />
                <input type="hidden" name="redirect_to"  value={redirectTo} />
                {transferId && <input type="hidden" name="transfer_id" value={transferId} />}

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                      Data
                    </label>
                    <input name="data_evento" type="date" required
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>

                  {/* Campos do bezerro — só aparecem no Nascimento */}
                  {tipo === "PARIDA" && (
                    <>
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                          Sexo do Bezerro <span className="text-red-400">*</span>
                        </label>
                        <div className="flex gap-2">
                          {[{ v: "F", label: "🐮 Fêmea" }, { v: "M", label: "🐂 Macho" }].map(op => (
                            <label key={op.v} className="flex-1 flex items-center justify-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="bezerro_sexo"
                                value={op.v}
                                required
                                className="accent-brand-600"
                              />
                              <span className="text-xs font-medium text-gray-700">{op.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                          Nome do Bezerro
                        </label>
                        <input name="bezerro_nome" type="text"
                          placeholder="Nome do filhote…"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                          RGN do Bezerro
                        </label>
                        <input name="bezerro_rgn" type="text"
                          placeholder="Registro genealógico…"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                      </div>
                    </>
                  )}

                  {tipo === "VENDA" && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                        Valor de Venda (R$)
                      </label>
                      <input name="valor" type="number" step="0.01" min="0"
                        placeholder="Ex: 4500.00"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-gray-400 font-medium block mb-1">
                      {tipo === "VENDA" ? "Comprador / Destino" : "Observações"}
                    </label>
                    <input name="observacoes" type="text"
                      placeholder={tipo === "VENDA" ? "Nome do comprador, leilão…" : "Causa, circunstâncias…"}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setOpen(false)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 text-gray-500 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit"
                    className="flex-1 text-xs text-white rounded-lg py-1.5 font-medium transition-colors bg-brand-600 hover:bg-brand-700">
                    Registrar
                  </button>
                </div>
              </form>
            )}

            {!tipo && (
              <p className="text-[11px] text-gray-400 text-center py-1">
                Selecione o tipo de desfecho acima
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
